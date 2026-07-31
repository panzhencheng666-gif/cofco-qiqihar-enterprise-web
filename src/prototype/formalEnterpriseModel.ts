export const formalApplications = [
  "work",
  "overview",
  "production",
  "market",
  "supply",
  "reporting",
] as const;

export const formalSectionsByApplication = {
  work: ["inbox", "reporting", "review", "exception", "completed"],
  overview: ["overview"],
  production: ["overview", "objects", "collection", "review", "reports"],
  market: ["overview", "objects", "collection", "review", "reports"],
  supply: ["overview", "accounts", "regional", "lineage", "situation"],
  reporting: [
    "business-reports",
    "duty-reports",
    "review",
    "distribution",
    "versions",
  ],
} as const;

export type FormalApplication = (typeof formalApplications)[number];
export type WorkSection = (typeof formalSectionsByApplication.work)[number];
export type OverviewSection =
  (typeof formalSectionsByApplication.overview)[number];
export type ProductionSection =
  (typeof formalSectionsByApplication.production)[number];
export type MarketSection =
  (typeof formalSectionsByApplication.market)[number];
export type SupplySection =
  (typeof formalSectionsByApplication.supply)[number];
export type ReportingSection =
  (typeof formalSectionsByApplication.reporting)[number];
export type FormalSection =
  | WorkSection
  | OverviewSection
  | ProductionSection
  | MarketSection
  | SupplySection
  | ReportingSection;

export interface FormalRoute {
  application: FormalApplication;
  section: FormalSection;
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

function isFormalApplication(value: string | null): value is FormalApplication {
  return formalApplications.some((application) => application === value);
}

export function isSectionForApplication(
  application: FormalApplication,
  value: string | null,
): value is FormalSection {
  return (formalSectionsByApplication[application] as readonly string[]).some(
    (section) => section === value,
  );
}

export function getDefaultFormalSection(
  application: FormalApplication,
): FormalSection {
  return formalSectionsByApplication[application][0];
}

export function readFormalRoute(search: string): FormalRoute {
  const parameters = new URLSearchParams(search);
  const applicationValue = parameters.get("page");
  const sectionValue = parameters.get("section");
  const application = isFormalApplication(applicationValue)
    ? applicationValue
    : "work";

  return {
    application,
    section: isSectionForApplication(application, sectionValue)
      ? sectionValue
      : getDefaultFormalSection(application),
  };
}

export function writeFormalRoute(route: FormalRoute): string {
  const parameters = new URLSearchParams();
  parameters.set("page", route.application);
  if (route.section !== getDefaultFormalSection(route.application)) {
    parameters.set("section", route.section);
  }
  return parameters.toString();
}

export function canFillWeeklyTask(
  task: WeeklyTaskAuthorization,
  userId: string,
): boolean {
  if (task.responsibleUserId !== userId) return false;
  return task.status !== "审核通过" && task.status !== "免报";
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
