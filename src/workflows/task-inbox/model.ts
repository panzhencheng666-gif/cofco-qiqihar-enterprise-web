import type { ObligationOwnerSnapshot } from "@/domains/identity-organization/responsibility";

export type MonitoringDomain = "production-monitoring" | "market-monitoring";

export type ReportingObligationStatus =
  "未开放" | "进行中" | "已到期" | "已关闭" | "免报";

export type TimelinessResult =
  "待判定" | "按时提交" | "逾期补填" | "仍未提交" | "不适用";

export type DocumentWorkflowStatus =
  "草稿" | "已提交" | "已退回" | "审核中" | "已审核" | "已发布";

export type DataQualityStatus = "通过" | "警告" | "阻断" | "未校验";

export interface WorkTask {
  id: string;
  domain: MonitoringDomain;
  title: string;
  objectId: string;
  objectName: string;
  documentId: string;
  commodity: "玉米" | "大豆" | "稻谷";
  reportingPeriod: string;
  dueAt: string;
  ownerSnapshot: ObligationOwnerSnapshot;
  obligationStatus: ReportingObligationStatus;
  timeliness: TimelinessResult;
  documentStatus: DocumentWorkflowStatus;
  qualityStatus: DataQualityStatus;
}
