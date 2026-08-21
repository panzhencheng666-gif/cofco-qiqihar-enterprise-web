import { readFileSync } from "node:fs";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { validSnapshot } from "@/platform/api/observableAnalysisContract.fixture";
import type { ObservableAnalysisSeriesPoint } from "./useObservableAnalysisSeries";
import {
  AnalysisBarChart,
  AnalysisColumnChart,
  AnalysisDashboardGrid,
  AnalysisDonutChart,
  AnalysisGroupedBarCharts,
  AnalysisGroupedColumnCharts,
  AnalysisGroupedVerticalBarCharts,
  AnalysisMetricBand,
  AnalysisPriceDifferenceChart,
  AnalysisRangeChart,
  AnalysisReportSection,
  AnalysisTrendChart,
  AnalysisVerticalBarChart,
} from "./ObservableAnalysisReport";

afterEach(cleanup);

function point(
  month: number,
  value: string | null,
): ObservableAnalysisSeriesPoint {
  return {
    month,
    error: null,
    snapshot: {
      ...validSnapshot(),
      production: {
        ...validSnapshot().production,
        metrics:
          value === null
            ? []
            : [
                {
                  code: "EXPECTED_OUTPUT",
                  label: "预计总产",
                  value,
                  unit: "吨",
                  aggregation: "SUM",
                  sourceCount: month,
                  missingReason: null,
                },
              ],
      },
    },
  };
}

describe("observable analysis report components", () => {
  it("renders a reference-style business metric card band", () => {
    const metric = {
      code: "EXPECTED_OUTPUT",
      label: "预计总产",
      value: "112720.6870",
      unit: "吨",
      aggregation: "SUM",
      sourceCount: 235,
      missingReason: null,
    };

    const { container } = render(<AnalysisMetricBand metrics={[metric]} />);

    expect(screen.getByText("预计总产")).toBeVisible();
    expect(screen.getByText("112,720.687 吨")).toBeVisible();
    expect(screen.getByText("235 条核定来源")).toBeVisible();
    expect(
      container.querySelector(".observable-analysis-report__metric-band"),
    ).toHaveAttribute("data-card-count", "1");
    expect(
      container.querySelector(".observable-analysis-report__metric-band-card"),
    ).toBeVisible();
    expect(
      container.querySelector(".observable-analysis-metric-grid"),
    ).not.toBeInTheDocument();
    const css = readFileSync("src/business/formal-enterprise.css", "utf8");
    expect(css).toMatch(
      /\.observable-analysis-report__metric-band\s*\{[\s\S]{0,180}grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/u,
    );
    expect(css).toMatch(
      /\.observable-analysis-report__metric-band\[data-card-count="1"\][\s\S]{0,120}grid-template-columns: minmax\(0, 22rem\)/u,
    );
  });

  it("omits missing metric cards instead of rendering empty dashboard shells", () => {
    render(
      <AnalysisMetricBand
        metrics={[
          {
            code: "TOTAL_SUPPLY",
            label: "可观测总供给",
            value: null,
            unit: "吨",
            aggregation: "SUM",
            sourceCount: 0,
            missingReason: "缺少物流流入量",
          },
          {
            code: "EXPECTED_OUTPUT",
            label: "预计总产",
            value: "50.0000",
            unit: "吨",
            aggregation: "SUM",
            sourceCount: 1,
            missingReason: null,
          },
        ]}
      />,
    );

    expect(screen.queryByText("可观测总供给")).not.toBeInTheDocument();
    expect(screen.queryByText("缺少物流流入量")).not.toBeInTheDocument();
    expect(screen.getByText("预计总产")).toBeVisible();
  });

  it("provides the primary and supporting dashboard grids without creating values", () => {
    const { container } = render(
      <>
        <AnalysisDashboardGrid variant="primary">
          <section>主图</section>
          <section>结构图</section>
        </AnalysisDashboardGrid>
        <AnalysisDashboardGrid variant="supporting">
          <section>业务构成</section>
        </AnalysisDashboardGrid>
      </>,
    );

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
    expect(container).toHaveTextContent("主图结构图业务构成");
    expect(
      container.querySelector(
        '.observable-analysis-dashboard__grid[data-layout="primary"][data-card-count="2"]',
      ),
    ).toBeVisible();
    expect(
      container.querySelector(
        '.observable-analysis-dashboard__grid[data-layout="supporting"][data-card-count="1"]',
      ),
    ).toBeVisible();

    const css = readFileSync("src/business/formal-enterprise.css", "utf8");
    expect(css).toMatch(
      /\.observable-analysis-dashboard__grid\[data-layout="primary"\][\s\S]{0,140}grid-template-columns: minmax\(0, 2fr\) minmax\(320px, 1fr\)/u,
    );
    expect(css).toMatch(
      /\.observable-analysis-dashboard__grid\[data-layout="supporting"\][\s\S]{0,120}grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/u,
    );
    expect(css)
      .toContain(`.observable-analysis-dashboard__grid[data-layout="primary"][data-card-count="1"] {
  grid-template-columns: 1fr;
}`);
    expect(css).toMatch(
      /\.observable-analysis-report__chart-grid\s*\{[\s\S]{0,160}align-items: stretch;[\s\S]{0,160}background: #fff;/u,
    );
    expect(css).toMatch(
      /\.observable-analysis-dashboard__grid\[data-layout="primary"\][\s\S]{0,80}align-items: start;/u,
    );
    expect(css).toContain(
      '.observable-analysis-report__chart-grid[data-layout="stacked"]',
    );
    expect(css)
      .toContain(`.observable-analysis-page[data-dashboard="production"]
  .observable-analysis-dashboard__grid[data-layout="primary"],
.observable-analysis-page[data-dashboard="market"]
  .observable-analysis-dashboard__grid[data-layout="primary"],
.observable-analysis-page[data-dashboard="market"]
  .observable-analysis-dashboard__grid[data-layout="supporting"],
.realtime-supply-panel[data-dashboard="supply"]
  .observable-analysis-dashboard__grid[data-layout="primary"],
.realtime-supply-panel[data-dashboard="supply"]
  .observable-analysis-dashboard__grid[data-layout="supporting"] {
  align-items: stretch;
}`);
    expect(css)
      .toContain(`.observable-analysis-page[data-dashboard="production"]
  .observable-analysis-dashboard__grid[data-layout="primary"]
  > .observable-analysis-dashboard__stack {
  align-content: stretch;
  height: 100%;
}`);
    expect(css).toContain(`.observable-analysis-page[data-dashboard="market"]
  .observable-analysis-dashboard__grid[data-layout="primary"]
  > .observable-analysis-report__section,
.observable-analysis-page[data-dashboard="market"]
  .observable-analysis-dashboard__grid[data-layout="supporting"]
  > .observable-analysis-report__section,
.realtime-supply-panel[data-dashboard="supply"]
  .observable-analysis-dashboard__grid[data-layout="primary"]
  > .observable-analysis-report__section {
  height: 100%;
}`);
    expect(css).toContain(`.realtime-supply-panel[data-dashboard="supply"]
  .observable-analysis-dashboard__grid[data-layout="supporting"]
  > * {
  height: 100%;
}`);
    expect(css).toContain(
      `.observable-analysis-report__trend > .observable-analysis-report__trend-table,`,
    );
    expect(css).toContain(`.realtime-supply-panel[data-dashboard="supply"]
  .observable-analysis-dashboard__grid[data-layout="supporting"]
  .realtime-supply-table-wrap {
  max-height: 12rem;
}`);
  });

  it("plots only real server points and leaves missing or failed months as gaps", () => {
    const failed: ObservableAnalysisSeriesPoint = {
      month: 4,
      snapshot: null,
      error: "该月数据暂时无法读取",
    };
    const points = [
      point(1, "10.0000"),
      point(2, null),
      point(3, "30.0000"),
      failed,
    ];

    const { container } = render(
      <AnalysisTrendChart
        lines={[
          {
            key: "output",
            label: "预计总产",
            unit: "吨",
            value: (snapshot) =>
              snapshot.production.metrics.find(
                ({ code }) => code === "EXPECTED_OUTPUT",
              )?.value ?? null,
          },
        ]}
        points={points}
        title="预计总产趋势"
      />,
    );

    expect(screen.getByRole("img", { name: "预计总产趋势" })).toBeVisible();
    expect(
      container.querySelectorAll('[data-series-key="output"] circle'),
    ).toHaveLength(2);
    expect(
      container.querySelector('[data-series-key="output"]')?.textContent,
    ).toContain("10.00");
    expect(
      container.querySelector('[data-series-key="output"]')?.textContent,
    ).toContain("30.00");
    const table = screen.getByRole("table", { name: "预计总产趋势数据表" });
    expect(
      within(table).getByRole("row", { name: /1 月 10.00 吨/u }),
    ).toBeVisible();
    expect(
      within(table).getByRole("row", { name: /2 月 暂无核定数据/u }),
    ).toBeVisible();
    expect(
      within(table).getByRole("row", { name: /4 月 该月暂缺/u }),
    ).toBeVisible();
  });

  it("does not manufacture a trend when only one period has approved data", () => {
    render(
      <AnalysisTrendChart
        lines={[
          {
            key: "output",
            label: "预计总产",
            unit: "吨",
            value: (snapshot) =>
              snapshot.production.metrics.find(
                ({ code }) => code === "EXPECTED_OUTPUT",
              )?.value ?? null,
          },
        ]}
        points={[point(10, null), point(11, "30.0000"), point(12, null)]}
        title="预计总产趋势"
      />,
    );

    expect(screen.getByText("仅 1 个有效月份，不生成趋势图")).toBeVisible();
    expect(
      screen.queryByRole("img", { name: "预计总产趋势" }),
    ).not.toBeInTheDocument();
  });

  it("compares current approved business fields with a value-backed bar chart", () => {
    render(
      <AnalysisBarChart
        metrics={[
          {
            code: "PURCHASE_VOLUME",
            label: "采购量",
            value: "20.0000",
            unit: "吨",
            aggregation: "SUM",
            sourceCount: 2,
            missingReason: null,
          },
          {
            code: "SALES_VOLUME",
            label: "销售量",
            value: "10.0000",
            unit: "吨",
            aggregation: "SUM",
            sourceCount: 1,
            missingReason: null,
          },
        ]}
        title="购销数量对比"
      />,
    );

    expect(screen.getByRole("img", { name: "购销数量对比" })).toBeVisible();
    expect(
      screen.getByRole("table", { name: "购销数量对比数据表" }),
    ).toHaveTextContent("采购量20.00 吨2");
  });

  it("uses distinct compact visuals for comparison, range, and composition semantics", () => {
    const metrics = [
      {
        code: "PURCHASE_VOLUME",
        label: "采购量",
        value: "20.0000",
        unit: "吨",
        aggregation: "SUM",
        sourceCount: 2,
        missingReason: null,
      },
      {
        code: "SALES_VOLUME",
        label: "销售量",
        value: "10.0000",
        unit: "吨",
        aggregation: "SUM",
        sourceCount: 1,
        missingReason: null,
      },
    ];

    const { container } = render(
      <>
        <AnalysisColumnChart metrics={metrics} title="购销数量对比" />
        <AnalysisRangeChart
          series={[
            {
              key: "moisture",
              label: "水分",
              minimum: {
                ...metrics[1],
                code: "MIN",
                value: "12.0000",
                unit: "%",
              },
              average: {
                ...metrics[1],
                code: "AVG",
                value: "14.0000",
                unit: "%",
              },
              maximum: {
                ...metrics[1],
                code: "MAX",
                value: "16.0000",
                unit: "%",
              },
            },
          ]}
          title="质量区间"
          unit="%"
        />
        <AnalysisDonutChart
          metrics={[
            {
              ...metrics[0],
              code: "BULK",
              label: "散粮占比",
              value: "75",
              unit: "%",
            },
            {
              ...metrics[1],
              code: "BAGGED",
              label: "包粮占比",
              value: "25",
              unit: "%",
            },
          ]}
          title="包装占比"
        />
      </>,
    );

    expect(
      container.querySelector(
        '[data-chart-type="comparison"] .observable-analysis-report__dot-plot',
      ),
    ).toBeVisible();
    expect(
      container.querySelector(
        '[data-chart-type="range"] .observable-analysis-report__ranges',
      ),
    ).toBeVisible();
    expect(
      container.querySelector(
        '[data-chart-type="distribution"] .observable-analysis-report__donut',
      ),
    ).toBeVisible();
  });

  it("does not render an empty chart shell when every business field is missing", () => {
    const { container } = render(
      <AnalysisBarChart
        metrics={[
          {
            code: "SALES_VOLUME",
            label: "销售量",
            value: null,
            unit: "吨",
            aggregation: "SUM",
            sourceCount: 0,
            missingReason: "暂无核定销售量",
          },
        ]}
        title="购销数量对比"
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("当前字段暂无核定数据")).not.toBeInTheDocument();
  });

  it("splits real metrics into independent same-unit chart groups", () => {
    const { container } = render(
      <AnalysisGroupedBarCharts
        metrics={[
          {
            code: "CURRENT_INVENTORY",
            label: "当前企业库存",
            value: "80.0000",
            unit: "吨",
            aggregation: "SUM",
            sourceCount: 1,
            missingReason: null,
          },
          {
            code: "INVENTORY_CHANGE_RATE",
            label: "企业库存变化率",
            value: "14.2857",
            unit: "%",
            aggregation: "AVERAGE",
            sourceCount: 1,
            missingReason: null,
          },
          {
            code: "MISSING_PRICE",
            label: "缺失价格",
            value: null,
            unit: "元/吨",
            aggregation: "AVERAGE",
            sourceCount: 0,
            missingReason: "暂无核定价格",
          },
        ]}
        title="库存变化"
      />,
    );

    expect(
      screen.queryByRole("img", { name: /库存变化/u }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("库存变化（吨）：当前企业库存"),
    ).toHaveAttribute("data-presentation", "single-metric");
    expect(
      screen.getByLabelText("库存变化（%）：企业库存变化率"),
    ).toHaveAttribute("data-presentation", "single-metric");
    expect(screen.queryByText("缺失价格")).not.toBeInTheDocument();
    expect(
      container.querySelector(
        '.observable-analysis-report__grouped-charts[data-group-count="2"]',
      ),
    ).toBeVisible();
  });

  it("collapses three single-value groups to two columns and then one without selector conflicts", () => {
    const css = readFileSync("src/business/formal-enterprise.css", "utf8");

    expect(css).toContain(`@media (max-width: 1100px) {
  .observable-analysis-report__grouped-charts[data-group-count="3"] {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }`);
    expect(css).toContain(`@media (max-width: 720px) {
  .observable-analysis-report__grouped-charts[data-group-count="3"] {
    grid-template-columns: 1fr;
  }`);
    expect(css).toContain(
      '.observable-analysis-dashboard__grid[data-layout="primary"]\n  .observable-analysis-report__chart-grid:has(> :only-child)',
    );
  });

  it("keeps dense ranges in one readable column while allowing wide bar lists to compact", () => {
    const denseMetrics = Array.from({ length: 5 }, (_, index) => ({
      code: `COST_${index}`,
      label: `成本项 ${index + 1}`,
      value: String(index + 1),
      unit: "元/亩",
      aggregation: "AVERAGE",
      sourceCount: 1,
      missingReason: null,
    }));
    const denseRanges = Array.from({ length: 4 }, (_, index) => ({
      key: `QUALITY_${index}`,
      label: `质量项 ${index + 1}`,
      minimum: { ...denseMetrics[0], code: `MIN_${index}`, unit: "%" },
      average: { ...denseMetrics[1], code: `AVG_${index}`, unit: "%" },
      maximum: { ...denseMetrics[2], code: `MAX_${index}`, unit: "%" },
    }));
    const { container } = render(
      <>
        <AnalysisBarChart metrics={denseMetrics} title="亩均成本构成" />
        <AnalysisRangeChart
          series={denseRanges}
          title="产情质量区间"
          unit="%"
        />
      </>,
    );

    expect(
      container.querySelector(
        '.observable-analysis-report__bar-chart[data-density="compact"]',
      ),
    ).toBeVisible();
    expect(
      container.querySelector(
        '.observable-analysis-report__range-chart[data-density="compact"]',
      ),
    ).toBeVisible();

    const css = readFileSync("src/business/formal-enterprise.css", "utf8");
    expect(css).toMatch(
      /\.observable-analysis-report__bar-chart\[data-density="compact"\][\s\S]{0,300}grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/u,
    );
    expect(css).toMatch(
      /\.observable-analysis-report__range-chart\[data-density="compact"\][\s\S]{0,220}grid-template-columns: 1fr/u,
    );
    expect(css).not
      .toContain(`.observable-analysis-dashboard__grid[data-layout="supporting"]
  .observable-analysis-report__grouped-ranges {
  grid-template-columns: 1fr;
}`);
    expect(css)
      .toContain(`.observable-analysis-dashboard__stack[data-business-flow="production-outcomes"]
  .observable-analysis-report__range-chart[data-density="compact"]
  .observable-analysis-report__ranges {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}`);
  });

  it("renders approved same-unit values as aligned horizontal comparisons without oversized columns", () => {
    const { container } = render(
      <AnalysisColumnChart
        metrics={[
          {
            code: "PURCHASE_VOLUME",
            label: "采购量",
            value: "20.0000",
            unit: "吨",
            aggregation: "SUM",
            sourceCount: 2,
            missingReason: null,
          },
          {
            code: "SALES_VOLUME",
            label: "销售量",
            value: "10.0000",
            unit: "吨",
            aggregation: "SUM",
            sourceCount: 1,
            missingReason: null,
          },
          {
            code: "MISSING_VOLUME",
            label: "缺失数量",
            value: null,
            unit: "吨",
            aggregation: "SUM",
            sourceCount: 0,
            missingReason: "暂无核定数量",
          },
        ]}
        title="购销数量对比"
      />,
    );

    expect(screen.getByRole("img", { name: "购销数量对比" })).toBeVisible();
    expect(screen.getAllByText("20.00 吨")[0]).toBeVisible();
    expect(screen.queryByText("缺失数量")).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-chart-type="comparison"]'),
    ).toBeVisible();
    expect(container.querySelector('[data-chart-type="column"]')).toBeNull();
    expect(
      container.querySelector('[data-chart-scale="zero-based"]'),
    ).toBeNull();
  });

  it("renders thin vertical bars only when approved values form a real comparison", () => {
    const { container } = render(
      <AnalysisVerticalBarChart
        metrics={[
          {
            code: "AFFECTED_AREA",
            label: "灾损面积",
            value: "4288.7000",
            unit: "亩",
            aggregation: "SUM",
            sourceCount: 109,
            missingReason: null,
          },
          {
            code: "INTENDED_AREA",
            label: "下年度意向面积",
            value: "4200.0000",
            unit: "亩",
            aggregation: "SUM",
            sourceCount: 109,
            missingReason: null,
          },
          {
            code: "MISSING_AREA",
            label: "缺失面积",
            value: null,
            unit: "亩",
            aggregation: "SUM",
            sourceCount: 0,
            missingReason: "暂无核定数据",
          },
        ]}
        title="灾损指标（亩）"
      />,
    );

    const chart = screen.getByRole("img", { name: "灾损指标（亩）" });
    expect(chart).toBeVisible();
    expect(within(chart).getByText("灾损面积")).toBeVisible();
    expect(within(chart).getByText("4,288.70 亩")).toBeVisible();
    expect(screen.queryByText("缺失面积")).not.toBeInTheDocument();
    expect(
      container.querySelector(
        '[data-chart-type="vertical-bar"][data-bar-count="2"]',
      ),
    ).toBeVisible();

    const css = readFileSync("src/business/formal-enterprise.css", "utf8");
    expect(css).toMatch(
      /\.observable-analysis-report__vertical-bars[\s\S]{0,260}min-height: 7\.25rem/u,
    );
    expect(css).toMatch(
      /\.observable-analysis-report__vertical-bars i[\s\S]{0,240}height: 4\.75rem;[\s\S]{0,180}width: min\(28%, 2\.4rem\)/u,
    );
    expect(css).toMatch(
      /\.observable-analysis-report__vertical-bar-chart\s*>\s*\.observable-analysis-report__trend-table[\s\S]{0,180}clip-path: inset\(50%\)/u,
    );
  });

  it("does not turn one approved value into a self-normalized full-height column", () => {
    const { container } = render(
      <AnalysisGroupedVerticalBarCharts
        metrics={[
          {
            code: "PURCHASE_VOLUME",
            label: "采购量",
            value: "20.0000",
            unit: "吨",
            aggregation: "SUM",
            sourceCount: 2,
            missingReason: null,
          },
        ]}
        title="购销数量对比"
      />,
    );

    expect(
      screen.queryByRole("img", { name: "购销数量对比" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("购销数量对比：采购量")).toHaveAttribute(
      "data-presentation",
      "single-metric",
    );
    expect(
      container.querySelector('[data-chart-type="vertical-bar"]'),
    ).not.toBeInTheDocument();
  });

  it("shows approved purchase and sale prices on one aligned comparison baseline with the returned spread", () => {
    const { container } = render(
      <AnalysisPriceDifferenceChart
        differenceMetric={{
          code: "SPREAD",
          label: "平均购销价差",
          value: "99.0667",
          unit: "元/吨",
          aggregation: "AVERAGE",
          sourceCount: 75,
          missingReason: null,
        }}
        endMetric={{
          code: "SALE_PRICE",
          label: "平均销售价格",
          value: "1945.3733",
          unit: "元/吨",
          aggregation: "AVERAGE",
          sourceCount: 75,
          missingReason: null,
        }}
        startMetric={{
          code: "PURCHASE_PRICE",
          label: "平均收购价格",
          value: "1846.3067",
          unit: "元/吨",
          aggregation: "AVERAGE",
          sourceCount: 75,
          missingReason: null,
        }}
        title="购销价格差异"
      />,
    );

    expect(screen.getByRole("group", { name: "购销价格差异" })).toBeVisible();
    expect(screen.getAllByText("1,846.3067 元/吨")[0]).toBeVisible();
    expect(screen.getAllByText("1,945.3733 元/吨")[0]).toBeVisible();
    expect(screen.getAllByText("99.0667 元/吨")[0]).toBeVisible();
    expect(
      container.querySelector('[data-chart-type="difference"]'),
    ).toBeVisible();
    expect(
      container.querySelectorAll(
        ".observable-analysis-report__price-flow > div",
      ),
    ).toHaveLength(2);
    expect(
      container.querySelector(".observable-analysis-report__price-columns"),
    ).toBeNull();
  });

  it("renders complete approved minimum-average-maximum quality ranges only", () => {
    const { container } = render(
      <AnalysisRangeChart
        series={[
          {
            key: "moisture",
            label: "水分",
            minimum: {
              code: "MOISTURE_MINIMUM",
              label: "水分最低值",
              value: "14.0000",
              unit: "%",
              aggregation: "MINIMUM",
              sourceCount: 75,
              missingReason: null,
            },
            average: {
              code: "MOISTURE_AVERAGE",
              label: "水分平均值",
              value: "14.7573",
              unit: "%",
              aggregation: "AVERAGE",
              sourceCount: 75,
              missingReason: null,
            },
            maximum: {
              code: "MOISTURE_MAXIMUM",
              label: "水分最高值",
              value: "15.5000",
              unit: "%",
              aggregation: "MAXIMUM",
              sourceCount: 75,
              missingReason: null,
            },
          },
          {
            key: "missing",
            label: "缺失质量",
            minimum: undefined,
            average: undefined,
            maximum: undefined,
          },
        ]}
        title="市场质量区间"
        unit="%"
      />,
    );

    expect(screen.getByRole("table", { name: "市场质量区间" })).toBeVisible();
    expect(screen.getAllByText("水分")[0]).toBeVisible();
    expect(
      within(screen.getByRole("table", { name: "市场质量区间" })).getByRole(
        "row",
        { name: "水分 14.00 % 14.7573 % 15.50 %" },
      ),
    ).toBeVisible();
    expect(screen.queryByText("缺失质量")).not.toBeInTheDocument();
    expect(container.querySelector('[data-chart-type="range"]')).toBeVisible();
  });

  it("uses compact field-backed indicators instead of meaningless one-column charts", () => {
    const { container } = render(
      <AnalysisGroupedColumnCharts
        metrics={[
          {
            code: "YIELD",
            label: "预计单产",
            value: "829.4753",
            unit: "公斤/亩",
            aggregation: "WEIGHTED_AVERAGE",
            sourceCount: 9,
            missingReason: null,
          },
          {
            code: "OUTPUT",
            label: "预计总产",
            value: "355713.8860",
            unit: "吨",
            aggregation: "SUM",
            sourceCount: 9,
            missingReason: null,
          },
        ]}
        title="产出指标"
      />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
      container.querySelectorAll('[data-presentation="single-metric"]'),
    ).toHaveLength(2);
    expect(screen.getByText("829.4753 公斤/亩")).toBeVisible();
    expect(screen.getByText("355,713.886 吨")).toBeVisible();
  });

  it("uses only approved positive component values in a compact aligned distribution strip", () => {
    const { container, rerender } = render(
      <AnalysisDonutChart
        metrics={[
          {
            code: "BULK_SHARE",
            label: "散粮占比",
            value: "88.0000",
            unit: "%",
            aggregation: "AVERAGE",
            sourceCount: 66,
            missingReason: null,
          },
          {
            code: "BAGGED_SHARE",
            label: "包粮占比",
            value: "12.0000",
            unit: "%",
            aggregation: "AVERAGE",
            sourceCount: 9,
            missingReason: null,
          },
        ]}
        title="包装占比"
      />,
    );

    expect(screen.getByRole("img", { name: "包装占比" })).toBeVisible();
    expect(screen.getAllByText("散粮占比")[0]).toBeVisible();
    expect(screen.getAllByText("88.00 %")[0]).toBeVisible();
    expect(
      container.querySelector('[data-chart-type="distribution"]'),
    ).toBeVisible();
    expect(container.querySelector('[data-chart-type="donut"]')).toBeNull();

    rerender(
      <AnalysisDonutChart
        metrics={[
          {
            code: "ONLY_SHARE",
            label: "仅有占比",
            value: "88.0000",
            unit: "%",
            aggregation: "AVERAGE",
            sourceCount: 1,
            missingReason: null,
          },
        ]}
        title="包装占比"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("uses section headings and rules as report structure", () => {
    const { container } = render(
      <AnalysisReportSection description="按月查看核定结果" title="年度趋势">
        <p>内容</p>
      </AnalysisReportSection>,
    );

    expect(screen.getByRole("heading", { name: "年度趋势" })).toBeVisible();
    expect(screen.getByText("按月查看核定结果")).toBeVisible();
    expect(
      container.querySelector(".observable-analysis-report__section"),
    ).toBeVisible();
  });
});
