import { useId, type JSX } from "react";

import {
  absFixedDecimal,
  compareFixedDecimal,
  divideFixedDecimal,
  fixedDecimal,
  subtractFixedDecimal,
  type FixedDecimal,
} from "../core/fixedDecimal";
import type { MetricComparisonViewModel } from "../core/metricComparisonViewModel";
import { getMetricComparisonModelError } from "./AnnualComparisonTrack";

export interface ComparisonChartsProps {
  model: MetricComparisonViewModel;
}

export const comparisonYearColors = {
  previous3: "#C6D1D3",
  previous2: "#91AAA9",
  previous1: "#4D8D87",
  current: "#1E625F",
} as const;

const ZERO = fixedDecimal("0");
const ONE = fixedDecimal("1");
const LEVEL_X = [80, 240, 400, 560] as const;
const LEVEL_TOP = 38;
const LEVEL_HEIGHT = 166;
const CHANGE_X = [120, 320, 520] as const;
const CHANGE_ZERO_Y = 140;
const CHANGE_HALF_HEIGHT = 78;
const YEAR_COLORS = Object.values(comparisonYearColors);

interface LevelGeometryPoint {
  x: number;
  y: number;
}

interface ChangeGeometryBar {
  height: number;
  sign: "positive" | "negative" | "zero";
  x: number;
  y: number;
}

function finalNormalizedNumber(value: FixedDecimal): number {
  const bounded =
    compareFixedDecimal(value, ZERO) < 0
      ? ZERO
      : compareFixedDecimal(value, ONE) > 0
        ? ONE
        : value;
  return Number(bounded);
}

function normalizedLevels(
  values: readonly (FixedDecimal | null)[],
): readonly (number | null)[] {
  const available = values.filter(
    (value): value is FixedDecimal => value !== null,
  );
  if (available.length === 0) return values.map(() => null);
  let minimum = available[0];
  let maximum = available[0];
  for (const value of available.slice(1)) {
    if (compareFixedDecimal(value, minimum) < 0) minimum = value;
    if (compareFixedDecimal(value, maximum) > 0) maximum = value;
  }
  if (compareFixedDecimal(minimum, maximum) === 0) {
    return values.map((value) => (value === null ? null : 0.5));
  }
  const span = subtractFixedDecimal(maximum, minimum);
  return values.map((value) =>
    value === null
      ? null
      : finalNormalizedNumber(
          divideFixedDecimal(subtractFixedDecimal(value, minimum), span, 8),
        ),
  );
}

function normalizedMagnitudes(
  values: readonly (FixedDecimal | null)[],
): readonly (number | null)[] {
  const magnitudes = values.map((value) =>
    value === null ? null : absFixedDecimal(value),
  );
  const available = magnitudes.filter(
    (value): value is FixedDecimal => value !== null,
  );
  if (available.length === 0) return values.map(() => null);
  let maximum = available[0];
  for (const value of available.slice(1)) {
    if (compareFixedDecimal(value, maximum) > 0) maximum = value;
  }
  if (compareFixedDecimal(maximum, ZERO) === 0) {
    return values.map((value) => (value === null ? null : 0));
  }
  return magnitudes.map((value) =>
    value === null
      ? null
      : finalNormalizedNumber(divideFixedDecimal(value, maximum, 8)),
  );
}

function createLevelGeometry(
  values: readonly (FixedDecimal | null)[],
): readonly (LevelGeometryPoint | null)[] {
  return normalizedLevels(values).map((normalized, index) =>
    normalized === null
      ? null
      : { x: LEVEL_X[index], y: LEVEL_TOP + (1 - normalized) * LEVEL_HEIGHT },
  );
}

function createChangeGeometry(
  values: readonly (FixedDecimal | null)[],
): readonly (ChangeGeometryBar | null)[] {
  const magnitudes = normalizedMagnitudes(values);
  return values.map((value, index) => {
    if (value === null || magnitudes[index] === null) return null;
    const comparison = compareFixedDecimal(value, ZERO);
    const sign =
      comparison > 0 ? "positive" : comparison < 0 ? "negative" : "zero";
    const height = (magnitudes[index] ?? 0) * CHANGE_HALF_HEIGHT;
    return {
      height,
      sign,
      x: CHANGE_X[index],
      y: sign === "positive" ? CHANGE_ZERO_Y - height : CHANGE_ZERO_Y,
    };
  });
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

function comparisonState(
  state: "comparable" | "not-comparable",
  rawChange: MetricComparisonViewModel["annualChangeSeries"][number]["rawChange"],
): string {
  if (state === "not-comparable") return "口径不可比";
  if (rawChange === null) return "口径可比·公式不可计算";
  return "口径可比";
}

function changeKindLabel(
  kind: MetricComparisonViewModel["annualChangeSeries"][number]["changeKind"],
): string {
  if (kind === "relative-rate") return "相对增长率";
  if (kind === "percentage-point") return "百分点变化";
  return "绝对变化";
}

export function ComparisonCharts({
  model,
}: ComparisonChartsProps): JSX.Element {
  const instanceId = useId().replaceAll(":", "");
  const modelError = getMetricComparisonModelError(model);
  if (modelError !== null) {
    return (
      <div
        aria-label={`${model.metricLabel}比较数据无效`}
        className="enterprise-comparison-error"
        role="alert"
      >
        <strong>比较图表无法展示</strong>
        <span>{modelError}</span>
      </div>
    );
  }

  const levelTitleId = `${instanceId}-level-title`;
  const levelDescriptionId = `${instanceId}-level-description`;
  const changeTitleId = `${instanceId}-change-title`;
  const changeDescriptionId = `${instanceId}-change-description`;
  const levelGapPatternId = `${instanceId}-level-gap-pattern`;
  const changeGapPatternId = `${instanceId}-change-gap-pattern`;
  const levelGeometry = createLevelGeometry(
    model.levelSeries.map(({ rawValue }) => rawValue),
  );
  const changeGeometry = createChangeGeometry(
    model.annualChangeSeries.map(({ rawChange }) => rawChange),
  );

  return (
    <section
      aria-label={`${model.metricLabel}四年比较分析`}
      className="enterprise-comparison-charts"
    >
      <div className="enterprise-comparison-charts__panels">
        <figure className="enterprise-comparison-chart">
          <figcaption>{model.metricLabel}四年数值趋势</figcaption>
          <svg
            aria-describedby={levelDescriptionId}
            aria-labelledby={levelTitleId}
            role="img"
            viewBox="0 0 640 280"
          >
            <title id={levelTitleId}>{model.metricLabel}四年数值趋势</title>
            <desc id={levelDescriptionId}>
              按年度展示四个已治理指标值，单位为{model.unit}。
            </desc>
            <defs>
              <pattern
                height="8"
                id={levelGapPatternId}
                patternUnits="userSpaceOnUse"
                width="8"
              >
                <path d="M0 8 8 0" stroke="#91AAA9" strokeWidth="1" />
              </pattern>
            </defs>
            <line
              className="enterprise-comparison-chart__axis"
              x1="44"
              x2="596"
              y1="218"
              y2="218"
            />
            {model.pairCells.map((pair, index) => {
              const from = levelGeometry[index];
              const to = levelGeometry[index + 1];
              if (
                from === null ||
                to === null ||
                pair.state === "not-comparable"
              )
                return null;
              return (
                <line
                  className="enterprise-comparison-chart__level-segment"
                  data-level-segment={`${model.yearCells[index].year}-${model.yearCells[index + 1].year}`}
                  key={`${model.yearCells[index].year}-${model.yearCells[index + 1].year}`}
                  x1={from.x}
                  x2={to.x}
                  y1={from.y}
                  y2={to.y}
                />
              );
            })}
            {model.levelSeries.map((point, index) => {
              const geometry = levelGeometry[index];
              const year = model.yearCells[index];
              if (geometry === null) {
                return (
                  <g
                    className="enterprise-comparison-chart__level-gap"
                    key={point.year}
                  >
                    <rect
                      fill={`url(#${levelGapPatternId})`}
                      height="72"
                      width="96"
                      x={LEVEL_X[index] - 48}
                      y="92"
                    />
                    <text
                      className="enterprise-comparison-chart__value-label"
                      textAnchor="middle"
                      x={LEVEL_X[index]}
                      y="82"
                    >
                      {point.valueText}
                    </text>
                    <text
                      className="enterprise-comparison-chart__reason-label"
                      textAnchor="middle"
                      x={LEVEL_X[index]}
                      y="180"
                    >
                      {year.reason ?? year.availabilityLabel}
                    </text>
                    <text
                      className="enterprise-comparison-chart__period-label"
                      textAnchor="middle"
                      x={LEVEL_X[index]}
                      y="246"
                    >
                      {point.year}
                    </text>
                  </g>
                );
              }
              return (
                <g key={point.year}>
                  <circle
                    className="enterprise-comparison-chart__level-point"
                    cx={geometry.x}
                    cy={geometry.y}
                    fill={YEAR_COLORS[index]}
                    r="7"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                  <text
                    className="enterprise-comparison-chart__value-label"
                    textAnchor="middle"
                    x={geometry.x}
                    y={Math.max(24, geometry.y - 13)}
                  >
                    {point.valueText} {model.unit}
                  </text>
                  <text
                    className="enterprise-comparison-chart__period-label"
                    textAnchor="middle"
                    x={geometry.x}
                    y="246"
                  >
                    {point.year}
                  </text>
                </g>
              );
            })}
          </svg>
        </figure>

        <figure className="enterprise-comparison-chart">
          <figcaption>{model.metricLabel}三段年度同比</figcaption>
          <svg
            aria-describedby={changeDescriptionId}
            aria-labelledby={changeTitleId}
            role="img"
            viewBox="0 0 640 280"
          >
            <title id={changeTitleId}>{model.metricLabel}三段年度同比</title>
            <desc id={changeDescriptionId}>展示三个相邻年度比较结果。</desc>
            <defs>
              <pattern
                height="8"
                id={changeGapPatternId}
                patternUnits="userSpaceOnUse"
                width="8"
              >
                <path d="M0 8 8 0" stroke="#91AAA9" strokeWidth="1" />
              </pattern>
            </defs>
            <line
              className="enterprise-comparison-chart__zero-axis"
              x1="40"
              x2="600"
              y1={CHANGE_ZERO_Y}
              y2={CHANGE_ZERO_Y}
            />
            <text
              className="enterprise-comparison-chart__zero-label"
              x="44"
              y={CHANGE_ZERO_Y - 7}
            >
              0
            </text>
            {model.annualChangeSeries.map((change, index) => {
              const geometry = changeGeometry[index];
              const pair = model.pairCells[index];
              const fromYear = model.yearCells[index].year;
              const toYear = model.yearCells[index + 1].year;
              const kindAndValue = `${changeKindLabel(change.changeKind)} ${signedChangeText(change.changeText, change.rawChange)}`;
              if (geometry === null) {
                const state =
                  pair.state === "not-comparable"
                    ? "coordinate-not-comparable"
                    : "formula-unavailable";
                return (
                  <g
                    className={`enterprise-comparison-chart__change-gap is-${state}`}
                    data-change-state={state}
                    key={`${fromYear}-${toYear}`}
                  >
                    <rect
                      fill={`url(#${changeGapPatternId})`}
                      height="76"
                      width="116"
                      x={CHANGE_X[index] - 58}
                      y="102"
                    />
                    <text
                      className="enterprise-comparison-chart__value-label"
                      textAnchor="middle"
                      x={CHANGE_X[index]}
                      y="92"
                    >
                      {changeKindLabel(change.changeKind)}
                    </text>
                    <text
                      className="enterprise-comparison-chart__reason-label"
                      textAnchor="middle"
                      x={CHANGE_X[index]}
                      y="194"
                    >
                      {pair.reason ?? change.reason ?? change.changeText}
                    </text>
                    <text
                      className="enterprise-comparison-chart__period-label"
                      textAnchor="middle"
                      x={CHANGE_X[index]}
                      y="246"
                    >
                      {toYear}/{fromYear}
                    </text>
                  </g>
                );
              }
              const labelY =
                geometry.sign === "positive"
                  ? Math.max(26, geometry.y - 11)
                  : geometry.sign === "negative"
                    ? Math.min(225, geometry.y + geometry.height + 18)
                    : CHANGE_ZERO_Y - 12;
              return (
                <g key={`${fromYear}-${toYear}`}>
                  {geometry.sign === "zero" ? (
                    <line
                      className="enterprise-comparison-chart__zero-marker"
                      data-change-kind={change.changeKind}
                      data-change-sign="zero"
                      stroke={YEAR_COLORS[index + 1]}
                      strokeWidth="5"
                      x1={geometry.x - 28}
                      x2={geometry.x + 28}
                      y1={CHANGE_ZERO_Y}
                      y2={CHANGE_ZERO_Y}
                    />
                  ) : (
                    <rect
                      className="enterprise-comparison-chart__bar"
                      data-change-kind={change.changeKind}
                      data-change-sign={geometry.sign}
                      fill={YEAR_COLORS[index + 1]}
                      height={geometry.height}
                      width="58"
                      x={geometry.x - 29}
                      y={geometry.y}
                    />
                  )}
                  <text
                    className="enterprise-comparison-chart__value-label"
                    textAnchor="middle"
                    x={geometry.x}
                    y={labelY}
                  >
                    {kindAndValue}
                  </text>
                  <text
                    className="enterprise-comparison-chart__period-label"
                    textAnchor="middle"
                    x={geometry.x}
                    y="246"
                  >
                    {toYear}/{fromYear}
                  </text>
                </g>
              );
            })}
          </svg>
        </figure>
      </div>

      <section
        aria-label="当前较前三年"
        className="enterprise-comparison-baselines"
      >
        <h3>当前较前三年</h3>
        <ul>
          {model.currentVsBaselineSeries.map((comparison) => (
            <li
              className={
                comparison.state === "not-comparable"
                  ? "is-coordinate-not-comparable"
                  : comparison.rawChange === null
                    ? "is-formula-unavailable"
                    : ""
              }
              key={comparison.fromYear}
            >
              <strong>{comparison.label}</strong>{" "}
              <span>
                {signedChangeText(comparison.changeText, comparison.rawChange)}
              </span>
              {comparison.reason && <small>{comparison.reason}</small>}
            </li>
          ))}
        </ul>
      </section>

      <div className="enterprise-comparison-table-wrap">
        <table
          aria-label={`${model.metricLabel}四年比较分析数据`}
          className="enterprise-comparison-table"
        >
          <thead>
            <tr>
              <th scope="col">分析类型</th>
              <th scope="col">期间或比较</th>
              <th scope="col">结果</th>
              <th scope="col">状态</th>
              <th scope="col">指标版本</th>
              <th scope="col">治理说明</th>
            </tr>
          </thead>
          <tbody>
            {model.levelSeries.map((point, index) => {
              const year = model.yearCells[index];
              return (
                <tr key={`level-${point.year}`}>
                  <th scope="row">年度值</th>
                  <td>{point.year}</td>
                  <td>
                    {point.valueText}
                    {point.rawValue === null ? "" : ` ${model.unit}`}
                  </td>
                  <td>{year.availabilityLabel}</td>
                  <td>{year.releaseVersionLabel}</td>
                  <td>{year.reason ?? "—"}</td>
                </tr>
              );
            })}
            {model.annualChangeSeries.map((change, index) => {
              const from = model.yearCells[index];
              const to = model.yearCells[index + 1];
              const pair = model.pairCells[index];
              return (
                <tr key={`change-${from.year}-${to.year}`}>
                  <th scope="row">相邻年度比较</th>
                  <td>
                    {to.year}/{from.year}同比
                  </td>
                  <td>
                    {signedChangeText(change.changeText, change.rawChange)}
                  </td>
                  <td>{comparisonState(pair.state, change.rawChange)}</td>
                  <td>
                    {from.releaseVersionLabel} → {to.releaseVersionLabel}
                  </td>
                  <td>{pair.reason ?? change.reason ?? "—"}</td>
                </tr>
              );
            })}
            {model.currentVsBaselineSeries.map((comparison, index) => {
              const baseline = model.yearCells[index];
              const current = model.yearCells[3];
              return (
                <tr key={`baseline-${comparison.fromYear}`}>
                  <th scope="row">当前较历史基期</th>
                  <td>{comparison.label}</td>
                  <td>
                    {signedChangeText(
                      comparison.changeText,
                      comparison.rawChange,
                    )}
                  </td>
                  <td>
                    {comparisonState(comparison.state, comparison.rawChange)}
                  </td>
                  <td>
                    {baseline.releaseVersionLabel} →{" "}
                    {current.releaseVersionLabel}
                  </td>
                  <td>{comparison.reason ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
