import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  realtimeBusinessRepository,
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

function statusLabel(status: string): string {
  return (
    (
      {
        DRAFT: "草稿",
        PENDING_REVIEW: "待审核",
        APPROVED: "审核通过",
        RETURNED: "退回补充",
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
  onCancel,
  onRecordsChanged,
  onSaved,
}: {
  productCode?: string;
  actorName?: string;
  repository?: RealtimeBusinessRepository;
  editorOnly?: boolean;
  onCancel?: () => void;
  onRecordsChanged?: () => void;
  onSaved?: () => void;
}) {
  const [definition, setDefinition] = useState<LogisticsDefinition | null>(
    null,
  );
  const [records, setRecords] = useState<readonly LogisticsRecordRow[]>([]);
  const [selected, setSelected] = useState<LogisticsRecordRow | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importJob, setImportJob] = useState<ProductionImportJob | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("正在读取物流业务定义…");
  const [returnReason, setReturnReason] = useState("");

  const fields = useMemo(() => definition?.fields ?? [], [definition]);
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
    setSelected(null);
    setValues(
      Object.fromEntries(
        editableFields.map((field) => [
          field.code,
          field.code === "LOG_REPORTER" ? actorName : "",
        ]),
      ),
    );
    setReturnReason("");
    setMessage("已新建空白物流记录，保存后生成正式记录");
  }

  async function openRecord(id: string) {
    setBusy(true);
    try {
      const record = await repository.getLogistics(id);
      setSelected(record);
      setValues(record.values);
      setMessage("已读取物流记录");
    } catch {
      setError("物流记录读取失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const record = selected
        ? await repository.updateLogistics(selected.id, {
            productCode,
            values,
            version: selected.version,
          })
        : await repository.createLogistics({ productCode, values });
      setSelected(record);
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

  async function transition(action: "submit" | "approve" | "return") {
    if (!selected) return;
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
      setValues(record.values);
      await reload();
      setMessage(
        `${action === "submit" ? "提交" : action === "approve" ? "审核通过" : "退回"}成功`,
      );
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
      anchor.download = `物流-${productCode}-批量导入模板.xlsx`;
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
    setError("");
    try {
      const initial = await repository.importLogisticsWorkbook(
        file,
        productCode,
      );
      const terminal = await awaitBusinessImport({
        repository,
        domain: "logistics",
        initial,
        onUpdate: setImportJob,
      });
      if (terminal.statusCode !== "FAILED") {
        await reload();
        onRecordsChanged?.();
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
        await reload();
        onRecordsChanged?.();
      }
    } catch {
      setError("物流批量导入任务重试失败，请稍后重试。");
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
  return (
    <section className="realtime-business-panel" aria-label="物流监测填报">
      <header>
        <div>
          <span>业务填报</span>
          <h2>物流监测填报</h2>
          <p>按当前产品和业务范围填写物流记录，提交后进入审核流程。</p>
        </div>
        {!editorOnly && (
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
        job={importJob}
        onDownloadErrors={() => void downloadImportErrors()}
        onRetry={() => void retryImport()}
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
                : "新建物流记录"}
            </strong>
          </header>
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
                      required={field.required}
                      value={values[field.code] ?? ""}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          [field.code]: event.target.value,
                        }))
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
                      required={field.required}
                      readOnly={field.readOnly}
                      type={fieldInputType(field.controlType)}
                      value={values[field.code] ?? ""}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          [field.code]: event.target.value,
                        }))
                      }
                    />
                  )}
                </label>
              );
            })}
          </div>
          <div className="realtime-business-actions">
            {editorOnly && (
              <button disabled={busy} type="button" onClick={onCancel}>
                取消并返回
              </button>
            )}
            <button disabled={busy || !definition} type="submit">
              保存物流记录
            </button>
            {selected && actions.has("SUBMIT") && (
              <button
                disabled={busy}
                type="button"
                onClick={() => void transition("submit")}
              >
                提交审核
              </button>
            )}
            {selected && actions.has("APPROVE") && (
              <button
                disabled={busy}
                type="button"
                onClick={() => void transition("approve")}
              >
                审核通过
              </button>
            )}
            {selected && actions.has("RETURN") && (
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
          </div>
          <p aria-live="polite" role={error ? "alert" : "status"}>
            {error || message}
          </p>
        </form>
      </div>
    </section>
  );
}
