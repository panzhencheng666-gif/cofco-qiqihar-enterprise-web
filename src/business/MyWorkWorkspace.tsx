import { useMemo, useState, type ReactNode } from "react";

import {
  projectMyWork,
  type BusinessWorkProjection,
} from "./application/businessWorkProjection";
import type { BusinessWorkItem } from "./core/businessWork";
import { businessClassifications } from "./core/businessClassification";
import type { OperationalScope } from "./core/operationalScope";
import { platformProducts } from "./core/platformMasterData";
import { businessWorkFixtures } from "./data/businessWorkFixtures";
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
import type { BatchReviewWorkItemsResult } from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";

type MyWorkLedgerSection = Exclude<
  WorkSection,
  "imports" | "sample-governance"
>;

function reviewErrorMessage(error: unknown): string {
  if (error instanceof RealtimeApiError && error.clientMessage) {
    return error.clientMessage;
  }
  return "审核操作未完成，请稍后重试。";
}

const myWorkViews: Readonly<
  Record<
    MyWorkLedgerSection,
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
  return item.effectivePeriod.trim() || "未提供任务期间";
}

function governedSubjectName(item: BusinessWorkItem): string {
  if (item.subject.kind === "monitoring-object") {
    return item.subject.objectName || "未提供监测对象名称";
  }
  if (item.subject.kind === "supply-account") {
    return item.subject.accountLabel || "未提供产品账户名称";
  }
  return item.subject.reportLabel || "未提供报告名称";
}

function governedProductName(item: BusinessWorkItem): string {
  if (item.productLabel?.trim()) return item.productLabel.trim();
  if (item.productId) {
    return (
      platformProducts.find(({ id }) => id === item.productId)?.label ??
      "未提供产品名称"
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
      governedProductionName(productionCultivarNames, id, "未提供品种名称"),
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
      authorization.permissionKeys.includes("enterprise:fixtures:read")) &&
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
  const options = new Map<string, string>();
  for (const item of workItems) {
    if (!item.productId || options.has(item.productId)) continue;
    const label = governedProductName(item);
    if (label !== "未提供产品名称" && label !== "未指定产品") {
      options.set(item.productId, label);
    }
  }
  return [...options].map(([id, label]) => ({ id, label }));
}

function workPeriodOptions(
  workItems: readonly BusinessWorkItem[],
): readonly { id: string; label: string }[] {
  const options = new Map<string, string>();
  for (const item of workItems) {
    if (!item.periodKey || options.has(item.periodKey)) continue;
    const governedLabel = governedPeriodName(item);
    const label =
      governedLabel === "未提供任务期间"
        ? item.effectivePeriod.trim() || item.periodKey
        : governedLabel;
    options.set(item.periodKey, label);
  }
  return [...options].map(([id, label]) => ({ id, label }));
}

function workDomainOptions(
  workItems: readonly BusinessWorkItem[],
): readonly { id: BusinessWorkItem["domain"]; label: string }[] {
  const domains = new Set(workItems.map(({ domain }) => domain));
  return Object.entries(domainLabels).flatMap(([id, label]) =>
    domains.has(id as BusinessWorkItem["domain"])
      ? [{ id: id as BusinessWorkItem["domain"], label }]
      : [],
  );
}

function workRegionOptions(
  workItems: readonly BusinessWorkItem[],
): readonly { id: string; label: string }[] {
  const options = new Map<string, string>();
  for (const item of workItems) {
    const label = item.regionLabel.trim();
    if (!item.regionId || !label || options.has(item.regionId)) continue;
    options.set(item.regionId, label);
  }
  return [...options].map(([id, label]) => ({ id, label }));
}

function workClassificationOptions(
  workItems: readonly BusinessWorkItem[],
): readonly {
  id: string;
  label: string;
  domain: BusinessWorkItem["domain"];
}[] {
  const options = new Map<
    string,
    { id: string; label: string; domain: BusinessWorkItem["domain"] }
  >();
  for (const item of workItems) {
    if (!item.businessSubtypeId || options.has(item.businessSubtypeId))
      continue;
    options.set(item.businessSubtypeId, {
      id: item.businessSubtypeId,
      label: item.businessLabel.trim() || domainLabels[item.domain],
      domain: item.domain,
    });
  }
  return [...options.values()];
}

function Filters({
  scope,
  onScopeChange,
  query,
  status,
  statusOptions,
  onApply,
  onQueryChange,
  onReset,
  onStatusChange,
  domainOptions,
  regionOptions,
  productOptions,
  periodOptions,
  availableClassificationOptions,
}: {
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  query: string;
  status: string;
  statusOptions: readonly string[];
  onApply: () => void;
  onQueryChange: (value: string) => void;
  onReset: () => void;
  onStatusChange: (value: string) => void;
  domainOptions: readonly {
    id: BusinessWorkItem["domain"];
    label: string;
  }[];
  regionOptions: readonly { id: string; label: string }[];
  productOptions: readonly { id: string; label: string }[];
  periodOptions: readonly { id: string; label: string }[];
  availableClassificationOptions: readonly {
    id: string;
    label: string;
    domain: BusinessWorkItem["domain"];
  }[];
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const classificationOptions = availableClassificationOptions.filter(
    ({ domain }) =>
      !scope.coordinates.businessDomainId ||
      domain === scope.coordinates.businessDomainId,
  );
  const selectedClassification = classificationOptions.find(
    ({ id }) =>
      id === scope.coordinates.businessSubtypeId ||
      (scope.coordinates.businessSubtypeId
        ? id.endsWith(`.${scope.coordinates.businessSubtypeId}`)
        : false),
  )?.id;
  const products = productOptions.filter(({ id }) =>
    scope.authorization.serverAuthoritative === true
      ? true
      : scope.authorization.authorizedProductIds.includes(id),
  );
  const periods = periodOptions;
  const domainInvalid =
    scope.coordinates.businessDomainId !== undefined &&
    !domainOptions.some(({ id }) => id === scope.coordinates.businessDomainId);
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
  const showProduct = products.length > 1 || productInvalid;
  const periodInvalid = Boolean(
    scope.coordinates.periodKey &&
    !periods.some(({ id }) => id === scope.coordinates.periodKey),
  );
  const showPeriod = periods.length > 1 || periodInvalid;
  const showAdvanced =
    classificationOptions.length > 1 || classificationInvalid;
  const showAdvancedControls = showProduct || showPeriod || showAdvanced;

  return (
    <section aria-label="我的工作筛选" className="my-work-task5-filter-surface">
      <div className="my-work-task5-filter-grid my-work-task5-filter-grid--primary">
        <label className="my-work-task5-search-field">
          <span>搜索事项</span>
          <input
            aria-label="搜索事项名称或单据编号"
            placeholder="搜索事项名称或单据编号"
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onApply();
            }}
          />
        </label>
        <label>
          <span>业务类型</span>
          <select
            aria-label="业务类型"
            value={scope.coordinates.businessDomainId ?? ""}
            onChange={(event) =>
              onScopeChange({
                businessDomainId: event.target.value || undefined,
                businessSubtypeId: undefined,
              })
            }
          >
            <option value="">全部业务类型</option>
            {domainInvalid && (
              <option disabled value={scope.coordinates.businessDomainId}>
                业务类型无效（请重新选择）
              </option>
            )}
            {domainOptions.map(({ id, label }) => (
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
            <option value="authorized-all">全部地区</option>
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
          <span>{statusOptions.length > 0 ? "办理状态" : "状态"}</span>
          <select
            aria-label="待处理状态"
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
          >
            <option value="">
              全部{statusOptions.length > 0 ? "办理" : ""}状态
            </option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="my-work-task5-filter-actions">
        {showAdvancedControls && (
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
        )}
        <span className="my-work-task5-filter-spacer" />
        <button type="button" onClick={onReset}>
          重置
        </button>
        <button className="is-primary" type="button" onClick={onApply}>
          查询
        </button>
      </div>
      {showAdvancedControls && advancedOpen && (
        <div
          className="my-work-task5-filter-grid my-work-task5-filter-grid--advanced"
          id="my-work-more-filters"
        >
          {showProduct && (
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
                <option value="">全部产品或作物</option>
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
          )}
          {showPeriod && (
            <label>
              <span>任务期间</span>
              <select
                aria-label="任务期间"
                value={scope.coordinates.periodKey ?? ""}
                onChange={(event) =>
                  onScopeChange({ periodKey: event.target.value || undefined })
                }
              >
                <option value="">全部任务期间</option>
                {periods.map(({ id, label }) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
                {scope.coordinates.periodKey &&
                  !periods.some(
                    ({ id }) => id === scope.coordinates.periodKey,
                  ) && (
                    <option disabled value={scope.coordinates.periodKey}>
                      任务期间无效（请重新选择）
                    </option>
                  )}
              </select>
            </label>
          )}
          {showAdvanced && (
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
                <option value="">全部业务分类</option>
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
          )}
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
  canBatchApprove = false,
  onBatchApprove,
  onReviewItem,
  samplePointGovernance,
  importTasks,
}: {
  section: WorkSection;
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  onOpenBusiness: (route: FormalRoute, selection?: FormalSelection) => void;
  workItems?: readonly BusinessWorkItem[];
  canBatchApprove?: boolean;
  samplePointGovernance?: ReactNode;
  importTasks?: ReactNode;
  onBatchApprove?: () => Promise<BatchReviewWorkItemsResult>;
  onReviewItem?: (
    item: BusinessWorkItem,
    action: "approve" | "return",
    reason?: string,
  ) => Promise<void>;
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
        canBatchApprove={canBatchApprove}
        onBatchApprove={onBatchApprove}
        onReviewItem={onReviewItem}
        samplePointGovernance={samplePointGovernance}
        importTasks={importTasks}
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
  canBatchApprove = false,
  onBatchApprove,
  onReviewItem,
  samplePointGovernance,
  importTasks,
}: {
  section: WorkSection;
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  onOpenBusiness: (route: FormalRoute, selection?: FormalSelection) => void;
  workItems?: readonly BusinessWorkItem[];
  canBatchApprove?: boolean;
  samplePointGovernance?: ReactNode;
  importTasks?: ReactNode;
  onBatchApprove?: () => Promise<BatchReviewWorkItemsResult>;
  onReviewItem?: (
    item: BusinessWorkItem,
    action: "approve" | "return",
    reason?: string,
  ) => Promise<void>;
}) {
  if (section === "sample-governance") {
    return (
      <div className="unified-workspace sample-point-governance-route">
        {samplePointGovernance ?? (
          <div className="my-work-task5-alert" role="status">
            当前账号没有样本点管理权限。
          </div>
        )}
      </div>
    );
  }
  if (section === "imports") {
    return (
      <div className="unified-workspace my-work-import-task-workspace">
        <WorkspaceHeader
          eyebrow="统一工作门户 / 我的工作"
          title="导入任务"
          summary="按产情、市场、物流查看真实导入批次，失败行可下载、修正并重试。"
        />
        {importTasks ?? (
          <div className="my-work-task5-alert" role="status">
            当前账号没有可查看的导入任务权限。
          </div>
        )}
      </div>
    );
  }
  return (
    <MyWorkLedger
      section={section}
      onOpenBusiness={onOpenBusiness}
      onScopeChange={onScopeChange}
      scope={scope}
      workItems={workItems}
      canBatchApprove={canBatchApprove}
      onBatchApprove={onBatchApprove}
      onReviewItem={onReviewItem}
    />
  );
}

function MyWorkLedger({
  section,
  scope,
  onScopeChange,
  onOpenBusiness,
  workItems,
  canBatchApprove,
  onBatchApprove,
  onReviewItem,
}: {
  section: MyWorkLedgerSection;
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  onOpenBusiness: (route: FormalRoute, selection?: FormalSelection) => void;
  workItems: readonly BusinessWorkItem[];
  canBatchApprove: boolean;
  onBatchApprove?: () => Promise<BatchReviewWorkItemsResult>;
  onReviewItem?: (
    item: BusinessWorkItem,
    action: "approve" | "return",
    reason?: string,
  ) => Promise<void>;
}) {
  const [page, setPage] = useState(1);
  const [batchReviewStatus, setBatchReviewStatus] = useState<
    "idle" | "running"
  >("idle");
  const [batchReviewMessage, setBatchReviewMessage] = useState("");
  const [activeReviewWorkId, setActiveReviewWorkId] = useState<string | null>(
    null,
  );
  const [returningWorkId, setReturningWorkId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const [queryDraft, setQueryDraft] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [statusDraft, setStatusDraft] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const domainOptions = workDomainOptions(workItems);
  const regionOptions = workRegionOptions(workItems);
  const productOptions = workProductOptions(workItems);
  const periodOptions = workPeriodOptions(workItems);
  const classificationOptions = workClassificationOptions(workItems);
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
  const completedView = section === "completed";
  const viewItems = projections.filter(({ savedViewGroup }) =>
    view.groups.includes(savedViewGroup),
  );
  const statusOptions = [
    ...new Set(viewItems.map(({ item }) => currentProcessingNode(item))),
  ];
  const normalizedQuery = appliedQuery.trim().toLocaleLowerCase("zh-CN");
  const visible = viewItems.filter(({ item }) => {
    const matchesStatus =
      !appliedStatus || currentProcessingNode(item) === appliedStatus;
    if (!matchesStatus) return false;
    if (!normalizedQuery) return true;
    return [
      item.workId,
      item.title,
      governedSubjectName(item),
      item.regionLabel,
      item.businessLabel,
      item.responsiblePerson,
      governedProductName(item),
    ]
      .join(" ")
      .toLocaleLowerCase("zh-CN")
      .includes(normalizedQuery);
  });
  const reviewableCount = visible.filter(
    ({ savedViewGroup, item }) =>
      savedViewGroup === "待审核" &&
      (item.domain === "production" || item.domain === "market"),
  ).length;
  const pageSize = 10;
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageRows = visible.slice(startIndex, startIndex + pageSize);
  const selectedProjection =
    pageRows.find(({ item }) => item.workId === selectedWorkId) ?? pageRows[0];
  const selectedItem = selectedProjection?.item;
  const selectedNode = selectedItem
    ? currentProcessingNode(selectedItem)
    : undefined;
  const selectedStates = selectedItem
    ? [
        ["义务状态", obligationLabels[selectedItem.obligationStatus]],
        ["单据状态", documentLabels[selectedItem.documentStatus]],
        ["审核状态", reviewLabels[selectedItem.reviewStatus]],
        ["质量状态", qualityLabels[selectedItem.qualityStatus]],
        ["发布状态", releaseLabels[selectedItem.releaseStatus]],
      ]
    : [];

  const approveVisibleRecords = async () => {
    if (!onBatchApprove) return;
    const confirmed =
      typeof window === "undefined" ||
      window.confirm(
        `确认审核通过当前筛选下的 ${reviewableCount} 条待审核业务记录吗？审核后将自动发布并进入总揽监测、分析和供需平衡。`,
      );
    if (!confirmed) return;
    setBatchReviewStatus("running");
    setBatchReviewMessage("");
    try {
      const result = await onBatchApprove();
      setBatchReviewMessage(
        result.failedCount === 0
          ? `批量审核完成：${result.approvedCount} 条已审核通过并自动发布。`
          : `批量审核完成：${result.approvedCount} 条通过，${result.failedCount} 条因规则校验未通过并保留在待审核列表。${result.failures[0]?.reason ? ` 首条原因：${result.failures[0].reason}` : ""}`,
      );
    } catch {
      setBatchReviewMessage(
        "批量审核未完成，请保留当前页面并联系管理员核查，系统没有跳过审核规则。",
      );
    } finally {
      setBatchReviewStatus("idle");
    }
  };
  const reviewOne = async (
    item: BusinessWorkItem,
    action: "approve" | "return",
  ) => {
    if (!onReviewItem) return;
    const reason = returnReason.trim();
    if (action === "return" && !reason) return;
    setActiveReviewWorkId(item.workId);
    setReviewMessage("");
    try {
      await onReviewItem(
        item,
        action,
        action === "return" ? reason : undefined,
      );
      setReviewMessage(
        action === "approve"
          ? "该记录已审核通过并自动发布。"
          : "该记录已驳回并通知填报人修改。",
      );
      setReturningWorkId(null);
      setReturnReason("");
    } catch (error) {
      setReviewMessage(reviewErrorMessage(error));
    } finally {
      setActiveReviewWorkId(null);
    }
  };

  return (
    <div className="unified-workspace my-work-task5-workspace">
      <WorkspaceHeader
        eyebrow="统一工作门户 / 我的工作"
        title={view.label}
        summary={
          completedView
            ? "查询本人已完成事项，核对办理结果，并可返回原业务单据。"
            : "只展示现在需要本人操作的事项；优先处理退回、异常和临近截止任务。"
        }
      />
      <span className="my-work-task5-sync-state" role="status">
        {queryAllowed ? "数据已同步" : "当前数据范围受限"}
      </span>
      <Filters
        availableClassificationOptions={classificationOptions}
        domainOptions={domainOptions}
        onScopeChange={(coordinates) => {
          setPage(1);
          onScopeChange(coordinates);
        }}
        onApply={() => {
          setPage(1);
          setAppliedQuery(queryDraft);
          setAppliedStatus(statusDraft);
        }}
        onQueryChange={setQueryDraft}
        onReset={() => {
          setPage(1);
          setQueryDraft("");
          setAppliedQuery("");
          setStatusDraft("");
          setAppliedStatus("");
          onScopeChange({
            regionId: "authorized-all",
            businessDomainId: undefined,
            businessSubtypeId: undefined,
            productId: undefined,
            cultivarId: undefined,
            periodKey: undefined,
          });
        }}
        onStatusChange={setStatusDraft}
        productOptions={productOptions}
        query={queryDraft}
        regionOptions={regionOptions}
        periodOptions={periodOptions}
        scope={scope}
        status={statusDraft}
        statusOptions={statusOptions}
      />
      <div
        aria-label={completedView ? "已办事项概况" : "待我处理概况"}
        className="my-work-task5-summary-band"
        role="status"
      >
        <strong>共 {viewItems.length} 项</strong>
        {statusOptions.slice(0, 3).map((statusLabel) => (
          <span key={statusLabel}>
            {statusLabel}{" "}
            {
              viewItems.filter(
                ({ item }) => currentProcessingNode(item) === statusLabel,
              ).length
            }
          </span>
        ))}
        <span className="my-work-task5-summary-sort">
          {completedView ? "按完成时间倒序" : "按风险与截止时间排序"}
        </span>
      </div>
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
              {completedView
                ? "按完成时间查看办理结果；点击“查看”返回原业务单据。"
                : "先处理退回和质量阻断，再处理临近截止事项；点击“处理”直接进入原业务单据。"}
            </p>
          </div>
          <div className="my-work-task5-batch-actions">
            <strong>{visible.length} 项</strong>
            {canBatchApprove && onBatchApprove && reviewableCount > 0 && (
              <button
                className="my-work-task5-row-action"
                disabled={batchReviewStatus === "running"}
                type="button"
                onClick={() => {
                  void approveVisibleRecords();
                }}
              >
                {batchReviewStatus === "running"
                  ? "正在批量审核…"
                  : `一键审核当前筛选（${reviewableCount} 项）`}
              </button>
            )}
          </div>
        </header>
        {batchReviewMessage && (
          <div className="my-work-task5-alert" role="status">
            {batchReviewMessage}
          </div>
        )}
        {reviewMessage && (
          <div className="my-work-task5-alert" role="status">
            {reviewMessage}
          </div>
        )}
        <div className="my-work-task5-ledger-split">
          <div className="my-work-task5-ledger-table-side">
            <div
              aria-label="本人工作台账横向滚动区域"
              className="my-work-task5-ledger-scroll"
              tabIndex={0}
            >
              <table aria-label="本人工作台账" className="my-work-task5-ledger">
                <thead>
                  <tr>
                    <th className="my-work-task5-sticky" scope="col">
                      事项
                    </th>
                    <th scope="col">业务范围</th>
                    <th scope="col">期间与截止</th>
                    <th scope="col">责任人</th>
                    <th scope="col">当前状态</th>
                    <th scope="col">处理</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((projection) => {
                    const { item } = projection;
                    const reviewable =
                      canBatchApprove &&
                      projection.savedViewGroup === "待审核" &&
                      (item.domain === "production" ||
                        item.domain === "market") &&
                      Boolean(onReviewItem);
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
                      <tr
                        aria-selected={
                          selectedProjection?.item.workId === item.workId
                        }
                        key={item.workId}
                        onClick={() => setSelectedWorkId(item.workId)}
                      >
                        <th className="my-work-task5-sticky" scope="row">
                          <span className="my-work-task5-cell-stack">
                            <strong>{item.title || "未提供任务名称"}</strong>
                            <small>{governedSubjectName(item)}</small>
                          </span>
                        </th>
                        <td>
                          <span className="my-work-task5-cell-stack">
                            <strong>
                              {domainLabels[item.domain]} ·{" "}
                              {item.businessLabel || "未提供业务分类"}
                            </strong>
                            <small>
                              {item.regionLabel || "未提供业务地区"} ·{" "}
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
                              {item.responsiblePerson || "未提供责任人"}
                            </strong>
                            <small>
                              {item.responsiblePost || "未提供责任岗位"} ·{" "}
                              {isResponsible ? "本人负责" : "本人审核"}
                              {item.applicableFields > 0
                                ? ` · 已完成 ${item.completedFields}/${item.applicableFields} 项`
                                : " · 系统流程任务"}
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
                          <span className="my-work-task5-cell-stack">
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
                            {reviewable && (
                              <>
                                <button
                                  className="my-work-task5-row-action"
                                  disabled={activeReviewWorkId !== null}
                                  type="button"
                                  onClick={() => {
                                    void reviewOne(item, "approve");
                                  }}
                                >
                                  审核通过
                                </button>
                                <button
                                  className="my-work-task5-row-action"
                                  disabled={activeReviewWorkId !== null}
                                  type="button"
                                  onClick={() => {
                                    setReturningWorkId(item.workId);
                                    setReturnReason("");
                                    setReviewMessage("");
                                  }}
                                >
                                  驳回
                                </button>
                                {returningWorkId === item.workId && (
                                  <div className="my-work-task5-return-form">
                                    <label>
                                      驳回原因
                                      <textarea
                                        aria-label="驳回原因"
                                        value={returnReason}
                                        onChange={(event) =>
                                          setReturnReason(event.target.value)
                                        }
                                      />
                                    </label>
                                    <button
                                      className="my-work-task5-row-action"
                                      disabled={
                                        !returnReason.trim() ||
                                        activeReviewWorkId !== null
                                      }
                                      type="button"
                                      onClick={() => {
                                        void reviewOne(item, "return");
                                      }}
                                    >
                                      确认驳回
                                    </button>
                                    <button
                                      className="my-work-task5-row-action"
                                      disabled={activeReviewWorkId !== null}
                                      type="button"
                                      onClick={() => {
                                        setReturningWorkId(null);
                                        setReturnReason("");
                                      }}
                                    >
                                      取消
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </span>
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
          </div>
          <aside
            aria-label={completedView ? "已办事项详情" : "当前事项详情"}
            className="my-work-task5-detail-drawer"
          >
            {selectedItem && selectedProjection && selectedNode ? (
              <>
                <header>
                  <small>{completedView ? "办理结果" : "当前事项"}</small>
                  <h3>{selectedItem.title || "未提供任务名称"}</h3>
                  <p>{governedSubjectName(selectedItem)}</p>
                </header>
                <dl>
                  <div>
                    <dt>业务范围</dt>
                    <dd>
                      {domainLabels[selectedItem.domain]} ·{" "}
                      {governedProductName(selectedItem)}
                    </dd>
                  </div>
                  <div>
                    <dt>地区</dt>
                    <dd>{selectedItem.regionLabel || "未提供业务地区"}</dd>
                  </div>
                  <div>
                    <dt>期间</dt>
                    <dd>{governedPeriodName(selectedItem)}</dd>
                  </div>
                  <div>
                    <dt>{completedView ? "办理结果" : "当前处理节点"}</dt>
                    <dd>
                      <span
                        className={`my-work-task5-state ${stateTone(selectedNode)}`.trim()}
                      >
                        {selectedNode}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>责任人</dt>
                    <dd>{selectedItem.responsiblePerson || "未提供责任人"}</dd>
                  </div>
                </dl>
                <details className="my-work-task5-detail-states">
                  <summary>查看完整流转状态</summary>
                  <dl>
                    {selectedStates.map(([label, value]) => (
                      <div key={`${selectedItem.workId}-detail-${label}`}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
                <footer>
                  <button
                    aria-label={
                      completedView
                        ? "从详情查看原业务单据"
                        : `从详情打开${selectedProjection.actionLabel}`
                    }
                    className="my-work-task5-row-action is-primary"
                    type="button"
                    onClick={() =>
                      onOpenBusiness(
                        selectedProjection.destination.route,
                        selectedProjection.destination.selection,
                      )
                    }
                  >
                    {completedView
                      ? "查看原业务单据"
                      : selectedProjection.actionLabel}
                  </button>
                </footer>
              </>
            ) : (
              <div className="my-work-task5-detail-empty">
                {completedView
                  ? "当前筛选范围内暂无已办事项。"
                  : "当前筛选范围内暂无待处理事项。"}
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
