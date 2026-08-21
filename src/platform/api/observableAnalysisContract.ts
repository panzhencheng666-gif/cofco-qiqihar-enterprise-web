import { z } from "zod";

import { RealtimeApiError } from "./realtimeApiClient";

export const ALL_AUTHORIZED_REGION_CODE = "__ALL_AUTHORIZED__";

const qualityStateSchema = z.enum([
  "AVAILABLE",
  "PARTIAL",
  "COVERAGE_REVIEW_REQUIRED",
  "BLOCKED",
  "NO_APPROVED_DATA",
]);

const formalDecimalSchema = z.string().regex(/^-?(?:0|[1-9]\d*)\.\d{4}$/u);
const nullableFormalDecimalSchema = formalDecimalSchema.nullable();
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u)
  .refine(
    (value) =>
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value,
    { message: "Invalid date" },
  );
const nullableDateSchema = dateSchema.nullable();
const timestampSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
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
      context.addIssue({
        code: "custom",
        message: "Metric codes must be unique",
      });
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
    totalSupplyTonnes: nullableFormalDecimalSchema,
    totalUseTonnes: nullableFormalDecimalSchema,
    issues: z.array(z.string().min(1)),
  })
  .strict();

const inventorySchema = z
  .object({
    productionOpeningTonnes: nullableFormalDecimalSchema,
    enterpriseOpeningTonnes: nullableFormalDecimalSchema,
    productionEndingTonnes: nullableFormalDecimalSchema,
    enterpriseEndingTonnes: nullableFormalDecimalSchema,
    openingComplete: z.boolean(),
    endingComplete: z.boolean(),
    adoptedRecordCount: z.number().int().nonnegative(),
    reviewGroupCount: z.number().int().nonnegative(),
    enterpriseOpeningObservedFrom: nullableDateSchema,
    enterpriseOpeningObservedThrough: nullableDateSchema,
    enterpriseEndingObservedFrom: nullableDateSchema,
    enterpriseEndingObservedThrough: nullableDateSchema,
  })
  .strict()
  .superRefine((inventory, context) => {
    if (
      inventory.openingComplete &&
      (inventory.productionOpeningTonnes === null ||
        inventory.enterpriseOpeningTonnes === null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Complete opening inventory requires both business layers",
      });
    }
    if (
      inventory.endingComplete &&
      (inventory.productionEndingTonnes === null ||
        inventory.enterpriseEndingTonnes === null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Complete ending inventory requires both business layers",
      });
    }
    requireEnterpriseInventoryObservationRange(
      inventory.enterpriseOpeningTonnes,
      inventory.enterpriseOpeningObservedFrom,
      inventory.enterpriseOpeningObservedThrough,
      "opening",
      context,
    );
    requireEnterpriseInventoryObservationRange(
      inventory.enterpriseEndingTonnes,
      inventory.enterpriseEndingObservedFrom,
      inventory.enterpriseEndingObservedThrough,
      "ending",
      context,
    );
  });

function requireEnterpriseInventoryObservationRange(
  value: string | null,
  observedFrom: string | null,
  observedThrough: string | null,
  label: string,
  context: z.RefinementCtx,
): void {
  if (
    (value === null) !== (observedFrom === null) ||
    (observedFrom === null) !== (observedThrough === null) ||
    (observedFrom !== null &&
      observedThrough !== null &&
      observedFrom > observedThrough)
  ) {
    context.addIssue({
      code: "custom",
      message: `Enterprise ${label} inventory requires an aligned observation range`,
    });
  }
}

const supplySchema = z
  .object({ calculation: calculationSchema, inventory: inventorySchema })
  .strict()
  .superRefine((supply, context) => {
    const opening = sumFormalDecimals(
      supply.inventory.productionOpeningTonnes,
      supply.inventory.enterpriseOpeningTonnes,
    );
    const ending = sumFormalDecimals(
      supply.inventory.productionEndingTonnes,
      supply.inventory.enterpriseEndingTonnes,
    );
    if (
      !sameFormalDecimal(
        opening,
        supply.calculation.openingObservableInventoryTonnes,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Opening inventory layers must equal the supply calculation",
      });
    }
    if (
      !sameFormalDecimal(
        ending,
        supply.calculation.endingObservableInventoryTonnes,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Ending inventory layers must equal the supply calculation",
      });
    }
    const totalSupply = sumRequiredFormalDecimals(
      supply.calculation.openingObservableInventoryTonnes,
      supply.calculation.expectedOutputTonnes,
      supply.calculation.inflowTonnes,
    );
    if (!sameFormalDecimal(totalSupply, supply.calculation.totalSupplyTonnes)) {
      context.addIssue({
        code: "custom",
        message: "Supply total must equal opening inventory, output and inflow",
      });
    }
    const totalUse = sumRequiredFormalDecimals(
      supply.calculation.selfUseTonnes,
      supply.calculation.outflowTonnes,
      supply.calculation.inferredOtherAbsorptionTonnes,
    );
    if (!sameFormalDecimal(totalUse, supply.calculation.totalUseTonnes)) {
      context.addIssue({
        code: "custom",
        message:
          "Use total must equal self use, outflow and inferred absorption",
      });
    }
    const balancedSupply = sumRequiredFormalDecimals(
      supply.calculation.totalUseTonnes,
      supply.calculation.endingObservableInventoryTonnes,
    );
    if (
      supply.calculation.totalSupplyTonnes !== null &&
      supply.calculation.totalUseTonnes !== null &&
      supply.calculation.endingObservableInventoryTonnes !== null &&
      !sameFormalDecimal(balancedSupply, supply.calculation.totalSupplyTonnes)
    ) {
      context.addIssue({
        code: "custom",
        message: "Supply total must balance with use and ending inventory",
      });
    }
  });

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
    dataCutoffAt: timestampSchema.nullable(),
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
        pendingReviewRecordCount: z.number().int().nonnegative(),
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
    supply: supplySchema,
    lineage: z.array(lineageSchema),
  })
  .strict()
  .superRefine((snapshot, context) => {
    if (
      (snapshot.coverage.recordCount === 0) !==
      (snapshot.dataCutoffAt === null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Data cutoff must be absent exactly when no approved record is adopted",
      });
    }
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
      context.addIssue({
        code: "custom",
        message: "Lineage entries must be unique",
      });
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

function formalDecimalToScaledInteger(value: string): bigint {
  return BigInt(value.replace(".", ""));
}

function sumFormalDecimals(
  first: string | null,
  second: string | null,
): bigint | null {
  if (first === null && second === null) return null;
  return (
    (first === null ? 0n : formalDecimalToScaledInteger(first)) +
    (second === null ? 0n : formalDecimalToScaledInteger(second))
  );
}

function sumRequiredFormalDecimals(
  ...values: readonly (string | null)[]
): bigint | null {
  if (values.some((value) => value === null)) return null;
  return values.reduce(
    (total, value) => total + formalDecimalToScaledInteger(value ?? "0.0000"),
    0n,
  );
}

function sameFormalDecimal(
  expected: bigint | null,
  actual: string | null,
): boolean {
  return expected === null
    ? actual === null
    : actual !== null && expected === formalDecimalToScaledInteger(actual);
}

export function observableAnalysisLineageKey(
  lineage: ObservableAnalysisSnapshot["lineage"][number],
): string {
  return [
    lineage.sourceDomain,
    [...lineage.factCodes].sort().join(","),
    lineage.subjectLabel,
    lineage.regionLabel,
    lineage.periodLabel,
    lineage.approvedAt,
  ].join("|");
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
