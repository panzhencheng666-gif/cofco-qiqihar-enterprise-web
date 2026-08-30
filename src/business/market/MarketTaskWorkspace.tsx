import { useEffect, useMemo, useState } from "react";

import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";

import {
  projectDomainTasks,
  type BusinessWorkProjection,
} from "../application/businessWorkProjection";
import type { BusinessWorkItem } from "../core/businessWork";
import type { OperationalScope } from "../core/operationalScope";
import { businessWorkFixtures } from "../data/businessWorkFixtures";
import { marketDocumentFixtures } from "../data/marketDocumentFixtures";
import type {
  BusinessCoordinates,
  FormalSelection,
} from "../formalEnterpriseModel";
import { marketTasks } from "../marketMonitoringData";
import {
  formatMarketDateTime,
  governedMarketName,
  marketCultivarNames,
  marketCultivarsByProduct,
  marketLifecycleLabels,
  marketProductNames,
  marketRoleLabels,
  marketStateTone,
  marketTaskStateOptions,
} from "../marketMonitoringModel";
import {
  WorkspaceHeader,
  WorkspacePagination,
} from "../UnifiedWorkspacePrimitives";
import {
  MarketDocumentWorkbench,
  type MarketDocumentDraft,
} from "./MarketDocumentWorkbench";
import {
  MarketFilterChips,
  type MarketFilterCondition,
} from "./MarketFilterChips";

type TaskStateFilters = {
  view: string;
  target: string;
  obligation: string;
  document: string;
  review: string;
  quality: string;
  release: string;
};

const emptyStateFilters: TaskStateFilters = {
  view: "",
  target: "",
  obligation: "",
  document: "",
  review: "",
  quality: "",
  release: "",
};

function stateSelect(
  label: string,
  key: keyof Omit<TaskStateFilters, "target" | "view">,
  filters: TaskStateFilters,
  onChange: (filters: TaskStateFilters) => void,
  options: readonly (readonly [string, string])[],
) {
  return (
    <label>
      <span>{label}</span>
      <select
        aria-label={label}
        value={filters[key]}
        onChange={(event) =>
          onChange({ ...filters, [key]: event.target.value })
        }
      >
        <option value="">全部{label}</option>
        {options.map(([value, optionLabel]) => (
          <option key={value} value={value}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function TaskFilters({
  scope,
  workItems,
  authoritativeProducts,
  filters,
  onScopeChange,
  onFiltersChange,
}: {
  scope: OperationalScope;
  workItems: readonly BusinessWorkItem[];
  authoritativeProducts: readonly { id: string; label: string }[];
  filters: TaskStateFilters;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  onFiltersChange: (filters: TaskStateFilters) => void;
}) {
  const marketItems = workItems.filter(({ domain }) => domain === "market");
  const regions = [
    ...new Map(
      marketItems
        .filter(({ regionId, regionLabel }) => regionId && regionLabel.trim())
        .map(({ regionId, regionLabel }) => [regionId, regionLabel] as const),
    ).entries(),
  ].map(([id, label]) => ({ id, label }));
  const classifications = [
    ...new Map(
      marketItems.map(({ businessSubtypeId, businessLabel }) => [
        businessSubtypeId,
        businessLabel.trim() || "未提供业务分类",
      ]),
    ).entries(),
  ].map(([id, label]) => ({ id, label }));
  const products = [
    ...new Map([
      ...authoritativeProducts.map(({ id, label }) => [id, label] as const),
      ...marketItems.flatMap((item) =>
        item.productId
          ? [
              [
                item.productId,
                item.productLabel?.trim() ||
                  governedMarketName(
                    marketProductNames,
                    item.productId,
                    "未提供产品名称",
                  ),
              ] as const,
            ]
          : [],
      ),
    ]).entries(),
  ].map(([id, label]) => ({ id, label }));
  const periods = [
    ...new Map(
      marketItems
        .filter(({ periodKey }) => Boolean(periodKey))
        .map(
          (item) =>
            [
              item.periodKey,
              item.effectivePeriod.trim() || "未提供任务期间",
            ] as const,
        ),
    ).entries(),
  ].map(([id, label]) => ({ id, label }));
  const targetOptions = [
    ...new Set(
      marketItems.map((item) =>
        item.businessSubtypeId === "market.logistics" ? "logistics" : "subject",
      ),
    ),
  ];
  const regionInvalid =
    scope.coordinates.regionId !== "authorized-all" &&
    !regions.some(({ id }) => id === scope.coordinates.regionId);
  const classificationInvalid = Boolean(
    scope.coordinates.businessSubtypeId &&
    !classifications.some(
      ({ id }) => id === scope.coordinates.businessSubtypeId,
    ),
  );
  const productInvalid = Boolean(
    scope.coordinates.productId &&
    !products.some(({ id }) => id === scope.coordinates.productId),
  );
  const periodInvalid = Boolean(
    scope.coordinates.periodKey &&
    !periods.some(({ id }) => id === scope.coordinates.periodKey),
  );
  const targetInvalid = Boolean(
    filters.target &&
    !targetOptions.some((option) => option === filters.target),
  );
  const cultivarIds = scope.coordinates.productId
    ? (marketCultivarsByProduct[scope.coordinates.productId] ?? []).filter(
        (id) => scope.authorization.authorizedCultivarIds.includes(id),
      )
    : [];
  const advancedCount =
    Number(Boolean(filters.target)) +
    Number(Boolean(scope.coordinates.cultivarId)) +
    (
      ["obligation", "document", "review", "quality", "release"] as const
    ).filter((key) => Boolean(filters[key])).length;
  const viewLabels: Readonly<Record<string, string>> = {
    "my-entry": "待我填报",
    "my-review": "待我审核",
    "quality-attention": "质量异常",
    "pending-release": "待发布",
    completed: "已办任务",
  };
  const activeConditions: MarketFilterCondition[] = [];
  const addCondition = (
    id: string,
    label: string | undefined,
    onClear: () => void,
  ) => {
    if (label) activeConditions.push({ id, label, onClear });
  };
  addCondition("view", viewLabels[filters.view], () =>
    onFiltersChange({ ...filters, view: "" }),
  );
  addCondition(
    "target",
    filters.target === "subject"
      ? "市场主体任务"
      : filters.target === "logistics"
        ? "物流节点任务"
        : undefined,
    () => onFiltersChange({ ...filters, target: "" }),
  );
  addCondition(
    "region",
    scope.coordinates.regionId === "authorized-all"
      ? undefined
      : regions.find(({ id }) => id === scope.coordinates.regionId)?.label,
    () => onScopeChange({ regionId: "authorized-all" }),
  );
  addCondition(
    "classification",
    classifications.find(({ id }) => id === scope.coordinates.businessSubtypeId)
      ?.label,
    () => onScopeChange({ businessSubtypeId: undefined }),
  );
  addCondition(
    "product",
    scope.coordinates.productId
      ? products.find(({ id }) => id === scope.coordinates.productId)?.label
      : undefined,
    () => onScopeChange({ productId: undefined, cultivarId: undefined }),
  );
  addCondition(
    "cultivar",
    scope.coordinates.cultivarId
      ? governedMarketName(
          marketCultivarNames,
          scope.coordinates.cultivarId,
          "未提供品种名称",
        )
      : undefined,
    () => onScopeChange({ cultivarId: undefined }),
  );
  addCondition(
    "period",
    periods.find(({ id }) => id === scope.coordinates.periodKey)?.label,
    () => onScopeChange({ periodKey: undefined }),
  );
  for (const key of [
    "obligation",
    "document",
    "review",
    "quality",
    "release",
  ] as const) {
    addCondition(
      key,
      filters[key]
        ? marketTaskStateOptions[key].find(
            ([value]) => value === filters[key],
          )?.[1]
        : undefined,
      () => onFiltersChange({ ...filters, [key]: "" }),
    );
  }
  return (
    <section aria-label="市场任务筛选" className="market-task6-filter-surface">
      <div className="market-task6-filter-grid">
        <label>
          <span>工作视图</span>
          <select
            aria-label="工作视图"
            value={filters.view}
            onChange={(event) =>
              onFiltersChange({ ...filters, view: event.target.value })
            }
          >
            <option value="">全部任务</option>
            <option value="my-entry">待我填报</option>
            <option value="my-review">待我审核</option>
            <option value="quality-attention">质量异常</option>
            <option value="pending-release">待发布</option>
            <option value="completed">已办任务</option>
          </select>
        </label>
        {(regions.length > 1 || regionInvalid) && (
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
                  所选地区当前无任务（请重新选择）
                </option>
              )}
              {regions.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        {(classifications.length > 1 || classificationInvalid) && (
          <label>
            <span>业务分类</span>
            <select
              aria-label="业务分类"
              value={scope.coordinates.businessSubtypeId ?? ""}
              onChange={(event) =>
                onScopeChange({
                  businessSubtypeId: event.target.value || undefined,
                })
              }
            >
              <option value="">全部业务分类</option>
              {classificationInvalid && (
                <option disabled value={scope.coordinates.businessSubtypeId}>
                  所选分类当前无任务（请重新选择）
                </option>
              )}
              {classifications.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        {(products.length > 1 || productInvalid) && (
          <label>
            <span>产品或品类</span>
            <select
              aria-label="产品或品类"
              value={scope.coordinates.productId ?? ""}
              onChange={(event) =>
                onScopeChange({
                  productId: event.target.value || undefined,
                  cultivarId: undefined,
                })
              }
            >
              <option value="">全部产品或品类</option>
              {productInvalid && (
                <option disabled value={scope.coordinates.productId}>
                  所选产品当前无任务（请重新选择）
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
        {(periods.length > 1 || periodInvalid) && (
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
                    无效任务期间（请重新选择）
                  </option>
                )}
            </select>
          </label>
        )}
      </div>
      <details className="market-task6-more-filters">
        <summary>更多筛选（{advancedCount} 项已生效）</summary>
        <div className="market-task6-more-filter-grid">
          {(targetOptions.length > 1 || targetInvalid) && (
            <label>
              <span>任务对象</span>
              <select
                aria-label="任务对象"
                value={filters.target}
                onChange={(event) =>
                  onFiltersChange({ ...filters, target: event.target.value })
                }
              >
                <option value="">全部任务对象</option>
                {targetInvalid && (
                  <option disabled value={filters.target}>
                    所选对象类型当前无任务（请重新选择）
                  </option>
                )}
                {targetOptions.includes("subject") && (
                  <option value="subject">市场主体</option>
                )}
                {targetOptions.includes("logistics") && (
                  <option value="logistics">物流节点</option>
                )}
              </select>
            </label>
          )}
          {scope.coordinates.productId && cultivarIds.length > 0 && (
            <label>
              <span>具体品种</span>
              <select
                aria-label="具体品种"
                value={scope.coordinates.cultivarId ?? ""}
                onChange={(event) =>
                  onScopeChange({
                    cultivarId: event.target.value || undefined,
                  })
                }
              >
                <option value="">全部适用品种</option>
                {cultivarIds.map((id) => (
                  <option key={id} value={id}>
                    {governedMarketName(
                      marketCultivarNames,
                      id,
                      "未提供品种名称",
                    )}
                  </option>
                ))}
              </select>
            </label>
          )}
          {stateSelect(
            "义务状态",
            "obligation",
            filters,
            onFiltersChange,
            marketTaskStateOptions.obligation,
          )}
          {stateSelect(
            "单据状态",
            "document",
            filters,
            onFiltersChange,
            marketTaskStateOptions.document,
          )}
          {stateSelect(
            "审核状态",
            "review",
            filters,
            onFiltersChange,
            marketTaskStateOptions.review,
          )}
          {stateSelect(
            "质量状态",
            "quality",
            filters,
            onFiltersChange,
            marketTaskStateOptions.quality,
          )}
          {stateSelect(
            "发布状态",
            "release",
            filters,
            onFiltersChange,
            marketTaskStateOptions.release,
          )}
          {advancedCount > 0 && (
            <button
              type="button"
              onClick={() => {
                onFiltersChange({
                  ...emptyStateFilters,
                  view: filters.view,
                });
                onScopeChange({ cultivarId: undefined });
              }}
            >
              清除更多筛选
            </button>
          )}
        </div>
      </details>
      <MarketFilterChips
        conditions={activeConditions}
        emptyLabel="当前未限定任务范围"
      />
    </section>
  );
}

function matchesFilters(
  projection: BusinessWorkProjection,
  filters: TaskStateFilters,
  currentUserId: string,
): boolean {
  const task = marketTasks.find(
    ({ workId }) => workId === projection.item.workId,
  );
  const target =
    task?.target ??
    (projection.item.businessSubtypeId === "market.logistics"
      ? "logistics"
      : "subject");
  const viewMatches =
    !filters.view ||
    (filters.view === "my-entry" &&
      projection.item.responsibleUserId === currentUserId &&
      ["待填报", "异常逾期"].includes(projection.savedViewGroup)) ||
    (filters.view === "my-review" &&
      projection.item.reviewerUserId === currentUserId &&
      projection.savedViewGroup === "待审核") ||
    (filters.view === "quality-attention" &&
      ["warning", "blocking"].includes(projection.item.qualityStatus)) ||
    (filters.view === "pending-release" &&
      (projection.savedViewGroup === "待发布" ||
        (projection.item.reviewStatus === "approved" &&
          projection.item.releaseStatus !== "published"))) ||
    (filters.view === "completed" && projection.savedViewGroup === "已办");
  return (
    viewMatches &&
    (!filters.target || target === filters.target) &&
    (!filters.obligation ||
      projection.item.obligationStatus === filters.obligation) &&
    (!filters.document ||
      projection.item.documentStatus === filters.document) &&
    (!filters.review || projection.item.reviewStatus === filters.review) &&
    (!filters.quality || projection.item.qualityStatus === filters.quality) &&
    (!filters.release || projection.item.releaseStatus === filters.release)
  );
}

function stateCell(
  item: BusinessWorkItem,
  kind: keyof typeof marketLifecycleLabels,
) {
  const values = {
    obligation: marketLifecycleLabels.obligation[item.obligationStatus],
    document: marketLifecycleLabels.document[item.documentStatus],
    review: marketLifecycleLabels.review[item.reviewStatus],
    quality: marketLifecycleLabels.quality[item.qualityStatus],
    release: marketLifecycleLabels.release[item.releaseStatus],
  };
  const value = values[kind];
  return (
    <span className={`market-task6-state ${marketStateTone(value)}`.trim()}>
      {value}
    </span>
  );
}

export function MarketTaskWorkspace({
  scope,
  onScopeChange,
  selection,
  onSelectionChange,
  queryAllowed,
  workItems = businessWorkFixtures,
  documentDrafts = {},
  onDocumentDraftChange = () => undefined,
  onWorkItemChange = () => undefined,
  realtimeRepository,
  onCreateRecord,
  onEditRecord,
  reviewMode = false,
}: {
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  selection?: FormalSelection;
  onSelectionChange: (selection: FormalSelection) => void;
  queryAllowed: boolean;
  workItems?: readonly BusinessWorkItem[];
  documentDrafts?: Readonly<Record<string, MarketDocumentDraft>>;
  onDocumentDraftChange?: (workId: string, draft: MarketDocumentDraft) => void;
  onWorkItemChange?: (item: BusinessWorkItem) => void;
  realtimeRepository?: RealtimeBusinessRepository;
  onCreateRecord?: (productCode: "CORN" | "SOYBEAN" | "RICE") => void;
  onEditRecord?: (
    productCode: "CORN" | "SOYBEAN" | "RICE",
    recordId: string,
  ) => void;
  reviewMode?: boolean;
}) {
  const [authoritativeProducts, setAuthoritativeProducts] = useState<
    readonly { id: string; label: string }[]
  >([]);
  useEffect(() => {
    if (!realtimeRepository || reviewMode) {
      return;
    }
    let active = true;
    void realtimeRepository
      .loadMasterData()
      .then((masterData) => {
        if (!active) return;
        setAuthoritativeProducts(
          masterData.products.flatMap(({ code, name }) => {
            const id = taskProductId(code);
            return id ? [{ id, label: name }] : [];
          }),
        );
      })
      .catch(() => {
        if (active) setAuthoritativeProducts([]);
      });
    return () => {
      active = false;
    };
  }, [realtimeRepository, reviewMode]);
  const [filters, setFilters] = useState(emptyStateFilters);
  const [page, setPage] = useState(1);
  const availablePeriods = useMemo(
    () => [
      ...new Set(
        workItems
          .filter(({ domain }) => domain === "market")
          .map(({ periodKey }) => periodKey)
          .filter(Boolean),
      ),
    ],
    [workItems],
  );
  const periodInvalid =
    scope.coordinates.periodKey !== undefined &&
    !availablePeriods.includes(scope.coordinates.periodKey);
  const cultivarMismatch = Boolean(
    scope.coordinates.productId &&
    scope.coordinates.cultivarId &&
    !(marketCultivarsByProduct[scope.coordinates.productId] ?? []).includes(
      scope.coordinates.cultivarId,
    ),
  );
  const projections = useMemo(
    () =>
      projectDomainTasks(workItems, {
        domain: "market",
        scope,
        queryAllowed: queryAllowed && !periodInvalid && !cultivarMismatch,
        availablePeriodKeys: availablePeriods,
      }),
    [
      availablePeriods,
      cultivarMismatch,
      periodInvalid,
      queryAllowed,
      scope,
      workItems,
    ],
  );
  const actionableProjections = reviewMode
    ? projections.filter(
        ({ item }) =>
          item.documentStatus === "submitted" &&
          (item.reviewStatus === "pending" ||
            item.reviewStatus === "reviewing"),
      )
    : projections;
  const visible = actionableProjections.filter((projection) =>
    matchesFilters(projection, filters, scope.identity.userId),
  );
  const pageSize = 10;
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageRows = visible.slice(startIndex, startIndex + pageSize);
  const selected =
    selection?.type === "work-item"
      ? actionableProjections.find(({ item }) => item.workId === selection.id)
      : undefined;
  const invalidSelection =
    selection !== undefined && (selection.type !== "work-item" || !selected);
  const selectedDocument = selected
    ? marketDocumentFixtures.find(
        ({ workId }) => workId === selected.item.workId,
      )
    : undefined;
  return (
    <div className="unified-workspace market-task6-workspace">
      <WorkspaceHeader
        eyebrow="市场监测 / 市场任务"
        title="市场任务作业"
        summary="按对象、期间和责任处理市场采集、审核、质量与发布，同一任务始终打开同一份业务单据。"
        actions={
          realtimeRepository &&
          !reviewMode &&
          scope.authorization.permissionKeys.includes("BUSINESS_CREATE") &&
          scope.coordinates.productId ? (
            <button
              type="button"
              onClick={() => {
                const code = marketTaskProductCode(scope.coordinates.productId);
                if (code) onCreateRecord?.(code);
              }}
            >
              新建市场任务
            </button>
          ) : undefined
        }
      />
      <TaskFilters
        authoritativeProducts={reviewMode ? [] : authoritativeProducts}
        filters={filters}
        onFiltersChange={(nextFilters) => {
          setPage(1);
          setFilters(nextFilters);
        }}
        onScopeChange={(coordinates) => {
          setPage(1);
          onScopeChange(coordinates);
        }}
        scope={scope}
        workItems={workItems}
      />
      {!queryAllowed && (
        <div className="market-task6-alert" role="alert">
          当前筛选范围超出您的数据权限，系统未展示其他任务。
        </div>
      )}
      {periodInvalid && (
        <div className="market-task6-alert" role="alert">
          任务期间无效，系统没有回落到其他期间。
        </div>
      )}
      {cultivarMismatch && (
        <div className="market-task6-alert" role="alert">
          具体品种与所选产品不匹配，系统没有回落到其他任务。
        </div>
      )}
      {invalidSelection && (
        <div className="market-task6-alert" role="alert">
          任务不可用或无权查看，系统没有打开其他任务。
        </div>
      )}
      <section
        aria-label="市场任务台账区域"
        className="market-task6-ledger-region"
      >
        <header>
          <div>
            <h2>市场工作队列</h2>
            <p>
              市场主体与物流节点共用业务工作来源，五类生命周期状态分别保存。
            </p>
          </div>
          <strong>{visible.length} 项</strong>
        </header>
        <div
          aria-label="市场任务台账横向滚动区域"
          className="market-task6-ledger-scroll"
          tabIndex={0}
        >
          <table aria-label="市场任务台账" className="market-task6-ledger">
            <thead>
              <tr>
                <th className="market-task6-sticky" scope="col">
                  任务
                </th>
                <th scope="col">监测对象</th>
                <th scope="col">产品与品种</th>
                <th scope="col">当前工作</th>
                <th scope="col">字段完成</th>
                <th scope="col">截止与责任</th>
                <th scope="col">当前处理节点</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((projection, index) => {
                const { item } = projection;
                const task = marketTasks.find(
                  ({ workId }) => workId === item.workId,
                );
                const target =
                  task?.target ??
                  (item.businessSubtypeId === "market.logistics"
                    ? "logistics"
                    : "subject");
                const targetName =
                  task?.targetName ??
                  (item.subject.kind === "monitoring-object"
                    ? item.subject.objectName
                    : item.title);
                const roleLabel = task
                  ? marketRoleLabels[task.role]
                  : item.businessLabel;
                const taskIndex = startIndex + index + 1;
                return (
                  <tr key={`${item.workId}-${taskIndex}`}>
                    <th className="market-task6-sticky" scope="row">
                      <span>第 {taskIndex} 项</span>
                      <strong>{item.title}</strong>
                    </th>
                    <td>
                      <strong>{targetName}</strong>
                      <span>
                        {target === "subject" ? "市场主体" : "物流节点"} ·{" "}
                        {roleLabel}
                      </span>
                    </td>
                    <td>
                      {governedMarketName(
                        marketProductNames,
                        item.productId,
                        item.productLabel?.trim() || "未提供产品名称",
                      )}
                      {item.cultivarIds.length > 0
                        ? ` · ${item.cultivarIds.map((id) => governedMarketName(marketCultivarNames, id, "未提供品种名称")).join("、")}`
                        : ""}
                    </td>
                    <td>{item.businessLabel}</td>
                    <td>
                      {item.applicableFields > 0
                        ? `${item.completedFields}/${item.applicableFields} 项`
                        : "系统流程任务"}
                    </td>
                    <td>
                      {formatMarketDateTime(item.deadline)} ·{" "}
                      {item.responsiblePerson}
                    </td>
                    <td>
                      {stateCell(
                        item,
                        item.qualityStatus === "blocking" ||
                          item.qualityStatus === "warning"
                          ? "quality"
                          : item.reviewStatus !== "approved"
                            ? "review"
                            : item.releaseStatus !== "published"
                              ? "release"
                              : "obligation",
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          const productCode = marketTaskProductCode(
                            item.productId,
                          );
                          if (
                            realtimeRepository &&
                            productCode &&
                            item.subject.kind === "monitoring-object"
                          ) {
                            onEditRecord?.(productCode, item.subject.objectId);
                            return;
                          }
                          onSelectionChange({
                            type: "work-item",
                            id: item.workId,
                          });
                        }}
                      >
                        {realtimeRepository
                          ? reviewMode
                            ? "审核任务"
                            : "办理任务"
                          : projection.actionLabel}
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
        {queryAllowed && !periodInvalid && visible.length === 0 && (
          <div className="market-task6-empty" role="status">
            当前筛选范围内没有可处理的市场任务，请调整筛选条件后重试。
          </div>
        )}
      </section>
      {selected && selectedDocument && !invalidSelection && (
        <MarketDocumentWorkbench
          actor={{
            userId: scope.identity.userId,
            displayName:
              scope.identity.displayName ??
              (scope.identity.userId === selected.item.responsibleUserId
                ? selected.item.responsiblePerson
                : scope.identity.userId === selected.item.reviewerUserId
                  ? selected.item.reviewer
                  : "当前登录人员"),
            canRelease:
              scope.authorization.permissionKeys.includes("market:release"),
          }}
          document={selectedDocument}
          draft={documentDrafts[selected.item.workId]}
          item={selected.item}
          onDraftChange={(draft) =>
            onDocumentDraftChange(selected.item.workId, draft)
          }
          onItemChange={onWorkItemChange}
        />
      )}
    </div>
  );
}

function marketTaskProductCode(
  productId: string | null | undefined,
): "CORN" | "SOYBEAN" | "RICE" | undefined {
  if (productId === "corn" || productId === "CORN") return "CORN";
  if (productId === "soybean" || productId === "SOYBEAN") return "SOYBEAN";
  if (productId === "paddy" || productId === "rice" || productId === "RICE") {
    return "RICE";
  }
  return undefined;
}

function taskProductId(productCode: string): string | undefined {
  if (productCode === "CORN") return "corn";
  if (productCode === "SOYBEAN") return "soybean";
  if (productCode === "RICE") return "paddy";
  return undefined;
}
