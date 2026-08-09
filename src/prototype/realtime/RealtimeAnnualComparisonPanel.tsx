import { useEffect, useMemo, useState } from "react";

import {
  realtimeBusinessRepository,
  type AnnualComparisonView,
  type MasterCultivar,
  type MasterDataSnapshot,
  type RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";

type AnalysisDomain = "production" | "market";

const indicators = {
  production: [
    { code: "PRODUCTION_CULTIVATED_AREA", label: "种植面积" },
    { code: "PRODUCTION_ESTIMATED_OUTPUT", label: "预计总产量" },
  ],
  market: [{ code: "MARKET_AVERAGE_TRADE_PRICE", label: "平均成交价" }],
} as const;

const chartColors = ["#7c9fb4", "#3b8cab", "#126f99", "#e0a62e"] as const;

function missingLabel(reason: string | null): string {
  if (reason === "NO_APPROVED_RECORDS") return "暂无已核定数据";
  return "暂无同口径数据";
}

function value(point: AnnualComparisonView["points"][number]): number | null {
  if (point.value === null || point.value === "") return null;
  const parsed = Number(point.value);
  return Number.isFinite(parsed) ? parsed : null;
}

function change(current: number | null, previous: number | null): string {
  if (current === null || previous === null) return "不可比较";
  if (previous === 0) return current === 0 ? "持平" : "基期为零";
  const rate = ((current - previous) / previous) * 100;
  if (Math.abs(rate) < 0.05) return "持平";
  return `${rate > 0 ? "+" : ""}${rate.toFixed(1)}%`;
}

export function RealtimeAnnualComparisonPanel({
  domain,
  repository = realtimeBusinessRepository,
}: {
  domain: AnalysisDomain;
  repository?: RealtimeBusinessRepository;
}) {
  const indicatorOptions = indicators[domain];
  const [master, setMaster] = useState<MasterDataSnapshot | null>(null);
  const [cultivars, setCultivars] = useState<readonly MasterCultivar[]>([]);
  const [productCode, setProductCode] = useState("CORN");
  const [regionCode, setRegionCode] = useState("230200");
  const [periodCode, setPeriodCode] = useState("2026-W32");
  const [cultivarCode, setCultivarCode] = useState("");
  const [indicatorCode, setIndicatorCode] = useState(
    indicatorOptions[0].code as string,
  );
  const [comparison, setComparison] = useState<AnnualComparisonView | null>(
    null,
  );
  const [activeYear, setActiveYear] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void repository
      .loadMasterData()
      .then((nextMaster) => {
        if (cancelled) return;
        setMaster(nextMaster);
        setProductCode(nextMaster.products[0]?.code ?? "CORN");
        setRegionCode(nextMaster.regions[0]?.code ?? "230200");
        setPeriodCode(nextMaster.periods[0]?.code ?? "2026-W32");
      })
      .catch(() => {
        if (!cancelled) setError("分析筛选项暂时无法读取，请稍后重试。");
      });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  useEffect(() => {
    let cancelled = false;
    void repository
      .listCultivars(productCode)
      .then((nextCultivars) => {
        if (!cancelled) setCultivars(nextCultivars);
      })
      .catch(() => {
        if (!cancelled) setCultivars([]);
      });
    return () => {
      cancelled = true;
    };
  }, [productCode, repository]);

  useEffect(() => {
    if (!master || !productCode || !regionCode || !periodCode) return;
    let cancelled = false;
    void repository
      .loadAnnualComparison({
        productCode,
        ...(cultivarCode ? { cultivarCode } : {}),
        regionCode,
        periodCode,
        indicatorCode,
      })
      .then((nextComparison) => {
        if (!cancelled) {
          setComparison(nextComparison);
          setActiveYear(nextComparison.points[0]?.businessYear ?? "");
        }
      })
      .catch(() => {
        if (!cancelled)
          setError("当前范围的年度对比暂时无法读取，请稍后重试。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    cultivarCode,
    indicatorCode,
    master,
    periodCode,
    productCode,
    regionCode,
    repository,
  ]);

  const chronologicalPoints = useMemo(
    () => [...(comparison?.points ?? [])].reverse(),
    [comparison],
  );
  const numericValues = chronologicalPoints
    .map(value)
    .filter((item): item is number => item !== null);
  const maximum = Math.max(...numericValues, 1);
  const total = numericValues.reduce((sum, item) => sum + item, 0);
  const activeIndex = Math.max(
    0,
    chronologicalPoints.findIndex((point) => point.businessYear === activeYear),
  );
  const activePoint = chronologicalPoints[activeIndex];
  const activeValue = activePoint ? value(activePoint) : null;
  const activePrevious =
    activeIndex > 0 ? value(chronologicalPoints[activeIndex - 1]) : null;
  const linePoints = chronologicalPoints.map((point, index) => ({
    point,
    pointValue: value(point),
    x: 44 + index * (312 / Math.max(chronologicalPoints.length - 1, 1)),
    y: 164 - ((value(point) ?? 0) / maximum) * 116,
  }));
  const linePath = linePoints
    .filter(({ pointValue }) => pointValue !== null)
    .map(({ x, y }) => `${x},${y}`)
    .join(" ");
  const circumference = 2 * Math.PI * 48;

  function changeAnalysisScope(action: () => void): void {
    action();
    setLoading(true);
    setError("");
    setComparison(null);
  }

  return (
    <div className="enterprise-ledger-workbench realtime-annual-analysis">
      <div className="enterprise-ledger-workbench__breadcrumb">
        {domain === "production"
          ? "产情监测 / 产情分析"
          : "市场监测 / 市场分析"}
      </div>
      <header className="enterprise-ledger-title">
        <h1>
          {domain === "production" ? "产情年度对比分析" : "市场年度对比分析"}
        </h1>
        <p>当前年度与前三年同地区、同品种、同口径已核定数据对比</p>
      </header>

      <section
        className="enterprise-ledger-query"
        aria-label="年度对比筛选条件"
        role="search"
      >
        <label>
          <span>产品品种</span>
          <select
            aria-label="产品品种"
            value={productCode}
            onChange={(event) =>
              changeAnalysisScope(() => {
                setProductCode(event.target.value);
                setCultivarCode("");
              })
            }
          >
            {master?.products.map((product) => (
              <option key={product.code} value={product.code}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>具体品种</span>
          <select
            aria-label="具体品种"
            value={cultivarCode}
            onChange={(event) =>
              changeAnalysisScope(() => setCultivarCode(event.target.value))
            }
          >
            <option value="">全部具体品种</option>
            {cultivars.map((cultivar) => (
              <option key={cultivar.code} value={cultivar.code}>
                {cultivar.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>统计地区</span>
          <select
            aria-label="统计地区"
            value={regionCode}
            onChange={(event) =>
              changeAnalysisScope(() => setRegionCode(event.target.value))
            }
          >
            {master?.regions.map((region) => (
              <option key={region.code} value={region.code}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>统计时间</span>
          <select
            aria-label="统计时间"
            value={periodCode}
            onChange={(event) =>
              changeAnalysisScope(() => setPeriodCode(event.target.value))
            }
          >
            {master?.periods.map((period) => (
              <option key={period.code} value={period.code}>
                {period.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>分析指标</span>
          <select
            aria-label="分析指标"
            value={indicatorCode}
            onChange={(event) =>
              changeAnalysisScope(() => setIndicatorCode(event.target.value))
            }
          >
            {indicatorOptions.map((indicator) => (
              <option key={indicator.code} value={indicator.code}>
                {indicator.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error && (
        <div className="market-task6-alert" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <p className="realtime-business-empty" role="status">
          正在形成四年对比分析……
        </p>
      ) : comparison ? (
        <section
          className="realtime-annual-analysis__result"
          aria-label="四年同比分析结果"
        >
          <header>
            <div>
              <h2>{comparison.indicatorName}</h2>
              <p>单位：{comparison.unitCode}</p>
            </div>
            <strong>当前年度与前三年</strong>
          </header>
          {activePoint && (
            <div
              aria-label="当前图表数据"
              className="realtime-annual-analysis__active"
              role="status"
            >
              <strong>{activePoint.businessYear}年</strong>
              <span>
                {activeValue === null
                  ? missingLabel(activePoint.missingReason)
                  : `${activeValue.toLocaleString()} ${comparison.unitCode}`}
              </span>
              <small>
                {activeIndex === 0
                  ? "对比基期"
                  : `较上年 ${change(activeValue, activePrevious)}`}
              </small>
            </div>
          )}
          <div
            className="realtime-annual-analysis__bars"
            role="img"
            aria-label={`${comparison.indicatorName}四年对比柱状图`}
          >
            {chronologicalPoints.map((point, index) => {
              const pointValue = value(point);
              const previous =
                index > 0 ? value(chronologicalPoints[index - 1]) : null;
              return (
                <button
                  aria-label={`柱状图 ${point.businessYear}年 ${pointValue === null ? missingLabel(point.missingReason) : `${pointValue.toLocaleString()} ${comparison.unitCode}`}`}
                  className={`realtime-annual-analysis__bar${activeYear === point.businessYear ? " is-active" : ""}`}
                  key={point.businessYear}
                  onFocus={() => setActiveYear(point.businessYear)}
                  onMouseEnter={() => setActiveYear(point.businessYear)}
                  type="button"
                >
                  <span>
                    {pointValue === null
                      ? missingLabel(point.missingReason)
                      : `${pointValue.toLocaleString()} ${comparison.unitCode}`}
                  </span>
                  <i
                    style={{
                      height:
                        pointValue === null
                          ? "4px"
                          : `${Math.max(8, (pointValue / maximum) * 180)}px`,
                    }}
                  />
                  <strong>{point.businessYear}年</strong>
                  <small>
                    {index === 0
                      ? "对比基期"
                      : `同比 ${change(pointValue, previous)}`}
                  </small>
                </button>
              );
            })}
          </div>
          <div className="realtime-annual-analysis__secondary">
            <figure>
              <figcaption>
                <strong>四年变化趋势</strong>
                <span>悬停或聚焦数据点查看当年明细</span>
              </figcaption>
              <div className="realtime-annual-analysis__line-frame">
                <svg
                  aria-label={`${comparison.indicatorName}四年趋势折线图`}
                  role="img"
                  viewBox="0 0 400 190"
                >
                  <line
                    className="realtime-annual-analysis__axis"
                    x1="32"
                    x2="378"
                    y1="164"
                    y2="164"
                  />
                  <polyline
                    className="realtime-annual-analysis__line"
                    points={linePath}
                  />
                  {linePoints.map(({ point, pointValue, x, y }) => (
                    <circle
                      className={
                        activeYear === point.businessYear ? "is-active" : ""
                      }
                      cx={x}
                      cy={pointValue === null ? 164 : y}
                      key={point.businessYear}
                      r={activeYear === point.businessYear ? 7 : 5}
                    />
                  ))}
                </svg>
                {linePoints.map(({ point, pointValue, x, y }) => (
                  <button
                    aria-label={`折线图 ${point.businessYear}年 ${pointValue === null ? missingLabel(point.missingReason) : `${pointValue.toLocaleString()} ${comparison.unitCode}`}`}
                    className="realtime-annual-analysis__line-hit"
                    key={point.businessYear}
                    onFocus={() => setActiveYear(point.businessYear)}
                    onMouseEnter={() => setActiveYear(point.businessYear)}
                    style={{
                      left: `${(x / 400) * 100}%`,
                      top: `${((pointValue === null ? 164 : y) / 190) * 100}%`,
                    }}
                    type="button"
                  />
                ))}
                <div className="realtime-annual-analysis__line-years">
                  {chronologicalPoints.map((point) => (
                    <span key={point.businessYear}>{point.businessYear}</span>
                  ))}
                </div>
              </div>
            </figure>
            <figure>
              <figcaption>
                <strong>四年合计占比</strong>
                <span>各年度数值占四年合计的比例</span>
              </figcaption>
              <div className="realtime-annual-analysis__donut-layout">
                <svg
                  aria-label={`${comparison.indicatorName}四年合计占比环图`}
                  className="realtime-annual-analysis__donut"
                  role="img"
                  viewBox="0 0 132 132"
                >
                  <circle
                    className="realtime-annual-analysis__donut-track"
                    cx="66"
                    cy="66"
                    r="48"
                  />
                  {chronologicalPoints.map((point, index) => {
                    const pointValue = value(point) ?? 0;
                    const length =
                      total > 0 ? (pointValue / total) * circumference : 0;
                    const offset = chronologicalPoints
                      .slice(0, index)
                      .reduce(
                        (sum, previousPoint) =>
                          sum +
                          (total > 0
                            ? ((value(previousPoint) ?? 0) / total) *
                              circumference
                            : 0),
                        0,
                      );
                    return (
                      <circle
                        className={
                          activeYear === point.businessYear ? "is-active" : ""
                        }
                        cx="66"
                        cy="66"
                        key={point.businessYear}
                        onFocus={() => setActiveYear(point.businessYear)}
                        onMouseEnter={() => setActiveYear(point.businessYear)}
                        r="48"
                        role="button"
                        stroke={chartColors[index]}
                        strokeDasharray={`${length} ${circumference - length}`}
                        strokeDashoffset={-offset}
                        tabIndex={0}
                        aria-label={`环图 ${point.businessYear}年 ${total > 0 ? `${((pointValue / total) * 100).toFixed(1)}%` : "暂无占比"}`}
                      />
                    );
                  })}
                  <text x="66" y="61">
                    当前选择
                  </text>
                  <text
                    className="realtime-annual-analysis__donut-value"
                    x="66"
                    y="80"
                  >
                    {activeValue === null || total === 0
                      ? "—"
                      : `${((activeValue / total) * 100).toFixed(1)}%`}
                  </text>
                </svg>
                <div className="realtime-annual-analysis__legend">
                  {chronologicalPoints.map((point, index) => (
                    <button
                      className={
                        activeYear === point.businessYear ? "is-active" : ""
                      }
                      key={point.businessYear}
                      onFocus={() => setActiveYear(point.businessYear)}
                      onMouseEnter={() => setActiveYear(point.businessYear)}
                      type="button"
                    >
                      <i style={{ backgroundColor: chartColors[index] }} />
                      <span>{point.businessYear}年</span>
                      <strong>
                        {value(point) === null || total === 0
                          ? "—"
                          : `${(((value(point) ?? 0) / total) * 100).toFixed(1)}%`}
                      </strong>
                    </button>
                  ))}
                </div>
              </div>
            </figure>
          </div>
          <div className="realtime-supply-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>年度</th>
                  <th>核定值</th>
                  <th>与上年同比</th>
                  <th>数据截止</th>
                </tr>
              </thead>
              <tbody>
                {chronologicalPoints.map((point, index) => {
                  const pointValue = value(point);
                  const previous =
                    index > 0 ? value(chronologicalPoints[index - 1]) : null;
                  return (
                    <tr key={point.businessYear}>
                      <td>{point.businessYear}年</td>
                      <td>
                        {pointValue === null
                          ? missingLabel(point.missingReason)
                          : `${pointValue.toLocaleString()} ${comparison.unitCode}`}
                      </td>
                      <td>
                        {index === 0 ? "基期" : change(pointValue, previous)}
                      </td>
                      <td>
                        {point.dataCutoff
                          ? new Date(point.dataCutoff).toLocaleDateString(
                              "zh-CN",
                            )
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <p className="realtime-business-empty">
          当前范围尚无可比较的已核定数据。
        </p>
      )}
    </div>
  );
}
