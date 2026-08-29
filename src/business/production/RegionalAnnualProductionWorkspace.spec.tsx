import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RealtimeApiClient } from "@/platform/api/realtimeApiClient";
import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";
import { RegionalAnnualProductionWorkspace } from "./RegionalAnnualProductionWorkspace";

afterEach(cleanup);

describe("RegionalAnnualProductionWorkspace", () => {
  it("saves county area and yield and shows backend-calculated output", async () => {
    const get = vi.fn().mockImplementation((path: string) =>
      Promise.resolve(
        path.includes("regional-crop-summary")
          ? {
              regionCode: "230200",
              regionName: "齐齐哈尔市",
              administrativeLevel: "PREFECTURE",
              year: 2026,
              productCode: "CORN",
              plantedAreaMu: "1500000",
              yieldPerMuKg: "650",
              totalOutputKg: null,
              areaChangeWanMu: null,
              areaChangeRatePercent: null,
              currentDataAvailable: true,
              comparisonAvailable: false,
              areaChangeRateAvailable: false,
              comparisonMessage: "缺少上年数据",
            }
          : [
              {
                regionCode: "230221",
                regionName: "龙江县",
                prefectureCode: "230200",
                dataYear: 2026,
                productCode: "CORN",
                plantedAreaMu: null,
                yieldPerMuKg: null,
                totalOutputKg: null,
                version: 0,
                updatedAt: null,
              },
            ],
      ),
    );
    const put = vi.fn().mockResolvedValue({
      regionCode: "230221",
      regionName: "龙江县",
      prefectureCode: "230200",
      dataYear: 2026,
      productCode: "CORN",
      plantedAreaMu: "689300.0000",
      yieldPerMuKg: "171.0000",
      totalOutputKg: "117870300.0000",
      version: 1,
      updatedAt: "2026-08-28T08:00:00Z",
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
    } as unknown as RealtimeBusinessRepository;

    render(
      <RegionalAnnualProductionWorkspace
        api={api}
        authorizedRegionCodes={["*"]}
        repository={repository}
      />,
    );

    expect(
      await screen.findByText("齐齐哈尔市（市级汇总）"),
    ).toBeInTheDocument();
    const countyRow = screen.getByRole("row", { name: /龙江县/ });
    expect(within(countyRow).getByText("未填写")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("龙江县播种面积"), {
      target: { value: "68.93" },
    });
    fireEvent.change(screen.getByLabelText("龙江县单产"), {
      target: { value: "171" },
    });
    expect(within(countyRow).getByText("11.79")).toBeInTheDocument();
    expect(within(countyRow).getByText("待保存")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "保存龙江县" }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        "/api/v1/production/regional-annual-stats/230221",
        expect.objectContaining({
          dataYear: 2026,
          productCode: "CORN",
          plantedAreaMu: "689300",
          yieldPerMuKg: "171",
          expectedVersion: 0,
        }),
      ),
    );
    expect(await within(countyRow).findByText("已保存")).toBeInTheDocument();
  });

  it("saves planted area while yield is not yet available", async () => {
    const get = vi.fn().mockImplementation((path: string) =>
      Promise.resolve(
        path.includes("regional-crop-summary")
          ? {
              regionCode: "230200",
              regionName: "齐齐哈尔市",
              administrativeLevel: "PREFECTURE",
              year: 2026,
              productCode: "CORN",
              plantedAreaMu: null,
              yieldPerMuKg: null,
              totalOutputKg: null,
              currentDataAvailable: false,
            }
          : [],
      ),
    );
    const put = vi.fn().mockResolvedValue({
      regionCode: "230202",
      regionName: "龙沙区",
      prefectureCode: "230200",
      dataYear: 2026,
      productCode: "CORN",
      plantedAreaMu: "17780.0000",
      yieldPerMuKg: null,
      totalOutputKg: null,
      version: 0,
      updatedAt: "2026-08-28T08:00:00Z",
    });
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
            code: "230202",
            name: "龙沙区",
            parentCode: "230200",
            level: "COUNTY",
          },
        ],
      }),
    } as unknown as RealtimeBusinessRepository;

    render(
      <RegionalAnnualProductionWorkspace
        api={{ get, put } as unknown as RealtimeApiClient}
        authorizedRegionCodes={["*"]}
        repository={repository}
      />,
    );

    await screen.findByText("齐齐哈尔市（市级汇总）");
    fireEvent.change(screen.getByLabelText("龙沙区播种面积"), {
      target: { value: "1.778" },
    });
    await userEvent.click(screen.getByRole("button", { name: "保存龙沙区" }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        "/api/v1/production/regional-annual-stats/230202",
        expect.objectContaining({
          plantedAreaMu: "17780",
          yieldPerMuKg: null,
          expectedVersion: 0,
        }),
      ),
    );
    expect(await screen.findByText("已保存")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps a successful save truthful when the summary refresh fails", async () => {
    let summaryCalls = 0;
    const get = vi.fn().mockImplementation((path: string) => {
      if (!path.includes("regional-crop-summary")) return Promise.resolve([]);
      summaryCalls += 1;
      if (summaryCalls > 1) return Promise.reject(new Error("summary offline"));
      return Promise.resolve({
        regionCode: "230200",
        regionName: "齐齐哈尔市",
        administrativeLevel: "PREFECTURE",
        year: 2026,
        productCode: "CORN",
        plantedAreaMu: null,
        yieldPerMuKg: null,
        totalOutputKg: null,
        currentDataAvailable: false,
      });
    });
    const put = vi.fn().mockResolvedValue({
      regionCode: "230221",
      regionName: "龙江县",
      prefectureCode: "230200",
      dataYear: 2026,
      productCode: "CORN",
      plantedAreaMu: "10000.0000",
      yieldPerMuKg: "500.0000",
      totalOutputKg: "5000000.0000",
      version: 0,
      updatedAt: "2026-08-28T08:00:00Z",
    });
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
    } as unknown as RealtimeBusinessRepository;

    render(
      <RegionalAnnualProductionWorkspace
        api={{ get, put } as unknown as RealtimeApiClient}
        authorizedRegionCodes={["*"]}
        repository={repository}
      />,
    );
    await screen.findByText("齐齐哈尔市（市级汇总）");
    fireEvent.change(screen.getByLabelText("龙江县播种面积"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("龙江县单产"), {
      target: { value: "500" },
    });
    await userEvent.click(screen.getByRole("button", { name: "保存龙江县" }));

    expect(await screen.findByText("已保存")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "数据已保存，市级汇总刷新失败，请稍后重试。",
    );
  });

  it("does not apply an old-scope save response after the year changes", async () => {
    let resolvePut!: (value: unknown) => void;
    const pendingPut = new Promise((resolve) => {
      resolvePut = resolve;
    });
    const get = vi
      .fn()
      .mockImplementation((path: string, params?: Record<string, unknown>) =>
        Promise.resolve(
          path.includes("regional-crop-summary")
            ? {
                regionCode: "230200",
                regionName: "齐齐哈尔市",
                administrativeLevel: "PREFECTURE",
                year: Number(params?.year),
                productCode: "CORN",
                plantedAreaMu: null,
                yieldPerMuKg: null,
                totalOutputKg: null,
                currentDataAvailable: false,
              }
            : [],
        ),
      );
    const put = vi.fn().mockReturnValue(pendingPut);
    const repository = {
      loadMasterData: vi.fn().mockResolvedValue({
        products: [{ code: "CORN", name: "玉米" }],
        periods: [],
        approvedSurveyYears: [2026, 2025],
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
    } as unknown as RealtimeBusinessRepository;

    render(
      <RegionalAnnualProductionWorkspace
        api={{ get, put } as unknown as RealtimeApiClient}
        authorizedRegionCodes={["*"]}
        repository={repository}
      />,
    );
    await screen.findByText("齐齐哈尔市（市级汇总）");
    fireEvent.change(screen.getByLabelText("龙江县播种面积"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("龙江县单产"), {
      target: { value: "500" },
    });
    await userEvent.click(screen.getByRole("button", { name: "保存龙江县" }));
    await waitFor(() => expect(put).toHaveBeenCalledOnce());

    fireEvent.change(screen.getByLabelText("地区产情年度"), {
      target: { value: "2025" },
    });
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(
        "/api/v1/production/regional-annual-stats",
        expect.objectContaining({ year: 2025 }),
      ),
    );
    resolvePut({
      regionCode: "230221",
      regionName: "龙江县",
      prefectureCode: "230200",
      dataYear: 2026,
      productCode: "CORN",
      plantedAreaMu: "10000.0000",
      yieldPerMuKg: "500.0000",
      totalOutputKg: "5000000.0000",
      version: 0,
      updatedAt: "2026-08-28T08:00:00Z",
    });

    await waitFor(() =>
      expect(screen.getByLabelText("龙江县播种面积")).toHaveValue(null),
    );
    expect(screen.getByLabelText("地区产情年度")).toHaveValue("2025");
    expect(screen.queryByText("已保存")).not.toBeInTheDocument();
  });

  it("blocks stale regional values while a newly selected product is loading", async () => {
    const pending = new Promise(() => undefined);
    const stat = {
      regionCode: "230221",
      regionName: "龙江县",
      prefectureCode: "230200",
      dataYear: 2026,
      productCode: "CORN",
      plantedAreaMu: "1500000.0000",
      yieldPerMuKg: "650.0000",
      totalOutputKg: "975000000.0000",
      version: 4,
      updatedAt: "2026-08-28T08:00:00Z",
    };
    const summary = {
      regionCode: "230200",
      regionName: "齐齐哈尔市",
      administrativeLevel: "PREFECTURE",
      year: 2026,
      productCode: "CORN",
      plantedAreaMu: "1500000",
      yieldPerMuKg: "650",
      totalOutputKg: "975000000",
      currentDataAvailable: true,
    };
    const get = vi
      .fn()
      .mockResolvedValueOnce([stat])
      .mockResolvedValueOnce(summary)
      .mockReturnValue(pending);
    const put = vi.fn();
    const repository = {
      loadMasterData: vi.fn().mockResolvedValue({
        products: [
          { code: "CORN", name: "玉米" },
          { code: "SOYBEAN", name: "大豆" },
        ],
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
    } as unknown as RealtimeBusinessRepository;

    render(
      <RegionalAnnualProductionWorkspace
        api={{ get, put } as unknown as RealtimeApiClient}
        authorizedRegionCodes={["*"]}
        repository={repository}
      />,
    );

    expect(await screen.findByDisplayValue("150")).toBeInTheDocument();
    await userEvent.selectOptions(
      screen.getByLabelText("地区产情品种"),
      "SOYBEAN",
    );

    expect(screen.getByLabelText("龙江县播种面积")).toBeDisabled();
    expect(screen.getByLabelText("龙江县播种面积")).toHaveValue(null);
    expect(screen.getByRole("button", { name: "保存龙江县" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "当前地区、年度和品种正在加载",
    );
    expect(put).not.toHaveBeenCalled();
  });

  it("keeps regional saving disabled when the newly selected scope fails to load", async () => {
    const stat = {
      regionCode: "230221",
      regionName: "龙江县",
      prefectureCode: "230200",
      dataYear: 2026,
      productCode: "CORN",
      plantedAreaMu: "1500000.0000",
      yieldPerMuKg: "650.0000",
      totalOutputKg: "975000000.0000",
      version: 4,
      updatedAt: "2026-08-28T08:00:00Z",
    };
    const summary = {
      regionCode: "230200",
      regionName: "齐齐哈尔市",
      administrativeLevel: "PREFECTURE",
      year: 2026,
      productCode: "CORN",
      plantedAreaMu: "1500000",
      yieldPerMuKg: "650",
      totalOutputKg: "975000000",
      currentDataAvailable: true,
    };
    const get = vi
      .fn()
      .mockResolvedValueOnce([stat])
      .mockResolvedValueOnce(summary)
      .mockRejectedValue(new Error("read failed"));
    const put = vi.fn();
    const repository = {
      loadMasterData: vi.fn().mockResolvedValue({
        products: [
          { code: "CORN", name: "玉米" },
          { code: "SOYBEAN", name: "大豆" },
        ],
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
    } as unknown as RealtimeBusinessRepository;

    render(
      <RegionalAnnualProductionWorkspace
        api={{ get, put } as unknown as RealtimeApiClient}
        authorizedRegionCodes={["*"]}
        repository={repository}
      />,
    );

    expect(await screen.findByDisplayValue("150")).toBeInTheDocument();
    await userEvent.selectOptions(
      screen.getByLabelText("地区产情品种"),
      "SOYBEAN",
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "地区产情读取失败，请重试。",
    );
    expect(screen.getByLabelText("龙江县播种面积")).toBeDisabled();
    expect(screen.getByRole("button", { name: "保存龙江县" })).toBeDisabled();
    expect(put).not.toHaveBeenCalled();
  });

  it("revalidates a previously loaded regional scope after a failed scope switch", async () => {
    const pending = new Promise(() => undefined);
    const stat = {
      regionCode: "230221",
      regionName: "龙江县",
      prefectureCode: "230200",
      dataYear: 2026,
      productCode: "CORN",
      plantedAreaMu: "1500000.0000",
      yieldPerMuKg: "650.0000",
      totalOutputKg: "975000000.0000",
      version: 4,
      updatedAt: "2026-08-28T08:00:00Z",
    };
    const summary = {
      regionCode: "230200",
      regionName: "齐齐哈尔市",
      administrativeLevel: "PREFECTURE",
      year: 2026,
      productCode: "CORN",
      plantedAreaMu: "1500000",
      yieldPerMuKg: "650",
      totalOutputKg: "975000000",
      currentDataAvailable: true,
    };
    const get = vi
      .fn()
      .mockResolvedValueOnce([stat])
      .mockResolvedValueOnce(summary)
      .mockRejectedValueOnce(new Error("soybean stats failed"))
      .mockRejectedValueOnce(new Error("soybean summary failed"))
      .mockReturnValue(pending);
    const repository = {
      loadMasterData: vi.fn().mockResolvedValue({
        products: [
          { code: "CORN", name: "玉米" },
          { code: "SOYBEAN", name: "大豆" },
        ],
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
    } as unknown as RealtimeBusinessRepository;

    render(
      <RegionalAnnualProductionWorkspace
        api={{ get, put: vi.fn() } as unknown as RealtimeApiClient}
        authorizedRegionCodes={["*"]}
        repository={repository}
      />,
    );

    expect(await screen.findByDisplayValue("150")).toBeInTheDocument();
    await userEvent.selectOptions(
      screen.getByLabelText("地区产情品种"),
      "SOYBEAN",
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "地区产情读取失败，请重试。",
    );

    await userEvent.selectOptions(
      screen.getByLabelText("地区产情品种"),
      "CORN",
    );

    expect(screen.getByLabelText("龙江县播种面积")).toBeDisabled();
    expect(screen.getByLabelText("龙江县播种面积")).toHaveValue(null);
    expect(screen.getByRole("button", { name: "保存龙江县" })).toBeDisabled();
  });
});
