import { z } from "zod";

import { RealtimeApiError } from "./realtimeApiClient";

const qualityStateSchema = z.enum([
  "AVAILABLE",
  "PARTIAL",
  "COVERAGE_REVIEW_REQUIRED",
  "BLOCKED",
  "NO_APPROVED_DATA",
]);

const formalDecimalSchema = z.string().regex(/^-?(?:0|[1-9]\d*)\.\d{4}$/u);
const nullableFormalDecimalSchema = formalDecimalSchema.nullable();
const timestampSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Invalid timestamp",
});

const scopeSchema = z
  .object({
    productCode: z.string().min(1),
    regionCode: z.string().min(1),
    surveyYear: z.number().int().min(1900).max(2200),
    surveyMonth: z.number().int().min(1).max(12).nullable(),
    cultivarCode: z.string().min(1).nullable(),
    subjectTypeCode: z.string().min(1).nullable(),
  })
  .strict();

const metricSchema = z
  .object({
    code: z.string().min(1),
    label: z.string().min(1),
    value: formalDecimalSchema.nullable(),
    unit: z.string().min(1),
    aggregation: z.string().min(1),
    sourceCount: z.number().int().nonnegative(),
    missingReason: z.string().min(1).nullable(),
  })
  .strict()
  .superRefine((metric, context) => {
    if ((metric.value === null) === (metric.missingReason === null)) {
      context.addIssue({
        code: "custom",
        message: "Exactly one of value or missingReason is required",
      });
    }
  });

const metricListSchema = z
  .array(metricSchema)
  .superRefine((metrics, context) => {
    const codes = metrics.map(({ code }) => code);
    if (new Set(codes).size !== codes.length) {
      context.addIssue({ code: "custom", message: "Metric codes must be unique" });
    }
  });

const sourceBalanceSchema = z
  .object({
    qualityState: qualityStateSchema,
    estimatedOutputTonnes: nullableFormalDecimalSchema,
    productionAvailableTonnes: nullableFormalDecimalSchema,
    knownDestinationTonnes: nullableFormalDecimalSchema,
    theoreticalEndingInventoryTonnes: nullableFormalDecimalSchema,
    reportedEndingInventoryTonnes: nullableFormalDecimalSchema,
    reconciliationDifferenceTonnes: nullableFormalDecimalSchema,
    issues: z.array(z.string().min(1)),
  })
  .strict();

const calculationSchema = z
  .object({
    qualityState: qualityStateSchema,
    openingObservableInventoryTonnes: nullableFormalDecimalSchema,
    expectedOutputTonnes: nullableFormalDecimalSchema,
    inflowTonnes: nullableFormalDecimalSchema,
    selfUseTonnes: nullableFormalDecimalSchema,
    outflowTonnes: nullableFormalDecimalSchema,
    endingObservableInventoryTonnes: nullableFormalDecimalSchema,
    inferredOtherAbsorptionTonnes: nullableFormalDecimalSchema,
    issues: z.array(z.string().min(1)),
  })
  .strict();

const lineageSchema = z
  .object({
    sourceDomain: z.enum(["PRODUCTION", "MARKET", "LOGISTICS"]),
    factCodes: z.array(z.string().min(1)).min(1),
    subjectLabel: z.string().min(1),
    regionLabel: z.string().min(1),
    periodLabel: z.string().min(1),
    approvedAt: timestampSchema,
  })
  .strict();

const observableAnalysisSnapshotSchema = z
  .object({
    scope: scopeSchema,
    analysisVersion: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
    methodologyVersion: z.string().min(1),
    dataCutoffAt: timestampSchema,
    generatedAt: timestampSchema,
    qualityState: qualityStateSchema,
    blockingReasons: z.array(z.string().min(1)),
    warnings: z.array(z.string().min(1)),
    coverage: z
      .object({
        recordCount: z.number().int().nonnegative(),
        uniqueSubjectCount: z.number().int().nonnegative(),
        coveredRegionCount: z.number().int().nonnegative(),
        excludedRecordCount: z.number().int().nonnegative(),
      })
      .strict(),
    production: z
      .object({
        metrics: metricListSchema,
        sourceBalances: z.array(sourceBalanceSchema),
      })
      .strict(),
    market: z.object({ metrics: metricListSchema }).strict(),
    logistics: z.object({ metrics: metricListSchema }).strict(),
    supply: z.object({ calculation: calculationSchema }).strict(),
    lineage: z.array(lineageSchema),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const lineageKeys = snapshot.lineage.map((lineage) =>
      [
        lineage.sourceDomain,
        [...lineage.factCodes].sort().join(","),
        lineage.subjectLabel,
        lineage.regionLabel,
        lineage.periodLabel,
        lineage.approvedAt,
      ].join("|"),
    );
    if (new Set(lineageKeys).size !== lineageKeys.length) {
      context.addIssue({ code: "custom", message: "Lineage entries must be unique" });
    }
  });

export type AnalysisQualityState = z.infer<typeof qualityStateSchema>;
export type ObservableAnalysisSnapshot = z.infer<
  typeof observableAnalysisSnapshotSchema
>;

export interface ObservableAnalysisQuery {
  productCode: string;
  regionCode: string;
  surveyYear: number;
  surveyMonth?: number;
  cultivarCode?: string;
  subjectTypeCode?: string;
}

export function parseObservableAnalysisSnapshot(
  value: unknown,
): ObservableAnalysisSnapshot {
  const result = observableAnalysisSnapshotSchema.safeParse(value);
  if (!result.success) {
    throw new RealtimeApiError({
      code: "CONTRACT_MISMATCH",
      message: "分析数据契约与当前页面版本不一致，请刷新页面或联系管理员",
      status: 200,
      details: result.error.issues,
    });
  }
  return result.data;
}
