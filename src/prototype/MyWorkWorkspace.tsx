import { useMemo, useState } from "react";

import {
  projectMyWork,
  type BusinessWorkProjection,
} from "./application/businessWorkProjection";
import type { BusinessWorkItem } from "./core/businessWork";
import { businessClassifications } from "./core/businessClassification";
import type { OperationalScope } from "./core/operationalScope";
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
  productionProductNames,
} from "./productionMonitoringModel";
import {
  FormalWorkspaceScopeProvider,
  WorkspaceHeader,
  WorkspaceTabs,
} from "./UnifiedWorkspacePrimitives";

type MyWorkView = "全部工作" | BusinessWorkProjection["savedViewGroup"];

const viewLabels: readonly MyWorkView[] = [
  "全部工作",
  "待填报",
  "待审核",
  "异常逾期",
  "待发布",
  "已办",
];

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
  superseded: "已被新版本替代",
};

interface GovernedIdentity {
  personName: string;
  postName: string;
}

function resolveGovernedIdentity(scope: OperationalScope): GovernedIdentity {
  const workResponsibility = businessWorkFixtures.find(
    ({ responsibleUserId }) => responsibleUserId === scope.identity.userId,
  );
  const reviewAssignment = businessWorkFixtures.find(
    ({ reviewerUserId }) => reviewerUserId === scope.identity.userId,
  );
  return {
    personName:
      workResponsibility?.responsiblePerson ||
      reviewAssignment?.reviewer ||
      "人员姓名待维护",
    postName:
      workResponsibility?.responsiblePost ||
      (reviewAssignment ? "业务审核岗" : "岗位名称待维护"),
  };
}

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
    return governedProductionName(
      productionProductNames,
      item.productId,
      "产品名称待维护",
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
  const domainIds = Object.keys(domainLabels);
  const classificationKnown = coordinates.businessSubtypeId
    ? businessClassifications.some(
        ({ id }) =>
          id === coordinates.businessSubtypeId ||
          id.endsWith(`.${coordinates.businessSubtypeId}`),
      )
    : true;
  return (
    authorization.permissionKeys.includes("prototype:read") &&
    (coordinates.regionId === "authorized-all" ||
      authorization.authorizedRegionIds.includes(
        coordinates.regionId as (typeof authorization.authorizedRegionIds)[number],
      )) &&
    (!coordinates.businessDomainId ||
      domainIds.includes(coordinates.businessDomainId)) &&
    classificationKnown &&
    (!coordinates.businessSubtypeId ||
      hasAuthorizedClassification(scope, coordinates.businessSubtypeId)) &&
    (!coordinates.productId ||
      authorization.authorizedProductIds.includes(coordinates.productId)) &&
    (!coordinates.cultivarId ||
      authorization.authorizedCultivarIds.includes(coordinates.cultivarId)) &&
    (!coordinates.periodKey ||
      availablePeriodKeys.includes(coordinates.periodKey)) &&
    (!coordinates.releaseVersion ||
      authorization.authorizedReleaseVersionIds.includes(
        coordinates.releaseVersion,
      ))
  );
}

function availablePeriodOptions(): readonly { id: string; label: string }[] {
  const options = new Map<string, string>();
  for (const item of businessWorkFixtures) {
    if (!options.has(item.periodKey)) {
      options.set(item.periodKey, governedPeriodName(item));
    }
  }
  return [...options].map(([id, label]) => ({ id, label }));
}

const myWorkPeriodOptions = availablePeriodOptions();
const myWorkPeriodKeys = myWorkPeriodOptions.map(({ id }) => id);

function Filters({
  scope,
  onScopeChange,
}: {
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
}) {
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
  const productOptions = scope.authorization.authorizedProductIds.map((id) => ({
    id,
    label: governedProductionName(productionProductNames, id, "产品名称待维护"),
  }));
  const periods = myWorkPeriodOptions;
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
    !productOptions.some(({ id }) => id === scope.coordinates.productId);

  return (
    <section aria-label="我的工作筛选" className="my-work-task5-filter-surface">
      <div className="my-work-task5-filter-grid">
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
            <option value="">全部已授权产品</option>
            {productInvalid && (
              <option disabled value={scope.coordinates.productId}>
                产品名称无效（请重新选择）
              </option>
            )}
            {productOptions.map(({ id, label }) => (
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
    </section>
  );
}

export function FormalMyWorkWorkspace({
  section,
  scope,
  onScopeChange,
  onOpenBusiness,
}: {
  section: WorkSection;
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  onOpenBusiness: (route: FormalRoute, selection?: FormalSelection) => void;
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
      />
    </FormalWorkspaceScopeProvider>
  );
}

export function MyWorkWorkspace({
  section,
  scope,
  onScopeChange,
  onOpenBusiness,
}: {
  section: WorkSection;
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  onOpenBusiness: (route: FormalRoute, selection?: FormalSelection) => void;
}) {
  if (section !== "tasks") return null;
  return (
    <MyWorkLedger
      onOpenBusiness={onOpenBusiness}
      onScopeChange={onScopeChange}
      scope={scope}
    />
  );
}

function MyWorkLedger({
  scope,
  onScopeChange,
  onOpenBusiness,
}: {
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  onOpenBusiness: (route: FormalRoute, selection?: FormalSelection) => void;
}) {
  const [activeView, setActiveView] = useState<MyWorkView>("全部工作");
  const identity = resolveGovernedIdentity(scope);
  const queryAllowed = scopeAllowsQuery(scope, myWorkPeriodKeys);
  const projections = useMemo(
    () =>
      projectMyWork(businessWorkFixtures, {
        userId: scope.identity.userId,
        scope,
        queryAllowed,
        availablePeriodKeys: myWorkPeriodKeys,
      }),
    [queryAllowed, scope],
  );
  const counts = new Map<MyWorkView, number>([
    ["全部工作", projections.length],
  ]);
  for (const view of viewLabels.slice(1)) {
    counts.set(
      view,
      projections.filter(({ savedViewGroup }) => savedViewGroup === view)
        .length,
    );
  }
  const visible =
    activeView === "全部工作"
      ? projections
      : projections.filter(
          ({ savedViewGroup }) => savedViewGroup === activeView,
        );

  return (
    <div className="unified-workspace my-work-task5-workspace">
      <WorkspaceHeader
        eyebrow="统一工作门户 / 我的工作"
        title="我的工作"
        summary="汇集本人负责和本人审核的跨业务事项，状态独立、来源一致，并直达原业务单据。"
      />
      <section
        aria-label="当前责任身份"
        className="my-work-task5-identity-line"
      >
        <strong>{identity.personName}</strong>
        <span>{identity.postName}</span>
        <span>{scope.workUnit.label || "工作单位名称待维护"}</span>
        <span>仅展示本人负责或审核事项</span>
      </section>
      <Filters onScopeChange={onScopeChange} scope={scope} />
      <div className="my-work-task5-views">
        <WorkspaceTabs
          active={activeView}
          label="我的工作状态视图"
          onChange={(key) => setActiveView(key as MyWorkView)}
          tabs={viewLabels.map((label) => ({
            key: label,
            label,
            count: String(counts.get(label) ?? 0),
          }))}
        />
      </div>
      {!queryAllowed && (
        <div className="my-work-task5-alert" role="alert">
          <strong>当前业务坐标无权查询</strong>
          <span>
            系统没有回落到其他地区、分类、产品或期间，请重新选择已授权范围。
          </span>
        </div>
      )}
      <section
        aria-label="本人工作台账区域"
        className="my-work-task5-ledger-region"
      >
        <header>
          <div>
            <h2>统一责任任务台账</h2>
            <p>本人负责与本人审核事项共用同一业务来源，五类状态分别记录。</p>
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
                  任务
                </th>
                <th scope="col">业务域</th>
                <th scope="col">业务分类</th>
                <th scope="col">业务对象</th>
                <th scope="col">业务地区</th>
                <th scope="col">产品或作物</th>
                <th scope="col">任务期间</th>
                <th scope="col">截止时间</th>
                <th scope="col">责任分工</th>
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
                const cultivars = governedCultivarNames(item);
                const states = [
                  obligationLabels[item.obligationStatus],
                  documentLabels[item.documentStatus],
                  reviewLabels[item.reviewStatus],
                  qualityLabels[item.qualityStatus],
                  releaseLabels[item.releaseStatus],
                ];
                const isResponsible =
                  item.responsibleUserId === scope.identity.userId;
                return (
                  <tr key={item.workId}>
                    <th className="my-work-task5-sticky" scope="row">
                      {item.title || "任务名称待维护"}
                    </th>
                    <td>{domainLabels[item.domain]}</td>
                    <td>{item.businessLabel || "业务分类名称待维护"}</td>
                    <td>{governedSubjectName(item)}</td>
                    <td>{item.regionLabel || "地区名称待维护"}</td>
                    <td>
                      {governedProductName(item)}
                      {cultivars ? ` · ${cultivars}` : ""}
                    </td>
                    <td>{governedPeriodName(item)}</td>
                    <td>{formatProductionDateTime(item.deadline)}</td>
                    <td>
                      <strong>
                        {item.responsiblePerson || "责任人待维护"} ·{" "}
                        {item.responsiblePost || "责任岗位待维护"}
                      </strong>
                      <small>{isResponsible ? "本人负责" : "本人审核"}</small>
                    </td>
                    <td>
                      {item.completedFields}/{item.applicableFields} 项
                    </td>
                    {states.map((label, index) => (
                      <td key={`${item.workId}-state-${String(index)}`}>
                        <span
                          className={`my-work-task5-state ${stateTone(label)}`.trim()}
                        >
                          {label}
                        </span>
                      </td>
                    ))}
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
        {queryAllowed && visible.length === 0 && (
          <div className="my-work-task5-empty" role="status">
            当前筛选或状态视图下没有本人事项，系统未改变任何业务坐标。
          </div>
        )}
      </section>
    </div>
  );
}
