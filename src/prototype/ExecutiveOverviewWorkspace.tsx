import { useState } from "react";

import { AnnualComparisonTrack } from "./components/AnnualComparisonTrack";
import { ComparisonCharts } from "./components/ComparisonCharts";
import { businessClassifications } from "./core/businessClassification";
import type { BusinessWorkItem } from "./core/businessWork";
import { chinesePeriodRange } from "./core/businessDisplayPolicy";
import {
  createDefaultExecutiveLedgerQuery,
  getExecutiveScopeCoordinateIssues,
  queryExecutiveLedger,
  resolveExecutiveAggregateMembership,
  type ExecutiveDrillDownTarget,
  type ExecutiveDutyRow,
  type ExecutiveLedgerQuery,
  type ExecutiveMetricRow,
  type ExecutiveReleaseRow,
  type ExecutiveRiskRow,
} from "./core/executiveLedger";
import type { OperationalScope } from "./core/operationalScope";
import type { BusinessReportRecord } from "./businessReportWorkflow";
import {
  filterPlatformMasterDataByAuthorization,
  isCultivarApplicableToProduct,
  platformCultivars,
  platformProducts,
} from "./core/platformMasterData";
import { executiveCoordinateOptions } from "./data/executiveLedgerFixtures";
import { getEnterpriseScopeRegion } from "./enterpriseRegions";
import {
  createFormalRoute,
  type BusinessCoordinates,
  type FormalRoute,
  type OverviewSection,
} from "./formalEnterpriseModel";
import { WorkspaceHeader, WorkspaceTabs } from "./UnifiedWorkspacePrimitives";

const overviewTabs = [
  { key: "operations", label: "经营运行" },
  { key: "risks", label: "风险事项" },
  { key: "duty", label: "履责监督" },
  { key: "releases", label: "发布成果" },
] as const;

const domainLabels = new Map(
  executiveCoordinateOptions.domains.map(({ id, label }) => [id, label]),
);

interface ExecutiveFilterOption {
  id: string;
  label: string;
}

interface RealtimeExecutiveOptions {
  domains: readonly ExecutiveFilterOption[];
  regions: readonly ExecutiveFilterOption[];
  products: readonly ExecutiveFilterOption[];
  periods: readonly ExecutiveFilterOption[];
  classifications: readonly (ExecutiveFilterOption & {
    domain: BusinessWorkItem["domain"];
  })[];
}

function realtimeExecutiveOptions(
  workItems: readonly BusinessWorkItem[],
): RealtimeExecutiveOptions {
  const regions = new Map<string, string>();
  const products = new Map<string, string>();
  const periods = new Map<string, string>();
  const domains = new Set<BusinessWorkItem["domain"]>();
  const classifications = new Map<
    string,
    ExecutiveFilterOption & { domain: BusinessWorkItem["domain"] }
  >();
  for (const item of workItems) {
    domains.add(item.domain);
    if (item.regionId && item.regionLabel.trim() && !regions.has(item.regionId)) {
      regions.set(item.regionId, item.regionLabel.trim());
    }
    if (item.productId && !products.has(item.productId)) {
      const label = item.productLabel?.trim();
      if (label) products.set(item.productId, label);
    }
    if (item.periodKey && !periods.has(item.periodKey)) {
      periods.set(
        item.periodKey,
        item.effectivePeriod.trim() || item.periodKey,
      );
    }
    if (
      item.businessSubtypeId &&
      !classifications.has(item.businessSubtypeId)
    ) {
      classifications.set(item.businessSubtypeId, {
        id: item.businessSubtypeId,
        label: item.businessLabel.trim() || domainLabels.get(item.domain) || "业务事项",
        domain: item.domain,
      });
    }
  }
  return {
    domains: [...domains].map((id) => ({
      id,
      label: domainLabels.get(id) ?? "业务事项",
    })),
    regions: [...regions].map(([id, label]) => ({ id, label })),
    products: [...products].map(([id, label]) => ({ id, label })),
    periods: [...periods].map(([id, label]) => ({ id, label })),
    classifications: [...classifications.values()],
  };
}

function optionLabel(
  options: readonly { id: string; label: string }[],
  id: string | null | undefined,
  emptyLabel: string,
  unknownLabel = emptyLabel,
): string {
  if (!id) return emptyLabel;
  return options.find((option) => option.id === id)?.label ?? unknownLabel;
}

function regionLabel(regionId: string): string {
  if (!regionId) return "未选择授权地区";
  return getEnterpriseScopeRegion(regionId)?.label ?? "所选地区已不可用";
}

function classificationLabel(classificationId: string): string {
  return (
    businessClassifications.find(({ id }) => id === classificationId)?.label ??
    "所选业务分类已不可用"
  );
}

function editionNumber(value: string): string {
  return String(Number(value));
}

function executiveVersionLabel(versionId: string): string {
  const currentReportWorkflow =
    /^REPORT-WORKFLOW-(\d{4})-W(\d+)-CURRENT$/i.exec(versionId);
  if (currentReportWorkflow) {
    return `${currentReportWorkflow[1]}年第${editionNumber(currentReportWorkflow[2])}周报告处理状态`;
  }
  const currentBusinessWorkflow = /^WORKFLOW-(\d{4})-W(\d+)-CURRENT$/i.exec(
    versionId,
  );
  if (currentBusinessWorkflow) {
    return `${currentBusinessWorkflow[1]}年第${editionNumber(currentBusinessWorkflow[2])}周业务处理状态`;
  }
  const weeklyMetric = /^METRIC-(\d{4})-W(\d+)-V(\d+)$/i.exec(versionId);
  if (weeklyMetric) {
    return `${weeklyMetric[1]}年第${editionNumber(weeklyMetric[2])}周已核定数据（当前采用）`;
  }
  const weeklyDuty = /^DUTY-(\d{4})-W(\d+)-V(\d+)$/i.exec(versionId);
  if (weeklyDuty) {
    return `${weeklyDuty[1]}年第${editionNumber(weeklyDuty[2])}周履责已核定数据`;
  }
  const annualSupply = /^SUPPLY-METRIC-(\d{4})-V(\d+)$/i.exec(versionId);
  if (annualSupply) {
    return `${annualSupply[1]}年度供需已核定数据`;
  }
  const annualMetric = /^METRIC-(\d{4})-V(\d+)$/i.exec(versionId);
  if (annualMetric) {
    return `${annualMetric[1]}年度已核定数据`;
  }
  return "所选采用数据已不可用";
}

function qualityStateLabel(qualityState: string): string {
  const labels: Readonly<Record<string, string>> = {
    passed: "质量校验通过",
    warning: "存在质量提醒",
    blocking: "质量校验阻断",
    rejected: "质量校验未通过",
    pending: "等待质量复核",
  };
  return labels[qualityState] ?? "质量状态待核定";
}

function businessTimestampLabel(timestamp: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?/.exec(
    timestamp,
  );
  if (!match) return "时间待核定";
  return `${match[1]}年${editionNumber(match[2])}月${editionNumber(match[3])}日 ${match[4]}:${match[5]}`;
}

function definitionVersionLabel(
  metricLabel: string,
  versionId: string,
): string {
  return versionId ? `${metricLabel}统计公式` : "未提供统计公式版本";
}

function comparabilityVersionLabel(versionId: string): string {
  return versionId ? "四年统计口径连续可比" : "未提供可比性说明";
}

function localizedComparison(
  comparison: ExecutiveMetricRow["comparison"],
): ExecutiveMetricRow["comparison"] {
  return {
    ...comparison,
    yearCells: comparison.yearCells.map((cell) => ({
      ...cell,
      releaseVersionLabel: executiveVersionLabel(cell.releaseVersionLabel),
    })),
  };
}

function routeForTarget(target: ExecutiveDrillDownTarget): FormalRoute {
  switch (target.application) {
    case "production":
      return createFormalRoute("production", target.section);
    case "market":
      return createFormalRoute("market", target.section);
    case "supply":
      return createFormalRoute("supply", target.section);
    case "reporting":
      return createFormalRoute("reporting", target.section);
    case "overview":
      return createFormalRoute("overview", target.section);
  }
}

type ExecutiveRegionLevel = NonNullable<BusinessCoordinates["regionLevel"]>;

function regionLevelForId(regionId: string): ExecutiveRegionLevel {
  if (regionId === "authorized-all") return "custom";
  return getEnterpriseScopeRegion(regionId)?.level === "监测区域"
    ? "city"
    : "county";
}

function riskTone(state: ExecutiveRiskRow["riskState"]): "warning" | "danger" {
  return state === "blocking" ? "danger" : "warning";
}

function LedgerEmptyState({ children }: { children: string }) {
  return (
    <div className="executive-ledger-empty" role="status">
      <strong>{children}</strong>
      <span>
        系统未改变地区、期间、数据状态或采用数据，请调整当前筛选条件。
      </span>
    </div>
  );
}

function OperationsLedger({
  rows,
  selectedMetricId,
  onSelect,
  onOpenTarget,
}: {
  rows: readonly ExecutiveMetricRow[];
  selectedMetricId: string | undefined;
  onSelect: (metricId: string) => void;
  onOpenTarget: (target: ExecutiveDrillDownTarget) => void;
}) {
  if (rows.length === 0) {
    return <LedgerEmptyState>当前筛选范围没有可用经营指标</LedgerEmptyState>;
  }
  return (
    <div className="executive-ledger-scroll">
      <table
        aria-label="经营运行台账"
        className="executive-ledger-table executive-ledger-table--operations"
      >
        <thead>
          <tr>
            <th className="executive-ledger-table__indicator" scope="col">
              指标
            </th>
            <th scope="col">2023</th>
            <th scope="col">2024</th>
            <th scope="col">2024同比</th>
            <th scope="col">2025</th>
            <th scope="col">2025同比</th>
            <th scope="col">2026</th>
            <th scope="col">2026同比</th>
            <th scope="col">三年复合增长率</th>
            <th scope="col">覆盖与质量</th>
            <th scope="col">异常</th>
            <th scope="col">可比性</th>
            <th scope="col">截止</th>
            <th scope="col">采用数据</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = row.id === `metric-${selectedMetricId ?? ""}`;
            const years = row.comparison.yearCells;
            const comparisons = row.comparison.pairCells;
            const yearValue = (index: number) => {
              const year = years[index];
              return `${year.valueText}${
                year.availabilityLabel === "可用"
                  ? ` ${row.comparison.unit}`
                  : ""
              }`;
            };
            return (
              <tr
                aria-selected={selected}
                className={selected ? "is-selected" : undefined}
                key={row.id}
              >
                <th className="executive-ledger-table__indicator" scope="row">
                  <button
                    aria-label={`分析${row.comparison.metricLabel}`}
                    aria-pressed={selected}
                    className="executive-ledger-select"
                    type="button"
                    onClick={() => onSelect(row.comparison.metricId)}
                  >
                    <strong>{row.comparison.metricLabel}</strong>
                    <span>
                      {domainLabels.get(row.domain) ?? "业务类型已不可用"}
                    </span>
                    <span className="executive-ledger-select__action">
                      分析{row.comparison.metricLabel}
                    </span>
                  </button>
                </th>
                <td>{yearValue(0)}</td>
                <td>{yearValue(1)}</td>
                <td>{comparisons[0].changeText}</td>
                <td>{yearValue(2)}</td>
                <td>{comparisons[1].changeText}</td>
                <td>{yearValue(3)}</td>
                <td>{comparisons[2].changeText}</td>
                <td>{row.comparison.cagrText}</td>
                <td>
                  {row.coverage} · {qualityStateLabel(row.qualityState)}
                </td>
                <td>{row.anomaly ?? "—"}</td>
                <td>{row.comparison.comparabilityText}</td>
                <td>{businessTimestampLabel(row.cutoff)}</td>
                <td>{executiveVersionLabel(row.sourceVersionId)}</td>
                <td>
                  <button
                    className="executive-ledger-drill"
                    type="button"
                    onClick={() => onOpenTarget(row.drillDownTarget)}
                  >
                    查看业务明细
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RisksLedger({
  rows,
  onOpenTarget,
}: {
  rows: readonly ExecutiveRiskRow[];
  onOpenTarget: (target: ExecutiveDrillDownTarget) => void;
}) {
  if (rows.length === 0)
    return <LedgerEmptyState>当前筛选范围没有经营风险记录</LedgerEmptyState>;
  return (
    <div className="executive-ledger-scroll">
      <table
        aria-label="经营异常风险台账"
        className="executive-ledger-table executive-ledger-table--risks"
      >
        <thead>
          <tr>
            <th className="executive-ledger-table__indicator" scope="col">
              风险事项
            </th>
            <th scope="col">所属业务</th>
            <th scope="col">地区</th>
            <th scope="col">影响</th>
            <th scope="col">当前状态</th>
            <th scope="col">覆盖</th>
            <th scope="col">数据截止</th>
            <th scope="col">风险识别依据</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th className="executive-ledger-table__indicator" scope="row">
                {row.riskItem}
              </th>
              <td>{row.business}</td>
              <td>{row.region}</td>
              <td>{row.impact}</td>
              <td>
                <span
                  className={`executive-ledger-state is-${riskTone(row.riskState)}`}
                  data-risk-state={row.riskState}
                >
                  {row.currentState}
                </span>
              </td>
              <td>{row.coverage}</td>
              <td>{businessTimestampLabel(row.cutoff)}</td>
              <td>{executiveVersionLabel(row.sourceVersionId)}</td>
              <td>
                <button
                  className="executive-ledger-drill"
                  type="button"
                  onClick={() => onOpenTarget(row.drillDownTarget)}
                >
                  进入处置工作区
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function valueOrDash(value: string | null | undefined): string {
  return value ?? "—";
}

function DutyLedger({
  rows,
  onOpenTarget,
}: {
  rows: readonly ExecutiveDutyRow[];
  onOpenTarget: (target: ExecutiveDrillDownTarget) => void;
}) {
  if (rows.length === 0)
    return <LedgerEmptyState>当前筛选范围没有履责监督记录</LedgerEmptyState>;
  return (
    <div className="executive-ledger-scroll">
      <table
        aria-label="经营履责监督台账"
        className="executive-ledger-table executive-ledger-table--duty"
      >
        <thead>
          <tr>
            <th className="executive-ledger-table__indicator" scope="col">
              履责事项
            </th>
            <th scope="col">地区</th>
            <th scope="col">责任人及岗位</th>
            <th scope="col">截止规则</th>
            <th scope="col">本周状态</th>
            <th scope="col">逾期时长</th>
            <th scope="col">复核结论</th>
            <th scope="col">详情与操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th className="executive-ledger-table__indicator" scope="row">
                {row.assignment.businessItem}
              </th>
              <td>{row.assignment.region}</td>
              <td>
                <span className="executive-ledger-stack">
                  <strong>{row.assignment.person}</strong>
                  <small>{row.assignment.post}</small>
                </span>
              </td>
              <td>{row.assignment.deadlineRule}</td>
              <td>{valueOrDash(row.weekly?.status)}</td>
              <td>{valueOrDash(row.weekly?.overdueDuration)}</td>
              <td>{valueOrDash(row.weekly?.review)}</td>
              <td>
                <div className="executive-ledger-row-actions">
                  <details className="executive-ledger-details">
                    <summary>查看完整履责记录</summary>
                    <dl>
                      <div>
                        <dt>填报频率</dt>
                        <dd>{row.assignment.frequency}</dd>
                      </div>
                      <div>
                        <dt>复核人</dt>
                        <dd>{row.assignment.reviewer}</dd>
                      </div>
                      <div>
                        <dt>有效期</dt>
                        <dd>
                          {chinesePeriodRange(row.assignment.effectivePeriod)}
                        </dd>
                      </div>
                      <div>
                        <dt>责任状态</dt>
                        <dd>{row.assignment.status}</dd>
                      </div>
                      <div>
                        <dt>首次合格提交</dt>
                        <dd>
                          {valueOrDash(row.weekly?.firstQualifiedSubmission)}
                        </dd>
                      </div>
                      <div>
                        <dt>月度应报</dt>
                        <dd>{valueOrDash(row.monthly?.expected)}</dd>
                      </div>
                      <div>
                        <dt>月度按时</dt>
                        <dd>{valueOrDash(row.monthly?.onTime)}</dd>
                      </div>
                      <div>
                        <dt>月度逾期</dt>
                        <dd>{valueOrDash(row.monthly?.overdue)}</dd>
                      </div>
                      <div>
                        <dt>月度缺报</dt>
                        <dd>{valueOrDash(row.monthly?.missing)}</dd>
                      </div>
                      <div>
                        <dt>月度退回</dt>
                        <dd>{valueOrDash(row.monthly?.returned)}</dd>
                      </div>
                      <div>
                        <dt>月度按时率</dt>
                        <dd>{valueOrDash(row.monthly?.onTimeRate)}</dd>
                      </div>
                      <div>
                        <dt>月度趋势</dt>
                        <dd>{valueOrDash(row.monthly?.trend)}</dd>
                      </div>
                      <div>
                        <dt>数据截止</dt>
                        <dd>{businessTimestampLabel(row.cutoff)}</dd>
                      </div>
                      <div>
                        <dt>履责统计依据</dt>
                        <dd>{executiveVersionLabel(row.sourceVersionId)}</dd>
                      </div>
                    </dl>
                  </details>
                  <button
                    className="executive-ledger-drill"
                    type="button"
                    onClick={() => onOpenTarget(row.drillDownTarget)}
                  >
                    查看履责任务
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function businessPublicationLabel(label: string): string {
  return label.replace(/第(\d+)版/g, (_, editionText: string) => {
    const edition = Number(editionText);
    return edition <= 1 ? "（初次发布）" : `（第${edition - 1}次修订发布）`;
  });
}

function replacementText(row: ExecutiveReleaseRow): string {
  if (row.replacedByPublicationLabel)
    return `已由 ${businessPublicationLabel(row.replacedByPublicationLabel)} 修订替代`;
  if (row.replacesPublicationLabel)
    return `修订替代 ${businessPublicationLabel(row.replacesPublicationLabel)}`;
  return "初次发布，无后续修订";
}

function ReleasesLedger({
  rows,
  onOpenTarget,
}: {
  rows: readonly ExecutiveReleaseRow[];
  onOpenTarget: (target: ExecutiveDrillDownTarget) => void;
}) {
  if (rows.length === 0)
    return <LedgerEmptyState>当前筛选范围没有发布成果记录</LedgerEmptyState>;
  return (
    <div className="executive-ledger-scroll">
      <table
        aria-label="经营发布成果台账"
        className="executive-ledger-table executive-ledger-table--releases"
      >
        <thead>
          <tr>
            <th className="executive-ledger-table__indicator" scope="col">
              发布成果
            </th>
            <th scope="col">报告名称</th>
            <th scope="col">来源业务</th>
            <th scope="col">范围</th>
            <th scope="col">期间</th>
            <th scope="col">发布状态</th>
            <th scope="col">责任岗位</th>
            <th scope="col">发布时间</th>
            <th scope="col">详情与操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th className="executive-ledger-table__indicator" scope="row">
                {businessPublicationLabel(row.publicationLabel)}
              </th>
              <td>{row.reportName}</td>
              <td>
                <span className="executive-ledger-stack">
                  <strong>
                    {domainLabels.get(row.sourceBusinessDomain) ??
                      "来源业务已不可用"}
                  </strong>
                  <small>
                    {classificationLabel(row.sourceBusinessSubtype)}
                  </small>
                </span>
              </td>
              <td>{row.scope}</td>
              <td>{row.period}</td>
              <td>{row.publicationStatus}</td>
              <td>{row.owner}</td>
              <td>{row.publishedAt}</td>
              <td>
                <div className="executive-ledger-row-actions">
                  <details className="executive-ledger-details">
                    <summary>查看完整发布记录</summary>
                    <dl>
                      <div>
                        <dt>发布频率</dt>
                        <dd>{row.frequency}</dd>
                      </div>
                      <div>
                        <dt>来源业务分类</dt>
                        <dd>
                          {classificationLabel(row.sourceBusinessSubtype)}
                        </dd>
                      </div>
                      <div>
                        <dt>采用数据</dt>
                        <dd>{row.dataVersion}</dd>
                      </div>
                      <div>
                        <dt>修订记录</dt>
                        <dd>{replacementText(row)}</dd>
                      </div>
                      <div>
                        <dt>数据截止</dt>
                        <dd>{businessTimestampLabel(row.cutoff)}</dd>
                      </div>
                      <div>
                        <dt>数据来源</dt>
                        <dd>{executiveVersionLabel(row.sourceVersionId)}</dd>
                      </div>
                    </dl>
                  </details>
                  <button
                    className="executive-ledger-drill"
                    type="button"
                    onClick={() => onOpenTarget(row.drillDownTarget)}
                  >
                    查看发布记录
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const executivePageSize = 20;

function ExecutiveResultSummary({
  section,
  query,
  totalRows,
  labels,
}: {
  section: ExecutiveLedgerQuery["view"];
  query: ExecutiveLedgerQuery;
  totalRows: number;
  labels?: {
    region: string;
    period: string;
    business: string;
    version: string;
  };
}) {
  const viewLabels: Readonly<Record<ExecutiveLedgerQuery["view"], string>> = {
    operations: "经营指标",
    risks: "风险事项",
    duty: "履责事项",
    releases: "发布成果",
  };
  return (
    <section
      aria-label="查询结果摘要"
      aria-live="polite"
      className="executive-result-summary"
      role="status"
    >
      <strong>
        {viewLabels[section]} {totalRows} 项
      </strong>
      <span>{labels?.region ?? regionLabel(query.regionId)}</span>
      <span>
        {labels?.period ??
          optionLabel(
            executiveCoordinateOptions.periods,
            query.periodKey,
            "尚未选择经营期间",
            "所选经营期间已不可用",
          )}
      </span>
      <span>
        {labels?.business ?? (
          <>
            {domainLabels.get(query.domain) ?? "所选业务类型已不可用"} ·{" "}
            {optionLabel(
              executiveCoordinateOptions.products,
              query.productId,
              "全部已授权产品",
              "所选产品已不可用",
            )}
          </>
        )}
      </span>
      <span>
        {labels?.version ??
          (query.releaseVersion
            ? executiveVersionLabel(query.releaseVersion)
            : "全部已核定数据")}
      </span>
      {section === "operations" &&
        query.productId === null &&
        totalRows > 0 && (
          <span className="executive-result-summary__scope-note">
            当前未选择具体产品，仅展示跨产品经营指标；选择产品后可查看对应的产情、市场和供需指标。
          </span>
        )}
    </section>
  );
}

function ExecutivePagination({
  page,
  totalRows,
  onPageChange,
}: {
  page: number;
  totalRows: number;
  onPageChange: (page: number) => void;
}) {
  if (totalRows === 0) return null;
  const totalPages = Math.max(1, Math.ceil(totalRows / executivePageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * executivePageSize + 1;
  const end = Math.min(currentPage * executivePageSize, totalRows);
  return (
    <nav aria-label="经营总览分页" className="executive-ledger-pagination">
      <span>
        共 {totalRows} 条 · 当前 {start}–{end}
      </span>
      <button
        disabled={currentPage === 1}
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
      >
        上一页
      </button>
      <strong>
        {currentPage} / {totalPages}
      </strong>
      <button
        disabled={currentPage === totalPages}
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
      >
        下一页
      </button>
    </nav>
  );
}

function RealtimeExecutiveFilters({
  query,
  options,
  onScopeChange,
}: {
  query: ExecutiveLedgerQuery;
  options: RealtimeExecutiveOptions;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
}) {
  const visibleClassifications = options.classifications.filter(
    ({ domain }) => query.domain === "all" || domain === query.domain,
  );
  const domainInvalid =
    query.domain !== "all" &&
    !options.domains.some(({ id }) => id === query.domain);
  const regionInvalid =
    query.regionId !== "authorized-all" &&
    !options.regions.some(({ id }) => id === query.regionId);
  const productInvalid =
    query.productId !== null &&
    !options.products.some(({ id }) => id === query.productId);
  const periodInvalid = !options.periods.some(
    ({ id }) => id === query.periodKey,
  );
  const classificationInvalid =
    query.businessSubtype !== null &&
    !visibleClassifications.some(({ id }) => id === query.businessSubtype);
  const showDomain = options.domains.length > 1 || domainInvalid;
  const showRegion = options.regions.length > 1 || regionInvalid;
  const showProduct = options.products.length > 1 || productInvalid;
  const showPeriod = options.periods.length > 1 || periodInvalid;
  const showClassification =
    visibleClassifications.length > 1 || classificationInvalid;

  if (
    !showDomain &&
    !showRegion &&
    !showProduct &&
    !showPeriod &&
    !showClassification
  ) {
    return null;
  }

  return (
    <section aria-label="经营总览业务筛选" className="executive-filter-surface">
      <div className="executive-filter-grid executive-filter-grid--primary">
        {showDomain && (
          <label>
            <span>业务类型</span>
            <select
              aria-label="业务类型"
              value={domainInvalid ? "__invalid-domain__" : query.domain}
              onChange={(event) => {
                const domain = event.target
                  .value as ExecutiveLedgerQuery["domain"];
                onScopeChange({
                  businessDomainId: domain === "all" ? undefined : domain,
                  businessSubtypeId: undefined,
                  selectedMetricId: undefined,
                });
              }}
            >
              {domainInvalid && (
                <option disabled value="__invalid-domain__">
                  所选业务类型已不可用
                </option>
              )}
              <option value="all">全部业务类型</option>
              {options.domains.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        {showRegion && (
          <label>
            <span>业务地区</span>
            <select
              aria-label="业务地区"
              value={query.regionId}
              onChange={(event) =>
                onScopeChange({
                  regionId: event.target.value,
                  regionLevel: undefined,
                  selectedMetricId: undefined,
                })
              }
            >
              {regionInvalid && (
                <option disabled value={query.regionId}>
                  所选地区已不可用
                </option>
              )}
              <option value="authorized-all">全部地区</option>
              {options.regions.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        {showPeriod && (
          <label>
            <span>任务期间</span>
            <select
              aria-label="任务期间"
              value={periodInvalid ? "__invalid-period__" : query.periodKey}
              onChange={(event) =>
                onScopeChange({
                  periodKey: event.target.value,
                  selectedMetricId: undefined,
                })
              }
            >
              {periodInvalid && (
                <option disabled value="__invalid-period__">
                  {query.periodKey ? "所选任务期间已不可用" : "暂无任务期间"}
                </option>
              )}
              {options.periods.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        {showProduct && (
          <label>
            <span>产品或作物</span>
            <select
              aria-label="产品或作物"
              value={productInvalid ? "__invalid-product__" : query.productId ?? ""}
              onChange={(event) =>
                onScopeChange({
                  productId: event.target.value || undefined,
                  cultivarId: undefined,
                  selectedMetricId: undefined,
                })
              }
            >
              {productInvalid && (
                <option disabled value="__invalid-product__">
                  所选产品或作物已不可用
                </option>
              )}
              <option value="">全部产品或作物</option>
              {options.products.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {showClassification && (
        <details className="executive-more-filters">
          <summary>
            <strong>更多筛选</strong>
            <span>按真实业务分类进一步缩小范围</span>
          </summary>
          <div className="executive-filter-grid executive-filter-grid--secondary">
            <label>
              <span>业务分类</span>
              <select
                aria-label="业务分类"
                value={
                  classificationInvalid
                    ? "__invalid-classification__"
                    : query.businessSubtype ?? ""
                }
                onChange={(event) =>
                  onScopeChange({
                    businessSubtypeId: event.target.value || undefined,
                    selectedMetricId: undefined,
                  })
                }
              >
                {classificationInvalid && (
                  <option disabled value="__invalid-classification__">
                    所选业务分类已不可用
                  </option>
                )}
                <option value="">全部业务分类</option>
                {visibleClassifications.map(({ id, label }) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </details>
      )}
    </section>
  );
}

function ExecutiveFilters({
  scope,
  query,
  workItems,
  onScopeChange,
  invalidBusinessDomain,
  invalidPeriod,
  invalidRiskState,
}: {
  scope: OperationalScope;
  query: ExecutiveLedgerQuery;
  workItems: readonly BusinessWorkItem[];
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  invalidBusinessDomain: boolean;
  invalidPeriod: boolean;
  invalidRiskState: boolean;
}) {
  const [cascadeNotice, setCascadeNotice] = useState<string | null>(null);
  if (scope.authorization.serverAuthoritative === true) {
    return (
      <RealtimeExecutiveFilters
        onScopeChange={onScopeChange}
        options={realtimeExecutiveOptions(workItems)}
        query={query}
      />
    );
  }
  const visibleClassifications = businessClassifications.filter(
    ({ id, domain }) =>
      scope.authorization.authorizedBusinessClassificationIds.includes(id) &&
      (query.domain === "all" || domain === query.domain),
  );
  const authorizedRegions = scope.authorization.authorizedRegionIds
    .filter((id) => id !== "authorized-all")
    .map((id) => ({
      id,
      label: regionLabel(id),
    }));
  const selectedRegionLevel =
    scope.coordinates.regionLevel ?? regionLevelForId(query.regionId);
  const regionCoordinateConflict =
    Boolean(query.regionId) &&
    regionLevelForId(query.regionId) !== selectedRegionLevel;
  const availableRegionLevels = executiveCoordinateOptions.regionLevels.filter(
    ({ id }) =>
      id === "custom" ||
      authorizedRegions.some((region) => regionLevelForId(region.id) === id),
  );
  const authorizedMasterData = filterPlatformMasterDataByAuthorization(
    scope.authorization,
  );
  const productOptions = [
    ...authorizedMasterData.products,
    ...(query.productId &&
    scope.authorization.authorizedProductIds.includes(query.productId) &&
    !authorizedMasterData.products.some(({ id }) => id === query.productId)
      ? [{ id: query.productId, label: "所选产品已不可用" }]
      : []),
  ];
  const selectedProductId = query.productId;
  const cultivarOptions = selectedProductId
    ? authorizedMasterData.cultivars.filter(({ id }) =>
        isCultivarApplicableToProduct(selectedProductId, id),
      )
    : [];
  const cultivarSelectionInvalid = Boolean(
    query.cultivarId &&
    (!query.productId ||
      !isCultivarApplicableToProduct(query.productId, query.cultivarId)),
  );
  const releaseOptions = [
    ...authorizedMasterData.releaseBatches,
    ...(query.releaseVersion &&
    scope.authorization.authorizedReleaseVersionIds.includes(
      query.releaseVersion,
    ) &&
    !authorizedMasterData.releaseBatches.some(
      ({ id }) => id === query.releaseVersion,
    )
      ? [{ id: query.releaseVersion, label: "所选采用数据已不可用" }]
      : []),
  ];
  const selectedRegionAuthorized =
    query.regionId === "authorized-all" ||
    authorizedRegions.some(({ id }) => id === query.regionId);
  return (
    <section aria-label="经营总览业务筛选" className="executive-filter-surface">
      <div className="executive-filter-grid executive-filter-grid--primary">
        <label>
          <span>业务类型</span>
          <select
            aria-label="业务类型"
            value={
              invalidBusinessDomain
                ? "__invalid-business-domain__"
                : query.domain
            }
            onChange={(event) => {
              const domain = event.target
                .value as ExecutiveLedgerQuery["domain"];
              const subtype = scope.coordinates.businessSubtypeId;
              onScopeChange({
                businessDomainId: domain === "all" ? undefined : domain,
                businessSubtypeId:
                  subtype &&
                  (domain === "all" || subtype.startsWith(`${domain}.`))
                    ? subtype
                    : undefined,
                selectedMetricId: undefined,
              });
            }}
          >
            {invalidBusinessDomain && (
              <option disabled value="__invalid-business-domain__">
                所选业务类型已不可用
              </option>
            )}
            {executiveCoordinateOptions.domains.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>授权地区</span>
          <select
            aria-label="授权地区"
            value={query.regionId}
            onChange={(event) => {
              const regionId = event.target.value;
              onScopeChange({
                regionId,
                regionLevel: regionId
                  ? regionLevelForId(regionId)
                  : selectedRegionLevel,
                selectedMetricId: undefined,
              });
            }}
          >
            {!query.regionId && <option value="">请选择授权地区</option>}
            {query.regionId && !selectedRegionAuthorized && (
              <option disabled value={query.regionId}>
                所选地区不在当前授权范围
              </option>
            )}
            {regionCoordinateConflict && selectedRegionAuthorized && (
              <option disabled value={query.regionId}>
                {regionLabel(query.regionId)}（与所选层级不一致）
              </option>
            )}
            <option value="authorized-all">全部已授权范围</option>
            {authorizedRegions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>经营期间</span>
          <select
            aria-label="经营期间"
            value={query.periodKey}
            onChange={(event) =>
              onScopeChange({
                periodKey: event.target.value,
                selectedMetricId: undefined,
              })
            }
          >
            {invalidPeriod && (
              <option disabled value={query.periodKey}>
                {query.periodKey
                  ? "无效经营期间（请重新选择）"
                  : "请选择经营期间"}
              </option>
            )}
            {executiveCoordinateOptions.periods.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>产品或作物</span>
          <select
            aria-label="产品或作物"
            value={query.productId ?? ""}
            onChange={(event) => {
              const productId = event.target.value || undefined;
              const cultivarId =
                productId &&
                query.cultivarId &&
                isCultivarApplicableToProduct(productId, query.cultivarId)
                  ? query.cultivarId
                  : undefined;
              if (query.cultivarId && cultivarId === undefined) {
                const productLabel = platformProducts.find(
                  ({ id }) => id === productId,
                )?.label;
                const cultivarLabel = platformCultivars.find(
                  ({ id }) => id === query.cultivarId,
                )?.label;
                setCascadeNotice(
                  productLabel
                    ? `已移除与${productLabel}不适用的品种：${cultivarLabel ?? "所选具体品种"}`
                    : `已移除具体品种：${cultivarLabel ?? "所选具体品种"}；请先选择适用产品`,
                );
              } else {
                setCascadeNotice(null);
              }
              onScopeChange({
                productId,
                cultivarId,
                selectedMetricId: undefined,
              });
            }}
          >
            <option value="">全部已授权产品</option>
            {productOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <details className="executive-more-filters">
        <summary>
          <strong>更多筛选</strong>
          <span>业务分类、地区层级、具体品种、数据状态、采用数据与风险</span>
        </summary>
        <div className="executive-filter-grid executive-filter-grid--secondary">
          <label>
            <span>业务分类</span>
            <select
              aria-label="业务分类"
              value={query.businessSubtype ?? ""}
              onChange={(event) =>
                onScopeChange({
                  businessSubtypeId: event.target.value || undefined,
                  selectedMetricId: undefined,
                })
              }
            >
              <option value="">全部已授权分类</option>
              {visibleClassifications.map((classification) => (
                <option key={classification.id} value={classification.id}>
                  {classification.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>地区层级</span>
            <select
              aria-label="地区层级"
              value={selectedRegionLevel}
              onChange={(event) => {
                const regionLevel = event.target.value as ExecutiveRegionLevel;
                const currentRegionStillValid =
                  Boolean(query.regionId) &&
                  regionLevelForId(query.regionId) === regionLevel;
                onScopeChange({
                  regionLevel,
                  regionId: currentRegionStillValid
                    ? query.regionId
                    : regionLevel === "custom"
                      ? "authorized-all"
                      : "",
                  selectedMetricId: undefined,
                });
              }}
            >
              {availableRegionLevels.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>具体品种</span>
            <select
              aria-label="具体品种"
              disabled={!query.productId || cultivarOptions.length === 0}
              value={query.cultivarId ?? ""}
              onChange={(event) => {
                setCascadeNotice(null);
                onScopeChange({
                  cultivarId: event.target.value || undefined,
                  selectedMetricId: undefined,
                });
              }}
            >
              <option value="">
                {!query.productId
                  ? "请先选择产品"
                  : cultivarOptions.length === 0
                    ? "所选产品不使用具体品种"
                    : "全部已授权品种"}
              </option>
              {cultivarSelectionInvalid && query.cultivarId && (
                <option disabled value={query.cultivarId}>
                  品种与当前产品不匹配（请重新选择）
                </option>
              )}
              {cultivarOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>数据状态</span>
            <select
              aria-label="数据状态"
              value={query.dataLayer}
              onChange={(event) =>
                onScopeChange({
                  dataLayer: event.target
                    .value as BusinessCoordinates["dataLayer"],
                  selectedMetricId: undefined,
                })
              }
            >
              {executiveCoordinateOptions.dataLayers.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>采用数据</span>
            <select
              aria-label="采用数据"
              value={query.releaseVersion ?? ""}
              onChange={(event) =>
                onScopeChange({
                  releaseVersion: event.target.value || undefined,
                  selectedMetricId: undefined,
                })
              }
            >
              <option value="">全部已核定数据</option>
              {releaseOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>风险状态</span>
            <select
              aria-label="风险状态"
              value={
                invalidRiskState ? "__invalid-risk-state__" : query.riskState
              }
              onChange={(event) =>
                onScopeChange({
                  riskState: event.target
                    .value as BusinessCoordinates["riskState"],
                })
              }
            >
              {invalidRiskState && (
                <option disabled value="__invalid-risk-state__">
                  无效风险状态（请重新选择）
                </option>
              )}
              {executiveCoordinateOptions.riskStates.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
      {cascadeNotice && (
        <p className="executive-coordinate-alert" role="alert">
          {cascadeNotice}
        </p>
      )}
    </section>
  );
}

export function ExecutiveOverviewWorkspace({
  section,
  scope,
  workItems,
  reportRecords,
  onScopeChange,
  onOpenRoute,
}: {
  section: OverviewSection;
  scope: OperationalScope;
  workItems?: readonly BusinessWorkItem[];
  reportRecords?: readonly BusinessReportRecord[];
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  onOpenRoute: (route: FormalRoute) => void;
}) {
  const [page, setPage] = useState(1);
  if (section === "map") return null;
  const realtimeMode = scope.authorization.serverAuthoritative === true;
  const currentWorkItems = workItems ?? [];
  const realtimeOptions = realtimeExecutiveOptions(currentWorkItems);
  const effectivePeriodKey =
    scope.coordinates.periodKey ?? realtimeOptions.periods[0]?.id ?? "";
  const queryScope = realtimeMode
    ? {
        ...scope,
        coordinates: {
          ...scope.coordinates,
          periodKey: effectivePeriodKey,
        },
      }
    : scope;
  const query = {
    ...createDefaultExecutiveLedgerQuery(queryScope),
    view: section,
    regionId: queryScope.coordinates.regionId,
  };
  const coordinateIssues = getExecutiveScopeCoordinateIssues(
    queryScope,
    realtimeMode
      ? realtimeOptions.periods.map(({ id }) => id)
      : undefined,
  );
  const invalidBusinessDomain = coordinateIssues.some(
    ({ coordinate }) => coordinate === "business-domain",
  );
  const invalidPeriod = coordinateIssues.some(
    ({ coordinate }) => coordinate === "period",
  );
  const invalidRiskState = coordinateIssues.some(
    ({ coordinate }) => coordinate === "risk-state",
  );
  const selectedRegionLevel =
    queryScope.coordinates.regionLevel ?? regionLevelForId(query.regionId);
  const regionSelectionMissing = query.regionId.length === 0;
  const regionCoordinateConflict =
    !realtimeMode &&
    !regionSelectionMissing &&
    regionLevelForId(query.regionId) !== selectedRegionLevel;
  const aggregateCoverageMissing =
    !realtimeMode &&
    coordinateIssues.length === 0 &&
    query.regionId === "authorized-all" &&
    resolveExecutiveAggregateMembership(scope, query) === null;
  const result = queryExecutiveLedger(
    queryScope,
    regionCoordinateConflict
      ? { ...query, regionId: "__inconsistent-region-level__" }
      : query,
    { workItems, reportRecords },
  );
  const totalRows =
    result.view === "operations"
      ? result.metrics.length
      : result.view === "risks"
        ? result.risks.length
        : result.view === "duty"
          ? result.duties.length
          : result.releases.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / executivePageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * executivePageSize;
  const pageEnd = pageStart + executivePageSize;
  const selectedMetric =
    result.view === "operations"
      ? result.metrics.find(
          ({ comparison }) =>
            comparison.metricId === scope.coordinates.selectedMetricId,
        )
      : undefined;
  const selectedComparison = selectedMetric
    ? localizedComparison(selectedMetric.comparison)
    : undefined;
  const openTarget = (target: ExecutiveDrillDownTarget) =>
    onOpenRoute(routeForTarget(target));
  const realtimeSummaryLabels = realtimeMode
    ? {
        region:
          query.regionId === "authorized-all"
            ? "全部地区"
            : realtimeOptions.regions.find(({ id }) => id === query.regionId)
                ?.label ?? "所选地区已不可用",
        period:
          realtimeOptions.periods.find(({ id }) => id === query.periodKey)
            ?.label ?? "当前没有可用任务期间",
        business: `${
          query.domain === "all"
            ? "全部业务类型"
            : realtimeOptions.domains.find(({ id }) => id === query.domain)
                ?.label ?? "所选业务类型已不可用"
        } · ${
          query.productId === null
            ? "全部产品或作物"
            : realtimeOptions.products.find(({ id }) => id === query.productId)
                ?.label ?? "所选产品或作物已不可用"
        }`,
        version: "当前业务数据",
      }
    : undefined;

  return (
    <div className="unified-workspace executive-ledger-workspace">
      <WorkspaceHeader
        eyebrow="经营门户 / 经营总览"
        title="粮食商情经营总览"
        summary="以全部已授权范围为默认查询范围，在同一筛选口径下查看经营指标、异常、履责与发布结果。"
      />
      <WorkspaceTabs
        active={section}
        label="经营总览视图"
        tabs={overviewTabs}
        onChange={(key) => {
          setPage(1);
          onOpenRoute(createFormalRoute("overview", key as OverviewSection));
        }}
      />
      <ExecutiveFilters
        scope={scope}
        query={query}
        workItems={currentWorkItems}
        onScopeChange={(coordinates) => {
          setPage(1);
          onScopeChange(coordinates);
        }}
        invalidBusinessDomain={invalidBusinessDomain}
        invalidPeriod={invalidPeriod}
        invalidRiskState={invalidRiskState}
      />
      <ExecutiveResultSummary
        labels={realtimeSummaryLabels}
        section={section}
        query={query}
        totalRows={totalRows}
      />
      {coordinateIssues.length > 0 && (
        <div className="executive-coordinate-alert" role="alert">
          <strong>
            {invalidBusinessDomain || invalidRiskState
              ? "业务筛选参数无效"
              : "请选择经营期间"}
          </strong>
          {invalidBusinessDomain || invalidRiskState ? (
            <span>
              当前链接中的业务类型、风险状态或经营期间缺少有效筛选值；系统未执行数据查询，请重新选择。
            </span>
          ) : (
            <span>
              当前查询尚未指定有效经营期间；系统未执行数据查询，请从经营期间列表中选择。
            </span>
          )}
        </div>
      )}
      {regionCoordinateConflict && (
        <div className="executive-coordinate-alert" role="alert">
          <strong>地区层级与授权地区不一致</strong>
          <span>
            当前共享链接未执行数据查询；请选择该层级内的已授权地区后再查询。
          </span>
        </div>
      )}
      {regionSelectionMissing && (
        <div className="executive-coordinate-alert" role="alert">
          <strong>地区层级已更新，请重新选择授权地区</strong>
          <span>
            系统已清空原层级下的地区，不会自动改用授权列表中的第一个地区。
          </span>
        </div>
      )}
      {aggregateCoverageMissing && (
        <div className="executive-coordinate-alert" role="alert">
          <strong>当前授权范围内部分地区尚无已发布数据</strong>
          <span>
            当前期间、数据状态或采用数据尚未覆盖全部已授权地区；系统没有改用齐齐哈尔或其他首个地区的数据。
          </span>
        </div>
      )}
      <section
        aria-labelledby={`经营总览视图-${section}-tab`}
        className="executive-ledger-primary"
        id={`经营总览视图-${section}-panel`}
        role="tabpanel"
      >
        {result.view === "operations" ? (
          <OperationsLedger
            rows={result.metrics.slice(pageStart, pageEnd)}
            selectedMetricId={scope.coordinates.selectedMetricId}
            onSelect={(selectedMetricId) => onScopeChange({ selectedMetricId })}
            onOpenTarget={openTarget}
          />
        ) : result.view === "risks" ? (
          <RisksLedger
            rows={result.risks.slice(pageStart, pageEnd)}
            onOpenTarget={openTarget}
          />
        ) : result.view === "duty" ? (
          <DutyLedger
            rows={result.duties.slice(pageStart, pageEnd)}
            onOpenTarget={openTarget}
          />
        ) : (
          <ReleasesLedger
            rows={result.releases.slice(pageStart, pageEnd)}
            onOpenTarget={openTarget}
          />
        )}
        <ExecutivePagination
          page={currentPage}
          totalRows={totalRows}
          onPageChange={setPage}
        />
      </section>
      {selectedMetric && selectedComparison && (
        <section
          aria-label={`${selectedMetric.comparison.metricLabel}选中指标分析`}
          className="executive-selected-analysis"
        >
          <AnnualComparisonTrack
            model={selectedComparison}
            selected
            onSelect={(selectedMetricId) => onScopeChange({ selectedMetricId })}
          />
          <ComparisonCharts model={selectedComparison} />
          <aside
            aria-label="统计口径与数据来源"
            className="executive-lineage-drawer"
            role="complementary"
          >
            <header>
              <span>统计口径与数据来源</span>
              <h2>{selectedMetric.comparison.metricLabel}</h2>
            </header>
            <dl>
              <div>
                <dt>指标定义</dt>
                <dd>{selectedMetric.definition.formula}</dd>
              </div>
              <div>
                <dt>标准单位</dt>
                <dd>{selectedMetric.definition.unit}</dd>
              </div>
              <div>
                <dt>覆盖范围</dt>
                <dd>{selectedMetric.coverage}</dd>
              </div>
              <div>
                <dt>质量状态</dt>
                <dd>{qualityStateLabel(selectedMetric.qualityState)}</dd>
              </div>
              <div>
                <dt>数据截止</dt>
                <dd>{businessTimestampLabel(selectedMetric.cutoff)}</dd>
              </div>
              <div>
                <dt>采用数据</dt>
                <dd>{executiveVersionLabel(selectedMetric.sourceVersionId)}</dd>
              </div>
              <div>
                <dt>统计公式</dt>
                <dd>
                  {definitionVersionLabel(
                    selectedMetric.comparison.metricLabel,
                    selectedMetric.definition.definitionVersionId,
                  )}
                </dd>
              </div>
              <div>
                <dt>可比性</dt>
                <dd>
                  {comparabilityVersionLabel(
                    selectedMetric.definition.comparisonPolicy
                      .comparabilityRuleVersionId,
                  )}
                </dd>
              </div>
              <div>
                <dt>异常结论</dt>
                <dd>{selectedMetric.anomaly ?? "未形成异常结论"}</dd>
              </div>
            </dl>
          </aside>
        </section>
      )}
    </div>
  );
}

export function FormalExecutiveOverviewWorkspace(props: {
  section: OverviewSection;
  scope: OperationalScope;
  workItems?: readonly BusinessWorkItem[];
  reportRecords?: readonly BusinessReportRecord[];
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  onOpenRoute: (route: FormalRoute) => void;
}) {
  return <ExecutiveOverviewWorkspace {...props} />;
}
