import { useEffect, useMemo, useState } from "react";

import type {
  ObservableAnalysisQuery,
  ObservableAnalysisSnapshot,
} from "@/platform/api/observableAnalysisContract";
import {
  ALL_AUTHORIZED_REGION_CODE,
  observableAnalysisLineageKey,
} from "@/platform/api/observableAnalysisContract";
import {
  realtimeBusinessRepository,
  type MasterDataSnapshot,
  type RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { ObservableAnalysisFilters } from "./ObservableAnalysisFilters";
import { SampleNetworkCoverageStrip } from "./SampleNetworkCoverageStrip";
import {
  AnalysisBarChart,
  AnalysisDashboardGrid,
  AnalysisDonutChart,
  AnalysisGroupedBarCharts,
  AnalysisGroupedRangeCharts,
  AnalysisGroupedVerticalBarCharts,
  AnalysisMetricBand,
  AnalysisPriceDifferenceChart,
  AnalysisReportSection,
  AnalysisScopeStrip,
  AnalysisTrendChart,
  buildAnalysisRangeSeries,
  hasAvailableMetrics,
  type AnalysisTrendLine,
} from "./ObservableAnalysisReport";
import { useObservableAnalysisSeries } from "./useObservableAnalysisSeries";
import type { ObservableAnalysisSeriesPoint } from "./useObservableAnalysisSeries";
import { useObservableAnalysisSnapshot } from "./useObservableAnalysisSnapshot";

type Metric = ObservableAnalysisSnapshot["market"]["metrics"][number];

export function MarketAnalysisPanel({
  repository = realtimeBusinessRepository,
  productCode = "CORN",
  regionCode = ALL_AUTHORIZED_REGION_CODE,
  surveyYear,
  authorizedRegionCodes = ["*"],
}: {
  repository?: RealtimeBusinessRepository;
  productCode?: string;
  regionCode?: string;
  surveyYear?: number;
  authorizedRegionCodes?: readonly string[];
}) {
  const defaultQuery = useMemo<ObservableAnalysisQuery>(
    () => ({
      productCode,
      regionCode,
      surveyYear: surveyYear ?? new Date().getFullYear(),
    }),
    [productCode, regionCode, surveyYear],
  );
  const [query, setQuery] = useState(defaultQuery);
  const [masterData, setMasterData] = useState<MasterDataSnapshot | null>(null);
  const [masterError, setMasterError] = useState("");

  useEffect(() => {
    let active = true;
    void repository
      .loadMasterData()
      .then((next) => {
        if (!active) return;
        setMasterData(next);
        if (surveyYear == null && next.approvedSurveyYears?.length) {
          setQuery((current) => ({
            ...current,
            surveyYear: next.approvedSurveyYears?.[0] ?? current.surveyYear,
          }));
        }
      })
      .catch(() => {
        if (active) setMasterError("分析筛选项暂时无法读取，请稍后重试。");
      });
    return () => {
      active = false;
    };
  }, [repository, surveyYear]);

  const resolvedDefaultQuery = useMemo(
    () => ({
      ...defaultQuery,
      surveyYear:
        surveyYear ??
        masterData?.approvedSurveyYears?.[0] ??
        defaultQuery.surveyYear,
    }),
    [defaultQuery, masterData?.approvedSurveyYears, surveyYear],
  );

  const { snapshot, status, error, refresh } = useObservableAnalysisSnapshot({
    query,
    repository,
  });

  return (
    <div
      className="enterprise-ledger-workbench observable-analysis-page"
      data-dashboard="market"
    >
      <div className="enterprise-ledger-workbench__breadcrumb">
        市场监测 / 市场分析
      </div>
      <div
        className="observable-analysis-dashboard__masthead"
        data-layout="compact"
      >
        <header className="enterprise-ledger-title observable-analysis-title">
          <div>
            <h1>市场分析</h1>
            <p>核定价格、购销、库存与流通结构</p>
          </div>
          <button
            disabled={status === "loading"}
            type="button"
            onClick={refresh}
          >
            刷新分析
          </button>
        </header>
        {masterData ? (
          <ObservableAnalysisFilters
            authorizedRegionCodes={authorizedRegionCodes}
            defaultQuery={resolvedDefaultQuery}
            masterData={masterData}
            query={query}
            onChange={setQuery}
          />
        ) : (
          <p>正在读取分析范围…</p>
        )}
        <SampleNetworkCoverageStrip
          regionCode={query.regionCode}
          repository={repository}
          year={query.surveyYear}
        />
      </div>
      {masterError ? <p role="alert">{masterError}</p> : null}
      {error ? <p role="alert">{error.message}</p> : null}
      {status === "loading" && !snapshot ? <p>正在汇总核定市场数据…</p> : null}
      {snapshot ? (
        <MarketResult
          query={query}
          realtimeStatus={status}
          repository={repository}
          snapshot={snapshot}
        />
      ) : null}
    </div>
  );
}

function MarketResult({
  snapshot,
  realtimeStatus,
  query,
  repository,
}: {
  snapshot: ObservableAnalysisSnapshot;
  realtimeStatus: string;
  query: ObservableAnalysisQuery;
  repository: RealtimeBusinessRepository;
}) {
  const market = new Map(
    snapshot.market.metrics.map((metric) => [metric.code, metric]),
  );
  const logistics = new Map(
    snapshot.logistics.metrics.map((metric) => [metric.code, metric]),
  );
  const version = snapshot.analysisVersion;
  const core = select(market, [
    "AVERAGE_PURCHASE_PRICE",
    "AVERAGE_SALE_PRICE",
    "AVERAGE_PURCHASE_SALE_SPREAD",
    "CURRENT_INVENTORY",
  ]);
  const activity = select(market, ["PURCHASE_VOLUME", "SALES_VOLUME"]);
  const purchasePrice = market.get("AVERAGE_PURCHASE_PRICE");
  const salePrice = market.get("AVERAGE_SALE_PRICE");
  const purchaseSaleSpread = market.get("AVERAGE_PURCHASE_SALE_SPREAD");
  const inventory = select(market, [
    "CURRENT_INVENTORY",
    "INVENTORY_CHANGE",
    "INVENTORY_CHANGE_RATE",
  ]);
  const costs = [
    ...select(market, [
      "AVERAGE_CARRIAGE_BOARD_AMOUNT",
      "AVERAGE_PACKAGING_AMOUNT",
      "AVERAGE_FREIGHT_AMOUNT",
    ]),
    ...select(logistics, ["AVERAGE_FREIGHT_RATE"]),
  ];
  const packaging = snapshot.market.metrics.filter(({ code }) =>
    code.startsWith("PACKAGING_"),
  );
  const packagingCounts = packaging.filter(({ code }) =>
    code.endsWith("_COUNT"),
  );
  const packagingShares = packaging.filter(({ code }) =>
    code.endsWith("_SHARE"),
  );
  const quality = snapshot.market.metrics.filter(({ code }) =>
    code.startsWith("MARKET_QUALITY_"),
  );
  const qualityRanges = buildAnalysisRangeSeries(quality, "MARKET_QUALITY_");
  const priceMetrics = [purchasePrice, salePrice, purchaseSaleSpread].filter(
    (metric): metric is Metric => Boolean(metric),
  );
  const hasPriceAndActivity = hasAvailableMetrics([
    ...priceMetrics,
    ...activity,
  ]);
  const hasInventoryAndCosts = hasAvailableMetrics([...inventory, ...costs]);
  const hasPrimaryAnalysis = hasPriceAndActivity || hasInventoryAndCosts;
  const hasPackaging = hasAvailableMetrics(packaging);
  const hasQuality = qualityRanges.length > 0;
  const hasSupportingAnalysis = hasPackaging || hasQuality;
  const adoptedSources = snapshot.lineage.filter(
    ({ sourceDomain }) => sourceDomain !== "PRODUCTION",
  );
  const adoptedRegionCount = new Set(
    adoptedSources.map(({ regionLabel }) => regionLabel),
  ).size;
  const adoptedSubjectCount = new Set(
    adoptedSources.map(({ subjectLabel }) => subjectLabel),
  ).size;
  const series = useObservableAnalysisSeries({
    query,
    refreshKey: `${snapshot.analysisVersion}|${snapshot.generatedAt}`,
    repository,
  });
  const priceTrendLines = [
    marketTrend("AVERAGE_PURCHASE_PRICE", "平均采集对象收购价格", "元/吨"),
    marketTrend(
      "AVERAGE_SALE_PRICE",
      "平均采集对象销售价格",
      "元/吨",
      "comparison",
    ),
  ];
  const inventoryTrendLines = [
    marketTrend("CURRENT_INVENTORY", "当前企业库存", "吨"),
  ];
  const validMonthCount = Math.max(
    countValidMonths(series.points, priceTrendLines),
    countValidMonths(series.points, inventoryTrendLines),
  );
  const hasMonthlyTrend = validMonthCount >= 2;

  return (
    <>
      <section
        className="observable-analysis-status"
        data-analysis-version={version}
      >
        <strong>{qualityLabel(snapshot.qualityState)}</strong>
        <span>
          {realtimeStatus === "reconnecting"
            ? "实时连接正在恢复，保留当前结果"
            : "核定数据变化后自动刷新"}
        </span>
        <span>数据截止：{formatDate(snapshot.dataCutoffAt)}</span>
        <AnalysisScopeStrip
          recordCount={adoptedSources.length}
          regionCount={adoptedRegionCount}
          subjectCount={adoptedSubjectCount}
        />
      </section>

      {adoptedSources.length ||
      snapshot.market.metrics.length ||
      snapshot.logistics.metrics.length ? (
        <>
          <AnalysisMetricBand metrics={core} />

          {hasPrimaryAnalysis ? (
            <AnalysisDashboardGrid variant="primary">
              {hasPriceAndActivity ? (
                <AnalysisReportSection
                  analysisVersion={version}
                  description="购销价格与数量均直接取自本期市场核定字段。"
                  title="价格与购销"
                >
                  <div
                    className="observable-analysis-report__chart-grid"
                    data-layout="stacked"
                  >
                    <AnalysisPriceDifferenceChart
                      differenceMetric={purchaseSaleSpread}
                      endMetric={salePrice}
                      startMetric={purchasePrice}
                      title="购销价格差异"
                    />
                    <AnalysisGroupedVerticalBarCharts
                      metrics={activity}
                      title="购销数量对比"
                    />
                  </div>
                </AnalysisReportSection>
              ) : null}

              {hasInventoryAndCosts ? (
                <AnalysisReportSection
                  analysisVersion={version}
                  description="库存变化与流通费用按单位分组呈现。"
                  title="库存与流通费用"
                >
                  <AnalysisGroupedBarCharts
                    metrics={inventory}
                    title="市场库存变化"
                  />
                  <AnalysisBarChart metrics={costs} title="流通成本构成" />
                </AnalysisReportSection>
              ) : null}
            </AnalysisDashboardGrid>
          ) : null}

          {hasMonthlyTrend ? (
            <AnalysisReportSection
              analysisVersion={version}
              aside={
                series.failedMonthCount > 0
                  ? `${series.failedMonthCount} 个月数据暂缺`
                  : undefined
              }
              description="仅当同一市场字段至少有两个有效月份时展示；缺失月份不补零。"
              title="跨月变化"
            >
              <div className="observable-analysis-report__chart-grid">
                <AnalysisTrendChart
                  lines={priceTrendLines}
                  points={series.points}
                  title="市场价格趋势"
                />
                <AnalysisTrendChart
                  lines={inventoryTrendLines}
                  points={series.points}
                  title="企业库存趋势"
                />
              </div>
            </AnalysisReportSection>
          ) : null}

          {hasSupportingAnalysis ? (
            <AnalysisDashboardGrid variant="supporting">
              {hasPackaging ? (
                <AnalysisReportSection
                  analysisVersion={version}
                  description="按核定包装数量与占比分组。"
                  title="包装结构"
                >
                  <div className="observable-analysis-report__chart-grid">
                    <AnalysisGroupedVerticalBarCharts
                      metrics={packagingCounts}
                      title="包装数量"
                    />
                    <AnalysisDonutChart
                      metrics={packagingShares}
                      title="包装占比"
                    />
                  </div>
                </AnalysisReportSection>
              ) : null}
              {hasQuality ? (
                <AnalysisReportSection
                  analysisVersion={version}
                  description="显示本期实际存在的质量字段。"
                  title="质量区间"
                >
                  <AnalysisGroupedRangeCharts
                    series={qualityRanges}
                    title="市场质量区间"
                  />
                </AnalysisReportSection>
              ) : null}
            </AnalysisDashboardGrid>
          ) : null}

          <AnalysisReportSection
            analysisVersion={version}
            description="明细仅列出本次结果实际采用的市场与物流核定记录。"
            title="核定数据来源"
          >
            <div
              className="realtime-supply-table-wrap observable-analysis-report__lineage-viewport"
              data-layout="business-ledger"
            >
              <table aria-label="市场地区与主体来源">
                <thead>
                  <tr>
                    <th>业务来源</th>
                    <th>调查对象</th>
                    <th>地区</th>
                    <th>期间</th>
                    <th>核定时间</th>
                  </tr>
                </thead>
                <tbody>
                  {adoptedSources.map((item) => (
                    <tr key={observableAnalysisLineageKey(item)}>
                      <td>
                        {item.sourceDomain === "MARKET"
                          ? "市场填报"
                          : "物流填报"}
                      </td>
                      <td>{item.subjectLabel}</td>
                      <td>{item.regionLabel}</td>
                      <td>{item.periodLabel}</td>
                      <td>{formatDate(item.approvedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AnalysisReportSection>
        </>
      ) : (
        <Empty>当前范围暂无已审核的市场或物流分析数据。</Empty>
      )}
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="observable-analysis-empty">{children}</p>;
}

function select(
  metrics: ReadonlyMap<string, Metric>,
  codes: readonly string[],
): readonly Metric[] {
  return codes.flatMap((code) => {
    const metric = metrics.get(code);
    return metric ? [metric] : [];
  });
}

function marketTrend(
  code: string,
  label: string,
  unit: string,
  tone: "primary" | "comparison" = "primary",
) {
  return {
    key: code,
    label,
    unit,
    tone,
    value: (snapshot: ObservableAnalysisSnapshot) =>
      snapshot.market.metrics.find((metric) => metric.code === code)?.value ??
      null,
  } as const;
}

function countValidMonths(
  points: readonly ObservableAnalysisSeriesPoint[],
  lines: readonly AnalysisTrendLine[],
): number {
  return Math.max(
    0,
    ...lines.map(
      (line) =>
        points.filter((point) => {
          const value = point.snapshot ? line.value(point.snapshot) : null;
          return value !== null && Number.isFinite(Number(value));
        }).length,
    ),
  );
}

function qualityLabel(
  state: ObservableAnalysisSnapshot["qualityState"],
): string {
  return {
    AVAILABLE: "数据完整",
    PARTIAL: "部分数据缺失",
    COVERAGE_REVIEW_REQUIRED: "覆盖范围待复核",
    BLOCKED: "分析已阻断",
    NO_APPROVED_DATA: "暂无核定数据",
  }[state];
}

function formatDate(value: string | null): string {
  if (value === null) return "暂无核定数据";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
