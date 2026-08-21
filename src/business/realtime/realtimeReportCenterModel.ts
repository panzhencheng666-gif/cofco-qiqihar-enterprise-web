import type {
  MasterDataSnapshot,
  ReportDefinition,
} from "@/platform/api/realtimeBusinessRepository";

export type ReportFrequency = "DAILY" | "WEEKLY" | "MONTHLY";
type ReportDomain = "COMPREHENSIVE";

export interface ReportDefinitionGroup {
  code: ReportDomain;
  label: string;
  description: string;
  definitions: readonly ReportDefinition[];
}

export interface ReportCoverage {
  status: "COMPLETE" | "PARTIAL";
  message: string;
}

const frequencyOrder: Record<ReportFrequency, number> = {
  DAILY: 0,
  WEEKLY: 1,
  MONTHLY: 2,
};

const reportGroups: readonly Omit<ReportDefinitionGroup, "definitions">[] = [
  {
    code: "COMPREHENSIVE",
    label: "综合经营报告",
    description: "同一审核快照汇总玉米、大豆、稻谷的产情、市场、物流与供需数据",
  },
];

export function reportFrequency(value: string | undefined): ReportFrequency {
  return value === "WEEKLY" || value === "MONTHLY" ? value : "DAILY";
}

export function defaultReportPeriod(
  frequency: ReportFrequency,
  today: string,
): string {
  if (frequency === "WEEKLY") return isoWeek(today);
  if (frequency === "MONTHLY") return today.slice(0, 7);
  return today;
}

export function reportPeriodLabel(
  frequency: ReportFrequency,
  value: string,
): string {
  if (frequency === "WEEKLY") {
    const match = /^(\d{4})-W(\d{2})$/.exec(value);
    if (!match || Number(match[2]) < 1 || Number(match[2]) > 53)
      return "报告周待选择";
    return `${match[1]}年第${Number(match[2])}周`;
  }
  if (frequency === "MONTHLY") {
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    if (!match || Number(match[2]) < 1 || Number(match[2]) > 12)
      return "报告月份待选择";
    return `${match[1]}年${Number(match[2])}月`;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match || !validDate(value)) return "报告日期待选择";
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
}

export function weeklyPeriodCode(year: string, week: string): string {
  if (!/^\d{4}$/.test(year)) throw new Error("报告年份无效");
  const weekNumber = Number(week);
  if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 53)
    throw new Error("报告周次必须为第1至53周");
  return `${year}-W${String(weekNumber).padStart(2, "0")}`;
}

export function weeklyPeriodParts(
  value: string,
  fallback: string,
): { year: string; week: string } {
  for (const candidate of [value, fallback]) {
    const match = /^(\d{4})-W(\d{2})$/.exec(candidate);
    if (match && Number(match[2]) >= 1 && Number(match[2]) <= 53)
      return { year: match[1], week: match[2] };
  }
  throw new Error("报告周待选择");
}

export function groupReportDefinitions(
  definitions: readonly ReportDefinition[],
): readonly ReportDefinitionGroup[] {
  return reportGroups.flatMap((group) => {
    const groupDefinitions = definitions
      .filter(({ businessDomain }) => businessDomain === group.code)
      .sort(
        (left, right) =>
          frequencyOrder[reportFrequency(left.frequencyCode)] -
          frequencyOrder[reportFrequency(right.frequencyCode)],
      );
    return groupDefinitions.length
      ? [{ ...group, definitions: groupDefinitions }]
      : [];
  });
}

export function defaultReportRegionCode(
  regions: MasterDataSnapshot["regions"],
): string {
  return (
    regions.find(
      ({ level, parentCode }) => level === "PREFECTURE" && parentCode === null,
    )?.code ??
    regions.find(({ level }) => level === "PREFECTURE")?.code ??
    regions[0]?.code ??
    ""
  );
}

export function reportCoverage(
  lines: readonly { label: string; value: string; note: string }[],
): ReportCoverage {
  const approvedCount = Number(
    lines.find(({ label }) => label === "核定数据条数")?.value,
  );
  const partial = lines.some(({ label, value, note }) => {
    if (label === "核定数据条数") return false;
    if (value.includes("暂无审核数据") || note.includes("暂无审核数据"))
      return true;
    const sourceCount = /采用\s*(\d+)\s*条审核数据/.exec(note)?.[1];
    return (
      Number.isFinite(approvedCount) &&
      approvedCount > 0 &&
      sourceCount !== undefined &&
      Number(sourceCount) < approvedCount
    );
  });
  return partial
    ? {
        status: "PARTIAL",
        message:
          "部分指标审核来源不足或暂缺，文件将如实保留缺项，不按零值处理。",
      }
    : {
        status: "COMPLETE",
        message: "数据覆盖完整，本次报告的业务指标均来自当前核定范围。",
      };
}

function isoWeek(dateCode: string): string {
  if (!validDate(dateCode)) throw new Error("报告日期无效");
  const [year, month, day] = dateCode.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const weekYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return weeklyPeriodCode(String(weekYear), String(week));
}

function validDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    Number.isInteger(year) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
