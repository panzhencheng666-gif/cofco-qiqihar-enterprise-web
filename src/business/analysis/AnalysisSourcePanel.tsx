import { useState } from "react";
import {
  observableAnalysisLineageKey,
  type ObservableAnalysisSnapshot,
} from "@/platform/api/observableAnalysisContract";

/** Region distribution and source ledger share one filtered, authoritative snapshot. */
export function AnalysisSourcePanel({
  sources,
  tableLabel = "分析数据来源",
}: {
  sources: ObservableAnalysisSnapshot["lineage"];
  tableLabel?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const counts = new Map<string, number>();
  sources.forEach((source) =>
    counts.set(source.regionLabel, (counts.get(source.regionLabel) ?? 0) + 1),
  );
  const regions = [...counts].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"),
  );
  const active = selected && counts.has(selected) ? selected : null;
  const visible = sources.filter(
    (source) =>
      (!active || source.regionLabel === active) &&
      (!search.trim() ||
        `${source.subjectLabel} ${source.regionLabel} ${source.periodLabel}`.includes(
          search.trim(),
        )),
  );
  return (
    <section className="analysis-source-panel" aria-label="本期数据来源分布">
      <header>
        <div>
          <h2>核定数据来源</h2>
          <p>
            当前图表采用 {sources.length} 条记录，覆盖 {regions.length} 个地区
          </p>
        </div>
        <label>
          搜索来源
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="调查对象、地区或期间"
          />
        </label>
      </header>
      <div className="analysis-source-body">
        <div className="analysis-source-breakdown">
          <h3>
            地区记录分布 <span>条</span>
          </h3>
          <div className="analysis-source-regions">
            {regions.map(([name, count]) => (
              <button
                key={name}
                type="button"
                aria-pressed={active === name}
                onClick={() => setSelected(active === name ? null : name)}
              >
                <span>{name}</span>
                <strong>{count}</strong>
                <i aria-hidden="true">
                  <b
                    style={{
                      width: `${(count / Math.max(1, regions[0][1])) * 100}%`,
                    }}
                  />
                </i>
              </button>
            ))}
          </div>
        </div>
        <div className="analysis-source-records">
          <div className="analysis-source-caption">
            <strong>
              {active ?? "全部地区"} · {visible.length} 条记录
            </strong>
            {active && (
              <button type="button" onClick={() => setSelected(null)}>
                清除地区筛选
              </button>
            )}
          </div>
          <div
            className="realtime-supply-table-wrap observable-analysis-report__lineage-viewport"
            data-layout="business-ledger"
          >
            <table aria-label={tableLabel}>
              <thead>
                <tr>
                  <th>业务来源</th>
                  <th>调查对象</th>
                  <th>地区</th>
                  <th>期间</th>
                  <th>采用时间</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((source, index) => (
                  <tr key={`${observableAnalysisLineageKey(source)}-${index}`}>
                    <td>
                      {source.sourceDomain === "PRODUCTION"
                        ? "产情"
                        : source.sourceDomain === "MARKET"
                          ? "市场"
                          : "物流"}
                    </td>
                    <td>{source.subjectLabel}</td>
                    <td>{source.regionLabel}</td>
                    <td>{source.periodLabel}</td>
                    <td>
                      {new Date(source.approvedAt).toLocaleString("zh-CN", {
                        hour12: false,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length && (
              <p className="analysis-source-empty">
                没有符合当前筛选条件的来源记录
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
