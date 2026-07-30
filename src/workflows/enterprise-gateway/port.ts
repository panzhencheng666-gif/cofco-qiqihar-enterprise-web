import type { MonitoringObject } from "@/domains/monitoring-object/model";
import type { BusinessDocument } from "@/workflows/document-workspace/model";
import type { MonitoringDomain, WorkTask } from "@/workflows/task-inbox/model";

export interface TaskFilter {
  domain?: MonitoringDomain;
  reviewOnly?: boolean;
}

export interface EnterpriseGateway {
  listTasks(filter?: TaskFilter): Promise<readonly WorkTask[]>;
  listReviewTasks(): Promise<readonly WorkTask[]>;
  getObject(objectId: string): Promise<MonitoringObject>;
  getDocument(documentId: string): Promise<BusinessDocument>;
}
