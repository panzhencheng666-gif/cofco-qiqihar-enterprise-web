import type { BusinessWorkItem } from "./core/businessWork";
import type { MonitoringObject } from "./core/monitoringRegistry";
import { businessWorkFixtures } from "./data/businessWorkFixtures";
import {
  marketMonitoringObjects,
  productionMonitoringObjects,
} from "./data/monitoringRegistryFixtures";
import type { MarketDocumentDraft } from "./market/MarketDocumentWorkbench";
import type { ProductionDocumentDraft } from "./production/ProductionDocumentWorkbench";

export const prototypeOperationalStateStorageKey =
  "齐齐哈尔粮食商情业务工作状态-第一版";

export interface PrototypeOperationalStateStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface PrototypeOperationalState {
  workItems: readonly BusinessWorkItem[];
  marketDocumentDrafts: Readonly<Record<string, MarketDocumentDraft>>;
  productionDocumentDrafts: Readonly<Record<string, ProductionDocumentDraft>>;
  marketRegistryObjects: readonly MonitoringObject[];
  productionRegistryObjects: readonly MonitoringObject[];
}

export interface PrototypeOperationalStateLoadResult {
  status: "empty" | "loaded" | "blocked";
  state: PrototypeOperationalState;
  message?: string;
}

export type PrototypeOperationalStateSaveResult =
  { status: "saved" } | { status: "blocked"; message: string };

interface StoredPrototypeOperationalState {
  schemaVersion: 1;
  savedAt: string;
  state: PrototypeOperationalState;
}

const businessDomains = ["production", "market", "supply", "reporting"];
const obligationStatuses = [
  "not-due",
  "in-progress",
  "on-time",
  "overdue-completed",
  "missed",
  "exempt",
];
const documentStatuses = ["draft", "submitted", "returned", "corrected"];
const reviewStatuses = ["pending", "reviewing", "approved", "returned"];
const qualityStatuses = [
  "passed",
  "warning",
  "blocking",
  "awaiting-explanation",
];
const releaseStatuses = ["unreleased", "pending", "published", "superseded"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === "string")
  );
}

function hasStringFields(
  value: Record<string, unknown>,
  fields: readonly string[],
): boolean {
  return fields.every((field) => typeof value[field] === "string");
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function isDraft(value: unknown): value is MarketDocumentDraft {
  if (!isRecord(value) || !isRecord(value.values)) return false;
  return (
    Object.values(value.values).every((entry) => typeof entry === "string") &&
    isStringArray(value.confirmedFieldKeys)
  );
}

function isDraftRecord(
  value: unknown,
): value is Readonly<Record<string, MarketDocumentDraft>> {
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([workId, draft]) => workId.length > 0 && isDraft(draft),
    )
  );
}

function isAuditArray(
  value: unknown,
  requiredStringFields: readonly string[],
): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isRecord(entry) && hasStringFields(entry, requiredStringFields),
    )
  );
}

function isBusinessWorkItem(value: unknown): value is BusinessWorkItem {
  if (!isRecord(value)) return false;
  if (
    !hasStringFields(value, [
      "workId",
      "title",
      "domain",
      "businessSubtypeId",
      "businessLabel",
      "regionId",
      "regionLabel",
      "periodKey",
      "deadline",
      "responsibleUserId",
      "responsiblePerson",
      "responsiblePost",
      "dutyLabel",
      "reviewerUserId",
      "reviewer",
      "responsibilityId",
      "frequency",
      "deadlineRule",
      "effectivePeriod",
      "obligationStatus",
      "documentStatus",
      "reviewStatus",
      "qualityStatus",
      "releaseStatus",
      "inputVersionState",
    ]) ||
    !businessDomains.includes(value.domain as string) ||
    !obligationStatuses.includes(value.obligationStatus as string) ||
    !documentStatuses.includes(value.documentStatus as string) ||
    !reviewStatuses.includes(value.reviewStatus as string) ||
    !qualityStatuses.includes(value.qualityStatus as string) ||
    !releaseStatuses.includes(value.releaseStatus as string) ||
    !isNullableString(value.productId) ||
    !isStringArray(value.cultivarIds) ||
    !isStringArray(value.collectionModes) ||
    !isStringArray(value.fieldGroupIds) ||
    typeof value.completedFields !== "number" ||
    typeof value.applicableFields !== "number" ||
    !isRecord(value.subject) ||
    typeof value.subject.kind !== "string" ||
    !isRecord(value.qualityGovernance) ||
    typeof value.qualityGovernance.ruleVersionId !== "string" ||
    typeof value.qualityGovernance.warningPublicationPolicy !== "string" ||
    !isStringArray(value.qualityGovernance.approvedExplanationVersionIds)
  ) {
    return false;
  }
  const subject = value.subject;
  const subjectIsValid =
    (subject.kind === "monitoring-object" &&
      hasStringFields(subject, ["objectId", "objectName", "objectTypeId"])) ||
    (subject.kind === "supply-account" &&
      hasStringFields(subject, [
        "productAccountId",
        "accountVersionId",
        "accountLabel",
      ])) ||
    (subject.kind === "report-run" &&
      hasStringFields(subject, ["runId", "reportTypeId", "reportLabel"]));
  return (
    subjectIsValid &&
    isAuditArray(value.obligationHistory, [
      "obligationEventId",
      "action",
      "actor",
      "at",
    ]) &&
    isAuditArray(value.submissionHistory, [
      "submissionVersionId",
      "submittedBy",
      "submittedAt",
      "kind",
    ]) &&
    isAuditArray(value.reviewHistory, [
      "reviewEventId",
      "submissionVersionId",
      "action",
      "reviewer",
      "at",
    ]) &&
    isAuditArray(value.qualityHistory, [
      "qualityEventId",
      "action",
      "ruleVersionId",
      "result",
      "actor",
      "actorRoleId",
      "at",
    ]) &&
    isAuditArray(value.releaseHistory, [
      "releaseEventId",
      "action",
      "releaseVersionId",
      "actor",
      "at",
    ])
  );
}

function isMonitoringObject(value: unknown): value is MonitoringObject {
  if (!isRecord(value)) return false;
  return (
    hasStringFields(value, [
      "objectId",
      "objectName",
      "objectTypeId",
      "objectTypeLabel",
      "regionId",
      "regionLabel",
      "sourceChannelId",
      "sourceChannelLabel",
      "responsibleUserId",
      "responsiblePerson",
      "effectiveFrom",
      "validityStatus",
    ]) &&
    isNullableString(value.effectiveTo) &&
    isStringArray(value.productIds) &&
    isStringArray(value.productLabels) &&
    isStringArray(value.cultivarIds) &&
    isStringArray(value.cultivarLabels) &&
    Array.isArray(value.roles) &&
    value.roles.every(
      (role) =>
        isRecord(role) &&
        hasStringFields(role, [
          "roleId",
          "label",
          "effectiveFrom",
          "capabilityTemplateVersionId",
        ]) &&
        isNullableString(role.effectiveTo),
    )
  );
}

function isOperationalState(
  value: unknown,
): value is PrototypeOperationalState {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.workItems) &&
    value.workItems.every(isBusinessWorkItem) &&
    isDraftRecord(value.marketDocumentDrafts) &&
    isDraftRecord(value.productionDocumentDrafts) &&
    Array.isArray(value.marketRegistryObjects) &&
    value.marketRegistryObjects.every(isMonitoringObject) &&
    Array.isArray(value.productionRegistryObjects) &&
    value.productionRegistryObjects.every(isMonitoringObject)
  );
}

export function createDefaultPrototypeOperationalState(): PrototypeOperationalState {
  return {
    workItems: [...businessWorkFixtures],
    marketDocumentDrafts: {},
    productionDocumentDrafts: {},
    marketRegistryObjects: [...marketMonitoringObjects],
    productionRegistryObjects: [...productionMonitoringObjects],
  };
}

/**
 * The API-backed runtime starts empty until the server returns real work.
 * Keeping this separate from the demo fixture state prevents a failed or empty
 * database query from being presented as business truth.
 */
export function createEmptyPrototypeOperationalState(): PrototypeOperationalState {
  return {
    workItems: [],
    marketDocumentDrafts: {},
    productionDocumentDrafts: {},
    marketRegistryObjects: [],
    productionRegistryObjects: [],
  };
}

export function loadPrototypeOperationalState(
  storage: PrototypeOperationalStateStorage | undefined,
): PrototypeOperationalStateLoadResult {
  const fallback = createDefaultPrototypeOperationalState();
  if (!storage) return { status: "empty", state: fallback };
  let raw: string | null;
  try {
    raw = storage.getItem(prototypeOperationalStateStorageKey);
  } catch {
    return {
      status: "blocked",
      state: fallback,
      message: "业务工作状态无法读取，原始数据已保留且未被覆盖。",
    };
  }
  if (raw === null) return { status: "empty", state: fallback };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      !isRecord(parsed) ||
      parsed.schemaVersion !== 1 ||
      typeof parsed.savedAt !== "string" ||
      !isOperationalState(parsed.state)
    ) {
      throw new Error("invalid operational state");
    }
    return { status: "loaded", state: parsed.state };
  } catch {
    return {
      status: "blocked",
      state: fallback,
      message: "业务工作状态无法读取，原始数据已保留且未被覆盖。",
    };
  }
}

export function savePrototypeOperationalState(
  storage: PrototypeOperationalStateStorage | undefined,
  state: PrototypeOperationalState,
): PrototypeOperationalStateSaveResult {
  if (!storage) return { status: "saved" };
  const stored: StoredPrototypeOperationalState = {
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    state,
  };
  try {
    storage.setItem(
      prototypeOperationalStateStorageKey,
      JSON.stringify(stored),
    );
    return { status: "saved" };
  } catch {
    return {
      status: "blocked",
      message: "业务工作状态保存失败，本次变更仍保留在当前页面。",
    };
  }
}
