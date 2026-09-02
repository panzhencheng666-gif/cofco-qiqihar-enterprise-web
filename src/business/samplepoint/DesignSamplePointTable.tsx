import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  CurrentSession,
  DesignSamplePointListInput,
  DesignSamplePointMutation,
  DesignSamplePointRow,
  MasterRegion,
  Page,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import type {
  DesignSampleContext,
  DesignSampleFieldContract,
  DesignSampleFieldDefinition,
} from "@/platform/api/designSampleFieldContract";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";

const PAGE_SIZE = 20;
const BOOTSTRAP_CONTEXT: DesignSampleContext = {
  domainCode: "PRODUCTION",
  productCode: "CORN",
  objectTypeCode: "FARMER",
};
const EMPTY_PAGE: Page<DesignSamplePointRow> = {
  items: [],
  pageNumber: 0,
  pageSize: PAGE_SIZE,
  totalElements: 0,
  totalPages: 0,
};

type ListState = "loading" | "ready" | "unavailable";
type Editor =
  | { mode: "create"; point?: undefined }
  | { mode: "edit"; point: DesignSamplePointRow };

export function DesignSamplePointTable({
  onListStateChange,
  refreshSequence,
  repository,
  session,
}: {
  onListStateChange: (state: ListState, total?: number) => void;
  refreshSequence: number;
  repository: RealtimeBusinessRepository;
  session: CurrentSession;
}) {
  const [listState, setListState] = useState<ListState>("loading");
  const [pageData, setPageData] =
    useState<Page<DesignSamplePointRow>>(EMPTY_PAGE);
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [filterDraft, setFilterDraft] = useState({
    keyword: "",
    domainCode: "",
    productCode: "",
    objectTypeCode: "",
    regionCode: "",
  });
  const [filters, setFilters] = useState(filterDraft);
  const [catalog, setCatalog] = useState<DesignSampleFieldContract>();
  const [regions, setRegions] = useState<readonly MasterRegion[]>([]);
  const [editor, setEditor] = useState<Editor>();
  const [editorContract, setEditorContract] =
    useState<DesignSampleFieldContract>();
  const [editorValues, setEditorValues] = useState<Record<string, string>>({});
  const [editorError, setEditorError] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const canWrite = session.permissions.includes("BUSINESS_UPDATE");

  useEffect(() => {
    let active = true;
    if (repository.loadDesignSamplePointFields) {
      void repository
        .loadDesignSamplePointFields(BOOTSTRAP_CONTEXT)
        .then((next) => {
          if (active) setCatalog(next);
        })
        .catch(() => undefined);
    }
    void repository
      .loadMasterData()
      .then((master) => {
        if (active) setRegions(master.regions);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [repository]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setListState("loading");
      onListStateChange("loading");
    });
    if (!repository.listDesignSamplePoints) {
      queueMicrotask(() => {
        if (!active) return;
        setListState("unavailable");
        onListStateChange("unavailable");
      });
      return () => {
        active = false;
      };
    }
    const input: DesignSamplePointListInput = {
      ...nonEmptyFilters(filters),
      page,
      pageSize: PAGE_SIZE,
    };
    void repository
      .listDesignSamplePoints(input)
      .then((next) => {
        if (!active) return;
        setPageData(next);
        setListState("ready");
        onListStateChange("ready", next.totalElements);
      })
      .catch(() => {
        if (!active) return;
        setListState("unavailable");
        onListStateChange("unavailable");
      });
    return () => {
      active = false;
    };
  }, [filters, onListStateChange, page, refresh, refreshSequence, repository]);

  const labels = useMemo(() => catalogLabels(catalog), [catalog]);
  const pageCount = Math.max(1, pageData.totalPages);

  const loadEditor = useCallback(
    async (nextEditor: Editor) => {
      setActionError("");
      let currentEditor = nextEditor;
      if (nextEditor.mode === "edit") {
        if (!repository.getDesignSamplePoint) {
          setActionError("最新点位信息暂不可用，请稍后重试。");
          return;
        }
        try {
          currentEditor = {
            mode: "edit",
            point: await repository.getDesignSamplePoint(nextEditor.point.id),
          };
        } catch (error) {
          setActionError(
            errorMessage(error, "最新点位信息暂不可用，请稍后重试。"),
          );
          return;
        }
      }
      const context = currentEditor.point?.context ?? BOOTSTRAP_CONTEXT;
      setEditor(currentEditor);
      setEditorContract(undefined);
      setEditorError("");
      setEditorValues(
        currentEditor.point
          ? Object.fromEntries(
              Object.entries(currentEditor.point.values).map(
                ([code, value]) => [code, formValue(value)],
              ),
            )
          : {},
      );
      if (!repository.loadDesignSamplePointFields) {
        setEditorError("字段信息暂不可用，请稍后重试。");
        return;
      }
      try {
        const contract = await repository.loadDesignSamplePointFields(context);
        setCatalog(contract);
        setEditorContract(contract);
      } catch (error) {
        setEditorError(errorMessage(error, "字段信息暂不可用，请稍后重试。"));
      }
    },
    [repository],
  );

  const reload = () => setRefresh((value) => value + 1);

  const save = async () => {
    if (!editor || !editorContract || saving) return;
    if (!repository.getDesignSamplePoint) {
      setEditorError("最新点位信息暂不可用，请稍后重试。");
      return;
    }
    const mutation: DesignSamplePointMutation = {
      contractVersion: editorContract.contractVersion,
      contractDigest: editorContract.contractDigest,
      context: editorContract.context,
      values: submittedValues(editorContract, editorValues),
    };
    setSaving(true);
    setEditorError("");
    setActionError("");
    let saved: DesignSamplePointRow;
    try {
      if (editor.mode === "create") {
        if (!repository.createDesignSamplePoint) throw new Error("unavailable");
        saved = await repository.createDesignSamplePoint(
          mutation,
          requestKey(),
        );
      } else {
        if (!repository.updateDesignSamplePoint) throw new Error("unavailable");
        saved = await repository.updateDesignSamplePoint(
          editor.point.id,
          mutation,
          editor.point.version,
        );
      }
    } catch (error) {
      setEditorError(
        errorMessage(error, "保存失败，请核对填写内容后重试。", editorContract),
      );
      setSaving(false);
      return;
    }
    try {
      await repository.getDesignSamplePoint(saved.id);
    } catch {
      setActionError("保存已完成，但最新点位信息读取失败，请刷新清单确认。");
    }
    setEditor(undefined);
    setEditorContract(undefined);
    reload();
    setSaving(false);
  };

  const remove = async (point: DesignSamplePointRow) => {
    if (
      !repository.deleteDesignSamplePoint ||
      !window.confirm(`确认删除“${point.name}”？`)
    ) {
      return;
    }
    setActionError("");
    try {
      await repository.deleteDesignSamplePoint(point.id, point.version);
      reload();
    } catch (error) {
      setActionError(errorMessage(error, "删除失败，请刷新清单后重试。"));
    }
  };

  return (
    <div className="sample-point-governance-workspace__table-region enterprise-ledger-workbench">
      <header className="enterprise-ledger-title enterprise-ledger-title--collection">
        <div>
          <h2>设计参考点清单</h2>
          <p>维护长期参考点。行政区覆盖、坐标范围和适用字段由系统校验。</p>
        </div>
        <div className="design-sample-point-table__header-actions">
          {listState === "ready" ? (
            <strong>{pageData.totalElements} 个参考点</strong>
          ) : null}
          {canWrite ? (
            <button
              onClick={() => void loadEditor({ mode: "create" })}
              type="button"
            >
              新建设计参考点
            </button>
          ) : null}
        </div>
      </header>

      <div
        aria-label="设计参考点台账工具栏"
        className="sample-point-governance-workspace__toolbar"
        role="toolbar"
      >
        <form
          aria-label="设计参考点筛选"
          className="enterprise-ledger-query enterprise-ledger-query--design"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(0);
            setFilters(filterDraft);
          }}
          role="search"
        >
          <label className="sample-point-governance-workspace__filter-query">
            <span>关键词</span>
            <input
              aria-label="搜索点位或行政区"
              onChange={(event) =>
                setFilterDraft((current) => ({
                  ...current,
                  keyword: event.target.value,
                }))
              }
              placeholder="搜索点位或行政区"
              type="search"
              value={filterDraft.keyword}
            />
          </label>
          <CatalogFilter
            label="业务类型"
            onChange={(domainCode) =>
              setFilterDraft((current) => ({
                ...current,
                domainCode,
                objectTypeCode: "",
              }))
            }
            options={catalog?.domains ?? []}
            value={filterDraft.domainCode}
          />
          <CatalogFilter
            label="产品"
            onChange={(productCode) =>
              setFilterDraft((current) => ({ ...current, productCode }))
            }
            options={catalog?.products ?? []}
            value={filterDraft.productCode}
          />
          <CatalogFilter
            label="对象类别"
            onChange={(objectTypeCode) =>
              setFilterDraft((current) => ({ ...current, objectTypeCode }))
            }
            options={(catalog?.objectTypes ?? []).filter(
              (option) =>
                !filterDraft.domainCode ||
                option.domainCode === filterDraft.domainCode,
            )}
            value={filterDraft.objectTypeCode}
          />
          <label>
            <span>行政区</span>
            <select
              aria-label="筛选行政区"
              onChange={(event) =>
                setFilterDraft((current) => ({
                  ...current,
                  regionCode: event.target.value,
                }))
              }
              value={filterDraft.regionCode}
            >
              <option value="">全部行政区</option>
              {regions.map((region) => (
                <option key={region.code} value={region.code}>
                  {region.name}
                </option>
              ))}
            </select>
          </label>
          <div className="enterprise-ledger-query__actions">
            <button className="is-primary" type="submit">
              查询
            </button>
            <button
              disabled={!Object.values(filterDraft).some(Boolean)}
              onClick={() => {
                const empty = {
                  keyword: "",
                  domainCode: "",
                  productCode: "",
                  objectTypeCode: "",
                  regionCode: "",
                };
                setFilterDraft(empty);
                setFilters(empty);
                setPage(0);
              }}
              type="button"
            >
              清除筛选
            </button>
          </div>
        </form>
      </div>

      {actionError ? <p role="alert">{actionError}</p> : null}
      {listState === "loading" ? (
        <p role="status">正在读取设计参考点清单…</p>
      ) : null}
      {listState === "unavailable" ? (
        <p role="alert">设计参考点清单暂不可用，请稍后重试。</p>
      ) : null}
      {listState === "ready" ? (
        <>
          <div className="enterprise-ledger-table">
            <div
              aria-label="设计参考点滚动清单"
              className="sample-point-governance-workspace__table-scroll--bounded enterprise-ledger-table__scroll"
              role="region"
              tabIndex={0}
            >
              <table aria-label="设计参考点清单">
                <thead>
                  <tr>
                    <th>点位名称</th>
                    <th>业务对象</th>
                    <th>行政区</th>
                    <th>坐标</th>
                    {canWrite ? <th>操作</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {pageData.items.map((point) => (
                    <tr key={point.id}>
                      <td>{point.name}</td>
                      <td>
                        {labels.domain.get(point.context.domainCode) ??
                          "未识别"}{" "}
                        ·{" "}
                        {labels.product.get(point.context.productCode) ??
                          "未识别"}{" "}
                        ·{" "}
                        {labels.objectType.get(point.context.objectTypeCode) ??
                          "未识别"}
                      </td>
                      <td>{point.regionPath}</td>
                      <td>
                        {point.longitude}, {point.latitude}
                      </td>
                      {canWrite ? (
                        <td className="design-sample-point-table__row-actions">
                          <button
                            aria-label={`编辑${point.name}`}
                            className="enterprise-ledger-row-action"
                            onClick={() =>
                              void loadEditor({ mode: "edit", point })
                            }
                            type="button"
                          >
                            编辑
                          </button>
                          <button
                            aria-label={`删除${point.name}`}
                            className="enterprise-ledger-row-action"
                            onClick={() => void remove(point)}
                            type="button"
                          >
                            删除
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  {pageData.items.length === 0 ? (
                    <tr>
                      <td colSpan={canWrite ? 5 : 4}>
                        没有符合条件的设计参考点。
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <nav
              aria-label="设计参考点分页"
              className="sample-point-governance-workspace__pagination"
            >
              <span>
                共 {pageData.totalElements} 条 · 第 {pageData.pageNumber + 1} /{" "}
                {pageCount} 页
              </span>
              <div>
                <button
                  disabled={pageData.pageNumber === 0}
                  onClick={() => setPage((value) => Math.max(0, value - 1))}
                  type="button"
                >
                  上一页
                </button>
                <button
                  disabled={pageData.pageNumber + 1 >= pageCount}
                  onClick={() => setPage((value) => value + 1)}
                  type="button"
                >
                  下一页
                </button>
              </div>
            </nav>
          </div>
        </>
      ) : null}

      {editor ? (
        <DesignSamplePointEditor
          contract={editorContract}
          error={editorError}
          mode={editor.mode}
          onCancel={() => setEditor(undefined)}
          onContextChange={async (context) => {
            if (!repository.loadDesignSamplePointFields) return;
            setEditorError("");
            setEditorContract(undefined);
            setEditorValues({});
            try {
              const next =
                await repository.loadDesignSamplePointFields(context);
              setCatalog(next);
              setEditorContract(next);
            } catch (error) {
              setEditorError(
                errorMessage(error, "字段信息暂不可用，请稍后重试。"),
              );
            }
          }}
          onSave={() => void save()}
          onValueChange={(code, value) =>
            setEditorValues((current) => ({ ...current, [code]: value }))
          }
          regions={regions}
          saving={saving}
          values={editorValues}
        />
      ) : null}
    </div>
  );
}

function DesignSamplePointEditor({
  contract,
  error,
  mode,
  onCancel,
  onContextChange,
  onSave,
  onValueChange,
  regions,
  saving,
  values,
}: {
  contract: DesignSampleFieldContract | undefined;
  error: string;
  mode: "create" | "edit";
  onCancel: () => void;
  onContextChange: (context: DesignSampleContext) => Promise<void>;
  onSave: () => void;
  onValueChange: (code: string, value: string) => void;
  regions: readonly MasterRegion[];
  saving: boolean;
  values: Readonly<Record<string, string>>;
}) {
  const fields = contract
    ? [...contract.identityFields, ...contract.observationFields].filter(
        (field) => field.editable,
      )
    : [];
  return (
    <form
      aria-label={mode === "create" ? "新建设计参考点" : "编辑设计参考点"}
      className="design-sample-point-editor"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
      role="form"
    >
      <header>
        <h3>{mode === "create" ? "新建设计参考点" : "编辑设计参考点"}</h3>
        <p>选择业务对象后，系统只展示该对象适用的填写项。</p>
      </header>
      {contract ? (
        <>
          <ContextFields contract={contract} onChange={onContextChange} />
          <div className="design-sample-point-editor__fields">
            {fields.map((field) => (
              <MetadataField
                field={field}
                key={field.code}
                onChange={(value) => onValueChange(field.code, value)}
                regions={regions}
                value={values[field.code] ?? ""}
              />
            ))}
          </div>
        </>
      ) : error ? null : (
        <p role="status">正在读取适用填写项…</p>
      )}
      {error ? <p role="alert">{error}</p> : null}
      <footer>
        <button onClick={onCancel} type="button">
          取消
        </button>
        <button disabled={!contract || saving} type="submit">
          {saving ? "保存中…" : "保存"}
        </button>
      </footer>
    </form>
  );
}

function ContextFields({
  contract,
  onChange,
}: {
  contract: DesignSampleFieldContract;
  onChange: (context: DesignSampleContext) => Promise<void>;
}) {
  const labels = catalogLabels(contract);
  const context = contract.context;
  const change = (part: keyof DesignSampleContext, value: string) => {
    const preferred = { ...context, [part]: value };
    const next =
      contract.supportedContexts.find(
        (candidate) =>
          candidate.domainCode === preferred.domainCode &&
          candidate.productCode === preferred.productCode &&
          candidate.objectTypeCode === preferred.objectTypeCode,
      ) ??
      contract.supportedContexts.find((candidate) => candidate[part] === value);
    if (next) void onChange(next);
  };
  return (
    <div className="design-sample-point-editor__context">
      <label>
        <span>业务类型</span>
        <select
          aria-label="业务类型"
          onChange={(event) => change("domainCode", event.target.value)}
          value={context.domainCode}
        >
          {contract.domains.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>产品</span>
        <select
          aria-label="产品"
          onChange={(event) => change("productCode", event.target.value)}
          value={context.productCode}
        >
          {contract.products.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>对象类别</span>
        <select
          aria-label="对象类别"
          onChange={(event) => change("objectTypeCode", event.target.value)}
          value={context.objectTypeCode}
        >
          {contract.supportedContexts
            .filter(
              (candidate) =>
                candidate.domainCode === context.domainCode &&
                candidate.productCode === context.productCode,
            )
            .map((candidate) => (
              <option
                key={candidate.objectTypeCode}
                value={candidate.objectTypeCode}
              >
                {labels.objectType.get(candidate.objectTypeCode) ?? "业务对象"}
              </option>
            ))}
        </select>
      </label>
    </div>
  );
}

function MetadataField({
  field,
  onChange,
  regions,
  value,
}: {
  field: DesignSampleFieldDefinition;
  onChange: (value: string) => void;
  regions: readonly MasterRegion[];
  value: string;
}) {
  const businessLabel = fieldLabel(field);
  const label = field.unit
    ? `${businessLabel}（${field.unit}）`
    : businessLabel;
  if (field.code === "DSP_REGION_CODE") {
    return (
      <label>
        <span>{businessLabel}</span>
        <select
          aria-label={businessLabel}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          value={value}
        >
          <option value="">请选择行政区</option>
          {regions.map((region) => (
            <option key={region.code} value={region.code}>
              {region.name}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (field.valueType === "ENUM") {
    return (
      <label>
        <span>{label}</span>
        <select
          aria-label={label}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          value={value}
        >
          <option value="">请选择</option>
          {field.enumOptions.map((option, index) => (
            <option key={option} value={option}>
              {enumLabel(option, index)}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label>
      <span>{label}</span>
      <input
        aria-label={label}
        max={field.maximumValue ?? undefined}
        maxLength={field.maxLength ?? undefined}
        min={field.minimumValue ?? undefined}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
        step={decimalStep(field)}
        type={
          field.valueType === "DECIMAL"
            ? "number"
            : field.valueType === "DATE"
              ? "date"
              : "text"
        }
        value={value}
      />
    </label>
  );
}

function CatalogFilter({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: readonly { code: string; label: string }[];
  value: string;
}) {
  if (options.length === 0) return null;
  return (
    <label>
      <span>{label}</span>
      <select
        aria-label={`筛选${label}`}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">全部{label}</option>
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function nonEmptyFilters(filters: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value.trim() !== ""),
  );
}

function submittedValues(
  contract: DesignSampleFieldContract,
  values: Readonly<Record<string, string>>,
) {
  return Object.fromEntries(
    [...contract.identityFields, ...contract.observationFields]
      .filter((field) => field.editable)
      .flatMap((field) => {
        const value = values[field.code]?.trim() ?? "";
        return value === "" ? [] : [[field.code, value] as const];
      }),
  );
}

function catalogLabels(contract: DesignSampleFieldContract | undefined) {
  return {
    domain: new Map(contract?.domains.map(({ code, label }) => [code, label])),
    product: new Map(
      contract?.products.map(({ code, label }) => [code, label]),
    ),
    objectType: new Map(
      contract?.objectTypes.map(({ code, label }) => [code, label]),
    ),
  };
}

function enumLabel(value: string, index: number) {
  const labels: Readonly<Record<string, string>> = {
    GOOD: "良好",
    NORMAL: "正常",
    POOR: "偏弱",
    SUFFICIENT: "充足",
    TIGHT: "偏紧",
    OUT_OF_STOCK: "缺货",
    INCREASE: "增加",
    STABLE: "稳定",
    DECREASE: "减少",
  };
  return labels[value] ?? `选项${index + 1}`;
}

function errorMessage(
  error: unknown,
  fallback: string,
  contract?: DesignSampleFieldContract,
) {
  if (!(error instanceof RealtimeApiError)) return fallback;
  const fieldErrors = readableFieldErrors(error.details, contract);
  return (
    [error.clientMessage, ...fieldErrors].filter(Boolean).join("；") || fallback
  );
}

function readableFieldErrors(
  details: unknown,
  contract: DesignSampleFieldContract | undefined,
) {
  if (!isRecord(details)) return [];
  const values = isRecord(details.fieldErrors)
    ? details.fieldErrors
    : isRecord(details.errors)
      ? details.errors
      : {};
  const labels = new Map(
    contract
      ? [...contract.identityFields, ...contract.observationFields].map(
          (field) => [field.code, fieldLabel(field)] as const,
        )
      : [],
  );
  return Object.entries(values).flatMap(([code, message]) => {
    const label = labels.get(code);
    if (!label) return [];
    if (typeof message === "string") return [`${label}：${message}`];
    if (Array.isArray(message)) {
      return message
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => `${label}：${entry}`);
    }
    return [];
  });
}

function fieldLabel(field: DesignSampleFieldDefinition) {
  return field.code === "DSP_REGION_CODE" ? "行政区" : field.label;
}

function decimalStep(field: DesignSampleFieldDefinition) {
  if (field.valueType !== "DECIMAL" || field.scale === null) return undefined;
  return field.scale === 0 ? "1" : `0.${"0".repeat(field.scale - 1)}1`;
}

function formValue(value: unknown) {
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? String(value)
    : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requestKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `design-sample-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
