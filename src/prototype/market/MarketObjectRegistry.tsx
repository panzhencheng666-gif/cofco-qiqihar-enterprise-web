import { useEffect, useMemo, useState, type FormEvent } from "react";

import type {
  MarketObjectMutation,
  MarketObjectRow,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";

import {
  type EffectiveBusinessRole,
  getActiveObjectCapabilities,
  getEffectiveBusinessRoles,
  projectMonitoringObjects,
  type MonitoringObject,
  type MonitoringSourceChannelId,
  type MonitoringObjectTypeId,
} from "../core/monitoringRegistry";
import type { OperationalScope } from "../core/operationalScope";
import {
  marketCapabilityTemplates,
  marketMonitoringObjects,
  marketRegistryAsOf,
  marketRegistryLegacyProfiles,
} from "../data/monitoringRegistryFixtures";
import { getEnterpriseScopeRegion } from "../enterpriseRegions";
import type {
  BusinessCoordinates,
  FormalSelection,
} from "../formalEnterpriseModel";
import { marketRegionCoverage } from "../marketMonitoringData";
import {
  governedMarketName,
  marketCultivarNames,
  marketCultivarsByProduct,
  marketProductNames,
  marketRoleLabels,
} from "../marketMonitoringModel";
import {
  WorkspaceHeader,
  WorkspacePagination,
} from "../UnifiedWorkspacePrimitives";
import {
  MarketFilterChips,
  type MarketFilterCondition,
} from "./MarketFilterChips";
import {
  marketObjectRegionCode,
  marketObjectRegionId,
} from "./marketObjectRegionCodes";

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

const marketObjectTypeOptions: readonly (readonly [
  MonitoringObjectTypeId,
  string,
])[] = [
  ["grain-trading-enterprise", "贸易商"],
  ["grain-processing-enterprise", "深加工企业"],
  ["breeding-farm", "养殖场"],
  ["feed-mill", "饲料厂"],
  ["wholesale-market", "批发市场"],
  ["grain-storage-enterprise", "承储企业"],
];

const serverMarketObjectTypeOptions: readonly (readonly [
  MonitoringObjectTypeId,
  string,
])[] = [["business-party" as MonitoringObjectTypeId, "经营主体"]];

const grainProcessingProductIds = [
  "corn",
  "soybean",
  "paddy",
  "wheat",
  "rice",
  "soymeal",
  "soyoil",
  "soy-protein",
] as const;

function applicableProductIdsForObjectType(
  objectTypeId: MonitoringObjectTypeId | "",
): readonly string[] {
  if (!objectTypeId) return [];
  if ((objectTypeId as string) === "business-party") {
    return ["corn", "soybean", "paddy"];
  }
  if (objectTypeId === "breeding-farm" || objectTypeId === "feed-mill") {
    return ["corn"];
  }
  if (objectTypeId === "grain-processing-enterprise")
    return grainProcessingProductIds;
  return ["corn", "soybean", "paddy"];
}

function monitoringStatusText(objectId: string): string {
  return legacyProfile(objectId)?.status ?? "监测状态待配置";
}

const marketSourceChannelOptions = [
  ["enterprise-report", "企业直报"],
  ["rail-waybill-ledger", "铁路运单与站点台账"],
  ["road-waybill-weighing", "公路运单与过磅记录"],
] as const satisfies readonly (readonly [MonitoringSourceChannelId, string])[];

const marketRoleOptions = marketCapabilityTemplates.map(
  ({ roleId, capabilityTemplateVersionId }) => ({
    roleId,
    label: marketRoleLabels[roleId],
    capabilityTemplateVersionId,
  }),
);

const serverMarketRoleIds = new Set([
  "trader",
  "corn-processor",
  "soy-crusher",
  "soy-protein",
  "food-condiment",
  "rice-mill",
  "feed",
  "livestock",
  "reserve",
  "wholesale-market",
]);

function cultivarIdsForProducts(productIds: readonly string[]): string[] {
  return [
    ...new Set(
      productIds.flatMap((productId) =>
        Array.from(marketCultivarsByProduct[productId] ?? []),
      ),
    ),
  ];
}

function formatChineseDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "日期未提供";
  return `${year} 年 ${month} 月 ${day} 日`;
}

function validityPeriodText(
  effectiveFrom: string,
  effectiveTo: string | null,
): string {
  return `${formatChineseDate(effectiveFrom)}起${
    effectiveTo ? `至${formatChineseDate(effectiveTo)}` : "，长期有效"
  }`;
}

function roleValidityText(role: EffectiveBusinessRole, asOf: string): string {
  if (role.effectiveFrom > asOf) return "尚未生效";
  if (role.effectiveTo && role.effectiveTo < asOf) return "已失效";
  return "当前生效";
}

function activeRoles(object: MonitoringObject, asOf: string) {
  return getEffectiveBusinessRoles(object, asOf);
}

function activeCapabilities(object: MonitoringObject, asOf: string) {
  return getActiveObjectCapabilities(object, marketCapabilityTemplates, asOf);
}

function currentChinaDate(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function legacyProfile(objectId: string) {
  return marketRegistryLegacyProfiles.find(
    (candidate) => candidate.objectId === objectId,
  )?.profile;
}

function monitoringScopeText(objectId: string): string {
  const profile = legacyProfile(objectId);
  if (!profile) return "监测内容未提供";
  if (profile.target === "subject") return profile.qualityScope;
  return `${profile.coverage} · ${profile.monitoring}`;
}

function ObjectFilters({
  scope,
  objects,
  filters,
  onScopeChange,
  onFiltersChange,
}: {
  scope: OperationalScope;
  objects: readonly MonitoringObject[];
  filters: RegistryFilters;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  onFiltersChange: (filters: RegistryFilters) => void;
}) {
  const objectTypes = [
    ...new Map(
      objects.map(
        ({ objectTypeId, objectTypeLabel }) =>
          [objectTypeId, objectTypeLabel] as const,
      ),
    ).entries(),
  ];
  const sources = [
    ...new Map(
      objects.map(
        ({ sourceChannelId, sourceChannelLabel }) =>
          [sourceChannelId, sourceChannelLabel] as const,
      ),
    ).entries(),
  ];
  const regions = [
    ...new Map(
      objects
        .filter(({ regionId, regionLabel }) => regionId && regionLabel.trim())
        .map(({ regionId, regionLabel }) => [regionId, regionLabel] as const),
    ).entries(),
  ].map(([id, label]) => ({ id, label }));
  const products = [
    ...new Map(
      objects.flatMap((object) =>
        object.productIds.map(
          (id, index) =>
            [
              id,
              object.productLabels[index] ||
                governedMarketName(marketProductNames, id, "未提供产品名称"),
            ] as const,
        ),
      ),
    ).entries(),
  ].map(([id, label]) => ({ id, label }));
  const effectiveProductId =
    scope.coordinates.productId ??
    (products.length === 1 ? products[0]?.id : undefined);
  const cultivars = effectiveProductId
    ? [
        ...new Map(
          objects
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
              (marketCultivarsByProduct[effectiveProductId] ?? []).includes(id),
            ),
        ).entries(),
      ].map(([id, label]) => ({ id, label }))
    : [];
  const validityOptions = [
    ...new Set(objects.map(({ validityStatus }) => validityStatus)),
  ];
  const objectTypeInvalid = Boolean(
    filters.objectTypeId &&
    !objectTypes.some(([id]) => id === filters.objectTypeId),
  );
  const regionInvalid =
    scope.coordinates.regionId !== "authorized-all" &&
    !regions.some(({ id }) => id === scope.coordinates.regionId);
  const productInvalid = Boolean(
    scope.coordinates.productId &&
    !products.some(({ id }) => id === scope.coordinates.productId),
  );
  const cultivarInvalid = Boolean(
    scope.coordinates.cultivarId &&
    !cultivars.some(({ id }) => id === scope.coordinates.cultivarId),
  );
  const validityInvalid = Boolean(
    filters.validityStatus &&
    !validityOptions.includes(
      filters.validityStatus as MonitoringObject["validityStatus"],
    ),
  );
  const sourceInvalid = Boolean(
    filters.sourceChannelId &&
    !sources.some(([id]) => id === filters.sourceChannelId),
  );
  const advancedCount =
    Number(Boolean(scope.coordinates.cultivarId)) +
    Number(Boolean(filters.sourceChannelId));
  const activeConditions: MarketFilterCondition[] = [];
  const addCondition = (
    id: string,
    label: string | undefined,
    onClear: () => void,
  ) => {
    if (label) activeConditions.push({ id, label, onClear });
  };
  addCondition(
    "object-type",
    filters.objectTypeId
      ? objectTypes.find(([id]) => id === filters.objectTypeId)?.[1]
      : undefined,
    () => onFiltersChange({ ...filters, objectTypeId: "" }),
  );
  addCondition(
    "region",
    scope.coordinates.regionId === "authorized-all"
      ? undefined
      : regions.find(({ id }) => id === scope.coordinates.regionId)?.label,
    () => onScopeChange({ regionId: "authorized-all" }),
  );
  addCondition(
    "product",
    scope.coordinates.productId
      ? products.find(({ id }) => id === scope.coordinates.productId)?.label
      : undefined,
    () => onScopeChange({ productId: undefined, cultivarId: undefined }),
  );
  addCondition(
    "validity",
    filters.validityStatus === "active"
      ? "当前有效"
      : filters.validityStatus === "inactive"
        ? "已停用"
        : undefined,
    () => onFiltersChange({ ...filters, validityStatus: "" }),
  );
  addCondition(
    "cultivar",
    scope.coordinates.cultivarId
      ? cultivars.find(({ id }) => id === scope.coordinates.cultivarId)?.label
      : undefined,
    () => onScopeChange({ cultivarId: undefined }),
  );
  addCondition(
    "source",
    filters.sourceChannelId
      ? sources.find(([id]) => id === filters.sourceChannelId)?.[1]
      : undefined,
    () => onFiltersChange({ ...filters, sourceChannelId: "" }),
  );
  return (
    <section aria-label="市场对象筛选" className="market-task6-filter-surface">
      <div className="market-task6-filter-grid">
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
                  所选对象类型当前无记录（请重新选择）
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
                  所选产品当前无对象（请重新选择）
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
      {(cultivars.length > 1 ||
        cultivarInvalid ||
        sources.length > 1 ||
        sourceInvalid) && (
        <details className="market-task6-more-filters">
          <summary>更多筛选（{advancedCount} 项已生效）</summary>
          <div className="market-task6-more-filter-grid">
            {(cultivars.length > 1 || cultivarInvalid) && (
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
                  {cultivarInvalid && (
                    <option disabled value={scope.coordinates.cultivarId}>
                      所选品种当前无对象（请重新选择）
                    </option>
                  )}
                  {cultivars.map(({ id, label }) => (
                    <option key={id} value={id}>
                      {label}
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
                      所选来源当前无对象（请重新选择）
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
            {advancedCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  onScopeChange({ cultivarId: undefined });
                  onFiltersChange({ ...filters, sourceChannelId: "" });
                }}
              >
                清除更多筛选
              </button>
            )}
          </div>
        </details>
      )}
      <MarketFilterChips
        conditions={activeConditions}
        emptyLabel="当前未限定对象范围"
      />
    </section>
  );
}

interface ObjectEditorValue {
  objectTypeId: MonitoringObjectTypeId;
  objectName: string;
  regionId: string;
  productIds: readonly string[];
  cultivarIds: readonly string[];
  sourceChannelId: MonitoringSourceChannelId;
  responsiblePerson: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  validityStatus: "active" | "inactive";
  roles: readonly EffectiveBusinessRole[];
}

interface PersistedMonitoringObject extends MonitoringObject {
  version: number;
}

function monitoringObjectFromRow(
  row: MarketObjectRow,
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

function marketObjectMutation(
  value: ObjectEditorValue,
): MarketObjectMutation | undefined {
  const regionCode = marketObjectRegionCode(value.regionId);
  if (!regionCode) return undefined;
  return {
    objectName: value.objectName,
    objectTypeId: value.objectTypeId,
    regionCode,
    productIds: value.productIds,
    cultivarIds: value.cultivarIds,
    sourceChannelId: value.sourceChannelId,
    effectiveFrom: value.effectiveFrom,
    effectiveTo: value.effectiveTo,
    validityStatus: value.validityStatus,
    roles: value.roles,
  };
}

interface RoleDraft {
  roleId: string;
  label: string;
  capabilityTemplateVersionId: string;
  selected: boolean;
  effectiveFrom: string;
  effectiveTo: string;
}

function roleDraftsFor(
  object?: MonitoringObject,
  serverBacked = false,
): RoleDraft[] {
  const configured = marketRoleOptions
    .filter(({ roleId }) => !serverBacked || serverMarketRoleIds.has(roleId))
    .map((option) => {
      const existing = object?.roles.find(
        ({ roleId }) => roleId === option.roleId,
      );
      return {
        ...option,
        label: existing?.label ?? option.label,
        capabilityTemplateVersionId:
          existing?.capabilityTemplateVersionId ??
          option.capabilityTemplateVersionId,
        selected: Boolean(existing),
        effectiveFrom: existing?.effectiveFrom ?? "",
        effectiveTo: existing?.effectiveTo ?? "",
      };
    });
  const configuredRoleIds = new Set<string>(
    configured.map(({ roleId }) => roleId),
  );
  const preserved = (object?.roles ?? [])
    .filter(({ roleId }) => !configuredRoleIds.has(roleId))
    .map((role) => ({
      ...role,
      selected: true,
      effectiveTo: role.effectiveTo ?? "",
    }));
  return [...configured, ...preserved];
}

function ObjectEditor({
  object,
  objectTypes,
  scope,
  onSave,
  serverBacked = false,
}: {
  object?: MonitoringObject;
  objectTypes: readonly (readonly [MonitoringObjectTypeId, string])[];
  scope: OperationalScope;
  onSave: (value: ObjectEditorValue) => boolean | Promise<boolean>;
  serverBacked?: boolean;
}) {
  const modeLabel = object ? "编辑对象" : "新增对象";
  const [objectName, setObjectName] = useState(object?.objectName ?? "");
  const [objectTypeId, setObjectTypeId] = useState<MonitoringObjectTypeId | "">(
    object?.objectTypeId ?? "",
  );
  const [regionId, setRegionId] = useState(object?.regionId ?? "");
  const [productIds, setProductIds] = useState<readonly string[]>(
    object?.productIds ?? [],
  );
  const [cultivarIds, setCultivarIds] = useState<readonly string[]>(
    object?.cultivarIds ?? [],
  );
  const [sourceChannelId, setSourceChannelId] = useState<
    MonitoringSourceChannelId | ""
  >(object?.sourceChannelId ?? "");
  const [responsiblePerson, setResponsiblePerson] = useState(
    object?.responsiblePerson ??
      (serverBacked ? (scope.identity.displayName ?? "") : ""),
  );
  const [validityStatus, setValidityStatus] = useState<"active" | "inactive">(
    object?.validityStatus ?? "active",
  );
  const [effectiveFrom, setEffectiveFrom] = useState(
    object?.effectiveFrom ?? "",
  );
  const [effectiveTo, setEffectiveTo] = useState(object?.effectiveTo ?? "");
  const [roleDrafts, setRoleDrafts] = useState<RoleDraft[]>(() =>
    roleDraftsFor(object, serverBacked),
  );
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const applicableProductIds = applicableProductIdsForObjectType(objectTypeId);
  const productOptions = (
    serverBacked
      ? (["corn", "soybean", "paddy"] as const)
      : scope.authorization.authorizedProductIds
  ).filter((id) => applicableProductIds.includes(id));
  const cultivarOptions = cultivarIdsForProducts(productIds).filter((id) =>
    serverBacked
      ? id === "heinong-84" || id === "dongsheng-22"
      : scope.authorization.authorizedCultivarIds.includes(id),
  );
  const regionOptions = scope.authorization.authorizedRegionIds;

  const changeObjectType = (nextTypeId: MonitoringObjectTypeId | "") => {
    setObjectTypeId(nextTypeId);
    const allowedProductIds = applicableProductIdsForObjectType(nextTypeId);
    const nextProductIds = productIds.filter((id) =>
      allowedProductIds.includes(id),
    );
    const allowedCultivarIds = cultivarIdsForProducts(nextProductIds);
    setProductIds(nextProductIds);
    setCultivarIds((current) =>
      current.filter((id) => allowedCultivarIds.includes(id)),
    );
    setMessage("");
  };
  const toggleProduct = (productId: string, checked: boolean) => {
    const nextProductIds = checked
      ? [...productIds, productId]
      : productIds.filter((id) => id !== productId);
    const allowedCultivarIds = cultivarIdsForProducts(nextProductIds);
    setProductIds(nextProductIds);
    setCultivarIds((current) =>
      current.filter((id) => allowedCultivarIds.includes(id)),
    );
    setMessage("");
  };
  const toggleCultivar = (cultivarId: string, checked: boolean) => {
    setCultivarIds((current) =>
      checked
        ? [...current, cultivarId]
        : current.filter((id) => id !== cultivarId),
    );
    setMessage("");
  };
  const updateRole = (roleId: string, patch: Partial<RoleDraft>) => {
    setRoleDrafts((current) =>
      current.map((role) =>
        role.roleId === roleId ? { ...role, ...patch } : role,
      ),
    );
    setMessage("");
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = objectName.trim();
    const trimmedResponsiblePerson = responsiblePerson.trim();
    if (!trimmedName || !objectTypeId || !regionId || !sourceChannelId) {
      setMessage("请完整填写对象名称、对象类型、业务地区和来源渠道。");
      return;
    }
    if (!trimmedResponsiblePerson || !effectiveFrom) {
      setMessage("请完整填写责任人和对象生效日期。");
      return;
    }
    if (effectiveTo && effectiveTo < effectiveFrom) {
      setMessage("对象失效日期不得早于对象生效日期，未保存对象。");
      return;
    }
    if (
      (!serverBacked &&
        !scope.authorization.authorizedRegionIds.some(
          (id) => id === regionId,
        )) ||
      productIds.length === 0 ||
      productIds.some(
        (id) =>
          (!serverBacked &&
            !scope.authorization.authorizedProductIds.includes(id)) ||
          !applicableProductIds.includes(id),
      )
    ) {
      setMessage("所选地区或产品不在当前岗位授权范围，未保存对象。");
      return;
    }
    const allowedCultivarIds = cultivarIdsForProducts(productIds);
    if (
      cultivarIds.some(
        (id) =>
          (!serverBacked &&
            !scope.authorization.authorizedCultivarIds.includes(id)) ||
          !allowedCultivarIds.includes(id),
      )
    ) {
      setMessage("适用具体品种与所选产品不匹配，未保存对象。");
      return;
    }
    const selectedRoles = roleDrafts.filter(({ selected }) => selected);
    if (selectedRoles.length === 0) {
      setMessage("请明确勾选至少一个业务角色，并填写角色有效期。");
      return;
    }
    if (selectedRoles.some(({ effectiveFrom: roleFrom }) => !roleFrom)) {
      setMessage("请为每个已勾选业务角色填写生效日期，未保存对象。");
      return;
    }
    if (
      selectedRoles.some(
        ({ effectiveFrom: roleFrom, effectiveTo: roleTo }) =>
          roleTo && roleTo < roleFrom,
      )
    ) {
      setMessage("业务角色失效日期不得早于生效日期，未保存对象。");
      return;
    }
    setMessage("正在保存对象资料。");
    setSaving(true);
    void Promise.resolve(
      onSave({
        objectTypeId,
        objectName: trimmedName,
        regionId,
        productIds,
        cultivarIds,
        sourceChannelId,
        responsiblePerson: trimmedResponsiblePerson,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        validityStatus,
        roles: selectedRoles.map(
          ({
            roleId,
            label,
            effectiveFrom: roleFrom,
            effectiveTo: roleTo,
            capabilityTemplateVersionId,
          }) => ({
            roleId,
            label,
            effectiveFrom: roleFrom,
            effectiveTo: roleTo || null,
            capabilityTemplateVersionId,
          }),
        ),
      }),
    )
      .then((saved) => {
        if (!saved) {
          setMessage("");
          return;
        }
        setMessage(
          object
            ? "对象资料已更新，名录与详情已同步。"
            : "监测对象已新增并进入当前名录。",
        );
      })
      .finally(() => setSaving(false));
  };
  return (
    <form
      aria-label={object ? "编辑监测对象资料" : "新增监测对象资料"}
      className="market-task6-object-editor"
      noValidate
      onSubmit={submit}
    >
      <div className="market-task6-object-editor__heading">
        <h3>{object ? "编辑监测对象" : "新增监测对象"}</h3>
        <p>先维护对象主数据，再明确勾选业务角色及其有效期。</p>
      </div>
      <div className="market-task6-object-editor-grid">
        <label>
          <span>对象名称</span>
          <input
            aria-label={`${modeLabel}名称`}
            value={objectName}
            onChange={(event) => setObjectName(event.target.value)}
          />
        </label>
        <label>
          <span>对象类型</span>
          <select
            aria-label={`${modeLabel}类型`}
            value={objectTypeId}
            onChange={(event) =>
              changeObjectType(
                event.target.value as MonitoringObjectTypeId | "",
              )
            }
          >
            <option value="">请选择对象类型</option>
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
            aria-label={`${modeLabel}业务地区`}
            value={regionId}
            onChange={(event) => setRegionId(event.target.value)}
          >
            <option value="">请选择业务地区</option>
            {regionOptions.map((id) => (
              <option key={id} value={id}>
                {getEnterpriseScopeRegion(
                  serverBacked ? (marketObjectRegionId(id) ?? id) : id,
                )?.label ?? "地区名称未提供"}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>来源渠道</span>
          <select
            aria-label={`${modeLabel}来源渠道`}
            value={sourceChannelId}
            onChange={(event) =>
              setSourceChannelId(
                event.target.value as MonitoringSourceChannelId | "",
              )
            }
          >
            <option value="">请选择来源渠道</option>
            {marketSourceChannelOptions
              .filter(([id]) => !serverBacked || id === "enterprise-report")
              .map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span>责任人</span>
          <input
            aria-label={`${modeLabel}责任人`}
            readOnly={serverBacked}
            value={responsiblePerson}
            onChange={(event) => setResponsiblePerson(event.target.value)}
          />
        </label>
        <label>
          <span>有效状态</span>
          <select
            aria-label={`${modeLabel}有效状态`}
            value={validityStatus}
            onChange={(event) =>
              setValidityStatus(event.target.value as "active" | "inactive")
            }
          >
            <option value="active">当前有效</option>
            <option value="inactive">已停用</option>
          </select>
        </label>
        <label>
          <span>对象生效日期</span>
          <input
            aria-label={`${modeLabel}生效日期`}
            type="date"
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
          />
        </label>
        <label>
          <span>对象失效日期</span>
          <input
            aria-label={`${modeLabel}失效日期`}
            type="date"
            value={effectiveTo}
            onChange={(event) => setEffectiveTo(event.target.value)}
          />
          <small>长期有效可留空</small>
        </label>
      </div>
      <fieldset className="market-task6-object-editor-scope">
        <legend>产品或品类</legend>
        <p>可按对象实际经营范围勾选多项，不会自动代选。</p>
        <div className="market-task6-object-editor-options">
          {productOptions.map((id) => {
            const label = governedMarketName(
              marketProductNames,
              id,
              "产品名称未提供",
            );
            return (
              <label key={id}>
                <input
                  aria-label={`${modeLabel}经营产品：${label}`}
                  checked={productIds.includes(id)}
                  type="checkbox"
                  onChange={(event) => toggleProduct(id, event.target.checked)}
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="market-task6-object-editor-scope">
        <legend>适用具体品种</legend>
        {productIds.length === 0 ? (
          <p>请先选择产品或品类。</p>
        ) : cultivarOptions.length === 0 ? (
          <p>所选产品不设具体品种，可按产品层级维护。</p>
        ) : (
          <>
            <p>品种范围随已选产品联动，不匹配项会被移除且不会回落首项。</p>
            <div className="market-task6-object-editor-options">
              {cultivarOptions.map((id) => {
                const label = governedMarketName(
                  marketCultivarNames,
                  id,
                  "品种名称未提供",
                );
                return (
                  <label key={id}>
                    <input
                      aria-label={`${modeLabel}适用品种：${label}`}
                      checked={cultivarIds.includes(id)}
                      type="checkbox"
                      onChange={(event) =>
                        toggleCultivar(id, event.target.checked)
                      }
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </fieldset>
      <fieldset className="market-task6-object-editor-roles">
        <legend>业务角色与有效期</legend>
        <p>角色由维护人员明确勾选；系统仅由当前已生效角色派生业务能力。</p>
        <div className="market-task6-object-editor-role-list">
          {roleDrafts.map((role) => (
            <div className="market-task6-object-editor-role" key={role.roleId}>
              <label className="market-task6-object-editor-role__choice">
                <input
                  aria-label={`${modeLabel}业务角色：${role.label}`}
                  checked={role.selected}
                  type="checkbox"
                  onChange={(event) =>
                    updateRole(role.roleId, { selected: event.target.checked })
                  }
                />
                <span>{role.label}</span>
              </label>
              {role.selected && (
                <div className="market-task6-object-editor-role__period">
                  <label>
                    <span>角色生效日期</span>
                    <input
                      aria-label={`${modeLabel}${role.label}角色生效日期`}
                      type="date"
                      value={role.effectiveFrom}
                      onChange={(event) =>
                        updateRole(role.roleId, {
                          effectiveFrom: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>角色失效日期</span>
                    <input
                      aria-label={`${modeLabel}${role.label}角色失效日期`}
                      type="date"
                      value={role.effectiveTo}
                      onChange={(event) =>
                        updateRole(role.roleId, {
                          effectiveTo: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      </fieldset>
      <div className="market-task6-object-editor-actions">
        <button disabled={saving} type="submit">
          {saving ? "正在保存" : object ? "保存对象资料" : "保存监测对象"}
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </form>
  );
}

export function MarketObjectRegistry({
  scope,
  onScopeChange,
  selection,
  onSelectionChange,
  onSelectionClear,
  queryAllowed,
  registryObjects,
  onRegistryObjectsChange,
  realtimeRepository,
}: {
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  selection?: FormalSelection;
  onSelectionChange: (selection: FormalSelection) => void;
  onSelectionClear: () => void;
  queryAllowed: boolean;
  registryObjects?: readonly MonitoringObject[];
  onRegistryObjectsChange?: (objects: readonly MonitoringObject[]) => void;
  realtimeRepository?: RealtimeBusinessRepository;
}) {
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [localRegistryObjects, setLocalRegistryObjects] = useState<
    readonly MonitoringObject[]
  >(() => [...marketMonitoringObjects]);
  const [serverRegistryObjects, setServerRegistryObjects] = useState<
    readonly PersistedMonitoringObject[]
  >([]);
  const [serverStatus, setServerStatus] = useState<
    "not-required" | "loading" | "ready" | "error"
  >(realtimeRepository ? "loading" : "not-required");
  const [creating, setCreating] = useState(false);
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  useEffect(() => {
    if (!realtimeRepository) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (typeof realtimeRepository.listMarketObjects !== "function") {
        setServerRegistryObjects([]);
        setServerStatus("error");
        return;
      }
      setServerStatus("loading");
      void realtimeRepository
        .listMarketObjects()
        .then((rows) => {
          if (cancelled) return;
          setServerRegistryObjects(rows.map(monitoringObjectFromRow));
          setServerStatus("ready");
        })
        .catch(() => {
          if (cancelled) return;
          setServerRegistryObjects([]);
          setServerStatus("error");
        });
    });
    return () => {
      cancelled = true;
    };
  }, [realtimeRepository]);
  const currentRegistryObjects = realtimeRepository
    ? serverRegistryObjects
    : (registryObjects ?? localRegistryObjects);
  const updateRegistryObjects = (objects: readonly MonitoringObject[]) => {
    if (registryObjects === undefined) setLocalRegistryObjects(objects);
    onRegistryObjectsChange?.(objects);
  };
  const hasManagePermission =
    scope.authorization.permissionKeys.includes("market:object:manage") ||
    scope.authorization.permissionKeys.includes("MARKET_OBJECT_MANAGE");
  const canManage =
    hasManagePermission && (!realtimeRepository || serverStatus === "ready");
  const registryAsOf = realtimeRepository
    ? currentChinaDate()
    : marketRegistryAsOf;
  const effectiveObjectTypeOptions = realtimeRepository
    ? serverMarketObjectTypeOptions
    : marketObjectTypeOptions;
  const cultivarMismatch = Boolean(
    scope.coordinates.productId &&
    scope.coordinates.cultivarId &&
    !(marketCultivarsByProduct[scope.coordinates.productId] ?? []).includes(
      scope.coordinates.cultivarId,
    ),
  );
  const authorizedObjects = useMemo(
    () =>
      projectMonitoringObjects(
        currentRegistryObjects,
        scope,
        queryAllowed && !cultivarMismatch,
        "market",
      ),
    [cultivarMismatch, currentRegistryObjects, queryAllowed, scope],
  );
  const objects = authorizedObjects;
  const visible = objects.filter(
    (object) =>
      (!filters.objectTypeId || object.objectTypeId === filters.objectTypeId) &&
      (!filters.sourceChannelId ||
        object.sourceChannelId === filters.sourceChannelId) &&
      (!filters.validityStatus ||
        object.validityStatus === filters.validityStatus),
  );
  const pageSize = 10;
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageObjects = visible.slice(startIndex, startIndex + pageSize);
  const selected =
    selection?.type === "object"
      ? objects.find(({ objectId }) => objectId === selection.id)
      : undefined;
  const selectedObject = selected
    ? (currentRegistryObjects.find(
        ({ objectId }) => objectId === selected.objectId,
      ) ?? selected)
    : undefined;
  const invalidSelection =
    selection !== undefined && (selection.type !== "object" || !selected);
  const createObject = async (value: ObjectEditorValue) => {
    if (realtimeRepository) {
      const input = marketObjectMutation(value);
      if (
        !input ||
        typeof realtimeRepository.createMarketObject !== "function"
      ) {
        setMaintenanceMessage("所选地区尚未映射到服务端行政区，未保存对象。");
        return false;
      }
      setMaintenanceMessage("正在保存市场监测对象。");
      try {
        const saved = monitoringObjectFromRow(
          await realtimeRepository.createMarketObject(input),
        );
        setServerRegistryObjects((current) => [...current, saved]);
        setCreating(false);
        setMaintenanceMessage("监测对象已保存到服务端权威名录。");
        onSelectionChange({ type: "object", id: saved.objectId });
        return true;
      } catch {
        setMaintenanceMessage("市场监测对象保存失败，请核对资料后重试。");
        return false;
      }
    }
    const objectId = `OBJ-MARKET-LOCAL-${currentRegistryObjects.length + 1}`;
    const objectTypeLabel =
      effectiveObjectTypeOptions.find(
        ([id]) => id === value.objectTypeId,
      )?.[1] ?? "对象类型名称未提供";
    const sourceChannelLabel =
      marketSourceChannelOptions.find(
        ([id]) => id === value.sourceChannelId,
      )?.[1] ?? "来源渠道名称未提供";
    const created: MonitoringObject = {
      objectId,
      objectName: value.objectName,
      objectTypeId: value.objectTypeId,
      objectTypeLabel,
      regionId: value.regionId,
      regionLabel:
        getEnterpriseScopeRegion(value.regionId)?.label ?? "地区名称未提供",
      productIds: value.productIds,
      productLabels: value.productIds.map((id) =>
        governedMarketName(marketProductNames, id, "产品名称未提供"),
      ),
      cultivarIds: value.cultivarIds,
      cultivarLabels: value.cultivarIds.map((id) =>
        governedMarketName(marketCultivarNames, id, "品种名称未提供"),
      ),
      sourceChannelId: value.sourceChannelId,
      sourceChannelLabel,
      responsibleUserId: scope.identity.userId,
      responsiblePerson: value.responsiblePerson,
      effectiveFrom: value.effectiveFrom,
      effectiveTo: value.effectiveTo,
      validityStatus: value.validityStatus,
      roles: value.roles,
    };
    updateRegistryObjects([...currentRegistryObjects, created]);
    setCreating(false);
    setMaintenanceMessage("监测对象已新增，名录与对象详情已同步。");
    onSelectionChange({ type: "object", id: objectId });
    return true;
  };
  const updateObject = async (
    object: MonitoringObject,
    value: ObjectEditorValue,
  ) => {
    if (realtimeRepository) {
      const input = marketObjectMutation(value);
      const version =
        "version" in object && typeof object.version === "number"
          ? object.version
          : undefined;
      if (
        !input ||
        version === undefined ||
        typeof realtimeRepository.updateMarketObject !== "function"
      ) {
        setMaintenanceMessage("服务端对象版本或地区映射缺失，未保存对象。");
        return false;
      }
      setMaintenanceMessage("正在更新市场监测对象。");
      try {
        const saved = monitoringObjectFromRow(
          await realtimeRepository.updateMarketObject(object.objectId, {
            ...input,
            version,
          }),
        );
        setServerRegistryObjects((current) =>
          current.map((candidate) =>
            candidate.objectId === saved.objectId ? saved : candidate,
          ),
        );
        setEditingObjectId(null);
        setMaintenanceMessage("对象资料已更新到服务端权威名录。");
        return true;
      } catch {
        setMaintenanceMessage(
          "对象资料更新失败，可能已被其他人员修改，请刷新后重试。",
        );
        return false;
      }
    }
    const objectTypeLabel =
      effectiveObjectTypeOptions.find(
        ([candidateId]) => candidateId === value.objectTypeId,
      )?.[1] ?? object.objectTypeLabel;
    const sourceChannelLabel =
      value.sourceChannelId === object.sourceChannelId
        ? object.sourceChannelLabel
        : (marketSourceChannelOptions.find(
            ([id]) => id === value.sourceChannelId,
          )?.[1] ?? "来源渠道名称未提供");
    updateRegistryObjects(
      currentRegistryObjects.map((candidate) =>
        candidate.objectId === object.objectId
          ? {
              ...candidate,
              ...value,
              objectTypeLabel,
              regionLabel:
                getEnterpriseScopeRegion(value.regionId)?.label ??
                "地区名称未提供",
              productLabels: value.productIds.map((id) =>
                governedMarketName(marketProductNames, id, "产品名称未提供"),
              ),
              cultivarLabels: value.cultivarIds.map((id) =>
                governedMarketName(marketCultivarNames, id, "品种名称未提供"),
              ),
              sourceChannelLabel,
            }
          : candidate,
      ),
    );
    setEditingObjectId(null);
    setMaintenanceMessage("对象资料已更新，名录与详情已同步。");
    return true;
  };
  return (
    <div className="unified-workspace market-task6-workspace">
      <WorkspaceHeader
        eyebrow="市场监测 / 监测对象"
        title="市场监测对象名录"
        summary="维护稳定对象身份、真实对象类型、有效业务角色、经营品类、监测内容和当前有效性。"
      />
      <ObjectFilters
        filters={filters}
        objects={authorizedObjects}
        onFiltersChange={(nextFilters) => {
          setPage(1);
          setFilters(nextFilters);
        }}
        onScopeChange={(coordinates) => {
          setPage(1);
          onScopeChange(coordinates);
        }}
        scope={scope}
      />
      {serverStatus === "loading" && (
        <div className="market-task6-alert" role="status">
          正在加载服务端市场监测对象名录。
        </div>
      )}
      {serverStatus === "error" && (
        <div className="market-task6-alert" role="alert">
          市场监测对象名录加载失败，请稍后重试。
        </div>
      )}
      {realtimeRepository && maintenanceMessage && !selectedObject && (
        <div className="market-task6-alert" role="status">
          {maintenanceMessage}
        </div>
      )}
      {!queryAllowed && (
        <div className="market-task6-alert" role="alert">
          当前筛选范围超出您的数据权限，系统未展示其他对象。
        </div>
      )}
      {cultivarMismatch && (
        <div className="market-task6-alert" role="alert">
          具体品种与所选产品不匹配，系统没有回落到其他监测对象。
        </div>
      )}
      {invalidSelection && (
        <div className="market-task6-alert" role="alert">
          对象不可用或无权查看，系统没有打开其他对象。
        </div>
      )}
      <section
        aria-label="市场对象名录区域"
        className="market-task6-ledger-region"
      >
        <header>
          <div>
            <h2>授权对象名录</h2>
            <p>业务能力只在所选对象详情中展示。</p>
          </div>
          <div className="market-task6-ledger-actions">
            <strong>{visible.length} 个</strong>
            {canManage && (
              <button
                type="button"
                onClick={() => setCreating((open) => !open)}
              >
                {creating ? "取消新增" : "新增监测对象"}
              </button>
            )}
          </div>
        </header>
        {canManage && creating && (
          <ObjectEditor
            objectTypes={effectiveObjectTypeOptions}
            scope={scope}
            onSave={createObject}
            serverBacked={Boolean(realtimeRepository)}
          />
        )}
        <div
          aria-label="市场对象名录横向滚动区域"
          className="market-task6-ledger-scroll"
          tabIndex={0}
        >
          <table aria-label="市场对象名录" className="market-task6-ledger">
            <thead>
              <tr>
                <th className="market-task6-sticky" scope="col">
                  对象名称与类型
                </th>
                <th scope="col">有效业务角色</th>
                <th scope="col">产品与品种</th>
                <th scope="col">质量范围或监测内容</th>
                <th scope="col">业务地区</th>
                <th scope="col">来源渠道</th>
                <th scope="col">责任与有效状态</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {pageObjects.map((object) => (
                <tr key={object.objectId}>
                  <th className="market-task6-sticky" scope="row">
                    <strong>{object.objectName}</strong>
                    <span>{object.objectTypeLabel}</span>
                  </th>
                  <td>
                    {activeRoles(object, registryAsOf)
                      .map(({ label }) => label)
                      .join("、")}
                  </td>
                  <td>
                    {object.productLabels.join("、")} ·{" "}
                    {object.cultivarLabels.join("、") || "不限定具体品种"}
                  </td>
                  <td>{monitoringScopeText(object.objectId)}</td>
                  <td>{object.regionLabel}</td>
                  <td>{object.sourceChannelLabel}</td>
                  <td>
                    {object.responsiblePerson} ·{" "}
                    {monitoringStatusText(object.objectId)}
                    {" · "}
                    {object.validityStatus === "active" ? "当前有效" : "已停用"}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingObjectId(null);
                        setMaintenanceMessage("");
                        onSelectionChange({
                          type: "object",
                          id: object.objectId,
                        });
                      }}
                    >
                      查看{object.objectName}
                    </button>
                  </td>
                </tr>
              ))}
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
          <div className="market-task6-empty" role="status">
            当前筛选范围内没有已授权监测对象，请调整筛选条件后重试。
          </div>
        )}
      </section>
      <details className="market-task6-coverage-register">
        <summary>查看地区监测覆盖情况</summary>
        <div
          aria-label="地区监测覆盖横向滚动区域"
          className="market-task6-ledger-scroll"
          tabIndex={0}
        >
          <table aria-label="地区监测覆盖情况" className="market-task6-ledger">
            <thead>
              <tr>
                <th scope="col">地区范围</th>
                <th scope="col">覆盖说明</th>
                <th scope="col">乡镇范围</th>
                <th scope="col">行政村范围</th>
                <th scope="col">底册依据</th>
                <th scope="col">核定状态</th>
              </tr>
            </thead>
            <tbody>
              {marketRegionCoverage.map((coverage) => (
                <tr key={coverage.label}>
                  <th scope="row">{coverage.label}</th>
                  <td>{coverage.detail}</td>
                  <td>{coverage.townshipCount}</td>
                  <td>{coverage.villageCount}</td>
                  <td>{coverage.sourceNote}</td>
                  <td>{coverage.sourceState}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      {selectedObject && !invalidSelection && (
        <section
          aria-label={`${selectedObject.objectName}对象详情`}
          className="market-task6-object-detail"
        >
          <header>
            <div>
              <span>{selectedObject.objectTypeLabel}</span>
              <h2>{selectedObject.objectName}</h2>
              <p>
                {selectedObject.regionLabel} ·{" "}
                {selectedObject.sourceChannelLabel}
              </p>
            </div>
            <div className="market-task6-object-detail__actions">
              {canManage && (
                <button
                  type="button"
                  onClick={() => {
                    setMaintenanceMessage("");
                    setEditingObjectId((current) =>
                      current === selectedObject.objectId
                        ? null
                        : selectedObject.objectId,
                    );
                  }}
                >
                  {editingObjectId === selectedObject.objectId
                    ? "取消编辑"
                    : "编辑监测对象"}
                </button>
              )}
              <button type="button" onClick={onSelectionClear}>
                关闭详情
              </button>
            </div>
          </header>
          <section aria-label="身份与业务角色">
            <h3>身份与业务角色</h3>
            <dl className="market-task6-object-summary">
              <div>
                <dt>经营产品</dt>
                <dd>{selectedObject.productLabels.join("、")}</dd>
              </div>
              <div>
                <dt>具体品种</dt>
                <dd>
                  {selectedObject.cultivarLabels.join("、") || "不限定具体品种"}
                </dd>
              </div>
              <div>
                <dt>业务地区</dt>
                <dd>{selectedObject.regionLabel}</dd>
              </div>
              <div>
                <dt>来源渠道</dt>
                <dd>{selectedObject.sourceChannelLabel}</dd>
              </div>
              <div>
                <dt>责任人</dt>
                <dd>{selectedObject.responsiblePerson}</dd>
              </div>
              <div>
                <dt>对象有效期</dt>
                <dd>
                  {validityPeriodText(
                    selectedObject.effectiveFrom,
                    selectedObject.effectiveTo,
                  )}
                </dd>
              </div>
              <div>
                <dt>监测范围</dt>
                <dd>{monitoringScopeText(selectedObject.objectId)}</dd>
              </div>
              <div>
                <dt>监测与有效状态</dt>
                <dd>
                  {monitoringStatusText(selectedObject.objectId)} ·{" "}
                  {selectedObject.validityStatus === "active"
                    ? "当前有效"
                    : "已停用"}
                </dd>
              </div>
            </dl>
            <section
              aria-label="业务角色有效期"
              className="market-task6-role-register"
            >
              <h3>业务角色有效期</h3>
              <div>
                {selectedObject.roles.map((role) => (
                  <article key={`${role.roleId}-${role.effectiveFrom}`}>
                    <strong>{role.label}</strong>
                    <span>{roleValidityText(role, registryAsOf)}</span>
                    <small>
                      {validityPeriodText(role.effectiveFrom, role.effectiveTo)}
                    </small>
                  </article>
                ))}
              </div>
            </section>
          </section>
          <section
            aria-label="当前对象实际业务能力"
            className="market-task6-capabilities"
          >
            <h3>当前有效角色与实际能力</h3>
            {activeCapabilities(selectedObject, registryAsOf).length > 0 ? (
              activeCapabilities(selectedObject, registryAsOf).map(
                (capability) => (
                  <div key={capability.roleLabel}>
                    <strong>{capability.roleLabel}</strong>
                    <span>{capability.templateLabel}</span>
                    <ul>
                      {capability.capabilityLabels.map((label) => (
                        <li key={label}>{label}</li>
                      ))}
                    </ul>
                  </div>
                ),
              )
            ) : (
              <p>当前没有处于有效期内的业务角色，系统未派生业务能力。</p>
            )}
          </section>
          <section
            aria-label="附件与来源凭证"
            className="market-task6-capabilities"
          >
            <h3>附件与来源凭证</h3>
            <dl className="market-task6-object-summary">
              <div>
                <dt>来源渠道</dt>
                <dd>{selectedObject.sourceChannelLabel}</dd>
              </div>
              <div>
                <dt>业务监测范围</dt>
                <dd>{monitoringScopeText(selectedObject.objectId)}</dd>
              </div>
            </dl>
            <p>检验单、库存台账、运单与过磅凭证在对应任务单据中归档。</p>
          </section>
          {canManage && editingObjectId === selectedObject.objectId && (
            <ObjectEditor
              key={selectedObject.objectId}
              object={selectedObject}
              objectTypes={effectiveObjectTypeOptions}
              scope={scope}
              serverBacked={Boolean(realtimeRepository)}
              onSave={(value) => updateObject(selectedObject, value)}
            />
          )}
          {maintenanceMessage && (
            <p className="market-task6-maintenance-message" role="status">
              {maintenanceMessage}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
