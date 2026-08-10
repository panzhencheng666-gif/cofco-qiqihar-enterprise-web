import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";

import { RealtimeAnnualComparisonPanel } from "./RealtimeAnnualComparisonPanel";

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
          code: "230208",
          name: "梅里斯达斡尔族区",
          parentCode: "230200",
          level: "COUNTY",
        },
        {
          code: "230208101",
          name: "达呼店镇",
          parentCode: "230208",
          level: "TOWNSHIP",
        },
        {
          code: "230208101001",
          name: "音钦村",
          parentCode: "230208101",
          level: "VILLAGE",
        },
      ],
    }),
    listAnnualComparisonDefinitions: vi.fn().mockResolvedValue([
      {
        code: "PRODUCTION_CULTIVATED_AREA",
        name: "核定播种面积",
        unitCode: "亩",
        sourceDomain: "PRODUCTION",
        aggregationCode: "SUM",
      },
      {
        code: "PRODUCTION_PROD_OPENING_INVENTORY",
        name: "产情核定期初库存",
        unitCode: "吨",
        sourceDomain: "PRODUCTION",
        aggregationCode: "SUM",
      },
      {
        code: "PRODUCTION_MOISTURE",
        name: "产情核定水分",
        unitCode: "%",
        sourceDomain: "PRODUCTION",
        aggregationCode: "AVERAGE",
      },
    ]),
    listCultivars: vi
      .fn()
      .mockResolvedValue([
        { code: "XIAN_YU_335", name: "先玉335", productCode: "CORN" },
      ]),
    loadAnnualComparison: vi.fn().mockResolvedValue({
      indicatorCode: "PRODUCTION_CULTIVATED_AREA",
      indicatorName: "种植面积",
      sourceDomain: "PRODUCTION",
      productCode: "CORN",
      cultivarCode: null,
      regionCode: "230200",
      surveyYear: 2026,
      cutoffPeriodCode: null,
      unitCode: "亩",
      methodologyVersion: "internal",
      points: [
        point("2026", 130, "2026-08-09T00:00:00Z"),
        point("2025", 120, "2025-08-09T00:00:00Z"),
        point("2024", 100, "2024-08-09T00:00:00Z"),
        point("2023", 80, "2023-08-09T00:00:00Z"),
      ],
    }),
  } as unknown as RealtimeBusinessRepository;
}

function point(businessYear: string, value: number, dataCutoff: string) {
  return {
    businessYear,
    value,
    sourcePublicationVersion: "approved",
    dataCutoff,
    missingReason: null,
  };
}

describe("realtime annual comparison panel", () => {
  it("shows the current year and previous three years with business filters", async () => {
    const api = repository();
    const loadAnnualComparison = vi.spyOn(api, "loadAnnualComparison");
    const user = userEvent.setup();
    render(
      <RealtimeAnnualComparisonPanel domain="production" repository={api} />,
    );

    expect(
      await screen.findByRole("heading", { name: "产情年度对比分析" }),
    ).toBeVisible();
    expect(
      await screen.findByRole("img", { name: "种植面积四年对比柱状图" }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", { name: "种植面积四年趋势折线图" }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", { name: "种植面积四年合计占比环图" }),
    ).toBeVisible();
    expect(screen.getAllByText("2023年").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2026年").length).toBeGreaterThan(0);
    expect(screen.getByText("同比 +8.3%")).toBeVisible();
    expect(screen.queryByLabelText("产品或作物")).not.toBeInTheDocument();
    expect(screen.getByLabelText("具体品种")).toBeVisible();
    expect(screen.getByRole("group", { name: "统计地区" })).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "搜索地级市" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "区县" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "乡镇" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "行政村" })).toBeVisible();
    expect(screen.queryByLabelText("统计时间")).not.toBeInTheDocument();
    expect(screen.getByLabelText("调查年度")).toHaveValue("2026");
    expect(screen.getByText("当前范围：玉米 · 2026调查年度")).toBeVisible();
    expect(screen.getByLabelText("分析指标")).toBeVisible();
    expect(screen.getByLabelText("分析指标")).toHaveTextContent(
      "产情核定期初库存",
    );
    expect(screen.getByLabelText("分析指标")).toHaveTextContent("产情核定水分");
    expect(screen.queryByText("internal")).not.toBeInTheDocument();
    expect(loadAnnualComparison).toHaveBeenCalledWith(
      expect.objectContaining({ surveyYear: 2026 }),
    );
    expect(loadAnnualComparison).not.toHaveBeenCalledWith(
      expect.objectContaining({ periodCode: expect.anything() }),
    );

    await user.selectOptions(screen.getByLabelText("调查年度"), "2025");
    await waitFor(() =>
      expect(loadAnnualComparison).toHaveBeenLastCalledWith(
        expect.objectContaining({ surveyYear: 2025 }),
      ),
    );

    await user.hover(
      screen.getByRole("button", { name: "折线图 2024年 100 亩" }),
    );
    expect(
      screen.getByRole("status", { name: "当前图表数据" }),
    ).toHaveTextContent("2024年");
    expect(
      screen.getByRole("status", { name: "当前图表数据" }),
    ).toHaveTextContent("100 亩");

    await user.selectOptions(screen.getByLabelText("具体品种"), "XIAN_YU_335");
    await waitFor(() =>
      expect(loadAnnualComparison).toHaveBeenLastCalledWith(
        expect.objectContaining({ cultivarCode: "XIAN_YU_335" }),
      ),
    );

    await user.selectOptions(
      screen.getByLabelText("分析指标"),
      "PRODUCTION_PROD_OPENING_INVENTORY",
    );
    await waitFor(() =>
      expect(loadAnnualComparison).toHaveBeenLastCalledWith(
        expect.objectContaining({
          indicatorCode: "PRODUCTION_PROD_OPENING_INVENTORY",
        }),
      ),
    );
  });

  it("uses the same survey-year-only filter for market analysis", async () => {
    const api = repository();
    const loadAnnualComparison = vi.spyOn(api, "loadAnnualComparison");
    const listDefinitions = vi.spyOn(api, "listAnnualComparisonDefinitions");

    render(<RealtimeAnnualComparisonPanel domain="market" repository={api} />);

    expect(
      await screen.findByRole("heading", { name: "市场年度对比分析" }),
    ).toBeVisible();
    expect(screen.getByLabelText("调查年度")).toHaveValue("2026");
    expect(screen.queryByLabelText("调查月份")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("填报日期起")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(listDefinitions).toHaveBeenCalledWith("MARKET", "CORN"),
    );
    await waitFor(() =>
      expect(loadAnnualComparison).toHaveBeenCalledWith(
        expect.objectContaining({ surveyYear: 2026 }),
      ),
    );
  });
});
