import type { ReactNode } from "react";
import { useEnterpriseRegion } from "./EnterpriseRegionContext";
import {
  enterpriseRegionGroups,
  type EnterpriseRegionId,
} from "./enterpriseRegions";

export type WorkspaceTone = "normal" | "good" | "warning" | "danger";
export type CollectionMode = "online" | "excel" | "system";

export function WorkspaceRegionSelect({
  label = "业务地区",
}: {
  label?: string;
}) {
  const { regionId, setRegionId } = useEnterpriseRegion();
  return (
    <select
      aria-label={label}
      className="workspace-region-select"
      value={regionId}
      onChange={(event) =>
        setRegionId(event.target.value as EnterpriseRegionId)
      }
    >
      {enterpriseRegionGroups.map((group) => (
        <optgroup key={group.id} label={group.label}>
          {group.regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

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
  items: readonly (readonly [label: string, value: ReactNode])[];
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
          {typeof value === "string" ? <strong>{value}</strong> : value}
        </div>
      ))}
    </section>
  );
}

export function WorkspaceScopeBar({
  items,
}: {
  items: readonly (readonly [label: string, value: ReactNode])[];
}) {
  return (
    <section aria-label="工作区范围" className="unified-context-bar">
      {items.map(([label, value]) => (
        <div key={label}>
          <small>{label}</small>
          {typeof value === "string" ? <strong>{value}</strong> : value}
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

export interface WorkspaceTab {
  key: string;
  label: string;
  count?: string;
}

export interface WorkspaceSummaryItem {
  label: string;
  value: string;
  note?: string;
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
        <span className={`is-${metric.tone ?? "normal"}`} key={metric.label}>
          <small>{metric.label}</small>
          <strong>
            {metric.value}
            {metric.unit && <span>{metric.unit}</span>}
          </strong>
          <p>{metric.note}</p>
        </span>
      ))}
    </section>
  );
}

export function WorkspaceTabs({
  label,
  tabs,
  active,
  onChange,
}: {
  label: string;
  tabs: readonly WorkspaceTab[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div aria-label={label} className="workspace-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          aria-selected={active === tab.key}
          className={active === tab.key ? "is-active" : undefined}
          key={tab.key}
          role="tab"
          type="button"
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          {tab.count && <span>{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function WorkspaceFilterBar({
  label,
  children,
  actions,
}: {
  label: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section aria-label={label} className="workspace-filter-bar">
      <div className="workspace-filter-fields">{children}</div>
      {actions && <div className="workspace-filter-actions">{actions}</div>}
    </section>
  );
}

export function WorkspaceSummaryStrip({
  items,
  label = "业务状态摘要",
}: {
  items: readonly WorkspaceSummaryItem[];
  label?: string;
}) {
  return (
    <div aria-label={label} className="workspace-summary-strip">
      {items.map((item) => (
        <span className={`is-${item.tone ?? "normal"}`} key={item.label}>
          {item.label}
          <strong>{item.value}</strong>
          {item.note && <small>{item.note}</small>}
        </span>
      ))}
    </div>
  );
}

export function WorkspaceInlineStats({
  items,
  label = "业务状态统计",
}: {
  items: readonly WorkspaceSummaryItem[];
  label?: string;
}) {
  return (
    <div aria-label={label} className="workspace-inline-stats">
      {items.map((item) => (
        <span className={`is-${item.tone ?? "normal"}`} key={item.label}>
          {item.label}
          <strong>{item.value}</strong>
          {item.note && <small>{item.note}</small>}
        </span>
      ))}
    </div>
  );
}

export function WorkspaceTableToolbar({
  title,
  note,
  actions,
}: {
  title: string;
  note?: string;
  actions?: ReactNode;
}) {
  return (
    <div aria-label={title} className="workspace-table-toolbar" role="toolbar">
      <strong>{title}</strong>
      {note && <span>{note}</span>}
      {actions && <div>{actions}</div>}
    </div>
  );
}

export function WorkspacePagination({
  total,
  start,
  end,
  page,
  pages,
}: {
  total: number;
  start: number;
  end: number;
  page: number;
  pages: number;
}) {
  return (
    <nav aria-label="表格分页" className="workspace-pagination">
      <span>{`共 ${String(total)} 条 · 当前 ${String(start)}–${String(end)}`}</span>
      <button aria-label="上一页" disabled={page === 1} type="button">
        ‹
      </button>
      <strong>{page}</strong>
      <span>/ {pages}</span>
      <button aria-label="下一页" disabled={page === pages} type="button">
        ›
      </button>
    </nav>
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
