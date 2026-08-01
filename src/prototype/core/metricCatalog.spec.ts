import { describe, expect, it } from "vitest";

import type { MetricDefinition } from "./metricCatalog";
import { validateMetricDefinition } from "./metricCatalog";

function definition(overrides: Partial<MetricDefinition> = {}): MetricDefinition {
  return {
    metricId: "production.regional-yield",
    label: "区域加权单产",
    domain: "production",
    businessSubtype: "production.planting-production",
    measureType: "ratio",
    formula: "总产量 / 收获面积",
    unit: "公斤/亩",
    aggregation: "ratio-of-aggregates",
    definitionVersionId: "metric-def-v2",
    displayScale: 1,
    trendDirection: "neutral",
    priceStatisticId: null,
    comparisonPolicy: {
      relativeChange: "allowed",
      cagr: "allowed",
      comparabilityRuleVersionId: "comparison-v1",
    },
    anomalyRuleVersionId: "anomaly-v1",
    ...overrides,
  };
}

describe("MetricDefinition", () => {
  it("keeps regional yield governed as a ratio of aggregates", () => {
    expect(validateMetricDefinition(definition()).aggregation).toBe("ratio-of-aggregates");
  });

  it("requires a governed statistic for price definitions", () => {
    expect(() =>
      validateMetricDefinition(
        definition({ metricId: "market.purchase-price", measureType: "price" }),
      ),
    ).toThrow("价格指标必须声明统计量口径");
    expect(
      validateMetricDefinition(
        definition({
          metricId: "market.purchase-price",
          domain: "market",
          businessSubtype: "market.quote-trade",
          measureType: "price",
          priceStatisticId: "weighted-average-purchase-price",
        }),
      ).priceStatisticId,
    ).toBe("weighted-average-purchase-price");
    expect(validateMetricDefinition(definition({
      metricId: "market.trade-volume",
      domain: "market",
      businessSubtype: "market.quote-trade",
      measureType: "quantity",
      priceStatisticId: null,
    })).priceStatisticId).toBeNull();
  });

  it("validates definition display scales as non-negative safe integers", () => {
    expect(() => validateMetricDefinition(definition({ displayScale: 1.5 }))).toThrow(
      "指标显示精度无效",
    );
  });

  it("requires the governed classification domain and CAGR policy to agree", () => {
    expect(() => validateMetricDefinition(definition({ domain: "market" }))).toThrow(
      "指标业务域与业务分类不一致",
    );
    expect(() => validateMetricDefinition(definition({
      comparisonPolicy: { ...definition().comparisonPolicy, relativeChange: "absolute-only", cagr: "allowed" },
    }))).toThrow("复合增长率仅适用于允许相对变化的指标");
  });

  it.each([
    ["label", "指标名称不能为空"],
    ["formula", "指标公式不能为空"],
    ["unit", "指标单位不能为空"],
    ["businessSubtype", "业务分类不能为空"],
    ["definitionVersionId", "指标定义版本不能为空"],
    ["anomalyRuleVersionId", "异常规则版本不能为空"],
  ] as const)("rejects whitespace-only governed definition field %s", (field, reason) => {
    expect(() => validateMetricDefinition(definition({ [field]: "   " }))).toThrow(reason);
  });

  it("rejects blank price statistics, comparison IDs, and metric/domain disagreement", () => {
    expect(() => validateMetricDefinition(definition({
      metricId: "market.purchase-price",
      domain: "market",
      businessSubtype: "market.quote-trade",
      measureType: "price",
      priceStatisticId: "   ",
    }))).toThrow("价格统计口径不能为空");
    expect(() => validateMetricDefinition(definition({
      comparisonPolicy: { ...definition().comparisonPolicy, comparabilityRuleVersionId: "   " },
    }))).toThrow("比较规则版本不能为空");
    expect(() => validateMetricDefinition(definition({ priceStatisticId: "\t" }))).toThrow("价格统计口径不能为空");
    expect(() => validateMetricDefinition(definition({ metricId: "market.trade-volume" }))).toThrow("指标编号与业务域不一致");
  });
});
