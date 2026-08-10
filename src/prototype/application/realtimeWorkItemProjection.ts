import type { BusinessWorkItem } from "../core/businessWork";
import type {
  MasterProduct,
  WorkItemRow,
} from "@/platform/api/realtimeBusinessRepository";

function domainOf(row: WorkItemRow): BusinessWorkItem["domain"] {
  if (row.domain === "MARKET") return "market";
  if (row.domain === "SUPPLY") return "supply";
  if (row.domain === "REPORTING") return "reporting";
  return "production";
}

function statusOf(
  row: WorkItemRow,
): Pick<
  BusinessWorkItem,
  | "documentStatus"
  | "reviewStatus"
  | "obligationStatus"
  | "qualityStatus"
  | "releaseStatus"
> {
  const status = (row.statusCode ?? row.status ?? "APPROVED").toUpperCase();
  const draft = status === "DRAFT" || status === "TO_FILL";
  const returned = status === "RETURNED";
  const approved = status === "APPROVED";
  const overdue =
    row.dueAt !== null &&
    Number.isFinite(Date.parse(row.dueAt)) &&
    Date.parse(row.dueAt) < Date.now();
  const reviewStatus = approved
    ? "approved"
    : returned
      ? "returned"
      : "pending";
  const documentStatus = draft ? "draft" : returned ? "returned" : "submitted";
  return {
    documentStatus,
    reviewStatus,
    obligationStatus:
      (draft || returned) && overdue
        ? "missed"
        : draft
          ? "in-progress"
          : "on-time",
    qualityStatus: "passed",
    releaseStatus: approved ? "published" : "pending",
  };
}

function productId(
  product: string,
  products: readonly MasterProduct[],
): string | null {
  const normalized = product.trim();
  const found = products.find(
    (candidate) =>
      candidate.code === normalized || candidate.name === normalized,
  );
  if (!found) return normalized.length > 0 ? normalized.toLowerCase() : null;
  return found.code.toLowerCase();
}

export function projectRealtimeWorkItem(
  row: WorkItemRow,
  products: readonly MasterProduct[],
): BusinessWorkItem {
  const domain = domainOf(row);
  const status = statusOf(row);
  const now = new Date().toISOString();
  const logistics = row.sourceType?.toUpperCase() === "LOGISTICS";
  const subtype = logistics
    ? "market.logistics"
    : domain === "production"
      ? "production.planting-production"
      : domain === "market"
        ? "market.quote-trade"
        : domain === "supply"
          ? "supply.supply"
          : "reporting.cross-business";
  return {
    workId: row.id,
    title: row.task,
    domain,
    businessSubtypeId: subtype,
    businessLabel: row.workflowNode || row.domain,
    subject: {
      kind: "monitoring-object",
      objectId: row.sourceId ?? row.id,
      objectName: row.task,
      objectTypeId: (row.sourceType ?? row.workflowNode) || "BUSINESS_RECORD",
    },
    regionId: row.regionCode,
    regionLabel: row.region,
    productId: productId(row.product, products),
    cultivarIds: [],
    periodKey: row.businessPeriodCode ?? row.businessPeriod,
    deadline: row.dueAt ?? "未设置截止时间",
    responsibleUserId: row.responsiblePartyCode,
    responsiblePerson: row.responsibleParty,
    responsiblePost: "业务工作流责任人",
    dutyLabel: "系统工作项",
    reviewerUserId: "",
    reviewer: "待分配审核人",
    responsibilityId: row.id,
    frequency: "按业务期间",
    deadlineRule: "由业务期间配置",
    effectivePeriod: row.businessPeriod,
    ...status,
    completedFields: 0,
    applicableFields: 0,
    collectionModes: ["online"],
    fieldGroupIds: [],
    inputVersionState: "current",
    qualityGovernance: {
      ruleVersionId: "backend",
      warningPublicationPolicy: "block",
      approvedExplanationVersionIds: [],
    },
    obligationHistory: [
      {
        obligationEventId: `${row.id}:created`,
        action: "started",
        actor: row.responsibleParty,
        at: now,
        reason: null,
      },
    ],
    submissionHistory: [],
    reviewHistory: [],
    qualityHistory: [],
    releaseHistory: [],
  };
}

export function projectRealtimeWorkItems(
  rows: readonly WorkItemRow[],
  products: readonly MasterProduct[],
): readonly BusinessWorkItem[] {
  return rows.map((row) => projectRealtimeWorkItem(row, products));
}
