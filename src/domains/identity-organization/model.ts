export type CapabilityCode =
  | "my-work:view"
  | "business-overview:view"
  | "production-monitoring:view"
  | "market-monitoring:view"
  | "supply-situation:view"
  | "report-center:view"
  | "data-governance:view"
  | "system-administration:view"
  | "business-document:view"
  | "business-document:review"
  | "account-security:view";

export interface ActorIdentity {
  id: string;
  displayName: string;
  responsibilityPosition: string;
}

export interface OrganizationContext {
  id: string;
  name: string;
}
