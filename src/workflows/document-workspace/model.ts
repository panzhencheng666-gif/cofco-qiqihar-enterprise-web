import type {
  DocumentState,
  QualitySummary,
} from "@/domains/review-release/model";
import type { MonitoringDomain } from "@/workflows/task-inbox/model";

export type DocumentMode = "edit" | "read" | "review";

export interface DocumentField {
  code: string;
  label: string;
  value: string | number | null;
  unit?: string;
  quality: "passed" | "warning" | "blocking" | "not-reported";
}

export interface DocumentSection {
  id: string;
  title: string;
  fields: readonly DocumentField[];
}

export interface BusinessDocument {
  id: string;
  objectId: string;
  domain: MonitoringDomain;
  commodity: "玉米" | "大豆" | "稻谷";
  reportingPeriod: string;
  formVersion: string;
  revision: number;
  state: DocumentState;
  quality: QualitySummary;
  sections: readonly DocumentSection[];
}
