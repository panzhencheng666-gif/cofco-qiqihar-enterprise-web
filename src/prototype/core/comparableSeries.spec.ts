import { describe, expect, it } from "vitest";

import { fixedDecimal } from "./fixedDecimal";
import type { MetricDefinition } from "./metricCatalog";
import {
  buildComparisonSet,
  type ApprovedMetricBridge,
  type PublishedMetricPoint,
  type ReleasedMetricCoordinate,
} from "./comparableSeries";

const definition: MetricDefinition = {
  metricId: "production.total-output",
  label: "总产量",
  domain: "production",
  businessSubtype: "production.planting-production",
  measureType: "quantity",
  formula: "收获面积 × 区域加权单产",
  unit: "万吨",
  aggregation: "sum",
  definitionVersionId: "metric-def-v2",
  displayScale: 1,
  trendDirection: "higher-is-better",
  priceStatisticId: null,
  comparisonPolicy: {
    relativeChange: "allowed",
    cagr: "allowed",
    comparabilityRuleVersionId: "comparison-v1",
  },
  anomalyRuleVersionId: "anomaly-v1",
};

function coordinate(year: number): ReleasedMetricCoordinate {
  return {
    metricId: definition.metricId,
    regionId: "authorized-all",
    regionBoundaryVersionId: "aggregate-membership-2026-v1",
    cropId: "corn",
    commodityId: null,
    productFormId: "grain-unprocessed",
    productAccountId: null,
    cultivarId: "all-governed-cultivars",
    qualityConditionId: "standard-grade",
    priceConditionId: null,
    deliveryConditionId: "farm-gate",
    populationOrSampleId: "weighted-regional-estimate",
    unitDefinitionVersionId: "ten-thousand-tonnes-v1",
    inventoryNatureId: null,
    statisticalMomentId: "annual-final",
    consolidationMatrixVersionId: null,
    domainDimensions: {
      domain: "production",
      areaBasisId: "harvested-area",
      yieldMethodId: "weighted-sample",
      growthStageId: null,
      surveyRoundId: "final-yield-survey",
      costAllocationRuleId: null,
    },
    period: {
      year,
      granularity: "year",
      periodKey: `${year}`,
      samePeriodKey: "annual-final",
      cutoff: `${year}-12-31T23:59:59+08:00`,
    },
    dataLayer: "official",
    inputReleaseVersionIds: [`facts-${year}-v1`],
    metricReleaseVersionId: `metric-${year}-v1`,
    releaseLineage: { kind: "standard-metric" },
  };
}

function point(
  year: number,
  value: string,
  overrides: Partial<Extract<PublishedMetricPoint, { availability: "available" }>> = {},
): PublishedMetricPoint {
  return {
    availability: "available",
    coordinate: coordinate(year),
    value: fixedDecimal(value),
    unit: definition.unit,
    coverageRate: fixedDecimal("98.5"),
    qualityStatus: "passed",
    definitionVersionId: definition.definitionVersionId,
    conversionVersionId: null,
    ...overrides,
  };
}

function four(values = ["100", "110", "121", "133.1"]): [
  PublishedMetricPoint,
  PublishedMetricPoint,
  PublishedMetricPoint,
  PublishedMetricPoint,
] {
  return values.map((value, index) => point(2023 + index, value)) as ReturnType<typeof four>;
}

function build(
  points: ReturnType<typeof four> = four(),
  metricDefinition = definition,
  approvedBridges: readonly ApprovedMetricBridge[] = [],
) {
  return buildComparisonSet({ definition: metricDefinition, currentYear: 2026, points, approvedBridges });
}

describe("buildComparisonSet", () => {
  it("builds the exact four-year window, three adjacent pairs, three direct baselines, and CAGR", () => {
    const comparison = build();
    expect(comparison.points.map(({ coordinate }) => coordinate.period.year)).toEqual([
      2023, 2024, 2025, 2026,
    ]);
    expect(comparison.pairs.map((pair) => pair.relativeRate)).toEqual([
      fixedDecimal("10"), fixedDecimal("10"), fixedDecimal("10"),
    ]);
    expect(comparison.pairs.map((pair) => pair.label)).toEqual([
      "2024 年同比", "2025 年同比", "当前同比",
    ]);
    expect(comparison.currentVsBaselines.map((pair) => pair.label)).toEqual([
      "较 2023 年变化", "较 2024 年变化", "较 2025 年变化",
    ]);
    expect(comparison.currentVsBaselines.every((pair) => !pair.label.includes("同比"))).toBe(true);
    expect(comparison.cagr).toEqual({
      status: "available",
      rate: fixedDecimal("10"),
      formula: "(133.1 / 100)^(1/3) - 1",
    });
  });

  it("separates coordinate comparability from a zero or negative relative calculation", () => {
    const zero = build(four(["80", "90", "0", "10"]));
    expect(zero.pairs[2]).toMatchObject({
      comparable: true,
      calculationAvailable: false,
      absoluteDelta: fixedDecimal("10"),
      relativeRate: null,
      reason: "基期为零，无法计算增长率",
    });
    const negative = build(four(["80", "90", "-5", "10"]));
    expect(negative.pairs[2]).toMatchObject({
      comparable: true,
      calculationAvailable: false,
      absoluteDelta: fixedDecimal("15"),
      relativeRate: null,
      reason: "基期为负，增长率不具业务意义",
    });
    expect(negative.cagr).toEqual({ status: "unavailable", reason: "四年序列存在不可计算的年度增长率" });
  });

  it("selects percentage-point, absolute-only, and signed-difference formulas", () => {
    const percentagePoints = four(["91", "92", "93", "94"]);
    for (let index = 0; index < percentagePoints.length; index += 1) {
      percentagePoints[index] = { ...percentagePoints[index], unit: "%" } as PublishedMetricPoint;
    }
    const percentage = build(
      percentagePoints,
      { ...definition, measureType: "percentage", unit: "%", comparisonPolicy: { ...definition.comparisonPolicy, relativeChange: "percentage-points", cagr: "not-applicable" } },
    );
    expect(percentage.pairs[2]).toMatchObject({ absoluteDelta: null, relativeRate: null, percentagePointDelta: fixedDecimal("1") });
    const signed = build(
      four(["-2", "-1", "0", "1"]),
      { ...definition, measureType: "signed-difference", comparisonPolicy: { ...definition.comparisonPolicy, relativeChange: "absolute-only", cagr: "not-applicable" } },
    );
    expect(signed.pairs[2]).toMatchObject({ absoluteDelta: fixedDecimal("1"), relativeRate: null, percentagePointDelta: null });
  });

  it.each(["missing", "not-collected", "not-applicable", "no-release", "rejected", "pending-review"] as const)(
    "preserves %s and invalidates only pairs containing that point",
    (availability) => {
      const points = four();
      points[1] = {
        availability,
        coordinate: coordinate(2024),
        releaseAttempt: null,
        value: null,
        unit: definition.unit,
        coverageRate: null,
        qualityStatus: "blocking",
        definitionVersionId: definition.definitionVersionId,
        conversionVersionId: null,
        reason: `治理原因-${availability}`,
      };
      const comparison = build(points);
      expect(comparison.points[1].availability).toBe(availability);
      expect(comparison.pairs.map((pair) => pair.comparable)).toEqual([false, false, true]);
      expect(comparison.pairs[0].reason).toBe(`治理原因-${availability}`);
      expect(comparison.trend).toMatchObject({ direction: "insufficient", continuity: "broken", breakYears: [2024] });
      expect(comparison.cagr.status).toBe("unavailable");
    },
  );

  it("validates unavailable coverage and requires a governed non-empty reason", () => {
    const unavailable = (availability: Exclude<PublishedMetricPoint["availability"], "available">, coverageRate: string | null, reason: string): PublishedMetricPoint => ({
      availability,
      coordinate: coordinate(2024),
      releaseAttempt: null,
      value: null,
      unit: definition.unit,
      coverageRate: coverageRate === null ? null : fixedDecimal(coverageRate),
      qualityStatus: "blocking",
      definitionVersionId: definition.definitionVersionId,
      conversionVersionId: null,
      reason,
    });
    for (const availability of ["missing", "not-collected", "not-applicable", "no-release", "rejected", "pending-review"] as const) {
      for (const invalidCoverage of ["-0.1", "100.1"]) {
        const points = four();
        points[1] = unavailable(availability, invalidCoverage, "等待治理审核");
        expect(() => build(points), `${availability}:${invalidCoverage}`).toThrow("覆盖率必须在 0 至 100 之间");
      }
    }
    for (const reason of ["", "   ", "\t", "\n"]) {
      const blankReason = four();
      blankReason[1] = unavailable("pending-review", "80", reason);
      expect(() => build(blankReason), JSON.stringify(reason)).toThrow("不可用指标点原因不能为空");
    }
    for (const coverageRate of [null, "0", "100"] as const) {
      const boundary = four();
      boundary[1] = unavailable("pending-review", coverageRate, "等待治理审核");
      expect(build(boundary).pairs[0].reason).toBe("等待治理审核");
    }
  });

  it("rejects malformed, duplicated, non-consecutive, or wrong-final-year tuples", () => {
    expect(() => buildComparisonSet({ definition, currentYear: 2026, points: [] as never, approvedBridges: [] })).toThrow("四年序列必须恰好包含四个年度点");
    const malformed = four();
    malformed[1] = point(2025, "110");
    expect(() => build(malformed)).toThrow("四年序列必须严格对应 2023 至 2026");
    const wrongMetric = four();
    wrongMetric[0] = point(2023, "100", { coordinate: { ...coordinate(2023), metricId: "other" } });
    expect(() => build(wrongMetric)).toThrow("指标坐标与定义不一致");
    const blankCutoff = four();
    blankCutoff[3] = point(2026, "133.1", { coordinate: { ...coordinate(2026), period: { ...coordinate(2026).period, cutoff: "   " } } });
    expect(() => build(blankCutoff)).toThrow("截止时点不能为空");
    const unavailableBlankCutoff = four();
    unavailableBlankCutoff[1] = {
      availability: "pending-review",
      coordinate: { ...coordinate(2024), period: { ...coordinate(2024).period, cutoff: "\t" } },
      releaseAttempt: null,
      value: null,
      unit: definition.unit,
      coverageRate: null,
      qualityStatus: "blocking",
      definitionVersionId: definition.definitionVersionId,
      conversionVersionId: null,
      reason: "等待治理审核",
    };
    expect(() => build(unavailableBlankCutoff)).toThrow("截止时点不能为空");
  });

  const baseMutations: readonly [string, (coordinate: ReleasedMetricCoordinate) => void][] = [
    ["地区不一致", (value) => { value.regionId = "qiqihar-all"; }],
    ["区划边界版本不一致", (value) => { value.regionBoundaryVersionId = "other"; }],
    ["作物不一致", (value) => { value.cropId = "soybean"; }],
    ["商品不一致", (value) => { value.commodityId = "corn"; }],
    ["产品形态不一致", (value) => { value.productFormId = "processed"; }],
    ["产品账户不一致", (value) => { value.productAccountId = "corn-account"; }],
    ["品种不一致", (value) => { value.cultivarId = "cultivar-x"; }],
    ["质量条件不一致", (value) => { value.qualityConditionId = "premium"; }],
    ["价格条件不一致", (value) => { value.priceConditionId = "tax-included"; }],
    ["交付条件不一致", (value) => { value.deliveryConditionId = "warehouse"; }],
    ["总体或样本不一致", (value) => { value.populationOrSampleId = "sample-a"; }],
    ["库存性质不一致", (value) => { value.inventoryNatureId = "commercial"; }],
    ["统计时点不一致", (value) => { value.statisticalMomentId = "midyear"; }],
    ["合并矩阵不一致", (value) => { value.consolidationMatrixVersionId = "matrix-v2"; }],
    ["同期间键不一致", (value) => { value.period.samePeriodKey = "different-day"; }],
    ["期间粒度不一致", (value) => { value.period.granularity = "marketing-year"; }],
    ["数据层不一致", (value) => { value.dataLayer = "preliminary"; }],
  ];

  it.each(baseMutations)("detects governed base coordinate mutation: %s", (reason, mutate) => {
    const points = four();
    const changed = structuredClone(points[3]) as Extract<PublishedMetricPoint, { availability: "available" }>;
    mutate(changed.coordinate);
    points[3] = changed;
    const comparison = build(points);
    expect(comparison.pairs[2]).toMatchObject({ comparable: false, reason });
    expect(comparison.trend).toMatchObject({ direction: "insufficient", continuity: "broken", breakYears: [2026] });
  });

  it.each([
    ["面积口径不一致", "areaBasisId", "planted-area"],
    ["单产方法不一致", "yieldMethodId", "simple-average"],
    ["生育阶段不一致", "growthStageId", "maturity"],
    ["调查轮次不一致", "surveyRoundId", "round-2"],
    ["成本分摊规则不一致", "costAllocationRuleId", "rule-v2"],
  ] as const)("detects production coordinate mutation: %s", (reason, key, changedValue) => {
    const points = four();
    const changed = structuredClone(points[3]) as Extract<PublishedMetricPoint, { availability: "available" }>;
    if (changed.coordinate.domainDimensions.domain !== "production") throw new Error("test setup");
    Object.assign(changed.coordinate.domainDimensions, { [key]: changedValue });
    points[3] = changed;
    expect(build(points).pairs[2]).toMatchObject({ comparable: false, reason });
  });

  it("compares market, supply, and operations domain-specific governed coordinates", () => {
    const domainCases = [
      { domain: "market", dimensions: { statisticId: "median", currency: "CNY", taxTreatmentId: "tax-included", packagingConditionId: "bulk", settlementConditionId: "spot", logisticsRouteId: "route-a", processingConversionBasisId: "basis-a" }, mutations: ["statisticId", "currency", "taxTreatmentId", "packagingConditionId", "settlementConditionId", "logisticsRouteId", "processingConversionBasisId"] },
      { domain: "supply", dimensions: { accountStandardVersionId: "account-standard-v1", consolidationScopeId: "scope-v1", ruleComparabilityVersionId: "rule-comparison-v1", marketingYearStageKey: "final" }, mutations: ["accountStandardVersionId", "consolidationScopeId", "ruleComparabilityVersionId", "marketingYearStageKey"] },
      { domain: "operations", dimensions: { obligationSetVersionId: "obligations-v1", eligiblePopulationId: "eligible-v1" }, mutations: ["obligationSetVersionId", "eligiblePopulationId"] },
    ] as const;
    for (const item of domainCases) {
      const domainDefinition = { ...definition, metricId: `${item.domain}.metric`, domain: item.domain, businessSubtype: ({ market: "market.quote-trade", supply: "supply.results", operations: "operations.data-quality" } as const)[item.domain], priceStatisticId: item.domain === "market" ? "median" : null } as MetricDefinition;
      const makeDomainPoint = (year: number, value: string) => point(year, value, { coordinate: { ...coordinate(year), metricId: domainDefinition.metricId, domainDimensions: { domain: item.domain, ...item.dimensions } } as ReleasedMetricCoordinate, definitionVersionId: domainDefinition.definitionVersionId });
      const domainPoints = [makeDomainPoint(2023, "1"), makeDomainPoint(2024, "2"), makeDomainPoint(2025, "3"), makeDomainPoint(2026, "4")] as ReturnType<typeof four>;
      for (const key of item.mutations) {
        const mutated = structuredClone(domainPoints) as ReturnType<typeof four>;
        Object.assign(mutated[3].coordinate.domainDimensions, { [key]: "changed" });
        if (item.domain === "market" && key === "statisticId") {
          expect(() => build(mutated, domainDefinition)).toThrow("市场统计量与指标定义不一致");
        } else {
          expect(build(mutated, domainDefinition).pairs[2].comparable).toBe(false);
        }
      }
    }
  });

  it("treats release IDs and cutoff timestamps as lineage while flagging coverage changes", () => {
    const points = four();
    const changed = structuredClone(points[3]) as Extract<PublishedMetricPoint, { availability: "available" }>;
    changed.coordinate.inputReleaseVersionIds = ["different-input-release"];
    changed.coordinate.metricReleaseVersionId = "different-metric-release";
    changed.coordinate.period.cutoff = "2027-01-15T00:00:00+08:00";
    changed.coverageRate = fixedDecimal("91");
    points[3] = changed;
    const comparison = build(points);
    expect(comparison.pairs[2].comparable).toBe(true);
    expect(comparison.trend.anomalies).toContain("2026 年覆盖率由 98.5% 变为 91.0%");
  });

  it("requires directed, unique, acyclic definition bridge resolution", () => {
    const older = four();
    older[0] = point(2023, "100", { definitionVersionId: "metric-def-v1" });
    const bridge = { metricId: definition.metricId, fromDefinitionVersionId: "metric-def-v1", toDefinitionVersionId: "metric-def-v2", conversionVersionId: "conversion-v1-v2" };
    expect(build(older, definition, [bridge]).pairs[0].comparable).toBe(true);
    expect(build(older, definition, [{ ...bridge, fromDefinitionVersionId: "metric-def-v2", toDefinitionVersionId: "metric-def-v1" }]).pairs[0].reason).toBe("指标定义缺少到当前版本的批准桥接");
    expect(build(older, definition, [bridge, { ...bridge, toDefinitionVersionId: "metric-def-mid" }, { ...bridge, fromDefinitionVersionId: "metric-def-mid" }]).pairs[0].reason).toBe("指标定义桥接路径不唯一");
    expect(build(older, definition, [bridge, { ...bridge, fromDefinitionVersionId: "metric-def-v2", toDefinitionVersionId: "metric-def-v1" }]).pairs[0].reason).toBe("指标定义桥接存在循环");
    expect(build(four(), definition, [bridge, { ...bridge, fromDefinitionVersionId: "metric-def-v2", toDefinitionVersionId: "metric-def-v1" }]).pairs[0].reason).toBe("指标定义桥接存在循环");
    expect(build(four(), definition, [{ ...bridge, fromDefinitionVersionId: "metric-def-v2", toDefinitionVersionId: "metric-def-v2" }]).pairs[0].reason).toBe("指标定义桥接存在循环");
  });

  it.each(["metricId", "fromDefinitionVersionId", "toDefinitionVersionId", "conversionVersionId"] as const)(
    "rejects blank ApprovedMetricBridge field %s",
    (field) => {
      const older = four();
      older[0] = point(2023, "100", { definitionVersionId: "metric-def-v1" });
      for (const blank of ["", " \t "]) {
        const bridge: ApprovedMetricBridge = {
          metricId: definition.metricId,
          fromDefinitionVersionId: "metric-def-v1",
          toDefinitionVersionId: "metric-def-v2",
          conversionVersionId: "conversion-v1-v2",
          [field]: blank,
        };
        expect(() => build(older, definition, [bridge])).toThrow("指标定义桥接字段不能为空");
      }
    },
  );

  it("rejects malformed bridge evidence even when it is irrelevant or unnecessary", () => {
    const malformed = { metricId: "other.metric", fromDefinitionVersionId: "old", toDefinitionVersionId: "new", conversionVersionId: "" };
    expect(() => build(four(), definition, [malformed])).toThrow("指标定义桥接字段不能为空");
  });

  it("requires explicit unit conversion evidence when unit-definition versions differ", () => {
    const points = four();
    points[3] = point(2026, "133.1", { coordinate: { ...coordinate(2026), unitDefinitionVersionId: "tonnes-v2" } });
    expect(build(points).pairs[2].reason).toBe("单位定义版本不一致且缺少批准转换证据");
    points[3] = point(2026, "133.1", { coordinate: { ...coordinate(2026), unitDefinitionVersionId: "tonnes-v2" }, conversionVersionId: "unit-conversion-v2" });
    const result = buildComparisonSet({ definition, currentYear: 2026, points, approvedBridges: [], approvedUnitConversions: [{ metricId: definition.metricId, fromUnitDefinitionVersionId: "ten-thousand-tonnes-v1", toUnitDefinitionVersionId: "tonnes-v2", conversionVersionId: "unit-conversion-v2" }] });
    expect(result.pairs[2]).toMatchObject({ comparable: true, absoluteDelta: fixedDecimal("12.1") });
    const unrelated = buildComparisonSet({ definition, currentYear: 2026, points, approvedBridges: [], approvedUnitConversions: [{ metricId: definition.metricId, fromUnitDefinitionVersionId: "unrelated-unit", toUnitDefinitionVersionId: "tonnes-v2", conversionVersionId: "unit-conversion-v2" }] });
    expect(unrelated.pairs[2].reason).toBe("单位定义版本不一致且缺少批准转换证据");

    const unchangedEndpointCitation = four();
    unchangedEndpointCitation[2] = point(2025, "121", { conversionVersionId: "unit-conversion-v2" });
    unchangedEndpointCitation[3] = point(2026, "133.1", { coordinate: { ...coordinate(2026), unitDefinitionVersionId: "tonnes-v2" }, conversionVersionId: null });
    const wrongCitation = buildComparisonSet({ definition, currentYear: 2026, points: unchangedEndpointCitation, approvedBridges: [], approvedUnitConversions: [{ metricId: definition.metricId, fromUnitDefinitionVersionId: "ten-thousand-tonnes-v1", toUnitDefinitionVersionId: "tonnes-v2", conversionVersionId: "unit-conversion-v2" }] });
    expect(wrongCitation.pairs[2].reason).toBe("单位定义版本不一致且缺少批准转换证据");

    const emptyCitation = four();
    emptyCitation[3] = point(2026, "133.1", { conversionVersionId: "" });
    expect(() => build(emptyCitation)).toThrow("单位转换版本不能为空");
  });

  it("validates governed percentage values on the 0 to 100 scale", () => {
    const percentageDefinition = { ...definition, measureType: "percentage", unit: "%", comparisonPolicy: { ...definition.comparisonPolicy, relativeChange: "percentage-points", cagr: "not-applicable" } } as MetricDefinition;
    const points = four();
    for (let index = 0; index < points.length; index += 1) points[index] = { ...points[index], unit: "%" } as PublishedMetricPoint;
    points[3] = { ...points[3], value: fixedDecimal("100.1") } as PublishedMetricPoint;
    expect(() => build(points, percentageDefinition)).toThrow("百分比指标值必须在 0 至 100 之间");
  });

  it("requires every published value to already use the definition's canonical unit", () => {
    const points = four();
    points[3] = { ...points[3], unit: "吨" } as PublishedMetricPoint;
    expect(() => build(points, definition, [])).toThrow("指标单位与定义不一致");
  });

  it("does not retain mutable aliases to the caller's point tuple", () => {
    const points = four();
    const result = build(points);
    (points[3].coordinate as ReleasedMetricCoordinate).period.samePeriodKey = "mutated-after-build";
    expect(result.points[3].coordinate.period.samePeriodKey).toBe("annual-final");
    expect(result.pairs[2].comparable).toBe(true);
  });

  it("derives trend from exact deltas even when a zero baseline has no relative rate", () => {
    const comparison = build(four(["0", "1", "2", "3"]));
    expect(comparison.pairs[0]).toMatchObject({ comparable: true, calculationAvailable: false, absoluteDelta: fixedDecimal("1") });
    expect(comparison.trend).toMatchObject({ direction: "rising", continuity: "continuous", breakYears: [] });
    expect(build(four(["0", "0", "0", "0"])).trend.direction).toBe("flat");
    expect(build(four(["-2", "-1", "0", "1"])).trend.direction).toBe("rising");
    expect(build(four(["0", "1", "0", "1"])).trend.direction).toBe("mixed");
  });
});
