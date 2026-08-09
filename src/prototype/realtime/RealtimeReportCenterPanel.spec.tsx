import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";

import { RealtimeReportCenterPanel } from "./RealtimeReportCenterPanel";

afterEach(cleanup);

function repository() {
  return {
    loadMasterData: vi.fn().mockResolvedValue({
      products: [{ code: "CORN", name: "玉米" }],
      periods: [
        {
          code: "2026-W32",
          name: "2026年第32周",
          startsOn: "2026-08-03",
          endsOn: "2026-08-09",
        },
      ],
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
        {
          code: "230202100",
          name: "大民街道",
          parentCode: "230202",
          level: "TOWNSHIP",
        },
        {
          code: "230202100001",
          name: "大民村",
          parentCode: "230202100",
          level: "VILLAGE",
        },
      ],
    }),
    loadReportParameterOptions: vi.fn().mockResolvedValue({
      definitions: [
        definition("PRODUCTION_DAILY", "产情日报", "PRODUCTION"),
        definition("MARKET_DAILY", "市场日报", "MARKET"),
        definition("LOGISTICS_WEEKLY", "物流周报", "LOGISTICS"),
        definition("SUPPLY_MONTHLY", "供需月报", "SUPPLY"),
      ],
      formats: [{ code: "CSV", label: "CSV（中文列名）" }],
    }),
    createReportPreview: vi.fn().mockResolvedValue({
      id: "preview-1",
      definitionCode: "MARKET_DAILY",
      title: "齐齐哈尔市玉米市场日报",
      dataCutoffLabel: "2026年第32周",
      lines: [{ label: "核定数据条数", value: "12", note: "已核定业务数据" }],
      sections: [
        { code: "OVERVIEW", title: "总体概览", body: "已采用12条核定数据。" },
      ],
      expiresAt: "2026-08-09T14:00:00Z",
    }),
  } as unknown as RealtimeBusinessRepository;
}

function definition(code: string, name: string, businessDomain: string) {
  return {
    code,
    name,
    businessDomain,
    businessSubtype: "MONITORING",
    frequencyCode: "DAILY",
    sections: [],
  };
}

describe("realtime report center", () => {
  it("requires an explicit business scope and previews only that scope before export", async () => {
    const api = repository();
    const createReportPreview = vi.spyOn(api, "createReportPreview");
    const user = userEvent.setup();
    render(<RealtimeReportCenterPanel repository={api} />);

    expect(
      await screen.findByRole("heading", { name: "业务报告" }),
    ).toBeVisible();
    expect(screen.queryByText(/综合/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("报告类型")).toHaveTextContent(
      "产情日报市场日报物流周报供需月报",
    );
    expect(screen.queryByLabelText("具体品种")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "统计地区" })).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "搜索地级市" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "地级市" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "区县" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "乡镇" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "行政村" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "导出当前报告" }),
    ).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("报告类型"), "MARKET_DAILY");
    await user.click(screen.getByRole("button", { name: "生成报告预览" }));

    await waitFor(() =>
      expect(createReportPreview).toHaveBeenCalledWith({
        definitionCode: "MARKET_DAILY",
        productCode: "CORN",
        regionLevel: "PREFECTURE",
        regionCode: "230200",
        periodCode: "2026-W32",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "齐齐哈尔市玉米市场日报" }),
    ).toBeVisible();
    expect(screen.getByText("12")).toBeVisible();
    expect(screen.getByRole("button", { name: "导出当前报告" })).toBeVisible();
  });
});
