import type { BusinessClassification } from "./core/businessClassification";
import {
  readOperationalScope,
  type OperationalScopeIdentity,
  type OperationalScopeIssue,
} from "./core/operationalScope";
import type { EnterpriseRegionId } from "./enterpriseRegions";

export const formalSectionsByApplication = {
  work: ["tasks"],
  overview: ["operations", "risks", "duty", "releases"],
  production: ["tasks", "objects", "analysis"],
  market: ["tasks", "objects", "analysis"],
  supply: ["calculation", "comparison", "versions"],
  reporting: ["compose", "review-distribution", "ledger"],
} as const;

export const formalApplications = Object.keys(
  formalSectionsByApplication,
) as readonly (keyof typeof formalSectionsByApplication)[];

export type FormalApplication = keyof typeof formalSectionsByApplication;
export type SectionFor<A extends FormalApplication> =
  (typeof formalSectionsByApplication)[A][number];
export type FormalRoute = {
  [A in FormalApplication]: { application: A; section: SectionFor<A> };
}[FormalApplication];

export function createFormalRoute<A extends FormalApplication>(
  application: A,
  section: SectionFor<A>,
): Extract<FormalRoute, { application: A }> {
  return { application, section } as Extract<FormalRoute, { application: A }>;
}

export type WorkSection = SectionFor<"work">;
export type OverviewSection = SectionFor<"overview">;
export type ProductionSection = SectionFor<"production">;
export type MarketSection = SectionFor<"market">;
/** Workspace compatibility is intentionally wider than the URL route contract. */
export type SupplySection = SectionFor<"supply"> | (string & {});
export type ReportingSection = SectionFor<"reporting">;
export type FormalSection = SectionFor<FormalApplication>;

export interface FormalSelection {
  type:
    | "work-item"
    | "object"
    | "document"
    | "exception"
    | "report"
    | "release-version";
  id: string;
}

export interface BusinessCoordinates {
  regionId: string;
  regionLevel?: "city" | "county" | "township" | "village" | "custom";
  businessDomainId?: string;
  businessSubtypeId?: string;
  productId?: string;
  cultivarId?: string;
  periodKey?: string;
  dataCutoff?: string;
  dataLayer?: "preliminary" | "official";
  releaseVersion?: string;
  riskState?: "all" | "warning" | "blocking";
  selectedMetricId?: string;
}

export interface FormalLocation {
  route: FormalRoute;
  coordinates: BusinessCoordinates;
  selection?: FormalSelection;
  savedViewId?: string;
}

export interface FormalLocationAuthorization {
  authorizedRegionIds: readonly EnterpriseRegionId[];
  authorizedBusinessClassificationIds: readonly BusinessClassification["id"][];
  authorizedProductIds: readonly string[];
  authorizedCultivarIds: readonly string[];
  authorizedReleaseVersionIds: readonly string[];
  permissionKeys: readonly string[];
}

export type FormalLocationAuthority =
  | FormalLocationAuthorization
  | OperationalScopeIdentity;

export interface FormalLocationReadResult {
  location: FormalLocation;
  issues: readonly OperationalScopeIssue[];
  queryAllowed: boolean;
}

function isFormalApplication(value: string | null): value is FormalApplication {
  return value !== null && value in formalSectionsByApplication;
}

export function isSectionForApplication<A extends FormalApplication>(
  application: A,
  value: string | null,
): value is SectionFor<A> {
  return (formalSectionsByApplication[application] as readonly string[]).some(
    (section) => section === value,
  );
}

export function getDefaultFormalSection<A extends FormalApplication>(
  application: A,
): SectionFor<A> {
  return formalSectionsByApplication[application][0];
}

export function readFormalRoute(search: string): FormalRoute {
  const parameters = new URLSearchParams(search);
  const applicationValue = parameters.get("page");
  const application = isFormalApplication(applicationValue)
    ? applicationValue
    : "work";
  const sectionValue = parameters.get("section");
  return createFormalRoute(
    application,
    isSectionForApplication(application, sectionValue)
      ? sectionValue
      : getDefaultFormalSection(application),
  );
}

export function writeFormalRoute(route: FormalRoute): string {
  const parameters = new URLSearchParams();
  parameters.set("page", route.application);
  if (route.section !== getDefaultFormalSection(route.application)) {
    parameters.set("section", route.section);
  }
  return parameters.toString();
}

const locationCoordinateParameters: readonly [keyof BusinessCoordinates, string][] = [
  ["regionId", "region"],
  ["regionLevel", "regionLevel"],
  ["businessDomainId", "businessDomain"],
  ["businessSubtypeId", "businessSubtype"],
  ["productId", "product"],
  ["cultivarId", "cultivar"],
  ["periodKey", "period"],
  ["dataCutoff", "dataCutoff"],
  ["dataLayer", "dataLayer"],
  ["releaseVersion", "releaseVersion"],
  ["riskState", "riskState"],
  ["selectedMetricId", "selectedMetric"],
];

export function writeFormalLocation(location: FormalLocation): string {
  const parameters = new URLSearchParams(writeFormalRoute(location.route));
  for (const [coordinate, parameter] of locationCoordinateParameters) {
    const value = location.coordinates[coordinate];
    if (value) parameters.set(parameter, value);
  }
  if (location.selection) {
    parameters.set("selectionType", location.selection.type);
    parameters.set("selectionId", location.selection.id);
  }
  if (location.savedViewId) parameters.set("savedView", location.savedViewId);
  return parameters.toString();
}

export function readFormalLocation(
  search: string,
  authority: FormalLocationAuthority,
): FormalLocationReadResult {
  const parameters = new URLSearchParams(search);
  const scope = readOperationalScope(search, toOperationalScopeIdentity(authority));
  const selectionType = parameters.get("selectionType");
  const selectionId = parameters.get("selectionId");
  const selection =
    selectionType && selectionId
      ? { type: selectionType as FormalSelection["type"], id: selectionId }
      : undefined;
  const savedViewId = parameters.get("savedView") ?? undefined;
  return {
    location: {
      route: readFormalRoute(search),
      coordinates: scope.scope.coordinates,
      ...(selection ? { selection } : {}),
      ...(savedViewId ? { savedViewId } : {}),
    },
    issues: scope.issues,
    queryAllowed: scope.queryAllowed,
  };
}

function toOperationalScopeIdentity(
  authority: FormalLocationAuthority,
): OperationalScopeIdentity {
  if ("workUnit" in authority) return authority;
  return {
    workUnit: {
      organizationId: "current-organization",
      unitId: "current-unit",
      label: "当前工作单位",
    },
    identity: { userId: "current-user", postId: "current-post" },
    authorization: authority,
  };
}

export type WeeklyTaskStatus =
  | "待填写"
  | "填写中"
  | "已按时提交"
  | "已退回"
  | "退回后待修改"
  | "截止未提交"
  | "逾期补填"
  | "审核通过"
  | "免报";

export interface WeeklyTaskAuthorization {
  responsibleUserId: string;
  status: WeeklyTaskStatus;
}

export type DutySnapshotStatus =
  | "按时完成"
  | "逾期补填"
  | "截止未提交"
  | "免报";
export interface DutySnapshot { status: DutySnapshotStatus; }
export interface DutyMonthSummary {
  expected: number; onTime: number; overdue: number; missing: number; exempt: number; onTimeRate: number;
}
export function canFillWeeklyTask(task: WeeklyTaskAuthorization, userId: string): boolean {
  return task.responsibleUserId === userId && task.status !== "审核通过" && task.status !== "免报";
}
export function summarizeDutyMonth(snapshots: readonly DutySnapshot[]): DutyMonthSummary {
  const exempt = snapshots.filter(({ status }) => status === "免报").length;
  const expected = snapshots.length - exempt;
  const onTime = snapshots.filter(({ status }) => status === "按时完成").length;
  const overdue = snapshots.filter(({ status }) => status === "逾期补填").length;
  const missing = snapshots.filter(({ status }) => status === "截止未提交").length;
  return { expected, onTime, overdue, missing, exempt, onTimeRate: expected === 0 ? 0 : Number(((onTime / expected) * 100).toFixed(1)) };
}
