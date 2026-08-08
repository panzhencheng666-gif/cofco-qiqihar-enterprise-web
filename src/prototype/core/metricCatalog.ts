import type { BusinessClassification } from "./businessClassification";

export interface MetricDefinition {
  metricId: string;
  label: string;
  domain: "production" | "market" | "supply" | "operations";
  businessSubtype: BusinessClassification["id"];
  measureType:
    | "quantity"
    | "amount"
    | "price"
    | "ratio"
    | "percentage"
    | "signed-difference";
  formula: string;
  unit: string;
  aggregation:
    | "sum"
    | "arithmetic-average"
    | "per-area"
    | "weighted-average"
    | "median"
    | "ratio-of-aggregates"
    | "ending-balance"
    | "rule-derived";
  definitionVersionId: string;
  displayScale: number;
  trendDirection:
    "higher-is-better" | "lower-is-better" | "neutral" | "rule-derived";
  priceStatisticId: string | null;
  comparisonPolicy: {
    relativeChange: "allowed" | "absolute-only" | "percentage-points";
    cagr: "allowed" | "not-applicable";
    comparabilityRuleVersionId: string;
  };
  anomalyRuleVersionId: string;
}

export function validateMetricDefinition(
  definition: MetricDefinition,
): MetricDefinition {
  if (
    !Number.isSafeInteger(definition.displayScale) ||
    definition.displayScale < 0
  ) {
    throw new Error("指标显示精度无效");
  }
  for (const [label, value] of [
    ["指标编号", definition.metricId],
    ["指标名称", definition.label],
    ["指标公式", definition.formula],
    ["指标单位", definition.unit],
    ["业务分类", definition.businessSubtype],
    ["指标定义版本", definition.definitionVersionId],
    ["比较规则版本", definition.comparisonPolicy.comparabilityRuleVersionId],
    ["异常规则版本", definition.anomalyRuleVersionId],
  ] as const) {
    if (!value.trim()) throw new Error(`${label}不能为空`);
  }
  if (
    definition.measureType === "price" &&
    definition.priceStatisticId === null
  ) {
    throw new Error("价格指标必须声明统计量口径");
  }
  if (
    definition.priceStatisticId !== null &&
    !definition.priceStatisticId.trim()
  ) {
    throw new Error("价格统计口径不能为空");
  }
  if (!definition.businessSubtype.startsWith(`${definition.domain}.`)) {
    throw new Error("指标业务域与业务分类不一致");
  }
  if (!definition.metricId.startsWith(`${definition.domain}.`)) {
    throw new Error("指标编号与业务域不一致");
  }
  if (
    definition.comparisonPolicy.cagr === "allowed" &&
    definition.comparisonPolicy.relativeChange !== "allowed"
  ) {
    throw new Error("复合增长率仅适用于允许相对变化的指标");
  }
  return definition;
}
