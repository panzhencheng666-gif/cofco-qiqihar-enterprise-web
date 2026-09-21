import { ChartDataTable } from "./ObservableAnalysisReport";
import type { AnalysisMetric } from "./ObservableAnalysisReport";
function value(metric?: AnalysisMetric) {
  return metric?.value != null && Number.isFinite(Number(metric.value))
    ? Number(metric.value)
    : null;
}
function label(metric?: AnalysisMetric) {
  const n = value(metric);
  return n === null
    ? "暂无数据"
    : `${n.toLocaleString("zh-CN", { maximumFractionDigits: 2 })} ${metric?.unit ?? ""}`;
}
export function HarvestFocus({
  rate,
  area,
  harvest,
  output,
}: {
  rate?: AnalysisMetric;
  area?: AnalysisMetric;
  harvest?: AnalysisMetric;
  output?: AnalysisMetric;
}) {
  const percent = value(rate);
  const valid = percent !== null && percent >= 0 && percent <= 100;
  return (
    <div className="analysis-harvest-focus">
      <figure>
        <svg
          viewBox="0 0 260 250"
          role="img"
          aria-label={`预计收获率：${label(rate)}`}
        >
          <circle
            cx="130"
            cy="122"
            r="92"
            fill="none"
            stroke="#edf3f7"
            strokeWidth="14"
          />
          {valid && (
            <circle
              cx="130"
              cy="122"
              r="92"
              fill="none"
              stroke="#329caa"
              strokeWidth="14"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray={`${percent} 100`}
              transform="rotate(-90 130 122)"
            />
          )}
          <text x="130" y="116" textAnchor="middle" className="focus-number">
            {percent === null ? "—" : `${percent.toFixed(2)}%`}
          </text>
          <text x="130" y="145" textAnchor="middle" className="focus-caption">
            预计收获率
          </text>
        </svg>
        <figcaption>本期生产规模与收获预期</figcaption>
      </figure>
      <dl>
        {[area, harvest, output]
          .filter((m): m is AnalysisMetric => Boolean(m))
          .map((m) => (
            <div key={m.code}>
              <dt>{m.label}</dt>
              <dd>{label(m)}</dd>
              <small>{m.sourceCount} 条采用记录</small>
            </div>
          ))}
      </dl>
      <ChartDataTable
        metrics={[area, harvest, output].filter((m): m is AnalysisMetric =>
          Boolean(m),
        )}
        title="面积结构对比"
      />
    </div>
  );
}
export function PriceFocus({
  purchase,
  sale,
  spread,
}: {
  purchase?: AnalysisMetric;
  sale?: AnalysisMetric;
  spread?: AnalysisMetric;
}) {
  const a = value(purchase),
    b = value(sale);
  const max = Math.max(a ?? 0, b ?? 0, 1);
  const y = (n: number) => 180 - (n / max) * 95;
  return (
    <figure
      className="analysis-price-focus"
      role="group"
      aria-label="购销价格差异"
      data-chart-type="difference"
    >
      <figcaption>
        本期购销价格对照{" "}
        <span>单位：{purchase?.unit ?? sale?.unit ?? "元/吨"}</span>
      </figcaption>
      <svg
        viewBox="0 0 650 225"
        role="img"
        aria-label={`收购价格 ${label(purchase)}，销售价格 ${label(sale)}`}
      >
        <line x1="90" x2="560" y1="180" y2="180" stroke="#dbe5ed" />
        {a !== null && b !== null && (
          <>
            <path
              d={`M130 ${y(a)} L520 ${y(b)} L520 180 L130 180 Z`}
              fill="#e6f3f6"
            />
            <line
              x1="130"
              y1={y(a)}
              x2="520"
              y2={y(b)}
              stroke="#379aaa"
              strokeWidth="3"
            />
          </>
        )}
        {[
          [a, 130, "平均收购价格"],
          [b, 520, "平均销售价格"],
        ].map(([n, x, t]) => (
          <g key={String(t)}>
            {n !== null && (
              <>
                <circle cx={Number(x)} cy={y(Number(n))} r="7" fill="#287a9f" />
                <text
                  x={Number(x)}
                  y={y(Number(n)) - 20}
                  textAnchor="middle"
                  className="focus-number"
                >
                  {Number(n).toLocaleString("zh-CN", {
                    maximumFractionDigits: 2,
                  })}
                </text>
              </>
            )}
            <text
              x={Number(x)}
              y="210"
              textAnchor="middle"
              className="focus-caption"
            >
              {String(t)}
            </text>
          </g>
        ))}
      </svg>
      <ChartDataTable
        metrics={[purchase, sale, spread].filter((m): m is AnalysisMetric =>
          Boolean(m),
        )}
        title="购销价格差异"
      />
      <div className="analysis-price-spread">
        <span>平均购销价差</span>
        <strong>{label(spread)}</strong>
        <small>本期价格对照，不代表时间趋势或利润</small>
      </div>
    </figure>
  );
}
