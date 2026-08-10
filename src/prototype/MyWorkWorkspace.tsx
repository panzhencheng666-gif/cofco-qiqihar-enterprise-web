import { useMemo, useState } from "react";

import {
  projectMyWork,
  type BusinessWorkProjection,
} from "./application/businessWorkProjection";
import type { BusinessWorkItem } from "./core/businessWork";
import { businessClassifications } from "./core/businessClassification";
import type { OperationalScope } from "./core/operationalScope";
import { platformProducts } from "./core/platformMasterData";
import { businessWorkFixtures } from "./data/businessWorkFixtures";
import { getEnterpriseScopeRegion } from "./enterpriseRegions";
import type {
  BusinessCoordinates,
  FormalRoute,
  FormalSelection,
  WorkSection,
} from "./formalEnterpriseModel";
import {
  formatProductionDateTime,
  governedProductionName,
  productionCultivarNames,
  productionPeriodNames,
} from "./productionMonitoringModel";
import {
  FormalWorkspaceScopeProvider,
  WorkspaceHeader,
  WorkspacePagination,
} from "./UnifiedWorkspacePrimitives";

const myWorkViews: Readonly<
  Record<
    WorkSection,
    {
      label: string;
      groups: readonly BusinessWorkProjection["savedViewGroup"][];
    }
  >
> = {
  tasks: {
    label: "待我处理",
    groups: ["待填报", "待审核", "异常逾期", "待发布"],
  },
  submitted: { label: "待我填报", groups: ["待填报"] },
  review: { label: "待我审核", groups: ["待审核"] },
  exceptions: { label: "退回与异常", groups: ["异常逾期"] },
  completed: { label: "已办事项", groups: ["已办"] },
  obligations: {
    label: "填报履职周报",
    groups: ["待填报", "待审核", "异常逾期", "待发布", "已办"],
  },
};

const domainLabels: Readonly<Record<BusinessWorkItem["domain"], string>> = {
  production: "产情监测",
  market: "市场监测",
  supply: "供需核算",
  reporting: "报告中心",
};

const obligationLabels: Readonly<
  Record<BusinessWorkItem["obligationStatus"], string>
> = {
  "not-due": "未到期",
  "in-progress": "进行中",
  "on-time": "按时完成",
  "overdue-completed": "逾期补填",
  missed: "截止未提交",
  exempt: "免报",
};

const documentLabels: Readonly<
  Record<BusinessWorkItem["documentStatus"], string>
> = {
  draft: "草稿",
  submitted: "已提交",
  returned: "已退回",
  corrected: "已更正",
};

const reviewLabels: Readonly<Record<BusinessWorkItem["reviewStatus"], string>> =
  {
    pending: "待审核",
    reviewing: "审核中",
    approved: "审核通过",
    returned: "审核退回",
  };

const qualityLabels: Readonly<
  Record<BusinessWorkItem["qualityStatus"], string>
> = {
  passed: "质量通过",
  warning: "质量警告",
  blocking: "质量阻断",
  "awaiting-explanation": "等待说明",
};

const releaseLabels: Readonly<
  Record<BusinessWorkItem["releaseStatus"], string>
> = {
  unreleased: "未发布",
  pending: "待发布",
  published: "已发布",
  superseded: "已由新批次替代",
};

function governedPeriodName(item: BusinessWorkItem): string {
  const taskPeriod = governedProductionName(
    productionPeriodNames,
    item.periodKey,
    "",
  );
  if (taskPeriod) return taskPeriod;
  return item.frequency === "按年度"
    ? item.effectivePeriod || "任务期间名称待维护"
    : "任务期间名称待维护";
}

function governedSubjectName(item: BusinessWorkItem): string {
  if (item.subject.kind === "monitoring-object") {
    return item.subject.objectName || "监测对象名称待维护";
  }
  if (item.subject.kind === "supply-account") {
    return item.subject.accountLabel || "产品账户名称待维护";
  }
  return item.subject.reportLabel || "报告名称待维护";
}

function governedProductName(item: BusinessWorkItem): string {
  if (item.productId) {
    return (
      platformProducts.find(({ id }) => id === item.productId)?.label ??
      "产品名称待维护"
    );
  }
  if (item.subject.kind === "supply-account") return "按产品账户";
  if (item.subject.kind === "report-run") return "按报告范围";
  return "未指定产品";
}

function governedCultivarNames(item: BusinessWorkItem): string {
  if (item.cultivarIds.length === 0) return "";
  return item.cultivarIds
    .map((id) =>
      governedProductionName(productionCultivarNames, id, "品种名称待维护"),
    )
    .join("、");
}

function stateTone(label: string): string {
  if (
    label.includes("阻断") ||
    label.includes("截止") ||
    label.includes("逾期") ||
    label.includes("退回")
  ) {
    return "is-danger";
  }
  if (
    label.includes("待") ||
    label.includes("警告") ||
    label.includes("进行") ||
    label.includes("审核中")
  ) {
    return "is-warning";
  }
  if (label.includes("通过") || label.includes("完成") || label === "已发布") {
    return "is-good";
  }
  return "";
}

function currentProcessingNode(item: BusinessWorkItem): string {
  if (
    item.qualityStatus === "blocking" ||
    item.qualityStatus === "awaiting-explanation"
  ) {
    return qualityLabels[item.qualityStatus];
  }
  if (item.reviewStatus === "returned") return reviewLabels.returned;
  if (item.documentStatus === "returned") return documentLabels.returned;
  if (
    item.obligationStatus === "missed" ||
    item.obligationStatus === "overdue-completed"
  ) {
    return obligationLabels[item.obligationStatus];
  }
  if (item.reviewStatus === "pending" || item.reviewStatus === "reviewing") {
    return reviewLabels[item.reviewStatus];
  }
  if (item.documentStatus === "draft") return documentLabels.draft;
  if (
    item.obligationStatus === "not-due" ||
    item.obligationStatus === "in-progress"
  ) {
    return obligationLabels[item.obligationStatus];
  }
  if (item.releaseStatus === "pending" || item.releaseStatus === "unreleased") {
    return releaseLabels[item.releaseStatus];
  }
  if (
    item.releaseStatus === "published" ||
    item.releaseStatus === "superseded"
  ) {
    return releaseLabels[item.releaseStatus];
  }
  return "当前处理节点待确认";
}

function hasAuthorizedClassification(
  scope: OperationalScope,
  classificationId: string,
): boolean {
  return scope.authorization.authorizedBusinessClassificationIds.some(
    (authorizedId) =>
      authorizedId === classificationId ||
      authorizedId.endsWith(`.${classificationId}`),
  );
}

function scopeAllowsQuery(
  scope: OperationalScope,
  availablePeriodKeys: readonly string[],
): boolean {
  const { authorization, coordinates } = scope;
  const serverAuthoritative = authorization.serverAuthoritative === true;
  const domainIds = Object.keys(domainLabels);
  const classificationKnown = coordinates.businessSubtypeId
    ? businessClassifications.some(
        ({ id }) =>
          id === coordinates.businessSubtypeId ||
          id.endsWith(`.${coordinates.businessSubtypeId}`),
      )
    : true;
  return (
    (serverAuthoritative ||
      authorization.permissionKeys.includes("prototype:read")) &&
    (coordinates.regionId === "authorized-all" ||
      serverAuthoritative ||
      authorization.authorizedRegionIds.includes(
        coordinates.regionId as (typeof authorization.authorizedRegionIds)[number],
      )) &&
    (!coordinates.businessDomainId ||
      domainIds.includes(coordinates.businessDomainId)) &&
    classificationKnown &&
    (serverAuthoritative ||
      !coordinates.businessSubtypeId ||
      hasAuthorizedClassification(scope, coordinates.businessSubtypeId)) &&
    (serverAuthoritative ||
      !coordinates.productId ||
      authorization.authorizedProductIds.includes(coordinates.productId)) &&
    (serverAuthoritative ||
      !coordinates.cultivarId ||
      authorization.authorizedCultivarIds.includes(coordinates.cultivarId)) &&
    (!coordinates.periodKey ||
      availablePeriodKeys.includes(coordinates.periodKey)) &&
    (serverAuthoritative ||
      !coordinates.releaseVersion ||
      authorization.authorizedReleaseVersionIds.includes(
        coordinates.releaseVersion,
      ))
  );
}

function workProductOptions(
  workItems: readonly BusinessWorkItem[],
): readonly { id: string; label: string }[] {
  const productIds = new Set(
    workItems
      .filter((item) => item.productId !== null)
      .map((item) => item.productId as string),
  );
  return [...productIds].flatMap((id) => {
    const product = platformProducts.find((item) => item.id === id);
    // The work ledger's “产品或作物” filter is deliberately sourced from
    // current work items.  Non-grain business products are not crops and do
    // not belong in this selector.
    return product?.kind === "粮食作物"
      ? [{ id: product.id, label: product.label }]
      : [];
  });
}

function workPeriodOptions(
  workItems: readonly BusinessWorkItem[],
): readonly { id: string; label: string }[] {
  const options = new Map<string, string>();
  for (const item of workItems) {
    if (!item.periodKey || options.has(item.periodKey)) continue;
    const label = item.effectivePeriod.trim() || governedPeriodName(item);
    options.set(
      item.periodKey,
      label === "任务期间名称待维护" ? item.periodKey : label,
    );
  }
  return [...options].map(([id, label]) => ({ id, label }));
}

function Filters({
  scope,
  onScopeChange,
  productOptions,
  periodOptions,
}: {
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  productOptions: readonly { id: string; label: string }[];
  periodOptions: readonly { id: string; label: string }[];
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const domainOptions = Object.entries(domainLabels).filter(([domain]) =>
    businessClassifications.some(
      ({ id, domain: classificationDomain }) =>
        classificationDomain === domain &&
        scope.authorization.authorizedBusinessClassificationIds.includes(id),
    ),
  );
  const classificationOptions = businessClassifications.filter(
    ({ id, domain }) =>
      scope.authorization.authorizedBusinessClassificationIds.includes(id) &&
      domain !== "operations" &&
      (!scope.coordinates.businessDomainId ||
        domain === scope.coordinates.businessDomainId),
  );
  const selectedClassification = classificationOptions.find(
    ({ id }) =>
      id === scope.coordinates.businessSubtypeId ||
      (scope.coordinates.businessSubtypeId
        ? id.endsWith(`.${scope.coordinates.businessSubtypeId}`)
        : false),
  )?.id;
  const regionOptions = scope.authorization.authorizedRegionIds.map((id) => ({
    id,
    label: getEnterpriseScopeRegion(id)?.label ?? "地区名称待维护",
  }));
  const products = productOptions.filter(({ id }) =>
    scope.authorization.authorizedProductIds.includes(id),
  );
  const periods = periodOptions;
  const domainInvalid =
    scope.coordinates.businessDomainId !== undefined &&
    !domainOptions.some(([id]) => id === scope.coordinates.businessDomainId);
  const classificationInvalid =
    scope.coordinates.businessSubtypeId !== undefined &&
    selectedClassification === undefined;
  const regionInvalid =
    scope.coordinates.regionId !== "authorized-all" &&
    !regionOptions.some(({ id }) => id === scope.coordinates.regionId);
  const productInvalid =
    scope.coordinates.productId !== undefined &&
    !products.some(({ id }) => id === scope.coordinates.productId);
  const activeAdvancedCount = scope.coordinates.businessSubtypeId ? 1 : 0;

  return (
    <section aria-label="我的工作筛选" className="my-work-task5-filter-surface">
      <div className="my-work-task5-filter-grid my-work-task5-filter-grid--primary">
        <label>
          <span>业务域</span>
          <select
            aria-label="业务域"
            value={scope.coordinates.businessDomainId ?? ""}
            onChange={(event) =>
              onScopeChange({
                businessDomainId: event.target.value || undefined,
                businessSubtypeId: undefined,
              })
            }
          >
            <option value="">全部已授权业务域</option>
            {domainInvalid && (
              <option disabled value={scope.coordinates.businessDomainId}>
                业务域无效（请重新选择）
              </option>
            )}
            {domainOptions.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>业务地区</span>
          <select
            aria-label="业务地区"
            value={scope.coordinates.regionId}
            onChange={(event) =>
              onScopeChange({ regionId: event.target.value })
            }
          >
            <option value="authorized-all">全部已授权范围</option>
            {regionInvalid && (
              <option disabled value={scope.coordinates.regionId}>
                业务地区无效（请重新选择）
              </option>
            )}
            {regionOptions.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>产品或作物</span>
          <select
            aria-label="产品或作物"
            value={scope.coordinates.productId ?? ""}
            onChange={(event) =>
              onScopeChange({
                productId: event.target.value || undefined,
                cultivarId: undefined,
              })
            }
          >
            <option value="">全部当前事项作物</option>
            {productInvalid && (
              <option disabled value={scope.coordinates.productId}>
                产品名称无效（请重新选择）
              </option>
            )}
            {products.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>任务期间</span>
          <select
            aria-label="任务期间"
            value={scope.coordinates.periodKey ?? ""}
            onChange={(event) =>
              onScopeChange({ periodKey: event.target.value || undefined })
            }
          >
            <option value="">全部可用期间</option>
            {periods.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
            {scope.coordinates.periodKey &&
              !periods.some(({ id }) => id === scope.coordinates.periodKey) && (
                <option disabled value={scope.coordinates.periodKey}>
                  任务期间无效（请重新选择）
                </option>
              )}
          </select>
        </label>
      </div>
      <div className="my-work-task5-filter-actions">
        <button
          aria-controls="my-work-more-filters"
          aria-expanded={advancedOpen}
          className="my-work-task5-filter-toggle"
          type="button"
          onClick={() => setAdvancedOpen((current) => !current)}
        >
          {activeAdvancedCount > 0
            ? `更多筛选（已启用 ${activeAdvancedCount} 项）`
            : "更多筛选"}
        </button>
      </div>
      {advancedOpen && (
        <div
          className="my-work-task5-filter-grid my-work-task5-filter-grid--advanced"
          id="my-work-more-filters"
        >
          <label>
            <span>业务分类</span>
            <select
              aria-label="业务分类"
              value={
                selectedClassification ??
                scope.coordinates.businessSubtypeId ??
                ""
              }
              onChange={(event) =>
                onScopeChange({
                  businessSubtypeId: event.target.value || undefined,
                })
              }
            >
              <option value="">全部已授权分类</option>
              {classificationInvalid && (
                <option disabled value={scope.coordinates.businessSubtypeId}>
                  业务分类无效（请重新选择）
                </option>
              )}
              {classificationOptions.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </section>
  );
}

export function FormalMyWorkWorkspace({
  section,
  scope,
  onScopeChange,
  onOpenBusiness,
  workItems = businessWorkFixtures,
}: {
  section: WorkSection;
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  onOpenBusiness: (route: FormalRoute, selection?: FormalSelection) => void;
  workItems?: readonly BusinessWorkItem[];
}) {
  return (
    <FormalWorkspaceScopeProvider
      classificationOptions={businessClassifications}
      onScopeChange={onScopeChange}
      scope={scope}
    >
      <MyWorkWorkspace
        onOpenBusiness={onOpenBusiness}
        onScopeChange={onScopeChange}
        scope={scope}
        section={section}
        workItems={workItems}
      />
    </FormalWorkspaceScopeProvider>
  );
}

export function MyWorkWorkspace({
  section,
  scope,
  onScopeChange,
  onOpenBusiness,
  workItems = businessWorkFixtures,
}: {
  section: WorkSection;
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  onOpenBusiness: (route: FormalRoute, selection?: FormalSelection) => void;
  workItems?: readonly BusinessWorkItem[];
}) {
  return (
    <MyWorkLedger
      section={section}
      onOpenBusiness={onOpenBusiness}
      onScopeChange={onScopeChange}
      scope={scope}
      workItems={workItems}
    />
  );
}

function MyWorkLedger({
  section,
  scope,
  onScopeChange,
  onOpenBusiness,
  workItems,
}: {
  section: WorkSection;
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  onOpenBusiness: (route: FormalRoute, selection?: FormalSelection) => void;
  workItems: readonly BusinessWorkItem[];
}) {
  const [page, setPage] = useState(1);
  const productOptions = workProductOptions(workItems);
  const periodOptions = workPeriodOptions(workItems);
  const periodKeys = useMemo(
    () => periodOptions.map(({ id }) => id),
    [periodOptions],
  );
  const queryAllowed = scopeAllowsQuery(scope, periodKeys);
  const projections = useMemo(
    () =>
      projectMyWork(workItems, {
        userId: scope.identity.userId,
        scope,
        queryAllowed,
        availablePeriodKeys: periodKeys,
      }),
    [periodKeys, queryAllowed, scope, workItems],
  );
  const view = myWorkViews[section];
  const visible = projections.filter(({ savedViewGroup }) =>
    view.groups.includes(savedViewGroup),
  );
  const pageSize = 10;
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageRows = visible.slice(startIndex, startIndex + pageSize);

  return (
    <div className="unified-workspace my-work-task5-workspace">
      <WorkspaceHeader
        eyebrow="统一工作门户 / 我的工作"
        title={view.label}
        summary="统一汇总本人待填报、待审核、待发布、退回、异常与逾期事项，按截止时间和风险排序，并直达原业务单据。"
      />
      <Filters
        onScopeChange={(coordinates) => {
          setPage(1);
          onScopeChange(coordinates);
        }}
        productOptions={productOptions}
        periodOptions={periodOptions}
        scope={scope}
      />
      {!queryAllowed && (
        <div className="my-work-task5-alert" role="alert">
          <strong>当前筛选范围超出您的数据权限</strong>
          <span>请重新选择已授权的地区、分类、产品或期间。</span>
        </div>
      )}
      <section
        aria-label="本人工作台账区域"
        className="my-work-task5-ledger-region"
      >
        <header>
          <div>
            <h2>{view.label}任务台账</h2>
            <p>
              汇总待填报、待审核、待发布、退回、异常和逾期事项；同一业务事项只保留一个当前处理节点。
            </p>
          </div>
          <strong>{visible.length} 项</strong>
        </header>
        <div
          aria-label="本人工作台账横向滚动区域"
          className="my-work-task5-ledger-scroll"
          tabIndex={0}
        >
          <table aria-label="本人工作台账" className="my-work-task5-ledger">
            <thead>
              <tr>
                <th className="my-work-task5-sticky" scope="col">
                  任务与业务对象
                </th>
                <th scope="col">业务与分类</th>
                <th scope="col">地区与产品</th>
                <th scope="col">期间与截止</th>
                <th scope="col">责任与完成度</th>
                <th scope="col">当前处理节点</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((projection) => {
                const { item } = projection;
                const cultivars = governedCultivarNames(item);
                const states = [
                  ["义务状态", obligationLabels[item.obligationStatus]],
                  ["单据状态", documentLabels[item.documentStatus]],
                  ["审核状态", reviewLabels[item.reviewStatus]],
                  ["质量状态", qualityLabels[item.qualityStatus]],
                  ["发布状态", releaseLabels[item.releaseStatus]],
                ] as const;
                const currentNode = currentProcessingNode(item);
                const isResponsible =
                  item.responsibleUserId === scope.identity.userId;
                return (
                  <tr key={item.workId}>
                    <th className="my-work-task5-sticky" scope="row">
                      <span className="my-work-task5-cell-stack">
                        <strong>{item.title || "任务名称待维护"}</strong>
                        <small>{governedSubjectName(item)}</small>
                      </span>
                    </th>
                    <td>
                      <span className="my-work-task5-cell-stack">
                        <strong>{domainLabels[item.domain]}</strong>
                        <small>
                          {item.businessLabel || "业务分类名称待维护"}
                        </small>
                      </span>
                    </td>
                    <td>
                      <span className="my-work-task5-cell-stack">
                        <strong>{item.regionLabel || "地区名称待维护"}</strong>
                        <small>
                          {governedProductName(item)}
                          {cultivars ? ` · ${cultivars}` : ""}
                        </small>
                      </span>
                    </td>
                    <td>
                      <span className="my-work-task5-cell-stack">
                        <strong>{governedPeriodName(item)}</strong>
                        <small>
                          截止：{formatProductionDateTime(item.deadline)}
                        </small>
                      </span>
                    </td>
                    <td>
                      <span className="my-work-task5-cell-stack">
                        <strong>
                          {item.responsiblePerson || "责任人待维护"} ·{" "}
                          {item.responsiblePost || "责任岗位待维护"}
                        </strong>
                        <small>
                          {isResponsible ? "本人负责" : "本人审核"} · 已完成{" "}
                          {item.completedFields}/{item.applicableFields} 项
                        </small>
                      </span>
                    </td>
                    <td>
                      <span
                        className={`my-work-task5-state ${stateTone(currentNode)}`.trim()}
                      >
                        {currentNode}
                      </span>
                      <details className="my-work-task5-state-details">
                        <summary>查看全部状态</summary>
                        <dl>
                          {states.map(([label, value]) => (
                            <div key={`${item.workId}-${label}`}>
                              <dt>{label}</dt>
                              <dd>{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    </td>
                    <td>
                      <button
                        className="my-work-task5-row-action"
                        type="button"
                        onClick={() =>
                          onOpenBusiness(
                            projection.destination.route,
                            projection.destination.selection,
                          )
                        }
                      >
                        {projection.actionLabel}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <WorkspacePagination
          end={
            visible.length === 0
              ? 0
              : Math.min(startIndex + pageSize, visible.length)
          }
          onPageChange={setPage}
          page={currentPage}
          pages={pages}
          start={visible.length === 0 ? 0 : startIndex + 1}
          total={visible.length}
        />
        {queryAllowed && visible.length === 0 && (
          <div className="my-work-task5-empty" role="status">
            当前筛选条件或状态视图下没有本人事项，请调整筛选条件后重试。
          </div>
        )}
      </section>
    </div>
  );
}
