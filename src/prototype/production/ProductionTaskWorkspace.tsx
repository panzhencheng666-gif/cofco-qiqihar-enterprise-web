import { useMemo, useState } from "react";

import {
  projectDomainTasks,
  type BusinessWorkProjection,
} from "../application/businessWorkProjection";
import type { BusinessWorkItem } from "../core/businessWork";
import { businessClassifications } from "../core/businessClassification";
import type { OperationalScope } from "../core/operationalScope";
import { businessWorkFixtures } from "../data/businessWorkFixtures";
import { productionDocumentFixtures } from "../data/productionDocumentFixtures";
import { getEnterpriseScopeRegion } from "../enterpriseRegions";
import type {
  BusinessCoordinates,
  FormalSelection,
} from "../formalEnterpriseModel";
import {
  productionTaskPeriods,
  productionTaskStateOptions,
} from "../productionMonitoringData";
import {
  formatProductionDateTime,
  governedProductionName,
  productionCultivarNames,
  productionPeriodNames,
  productionProductNames,
} from "../productionMonitoringModel";
import { WorkspaceHeader } from "../UnifiedWorkspacePrimitives";
import { ProductionDocumentWorkbench } from "./ProductionDocumentWorkbench";

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
  superseded: "已被新版本替代",
};

type TaskStateFilters = {
  obligation: string;
  document: string;
  review: string;
  quality: string;
  release: string;
};

const emptyStateFilters: TaskStateFilters = {
  obligation: "",
  document: "",
  review: "",
  quality: "",
  release: "",
};

function regionName(id: string): string {
  return getEnterpriseScopeRegion(id)?.label ?? "地区名称待维护";
}

function stateTone(value: string): string {
  if (
    value.includes("阻断") ||
    value.includes("截止") ||
    value.includes("逾期") ||
    value.includes("退回")
  )
    return "is-danger";
  if (
    value.includes("待") ||
    value.includes("警告") ||
    value.includes("进行") ||
    value.includes("审核中")
  )
    return "is-warning";
  if (value.includes("通过") || value.includes("完成") || value === "已发布")
    return "is-good";
  return "";
}

function taskSubjectName(item: BusinessWorkItem): string {
  return item.subject.kind === "monitoring-object"
    ? item.subject.objectName
    : "监测对象名称待维护";
}

function TaskFilters({
  scope,
  onScopeChange,
  stateFilters,
  onStateFiltersChange,
}: {
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  stateFilters: TaskStateFilters;
  onStateFiltersChange: (filters: TaskStateFilters) => void;
}) {
  const regions = scope.authorization.authorizedRegionIds.map((id) => ({
    id,
    label: regionName(id),
  }));
  const classifications = businessClassifications.filter(
    ({ domain, id }) =>
      domain === "production" &&
      scope.authorization.authorizedBusinessClassificationIds.includes(id),
  );
  const products = scope.authorization.authorizedProductIds.map((id) => ({
    id,
    label: governedProductionName(productionProductNames, id, "产品名称待维护"),
  }));
  const cultivars = scope.authorization.authorizedCultivarIds.map((id) => ({
    id,
    label: governedProductionName(
      productionCultivarNames,
      id,
      "品种名称待维护",
    ),
  }));
  const stateSelect = (
    label: string,
    key: keyof TaskStateFilters,
    options: readonly (readonly [string, string])[],
  ) => (
    <label>
      <span>{label}</span>
      <select
        aria-label={label}
        value={stateFilters[key]}
        onChange={(event) =>
          onStateFiltersChange({
            ...stateFilters,
            [key]: event.target.value,
          })
        }
      >
        {options.map(([value, optionLabel]) => (
          <option key={value || "all"} value={value}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section
      aria-label="产情任务筛选"
      className="production-task5-filter-surface"
    >
      <div className="production-task5-filter-grid">
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
            {regions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
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
            <option value="">全部已授权分类</option>
            {classifications.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
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
            <option value="">全部已授权产品</option>
            {products.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>具体品种</span>
          <select
            aria-label="具体品种"
            value={scope.coordinates.cultivarId ?? ""}
            onChange={(event) =>
              onScopeChange({ cultivarId: event.target.value || undefined })
            }
          >
            <option value="">全部已授权品种</option>
            {cultivars.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
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
            {productionTaskPeriods.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
            {scope.coordinates.periodKey &&
              !productionTaskPeriods.some(
                ({ id }) => id === scope.coordinates.periodKey,
              ) && (
                <option disabled value={scope.coordinates.periodKey}>
                  无效任务期间（请重新选择）
                </option>
              )}
          </select>
        </label>
        {stateSelect(
          "义务状态",
          "obligation",
          productionTaskStateOptions.obligation,
        )}
        {stateSelect(
          "单据状态",
          "document",
          productionTaskStateOptions.document,
        )}
        {stateSelect("审核状态", "review", productionTaskStateOptions.review)}
        {stateSelect("质量状态", "quality", productionTaskStateOptions.quality)}
        {stateSelect("发布状态", "release", productionTaskStateOptions.release)}
      </div>
    </section>
  );
}

function matchesStateFilters(
  projection: BusinessWorkProjection,
  filters: TaskStateFilters,
): boolean {
  const { item } = projection;
  return (
    (!filters.obligation || item.obligationStatus === filters.obligation) &&
    (!filters.document || item.documentStatus === filters.document) &&
    (!filters.review || item.reviewStatus === filters.review) &&
    (!filters.quality || item.qualityStatus === filters.quality) &&
    (!filters.release || item.releaseStatus === filters.release)
  );
}

export function ProductionTaskWorkspace({
  scope,
  onScopeChange,
  selection,
  onSelectionChange,
  queryAllowed,
}: {
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  selection?: FormalSelection;
  onSelectionChange: (selection: FormalSelection) => void;
  queryAllowed: boolean;
}) {
  const [stateFilters, setStateFilters] =
    useState<TaskStateFilters>(emptyStateFilters);
  const periodInvalid =
    scope.coordinates.periodKey !== undefined &&
    !productionTaskPeriods.some(({ id }) => id === scope.coordinates.periodKey);
  const projections = useMemo(
    () =>
      projectDomainTasks(businessWorkFixtures, {
        domain: "production",
        scope,
        queryAllowed: queryAllowed && !periodInvalid,
        availablePeriodKeys: productionTaskPeriods.map(({ id }) => id),
      }),
    [periodInvalid, queryAllowed, scope],
  );
  const visible = projections.filter((projection) =>
    matchesStateFilters(projection, stateFilters),
  );
  const selected =
    selection?.type === "work-item"
      ? projections.find(({ item }) => item.workId === selection.id)
      : undefined;
  const invalidSelection =
    selection !== undefined &&
    (selection.type !== "work-item" || selected === undefined);
  const selectedDocument = selected
    ? productionDocumentFixtures.find(
        ({ workId }) => workId === selected.item.workId,
      )
    : undefined;
  return (
    <div className="unified-workspace production-task5-workspace">
      <WorkspaceHeader
        eyebrow="产情监测 / 产情任务"
        title="产情任务作业"
        summary="按期间处理采集、审核、质量与发布生命周期，同一任务始终打开同一份业务单据。"
      />
      <TaskFilters
        onScopeChange={onScopeChange}
        onStateFiltersChange={setStateFilters}
        scope={scope}
        stateFilters={stateFilters}
      />
      {!queryAllowed && (
        <div className="production-task5-alert" role="alert">
          当前业务坐标无权查询，系统未展示其他任务。
        </div>
      )}
      {periodInvalid && (
        <div className="production-task5-alert" role="alert">
          <strong>任务期间无效</strong>
          <span>系统没有回落到其他期间，请重新选择可用任务期间。</span>
        </div>
      )}
      {invalidSelection && (
        <div className="production-task5-alert" role="alert">
          <strong>任务不可用或无权查看</strong>
          <span>系统没有打开其他任务，请返回已授权任务台账选择。</span>
        </div>
      )}
      <section
        aria-label="产情任务台账区域"
        className="production-task5-ledger-region"
      >
        <header>
          <div>
            <h2>本期工作队列</h2>
            <p>
              {governedProductionName(
                productionPeriodNames,
                scope.coordinates.periodKey,
                "全部可用期间",
              )}
              · 全部状态维度独立保存
            </p>
          </div>
        </header>
        <div className="production-task5-ledger-scroll">
          <table
            aria-label="产情任务台账"
            className="production-task5-ledger production-task5-task-ledger"
          >
            <thead>
              <tr>
                <th className="production-task5-sticky" scope="col">
                  任务
                </th>
                <th scope="col">监测对象</th>
                <th scope="col">业务分类</th>
                <th scope="col">行政区划</th>
                <th scope="col">作物与具体品种</th>
                <th scope="col">任务期间</th>
                <th scope="col">截止</th>
                <th scope="col">责任人</th>
                <th scope="col">字段完成</th>
                <th scope="col">义务状态</th>
                <th scope="col">单据状态</th>
                <th scope="col">审核状态</th>
                <th scope="col">质量状态</th>
                <th scope="col">发布状态</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((projection) => {
                const { item } = projection;
                const statusValues = [
                  obligationLabels[item.obligationStatus],
                  documentLabels[item.documentStatus],
                  reviewLabels[item.reviewStatus],
                  qualityLabels[item.qualityStatus],
                  releaseLabels[item.releaseStatus],
                ];
                return (
                  <tr key={item.workId}>
                    <th className="production-task5-sticky" scope="row">
                      {item.title}
                    </th>
                    <td>{taskSubjectName(item)}</td>
                    <td>{item.businessLabel || "业务分类名称待维护"}</td>
                    <td>{item.regionLabel || "地区名称待维护"}</td>
                    <td>
                      {governedProductionName(
                        productionProductNames,
                        item.productId,
                        "产品名称待维护",
                      )}
                      {item.cultivarIds.length > 0
                        ? ` · ${item.cultivarIds
                            .map((id) =>
                              governedProductionName(
                                productionCultivarNames,
                                id,
                                "品种名称待维护",
                              ),
                            )
                            .join("、")}`
                        : ""}
                    </td>
                    <td>
                      {governedProductionName(
                        productionPeriodNames,
                        item.periodKey,
                        "任务期间待维护",
                      )}
                    </td>
                    <td>{formatProductionDateTime(item.deadline)}</td>
                    <td>
                      {item.responsiblePerson || "责任人待维护"} ·{" "}
                      {item.responsiblePost || "岗位待维护"}
                    </td>
                    <td>
                      {item.completedFields}/{item.applicableFields} 项
                    </td>
                    {statusValues.map((value, index) => (
                      <td key={`${item.workId}-state-${String(index)}`}>
                        <span
                          className={`production-task5-state ${stateTone(value)}`.trim()}
                        >
                          {value}
                        </span>
                      </td>
                    ))}
                    <td>
                      <button
                        className="production-task5-row-action"
                        type="button"
                        onClick={() =>
                          onSelectionChange({
                            type: "work-item",
                            id: item.workId,
                          })
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
        {queryAllowed && !periodInvalid && visible.length === 0 && (
          <div className="production-task5-empty" role="status">
            当前筛选下没有可处理的产情任务，系统未改变任何业务坐标。
          </div>
        )}
      </section>
      {selected && selectedDocument && !invalidSelection && (
        <ProductionDocumentWorkbench
          document={selectedDocument}
          item={selected.item}
          itemTitle={selected.item.title}
        />
      )}
      {selected && !selectedDocument && (
        <div className="production-task5-alert" role="alert">
          任务单据配置待维护，系统未打开其他单据。
        </div>
      )}
    </div>
  );
}
