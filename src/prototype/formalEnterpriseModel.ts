export const formalApplications = [
  "work",
  "production",
  "market",
  "supply",
  "reporting",
] as const;

export const reportingSections = [
  "overview",
  "responsibility",
  "weekly",
  "records",
  "overdue",
  "duty-weekly",
  "duty-monthly",
  "business-reports",
  "versions",
] as const;

export type FormalApplication = (typeof formalApplications)[number];
export type ReportingSection = (typeof reportingSections)[number];

export interface FormalRoute {
  application: FormalApplication;
  reportingSection: ReportingSection;
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

function isReportingSection(value: string | null): value is ReportingSection {
  return reportingSections.some((section) => section === value);
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
    reportingSection:
      application === "reporting" && isReportingSection(sectionValue)
        ? sectionValue
        : "overview",
  };
}

export function writeFormalRoute(route: FormalRoute): string {
  const parameters = new URLSearchParams();
  parameters.set("page", route.application);
  if (
    route.application === "reporting" &&
    route.reportingSection !== "overview"
  ) {
    parameters.set("section", route.reportingSection);
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
