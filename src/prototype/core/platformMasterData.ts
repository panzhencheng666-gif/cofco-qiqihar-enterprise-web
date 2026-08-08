import type { OperationalScopeIdentity } from "./operationalScope";
import {
  businessClassifications,
  type BusinessClassification,
  type BusinessClassificationDomain,
} from "./businessClassification";
import {
  enterpriseRegionGroups,
  type EnterpriseRegionGroup,
  type EnterpriseRegionId,
} from "../enterpriseRegions";

export interface PlatformBusinessDomain {
  id: BusinessClassificationDomain;
  label: string;
}

export type PlatformProductId =
  | "corn"
  | "soybean"
  | "paddy"
  | "wheat"
  | "rice"
  | "soymeal"
  | "soyoil"
  | "soy-protein"
  | "agri-input";

export interface PlatformProduct {
  id: PlatformProductId;
  label: string;
  kind: "粮食作物" | "加工产品" | "农资";
}

export type PlatformCultivarId =
  | "demeiya-3"
  | "jingke-968"
  | "xianyu-335"
  | "heinong-84"
  | "dongsheng-22"
  | "longjing-31"
  | "suijing-18"
  | "longmai-35"
  | "kechun-14";

export interface PlatformCultivar {
  id: PlatformCultivarId;
  label: string;
  applicableProductIds: readonly PlatformProductId[];
}

export type PlatformPeriodTypeId =
  "day" | "week" | "ten-day" | "month" | "natural-year" | "marketing-year";

export interface PlatformPeriodType {
  id: PlatformPeriodTypeId;
  label: string;
}

export type PlatformReleaseBatchId =
  | "METRIC-2026-W31-V3"
  | "PRODUCTION-2026-W31-APPROVED"
  | "MARKET-2026-W31-APPROVED"
  | "SUPPLY-2026-MY-APPROVED"
  | "OPERATIONS-2026-W31-APPROVED"
  | "REPORTING-2026-W31-APPROVED";

export interface PlatformReleaseBatch {
  id: PlatformReleaseBatchId;
  label: string;
  applicableBusinessClassificationIds: readonly BusinessClassification["id"][];
}

export const platformBusinessDomains: readonly PlatformBusinessDomain[] = [
  { id: "production", label: "产情监测" },
  { id: "market", label: "市场监测" },
  { id: "supply", label: "供需核算" },
  { id: "operations", label: "经营履责" },
  { id: "reporting", label: "报告中心" },
];

export const platformProducts: PlatformProduct[] = [
  { id: "corn", label: "玉米", kind: "粮食作物" },
  { id: "soybean", label: "大豆", kind: "粮食作物" },
  { id: "paddy", label: "稻谷", kind: "粮食作物" },
  { id: "wheat", label: "小麦", kind: "粮食作物" },
  { id: "rice", label: "大米", kind: "加工产品" },
  { id: "soymeal", label: "豆粕", kind: "加工产品" },
  { id: "soyoil", label: "豆油", kind: "加工产品" },
  { id: "soy-protein", label: "大豆蛋白", kind: "加工产品" },
  { id: "agri-input", label: "农资", kind: "农资" },
];

export const platformCultivars: PlatformCultivar[] = [
  {
    id: "demeiya-3",
    label: "德美亚3号",
    applicableProductIds: ["corn"],
  },
  {
    id: "jingke-968",
    label: "京科968",
    applicableProductIds: ["corn"],
  },
  {
    id: "xianyu-335",
    label: "先玉335",
    applicableProductIds: ["corn"],
  },
  {
    id: "heinong-84",
    label: "黑农84",
    applicableProductIds: ["soybean"],
  },
  {
    id: "dongsheng-22",
    label: "东生22",
    applicableProductIds: ["soybean"],
  },
  {
    id: "longjing-31",
    label: "龙粳31",
    applicableProductIds: ["paddy"],
  },
  {
    id: "suijing-18",
    label: "绥粳18",
    applicableProductIds: ["paddy"],
  },
  {
    id: "longmai-35",
    label: "龙麦35",
    applicableProductIds: ["wheat"],
  },
  {
    id: "kechun-14",
    label: "克春14号",
    applicableProductIds: ["wheat"],
  },
];

const backendProductIds: Readonly<Record<string, PlatformProductId>> = {
  CORN: "corn",
  SOYBEAN: "soybean",
  RICE: "paddy",
};

const backendProductKinds: Readonly<
  Record<PlatformProductId, PlatformProduct["kind"]>
> = {
  corn: "粮食作物",
  soybean: "粮食作物",
  paddy: "粮食作物",
  wheat: "粮食作物",
  rice: "加工产品",
  soymeal: "加工产品",
  soyoil: "加工产品",
  "soy-protein": "加工产品",
  "agri-input": "农资",
};

/** Replace display master data in-place after the API returns. Existing workspace
 * imports keep the same array reference, so no page needs a fixture-specific
 * refresh path. Unknown backend products are ignored until their UI contract is
 * defined instead of being shown as a misleading hardcoded crop. */
export function applyBackendProductMasterData(
  products: readonly { code: string; name: string }[],
): void {
  const next = products.flatMap((product) => {
    const id = backendProductIds[product.code];
    return id
      ? [{ id, label: product.name, kind: backendProductKinds[id] }]
      : [];
  });
  if (next.length === 0) return;
  platformProducts.splice(0, platformProducts.length, ...next);
}

export function applyBackendCultivarMasterData(
  cultivars: readonly { code: string; name: string; productCode: string }[],
): void {
  const next = cultivars.flatMap((cultivar) => {
    const productId = backendProductIds[cultivar.productCode];
    if (!productId) return [];
    return [
      {
        id: cultivar.code as PlatformCultivarId,
        label: cultivar.name,
        applicableProductIds: [productId],
      },
    ];
  });
  if (next.length > 0)
    platformCultivars.splice(0, platformCultivars.length, ...next);
}

export const platformPeriodTypes: readonly PlatformPeriodType[] = [
  { id: "day", label: "日度" },
  { id: "week", label: "周度" },
  { id: "ten-day", label: "旬度" },
  { id: "month", label: "月度" },
  { id: "natural-year", label: "自然年度" },
  { id: "marketing-year", label: "营销年度" },
];

const periodTypeIdsByBusiness = {
  "production.planting-production": [
    "week",
    "ten-day",
    "month",
    "natural-year",
  ],
  "production.cost-support": ["month", "natural-year"],
  "production.farmer-stock-sales": ["week", "month", "natural-year"],
  "production.planting-intention": ["ten-day", "month", "natural-year"],
  "production.quality-survey": ["week", "month", "natural-year"],
  "market.quote-trade": ["day", "week", "month"],
  "market.quality": ["week", "month"],
  "market.inventory": ["week", "month"],
  "market.processing": ["week", "month"],
  "market.consumption-use": ["week", "month"],
  "market.sales": ["week", "month"],
  "market.logistics": ["day", "week", "month"],
  "market.agricultural-input": ["week", "month"],
  "supply.supply": ["marketing-year"],
  "supply.use-outflow": ["marketing-year"],
  "supply.results": ["marketing-year"],
  "supply.auxiliary": ["marketing-year"],
  "operations.obligation-performance": ["week", "month"],
  "operations.data-quality": ["week", "month"],
  "reporting.production": ["week", "month", "natural-year"],
  "reporting.market": ["day", "week", "month"],
  "reporting.supply": ["marketing-year"],
  "reporting.cross-business": [
    "day",
    "week",
    "month",
    "natural-year",
    "marketing-year",
  ],
  "reporting.duty": ["week", "month"],
} as const satisfies Record<
  BusinessClassification["id"],
  readonly PlatformPeriodTypeId[]
>;

const classificationsByDomain = (
  domain: BusinessClassificationDomain,
): readonly BusinessClassification["id"][] =>
  businessClassifications
    .filter((classification) => classification.domain === domain)
    .map(({ id }) => id);

const allBusinessClassificationIds = businessClassifications.map(
  ({ id }) => id,
);

export const platformReleaseBatches: readonly PlatformReleaseBatch[] = [
  {
    id: "METRIC-2026-W31-V3",
    label: "2026年第31周已核定数据（当前采用）",
    applicableBusinessClassificationIds: allBusinessClassificationIds,
  },
  {
    id: "PRODUCTION-2026-W31-APPROVED",
    label: "2026年第31周产情已核定数据",
    applicableBusinessClassificationIds: [
      ...classificationsByDomain("production"),
      "reporting.production",
    ],
  },
  {
    id: "MARKET-2026-W31-APPROVED",
    label: "2026年第31周市场已核定数据",
    applicableBusinessClassificationIds: [
      ...classificationsByDomain("market"),
      "reporting.market",
    ],
  },
  {
    id: "SUPPLY-2026-MY-APPROVED",
    label: "2026/27营销年度供需已核定数据",
    applicableBusinessClassificationIds: [
      ...classificationsByDomain("supply"),
      "reporting.supply",
    ],
  },
  {
    id: "OPERATIONS-2026-W31-APPROVED",
    label: "2026年第31周履责与质量已核定数据",
    applicableBusinessClassificationIds: [
      ...classificationsByDomain("operations"),
      "reporting.duty",
    ],
  },
  {
    id: "REPORTING-2026-W31-APPROVED",
    label: "2026年第31周报告采用数据",
    applicableBusinessClassificationIds: classificationsByDomain("reporting"),
  },
];

export const platformMasterData = {
  regionGroups: enterpriseRegionGroups,
  businessDomains: platformBusinessDomains,
  businessClassifications,
  products: platformProducts,
  cultivars: platformCultivars,
  periodTypes: platformPeriodTypes,
  releaseBatches: platformReleaseBatches,
} as const;

export type PlatformMasterDataAuthorization = Pick<
  OperationalScopeIdentity["authorization"],
  | "authorizedRegionIds"
  | "authorizedBusinessClassificationIds"
  | "authorizedProductIds"
  | "authorizedCultivarIds"
  | "authorizedReleaseVersionIds"
>;

export const prototypeMasterDataAuthorization = {
  authorizedRegionIds: enterpriseRegionGroups.flatMap(({ regions }) =>
    regions.map(({ id }) => id),
  ),
  authorizedBusinessClassificationIds: allBusinessClassificationIds,
  authorizedProductIds: platformProducts.map(({ id }) => id),
  authorizedCultivarIds: [
    "demeiya-3",
    "jingke-968",
    "xianyu-335",
    "heinong-84",
    "dongsheng-22",
    "longjing-31",
    "suijing-18",
    "longmai-35",
    "kechun-14",
  ],
  authorizedReleaseVersionIds: platformReleaseBatches.map(({ id }) => id),
} as const satisfies PlatformMasterDataAuthorization;

export function getApplicableCultivars(
  productId: string,
): readonly PlatformCultivar[] {
  if (!platformProducts.some(({ id }) => id === productId)) return [];
  return platformCultivars.filter(({ applicableProductIds }) =>
    applicableProductIds.includes(productId as PlatformProductId),
  );
}

export function isCultivarApplicableToProduct(
  productId: string,
  cultivarId: string,
): boolean {
  return getApplicableCultivars(productId).some(({ id }) => id === cultivarId);
}

export function getApplicablePeriodTypes(
  businessClassificationId: string,
): readonly PlatformPeriodType[] {
  const periodTypeIds =
    periodTypeIdsByBusiness[
      businessClassificationId as BusinessClassification["id"]
    ];
  if (!periodTypeIds) return [];
  const applicablePeriodTypeIds = new Set<PlatformPeriodTypeId>(periodTypeIds);
  return platformPeriodTypes.filter(({ id }) =>
    applicablePeriodTypeIds.has(id),
  );
}

export function isPeriodTypeApplicableToBusiness(
  businessClassificationId: string,
  periodTypeId: string,
): boolean {
  return getApplicablePeriodTypes(businessClassificationId).some(
    ({ id }) => id === periodTypeId,
  );
}

export function getApplicableReleaseBatches(
  businessClassificationId: string,
): readonly PlatformReleaseBatch[] {
  if (
    !businessClassifications.some(({ id }) => id === businessClassificationId)
  )
    return [];
  return platformReleaseBatches.filter(
    ({ applicableBusinessClassificationIds }) =>
      applicableBusinessClassificationIds.includes(
        businessClassificationId as BusinessClassification["id"],
      ),
  );
}

export function isReleaseBatchApplicableToBusiness(
  businessClassificationId: string,
  releaseBatchId: string,
): boolean {
  return getApplicableReleaseBatches(businessClassificationId).some(
    ({ id }) => id === releaseBatchId,
  );
}

export interface AuthorizedPlatformMasterData {
  regionGroups: readonly EnterpriseRegionGroup[];
  businessDomains: readonly PlatformBusinessDomain[];
  businessClassifications: readonly BusinessClassification[];
  products: readonly PlatformProduct[];
  cultivars: readonly PlatformCultivar[];
  periodTypes: readonly PlatformPeriodType[];
  releaseBatches: readonly PlatformReleaseBatch[];
}

export function filterPlatformMasterDataByAuthorization(
  authorization: PlatformMasterDataAuthorization,
): AuthorizedPlatformMasterData {
  const regionIds = new Set<EnterpriseRegionId>(
    authorization.authorizedRegionIds,
  );
  const classificationIds = new Set(
    authorization.authorizedBusinessClassificationIds,
  );
  const productIds = new Set(authorization.authorizedProductIds);
  const cultivarIds = new Set(authorization.authorizedCultivarIds);
  const releaseBatchIds = new Set(authorization.authorizedReleaseVersionIds);

  const regionGroups = enterpriseRegionGroups.flatMap((group) => {
    const regions = group.regions.filter(({ id }) => regionIds.has(id));
    return regions.length > 0 ? [{ ...group, regions }] : [];
  });
  const authorizedClassifications = businessClassifications.filter(({ id }) =>
    classificationIds.has(id),
  );
  const authorizedDomainIds = new Set(
    authorizedClassifications.map(({ domain }) => domain),
  );
  const products = platformProducts.filter(({ id }) => productIds.has(id));
  const authorizedProductIds = new Set(products.map(({ id }) => id));
  const cultivars = platformCultivars.filter(
    ({ id, applicableProductIds }) =>
      cultivarIds.has(id) &&
      applicableProductIds.some((productId) =>
        authorizedProductIds.has(productId),
      ),
  );
  const periodTypeIds = new Set(
    authorizedClassifications.flatMap(({ id }) => periodTypeIdsByBusiness[id]),
  );
  const authorizedClassificationIds = new Set(
    authorizedClassifications.map(({ id }) => id),
  );
  const releaseBatches = platformReleaseBatches.filter(
    ({ id, applicableBusinessClassificationIds }) =>
      releaseBatchIds.has(id) &&
      applicableBusinessClassificationIds.some((businessId) =>
        authorizedClassificationIds.has(businessId),
      ),
  );

  return {
    regionGroups,
    businessDomains: platformBusinessDomains.filter(({ id }) =>
      authorizedDomainIds.has(id),
    ),
    businessClassifications: authorizedClassifications,
    products,
    cultivars,
    periodTypes: platformPeriodTypes.filter(({ id }) => periodTypeIds.has(id)),
    releaseBatches,
  };
}
