import type { MonitoringObject } from "@/domains/monitoring-object/model";
import type { BusinessDocument } from "@/workflows/document-workspace/model";
import type { CurrentWorkspace } from "@/workflows/current-workspace/model";
import type { MyWorkItem } from "@/workflows/my-work/model";
import type { MonitoringDomain, WorkTask } from "@/workflows/task-inbox/model";

export interface TaskFilter {
  domain?: MonitoringDomain;
  reviewOnly?: boolean;
}

export interface EnterpriseGateway {
  getCurrentWorkspace(): Promise<CurrentWorkspace>;
  listMyWork(): Promise<readonly MyWorkItem[]>;
  listTasks(filter?: TaskFilter): Promise<readonly WorkTask[]>;
  listReviewTasks(): Promise<readonly WorkTask[]>;
  getObject(objectId: string): Promise<MonitoringObject>;
  getDocument(documentId: string): Promise<BusinessDocument>;
}
