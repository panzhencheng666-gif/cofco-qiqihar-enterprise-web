import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  realtimeBusinessRepository,
  type BusinessImportDraft,
  type LogisticsDefinition,
  type LogisticsRecordRow,
  type ProductionImportJob,
  type RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { BusinessImportStatus } from "../importing/BusinessImportStatus";
import {
  awaitBusinessImport,
  saveImportErrorFile,
} from "../importing/businessImportWorkflow";

type PanelMode = "entry" | "view" | "review";

const productNames: Readonly<Record<string, string>> = {
  CORN: "玉米",
  SOYBEAN: "大豆",
  RICE: "稻谷",
};

const publicLogisticsFieldOrder = [
  "surveyYear",
  "surveyMonth",
  "fillingDate",
  "LOG_SAMPLE_NAME",
  "LOG_REGION",
  "LOG_REPORTER",
  "LOG_REPORTER_PHONE",
  "LOG_SAMPLE_CONTACT",
  "LOG_SAMPLE_LATITUDE",
  "LOG_SAMPLE_LONGITUDE",
  "LOG_TRANSPORT_MODE",
  "LOG_DIRECTION",
  "LOG_ROUTE_VOLUME",
  "LOG_FREIGHT_RATE",
  "LOG_BOARD_PRICE",
  "LOG_STATUS",
] as const;
const publicLogisticsFields = new Set<string>(publicLogisticsFieldOrder);

function statusLabel(status: string): string {
  return (
    (
      {
        DRAFT: "草稿",
        PENDING_REVIEW: "待审核",
        APPROVED: "审核通过",
        RETURNED: "退回补充",
        VOIDED: "已作废",
      } as Record<string, string>
    )[status] ?? status
  );
}

function fieldInputType(controlType: string): "date" | "number" | "text" {
  if (controlType.includes("DATE")) return "date";
  if (controlType.includes("DECIMAL") || controlType.includes("NUMBER"))
    return "number";
  return "text";
}

export function RealtimeLogisticsOperationsPanel({
  productCode = "CORN",
  actorName = "当前登录员工",
  repository = realtimeBusinessRepository,
  editorOnly = false,
  mode = "entry",
  permissions = [],
  refreshToken = 0,
  initialRecordId,
  onCancel,
  onRecordsChanged,
  onSaved,
}: {
  productCode?: string;
  actorName?: string;
  repository?: RealtimeBusinessRepository;
  editorOnly?: boolean;
  mode?: PanelMode;
  permissions?: readonly string[];
  refreshToken?: number;
  initialRecordId?: string;
  onCancel?: () => void;
  onRecordsChanged?: () => void;
  onSaved?: () => void;
}) {
  const [definition, setDefinition] = useState<LogisticsDefinition | null>(
    null,
  );
  const [records, setRecords] = useState<readonly LogisticsRecordRow[]>([]);
  const [selected, setSelected] = useState<LogisticsRecordRow | null>(null);
  const selectedRecordId = useRef<string | undefined>(initialRecordId);
  const formDirty = useRef(false);
  const [recordLoadState, setRecordLoadState] = useState<
    "new" | "loading" | "loaded" | "failed"
  >(initialRecordId ? "loading" : "new");
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importJob, setImportJob] = useState<ProductionImportJob | null>(null);
  const [importDrafts, setImportDrafts] = useState<
    readonly BusinessImportDraft[]
  >([]);
  const [importPhotos, setImportPhotos] = useState<readonly File[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("正在读取物流业务定义…");
  const [returnReason, setReturnReason] = useState("");

  const fields = useMemo(() => {
    const byCode = new Map(
      (definition?.fields ?? [])
        .filter((field) => publicLogisticsFields.has(field.code))
        .map((field) => [field.code, field]),
    );
    return publicLogisticsFieldOrder.flatMap((code) => {
      const field = byCode.get(code);
      return field ? [field] : [];
    });
  }, [definition]);
  const editableFields = useMemo(
    () => fields.filter((field) => !field.readOnly),
    [fields],
  );

  const reload = useCallback(async () => {
    const page = await repository.listLogistics({ productCode, pageSize: 100 });
    setRecords(page.items);
  }, [productCode, repository]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      repository.loadLogisticsDefinition(productCode),
      repository.listLogistics({ productCode, pageSize: 100 }),
    ])
      .then(([nextDefinition, page]) => {
        if (cancelled) return;
        setDefinition(nextDefinition);
        setRecords(page.items);
        setError("");
        setMessage("已加载物流监测规则");
      })
      .catch(() => {
        if (!cancelled) setError("物流监测规则读取失败，请稍后重试。");
      });
    return () => {
      cancelled = true;
    };
  }, [productCode, repository]);

  function newRecord() {
    formDirty.current = false;
    setSelected(null);
    selectedRecordId.current = undefined;
    setRecordLoadState("new");
    setValues(
      Object.fromEntries(
        editableFields.map((field) => [
          field.code,
          field.code === "LOG_REPORTER"
            ? actorName
            : field.code === "surveyYear"
              ? String(new Date().getFullYear())
              : "",
        ]),
      ),
    );
    setReturnReason("");
    setMessage("已新建空白物流记录，保存后生成正式记录");
  }

  const openRecord = useCallback(
    async (id: string) => {
      selectedRecordId.current = id;
      setRecordLoadState("loading");
      setSelected(null);
      setBusy(true);
      setError("");
      try {
        const record = await repository.getLogistics(id);
        if (record.productCode.trim().toUpperCase() !== productCode) {
          setRecordLoadState("failed");
          setError("该物流记录不属于当前菜单品种，无法打开。");
          return;
        }
        setSelected(record);
        formDirty.current = false;
        setRecordLoadState("loaded");
        setValues(record.values);
        setMessage("已读取物流记录");
      } catch {
        setRecordLoadState("failed");
        setError("物流记录读取失败，请稍后重试。");
      } finally {
        setBusy(false);
      }
    },
    [productCode, repository],
  );

  useEffect(() => {
    let cancelled = false;
    if (initialRecordId) {
      void Promise.resolve().then(() => {
        if (!cancelled) return openRecord(initialRecordId);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [initialRecordId, openRecord]);

  useEffect(() => {
    if (refreshToken < 1) return;
    const recordId = selectedRecordId.current ?? initialRecordId;
    void Promise.resolve().then(async () => {
      await reload();
      if (recordId && !formDirty.current) await openRecord(recordId);
    });
  }, [initialRecordId, openRecord, refreshToken, reload]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (mode !== "entry") {
      setError("当前为只读处理界面，不能修改或新建物流记录。");
      return;
    }
    if (selected && !actions.has("SAVE")) {
      setError("该物流单据当前状态不允许修改，请按服务端分配的业务动作处理。");
      return;
    }
    if (recordLoadState === "loading" || recordLoadState === "failed") {
      setError("原物流记录尚未成功读取，不能按新建记录保存。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const editableValues = Object.fromEntries(
        editableFields.map(({ code }) => [code, values[code] ?? ""]),
      );
      const record = selected
        ? await repository.updateLogistics(selected.id, {
            productCode,
            values: editableValues,
            version: selected.version,
          })
        : await repository.createLogistics({
            productCode,
            values: editableValues,
          });
      setSelected(record);
      formDirty.current = false;
      setValues(record.values);
      await reload();
      onRecordsChanged?.();
      setMessage("保存成功");
      onSaved?.();
    } catch {
      setError("物流记录保存失败，请核对填报内容后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function transition(action: "submit" | "approve" | "return" | "void") {
    if (!selected) return;
    if (
      (action === "approve" && !permissions.includes("BUSINESS_APPROVE")) ||
      (action === "return" && !permissions.includes("BUSINESS_RETURN"))
    ) {
      setError("当前账号没有该业务审核权限。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const record = await repository.transitionLogistics(
        selected.id,
        action,
        selected.version,
        action === "return" ? returnReason : undefined,
      );
      setSelected(record);
      formDirty.current = false;
      setValues(record.values);
      await reload();
      setMessage(
        `${action === "submit" ? "提交" : action === "approve" ? "审核通过" : action === "return" ? "退回" : "作废"}成功`,
      );
      onRecordsChanged?.();
      if (mode === "review" && action !== "submit") onSaved?.();
    } catch {
      setError("物流记录处理失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function downloadWorkbook() {
    if (!repository.downloadLogisticsXlsxTemplate) return;
    setError("");
    try {
      const blob = await repository.downloadLogisticsXlsxTemplate(productCode);
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `物流-${productNames[productCode] ?? "粮食"}-批量导入模板.xlsx`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch {
      setError("物流 XLSX 模板下载失败，请稍后重试。");
    }
  }

  async function importWorkbook(file: File | undefined) {
    if (!file || !repository.importLogisticsWorkbook) return;
    setImporting(true);
    setImportJob(null);
    setImportDrafts([]);
    setError("");
    try {
      const initial = await repository.importLogisticsWorkbook(
        file,
        productCode,
        importPhotos,
      );
      const terminal = await awaitBusinessImport({
        repository,
        domain: "logistics",
        initial,
        onUpdate: setImportJob,
      });
      if (terminal.statusCode !== "FAILED") {
        setImportDrafts(
          (await repository.listImportDrafts?.(terminal.id)) ?? [],
        );
        setImportPhotos([]);
      }
    } catch {
      setError("物流记录导入失败，请核对 XLSX 模板内容后重试。");
    } finally {
      setImporting(false);
    }
  }

  async function retryImport() {
    if (!repository.retryImportJob || !importJob) return;
    setImporting(true);
    setError("");
    try {
      const initial = await repository.retryImportJob(
        "logistics",
        importJob.id,
      );
      const terminal = await awaitBusinessImport({
        repository,
        domain: "logistics",
        initial,
        onUpdate: setImportJob,
      });
      if (terminal.statusCode !== "FAILED") {
        setImportDrafts(
          (await repository.listImportDrafts?.(terminal.id)) ?? [],
        );
      }
    } catch {
      setError("物流批量导入任务重试失败，请稍后重试。");
    } finally {
      setImporting(false);
    }
  }

  async function submitImportDraft(draftId: string) {
    if (!repository.submitImportDraft) return;
    setImporting(true);
    setError("");
    try {
      const submitted = await repository.submitImportDraft(draftId);
      setImportDrafts((current) =>
        current.map((draft) => (draft.id === submitted.id ? submitted : draft)),
      );
      await reload();
      onRecordsChanged?.();
    } catch {
      setError(
        "该行已保留为草稿；如需提交审核，请在 XLSX 中补充基础信息后重新导入。",
      );
    } finally {
      setImporting(false);
    }
  }

  async function downloadImportErrors() {
    if (!repository.downloadImportErrors || !importJob) return;
    setError("");
    try {
      saveImportErrorFile(
        await repository.downloadImportErrors("logistics", importJob.id),
        "logistics",
        importJob.id,
      );
    } catch {
      setError("物流导入错误清单下载失败，请稍后重试。");
    }
  }

  const actions = new Set(
    selected?.allowedActions.map((action) => action.toUpperCase()) ?? [],
  );
  const canSave = mode === "entry" && (!selected || actions.has("SAVE"));
  const readOnlyMode =
    mode === "view" || mode === "review" || (Boolean(selected) && !canSave);
  const canApprove =
    mode === "review" &&
    permissions.includes("BUSINESS_APPROVE") &&
    actions.has("APPROVE");
  const canReturn =
    mode === "review" &&
    permissions.includes("BUSINESS_RETURN") &&
    actions.has("RETURN");
  const existingRecordUnavailable =
    recordLoadState === "loading" || recordLoadState === "failed";
  return (
    <section
      className="realtime-business-panel"
      aria-label={
        mode === "review"
          ? "物流监测单据审核"
          : mode === "view"
            ? "物流监测记录详情"
            : "物流监测填报"
      }
    >
      <header>
        <div>
          <span>
            {mode === "review"
              ? "业务审核"
              : mode === "view"
                ? "业务查看"
                : "业务填报"}
          </span>
          <h2>
            {mode === "review"
              ? "物流监测单据审核"
              : mode === "view"
                ? "物流监测记录详情"
                : "物流监测填报"}
          </h2>
          <p>
            {mode === "review"
              ? "只读核对原物流单据和当前状态，通过或填写原因退回；审核不会新建记录。"
              : mode === "view"
                ? "只读查看原物流记录，不会修改或新建记录。"
                : "按当前产品和业务范围填写物流记录，提交后进入审核流程。"}
          </p>
        </div>
        {!editorOnly && mode === "entry" && (
          <div className="realtime-business-header-actions">
            <button
              disabled={busy || importing}
              type="button"
              onClick={() => void downloadWorkbook()}
            >
              下载 XLSX 模板
            </button>
            <label className="realtime-business-file-action">
              导入 XLSX
              <input
                aria-label="导入 XLSX"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={busy || importing}
                type="file"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  void importWorkbook(file);
                }}
              />
            </label>
            <label className="realtime-business-file-action">
              附加照片（可选）
              <input
                aria-label="附加物流照片"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy || importing}
                multiple
                type="file"
                onChange={(event) =>
                  setImportPhotos(Array.from(event.target.files ?? []))
                }
              />
            </label>
            <button
              type="button"
              onClick={newRecord}
              disabled={busy || importing}
            >
              新建物流记录
            </button>
          </div>
        )}
      </header>
      <BusinessImportStatus
        busy={importing}
        className="realtime-business-message"
        drafts={importDrafts}
        job={importJob}
        onDownloadErrors={() => void downloadImportErrors()}
        onRetry={() => void retryImport()}
        onSubmitDraft={(draftId) => void submitImportDraft(draftId)}
      />
      {error && (
        <p className="realtime-business-error" role="alert">
          {error}
        </p>
      )}
      <div
        className={`realtime-business-layout${editorOnly ? " is-editor-only" : ""}`}
      >
        {!editorOnly && (
          <aside aria-label="物流业务记录">
            <strong>{records.length} 条业务记录</strong>
            <ul>
              {records.map((record) => (
                <li key={record.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void openRecord(record.id)}
                  >
                    <strong>
                      {record.displayValues.LOGISTICS_NODE ??
                        record.values.LOGISTICS_NODE ??
                        record.id}
                    </strong>
                    <span>{statusLabel(record.status)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {records.length === 0 && (
              <p role="status">暂无物流记录，可新建填报。</p>
            )}
          </aside>
        )}
        <form onSubmit={(event) => void save(event)}>
          <header>
            <strong>
              {selected
                ? `${selected.id} · ${statusLabel(selected.status)}`
                : recordLoadState === "loading"
                  ? "正在读取原物流记录"
                  : recordLoadState === "failed"
                    ? "原物流记录读取失败"
                    : "新建物流记录"}
            </strong>
          </header>
          <fieldset disabled={existingRecordUnavailable || readOnlyMode}>
            <legend>物流业务信息</legend>
            <div className="realtime-business-fields">
              {fields.map((field) => {
                const identityLocked = field.code === "LOG_REPORTER";
                const readOnly = identityLocked || field.readOnly;
                const readOnlyValue = selected
                  ? (selected.displayValues[field.code] ??
                    values[field.code] ??
                    (field.code === "LOG_STATUS"
                      ? statusLabel(selected.status)
                      : "—"))
                  : identityLocked
                    ? actorName
                    : "保存后由系统生成";
                return (
                  <label key={field.code}>
                    <span>
                      {field.label}
                      {field.required ? " *" : ""}
                      {field.unit ? `（${field.unit}）` : ""}
                    </span>
                    {readOnly ? (
                      <output aria-label={field.label}>{readOnlyValue}</output>
                    ) : field.options.length > 0 ? (
                      <select
                        aria-label={field.label}
                        required={field.required}
                        value={values[field.code] ?? ""}
                        onChange={(event) =>
                          setValues((current) => {
                            formDirty.current = true;
                            return {
                              ...current,
                              [field.code]: event.target.value,
                            };
                          })
                        }
                      >
                        <option value="">请选择</option>
                        {field.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        aria-label={field.label}
                        max={
                          field.code === "LOG_SAMPLE_LATITUDE"
                            ? 90
                            : field.code === "LOG_SAMPLE_LONGITUDE"
                              ? 180
                              : undefined
                        }
                        min={
                          field.code === "LOG_SAMPLE_LATITUDE"
                            ? -90
                            : field.code === "LOG_SAMPLE_LONGITUDE"
                              ? -180
                              : undefined
                        }
                        required={field.required}
                        readOnly={field.readOnly}
                        type={fieldInputType(field.controlType)}
                        value={values[field.code] ?? ""}
                        onChange={(event) =>
                          setValues((current) => {
                            formDirty.current = true;
                            return {
                              ...current,
                              [field.code]: event.target.value,
                            };
                          })
                        }
                      />
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="realtime-business-actions">
            {editorOnly && (
              <button disabled={busy} type="button" onClick={onCancel}>
                取消并返回
              </button>
            )}
            {canSave && (
              <button
                disabled={busy || !definition || existingRecordUnavailable}
                type="submit"
              >
                保存物流记录
              </button>
            )}
            {mode === "entry" && selected && actions.has("SUBMIT") && (
              <button
                disabled={busy}
                type="button"
                onClick={() => void transition("submit")}
              >
                提交审核
              </button>
            )}
            {mode === "entry" && selected && actions.has("VOID") && (
              <button
                disabled={busy}
                type="button"
                onClick={() => void transition("void")}
              >
                作废记录
              </button>
            )}
            {selected && canApprove && (
              <button
                disabled={busy}
                type="button"
                onClick={() => void transition("approve")}
              >
                审核通过
              </button>
            )}
            {selected && canReturn && (
              <>
                <input
                  aria-label="物流退回原因"
                  placeholder="填写退回原因"
                  value={returnReason}
                  onChange={(event) => setReturnReason(event.target.value)}
                />
                <button
                  disabled={busy || !returnReason.trim()}
                  type="button"
                  onClick={() => void transition("return")}
                >
                  退回补充
                </button>
              </>
            )}
            {mode === "review" && selected && !canApprove && !canReturn && (
              <p role="status">
                当前账号无可执行的审核操作，或该单据已离开待审核状态。
              </p>
            )}
          </div>
          <p aria-live="polite" role={error ? "alert" : "status"}>
            {error || message}
          </p>
        </form>
      </div>
    </section>
  );
}
