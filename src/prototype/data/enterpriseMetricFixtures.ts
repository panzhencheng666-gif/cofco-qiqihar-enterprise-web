import { businessClassifications, type BusinessClassification } from "../core/businessClassification";
import {
  buildComparisonSet,
  type MetricComparisonQuery,
  type MetricComparisonQueryResult,
  type PublishedMetricPoint,
  type ReleasedMetricCoordinate,
} from "../core/comparableSeries";
import { fixedDecimal } from "../core/fixedDecimal";
import type { MetricDefinition } from "../core/metricCatalog";
import { validateMetricDefinition } from "../core/metricCatalog";
import type { EnterpriseRegionId } from "../enterpriseRegions";

export interface AggregateRegionMembershipSnapshot {
  regionId: "authorized-all";
  regionBoundaryVersionId: string;
  memberRegionIds: readonly EnterpriseRegionId[];
}

export const aggregateRegionMembershipSnapshots: readonly AggregateRegionMembershipSnapshot[] = [
  {
    regionId: "authorized-all",
    regionBoundaryVersionId: "authorized-membership-2026-v1",
    memberRegionIds: ["qiqihar-all", "qiqihar-nehe"],
  },
];

type DefinitionSeed = readonly [
  metricId: string,
  label: string,
  businessSubtype: BusinessClassification["id"],
  measureType?: MetricDefinition["measureType"],
  aggregation?: MetricDefinition["aggregation"],
];

const definitionSeeds: readonly DefinitionSeed[] = [
  ["production.planted-area", "播种面积", "production.planting-production"],
  ["production.harvested-area", "收获面积", "production.planting-production"],
  ["production.unharvested-area", "未收获面积", "production.planting-production"],
  ["production.affected-area", "受灾面积", "production.planting-production"],
  ["production.disaster-area", "成灾面积", "production.planting-production"],
  ["production.total-loss-area", "绝收面积", "production.planting-production"],
  ["production.growth-condition", "长势指数", "production.planting-production", "ratio", "weighted-average"],
  ["production.regional-yield", "区域加权单产", "production.planting-production", "ratio", "ratio-of-aggregates"],
  ["production.sample-average-yield", "样本平均单产", "production.planting-production", "ratio", "weighted-average"],
  ["production.expected-yield", "预计单产", "production.planting-production", "ratio", "weighted-average"],
  ["production.total-output", "总产量", "production.planting-production"],
  ["production.cost-per-area", "亩均成本", "production.cost-support", "amount"],
  ...Object.entries({ "land-rent": "地租", "seed-cost": "种子成本", "pesticide-cost": "农药成本", "fertilizer-cost": "化肥成本", "irrigation-cost": "灌溉成本", "labor-cost": "人工成本", "machinery-cost": "机耕成本", subsidy: "补贴", insurance: "保险" }).map(([id, label]) => [`production.${id}`, label, "production.cost-support", "amount"] as DefinitionSeed),
  ["production.farmer-opening-stock", "农户期初库存", "production.farmer-stock-sales"],
  ["production.farmer-stock-inflow", "农户入库", "production.farmer-stock-sales"],
  ["production.farmer-stock-loss", "农户损耗", "production.farmer-stock-sales"],
  ["production.farmer-stock", "农户期末余粮", "production.farmer-stock-sales", "quantity", "ending-balance"],
  ["production.sales-volume", "农户销售量", "production.farmer-stock-sales"],
  ["production.sales-price", "农户销售价", "production.farmer-stock-sales", "price", "weighted-average"],
  ["production.intended-area", "意向面积", "production.planting-intention"],
  ...Object.entries({ moisture: "水分", "test-weight": "容重", impurity: "杂质", "imperfect-grain": "不完善粒", mildew: "霉变", toxin: "毒素" }).map(([id, label]) => [`production.quality-${id}`, label, "production.quality-survey", "ratio", "weighted-average"] as DefinitionSeed),
  ["market.purchase-price", "采购价", "market.quote-trade", "price", "weighted-average"],
  ["market.transaction-price", "成交价", "market.quote-trade", "price", "weighted-average"],
  ["market.trade-volume", "成交量", "market.quote-trade"],
  ["market.quality-moisture", "市场水分", "market.quality", "ratio", "weighted-average"],
  ["market.quality-impurity", "市场杂质", "market.quality", "ratio", "weighted-average"],
  ["market.inventory-opening", "市场期初库存", "market.inventory"],
  ["market.inventory-inflow", "市场入库", "market.inventory"],
  ["market.inventory-outflow", "市场出库", "market.inventory"],
  ["market.inventory-loss", "市场库存损耗", "market.inventory"],
  ["market.inventory", "市场期末库存", "market.inventory", "quantity", "ending-balance"],
  ["market.sales-volume", "市场销售量", "market.sales"],
  ["market.sales-price", "市场销售价", "market.sales", "price", "weighted-average"],
  ["market.processing-input", "加工原料投入", "market.processing"],
  ["market.processing-output", "加工产品产出", "market.processing"],
  ["market.byproduct-output", "副产品产出", "market.processing"],
  ["market.processing-loss", "加工损耗", "market.processing"],
  ["market.processing-capacity", "加工产能", "market.processing"],
  ["market.operating-rate", "开机率", "market.processing", "percentage", "weighted-average"],
  ["market.direct-use", "直接使用量", "market.consumption-use"],
  ["market.inflow", "区域流入", "market.logistics"],
  ["market.outflow", "区域流出", "market.logistics"],
  ["market.freight-volume", "运输量", "market.logistics"],
  ["market.freight-rate", "运价", "market.logistics", "price", "median"],
  ["market.agri-input-price", "农资价格", "market.agricultural-input", "price", "median"],
  ["market.agri-input-inventory", "农资库存", "market.agricultural-input"],
  ["market.agri-input-sales", "农资销量", "market.agricultural-input"],
  ["supply.total-supply", "总供给", "supply.supply", "quantity", "rule-derived"],
  ["supply.total-use", "总使用与外流", "supply.use-outflow", "quantity", "rule-derived"],
  ["supply.other-use", "其他使用", "supply.use-outflow", "quantity", "rule-derived"],
  ["supply.book-ending", "调整前账面期末", "supply.results", "quantity", "rule-derived"],
  ["supply.approved-adjustment", "批准库存调整", "supply.results", "signed-difference", "rule-derived"],
  ["supply.adopted-ending", "采用后账面期末", "supply.results", "quantity", "ending-balance"],
  ["supply.survey-ending", "调查汇总期末", "supply.results", "quantity", "ending-balance"],
  ["supply.inventory-difference", "库存平衡差额", "supply.results", "signed-difference", "rule-derived"],
  ["supply.input-coverage-rate", "供需输入覆盖率", "supply.auxiliary", "percentage", "weighted-average"],
  ["operations.coverage-rate", "报送覆盖率", "operations.obligation-performance", "percentage", "ratio-of-aggregates"],
  ["operations.on-time-rate", "按时率", "operations.obligation-performance", "percentage", "ratio-of-aggregates"],
  ["operations.quality-block-rate", "质量阻断率", "operations.data-quality", "percentage", "ratio-of-aggregates"],
];

function createDefinition(seed: DefinitionSeed): MetricDefinition {
  const [metricId, label, businessSubtype, measureType = "quantity", aggregation = "sum"] = seed;
  const domain = metricId.split(".")[0] as MetricDefinition["domain"];
  const priceStatisticId = domain === "market" || measureType === "price" ? `${metricId}.governed-statistic-v1` : null;
  const relativeChange = measureType === "percentage" ? "percentage-points" : measureType === "signed-difference" ? "absolute-only" : "allowed";
  const unit = metricUnit(metricId, measureType);
  return validateMetricDefinition({
    metricId,
    label,
    domain,
    businessSubtype,
    measureType,
    formula: metricFormula(metricId, label, aggregation),
    unit,
    aggregation,
    definitionVersionId: `${metricId}.definition-v1`,
    displayScale: 1,
    trendDirection: "neutral",
    priceStatisticId,
    comparisonPolicy: {
      relativeChange,
      cagr: relativeChange === "allowed" ? "allowed" : "not-applicable",
      comparabilityRuleVersionId: "comparability-v1",
    },
    anomalyRuleVersionId: "anomaly-v1",
  });
}

function metricUnit(metricId: string, measureType: MetricDefinition["measureType"]): string {
  if (measureType === "percentage") return "%";
  if (measureType === "price") return metricId === "market.freight-rate" ? "元/吨公里" : "元/吨";
  if (metricId.includes("area")) return "万亩";
  if (metricId.includes("yield")) return "公斤/亩";
  if (metricId === "production.quality-test-weight") return "克/升";
  if (metricId === "production.quality-toxin") return "微克/千克";
  if (metricId === "production.growth-condition") return "指数";
  if (metricId === "market.processing-capacity") return "万吨/年";
  if (metricId.includes("cost") || metricId.endsWith("land-rent") || metricId.endsWith("subsidy") || metricId.endsWith("insurance")) return "元/亩";
  if (metricId.includes("quality-") || metricId === "production.growth-condition") return "%";
  return "万吨";
}

function metricFormula(metricId: string, label: string, aggregation: MetricDefinition["aggregation"]): string {
  const exact: Record<string, string> = {
    "production.regional-yield": "区域规范总产量 / 区域规范收获面积",
    "production.sample-average-yield": "样本单产算术平均，不代替区域加权估计",
    "production.expected-yield": "按当前长势与测产依据形成的预计单产",
    "production.total-output": "规范收获面积 × 区域加权单产",
    "supply.total-supply": "期初库存 + 本地生产 + 区域外流入 + 进口 + 批准的其他供给",
    "supply.total-use": "口粮 + 饲用 + 种用 + 加工投入 + 损耗 + 区域外流出 + 出口 + 批准的其他使用",
    "supply.book-ending": "总供给 - 总使用与外流",
    "supply.adopted-ending": "调整前账面期末 + 已批准库存调整",
    "supply.inventory-difference": "调查汇总期末 - 采用后账面期末",
  };
  if (exact[metricId]) return exact[metricId];
  if (aggregation === "ending-balance") return `按${label}规范事实的期末余额规则计算`;
  if (aggregation === "ratio-of-aggregates") return `${label}治理分子合计 / 治理分母合计`;
  if (aggregation === "weighted-average") return `${label}按已发布权重加权汇总`;
  if (aggregation === "median") return `${label}按同坐标有效样本取中位数`;
  if (aggregation === "rule-derived") return `${label}按固定规则版本计算`;
  return `${label}规范事实按完整治理坐标求和`;
}

export const enterpriseMetricDefinitions: readonly MetricDefinition[] = definitionSeeds.map(createDefinition);

function domainDimensions(definition: MetricDefinition): ReleasedMetricCoordinate["domainDimensions"] {
  if (definition.domain === "production") return { domain: "production", areaBasisId: definition.metricId === "production.regional-yield" ? "harvested-area" : "governed-area", yieldMethodId: definition.metricId.includes("yield") ? "governed-weighted-estimate" : null, growthStageId: null, surveyRoundId: "annual-final", costAllocationRuleId: definition.businessSubtype === "production.cost-support" ? "cost-allocation-v1" : null };
  if (definition.domain === "market") return { domain: "market", statisticId: definition.priceStatisticId ?? `${definition.metricId}.governed-statistic-v1`, currency: definition.measureType === "price" ? "CNY" : null, taxTreatmentId: definition.measureType === "price" ? "tax-included" : null, packagingConditionId: "bulk", settlementConditionId: definition.measureType === "price" ? "spot" : null, logisticsRouteId: definition.businessSubtype === "market.logistics" ? "authorized-route-network-v1" : null, processingConversionBasisId: definition.businessSubtype === "market.processing" ? "processing-basis-v1" : null };
  if (definition.domain === "supply") return { domain: "supply", accountStandardVersionId: "supply-account-standard-v1", consolidationScopeId: "authorized-scope-v1", ruleComparabilityVersionId: "supply-rule-comparison-v1", marketingYearStageKey: "final" };
  return { domain: "operations", obligationSetVersionId: "obligation-set-v1", eligiblePopulationId: "authorized-obligations-v1" };
}

function availablePoint(definition: MetricDefinition, year: number, value: string): PublishedMetricPoint {
  const agriculturalInput = definition.businessSubtype === "market.agricultural-input";
  return {
    availability: "available",
    coordinate: {
      metricId: definition.metricId,
      regionId: "authorized-all",
      regionBoundaryVersionId: "authorized-membership-2026-v1",
      cropId: definition.domain === "production" || (definition.domain === "market" && !agriculturalInput) ? "corn" : null,
      commodityId: definition.domain === "market" ? agriculturalInput ? "agri-input" : "corn-grain" : null,
      productFormId: definition.domain === "production" || definition.domain === "market" ? agriculturalInput ? "agricultural-input" : "grain-unprocessed" : null,
      productAccountId: definition.domain === "supply" ? "corn-account" : null,
      cultivarId: null,
      qualityConditionId: definition.businessSubtype.includes("quality") ? "governed-quality-v1" : null,
      priceConditionId: definition.measureType === "price" ? "governed-price-condition-v1" : null,
      deliveryConditionId: definition.measureType === "price" ? "warehouse-delivery" : null,
      populationOrSampleId: definition.domain === "operations" ? "authorized-obligation-population" : "authorized-weighted-population",
      unitDefinitionVersionId: `${definition.unit}.definition-v1`,
      inventoryNatureId: definition.metricId.includes("inventory") || definition.metricId.includes("stock") ? "commercial" : null,
      statisticalMomentId: definition.aggregation === "ending-balance" ? "year-end" : "annual-final",
      consolidationMatrixVersionId: definition.domain === "supply" ? "supply-consolidation-v1" : null,
      domainDimensions: domainDimensions(definition),
      period: { year, granularity: "year", periodKey: `${year}`, samePeriodKey: "annual-final", cutoff: `${year}-12-31T23:59:59+08:00` },
      dataLayer: "official",
      inputReleaseVersionIds: [`facts-${year}-v1`],
      metricReleaseVersionId: `metric-${year}-v1`,
      releaseLineage: { kind: "standard-metric" },
    },
    value: fixedDecimal(value),
    unit: definition.unit,
    coverageRate: fixedDecimal("98.5"),
    qualityStatus: "passed",
    definitionVersionId: definition.definitionVersionId,
    conversionVersionId: null,
  };
}

function valuesFor(definition: MetricDefinition): readonly string[] {
  const legacyCanonicalValues: Record<string, readonly string[]> = {
    "production.planted-area": ["1198.4", "1226.7", "1251.3", "1284.6"],
    "production.expected-yield": ["446.8", "454.1", "461.7", "468.2"],
    "production.sample-average-yield": ["450.2", "458.4", "465.9", "471.6"],
    "production.regional-yield": ["445.7", "452.9", "460.8", "468.2"],
  };
  if (legacyCanonicalValues[definition.metricId]) return legacyCanonicalValues[definition.metricId];
  if (definition.metricId === "operations.quality-block-rate") return ["2", "1", "1", "0"];
  if (definition.measureType === "percentage") return ["80", "84", "88", "92"];
  return ["100", "110", "121", "133.1"];
}

export const enterpriseMetricPoints: readonly PublishedMetricPoint[] = enterpriseMetricDefinitions
  .filter(({ domain }) => domain !== "supply")
  .flatMap((definition) => valuesFor(definition).map((value, index) => availablePoint(definition, 2023 + index, value)));

function normalizedSubtype(query: MetricComparisonQuery): BusinessClassification["id"] | null | undefined {
  const resolve = (requested: string | undefined): BusinessClassification["id"] | null | undefined => {
    if (!requested) return undefined;
    const candidates = businessClassifications.filter(({ id, domain }) =>
      domain === query.domain && (id === requested || id.endsWith(`.${requested}`)),
    );
    if (candidates.length !== 1) return null;
    const resolved = candidates[0].id;
    return query.scope.authorization.authorizedBusinessClassificationIds.includes(resolved) ? resolved : null;
  };
  const scopeSubtype = resolve(query.scope.coordinates.businessSubtypeId);
  const querySubtype = resolve(query.businessSubtype);
  if (scopeSubtype === null || querySubtype === null) return null;
  if (scopeSubtype && querySubtype && scopeSubtype !== querySubtype) return null;
  return querySubtype ?? scopeSubtype;
}

function regionIsAuthorized(query: MetricComparisonQuery): boolean {
  const regionId = query.scope.coordinates.regionId;
  if (regionId === "authorized-all") return aggregateRegionMembershipSnapshots.some(({ memberRegionIds }) => {
    const effective = [...query.scope.authorization.authorizedRegionIds].sort();
    return effective.length === memberRegionIds.length && [...memberRegionIds].sort().every((id, index) => id === effective[index]);
  });
  return query.scope.authorization.authorizedRegionIds.includes(regionId as EnterpriseRegionId);
}

export function queryPrototypeMetricComparisons(query: MetricComparisonQuery): readonly MetricComparisonQueryResult[] {
  if (query.queryAllowed !== true) return [];
  if (!query.scope.authorization.permissionKeys.includes("prototype:read")) return [];
  if (query.scope.coordinates.businessDomainId && query.scope.coordinates.businessDomainId !== query.domain) return [];
  const subtype = normalizedSubtype(query);
  if (subtype === null) return [];
  const selectedProduct = query.scope.coordinates.productId;
  const selectedCultivar = query.scope.coordinates.cultivarId;
  const productIsGoverned = query.domain !== "operations";
  const requestedProduct = selectedProduct ?? (query.scope.authorization.authorizedProductIds.length === 1 ? query.scope.authorization.authorizedProductIds[0] : undefined);
  const requestedCultivar = selectedCultivar;
  if (productIsGoverned && (!requestedProduct || !query.scope.authorization.authorizedProductIds.includes(requestedProduct))) return [];
  if (requestedCultivar && !query.scope.authorization.authorizedCultivarIds.includes(requestedCultivar)) return [];
  const selectedRelease = query.scope.coordinates.releaseVersion;
  if (selectedRelease && !query.scope.authorization.authorizedReleaseVersionIds.includes(selectedRelease)) return [];
  const definitions = enterpriseMetricDefinitions.filter((definition) =>
    definition.domain === query.domain
    && (subtype ? definition.businessSubtype === subtype : query.scope.authorization.authorizedBusinessClassificationIds.includes(definition.businessSubtype)),
  );
  const regionAvailable = regionIsAuthorized(query);
  return definitions.map((definition) => {
    const points = regionAvailable
      ? enterpriseMetricPoints.filter((point) =>
          point.coordinate.metricId === definition.metricId
          && point.coordinate.regionId === query.scope.coordinates.regionId
          && point.coordinate.dataLayer === (query.scope.coordinates.dataLayer ?? "official")
          && (!requestedProduct || definition.domain === "operations" || point.coordinate.cropId === requestedProduct || point.coordinate.commodityId === requestedProduct || point.coordinate.productAccountId === requestedProduct)
          && (point.coordinate.cultivarId === null
            ? !requestedCultivar
            : query.scope.authorization.authorizedCultivarIds.includes(point.coordinate.cultivarId)
              && (!requestedCultivar || point.coordinate.cultivarId === requestedCultivar))
          && point.coordinate.period.year >= query.currentYear - 3
          && point.coordinate.period.year <= query.currentYear,
        )
      : [];
    if (points.length !== 4) return { status: "no-release", metricId: definition.metricId, reason: "当前治理坐标没有四个年度的不可变发布点" };
    return {
      status: "ready",
      definition,
      comparison: buildComparisonSet({ definition, currentYear: query.currentYear, points: points as [PublishedMetricPoint, PublishedMetricPoint, PublishedMetricPoint, PublishedMetricPoint], approvedBridges: [] }),
    };
  });
}
