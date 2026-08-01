import type { ComparisonPair, ComparisonSet, PublishedMetricPoint } from "./comparableSeries";
import type { FixedDecimal } from "./fixedDecimal";
import { formatFixedDecimal } from "./fixedDecimal";
import type { MetricDefinition } from "./metricCatalog";

export interface MetricComparisonViewModel {
  metricId: string;
  metricLabel: string;
  unit: string;
  currentValue: string;
  currentChangeText: string;
  yearCells: readonly { year: number; valueText: string; availabilityLabel: string; releaseVersionLabel: string; reason: string | null }[];
  pairCells: readonly { label: string; changeText: string; state: "comparable" | "not-comparable"; reason: string | null }[];
  cagrText: string;
  comparabilityText: string;
  levelSeries: readonly { year: number; rawValue: FixedDecimal | null; valueText: string }[];
  annualChangeSeries: readonly { label: string; changeKind: "relative-rate" | "percentage-point" | "absolute-delta"; rawChange: FixedDecimal | null; changeText: string; reason: string | null }[];
  currentVsBaselineSeries: readonly {
    fromYear: number;
    label: string;
    changeKind: "relative-rate" | "percentage-point" | "absolute-delta";
    rawChange: FixedDecimal | null;
    changeText: string;
    state: "comparable" | "not-comparable";
    reason: string | null;
  }[];
}

const availabilityLabels: Record<PublishedMetricPoint["availability"], string> = {
  available: "可用",
  missing: "缺失",
  "not-collected": "未采集",
  "not-applicable": "不适用",
  "no-release": "无发布",
  rejected: "已拒绝",
  "pending-review": "待审核",
};

function pointText(point: PublishedMetricPoint, definition: MetricDefinition): string {
  return point.availability === "available"
    ? formatFixedDecimal(point.value, definition.displayScale)
    : availabilityLabels[point.availability];
}

function releaseLabel(point: PublishedMetricPoint): string {
  if (point.availability === "available") return point.coordinate.metricReleaseVersionId;
  if (point.releaseAttempt === null) return "未发起发布";
  return point.releaseAttempt.metricReleaseVersionId ?? "已发起，未形成指标发布";
}

function changeKind(definition: MetricDefinition): MetricComparisonViewModel["annualChangeSeries"][number]["changeKind"] {
  return definition.comparisonPolicy.relativeChange === "allowed"
    ? "relative-rate"
    : definition.comparisonPolicy.relativeChange === "percentage-points"
      ? "percentage-point"
      : "absolute-delta";
}

function rawChange(pair: ComparisonPair, definition: MetricDefinition): FixedDecimal | null {
  if (definition.comparisonPolicy.relativeChange === "allowed") return pair.relativeRate;
  if (definition.comparisonPolicy.relativeChange === "percentage-points") return pair.percentagePointDelta;
  return pair.absoluteDelta;
}

function changeText(pair: ComparisonPair, definition: MetricDefinition): string {
  const change = rawChange(pair, definition);
  if (change === null) return pair.reason ?? "不可计算";
  const formatted = formatFixedDecimal(change, definition.displayScale);
  if (definition.comparisonPolicy.relativeChange === "allowed") return `${formatted}%`;
  if (definition.comparisonPolicy.relativeChange === "percentage-points") return `${formatted} 个百分点`;
  return `${formatted} ${definition.unit}`;
}

export function createMetricComparisonViewModel(
  definition: MetricDefinition,
  comparison: ComparisonSet,
): MetricComparisonViewModel {
  if (comparison.metricId !== definition.metricId) throw new Error("比较结果与指标定义不一致");
  const current = comparison.points[3];
  const pairCells = comparison.pairs.map((pair) => ({
    label: pair.label,
    changeText: changeText(pair, definition),
    state: pair.comparable ? "comparable" as const : "not-comparable" as const,
    reason: pair.reason,
  }));
  return {
    metricId: definition.metricId,
    metricLabel: definition.label,
    unit: definition.unit,
    currentValue: pointText(current, definition),
    currentChangeText: changeText(comparison.pairs[2], definition),
    yearCells: comparison.points.map((point) => ({
      year: point.coordinate.period.year,
      valueText: pointText(point, definition),
      availabilityLabel: availabilityLabels[point.availability],
      releaseVersionLabel: releaseLabel(point),
      reason: point.availability === "available" ? null : point.reason,
    })),
    pairCells,
    cagrText: comparison.cagr.status === "available"
      ? `年均复合增长率 ${formatFixedDecimal(comparison.cagr.rate, definition.displayScale)}%`
      : comparison.cagr.reason,
    comparabilityText: comparison.trend.continuity === "continuous" && comparison.pairs.every(({ comparable }) => comparable)
      ? "四年口径连续可比"
      : `四年口径存在断点：${comparison.trend.breakYears.join("、") || "口径不一致"}`,
    levelSeries: comparison.points.map((point) => ({
      year: point.coordinate.period.year,
      rawValue: point.value,
      valueText: pointText(point, definition),
    })),
    annualChangeSeries: comparison.pairs.map((pair) => ({
      label: pair.label,
      changeKind: changeKind(definition),
      rawChange: rawChange(pair, definition),
      changeText: changeText(pair, definition),
      reason: pair.reason,
    })),
    currentVsBaselineSeries: comparison.currentVsBaselines.map((pair) => ({
      fromYear: pair.fromYear,
      label: pair.label,
      changeKind: changeKind(definition),
      rawChange: rawChange(pair, definition),
      changeText: changeText(pair, definition),
      state: pair.comparable ? "comparable" : "not-comparable",
      reason: pair.reason,
    })),
  };
}
