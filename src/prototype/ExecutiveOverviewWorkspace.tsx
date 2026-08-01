import { AnnualComparisonTrack } from "./components/AnnualComparisonTrack";
import { ComparisonCharts } from "./components/ComparisonCharts";
import { businessClassifications } from "./core/businessClassification";
import {
  createDefaultExecutiveLedgerQuery,
  getExecutiveScopeCoordinateIssues,
  queryExecutiveLedger,
  type ExecutiveDrillDownTarget,
  type ExecutiveDutyRow,
  type ExecutiveLedgerQuery,
  type ExecutiveMetricRow,
  type ExecutiveReleaseRow,
  type ExecutiveRiskRow,
} from "./core/executiveLedger";
import type { OperationalScope } from "./core/operationalScope";
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
  { key: "operations", label: "经营态势" },
  { key: "risks", label: "异常风险" },
  { key: "duty", label: "履责监督" },
  { key: "releases", label: "发布成果" },
] as const;

const domainLabels = new Map(
  executiveCoordinateOptions.domains.map(({ id, label }) => [id, label]),
);

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
  return getEnterpriseScopeRegion(regionId)?.label ?? "地区名称待维护";
}

function classificationLabel(classificationId: string): string {
  return (
    businessClassifications.find(({ id }) => id === classificationId)?.label ??
    "业务分类名称待维护"
  );
}

function editionNumber(value: string): string {
  return String(Number(value));
}

function executiveVersionLabel(versionId: string): string {
  const weeklyMetric = /^METRIC-(\d{4})-W(\d+)-V(\d+)$/i.exec(versionId);
  if (weeklyMetric) {
    return `${weeklyMetric[1]}年第${editionNumber(weeklyMetric[2])}周正式指标第${editionNumber(weeklyMetric[3])}版`;
  }
  const weeklyDuty = /^DUTY-(\d{4})-W(\d+)-V(\d+)$/i.exec(versionId);
  if (weeklyDuty) {
    return `${weeklyDuty[1]}年第${editionNumber(weeklyDuty[2])}周履责台账第${editionNumber(weeklyDuty[3])}版`;
  }
  const annualSupply = /^SUPPLY-METRIC-(\d{4})-V(\d+)$/i.exec(versionId);
  if (annualSupply) {
    return `${annualSupply[1]}年度供需指标第${editionNumber(annualSupply[2])}版`;
  }
  const annualMetric = /^METRIC-(\d{4})-V(\d+)$/i.exec(versionId);
  if (annualMetric) {
    return `${annualMetric[1]}年度正式指标第${editionNumber(annualMetric[2])}版`;
  }
  return "治理版本中文名称待核定";
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
  const edition = /(?:^|[-.])v(\d+)$/i.exec(versionId)?.[1];
  return edition
    ? `${metricLabel}指标定义第${editionNumber(edition)}版`
    : `${metricLabel}指标定义版本待核定`;
}

function comparabilityVersionLabel(versionId: string): string {
  const edition = /(?:^|[-.])v(\d+)$/i.exec(versionId)?.[1];
  return edition
    ? `跨年度可比规则第${editionNumber(edition)}版`
    : "跨年度可比规则版本待核定";
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
      <span>系统未改变地区、期间、数据层或版本，请调整已显示的业务坐标。</span>
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
    return <LedgerEmptyState>当前业务坐标没有可用经营指标</LedgerEmptyState>;
  }
  return (
    <div className="executive-ledger-scroll">
      <table
        aria-label="经营指标趋势台账"
        className="executive-ledger-table executive-ledger-table--operations"
      >
        <thead>
          <tr>
            <th className="executive-ledger-table__indicator" scope="col">
              指标
            </th>
            <th scope="col">当前值</th>
            <th scope="col">上年同期</th>
            <th scope="col">当前同比</th>
            <th scope="col">前三年值</th>
            <th scope="col">四年趋势</th>
            <th scope="col">三年复合增长率</th>
            <th scope="col">覆盖与质量</th>
            <th scope="col">异常</th>
            <th scope="col">可比性</th>
            <th scope="col">截止</th>
            <th scope="col">指标数据版本</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = row.id === `metric-${selectedMetricId ?? ""}`;
            const prior = row.comparison.yearCells[2];
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
                      {domainLabels.get(row.domain) ?? "业务域名称待维护"}
                    </span>
                    <span className="executive-ledger-select__action">
                      分析{row.comparison.metricLabel}
                    </span>
                  </button>
                </th>
                <td>
                  {row.comparison.currentValue} {row.comparison.unit}
                </td>
                <td>
                  {prior.valueText}
                  {prior.availabilityLabel === "可用"
                    ? ` ${row.comparison.unit}`
                    : ""}
                </td>
                <td>{row.comparison.currentChangeText}</td>
                <td>
                  <span className="executive-ledger-year-values">
                    {row.comparison.yearCells.slice(0, 3).map((year) => (
                      <span key={year.year}>
                        {year.year}：{year.valueText}
                      </span>
                    ))}
                  </span>
                </td>
                <td>
                  <span className="executive-ledger-trend-sequence">
                    {row.comparison.yearCells.map((year, index) => (
                      <span key={year.year}>
                        {index > 0 ? " → " : ""}
                        {year.valueText}
                      </span>
                    ))}
                  </span>
                </td>
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
    return <LedgerEmptyState>当前业务坐标没有经营风险记录</LedgerEmptyState>;
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
            <th scope="col">风险识别数据版本</th>
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
    return <LedgerEmptyState>当前业务坐标没有履责监督记录</LedgerEmptyState>;
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
            <th scope="col">频率</th>
            <th scope="col">责任人</th>
            <th scope="col">责任岗位</th>
            <th scope="col">复核人</th>
            <th scope="col">截止规则</th>
            <th scope="col">有效期</th>
            <th scope="col">责任状态</th>
            <th scope="col">首次合格提交</th>
            <th scope="col">本周状态</th>
            <th scope="col">逾期时长</th>
            <th scope="col">复核结论</th>
            <th scope="col">月度应报</th>
            <th scope="col">月度按时</th>
            <th scope="col">月度逾期</th>
            <th scope="col">月度缺报</th>
            <th scope="col">月度退回</th>
            <th scope="col">月度按时率</th>
            <th scope="col">月度趋势</th>
            <th scope="col">数据截止</th>
            <th scope="col">履责台账版本</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th className="executive-ledger-table__indicator" scope="row">
                {row.assignment.businessItem}
              </th>
              <td>{row.assignment.region}</td>
              <td>{row.assignment.frequency}</td>
              <td>{row.assignment.person}</td>
              <td>{row.assignment.post}</td>
              <td>{row.assignment.reviewer}</td>
              <td>{row.assignment.deadlineRule}</td>
              <td>{row.assignment.effectivePeriod}</td>
              <td>{row.assignment.status}</td>
              <td>{valueOrDash(row.weekly?.firstQualifiedSubmission)}</td>
              <td>{valueOrDash(row.weekly?.status)}</td>
              <td>{valueOrDash(row.weekly?.overdueDuration)}</td>
              <td>{valueOrDash(row.weekly?.review)}</td>
              <td>{valueOrDash(row.monthly?.expected)}</td>
              <td>{valueOrDash(row.monthly?.onTime)}</td>
              <td>{valueOrDash(row.monthly?.overdue)}</td>
              <td>{valueOrDash(row.monthly?.missing)}</td>
              <td>{valueOrDash(row.monthly?.returned)}</td>
              <td>{valueOrDash(row.monthly?.onTimeRate)}</td>
              <td>{valueOrDash(row.monthly?.trend)}</td>
              <td>{businessTimestampLabel(row.cutoff)}</td>
              <td>{executiveVersionLabel(row.sourceVersionId)}</td>
              <td>
                <button
                  className="executive-ledger-drill"
                  type="button"
                  onClick={() => onOpenTarget(row.drillDownTarget)}
                >
                  查看履责任务
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function replacementText(row: ExecutiveReleaseRow): string {
  if (row.replacedByPublicationLabel)
    return `已由 ${row.replacedByPublicationLabel} 替代`;
  if (row.replacesPublicationLabel)
    return `替代 ${row.replacesPublicationLabel}`;
  return "首次发布";
}

function ReleasesLedger({
  rows,
  onOpenTarget,
}: {
  rows: readonly ExecutiveReleaseRow[];
  onOpenTarget: (target: ExecutiveDrillDownTarget) => void;
}) {
  if (rows.length === 0)
    return <LedgerEmptyState>当前业务坐标没有发布成果记录</LedgerEmptyState>;
  return (
    <div className="executive-ledger-scroll">
      <table
        aria-label="经营发布成果台账"
        className="executive-ledger-table executive-ledger-table--releases"
      >
        <thead>
          <tr>
            <th className="executive-ledger-table__indicator" scope="col">
              成果发布版本
            </th>
            <th scope="col">报告名称</th>
            <th scope="col">来源业务域</th>
            <th scope="col">来源业务分类</th>
            <th scope="col">频率</th>
            <th scope="col">范围</th>
            <th scope="col">期间</th>
            <th scope="col">采用数据批次</th>
            <th scope="col">发布状态</th>
            <th scope="col">责任岗位</th>
            <th scope="col">发布时间</th>
            <th scope="col">替代关系</th>
            <th scope="col">数据截止</th>
            <th scope="col">上游指标版本</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th className="executive-ledger-table__indicator" scope="row">
                {row.publicationLabel}
              </th>
              <td>{row.reportName}</td>
              <td>
                {domainLabels.get(row.sourceBusinessDomain) ??
                  "来源业务域名称待维护"}
              </td>
              <td>{classificationLabel(row.sourceBusinessSubtype)}</td>
              <td>{row.frequency}</td>
              <td>{row.scope}</td>
              <td>{row.period}</td>
              <td>{row.dataVersion}</td>
              <td>{row.publicationStatus}</td>
              <td>{row.owner}</td>
              <td>{row.publishedAt}</td>
              <td>{replacementText(row)}</td>
              <td>{businessTimestampLabel(row.cutoff)}</td>
              <td>{executiveVersionLabel(row.sourceVersionId)}</td>
              <td>
                <button
                  className="executive-ledger-drill"
                  type="button"
                  onClick={() => onOpenTarget(row.drillDownTarget)}
                >
                  查看发布记录
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AppliedCoordinates({
  query,
  regionLevel,
  invalidBusinessDomain,
  invalidRiskState,
}: {
  query: ExecutiveLedgerQuery;
  regionLevel: ExecutiveRegionLevel;
  invalidBusinessDomain: boolean;
  invalidRiskState: boolean;
}) {
  const subtypeLabel = query.businessSubtype
    ? classificationLabel(query.businessSubtype)
    : "全部已授权分类";
  return (
    <section
      aria-label="已应用业务坐标"
      className="executive-coordinate-summary"
    >
      <span>
        <small>范围</small>
        <strong>
          {optionLabel(
            executiveCoordinateOptions.regionLevels,
            regionLevel,
            "地区层级待维护",
          )}{" "}
          · {regionLabel(query.regionId)}
        </strong>
      </span>
      <span>
        <small>业务</small>
        <strong>
          {invalidBusinessDomain
            ? "业务域无效，请重新选择"
            : (domainLabels.get(query.domain) ?? "业务域名称待维护")}{" "}
          · {subtypeLabel}
        </strong>
      </span>
      <span>
        <small>产品与品种</small>
        <strong>
          {optionLabel(
            executiveCoordinateOptions.products,
            query.productId,
            "全部已授权产品",
            "产品名称待维护",
          )}{" "}
          ·{" "}
          {optionLabel(
            executiveCoordinateOptions.cultivars,
            query.cultivarId,
            "全部已授权品种",
            "品种名称待维护",
          )}
        </strong>
      </span>
      <span>
        <small>期间与数据层</small>
        <strong>
          {optionLabel(
            executiveCoordinateOptions.periods,
            query.periodKey,
            "经营期间待维护",
          )}{" "}
          ·{" "}
          {optionLabel(
            executiveCoordinateOptions.dataLayers,
            query.dataLayer,
            "数据层名称待维护",
          )}
        </strong>
      </span>
      <span>
        <small>指标数据版本与风险</small>
        <strong>
          {optionLabel(
            executiveCoordinateOptions.releaseVersions,
            query.releaseVersion,
            "全部已授权版本",
            "数据版本名称待维护",
          )}{" "}
          ·{" "}
          {optionLabel(
            executiveCoordinateOptions.riskStates,
            query.riskState,
            "全部风险状态",
            invalidRiskState ? "风险状态无效，请重新选择" : "风险状态待维护",
          )}
        </strong>
      </span>
    </section>
  );
}

function ExecutiveFilters({
  scope,
  query,
  onScopeChange,
  invalidBusinessDomain,
  invalidRiskState,
}: {
  scope: OperationalScope;
  query: ExecutiveLedgerQuery;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  invalidBusinessDomain: boolean;
  invalidRiskState: boolean;
}) {
  const visibleClassifications = businessClassifications.filter(
    ({ id, domain }) =>
      scope.authorization.authorizedBusinessClassificationIds.includes(id) &&
      (query.domain === "all" || domain === query.domain),
  );
  const authorizedRegions = scope.authorization.authorizedRegionIds.map(
    (id) => ({
      id,
      label: regionLabel(id),
    }),
  );
  const selectedRegionLevel =
    scope.coordinates.regionLevel ?? regionLevelForId(query.regionId);
  const regionCoordinateConflict =
    regionLevelForId(query.regionId) !== selectedRegionLevel;
  const availableRegionLevels = executiveCoordinateOptions.regionLevels.filter(
    ({ id }) =>
      id === "custom" ||
      authorizedRegions.some((region) => regionLevelForId(region.id) === id),
  );
  const regionsAtSelectedLevel = authorizedRegions.filter(
    (region) => regionLevelForId(region.id) === selectedRegionLevel,
  );
  const productOptions = scope.authorization.authorizedProductIds.map((id) => ({
    id,
    label: optionLabel(
      executiveCoordinateOptions.products,
      id,
      "产品名称待维护",
    ),
  }));
  const cultivarOptions = scope.authorization.authorizedCultivarIds.map(
    (id) => ({
      id,
      label: optionLabel(
        executiveCoordinateOptions.cultivars,
        id,
        "品种名称待维护",
      ),
    }),
  );
  const releaseOptions = scope.authorization.authorizedReleaseVersionIds.map(
    (id) => ({
      id,
      label: optionLabel(
        executiveCoordinateOptions.releaseVersions,
        id,
        "数据版本名称待维护",
      ),
    }),
  );
  return (
    <section aria-label="经营总览业务筛选" className="executive-filter-surface">
      <div className="executive-filter-grid">
        <label>
          <span>业务域</span>
          <select
            aria-label="业务域"
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
                无效业务域（请重新选择）
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
              const firstAuthorizedRegion = authorizedRegions.find(
                (region) => regionLevelForId(region.id) === regionLevel,
              );
              onScopeChange({
                regionLevel,
                regionId:
                  regionLevel === "custom"
                    ? "authorized-all"
                    : firstAuthorizedRegion?.id,
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
          <span>业务地区</span>
          <select
            aria-label="业务地区"
            value={query.regionId}
            onChange={(event) =>
              onScopeChange({
                regionId: event.target.value,
                selectedMetricId: undefined,
              })
            }
          >
            {regionCoordinateConflict && (
              <option disabled value={query.regionId}>
                {regionLabel(query.regionId)}（与所选层级不一致）
              </option>
            )}
            {selectedRegionLevel === "custom" && (
              <option value="authorized-all">全部已授权范围</option>
            )}
            {regionsAtSelectedLevel.map((option) => (
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
            onChange={(event) =>
              onScopeChange({
                productId: event.target.value || undefined,
                cultivarId: undefined,
                selectedMetricId: undefined,
              })
            }
          >
            <option value="">全部已授权产品</option>
            {productOptions.map((option) => (
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
            value={query.cultivarId ?? ""}
            onChange={(event) =>
              onScopeChange({
                cultivarId: event.target.value || undefined,
                selectedMetricId: undefined,
              })
            }
          >
            <option value="">全部已授权品种</option>
            {cultivarOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>数据层</span>
          <select
            aria-label="数据层"
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
          <span>指标数据版本</span>
          <select
            aria-label="指标数据版本"
            value={query.releaseVersion ?? ""}
            onChange={(event) =>
              onScopeChange({
                releaseVersion: event.target.value || undefined,
                selectedMetricId: undefined,
              })
            }
          >
            <option value="">全部已授权版本</option>
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
    </section>
  );
}

export function ExecutiveOverviewWorkspace({
  section,
  scope,
  onScopeChange,
  onOpenRoute,
}: {
  section: OverviewSection;
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  onOpenRoute: (route: FormalRoute) => void;
}) {
  const query = { ...createDefaultExecutiveLedgerQuery(scope), view: section };
  const coordinateIssues = getExecutiveScopeCoordinateIssues(scope);
  const invalidBusinessDomain = coordinateIssues.some(
    ({ coordinate }) => coordinate === "business-domain",
  );
  const invalidRiskState = coordinateIssues.some(
    ({ coordinate }) => coordinate === "risk-state",
  );
  const selectedRegionLevel =
    scope.coordinates.regionLevel ?? regionLevelForId(query.regionId);
  const regionCoordinateConflict =
    regionLevelForId(query.regionId) !== selectedRegionLevel;
  const result = queryExecutiveLedger(
    scope,
    regionCoordinateConflict
      ? { ...query, regionId: "__inconsistent-region-level__" }
      : query,
  );
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

  return (
    <div className="unified-workspace executive-ledger-workspace">
      <WorkspaceHeader
        eyebrow="经营门户 / 经营总览"
        title="粮食商情经营总览"
        summary="以全部已授权范围为默认聚合，在同一组业务坐标下查询经营指标、异常、履责与发布结果。"
      />
      <ExecutiveFilters
        scope={scope}
        query={query}
        onScopeChange={onScopeChange}
        invalidBusinessDomain={invalidBusinessDomain}
        invalidRiskState={invalidRiskState}
      />
      <AppliedCoordinates
        query={query}
        regionLevel={selectedRegionLevel}
        invalidBusinessDomain={invalidBusinessDomain}
        invalidRiskState={invalidRiskState}
      />
      {coordinateIssues.length > 0 && (
        <div className="executive-coordinate-alert" role="alert">
          <strong>业务筛选参数无效</strong>
          <span>
            当前链接中的业务域或风险状态不是系统支持的业务值；系统未执行数据查询，请重新选择。
          </span>
        </div>
      )}
      {regionCoordinateConflict && (
        <div className="executive-coordinate-alert" role="alert">
          <strong>地区层级与业务地区不一致</strong>
          <span>
            当前共享链接未执行数据查询；请选择该层级内的已授权地区后再查询。
          </span>
        </div>
      )}
      <WorkspaceTabs
        active={section}
        label="经营总览视图"
        tabs={overviewTabs}
        onChange={(key) =>
          onOpenRoute(createFormalRoute("overview", key as OverviewSection))
        }
      />
      <section
        aria-labelledby={`经营总览视图-${section}-tab`}
        className="executive-ledger-primary"
        id={`经营总览视图-${section}-panel`}
        role="tabpanel"
      >
        {result.view === "operations" ? (
          <OperationsLedger
            rows={result.metrics}
            selectedMetricId={scope.coordinates.selectedMetricId}
            onSelect={(selectedMetricId) => onScopeChange({ selectedMetricId })}
            onOpenTarget={openTarget}
          />
        ) : result.view === "risks" ? (
          <RisksLedger rows={result.risks} onOpenTarget={openTarget} />
        ) : result.view === "duty" ? (
          <DutyLedger rows={result.duties} onOpenTarget={openTarget} />
        ) : (
          <ReleasesLedger rows={result.releases} onOpenTarget={openTarget} />
        )}
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
            aria-label="指标口径与来源"
            className="executive-lineage-drawer"
            role="complementary"
          >
            <header>
              <span>治理口径与发布血缘</span>
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
                <dt>指标数据版本</dt>
                <dd>{executiveVersionLabel(selectedMetric.sourceVersionId)}</dd>
              </div>
              <div>
                <dt>口径定义版本</dt>
                <dd>
                  {definitionVersionLabel(
                    selectedMetric.comparison.metricLabel,
                    selectedMetric.definition.definitionVersionId,
                  )}
                </dd>
              </div>
              <div>
                <dt>可比规则版本</dt>
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
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  onOpenRoute: (route: FormalRoute) => void;
}) {
  return <ExecutiveOverviewWorkspace {...props} />;
}
