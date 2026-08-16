import { useEffect, useMemo, useState } from "react";

import type {
  ObservableAnalysisQuery,
  ObservableAnalysisSnapshot,
} from "@/platform/api/observableAnalysisContract";
import {
  realtimeBusinessRepository,
  type MasterDataSnapshot,
  type RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { ObservableAnalysisFilters } from "./ObservableAnalysisFilters";
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
  regionCode = "230200",
  surveyYear = new Date().getFullYear(),
  authorizedRegionCodes = ["*"],
}: {
  repository?: RealtimeBusinessRepository;
  productCode?: string;
  regionCode?: string;
  surveyYear?: number;
  authorizedRegionCodes?: readonly string[];
}) {
  const defaultQuery = useMemo<ObservableAnalysisQuery>(
    () => ({ productCode, regionCode, surveyYear }),
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
        if (active) setMasterData(next);
      })
      .catch(() => {
        if (active) setMasterError("分析筛选项暂时无法读取，请稍后重试。");
      });
    return () => {
      active = false;
    };
  }, [repository]);

  const { snapshot, status, error, refresh } = useObservableAnalysisSnapshot({
    query,
    repository,
  });

  return (
    <div className="enterprise-ledger-workbench observable-analysis-page">
      <div className="enterprise-ledger-workbench__breadcrumb">产情监测 / 产情分析</div>
      <header className="enterprise-ledger-title observable-analysis-title">
        <div>
          <h1>产情分析</h1>
          <p>按生产问题查看当前核定填报数据、自动勾稽结果和数据来源</p>
        </div>
        <button disabled={status === "loading"} type="button" onClick={refresh}>
          刷新分析
        </button>
      </header>

      {masterData ? (
        <ObservableAnalysisFilters
          authorizedRegionCodes={authorizedRegionCodes}
          defaultQuery={defaultQuery}
          masterData={masterData}
          query={query}
          onChange={setQuery}
        />
      ) : (
        <p>正在读取分析范围…</p>
      )}
      {masterError ? <p role="alert">{masterError}</p> : null}
      {error ? <p role="alert">{error.message}</p> : null}
      {status === "loading" && !snapshot ? <p>正在汇总核定产情数据…</p> : null}
      {snapshot ? <ProductionResult snapshot={snapshot} realtimeStatus={status} /> : null}
    </div>
  );
}

function ProductionResult({
  snapshot,
  realtimeStatus,
}: {
  snapshot: ObservableAnalysisSnapshot;
  realtimeStatus: string;
}) {
  const metrics = new Map(snapshot.production.metrics.map((metric) => [metric.code, metric]));
  const version = snapshot.analysisVersion;
  const overview = select(metrics, [
    "CULTIVATED_AREA",
    "HARVEST_AREA",
    "WEIGHTED_YIELD_PER_MU",
    "EXPECTED_OUTPUT",
  ]);
  const damage = select(metrics, ["AFFECTED_AREA"]);
  const intention = select(metrics, ["INTENDED_AREA", "CULTIVATED_AREA"]);

  return (
    <>
      <section className="observable-analysis-status" data-analysis-version={version}>
        <strong>{stateLabels[snapshot.qualityState]}</strong>
        <span>{realtimeStatus === "reconnecting" ? "实时连接正在恢复，保留当前结果" : "核定数据变化后自动刷新"}</span>
        <span>数据截止：{formatDate(snapshot.dataCutoffAt)}</span>
        <span>{snapshot.coverage.recordCount} 条核定记录</span>
      </section>

      <AnalysisSection
        description="回答种了多少、预计收获多少、单产和总产分别是多少。"
        metrics={overview}
        title="生产概况"
        version={version}
      >
        <MetricBars metrics={overview} name="生产概况指标图" />
        <MetricTable metrics={overview} name="生产概况等价数据表" />
        <p className="observable-analysis-summary">{overviewSummary(metrics)}</p>
      </AnalysisSection>

      <AnalysisSection
        description="回答当前模板能够核定的灾损情况；没有核定值时明确标为缺失。"
        metrics={damage}
        title="长势与灾损"
        version={version}
      />

      <AnalysisSection
        description="用生产填报的库存、销售和自用数据解释余粮去向，并展示自动勾稽。"
        metrics={[]}
        title="余粮与去向"
        version={version}
      >
        <dl className="observable-analysis-metric-grid">
          <SnapshotAmount label="期初可观测库存" value={snapshot.supply.calculation.openingObservableInventoryTonnes} />
          <SnapshotAmount label="自用数量" value={snapshot.supply.calculation.selfUseTonnes} />
          <SnapshotAmount label="期末可观测库存" value={snapshot.supply.calculation.endingObservableInventoryTonnes} />
          <SnapshotAmount label="主体勾稽记录" value={String(snapshot.production.sourceBalances.length)} unit="条" />
        </dl>
      </AnalysisSection>

      <AnalysisSection
        description="只展示当前填报模板中实际存在且已核定的质量、成本、补贴和保险事实。"
        metrics={[]}
        title="质量与成本"
        version={version}
      >
        <p className="observable-analysis-empty">当前核定模板未提供可汇总的质量与成本事实，不以其他字段替代。</p>
      </AnalysisSection>

      <AnalysisSection
        description="将下年度意向面积与当前核定播种面积并列，观察计划调整。"
        metrics={intention}
        title="下年种植意向"
        version={version}
      >
        <MetricBars metrics={intention} name="种植意向对比图" />
      </AnalysisSection>

      <section className="observable-analysis-section" data-analysis-version={version}>
        <header>
          <div>
            <h2>核定数据来源</h2>
            <p>本页结论仅来自当前范围实际采用的产情记录。</p>
          </div>
        </header>
        <div className="realtime-supply-table-wrap">
          <table aria-label="产情核定数据来源">
            <thead><tr><th>调查对象</th><th>地区</th><th>期间</th><th>核定时间</th></tr></thead>
            <tbody>
              {snapshot.lineage.filter(({ sourceDomain }) => sourceDomain === "PRODUCTION").map((item) => (
                <tr key={`${item.subjectLabel}-${item.regionLabel}-${item.periodLabel}`}>
                  <td>{item.subjectLabel}</td><td>{item.regionLabel}</td><td>{item.periodLabel}</td><td>{formatDate(item.approvedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function AnalysisSection({
  title,
  description,
  metrics,
  version,
  children,
}: {
  title: string;
  description: string;
  metrics: readonly Metric[];
  version: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="observable-analysis-section" data-analysis-version={version}>
      <header><div><h2>{title}</h2><p>{description}</p></div></header>
      {metrics.length ? <MetricCards metrics={metrics} /> : null}
      {children}
    </section>
  );
}

function MetricCards({ metrics }: { metrics: readonly Metric[] }) {
  return (
    <dl className="observable-analysis-metric-grid">
      {metrics.map((metric) => (
        <div key={metric.code}><dt>{metric.label}</dt><dd>{metricValue(metric)}</dd><small>{metric.sourceCount} 条来源</small></div>
      ))}
    </dl>
  );
}

function MetricBars({ metrics, name }: { metrics: readonly Metric[]; name: string }) {
  const present = metrics.filter((metric) => metric.value !== null);
  const maximum = Math.max(...present.map((metric) => Number(metric.value)), 1);
  return (
    <figure className="observable-analysis-bars" role="img" aria-label={name}>
      {metrics.map((metric) => (
        <div key={metric.code}><span>{metric.label}</span><i style={{ width: metric.value === null ? "0" : `${Math.max((Number(metric.value) / maximum) * 100, 2)}%` }} /><strong>{metricValue(metric)}</strong></div>
      ))}
    </figure>
  );
}

function MetricTable({ metrics, name }: { metrics: readonly Metric[]; name: string }) {
  return (
    <table className="observable-analysis-equivalent-table" aria-label={name}>
      <thead><tr><th>项目</th><th>核定结果</th><th>来源数</th></tr></thead>
      <tbody>{metrics.map((metric) => <tr key={metric.code}><td>{metric.label}</td><td>{metricValue(metric)}</td><td>{metric.sourceCount}</td></tr>)}</tbody>
    </table>
  );
}

function SnapshotAmount({ label, value, unit = "吨" }: { label: string; value: string | null; unit?: string }) {
  return <div><dt>{label}</dt><dd>{value === null ? "缺少核定数据" : `${formatNumber(value)} ${unit}`}</dd></div>;
}

function metricValue(metric: Metric): string {
  return metric.value === null ? (metric.missingReason ?? "缺少核定数据") : `${formatNumber(metric.value)} ${metric.unit}`;
}

function formatNumber(value: string): string {
  return Number(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function select(metrics: ReadonlyMap<string, Metric>, codes: readonly string[]): readonly Metric[] {
  return codes.flatMap((code) => {
    const metric = metrics.get(code);
    return metric ? [metric] : [];
  });
}

function overviewSummary(metrics: ReadonlyMap<string, Metric>): string {
  const cultivated = metrics.get("CULTIVATED_AREA")?.value;
  const harvest = metrics.get("HARVEST_AREA")?.value;
  if (!cultivated || !harvest || Number(cultivated) === 0) return "当前核定数据不足，暂不能形成面积关系摘要。";
  return `预计收获面积为播种面积的 ${((Number(harvest) / Number(cultivated)) * 100).toFixed(1)}%。`;
}
