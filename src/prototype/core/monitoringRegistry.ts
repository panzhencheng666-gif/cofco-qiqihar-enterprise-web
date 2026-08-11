import type { OperationalScope } from "./operationalScope";

export type MonitoringObjectTypeId =
  | "survey-area"
  | "farmer"
  | "village-committee"
  | "family-farm"
  | "cooperative"
  | "agri-station"
  | "field-plot"
  | "market-monitoring-group"
  | "grain-processing-enterprise"
  | "grain-trading-enterprise"
  | "grain-storage-enterprise"
  | "breeding-farm"
  | "feed-mill"
  | "wholesale-market"
  | "agri-input-operator"
  | "rail-node"
  | "road-node";

export type MonitoringSourceChannelId =
  | "administrative-village-ledger"
  | "farmer-sample"
  | "family-farm-sample"
  | "agricultural-station-observation"
  | "field-yield-survey"
  | "enterprise-report"
  | "rail-waybill-ledger"
  | "road-waybill-weighing";

export type MonitoringDomain = "production" | "market";

export interface EffectiveBusinessRole {
  roleId: string;
  label: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  capabilityTemplateVersionId: string;
}

export interface MonitoringObject {
  objectId: string;
  objectName: string;
  objectTypeId: MonitoringObjectTypeId;
  objectTypeLabel: string;
  regionId: string;
  regionLabel: string;
  productIds: readonly string[];
  productLabels: readonly string[];
  cultivarIds: readonly string[];
  cultivarLabels: readonly string[];
  sourceChannelId: MonitoringSourceChannelId;
  sourceChannelLabel: string;
  responsibleUserId: string;
  responsiblePerson: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  validityStatus: "active" | "inactive";
  roles: readonly EffectiveBusinessRole[];
}

export interface CapabilityTemplate {
  capabilityTemplateVersionId: string;
  label: string;
  capabilityLabels: readonly string[];
}

export interface ActiveObjectCapability {
  roleLabel: string;
  templateLabel: string;
  capabilityLabels: readonly string[];
}

export function migrateLegacyProductionType(legacyType: "village-ledger"): {
  objectTypeId: MonitoringObjectTypeId;
  sourceChannelId: MonitoringSourceChannelId;
} {
  if (legacyType === "village-ledger") {
    return {
      objectTypeId: "survey-area",
      sourceChannelId: "administrative-village-ledger",
    };
  }
  return legacyType satisfies never;
}

function isEffective(
  effectiveFrom: string,
  effectiveTo: string | null,
  at: string,
): boolean {
  return effectiveFrom <= at && (effectiveTo === null || effectiveTo >= at);
}

export function getEffectiveBusinessRoles(
  object: MonitoringObject,
  at: string,
): readonly EffectiveBusinessRole[] {
  return object.roles.filter((role) =>
    isEffective(role.effectiveFrom, role.effectiveTo, at),
  );
}

export function getActiveObjectCapabilities(
  object: MonitoringObject,
  templates: readonly CapabilityTemplate[],
  at: string,
): readonly ActiveObjectCapability[] {
  return getEffectiveBusinessRoles(object, at).map((role) => {
    const template = templates.find(
      ({ capabilityTemplateVersionId }) =>
        capabilityTemplateVersionId === role.capabilityTemplateVersionId,
    );
    const businessLabel = template?.label
      .replace(/(?:字段)?模板第[0-9一二三四五六七八九十百]+版/g, "")
      .replace(/(?:字段)?模板/g, "")
      .trim();
    return {
      roleLabel: role.label || "业务角色名称未提供",
      templateLabel: businessLabel || "适用能力名称未提供",
      capabilityLabels: template?.capabilityLabels ?? [],
    };
  });
}

export function projectMonitoringObjects(
  objects: readonly MonitoringObject[],
  scope: OperationalScope,
  queryAllowed: boolean,
  domain: MonitoringDomain = "production",
): readonly MonitoringObject[] {
  const requestedSubtype = scope.coordinates.businessSubtypeId;
  const serverAuthoritative = scope.authorization.serverAuthoritative === true;
  const authorizedDomainClassifications =
    scope.authorization.authorizedBusinessClassificationIds.filter((id) =>
      id.startsWith(`${domain}.`),
    );
  const matchedSubtypes = requestedSubtype
    ? authorizedDomainClassifications.filter(
        (id) => id === requestedSubtype || id.endsWith(`.${requestedSubtype}`),
      )
    : [];
  const subtypeAllowed =
    serverAuthoritative ||
    (authorizedDomainClassifications.length > 0 &&
      (requestedSubtype === undefined || matchedSubtypes.length === 1));
  if (
    !queryAllowed ||
    (!serverAuthoritative &&
      !scope.authorization.permissionKeys.includes("prototype:read")) ||
    (scope.coordinates.businessDomainId !== undefined &&
      scope.coordinates.businessDomainId !== domain) ||
    !subtypeAllowed
  ) {
    return [];
  }
  return objects.flatMap((object) => {
    const regionAllowed =
      serverAuthoritative ||
      scope.authorization.authorizedRegionIds.some(
        (regionId) => regionId === object.regionId,
      );
    const productAllowed =
      serverAuthoritative ||
      object.productIds.some((productId) =>
        scope.authorization.authorizedProductIds.includes(productId),
      );
    const cultivarAllowed =
      serverAuthoritative ||
      object.cultivarIds.length === 0 ||
      object.cultivarIds.some((cultivarId) =>
        scope.authorization.authorizedCultivarIds.includes(cultivarId),
      );
    const visible =
      regionAllowed &&
      productAllowed &&
      cultivarAllowed &&
      (scope.coordinates.regionId === "authorized-all" ||
        scope.coordinates.regionId === object.regionId) &&
      (!scope.coordinates.productId ||
        object.productIds.includes(scope.coordinates.productId)) &&
      (!scope.coordinates.cultivarId ||
        object.cultivarIds.includes(scope.coordinates.cultivarId));
    if (!visible) return [];
    const productCoordinates = object.productIds.flatMap((productId, index) =>
      serverAuthoritative ||
      scope.authorization.authorizedProductIds.includes(productId)
        ? [
            {
              id: productId,
              label: object.productLabels[index] ?? "未提供作物名称",
            },
          ]
        : [],
    );
    const cultivarCoordinates = object.cultivarIds.flatMap(
      (cultivarId, index) =>
        serverAuthoritative ||
        scope.authorization.authorizedCultivarIds.includes(cultivarId)
          ? [
              {
                id: cultivarId,
                label: object.cultivarLabels[index] ?? "未提供品种名称",
              },
            ]
          : [],
    );
    return [
      {
        ...object,
        productIds: productCoordinates.map(({ id }) => id),
        productLabels: productCoordinates.map(({ label }) => label),
        cultivarIds: cultivarCoordinates.map(({ id }) => id),
        cultivarLabels: cultivarCoordinates.map(({ label }) => label),
      },
    ];
  });
}
