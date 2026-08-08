import type { BusinessClassification } from "./businessClassification";
import type { EnterpriseRegionId } from "../enterpriseRegions";
import type { BusinessCoordinates } from "../formalEnterpriseModel";

export interface OperationalScope {
  workUnit: { organizationId: string; unitId: string; label: string };
  identity: { userId: string; postId: string; displayName?: string };
  authorization: {
    authorizedRegionIds: readonly EnterpriseRegionId[];
    authorizedBusinessClassificationIds: readonly BusinessClassification["id"][];
    authorizedProductIds: readonly string[];
    authorizedCultivarIds: readonly string[];
    authorizedReleaseVersionIds: readonly string[];
    permissionKeys: readonly string[];
  };
  coordinates: BusinessCoordinates;
  savedView: {
    id: string;
    label: string;
    coordinates: BusinessCoordinates;
    columnIds: readonly string[];
    sort: readonly { field: string; direction: "asc" | "desc" }[];
  } | null;
}

export interface OperationalScopeIssue {
  code:
    | "unknown-or-unauthorized-region"
    | "unknown-or-unauthorized-business-subtype"
    | "unknown-or-unauthorized-product"
    | "unknown-or-unauthorized-cultivar"
    | "unknown-or-unauthorized-release-version"
    | "invalid-data-layer";
  value: string;
}

export interface OperationalScopeReadResult {
  scope: OperationalScope;
  issues: readonly OperationalScopeIssue[];
  queryAllowed: boolean;
}

export type OperationalScopeIdentity = Omit<
  OperationalScope,
  "coordinates" | "savedView"
>;

const coordinateKeys = {
  regionId: "region",
  regionLevel: "regionLevel",
  businessDomainId: "businessDomain",
  businessSubtypeId: "businessSubtype",
  productId: "product",
  cultivarId: "cultivar",
  periodKey: "period",
  dataCutoff: "dataCutoff",
  dataLayer: "dataLayer",
  releaseVersion: "releaseVersion",
  riskState: "riskState",
  selectedMetricId: "selectedMetric",
} as const;

export function readOperationalScope(
  search: string,
  identity: OperationalScopeIdentity,
): OperationalScopeReadResult {
  const parameters = new URLSearchParams(search);
  const issues: OperationalScopeIssue[] = [];
  const coordinates: BusinessCoordinates = { regionId: "authorized-all" };
  const requestedRegion = parameters.get(coordinateKeys.regionId);

  if (
    requestedRegion &&
    requestedRegion !== "authorized-all" &&
    !identity.authorization.authorizedRegionIds.includes(
      requestedRegion as EnterpriseRegionId,
    )
  ) {
    issues.push({
      code: "unknown-or-unauthorized-region",
      value: requestedRegion,
    });
  } else if (requestedRegion) {
    coordinates.regionId = requestedRegion;
  }

  const subtype = parameters.get(coordinateKeys.businessSubtypeId);
  if (subtype) {
    const authorized =
      identity.authorization.authorizedBusinessClassificationIds.some(
        (id) => id === subtype || id.endsWith(`.${subtype}`),
      );
    if (!authorized) {
      issues.push({
        code: "unknown-or-unauthorized-business-subtype",
        value: subtype,
      });
    } else {
      coordinates.businessSubtypeId = subtype;
    }
  }

  readAuthorizedParameter(
    parameters,
    coordinateKeys.productId,
    identity.authorization.authorizedProductIds,
    "unknown-or-unauthorized-product",
    issues,
    (value) => (coordinates.productId = value),
  );
  readAuthorizedParameter(
    parameters,
    coordinateKeys.cultivarId,
    identity.authorization.authorizedCultivarIds,
    "unknown-or-unauthorized-cultivar",
    issues,
    (value) => (coordinates.cultivarId = value),
  );
  readAuthorizedParameter(
    parameters,
    coordinateKeys.releaseVersion,
    identity.authorization.authorizedReleaseVersionIds,
    "unknown-or-unauthorized-release-version",
    issues,
    (value) => (coordinates.releaseVersion = value),
  );

  const dataLayer = parameters.get(coordinateKeys.dataLayer);
  if (dataLayer && dataLayer !== "preliminary" && dataLayer !== "official") {
    issues.push({ code: "invalid-data-layer", value: dataLayer });
  } else if (dataLayer) {
    coordinates.dataLayer = dataLayer as BusinessCoordinates["dataLayer"];
  }

  for (const key of [
    "regionLevel",
    "businessDomainId",
    "periodKey",
    "dataCutoff",
    "riskState",
    "selectedMetricId",
  ] as const) {
    const value = parameters.get(coordinateKeys[key]);
    if (value) Object.assign(coordinates, { [key]: value });
  }

  return {
    scope: { ...identity, coordinates, savedView: null },
    issues,
    queryAllowed: issues.length === 0,
  };
}

function readAuthorizedParameter(
  parameters: URLSearchParams,
  key: string,
  authorizedValues: readonly string[],
  code: Exclude<
    OperationalScopeIssue["code"],
    | "unknown-or-unauthorized-region"
    | "unknown-or-unauthorized-business-subtype"
    | "invalid-data-layer"
  >,
  issues: OperationalScopeIssue[],
  assign: (value: string) => void,
) {
  const value = parameters.get(key);
  if (!value) return;
  if (!authorizedValues.includes(value)) {
    issues.push({ code, value });
    return;
  }
  assign(value);
}

export function writeOperationalCoordinates(
  coordinates: BusinessCoordinates,
): string {
  const parameters = new URLSearchParams();
  for (const [coordinate, key] of Object.entries(coordinateKeys) as [
    keyof BusinessCoordinates,
    string,
  ][]) {
    const value = coordinates[coordinate];
    if (value) parameters.set(key, value);
  }
  return parameters.toString();
}
