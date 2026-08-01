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
      ? createFormalRoute("production", "tasks")
      : item.domain === "market"
        ? createFormalRoute("market", "tasks")
        : item.domain === "supply"
          ? createFormalRoute("supply", "calculation")
          : createFormalRoute("reporting", "review-distribution");
  return { route, selection: { type: "work-item", id: item.workId } };
}

function actionLabelFor(item: BusinessWorkItem): string {
  if (item.domain === "supply") return "复核供需说明";
  if (item.domain === "reporting") return "审核并分发报告";
  if (item.domain === "production") return "处理产情单据";
  return "处理市场任务";
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

export function projectMyWork(
  items: readonly BusinessWorkItem[],
  query: MyWorkProjectionQuery,
): readonly BusinessWorkProjection[] {
  return items
    .filter(
      (item) =>
        (item.responsibleUserId === query.userId ||
          item.reviewerUserId === query.userId) &&
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
  if (!query.queryAllowed) return false;
  if (!scope.authorization.permissionKeys.includes("prototype:read"))
    return false;
  if (item.domain !== query.domain) return false;
  if (
    scope.coordinates.businessDomainId &&
    scope.coordinates.businessDomainId !== item.domain
  )
    return false;
  if (
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
    !scope.authorization.authorizedRegionIds.includes(
      item.regionId as OperationalScope["authorization"]["authorizedRegionIds"][number],
    )
  )
    return false;
  if (
    item.productId !== null &&
    !scope.authorization.authorizedProductIds.includes(item.productId)
  )
    return false;
  if (
    scope.coordinates.productId &&
    item.productId !== scope.coordinates.productId
  )
    return false;
  if (
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
