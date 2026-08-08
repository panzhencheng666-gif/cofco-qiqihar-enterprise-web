import type {
  ActorIdentity,
  CapabilityCode,
  OrganizationContext,
} from "@/domains/identity-organization/model";

export interface CurrentWorkspace {
  id: "current";
  organization: OrganizationContext;
  regionName: string;
  marketingYear: string;
  dataScopeName: string;
  actor: ActorIdentity;
  capabilities: readonly CapabilityCode[];
  documentAccess: readonly DocumentAccessProjection[];
  dataMode: "演示环境 · 非生产数据" | "生产环境 · 正式数据";
  session: {
    status: "安全" | "需要重新登录";
  };
}

export type DocumentOperation = "view" | "edit" | "review" | "publish";

export interface DocumentAccessProjection {
  objectId: string;
  documentId: string;
  operations: readonly DocumentOperation[];
  responsibilityAssignmentId?: string;
  appointmentId?: string;
}
