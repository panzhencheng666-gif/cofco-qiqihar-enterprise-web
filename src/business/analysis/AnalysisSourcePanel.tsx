import { useState } from "react";
import type { ObservableAnalysisSnapshot } from "@/platform/api/observableAnalysisContract";

/** Uses exactly the lineage of the displayed snapshot, never the sample directory. */
export function AnalysisSourcePanel({
  sources,
}: {
  sources: ObservableAnalysisSnapshot["lineage"];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const counts = new Map<string, number>();
  sources.forEach((source) =>
    counts.set(source.regionLabel, (counts.get(source.regionLabel) ?? 0) + 1),
  );
  const regions = [...counts].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"),
  );
  const active = selected && counts.has(selected) ? selected : null;
  const visible = active
    ? sources.filter((source) => source.regionLabel === active)
    : sources;
  return (
    <aside className="analysis-source-panel" aria-label="本期数据来源分布">
      <header>
        <span>数据来源</span>
        <h2>样本覆盖与构成</h2>
        <p>与当前图表使用同一批记录</p>
      </header>
      <div className="analysis-source-totals">
        <div>
          <strong>{sources.length.toLocaleString("zh-CN")}</strong>
          <span>采用记录</span>
        </div>
        <div>
          <strong>{regions.length}</strong>
          <span>覆盖地区</span>
        </div>
      </div>
      <div className="analysis-source-region-title">
        <h3>地区记录分布</h3>
        <span>单位：条</span>
      </div>
      <div className="analysis-source-regions">
        {regions.map(([name, count]) => (
          <button
            type="button"
            key={name}
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
      <section className="analysis-source-records">
        <h3>{active ?? "全部地区"} · 来源记录</h3>
        <p>
          显示 {Math.min(visible.length, 6)} / {visible.length}{" "}
          条，完整明细见下方
        </p>
        {visible.slice(0, 6).map((source, index) => (
          <div key={index}>
            <strong>{source.subjectLabel}</strong>
            <span>
              {source.regionLabel} · {source.periodLabel}
            </span>
          </div>
        ))}
        {!visible.length && <p>当前范围暂无采用记录</p>}
      </section>
    </aside>
  );
}
