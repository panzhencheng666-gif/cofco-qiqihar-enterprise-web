export const currentSurveyYear = String(new Date().getFullYear());

export const surveyYearOptions = Array.from({ length: 12 }, (_, index) =>
  String(Number(currentSurveyYear) + 1 - index),
);

export const surveyMonthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: `${index + 1} 月`,
}));

type RecordValues = Readonly<Record<string, string | undefined>>;

export function formatExplicitSurveyPeriod(
  values: RecordValues,
  prefix: "PROD" | "MKT" | "LOG",
  legacyCode: string,
): string {
  const year = values.surveyYear ?? values[`${prefix}_SURVEY_YEAR`];
  const month = values.surveyMonth ?? values[`${prefix}_SURVEY_MONTH`];
  const governanceState = values[`${prefix}_SURVEY_PERIOD_GOVERNANCE_STATE`];
  if (!year) return values[legacyCode] ?? "—";

  const period = month ? `${year}年${Number(month)}月` : `${year}年（年度）`;
  return governanceState === "PENDING_GOVERNANCE"
    ? `${period} · 待治理`
    : period;
}

export function formatRealFillingTime(
  values: RecordValues,
  prefix: "PROD" | "MKT" | "LOG",
): string {
  const fillingAt = values.fillingDate ?? values[`${prefix}_FILLING_AT`];
  if (!fillingAt) return "—";

  const basis = values[`${prefix}_FILLING_TIME_BASIS`];
  if (basis === "SUBMITTED_AT") return `${fillingAt}（提交）`;
  if (basis === "DRAFT_CREATED_AT") return `${fillingAt}（草稿创建）`;
  if (basis === "CREATED_AT_NO_SUBMISSION_AUDIT") {
    return `${fillingAt}（创建时间，提交审计缺失）`;
  }
  return fillingAt;
}

export function matchesSurveyPeriod(
  isoDate: string,
  year: string,
  month: string,
): boolean {
  const match = /^(\d{4})-(\d{2})/.exec(isoDate);
  if (!match) return false;
  return match[1] === year && (!month || Number(match[2]) === Number(month));
}

export function formatSurveyPeriodFromDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(isoDate);
  return match ? `${match[1]}年${Number(match[2])}月` : isoDate;
}

export function matchesFillingDateRange(
  value: string,
  from: string,
  to: string,
): boolean {
  if (!from && !to) return true;
  const match = /(\d{4})[-年](\d{1,2})[-月](\d{1,2})/.exec(value);
  if (!match) return false;
  const date = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  return (!from || date >= from) && (!to || date <= to);
}
