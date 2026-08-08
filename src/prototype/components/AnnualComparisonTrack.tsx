import { useRef, type JSX, type KeyboardEvent } from "react";

import { compareFixedDecimal, fixedDecimal } from "../core/fixedDecimal";
import { businessComparisonReason } from "../core/businessDisplayPolicy";
import type { MetricComparisonViewModel } from "../core/metricComparisonViewModel";

export interface AnnualComparisonTrackProps {
  model: MetricComparisonViewModel;
  selected: boolean;
  onSelect: (metricId: string) => void;
}

const UNAVAILABLE_AVAILABILITY_LABELS = new Set([
  "缺失",
  "未采集",
  "不适用",
  "无发布",
  "已拒绝",
  "待审核",
]);

function isCanonicalRawDecimal(value: string): boolean {
  try {
    return fixedDecimal(value) === value;
  } catch {
    return false;
  }
}

export function getMetricComparisonModelError(
  model: MetricComparisonViewModel,
): string | null {
  if (
    model.yearCells.length !== 4 ||
    model.levelSeries.length !== 4 ||
    model.pairCells.length !== 3 ||
    model.annualChangeSeries.length !== 3 ||
    model.currentVsBaselineSeries.length !== 3
  ) {
    return "四年比较数据结构不完整";
  }

  const firstYear = model.yearCells[0]?.year;
  if (
    firstYear === undefined ||
    model.yearCells.some(({ year }, index) => year !== firstYear + index) ||
    model.levelSeries.some(
      ({ year }, index) => year !== model.yearCells[index]?.year,
    )
  ) {
    return "四年比较年份必须连续递增";
  }

  if (
    model.pairCells.some(
      ({ label, changeText }, index) =>
        label !== model.annualChangeSeries[index]?.label ||
        changeText !== model.annualChangeSeries[index]?.changeText,
    ) ||
    model.currentVsBaselineSeries.some(
      ({ fromYear }, index) => fromYear !== model.yearCells[index]?.year,
    ) ||
    model.levelSeries.some(
      ({ valueText }, index) => valueText !== model.yearCells[index]?.valueText,
    )
  ) {
    return "四年比较序列关联不一致";
  }

  if (
    model.currentValue !== model.yearCells[3].valueText ||
    model.currentChangeText !== model.annualChangeSeries[2].changeText
  ) {
    return "四年比较当前值关联不一致";
  }

  if (
    model.currentVsBaselineSeries.some(
      ({ label }) => label.trim() === "" || label.includes("同比"),
    )
  ) {
    return "当前较基期标签无效";
  }

  const comparisonKind = model.annualChangeSeries[0].changeKind;
  if (
    model.annualChangeSeries.some(
      ({ changeKind }) => changeKind !== comparisonKind,
    ) ||
    model.currentVsBaselineSeries.some(
      ({ changeKind }) => changeKind !== comparisonKind,
    )
  ) {
    return "四年比较计算类型不一致";
  }

  const hasInvalidYearState = model.levelSeries.some((point, index) => {
    const cell = model.yearCells[index];
    if (cell.releaseVersionLabel.trim() === "") return true;

    if (point.rawValue === null) {
      return (
        !UNAVAILABLE_AVAILABILITY_LABELS.has(cell.availabilityLabel) ||
        cell.valueText !== cell.availabilityLabel ||
        cell.reason?.trim() === "" ||
        cell.reason === null
      );
    }

    return cell.availabilityLabel !== "可用" || cell.reason !== null;
  });
  if (hasInvalidYearState) {
    return "四年比较年度状态关联不一致";
  }

  const hasInvalidAdjacentEndpoint = model.annualChangeSeries.some(
    (change, index) => {
      const endpointUnavailable =
        model.levelSeries[index].rawValue === null ||
        model.levelSeries[index + 1].rawValue === null;
      if (!endpointUnavailable) return false;

      const pair = model.pairCells[index];
      return (
        change.rawChange !== null ||
        pair.state !== "not-comparable" ||
        pair.reason === null ||
        pair.reason.trim() === ""
      );
    },
  );
  const currentLevelUnavailable = model.levelSeries[3].rawValue === null;
  const hasInvalidDirectEndpoint = model.currentVsBaselineSeries.some(
    (change, index) => {
      const endpointUnavailable =
        model.levelSeries[index].rawValue === null || currentLevelUnavailable;
      if (!endpointUnavailable) return false;

      return (
        change.rawChange !== null ||
        change.state !== "not-comparable" ||
        change.reason === null ||
        change.reason.trim() === ""
      );
    },
  );
  if (hasInvalidAdjacentEndpoint || hasInvalidDirectEndpoint) {
    return "四年比较端点依赖不一致";
  }

  const hasInvalidPairState = model.pairCells.some((pair, index) => {
    const change = model.annualChangeSeries[index];
    if (pair.reason !== change.reason) return true;

    if (change.rawChange === null) {
      return (
        pair.reason === null ||
        pair.reason.trim() === "" ||
        pair.changeText !== pair.reason
      );
    }

    return pair.state !== "comparable" || pair.reason !== null;
  });
  const hasInvalidDirectState = model.currentVsBaselineSeries.some((change) => {
    if (change.rawChange === null) {
      return (
        change.reason === null ||
        change.reason.trim() === "" ||
        change.changeText !== change.reason
      );
    }

    return change.state !== "comparable" || change.reason !== null;
  });
  if (hasInvalidPairState || hasInvalidDirectState) {
    return "四年比较状态原因关联不一致";
  }

  const rawValues = [
    ...model.levelSeries.map(({ rawValue }) => rawValue),
    ...model.annualChangeSeries.map(({ rawChange }) => rawChange),
    ...model.currentVsBaselineSeries.map(({ rawChange }) => rawChange),
  ];
  if (
    rawValues.some((value) => value !== null && !isCanonicalRawDecimal(value))
  ) {
    return "指标数值格式无效";
  }

  return null;
}

function signedChangeText(
  text: string,
  rawChange: MetricComparisonViewModel["annualChangeSeries"][number]["rawChange"],
): string {
  return rawChange !== null &&
    compareFixedDecimal(rawChange, fixedDecimal("0")) > 0 &&
    !text.startsWith("+")
    ? `+${text}`
    : text;
}

function cagrDisplayText(text: string): string {
  return text.startsWith("年均复合增长率") ? text : `年均复合增长率：${text}`;
}

export function AnnualComparisonTrack({
  model,
  selected,
  onSelect,
}: AnnualComparisonTrackProps): JSX.Element {
  const railRef = useRef<HTMLSpanElement>(null);
  const modelError = getMetricComparisonModelError(model);
  if (modelError !== null) {
    return (
      <div
        aria-label={`${model.metricLabel}比较数据无效`}
        className="enterprise-comparison-error"
        role="alert"
      >
        <strong>比较数据无法展示</strong>
        <span>{modelError}</span>
      </div>
    );
  }

  const currentChange =
    model.annualChangeSeries[model.annualChangeSeries.length - 1];
  const currentChangeText = signedChangeText(
    model.currentChangeText,
    currentChange?.rawChange ?? null,
  );
  const currentHasValue =
    model.levelSeries[model.levelSeries.length - 1]?.rawValue !== null;
  const accessibleName = `${model.metricLabel}四年比较，当前值 ${model.currentValue}${currentHasValue ? ` ${model.unit}` : ""}，当前年度同比 ${currentChangeText}，${model.comparabilityText}`;
  const handleTrackKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    const rail = railRef.current;
    if (rail === null) return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const distance = Math.max(120, Math.round(rail.clientWidth * 0.6));
    rail.scrollLeft += direction * distance;
  };

  return (
    <button
      aria-label={accessibleName}
      aria-keyshortcuts="ArrowLeft ArrowRight"
      aria-pressed={selected}
      className="enterprise-comparison-track"
      onClick={() => onSelect(model.metricId)}
      onKeyDown={handleTrackKeyDown}
      type="button"
    >
      <span className="enterprise-comparison-track__identity">
        <strong>{model.metricLabel}</strong>
        <small>{model.unit}</small>
        <span>
          当前值 {model.currentValue}
          {currentHasValue ? ` ${model.unit}` : ""}
        </span>
        <span className="enterprise-comparison-track__cagr">
          {cagrDisplayText(model.cagrText)}
        </span>
        <span className="enterprise-comparison-track__version">
          数据状态：已核定（当前采用）
        </span>
        <span className="enterprise-comparison-track__comparability">
          {model.comparabilityText}
        </span>
      </span>

      <span className="enterprise-comparison-track__rail" ref={railRef}>
        <span className="enterprise-comparison-track__years">
          {model.yearCells.map((cell, index) => {
            const missing = model.levelSeries[index]?.rawValue === null;
            return (
              <span
                aria-label={`${cell.year} 年指标值`}
                className={`enterprise-comparison-track__year${missing ? " is-missing" : ""}`}
                key={cell.year}
                role="group"
              >
                <small>{cell.year}</small>
                <strong>{cell.valueText}</strong>
                {cell.reason && (
                  <span className="enterprise-comparison-track__reason">
                    {businessComparisonReason(cell.reason)}
                  </span>
                )}
              </span>
            );
          })}
        </span>
        <span className="enterprise-comparison-track__pairs">
          {model.pairCells.map((pair, index) => {
            const fromYear = model.yearCells[index]?.year;
            const toYear = model.yearCells[index + 1]?.year;
            const rawChange =
              model.annualChangeSeries[index]?.rawChange ?? null;
            const coordinateBreak = pair.state === "not-comparable";
            const formulaUnavailable = !coordinateBreak && rawChange === null;
            const className = `enterprise-comparison-track__pair${coordinateBreak ? " is-coordinate-not-comparable" : formulaUnavailable ? " is-formula-unavailable" : ""}`;
            const text = coordinateBreak
              ? `${toYear} 与 ${fromYear} 口径不可比：${businessComparisonReason(pair.reason ?? pair.changeText)}`
              : `${toYear}/${fromYear}同比 ${signedChangeText(pair.changeText, rawChange)}`;
            return (
              <span className={className} key={`${fromYear}-${toYear}`}>
                {text}
              </span>
            );
          })}
        </span>
      </span>
    </button>
  );
}
