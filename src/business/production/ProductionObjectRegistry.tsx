import { useEffect, useId, useMemo, useState, type FormEvent } from "react";

import type {
  MasterDataSnapshot,
  ProductionObjectMutation,
  ProductionObjectRow,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";

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
  getApplicableCultivars,
  platformCultivars,
  platformProducts,
  type PlatformCultivarId,
  type PlatformProductId,
} from "../core/platformMasterData";
import {
  productionBusinessRoleMasterData,
  productionCapabilityTemplates,
  productionMonitoringObjects,
  productionObjectTypeMasterData,
  productionRegistryAsOf,
  productionResponsiblePeopleMasterData,
  productionSourceChannelMasterData,
} from "../data/monitoringRegistryFixtures";
import {
  enterpriseRegionGroups,
  getEnterpriseScopeRegion,
} from "../enterpriseRegions";
import type {
  BusinessCoordinates,
  FormalSelection,
} from "../formalEnterpriseModel";
import {
  governedProductionName,
  productionCultivarNames,
  productionProductNames,
} from "../productionMonitoringModel";
import {
  WorkspaceHeader,
  WorkspacePagination,
} from "../UnifiedWorkspacePrimitives";

interface RegistryFilters {
  objectTypeId: string;
  sourceChannelId: string;
  validityStatus: string;
}

interface PersistedMonitoringObject extends MonitoringObject {
  version: number;
}

function monitoringObjectFromRow(
  row: ProductionObjectRow,
): PersistedMonitoringObject {
  return {
    objectId: row.objectId,
    objectName: row.objectName,
    objectTypeId: row.objectTypeId as MonitoringObjectTypeId,
    objectTypeLabel: row.objectTypeLabel,
    regionId: row.regionCode,
    regionLabel: row.regionName,
    productIds: row.productIds,
    productLabels: row.productLabels,
    cultivarIds: row.cultivarIds,
    cultivarLabels: row.cultivarLabels,
    sourceChannelId: row.sourceChannelId as MonitoringSourceChannelId,
    sourceChannelLabel: row.sourceChannelLabel,
    responsibleUserId: row.responsibleUserId,
    responsiblePerson: row.responsiblePerson,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    validityStatus: row.validityStatus,
    roles: row.roles,
    version: row.version,
  };
}

function productionObjectMutation(
  object: MonitoringObject,
): ProductionObjectMutation {
  return {
    objectName: object.objectName,
    objectTypeId: object.objectTypeId,
    regionCode: object.regionId,
    productIds: object.productIds,
    cultivarIds: object.cultivarIds,
    sourceChannelId: object.sourceChannelId,
    effectiveFrom: object.effectiveFrom,
    effectiveTo: object.effectiveTo,
    validityStatus: object.validityStatus,
    roles: object.roles,
  };
}

const emptyFilters: RegistryFilters = {
  objectTypeId: "",
  sourceChannelId: "",
  validityStatus: "",
};

function regionName(id: string): string {
  return getEnterpriseScopeRegion(id)?.label ?? "未提供地区名称";
}

function formatChineseDate(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${year}年${month}月${day}日`;
}

function platformProductIdForBackend(
  code: string,
): PlatformProductId | undefined {
  const id = (
    code.toUpperCase() === "RICE" ? "paddy" : code.toLowerCase()
  ) as PlatformProductId;
  return platformProducts.some(
    (product) => product.id === id && productionProductNames[id] !== undefined,
  )
    ? id
    : undefined;
}

function productionProductLabel(
  productId: string | undefined,
  emptyLabel: string,
): string {
  if (!productId) return emptyLabel;
  return productionProductNames[productId] ?? "作物不可用（请重新选择）";
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const objectTypes = [
    ...new Map(
      authorizedObjects.map(
        ({ objectTypeId, objectTypeLabel }) =>
          [objectTypeId, objectTypeLabel || "未提供对象类型名称"] as const,
      ),
    ).entries(),
  ];
  const sources = [
    ...new Map(
      authorizedObjects.map(
        ({ sourceChannelId, sourceChannelLabel }) =>
          [
            sourceChannelId,
            sourceChannelLabel || "未提供来源渠道名称",
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
  const regions = [
    ...new Map(
      authorizedObjects
        .filter(({ regionId, regionLabel }) => regionId && regionLabel.trim())
        .map(({ regionId, regionLabel }) => [regionId, regionLabel] as const),
    ).entries(),
  ].map(([id, label]) => ({ id, label }));
  const authorizedProductionProducts = [
    ...new Map(
      authorizedObjects.flatMap((object) =>
        object.productIds.map(
          (id, index) =>
            [
              id,
              object.productLabels[index] ||
                governedProductionName(
                  productionProductNames,
                  id,
                  "未提供作物名称",
                ),
            ] as const,
        ),
      ),
    ).entries(),
  ].map(([id, label]) => ({ id, label }));
  const effectiveProductId =
    scope.coordinates.productId ??
    (authorizedProductionProducts.length === 1
      ? authorizedProductionProducts[0]?.id
      : undefined);
  const productInvalid =
    scope.coordinates.productId !== undefined &&
    !authorizedProductionProducts.some(
      ({ id }) => id === scope.coordinates.productId,
    );
  const applicableCultivars = effectiveProductId
    ? [
        ...new Map(
          authorizedObjects
            .filter(({ productIds }) => productIds.includes(effectiveProductId))
            .flatMap((object) =>
              object.cultivarIds.map(
                (id, index) =>
                  [
                    id,
                    object.cultivarLabels[index] || "未提供品种名称",
                  ] as const,
              ),
            )
            .filter(([id]) =>
              getApplicableCultivars(effectiveProductId).some(
                (candidate) => candidate.id === id,
              ),
            ),
        ).entries(),
      ].map(([id, label]) => ({ id, label }))
    : [];
  const regionInvalid =
    scope.coordinates.regionId !== "authorized-all" &&
    !regions.some(({ id }) => id === scope.coordinates.regionId);
  const cultivarInvalid =
    scope.coordinates.cultivarId !== undefined &&
    !applicableCultivars.some(({ id }) => id === scope.coordinates.cultivarId);
  const activeAdvancedCount =
    (scope.coordinates.cultivarId ? 1 : 0) + (filters.sourceChannelId ? 1 : 0);
  const validityOptions = [
    ...new Set(authorizedObjects.map(({ validityStatus }) => validityStatus)),
  ];
  const validityInvalid = Boolean(
    filters.validityStatus &&
    !validityOptions.includes(
      filters.validityStatus as MonitoringObject["validityStatus"],
    ),
  );
  const showAdvanced =
    applicableCultivars.length > 1 ||
    cultivarInvalid ||
    sources.length > 1 ||
    sourceInvalid;
  return (
    <section
      aria-label="产情对象筛选"
      className="production-task5-filter-surface"
    >
      <div className="production-task5-filter-grid production-task5-filter-grid--registry-primary">
        {(objectTypes.length > 1 || objectTypeInvalid) && (
          <label>
            <span>对象类型</span>
            <select
              aria-label="对象类型"
              value={filters.objectTypeId}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  objectTypeId: event.target.value,
                })
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
        )}
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
                  所选地区当前无对象（请重新选择）
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
        {(authorizedProductionProducts.length > 1 || productInvalid) && (
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
              <option value="">全部作物</option>
              {productInvalid && (
                <option disabled value={scope.coordinates.productId}>
                  作物不可用（请重新选择）
                </option>
              )}
              {authorizedProductionProducts.map(({ id, label }) => (
                <option key={id} value={id}>
                  {governedProductionName(productionProductNames, id, label)}
                </option>
              ))}
            </select>
          </label>
        )}
        {(validityOptions.length > 1 || validityInvalid) && (
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
              {validityInvalid && (
                <option disabled value={filters.validityStatus}>
                  所选状态当前无对象（请重新选择）
                </option>
              )}
              {validityOptions.includes("active") && (
                <option value="active">当前有效</option>
              )}
              {validityOptions.includes("inactive") && (
                <option value="inactive">已停用</option>
              )}
            </select>
          </label>
        )}
      </div>
      {showAdvanced && (
        <div className="production-task5-filter-actions">
          <button
            aria-controls="production-object-more-filters"
            aria-expanded={advancedOpen}
            className="production-task5-filter-toggle"
            type="button"
            onClick={() => setAdvancedOpen((current) => !current)}
          >
            {activeAdvancedCount > 0
              ? `更多筛选（已启用 ${activeAdvancedCount} 项）`
              : "更多筛选"}
          </button>
        </div>
      )}
      {showAdvanced && advancedOpen && (
        <div
          className="production-task5-filter-grid production-task5-filter-grid--registry-advanced"
          id="production-object-more-filters"
        >
          {(applicableCultivars.length > 1 || cultivarInvalid) && (
            <label>
              <span>具体品种</span>
              <select
                aria-label="具体品种"
                value={scope.coordinates.cultivarId ?? ""}
                onChange={(event) =>
                  onScopeChange({ cultivarId: event.target.value || undefined })
                }
              >
                <option value="">
                  {effectiveProductId ? "全部适用品种" : "请先选择作物"}
                </option>
                {cultivarInvalid && (
                  <option disabled value={scope.coordinates.cultivarId}>
                    品种不适用于当前作物（请重新选择）
                  </option>
                )}
                {applicableCultivars.map(({ id, label }) => (
                  <option key={id} value={id}>
                    {governedProductionName(productionCultivarNames, id, label)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(sources.length > 1 || sourceInvalid) && (
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
          )}
        </div>
      )}
    </section>
  );
}

function ObjectEditor({
  object,
  scope,
  masterData,
  onClose,
  onSave,
  serverBacked = false,
}: {
  object?: MonitoringObject;
  scope: OperationalScope;
  masterData?: MasterDataSnapshot;
  onClose: () => void;
  onSave: (object: MonitoringObject) => true | string | Promise<true | string>;
  serverBacked?: boolean;
}) {
  const localDraftId = useId();
  const productOptions = serverBacked
    ? (masterData?.products ?? []).flatMap(({ code, name }) => {
        const id = platformProductIdForBackend(code);
        return id ? ([[id, name]] as const) : [];
      })
    : platformProducts
        .filter(
          ({ id }) =>
            scope.authorization.authorizedProductIds.includes(id) &&
            productionProductNames[id] !== undefined,
        )
        .map(({ id, label }) => [id, label] as const);
  const authorizedCultivarOptions = platformCultivars
    .filter(({ id }) => scope.authorization.authorizedCultivarIds.includes(id))
    .map(({ id, label, applicableProductIds }) => ({
      id,
      label,
      applicableProductIds,
    }));
  const objectTypeOptions = [
    ...new Map([
      ...productionObjectTypeMasterData.map(
        ({ id, label }) => [id, label] as const,
      ),
      ...(object
        ? [[object.objectTypeId, object.objectTypeLabel] as const]
        : []),
    ]).entries(),
  ];
  const authoritativeRegionNames = new Map(
    (masterData?.regions ?? []).map(({ code, name }) => [code, name] as const),
  );
  const regionOptions = serverBacked
    ? scope.authorization.authorizedRegionIds.flatMap((id) => {
        const label =
          authoritativeRegionNames.get(id) ??
          (object?.regionId === id ? object.regionLabel : undefined);
        return label ? ([[id, label]] as const) : [];
      })
    : enterpriseRegionGroups
        .flatMap(({ regions }) => regions)
        .filter(({ id }) =>
          scope.authorization.authorizedRegionIds.includes(id),
        )
        .map(({ id, label }) => [id, label] as const);
  const sourceOptions = [
    ...new Map([
      ...productionSourceChannelMasterData.map(
        ({ id, label }) => [id, label] as const,
      ),
      ...(object
        ? [[object.sourceChannelId, object.sourceChannelLabel] as const]
        : []),
    ]).entries(),
  ];
  const people = [
    ...new Map([
      ...productionResponsiblePeopleMasterData.map(
        ({ id, label }) => [id, label] as const,
      ),
      ...(object
        ? [[object.responsibleUserId, object.responsiblePerson] as const]
        : []),
    ]).entries(),
  ];
  const roleDefinitions = [
    ...new Map(
      [...productionBusinessRoleMasterData, ...(object?.roles ?? [])].map(
        (role) => [role.roleId, role] as const,
      ),
    ).values(),
  ];
  const productOptionIds = productOptions.map(([id]) => id);
  const authorizedCultivarOptionIds = authorizedCultivarOptions.map(
    ({ id }) => id,
  );
  const roleOptionIds = roleDefinitions.map(({ roleId }) => roleId);
  const [regionId, setRegionId] = useState(object?.regionId ?? "");
  const [selectedProductIds, setSelectedProductIds] = useState<
    readonly PlatformProductId[]
  >(
    object?.productIds.filter((id): id is PlatformProductId =>
      productOptionIds.some((optionId) => optionId === id),
    ) ?? [],
  );
  const [selectedCultivarIds, setSelectedCultivarIds] = useState<
    readonly PlatformCultivarId[]
  >(
    object?.cultivarIds.filter((id): id is PlatformCultivarId => {
      const cultivar = authorizedCultivarOptions.find(
        (option) => option.id === id,
      );
      return (
        cultivar !== undefined &&
        cultivar.applicableProductIds.some((productId) =>
          (object.productIds ?? []).includes(productId),
        )
      );
    }) ?? [],
  );
  const cultivarOptions = authorizedCultivarOptions.filter(
    ({ applicableProductIds }) =>
      applicableProductIds.some((productId) =>
        selectedProductIds.includes(productId),
      ),
  );
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
  const toggle = <Id extends string>(
    id: Id,
    current: readonly Id[],
    setCurrent: (ids: readonly Id[]) => void,
  ) =>
    setCurrent(
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  const toggleProduct = (id: PlatformProductId) => {
    const nextProductIds = selectedProductIds.includes(id)
      ? selectedProductIds.filter((value) => value !== id)
      : [...selectedProductIds, id];
    const nextApplicableCultivars = new Set(
      authorizedCultivarOptions
        .filter(({ applicableProductIds }) =>
          applicableProductIds.some((productId) =>
            nextProductIds.includes(productId),
          ),
        )
        .map(({ id: cultivarId }) => cultivarId),
    );
    setSelectedProductIds(nextProductIds);
    setSelectedCultivarIds((current) =>
      current.filter((cultivarId) => nextApplicableCultivars.has(cultivarId)),
    );
  };
  const [saving, setSaving] = useState(false);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (field: string) => {
      const entry = data.get(field);
      return typeof entry === "string" ? entry : "";
    };
    const requiredFields = [
      ["objectName", "请填写对象名称"],
      ["objectTypeId", "请选择对象类型"],
      ["regionId", "请选择已授权行政区划"],
      ["sourceChannelId", "请选择来源渠道"],
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
    const responsibleUserId = serverBacked
      ? (object?.responsibleUserId ?? scope.identity.userId)
      : value("responsibleUserId");
    const hiddenProducts = (object?.productIds ?? []).flatMap((id, index) =>
      productOptionIds.some((optionId) => optionId === id)
        ? []
        : [[id, object?.productLabels[index] ?? "作物名称未提供"] as const],
    );
    const hiddenCultivars = (object?.cultivarIds ?? []).flatMap((id, index) =>
      authorizedCultivarOptionIds.some((optionId) => optionId === id)
        ? []
        : [[id, object?.cultivarLabels[index] ?? "品种名称未提供"] as const],
    );
    const products = [
      ...hiddenProducts,
      ...selectedProductIds.map(
        (id) =>
          [
            id,
            productOptions.find(([optionId]) => optionId === id)?.[1] ??
              "作物名称未提供",
          ] as const,
      ),
    ];
    const cultivars = [
      ...hiddenCultivars,
      ...selectedCultivarIds.map(
        (id) =>
          [
            id,
            authorizedCultivarOptions.find(
              ({ id: optionId }) => optionId === id,
            )?.label ?? "品种名称未提供",
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
    setSaving(true);
    const result = await onSave({
      objectId: object?.objectId ?? `OBJ-LOCAL-DRAFT-${localDraftId}`,
      objectName: value("objectName"),
      objectTypeId: value("objectTypeId") as MonitoringObjectTypeId,
      objectTypeLabel:
        objectTypeOptions.find(([id]) => id === value("objectTypeId"))?.[1] ??
        "对象类型名称未提供",
      regionId: value("regionId"),
      regionLabel:
        regionOptions.find(([id]) => id === value("regionId"))?.[1] ??
        "地区名称未提供",
      productIds: products.map(([id]) => id),
      productLabels: products.map(([, label]) => label),
      cultivarIds: cultivars.map(([id]) => id),
      cultivarLabels: cultivars.map(([, label]) => label),
      sourceChannelId: value("sourceChannelId") as MonitoringSourceChannelId,
      sourceChannelLabel:
        sourceOptions.find(([id]) => id === value("sourceChannelId"))?.[1] ??
        "来源渠道名称未提供",
      responsibleUserId,
      responsiblePerson:
        object?.responsiblePerson ??
        people.find(([id]) => id === responsibleUserId)?.[1] ??
        scope.identity.displayName ??
        scope.identity.userId,
      effectiveFrom: object?.effectiveFrom ?? roles[0]?.effectiveFrom ?? "",
      effectiveTo: object?.effectiveTo ?? null,
      validityStatus: value(
        "validityStatus",
      ) as MonitoringObject["validityStatus"],
      roles,
    });
    setSaving(false);
    if (result !== true) setMessage({ kind: "alert", text: result });
  };
  return (
    <form
      aria-label={object ? "编辑监测对象" : "新增监测对象"}
      className="production-task5-object-editor"
      onSubmit={(event) => {
        void save(event);
      }}
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
            <option value="">请选择对象类型</option>
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
                onChange={() => toggleProduct(id)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <fieldset aria-label="编辑具体品种">
          <legend>具体品种（可多选）</legend>
          {selectedProductIds.length === 0 && (
            <span className="production-task5-field-hint">
              请先选择至少一种作物
            </span>
          )}
          {cultivarOptions.map(({ id, label }) => (
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
            <option value="">请选择来源渠道</option>
            {sourceOptions.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {!serverBacked && (
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
        )}
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
      <button
        className="production-task5-primary"
        disabled={saving}
        type="submit"
      >
        {saving ? "正在保存" : "保存对象草稿"}
      </button>
      {message && <p role={message.kind}>{message.text}</p>}
    </form>
  );
}

function ObjectDetail({
  object,
  canEdit,
  onEdit,
  onClose,
}: {
  object: MonitoringObject;
  canEdit: boolean;
  onEdit: () => void;
  onClose: () => void;
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
        <div className="production-task5-object-detail__actions">
          {canEdit && (
            <button type="button" onClick={onEdit}>
              编辑对象
            </button>
          )}
          <button type="button" onClick={onClose}>
            关闭详情
          </button>
        </div>
      </header>
      <section aria-label="身份与业务角色">
        <h3>身份与业务角色</h3>
        <dl className="production-task5-object-detail__identity">
          <div>
            <dt>对象类型</dt>
            <dd>{object.objectTypeLabel}</dd>
          </div>
          <div>
            <dt>行政区划</dt>
            <dd>{object.regionLabel}</dd>
          </div>
          <div>
            <dt>责任人</dt>
            <dd>{object.responsiblePerson || "责任人未提供"}</dd>
          </div>
          <div>
            <dt>有效状态</dt>
            <dd>
              {object.validityStatus === "active" ? "当前有效" : "已停用"}
            </dd>
          </div>
        </dl>
        <h4>当前业务角色</h4>
        <ul>
          {effectiveRoles.map((role) => (
            <li key={role.roleId}>
              {role.label} · {formatChineseDate(role.effectiveFrom)}起
              {role.effectiveTo
                ? `至${formatChineseDate(role.effectiveTo)}`
                : "，长期有效"}
            </li>
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
      <section aria-label="附件与来源凭证">
        <h3>附件与来源凭证</h3>
        <dl className="production-task5-object-detail__identity">
          <div>
            <dt>来源渠道</dt>
            <dd>{object.sourceChannelLabel || "来源渠道未提供"}</dd>
          </div>
          <div>
            <dt>适用品种</dt>
            <dd>{object.cultivarLabels.join("、") || "未限定具体品种"}</dd>
          </div>
        </dl>
        <p>业务附件、调查记录和来源凭证在对应任务单据中归档。</p>
      </section>
    </aside>
  );
}

export function ProductionObjectRegistry({
  scope,
  onScopeChange,
  selection,
  onSelectionChange,
  onSelectionClear,
  queryAllowed = true,
  registryObjects: controlledRegistryObjects,
  onRegistryObjectsChange,
  realtimeRepository,
}: {
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  selection?: FormalSelection;
  onSelectionChange: (selection: FormalSelection) => void;
  onSelectionClear: () => void;
  queryAllowed?: boolean;
  registryObjects?: readonly MonitoringObject[];
  onRegistryObjectsChange?: (objects: readonly MonitoringObject[]) => void;
  realtimeRepository?: RealtimeBusinessRepository;
}) {
  const [filters, setFilters] = useState<RegistryFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<"create" | "edit" | null>(null);
  const [localRegistryObjects, setLocalRegistryObjects] = useState<
    readonly MonitoringObject[]
  >(productionMonitoringObjects);
  const [serverRegistryObjects, setServerRegistryObjects] = useState<
    readonly PersistedMonitoringObject[]
  >([]);
  const [serverMasterData, setServerMasterData] =
    useState<MasterDataSnapshot>();
  const [serverStatus, setServerStatus] = useState<
    "not-required" | "loading" | "ready" | "error"
  >(realtimeRepository ? "loading" : "not-required");
  useEffect(() => {
    if (!realtimeRepository) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (
        typeof realtimeRepository.listProductionObjects !== "function" ||
        typeof realtimeRepository.loadMasterData !== "function"
      ) {
        setServerRegistryObjects([]);
        setServerMasterData(undefined);
        setServerStatus("error");
        return;
      }
      setServerStatus("loading");
      void Promise.all([
        realtimeRepository.listProductionObjects(),
        realtimeRepository.loadMasterData(),
      ])
        .then(([rows, masterData]) => {
          if (cancelled) return;
          setServerRegistryObjects(rows.map(monitoringObjectFromRow));
          setServerMasterData(masterData);
          setServerStatus("ready");
        })
        .catch(() => {
          if (cancelled) return;
          setServerRegistryObjects([]);
          setServerMasterData(undefined);
          setServerStatus("error");
        });
    });
    return () => {
      cancelled = true;
    };
  }, [realtimeRepository]);
  const hasManagePermission = realtimeRepository
    ? scope.authorization.permissionKeys.includes("BUSINESS_UPDATE")
    : scope.authorization.permissionKeys.includes("production:object:manage");
  const canManage =
    hasManagePermission && (!realtimeRepository || serverStatus === "ready");
  const registryObjects = realtimeRepository
    ? serverRegistryObjects
    : (controlledRegistryObjects ?? localRegistryObjects);
  const updateRegistryObjects = (objects: readonly MonitoringObject[]) => {
    if (!canManage) return;
    if (controlledRegistryObjects === undefined)
      setLocalRegistryObjects(objects);
    onRegistryObjectsChange?.(objects);
  };
  const requestEditor = (nextEditor: "create" | "edit") => {
    if (!canManage) {
      setEditor(null);
      return;
    }
    setEditor(nextEditor);
  };
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
  const pageSize = 10;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageRows = rows.slice(startIndex, startIndex + pageSize);
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
  const advancedFilterCount =
    (scope.coordinates.cultivarId ? 1 : 0) + (filters.sourceChannelId ? 1 : 0);
  return (
    <div className="unified-workspace production-task5-workspace">
      <WorkspaceHeader
        eyebrow="产情监测 / 监测对象"
        title="产情对象名录"
        summary="维护跨期间稳定对象身份、类型、地区、品种、来源和有效角色。"
        actions={
          canManage ? (
            <button
              className="production-task5-primary"
              type="button"
              onClick={() => requestEditor("create")}
            >
              新增监测对象
            </button>
          ) : undefined
        }
      />
      <RegistryFilters
        authorizedObjects={authorizedObjects}
        filters={filters}
        onFiltersChange={(next) => {
          setPage(1);
          setFilters(next);
        }}
        onScopeChange={(coordinates) => {
          setPage(1);
          onScopeChange(coordinates);
        }}
        scope={scope}
      />
      <section
        aria-label="产情对象结果摘要"
        className="production-task5-summary-line"
      >
        <strong>监测对象名录</strong>
        <span>
          {scope.coordinates.regionId === "authorized-all"
            ? "全部已授权范围"
            : regionName(scope.coordinates.regionId)}
        </span>
        <span>
          {productionProductLabel(
            scope.coordinates.productId,
            "全部已授权作物",
          )}
        </span>
        <span>{rows.length} 个对象</span>
        <span>
          {advancedFilterCount > 0
            ? `已启用 ${advancedFilterCount} 项更多筛选`
            : "未启用更多筛选"}
        </span>
      </section>
      {savedDraftName && (
        <p role="status">
          {realtimeRepository
            ? `${savedDraftName}已保存到服务端权威名录。`
            : `${savedDraftName}对象草稿已保存，并已写入当前对象名录草稿。`}
        </p>
      )}
      {serverStatus === "error" && (
        <div className="production-task5-alert" role="alert">
          产情调查对象加载失败，请稍后重试。
        </div>
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
        <header>
          <div>
            <h2>监测对象名录</h2>
            <p>对象类型与对象身份稳定维护，业务能力仅在对象详情中查看</p>
          </div>
          <strong>{rows.length} 个</strong>
        </header>
        <div
          aria-label="产情对象名录横向滚动区域"
          className="production-task5-ledger-scroll"
          tabIndex={0}
        >
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
              {pageRows.map((object) => {
                const products = authorizedLabels(
                  object.productIds,
                  object.productLabels,
                  realtimeRepository
                    ? object.productIds
                    : scope.authorization.authorizedProductIds,
                  "作物名称未提供",
                );
                const cultivars = authorizedLabels(
                  object.cultivarIds,
                  object.cultivarLabels,
                  realtimeRepository
                    ? object.cultivarIds
                    : scope.authorization.authorizedCultivarIds,
                  "品种名称未提供",
                );
                return (
                  <tr key={object.objectId}>
                    <th className="production-task5-sticky" scope="row">
                      {object.objectName}
                    </th>
                    <td>{object.objectTypeLabel || "对象类型名称未提供"}</td>
                    <td>{object.regionLabel || "地区名称未提供"}</td>
                    <td>{products.join("、") || "当前无可查看作物"}</td>
                    <td>{cultivars.join("、") || "未指定具体品种"}</td>
                    <td>{object.sourceChannelLabel || "来源渠道名称未提供"}</td>
                    <td>{object.responsiblePerson || "责任人未提供"}</td>
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
        <WorkspacePagination
          end={
            rows.length === 0 ? 0 : Math.min(startIndex + pageSize, rows.length)
          }
          onPageChange={setPage}
          page={currentPage}
          pages={pages}
          start={rows.length === 0 ? 0 : startIndex + 1}
          total={rows.length}
        />
        {rows.length === 0 && (
          <div className="production-task5-empty" role="status">
            当前筛选范围内没有可查看的监测对象，请调整筛选条件后重试。
          </div>
        )}
      </section>
      {canManage && editor && (
        <ObjectEditor
          masterData={serverMasterData}
          object={editor === "edit" ? selectedSource : undefined}
          scope={scope}
          serverBacked={Boolean(realtimeRepository)}
          onClose={() => setEditor(null)}
          onSave={async (draft) => {
            if (!canManage) {
              setEditor(null);
              return "保存失败：当前账号无维护权限。";
            }
            if (realtimeRepository) {
              try {
                const existing = serverRegistryObjects.find(
                  ({ objectId }) => objectId === draft.objectId,
                );
                const saved = existing
                  ? await realtimeRepository.updateProductionObject?.(
                      existing.objectId,
                      {
                        ...productionObjectMutation(draft),
                        version: existing.version,
                      },
                    )
                  : await realtimeRepository.createProductionObject?.(
                      productionObjectMutation(draft),
                    );
                if (!saved) return "保存失败，服务端未返回权威对象。";
                const reloaded =
                  typeof realtimeRepository.listProductionObjects === "function"
                    ? await realtimeRepository.listProductionObjects()
                    : [saved];
                setServerRegistryObjects(reloaded.map(monitoringObjectFromRow));
                setSavedDraftName(draft.objectName);
                setEditor(null);
                onSelectionChange({ type: "object", id: saved.objectId });
                return true;
              } catch (error) {
                const errorCode =
                  typeof error === "object" && error !== null && "code" in error
                    ? error.code
                    : undefined;
                if (
                  errorCode === "PRODUCTION_OBJECT_VERSION_CONFLICT" ||
                  (error instanceof Error &&
                    error.message.includes(
                      "PRODUCTION_OBJECT_VERSION_CONFLICT",
                    ))
                ) {
                  return "保存失败：对象已被其他人员更新，请刷新后重试。";
                }
                return "保存失败，请核对资料或权限后重试。";
              }
            }
            updateRegistryObjects(
              registryObjects.some(
                ({ objectId }) => objectId === draft.objectId,
              )
                ? registryObjects.map((item) =>
                    item.objectId === draft.objectId ? draft : item,
                  )
                : [...registryObjects, draft],
            );
            setSavedDraftName(draft.objectName);
            setEditor(null);
            return true;
          }}
        />
      )}
      {selected && !invalidSelection && (
        <ObjectDetail
          canEdit={canManage}
          object={selected}
          onEdit={() => requestEditor("edit")}
          onClose={onSelectionClear}
        />
      )}
    </div>
  );
}
