import type { BusinessClassification } from "./businessClassification";
import { businessClassifications } from "./businessClassification";
import type { BusinessWorkItem } from "./businessWork";
import {
  buildComparisonSet,
  type PublishedMetricPoint,
} from "./comparableSeries";
import { formatFixedDecimal } from "./fixedDecimal";
import type { MetricDefinition } from "./metricCatalog";
import type { MetricComparisonViewModel } from "./metricComparisonViewModel";
import { createMetricComparisonViewModel } from "./metricComparisonViewModel";
import type { OperationalScope } from "./operationalScope";
import { platformCultivars, platformProducts } from "./platformMasterData";
import type { BusinessReportRecord } from "../businessReportWorkflow";
import {
  enterpriseMetricDefinitions,
  enterpriseMetricPoints,
  queryPrototypeMetricComparisons,
} from "../data/enterpriseMetricFixtures";
import {
  executiveAggregateRegionMembershipFixtures,
  executiveDutyFixtures,
  executiveReleaseFixtures,
  executiveRiskFixtures,
  prototypeExecutiveSupportedPeriodKeys,
  executiveSupplyReleasePoints,
  type ExecutiveAggregateRegionMembershipFixture,
  type ExecutiveFixtureCoordinates,
} from "../data/executiveLedgerFixtures";
import {
  authorizedScopeRegion,
  getEnterpriseRegionOptions,
} from "../enterpriseRegions";

export interface ExecutiveLedgerQuery {
  view: "operations" | "risks" | "duty" | "releases";
  regionId: string;
  domain:
    "all" | "production" | "market" | "supply" | "operations" | "reporting";
  businessSubtype: BusinessClassification["id"] | null;
  productId: string | null;
  cultivarId: string | null;
  periodKey: string;
  dataLayer: "preliminary" | "official";
  releaseVersion: string | null;
  riskState: "all" | "warning" | "blocking";
}

export type ExecutiveDrillDownTarget =
  | {
      application: "production";
      section: "tasks" | "objects" | "analysis";
    }
  | { application: "market"; section: "tasks" | "objects" | "analysis" }
  | {
      application: "supply";
      section: "calculation" | "comparison" | "versions";
    }
  | {
      application: "overview";
      section: "operations" | "risks" | "duty" | "releases";
    }
  | {
      application: "reporting";
      section: "compose" | "review-distribution" | "ledger";
    };

interface ExecutiveLineage {
  id: string;
  sourceVersionId: string;
  cutoff: string;
  coverage: string;
  drillDownTarget: ExecutiveDrillDownTarget;
}

export interface ExecutiveMetricRow extends ExecutiveLineage {
  domain: "production" | "market" | "supply" | "operations";
  businessSubtype: BusinessClassification["id"];
  comparison: MetricComparisonViewModel;
  definition: MetricDefinition;
  qualityState: string;
  anomaly: string | null;
  drillDownTarget: Exclude<
    ExecutiveDrillDownTarget,
    { application: "reporting" }
  >;
}

export interface ExecutiveRiskRow extends ExecutiveLineage {
  riskItem: string;
  business: string;
  region: string;
  impact: string;
  currentState: string;
  riskState: "warning" | "blocking";
}

export interface ExecutiveDutyAssignment {
  id: string;
  region: string;
  businessItem: string;
  frequency: string;
  responsibleUserId: string;
  person: string;
  post: string;
  reviewer: string;
  deadlineRule: string;
  effectivePeriod: string;
  status: string;
}

export interface ExecutiveDutyWeekly {
  person: string;
  region: string;
  item: string;
  deadline: string;
  firstQualifiedSubmission: string;
  status: string;
  overdueDuration: string;
  review: string;
}

export interface ExecutiveDutyMonthly {
  person: string;
  region: string;
  expected: string;
  onTime: string;
  overdue: string;
  missing: string;
  returned: string;
  onTimeRate: string;
  trend: string;
}

export interface ExecutiveDutyRow extends ExecutiveLineage {
  assignment: ExecutiveDutyAssignment;
  weekly: ExecutiveDutyWeekly | null;
  monthly: ExecutiveDutyMonthly | null;
}

export interface ExecutiveReleaseRow extends ExecutiveLineage {
  domain: "reporting";
  sourceBusinessDomain:
    "production" | "market" | "supply" | "operations" | "reporting";
  sourceBusinessSubtype: BusinessClassification["id"];
  publicationId: string;
  publicationLabel: string;
  replacesPublicationId: string | null;
  replacesPublicationLabel: string | null;
  replacedByPublicationId: string | null;
  replacedByPublicationLabel: string | null;
  reportName: string;
  frequency: string;
  scope: string;
  period: string;
  dataVersion: string;
  publicationStatus: string;
  owner: string;
  publishedAt: string;
}

export type ExecutiveLedgerResult =
  | { view: "operations"; metrics: readonly ExecutiveMetricRow[] }
  | { view: "risks"; risks: readonly ExecutiveRiskRow[] }
  | { view: "duty"; duties: readonly ExecutiveDutyRow[] }
  | { view: "releases"; releases: readonly ExecutiveReleaseRow[] };

export interface ExecutiveLedgerProjectionInput {
  /**
   * Current business-work snapshot. Supplying an empty array intentionally
   * produces no workflow risks or duties; omitting it keeps the seed ledger.
   */
  workItems?: readonly BusinessWorkItem[];
  /**
   * Current report-workflow snapshot. Supplying an empty array intentionally
   * produces no release rows; omitting it keeps the seed release ledger.
   */
  reportRecords?: readonly BusinessReportRecord[];
}

const domains = [
  "production",
  "market",
  "supply",
  "operations",
  "reporting",
] as const;

const riskStates = ["all", "warning", "blocking"] as const;

export interface ExecutiveScopeCoordinateIssue {
  coordinate: "business-domain" | "period" | "risk-state";
}

function isQueryDomain(
  value: string | undefined,
): value is ExecutiveLedgerQuery["domain"] {
  return value === "all" || domains.some((domain) => domain === value);
}

function isRiskState(
  value: string | undefined,
): value is ExecutiveLedgerQuery["riskState"] {
  return riskStates.some((state) => state === value);
}

export function getExecutiveScopeCoordinateIssues(
  scope: OperationalScope,
): readonly ExecutiveScopeCoordinateIssue[] {
  const issues: ExecutiveScopeCoordinateIssue[] = [];
  const { businessDomainId, riskState } = scope.coordinates;
  if (businessDomainId !== undefined && !isQueryDomain(businessDomainId)) {
    issues.push({ coordinate: "business-domain" });
  }
  if (
    !scope.coordinates.periodKey ||
    !prototypeExecutiveSupportedPeriodKeys.some(
      (periodKey) => periodKey === scope.coordinates.periodKey,
    )
  ) {
    issues.push({ coordinate: "period" });
  }
  if (riskState !== undefined && !isRiskState(riskState)) {
    issues.push({ coordinate: "risk-state" });
  }
  return issues;
}

export function createDefaultExecutiveLedgerQuery(
  scope: OperationalScope,
): ExecutiveLedgerQuery {
  const coordinates = scope.coordinates;
  return {
    view: "operations",
    regionId: coordinates.regionId || "authorized-all",
    domain: isQueryDomain(coordinates.businessDomainId)
      ? coordinates.businessDomainId
      : "all",
    businessSubtype:
      (coordinates.businessSubtypeId as
        BusinessClassification["id"] | undefined) ?? null,
    productId: coordinates.productId ?? null,
    cultivarId: coordinates.cultivarId ?? null,
    periodKey: coordinates.periodKey ?? "",
    dataLayer: coordinates.dataLayer ?? "official",
    releaseVersion: coordinates.releaseVersion ?? null,
    riskState: coordinates.riskState ?? "all",
  };
}

function parseCurrentYear(periodKey: string): number | null {
  const match = /^(\d{4})(?:$|[-/\s年])/.exec(periodKey.trim());
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isSafeInteger(year) && year >= 2000 && year <= 2100
    ? year
    : null;
}

function sameRegionMembers(
  authorizedRegionIds: readonly string[],
  memberRegionIds: readonly string[],
): boolean {
  const effective = new Set(authorizedRegionIds);
  const members = new Set(memberRegionIds);
  if (
    effective.size !== authorizedRegionIds.length ||
    members.size !== memberRegionIds.length ||
    effective.size !== members.size
  ) {
    return false;
  }
  return [...effective].every((regionId) => members.has(regionId));
}

export function resolveExecutiveAggregateMembership(
  scope: OperationalScope,
  query: ExecutiveLedgerQuery,
): ExecutiveAggregateRegionMembershipFixture | null {
  if (query.regionId !== "authorized-all") return null;
  const matches = executiveAggregateRegionMembershipFixtures.filter(
    (fixture) =>
      fixture.aggregateRegionId === query.regionId &&
      fixture.periodKey === query.periodKey &&
      fixture.dataLayer === query.dataLayer &&
      (query.releaseVersion === null ||
        fixture.releaseVersion === query.releaseVersion) &&
      scope.authorization.authorizedReleaseVersionIds.includes(
        fixture.releaseVersion,
      ) &&
      sameRegionMembers(
        scope.authorization.authorizedRegionIds,
        fixture.memberRegionIds,
      ),
  );
  return matches.length === 1 ? matches[0] : null;
}

function queryIsAuthorized(
  scope: OperationalScope,
  query: ExecutiveLedgerQuery,
): boolean {
  if (!scope.authorization.permissionKeys.includes("prototype:read"))
    return false;
  if (
    query.regionId !== "authorized-all" &&
    !scope.authorization.authorizedRegionIds.includes(
      query.regionId as OperationalScope["authorization"]["authorizedRegionIds"][number],
    )
  ) {
    return false;
  }
  if (
    query.businessSubtype !== null &&
    !scope.authorization.authorizedBusinessClassificationIds.includes(
      query.businessSubtype,
    )
  ) {
    return false;
  }
  if (
    query.businessSubtype !== null &&
    query.domain !== "all" &&
    !query.businessSubtype.startsWith(`${query.domain}.`)
  ) {
    return false;
  }
  if (
    query.productId !== null &&
    !scope.authorization.authorizedProductIds.includes(query.productId)
  ) {
    return false;
  }
  if (
    query.cultivarId !== null &&
    !scope.authorization.authorizedCultivarIds.includes(query.cultivarId)
  ) {
    return false;
  }
  if (
    query.releaseVersion !== null &&
    !scope.authorization.authorizedReleaseVersionIds.includes(
      query.releaseVersion,
    )
  ) {
    return false;
  }
  return (
    query.regionId !== "authorized-all" ||
    resolveExecutiveAggregateMembership(scope, query) !== null
  );
}

function pointRegionMatches(
  scope: OperationalScope,
  query: ExecutiveLedgerQuery,
  pointRegionId: string,
): boolean {
  if (query.regionId !== "authorized-all")
    return pointRegionId === query.regionId;
  const membership = resolveExecutiveAggregateMembership(scope, query);
  if (!membership) return false;
  return (
    pointRegionId === "authorized-all" ||
    membership.memberRegionIds.some((regionId) => regionId === pointRegionId)
  );
}

function fixtureMatches(
  scope: OperationalScope,
  query: ExecutiveLedgerQuery,
  fixture: ExecutiveFixtureCoordinates,
): boolean {
  const subtypeDomain = query.businessSubtype?.split(".")[0] ?? null;
  const domainMatches =
    query.domain === "all" ||
    fixture.domain === query.domain ||
    (query.domain === "reporting" && fixture.domain === "reporting");
  return (
    domainMatches &&
    (subtypeDomain === null || fixture.domain === subtypeDomain) &&
    (query.businessSubtype === null ||
      fixture.businessSubtype === query.businessSubtype) &&
    pointRegionMatches(scope, query, fixture.regionId) &&
    (query.productId === null || fixture.productId === query.productId) &&
    (query.cultivarId === null || fixture.cultivarId === query.cultivarId) &&
    fixture.periodKey === query.periodKey &&
    fixture.dataLayer === query.dataLayer &&
    (query.releaseVersion === null ||
      fixture.releaseVersion === query.releaseVersion) &&
    scope.authorization.authorizedBusinessClassificationIds.includes(
      fixture.businessSubtype,
    ) &&
    (fixture.productId === null ||
      scope.authorization.authorizedProductIds.includes(fixture.productId)) &&
    (fixture.cultivarId === null ||
      scope.authorization.authorizedCultivarIds.includes(fixture.cultivarId)) &&
    scope.authorization.authorizedReleaseVersionIds.includes(
      fixture.releaseVersion,
    )
  );
}

function metricTarget(
  domain: ExecutiveMetricRow["domain"],
): ExecutiveMetricRow["drillDownTarget"] {
  if (domain === "operations") {
    return { application: "overview", section: "duty" };
  }
  if (domain === "supply") {
    return { application: "supply", section: "calculation" };
  }
  return { application: domain, section: "analysis" };
}

function metricRow(
  definition: MetricDefinition,
  points: readonly [
    PublishedMetricPoint,
    PublishedMetricPoint,
    PublishedMetricPoint,
    PublishedMetricPoint,
  ],
): ExecutiveMetricRow {
  const comparisonSet = buildComparisonSet({
    definition,
    currentYear: points[3].coordinate.period.year,
    points,
    approvedBridges: [],
  });
  const current = points[3];
  if (current.availability !== "available") {
    throw new Error("经营指标台账仅投影可用的当前发布点");
  }
  const comparison = createMetricComparisonViewModel(definition, comparisonSet);
  return {
    id: `metric-${definition.metricId}`,
    domain: definition.domain,
    businessSubtype: definition.businessSubtype,
    comparison,
    definition,
    sourceVersionId: current.coordinate.metricReleaseVersionId,
    cutoff: current.coordinate.period.cutoff,
    coverage: `${formatFixedDecimal(current.coverageRate, 1)}%`,
    qualityState: current.qualityStatus,
    anomaly: comparisonSet.trend.anomalies[0] ?? null,
    drillDownTarget: metricTarget(definition.domain),
  };
}

function tupleOfFour(
  points: readonly PublishedMetricPoint[],
):
  | readonly [
      PublishedMetricPoint,
      PublishedMetricPoint,
      PublishedMetricPoint,
      PublishedMetricPoint,
    ]
  | null {
  if (points.length !== 4) return null;
  return [points[0], points[1], points[2], points[3]];
}

function operationsRows(
  scope: OperationalScope,
  query: ExecutiveLedgerQuery,
  currentYear: number,
): readonly ExecutiveMetricRow[] {
  if (query.domain === "reporting") return [];
  const selectedDomains = (
    query.domain === "all"
      ? ["production", "market", "supply", "operations"]
      : [query.domain]
  ) as readonly ExecutiveMetricRow["domain"][];
  const effectiveScope: OperationalScope = {
    ...scope,
    coordinates: {
      ...scope.coordinates,
      regionId: query.regionId,
      businessDomainId: undefined,
      businessSubtypeId: query.businessSubtype ?? undefined,
      productId: query.productId ?? undefined,
      cultivarId: query.cultivarId ?? undefined,
      periodKey: query.periodKey,
      dataLayer: query.dataLayer,
      releaseVersion: query.releaseVersion ?? undefined,
    },
  };

  return selectedDomains.flatMap((domain) => {
    if (domain !== "supply") {
      return queryPrototypeMetricComparisons({
        scope: effectiveScope,
        queryAllowed: true,
        domain,
        ...(query.businessSubtype
          ? { businessSubtype: query.businessSubtype }
          : {}),
        currentYear,
      }).flatMap((result) =>
        result.status === "ready"
          ? [metricRow(result.definition, result.comparison.points)]
          : [],
      );
    }

    const definition = enterpriseMetricDefinitions.find(
      ({ metricId }) => metricId === "supply.total-supply",
    );
    if (
      !definition ||
      !scope.authorization.authorizedBusinessClassificationIds.includes(
        definition.businessSubtype,
      ) ||
      (query.businessSubtype !== null &&
        query.businessSubtype !== definition.businessSubtype)
    ) {
      return [];
    }
    const supplyPoints = executiveSupplyReleasePoints.filter((point) => {
      const governedProductIds = [
        point.coordinate.cropId,
        point.coordinate.commodityId,
        point.coordinate.productAccountId,
      ].filter((id): id is string => id !== null);
      const productAuthorized =
        governedProductIds.length === 0 ||
        governedProductIds.some((id) =>
          scope.authorization.authorizedProductIds.includes(id),
        );
      const cultivarAuthorized =
        point.coordinate.cultivarId === null ||
        scope.authorization.authorizedCultivarIds.includes(
          point.coordinate.cultivarId,
        );
      return (
        productAuthorized &&
        cultivarAuthorized &&
        point.coordinate.period.year >= currentYear - 3 &&
        point.coordinate.period.year <= currentYear &&
        pointRegionMatches(scope, query, point.coordinate.regionId) &&
        point.coordinate.dataLayer === query.dataLayer &&
        (query.productId === null ||
          point.coordinate.cropId === query.productId ||
          point.coordinate.productAccountId === query.productId) &&
        (query.cultivarId === null ||
          point.coordinate.cultivarId === query.cultivarId)
      );
    });
    const points = tupleOfFour(supplyPoints);
    if (!points) return [];
    const current = points[3];
    if (
      current.availability !== "available" ||
      !scope.authorization.authorizedReleaseVersionIds.includes(
        current.coordinate.metricReleaseVersionId,
      ) ||
      (query.releaseVersion !== null &&
        query.releaseVersion !== current.coordinate.metricReleaseVersionId)
    ) {
      return [];
    }
    return [metricRow(definition, points)];
  });
}

function emptyResult(
  view: ExecutiveLedgerQuery["view"],
): ExecutiveLedgerResult {
  switch (view) {
    case "operations":
      return { view, metrics: [] };
    case "risks":
      return { view, risks: [] };
    case "duty":
      return { view, duties: [] };
    case "releases":
      return { view, releases: [] };
  }
}

function workflowSnapshotVersion(
  periodKey: string,
  source: "business" | "report",
): string {
  const prefix = source === "business" ? "WORKFLOW" : "REPORT-WORKFLOW";
  return `${prefix}-${periodKey}-CURRENT`;
}

function businessWorkTarget(
  domain: BusinessWorkItem["domain"],
): ExecutiveDrillDownTarget {
  if (domain === "production")
    return { application: "production", section: "tasks" };
  if (domain === "market") return { application: "market", section: "tasks" };
  if (domain === "supply")
    return { application: "supply", section: "calculation" };
  return { application: "reporting", section: "review-distribution" };
}

function businessDomainLabel(domain: BusinessWorkItem["domain"]): string {
  const labels: Readonly<Record<BusinessWorkItem["domain"], string>> = {
    production: "产情监测",
    market: "市场监测",
    supply: "供需核算",
    reporting: "报告发布",
  };
  return labels[domain];
}

function businessWorkMatches(
  scope: OperationalScope,
  query: ExecutiveLedgerQuery,
  item: BusinessWorkItem,
): boolean {
  if (query.dataLayer !== "official") return false;
  if (query.domain !== "all" && query.domain !== item.domain) return false;
  if (
    query.businessSubtype !== null &&
    query.businessSubtype !== item.businessSubtypeId
  )
    return false;
  if (item.periodKey !== query.periodKey) return false;
  if (!pointRegionMatches(scope, query, item.regionId)) return false;
  if (query.productId !== null && query.productId !== item.productId)
    return false;
  if (query.cultivarId !== null && !item.cultivarIds.includes(query.cultivarId))
    return false;
  if (
    !scope.authorization.authorizedBusinessClassificationIds.includes(
      item.businessSubtypeId,
    ) ||
    !scope.authorization.authorizedRegionIds.includes(
      item.regionId as OperationalScope["authorization"]["authorizedRegionIds"][number],
    ) ||
    (item.productId !== null &&
      !scope.authorization.authorizedProductIds.includes(item.productId)) ||
    item.cultivarIds.some(
      (cultivarId) =>
        !scope.authorization.authorizedCultivarIds.includes(cultivarId),
    )
  ) {
    return false;
  }
  return true;
}

function latestBusinessWorkTimestamp(item: BusinessWorkItem): string {
  const timestamps = [
    ...item.obligationHistory.map(({ at }) => at),
    ...item.submissionHistory.map(({ submittedAt }) => submittedAt),
    ...item.reviewHistory.map(({ at }) => at),
    ...item.qualityHistory.map(({ at }) => at),
    ...item.releaseHistory.map(({ at }) => at),
  ].filter((value) => Number.isFinite(Date.parse(value)));
  return (
    timestamps.sort((left, right) => Date.parse(right) - Date.parse(left))[0] ??
    item.deadline
  );
}

function workRisk(
  item: BusinessWorkItem,
): Pick<ExecutiveRiskRow, "impact" | "currentState" | "riskState"> | null {
  if (item.inputVersionState === "stale") {
    return {
      impact: "阻断当前版本继续审核与发布",
      currentState: "上游数据已更新",
      riskState: "blocking",
    };
  }
  if (item.qualityStatus === "blocking") {
    return {
      impact: "阻断正式发布",
      currentState: "质量阻断",
      riskState: "blocking",
    };
  }
  if (item.obligationStatus === "missed") {
    return {
      impact: "影响本期汇总与发布覆盖",
      currentState: "截止未提交",
      riskState: "warning",
    };
  }
  if (item.reviewStatus === "returned" || item.documentStatus === "returned") {
    return {
      impact: "需要更正后重新提交",
      currentState: "审核退回",
      riskState: "warning",
    };
  }
  if (item.qualityStatus === "awaiting-explanation") {
    return {
      impact: "质量说明通过前不可正式发布",
      currentState: "等待质量说明复核",
      riskState: "warning",
    };
  }
  if (item.qualityStatus === "warning") {
    return {
      impact: "需要补充或复核质量依据",
      currentState: "质量警告",
      riskState: "warning",
    };
  }
  return null;
}

function projectWorkRisks(
  scope: OperationalScope,
  query: ExecutiveLedgerQuery,
  workItems: readonly BusinessWorkItem[],
): readonly ExecutiveRiskRow[] {
  return workItems.flatMap((item) => {
    if (!businessWorkMatches(scope, query, item)) return [];
    const risk = workRisk(item);
    if (
      !risk ||
      (query.riskState !== "all" && query.riskState !== risk.riskState)
    )
      return [];
    return [
      {
        id: `risk-work-${item.workId}`,
        riskItem: item.title,
        business: businessDomainLabel(item.domain),
        region: item.regionLabel,
        ...risk,
        sourceVersionId: workflowSnapshotVersion(query.periodKey, "business"),
        cutoff: latestBusinessWorkTimestamp(item),
        coverage: `${item.regionLabel} · ${item.businessLabel}`,
        drillDownTarget: businessWorkTarget(item.domain),
      },
    ];
  });
}

function obligationStatusLabel(
  status: BusinessWorkItem["obligationStatus"],
): string {
  const labels: Readonly<Record<BusinessWorkItem["obligationStatus"], string>> =
    {
      "not-due": "未到期",
      "in-progress": "进行中",
      "on-time": "已按时完成",
      "overdue-completed": "逾期完成",
      missed: "截止未提交",
      exempt: "已免报",
    };
  return labels[status];
}

function reviewStatusLabel(status: BusinessWorkItem["reviewStatus"]): string {
  const labels: Readonly<Record<BusinessWorkItem["reviewStatus"], string>> = {
    pending: "待审核",
    reviewing: "审核中",
    approved: "审核通过",
    returned: "审核退回",
  };
  return labels[status];
}

function formatChineseTimestamp(value: string | number): string {
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "时间待核定";
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("year")}年${Number(part("month"))}月${Number(part("day"))}日 ${part("hour")}:${part("minute")}`;
}

function firstQualifiedSubmission(item: BusinessWorkItem): string {
  const approvedSubmissionIds = new Set(
    item.reviewHistory
      .filter(({ action }) => action === "approved")
      .map(({ submissionVersionId }) => submissionVersionId),
  );
  const submission = item.submissionHistory.find(({ submissionVersionId }) =>
    approvedSubmissionIds.has(submissionVersionId),
  );
  return submission
    ? formatChineseTimestamp(submission.submittedAt)
    : "尚未形成合格提交";
}

function overdueLabel(item: BusinessWorkItem): string {
  if (item.obligationStatus === "missed") return "已逾期";
  if (item.obligationStatus === "overdue-completed") return "逾期后完成";
  return "未逾期";
}

function projectWorkDuties(
  scope: OperationalScope,
  query: ExecutiveLedgerQuery,
  workItems: readonly BusinessWorkItem[],
): readonly ExecutiveDutyRow[] {
  return workItems
    .filter((item) => businessWorkMatches(scope, query, item))
    .map((item) => {
      const status = obligationStatusLabel(item.obligationStatus);
      return {
        id: `duty-work-${item.workId}`,
        assignment: {
          id: item.responsibilityId,
          region: item.regionLabel,
          businessItem: item.title,
          frequency: item.frequency,
          responsibleUserId: item.responsibleUserId,
          person: item.responsiblePerson,
          post: item.responsiblePost,
          reviewer: item.reviewer,
          deadlineRule: item.deadlineRule,
          effectivePeriod: item.effectivePeriod,
          status,
        },
        weekly: {
          person: item.responsiblePerson,
          region: item.regionLabel,
          item: item.title,
          deadline: formatChineseTimestamp(item.deadline),
          firstQualifiedSubmission: firstQualifiedSubmission(item),
          status,
          overdueDuration: overdueLabel(item),
          review: reviewStatusLabel(item.reviewStatus),
        },
        monthly: null,
        sourceVersionId: workflowSnapshotVersion(query.periodKey, "business"),
        cutoff: latestBusinessWorkTimestamp(item),
        coverage: `${item.regionLabel} · ${item.businessLabel}`,
        drillDownTarget: businessWorkTarget(item.domain),
      };
    });
}

function reportRegionId(regionLabel: string): string | null {
  if (regionLabel === authorizedScopeRegion.label)
    return authorizedScopeRegion.id;
  return (
    getEnterpriseRegionOptions().find(({ label }) => label === regionLabel)
      ?.id ?? null
  );
}

function reportProductId(productLabel: string): string | null {
  return (
    platformProducts.find(({ label }) => label === productLabel)?.id ?? null
  );
}

function reportCultivarId(cultivarLabel: string): string | null {
  if (cultivarLabel === "不按具体品种拆分") return null;
  return (
    platformCultivars.find(({ label }) => label === cultivarLabel)?.id ?? null
  );
}

function reportRecordMatches(
  scope: OperationalScope,
  query: ExecutiveLedgerQuery,
  report: BusinessReportRecord,
): boolean {
  const classification = businessClassifications.find(
    ({ id }) => id === report.scope.businessClassificationId,
  );
  const regionId = reportRegionId(report.scope.region);
  const productId = reportProductId(report.scope.product);
  const cultivarId = reportCultivarId(report.scope.cultivar);
  const currentYear = parseCurrentYear(query.periodKey);
  if (!classification || !regionId || currentYear === null) return false;
  if (!report.scope.period.includes(String(currentYear))) return false;
  if (query.domain !== "all" && query.domain !== report.scope.application)
    return false;
  if (
    query.businessSubtype !== null &&
    query.businessSubtype !== classification.id
  )
    return false;
  if (!pointRegionMatches(scope, query, regionId)) return false;
  if (query.productId !== null && query.productId !== productId) return false;
  if (query.cultivarId !== null && query.cultivarId !== cultivarId)
    return false;
  if (
    query.releaseVersion !== null &&
    query.releaseVersion !== report.scope.dataBatchId
  )
    return false;
  return (
    scope.authorization.authorizedBusinessClassificationIds.includes(
      classification.id,
    ) &&
    (productId === null ||
      scope.authorization.authorizedProductIds.includes(productId)) &&
    (cultivarId === null ||
      scope.authorization.authorizedCultivarIds.includes(cultivarId))
  );
}

function reportCutoff(value: string): string {
  const normalized = value.trim().replace(" ", "T");
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)
    ? `${normalized}:00+08:00`
    : normalized;
}

function projectReportReleases(
  scope: OperationalScope,
  query: ExecutiveLedgerQuery,
  reports: readonly BusinessReportRecord[],
): readonly ExecutiveReleaseRow[] {
  const reportById = new Map(reports.map((report) => [report.id, report]));
  return reports.flatMap((report) => {
    if (!reportRecordMatches(scope, query, report)) return [];
    const classification = businessClassifications.find(
      ({ id }) => id === report.scope.businessClassificationId,
    );
    if (!classification) return [];
    const publishAudit = [...report.auditTrail]
      .reverse()
      .find(({ action }) => action === "发布报告");
    const publicationLabel =
      report.status === "已发布"
        ? report.revisionOfReportId
          ? "修订报告正式发布"
          : "报告正式发布"
        : report.status === "已替代"
          ? "历史报告已被修订替代"
          : `报告流程：${report.status}`;
    return [
      {
        id: `release-report-${report.id}`,
        domain: "reporting",
        businessSubtype: classification.id,
        sourceBusinessDomain: report.scope.application,
        sourceBusinessSubtype: classification.id,
        publicationId: report.id,
        publicationLabel,
        replacesPublicationId: report.replacesReportId ?? null,
        replacesPublicationLabel:
          (report.replacesReportId
            ? reportById.get(report.replacesReportId)?.title
            : null) ?? null,
        replacedByPublicationId: report.replacedByReportId ?? null,
        replacedByPublicationLabel:
          (report.replacedByReportId
            ? reportById.get(report.replacedByReportId)?.title
            : null) ?? null,
        reportName: report.title,
        frequency: report.scope.frequency,
        scope: `${report.scope.region} · ${report.scope.product} · ${report.scope.cultivar}`,
        period: report.scope.period,
        dataVersion: report.dataBatchLabel,
        publicationStatus: report.status,
        owner:
          report.status === "已发布" || report.status === "已替代"
            ? report.publisherPost
            : report.currentHandlerPost,
        publishedAt: publishAudit
          ? formatChineseTimestamp(publishAudit.occurredAt)
          : "尚未发布",
        sourceVersionId: workflowSnapshotVersion(query.periodKey, "report"),
        cutoff: reportCutoff(report.scope.dataCutoff),
        coverage: `${report.scope.region} · ${report.scope.product}`,
        drillDownTarget: {
          application: "reporting",
          section:
            report.status === "已发布" || report.status === "已替代"
              ? "ledger"
              : "review-distribution",
        },
      },
    ];
  });
}

export function queryExecutiveLedger(
  scope: OperationalScope,
  query: ExecutiveLedgerQuery,
  projection: ExecutiveLedgerProjectionInput = {},
): ExecutiveLedgerResult {
  const currentYear = parseCurrentYear(query.periodKey);
  const periodSupported = prototypeExecutiveSupportedPeriodKeys.some(
    (periodKey) => periodKey === query.periodKey,
  );
  if (
    getExecutiveScopeCoordinateIssues(scope).length > 0 ||
    !isQueryDomain(query.domain) ||
    !isRiskState(query.riskState) ||
    currentYear === null ||
    !periodSupported ||
    !queryIsAuthorized(scope, query)
  ) {
    return emptyResult(query.view);
  }
  switch (query.view) {
    case "operations":
      return {
        view: "operations",
        metrics: operationsRows(scope, query, currentYear),
      };
    case "risks":
      return {
        view: "risks",
        risks:
          projection.workItems === undefined
            ? executiveRiskFixtures.filter(
                (fixture) =>
                  fixtureMatches(scope, query, fixture) &&
                  (query.riskState === "all" ||
                    fixture.riskState === query.riskState),
              )
            : projectWorkRisks(scope, query, projection.workItems),
      };
    case "duty":
      return {
        view: "duty",
        duties:
          projection.workItems === undefined
            ? executiveDutyFixtures.filter((fixture) =>
                fixtureMatches(scope, query, fixture),
              )
            : projectWorkDuties(scope, query, projection.workItems),
      };
    case "releases":
      return {
        view: "releases",
        releases:
          projection.reportRecords === undefined
            ? executiveReleaseFixtures.filter((fixture) => {
                const subtypeDomain =
                  query.businessSubtype?.split(".")[0] ?? null;
                const requestedSourceDomain =
                  query.domain === "all" && subtypeDomain !== null
                    ? subtypeDomain
                    : query.domain;
                const domainMatches =
                  requestedSourceDomain === "all" ||
                  requestedSourceDomain === "reporting" ||
                  fixture.sourceBusinessDomain === requestedSourceDomain;
                const subtypeMatches =
                  query.businessSubtype === null ||
                  (subtypeDomain === "reporting"
                    ? fixture.businessSubtype === query.businessSubtype
                    : fixture.sourceBusinessSubtype === query.businessSubtype);
                const sourceAuthorized =
                  scope.authorization.authorizedBusinessClassificationIds.includes(
                    fixture.sourceBusinessSubtype,
                  );
                return (
                  domainMatches &&
                  subtypeMatches &&
                  sourceAuthorized &&
                  fixtureMatches(
                    scope,
                    { ...query, domain: "reporting", businessSubtype: null },
                    fixture,
                  )
                );
              })
            : projectReportReleases(scope, query, projection.reportRecords),
      };
  }
}

export const executiveMetricPointFixtures = enterpriseMetricPoints;
