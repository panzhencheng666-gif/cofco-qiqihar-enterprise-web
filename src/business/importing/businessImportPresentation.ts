import type { ProductionImportJob } from "@/platform/api/realtimeBusinessRepository";

const productLabels: Readonly<Record<string, string>> = {
  CORN: "玉米",
  RICE: "稻谷",
  SOYBEAN: "大豆",
};

function productLabel(code: string) {
  return productLabels[code] ?? code;
}

function periodLabel(period: string) {
  const match = /^(\d{4})-(\d{2})$/u.exec(period);
  if (!match) return period;
  return `${match[1]}年${Number(match[2])}月`;
}

export function businessImportScopeLabel(job: ProductionImportJob) {
  const products = (job.productCodes ?? []).map(productLabel).join("、");
  const periods = (job.surveyPeriods ?? []).map(periodLabel).join("、");
  return [products, periods].filter(Boolean).join(" · ") || "导入任务";
}
