import { RealtimeApiError } from "@/platform/api/realtimeApiClient";
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

export const importRefreshFailureMessage =
  "导入结果已保存，但列表刷新失败，请刷新页面查看，无需重复导入。";

export function importFailureMessage(error: unknown) {
  if (error instanceof RealtimeApiError) {
    if (error.code === "API_TIMEOUT" || error.code === "API_NETWORK_ERROR") {
      return "连接中断或请求超时，暂时无法确认导入结果，请刷新列表核对后再重试。";
    }
    if (error.clientMessage) return error.clientMessage;
    if (error.status === 401) return "登录已失效，请重新登录后再导入。";
    if (error.status === 403) return "当前账号没有导入权限，请联系管理员。";
    if (error.status === 413) return "导入文件过大，请减小文件后重试。";
  }
  return "未能确认导入结果，请刷新列表核对后再重试。";
}
