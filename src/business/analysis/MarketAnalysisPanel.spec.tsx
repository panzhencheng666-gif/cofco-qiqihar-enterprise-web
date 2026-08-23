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
import { MarketAnalysisPanel } from "./MarketAnalysisPanel";

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
      market: {
        metrics: [
          metric(
            "AVERAGE_PURCHASE_PRICE",
            "平均采集对象收购价格",
            "2400.0000",
            "元/吨",
          ),
          metric(
            "AVERAGE_SALE_PRICE",
            "平均采集对象销售价格",
            "2550.0000",
            "元/吨",
          ),
          metric(
            "AVERAGE_PURCHASE_SALE_SPREAD",
            "平均购销价差",
            "150.0000",
            "元/吨",
          ),
          metric(
            "AVERAGE_CARRIAGE_BOARD_AMOUNT",
            "平均车板组成",
            "20.0000",
            "元/吨",
          ),
          metric(
            "AVERAGE_PACKAGING_AMOUNT",
            "平均包装组成",
            "10.0000",
            "元/吨",
          ),
          metric("AVERAGE_FREIGHT_AMOUNT", "平均运费组成", "30.0000", "元/吨"),
          metric("PURCHASE_VOLUME", "采购量", "20.0000", "吨"),
          metric("CURRENT_INVENTORY", "当前企业库存", "80.0000", "吨"),
          metric("INVENTORY_CHANGE", "企业库存变化量", "10.0000", "吨"),
          metric("INVENTORY_CHANGE_RATE", "企业库存变化率", "14.2857", "%"),
          metric("PACKAGING_BULK_COUNT", "散粮记录数", "3.0000", "条"),
          metric("PACKAGING_BULK_SHARE", "散粮占比", "75.0000", "%"),
          metric("PACKAGING_BAGGED_COUNT", "包粮记录数", "1.0000", "条"),
          metric("PACKAGING_BAGGED_SHARE", "包粮占比", "25.0000", "%"),
          metric(
            "MARKET_QUALITY_MOISTURE_MINIMUM",
            "水分最低值",
            "13.0000",
            "%",
          ),
          metric(
            "MARKET_QUALITY_MOISTURE_AVERAGE",
            "水分平均值",
            "13.5000",
            "%",
          ),
          metric(
            "MARKET_QUALITY_MOISTURE_MAXIMUM",
            "水分最高值",
            "14.0000",
            "%",
          ),
        ],
      },
      logistics: {
        metrics: [
          metric("AVERAGE_FREIGHT_RATE", "平均物流运价", "80.0000", "元/吨"),
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

describe("MarketAnalysisPanel", () => {
  it("shares the all-region latest-approved-year scope and keeps empty market data explicit", async () => {
    const data = repository();
    const originalLoad = data.loadObservableAnalysisSnapshot.bind(data);
    const loadObservableAnalysisSnapshot = vi.fn(
      (query: ObservableAnalysisQuery) => originalLoad(query),
    );
    data.loadObservableAnalysisSnapshot = loadObservableAnalysisSnapshot;
    data.loadMasterData = vi.fn().mockResolvedValue({
      products: [{ code: "CORN", name: "玉米" }],
      periods: [],
      regions: [],
      approvedSurveyYears: [2024],
    });
    loadObservableAnalysisSnapshot.mockResolvedValue({
      ...validSnapshot(),
      qualityState: "NO_APPROVED_DATA",
      coverage: {
        recordCount: 0,
        uniqueSubjectCount: 0,
        coveredRegionCount: 0,
        excludedRecordCount: 0,
        pendingReviewRecordCount: 0,
      },
      market: { metrics: [] },
      logistics: { metrics: [] },
      lineage: [],
    });

    render(<MarketAnalysisPanel repository={data} />);

    await waitFor(() =>
      expect(loadObservableAnalysisSnapshot.mock.lastCall?.[0]).toMatchObject({
        productCode: "CORN",
        regionCode: "__ALL_AUTHORIZED__",
        surveyYear: 2024,
      }),
    );
    expect(screen.getByText("暂无核定数据")).toBeVisible();
    expect(
      screen.getByText("当前范围暂无已审核的市场或物流分析数据。"),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "价格运行" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("does not leave hollow chart cards when approved lineage has no usable market metrics", async () => {
    const data = repository();
    const approved = await data.loadObservableAnalysisSnapshot({
      productCode: "CORN",
      regionCode: "__ALL_AUTHORIZED__",
      surveyYear: 2024,
    });
    data.loadObservableAnalysisSnapshot = vi.fn().mockResolvedValue({
      ...approved,
      market: { metrics: [] },
      logistics: { metrics: [] },
      lineage: approved.lineage.map((item) => ({
        ...item,
        sourceDomain: "MARKET" as const,
      })),
    });

    const { container } = render(<MarketAnalysisPanel repository={data} />);

    expect(
      await screen.findByRole("heading", { name: "核定数据来源" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "价格与购销" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "库存与流通费用" }),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector(".observable-analysis-dashboard__grid"),
    ).not.toBeInTheDocument();
  });

  it("organizes approved market facts as a reference-style business dashboard", async () => {
    const { container } = render(
      <MarketAnalysisPanel repository={repository()} />,
    );

    expect(
      await screen.findByRole("heading", { name: "市场分析" }),
    ).toBeVisible();
    expect(
      await screen.findByRole("region", { name: "样本网络覆盖" }),
    ).toHaveTextContent("年度现有样本点650");
    expect(container.firstElementChild).toHaveAttribute(
      "data-dashboard",
      "market",
    );
    for (const heading of [
      "价格与购销",
      "库存与流通费用",
      "包装结构",
      "质量区间",
      "核定数据来源",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeVisible();
    }
    expect(screen.queryByLabelText("分析指标")).not.toBeInTheDocument();
    expect(screen.getAllByText("平均采集对象收购价格")[0]).toBeVisible();
    expect(screen.getAllByText("平均采集对象销售价格")[0]).toBeVisible();
    expect(screen.getAllByText("平均购销价差")[0]).toBeVisible();
    expect(screen.getAllByText("当前企业库存")[0]).toBeVisible();
    expect(screen.getAllByText("企业库存变化率")[0]).toBeVisible();
    expect(screen.getAllByText("平均车板组成")[0]).toBeVisible();
    expect(screen.getAllByText("散粮占比")[0]).toBeVisible();
    expect(
      within(screen.getByRole("table", { name: "市场质量区间" })).getByRole(
        "row",
        { name: /水分/u },
      ),
    ).toBeVisible();
    expect(screen.queryByText("加工投入量")).not.toBeInTheDocument();
    expect(
      screen.queryByText("市场购销量仅用于市场活动分析，不进入供需平衡总量。"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/当前年度仅 .* 个有效月份/u),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("group", { name: "购销价格差异" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("img", { name: "购销数量对比" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("购销数量对比：采购量")).toHaveAttribute(
      "data-presentation",
      "single-metric",
    );
    expect(screen.queryByText("销售量")).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "市场库存变化（吨）" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("img", { name: "市场库存变化（%）" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("市场库存变化（%）：企业库存变化率"),
    ).toHaveAttribute("data-presentation", "single-metric");
    expect(screen.getByRole("img", { name: "包装数量" })).toBeVisible();
    expect(screen.getByRole("img", { name: "包装占比" })).toBeVisible();
    expect(screen.getByRole("table", { name: "市场质量区间" })).toBeVisible();
    expect(
      screen.getByRole("table", { name: "购销价格差异数据表" }),
    ).toBeVisible();
    expect(
      container.querySelector('[data-chart-type="vertical-bar"]'),
    ).toBeVisible();
    expect(container.querySelector('[data-chart-type="bar"]')).toBeVisible();
    expect(
      container.querySelector('[data-chart-type="difference"]'),
    ).toBeVisible();
    expect(container.querySelector('[data-chart-type="range"]')).toBeVisible();
    expect(
      container.querySelector('[data-chart-type="distribution"]'),
    ).toBeVisible();
    expect(
      container.querySelector(
        '.observable-analysis-report__lineage-viewport[data-layout="business-ledger"]',
      ),
    ).toBeVisible();
    expect(
      screen.queryByText("MKT_ACTUAL_TRADE_PRICE"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("230200")).not.toBeInTheDocument();
    expect(screen.getByText("统计范围")).toBeVisible();
    expect(screen.getByText("0 个地区")).toBeVisible();
    expect(screen.getByText("0 个调查对象")).toBeVisible();
    expect(screen.getByText("0 条采用记录")).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "数据覆盖" }),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector(
        '.observable-analysis-dashboard__grid[data-layout="supporting"][data-card-count="2"]',
      ),
    ).toBeVisible();

    const versions = [
      ...container.querySelectorAll("[data-analysis-version]"),
    ].map((element) => element.getAttribute("data-analysis-version"));
    expect(new Set(versions).size).toBe(1);
    expect(versions.length).toBeGreaterThanOrEqual(4);
    expect(
      container.querySelector(".observable-analysis-report__metric-band"),
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
    ).toBeVisible();
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

  it("uses current-period comparisons instead of a false trend when only one month has approved data", async () => {
    const data = repository();
    const approved = await data.loadObservableAnalysisSnapshot({
      productCode: "CORN",
      regionCode: "__ALL_AUTHORIZED__",
      surveyYear: 2024,
    });
    data.loadObservableAnalysisSnapshot = vi.fn(
      (query: ObservableAnalysisQuery) =>
        Promise.resolve(
          query.surveyMonth == null || query.surveyMonth === 11
            ? approved
            : {
                ...approved,
                dataCutoffAt: null,
                qualityState: "NO_APPROVED_DATA" as const,
                coverage: {
                  recordCount: 0,
                  uniqueSubjectCount: 0,
                  coveredRegionCount: 0,
                  excludedRecordCount: 0,
                  pendingReviewRecordCount: 0,
                },
                market: { metrics: [] },
                logistics: { metrics: [] },
                lineage: [],
              },
        ),
    );

    render(<MarketAnalysisPanel repository={data} surveyYear={2024} />);

    expect(
      screen.queryByText("当前年度仅 1 个有效月份，改用本期业务对比。"),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("group", { name: "购销价格差异" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "跨月变化" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: "市场价格趋势" }),
    ).not.toBeInTheDocument();
  });
});

function sampleNetworkCoverage() {
  return {
    networkYear: 2026,
    networkStatus: "PUBLISHED" as const,
    designPointCount: 2332,
    designCoordinateCount: 2300,
    activeSamplePointCount: 650,
    approvedSubmissionSamplePointCount: 520,
    pendingVerificationDesignPointCount: 32,
    multipleActualPerDesignPointCount: 6,
    anomalyCount: 3,
    exactCoveredDesignPointCount: 600,
    representedDesignPointCount: 40,
    regionalAssociationDesignPointCount: 0,
    unrelatedDesignPointCount: 1692,
    actualLevelCounts: { prefecture: 0, county: 0, township: 0, village: 650 },
    designPoints: [],
    actualPoints: [],
    relations: [],
  };
}
