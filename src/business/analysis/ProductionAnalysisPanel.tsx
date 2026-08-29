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
  AnalysisGroupedBarCharts,
  AnalysisGroupedRangeCharts,
  AnalysisGroupedVerticalBarCharts,
  AnalysisMetricBand,
  AnalysisReportSection,
  AnalysisScopeStrip,
  AnalysisTrendChart,
  buildAnalysisRangeSeries,
  hasAvailableMetrics,
  type AnalysisMetric,
  type AnalysisTrendLine,
} from "./ObservableAnalysisReport";
import { useObservableAnalysisSeries } from "./useObservableAnalysisSeries";
import type { ObservableAnalysisSeriesPoint } from "./useObservableAnalysisSeries";
import { useObservableAnalysisSnapshot } from "./useObservableAnalysisSnapshot";

type Metric = ObservableAnalysisSnapshot["production"]["metrics"][number];

const stateLabels = {
  AVAILABLE: "数据完整",
  PARTIAL: "部分数据缺失",
  COVERAGE_REVIEW_REQUIRED: "覆盖范围待复核",
  BLOCKED: "分析已阻断",
  NO_APPROVED_DATA: "暂无核定数据",
} as const;

export function ProductionAnalysisPanel({
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
      className="enterprise-ledger-workbench observable-analysis-page analysis-workbench-page"
      data-dashboard="production"
    >
      <div className="enterprise-ledger-workbench__breadcrumb">
        产情监测 / 产情分析
      </div>
      <section
        aria-label="产情分析范围"
        className="observable-analysis-dashboard__masthead"
        data-layout="linear-workbench"
      >
        <header className="enterprise-ledger-title observable-analysis-title">
          <div>
            <h1>产情分析</h1>
            <p>核定产情结果与生产结构</p>
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
          productCode={query.productCode}
          refreshKey={
            snapshot
              ? `${snapshot.analysisVersion}|${snapshot.generatedAt}`
              : status
          }
          regionCode={query.regionCode}
          repository={repository}
          year={query.surveyYear}
        />
      </section>
      {masterError ? <p role="alert">{masterError}</p> : null}
      {error ? <p role="alert">{error.message}</p> : null}
      {status === "loading" && !snapshot ? <p>正在汇总核定产情数据…</p> : null}
      {snapshot ? (
        <ProductionResult
          query={query}
          realtimeStatus={status}
          repository={repository}
          snapshot={snapshot}
        />
      ) : null}
    </div>
  );
}

function ProductionResult({
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
  const metrics = new Map(
    snapshot.production.metrics.map((metric) => [metric.code, metric]),
  );
  const version = snapshot.analysisVersion;
  const overview = select(metrics, [
    "CULTIVATED_AREA",
    "WEIGHTED_YIELD_PER_MU",
    "EXPECTED_OUTPUT",
    "EXPECTED_HARVEST_RATE",
  ]);
  const damage = select(metrics, ["AFFECTED_AREA", "AFFECTED_AREA_RATE"]);
  const quality = snapshot.production.metrics.filter(({ code }) =>
    code.startsWith("QUALITY_"),
  );
  const costs = snapshot.production.metrics.filter(
    ({ code }) =>
      code.startsWith("COST_") ||
      ["COMPLETE_COST_PER_MU", "INSURANCE_AMOUNT", "SUBSIDY_AMOUNT"].includes(
        code,
      ),
  );
  const intention = select(metrics, [
    "INTENDED_AREA",
    "INTENDED_AREA_CHANGE",
    "INTENDED_AREA_CHANGE_RATE",
  ]);
  const areaStructure = select(metrics, [
    "CULTIVATED_AREA",
    "HARVEST_AREA",
    "AFFECTED_AREA",
    "INTENDED_AREA",
  ]);
  const qualityRanges = buildAnalysisRangeSeries(quality, "QUALITY_");
  const unitCost = costs.filter(({ unit }) => unit === "元/亩");
  const productionSources = snapshot.lineage.filter(
    ({ sourceDomain }) => sourceDomain === "PRODUCTION",
  );
  const coveredRegionCount = new Set(
    productionSources.map(({ regionLabel }) => regionLabel),
  ).size;
  const subjectCount = new Set(
    productionSources.map(({ subjectLabel }) => subjectLabel),
  ).size;
  const series = useObservableAnalysisSeries({
    query,
    refreshKey: `${snapshot.analysisVersion}|${snapshot.generatedAt}`,
    repository,
  });
  const areaTrendLines = [
    productionTrend("CULTIVATED_AREA", "核定播种面积", "亩"),
    productionTrend("HARVEST_AREA", "预计收获面积", "亩", "comparison"),
  ];
  const outputTrendLines = [
    productionTrend("EXPECTED_OUTPUT", "预计总产", "吨"),
  ];
  const hasMonthlyTrend =
    hasAtLeastTwoValues(series.points, areaTrendLines) ||
    hasAtLeastTwoValues(series.points, outputTrendLines);
  const inventoryAndUse: readonly AnalysisMetric[] = [
    snapshotMetric(
      "OPENING_OBSERVABLE_INVENTORY",
      "期初可观测库存",
      snapshot.supply.calculation.openingObservableInventoryTonnes,
      productionSources.length,
    ),
    snapshotMetric(
      "SELF_USE",
      "自用数量",
      snapshot.supply.calculation.selfUseTonnes,
      productionSources.length,
    ),
    snapshotMetric(
      "ENDING_OBSERVABLE_INVENTORY",
      "期末可观测库存",
      snapshot.supply.calculation.endingObservableInventoryTonnes,
      productionSources.length,
    ),
  ];
  const hasAreaStructure = hasAvailableMetrics(areaStructure);
  const hasDamageAndIntention = hasAvailableMetrics([...damage, ...intention]);
  const hasQuality = qualityRanges.length > 0;
  const hasProductionOutcomes =
    hasAreaStructure || hasDamageAndIntention || hasQuality;
  const hasCosts = hasAvailableMetrics(costs);
  const hasInventoryAndUse = hasAvailableMetrics(inventoryAndUse);
  const hasProductionResources = hasCosts || hasInventoryAndUse;

  return (
    <>
      <section
        className="observable-analysis-status"
        data-analysis-version={version}
      >
        <strong>{stateLabels[snapshot.qualityState]}</strong>
        <span>
          {realtimeStatus === "reconnecting"
            ? "实时连接正在恢复，保留当前结果"
            : "核定数据变化后自动刷新"}
        </span>
        <span>数据截止：{formatDate(snapshot.dataCutoffAt)}</span>
        <AnalysisScopeStrip
          recordCount={productionSources.length}
          regionCount={coveredRegionCount}
          subjectCount={subjectCount}
        />
      </section>

      {productionSources.length || snapshot.production.metrics.length ? (
        <>
          <AnalysisMetricBand metrics={overview} />

          {hasProductionOutcomes || hasProductionResources ? (
            <AnalysisDashboardGrid variant="primary">
              {hasProductionOutcomes ? (
                <div
                  className="observable-analysis-dashboard__stack"
                  data-business-flow="production-outcomes"
                >
                  {hasAreaStructure ? (
                    <AnalysisReportSection
                      analysisVersion={version}
                      description="播种、收获、灾损和下年意向采用同一面积口径。"
                      title="面积与产出"
                    >
                      <AnalysisGroupedVerticalBarCharts
                        metrics={areaStructure}
                        title="面积结构对比"
                      />
                    </AnalysisReportSection>
                  ) : null}

                  {hasDamageAndIntention ? (
                    <AnalysisReportSection
                      analysisVersion={version}
                      description="按亩数和比例分别对照灾损与下年度种植意向。"
                      title="灾损与下年意向"
                    >
                      <AnalysisGroupedVerticalBarCharts
                        metrics={[...damage, ...intention]}
                        title="灾损与意向"
                      />
                    </AnalysisReportSection>
                  ) : null}

                  {hasQuality ? (
                    <AnalysisReportSection
                      analysisVersion={version}
                      description="显示本期核定质量字段的最低、平均与最高值。"
                      title="质量区间"
                    >
                      <AnalysisGroupedRangeCharts
                        series={qualityRanges}
                        title="产情质量区间"
                      />
                    </AnalysisReportSection>
                  ) : null}
                </div>
              ) : null}

              {hasProductionResources ? (
                <div
                  className="observable-analysis-dashboard__stack"
                  data-business-flow="production-resources"
                >
                  {hasCosts ? (
                    <AnalysisReportSection
                      analysisVersion={version}
                      description="各项投入均按本期核定成本字段汇总。"
                      title="成本与保障"
                    >
                      <AnalysisBarChart
                        metrics={unitCost}
                        title="亩均成本构成"
                      />
                      <AnalysisGroupedBarCharts
                        metrics={costs.filter(({ unit }) => unit !== "元/亩")}
                        title="成本与保障"
                      />
                    </AnalysisReportSection>
                  ) : null}

                  {hasInventoryAndUse ? (
                    <AnalysisReportSection
                      analysisVersion={version}
                      description="库存和自用取自本次核定结果。"
                      title="库存与自用"
                    >
                      <AnalysisGroupedVerticalBarCharts
                        metrics={inventoryAndUse}
                        title="库存与自用数量"
                      />
                    </AnalysisReportSection>
                  ) : null}
                </div>
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
              description="仅当同一字段至少有两个有效月份时展示；缺失月份不补零。"
              title="跨月变化"
            >
              <div className="observable-analysis-report__chart-grid">
                <AnalysisTrendChart
                  lines={areaTrendLines}
                  points={series.points}
                  title="播种与收获面积变化"
                />
                <AnalysisTrendChart
                  lines={outputTrendLines}
                  points={series.points}
                  title="预计总产变化"
                />
              </div>
            </AnalysisReportSection>
          ) : null}

          <AnalysisReportSection
            analysisVersion={version}
            description="本页结论仅来自当前范围实际采用的产情记录。"
            title="核定数据来源"
          >
            <div
              className="realtime-supply-table-wrap observable-analysis-report__lineage-viewport"
              data-layout="business-ledger"
            >
              <table aria-label="产情核定数据来源">
                <thead>
                  <tr>
                    <th>调查对象</th>
                    <th>地区</th>
                    <th>期间</th>
                    <th>核定时间</th>
                  </tr>
                </thead>
                <tbody>
                  {productionSources.map((item) => (
                    <tr key={observableAnalysisLineageKey(item)}>
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
        <Empty>当前范围暂无已审核的产情分析数据。</Empty>
      )}
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="observable-analysis-empty">{children}</p>;
}

function snapshotMetric(
  code: string,
  label: string,
  value: string | null,
  sourceCount: number,
): AnalysisMetric {
  return {
    code,
    label,
    value,
    unit: "吨",
    aggregation: "SUM",
    sourceCount: value === null ? 0 : sourceCount,
    missingReason: value === null ? "缺少核定数据" : null,
  };
}

function productionTrend(
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
      snapshot.production.metrics.find((metric) => metric.code === code)
        ?.value ?? null,
  } as const;
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

function select(
  metrics: ReadonlyMap<string, Metric>,
  codes: readonly string[],
): readonly Metric[] {
  return codes.flatMap((code) => {
    const metric = metrics.get(code);
    return metric ? [metric] : [];
  });
}

function hasAtLeastTwoValues(
  points: readonly ObservableAnalysisSeriesPoint[],
  lines: readonly AnalysisTrendLine[],
): boolean {
  return lines.some(
    (line) =>
      points.filter((point) => {
        const value = point.snapshot ? line.value(point.snapshot) : null;
        return value !== null && Number.isFinite(Number(value));
      }).length >= 2,
  );
}
