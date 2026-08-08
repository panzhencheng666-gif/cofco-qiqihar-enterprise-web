import type {
  DataQualityStatus,
  DocumentWorkflowStatus,
  ReportingObligationStatus,
  TimelinessResult,
} from "@/workflows/task-inbox/model";

export type MyWorkKind = "填报" | "审核" | "异常处置" | "发布";

export interface MyWorkItem {
  id: string;
  taskId: string;
  kind: MyWorkKind;
  title: string;
  businessModule: "产情监测" | "市场监测";
  regionName: string;
  dueAt: string;
  deadlineOwnerName: string;
  obligationStatus: ReportingObligationStatus;
  timeliness: TimelinessResult;
  documentStatus: DocumentWorkflowStatus;
  qualityStatus: DataQualityStatus;
  documentPath: string;
}

export interface MyWorkSummary {
  pending: number;
  qualityBlocking: number;
  overdue: number;
  completed: number;
}
