import { describe, expect, it } from "vitest";

import type { OperationalScope } from "../core/operationalScope";
import {
  aggregateRegionMembershipSnapshots,
  enterpriseMetricDefinitions,
  enterpriseMetricPoints,
  findApprovedMetricSeries,
  prototypeCurrentMetricReleaseVersionId,
  queryPrototypeMetricComparisons,
} from "./enterpriseMetricFixtures";

const requiredMetricIds = [
  "production.planted-area",
  "production.harvested-area",
  "production.unharvested-area",
  "production.total-output",
  "production.cost-per-area",
  "production.farmer-stock",
  "production.sales-volume",
  "production.sales-price",
  "production.intended-area",
  "market.purchase-price",
  "market.trade-volume",
  "market.inventory",
  "market.sales-volume",
  "market.processing-input",
  "market.processing-output",
  "market.byproduct-output",
  "market.processing-loss",
  "market.operating-rate",
  "market.direct-use",
  "market.inflow",
  "market.outflow",
  "market.freight-rate",
  "market.agri-input-price",
  "market.agri-input-sales",
  "supply.total-supply",
  "supply.total-use",
  "supply.adopted-ending",
  "supply.survey-ending",
  "supply.inventory-difference",
  "operations.coverage-rate",
  "operations.on-time-rate",
  "operations.quality-block-rate",
] as const;

function scope(
  overrides: Partial<OperationalScope["coordinates"]> = {},
): OperationalScope {
  return {
    workUnit: { organizationId: "org", unitId: "unit", label: "单位" },
    identity: { userId: "user", postId: "post" },
    authorization: {
      authorizedRegionIds: ["qiqihar-all", "qiqihar-nehe"],
      authorizedBusinessClassificationIds: [
        "production.planting-production",
        "market.quote-trade",
        "supply.results",
        "operations.data-quality",
      ],
      authorizedProductIds: ["corn"],
      authorizedCultivarIds: ["jingke-968"],
      authorizedReleaseVersionIds: ["METRIC-2026-W31-V3"],
      permissionKeys: ["prototype:read"],
    },
    coordinates: {
      regionId: "authorized-all",
      productId: "corn",
      dataLayer: "official",
      ...overrides,
    },
    savedView: null,
  };
}

describe("enterprise metric fixtures", () => {
  it("contains the approved catalog and keeps retired yield metrics absent", () => {
    const ids = enterpriseMetricDefinitions.map(({ metricId }) => metricId);
    expect(ids).toEqual(expect.arrayContaining([...requiredMetricIds]));
    expect(ids).not.toContain("production.regional-yield");
    expect(ids).not.toContain("production.sample-average-yield");
    expect(
      enterpriseMetricDefinitions
        .filter(({ measureType }) => measureType === "price")
        .every(({ priceStatisticId }) => Boolean(priceStatisticId)),
    ).toBe(true);
    for (const definition of enterpriseMetricDefinitions.filter(
      ({ domain }) => domain === "market",
    )) {
      const points = enterpriseMetricPoints.filter(
        ({ coordinate }) => coordinate.metricId === definition.metricId,
      );
      expect(
        points.every(
          ({ coordinate }) =>
            coordinate.domainDimensions.domain === "market" &&
            coordinate.domainDimensions.statisticId ===
              definition.priceStatisticId,
        ),
        definition.metricId,
      ).toBe(true);
    }
  });

  it("uses governed Chinese labels, semantic units, formulas, and product coordinates", () => {
    expect(
      enterpriseMetricDefinitions.every(
        ({ label, formula }) =>
          /[\u3400-\u9fff]/u.test(label) &&
          !/治理|同坐标|规则版本|治理坐标/.test(formula),
      ),
    ).toBe(true);
    expect(
      enterpriseMetricDefinitions.find(
        ({ metricId }) => metricId === "production.cost-per-area",
      )?.formula,
    ).toBe("亩均成本按成本合计 / 对应面积计算");
    expect(
      enterpriseMetricDefinitions.find(
        ({ metricId }) => metricId === "market.freight-rate",
      )?.formula,
    ).toBe("运价按当前统计范围有效样本取中位数");
    expect(
      enterpriseMetricDefinitions.find(
        ({ metricId }) => metricId === "supply.total-supply",
      )?.formula,
    ).not.toMatch(/版本|治理|坐标/);
    const unit = (metricId: string) =>
      enterpriseMetricDefinitions.find(
        (definition) => definition.metricId === metricId,
      )?.unit;
    expect(unit("production.quality-test-weight")).toBe("克/升");
    expect(unit("production.quality-toxin")).toBe("微克/千克");
    expect(unit("market.processing-capacity")).toBe("万吨/年");
    const agriPoints = enterpriseMetricPoints.filter(({ coordinate }) =>
      coordinate.metricId.startsWith("market.agri-input"),
    );
    expect(
      agriPoints.every(
        ({ coordinate }) =>
          coordinate.cropId === null &&
          coordinate.commodityId === "agri-input" &&
          coordinate.productFormId === "agricultural-input",
      ),
    ).toBe(true);
  });

  it("governs per-area cost and quality metric semantics explicitly", () => {
    const byId = new Map(
      enterpriseMetricDefinitions.map((item) => [item.metricId, item]),
    );
    expect(byId.get("production.cost-per-area")).toMatchObject({
      measureType: "amount",
      unit: "元/亩",
      aggregation: "per-area",
    });
    expect(byId.get("production.cost-per-area")?.formula).toContain("/");
    expect(byId.has("production.sample-average-yield")).toBe(false);
    expect(byId.has("production.regional-yield")).toBe(false);

    for (const metricId of [
      "production.quality-moisture",
      "production.quality-impurity",
      "production.quality-imperfect-grain",
      "production.quality-mildew",
      "market.quality-moisture",
      "market.quality-impurity",
    ]) {
      expect(byId.get(metricId), metricId).toMatchObject({
        measureType: "percentage",
        unit: "%",
        comparisonPolicy: {
          relativeChange: "percentage-points",
          cagr: "not-applicable",
        },
      });
      const points = enterpriseMetricPoints.filter(
        ({ coordinate }) => coordinate.metricId === metricId,
      );
      expect(
        points.every(
          (point) =>
            point.availability !== "available" ||
            (Number(point.value) >= 0 && Number(point.value) <= 100),
        ),
        metricId,
      ).toBe(true);
    }
    expect(
      enterpriseMetricDefinitions
        .filter(
          ({ metricId, measureType }) =>
            (metricId.startsWith("production.quality-") ||
              metricId.startsWith("market.quality-")) &&
            measureType === "percentage",
        )
        .map(({ metricId }) => metricId)
        .sort(),
    ).toEqual([
      "market.quality-impurity",
      "market.quality-moisture",
      "production.quality-imperfect-grain",
      "production.quality-impurity",
      "production.quality-mildew",
      "production.quality-moisture",
    ]);
    expect(byId.get("production.quality-test-weight")).toMatchObject({
      unit: "克/升",
      measureType: "ratio",
      comparisonPolicy: { relativeChange: "allowed", cagr: "allowed" },
    });
    expect(byId.get("production.quality-toxin")).toMatchObject({
      unit: "微克/千克",
      measureType: "ratio",
      comparisonPolicy: { relativeChange: "allowed", cagr: "allowed" },
    });
    expect(
      [...byId.values()]
        .filter(
          ({ businessSubtype }) =>
            businessSubtype === "production.cost-support",
        )
        .every(({ unit }) => unit === "元/亩"),
    ).toBe(true);
  });

  it("publishes only source-backed four-year series and never promotes generic placeholder trends", () => {
    const publishedMetricIds = [
      ...new Set(
        enterpriseMetricPoints.map(({ coordinate }) => coordinate.metricId),
      ),
    ].sort();

    expect(publishedMetricIds).toEqual([
      "market.purchase-price",
      "market.trade-volume",
      "market.transaction-price",
      "operations.quality-block-rate",
      "production.estimated-total-output",
      "production.expected-yield",
      "production.planted-area",
    ]);
    for (const metricId of publishedMetricIds) {
      expect(
        enterpriseMetricPoints
          .filter(({ coordinate }) => coordinate.metricId === metricId)
          .map(({ coordinate }) => coordinate.period.year),
        metricId,
      ).toEqual([2023, 2024, 2025, 2026]);
    }
    expect(
      enterpriseMetricPoints.some(
        ({ coordinate }) => coordinate.domainDimensions.domain === "supply",
      ),
    ).toBe(false);
    expect(
      enterpriseMetricPoints
        .filter(
          ({ coordinate }) => coordinate.metricId === "market.purchase-price",
        )
        .map(({ value }) => value),
    ).toEqual(["2198", "2245", "2301", "2346"]);
    expect(
      enterpriseMetricPoints.some(
        ({ coordinate }) => coordinate.metricId === "production.total-output",
      ),
    ).toBe(false);
    expect(
      enterpriseMetricPoints
        .filter(
          ({ coordinate }) =>
            coordinate.metricId === "production.estimated-total-output",
        )
        .map(({ value }) => value),
    ).toEqual(["535.4", "557", "577.7", "601.4"]);
    for (const point of enterpriseMetricPoints) {
      expect(point.coordinate.period).toMatchObject({
        granularity: "week",
        periodKey: `${String(point.coordinate.period.year)}-W31`,
        samePeriodKey: "W31",
        cutoff: `${String(point.coordinate.period.year)}-07-31T17:00:00+08:00`,
      });
    }
  });

  it("selects a reportable metric series only from the exact approved business coordinates", () => {
    const approvedSeriesQuery = {
      metricId: "production.planted-area",
      regionId: "qiqihar-all",
      productId: "corn",
      cultivarId: null,
      samePeriodKey: "W31",
      dataLayer: "official" as const,
      qualityStatus: "passed" as const,
      currentYear: 2026,
      metricReleaseVersionId: "METRIC-2026-W31-V3",
    };

    const series = findApprovedMetricSeries(approvedSeriesQuery);

    expect(
      series?.map(({ coordinate }) => coordinate.period.periodKey),
    ).toEqual(["2023-W31", "2024-W31", "2025-W31", "2026-W31"]);
    expect(series?.at(-1)).toMatchObject({
      availability: "available",
      qualityStatus: "passed",
      coordinate: {
        regionId: "qiqihar-all",
        cropId: "corn",
        cultivarId: null,
        dataLayer: "official",
        metricReleaseVersionId: "METRIC-2026-W31-V3",
      },
    });
    for (const changedCoordinate of [
      { metricId: "production.metric-without-release" },
      { regionId: "qiqihar-nehe" },
      { productId: "soybean" },
      { cultivarId: "jingke-968" },
      { samePeriodKey: "W30" },
      { dataLayer: "preliminary" as const },
      { qualityStatus: "warning" as const },
      { currentYear: 2027 },
      { metricReleaseVersionId: "METRIC-2026-W31-OTHER" },
    ]) {
      expect(
        findApprovedMetricSeries({
          ...approvedSeriesQuery,
          ...changedCoordinate,
        }),
      ).toBeNull();
    }
  });

  it("keeps literal zero available", () => {
    expect(
      enterpriseMetricPoints.find(
        ({ coordinate }) =>
          coordinate.metricId === "operations.quality-block-rate" &&
          coordinate.period.year === 2026,
      ),
    ).toMatchObject({ availability: "available", value: "0" });
  });

  it("stores canonical legacy raw values without parsing presentation strings or collapsing yield semantics", () => {
    const current = (metricId: string) =>
      enterpriseMetricPoints.find(
        ({ coordinate }) =>
          coordinate.metricId === metricId && coordinate.period.year === 2026,
      );
    expect(current("production.planted-area")).toMatchObject({
      value: "1284.6",
      unit: "万亩",
    });
    expect(current("production.expected-yield")).toMatchObject({
      value: "468.2",
      unit: "公斤/亩",
    });
    expect(current("production.sample-average-yield")).toBeUndefined();
    expect(current("production.regional-yield")).toBeUndefined();
    expect(current("production.estimated-total-output")).toMatchObject({
      value: "601.4",
      unit: "万吨",
    });
    expect(current("market.purchase-price")).toMatchObject({
      value: "2346",
      unit: "元/吨",
    });
    expect(current("market.transaction-price")).toMatchObject({
      value: "2382",
      unit: "元/吨",
    });
    expect(current("market.trade-volume")).toMatchObject({
      value: "98.5",
      unit: "万吨",
    });
    expect(
      enterpriseMetricDefinitions.find(
        ({ metricId }) => metricId === "production.total-output",
      )?.formula,
    ).toBe("规范收获面积 × 核定单产");
  });

  it("gives authorized-all its own aggregate membership snapshot", () => {
    expect(aggregateRegionMembershipSnapshots).toContainEqual({
      regionId: "authorized-all",
      regionBoundaryVersionId: "authorized-membership-2026-v1",
      memberRegionIds: ["qiqihar-all", "qiqihar-nehe"],
    });
  });

  it("normalizes an unambiguous short subtype only against full authorization", () => {
    const results = queryPrototypeMetricComparisons({
      scope: scope({
        regionId: "qiqihar-all",
        businessSubtypeId: "planting-production",
      }),
      queryAllowed: true,
      domain: "production",
      currentYear: 2026,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(
      results
        .filter((result) => result.status === "ready")
        .map(({ definition }) => definition.metricId),
    ).toEqual([
      "production.planted-area",
      "production.expected-yield",
      "production.estimated-total-output",
    ]);
  });

  it("denies query arguments that conflict with the operational scope domain or subtype", () => {
    expect(
      queryPrototypeMetricComparisons({
        scope: scope({ businessDomainId: "market" }),
        queryAllowed: true,
        domain: "production",
        currentYear: 2026,
      }),
    ).toEqual([]);
    const conflicting = scope({
      businessSubtypeId: "production.planting-production",
    });
    conflicting.authorization = {
      ...conflicting.authorization,
      authorizedBusinessClassificationIds: [
        ...conflicting.authorization.authorizedBusinessClassificationIds,
        "production.cost-support",
      ],
    };
    expect(
      queryPrototypeMetricComparisons({
        scope: conflicting,
        queryAllowed: true,
        domain: "production",
        businessSubtype: "production.cost-support",
        currentYear: 2026,
      }),
    ).toEqual([]);
  });

  it("denies invalid scope, unknown subtype, and unknown region without fallback", () => {
    expect(
      queryPrototypeMetricComparisons({
        scope: scope(),
        queryAllowed: false,
        domain: "production",
        currentYear: 2026,
      }),
    ).toEqual([]);
    expect(
      queryPrototypeMetricComparisons({
        scope: scope(),
        queryAllowed: undefined as never,
        domain: "production",
        currentYear: 2026,
      }),
    ).toEqual([]);
    expect(
      queryPrototypeMetricComparisons({
        scope: scope({ businessSubtypeId: "unknown" }),
        queryAllowed: true,
        domain: "production",
        currentYear: 2026,
      }),
    ).toEqual([]);
    const unknownRegion = scope({ regionId: "unknown-region" });
    const unknownResults = queryPrototypeMetricComparisons({
      scope: unknownRegion,
      queryAllowed: true,
      domain: "production",
      currentYear: 2026,
    });
    expect(unknownResults.length).toBeGreaterThan(0);
    expect(
      unknownResults.every((result) => result.status === "no-release"),
    ).toBe(true);
  });

  it("requires governed product, cultivar, and current release authorization even when selectors are absent", () => {
    const productNotSelected = scope({
      productId: undefined,
      cultivarId: undefined,
    });
    expect(
      queryPrototypeMetricComparisons({
        scope: productNotSelected,
        queryAllowed: true,
        domain: "production",
        currentYear: 2026,
      }),
    ).toEqual([]);

    const noSelectors = scope({ productId: undefined, cultivarId: undefined });
    noSelectors.authorization = {
      ...noSelectors.authorization,
      authorizedProductIds: [],
      authorizedCultivarIds: [],
    };
    expect(
      queryPrototypeMetricComparisons({
        scope: noSelectors,
        queryAllowed: true,
        domain: "production",
        currentYear: 2026,
      }),
    ).toEqual([]);

    const noReadPermission = scope();
    noReadPermission.authorization = {
      ...noReadPermission.authorization,
      permissionKeys: [],
    };
    expect(
      queryPrototypeMetricComparisons({
        scope: noReadPermission,
        queryAllowed: true,
        domain: "production",
        currentYear: 2026,
      }),
    ).toEqual([]);

    const unauthorizedRelease = scope({
      releaseVersion: "unauthorized-current-release",
    });
    expect(
      queryPrototypeMetricComparisons({
        scope: unauthorizedRelease,
        queryAllowed: true,
        domain: "production",
        currentYear: 2026,
      }),
    ).toEqual([]);
  });

  it("serves the exact concrete source scope and never falls back from an aggregate, another product, or a cultivar", () => {
    const concrete = queryPrototypeMetricComparisons({
      scope: scope({ regionId: "qiqihar-all" }),
      queryAllowed: true,
      domain: "production",
      currentYear: 2026,
    });
    expect(concrete.length).toBeGreaterThan(0);
    expect(
      concrete
        .filter((result) => result.status === "ready")
        .map(({ definition }) => definition.metricId),
    ).toEqual([
      "production.planted-area",
      "production.expected-yield",
      "production.estimated-total-output",
    ]);

    const partialScope = scope();
    partialScope.authorization = {
      ...partialScope.authorization,
      authorizedRegionIds: ["qiqihar-all"],
    };
    const partial = queryPrototypeMetricComparisons({
      scope: partialScope,
      queryAllowed: true,
      domain: "production",
      currentYear: 2026,
    });
    expect(partial.every((result) => result.status === "no-release")).toBe(
      true,
    );

    const soybeanScope = scope({ productId: "soybean" });
    soybeanScope.authorization = {
      ...soybeanScope.authorization,
      authorizedProductIds: ["corn", "soybean"],
    };
    const soybean = queryPrototypeMetricComparisons({
      scope: soybeanScope,
      queryAllowed: true,
      domain: "production",
      currentYear: 2026,
    });
    expect(soybean.every((result) => result.status === "no-release")).toBe(
      true,
    );

    const cultivar = queryPrototypeMetricComparisons({
      scope: scope({ cultivarId: "jingke-968" }),
      queryAllowed: true,
      domain: "production",
      currentYear: 2026,
    });
    expect(cultivar.length).toBeGreaterThan(0);
    expect(cultivar.every((result) => result.status === "no-release")).toBe(
      true,
    );
  });

  it("refuses to compare a different week against the released week-31 series", () => {
    const results = queryPrototypeMetricComparisons({
      scope: scope({
        regionId: "qiqihar-all",
        productId: "corn",
        periodKey: "2026-W32",
      }),
      queryAllowed: true,
      domain: "production",
      currentYear: 2026,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every(({ status }) => status === "no-release")).toBe(true);
  });

  it("returns supply no-release from absence of immutable points, not a domain hardcode", () => {
    const results = queryPrototypeMetricComparisons({
      scope: scope({ businessSubtypeId: "supply.results" }),
      queryAllowed: true,
      domain: "supply",
      currentYear: 2026,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every(
        (result) =>
          result.status === "no-release" &&
          result.reason === "当前筛选范围没有连续四个年度的已发布数据",
      ),
    ).toBe(true);
  });

  it("binds the selected authorized release to current Y while retaining historical lineage", () => {
    expect(prototypeCurrentMetricReleaseVersionId).toBe("METRIC-2026-W31-V3");
    const [result] = queryPrototypeMetricComparisons({
      scope: scope({
        regionId: "qiqihar-all",
        releaseVersion: "METRIC-2026-W31-V3",
      }),
      queryAllowed: true,
      domain: "production",
      businessSubtype: "production.planting-production",
      currentYear: 2026,
    });
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(
        result.comparison.points.map(
          ({ coordinate }) => coordinate.period.year,
        ),
      ).toEqual([2023, 2024, 2025, 2026]);
      expect(
        result.comparison.points.map((point) =>
          point.availability === "available"
            ? point.coordinate.metricReleaseVersionId
            : null,
        ),
      ).toEqual([
        "metric-2023-v1",
        "metric-2024-v1",
        "metric-2025-v1",
        "METRIC-2026-W31-V3",
      ]);
    }

    const mismatch = scope({
      regionId: "qiqihar-all",
      releaseVersion: "METRIC-2026-W31-V2",
    });
    mismatch.authorization = {
      ...mismatch.authorization,
      authorizedReleaseVersionIds: ["METRIC-2026-W31-V2", "METRIC-2026-W31-V3"],
    };
    const mismatchResults = queryPrototypeMetricComparisons({
      scope: mismatch,
      queryAllowed: true,
      domain: "production",
      businessSubtype: "production.planting-production",
      currentYear: 2026,
    });
    expect(mismatchResults.length).toBeGreaterThan(0);
    expect(mismatchResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "no-release",
          reason: "当前数据发布批次未获授权或与所选批次不一致",
        }),
      ]),
    );

    const noSelector = scope({ regionId: "qiqihar-all" });
    noSelector.authorization = {
      ...noSelector.authorization,
      authorizedReleaseVersionIds: [],
    };
    const unauthorizedCurrent = queryPrototypeMetricComparisons({
      scope: noSelector,
      queryAllowed: true,
      domain: "production",
      businessSubtype: "production.planting-production",
      currentYear: 2026,
    });
    expect(unauthorizedCurrent.length).toBeGreaterThan(0);
    expect(
      unauthorizedCurrent.every((item) => item.status === "no-release"),
    ).toBe(true);

    const authorizedCurrent = queryPrototypeMetricComparisons({
      scope: scope({ regionId: "qiqihar-all" }),
      queryAllowed: true,
      domain: "production",
      businessSubtype: "production.planting-production",
      currentYear: 2026,
    });
    expect(
      authorizedCurrent.filter((item) => item.status === "ready"),
    ).toHaveLength(3);

    const historicalOnly = scope({ regionId: "qiqihar-all" });
    historicalOnly.authorization = {
      ...historicalOnly.authorization,
      authorizedReleaseVersionIds: ["metric-2025-v1"],
    };
    const historicalOnlyResults = queryPrototypeMetricComparisons({
      scope: historicalOnly,
      queryAllowed: true,
      domain: "production",
      businessSubtype: "production.planting-production",
      currentYear: 2026,
    });
    expect(historicalOnlyResults.length).toBeGreaterThan(0);
    expect(
      historicalOnlyResults.every((item) => item.status === "no-release"),
    ).toBe(true);
  });

  it("never returns agricultural-input series for a corn query", () => {
    const cornScope = scope({
      businessSubtypeId: "market.agricultural-input",
      productId: "corn",
      cultivarId: undefined,
    });
    cornScope.authorization = {
      ...cornScope.authorization,
      authorizedBusinessClassificationIds: [
        ...cornScope.authorization.authorizedBusinessClassificationIds,
        "market.agricultural-input",
      ],
    };
    const cornResults = queryPrototypeMetricComparisons({
      scope: cornScope,
      queryAllowed: true,
      domain: "market",
      currentYear: 2026,
    });
    expect(cornResults.length).toBeGreaterThan(0);
    expect(cornResults.every((result) => result.status === "no-release")).toBe(
      true,
    );

    const agriScope = scope({
      businessSubtypeId: "market.agricultural-input",
      productId: "agri-input",
      cultivarId: undefined,
    });
    agriScope.authorization = {
      ...agriScope.authorization,
      authorizedBusinessClassificationIds: [
        ...agriScope.authorization.authorizedBusinessClassificationIds,
        "market.agricultural-input",
      ],
      authorizedProductIds: ["corn", "agri-input"],
    };
    const agriResults = queryPrototypeMetricComparisons({
      scope: agriScope,
      queryAllowed: true,
      domain: "market",
      currentYear: 2026,
    });
    expect(agriResults.every((result) => result.status === "no-release")).toBe(
      true,
    );
  });
});
