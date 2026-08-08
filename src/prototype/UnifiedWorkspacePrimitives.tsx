import { createContext, useContext, type ReactNode } from "react";
import {
  RegionCascadeSelector,
  type RegionCascadeValue,
} from "./components/RegionCascadeSelector";
import { getEnterpriseRegionPath } from "./data/enterpriseRegionHierarchy";
import { useEnterpriseRegion } from "./EnterpriseRegionContext";
import {
  getEnterpriseRegionOptions,
  type EnterpriseRegionId,
} from "./enterpriseRegions";
import type { BusinessCoordinates } from "./formalEnterpriseModel";
import type { OperationalScope } from "./core/operationalScope";
import type { BusinessClassification } from "./core/businessClassification";

interface FormalWorkspaceScopeValue {
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  classificationOptions: readonly BusinessClassification[];
}

const FormalWorkspaceScopeContext =
  createContext<FormalWorkspaceScopeValue | null>(null);

export function useFormalWorkspaceScope() {
  return useContext(FormalWorkspaceScopeContext);
}

/** Uses the URL-owned scope whenever the formal prototype is mounted. */
export function useWorkspaceRegion() {
  const formalScope = useFormalWorkspaceScope();
  const legacyScope = useEnterpriseRegion();
  if (formalScope) {
    return {
      regionId: formalScope.scope.coordinates.regionId,
      setRegionId: (regionId: EnterpriseRegionId) =>
        formalScope.onScopeChange({ regionId }),
    };
  }
  return legacyScope;
}

export function FormalWorkspaceScopeProvider({
  scope,
  onScopeChange,
  classificationOptions,
  children,
}: FormalWorkspaceScopeValue & { children: ReactNode }) {
  return (
    <FormalWorkspaceScopeContext.Provider
      value={{ scope, onScopeChange, classificationOptions }}
    >
      {children}
    </FormalWorkspaceScopeContext.Provider>
  );
}

export type WorkspaceTone = "normal" | "good" | "warning" | "danger";
export type CollectionMode = "online" | "excel" | "system";

function isWorkspaceRegionId(value: string): value is EnterpriseRegionId {
  return (
    value === "authorized-all" ||
    getEnterpriseRegionOptions().some((region) => region.id === value)
  );
}

export function WorkspaceRegionSelect({
  label = "业务地区",
}: {
  label?: string;
}) {
  const formalScope = useFormalWorkspaceScope();
  const { regionId, setRegionId } = useWorkspaceRegion();
  const authorizedRegionIds = formalScope
    ? formalScope.scope.authorization.authorizedRegionIds
    : getEnterpriseRegionOptions().map(({ id }) => id);
  const regionPath = getEnterpriseRegionPath(regionId);
  const value: RegionCascadeValue = {
    cityId: regionPath.find(({ level }) => level === "prefecture")?.id,
    countyId: regionPath.find(({ level }) => level === "county")?.id,
  };
  const aggregateRegionByCity = {
    qiqihar: "qiqihar-all",
    heihe: "heihe-all",
    hulunbuir: "hulunbuir-designated",
  } as const;

  const applyCascadeValue = (nextValue: RegionCascadeValue) => {
    const nextRegionId =
      nextValue.countyId ??
      (nextValue.cityId
        ? aggregateRegionByCity[
            nextValue.cityId as keyof typeof aggregateRegionByCity
          ]
        : undefined);
    if (nextRegionId && isWorkspaceRegionId(nextRegionId)) {
      setRegionId(nextRegionId);
    }
  };

  return (
    <div aria-label={label} className="workspace-region-cascade" role="group">
      <RegionCascadeSelector
        authorizedRegionIds={authorizedRegionIds}
        maxLevel="county"
        value={value}
        onChange={applyCascadeValue}
      />
    </div>
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
  items: readonly (readonly [label: string, value: string])[];
}) {
  return (
    <section
      aria-label="工作区范围"
      className="unified-context-bar unified-scope-bar"
    >
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
          aria-controls={`${label}-${tab.key}-panel`}
          className={active === tab.key ? "is-active" : undefined}
          id={`${label}-${tab.key}-tab`}
          key={tab.key}
          role="tab"
          tabIndex={active === tab.key ? 0 : -1}
          type="button"
          onClick={() => onChange(tab.key)}
          onKeyDown={(event) => {
            const tabs = Array.from(
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                "[role=tab]",
              ) ?? [],
            );
            const currentIndex = tabs.indexOf(event.currentTarget);
            const nextIndex =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? tabs.length - 1
                  : event.key === "ArrowRight"
                    ? (currentIndex + 1) % tabs.length
                    : event.key === "ArrowLeft"
                      ? (currentIndex - 1 + tabs.length) % tabs.length
                      : null;
            if (nextIndex === null) return;
            event.preventDefault();
            tabs[nextIndex].focus();
            onChange(tabs[nextIndex].dataset.workspaceTabKey!);
          }}
          data-workspace-tab-key={tab.key}
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
  className = "",
}: {
  label: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={label}
      className={`workspace-filter-bar ${className}`.trim()}
    >
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
  onPageChange,
}: {
  total: number;
  start: number;
  end: number;
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <nav aria-label="表格分页" className="workspace-pagination">
      <span>{`共 ${String(total)} 条 · 当前 ${String(start)}–${String(end)}`}</span>
      <button
        aria-label="上一页"
        disabled={page === 1}
        type="button"
        onClick={() => onPageChange(page - 1)}
      >
        ‹
      </button>
      <strong>{page}</strong>
      <span>/ {pages}</span>
      <button
        aria-label="下一页"
        disabled={page === pages}
        type="button"
        onClick={() => onPageChange(page + 1)}
      >
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
    ["excel", "电子表格批量导入"],
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
