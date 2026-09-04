import { useCallback, useEffect, useRef, useState } from "react";

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
import type { FormalSelection } from "../formalEnterpriseModel";
import { SamplePointImportPanel } from "../formal-sample/SamplePointImportPanel";
import {
  SamplePointEditorForm,
  SamplePointLedgerFilters,
  SamplePointLedgerPage,
  SamplePointLedgerPagination,
  SamplePointLedgerRowActions,
  SamplePointLedgerTable,
  SamplePointLedgerTitle,
  SamplePointLedgerToolbar,
} from "../formal-sample/SamplePointLedgerPrimitives";

const PAGE_SIZE = 20;
const BOOTSTRAP_CONTEXT: DesignSampleContext = {
  domainCode: "PRODUCTION",
  productCode: "CORN",
  objectTypeCode: "FARMER",
};
const LOCATION_FIELD_CODES = new Set([
  "DSP_NAME",
  "DSP_REGION_CODE",
  "DSP_ADDRESS",
  "DSP_LONGITUDE",
  "DSP_LATITUDE",
  "DSP_MAINTAINER_NAME",
  "DSP_MAINTAINER_UNIT",
]);
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
  selection,
  onSelectionChange,
  onSelectionClear,
  standalone = false,
}: {
  onListStateChange: (state: ListState, total?: number) => void;
  refreshSequence: number;
  repository: RealtimeBusinessRepository;
  session: CurrentSession;
  selection?: FormalSelection;
  onSelectionChange?: (selection: FormalSelection) => void;
  onSelectionClear?: () => void;
  standalone?: boolean;
}) {
  const [listState, setListState] = useState<ListState>("loading");
  const [pageData, setPageData] =
    useState<Page<DesignSamplePointRow>>(EMPTY_PAGE);
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [filterDraft, setFilterDraft] = useState({
    keyword: "",
    regionCode: "",
    domainCode: "",
    productCode: "",
    objectTypeCode: "",
  });
  const [filters, setFilters] = useState(filterDraft);
  const [regions, setRegions] = useState<readonly MasterRegion[]>([]);
  const [catalog, setCatalog] = useState<DesignSampleFieldContract>();
  const [editor, setEditor] = useState<Editor>();
  const [viewPoint, setViewPoint] = useState<DesignSamplePointRow>();
  const [editorContract, setEditorContract] =
    useState<DesignSampleFieldContract>();
  const [editorContext, setEditorContext] =
    useState<DesignSampleContext>(BOOTSTRAP_CONTEXT);
  const [editorValues, setEditorValues] = useState<Record<string, string>>({});
  const [editorError, setEditorError] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const hydratedSelection = useRef("");
  const canWrite = session.permissions.includes("BUSINESS_UPDATE");
  const canImport = session.permissions.includes("BUSINESS_IMPORT");
  const showList = true;
  const navigate = (next: FormalSelection) => onSelectionChange?.(next);

  useEffect(() => {
    let active = true;
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
    void repository
      .loadDesignSamplePointFields?.(BOOTSTRAP_CONTEXT)
      .then((contract) => {
        if (active) setCatalog(contract);
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
      setEditorContext(context);
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
        setEditorContract(contract);
      } catch (error) {
        setEditorError(errorMessage(error, "字段信息暂不可用，请稍后重试。"));
      }
    },
    [repository],
  );

  const changeEditorContext = (partial: Partial<DesignSampleContext>) => {
    const definition = catalog ?? editorContract;
    if (!definition || !repository.loadDesignSamplePointFields) return;
    const requested = { ...editorContext, ...partial };
    const next =
      definition.supportedContexts.find(
        (candidate) =>
          candidate.domainCode === requested.domainCode &&
          candidate.productCode === requested.productCode &&
          candidate.objectTypeCode === requested.objectTypeCode,
      ) ??
      definition.supportedContexts.find(
        (candidate) =>
          candidate.domainCode === requested.domainCode &&
          candidate.productCode === requested.productCode,
      ) ??
      definition.supportedContexts.find(
        (candidate) => candidate.domainCode === requested.domainCode,
      );
    if (!next) return;
    const context = {
      domainCode: next.domainCode,
      productCode: next.productCode,
      objectTypeCode: next.objectTypeCode,
    };
    setEditorContext(context);
    setEditorContract(undefined);
    setEditorError("");
    void repository
      .loadDesignSamplePointFields(context)
      .then(setEditorContract)
      .catch((error) =>
        setEditorError(errorMessage(error, "字段信息暂不可用，请稍后重试。")),
      );
  };

  useEffect(() => {
    if (!selection || !selection.type.startsWith("design-sample-")) return;
    const key = `${selection.type}:${selection.id}`;
    if (hydratedSelection.current === key) return;
    hydratedSelection.current = key;
    if (selection.type === "design-sample-list") {
      queueMicrotask(() => {
        setActionError("");
        setEditor(undefined);
        setViewPoint(undefined);
      });
      return;
    }
    if (selection.type === "design-sample-create") {
      queueMicrotask(() => {
        setActionError("");
        setViewPoint(undefined);
        void loadEditor({ mode: "create" });
      });
      return;
    }
    if (!repository.getDesignSamplePoint) {
      queueMicrotask(() =>
        setActionError("最新点位信息暂不可用，请稍后重试。"),
      );
      return;
    }
    void repository
      .getDesignSamplePoint(selection.id)
      .then((point) => {
        if (selection.type === "design-sample-view") {
          setEditor(undefined);
          setViewPoint(point);
        } else if (selection.type === "design-sample-edit") {
          setViewPoint(undefined);
          void loadEditor({ mode: "edit", point });
        }
      })
      .catch((error: unknown) =>
        setActionError(
          errorMessage(error, "最新点位信息暂不可用，请稍后重试。"),
        ),
      );
  }, [loadEditor, repository, selection]);

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
      values: submittedValues(editorContract, {
        ...editorValues,
        DSP_MAINTAINER_NAME: session.displayName,
        DSP_MAINTAINER_UNIT: session.workUnitName,
      }),
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
    navigate({ type: "design-sample-view", id: saved.id });
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
      navigate({ type: "design-sample-list", id: "list" });
    } catch (error) {
      setActionError(errorMessage(error, "删除失败，请刷新清单后重试。"));
    }
  };

  return (
    <SamplePointLedgerPage
      ariaLabel="设计参考点台账工作台"
      className="sample-point-governance-workspace__table-region design-sample-ledger formal-sample-ledger enterprise-ledger-workbench"
    >
      {onSelectionClear ? (
        <div className="enterprise-ledger-table__toolbar">
          <button onClick={onSelectionClear} type="button">
            返回业务台账
          </button>
        </div>
      ) : null}
      {showList ? (
        <>
          <SamplePointLedgerTitle
            description="维护长期参考点。行政区覆盖、坐标范围和适用字段由系统校验。"
            title={standalone ? "设计样本点" : "设计参考点清单"}
          />

          <SamplePointLedgerFilters ariaLabel="设计参考点筛选">
            <label>
              <span>参考类别</span>
              <select
                aria-label="筛选参考类别"
                onChange={(event) =>
                  setFilterDraft((current) => ({
                    ...current,
                    domainCode: event.target.value,
                    objectTypeCode: "",
                  }))
                }
                value={filterDraft.domainCode}
              >
                <option value="">全部类别</option>
                {catalog?.domains
                  .filter((option) => option.code !== "REFERENCE")
                  .map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}类
                    </option>
                  ))}
              </select>
            </label>
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
            <label>
              <span>品种</span>
              <select
                aria-label="筛选品种"
                onChange={(event) =>
                  setFilterDraft((current) => ({
                    ...current,
                    productCode: event.target.value,
                  }))
                }
                value={filterDraft.productCode}
              >
                <option value="">全部品种</option>
                {catalog?.products
                  .filter((option) => option.code !== "GENERAL")
                  .map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span>参考对象类型</span>
              <select
                aria-label="筛选参考对象类型"
                onChange={(event) =>
                  setFilterDraft((current) => ({
                    ...current,
                    objectTypeCode: event.target.value,
                  }))
                }
                value={filterDraft.objectTypeCode}
              >
                <option value="">全部对象类型</option>
                {catalog?.objectTypes
                  .filter(
                    (option) =>
                      option.domainCode !== "REFERENCE" &&
                      (!filterDraft.domainCode ||
                        option.domainCode === filterDraft.domainCode),
                  )
                  .map((option) => (
                    <option
                      key={`${option.domainCode}:${option.code}`}
                      value={option.code}
                    >
                      {option.label}
                    </option>
                  ))}
              </select>
            </label>
            <div className="enterprise-ledger-query__actions">
              <button
                className="is-primary"
                type="button"
                onClick={() => {
                  setPage(0);
                  setFilters(filterDraft);
                }}
              >
                查询
              </button>
              <button
                disabled={!Object.values(filterDraft).some(Boolean)}
                onClick={() => {
                  const empty = {
                    keyword: "",
                    regionCode: "",
                    domainCode: "",
                    productCode: "",
                    objectTypeCode: "",
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
          </SamplePointLedgerFilters>

          {actionError ? <p role="alert">{actionError}</p> : null}
          {listState === "loading" ? (
            <p role="status">正在读取设计参考点清单…</p>
          ) : null}
          {listState === "unavailable" ? (
            <p role="alert">设计参考点清单暂不可用，请稍后重试。</p>
          ) : null}
          {listState === "ready" ? (
            <>
              <SamplePointLedgerTable
                ariaLabel="设计参考点清单"
                className="formal-sample-ledger__table enterprise-ledger-table enterprise-ledger-table--compact"
                headers={[
                  "参考类别",
                  "点位名称",
                  "行政区",
                  "详细地址",
                  "坐标",
                  "品种",
                  "参考对象类型",
                  "维护人/维护单位",
                  "操作",
                ]}
                scrollClassName="sample-point-governance-workspace__table-scroll--bounded enterprise-ledger-table__scroll"
                scrollAriaLabel="设计参考点滚动清单"
                scrollTabIndex={0}
                toolbar={
                  <SamplePointLedgerToolbar
                    ariaLabel="设计参考点批量操作"
                    count={`共 ${pageData.totalElements} 个参考点，当前显示 ${pageData.items.length} 个`}
                  >
                    {canImport ? (
                      <SamplePointImportPanel
                        kind="design"
                        repository={repository}
                        onImported={() => reload()}
                        variant="ledger-toolbar"
                      />
                    ) : null}
                    {canWrite ? (
                      <div className="enterprise-ledger-action-group enterprise-ledger-action-group--primary">
                        <span className="enterprise-ledger-action-group__label">
                          点位维护
                        </span>
                        <button
                          onClick={() => {
                            if (onSelectionChange) {
                              navigate({
                                type: "design-sample-create",
                                id: "new",
                              });
                            } else void loadEditor({ mode: "create" });
                          }}
                          type="button"
                        >
                          新建设计参考点
                        </button>
                      </div>
                    ) : null}
                  </SamplePointLedgerToolbar>
                }
                empty={
                  pageData.items.length === 0
                    ? "没有符合条件的设计参考点。"
                    : undefined
                }
                footer={
                  <SamplePointLedgerPagination
                    pageNumber={pageData.pageNumber}
                    pageCount={pageCount}
                    onPrevious={() =>
                      setPage((value) => Math.max(0, value - 1))
                    }
                    onNext={() => setPage((value) => value + 1)}
                  />
                }
              >
                {pageData.items.map((point) => (
                  <tr key={point.id}>
                    <td>
                      {optionLabel(
                        catalog?.domains,
                        point.context.domainCode,
                        "类",
                      )}
                    </td>
                    <td>{point.name}</td>
                    <td>{point.regionPath}</td>
                    <td>{displayValue(point.values.DSP_ADDRESS)}</td>
                    <td>
                      {point.longitude}, {point.latitude}
                    </td>
                    <td>
                      {optionLabel(
                        catalog?.products,
                        point.context.productCode,
                      )}
                    </td>
                    <td>{objectTypeLabel(catalog, point.context)}</td>
                    <td>{maintainerLabel(point)}</td>
                    <td>
                      <SamplePointLedgerRowActions>
                        <button
                          aria-label={`查看${point.name}`}
                          className="enterprise-ledger-row-action"
                          onClick={() => {
                            if (onSelectionChange) {
                              navigate({
                                type: "design-sample-view",
                                id: point.id,
                              });
                            } else setViewPoint(point);
                          }}
                          type="button"
                        >
                          查看
                        </button>
                        {canWrite ? (
                          <>
                            <button
                              aria-label={`编辑${point.name}`}
                              className="enterprise-ledger-row-action"
                              onClick={() => {
                                if (onSelectionChange) {
                                  navigate({
                                    type: "design-sample-edit",
                                    id: point.id,
                                  });
                                } else void loadEditor({ mode: "edit", point });
                              }}
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
                          </>
                        ) : null}
                      </SamplePointLedgerRowActions>
                    </td>
                  </tr>
                ))}
              </SamplePointLedgerTable>
            </>
          ) : null}
        </>
      ) : null}

      {viewPoint ? (
        <section
          className="design-sample-point-page enterprise-ledger-drawer"
          aria-label="设计参考点详情"
        >
          <header>
            <div>
              <h3>{viewPoint.name}</h3>
              <p>设计参考点稳定信息</p>
            </div>
          </header>
          <dl>
            <div>
              <dt>点位名称</dt>
              <dd>{viewPoint.name}</dd>
            </div>
            <div>
              <dt>行政区</dt>
              <dd>{viewPoint.regionPath}</dd>
            </div>
            <div>
              <dt>详细地址</dt>
              <dd>{displayValue(viewPoint.values.DSP_ADDRESS)}</dd>
            </div>
            <div>
              <dt>坐标</dt>
              <dd>
                {viewPoint.longitude}，{viewPoint.latitude}
              </dd>
            </div>
          </dl>
          <div className="design-sample-point-page__actions">
            {canWrite ? (
              <button
                type="button"
                onClick={() =>
                  navigate({ type: "design-sample-edit", id: viewPoint.id })
                }
              >
                编辑
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setViewPoint(undefined);
                navigate({ type: "design-sample-list", id: "list" });
              }}
            >
              返回设计样本台账
            </button>
          </div>
        </section>
      ) : null}

      {editor ? (
        <DesignSamplePointEditor
          catalog={catalog ?? editorContract}
          contract={editorContract}
          context={editorContext}
          error={editorError}
          mode={editor.mode}
          onCancel={() => {
            setEditor(undefined);
            navigate({ type: "design-sample-list", id: "list" });
          }}
          onContextChange={changeEditorContext}
          onSave={() => void save()}
          onValueChange={(code, value) =>
            setEditorValues((current) => ({ ...current, [code]: value }))
          }
          regions={regions}
          saving={saving}
          session={session}
          values={editorValues}
        />
      ) : null}
    </SamplePointLedgerPage>
  );
}

function DesignSamplePointEditor({
  catalog,
  contract,
  context,
  error,
  mode,
  onCancel,
  onContextChange,
  onSave,
  onValueChange,
  regions,
  saving,
  session,
  values,
}: {
  catalog: DesignSampleFieldContract | undefined;
  contract: DesignSampleFieldContract | undefined;
  context: DesignSampleContext;
  error: string;
  mode: "create" | "edit";
  onCancel: () => void;
  onContextChange: (context: Partial<DesignSampleContext>) => void;
  onSave: () => void;
  onValueChange: (code: string, value: string) => void;
  regions: readonly MasterRegion[];
  saving: boolean;
  session: CurrentSession;
  values: Readonly<Record<string, string>>;
}) {
  const fields = contract
    ? contract.identityFields.filter(
        (field) => field.editable && LOCATION_FIELD_CODES.has(field.code),
      )
    : [];
  return (
    <SamplePointEditorForm
      ariaLabel={mode === "create" ? "新建设计参考点" : "编辑设计参考点"}
      title={mode === "create" ? "新建设计参考点" : "编辑设计参考点"}
      description="填写点位名称、行政区、详细地址和经纬度。"
      role="form"
      notice={error ? <p role="alert">{error}</p> : null}
      actions={
        <>
          <button disabled={!contract || saving} type="button" onClick={onSave}>
            {saving ? "保存中…" : "保存"}
          </button>
          <button onClick={onCancel} type="button">
            取消
          </button>
        </>
      }
    >
      {catalog ? (
        <>
          <label>
            <span>参考类别</span>
            <select
              aria-label="参考类别"
              value={context.domainCode}
              onChange={(event) =>
                onContextChange({ domainCode: event.target.value })
              }
            >
              {catalog.domains
                .filter((option) => option.code !== "REFERENCE")
                .map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}类
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span>品种</span>
            <select
              aria-label="品种"
              value={context.productCode}
              onChange={(event) =>
                onContextChange({ productCode: event.target.value })
              }
            >
              {catalog.products
                .filter((option) =>
                  catalog.supportedContexts.some(
                    (candidate) =>
                      candidate.domainCode === context.domainCode &&
                      candidate.productCode === option.code,
                  ),
                )
                .map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span>参考对象类型</span>
            <select
              aria-label="参考对象类型"
              value={context.objectTypeCode}
              onChange={(event) =>
                onContextChange({ objectTypeCode: event.target.value })
              }
            >
              {catalog.objectTypes
                .filter(
                  (option) =>
                    option.domainCode === context.domainCode &&
                    catalog.supportedContexts.some(
                      (candidate) =>
                        candidate.domainCode === context.domainCode &&
                        candidate.productCode === context.productCode &&
                        candidate.objectTypeCode === option.code,
                    ),
                )
                .map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
            </select>
          </label>
        </>
      ) : null}
      {contract ? (
        <>
          {fields.map((field) => (
            <MetadataField
              disabled={
                field.code === "DSP_MAINTAINER_NAME" ||
                field.code === "DSP_MAINTAINER_UNIT"
              }
              field={field}
              key={field.code}
              onChange={(value) => onValueChange(field.code, value)}
              regions={regions}
              value={
                field.code === "DSP_MAINTAINER_NAME"
                  ? session.displayName
                  : field.code === "DSP_MAINTAINER_UNIT"
                    ? session.workUnitName
                    : (values[field.code] ?? "")
              }
            />
          ))}
        </>
      ) : error ? null : (
        <p role="status">正在读取适用填写项…</p>
      )}
    </SamplePointEditorForm>
  );
}

function MetadataField({
  disabled = false,
  field,
  onChange,
  regions,
  value,
}: {
  disabled?: boolean;
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
    <label
      className={
        field.code === "DSP_ADDRESS" ? "formal-sample-page__address" : undefined
      }
    >
      <span>{label}</span>
      <input
        aria-label={label}
        disabled={disabled}
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
    contract.identityFields
      .filter((field) => field.editable && LOCATION_FIELD_CODES.has(field.code))
      .flatMap((field) => {
        const value = values[field.code]?.trim() ?? "";
        return value === "" ? [] : [[field.code, value] as const];
      }),
  );
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

function displayValue(value: unknown) {
  return formValue(value).trim() || "未填写";
}

function optionLabel(
  options: readonly { code: string; label: string }[] | undefined,
  code: string,
  suffix = "",
) {
  const label = options?.find((option) => option.code === code)?.label;
  return label ? `${label}${suffix}` : code;
}

function objectTypeLabel(
  contract: DesignSampleFieldContract | undefined,
  context: DesignSampleContext,
) {
  return (
    contract?.objectTypes.find(
      (option) =>
        option.domainCode === context.domainCode &&
        option.code === context.objectTypeCode,
    )?.label ?? context.objectTypeCode
  );
}

function maintainerLabel(point: DesignSamplePointRow) {
  const name = formValue(point.values.DSP_MAINTAINER_NAME).trim();
  const unit = formValue(point.values.DSP_MAINTAINER_UNIT).trim();
  return [name, unit].filter(Boolean).join(" / ") || "未填写";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requestKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `design-sample-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
