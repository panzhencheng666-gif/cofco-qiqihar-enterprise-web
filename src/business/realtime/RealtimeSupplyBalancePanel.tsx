import { useEffect, useMemo, useState } from "react";

import { ObservableAnalysisFilters } from "@/business/analysis/ObservableAnalysisFilters";
import {
  AnalysisDashboardGrid,
  AnalysisDonutChart,
  AnalysisMetricBand,
  AnalysisReportSection,
  AnalysisScopeStrip,
  AnalysisTrendChart,
  AnalysisVerticalBarChart,
  type AnalysisMetric,
} from "@/business/analysis/ObservableAnalysisReport";
import { useObservableAnalysisSeries } from "@/business/analysis/useObservableAnalysisSeries";
import { useObservableAnalysisSnapshot } from "@/business/analysis/useObservableAnalysisSnapshot";
import type {
  AnalysisQualityState,
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

interface RealtimeSupplyBalancePanelProps {
  productCode?: string;
  regionCode?: string;
  periodCode?: string;
  onPeriodCodeChange?: (periodCode: string) => void;
  permissions?: readonly string[];
  authorizedRegionCodes?: readonly string[];
  repository?: RealtimeBusinessRepository;
}

const qualityLabels: Readonly<Record<AnalysisQualityState, string>> = {
  AVAILABLE: "结果可用",
  PARTIAL: "数据不完整",
  COVERAGE_REVIEW_REQUIRED: "覆盖口径待复核",
  BLOCKED: "计算已阻断",
  NO_APPROVED_DATA: "暂无核定数据",
};

const domainLabels = {
  PRODUCTION: "产情填报",
  MARKET: "市场填报",
  LOGISTICS: "物流填报",
} as const;

const allAuthorizedRegions = ["*"] as const;

const qualityReasonLabels: Readonly<Record<string, string>> = {
  OPENING_INVENTORY_MISSING: "缺少期初库存核定数据",
  CULTIVATED_AREA_MISSING: "缺少播种面积核定数据",
  YIELD_PER_MU_MISSING: "缺少亩产核定数据",
  SALES_VOLUME_MISSING: "缺少销售量核定数据",
  SELF_USE_MISSING: "缺少自用数量核定数据",
  REPORTED_ENDING_INVENTORY_MISSING: "缺少填报期末库存核定数据",
  NEGATIVE_THEORETICAL_ENDING_INVENTORY: "理论期末库存小于零，请复核来源数据",
  OPENING_OBSERVABLE_INVENTORY_MISSING: "缺少可观测期初库存",
  OPENING_OBSERVABLE_INVENTORY_INCOMPLETE: "期初库存覆盖尚不完整",
  EXPECTED_OUTPUT_MISSING: "缺少预计总产核定数据",
  INFLOW_MISSING: "缺少区域流入核定数据",
  OUTFLOW_MISSING: "缺少区域流出核定数据",
  ENDING_OBSERVABLE_INVENTORY_MISSING: "缺少可观测期末库存",
  ENDING_OBSERVABLE_INVENTORY_INCOMPLETE: "期末库存覆盖尚不完整",
  INVENTORY_POSITION_REVIEW_REQUIRED: "部分库存位置的数据需要复核",
  NEGATIVE_INFERRED_OTHER_ABSORPTION: "推算其他消耗小于零，请复核来源数据",
};

const factLabels: Readonly<Record<string, string>> = {
  PROD_AREA_MU: "播种面积",
  PROD_YIELD_PER_MU: "亩产",
  PROD_ESTIMATED_OUTPUT: "预计总产",
  EXPECTED_OUTPUT: "预计总产",
  PROD_HARVEST_AREA_MU: "预计收获面积",
  PROD_AFFECTED_AREA_MU: "灾损面积",
  PROD_INTENDED_AREA_MU: "下年度意向面积",
  PROD_OPENING_INVENTORY: "期初库存",
  PROD_SALES_VOLUME: "销售量",
  PROD_SELF_USE: "自用数量",
  PROD_ENDING_INVENTORY: "期末库存",
  MKT_PURCHASE_BASE_PRICE: "收购价格",
  MKT_SALE_BASE_PRICE: "销售价格",
  MKT_CARRIAGE_BOARD_AMOUNT: "车板组成",
  MKT_PACKAGING_AMOUNT: "包装组成",
  MKT_FREIGHT_AMOUNT: "运费组成",
  MKT_PACKAGING_FORM: "包装形态",
  PURCHASE_VOLUME: "采购量",
  SALES_VOLUME: "销售量",
  OPENING_INVENTORY: "期初库存",
  ENDING_INVENTORY: "现有库存",
  ROUTE_VOLUME: "运输数量",
  FREIGHT_RATE: "物流运价",
};

function yearFromPeriod(periodCode: string): number {
  const year = Number(periodCode.match(/\d{4}/u)?.[0]);
  return Number.isInteger(year) ? year : new Date().getFullYear();
}

function displayAmount(value: string | null, unit = "吨"): string {
  if (value === null) return "缺少核定数据";
  return `${Number(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })} ${unit}`;
}

function displayDate(value: string | null): string {
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

function displayBusinessDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

function inventoryObservationLabel(
  observedFrom: string | null,
  observedThrough: string | null,
): string | undefined {
  if (observedFrom === null || observedThrough === null) return undefined;
  if (observedFrom === observedThrough) {
    return `库存统计日期：${displayBusinessDate(observedFrom)}`;
  }
  return `各库存位置最近统计日期：${displayBusinessDate(observedFrom)}至${displayBusinessDate(observedThrough)}`;
}

export function RealtimeSupplyBalancePanel({
  productCode = "CORN",
  regionCode = ALL_AUTHORIZED_REGION_CODE,
  periodCode = "",
  onPeriodCodeChange,
  authorizedRegionCodes = allAuthorizedRegions,
  repository = realtimeBusinessRepository,
}: RealtimeSupplyBalancePanelProps) {
  return (
    <CurrentScopeSupplyBalancePanel
      key={`${productCode}|${regionCode}`}
      authorizedRegionCodes={authorizedRegionCodes}
      onPeriodCodeChange={onPeriodCodeChange}
      periodCode={periodCode}
      productCode={productCode}
      regionCode={regionCode}
      repository={repository}
    />
  );
}

function CurrentScopeSupplyBalancePanel({
  productCode,
  regionCode,
  periodCode,
  onPeriodCodeChange,
  authorizedRegionCodes,
  repository,
}: Required<
  Pick<
    RealtimeSupplyBalancePanelProps,
    | "productCode"
    | "regionCode"
    | "periodCode"
    | "authorizedRegionCodes"
    | "repository"
  >
> &
  Pick<RealtimeSupplyBalancePanelProps, "onPeriodCodeChange">) {
  const defaultQuery = useMemo<ObservableAnalysisQuery>(
    () => ({
      productCode,
      regionCode,
      surveyYear: yearFromPeriod(periodCode),
    }),
    [periodCode, productCode, regionCode],
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
        if (!periodCode && next.approvedSurveyYears?.length) {
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
  }, [periodCode, repository]);

  const resolvedDefaultQuery = useMemo(
    () => ({
      ...defaultQuery,
      surveyYear:
        periodCode === ""
          ? (masterData?.approvedSurveyYears?.[0] ?? defaultQuery.surveyYear)
          : defaultQuery.surveyYear,
    }),
    [defaultQuery, masterData?.approvedSurveyYears, periodCode],
  );

  const relatedRegionCodes = useMemo(
    () => relatedRegions(masterData, query.regionCode),
    [masterData, query.regionCode],
  );
  const { snapshot, status, error, cursorGapDetected, refresh } =
    useObservableAnalysisSnapshot({ query, relatedRegionCodes, repository });

  function changeQuery(next: ObservableAnalysisQuery): void {
    setQuery(next);
    if (next.surveyYear !== query.surveyYear) {
      onPeriodCodeChange?.(String(next.surveyYear));
    }
  }

  return (
    <section
      aria-label="供需平衡"
      className="realtime-business-panel realtime-supply-panel"
      data-dashboard="supply"
    >
      <div
        className="observable-analysis-dashboard__masthead"
        data-layout="compact"
      >
        <header>
          <div>
            <p className="realtime-supply-eyebrow">经营决策分析</p>
            <h2>供需平衡</h2>
            <p>核定产情、市场库存与物流结果自动勾稽</p>
          </div>
          <button
            disabled={status === "loading"}
            type="button"
            onClick={refresh}
          >
            刷新结果
          </button>
        </header>

        {masterData ? (
          <ObservableAnalysisFilters
            authorizedRegionCodes={authorizedRegionCodes}
            defaultQuery={resolvedDefaultQuery}
            masterData={masterData}
            query={query}
            onChange={changeQuery}
          />
        ) : (
          <p className="realtime-supply-loading">正在读取分析范围…</p>
        )}
      </div>

      {masterError ? <p role="alert">{masterError}</p> : null}
      {error ? <p role="alert">{error.message}</p> : null}
      {status === "loading" && !snapshot ? (
        <p className="realtime-supply-loading">正在汇总核定数据并自动计算…</p>
      ) : null}

      {snapshot ? (
        <SupplyResult
          cursorGapDetected={cursorGapDetected}
          query={query}
          reconnecting={status === "reconnecting"}
          repository={repository}
          snapshot={snapshot}
        />
      ) : null}
    </section>
  );
}

function SupplyResult({
  snapshot,
  reconnecting,
  cursorGapDetected,
  query,
  repository,
}: {
  snapshot: ObservableAnalysisSnapshot;
  reconnecting: boolean;
  cursorGapDetected: boolean;
  query: ObservableAnalysisQuery;
  repository: RealtimeBusinessRepository;
}) {
  const calculation = snapshot.supply.calculation;
  const version = snapshot.analysisVersion;
  const blocked = ["BLOCKED", "NO_APPROVED_DATA"].includes(
    snapshot.qualityState,
  );
  const qualityReasons = [
    ...new Set(
      [...snapshot.blockingReasons, ...snapshot.warnings, ...calculation.issues]
        .filter((message) => message !== "NO_APPROVED_DATA")
        .map(
          (message) =>
            qualityReasonLabels[message] ??
            (/^[A-Z][A-Z0-9_]+$/u.test(message)
              ? "存在需复核的数据项"
              : message),
        ),
    ),
  ];
  const metrics: readonly AnalysisMetric[] = [
    supplyMetric(
      "OPENING_OBSERVABLE_INVENTORY",
      "期初可观测库存",
      calculation.openingObservableInventoryTonnes,
      snapshot.coverage.recordCount,
    ),
    supplyMetric(
      "EXPECTED_OUTPUT",
      "预计总产",
      calculation.expectedOutputTonnes,
      snapshot.coverage.recordCount,
    ),
    supplyMetric(
      "INFLOW",
      "物流流入",
      calculation.inflowTonnes,
      snapshot.coverage.recordCount,
    ),
    supplyMetric(
      "TOTAL_SUPPLY",
      "可观测总供给",
      calculation.totalSupplyTonnes,
      snapshot.coverage.recordCount,
    ),
    supplyMetric(
      "TOTAL_USE",
      "可观测总使用",
      calculation.totalUseTonnes,
      snapshot.coverage.recordCount,
    ),
    supplyMetric(
      "ENDING_OBSERVABLE_INVENTORY",
      "期末可观测库存",
      calculation.endingObservableInventoryTonnes,
      snapshot.coverage.recordCount,
    ),
  ];
  const headlineMetrics = [
    ...metrics.filter(({ code }) =>
      [
        "OPENING_OBSERVABLE_INVENTORY",
        "EXPECTED_OUTPUT",
        "ENDING_OBSERVABLE_INVENTORY",
      ].includes(code),
    ),
    supplyMetric(
      "ENTERPRISE_ENDING_INVENTORY",
      "企业端最近已审核库存",
      snapshot.supply.inventory.enterpriseEndingTonnes,
      snapshot.supply.inventory.adoptedRecordCount,
    ),
  ];
  const series = useObservableAnalysisSeries({
    query,
    refreshKey: `${snapshot.analysisVersion}|${snapshot.generatedAt}`,
    repository,
  });
  const validEndingMonthCount = series.points.filter(
    ({ snapshot: item }) =>
      item?.supply.calculation.endingObservableInventoryTonnes !== null,
  ).length;
  const hasAuthoritativeResult =
    snapshot.qualityState !== "NO_APPROVED_DATA" &&
    [...metrics, ...headlineMetrics].some(({ value }) => value !== null);

  return (
    <>
      <section
        className={`realtime-supply-conclusion${blocked ? " is-blocked" : ""}`}
        data-analysis-version={version}
      >
        <div className="realtime-supply-conclusion__status">
          <span>{qualityLabels[snapshot.qualityState]}</span>
          <small role="status">
            {reconnecting
              ? "实时连接正在恢复，当前结果继续保留"
              : cursorGapDetected
                ? "数据更新已重新核对"
                : "核定数据变化后自动同步"}
          </small>
          <small>数据截止：{displayDate(snapshot.dataCutoffAt)}</small>
          <AnalysisScopeStrip
            recordCount={snapshot.coverage.recordCount}
            regionCount={snapshot.coverage.coveredRegionCount}
            subjectCount={snapshot.coverage.uniqueSubjectCount}
          />
        </div>
      </section>

      {hasAuthoritativeResult ? (
        <>
          <AnalysisMetricBand
            metrics={headlineMetrics}
            sourceLabel={() => "本次核定结果"}
          />

          <AnalysisDashboardGrid variant="primary">
            <AnalysisReportSection
              analysisVersion={version}
              description="先看供给由什么形成，再核对使用与期末库存是否闭合。"
              title="供需如何平衡"
            >
              <div
                className="realtime-supply-equations"
                data-chart-type="bridge"
              >
                <div>
                  <strong>供给端</strong>
                  <div
                    aria-label="供给端勾稽"
                    className="realtime-supply-bridge__flow realtime-supply-bridge__flow--observable"
                    data-equation="supply"
                  >
                    <FlowItem
                      label="期初可观测库存"
                      value={calculation.openingObservableInventoryTonnes}
                    />
                    <b>+</b>
                    <FlowItem
                      label="预计总产"
                      value={calculation.expectedOutputTonnes}
                    />
                    <b>+</b>
                    <FlowItem
                      label="物流流入"
                      value={calculation.inflowTonnes}
                    />
                    <b>=</b>
                    <FlowItem
                      label="可观测总供给"
                      tone="adopted"
                      value={calculation.totalSupplyTonnes}
                    />
                  </div>
                </div>
                <div>
                  <strong>使用端</strong>
                  <div
                    aria-label="使用端勾稽"
                    className="realtime-supply-bridge__flow realtime-supply-bridge__flow--observable"
                    data-equation="use"
                  >
                    <FlowItem
                      label="可观测总使用"
                      value={calculation.totalUseTonnes}
                      tone="use"
                    />
                    <b>+</b>
                    <FlowItem
                      label="期末可观测库存"
                      value={calculation.endingObservableInventoryTonnes}
                      tone="adopted"
                    />
                    <b>=</b>
                    <FlowItem
                      label="可观测总供给"
                      tone="adopted"
                      value={calculation.totalSupplyTonnes}
                    />
                  </div>
                </div>
              </div>
              <p className="realtime-supply-formula-note">
                “推算其他消耗”仅为本次平衡差额。
              </p>
            </AnalysisReportSection>

            <InventoryBreakdown snapshot={snapshot} />
          </AnalysisDashboardGrid>

          <AnalysisDashboardGrid variant="supporting">
            {validEndingMonthCount >= 2 ? (
              <AnalysisReportSection
                analysisVersion={version}
                aside={
                  series.failedMonthCount > 0
                    ? `${series.failedMonthCount} 个月数据暂缺`
                    : undefined
                }
                description="逐月展示核定期末库存；缺失月份保持断点。"
                title="期末库存月份趋势"
              >
                <AnalysisTrendChart
                  lines={[
                    {
                      key: "ending-inventory",
                      label: "期末可观测库存",
                      unit: "吨",
                      value: (item) =>
                        item.supply.calculation.endingObservableInventoryTonnes,
                    },
                  ]}
                  points={series.points}
                  title="期末可观测库存趋势"
                />
              </AnalysisReportSection>
            ) : null}

            <section
              className="realtime-supply-detail"
              data-analysis-version={version}
            >
              <header>
                <div>
                  <h3>生产主体勾稽</h3>
                  <p>逐个核定主体对照理论期末库存与填报期末库存</p>
                </div>
              </header>
              <section
                className="realtime-supply-validation"
                data-analysis-version={version}
              >
                <div>
                  <h3>数据质量</h3>
                  <strong>{qualityLabels[snapshot.qualityState]}</strong>
                </div>
                {snapshot.coverage.excludedRecordCount > 0 ? (
                  <Coverage
                    label="排除记录"
                    value={snapshot.coverage.excludedRecordCount}
                  />
                ) : null}
                {qualityReasons.map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </section>
              <div className="realtime-supply-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>序号</th>
                      <th>预计总产</th>
                      <th>生产可用量</th>
                      <th>已知去向</th>
                      <th>理论期末库存</th>
                      <th>填报期末库存</th>
                      <th>差额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.production.sourceBalances.length ? (
                      snapshot.production.sourceBalances.map(
                        (balance, index) => (
                          <tr
                            key={`${index}-${balance.estimatedOutputTonnes ?? "missing"}`}
                          >
                            <td>{index + 1}</td>
                            <td>
                              {displayAmount(balance.estimatedOutputTonnes)}
                            </td>
                            <td>
                              {displayAmount(balance.productionAvailableTonnes)}
                            </td>
                            <td>
                              {displayAmount(balance.knownDestinationTonnes)}
                            </td>
                            <td>
                              {displayAmount(
                                balance.theoreticalEndingInventoryTonnes,
                              )}
                            </td>
                            <td>
                              {displayAmount(
                                balance.reportedEndingInventoryTonnes,
                              )}
                            </td>
                            <td>
                              {displayAmount(
                                balance.reconciliationDifferenceTonnes,
                              )}
                            </td>
                          </tr>
                        ),
                      )
                    ) : (
                      <tr>
                        <td colSpan={7}>
                          当前范围暂无可展示的生产主体勾稽明细。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </AnalysisDashboardGrid>

          <InventoryBreakdownLedger snapshot={snapshot} />

          <section
            className="realtime-supply-detail"
            data-analysis-version={version}
          >
            <header>
              <div>
                <h3>核定数据来源</h3>
                <p>仅显示本次自动计算实际采用的核定业务记录</p>
              </div>
            </header>
            <div
              className="realtime-supply-table-wrap observable-analysis-report__lineage-viewport"
              data-layout="business-ledger"
            >
              <table>
                <thead>
                  <tr>
                    <th>业务来源</th>
                    <th>调查对象</th>
                    <th>地区</th>
                    <th>期间</th>
                    <th>采用事实</th>
                    <th>核定时间</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.lineage.map((item) => (
                    <tr key={observableAnalysisLineageKey(item)}>
                      <td>{domainLabels[item.sourceDomain]}</td>
                      <td>{item.subjectLabel}</td>
                      <td>{item.regionLabel}</td>
                      <td>{item.periodLabel}</td>
                      <td>
                        {[
                          ...new Set(
                            item.factCodes.map(
                              (code) => factLabels[code] ?? "其他核定事实",
                            ),
                          ),
                        ].join("、")}
                      </td>
                      <td>{displayDate(item.approvedAt)}</td>
                    </tr>
                  ))}
                  {!snapshot.lineage.length ? (
                    <tr>
                      <td colSpan={6}>当前范围暂无已采用的核定数据来源。</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <p className="observable-analysis-empty">
          当前范围暂无可计算的核定供需数据。
        </p>
      )}
    </>
  );
}

function InventoryBreakdown({
  snapshot,
}: {
  snapshot: ObservableAnalysisSnapshot;
}) {
  const inventory = snapshot.supply.inventory;
  const calculation = snapshot.supply.calculation;
  const inventoryTotals = [
    supplyMetric(
      "OPENING_OBSERVABLE_INVENTORY",
      "期初可观测库存",
      calculation.openingObservableInventoryTonnes,
      snapshot.coverage.recordCount,
    ),
    supplyMetric(
      "ENDING_OBSERVABLE_INVENTORY",
      "期末可观测库存",
      calculation.endingObservableInventoryTonnes,
      snapshot.coverage.recordCount,
    ),
  ];
  const endingInventoryMetrics = [
    supplyMetric(
      "PRODUCTION_ENDING_INVENTORY",
      "生产端期末库存",
      inventory.productionEndingTonnes,
      inventory.productionEndingTonnes === null ? 0 : 1,
    ),
    supplyMetric(
      "ENTERPRISE_ENDING_INVENTORY",
      "企业端最近已审核库存",
      inventory.enterpriseEndingTonnes,
      inventory.enterpriseEndingTonnes === null ? 0 : 1,
    ),
  ];
  return (
    <section
      className="realtime-supply-detail"
      data-analysis-version={snapshot.analysisVersion}
    >
      <header>
        <div>
          <h3>库存口径拆分</h3>
          <p>生产端与企业端按不同持有环节分别汇总</p>
        </div>
      </header>
      <AnalysisVerticalBarChart
        metrics={inventoryTotals}
        title="期初期末库存对比"
      />
      <AnalysisDonutChart
        metrics={endingInventoryMetrics}
        title="期末库存持有结构"
      />
    </section>
  );
}

function InventoryBreakdownLedger({
  snapshot,
}: {
  snapshot: ObservableAnalysisSnapshot;
}) {
  const inventory = snapshot.supply.inventory;
  return (
    <section
      className="realtime-supply-detail"
      data-analysis-version={snapshot.analysisVersion}
    >
      <header>
        <div>
          <h3>库存口径明细</h3>
          <p>企业库存采用各持有位置最近一次已审核值，具体日期逐项列示</p>
        </div>
      </header>
      <div className="realtime-supply-table-wrap">
        <table aria-label="库存分层明细">
          <thead>
            <tr>
              <th>持有环节</th>
              <th>核定库存</th>
              <th>统计口径</th>
            </tr>
          </thead>
          <tbody>
            <InventoryItem
              label="生产端已核定期初库存"
              value={inventory.productionOpeningTonnes}
            />
            <InventoryItem
              helperText={inventoryObservationLabel(
                inventory.enterpriseOpeningObservedFrom,
                inventory.enterpriseOpeningObservedThrough,
              )}
              label="企业端期初库存（上期最近库存结转）"
              value={inventory.enterpriseOpeningTonnes}
            />
            <InventoryItem
              label="生产端已核定期末库存"
              value={inventory.productionEndingTonnes}
            />
            <InventoryItem
              helperText={inventoryObservationLabel(
                inventory.enterpriseEndingObservedFrom,
                inventory.enterpriseEndingObservedThrough,
              )}
              label="企业端最近已审核库存（按期末替代）"
              value={inventory.enterpriseEndingTonnes}
            />
          </tbody>
        </table>
      </div>
      <p>
        {inventory.adoptedRecordCount.toLocaleString("zh-CN")} 条库存记录已采用
      </p>
      {snapshot.coverage.pendingReviewRecordCount > 0 ? (
        <p>
          {snapshot.coverage.pendingReviewRecordCount.toLocaleString("zh-CN")}{" "}
          条待审核记录暂不计入
        </p>
      ) : null}
      {inventory.reviewGroupCount > 0 ? (
        <p>
          {inventory.reviewGroupCount.toLocaleString("zh-CN")}{" "}
          组库存口径待复核，其他已核定库存已先计算
        </p>
      ) : null}
    </section>
  );
}

function InventoryItem({
  helperText,
  label,
  value,
}: {
  helperText?: string;
  label: string;
  value: string | null;
}) {
  return (
    <tr>
      <td>{label}</td>
      <td>{displayAmount(value)}</td>
      <td>
        {value === null ? "该环节缺少核定数据" : (helperText ?? "当前核定范围")}
      </td>
    </tr>
  );
}

function supplyMetric(
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
    aggregation: "SERVER_CALCULATION",
    sourceCount,
    missingReason: value === null ? "缺少核定数据" : null,
  };
}

function FlowItem({
  label,
  value,
  tone = "supply",
}: {
  label: string;
  value: string | null;
  tone?: "supply" | "use" | "adopted";
}) {
  return (
    <div data-tone={tone}>
      <span>{label}</span>
      <strong>{value === null ? "缺失" : displayAmount(value)}</strong>
    </div>
  );
}

function Coverage({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value.toLocaleString("zh-CN")} 条</strong>
    </div>
  );
}

function relatedRegions(
  masterData: MasterDataSnapshot | null,
  regionCode: string,
): readonly string[] {
  if (!masterData) return [regionCode];
  if (regionCode === ALL_AUTHORIZED_REGION_CODE) {
    return masterData.regions.map(({ code }) => code);
  }
  const byCode = new Map(
    masterData.regions.map((region) => [region.code, region]),
  );
  return masterData.regions
    .filter((region) => {
      let current = region;
      const visited = new Set<string>();
      while (!visited.has(current.code)) {
        if (current.code === regionCode) return true;
        visited.add(current.code);
        if (!current.parentCode) return false;
        const parent = byCode.get(current.parentCode);
        if (!parent) return false;
        current = parent;
      }
      return false;
    })
    .map(({ code }) => code);
}
