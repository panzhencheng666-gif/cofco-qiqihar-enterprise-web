import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type {
  EligibleFormalSample,
  FormalSampleCoordinateSource,
  FormalSampleObservationDomain,
  FormalSampleObservationHistoryItem,
  LogisticsDefinition,
  MarketDefinition,
  MasterObjectType,
  MasterRegion,
  ProductionDefinition,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";
import { productionPayloadFromValues } from "../realtime/realtimeRecordFormModel";
import {
  observationFieldLabel,
  observationFields,
  type ObservationField,
} from "./formalSampleObservationFields";

type ValueMap = Record<string, string>;
type PageMode = "LEDGER" | "UPDATE";

interface CoordinateChangeDraft {
  longitude: string;
  latitude: string;
  source: FormalSampleCoordinateSource | "";
  collectedAt: string;
  verifiedAddress: string;
  changeReason: string;
  evidenceReference: string;
}

const emptyCoordinateChange: CoordinateChangeDraft = {
  longitude: "",
  latitude: "",
  source: "",
  collectedAt: "",
  verifiedAddress: "",
  changeReason: "",
  evidenceReference: "",
};

const coordinateSources: readonly {
  value: FormalSampleCoordinateSource;
  label: string;
}[] = [
  { value: "FIELD_GPS", label: "现场 GPS 采集" },
  { value: "EVIDENCE_PHOTO", label: "带定位现场照片" },
  { value: "OFFICIAL_GEOCODE", label: "官方地址定位" },
  { value: "VERIFIED_MAP", label: "人工核验地图" },
  { value: "OTHER", label: "其他可核验证据" },
];

const moduleLabels: Readonly<Record<string, string>> = {
  OVERVIEW: "总揽监测",
  PRODUCTION_ANALYSIS: "产情分析",
  MARKET_ANALYSIS: "市场分析",
  LOGISTICS_ANALYSIS: "物流分析",
  REPORTS: "报表",
};

function localDateTimeValue(): string {
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
  return now.toISOString().slice(0, 16);
}

function errorMessage(
  error: unknown,
  fallback = "加载失败，请稍后重试",
): string {
  return error instanceof RealtimeApiError
    ? (error.clientMessage ?? fallback)
    : fallback;
}

function dateTimeLabel(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleString("zh-CN", { hour12: false })
    : value;
}

function coordinateError(draft: CoordinateChangeDraft): string | null {
  const decimal = /^-?\d+(?:\.(\d+))?$/u;
  const longitude = decimal.exec(draft.longitude.trim());
  const latitude = decimal.exec(draft.latitude.trim());
  if (!longitude || !latitude) return "请输入有效的经度和纬度";
  if ((longitude[1]?.length ?? 0) > 7 || (latitude[1]?.length ?? 0) > 7)
    return "经纬度最多保留 7 位小数";
  const longitudeValue = Number(draft.longitude);
  const latitudeValue = Number(draft.latitude);
  if (
    longitudeValue < -180 ||
    longitudeValue > 180 ||
    latitudeValue < -90 ||
    latitudeValue > 90
  )
    return "经度须在 -180 至 180 之间，纬度须在 -90 至 90 之间";
  if (longitudeValue === 0 && latitudeValue === 0)
    return "不能使用 0，0 占位坐标";
  if (
    !draft.source ||
    !draft.collectedAt ||
    !draft.verifiedAddress.trim() ||
    !draft.changeReason.trim() ||
    !draft.evidenceReference.trim()
  )
    return "请完整填写坐标来源、采集时间、核验地址、变更原因和证据说明";
  if (!Number.isFinite(Date.parse(draft.collectedAt)))
    return "坐标采集时间无效";
  if (new Date(draft.collectedAt).getTime() > Date.now())
    return "坐标采集时间不能晚于当前时间";
  return null;
}

function coordinateMapUrl(draft: CoordinateChangeDraft): string | null {
  const longitude = draft.longitude.trim();
  const latitude = draft.latitude.trim();
  const longitudeValue = Number(longitude);
  const latitudeValue = Number(latitude);
  if (
    !longitude ||
    !latitude ||
    !Number.isFinite(longitudeValue) ||
    !Number.isFinite(latitudeValue) ||
    longitudeValue < -180 ||
    longitudeValue > 180 ||
    latitudeValue < -90 ||
    latitudeValue > 90
  )
    return null;
  return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(latitude)}&mlon=${encodeURIComponent(longitude)}#map=16/${encodeURIComponent(latitude)}/${encodeURIComponent(longitude)}`;
}

function populated(values: ValueMap, codes: readonly string[]): ValueMap {
  return Object.fromEntries(
    codes.flatMap((code) => {
      const value = values[code]?.trim();
      return value ? [[code, value] as const] : [];
    }),
  );
}

function observationValueLabel(
  field: ObservationField,
  value: string | undefined,
): string {
  if (!value) return "—";
  return field.options.find((option) => option.value === value)?.label ?? value;
}

function buildPayload(
  domain: FormalSampleObservationDomain,
  productCode: string,
  observedAt: string,
  sample: EligibleFormalSample,
  values: ValueMap,
  definition: ProductionDefinition | MarketDefinition | LogisticsDefinition,
  fields: readonly ObservationField[],
): unknown {
  const observed = new Date(observedAt);
  const surveyYear = String(observed.getFullYear());
  const surveyMonth = String(observed.getMonth() + 1);
  if (domain === "PRODUCTION" && "contractVersion" in definition) {
    return {
      ...productionPayloadFromValues(
        {
          ...values,
          objectTypeCode: sample.objectTypeCode ?? "",
          regionCode: sample.regionCode,
          surveyYear,
          surveyMonth,
        },
        productCode,
        definition,
      ),
      surveyDate: observedAt.slice(0, 10),
    };
  }
  if (domain === "MARKET" && "coreFields" in definition) {
    const coreCodes = new Set(definition.coreFields.map(({ code }) => code));
    const displayedCodes = fields.map(({ code }) => code);
    return {
      productCode,
      surveyYear,
      surveyMonth,
      coreValues: populated(
        values,
        displayedCodes.filter((code) => coreCodes.has(code)),
      ),
      facts: populated(
        values,
        displayedCodes.filter((code) => !coreCodes.has(code)),
      ),
      evidencePhotoIds: [],
    };
  }
  return {
    productCode,
    values: populated(
      values,
      fields.map(({ code }) => code),
    ),
  };
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: ObservationField;
  value: string;
  onChange: (value: string) => void;
}) {
  const fieldLabel = observationFieldLabel(field);
  if (field.controlType.toUpperCase() === "SELECT") {
    return (
      <select
        aria-label={fieldLabel}
        data-field-code={field.code}
        required={field.required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">请选择</option>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.controlType.toUpperCase() === "TEXTAREA") {
    return (
      <textarea
        aria-label={fieldLabel}
        data-field-code={field.code}
        required={field.required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  const number = ["NUMBER", "DECIMAL", "INTEGER"].includes(
    field.controlType.toUpperCase(),
  );
  return (
    <input
      aria-label={fieldLabel}
      data-field-code={field.code}
      required={field.required}
      type={number ? "number" : "text"}
      step={number ? "any" : undefined}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function ExistingSampleObservationPanel({
  domain,
  productCode,
  repository,
  onSaved,
  children,
}: {
  domain: FormalSampleObservationDomain;
  productCode: string;
  repository?: RealtimeBusinessRepository;
  onSaved: () => void;
  children?: ReactNode;
}) {
  const [mode, setMode] = useState<PageMode>("LEDGER");
  const [observedAt, setObservedAt] = useState(localDateTimeValue);
  const [objectTypes, setObjectTypes] = useState<readonly MasterObjectType[]>(
    [],
  );
  const [regions, setRegions] = useState<readonly MasterRegion[]>([]);
  const [objectTypeCode, setObjectTypeCode] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [keyword, setKeyword] = useState("");
  const [samples, setSamples] = useState<readonly EligibleFormalSample[]>([]);
  const [sampleId, setSampleId] = useState("");
  const [definition, setDefinition] = useState<
    ProductionDefinition | MarketDefinition | LogisticsDefinition | null
  >(null);
  const [values, setValues] = useState<ValueMap>({});
  const [history, setHistory] = useState<
    readonly FormalSampleObservationHistoryItem[]
  >([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyYear, setHistoryYear] = useState(() =>
    Number(localDateTimeValue().slice(0, 4)),
  );
  const [historyDetail, setHistoryDetail] =
    useState<FormalSampleObservationHistoryItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [canRequestCoordinate, setCanRequestCoordinate] = useState(false);
  const [coordinateOpen, setCoordinateOpen] = useState(false);
  const [coordinateDraft, setCoordinateDraft] = useState<CoordinateChangeDraft>(
    emptyCoordinateChange,
  );
  const [coordinateValidation, setCoordinateValidation] = useState("");
  const [coordinateIdempotencyKey, setCoordinateIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const sampleRequestVersion = useRef(0);
  const definitionRequestVersion = useRef(0);
  const historyRequestVersion = useRef(0);

  const sample = useMemo(
    () => samples.find(({ samplePointId }) => samplePointId === sampleId),
    [samples, sampleId],
  );
  const fields = useMemo(
    () => observationFields(domain, definition),
    [definition, domain],
  );
  const sections = useMemo(
    () => [
      ...new Set(
        fields
          .slice()
          .sort(
            (a, b) =>
              a.sectionOrder - b.sectionOrder || a.sortOrder - b.sortOrder,
          )
          .map(({ section }) => section),
      ),
    ],
    [fields],
  );
  const historyYears = useMemo(() => {
    const latest = Number(observedAt.slice(0, 4));
    const end =
      Number.isInteger(latest) && latest >= 2000 && latest <= 2100
        ? latest
        : new Date().getFullYear();
    return Array.from({ length: end - 1999 }, (_, index) => end - index);
  }, [observedAt]);

  const resetSelection = useCallback(() => {
    historyRequestVersion.current += 1;
    definitionRequestVersion.current += 1;
    setSampleId("");
    setDefinition(null);
    setValues({});
    setHistory([]);
    setHistoryTotal(0);
    setHistoryDetail(null);
    setCoordinateOpen(false);
    setCoordinateDraft(emptyCoordinateChange);
    setCoordinateValidation("");
  }, []);

  const invalidateQuery = useCallback(() => {
    sampleRequestVersion.current += 1;
    setBusy(false);
    setSamples([]);
    resetSelection();
  }, [resetSelection]);

  const querySamples = useCallback(
    async (preserveSampleId?: string) => {
      if (
        !repository?.listEligibleFormalSamples ||
        !Number.isFinite(Date.parse(observedAt))
      )
        return;
      const requestVersion = ++sampleRequestVersion.current;
      setBusy(true);
      setNotice("");
      try {
        const next = await repository.listEligibleFormalSamples({
          domain,
          productCode,
          regionCode: regionCode || undefined,
          objectTypeCode: objectTypeCode || undefined,
          keyword: keyword.trim() || undefined,
          year: Number(observedAt.slice(0, 4)),
          observedAt: new Date(observedAt).toISOString(),
        });
        if (requestVersion !== sampleRequestVersion.current) return;
        setSamples(next);
        if (
          preserveSampleId &&
          next.some(({ samplePointId }) => samplePointId === preserveSampleId)
        ) {
          setSampleId(preserveSampleId);
        } else {
          resetSelection();
        }
      } catch (error) {
        if (requestVersion === sampleRequestVersion.current)
          setNotice(errorMessage(error));
      } finally {
        if (requestVersion === sampleRequestVersion.current) setBusy(false);
      }
    },
    [
      domain,
      keyword,
      objectTypeCode,
      observedAt,
      productCode,
      regionCode,
      repository,
      resetSelection,
    ],
  );

  const loadHistory = useCallback(
    async (
      selected: EligibleFormalSample,
      pageNumber = 0,
      year = historyYear,
    ) => {
      if (!repository?.listFormalSampleObservationHistory) return;
      const requestVersion = ++historyRequestVersion.current;
      try {
        const result = await repository.listFormalSampleObservationHistory({
          domain,
          samplePointId: selected.samplePointId,
          productCode,
          year,
          pageNumber,
          pageSize: 20,
        });
        if (requestVersion !== historyRequestVersion.current) return;
        setHistory(result.items);
        setHistoryTotal(result.totalElements);
        setHistoryPage(result.pageNumber);
        setHistoryDetail(result.items[0] ?? null);
      } catch (error) {
        if (requestVersion === historyRequestVersion.current) {
          setNotice(errorMessage(error, "历史记录加载失败，请稍后重试"));
        }
      }
    },
    [domain, historyYear, productCode, repository],
  );

  const querySamplesRef = useRef(querySamples);
  useEffect(() => {
    querySamplesRef.current = querySamples;
  }, [querySamples]);

  useEffect(() => {
    if (mode !== "UPDATE" || !repository) return;
    let active = true;
    if (domain !== "LOGISTICS") {
      repository
        .listObjectTypes(productCode, domain)
        .then((items) => {
          if (active) setObjectTypes(items);
        })
        .catch((error: unknown) => {
          if (active) setNotice(errorMessage(error));
        });
    }
    repository
      .loadCurrentSession()
      .then((session) => {
        if (active)
          setCanRequestCoordinate(
            session.permissions.includes("BUSINESS_IMPORT"),
          );
      })
      .catch(() => {
        if (active) setCanRequestCoordinate(false);
      });
    repository
      .loadMasterData?.()
      .then((data) => {
        if (active) setRegions(data.regions);
      })
      .catch(() => undefined);
    void querySamplesRef.current();
    return () => {
      active = false;
    };
  }, [domain, mode, productCode, repository]);

  const chooseSample = async (selected: EligibleFormalSample) => {
    if (!repository) return;
    const requestVersion = ++definitionRequestVersion.current;
    historyRequestVersion.current += 1;
    const selectedHistoryYear = Number(observedAt.slice(0, 4));
    setSampleId(selected.samplePointId);
    setValues({ ...selected.latestValues });
    setDefinition(null);
    setHistory([]);
    setHistoryTotal(0);
    setHistoryDetail(null);
    setHistoryYear(selectedHistoryYear);
    setIdempotencyKey(crypto.randomUUID());
    setNotice("");
    setCoordinateOpen(false);
    setCoordinateDraft(emptyCoordinateChange);
    setCoordinateValidation("");
    setBusy(true);
    try {
      const next =
        domain === "PRODUCTION"
          ? await repository.loadProductionDefinition(
              productCode,
              selected.objectTypeCode ?? undefined,
            )
          : domain === "MARKET"
            ? await repository.loadMarketDefinition(
                productCode,
                selected.objectTypeCode ?? undefined,
              )
            : await repository.loadLogisticsDefinition(productCode);
      if (requestVersion !== definitionRequestVersion.current) return;
      setDefinition(next);
      await loadHistory(selected, 0, selectedHistoryYear);
    } catch (error) {
      if (requestVersion === definitionRequestVersion.current)
        setNotice(errorMessage(error));
    } finally {
      if (requestVersion === definitionRequestVersion.current) setBusy(false);
    }
  };

  const save = async () => {
    if (
      !repository?.saveFormalSampleObservation ||
      !sample ||
      !definition ||
      !Number.isFinite(Date.parse(observedAt))
    )
      return;
    setBusy(true);
    setNotice("");
    try {
      const result = await repository.saveFormalSampleObservation(
        {
          domain,
          samplePointId: sample.samplePointId,
          productCode,
          observedAt: new Date(observedAt).toISOString(),
          payload: buildPayload(
            domain,
            productCode,
            observedAt,
            sample,
            values,
            definition,
            fields,
          ),
        },
        idempotencyKey,
      );
      const linked = result.synchronizedModules
        .map((code) => moduleLabels[code] ?? code)
        .join("、");
      setIdempotencyKey(crypto.randomUUID());
      await Promise.all([
        querySamples(sample.samplePointId),
        loadHistory(sample, 0, historyYear),
      ]);
      setNotice(`已正式入库，已实时联动${linked}`);
      onSaved();
    } catch (error) {
      setNotice(errorMessage(error, "保存失败，请核对数据和权限后重试"));
    } finally {
      setBusy(false);
    }
  };

  const openCoordinateChange = () => {
    if (!sample || !canRequestCoordinate) return;
    setCoordinateDraft({
      ...emptyCoordinateChange,
      longitude: sample.longitude,
      latitude: sample.latitude,
    });
    setCoordinateValidation("");
    setCoordinateIdempotencyKey(crypto.randomUUID());
    setCoordinateOpen(true);
  };

  const changeCoordinateDraft = (
    property: keyof CoordinateChangeDraft,
    value: string,
  ) => {
    setCoordinateDraft((current) => ({ ...current, [property]: value }));
    setCoordinateValidation("");
    setCoordinateIdempotencyKey(crypto.randomUUID());
  };

  const submitCoordinateChange = async () => {
    if (!sample || !repository?.submitFormalSampleCoordinateCorrection) return;
    const validation = coordinateError(coordinateDraft);
    if (validation) {
      setCoordinateValidation(validation);
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      await repository.submitFormalSampleCoordinateCorrection(
        {
          samplePointId: sample.samplePointId,
          expectedVersion: sample.coordinateVersion,
          originalLongitude: sample.longitude,
          originalLatitude: sample.latitude,
          correctedLongitude: coordinateDraft.longitude.trim(),
          correctedLatitude: coordinateDraft.latitude.trim(),
          coordinateSource:
            coordinateDraft.source as FormalSampleCoordinateSource,
          coordinateCollectedAt: new Date(
            coordinateDraft.collectedAt,
          ).toISOString(),
          verifiedAddress: coordinateDraft.verifiedAddress.trim(),
          changeReason: coordinateDraft.changeReason.trim(),
          evidenceReference: coordinateDraft.evidenceReference.trim(),
        },
        coordinateIdempotencyKey,
      );
      setNotice("坐标变更已提交审核，正式坐标尚未改变");
    } catch (error) {
      setNotice(
        errorMessage(error, "坐标变更提交失败，请核对数据和权限后重试"),
      );
    } finally {
      setBusy(false);
    }
  };

  const mapUrl = coordinateMapUrl(coordinateDraft);

  if (
    !repository?.listEligibleFormalSamples ||
    !repository.saveFormalSampleObservation
  )
    return <>{children}</>;

  return (
    <div className="existing-observation">
      <div
        className="existing-observation__modes"
        role="tablist"
        aria-label="采集业务模式"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "LEDGER"}
          className={mode === "LEDGER" ? "is-active" : ""}
          onClick={() => setMode("LEDGER")}
        >
          采集台账
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "UPDATE"}
          className={mode === "UPDATE" ? "is-active" : ""}
          onClick={() => setMode("UPDATE")}
        >
          已有样本数据更新
        </button>
      </div>

      {mode === "LEDGER" ? (
        children
      ) : (
        <section
          className="existing-observation__page"
          aria-label="已有样本数据更新工作台"
        >
          <header className="existing-observation__header">
            <div className="existing-observation__header-copy">
              <h2>已有样本数据更新</h2>
              <p>
                选择已正式生效的样本，保存一次即正式入库并保留历史，不进入审核流程。
              </p>
            </div>
            <span className="existing-observation__header-badge">
              正式数据直报
            </span>
            <nav
              className="existing-observation__process"
              aria-label="已有样本数据更新流程"
            >
              <ol>
                <li className={!sample ? "is-current" : "is-complete"}>
                  <span>01</span>
                  <div>
                    <strong>查询正式样本</strong>
                    <small>按类型、地区或名称定位</small>
                  </div>
                </li>
                <li
                  className={
                    !sample
                      ? ""
                      : notice.startsWith("已正式入库")
                        ? "is-complete"
                        : "is-current"
                  }
                >
                  <span>02</span>
                  <div>
                    <strong>填写本次观测</strong>
                    <small>字段与采集台账同源</small>
                  </div>
                </li>
                <li
                  className={
                    notice.startsWith("已正式入库") ? "is-current" : ""
                  }
                >
                  <span>03</span>
                  <div>
                    <strong>正式入库并联动</strong>
                    <small>一次保存、历史留痕</small>
                  </div>
                </li>
              </ol>
            </nav>
          </header>

          <section
            className="existing-observation__filters"
            role="region"
            aria-label="已有正式样本查询"
          >
            <div className="existing-observation__filter-heading">
              <h3>查询与定位</h3>
              <p>先找到正式样本，再填写本次实际观测数据。</p>
            </div>
            <label>
              <span>实际观测时间</span>
              <input
                aria-label="实际观测时间"
                type="datetime-local"
                max={localDateTimeValue()}
                value={observedAt}
                onChange={(event) => {
                  setObservedAt(event.target.value);
                  setHistoryYear(Number(event.target.value.slice(0, 4)));
                  invalidateQuery();
                }}
              />
            </label>
            {domain !== "LOGISTICS" && (
              <label>
                <span>对象类型</span>
                <select
                  aria-label="筛选对象类型"
                  value={objectTypeCode}
                  onChange={(event) => {
                    setObjectTypeCode(event.target.value);
                    invalidateQuery();
                  }}
                >
                  <option value="">全部对象类型</option>
                  {objectTypes.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              <span>业务地区</span>
              <select
                aria-label="筛选业务地区"
                value={regionCode}
                onChange={(event) => {
                  setRegionCode(event.target.value);
                  invalidateQuery();
                }}
              >
                <option value="">全部授权地区</option>
                {regions.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="existing-observation__keyword">
              <span>样本点或企业名称</span>
              <input
                type="search"
                aria-label="搜索样本企业"
                placeholder="输入名称关键字"
                value={keyword}
                maxLength={100}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  invalidateQuery();
                }}
              />
            </label>
            <button
              className="is-primary"
              type="button"
              disabled={busy}
              onClick={() => void querySamples()}
            >
              查询正式样本
            </button>
          </section>

          <div className="existing-observation__workspace">
            <aside
              className="existing-observation__samples"
              aria-label="正式样本查询结果"
            >
              <div className="existing-observation__section-title">
                <h3>正式样本</h3>
                <span>共 {samples.length} 个</span>
              </div>
              <div className="existing-observation__sample-list">
                {samples.length === 0 && (
                  <p className="existing-observation__empty">
                    当前条件下没有可更新的正式样本
                  </p>
                )}
                {samples.map((item) => (
                  <button
                    type="button"
                    key={item.samplePointId}
                    className={
                      sampleId === item.samplePointId ? "is-selected" : ""
                    }
                    onClick={() => void chooseSample(item)}
                  >
                    <strong>{item.sampleName}</strong>
                    <span>
                      {item.objectTypeName ?? "物流样本"} · {item.regionName}
                    </span>
                    <small>
                      最近观测 {dateTimeLabel(item.latestObservedAt)}
                    </small>
                  </button>
                ))}
              </div>
            </aside>

            <main className="existing-observation__editor">
              {!sample && (
                <div className="existing-observation__placeholder">
                  <strong>请选择左侧正式样本</strong>
                  <span>样本身份与地区锁定，右侧仅填写本次实际观测数据。</span>
                </div>
              )}
              {sample && (
                <>
                  <div className="existing-observation__editor-heading">
                    <div>
                      <h3>本次正式观测</h3>
                      <p>样本身份只读，本页仅更新观测数据。</p>
                    </div>
                    <span>保存后立即生效</span>
                  </div>
                  <div
                    className="existing-observation__identity"
                    role="group"
                    aria-label="正式样本锁定信息"
                  >
                    <div>
                      <span>正式样本</span>
                      <strong>{sample.sampleName}</strong>
                    </div>
                    <div>
                      <span>对象类型</span>
                      <strong>{sample.objectTypeName ?? "物流样本"}</strong>
                    </div>
                    <div>
                      <span>业务地区</span>
                      <strong>{sample.regionName}</strong>
                    </div>
                    <div>
                      <span>定位坐标</span>
                      <strong>
                        {sample.longitude}，{sample.latitude}
                      </strong>
                      <small>坐标由样本档案管理</small>
                      <small>审核通过后由样本主档统一生效</small>
                      <button
                        type="button"
                        aria-describedby="coordinate-change-authority"
                        disabled={
                          !canRequestCoordinate ||
                          !repository.submitFormalSampleCoordinateCorrection
                        }
                        onClick={openCoordinateChange}
                      >
                        申请坐标变更
                      </button>
                      <small id="coordinate-change-authority">
                        {canRequestCoordinate
                          ? "提交后由系统校验权限、责任区、行政边界、版本和坐标占用，再进入独立审核"
                          : "当前账号没有坐标变更申请权限，系统仍会再次校验权限和责任区"}
                      </small>
                    </div>
                  </div>
                  {coordinateOpen && (
                    <section
                      className="existing-observation__coordinate-change"
                      role="region"
                      aria-label="坐标变更申请"
                    >
                      <header>
                        <div>
                          <h4>坐标变更申请</h4>
                          <p>
                            观测台账不会改写样本身份；审核通过后，样本主档坐标才会统一更新。
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCoordinateOpen(false)}
                        >
                          关闭
                        </button>
                      </header>
                      <div className="existing-observation__coordinate-summary">
                        <div>
                          <span>当前坐标</span>
                          <strong>
                            {sample.longitude}，{sample.latitude}
                          </strong>
                        </div>
                        <div>
                          <span>变更后坐标</span>
                          <strong>
                            {coordinateDraft.longitude || "—"}，
                            {coordinateDraft.latitude || "—"}
                          </strong>
                        </div>
                      </div>
                      <div
                        className="existing-observation__coordinate-map"
                        role="img"
                        aria-label="坐标变更地图预览"
                      >
                        <span>当前锚点</span>
                        <span>拟变更锚点</span>
                        <small>
                          服务端将按样本所属行政边界核验；同坐标冲突会拒绝，审核前地图锚点不变。
                        </small>
                        {mapUrl && (
                          <a href={mapUrl} target="_blank" rel="noreferrer">
                            在地图中核对变更后坐标
                          </a>
                        )}
                        <small>
                          待复核地址：
                          {coordinateDraft.verifiedAddress.trim() || "尚未填写"}
                        </small>
                      </div>
                      <div className="existing-observation__coordinate-grid">
                        <label>
                          <span>变更后经度</span>
                          <input
                            aria-label="变更后经度"
                            inputMode="decimal"
                            value={coordinateDraft.longitude}
                            onChange={(event) =>
                              changeCoordinateDraft(
                                "longitude",
                                event.target.value,
                              )
                            }
                          />
                        </label>
                        <label>
                          <span>变更后纬度</span>
                          <input
                            aria-label="变更后纬度"
                            inputMode="decimal"
                            value={coordinateDraft.latitude}
                            onChange={(event) =>
                              changeCoordinateDraft(
                                "latitude",
                                event.target.value,
                              )
                            }
                          />
                        </label>
                        <label>
                          <span>坐标来源</span>
                          <select
                            aria-label="坐标来源"
                            value={coordinateDraft.source}
                            onChange={(event) =>
                              changeCoordinateDraft(
                                "source",
                                event.target.value,
                              )
                            }
                          >
                            <option value="">请选择</option>
                            {coordinateSources.map((source) => (
                              <option key={source.value} value={source.value}>
                                {source.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>坐标采集时间</span>
                          <input
                            aria-label="坐标采集时间"
                            type="datetime-local"
                            max={localDateTimeValue()}
                            value={coordinateDraft.collectedAt}
                            onChange={(event) =>
                              changeCoordinateDraft(
                                "collectedAt",
                                event.target.value,
                              )
                            }
                          />
                        </label>
                        <label className="is-wide">
                          <span>核验地址</span>
                          <input
                            aria-label="核验地址"
                            maxLength={300}
                            value={coordinateDraft.verifiedAddress}
                            onChange={(event) =>
                              changeCoordinateDraft(
                                "verifiedAddress",
                                event.target.value,
                              )
                            }
                          />
                          <small>
                            地址用于人工复核，不会替代行政边界和真实经纬度校验。
                          </small>
                        </label>
                        <label className="is-wide">
                          <span>变更原因</span>
                          <textarea
                            aria-label="变更原因"
                            maxLength={500}
                            value={coordinateDraft.changeReason}
                            onChange={(event) =>
                              changeCoordinateDraft(
                                "changeReason",
                                event.target.value,
                              )
                            }
                          />
                        </label>
                        <label className="is-wide">
                          <span>证据说明</span>
                          <textarea
                            aria-label="证据说明"
                            maxLength={500}
                            value={coordinateDraft.evidenceReference}
                            onChange={(event) =>
                              changeCoordinateDraft(
                                "evidenceReference",
                                event.target.value,
                              )
                            }
                          />
                        </label>
                      </div>
                      {coordinateValidation && (
                        <p className="existing-observation__coordinate-error">
                          {coordinateValidation}
                        </p>
                      )}
                      <div className="existing-observation__coordinate-actions">
                        <span>
                          提交只生成待审核申请，不会提前改变主档、地图或导出。
                        </span>
                        <button
                          className="is-primary"
                          type="button"
                          disabled={busy}
                          onClick={() => void submitCoordinateChange()}
                        >
                          {busy ? "正在提交" : "提交坐标变更审核"}
                        </button>
                      </div>
                    </section>
                  )}
                  {definition && (
                    <form
                      className="existing-observation__form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void save();
                      }}
                    >
                      {sections.map((section) => (
                        <fieldset key={section}>
                          <legend>{section}</legend>
                          <div className="existing-observation__field-grid">
                            {fields
                              .filter((field) => field.section === section)
                              .sort((a, b) => a.sortOrder - b.sortOrder)
                              .map((field) => (
                                <label key={field.code}>
                                  <span>
                                    {observationFieldLabel(field)}
                                    {field.required && (
                                      <em aria-hidden="true">*</em>
                                    )}
                                  </span>
                                  <FieldControl
                                    field={field}
                                    value={values[field.code] ?? ""}
                                    onChange={(value) => {
                                      setValues((current) => ({
                                        ...current,
                                        [field.code]: value,
                                      }));
                                      setIdempotencyKey(crypto.randomUUID());
                                    }}
                                  />
                                </label>
                              ))}
                          </div>
                        </fieldset>
                      ))}
                      <div className="existing-observation__actions">
                        <div>
                          <strong>保存后立即生效</strong>
                          <span>
                            写入正式历史，并联动总揽、对应分析和报表。
                          </span>
                        </div>
                        <button
                          className="is-primary"
                          type="submit"
                          disabled={busy}
                        >
                          {busy ? "正在保存" : "保存并正式入库"}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </main>
          </div>

          {sample && (
            <section
              className="existing-observation__history"
              aria-label="历史观测记录"
            >
              <div className="existing-observation__section-title">
                <div>
                  <h3>历史观测记录</h3>
                  <p>页面可查的正式历史，旧记录只读保留，不被新数据覆盖。</p>
                </div>
                <div className="existing-observation__history-summary">
                  <label>
                    <span>历史数据年份</span>
                    <select
                      aria-label="历史数据年份"
                      value={historyYear}
                      onChange={(event) => {
                        const year = Number(event.target.value);
                        setHistoryYear(year);
                        void loadHistory(sample, 0, year);
                      }}
                    >
                      {historyYears.map((year) => (
                        <option key={year} value={year}>
                          {year} 年
                        </option>
                      ))}
                    </select>
                  </label>
                  <strong>共 {historyTotal} 条</strong>
                </div>
              </div>
              <div className="existing-observation__history-layout">
                <div className="existing-observation__history-table">
                  <table>
                    <thead>
                      <tr>
                        <th>状态</th>
                        <th>实际观测时间</th>
                        <th>正式入库时间</th>
                        <th>填报人</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((item) => (
                        <tr
                          key={
                            item.observationId ??
                            `${item.observedAt}-${item.officialSavedAt}`
                          }
                        >
                          <td>
                            <span className={item.latest ? "is-current" : ""}>
                              {item.latest ? "当前最新" : "历史记录"}
                            </span>
                          </td>
                          <td>{dateTimeLabel(item.observedAt)}</td>
                          <td>{dateTimeLabel(item.officialSavedAt)}</td>
                          <td>{item.actorDisplayName}</td>
                          <td>
                            <button
                              type="button"
                              onClick={() => setHistoryDetail(item)}
                            >
                              查看详情
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {history.length === 0 && (
                    <p className="existing-observation__empty">
                      {historyYear} 年暂无历史观测记录
                    </p>
                  )}
                  {historyTotal > 20 && (
                    <div className="existing-observation__pagination">
                      <button
                        type="button"
                        disabled={historyPage === 0}
                        onClick={() =>
                          void loadHistory(sample, historyPage - 1)
                        }
                      >
                        上一页
                      </button>
                      <span>第 {historyPage + 1} 页</span>
                      <button
                        type="button"
                        disabled={(historyPage + 1) * 20 >= historyTotal}
                        onClick={() =>
                          void loadHistory(sample, historyPage + 1)
                        }
                      >
                        下一页
                      </button>
                    </div>
                  )}
                </div>
                <div
                  className="existing-observation__history-detail"
                  aria-label="历史记录详情"
                >
                  <h4>
                    {historyDetail?.latest ? "当前最新数据" : "历史数据详情"}
                  </h4>
                  {!historyDetail ? (
                    <p>请选择一条历史记录查看</p>
                  ) : (
                    <dl>
                      {fields.map((field) => (
                        <div key={field.code}>
                          <dt>{observationFieldLabel(field)}</dt>
                          <dd>
                            {observationValueLabel(
                              field,
                              historyDetail.values[field.code],
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </div>
            </section>
          )}
          {notice && (
            <div className="existing-observation__notice" role="status">
              {notice}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
