import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type {
  EligibleFormalSample,
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
import {
  decimalInputConstraints,
  productionPayloadFromValues,
} from "../realtime/realtimeRecordFormModel";
import type { FormalSelection } from "../formalEnterpriseModel";
import {
  observationFieldLabel,
  observationFields,
  type ObservationField,
} from "./formalSampleObservationFields";

const FormalSamplePointLedger = lazy(() =>
  import("./FormalSamplePointLedger").then((module) => ({
    default: module.FormalSamplePointLedger,
  })),
);

type ValueMap = Record<string, string>;

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
  if (!(error instanceof RealtimeApiError)) return fallback;
  const messages: Readonly<Record<string, string>> = {
    FORMAL_SAMPLE_MAINTAINER_REQUIRED:
      "该正式样本尚未指定维护人，请先由管理员指定后再填写期间数据。",
    FORMAL_SAMPLE_MAINTAINER_DENIED:
      "当前账号不是该正式样本的维护人，不能填写期间数据。",
    ACCESS_PERMISSION_DENIED: "当前账号没有填写正式采集数据的权限。",
    ACCESS_REGION_DENIED: "该正式样本不在当前账号的授权地区内。",
    FORMAL_SAMPLE_POINT_NOT_FOUND: "正式样本不存在或已被删除。",
  };
  return messages[error.code] ?? error.clientMessage ?? fallback;
}

function dateTimeLabel(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleString("zh-CN", { hour12: false })
    : value;
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
      {...(number ? decimalInputConstraints(field.precision, field.scale) : {})}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function ExistingSampleObservationPanel({
  domain,
  productCode,
  repository,
  permissions = [],
  onSaved,
  selection,
  onSelectionChange,
  onSelectionClear,
  children,
}: {
  domain: FormalSampleObservationDomain;
  productCode: string;
  repository?: RealtimeBusinessRepository;
  permissions?: readonly string[];
  onSaved: () => void;
  selection?: FormalSelection;
  onSelectionChange?: (selection: FormalSelection) => void;
  onSelectionClear?: () => void;
  children?: ReactNode;
}) {
  const [localSelection, setLocalSelection] = useState<
    FormalSelection | undefined
  >(selection);
  const activeSelection = onSelectionChange ? selection : localSelection;
  const isObservationPage =
    activeSelection?.type === "formal-sample-observation";
  const isFormalSampleEditor =
    activeSelection?.type === "formal-sample-create" ||
    activeSelection?.type === "formal-sample-edit";
  const isEmbeddedLegacyList =
    activeSelection?.type === "formal-sample-list" && !onSelectionChange;
  const isFormalSamplePage =
    isObservationPage || isFormalSampleEditor || isEmbeddedLegacyList;
  const requestedSamplePointId = isObservationPage ? activeSelection.id : "";
  const navigate = (next: FormalSelection) => {
    setLocalSelection(next);
    onSelectionChange?.(next);
  };
  const closeWorkflow = () => {
    setLocalSelection(undefined);
    onSelectionClear?.();
  };
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
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const sampleRequestVersion = useRef(0);
  const definitionRequestVersion = useRef(0);
  const historyRequestVersion = useRef(0);
  const valuesDirty = useRef(false);

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
    valuesDirty.current = false;
    setHistory([]);
    setHistoryTotal(0);
    setHistoryDetail(null);
  }, []);

  const resetUpdateFilters = useCallback(() => {
    setObjectTypeCode("");
    setRegionCode("");
    setKeyword("");
  }, []);

  const invalidateQuery = useCallback(() => {
    sampleRequestVersion.current += 1;
    setBusy(false);
    setSamples([]);
    resetSelection();
  }, [resetSelection]);

  const loadDefinitionForSample = useCallback(
    async (selected: EligibleFormalSample) => {
      if (!repository) return null;
      return domain === "PRODUCTION"
        ? repository.loadProductionDefinition(
            productCode,
            selected.objectTypeCode ?? undefined,
          )
        : domain === "MARKET"
          ? repository.loadMarketDefinition(
              productCode,
              selected.objectTypeCode ?? undefined,
            )
          : repository.loadLogisticsDefinition(productCode);
    },
    [domain, productCode, repository],
  );

  const querySamples = useCallback(
    async (preserveSampleId?: string, refreshEditor = false) => {
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
        const preserved = next.find(
          ({ samplePointId }) => samplePointId === preserveSampleId,
        );
        if (preserved) {
          setSampleId(preserved.samplePointId);
          if (refreshEditor) {
            if (valuesDirty.current) {
              setNotice(
                "正式数据已更新，当前未保存内容未被覆盖；请重新选择样本后继续。",
              );
            } else {
              const definitionVersion = ++definitionRequestVersion.current;
              const refreshedDefinition =
                await loadDefinitionForSample(preserved);
              if (
                requestVersion !== sampleRequestVersion.current ||
                definitionVersion !== definitionRequestVersion.current
              )
                return;
              setValues({ ...preserved.latestValues });
              setDefinition(refreshedDefinition);
              setIdempotencyKey(crypto.randomUUID());
            }
          }
          return preserved;
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
      loadDefinitionForSample,
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
  const loadHistoryRef = useRef(loadHistory);
  useEffect(() => {
    querySamplesRef.current = querySamples;
    loadHistoryRef.current = loadHistory;
  }, [loadHistory, querySamples]);
  const eventSequence = useRef(0);
  const eventState = useRef({ sample, productCode, historyYear, loadHistory });
  useEffect(() => {
    eventState.current = { sample, productCode, historyYear, loadHistory };
  }, [historyYear, loadHistory, productCode, sample]);

  useEffect(() => {
    if (!isObservationPage || !repository?.subscribeBusinessEvents) {
      return undefined;
    }
    return repository.subscribeBusinessEvents(
      eventSequence.current,
      (event) => {
        if (event.sequence <= eventSequence.current) return;
        eventSequence.current = event.sequence;
        const current = eventState.current;
        const observationChanged =
          event.actionCode === "FORMAL_SAMPLE_OBSERVATION_SAVED" &&
          (!event.productCode || event.productCode === current.productCode);
        const formalSampleChanged = event.actionCode.startsWith(
          "FORMAL_SAMPLE_POINT_",
        );
        if (!observationChanged && !formalSampleChanged) return;
        void querySamplesRef
          .current(current.sample?.samplePointId, true)
          .then((refreshed) => {
            if (refreshed && observationChanged) {
              void current.loadHistory(refreshed, 0, current.historyYear);
            }
          });
      },
    );
  }, [isObservationPage, repository]);

  useEffect(() => {
    if (!isObservationPage || !repository) return;
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
      .loadMasterData?.()
      .then((data) => {
        if (active) setRegions(data.regions);
      })
      .catch(() => undefined);
    void querySamplesRef
      .current(requestedSamplePointId || undefined, true)
      .then((preserved) => {
        if (!active || !preserved || !requestedSamplePointId) return;
        const selectedHistoryYear = Number(observedAt.slice(0, 4));
        setHistoryYear(selectedHistoryYear);
        void loadHistoryRef.current(preserved, 0, selectedHistoryYear);
      });
    return () => {
      active = false;
    };
  }, [
    domain,
    isObservationPage,
    observedAt,
    productCode,
    repository,
    requestedSamplePointId,
  ]);

  const chooseSample = async (selected: EligibleFormalSample) => {
    if (!repository) return;
    const requestVersion = ++definitionRequestVersion.current;
    historyRequestVersion.current += 1;
    const selectedHistoryYear = Number(observedAt.slice(0, 4));
    setSampleId(selected.samplePointId);
    setValues({ ...selected.latestValues });
    valuesDirty.current = false;
    setDefinition(null);
    setHistory([]);
    setHistoryTotal(0);
    setHistoryDetail(null);
    setHistoryYear(selectedHistoryYear);
    setIdempotencyKey(crypto.randomUUID());
    setNotice("");
    setBusy(true);
    try {
      const next = await loadDefinitionForSample(selected);
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
        .filter((code) => code !== "REPORTS")
        .map((code) => moduleLabels[code] ?? code)
        .join("、");
      setIdempotencyKey(crypto.randomUUID());
      valuesDirty.current = false;
      await Promise.all([
        querySamples(sample.samplePointId, true),
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

  if (
    !repository?.listEligibleFormalSamples ||
    !repository.saveFormalSampleObservation
  )
    return <>{children}</>;

  return (
    <div className="existing-observation">
      {!isFormalSamplePage ? <>{children}</> : null}
      {(isFormalSampleEditor || isEmbeddedLegacyList) &&
      repository.listFormalSamplePoints ? (
        <section
          className="existing-observation__page"
          aria-label="正式样本台账"
        >
          <Suspense fallback={<p role="status">正在读取正式样本台账…</p>}>
            <FormalSamplePointLedger
              domain={domain}
              permissions={permissions}
              productCode={productCode}
              repository={repository}
              selection={onSelectionChange ? activeSelection : undefined}
              onSelectionChange={onSelectionChange ? navigate : undefined}
              onSelectionClear={closeWorkflow}
              onCollectData={(samplePointId) => {
                resetUpdateFilters();
                resetSelection();
                navigate({
                  type: "formal-sample-observation",
                  id: samplePointId,
                });
              }}
            />
          </Suspense>
        </section>
      ) : null}
      {isObservationPage && (
        <section
          className="existing-observation__page"
          aria-label="采集数据填写工作台"
        >
          <header className="existing-observation__header">
            <div className="existing-observation__header-copy">
              <h2>填写或更新采集数据</h2>
              <p>当前样本身份保持锁定，本页只填写本次期间观测。</p>
            </div>
            <button
              type="button"
              onClick={() => {
                resetUpdateFilters();
                resetSelection();
                closeWorkflow();
              }}
            >
              返回业务列表
            </button>
          </header>

          <section
            className="existing-observation__filters enterprise-ledger-query enterprise-ledger-query--design"
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
            <div className="enterprise-ledger-query__actions">
              <button
                className="is-primary"
                type="button"
                disabled={busy}
                onClick={() => void querySamples()}
              >
                查询正式样本
              </button>
            </div>
          </section>

          <div
            className={`existing-observation__workspace${
              requestedSamplePointId && onSelectionChange
                ? " existing-observation__workspace--full"
                : ""
            }`}
          >
            {(!requestedSamplePointId || !onSelectionChange) && (
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
                      onClick={() => {
                        if (sampleId !== item.samplePointId)
                          void chooseSample(item);
                      }}
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
            )}

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
                    </div>
                  </div>
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
                                      valuesDirty.current = true;
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
