import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  fixedDecimal,
  multiplyFixedDecimal,
} from "@/business/core/fixedDecimal";
import {
  realtimeApiClient,
  type RealtimeApiClient,
} from "@/platform/api/realtimeApiClient";
import type {
  MasterDataSnapshot,
  MasterRegion,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";

interface RegionalAnnualStat {
  regionCode: string;
  regionName: string;
  prefectureCode: string;
  dataYear: number;
  productCode: string;
  plantedAreaMu: string | null;
  yieldPerMuKg: string | null;
  totalOutputKg: string | null;
  version: number;
  updatedAt: string | null;
}

interface CountyDraft {
  areaWanMu: string;
  yieldPerMuKg: string;
  dirty: boolean;
  stat?: RegionalAnnualStat;
}

interface RegionalSummary {
  regionCode: string;
  regionName: string;
  administrativeLevel: string;
  year: number;
  productCode: string;
  plantedAreaMu: string | null;
  yieldPerMuKg: string | null;
  totalOutputKg: string | null;
  currentDataAvailable: boolean;
}

function isAuthorized(
  region: MasterRegion,
  authorizedRegionCodes: readonly string[],
): boolean {
  return (
    authorizedRegionCodes.includes("*") ||
    authorizedRegionCodes.includes(region.code) ||
    (region.parentCode !== null &&
      authorizedRegionCodes.includes(region.parentCode))
  );
}

function decimal(value: string | null | undefined, divisor = 1): string {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value) / divisor;
  return Number.isFinite(number)
    ? number.toLocaleString("zh-CN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "—";
}

function previewTotalOutputKg(draft: CountyDraft): string | null {
  if (!draft.areaWanMu || !draft.yieldPerMuKg) return null;
  const totalOutputKg =
    Number(draft.areaWanMu) * 10_000 * Number(draft.yieldPerMuKg);
  return Number.isFinite(totalOutputKg) && totalOutputKg >= 0
    ? String(totalOutputKg)
    : null;
}

export function RegionalAnnualProductionWorkspace({
  api = realtimeApiClient,
  authorizedRegionCodes,
  repository,
}: {
  api?: RealtimeApiClient;
  authorizedRegionCodes: readonly string[];
  repository: RealtimeBusinessRepository;
}) {
  const [masterData, setMasterData] = useState<MasterDataSnapshot>();
  const [prefectureCode, setPrefectureCode] = useState("");
  const [productCode, setProductCode] = useState("CORN");
  const [year, setYear] = useState(new Date().getFullYear());
  const [drafts, setDrafts] = useState<Record<string, CountyDraft>>({});
  const [prefectureSummary, setPrefectureSummary] = useState<RegionalSummary>();
  const [issue, setIssue] = useState<string>();
  const [savingRegionCode, setSavingRegionCode] = useState<string>();
  const [loadedScopeKey, setLoadedScopeKey] = useState<string>();

  useEffect(() => {
    let active = true;
    repository
      .loadMasterData()
      .then((next) => {
        if (!active) return;
        setMasterData(next);
        setYear(next.approvedSurveyYears?.[0] ?? new Date().getFullYear());
        const first = next.regions.find(
          (region) =>
            region.level.toUpperCase() === "PREFECTURE" &&
            isAuthorized(region, authorizedRegionCodes),
        );
        setPrefectureCode(first?.code ?? "");
      })
      .catch(() => active && setIssue("地区、年度和品种加载失败，请重试。"));
    return () => {
      active = false;
    };
  }, [authorizedRegionCodes, repository]);

  const prefectures = useMemo(
    () =>
      masterData?.regions.filter(
        (region) =>
          region.level.toUpperCase() === "PREFECTURE" &&
          isAuthorized(region, authorizedRegionCodes),
      ) ?? [],
    [authorizedRegionCodes, masterData],
  );
  const counties = useMemo(
    () =>
      masterData?.regions.filter(
        (region) =>
          region.level.toUpperCase() === "COUNTY" &&
          region.parentCode === prefectureCode &&
          isAuthorized(region, authorizedRegionCodes),
      ) ?? [],
    [authorizedRegionCodes, masterData, prefectureCode],
  );
  const products =
    masterData?.products.filter((product) =>
      ["CORN", "SOYBEAN", "RICE"].includes(product.code),
    ) ?? [];
  const years = masterData?.approvedSurveyYears?.length
    ? masterData.approvedSurveyYears
    : [year];
  const scopeKey = `${prefectureCode}:${year}:${productCode}`;
  const scopeRef = useRef(scopeKey);
  useLayoutEffect(() => {
    scopeRef.current = scopeKey;
  }, [scopeKey]);
  const scopeLoaded = loadedScopeKey === scopeKey;

  function invalidateLoadedScope() {
    setLoadedScopeKey(undefined);
    setIssue(undefined);
  }

  useEffect(() => {
    if (!prefectureCode || !productCode || !year) return;
    const requestScopeKey = scopeKey;
    let active = true;
    Promise.all([
      api.get<RegionalAnnualStat[]>(
        "/api/v1/production/regional-annual-stats",
        {
          year,
          productCode,
          prefectureCode,
        },
      ),
      api.get<RegionalSummary>("/api/v1/overview/regional-crop-summary", {
        year,
        productCode,
        regionCode: prefectureCode,
      }),
    ])
      .then(([stats, summary]) => {
        if (!active || scopeRef.current !== requestScopeKey) return;
        setIssue(undefined);
        setPrefectureSummary(summary);
        const byRegion = new Map(stats.map((stat) => [stat.regionCode, stat]));
        setDrafts(
          Object.fromEntries(
            counties.map((county) => {
              const stat = byRegion.get(county.code);
              const persistedStat = stat?.updatedAt ? stat : undefined;
              return [
                county.code,
                {
                  areaWanMu: stat?.plantedAreaMu
                    ? String(Number(stat.plantedAreaMu) / 10_000)
                    : "",
                  yieldPerMuKg: stat?.yieldPerMuKg ?? "",
                  dirty: false,
                  ...(persistedStat ? { stat: persistedStat } : {}),
                },
              ];
            }),
          ),
        );
        setLoadedScopeKey(requestScopeKey);
      })
      .catch(() => {
        if (active && scopeRef.current === requestScopeKey) {
          setIssue("地区产情读取失败，请重试。");
        }
      });
    return () => {
      active = false;
    };
  }, [api, counties, prefectureCode, productCode, scopeKey, year]);

  function updateDraft(regionCode: string, patch: Partial<CountyDraft>) {
    setDrafts((current) => {
      const existing = current[regionCode] ?? {
        areaWanMu: "",
        yieldPerMuKg: "",
        dirty: false,
      };
      return {
        ...current,
        [regionCode]: {
          ...existing,
          ...patch,
          dirty: patch.dirty ?? true,
        },
      };
    });
  }

  async function save(county: MasterRegion) {
    const draft = drafts[county.code];
    if (!draft?.areaWanMu) {
      setIssue("播种面积必须填写；单产可在正式数据出来后补填。");
      return;
    }
    const requestScopeKey = scopeKey;
    if (loadedScopeKey !== requestScopeKey) {
      setIssue("当前地区、年度和品种仍在加载，请稍后再保存。");
      return;
    }
    const requestYear = year;
    const requestProductCode = productCode;
    const requestPrefectureCode = prefectureCode;
    setSavingRegionCode(county.code);
    setIssue(undefined);
    try {
      const stat = await api.put<RegionalAnnualStat>(
        `/api/v1/production/regional-annual-stats/${county.code}`,
        {
          dataYear: requestYear,
          productCode: requestProductCode,
          plantedAreaMu: multiplyFixedDecimal(
            fixedDecimal(draft.areaWanMu),
            fixedDecimal("10000"),
          ),
          yieldPerMuKg: draft.yieldPerMuKg || null,
          expectedVersion: draft.stat?.version ?? 0,
        },
      );
      if (scopeRef.current !== requestScopeKey) return;
      updateDraft(county.code, {
        areaWanMu: String(Number(stat.plantedAreaMu) / 10_000),
        yieldPerMuKg: stat.yieldPerMuKg ?? "",
        dirty: false,
        stat,
      });
      try {
        const summary = await api.get<RegionalSummary>(
          "/api/v1/overview/regional-crop-summary",
          {
            year: requestYear,
            productCode: requestProductCode,
            regionCode: requestPrefectureCode,
          },
        );
        if (scopeRef.current === requestScopeKey) {
          setPrefectureSummary(summary);
        }
      } catch {
        if (scopeRef.current === requestScopeKey) {
          setIssue("数据已保存，市级汇总刷新失败，请稍后重试。");
        }
      }
    } catch (error) {
      if (scopeRef.current !== requestScopeKey) return;
      setIssue(
        typeof error === "object" &&
          error !== null &&
          "status" in error &&
          error.status === 409
          ? "数据已由其他人员更新，请刷新后再填写。"
          : "保存失败，当前填写内容已保留，请重试。",
      );
    } finally {
      setSavingRegionCode(undefined);
    }
  }

  return (
    <section className="regional-data-workspace" aria-label="地区产情填报">
      <header>
        <div>
          <p>产情监测 / 地区年度数据</p>
          <h2>地区产情填报</h2>
          <span>
            可先保存播种面积，单产正式数据出来后再补填；总产在单产填报后由系统自动计算，同年度同地区同品种再次保存即更新当前值并保留历史。
          </span>
        </div>
      </header>
      <div className="regional-data-workspace__filters">
        <label>
          地级市
          <select
            aria-label="地区产情地级市"
            value={prefectureCode}
            onChange={(event) => {
              invalidateLoadedScope();
              setPrefectureCode(event.target.value);
            }}
          >
            {prefectures.map((region) => (
              <option key={region.code} value={region.code}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          年度
          <select
            aria-label="地区产情年度"
            value={year}
            onChange={(event) => {
              invalidateLoadedScope();
              setYear(Number(event.target.value));
            }}
          >
            {years.map((item) => (
              <option key={item} value={item}>
                {item}年
              </option>
            ))}
          </select>
        </label>
        <label>
          品种
          <select
            aria-label="地区产情品种"
            value={productCode}
            onChange={(event) => {
              invalidateLoadedScope();
              setProductCode(event.target.value);
            }}
          >
            {products.map((product) => (
              <option key={product.code} value={product.code}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {issue && (
        <p className="regional-data-workspace__issue" role="alert">
          {issue}
        </p>
      )}
      {!issue && prefectureCode && productCode && year && !scopeLoaded && (
        <p className="regional-data-workspace__notice" role="status">
          当前地区、年度和品种正在加载，请稍候。
        </p>
      )}
      <div className="regional-data-workspace__table-wrap">
        <table>
          <thead>
            <tr>
              <th>区县</th>
              <th>播种面积（万亩）</th>
              <th>单产（公斤/亩）</th>
              <th>总产（万吨）</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {scopeLoaded && prefectureSummary && (
              <tr className="regional-data-workspace__summary-row">
                <th scope="row">{prefectureSummary.regionName}（市级汇总）</th>
                <td>{decimal(prefectureSummary.plantedAreaMu, 10_000)}</td>
                <td>{decimal(prefectureSummary.yieldPerMuKg)}</td>
                <td>{decimal(prefectureSummary.totalOutputKg, 10_000_000)}</td>
                <td>系统汇总</td>
              </tr>
            )}
            {counties.map((county) => {
              const draft = (scopeLoaded ? drafts[county.code] : undefined) ?? {
                areaWanMu: "",
                yieldPerMuKg: "",
                dirty: false,
              };
              return (
                <tr key={county.code}>
                  <th scope="row">{county.name}</th>
                  <td>
                    <input
                      aria-label={`${county.name}播种面积`}
                      disabled={!scopeLoaded}
                      min="0"
                      step="0.0001"
                      type="number"
                      value={draft.areaWanMu}
                      onChange={(event) =>
                        updateDraft(county.code, {
                          areaWanMu: event.target.value,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`${county.name}单产`}
                      disabled={!scopeLoaded}
                      min="0"
                      step="0.0001"
                      type="number"
                      placeholder="可后补"
                      value={draft.yieldPerMuKg}
                      onChange={(event) =>
                        updateDraft(county.code, {
                          yieldPerMuKg: event.target.value,
                        })
                      }
                    />
                  </td>
                  <td>
                    {decimal(
                      draft.dirty
                        ? previewTotalOutputKg(draft)
                        : draft.stat?.totalOutputKg,
                      10_000_000,
                    )}
                  </td>
                  <td>
                    <span>
                      {draft.dirty
                        ? "待保存"
                        : draft.stat
                          ? "已保存"
                          : "未填写"}
                    </span>
                    <button
                      aria-label={`保存${county.name}`}
                      disabled={!scopeLoaded || savingRegionCode !== undefined}
                      type="button"
                      onClick={() => void save(county)}
                    >
                      {savingRegionCode === county.code ? "保存中" : "保存"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
