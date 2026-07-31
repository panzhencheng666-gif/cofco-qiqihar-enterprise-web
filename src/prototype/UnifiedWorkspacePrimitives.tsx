import type { ReactNode } from "react";

export type WorkspaceTone = "normal" | "good" | "warning" | "danger";
export type CollectionMode = "online" | "excel" | "system";

export function WorkspaceHeader({
  eyebrow,
  title,
  summary,
  actions,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  actions?: ReactNode;
}) {
  return (
    <header className="unified-page-header">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{summary}</p>
      </div>
      {actions && <div className="unified-page-actions">{actions}</div>}
    </header>
  );
}

export function BusinessContextBar({
  items,
  state,
  tone = "good",
}: {
  items: readonly (readonly [label: string, value: string])[];
  state: string;
  tone?: WorkspaceTone;
}) {
  return (
    <section aria-label="当前业务上下文" className="unified-context-bar">
      <div className={`unified-context-state is-${tone}`}>
        <span />
        <small>当前状态</small>
        <strong>{state}</strong>
      </div>
      {items.map(([label, value]) => (
        <div key={label}>
          <small>{label}</small>
          <strong>{value}</strong>
        </div>
      ))}
    </section>
  );
}

export function WorkspaceStatus({
  children,
  tone = "normal",
}: {
  children: ReactNode;
  tone?: WorkspaceTone;
}) {
  return (
    <span className={`unified-status is-${tone}`} data-tone={tone}>
      {children}
    </span>
  );
}

export interface CompactMetric {
  label: string;
  value: string;
  unit?: string;
  note: string;
  tone?: WorkspaceTone;
}

export function CompactMetricStrip({
  metrics,
  label = "核心业务指标",
}: {
  metrics: readonly CompactMetric[];
  label?: string;
}) {
  return (
    <section aria-label={label} className="unified-metric-strip">
      {metrics.map((metric) => (
        <article className={`is-${metric.tone ?? "normal"}`} key={metric.label}>
          <small>{metric.label}</small>
          <strong>
            {metric.value}
            {metric.unit && <span>{metric.unit}</span>}
          </strong>
          <p>{metric.note}</p>
        </article>
      ))}
    </section>
  );
}

export function WorkspacePanel({
  kicker,
  title,
  note,
  actions,
  children,
  className = "",
}: {
  kicker?: string;
  title: string;
  note?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`unified-panel ${className}`.trim()}>
      <header className="unified-panel-header">
        <div>
          {kicker && <span>{kicker}</span>}
          <h2>{title}</h2>
          {note && <p>{note}</p>}
        </div>
        {actions && <div className="unified-panel-actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

export function WorkspaceTable({
  label,
  columns,
  rows,
}: {
  label: string;
  columns: readonly string[];
  rows: readonly (readonly ReactNode[])[];
}) {
  return (
    <div className="unified-table-scroll">
      <table aria-label={label} className="unified-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${label}-${String(rowIndex)}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${String(cellIndex)}-${String(rowIndex)}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CollectionModeSwitch({
  mode,
  onChange,
}: {
  mode: CollectionMode;
  onChange: (mode: CollectionMode) => void;
}) {
  const modes: readonly [CollectionMode, string][] = [
    ["online", "在线填报"],
    ["excel", "Excel批量导入"],
    ["system", "授权系统接入"],
  ];
  return (
    <div aria-label="数据采集方式" className="unified-mode-switch">
      {modes.map(([key, label]) => (
        <button
          aria-pressed={mode === key}
          className={mode === key ? "is-active" : undefined}
          key={key}
          type="button"
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
