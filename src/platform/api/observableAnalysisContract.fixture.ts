import type { ObservableAnalysisSnapshot } from "./observableAnalysisContract";

export function validSnapshot(): ObservableAnalysisSnapshot {
  return {
    scope: {
      productCode: "CORN",
      regionCode: "230200",
      surveyYear: 2026,
      surveyMonth: 8,
      cultivarCode: null,
      subjectTypeCode: null,
    },
    analysisVersion:
      "sha256:2c1ff60eabc1e2d8d88c3d9275a917753b23da3bbf36f8d11cbe234c4be4f616",
    methodologyVersion: "OBSERVABLE_ANALYSIS_V3",
    dataCutoffAt: "2026-08-16T12:00:00+08:00",
    generatedAt: "2026-08-16T12:01:00+08:00",
    qualityState: "AVAILABLE",
    blockingReasons: [],
    warnings: ["样本覆盖仅代表当前核定范围"],
    coverage: {
      recordCount: 3,
      uniqueSubjectCount: 1,
      coveredRegionCount: 1,
      excludedRecordCount: 1,
      pendingReviewRecordCount: 2,
    },
    production: {
      metrics: [
        {
          code: "EXPECTED_OUTPUT",
          label: "预计总产",
          value: "50.0000",
          unit: "吨",
          aggregation: "SUM",
          sourceCount: 1,
          missingReason: null,
        },
      ],
      sourceBalances: [],
    },
    market: {
      metrics: [
        {
          code: "AVERAGE_TRADE_PRICE",
          label: "平均成交价",
          value: "2500.0000",
          unit: "元/吨",
          aggregation: "AVERAGE",
          sourceCount: 1,
          missingReason: null,
        },
      ],
    },
    logistics: {
      metrics: [
        {
          code: "INFLOW_VOLUME",
          label: "确认流入量",
          value: "5.0000",
          unit: "吨",
          aggregation: "SUM",
          sourceCount: 1,
          missingReason: null,
        },
      ],
    },
    supply: {
      calculation: {
        qualityState: "AVAILABLE",
        openingObservableInventoryTonnes: "10.0000",
        expectedOutputTonnes: "50.0000",
        inflowTonnes: "5.0000",
        selfUseTonnes: "5.0000",
        outflowTonnes: "15.0000",
        endingObservableInventoryTonnes: "25.0000",
        inferredOtherAbsorptionTonnes: "20.0000",
        totalSupplyTonnes: "65.0000",
        totalUseTonnes: "40.0000",
        issues: [],
      },
      inventory: {
        productionOpeningTonnes: "6.0000",
        enterpriseOpeningTonnes: "4.0000",
        productionEndingTonnes: "15.0000",
        enterpriseEndingTonnes: "10.0000",
        openingComplete: true,
        endingComplete: true,
        adoptedRecordCount: 2,
        reviewGroupCount: 0,
        enterpriseOpeningObservedFrom: "2026-07-31",
        enterpriseOpeningObservedThrough: "2026-07-31",
        enterpriseEndingObservedFrom: "2026-08-10",
        enterpriseEndingObservedThrough: "2026-08-31",
      },
    },
    lineage: [
      {
        sourceDomain: "PRODUCTION",
        factCodes: ["EXPECTED_OUTPUT"],
        subjectLabel: "龙江县调查户",
        regionLabel: "龙江县",
        periodLabel: "2026年8月",
        approvedAt: "2026-08-16T12:00:00+08:00",
      },
    ],
  };
}
