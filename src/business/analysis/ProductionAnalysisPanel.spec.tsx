import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { validSnapshot } from "@/platform/api/observableAnalysisContract.fixture";
import type { ObservableAnalysisQuery } from "@/platform/api/observableAnalysisContract";
import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";
import { ProductionAnalysisPanel } from "./ProductionAnalysisPanel";

afterEach(cleanup);

function repository(): RealtimeBusinessRepository {
  const snapshot = validSnapshot();
  return {
    loadMasterData: vi.fn().mockResolvedValue({
      products: [{ code: "CORN", name: "玉米" }],
      periods: [],
      regions: [
        {
          code: "230200",
          name: "齐齐哈尔市",
          parentCode: null,
          level: "PREFECTURE",
        },
      ],
    }),
    loadObservableAnalysisSnapshot: vi.fn().mockResolvedValue({
      ...snapshot,
      production: {
        ...snapshot.production,
        metrics: [
          metric("CULTIVATED_AREA", "核定播种面积", "100.0000", "亩"),
          metric("HARVEST_AREA", "预计收获面积", "90.0000", "亩"),
          metric(
            "WEIGHTED_YIELD_PER_MU",
            "加权预计单产",
            "500.0000",
            "公斤/亩",
          ),
          metric("EXPECTED_OUTPUT", "预计总产", "50.0000", "吨"),
          metric("EXPECTED_HARVEST_RATE", "预计收获率", "90.0000", "%"),
          metric("AFFECTED_AREA", "灾损面积", "5.0000", "亩"),
          metric("AFFECTED_AREA_RATE", "灾损面积占比", "5.0000", "%"),
          metric("QUALITY_MOISTURE_AVERAGE", "水分平均值", "14.0000", "%"),
          metric("QUALITY_MOISTURE_MINIMUM", "水分最低值", "13.0000", "%"),
          metric("QUALITY_MOISTURE_MAXIMUM", "水分最高值", "15.0000", "%"),
          metric("COST_LAND_RENT", "地租", "600.0000", "元/亩"),
          metric(
            "COMPLETE_COST_PER_MU",
            "完整亩均成本合计",
            "900.0000",
            "元/亩",
          ),
          metric("INSURANCE_AMOUNT", "保险金额", "1000.0000", "元"),
          metric("SUBSIDY_AMOUNT", "补贴金额", "500.0000", "元"),
          metric("INTENDED_AREA", "下年度意向面积", "105.0000", "亩"),
          metric("INTENDED_AREA_CHANGE", "面积调整量", "5.0000", "亩"),
          metric("INTENDED_AREA_CHANGE_RATE", "面积调整比例", "5.0000", "%"),
        ],
      },
    }),
    getSampleNetworkComparison: vi
      .fn()
      .mockResolvedValue(sampleNetworkCoverage()),
    listNotifications: vi.fn().mockResolvedValue({ items: [], unreadCount: 0 }),
    subscribeBusinessEvents: vi.fn(() => vi.fn()),
  } as unknown as RealtimeBusinessRepository;
}

function metric(
  code: string,
  label: string,
  value: string | null,
  unit: string,
  missingReason: string | null = null,
) {
  return {
    code,
    label,
    value,
    unit,
    aggregation: "SUM",
    sourceCount: value ? 1 : 0,
    missingReason,
  };
}

describe("ProductionAnalysisPanel", () => {
  it("shows one formal notice instead of empty cards, charts, and tables when no production data is approved", async () => {
    const data = repository();
    data.loadObservableAnalysisSnapshot = vi.fn().mockResolvedValue({
      ...validSnapshot(),
      qualityState: "NO_APPROVED_DATA",
      production: { metrics: [], sourceBalances: [] },
      lineage: [],
    });

    render(<ProductionAnalysisPanel repository={data} />);

    expect(
      await screen.findByText("当前范围暂无已审核的产情分析数据。"),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "生产概况" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("缺少核定数据")).not.toBeInTheDocument();
  });

  it("omits unsupported production chart groups instead of rendering hollow cards", async () => {
    const data = repository();
    const approved = await data.loadObservableAnalysisSnapshot({
      productCode: "CORN",
      regionCode: "__ALL_AUTHORIZED__",
      surveyYear: 2024,
    });
    data.loadObservableAnalysisSnapshot = vi.fn().mockResolvedValue({
      ...approved,
      production: { ...approved.production, metrics: [] },
    });

    render(<ProductionAnalysisPanel repository={data} />);

    expect(
      await screen.findByRole("heading", { name: "核定数据来源" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "面积与产出" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "成本与保障" }),
    ).not.toBeInTheDocument();
  });

  it("opens on all authorized regions and the latest approved survey year", async () => {
    const data = repository();
    const originalLoad = data.loadObservableAnalysisSnapshot.bind(data);
    const loadObservableAnalysisSnapshot = vi.fn(
      (query: ObservableAnalysisQuery) => originalLoad(query),
    );
    data.loadObservableAnalysisSnapshot = loadObservableAnalysisSnapshot;
    data.loadMasterData = vi.fn().mockResolvedValue({
      products: [{ code: "CORN", name: "玉米" }],
      periods: [],
      regions: [
        {
          code: "230200",
          name: "齐齐哈尔市",
          parentCode: null,
          level: "PREFECTURE",
        },
        {
          code: "231100",
          name: "黑河市",
          parentCode: null,
          level: "PREFECTURE",
        },
      ],
      approvedSurveyYears: [2024],
    });

    render(<ProductionAnalysisPanel repository={data} />);

    await waitFor(() =>
      expect(loadObservableAnalysisSnapshot.mock.lastCall?.[0]).toMatchObject({
        productCode: "CORN",
        regionCode: "__ALL_AUTHORIZED__",
        surveyYear: 2024,
      }),
    );
    expect(screen.getByRole("combobox", { name: "调查年份" })).toHaveValue(
      "2024",
    );
  });

  it("organizes approved production facts as a reference-style business dashboard", async () => {
    const { container } = render(
      <ProductionAnalysisPanel repository={repository()} />,
    );

    expect(
      await screen.findByRole("heading", { name: "产情分析" }),
    ).toBeVisible();
    expect(
      await screen.findByRole("region", { name: "样本网络覆盖" }),
    ).toHaveTextContent("设计行政村2,332");
    expect(container.firstElementChild).toHaveAttribute(
      "data-dashboard",
      "production",
    );
    for (const heading of [
      "面积与产出",
      "成本与保障",
      "灾损与下年意向",
      "质量区间",
      "库存与自用",
      "核定数据来源",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeVisible();
    }
    expect(screen.queryByLabelText("分析指标")).not.toBeInTheDocument();
    expect(screen.queryByText("产情年度对比分析")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "面积结构对比" })).toBeVisible();
    expect(screen.getAllByText("加权预计单产")[0]).toBeVisible();
    expect(screen.getAllByText("预计总产")[0]).toBeVisible();
    expect(screen.getAllByText("预计收获率")[0]).toBeVisible();
    expect(screen.getByRole("img", { name: "面积结构对比" })).toHaveAttribute(
      "data-chart-type",
      "vertical-bar",
    );
    const damageAreaChart = screen.getByRole("img", {
      name: "灾损与意向（亩）",
    });
    const damageRateChart = screen.getByRole("img", {
      name: "灾损与意向（%）",
    });
    expect(within(damageAreaChart).getByText("灾损面积")).toBeVisible();
    expect(within(damageAreaChart).getByText("面积调整量")).toBeVisible();
    expect(within(damageRateChart).getByText("灾损面积占比")).toBeVisible();
    expect(within(damageRateChart).getByText("面积调整比例")).toBeVisible();
    expect(screen.getAllByText("灾损面积占比")[0]).toBeVisible();
    expect(screen.getAllByText("面积调整比例")[0]).toBeVisible();
    expect(
      screen.queryByRole("img", { name: /产出指标/u }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("table", { name: "产情质量区间" })).toBeVisible();
    expect(
      screen.getByRole("table", { name: "面积结构对比数据表" }),
    ).toBeVisible();
    expect(screen.getAllByText("预计收获率")[0]).toBeVisible();
    expect(screen.getAllByText("灾损面积占比")[0]).toBeVisible();
    expect(
      within(screen.getByRole("table", { name: "产情质量区间" })).getByRole(
        "row",
        { name: /水分/u },
      ),
    ).toBeVisible();
    expect(screen.getAllByText("完整亩均成本合计")[0]).toBeVisible();
    expect(screen.getAllByText("面积调整比例")[0]).toBeVisible();
    expect(
      screen.queryByText(/当前核定模板未提供可汇总/u),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("AI分析")).not.toBeInTheDocument();
    expect(screen.queryByText("230200")).not.toBeInTheDocument();
    expect(screen.getByText("统计范围")).toBeVisible();
    expect(screen.getByText("1 个地区")).toBeVisible();
    expect(screen.getByText("1 个调查对象")).toBeVisible();
    expect(screen.getByText("1 条采用记录")).toBeVisible();
    expect(screen.queryByText("1 条产情核定记录")).not.toBeInTheDocument();

    const versions = [
      ...container.querySelectorAll("[data-analysis-version]"),
    ].map((element) => element.getAttribute("data-analysis-version"));
    expect(new Set(versions).size).toBe(1);
    expect(versions.length).toBeGreaterThanOrEqual(4);
    expect(
      container.querySelector(".observable-analysis-report__metric-band"),
    ).toBeVisible();
    expect(
      container.querySelectorAll('[data-chart-type="vertical-bar"]').length,
    ).toBe(4);
    expect(container.querySelector('[data-chart-type="range"]')).toBeVisible();
    expect(
      container.querySelector(
        '.observable-analysis-report__lineage-viewport[data-layout="business-ledger"]',
      ),
    ).toBeVisible();
    expect(
      container.querySelector(
        '.observable-analysis-dashboard__grid[data-layout="primary"]',
      ),
    ).toBeVisible();
    expect(
      container.querySelector(
        '.observable-analysis-dashboard__grid[data-layout="supporting"]',
      ),
    ).not.toBeInTheDocument();
    const outcomeFlow = container.querySelector(
      '.observable-analysis-dashboard__stack[data-business-flow="production-outcomes"]',
    );
    const resourceFlow = container.querySelector(
      '.observable-analysis-dashboard__stack[data-business-flow="production-resources"]',
    );
    expect(outcomeFlow).toBeVisible();
    expect(resourceFlow).toBeVisible();
    expect(
      within(outcomeFlow as HTMLElement).getByRole("heading", {
        name: "质量区间",
      }),
    ).toBeVisible();
    expect(
      within(resourceFlow as HTMLElement).getByRole("heading", {
        name: "库存与自用",
      }),
    ).toBeVisible();
    expect(
      container.querySelectorAll(
        ".observable-analysis-report__metric-band-card",
      ),
    ).toHaveLength(4);
    expect(
      container.querySelector(".observable-analysis-dashboard__masthead"),
    ).toBeVisible();
    expect(
      container.querySelector(
        '.observable-analysis-dashboard__masthead[data-layout="compact"]',
      ),
    ).toBeVisible();
    expect(
      container.querySelector(".observable-analysis-report__lineage-viewport"),
    ).toBeVisible();
    expect(
      container.querySelector(".observable-analysis-metric-grid"),
    ).not.toBeInTheDocument();
  });
});

function sampleNetworkCoverage() {
  return {
    networkYear: 2026,
    networkStatus: "PUBLISHED" as const,
    designPointCount: 2332,
    activeSamplePointCount: 650,
    coveredDesignPointCount: 640,
    uncoveredDesignPointCount: 1692,
    points: [],
  };
}
