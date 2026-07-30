export type MonitoringObjectKind =
  | "village-ledger"
  | "agricultural-station"
  | "farmer-sample"
  | "operating-site"
  | "logistics-node";

export interface MonitoringObject {
  id: string;
  name: string;
  kind: MonitoringObjectKind;
  regionPath: readonly string[];
  organizationName?: string;
  capabilities: readonly string[];
  status: "active" | "inactive";
}
