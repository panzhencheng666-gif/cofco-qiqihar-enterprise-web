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

type Metric = ObservableAnalysisSnapshot["market"]["metrics"][number];

export function MarketAnalysisPanel({
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
      <div className="enterprise-ledger-workbench__breadcrumb">市场监测 / 市场分析</div>
      <header className="enterprise-ledger-title observable-analysis-title">
        <div><h1>市场分析</h1><p>按价格、购销、库存、流通成本、质量和主体范围解释当前核定市场数据</p></div>
        <button disabled={status === "loading"} type="button" onClick={refresh}>刷新分析</button>
      </header>
      {masterData ? (
        <ObservableAnalysisFilters
          authorizedRegionCodes={authorizedRegionCodes}
          defaultQuery={defaultQuery}
          masterData={masterData}
          query={query}
          onChange={setQuery}
        />
      ) : <p>正在读取分析范围…</p>}
      {masterError ? <p role="alert">{masterError}</p> : null}
      {error ? <p role="alert">{error.message}</p> : null}
      {status === "loading" && !snapshot ? <p>正在汇总核定市场数据…</p> : null}
      {snapshot ? <MarketResult snapshot={snapshot} realtimeStatus={status} /> : null}
    </div>
  );
}

function MarketResult({ snapshot, realtimeStatus }: { snapshot: ObservableAnalysisSnapshot; realtimeStatus: string }) {
  const market = new Map(snapshot.market.metrics.map((metric) => [metric.code, metric]));
  const logistics = new Map(snapshot.logistics.metrics.map((metric) => [metric.code, metric]));
  const version = snapshot.analysisVersion;
  const prices = select(market, ["AVERAGE_TRADE_PRICE", "AVERAGE_PURCHASE_PRICE", "AVERAGE_SALE_PRICE", "BOARD_PRICE"]);
  const activity = select(market, ["PURCHASE_VOLUME", "SALES_VOLUME", "NET_PURCHASE_VOLUME", "PROCESSING_INPUT"]);
  const inventory = select(market, ["CURRENT_INVENTORY", "INVENTORY_CHANGE"]);
  const costs = select(logistics, ["AVERAGE_FREIGHT_RATE"]);

  return (
    <>
      <section className="observable-analysis-status" data-analysis-version={version}>
        <strong>{qualityLabel(snapshot.qualityState)}</strong>
        <span>{realtimeStatus === "reconnecting" ? "实时连接正在恢复，保留当前结果" : "核定数据变化后自动刷新"}</span>
        <span>数据截止：{formatDate(snapshot.dataCutoffAt)}</span>
        <span>{snapshot.coverage.recordCount} 条核定记录</span>
      </section>

      <Theme title="价格运行" description="分别查看成交价、采购价、销售价和车板价；不同价格口径不合并。" version={version}>
        <MetricCards metrics={prices} />
        <MetricBars metrics={prices} name="市场价格对比图" />
        <MetricTable metrics={prices} name="市场价格等价数据表" />
        <p className="observable-analysis-summary">{priceSummary(market)}</p>
      </Theme>

      <Theme title="购销活动" description="只汇总当前对象类型适用的购销量；缺失或不适用不按零计算。" version={version}>
        <MetricCards metrics={activity} />
        <p className="observable-analysis-summary">市场购销量仅用于市场活动分析，不进入供需平衡总量。</p>
      </Theme>

      <Theme title="库存监测" description="查看市场主体当前库存和可比期间变化，不与生产端余粮重复相加。" version={version}>
        {inventory.length ? <MetricCards metrics={inventory} /> : <Empty>当前核定市场模板未形成可汇总的库存变化事实。</Empty>}
      </Theme>

      <Theme title="流通成本" description="展示物流填报中的核定运价等成本事实，只作为市场解释指标。" version={version}>
        {costs.length ? <MetricCards metrics={costs} /> : <Empty>当前范围暂无核定流通成本数据。</Empty>}
      </Theme>

      <Theme title="市场质量" description="只展示当前产品和对象类型实际适用的核定质量字段。" version={version}>
        <Empty>当前核定市场模板未提供可汇总的质量分布事实。</Empty>
      </Theme>

      <Theme title="地区与主体对比" description="按当前授权地区和核定调查主体解释覆盖范围，不展示内部代码。" version={version}>
        <dl className="observable-analysis-metric-grid">
          <Count label="覆盖地区" value={snapshot.coverage.coveredRegionCount} />
          <Count label="调查主体" value={snapshot.coverage.uniqueSubjectCount} />
          <Count label="核定记录" value={snapshot.coverage.recordCount} />
          <Count label="排除记录" value={snapshot.coverage.excludedRecordCount} />
        </dl>
        <div className="realtime-supply-table-wrap">
          <table aria-label="市场地区与主体来源">
            <thead><tr><th>业务来源</th><th>调查对象</th><th>地区</th><th>期间</th><th>核定时间</th></tr></thead>
            <tbody>
              {snapshot.lineage.filter(({ sourceDomain }) => sourceDomain !== "PRODUCTION").map((item) => (
                <tr key={`${item.sourceDomain}-${item.subjectLabel}-${item.regionLabel}-${item.periodLabel}`}>
                  <td>{item.sourceDomain === "MARKET" ? "市场填报" : "物流填报"}</td><td>{item.subjectLabel}</td><td>{item.regionLabel}</td><td>{item.periodLabel}</td><td>{formatDate(item.approvedAt)}</td>
                </tr>
              ))}
              {!snapshot.lineage.some(({ sourceDomain }) => sourceDomain !== "PRODUCTION") ? <tr><td colSpan={5}>当前范围暂无市场或物流核定来源。</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Theme>
    </>
  );
}

function Theme({ title, description, version, children }: { title: string; description: string; version: string; children: React.ReactNode }) {
  return <section className="observable-analysis-section" data-analysis-version={version}><header><div><h2>{title}</h2><p>{description}</p></div></header>{children}</section>;
}

function MetricCards({ metrics }: { metrics: readonly Metric[] }) {
  if (!metrics.length) return <Empty>当前范围暂无适用的核定数据。</Empty>;
  return <dl className="observable-analysis-metric-grid">{metrics.map((metric) => <div key={metric.code}><dt>{metric.label}</dt><dd>{metricValue(metric)}</dd><small>{metric.sourceCount} 条适用来源</small></div>)}</dl>;
}

function MetricBars({ metrics, name }: { metrics: readonly Metric[]; name: string }) {
  const maximum = Math.max(...metrics.filter(({ value }) => value !== null).map(({ value }) => Number(value)), 1);
  return <figure className="observable-analysis-bars" role="img" aria-label={name}>{metrics.map((metric) => <div key={metric.code}><span>{metric.label}</span><i style={{ width: metric.value === null ? "0" : `${Math.max((Number(metric.value) / maximum) * 100, 2)}%` }} /><strong>{metricValue(metric)}</strong></div>)}</figure>;
}

function MetricTable({ metrics, name }: { metrics: readonly Metric[]; name: string }) {
  return <table className="observable-analysis-equivalent-table" aria-label={name}><thead><tr><th>价格口径</th><th>核定结果</th><th>适用来源</th></tr></thead><tbody>{metrics.map((metric) => <tr key={metric.code}><td>{metric.label}</td><td>{metricValue(metric)}</td><td>{metric.sourceCount}</td></tr>)}</tbody></table>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="observable-analysis-empty">{children}</p>;
}

function Count({ label, value }: { label: string; value: number }) {
  return <div><dt>{label}</dt><dd>{value.toLocaleString("zh-CN")} 条</dd></div>;
}

function select(metrics: ReadonlyMap<string, Metric>, codes: readonly string[]): readonly Metric[] {
  return codes.flatMap((code) => { const metric = metrics.get(code); return metric ? [metric] : []; });
}

function metricValue(metric: Metric): string {
  return metric.value === null ? (metric.missingReason ?? "缺少核定数据") : `${Number(metric.value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${metric.unit}`;
}

function priceSummary(metrics: ReadonlyMap<string, Metric>): string {
  const purchase = metrics.get("AVERAGE_PURCHASE_PRICE")?.value;
  const sale = metrics.get("AVERAGE_SALE_PRICE")?.value;
  if (!purchase || !sale) return "当前核定价格数据不足，暂不能形成采购与销售价差摘要。";
  const difference = Number(sale) - Number(purchase);
  return `平均销售价较平均采购价${difference >= 0 ? "高" : "低"} ${Math.abs(difference).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} 元/吨。`;
}

function qualityLabel(state: ObservableAnalysisSnapshot["qualityState"]): string {
  return { AVAILABLE: "数据完整", PARTIAL: "部分数据缺失", COVERAGE_REVIEW_REQUIRED: "覆盖范围待复核", BLOCKED: "分析已阻断", NO_APPROVED_DATA: "暂无核定数据" }[state];
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}
