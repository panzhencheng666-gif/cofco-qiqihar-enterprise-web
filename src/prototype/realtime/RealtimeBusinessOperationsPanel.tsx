import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  realtimeBusinessRepository,
  type BusinessRecordListItem,
  type MarketDefinition,
  type MarketRecordRow,
  type MasterDataSnapshot,
  type MasterObjectType,
  type ProductionDefinition,
  type ProductionRecordRow,
  type RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import {
  definitionFields,
  marketPayloadFromValues,
  productionCoreFields,
  productionMetadataFields,
  productionPayloadFromValues,
  type RealtimeFormField,
} from "./realtimeRecordFormModel";
import { RealtimeRegionCascadePicker } from "./RealtimeRegionCascadePicker";

type Domain = "production" | "market";
type SelectedRecord = ProductionRecordRow | MarketRecordRow;

function inputType(field: RealtimeFormField): string {
  if (field.type === "date") return "date";
  return "text";
}

function statusLabel(status: string | undefined): string {
  const labels: Readonly<Record<string, string>> = {
    DRAFT: "草稿",
    PENDING_REVIEW: "待审核",
    APPROVED: "审核通过",
    RETURNED: "退回补充",
  };
  return status ? (labels[status] ?? status) : "新建填报";
}

function productName(code: string, master: MasterDataSnapshot | null): string {
  return (
    master?.products.find((product) => product.code === code)?.name ?? code
  );
}

function isAccountLockedReporter(code: string): boolean {
  return code === "PROD_REPORTER_NAME" || code === "MKT_REPORTER_NAME";
}

function productionValues(record: ProductionRecordRow): Record<string, string> {
  return {
    objectTypeCode: record.objectTypeCode,
    regionCode: record.regionCode,
    surveyDate: record.surveyDate,
    cultivatedAreaMu: record.cultivatedAreaMu,
    yieldPerMuKilograms: record.yieldPerMuKilograms,
    ...record.quality,
    ...record.costs,
    ...record.insurance,
    ...record.subsidies,
    ...record.submissionMetadata,
  };
}

function marketValues(record: MarketRecordRow): Record<string, string> {
  return { ...record.coreValues, ...record.facts };
}

export function RealtimeBusinessOperationsPanel({
  actorName,
  domain,
  lockedProductCode,
  repository = realtimeBusinessRepository,
  editorOnly = false,
  onCancel,
  onSaved,
  onRecordsChanged,
}: {
  actorName: string;
  domain: Domain;
  lockedProductCode: string;
  repository?: RealtimeBusinessRepository;
  editorOnly?: boolean;
  onCancel?: () => void;
  onSaved?: () => void;
  onRecordsChanged?: () => void;
}) {
  const productCode = lockedProductCode.trim().toUpperCase();
  const [master, setMaster] = useState<MasterDataSnapshot | null>(null);
  const [objectTypes, setObjectTypes] = useState<readonly MasterObjectType[]>(
    [],
  );
  const [definition, setDefinition] = useState<
    ProductionDefinition | MarketDefinition | null
  >(null);
  const [records, setRecords] = useState<readonly BusinessRecordListItem[]>([]);
  const [selected, setSelected] = useState<SelectedRecord | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [returnReason, setReturnReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("正在读取业务配置…");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<readonly File[]>([]);
  const [authenticatedName, setAuthenticatedName] = useState(actorName);
  const [identityError, setIdentityError] = useState("");

  useEffect(() => {
    if (!repository.loadCurrentSession) return;
    let cancelled = false;
    void repository
      .loadCurrentSession()
      .then((session) => {
        if (cancelled) return;
        setAuthenticatedName(session.displayName);
        setValues((current) => ({
          ...current,
          ...(domain === "production"
            ? { PROD_REPORTER_NAME: session.displayName }
            : { MKT_REPORTER_NAME: session.displayName }),
        }));
        setIdentityError("");
      })
      .catch(() => {
        if (!cancelled) {
          setIdentityError("登录账号资料读取失败，暂不能保存业务记录。");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [domain, repository]);

  useEffect(() => {
    let cancelled = false;
    void repository
      .loadMasterData()
      .then((snapshot) => {
        if (cancelled) return;
        setMaster(snapshot);
        setValues((current) => ({
          ...current,
          ...(domain === "production"
            ? { PROD_REPORTER_NAME: authenticatedName }
            : { MKT_REPORTER_NAME: authenticatedName }),
        }));
        const configured = snapshot.products.some(
          ({ code }) => code.toUpperCase() === productCode,
        );
        if (!configured) {
          setError("当前菜单品种尚未配置，暂不能填报。");
        }
        setMessage(configured ? "已加载业务填报规则" : "当前菜单品种尚未配置");
      })
      .catch(() => {
        if (!cancelled) setError("业务填报规则读取失败，请稍后重试。");
      });
    return () => {
      cancelled = true;
    };
  }, [authenticatedName, domain, productCode, repository]);

  async function reload(nextProductCode = productCode): Promise<void> {
    if (!nextProductCode) return;
    const page =
      domain === "production"
        ? await repository.listProduction({
            productCode: nextProductCode,
            pageSize: 100,
          })
        : await repository.listMarket({
            productCode: nextProductCode,
            pageSize: 100,
          });
    setRecords(page.items);
  }

  useEffect(() => {
    if (!productCode) return;
    let cancelled = false;
    const domainCode = domain === "production" ? "PRODUCTION" : "MARKET";
    void Promise.all([
      repository.listObjectTypes(productCode, domainCode),
      domain === "production"
        ? repository.listProduction({ productCode, pageSize: 100 })
        : repository.listMarket({ productCode, pageSize: 100 }),
    ])
      .then(([types, page]) => {
        if (cancelled) return;
        setObjectTypes(types);
        setRecords(page.items);
        setError("");
        const objectTypeCode = types[0]?.code ?? "";
        setValues((current) => ({
          ...(domain === "production"
            ? { PROD_REPORTER_NAME: authenticatedName }
            : { MKT_REPORTER_NAME: authenticatedName }),
          ...current,
          objectTypeCode,
          MKT_OBJECT_TYPE: objectTypeCode,
        }));
      })
      .catch(() => {
        if (!cancelled) setError("业务记录读取失败，请稍后重试。");
      });
    return () => {
      cancelled = true;
    };
  }, [authenticatedName, domain, productCode, repository]);

  useEffect(() => {
    if (!productCode) return;
    let cancelled = false;
    const refreshRecords = () => {
      void (
        domain === "production"
          ? repository.listProduction({ productCode, pageSize: 100 })
          : repository.listMarket({ productCode, pageSize: 100 })
      )
        .then((page) => {
          if (!cancelled) setRecords(page.items);
        })
        .catch(() => {
          if (!cancelled) setError("业务记录刷新失败，请稍后重试。");
        });
    };
    const timer = window.setInterval(refreshRecords, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [domain, productCode, repository]);

  const objectTypeCode =
    values.objectTypeCode ||
    values.MKT_OBJECT_TYPE ||
    objectTypes[0]?.code ||
    "";
  useEffect(() => {
    if (!productCode || !objectTypeCode) return;
    let cancelled = false;
    const request =
      domain === "production"
        ? repository.loadProductionDefinition(productCode, objectTypeCode)
        : repository.loadMarketDefinition(productCode, objectTypeCode);
    void request
      .then((nextDefinition) => {
        if (!cancelled) setDefinition(nextDefinition);
      })
      .catch(() => {
        if (!cancelled) setError("填报规则读取失败，请稍后重试。");
      });
    return () => {
      cancelled = true;
    };
  }, [domain, objectTypeCode, productCode, repository]);

  const fields = useMemo(() => {
    if (domain === "production") {
      const dynamic =
        definition && "groups" in definition
          ? definitionFields(definition)
          : [];
      return [...productionCoreFields, ...productionMetadataFields, ...dynamic];
    }
    if (!definition || !("coreFields" in definition)) return [];
    const core: RealtimeFormField[] = definition.coreFields.map((field) => ({
      code: field.code,
      label: field.label,
      type:
        field.controlType === "SELECT"
          ? "select"
          : field.controlType === "DATE"
            ? "date"
            : field.controlType === "DECIMAL"
              ? "decimal"
              : "text",
      required: field.required,
      readOnly: field.controlType.startsWith("READONLY"),
      unit: field.unit,
      options: field.options,
      section: "交易与对象",
    }));
    return [...core, ...definitionFields(definition)];
  }, [definition, domain]);

  const fieldSections = useMemo(() => {
    const sections = new Map<string, RealtimeFormField[]>();
    fields.forEach((field) => {
      const section = field.section ?? "其他信息";
      sections.set(section, [...(sections.get(section) ?? []), field]);
    });
    return [...sections.entries()];
  }, [fields]);

  function options(
    field: RealtimeFormField,
  ): readonly { value: string; label: string }[] {
    if (field.code === "objectTypeCode" || field.code === "MKT_OBJECT_TYPE")
      return objectTypes.map(({ code, name }) => ({
        value: code,
        label: name,
      }));
    if (field.code === "regionCode" || field.code === "MKT_REGION")
      return (
        master?.regions.map(({ code, name }) => ({
          value: code,
          label: name,
        })) ?? []
      );
    return field.options ?? [];
  }

  function edit(code: string, value: string) {
    if (isAccountLockedReporter(code)) return;
    setValues((current) => ({ ...current, [code]: value }));
  }

  function displayedValue(field: RealtimeFormField): string {
    if (field.code === "estimatedOutputKilograms") {
      const area = Number(values.cultivatedAreaMu);
      const yieldPerMu = Number(values.yieldPerMuKilograms);
      return Number.isFinite(area) && Number.isFinite(yieldPerMu)
        ? String(area * yieldPerMu)
        : "填写面积和单产后自动计算";
    }
    if (field.code === "yearOnYear") {
      return selected
        ? "由系统按上年同地区、同品种、同调查期计算"
        : "保存后由系统按同口径计算";
    }
    return values[field.code] || "正在读取登录账号…";
  }

  async function openRecord(id: string) {
    setBusy(true);
    setError("");
    try {
      const record =
        domain === "production"
          ? await repository.getProduction(id)
          : await repository.getMarket(id);
      if (record.productCode.trim().toUpperCase() !== productCode) {
        setSelected(null);
        setError("该记录不属于当前菜单品种，无法打开。");
        return;
      }
      setSelected(record);
      setEvidenceFiles([]);
      setValues(
        domain === "production"
          ? productionValues(record as ProductionRecordRow)
          : marketValues(record as MarketRecordRow),
      );
      setMessage("已读取业务记录");
    } catch {
      setError("业务记录读取失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  function newRecord() {
    setSelected(null);
    setReturnReason("");
    setEvidenceFiles([]);
    setValues({
      objectTypeCode: objectTypes[0]?.code ?? "",
      MKT_OBJECT_TYPE: objectTypes[0]?.code ?? "",
      ...(domain === "production"
        ? { PROD_REPORTER_NAME: authenticatedName }
        : { MKT_REPORTER_NAME: authenticatedName }),
    });
    setMessage("已新建空白填报，保存后生成正式记录");
    setError("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!definition) return;
    if (identityError) {
      setError(identityError);
      return;
    }
    if (!selected && (evidenceFiles.length < 1 || evidenceFiles.length > 5)) {
      setError("请上传 1–5 张现场水印照片后再保存。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const latitude =
        values[
          domain === "production"
            ? "PROD_SAMPLE_LATITUDE"
            : "MKT_SAMPLE_LATITUDE"
        ]?.trim() ?? "";
      const longitude =
        values[
          domain === "production"
            ? "PROD_SAMPLE_LONGITUDE"
            : "MKT_SAMPLE_LONGITUDE"
        ]?.trim() ?? "";
      const regionCode =
        values[domain === "production" ? "regionCode" : "MKT_REGION"] ?? "";
      const regionName =
        master?.regions.find((region) => region.code === regionCode)?.name ??
        regionCode;
      const evidencePhotoIds = selected
        ? []
        : await Promise.all(
            evidenceFiles.map(async (file) => {
              const photo = await repository.uploadEvidencePhoto({
                file,
                capturedAt: new Date().toISOString(),
                latitude,
                longitude,
                watermarkText:
                  `${regionName} ${domain === "production" ? "产情调查" : "市场采集"} ${authenticatedName}`.trim(),
              });
              return photo.id;
            }),
          );
      let record: SelectedRecord;
      if (domain === "production") {
        const payload = {
          ...productionPayloadFromValues(values, productCode, definition),
          evidencePhotoIds,
        };
        record = selected
          ? await repository.updateProduction(selected.id, {
              ...payload,
              version: selected.version,
            })
          : await repository.createProduction(payload);
      } else {
        const payload = {
          ...marketPayloadFromValues(
            values,
            productCode,
            definition as MarketDefinition,
          ),
          evidencePhotoIds,
        };
        record = selected
          ? await repository.updateMarket(selected.id, {
              ...payload,
              version: selected.version,
            })
          : await repository.createMarket(payload);
      }
      setSelected(record);
      setValues(
        domain === "production"
          ? productionValues(record as ProductionRecordRow)
          : marketValues(record as MarketRecordRow),
      );
      await reload(record.productCode);
      onRecordsChanged?.();
      setMessage("保存成功");
      onSaved?.();
    } catch {
      setError("保存失败，请核对填报内容后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function transition(action: "submit" | "approve" | "return") {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const record =
        domain === "production"
          ? await repository.transitionProduction(
              selected.id,
              action,
              selected.version,
              action === "return" ? returnReason : undefined,
            )
          : await repository.transitionMarket(
              selected.id,
              action,
              selected.version,
              action === "return" ? returnReason : undefined,
            );
      setSelected(record);
      await reload(record.productCode);
      onRecordsChanged?.();
      setMessage(
        `${action === "submit" ? "提交" : action === "approve" ? "审核通过" : "退回"}成功`,
      );
    } catch {
      setError("业务状态处理失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function importWorkbook(file: File | undefined) {
    if (!file) return;
    setImporting(true);
    setError("");
    try {
      const job =
        domain === "production"
          ? await repository.importProductionCsv(file)
          : await repository.importMarketWorkbook?.(file);
      if (!job) throw new Error("IMPORT_NOT_CONFIGURED");
      await reload(productCode);
      onRecordsChanged?.();
      setMessage(
        `导入完成：成功 ${job.importedRows} 条，失败 ${job.failedRows} 条。`,
      );
    } catch {
      setError(
        `${domain === "production" ? "产情" : "市场"}记录导入失败，请核对 XLSX 模板内容后重试。`,
      );
    } finally {
      setImporting(false);
    }
  }

  async function downloadWorkbook() {
    if (!productCode || !objectTypeCode) return;
    setError("");
    try {
      const blob =
        domain === "production"
          ? await repository.downloadProductionXlsxTemplate?.(
              productCode,
              objectTypeCode,
            )
          : await repository.downloadMarketXlsxTemplate?.(
              productCode,
              objectTypeCode,
            );
      if (!blob) throw new Error("TEMPLATE_NOT_CONFIGURED");
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `${domain === "production" ? "产情" : "市场"}-${productCode}-${objectTypeCode}-批量导入模板.xlsx`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch {
      setError("XLSX 模板下载失败，请稍后重试。");
    }
  }

  const allowed = new Set(
    selected?.allowedActions.map((action) => action.toUpperCase()) ?? [],
  );
  return (
    <section
      aria-label={domain === "production" ? "产情填报" : "市场采集"}
      className="realtime-business-panel"
    >
      <header>
        <div>
          <span>业务填报</span>
          <h2>{domain === "production" ? "产情填报" : "市场采集"}</h2>
          <p>按当前账号的业务范围填写并保存记录，提交后进入审核流程。</p>
        </div>
        <div className="realtime-business-header-actions">
          {!editorOnly && (
            <>
              <button
                type="button"
                disabled={busy || importing || !productCode || !objectTypeCode}
                onClick={() => void downloadWorkbook()}
              >
                下载 XLSX 模板
              </button>
              <label className="realtime-business-file-action">
                导入 XLSX
                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  disabled={busy || importing}
                  onChange={(event) =>
                    void importWorkbook(event.target.files?.[0])
                  }
                />
              </label>
            </>
          )}
          {!editorOnly && (
            <button
              type="button"
              onClick={newRecord}
              disabled={busy || importing}
            >
              新建填报
            </button>
          )}
        </div>
      </header>
      <div
        className={`realtime-business-layout${editorOnly ? " is-editor-only" : ""}`}
      >
        {!editorOnly && (
          <aside aria-label="业务记录">
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
                      {record.values.PROD_REGION ??
                        record.values.MKT_REGION ??
                        record.id}
                    </strong>
                    <span>
                      {record.values.PROD_STATUS ??
                        record.values.MKT_STATUS ??
                        "状态待读取"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {records.length === 0 && (
              <p role="status">
                {productName(productCode, master)}暂无记录，可新建填报。
              </p>
            )}
          </aside>
        )}
        <form onSubmit={(event) => void save(event)}>
          <header>
            <strong>
              {selected
                ? `${selected.id} · ${statusLabel(selected.status)}`
                : "新建填报"}
            </strong>
          </header>
          <div className="realtime-business-sections">
            {fieldSections.map(([section, sectionFields]) => (
              <fieldset key={section}>
                <legend>{section}</legend>
                <div className="realtime-business-fields">
                  {sectionFields.map((field) => {
                    const fieldOptions = options(field);
                    const accountLocked = isAccountLockedReporter(field.code);
                    const readOnly = accountLocked || field.readOnly;
                    const regionField =
                      field.code === "regionCode" ||
                      field.code === "MKT_REGION";
                    const visibleOptions = fieldOptions;
                    if (regionField) {
                      return (
                        <div
                          className="realtime-business-field realtime-business-field--region"
                          key={field.code}
                        >
                          <span>{field.label} *</span>
                          <RealtimeRegionCascadePicker
                            regions={master?.regions ?? []}
                            value={values[field.code] ?? ""}
                            onChange={(regionCode) =>
                              edit(field.code, regionCode)
                            }
                          />
                        </div>
                      );
                    }
                    return (
                      <label key={field.code}>
                        <span>
                          {field.label}
                          {accountLocked ? "（账号锁定）" : ""}
                          {field.required ? " *" : ""}
                          {field.unit ? `（${field.unit}）` : ""}
                        </span>
                        {readOnly ? (
                          <output aria-label={field.label}>
                            {displayedValue(field)}
                          </output>
                        ) : fieldOptions.length > 0 ||
                          field.type === "select" ? (
                          <select
                            aria-label={field.label}
                            required={field.required}
                            value={values[field.code] ?? ""}
                            onChange={(event) =>
                              edit(field.code, event.target.value)
                            }
                          >
                            <option value="">请选择</option>
                            {visibleOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            aria-label={field.label}
                            inputMode={
                              field.type === "decimal" ? "decimal" : undefined
                            }
                            required={field.required}
                            type={inputType(field)}
                            value={values[field.code] ?? ""}
                            onChange={(event) =>
                              edit(field.code, event.target.value)
                            }
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            {!selected && (
              <fieldset>
                <legend>现场照片</legend>
                <label className="realtime-business-evidence-upload">
                  <span>现场水印照片（1–5 张） *</span>
                  <input
                    aria-label="现场水印照片"
                    accept="image/jpeg,image/png"
                    multiple
                    type="file"
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      if (files.length > 5) {
                        setEvidenceFiles([]);
                        setError("现场水印照片最多上传 5 张。");
                        event.target.value = "";
                        return;
                      }
                      setEvidenceFiles(files);
                      setError("");
                    }}
                  />
                  <small>
                    {evidenceFiles.length > 0
                      ? `已选择 ${evidenceFiles.length} 张：${evidenceFiles.map((file) => file.name).join("、")}`
                      : "照片将按填报坐标和时间生成水印；保存后，具有该地区业务读取权限的员工均可查看。"}
                  </small>
                </label>
              </fieldset>
            )}
          </div>
          <div className="realtime-business-actions">
            {editorOnly && (
              <button disabled={busy} type="button" onClick={onCancel}>
                取消并返回
              </button>
            )}
            <button disabled={busy || !definition} type="submit">
              保存业务记录
            </button>
            {selected && allowed.has("SUBMIT") && (
              <button
                disabled={busy}
                type="button"
                onClick={() => void transition("submit")}
              >
                提交审核
              </button>
            )}
            {selected && allowed.has("APPROVE") && (
              <button
                disabled={busy}
                type="button"
                onClick={() => void transition("approve")}
              >
                审核通过
              </button>
            )}
            {selected && allowed.has("RETURN") && (
              <>
                <input
                  aria-label="退回原因"
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
