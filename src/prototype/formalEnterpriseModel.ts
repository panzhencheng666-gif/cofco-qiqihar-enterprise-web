import type { BusinessClassification } from "./core/businessClassification";
import {
  readOperationalScope,
  writeOperationalCoordinates,
  type OperationalScopeIdentity,
  type OperationalScopeIssue,
} from "./core/operationalScope";
import type { EnterpriseRegionId } from "./enterpriseRegions";

export const formalSectionsByApplication = {
  work: ["tasks", "submitted", "review", "exceptions", "completed"],
  overview: ["operations", "risks", "duty", "releases", "map"],
  production: [
    "corn-collection",
    "soybean-collection",
    "rice-collection",
    "tasks",
    "objects",
    "review",
    "analysis",
  ],
  market: [
    "corn-collection",
    "soybean-collection",
    "paddy-collection",
    "logistics",
    "tasks",
    "objects",
    "review",
    "analysis",
  ],
  supply: [
    "corn-balance",
    "soybean-balance",
    "paddy-balance",
    "records",
    // Hidden compatibility routes remain readable until the supply workspace
    // is recomposed around the product-owned account routes.
    "calculation",
    "comparison",
    "versions",
  ],
  reporting: ["compose", "comprehensive", "review-distribution", "ledger"],
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
export type SupplySection = SectionFor<"supply">;
export type ReportingSection = SectionFor<"reporting">;
export type FormalSection = SectionFor<FormalApplication>;

const formalBusinessRouteNames = {
  work: {
    application: "我的工作",
    sections: {
      tasks: "待我处理",
      submitted: "待我填报",
      review: "待我审核",
      exceptions: "退回与异常",
      completed: "已办事项",
    },
  },
  overview: {
    // Keep the legacy application name in persisted hashes.  The map is
    // exposed as a separate navigation item, while the former executive
    // ledger routes remain backward compatible.
    application: "经营总览",
    sections: {
      operations: "经营运行",
      risks: "风险关注",
      duty: "履责情况",
      releases: "结果发布",
      map: "总揽监测",
    },
  },
  production: {
    application: "产情监测",
    sections: {
      "corn-collection": "玉米产情填报",
      "soybean-collection": "大豆产情填报",
      "rice-collection": "稻谷产情填报",
      tasks: "产情任务",
      objects: "调查对象",
      review: "数据审核",
      analysis: "产情分析",
    },
  },
  market: {
    application: "市场监测",
    sections: {
      "corn-collection": "玉米市场采集",
      "soybean-collection": "大豆市场采集",
      "paddy-collection": "稻谷市场采集",
      logistics: "物流节点监测",
      tasks: "采集任务",
      objects: "监测对象",
      review: "数据审核",
      analysis: "市场分析",
    },
  },
  supply: {
    application: "供需分析",
    sections: {
      "corn-balance": "玉米供需平衡",
      "soybean-balance": "大豆供需平衡",
      "paddy-balance": "稻谷供需平衡",
      records: "计算记录",
      calculation: "供需测算",
      comparison: "四年对比",
      versions: "核定记录",
    },
  },
  reporting: {
    application: "报表中心",
    sections: {
      compose: "业务报告",
      comprehensive: "综合报告",
      "review-distribution": "报告审核与发布",
      ledger: "报告台账",
    },
  },
} as const satisfies {
  [A in FormalApplication]: {
    application: string;
    sections: Record<SectionFor<A>, string>;
  };
};

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
  FormalLocationAuthorization | OperationalScopeIdentity;

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

function defaultFormalRoute(): FormalRoute {
  return createFormalRoute("work", "tasks");
}

function safelyDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

function readBusinessHash(hash: string): FormalRoute | null {
  const decoded = safelyDecode(hash).replace(/^#\/?/, "");
  if (!decoded) return null;
  const [applicationSegment, sectionSegment] = decoded.split("/");
  const application = formalApplications.find(
    (candidate) =>
      formalBusinessRouteNames[candidate].application === applicationSegment ||
      candidate === applicationSegment,
  );
  if (!application) return null;
  const sectionNames = formalBusinessRouteNames[application]
    .sections as Readonly<Record<string, string>>;
  const legacySectionAliases: Partial<
    Record<FormalApplication, Record<string, string>>
  > = {
    production: { 水稻产情填报: "rice-collection" },
  };
  const aliasedSection = legacySectionAliases[application]?.[sectionSegment];
  const section = formalSectionsByApplication[application].find(
    (candidate) =>
      sectionNames[candidate] === sectionSegment ||
      candidate === sectionSegment ||
      candidate === aliasedSection,
  );
  return createFormalRoute(
    application,
    section ?? getDefaultFormalSection(application),
  );
}

function routeInputParts(value: string): {
  hash: string;
  search: string;
  encodedHash: string;
} {
  const url = new URL(value || "/", "https://enterprise-route.invalid/");
  const search = value.startsWith("?") ? value : url.search;
  const encodedHash = search.startsWith("?")
    ? safelyDecode(search.slice(1))
    : "";
  return {
    hash: value.startsWith("#") ? value : url.hash,
    search,
    encodedHash: encodedHash.startsWith("#/") ? encodedHash : "",
  };
}

export function readFormalRoute(value: string): FormalRoute {
  const { encodedHash, hash, search } = routeInputParts(value);
  if (encodedHash) return readBusinessHash(encodedHash) ?? defaultFormalRoute();
  if (hash) return readBusinessHash(hash) ?? defaultFormalRoute();

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
  const names = formalBusinessRouteNames[route.application];
  const sectionNames = names.sections as Readonly<Record<string, string>>;
  return `#/${names.application}/${sectionNames[route.section]}`;
}

export function writeFormalLocation(location: FormalLocation): string {
  return writeFormalRoute(location.route);
}

export function readFormalLocation(
  search: string,
  authority: FormalLocationAuthority,
): FormalLocationReadResult {
  const scope = readOperationalScope("", toOperationalScopeIdentity(authority));
  return {
    location: {
      route: readFormalRoute(search),
      coordinates: scope.scope.coordinates,
    },
    issues: scope.issues,
    queryAllowed: scope.queryAllowed,
  };
}

const formalSelectionTypes: readonly FormalSelection["type"][] = [
  "work-item",
  "object",
  "document",
  "exception",
  "report",
  "release-version",
];

function safeSessionValue(value: string | undefined): string | undefined {
  if (!value || value.length > 160 || !/^[\p{L}\p{N}._:-]+$/u.test(value)) {
    return undefined;
  }
  return value;
}

export function normalizeFormalLocation(
  location: FormalLocation,
  authority: FormalLocationAuthority,
): FormalLocationReadResult {
  const scope = readOperationalScope(
    writeOperationalCoordinates(location.coordinates),
    toOperationalScopeIdentity(authority),
  );
  const selectionId = safeSessionValue(location.selection?.id);
  const selection =
    location.selection &&
    formalSelectionTypes.includes(location.selection.type) &&
    selectionId
      ? { type: location.selection.type, id: selectionId }
      : undefined;
  const savedViewId = safeSessionValue(location.savedViewId);
  return {
    location: {
      route: location.route,
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
  "按时完成" | "逾期补填" | "截止未提交" | "免报";
export interface DutySnapshot {
  status: DutySnapshotStatus;
}
export interface DutyMonthSummary {
  expected: number;
  onTime: number;
  overdue: number;
  missing: number;
  exempt: number;
  onTimeRate: number;
}
export function canFillWeeklyTask(
  task: WeeklyTaskAuthorization,
  userId: string,
): boolean {
  return (
    task.responsibleUserId === userId &&
    task.status !== "审核通过" &&
    task.status !== "免报"
  );
}
export function summarizeDutyMonth(
  snapshots: readonly DutySnapshot[],
): DutyMonthSummary {
  const exempt = snapshots.filter(({ status }) => status === "免报").length;
  const expected = snapshots.length - exempt;
  const onTime = snapshots.filter(({ status }) => status === "按时完成").length;
  const overdue = snapshots.filter(
    ({ status }) => status === "逾期补填",
  ).length;
  const missing = snapshots.filter(
    ({ status }) => status === "截止未提交",
  ).length;
  return {
    expected,
    onTime,
    overdue,
    missing,
    exempt,
    onTimeRate:
      expected === 0 ? 0 : Number(((onTime / expected) * 100).toFixed(1)),
  };
}
