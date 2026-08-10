import type { FixedDecimal } from "./fixedDecimal";
import {
  cagrPercent,
  compareFixedDecimal,
  fixedDecimal,
  formatFixedDecimal,
  percentageChange,
  subtractFixedDecimal,
} from "./fixedDecimal";
import type { MetricDefinition } from "./metricCatalog";
import { validateMetricDefinition } from "./metricCatalog";
import type { BusinessClassification } from "./businessClassification";
import type { OperationalScope } from "./operationalScope";

export interface RequestedMetricCoordinate {
  metricId: string;
  regionId: string;
  regionBoundaryVersionId: string;
  cropId: string | null;
  commodityId: string | null;
  productFormId: string | null;
  productAccountId: string | null;
  cultivarId: string | null;
  qualityConditionId: string | null;
  priceConditionId: string | null;
  deliveryConditionId: string | null;
  populationOrSampleId: string;
  unitDefinitionVersionId: string;
  inventoryNatureId: string | null;
  statisticalMomentId: string;
  consolidationMatrixVersionId: string | null;
  domainDimensions:
    | {
        domain: "production";
        areaBasisId: string;
        yieldMethodId: string | null;
        growthStageId: string | null;
        surveyRoundId: string | null;
        costAllocationRuleId: string | null;
      }
    | {
        domain: "market";
        statisticId: string;
        currency: string | null;
        taxTreatmentId: string | null;
        packagingConditionId: string | null;
        settlementConditionId: string | null;
        logisticsRouteId: string | null;
        processingConversionBasisId: string | null;
      }
    | {
        domain: "supply";
        accountStandardVersionId: string;
        consolidationScopeId: string;
        ruleComparabilityVersionId: string;
        marketingYearStageKey: string;
      }
    | {
        domain: "operations";
        obligationSetVersionId: string;
        eligiblePopulationId: string;
      };
  period: {
    year: number;
    granularity: "year" | "marketing-year" | "month" | "week";
    periodKey: string;
    samePeriodKey: string;
    cutoff: string;
  };
  dataLayer: "preliminary" | "official";
}

export interface ReleasedMetricCoordinate extends RequestedMetricCoordinate {
  inputReleaseVersionIds: readonly string[];
  metricReleaseVersionId: string;
  releaseLineage:
    | { kind: "standard-metric" }
    | {
        kind: "supply-result";
        supplyAccountVersionId: string;
        ruleVersionId: string;
        resultReleaseVersionId: string;
      };
}

export type PublishedMetricPoint =
  | {
      availability: "available";
      coordinate: ReleasedMetricCoordinate;
      value: FixedDecimal;
      unit: string;
      coverageRate: FixedDecimal;
      qualityStatus: "passed" | "warning";
      definitionVersionId: string;
      conversionVersionId: string | null;
    }
  | {
      availability:
        | "missing"
        | "not-collected"
        | "not-applicable"
        | "no-release"
        | "rejected"
        | "pending-review";
      coordinate: RequestedMetricCoordinate;
      releaseAttempt: {
        inputReleaseVersionIds: readonly string[];
        metricReleaseVersionId: string | null;
      } | null;
      value: null;
      unit: string;
      coverageRate: FixedDecimal | null;
      qualityStatus: "warning" | "blocking";
      definitionVersionId: string;
      conversionVersionId: string | null;
      reason: string;
    };

export interface ApprovedMetricBridge {
  metricId: string;
  fromDefinitionVersionId: string;
  toDefinitionVersionId: string;
  conversionVersionId: string;
}

export interface ApprovedUnitConversion {
  metricId: string;
  fromUnitDefinitionVersionId: string;
  toUnitDefinitionVersionId: string;
  conversionVersionId: string;
}

export interface ComparisonPair {
  fromYear: number;
  toYear: number;
  kind: "year-over-year" | "current-vs-baseline";
  label: string;
  comparable: boolean;
  calculationAvailable: boolean;
  absoluteDelta: FixedDecimal | null;
  relativeRate: FixedDecimal | null;
  percentagePointDelta: FixedDecimal | null;
  reason: string | null;
  formula: string | null;
}

export interface ComparisonSet {
  metricId: string;
  points: readonly [
    PublishedMetricPoint,
    PublishedMetricPoint,
    PublishedMetricPoint,
    PublishedMetricPoint,
  ];
  pairs: readonly [ComparisonPair, ComparisonPair, ComparisonPair];
  currentVsBaselines: readonly [ComparisonPair, ComparisonPair, ComparisonPair];
  cagr:
    | { status: "available"; rate: FixedDecimal; formula: string }
    | { status: "unavailable"; reason: string };
  trend: {
    direction: "rising" | "falling" | "flat" | "mixed" | "insufficient";
    continuity: "continuous" | "broken";
    breakYears: readonly number[];
    anomalies: readonly string[];
  };
}

export interface MetricComparisonQuery {
  scope: OperationalScope;
  queryAllowed: boolean;
  domain: MetricDefinition["domain"];
  businessSubtype?: BusinessClassification["id"];
  currentYear: number;
}

export type MetricComparisonQueryResult =
  | { status: "ready"; definition: MetricDefinition; comparison: ComparisonSet }
  | { status: "no-release"; metricId: string; reason: string };

interface GovernedCoordinateRule<Key extends PropertyKey> {
  key: Key;
  label: string;
  mismatchReason: string;
  nullAllowed: boolean;
}

const BASE_COORDINATES = [
  {
    key: "regionId",
    label: "地区",
    mismatchReason: "地区不一致",
    nullAllowed: false,
  },
  {
    key: "regionBoundaryVersionId",
    label: "区划边界版本",
    mismatchReason: "区划边界版本不一致",
    nullAllowed: false,
  },
  {
    key: "cropId",
    label: "作物",
    mismatchReason: "作物不一致",
    nullAllowed: true,
  },
  {
    key: "commodityId",
    label: "商品",
    mismatchReason: "商品不一致",
    nullAllowed: true,
  },
  {
    key: "productFormId",
    label: "产品形态",
    mismatchReason: "产品形态不一致",
    nullAllowed: true,
  },
  {
    key: "productAccountId",
    label: "产品账户",
    mismatchReason: "产品账户不一致",
    nullAllowed: true,
  },
  {
    key: "cultivarId",
    label: "品种",
    mismatchReason: "品种不一致",
    nullAllowed: true,
  },
  {
    key: "qualityConditionId",
    label: "质量条件",
    mismatchReason: "质量条件不一致",
    nullAllowed: true,
  },
  {
    key: "priceConditionId",
    label: "价格条件",
    mismatchReason: "价格条件不一致",
    nullAllowed: true,
  },
  {
    key: "deliveryConditionId",
    label: "交付条件",
    mismatchReason: "交付条件不一致",
    nullAllowed: true,
  },
  {
    key: "populationOrSampleId",
    label: "总体或样本",
    mismatchReason: "总体或样本不一致",
    nullAllowed: false,
  },
  {
    key: "inventoryNatureId",
    label: "库存性质",
    mismatchReason: "库存性质不一致",
    nullAllowed: true,
  },
  {
    key: "statisticalMomentId",
    label: "统计时点",
    mismatchReason: "统计时点不一致",
    nullAllowed: false,
  },
  {
    key: "consolidationMatrixVersionId",
    label: "合并矩阵版本",
    mismatchReason: "合并矩阵不一致",
    nullAllowed: true,
  },
  {
    key: "dataLayer",
    label: "数据层",
    mismatchReason: "数据层不一致",
    nullAllowed: false,
  },
] as const satisfies readonly GovernedCoordinateRule<
  keyof RequestedMetricCoordinate
>[];

const PRODUCTION_COORDINATES = [
  {
    key: "areaBasisId",
    label: "面积口径",
    mismatchReason: "面积口径不一致",
    nullAllowed: false,
  },
  {
    key: "yieldMethodId",
    label: "单产方法",
    mismatchReason: "单产方法不一致",
    nullAllowed: true,
  },
  {
    key: "growthStageId",
    label: "生育阶段",
    mismatchReason: "生育阶段不一致",
    nullAllowed: true,
  },
  {
    key: "surveyRoundId",
    label: "调查轮次",
    mismatchReason: "调查轮次不一致",
    nullAllowed: true,
  },
  {
    key: "costAllocationRuleId",
    label: "成本分摊规则",
    mismatchReason: "成本分摊规则不一致",
    nullAllowed: true,
  },
] as const satisfies readonly GovernedCoordinateRule<
  keyof Extract<
    RequestedMetricCoordinate["domainDimensions"],
    { domain: "production" }
  >
>[];

const MARKET_COORDINATES = [
  {
    key: "statisticId",
    label: "市场统计量",
    mismatchReason: "市场统计量不一致",
    nullAllowed: false,
  },
  {
    key: "currency",
    label: "币种",
    mismatchReason: "币种不一致",
    nullAllowed: true,
  },
  {
    key: "taxTreatmentId",
    label: "税价口径",
    mismatchReason: "税价口径不一致",
    nullAllowed: true,
  },
  {
    key: "packagingConditionId",
    label: "包装条件",
    mismatchReason: "包装条件不一致",
    nullAllowed: true,
  },
  {
    key: "settlementConditionId",
    label: "结算条件",
    mismatchReason: "结算条件不一致",
    nullAllowed: true,
  },
  {
    key: "logisticsRouteId",
    label: "物流路线",
    mismatchReason: "物流路线不一致",
    nullAllowed: true,
  },
  {
    key: "processingConversionBasisId",
    label: "加工转换口径",
    mismatchReason: "加工转换口径不一致",
    nullAllowed: true,
  },
] as const satisfies readonly GovernedCoordinateRule<
  keyof Extract<
    RequestedMetricCoordinate["domainDimensions"],
    { domain: "market" }
  >
>[];

const SUPPLY_COORDINATES = [
  {
    key: "accountStandardVersionId",
    label: "账户规范版本",
    mismatchReason: "账户规范版本不一致",
    nullAllowed: false,
  },
  {
    key: "consolidationScopeId",
    label: "合并范围",
    mismatchReason: "合并范围不一致",
    nullAllowed: false,
  },
  {
    key: "ruleComparabilityVersionId",
    label: "规则可比版本",
    mismatchReason: "规则可比版本不一致",
    nullAllowed: false,
  },
  {
    key: "marketingYearStageKey",
    label: "营销年度阶段",
    mismatchReason: "营销年度阶段不一致",
    nullAllowed: false,
  },
] as const satisfies readonly GovernedCoordinateRule<
  keyof Extract<
    RequestedMetricCoordinate["domainDimensions"],
    { domain: "supply" }
  >
>[];

const OPERATIONS_COORDINATES = [
  {
    key: "obligationSetVersionId",
    label: "义务集合版本",
    mismatchReason: "义务集合版本不一致",
    nullAllowed: false,
  },
  {
    key: "eligiblePopulationId",
    label: "应纳入总体",
    mismatchReason: "应纳入总体不一致",
    nullAllowed: false,
  },
] as const satisfies readonly GovernedCoordinateRule<
  keyof Extract<
    RequestedMetricCoordinate["domainDimensions"],
    { domain: "operations" }
  >
>[];

const DOMAIN_COORDINATES = {
  production: PRODUCTION_COORDINATES,
  market: MARKET_COORDINATES,
  supply: SUPPLY_COORDINATES,
  operations: OPERATIONS_COORDINATES,
} as const;

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateGovernedCoordinates(
  coordinates: Record<string, unknown>,
  rules: readonly GovernedCoordinateRule<string>[],
): void {
  for (const rule of rules) {
    const value = coordinates[rule.key];
    if (value === null && rule.nullAllowed) continue;
    if (!isNonEmpty(value)) throw new Error(`${rule.label}不能为空`);
  }
}

function governedCoordinateReason(
  from: Record<string, unknown>,
  to: Record<string, unknown>,
  rules: readonly GovernedCoordinateRule<string>[],
): string | null {
  for (const rule of rules) {
    if (from[rule.key] !== to[rule.key]) return rule.mismatchReason;
  }
  return null;
}

function validatePoint(
  point: PublishedMetricPoint,
  definition: MetricDefinition,
  expectedYear: number,
): void {
  if (point.coordinate.period.year !== expectedYear)
    throw new Error(
      `四年序列必须严格对应 ${expectedYear - (expectedYear % 1)} 至 ${expectedYear}`,
    );
  if (
    point.coordinate.metricId !== definition.metricId ||
    point.coordinate.domainDimensions.domain !== definition.domain
  ) {
    throw new Error("指标坐标与定义不一致");
  }
  if (point.unit !== definition.unit) throw new Error("指标单位与定义不一致");
  validateGovernedCoordinates(
    point.coordinate as unknown as Record<string, unknown>,
    BASE_COORDINATES,
  );
  for (const [label, value] of [
    ["单位定义版本", point.coordinate.unitDefinitionVersionId],
    ["期间键", point.coordinate.period.periodKey],
    ["同期间键", point.coordinate.period.samePeriodKey],
    ["截止时点", point.coordinate.period.cutoff],
  ] as const) {
    if (!isNonEmpty(value)) throw new Error(`${label}不能为空`);
  }
  if (!isNonEmpty(point.definitionVersionId))
    throw new Error("指标定义版本不能为空");
  if (
    point.conversionVersionId !== null &&
    !isNonEmpty(point.conversionVersionId)
  ) {
    throw new Error("单位转换版本不能为空");
  }
  const domainDimensions = point.coordinate.domainDimensions;
  validateGovernedCoordinates(
    domainDimensions,
    DOMAIN_COORDINATES[domainDimensions.domain],
  );
  if (definition.domain === "market" && definition.priceStatisticId !== null) {
    const dimensions = point.coordinate.domainDimensions;
    if (
      dimensions.domain !== "market" ||
      dimensions.statisticId !== definition.priceStatisticId
    ) {
      throw new Error("市场统计量与指标定义不一致");
    }
  }
  if (
    point.coverageRate !== null &&
    (compareFixedDecimal(point.coverageRate, fixedDecimal("0")) < 0 ||
      compareFixedDecimal(point.coverageRate, fixedDecimal("100")) > 0)
  ) {
    throw new Error("覆盖率必须在 0 至 100 之间");
  }
  if (point.availability === "available") {
    if (
      point.coordinate.inputReleaseVersionIds.length === 0 ||
      point.coordinate.inputReleaseVersionIds.some((id) => !isNonEmpty(id)) ||
      !isNonEmpty(point.coordinate.metricReleaseVersionId)
    ) {
      throw new Error("可用指标点必须具有完整发布版本");
    }
    if (point.coordinate.releaseLineage.kind === "supply-result") {
      const lineage = point.coordinate.releaseLineage;
      if (
        ![
          lineage.supplyAccountVersionId,
          lineage.ruleVersionId,
          lineage.resultReleaseVersionId,
        ].every(isNonEmpty)
      ) {
        throw new Error("供需指标点必须具有完整结果血缘");
      }
    }
    if (
      definition.measureType === "percentage" &&
      (compareFixedDecimal(point.value, fixedDecimal("0")) < 0 ||
        compareFixedDecimal(point.value, fixedDecimal("100")) > 0)
    ) {
      throw new Error("百分比指标值必须在 0 至 100 之间");
    }
  } else {
    if (!isNonEmpty(point.reason)) throw new Error("不可用指标点原因不能为空");
    if (point.releaseAttempt) {
      if (
        point.releaseAttempt.inputReleaseVersionIds.length === 0 ||
        point.releaseAttempt.inputReleaseVersionIds.some(
          (id) => !isNonEmpty(id),
        ) ||
        (point.releaseAttempt.metricReleaseVersionId !== null &&
          !isNonEmpty(point.releaseAttempt.metricReleaseVersionId))
      ) {
        throw new Error("发布尝试版本不完整");
      }
    }
  }
}

type BridgeResolution =
  { status: "resolved" } | { status: "failed"; reason: string };

function bridgeResolution(
  metricId: string,
  source: string,
  target: string,
  bridges: readonly ApprovedMetricBridge[],
): BridgeResolution {
  const relevant = bridges.filter((bridge) => bridge.metricId === metricId);
  const adjacency = new Map<string, string[]>();
  for (const bridge of relevant)
    adjacency.set(bridge.fromDefinitionVersionId, [
      ...(adjacency.get(bridge.fromDefinitionVersionId) ?? []),
      bridge.toDefinitionVersionId,
    ]);
  let cycle = false;
  const cycleVisit = (
    node: string,
    visiting: Set<string>,
    visited: Set<string>,
  ) => {
    if (visiting.has(node)) {
      cycle = true;
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const next of adjacency.get(node) ?? [])
      cycleVisit(next, visiting, visited);
    visiting.delete(node);
    visited.add(node);
  };
  cycleVisit(source, new Set(), new Set());
  if (cycle) return { status: "failed", reason: "指标定义桥接存在循环" };
  if (source === target) return { status: "resolved" };
  let paths = 0;
  const countPaths = (node: string) => {
    if (paths > 1) return;
    if (node === target) {
      paths += 1;
      return;
    }
    for (const next of adjacency.get(node) ?? []) countPaths(next);
  };
  countPaths(source);
  if (paths === 0)
    return { status: "failed", reason: "指标定义缺少到当前版本的批准桥接" };
  if (paths > 1) return { status: "failed", reason: "指标定义桥接路径不唯一" };
  return { status: "resolved" };
}

function coordinateReason(
  from: PublishedMetricPoint,
  to: PublishedMetricPoint,
  definition: MetricDefinition,
  bridges: readonly ApprovedMetricBridge[],
  unitConversions: readonly ApprovedUnitConversion[],
): string | null {
  for (const point of [from, to]) {
    const resolution = bridgeResolution(
      definition.metricId,
      point.definitionVersionId,
      definition.definitionVersionId,
      bridges,
    );
    if (resolution.status === "failed") return resolution.reason;
  }
  if (from.availability !== "available") return from.reason;
  if (to.availability !== "available") return to.reason;
  const baseReason = governedCoordinateReason(
    from.coordinate as unknown as Record<string, unknown>,
    to.coordinate as unknown as Record<string, unknown>,
    BASE_COORDINATES,
  );
  if (baseReason) return baseReason;
  if (from.coordinate.period.granularity !== to.coordinate.period.granularity)
    return "期间粒度不一致";
  if (
    from.coordinate.period.samePeriodKey !== to.coordinate.period.samePeriodKey
  )
    return "同期间键不一致";
  const fromDomain = from.coordinate.domainDimensions;
  const toDomain = to.coordinate.domainDimensions;
  if (fromDomain.domain !== toDomain.domain) return "指标所属业务类型不一致";
  const domainReason = governedCoordinateReason(
    fromDomain,
    toDomain,
    DOMAIN_COORDINATES[fromDomain.domain],
  );
  if (domainReason) return domainReason;
  if (
    from.coordinate.unitDefinitionVersionId !==
    to.coordinate.unitDefinitionVersionId
  ) {
    // A bridge proves comparability only. Both point values have already passed
    // the canonical published-unit check above; no numeric conversion occurs here.
    const changedPointConversionId = to.conversionVersionId;
    const hasDirectedEvidence = unitConversions.some(
      (conversion) =>
        conversion.metricId === definition.metricId &&
        conversion.fromUnitDefinitionVersionId ===
          from.coordinate.unitDefinitionVersionId &&
        conversion.toUnitDefinitionVersionId ===
          to.coordinate.unitDefinitionVersionId &&
        isNonEmpty(conversion.conversionVersionId) &&
        changedPointConversionId === conversion.conversionVersionId,
    );
    if (!hasDirectedEvidence) return "单位定义版本不一致且缺少批准转换证据";
  }
  return null;
}

function pair(
  from: PublishedMetricPoint,
  to: PublishedMetricPoint,
  kind: ComparisonPair["kind"],
  label: string,
  definition: MetricDefinition,
  bridges: readonly ApprovedMetricBridge[],
  unitConversions: readonly ApprovedUnitConversion[],
): ComparisonPair {
  const reason = coordinateReason(
    from,
    to,
    definition,
    bridges,
    unitConversions,
  );
  const common = {
    fromYear: from.coordinate.period.year,
    toYear: to.coordinate.period.year,
    kind,
    label,
  };
  if (reason)
    return {
      ...common,
      comparable: false,
      calculationAvailable: false,
      absoluteDelta: null,
      relativeRate: null,
      percentagePointDelta: null,
      reason,
      formula: null,
    };
  if (from.availability !== "available" || to.availability !== "available")
    throw new Error("指标点可用状态不一致");
  const absolute = subtractFixedDecimal(to.value, from.value);
  if (definition.comparisonPolicy.relativeChange === "absolute-only") {
    return {
      ...common,
      comparable: true,
      calculationAvailable: true,
      absoluteDelta: absolute,
      relativeRate: null,
      percentagePointDelta: null,
      reason: null,
      formula: `${to.value} - ${from.value}`,
    };
  }
  if (definition.comparisonPolicy.relativeChange === "percentage-points") {
    return {
      ...common,
      comparable: true,
      calculationAvailable: true,
      absoluteDelta: null,
      relativeRate: null,
      percentagePointDelta: absolute,
      reason: null,
      formula: `${to.value} - ${from.value} 个百分点`,
    };
  }
  const baselineSign = compareFixedDecimal(from.value, fixedDecimal("0"));
  if (baselineSign === 0)
    return {
      ...common,
      comparable: true,
      calculationAvailable: false,
      absoluteDelta: absolute,
      relativeRate: null,
      percentagePointDelta: null,
      reason: "基期为零，无法计算增长率",
      formula: null,
    };
  if (baselineSign < 0)
    return {
      ...common,
      comparable: true,
      calculationAvailable: false,
      absoluteDelta: absolute,
      relativeRate: null,
      percentagePointDelta: null,
      reason: "基期为负，增长率不具业务意义",
      formula: null,
    };
  return {
    ...common,
    comparable: true,
    calculationAvailable: true,
    absoluteDelta: absolute,
    relativeRate: percentageChange(
      to.value,
      from.value,
      definition.displayScale,
    ),
    percentagePointDelta: null,
    reason: null,
    formula: `(${to.value} - ${from.value}) / ${from.value} × 100%`,
  };
}

export function buildComparisonSet(input: {
  definition: MetricDefinition;
  currentYear: number;
  points: ComparisonSet["points"];
  approvedBridges: readonly ApprovedMetricBridge[];
  approvedUnitConversions?: readonly ApprovedUnitConversion[];
}): ComparisonSet {
  const definition = validateMetricDefinition(input.definition);
  if (!Number.isSafeInteger(input.currentYear)) throw new Error("当前年份无效");
  if (input.points.length !== 4)
    throw new Error("四年序列必须恰好包含四个年度点");
  for (const bridge of input.approvedBridges) {
    if (
      ![
        bridge.metricId,
        bridge.fromDefinitionVersionId,
        bridge.toDefinitionVersionId,
        bridge.conversionVersionId,
      ].every(isNonEmpty)
    ) {
      throw new Error("指标定义桥接字段不能为空");
    }
  }
  const unitConversions = input.approvedUnitConversions ?? [];
  for (const conversion of unitConversions) {
    if (
      ![
        conversion.metricId,
        conversion.fromUnitDefinitionVersionId,
        conversion.toUnitDefinitionVersionId,
        conversion.conversionVersionId,
      ].every(isNonEmpty)
    ) {
      throw new Error("单位转换证据字段不能为空");
    }
  }
  const points = structuredClone(input.points);
  const firstYear = input.currentYear - 3;
  points.forEach((point, index) => {
    const expected = firstYear + index;
    if (point.coordinate.period.year !== expected)
      throw new Error(
        `四年序列必须严格对应 ${firstYear} 至 ${input.currentYear}`,
      );
    validatePoint(point, definition, expected);
  });
  const adjacent = [0, 1, 2].map((index) =>
    pair(
      points[index],
      points[index + 1],
      "year-over-year",
      index === 2 ? "当前同比" : `${firstYear + index + 1} 年同比`,
      definition,
      input.approvedBridges,
      unitConversions,
    ),
  ) as unknown as ComparisonSet["pairs"];
  const direct = [0, 1, 2].map((index) =>
    pair(
      points[index],
      points[3],
      "current-vs-baseline",
      `较 ${firstYear + index} 年变化`,
      definition,
      input.approvedBridges,
      unitConversions,
    ),
  ) as unknown as ComparisonSet["currentVsBaselines"];
  const unavailablePoints = points.filter(
    (point) => point.availability !== "available",
  );
  let cagr: ComparisonSet["cagr"];
  if (definition.comparisonPolicy.cagr === "not-applicable")
    cagr = { status: "unavailable", reason: "该指标不适用复合增长率" };
  else if (unavailablePoints.length > 0)
    cagr = {
      status: "unavailable",
      reason: `四年序列包含不可用数据：${unavailablePoints.map((point) => point.coordinate.period.year).join("、")}`,
    };
  else if (adjacent.some((item) => !item.comparable))
    cagr = { status: "unavailable", reason: "四年序列存在不可比口径" };
  else if (adjacent.some((item) => !item.calculationAvailable))
    cagr = {
      status: "unavailable",
      reason: "四年序列存在不可计算的年度增长率",
    };
  else {
    const first = points[0] as Extract<
      PublishedMetricPoint,
      { availability: "available" }
    >;
    const last = points[3] as Extract<
      PublishedMetricPoint,
      { availability: "available" }
    >;
    if (
      compareFixedDecimal(first.value, fixedDecimal("0")) <= 0 ||
      compareFixedDecimal(last.value, fixedDecimal("0")) <= 0
    )
      cagr = { status: "unavailable", reason: "复合增长率端点必须为正数" };
    else
      cagr = {
        status: "available",
        rate: cagrPercent(last.value, first.value, 3, definition.displayScale),
        formula: `(${last.value} / ${first.value})^(1/3) - 1`,
      };
  }
  const breakYears = [
    ...new Set([
      ...points
        .filter((point) => point.availability !== "available")
        .map((point) => point.coordinate.period.year),
      ...adjacent.flatMap((item, index) =>
        !item.comparable &&
        points[index].availability === "available" &&
        points[index + 1].availability === "available"
          ? [item.toYear]
          : [],
      ),
    ]),
  ].sort((left, right) => left - right);
  const comparableDeltas = adjacent
    .filter((item) => item.comparable)
    .map((item) => item.absoluteDelta ?? item.percentagePointDelta)
    .filter((value): value is FixedDecimal => value !== null)
    .map((value) => compareFixedDecimal(value, fixedDecimal("0")));
  const direction =
    comparableDeltas.length < 3
      ? "insufficient"
      : comparableDeltas.every((value) => value > 0)
        ? "rising"
        : comparableDeltas.every((value) => value < 0)
          ? "falling"
          : comparableDeltas.every((value) => value === 0)
            ? "flat"
            : "mixed";
  const anomalies: string[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (
      previous.coverageRate !== null &&
      current.coverageRate !== null &&
      compareFixedDecimal(previous.coverageRate, current.coverageRate) !== 0
    ) {
      anomalies.push(
        `${current.coordinate.period.year} 年覆盖率由 ${formatFixedDecimal(previous.coverageRate, 1)}% 变为 ${formatFixedDecimal(current.coverageRate, 1)}%`,
      );
    }
  }
  return {
    metricId: definition.metricId,
    points,
    pairs: adjacent,
    currentVsBaselines: direct,
    cagr,
    trend: {
      direction,
      continuity: breakYears.length === 0 ? "continuous" : "broken",
      breakYears,
      anomalies,
    },
  };
}
