import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  realtimeApiClient,
  type RealtimeApiClient,
} from "@/platform/api/realtimeApiClient";
import type {
  MasterDataSnapshot,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";

interface SupplyBalanceRow {
  code: string;
  label: string;
  kind: "AUTO" | "MANUAL" | "DERIVED" | "RATIO";
  unit: string;
  requirement: string;
  value: string | null;
  display: string;
  note: string | null;
}

interface SupplyBalanceView {
  regionCode: string;
  regionName: string;
  administrativeLevel: string;
  surveyYear: number;
  productCode: string;
  regionalProductionAvailable: boolean;
  version: number;
  updatedAt: string | null;
  rows: readonly SupplyBalanceRow[];
}

export function SupplyBalanceWorkspace({
  api = realtimeApiClient,
  authorizedRegionCodes,
  repository,
}: {
  api?: RealtimeApiClient;
  authorizedRegionCodes: readonly string[];
  repository: RealtimeBusinessRepository;
}) {
  const [masterData, setMasterData] = useState<MasterDataSnapshot>();
  const [regionCode, setRegionCode] = useState("");
  const [productCode, setProductCode] = useState("CORN");
  const [year, setYear] = useState(new Date().getFullYear());
  const [view, setView] = useState<SupplyBalanceView>();
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [issue, setIssue] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [loadedScopeKey, setLoadedScopeKey] = useState<string>();
  const draftDirty = useRef(false);

  useEffect(() => {
    repository
      .loadMasterData()
      .then((data) => {
        setMasterData(data);
        setYear(data.approvedSurveyYears?.[0] ?? new Date().getFullYear());
        const unrestricted = authorizedRegionCodes.includes("*");
        const region = data.regions.find(
          (candidate) =>
            candidate.level.toUpperCase() === "COUNTY" &&
            (unrestricted ||
              authorizedRegionCodes.includes(candidate.code) ||
              (candidate.parentCode !== null &&
                authorizedRegionCodes.includes(candidate.parentCode))),
        );
        setRegionCode(region?.code ?? "");
      })
      .catch(() => setIssue("地区、年度和品种加载失败，请重试。"));
  }, [authorizedRegionCodes, repository]);

  const regions = useMemo(() => {
    if (!masterData) return [];
    const unrestricted = authorizedRegionCodes.includes("*");
    return masterData.regions.filter(
      (region) =>
        ["PREFECTURE", "COUNTY"].includes(region.level.toUpperCase()) &&
        (unrestricted ||
          authorizedRegionCodes.includes(region.code) ||
          (region.parentCode !== null &&
            authorizedRegionCodes.includes(region.parentCode))),
    );
  }, [authorizedRegionCodes, masterData]);
  const selectedRegion = regions.find((region) => region.code === regionCode);
  const products =
    masterData?.products.filter((product) =>
      ["CORN", "SOYBEAN", "RICE"].includes(product.code),
    ) ?? [];
  const years = masterData?.approvedSurveyYears?.length
    ? masterData.approvedSurveyYears
    : [year];
  const scopeKey = `${regionCode}:${year}:${productCode}`;
  const scopeRef = useRef(scopeKey);
  useLayoutEffect(() => {
    scopeRef.current = scopeKey;
  }, [scopeKey]);
  const scopeLoaded = loadedScopeKey === scopeKey;

  function invalidateLoadedScope() {
    draftDirty.current = false;
    setLoadedScopeKey(undefined);
    setIssue(undefined);
  }

  function accept(next: SupplyBalanceView) {
    draftDirty.current = false;
    setLoadedScopeKey(
      `${next.regionCode}:${next.surveyYear}:${next.productCode}`,
    );
    setView(next);
    setManualValues(
      Object.fromEntries(
        next.rows
          .filter((row) => row.kind === "MANUAL" && row.value !== null)
          .map((row) => [row.code, row.value as string]),
      ),
    );
    setNotes(
      Object.fromEntries(
        next.rows
          .filter((row) => row.note)
          .map((row) => [row.code, row.note as string]),
      ),
    );
  }

  useEffect(() => {
    if (!regionCode || !productCode || !year) return;
    const requestScopeKey = scopeKey;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    const reload = async (eventType?: "REGIONAL" | "SUPPLY") => {
      try {
        const next = await api.get<SupplyBalanceView>(
          "/api/v1/supply-balances",
          {
            regionCode,
            surveyYear: year,
            productCode,
          },
        );
        if (!active || scopeRef.current !== requestScopeKey) return;
        if (
          `${next.regionCode}:${next.surveyYear}:${next.productCode}` !==
          requestScopeKey
        ) {
          setIssue("供需平衡读取失败，请重试。");
          return;
        }
        if (draftDirty.current) {
          if (eventType === "REGIONAL") setView(next);
          setIssue(
            eventType === "SUPPLY"
              ? "当前供需数据已由其他人员更新，现有填写已保留；保存时将进行版本校验。"
              : undefined,
          );
        } else {
          setIssue(undefined);
          accept(next);
        }
      } catch {
        if (active && scopeRef.current === requestScopeKey) {
          setIssue("供需平衡读取失败，请重试。");
        }
      }
    };
    const start = async () => {
      setIssue(undefined);
      const afterSequence = await repository
        .listNotifications()
        .then((notifications) =>
          Math.max(0, ...notifications.items.map((item) => item.sequence)),
        )
        .catch(() => 0);
      if (!active) return;
      unsubscribe = repository.subscribeBusinessEvents(
        afterSequence,
        (event) => {
          const eventType =
            event.aggregateType === "REGIONAL_CROP_ANNUAL_STAT" &&
            event.actionCode === "REGIONAL_CROP_ANNUAL_STAT_UPSERTED"
              ? "REGIONAL"
              : event.aggregateType === "SUPPLY_DEMAND_BALANCE" &&
                  event.actionCode === "SUPPLY_BALANCE_UPSERTED"
                ? "SUPPLY"
                : undefined;
          if (
            eventType &&
            event.productCode === productCode &&
            event.surveyYear === year &&
            event.regionCodes.includes(regionCode)
          ) {
            void reload(eventType);
          }
        },
        () => active && setIssue("实时联动暂时中断，系统正在等待重新连接。"),
      );
      await reload();
    };
    void start();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [api, productCode, regionCode, repository, scopeKey, year]);

  async function save() {
    if (!view || selectedRegion?.level.toUpperCase() !== "COUNTY") return;
    const requestScopeKey = scopeKey;
    if (loadedScopeKey !== requestScopeKey) {
      setIssue("当前地区、年度和品种仍在加载，请稍后再保存。");
      return;
    }
    const requestRegionCode = regionCode;
    const requestYear = year;
    const requestProductCode = productCode;
    setSaving(true);
    setIssue(undefined);
    try {
      const next = await api.put<SupplyBalanceView>(
        `/api/v1/supply-balances/${requestRegionCode}/${requestYear}/${requestProductCode}`,
        {
          version: view.version,
          manualValues: Object.fromEntries(
            Object.entries(manualValues).filter(([, value]) => value !== ""),
          ),
          notes: Object.fromEntries(
            Object.entries(notes).filter(([, value]) => value.trim() !== ""),
          ),
        },
      );
      if (scopeRef.current !== requestScopeKey) return;
      accept(next);
    } catch (error) {
      if (scopeRef.current !== requestScopeKey) return;
      setIssue(
        typeof error === "object" &&
          error !== null &&
          "status" in error &&
          error.status === 409
          ? "数据已由其他人员更新，请重新选择地区后继续。"
          : "保存失败，当前填写内容已保留，请重试。",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="regional-data-workspace" aria-label="供需平衡">
      <header>
        <div>
          <p>供需分析 / 年度平衡</p>
          <h2>供需平衡</h2>
          <span>
            按品种展示固定表格；面积、单产、总产和派生项由系统计算，其余项目一次填报、保存后立即生效。
          </span>
        </div>
      </header>
      <div className="regional-data-workspace__filters">
        <label>
          地区
          <select
            aria-label="供需地区"
            value={regionCode}
            onChange={(event) => {
              invalidateLoadedScope();
              setRegionCode(event.target.value);
            }}
          >
            {regions.map((region) => (
              <option key={region.code} value={region.code}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          年度
          <select
            aria-label="供需年度"
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
            aria-label="供需品种"
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
      {!issue && regionCode && productCode && year && !scopeLoaded && (
        <p className="regional-data-workspace__notice" role="status">
          当前地区、年度和品种正在加载，请稍候。
        </p>
      )}
      {scopeLoaded && view && !view.regionalProductionAvailable && (
        <p className="regional-data-workspace__notice">
          当前地区、年度和品种尚未填报地区产情，面积、单产和总产暂不显示。
        </p>
      )}
      <div className="regional-data-workspace__table-wrap">
        <table>
          <thead>
            <tr>
              <th>项目</th>
              <th>口径</th>
              <th>数值</th>
              <th>单位</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            {(scopeLoaded ? view?.rows : undefined)?.map((row) => (
              <tr key={row.code}>
                <th scope="row">{row.label}</th>
                <td>{row.requirement}</td>
                <td>
                  {row.kind === "MANUAL" &&
                  selectedRegion?.level.toUpperCase() === "COUNTY" ? (
                    <input
                      aria-label={`${row.label}填报值`}
                      min="0"
                      step="0.0001"
                      type="number"
                      value={manualValues[row.code] ?? ""}
                      onChange={(event) => {
                        draftDirty.current = true;
                        setManualValues((current) => ({
                          ...current,
                          [row.code]: event.target.value,
                        }));
                      }}
                    />
                  ) : (
                    row.display
                  )}
                </td>
                <td>{row.unit}</td>
                <td>
                  {row.kind === "MANUAL" &&
                  selectedRegion?.level.toUpperCase() === "COUNTY" ? (
                    <input
                      aria-label={`${row.label}说明`}
                      value={notes[row.code] ?? ""}
                      onChange={(event) => {
                        draftDirty.current = true;
                        setNotes((current) => ({
                          ...current,
                          [row.code]: event.target.value,
                        }));
                      }}
                    />
                  ) : (
                    (row.note ?? "—")
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="regional-data-workspace__actions">
        <button
          disabled={
            !scopeLoaded ||
            saving ||
            selectedRegion?.level.toUpperCase() !== "COUNTY"
          }
          type="button"
          onClick={() => void save()}
        >
          {saving ? "保存中" : "保存供需平衡"}
        </button>
        {selectedRegion?.level.toUpperCase() === "PREFECTURE" && (
          <span>地级市为区县自动汇总，只读展示。</span>
        )}
      </div>
    </section>
  );
}
