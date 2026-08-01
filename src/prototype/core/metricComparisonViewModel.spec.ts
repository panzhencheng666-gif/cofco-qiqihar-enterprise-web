import { describe, expect, it } from "vitest";

import { buildComparisonSet, type ApprovedMetricBridge, type PublishedMetricPoint } from "./comparableSeries";
import { fixedDecimal } from "./fixedDecimal";
import type { MetricDefinition } from "./metricCatalog";
import { createMetricComparisonViewModel } from "./metricComparisonViewModel";

const definition: MetricDefinition = {
  metricId: "production.total-output", label: "总产量", domain: "production", businessSubtype: "production.planting-production", measureType: "quantity", formula: "收获面积 × 区域加权单产", unit: "万吨", aggregation: "sum", definitionVersionId: "definition-v1", displayScale: 1, trendDirection: "higher-is-better", priceStatisticId: null,
  comparisonPolicy: { relativeChange: "allowed", cagr: "allowed", comparabilityRuleVersionId: "comparison-v1" }, anomalyRuleVersionId: "anomaly-v1",
};

function point(year: number, value: string): PublishedMetricPoint {
  return {
    availability: "available",
    coordinate: {
      metricId: definition.metricId, regionId: "authorized-all", regionBoundaryVersionId: "authorized-membership-v1", cropId: "corn", commodityId: null, productFormId: "grain", productAccountId: null, cultivarId: null, qualityConditionId: null, priceConditionId: null, deliveryConditionId: null, populationOrSampleId: "regional", unitDefinitionVersionId: "unit-v1", inventoryNatureId: null, statisticalMomentId: "annual-final", consolidationMatrixVersionId: null,
      domainDimensions: { domain: "production", areaBasisId: "harvested", yieldMethodId: "weighted", growthStageId: null, surveyRoundId: "final", costAllocationRuleId: null },
      period: { year, granularity: "year", periodKey: `${year}`, samePeriodKey: "annual-final", cutoff: `${year}-12-31` }, dataLayer: "official",
      inputReleaseVersionIds: [`facts-${year}`], metricReleaseVersionId: `metric-${year}-v1`, releaseLineage: { kind: "standard-metric" },
    },
    value: fixedDecimal(value), unit: definition.unit, coverageRate: fixedDecimal("98"), qualityStatus: "passed", definitionVersionId: definition.definitionVersionId, conversionVersionId: null,
  };
}

function comparison(
  points: [PublishedMetricPoint, PublishedMetricPoint, PublishedMetricPoint, PublishedMetricPoint],
  approvedBridges: readonly ApprovedMetricBridge[] = [],
) {
  return buildComparisonSet({ definition, currentYear: 2026, points, approvedBridges });
}

describe("MetricComparisonViewModel", () => {
  it("keeps canonical values separate from rounded display strings and release labels", () => {
    const model = createMetricComparisonViewModel(definition, comparison([
      point(2023, "100"), point(2024, "110"), point(2025, "121"), point(2026, "133.1"),
    ]));
    expect(model).toMatchObject({ metricId: definition.metricId, metricLabel: "总产量", unit: "万吨", currentValue: "133.1", currentChangeText: "10.0%", cagrText: "年均复合增长率 10.0%", comparabilityText: "四年口径连续可比" });
    expect(model.yearCells[0]).toEqual({ year: 2023, valueText: "100.0", availabilityLabel: "可用", releaseVersionLabel: "metric-2023-v1", reason: null });
    expect(model.levelSeries[0]).toEqual({ year: 2023, rawValue: fixedDecimal("100"), valueText: "100.0" });
    expect(model.annualChangeSeries[2]).toMatchObject({ label: "当前同比", changeKind: "relative-rate", rawChange: fixedDecimal("10"), changeText: "10.0%", reason: null });
    expect(model.currentVsBaselineSeries.map(({ label, rawChange, changeText }) => ({ label, rawChange, changeText }))).toEqual([
      { label: "较 2023 年变化", rawChange: fixedDecimal("33.1"), changeText: "33.1%" },
      { label: "较 2024 年变化", rawChange: fixedDecimal("21"), changeText: "21.0%" },
      { label: "较 2025 年变化", rawChange: fixedDecimal("10"), changeText: "10.0%" },
    ]);
  });

  it("preserves unavailable state and its governed Chinese reason without breaking unrelated pairs", () => {
    const missing: PublishedMetricPoint = {
      availability: "not-collected",
      coordinate: point(2024, "0").coordinate,
      releaseAttempt: null,
      value: null,
      unit: definition.unit,
      coverageRate: null,
      qualityStatus: "blocking",
      definitionVersionId: definition.definitionVersionId,
      conversionVersionId: null,
      reason: "本年度未组织采集",
    };
    const model = createMetricComparisonViewModel(definition, comparison([
      point(2023, "100"), missing, point(2025, "121"), point(2026, "133.1"),
    ]));
    expect(model.yearCells[1]).toEqual({ year: 2024, valueText: "未采集", availabilityLabel: "未采集", releaseVersionLabel: "未发起发布", reason: "本年度未组织采集" });
    expect(model.pairCells[0]).toMatchObject({ state: "not-comparable", reason: "本年度未组织采集", changeText: "本年度未组织采集" });
    expect(model.pairCells[2]).toMatchObject({ state: "comparable", reason: null, changeText: "10.0%" });
    expect(model.levelSeries[1]).toEqual({ year: 2024, rawValue: null, valueText: "未采集" });
  });

  it("keeps an unavailable year reason while pair governance resolves its definition", () => {
    const unavailable: PublishedMetricPoint = {
      availability: "missing",
      coordinate: point(2024, "0").coordinate,
      releaseAttempt: null,
      value: null,
      unit: definition.unit,
      coverageRate: null,
      qualityStatus: "blocking",
      definitionVersionId: "definition-v0",
      conversionVersionId: null,
      reason: "本年度缺失",
    };
    const points = [point(2023, "100"), unavailable, point(2025, "121"), point(2026, "133.1")] as [PublishedMetricPoint, PublishedMetricPoint, PublishedMetricPoint, PublishedMetricPoint];

    const unbridged = createMetricComparisonViewModel(definition, comparison(points));
    expect(unbridged.yearCells[1].reason).toBe("本年度缺失");
    expect(unbridged.pairCells[0]).toMatchObject({ state: "not-comparable", reason: "指标定义缺少到当前版本的批准桥接" });

    const bridged = createMetricComparisonViewModel(definition, comparison(points, [{
      metricId: definition.metricId,
      fromDefinitionVersionId: "definition-v0",
      toDefinitionVersionId: definition.definitionVersionId,
      conversionVersionId: "definition-conversion-v0-v1",
    }]));
    expect(bridged.yearCells[1].reason).toBe("本年度缺失");
    expect(bridged.pairCells[0]).toMatchObject({ state: "not-comparable", reason: "本年度缺失", changeText: "本年度缺失" });
  });

  it("preserves formula-unavailable reasons while coordinates remain comparable", () => {
    const model = createMetricComparisonViewModel(definition, comparison([
      point(2023, "100"), point(2024, "110"), point(2025, "0"), point(2026, "10"),
    ]));
    expect(model.pairCells[2]).toEqual({ label: "当前同比", changeText: "基期为零，无法计算增长率", state: "comparable", reason: "基期为零，无法计算增长率" });
  });

  it("distinguishes a release attempt without a metric release from no attempt", () => {
    const attempted: PublishedMetricPoint = {
      availability: "pending-review",
      coordinate: point(2024, "0").coordinate,
      releaseAttempt: { inputReleaseVersionIds: ["facts-2024-attempt"], metricReleaseVersionId: null },
      value: null,
      unit: definition.unit,
      coverageRate: fixedDecimal("91"),
      qualityStatus: "warning",
      definitionVersionId: definition.definitionVersionId,
      conversionVersionId: null,
      reason: "等待审核",
    };
    const model = createMetricComparisonViewModel(definition, comparison([point(2023, "100"), attempted, point(2025, "121"), point(2026, "133.1")]));
    expect(model.yearCells[1].releaseVersionLabel).toBe("已发起，未形成指标发布");
  });
});
