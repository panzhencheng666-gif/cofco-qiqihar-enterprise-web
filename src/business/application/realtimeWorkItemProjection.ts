import type { BusinessWorkItem } from "../core/businessWork";
import type {
  MasterPeriod,
  MasterProduct,
  MasterRegion,
  WorkItemRow,
} from "@/platform/api/realtimeBusinessRepository";

function businessClassificationLabel(
  row: WorkItemRow,
  domain: BusinessWorkItem["domain"],
): string {
  if (
    row.domain.toUpperCase() === "LOGISTICS" ||
    row.sourceType?.toUpperCase() === "LOGISTICS"
  ) {
    return "物流监测";
  }
  if (domain === "production") return "种植生产";
  if (domain === "market") return "报价与交易";
  if (domain === "supply") return "供需核算";
  return "综合报告";
}

function domainOf(row: WorkItemRow): BusinessWorkItem["domain"] {
  if (row.domain === "MARKET") return "market";
  if (row.domain === "LOGISTICS") return "market";
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

function productLabel(
  product: string,
  products: readonly MasterProduct[],
): string {
  const normalized = product.trim();
  const found = products.find(
    (candidate) =>
      candidate.code === normalized || candidate.name === normalized,
  );
  return found?.name ?? normalized;
}

function hasInternalIdentifier(
  value: string,
  sourceId: string | null,
): boolean {
  const normalized = value.trim();
  if (!normalized) return false;
  if (sourceId && normalized.includes(sourceId)) return true;
  return /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(
    normalized,
  );
}

function readableTaskName(
  row: WorkItemRow,
  domain: BusinessWorkItem["domain"],
  displayProduct: string,
): string {
  if (!hasInternalIdentifier(row.task, row.sourceId)) return row.task.trim();
  const productPrefix = displayProduct ? `${displayProduct}` : "";
  const businessLabel = businessClassificationLabel(row, domain);
  const workflowSuffix = row.workflowNode.trim()
    ? `${row.workflowNode.trim()}任务`
    : "待处理任务";
  return `${productPrefix}${businessLabel}${workflowSuffix}`;
}

function readableSubjectName(
  row: WorkItemRow,
  domain: BusinessWorkItem["domain"],
  displayProduct: string,
): string {
  const parts = [
    row.region.trim(),
    displayProduct,
    businessClassificationLabel(row, domain),
  ];
  return `${parts.filter(Boolean).join(" · ")}业务记录`;
}

function periodLabel(
  row: WorkItemRow,
  periods: readonly MasterPeriod[],
): string {
  const periodCode = row.businessPeriodCode ?? row.businessPeriod;
  return (
    periods.find(
      (candidate) =>
        candidate.code === periodCode || candidate.name === row.businessPeriod,
    )?.name ?? row.businessPeriod
  ).trim();
}

function regionLabel(
  row: WorkItemRow,
  regions: readonly MasterRegion[],
): string {
  return (
    regions.find((candidate) => candidate.code === row.regionCode)?.name ??
    row.region
  ).trim();
}

export function projectRealtimeWorkItem(
  row: WorkItemRow,
  products: readonly MasterProduct[],
  periods: readonly MasterPeriod[] = [],
  regions: readonly MasterRegion[] = [],
): BusinessWorkItem {
  const domain = domainOf(row);
  const status = statusOf(row);
  const now = new Date().toISOString();
  const displayProduct = productLabel(row.product, products);
  const displayTask = readableTaskName(row, domain, displayProduct);
  const logistics =
    row.domain.toUpperCase() === "LOGISTICS" ||
    row.sourceType?.toUpperCase() === "LOGISTICS";
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
    title: displayTask,
    domain,
    businessSubtypeId: subtype,
    businessLabel: businessClassificationLabel(row, domain),
    subject: {
      kind: "monitoring-object",
      objectId: row.sourceId ?? row.id,
      objectName: hasInternalIdentifier(row.task, row.sourceId)
        ? readableSubjectName(row, domain, displayProduct)
        : displayTask,
      objectTypeId: (row.sourceType ?? row.workflowNode) || "BUSINESS_RECORD",
    },
    regionId: row.regionCode,
    regionLabel: regionLabel(row, regions),
    productId: productId(row.product, products),
    productLabel: displayProduct,
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
    effectivePeriod: periodLabel(row, periods),
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
  periods: readonly MasterPeriod[] = [],
  regions: readonly MasterRegion[] = [],
): readonly BusinessWorkItem[] {
  return rows.map((row) =>
    projectRealtimeWorkItem(row, products, periods, regions),
  );
}

export function realtimeWorkItemScope(
  section: string,
): "PENDING" | "COMPLETED" {
  return section === "completed" ? "COMPLETED" : "PENDING";
}
