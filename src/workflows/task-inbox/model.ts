export type MonitoringDomain = "production-monitoring" | "market-monitoring";

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
  assignee: string;
  status: "待填报" | "待复核" | "质量异常" | "已发布";
}
