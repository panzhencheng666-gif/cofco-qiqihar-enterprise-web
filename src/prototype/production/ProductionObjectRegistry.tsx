import { useId, useMemo, useState, type FormEvent } from "react";

import {
  getActiveObjectCapabilities,
  getEffectiveBusinessRoles,
  projectMonitoringObjects,
  type EffectiveBusinessRole,
  type MonitoringObject,
  type MonitoringObjectTypeId,
  type MonitoringSourceChannelId,
} from "../core/monitoringRegistry";
import type { OperationalScope } from "../core/operationalScope";
import {
  productionCapabilityTemplates,
  productionMonitoringObjects,
  productionRegistryAsOf,
} from "../data/monitoringRegistryFixtures";
import { getEnterpriseScopeRegion } from "../enterpriseRegions";
import type {
  BusinessCoordinates,
  FormalSelection,
} from "../formalEnterpriseModel";
import {
  governedProductionName,
  productionCultivarNames,
  productionProductNames,
} from "../productionMonitoringModel";
import { WorkspaceHeader } from "../UnifiedWorkspacePrimitives";

interface RegistryFilters {
  objectTypeId: string;
  sourceChannelId: string;
  validityStatus: string;
}

const emptyFilters: RegistryFilters = {
  objectTypeId: "",
  sourceChannelId: "",
  validityStatus: "",
};

function regionName(id: string): string {
  return getEnterpriseScopeRegion(id)?.label ?? "地区名称待维护";
}

function authorizedLabels(
  ids: readonly string[],
  labels: readonly string[],
  authorizedIds: readonly string[],
  missingLabel: string,
): readonly string[] {
  return ids
    .map((id, index) => ({ id, label: labels[index] ?? missingLabel }))
    .filter(({ id }) => authorizedIds.includes(id))
    .map(({ label }) => label || missingLabel);
}

function RegistryFilters({
  scope,
  authorizedObjects,
  filters,
  onScopeChange,
  onFiltersChange,
}: {
  scope: OperationalScope;
  authorizedObjects: readonly MonitoringObject[];
  filters: RegistryFilters;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  onFiltersChange: (filters: RegistryFilters) => void;
}) {
  const objectTypes = [
    ...new Map(
      authorizedObjects.map(
        ({ objectTypeId, objectTypeLabel }) =>
          [objectTypeId, objectTypeLabel || "对象类型名称待维护"] as const,
      ),
    ).entries(),
  ];
  const sources = [
    ...new Map(
      authorizedObjects.map(
        ({ sourceChannelId, sourceChannelLabel }) =>
          [
            sourceChannelId,
            sourceChannelLabel || "来源渠道名称待维护",
          ] as const,
      ),
    ).entries(),
  ];
  const objectTypeInvalid =
    filters.objectTypeId !== "" &&
    !objectTypes.some(([id]) => id === filters.objectTypeId);
  const sourceInvalid =
    filters.sourceChannelId !== "" &&
    !sources.some(([id]) => id === filters.sourceChannelId);
  return (
    <section
      aria-label="产情对象筛选"
      className="production-task5-filter-surface"
    >
      <div className="production-task5-filter-grid production-task5-filter-grid--registry">
        <label>
          <span>对象类型</span>
          <select
            aria-label="对象类型"
            value={filters.objectTypeId}
            onChange={(event) =>
              onFiltersChange({ ...filters, objectTypeId: event.target.value })
            }
          >
            <option value="">全部对象类型</option>
            {objectTypeInvalid && (
              <option disabled value={filters.objectTypeId}>
                对象类型不可用（请重新选择）
              </option>
            )}
            {objectTypes.map(([id, label]) => (
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
            {scope.authorization.authorizedRegionIds.map((id) => (
              <option key={id} value={id}>
                {regionName(id)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>作物</span>
          <select
            aria-label="作物"
            value={scope.coordinates.productId ?? ""}
            onChange={(event) =>
              onScopeChange({
                productId: event.target.value || undefined,
                cultivarId: undefined,
              })
            }
          >
            <option value="">全部已授权作物</option>
            {scope.authorization.authorizedProductIds.map((id) => (
              <option key={id} value={id}>
                {governedProductionName(
                  productionProductNames,
                  id,
                  "作物名称待维护",
                )}
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
            {scope.authorization.authorizedCultivarIds.map((id) => (
              <option key={id} value={id}>
                {governedProductionName(
                  productionCultivarNames,
                  id,
                  "品种名称待维护",
                )}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>来源渠道</span>
          <select
            aria-label="来源渠道"
            value={filters.sourceChannelId}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                sourceChannelId: event.target.value,
              })
            }
          >
            <option value="">全部来源渠道</option>
            {sourceInvalid && (
              <option disabled value={filters.sourceChannelId}>
                来源渠道不可用（请重新选择）
              </option>
            )}
            {sources.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>有效状态</span>
          <select
            aria-label="有效状态"
            value={filters.validityStatus}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                validityStatus: event.target.value,
              })
            }
          >
            <option value="">全部有效状态</option>
            <option value="active">当前有效</option>
            <option value="inactive">已停用</option>
          </select>
        </label>
      </div>
    </section>
  );
}

function ObjectEditor({
  object,
  authorizedObjects,
  onClose,
  onSave,
}: {
  object?: MonitoringObject;
  authorizedObjects: readonly MonitoringObject[];
  onClose: () => void;
  onSave: (object: MonitoringObject) => void;
}) {
  const localDraftId = useId();
  const productOptions = [
    ...new Map(
      authorizedObjects.flatMap((item) =>
        item.productIds.map(
          (id, index) =>
            [id, item.productLabels[index] ?? "作物名称待维护"] as const,
        ),
      ),
    ).entries(),
  ];
  const cultivarOptions = [
    ...new Map(
      authorizedObjects.flatMap((item) =>
        item.cultivarIds.map(
          (id, index) =>
            [id, item.cultivarLabels[index] ?? "品种名称待维护"] as const,
        ),
      ),
    ).entries(),
  ];
  const objectTypeOptions = [
    ...new Map(
      authorizedObjects.map(
        (item) => [item.objectTypeId, item.objectTypeLabel] as const,
      ),
    ).entries(),
  ];
  const regionOptions = [
    ...new Map(
      authorizedObjects.map(
        (item) => [item.regionId, item.regionLabel] as const,
      ),
    ).entries(),
  ];
  const sourceOptions = [
    ...new Map(
      authorizedObjects.map(
        (item) => [item.sourceChannelId, item.sourceChannelLabel] as const,
      ),
    ).entries(),
  ];
  const people = [
    ...new Map(
      authorizedObjects.map(
        (item) => [item.responsibleUserId, item.responsiblePerson] as const,
      ),
    ).entries(),
  ];
  const roleDefinitions = [
    ...new Map(
      authorizedObjects
        .flatMap((item) => item.roles)
        .map((role) => [role.roleId, role] as const),
    ).values(),
  ];
  const productOptionIds = productOptions.map(([id]) => id);
  const cultivarOptionIds = cultivarOptions.map(([id]) => id);
  const roleOptionIds = roleDefinitions.map(({ roleId }) => roleId);
  const [regionId, setRegionId] = useState(object?.regionId ?? "");
  const [selectedProductIds, setSelectedProductIds] = useState<
    readonly string[]
  >(object?.productIds.filter((id) => productOptionIds.includes(id)) ?? []);
  const [selectedCultivarIds, setSelectedCultivarIds] = useState<
    readonly string[]
  >(object?.cultivarIds.filter((id) => cultivarOptionIds.includes(id)) ?? []);
  const [selectedRoleIds, setSelectedRoleIds] = useState<readonly string[]>(
    object?.roles
      .map(({ roleId }) => roleId)
      .filter((id) => roleOptionIds.includes(id)) ?? [],
  );
  const [rolePeriods, setRolePeriods] = useState<
    Record<string, { from: string; to: string }>
  >(
    Object.fromEntries(
      (object?.roles ?? []).map((role) => [
        role.roleId,
        {
          from: role.effectiveFrom,
          to: role.effectiveTo ?? "",
        },
      ]),
    ),
  );
  const [message, setMessage] = useState<{
    kind: "alert" | "status";
    text: string;
  }>();
  const toggle = (
    id: string,
    current: readonly string[],
    setCurrent: (ids: readonly string[]) => void,
  ) =>
    setCurrent(
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (field: string) => {
      const entry = data.get(field);
      return typeof entry === "string" ? entry : "";
    };
    const requiredFields = [
      ["objectName", "请填写对象名称"],
      ["objectTypeId", "请选择治理对象类型"],
      ["regionId", "请选择已授权行政区划"],
      ["sourceChannelId", "请选择治理来源渠道"],
      ["responsibleUserId", "请选择责任人"],
      ["validityStatus", "请选择有效状态"],
    ] as const;
    const errors: string[] = requiredFields
      .filter(([field]) => !value(field).trim())
      .map(([, label]) => label);
    if (selectedProductIds.length === 0)
      errors.push("请选择至少一种已授权作物");
    if (selectedRoleIds.length === 0) errors.push("请选择至少一个有效业务角色");
    if (selectedRoleIds.some((id) => !(rolePeriods[id]?.from ?? "").trim())) {
      errors.push("请填写每个业务角色的生效日期");
    }
    if (errors.length > 0) {
      setMessage({ kind: "alert", text: `${errors.join("；")}。` });
      return;
    }
    const responsibleUserId = value("responsibleUserId");
    const hiddenProducts = (object?.productIds ?? []).flatMap((id, index) =>
      productOptionIds.includes(id)
        ? []
        : [[id, object?.productLabels[index] ?? "作物名称待维护"] as const],
    );
    const hiddenCultivars = (object?.cultivarIds ?? []).flatMap((id, index) =>
      cultivarOptionIds.includes(id)
        ? []
        : [[id, object?.cultivarLabels[index] ?? "品种名称待维护"] as const],
    );
    const products = [
      ...hiddenProducts,
      ...selectedProductIds.map(
        (id) =>
          [
            id,
            productOptions.find(([optionId]) => optionId === id)?.[1] ??
              "作物名称待维护",
          ] as const,
      ),
    ];
    const cultivars = [
      ...hiddenCultivars,
      ...selectedCultivarIds.map(
        (id) =>
          [
            id,
            cultivarOptions.find(([optionId]) => optionId === id)?.[1] ??
              "品种名称待维护",
          ] as const,
      ),
    ];
    const hiddenRoles = (object?.roles ?? []).filter(
      ({ roleId }) => !roleOptionIds.includes(roleId),
    );
    const selectedRoles = selectedRoleIds.flatMap(
      (roleId): EffectiveBusinessRole[] => {
        const definition = roleDefinitions.find(
          (role) => role.roleId === roleId,
        );
        if (!definition) return [];
        return [
          {
            ...definition,
            effectiveFrom: rolePeriods[roleId]?.from ?? "",
            effectiveTo: rolePeriods[roleId]?.to || null,
          },
        ];
      },
    );
    const roles = [...hiddenRoles, ...selectedRoles];
    onSave({
      objectId: object?.objectId ?? `OBJ-LOCAL-DRAFT-${localDraftId}`,
      objectName: value("objectName"),
      objectTypeId: value("objectTypeId") as MonitoringObjectTypeId,
      objectTypeLabel:
        objectTypeOptions.find(([id]) => id === value("objectTypeId"))?.[1] ??
        "对象类型名称待维护",
      regionId: value("regionId"),
      regionLabel:
        regionOptions.find(([id]) => id === value("regionId"))?.[1] ??
        "地区名称待维护",
      productIds: products.map(([id]) => id),
      productLabels: products.map(([, label]) => label),
      cultivarIds: cultivars.map(([id]) => id),
      cultivarLabels: cultivars.map(([, label]) => label),
      sourceChannelId: value("sourceChannelId") as MonitoringSourceChannelId,
      sourceChannelLabel:
        sourceOptions.find(([id]) => id === value("sourceChannelId"))?.[1] ??
        "来源渠道名称待维护",
      responsibleUserId,
      responsiblePerson:
        people.find(([id]) => id === responsibleUserId)?.[1] ??
        "责任人名称待维护",
      effectiveFrom: object?.effectiveFrom ?? roles[0]?.effectiveFrom ?? "",
      effectiveTo: object?.effectiveTo ?? null,
      validityStatus: value(
        "validityStatus",
      ) as MonitoringObject["validityStatus"],
      roles,
    });
  };
  return (
    <form
      aria-label={object ? "编辑监测对象" : "新增监测对象"}
      className="production-task5-object-editor"
      onSubmit={save}
    >
      <header>
        <h2>{object ? "编辑监测对象" : "新增监测对象"}</h2>
        <button type="button" onClick={onClose}>
          取消
        </button>
      </header>
      <div className="production-task5-filter-grid">
        <label>
          <span>对象名称</span>
          <input
            aria-label="对象名称"
            name="objectName"
            defaultValue={object?.objectName ?? ""}
          />
        </label>
        <label>
          <span>对象类型</span>
          <select
            aria-label="编辑对象类型"
            name="objectTypeId"
            defaultValue={object?.objectTypeId ?? ""}
          >
            <option value="">请选择治理对象类型</option>
            {objectTypeOptions.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>行政区划</span>
          <select
            aria-label="编辑行政区划"
            name="regionId"
            value={regionId}
            onChange={(event) => setRegionId(event.target.value)}
          >
            <option value="">请选择已授权行政区划</option>
            {regionOptions.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <fieldset aria-label="编辑作物">
          <legend>作物（可多选）</legend>
          {productOptions.map(([id, label]) => (
            <label key={id}>
              <input
                type="checkbox"
                checked={selectedProductIds.includes(id)}
                onChange={() =>
                  toggle(id, selectedProductIds, setSelectedProductIds)
                }
              />
              {label}
            </label>
          ))}
        </fieldset>
        <fieldset aria-label="编辑具体品种">
          <legend>具体品种（可多选）</legend>
          {cultivarOptions.map(([id, label]) => (
            <label key={id}>
              <input
                type="checkbox"
                checked={selectedCultivarIds.includes(id)}
                onChange={() =>
                  toggle(id, selectedCultivarIds, setSelectedCultivarIds)
                }
              />
              {label}
            </label>
          ))}
        </fieldset>
        <label>
          <span>来源渠道</span>
          <select
            aria-label="编辑来源渠道"
            name="sourceChannelId"
            defaultValue={object?.sourceChannelId ?? ""}
          >
            <option value="">请选择治理来源渠道</option>
            {sourceOptions.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>责任人</span>
          <select
            aria-label="编辑责任人"
            name="responsibleUserId"
            defaultValue={object?.responsibleUserId ?? ""}
          >
            <option value="">请选择责任人</option>
            {people.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>有效状态</span>
          <select
            aria-label="编辑有效状态"
            name="validityStatus"
            defaultValue={object?.validityStatus ?? ""}
          >
            <option value="">请选择有效状态</option>
            <option value="active">当前有效</option>
            <option value="inactive">已停用</option>
          </select>
        </label>
        <fieldset aria-label="编辑业务角色">
          <legend>业务角色与有效区间（可多选）</legend>
          {roleDefinitions.map((role) => {
            const selected = selectedRoleIds.includes(role.roleId);
            const period = rolePeriods[role.roleId] ?? { from: "", to: "" };
            return (
              <div key={role.roleId}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() =>
                      toggle(role.roleId, selectedRoleIds, setSelectedRoleIds)
                    }
                  />
                  {role.label}
                </label>
                <label>
                  <span>{role.label}角色生效日期</span>
                  <input
                    aria-label={`${role.label}角色生效日期`}
                    disabled={!selected}
                    type="date"
                    value={period.from}
                    onChange={(event) =>
                      setRolePeriods((current) => ({
                        ...current,
                        [role.roleId]: { ...period, from: event.target.value },
                      }))
                    }
                  />
                </label>
                <label>
                  <span>{role.label}角色失效日期</span>
                  <input
                    aria-label={`${role.label}角色失效日期`}
                    disabled={!selected}
                    type="date"
                    value={period.to}
                    onChange={(event) =>
                      setRolePeriods((current) => ({
                        ...current,
                        [role.roleId]: { ...period, to: event.target.value },
                      }))
                    }
                  />
                </label>
              </div>
            );
          })}
        </fieldset>
      </div>
      <button className="production-task5-primary" type="submit">
        保存对象草稿
      </button>
      {message && <p role={message.kind}>{message.text}</p>}
    </form>
  );
}

function ObjectDetail({
  object,
  onEdit,
}: {
  object: MonitoringObject;
  onEdit: () => void;
}) {
  const effectiveRoles = getEffectiveBusinessRoles(
    object,
    productionRegistryAsOf,
  );
  const capabilities = getActiveObjectCapabilities(
    object,
    productionCapabilityTemplates,
    productionRegistryAsOf,
  );
  return (
    <aside
      aria-label={`${object.objectName}对象详情`}
      className="production-task5-object-detail"
    >
      <header>
        <div>
          <span>对象详情</span>
          <h2>{object.objectName}</h2>
          <p>
            {object.objectTypeLabel} · {object.regionLabel}
          </p>
        </div>
        <button type="button" onClick={onEdit}>
          编辑对象
        </button>
      </header>
      <section>
        <h3>当前业务角色</h3>
        <ul>
          {effectiveRoles.map((role) => (
            <li key={role.roleId}>{role.label}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3>当前适用能力</h3>
        {capabilities.map((capability) => (
          <div key={`${capability.roleLabel}-${capability.templateLabel}`}>
            <strong>
              {capability.roleLabel} · {capability.templateLabel}
            </strong>
            <ul>
              {capability.capabilityLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </aside>
  );
}

export function ProductionObjectRegistry({
  scope,
  onScopeChange,
  selection,
  onSelectionChange,
  queryAllowed = true,
}: {
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  selection?: FormalSelection;
  onSelectionChange: (selection: FormalSelection) => void;
  queryAllowed?: boolean;
}) {
  const [filters, setFilters] = useState<RegistryFilters>(emptyFilters);
  const [editor, setEditor] = useState<"create" | "edit" | null>(null);
  const [registryObjects, setRegistryObjects] = useState<
    readonly MonitoringObject[]
  >(productionMonitoringObjects);
  const [savedDraftName, setSavedDraftName] = useState<string>();
  const authorizedObjects = useMemo(
    () => projectMonitoringObjects(registryObjects, scope, queryAllowed),
    [queryAllowed, registryObjects, scope],
  );
  const rows = useMemo(
    () =>
      authorizedObjects.filter((object) => {
        return (
          (!filters.objectTypeId ||
            object.objectTypeId === filters.objectTypeId) &&
          (!filters.sourceChannelId ||
            object.sourceChannelId === filters.sourceChannelId) &&
          (!filters.validityStatus ||
            object.validityStatus === filters.validityStatus)
        );
      }),
    [authorizedObjects, filters],
  );
  const selected =
    selection?.type === "object"
      ? rows.find(({ objectId }) => objectId === selection.id)
      : undefined;
  const selectedSource = selected
    ? registryObjects.find(({ objectId }) => objectId === selected.objectId)
    : undefined;
  const invalidSelection =
    selection !== undefined &&
    (selection.type !== "object" || selected === undefined);
  return (
    <div className="unified-workspace production-task5-workspace">
      <WorkspaceHeader
        eyebrow="产情监测 / 监测对象"
        title="产情对象名录"
        summary="维护跨期间稳定对象身份、类型、地区、品种、来源和有效角色。"
        actions={
          <button
            className="production-task5-primary"
            type="button"
            onClick={() => setEditor("create")}
          >
            新增监测对象
          </button>
        }
      />
      <RegistryFilters
        authorizedObjects={authorizedObjects}
        filters={filters}
        onFiltersChange={setFilters}
        onScopeChange={onScopeChange}
        scope={scope}
      />
      {savedDraftName && (
        <p role="status">
          {savedDraftName}对象草稿已保存，并已写入当前对象名录草稿。
        </p>
      )}
      {invalidSelection && (
        <div className="production-task5-alert" role="alert">
          对象不可用或无权查看，系统未打开其他对象。
        </div>
      )}
      <section
        aria-label="产情对象名录区域"
        className="production-task5-ledger-region"
      >
        <div className="production-task5-ledger-scroll">
          <table
            aria-label="产情监测对象名录"
            className="production-task5-ledger production-task5-object-ledger"
          >
            <thead>
              <tr>
                <th className="production-task5-sticky" scope="col">
                  对象名称
                </th>
                <th scope="col">对象类型</th>
                <th scope="col">行政区划</th>
                <th scope="col">作物</th>
                <th scope="col">具体品种</th>
                <th scope="col">来源渠道</th>
                <th scope="col">责任人</th>
                <th scope="col">有效状态</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((object) => {
                const products = authorizedLabels(
                  object.productIds,
                  object.productLabels,
                  scope.authorization.authorizedProductIds,
                  "作物名称待维护",
                );
                const cultivars = authorizedLabels(
                  object.cultivarIds,
                  object.cultivarLabels,
                  scope.authorization.authorizedCultivarIds,
                  "品种名称待维护",
                );
                return (
                  <tr key={object.objectId}>
                    <th className="production-task5-sticky" scope="row">
                      {object.objectName}
                    </th>
                    <td>{object.objectTypeLabel || "对象类型名称待维护"}</td>
                    <td>{object.regionLabel || "地区名称待维护"}</td>
                    <td>{products.join("、") || "当前无可查看作物"}</td>
                    <td>{cultivars.join("、") || "未指定具体品种"}</td>
                    <td>{object.sourceChannelLabel || "来源渠道名称待维护"}</td>
                    <td>{object.responsiblePerson || "责任人待维护"}</td>
                    <td>
                      <span
                        className={`production-task5-state ${object.validityStatus === "active" ? "is-good" : ""}`}
                      >
                        {object.validityStatus === "active"
                          ? "当前有效"
                          : "已停用"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="production-task5-row-action"
                        type="button"
                        aria-label={`查看${object.objectName}`}
                        onClick={() =>
                          onSelectionChange({
                            type: "object",
                            id: object.objectId,
                          })
                        }
                      >
                        查看详情
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <div className="production-task5-empty" role="status">
            当前筛选下没有可查看的监测对象，系统未改变业务坐标。
          </div>
        )}
      </section>
      {editor && (
        <ObjectEditor
          authorizedObjects={authorizedObjects}
          object={editor === "edit" ? selectedSource : undefined}
          onClose={() => setEditor(null)}
          onSave={(draft) => {
            setRegistryObjects((current) =>
              current.some(({ objectId }) => objectId === draft.objectId)
                ? current.map((item) =>
                    item.objectId === draft.objectId ? draft : item,
                  )
                : [...current, draft],
            );
            setSavedDraftName(draft.objectName);
            setEditor(null);
          }}
        />
      )}
      {selected && !invalidSelection && (
        <ObjectDetail object={selected} onEdit={() => setEditor("edit")} />
      )}
    </div>
  );
}
