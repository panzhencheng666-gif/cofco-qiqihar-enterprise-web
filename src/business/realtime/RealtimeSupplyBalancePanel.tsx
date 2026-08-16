import { useEffect, useMemo, useState } from "react";

import { ObservableAnalysisFilters } from "@/business/analysis/ObservableAnalysisFilters";
import { useObservableAnalysisSnapshot } from "@/business/analysis/useObservableAnalysisSnapshot";
import type {
  AnalysisQualityState,
  ObservableAnalysisQuery,
  ObservableAnalysisSnapshot,
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

function displayDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function RealtimeSupplyBalancePanel({
  productCode = "CORN",
  regionCode = "230200",
  periodCode = "",
  onPeriodCodeChange,
  authorizedRegionCodes = allAuthorizedRegions,
  repository = realtimeBusinessRepository,
}: RealtimeSupplyBalancePanelProps) {
  return (
    <CurrentScopeSupplyBalancePanel
      key={`${productCode}|${regionCode}|${periodCode}`}
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
        if (active) setMasterData(next);
      })
      .catch(() => {
        if (active) setMasterError("分析筛选项暂时无法读取，请稍后重试。");
      });
    return () => {
      active = false;
    };
  }, [repository]);

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
      aria-label="实时供需平衡"
      className="realtime-business-panel realtime-supply-panel"
    >
      <header>
        <div>
          <p className="realtime-supply-eyebrow">经营决策分析</p>
          <h2>实时供需平衡</h2>
          <p>
            将当前核定的产情、市场和物流数据按同一范围自动汇总，结果仅供查看，不在此页面填报或修改。
          </p>
        </div>
        <button disabled={status === "loading"} type="button" onClick={refresh}>
          刷新结果
        </button>
      </header>

      {masterData ? (
        <ObservableAnalysisFilters
          authorizedRegionCodes={authorizedRegionCodes}
          defaultQuery={defaultQuery}
          masterData={masterData}
          query={query}
          onChange={changeQuery}
        />
      ) : (
        <p className="realtime-supply-loading">正在读取分析范围…</p>
      )}

      {masterError ? <p role="alert">{masterError}</p> : null}
      {error ? <p role="alert">{error.message}</p> : null}
      {status === "loading" && !snapshot ? (
        <p className="realtime-supply-loading">正在汇总核定数据并自动计算…</p>
      ) : null}

      {snapshot ? (
        <SupplyResult
          cursorGapDetected={cursorGapDetected}
          reconnecting={status === "reconnecting"}
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
}: {
  snapshot: ObservableAnalysisSnapshot;
  reconnecting: boolean;
  cursorGapDetected: boolean;
}) {
  const calculation = snapshot.supply.calculation;
  const version = snapshot.analysisVersion;
  const blocked = ["BLOCKED", "NO_APPROVED_DATA"].includes(
    snapshot.qualityState,
  );
  const qualityReasons = [
    ...new Set([
      ...snapshot.blockingReasons,
      ...snapshot.warnings,
      ...calculation.issues,
    ]),
  ];
  const kpis = [
    ["预计总产", calculation.expectedOutputTonnes],
    ["期初可观测库存", calculation.openingObservableInventoryTonnes],
    ["期末可观测库存", calculation.endingObservableInventoryTonnes],
    ["推算其他消耗", calculation.inferredOtherAbsorptionTonnes],
  ] as const;

  return (
    <>
      <section
        className={`realtime-supply-conclusion${blocked ? " is-blocked" : ""}`}
        data-analysis-version={version}
      >
        <div className="realtime-supply-conclusion__status">
          <span>{qualityLabels[snapshot.qualityState]}</span>
          <strong>自动计算，只读展示</strong>
          <small>数据截止：{displayDate(snapshot.dataCutoffAt)}</small>
        </div>
        <dl className="realtime-supply-kpis realtime-supply-kpis--observable">
          {kpis.map(([label, value]) => (
            <div key={label} className={label === "期末可观测库存" ? "is-primary" : ""}>
              <dt>{label}</dt>
              <dd>{displayAmount(value)}</dd>
              <small>{value === null ? "未以零值代替" : "当前核定范围"}</small>
            </div>
          ))}
        </dl>
      </section>

      <p className="realtime-supply-live-state" role="status">
        {reconnecting
          ? "实时连接正在恢复，当前结果继续保留"
          : cursorGapDetected
            ? "已发现数据通知缺口，结果已完整刷新"
            : "实时连接正常，核定数据变化后自动刷新"}
      </p>

      <section
        className="realtime-supply-detail"
        data-analysis-version={version}
      >
        <header>
          <div>
            <h3>供需流向桥</h3>
            <p>可观测供给 = 可观测使用 + 期末可观测库存</p>
          </div>
        </header>
        <div className="realtime-supply-bridge__flow realtime-supply-bridge__flow--observable">
          <FlowItem label="期初库存" value={calculation.openingObservableInventoryTonnes} />
          <b>+</b>
          <FlowItem label="预计总产" value={calculation.expectedOutputTonnes} />
          <b>+</b>
          <FlowItem label="流入" value={calculation.inflowTonnes} />
          <b>=</b>
          <FlowItem label="自用 + 流出 + 其他消耗" value={sumUseLabel(calculation)} tone="use" />
          <b>+</b>
          <FlowItem label="期末库存" value={calculation.endingObservableInventoryTonnes} tone="adopted" />
        </div>
        <p className="realtime-supply-formula-note">
          “推算其他消耗”只是在当前核定数据范围内用于闭合等式的差额，不作为独立调查数据。
        </p>
      </section>

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
                snapshot.production.sourceBalances.map((balance, index) => (
                  <tr key={`${index}-${balance.estimatedOutputTonnes ?? "missing"}`}>
                    <td>{index + 1}</td>
                    <td>{displayAmount(balance.estimatedOutputTonnes)}</td>
                    <td>{displayAmount(balance.productionAvailableTonnes)}</td>
                    <td>{displayAmount(balance.knownDestinationTonnes)}</td>
                    <td>{displayAmount(balance.theoreticalEndingInventoryTonnes)}</td>
                    <td>{displayAmount(balance.reportedEndingInventoryTonnes)}</td>
                    <td>{displayAmount(balance.reconciliationDifferenceTonnes)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>当前范围暂无可展示的生产主体勾稽明细。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className="realtime-supply-validation"
        data-analysis-version={version}
      >
        <div>
          <h3>数据覆盖与质量</h3>
          <strong>{qualityLabels[snapshot.qualityState]}</strong>
        </div>
        <Coverage label="核定记录" value={snapshot.coverage.recordCount} />
        <Coverage label="调查主体" value={snapshot.coverage.uniqueSubjectCount} />
        <Coverage label="覆盖地区" value={snapshot.coverage.coveredRegionCount} />
        <Coverage label="排除记录" value={snapshot.coverage.excludedRecordCount} />
        {qualityReasons.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </section>

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
        <div className="realtime-supply-table-wrap">
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
                <tr key={`${item.sourceDomain}-${item.subjectLabel}-${item.periodLabel}`}>
                  <td>{domainLabels[item.sourceDomain]}</td>
                  <td>{item.subjectLabel}</td>
                  <td>{item.regionLabel}</td>
                  <td>{item.periodLabel}</td>
                  <td>{item.factCodes.join("、")}</td>
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
  );
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

function sumUseLabel(
  calculation: ObservableAnalysisSnapshot["supply"]["calculation"],
): string | null {
  const values = [
    calculation.selfUseTonnes,
    calculation.outflowTonnes,
    calculation.inferredOtherAbsorptionTonnes,
  ];
  if (values.some((value) => value === null)) return null;
  const total = values.reduce((sum, value) => sum + Number(value), 0);
  return total.toFixed(4);
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
  const byCode = new Map(masterData.regions.map((region) => [region.code, region]));
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
