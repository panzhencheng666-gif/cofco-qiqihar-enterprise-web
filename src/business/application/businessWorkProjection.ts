import type { BusinessWorkItem } from "../core/businessWork";
import type { OperationalScope } from "../core/operationalScope";
import {
  createFormalRoute,
  type FormalRoute,
  type FormalSelection,
} from "../formalEnterpriseModel";

export interface BusinessWorkProjection {
  item: BusinessWorkItem;
  destination: {
    route: FormalRoute;
    selection: FormalSelection;
  };
  actionLabel: string;
  savedViewGroup: "待填报" | "待审核" | "异常逾期" | "待发布" | "已办";
}

export interface MyWorkProjectionQuery {
  userId: string;
  scope: OperationalScope;
  queryAllowed: boolean;
  availablePeriodKeys: readonly string[];
}

export interface DomainTaskProjectionQuery {
  domain: BusinessWorkItem["domain"];
  scope: OperationalScope;
  queryAllowed: boolean;
  availablePeriodKeys: readonly string[];
  workId?: string;
}

function destinationFor(
  item: BusinessWorkItem,
): BusinessWorkProjection["destination"] {
  const route: FormalRoute =
    item.domain === "production"
      ? createFormalRoute("production", "corn-collection")
      : item.domain === "market"
        ? createFormalRoute("market", "corn-collection")
        : item.domain === "supply"
          ? createFormalRoute("supply", "calculation")
          : createFormalRoute("market", "corn-collection");
  return { route, selection: { type: "work-item", id: item.workId } };
}

function actionLabelFor(item: BusinessWorkItem): string {
  if (item.domain === "supply") return "复核供需说明";
  if (item.domain === "reporting") return "审核并分发报告";
  const pendingReview =
    item.documentStatus === "submitted" &&
    (item.reviewStatus === "pending" || item.reviewStatus === "reviewing");
  if (item.domain === "production") {
    if (pendingReview) return "审核产情单据";
    return item.documentStatus === "returned" ? "补充产情填报" : "继续产情填报";
  }
  if (item.businessSubtypeId === "market.logistics") {
    if (pendingReview) return "审核物流单据";
    return item.documentStatus === "returned" ? "补充物流填报" : "继续物流填报";
  }
  if (pendingReview) return "审核市场单据";
  return item.documentStatus === "returned" ? "补充市场填报" : "继续市场填报";
}

function savedViewGroupFor(
  item: BusinessWorkItem,
): BusinessWorkProjection["savedViewGroup"] {
  if (
    item.obligationStatus === "missed" ||
    item.obligationStatus === "overdue-completed" ||
    item.documentStatus === "returned" ||
    item.reviewStatus === "returned" ||
    item.qualityStatus === "blocking"
  )
    return "异常逾期";
  if (item.releaseStatus === "pending") return "待发布";
  if (item.reviewStatus === "pending" || item.reviewStatus === "reviewing")
    return "待审核";
  if (
    item.documentStatus === "draft" ||
    item.obligationStatus === "not-due" ||
    item.obligationStatus === "in-progress"
  )
    return "待填报";
  return "已办";
}

function project(item: BusinessWorkItem): BusinessWorkProjection {
  return {
    item,
    destination: destinationFor(item),
    actionLabel: actionLabelFor(item),
    savedViewGroup: savedViewGroupFor(item),
  };
}

type WorkAssignmentNode = "responsible" | "reviewer" | "publisher" | "history";

function assignmentNodeFor(item: BusinessWorkItem): WorkAssignmentNode {
  if (item.releaseStatus === "pending") return "publisher";
  if (
    item.releaseStatus === "published" ||
    item.releaseStatus === "superseded"
  ) {
    return "history";
  }
  if (
    item.documentStatus === "returned" ||
    item.reviewStatus === "returned" ||
    item.qualityStatus === "blocking"
  ) {
    return "responsible";
  }
  if (item.qualityStatus === "awaiting-explanation") {
    const latestQualityAction = item.qualityHistory.at(-1)?.action;
    return latestQualityAction === "explanation-submitted"
      ? "reviewer"
      : "responsible";
  }
  if (
    (item.reviewStatus === "pending" || item.reviewStatus === "reviewing") &&
    (item.documentStatus === "submitted" || item.documentStatus === "corrected")
  ) {
    return "reviewer";
  }
  return "responsible";
}

function itemIsAssignedAtCurrentNode(
  item: BusinessWorkItem,
  userId: string,
): boolean {
  const node = assignmentNodeFor(item);
  if (node === "responsible") return item.responsibleUserId === userId;
  if (node === "reviewer") return item.reviewerUserId === userId;
  if (node === "history") {
    return item.responsibleUserId === userId || item.reviewerUserId === userId;
  }
  // 发布岗目前没有治理到 BusinessWorkItem 的人员指派字段。不能把待发布
  // 事项继续投给已经办结审核的审核人，也不能猜测一个发布责任人。
  return false;
}

export function projectMyWork(
  items: readonly BusinessWorkItem[],
  query: MyWorkProjectionQuery,
): readonly BusinessWorkProjection[] {
  return items
    .filter(
      (item) =>
        (query.scope.authorization.serverAuthoritative === true ||
          itemIsAssignedAtCurrentNode(item, query.userId)) &&
        itemIsAuthorized(item, {
          domain: item.domain,
          scope: query.scope,
          queryAllowed: query.queryAllowed,
          availablePeriodKeys: query.availablePeriodKeys,
        }),
    )
    .map(project);
}

function itemIsAuthorized(
  item: BusinessWorkItem,
  query: DomainTaskProjectionQuery,
): boolean {
  const { scope } = query;
  const serverAuthoritative = scope.authorization.serverAuthoritative === true;
  const governedProductId =
    item.productId ??
    (item.subject.kind === "supply-account" &&
    item.subject.productAccountId === "PRODUCT-ACCOUNT-CORN-2026"
      ? "corn"
      : null);
  if (!query.queryAllowed) return false;
  if (
    !serverAuthoritative &&
    !scope.authorization.permissionKeys.includes("enterprise:fixtures:read")
  )
    return false;
  if (item.domain !== query.domain) return false;
  if (
    scope.coordinates.businessDomainId &&
    scope.coordinates.businessDomainId !== item.domain
  )
    return false;
  if (
    !serverAuthoritative &&
    !scope.authorization.authorizedBusinessClassificationIds.includes(
      item.businessSubtypeId,
    )
  )
    return false;
  const subtype = scope.coordinates.businessSubtypeId;
  if (
    subtype &&
    item.businessSubtypeId !== subtype &&
    !item.businessSubtypeId.endsWith(`.${subtype}`)
  )
    return false;
  if (
    scope.coordinates.regionId !== "authorized-all" &&
    scope.coordinates.regionId !== item.regionId
  )
    return false;
  if (
    !serverAuthoritative &&
    !scope.authorization.authorizedRegionIds.includes(
      item.regionId as OperationalScope["authorization"]["authorizedRegionIds"][number],
    )
  )
    return false;
  if (
    !serverAuthoritative &&
    governedProductId !== null &&
    !scope.authorization.authorizedProductIds.includes(governedProductId)
  )
    return false;
  if (
    scope.coordinates.productId &&
    governedProductId !== scope.coordinates.productId
  )
    return false;
  if (
    !serverAuthoritative &&
    item.cultivarIds.some(
      (cultivarId) =>
        !scope.authorization.authorizedCultivarIds.includes(cultivarId),
    )
  )
    return false;
  if (
    scope.coordinates.cultivarId &&
    !item.cultivarIds.includes(scope.coordinates.cultivarId)
  )
    return false;
  if (!query.availablePeriodKeys.includes(item.periodKey)) return false;
  if (
    scope.coordinates.periodKey &&
    scope.coordinates.periodKey !== item.periodKey
  )
    return false;
  if (query.workId && query.workId !== item.workId) return false;
  return true;
}

export function projectDomainTasks(
  items: readonly BusinessWorkItem[],
  query: DomainTaskProjectionQuery,
): readonly BusinessWorkProjection[] {
  return items.filter((item) => itemIsAuthorized(item, query)).map(project);
}
