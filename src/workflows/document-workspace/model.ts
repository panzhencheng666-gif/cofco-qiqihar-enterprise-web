import type {
  DocumentState,
  QualitySummary,
} from "@/domains/review-release/model";
import type { MonitoringDomain } from "@/workflows/task-inbox/model";

export type DocumentMode = "edit" | "read" | "review";

declare const fixedDecimalBrand: unique symbol;

export type FixedDecimal = string & {
  readonly [fixedDecimalBrand]: "FixedDecimal";
};

export function fixedDecimal(input: unknown): FixedDecimal {
  if (
    typeof input !== "string" ||
    !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(input)
  ) {
    throw new TypeError("字段值必须是规范十进制定点字符串");
  }
  return input as FixedDecimal;
}

export type DocumentFieldValue =
  | { status: "reported"; amount: FixedDecimal }
  | { status: "not-reported" }
  | { status: "not-applicable"; reason: string }
  | { status: "unavailable"; reason: string }
  | { status: "collection-failed"; reason: string }
  | { status: "estimated"; amount: FixedDecimal; method: string }
  | { status: "imputed"; amount: FixedDecimal; method: string }
  | { status: "approved-adjustment"; amount: FixedDecimal; reason: string };

export interface FieldValueDisplay {
  text: string;
  statusLabel: string;
  hasAmount: boolean;
}

export function fieldValueDisplay(
  value: DocumentFieldValue,
): FieldValueDisplay {
  switch (value.status) {
    case "reported":
      return { text: value.amount, statusLabel: "已填报", hasAmount: true };
    case "not-reported":
      return { text: "未填报", statusLabel: "未填报", hasAmount: false };
    case "not-applicable":
      return { text: "不适用", statusLabel: "不适用", hasAmount: false };
    case "unavailable":
      return { text: "暂不可得", statusLabel: "暂不可得", hasAmount: false };
    case "collection-failed":
      return { text: "采集失败", statusLabel: "采集失败", hasAmount: false };
    case "estimated":
      return { text: value.amount, statusLabel: "估算值", hasAmount: true };
    case "imputed":
      return { text: value.amount, statusLabel: "插补值", hasAmount: true };
    case "approved-adjustment":
      return { text: value.amount, statusLabel: "审核调整", hasAmount: true };
  }
}

export interface DocumentField {
  code: string;
  label: string;
  value: DocumentFieldValue;
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
