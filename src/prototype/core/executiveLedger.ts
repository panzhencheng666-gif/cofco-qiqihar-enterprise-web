import type { BusinessClassification } from "./businessClassification";
import {
  buildComparisonSet,
  type PublishedMetricPoint,
} from "./comparableSeries";
import { formatFixedDecimal } from "./fixedDecimal";
import type { MetricDefinition } from "./metricCatalog";
import type { MetricComparisonViewModel } from "./metricComparisonViewModel";
import { createMetricComparisonViewModel } from "./metricComparisonViewModel";
import type { OperationalScope } from "./operationalScope";
import {
  aggregateRegionMembershipSnapshots,
  enterpriseMetricDefinitions,
  enterpriseMetricPoints,
  queryPrototypeMetricComparisons,
} from "../data/enterpriseMetricFixtures";
import {
  executiveDutyFixtures,
  executiveReleaseFixtures,
  executiveRiskFixtures,
  prototypeExecutiveDefaultPeriodKey,
  prototypeExecutiveSupportedPeriodKeys,
  temporaryExecutiveSupplyReleasePoints,
  type ExecutiveFixtureCoordinates,
} from "../data/executiveLedgerFixtures";

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

const domains = [
  "production",
  "market",
  "supply",
  "operations",
  "reporting",
] as const;

const riskStates = ["all", "warning", "blocking"] as const;

export interface ExecutiveScopeCoordinateIssue {
  coordinate: "business-domain" | "risk-state";
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
    periodKey: coordinates.periodKey ?? prototypeExecutiveDefaultPeriodKey,
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

function authorizedAggregate(scope: OperationalScope): boolean {
  const effective = [...scope.authorization.authorizedRegionIds].sort();
  return aggregateRegionMembershipSnapshots.some(({ memberRegionIds }) => {
    const members = [...memberRegionIds].sort();
    return (
      members.length === effective.length &&
      members.every((regionId, index) => regionId === effective[index])
    );
  });
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
  return query.regionId !== "authorized-all" || authorizedAggregate(scope);
}

function pointRegionMatches(
  scope: OperationalScope,
  queryRegionId: string,
  pointRegionId: string,
): boolean {
  if (queryRegionId !== "authorized-all")
    return pointRegionId === queryRegionId;
  if (!authorizedAggregate(scope)) return false;
  return (
    pointRegionId === "authorized-all" ||
    scope.authorization.authorizedRegionIds.some(
      (authorizedRegionId) => authorizedRegionId === pointRegionId,
    )
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
    pointRegionMatches(scope, query.regionId, fixture.regionId) &&
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
    const supplyPoints = temporaryExecutiveSupplyReleasePoints.filter(
      (point) => {
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
          pointRegionMatches(
            scope,
            query.regionId,
            point.coordinate.regionId,
          ) &&
          point.coordinate.dataLayer === query.dataLayer &&
          (query.productId === null ||
            point.coordinate.cropId === query.productId ||
            point.coordinate.productAccountId === query.productId) &&
          (query.cultivarId === null ||
            point.coordinate.cultivarId === query.cultivarId)
        );
      },
    );
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

export function queryExecutiveLedger(
  scope: OperationalScope,
  query: ExecutiveLedgerQuery,
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
        risks: executiveRiskFixtures.filter(
          (fixture) =>
            fixtureMatches(scope, query, fixture) &&
            (query.riskState === "all" ||
              fixture.riskState === query.riskState),
        ),
      };
    case "duty":
      return {
        view: "duty",
        duties: executiveDutyFixtures.filter((fixture) =>
          fixtureMatches(scope, query, fixture),
        ),
      };
    case "releases":
      return {
        view: "releases",
        releases: executiveReleaseFixtures.filter((fixture) => {
          const subtypeDomain = query.businessSubtype?.split(".")[0] ?? null;
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
        }),
      };
  }
}

export const executiveMetricPointFixtures = enterpriseMetricPoints;
