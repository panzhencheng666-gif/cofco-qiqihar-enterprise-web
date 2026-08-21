import { Children, type ReactNode } from "react";

import type { ObservableAnalysisSnapshot } from "@/platform/api/observableAnalysisContract";
import type { ObservableAnalysisSeriesPoint } from "./useObservableAnalysisSeries";

export type AnalysisMetric =
  ObservableAnalysisSnapshot["production"]["metrics"][number];

export interface AnalysisTrendLine {
  key: string;
  label: string;
  unit: string;
  tone?: "primary" | "comparison" | "warning";
  value: (snapshot: ObservableAnalysisSnapshot) => string | null;
}

export interface AnalysisRangeSeries {
  key: string;
  label: string;
  minimum?: AnalysisMetric;
  average?: AnalysisMetric;
  maximum?: AnalysisMetric;
}

export function AnalysisScopeStrip({
  regionCount,
  subjectCount,
  recordCount,
}: {
  regionCount: number;
  subjectCount: number;
  recordCount: number;
}) {
  return (
    <div className="observable-analysis-report__scope-strip">
      <b>统计范围</b>
      <span>{regionCount.toLocaleString("zh-CN")} 个地区</span>
      <span>{subjectCount.toLocaleString("zh-CN")} 个调查对象</span>
      <span>{recordCount.toLocaleString("zh-CN")} 条采用记录</span>
    </div>
  );
}

export function buildAnalysisRangeSeries(
  metrics: readonly AnalysisMetric[],
  prefix: string,
): AnalysisRangeSeries[] {
  const suffixes = ["_MINIMUM", "_AVERAGE", "_MAXIMUM"] as const;
  const grouped = new Map<string, AnalysisRangeSeries>();

  metrics.forEach((metric) => {
    if (!metric.code.startsWith(prefix)) return;
    const suffix = suffixes.find((candidate) =>
      metric.code.endsWith(candidate),
    );
    if (!suffix) return;
    const key = metric.code.slice(0, -suffix.length);
    const current = grouped.get(key) ?? {
      key,
      label: metric.label.replace(/(?:最低值|平均值|最高值)$/u, ""),
    };
    if (suffix === "_MINIMUM") current.minimum = metric;
    if (suffix === "_AVERAGE") current.average = metric;
    if (suffix === "_MAXIMUM") current.maximum = metric;
    grouped.set(key, current);
  });

  return [...grouped.values()].filter(
    (item) =>
      item.minimum &&
      item.average &&
      item.maximum &&
      isAvailableMetric(item.minimum) &&
      isAvailableMetric(item.average) &&
      isAvailableMetric(item.maximum),
  );
}

export function AnalysisDashboardGrid({
  children,
  variant,
}: {
  children: ReactNode;
  variant: "primary" | "supporting";
}) {
  const cardCount = Children.toArray(children).length;
  return (
    <div
      className="observable-analysis-dashboard__grid"
      data-card-count={cardCount}
      data-layout={variant}
    >
      {children}
    </div>
  );
}

export function AnalysisMetricBand({
  metrics,
  sourceLabel,
}: {
  metrics: readonly AnalysisMetric[];
  sourceLabel?: (metric: AnalysisMetric) => string;
}) {
  const available = metrics.filter(isAvailableMetric);

  if (available.length === 0) return null;

  return (
    <dl
      className="observable-analysis-report__metric-band"
      data-card-count={available.length}
    >
      {available.map((metric) => (
        <div
          className="observable-analysis-report__metric-band-card"
          key={metric.code}
        >
          <dt>{metric.label}</dt>
          <dd>
            {formatMetric(metric.value, metric.unit, metric.missingReason)}
          </dd>
          <small>
            {metric.value === null
              ? "未以零值代替"
              : (sourceLabel?.(metric) ??
                `${metric.sourceCount.toLocaleString("zh-CN")} 条核定来源`)}
          </small>
        </div>
      ))}
    </dl>
  );
}

export function AnalysisReportSection({
  title,
  description,
  aside,
  analysisVersion,
  children,
}: {
  title: string;
  description?: string;
  aside?: ReactNode;
  analysisVersion?: string;
  children: ReactNode;
}) {
  return (
    <section
      className="observable-analysis-report__section"
      data-analysis-version={analysisVersion}
    >
      <header>
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {aside ? <div>{aside}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function AnalysisTrendChart({
  title,
  points,
  lines,
}: {
  title: string;
  points: readonly ObservableAnalysisSeriesPoint[];
  lines: readonly AnalysisTrendLine[];
}) {
  const validMonthCount = Math.max(
    0,
    ...lines.map(
      (line) =>
        points.filter((point) => {
          const value = point.snapshot ? line.value(point.snapshot) : null;
          return value !== null && Number.isFinite(Number(value));
        }).length,
    ),
  );
  const numericValues = points.flatMap((point) =>
    point.snapshot
      ? lines.flatMap((line) => {
          const value = line.value(point.snapshot!);
          return value === null || !Number.isFinite(Number(value))
            ? []
            : [Number(value)];
        })
      : [],
  );
  const minimum = numericValues.length ? Math.min(...numericValues) : 0;
  const maximum = numericValues.length ? Math.max(...numericValues) : 1;
  const range = maximum === minimum ? 1 : maximum - minimum;
  const x = (month: number) => 48 + ((month - 1) / 11) * 624;
  const y = (value: number) => 24 + ((maximum - value) / range) * 152;

  if (validMonthCount < 2) {
    return (
      <div className="observable-analysis-report__trend-insufficient">
        <strong>仅 {validMonthCount} 个有效月份，不生成趋势图</strong>
        <span>当前核定值保留在本期指标和业务结构中。</span>
      </div>
    );
  }

  return (
    <figure className="observable-analysis-report__trend">
      <div className="observable-analysis-report__legend" aria-hidden="true">
        {lines.map((line) => (
          <span data-tone={line.tone ?? "primary"} key={line.key}>
            {line.label}
          </span>
        ))}
      </div>
      <svg aria-label={title} role="img" viewBox="0 0 720 220">
        <line className="chart-axis" x1="48" x2="672" y1="176" y2="176" />
        {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
          <g key={month}>
            <line
              className="chart-tick"
              x1={x(month)}
              x2={x(month)}
              y1="176"
              y2="181"
            />
            <text x={x(month)} y="201">
              {month}月
            </text>
          </g>
        ))}
        {lines.map((line, lineIndex) => {
          const values = points.map((point) => {
            const raw = point.snapshot ? line.value(point.snapshot) : null;
            return {
              month: point.month,
              value:
                raw === null || !Number.isFinite(Number(raw))
                  ? null
                  : Number(raw),
            };
          });
          return (
            <g
              data-series-key={line.key}
              data-tone={line.tone ?? "primary"}
              key={line.key}
            >
              <path d={segmentedPath(values, x, y)} fill="none" />
              {values.flatMap((item) =>
                item.value === null
                  ? []
                  : [
                      <g key={item.month}>
                        <circle cx={x(item.month)} cy={y(item.value)} r="4.5" />
                        <text
                          className="chart-value"
                          x={x(item.month)}
                          y={Math.max(13, y(item.value) - 8 - lineIndex * 12)}
                        >
                          {formatChartValue(item.value)}
                        </text>
                      </g>,
                    ],
              )}
            </g>
          );
        })}
      </svg>
      <div className="observable-analysis-report__trend-table">
        <table aria-label={`${title}数据表`}>
          <thead>
            <tr>
              <th>月份</th>
              {lines.map((line) => (
                <th key={line.key}>{line.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.month}>
                <th scope="row">{point.month} 月</th>
                {lines.map((line) => {
                  const value = point.snapshot
                    ? line.value(point.snapshot)
                    : null;
                  return (
                    <td key={line.key}>
                      {point.error
                        ? "该月暂缺"
                        : value === null
                          ? "暂无核定数据"
                          : formatMetric(value, line.unit)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

export function AnalysisBarChart({
  metrics,
  title,
}: {
  metrics: readonly AnalysisMetric[];
  title: string;
}) {
  const available = metrics.filter(
    (metric) => metric.value !== null && Number.isFinite(Number(metric.value)),
  );
  if (available.length === 0) return null;

  return (
    <figure
      className="observable-analysis-report__bar-chart"
      data-chart-type="bar"
      data-density={available.length >= 4 ? "compact" : "regular"}
    >
      <figcaption>{title}</figcaption>
      <AnalysisValueBars metrics={available} title={title} />
      <div className="observable-analysis-report__trend-table">
        <table aria-label={`${title}数据表`}>
          <thead>
            <tr>
              <th>业务指标</th>
              <th>核定结果</th>
              <th>来源数</th>
            </tr>
          </thead>
          <tbody>
            {available.map((metric) => (
              <tr key={metric.code}>
                <th scope="row">{metric.label}</th>
                <td>{formatMetric(metric.value, metric.unit)}</td>
                <td>{metric.sourceCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

export function AnalysisGroupedBarCharts({
  metrics,
  title,
}: {
  metrics: readonly AnalysisMetric[];
  title: string;
}) {
  const groups = new Map<string, AnalysisMetric[]>();
  metrics.filter(isAvailableMetric).forEach((metric) => {
    const group = groups.get(metric.unit) ?? [];
    group.push(metric);
    groups.set(metric.unit, group);
  });
  const entries = [...groups.entries()];

  if (entries.length === 0) return null;

  return (
    <div
      className="observable-analysis-report__grouped-charts"
      data-group-count={entries.length}
    >
      {entries.map(([unit, group]) =>
        group.length === 1 ? (
          <AnalysisSingleMetric
            key={unit}
            metric={group[0]}
            title={entries.length === 1 ? title : `${title}（${unit}）`}
          />
        ) : (
          <AnalysisBarChart
            key={unit}
            metrics={group}
            title={entries.length === 1 ? title : `${title}（${unit}）`}
          />
        ),
      )}
    </div>
  );
}

export function AnalysisColumnChart({
  metrics,
  title,
}: {
  metrics: readonly AnalysisMetric[];
  title: string;
}) {
  const available = metrics.filter(isAvailableMetric);
  if (available.length < 2) return null;
  const maximum = Math.max(
    1,
    ...available.map((metric) => Math.abs(Number(metric.value))),
  );

  return (
    <figure
      className="observable-analysis-report__comparison-chart"
      data-chart-type="comparison"
    >
      <figcaption>{title}</figcaption>
      <div
        className="observable-analysis-report__value-scale"
        aria-hidden="true"
      >
        <span>0</span>
        <span>
          同组最大值 {formatMetric(String(maximum), available[0].unit)}
        </span>
      </div>
      <div
        aria-label={title}
        className="observable-analysis-report__dot-plot"
        role="img"
      >
        {available.map((metric, index) => {
          const numericValue = Number(metric.value);
          const position =
            numericValue === 0
              ? 0
              : Math.max(2, (Math.abs(numericValue) / maximum) * 100);
          return (
            <div data-tone={index % 4} key={metric.code}>
              <span>{metric.label}</span>
              <strong>{formatMetric(metric.value, metric.unit)}</strong>
              <i aria-hidden="true">
                <b style={{ width: `${position}%` }} />
                <em style={{ left: `${position}%` }} />
              </i>
              <small>
                {metric.sourceCount.toLocaleString("zh-CN")} 条核定来源
              </small>
            </div>
          );
        })}
      </div>
      <ChartDataTable metrics={available} title={title} />
    </figure>
  );
}

export function AnalysisVerticalBarChart({
  metrics,
  title,
}: {
  metrics: readonly AnalysisMetric[];
  title: string;
}) {
  const available = metrics.filter(isAvailableMetric);
  if (available.length === 0) return null;
  const maximum = Math.max(
    1,
    ...available.map((metric) => Math.abs(Number(metric.value))),
  );

  return (
    <figure className="observable-analysis-report__vertical-bar-chart">
      <figcaption>{title}</figcaption>
      <div
        className="observable-analysis-report__value-scale"
        aria-hidden="true"
      >
        <span>0</span>
        <span>
          同组最大值 {formatMetric(String(maximum), available[0].unit)}
        </span>
      </div>
      <div
        aria-label={title}
        className="observable-analysis-report__vertical-bars"
        data-bar-count={available.length}
        data-chart-type="vertical-bar"
        role="img"
      >
        {available.map((metric, index) => {
          const numericValue = Math.abs(Number(metric.value));
          const height =
            numericValue === 0
              ? 0
              : Math.max(7, (numericValue / maximum) * 100);
          return (
            <div data-tone={index % 4} key={metric.code}>
              <strong>{formatMetric(metric.value, metric.unit)}</strong>
              <i aria-hidden="true">
                <b style={{ height: `${height}%` }} />
              </i>
              <span>{metric.label}</span>
              <small>
                {metric.sourceCount.toLocaleString("zh-CN")} 条核定来源
              </small>
            </div>
          );
        })}
      </div>
      <ChartDataTable metrics={available} title={title} />
    </figure>
  );
}

function AnalysisValueBars({
  metrics,
  title,
}: {
  metrics: readonly AnalysisMetric[];
  title: string;
}) {
  const maximum = Math.max(
    1,
    ...metrics.map((metric) => Math.abs(Number(metric.value))),
  );
  return (
    <>
      <div
        className="observable-analysis-report__value-scale"
        aria-hidden="true"
      >
        <span>0</span>
        <span>同组最大值 {formatMetric(String(maximum), metrics[0].unit)}</span>
      </div>
      <div
        aria-label={title}
        className="observable-analysis-report__bars"
        role="img"
      >
        {metrics.map((metric) => {
          const numericValue = Number(metric.value);
          const width =
            numericValue === 0
              ? 0
              : Math.max(2, (Math.abs(numericValue) / maximum) * 100);
          return (
            <div
              data-direction={numericValue < 0 ? "negative" : "positive"}
              key={metric.code}
            >
              <span>{metric.label}</span>
              <strong>{formatMetric(metric.value, metric.unit)}</strong>
              <i>
                <b style={{ width: `${width}%` }} />
              </i>
              <small>
                {metric.sourceCount.toLocaleString("zh-CN")} 条核定来源
              </small>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function AnalysisPriceDifferenceChart({
  startMetric,
  endMetric,
  differenceMetric,
  title,
}: {
  startMetric?: AnalysisMetric;
  endMetric?: AnalysisMetric;
  differenceMetric?: AnalysisMetric;
  title: string;
}) {
  if (!startMetric || !endMetric) return null;
  if (!isAvailableMetric(startMetric) || !isAvailableMetric(endMetric)) {
    return null;
  }
  const difference =
    differenceMetric && isAvailableMetric(differenceMetric)
      ? differenceMetric
      : undefined;
  const metrics = [startMetric, endMetric, ...(difference ? [difference] : [])];
  return (
    <figure
      className="observable-analysis-report__difference-chart"
      data-chart-type="difference"
    >
      <figcaption>{title}</figcaption>
      <div
        aria-label={title}
        className="observable-analysis-report__difference"
        role="group"
      >
        {difference ? (
          <p className="observable-analysis-report__price-spread">
            <span>{difference.label}</span>
            <strong>{formatMetric(difference.value, difference.unit)}</strong>
          </p>
        ) : null}
        <div
          aria-label={`${title}价格路径`}
          className="observable-analysis-report__price-flow"
          role="img"
        >
          {[startMetric, endMetric].map((metric) => (
            <div key={metric.code}>
              <span>{metric.label}</span>
              <strong>{formatMetric(metric.value, metric.unit)}</strong>
            </div>
          ))}
          <b aria-hidden="true">→</b>
        </div>
      </div>
      <ChartDataTable metrics={metrics} title={title} />
    </figure>
  );
}

export function AnalysisRangeChart({
  series,
  title,
  unit,
}: {
  series: readonly AnalysisRangeSeries[];
  title: string;
  unit: string;
}) {
  const available = series.filter(
    (item) =>
      item.minimum &&
      item.average &&
      item.maximum &&
      item.minimum.unit === unit &&
      item.average.unit === unit &&
      item.maximum.unit === unit &&
      isAvailableMetric(item.minimum) &&
      isAvailableMetric(item.average) &&
      isAvailableMetric(item.maximum),
  ) as Array<
    AnalysisRangeSeries & {
      minimum: AnalysisMetric;
      average: AnalysisMetric;
      maximum: AnalysisMetric;
    }
  >;

  if (available.length === 0) return null;

  const domainMinimum = Math.min(
    ...available.map((item) => Number(item.minimum.value)),
  );
  const domainMaximum = Math.max(
    ...available.map((item) => Number(item.maximum.value)),
  );
  const domainRange = domainMaximum - domainMinimum;
  const position = (value: string | null) =>
    domainRange === 0
      ? 50
      : ((Number(value) - domainMinimum) / domainRange) * 100;

  return (
    <figure
      className="observable-analysis-report__range-chart"
      data-chart-type="range"
      data-density={available.length >= 4 ? "compact" : "regular"}
    >
      <figcaption>{title}</figcaption>
      <div
        className="observable-analysis-report__ranges"
        role="img"
        aria-label={title}
      >
        {available.map((item) => {
          const minimumPosition = position(item.minimum.value);
          const averagePosition = position(item.average.value);
          const maximumPosition = position(item.maximum.value);
          return (
            <div key={item.key}>
              <strong>{item.label}</strong>
              <div className="observable-analysis-report__range-values">
                <small>最低 {formatMetric(item.minimum.value, unit)}</small>
                <small>平均 {formatMetric(item.average.value, unit)}</small>
                <small>最高 {formatMetric(item.maximum.value, unit)}</small>
              </div>
              <i aria-hidden="true">
                <b
                  style={{
                    left: `${minimumPosition}%`,
                    width: `${Math.max(0, maximumPosition - minimumPosition)}%`,
                  }}
                />
                <em style={{ left: `${averagePosition}%` }} />
              </i>
            </div>
          );
        })}
      </div>
      <div className="observable-analysis-report__trend-table">
        <table aria-label={title}>
          <thead>
            <tr>
              <th>指标</th>
              <th>最低</th>
              <th>平均</th>
              <th>最高</th>
            </tr>
          </thead>
          <tbody>
            {available.map((item) => (
              <tr key={item.key}>
                <th scope="row">{item.label}</th>
                <td>{formatMetric(item.minimum.value, unit)}</td>
                <td>{formatMetric(item.average.value, unit)}</td>
                <td>{formatMetric(item.maximum.value, unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

export function AnalysisGroupedRangeCharts({
  series,
  title,
}: {
  series: readonly AnalysisRangeSeries[];
  title: string;
}) {
  const groups = new Map<string, AnalysisRangeSeries[]>();
  series.forEach((item) => {
    const unit = item.average?.unit;
    if (!unit) return;
    const group = groups.get(unit) ?? [];
    group.push(item);
    groups.set(unit, group);
  });
  const entries = [...groups.entries()];

  if (entries.length === 0) return null;

  return (
    <div
      className="observable-analysis-report__grouped-charts observable-analysis-report__grouped-ranges"
      data-group-count={entries.length}
    >
      {entries.map(([unit, group]) => (
        <AnalysisRangeChart
          key={unit}
          series={group}
          title={entries.length === 1 ? title : `${title}（${unit}）`}
          unit={unit}
        />
      ))}
    </div>
  );
}

export function AnalysisGroupedColumnCharts({
  metrics,
  title,
}: {
  metrics: readonly AnalysisMetric[];
  title: string;
}) {
  const groups = groupAvailableMetricsByUnit(metrics);

  if (groups.length === 0) return null;

  return (
    <div
      className="observable-analysis-report__grouped-charts"
      data-group-count={groups.length}
    >
      {groups.map(([unit, group]) =>
        group.length === 1 ? (
          <AnalysisSingleMetric
            key={unit}
            metric={group[0]}
            title={groups.length === 1 ? title : `${title}（${unit}）`}
          />
        ) : (
          <AnalysisColumnChart
            key={unit}
            metrics={group}
            title={groups.length === 1 ? title : `${title}（${unit}）`}
          />
        ),
      )}
    </div>
  );
}

export function AnalysisGroupedVerticalBarCharts({
  metrics,
  title,
}: {
  metrics: readonly AnalysisMetric[];
  title: string;
}) {
  const groups = groupAvailableMetricsByUnit(metrics);

  if (groups.length === 0) return null;

  return (
    <div
      className="observable-analysis-report__grouped-charts"
      data-group-count={groups.length}
    >
      {groups.map(([unit, group]) =>
        group.length === 1 ? (
          <AnalysisSingleMetric
            key={unit}
            metric={group[0]}
            title={groups.length === 1 ? title : `${title}（${unit}）`}
          />
        ) : (
          <AnalysisVerticalBarChart
            key={unit}
            metrics={group}
            title={groups.length === 1 ? title : `${title}（${unit}）`}
          />
        ),
      )}
    </div>
  );
}

function AnalysisSingleMetric({
  metric,
  title,
}: {
  metric: AnalysisMetric;
  title: string;
}) {
  return (
    <div
      aria-label={`${title}：${metric.label}`}
      className="observable-analysis-report__single-metric"
      data-presentation="single-metric"
    >
      <span>{metric.label}</span>
      <strong>{formatMetric(metric.value, metric.unit)}</strong>
      <small>{metric.sourceCount.toLocaleString("zh-CN")} 条核定来源</small>
    </div>
  );
}

const DONUT_COLORS = ["#287a6f", "#3d78a8", "#9a6642", "#8f3340"];

export function AnalysisDonutChart({
  metrics,
  title,
}: {
  metrics: readonly AnalysisMetric[];
  title: string;
}) {
  const available = metrics.filter(
    (metric) => isAvailableMetric(metric) && Number(metric.value) > 0,
  );
  const total = available.reduce(
    (sum, metric) => sum + Number(metric.value),
    0,
  );

  if (available.length < 2 || total <= 0) return null;
  const segments = available.map((metric, index) => {
    const start = available
      .slice(0, index)
      .reduce((sum, item) => sum + (Number(item.value) / total) * 100, 0);
    const end = start + (Number(metric.value) / total) * 100;
    return `${DONUT_COLORS[index % DONUT_COLORS.length]} ${start.toFixed(4)}% ${end.toFixed(4)}%`;
  });

  return (
    <figure
      className="observable-analysis-report__distribution-chart"
      data-chart-type="distribution"
    >
      <figcaption>{title}</figcaption>
      <div
        aria-label={title}
        className="observable-analysis-report__distribution-layout"
        role="img"
      >
        <i
          aria-hidden="true"
          className="observable-analysis-report__donut"
          style={{ background: `conic-gradient(${segments.join(", ")})` }}
        >
          <span>占比</span>
        </i>
        <dl>
          {available.map((metric, index) => (
            <div key={metric.code}>
              <dt>
                <b
                  aria-hidden="true"
                  style={{
                    backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length],
                  }}
                />
                {metric.label}
              </dt>
              <dd>{formatMetric(metric.value, metric.unit)}</dd>
            </div>
          ))}
        </dl>
      </div>
      <ChartDataTable metrics={available} title={title} />
    </figure>
  );
}

export function hasAvailableMetrics(
  metrics: readonly AnalysisMetric[],
): boolean {
  return metrics.some(isAvailableMetric);
}

function isAvailableMetric(metric: AnalysisMetric): boolean {
  return metric.value !== null && Number.isFinite(Number(metric.value));
}

function groupAvailableMetricsByUnit(
  metrics: readonly AnalysisMetric[],
): [string, AnalysisMetric[]][] {
  const groups = new Map<string, AnalysisMetric[]>();
  metrics.filter(isAvailableMetric).forEach((metric) => {
    const group = groups.get(metric.unit) ?? [];
    group.push(metric);
    groups.set(metric.unit, group);
  });
  return [...groups.entries()];
}

function ChartDataTable({
  metrics,
  title,
}: {
  metrics: readonly AnalysisMetric[];
  title: string;
}) {
  return (
    <div className="observable-analysis-report__trend-table">
      <table aria-label={`${title}数据表`}>
        <thead>
          <tr>
            <th>业务指标</th>
            <th>核定结果</th>
            <th>来源数</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => (
            <tr key={metric.code}>
              <th scope="row">{metric.label}</th>
              <td>{formatMetric(metric.value, metric.unit)}</td>
              <td>{metric.sourceCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function segmentedPath(
  values: readonly { month: number; value: number | null }[],
  x: (month: number) => number,
  y: (value: number) => number,
): string {
  let drawing = false;
  return values
    .flatMap((item) => {
      if (item.value === null) {
        drawing = false;
        return [];
      }
      const command = drawing ? "L" : "M";
      drawing = true;
      return [
        `${command}${x(item.month).toFixed(2)},${y(item.value).toFixed(2)}`,
      ];
    })
    .join(" ");
}

function formatChartValue(value: number): string {
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function formatMetric(
  value: string | null,
  unit: string,
  missingReason: string | null = "暂无核定数据",
): string {
  if (value === null) return missingReason ?? "暂无核定数据";
  return `${Number(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })} ${unit}`;
}
