import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RealtimeApiClient } from "@/platform/api/realtimeApiClient";
import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";
import { SupplyBalanceWorkspace } from "./SupplyBalanceWorkspace";

afterEach(cleanup);

describe("SupplyBalanceWorkspace", () => {
  it("keeps automatic production read-only and saves only manual product rows", async () => {
    const response = {
      regionCode: "230221",
      regionName: "龙江县",
      administrativeLevel: "COUNTY",
      surveyYear: 2026,
      productCode: "CORN",
      regionalProductionAvailable: true,
      version: 0,
      updatedAt: null,
      rows: [
        {
          code: "PLANTED_AREA",
          label: "播种面积",
          kind: "AUTO",
          unit: "万公顷",
          requirement: "地区产情自动换算",
          value: "10",
          display: "10.00",
          note: null,
        },
        {
          code: "OPENING_INVENTORY",
          label: "期初库存",
          kind: "MANUAL",
          unit: "万吨",
          requirement: "手动填报",
          value: null,
          display: "—",
          note: null,
        },
        {
          code: "CLOSING_INVENTORY",
          label: "期末库存",
          kind: "DERIVED",
          unit: "万吨",
          requirement: "系统自动计算",
          value: null,
          display: "—",
          note: null,
        },
      ],
    };
    const get = vi.fn().mockResolvedValue(response);
    const put = vi.fn().mockResolvedValue({
      ...response,
      version: 1,
      rows: response.rows.map((row) =>
        row.code === "OPENING_INVENTORY"
          ? { ...row, value: "12.5", display: "12.50" }
          : row,
      ),
    });
    const api = { get, put } as unknown as RealtimeApiClient;
    const repository = {
      loadMasterData: vi.fn().mockResolvedValue({
        products: [{ code: "CORN", name: "玉米" }],
        periods: [],
        approvedSurveyYears: [2026],
        regions: [
          {
            code: "230200",
            name: "齐齐哈尔市",
            parentCode: null,
            level: "PREFECTURE",
          },
          {
            code: "230221",
            name: "龙江县",
            parentCode: "230200",
            level: "COUNTY",
          },
        ],
      }),
      listNotifications: vi
        .fn()
        .mockResolvedValue({ items: [], unreadCount: 0 }),
      subscribeBusinessEvents: vi.fn(() => vi.fn()),
    } as unknown as RealtimeBusinessRepository;

    render(
      <SupplyBalanceWorkspace
        api={api}
        authorizedRegionCodes={["*"]}
        repository={repository}
      />,
    );

    expect(await screen.findByText("10.00")).toBeInTheDocument();
    expect(screen.queryByLabelText("播种面积填报值")).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("期初库存填报值"), "12.5");
    await userEvent.click(screen.getByRole("button", { name: "保存供需平衡" }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        "/api/v1/supply-balances/230221/2026/CORN",
        { version: 0, manualValues: { OPENING_INVENTORY: "12.5" }, notes: {} },
      ),
    );
  });

  it("requeries the selected regional balance when regional production changes", async () => {
    let listener:
      | ((event: {
          sequence: number;
          aggregateType: string;
          aggregateId: string;
          actionCode: string;
          productCode: string;
          surveyYear: number;
          regionCodes: string[];
          occurredAt: string;
          read: boolean;
          id: string;
        }) => void)
      | undefined;
    const row = (display: string) => ({
      regionCode: "230221",
      regionName: "龙江县",
      administrativeLevel: "COUNTY",
      surveyYear: 2026,
      productCode: "CORN",
      regionalProductionAvailable: true,
      version: 0,
      updatedAt: null,
      rows: [
        {
          code: "PLANTED_AREA",
          label: "播种面积",
          kind: "AUTO" as const,
          unit: "万公顷",
          requirement: "地区产情自动换算",
          value: display,
          display,
          note: null,
        },
      ],
    });
    const get = vi
      .fn()
      .mockResolvedValueOnce(row("10.00"))
      .mockResolvedValue(row("12.00"));
    const repository = {
      loadMasterData: vi.fn().mockResolvedValue({
        products: [{ code: "CORN", name: "玉米" }],
        periods: [],
        approvedSurveyYears: [2026],
        regions: [
          {
            code: "230221",
            name: "龙江县",
            parentCode: "230200",
            level: "COUNTY",
          },
        ],
      }),
      listNotifications: vi
        .fn()
        .mockResolvedValue({ items: [], unreadCount: 0 }),
      subscribeBusinessEvents: vi.fn(
        (_after: number, next: typeof listener) => {
          listener = next;
          return vi.fn();
        },
      ),
    } as unknown as RealtimeBusinessRepository;

    render(
      <SupplyBalanceWorkspace
        api={{ get, put: vi.fn() } as unknown as RealtimeApiClient}
        authorizedRegionCodes={["*"]}
        repository={repository}
      />,
    );

    expect(await screen.findByText("10.00")).toBeInTheDocument();
    await waitFor(() => expect(listener).toBeDefined());
    act(() =>
      listener?.({
        id: "event-1",
        sequence: 1,
        aggregateType: "REGIONAL_CROP_ANNUAL_STAT",
        aggregateId: "230221|2026|CORN",
        actionCode: "REGIONAL_CROP_ANNUAL_STAT_UPSERTED",
        productCode: "CORN",
        surveyYear: 2026,
        regionCodes: ["230221", "230200"],
        occurredAt: "2026-08-28T20:00:00+08:00",
        read: false,
      }),
    );

    expect(await screen.findByText("12.00")).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("blocks saving stale values until the newly selected scope finishes loading", async () => {
    let resolveNext!: (value: unknown) => void;
    const nextScope = new Promise((resolve) => {
      resolveNext = resolve;
    });
    const balance = (surveyYear: number, value: string, version: number) => ({
      regionCode: "230221",
      regionName: "龙江县",
      administrativeLevel: "COUNTY",
      surveyYear,
      productCode: "CORN",
      regionalProductionAvailable: true,
      version,
      updatedAt: null,
      rows: [
        {
          code: "OPENING_INVENTORY",
          label: "期初库存",
          kind: "MANUAL" as const,
          unit: "万吨",
          requirement: "手动填报",
          value,
          display: value,
          note: null,
        },
      ],
    });
    const get = vi
      .fn()
      .mockResolvedValueOnce(balance(2026, "12.5", 7))
      .mockReturnValueOnce(nextScope);
    const put = vi
      .fn()
      .mockImplementation(
        (_path: string, body: { manualValues: Record<string, string> }) =>
          Promise.resolve({
            ...balance(2025, body.manualValues.OPENING_INVENTORY ?? "", 3),
          }),
      );
    const repository = {
      loadMasterData: vi.fn().mockResolvedValue({
        products: [{ code: "CORN", name: "玉米" }],
        periods: [],
        approvedSurveyYears: [2026, 2025],
        regions: [
          {
            code: "230221",
            name: "龙江县",
            parentCode: "230200",
            level: "COUNTY",
          },
        ],
      }),
      listNotifications: vi
        .fn()
        .mockResolvedValue({ items: [], unreadCount: 0 }),
      subscribeBusinessEvents: vi.fn(() => vi.fn()),
    } as unknown as RealtimeBusinessRepository;

    render(
      <SupplyBalanceWorkspace
        api={{ get, put } as unknown as RealtimeApiClient}
        authorizedRegionCodes={["*"]}
        repository={repository}
      />,
    );

    expect(await screen.findByDisplayValue("12.5")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("供需年度"), "2025");

    const saveButton = screen.getByRole("button", { name: "保存供需平衡" });
    expect(saveButton).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "当前地区、年度和品种正在加载",
    );
    expect(screen.queryByDisplayValue("12.5")).not.toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();

    resolveNext(balance(2025, "8.25", 2));
    expect(await screen.findByDisplayValue("8.25")).toBeInTheDocument();
    expect(saveButton).toBeEnabled();
    await userEvent.clear(screen.getByLabelText("期初库存填报值"));
    await userEvent.type(screen.getByLabelText("期初库存填报值"), "9");
    await userEvent.click(saveButton);

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        "/api/v1/supply-balances/230221/2025/CORN",
        { version: 2, manualValues: { OPENING_INVENTORY: "9" }, notes: {} },
      ),
    );
  });

  it("keeps saving disabled when the newly selected scope fails to load", async () => {
    const response = {
      regionCode: "230221",
      regionName: "龙江县",
      administrativeLevel: "COUNTY",
      surveyYear: 2026,
      productCode: "CORN",
      regionalProductionAvailable: true,
      version: 7,
      updatedAt: null,
      rows: [
        {
          code: "OPENING_INVENTORY",
          label: "期初库存",
          kind: "MANUAL" as const,
          unit: "万吨",
          requirement: "手动填报",
          value: "12.5",
          display: "12.50",
          note: null,
        },
      ],
    };
    const get = vi
      .fn()
      .mockResolvedValueOnce(response)
      .mockRejectedValueOnce(new Error("read failed"));
    const put = vi.fn();
    const repository = {
      loadMasterData: vi.fn().mockResolvedValue({
        products: [{ code: "CORN", name: "玉米" }],
        periods: [],
        approvedSurveyYears: [2026, 2025],
        regions: [
          {
            code: "230221",
            name: "龙江县",
            parentCode: "230200",
            level: "COUNTY",
          },
        ],
      }),
      listNotifications: vi
        .fn()
        .mockResolvedValue({ items: [], unreadCount: 0 }),
      subscribeBusinessEvents: vi.fn(() => vi.fn()),
    } as unknown as RealtimeBusinessRepository;

    render(
      <SupplyBalanceWorkspace
        api={{ get, put } as unknown as RealtimeApiClient}
        authorizedRegionCodes={["*"]}
        repository={repository}
      />,
    );

    expect(await screen.findByDisplayValue("12.5")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("供需年度"), "2025");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "供需平衡读取失败，请重试。",
    );
    expect(screen.getByRole("button", { name: "保存供需平衡" })).toBeDisabled();
    expect(screen.queryByDisplayValue("12.5")).not.toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });
});
