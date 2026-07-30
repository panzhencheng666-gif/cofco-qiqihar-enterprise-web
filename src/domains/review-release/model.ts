export type DocumentState =
  | "DRAFT"
  | "SUBMITTED"
  | "VALIDATING"
  | "PRIMARY_REVIEW"
  | "FINAL_REVIEW"
  | "RELEASE_CANDIDATE"
  | "PUBLISHED"
  | "SUPERSEDED";

export interface QualitySummary {
  blocking: number;
  warning: number;
  passed: number;
}
