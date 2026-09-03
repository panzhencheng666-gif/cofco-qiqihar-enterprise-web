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
  type BusinessRecordListItem,
  type MarketDefinition,
  type MarketRecordRow,
  type MasterDataSnapshot,
  type MasterObjectType,
  type ProductionDefinition,
  type ProductionImportJob,
  type ProductionRecordRow,
  type RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";
import { BusinessImportStatus } from "../importing/BusinessImportStatus";
import {
  awaitBusinessImport,
  saveImportErrorFile,
} from "../importing/businessImportWorkflow";
import {
  decimalInputConstraints,
  marketFields,
  marketPayloadFromValues,
  productionFields,
  productionPayloadFromValues,
  type RealtimeFormField,
} from "./realtimeRecordFormModel";
import { RealtimeRegionCascadePicker } from "./RealtimeRegionCascadePicker";

type Domain = "production" | "market";
type SelectedRecord = ProductionRecordRow | MarketRecordRow;
type PanelMode = "entry" | "view" | "review";

function inputType(field: RealtimeFormField): string {
  if (field.type === "date") return "date";
  if (field.type === "decimal") return "number";
  return "text";
}

function statusLabel(status: string | undefined): string {
  const labels: Readonly<Record<string, string>> = {
    DRAFT: "草稿",
    PENDING_REVIEW: "待审核",
    APPROVED: "审核通过",
    RETURNED: "退回补充",
    VOIDED: "已作废",
  };
  return status ? (labels[status] ?? status) : "新建填报";
}

function businessRecordLabel(values: Readonly<Record<string, string>>): string {
  return (
    values.PROD_SAMPLE_NAME ??
    values.MKT_SAMPLE_NAME ??
    values.PROD_REGION ??
    values.MKT_REGION ??
    "业务记录"
  );
}

function productName(code: string, master: MasterDataSnapshot | null): string {
  return (
    master?.products.find((product) => product.code === code)?.name ?? code
  );
}

function isAccountLockedReporter(code: string): boolean {
  return code === "PROD_REPORTER_NAME" || code === "MKT_REPORTER_NAME";
}

const retainedObjectIdentityCodes: Readonly<
  Record<Domain, ReadonlySet<string>>
> = {
  production: new Set([
    "surveyYear",
    "surveyMonth",
    "surveyDate",
    "regionCode",
    "PROD_SAMPLE_NAME",
    "PROD_REPORTER_NAME",
    "PROD_SURVEYOR_NAME",
    "PROD_SURVEYOR_PHONE",
    "PROD_SAMPLE_CONTACT",
    "PROD_SAMPLE_LATITUDE",
    "PROD_SAMPLE_LONGITUDE",
  ]),
  market: new Set([
    "surveyYear",
    "surveyMonth",
    "MKT_REGION",
    "MKT_SAMPLE_NAME",
    "MKT_REPORTER_NAME",
    "MKT_SURVEYOR_NAME",
    "MKT_SURVEYOR_PHONE",
    "MKT_SAMPLE_CONTACT",
    "MKT_SAMPLE_LATITUDE",
    "MKT_SAMPLE_LONGITUDE",
  ]),
};

function productionValues(record: ProductionRecordRow): Record<string, string> {
  const [legacyYear = "", legacyMonth = ""] = (record.surveyDate ?? "").split(
    "-",
  );
  return {
    objectTypeCode: record.objectTypeCode,
    regionCode: record.regionCode,
    surveyDate: record.surveyDate ?? "",
    surveyYear:
      record.surveyYear != null ? String(record.surveyYear) : legacyYear,
    surveyMonth:
      record.surveyMonth != null
        ? String(record.surveyMonth)
        : legacyMonth
          ? String(Number(legacyMonth))
          : "",
    fillingDate: record.fillingDate || record.reportedAt.slice(0, 10),
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
  const [legacyYear = "", legacyMonth = ""] = (
    record.coreValues.MKT_TRADE_DATE ?? ""
  ).split("-");
  return {
    ...record.coreValues,
    ...record.facts,
    surveyYear: record.surveyYear || legacyYear,
    surveyMonth:
      record.surveyMonth || (legacyMonth ? String(Number(legacyMonth)) : ""),
  };
}

export function RealtimeBusinessOperationsPanel({
  actorName,
  domain,
  lockedProductCode,
  repository = realtimeBusinessRepository,
  editorOnly = false,
  mode = "entry",
  permissions = [],
  refreshToken = 0,
  initialRecordId,
  onCancel,
  onSaved,
  onRecordsChanged,
}: {
  actorName: string;
  domain: Domain;
  lockedProductCode: string;
  repository?: RealtimeBusinessRepository;
  editorOnly?: boolean;
  mode?: PanelMode;
  permissions?: readonly string[];
  refreshToken?: number;
  initialRecordId?: string;
  onCancel?: () => void;
  onSaved?: () => void;
  onRecordsChanged?: () => void;
}) {
  const productCode = lockedProductCode.trim().toUpperCase();
  const [master, setMaster] = useState<MasterDataSnapshot | null>(null);
  const [objectTypes, setObjectTypes] = useState<readonly MasterObjectType[]>(
    [],
  );
  const [definitionSnapshot, setDefinitionSnapshot] = useState<{
    requestKey: string;
    definition: ProductionDefinition | MarketDefinition | null;
    state: "loaded" | "failed";
    error: string;
  }>({ requestKey: "", definition: null, state: "failed", error: "" });
  const [records, setRecords] = useState<readonly BusinessRecordListItem[]>([]);
  const [selected, setSelected] = useState<SelectedRecord | null>(null);
  const selectedRecordId = useRef<string | undefined>(initialRecordId);
  const formDirty = useRef(false);
  const [recordLoadState, setRecordLoadState] = useState<
    "new" | "loading" | "loaded" | "failed"
  >(initialRecordId ? "loading" : "new");
  const [values, setValues] = useState<Record<string, string>>({});
  const [returnReason, setReturnReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("正在读取业务配置…");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importJob, setImportJob] = useState<ProductionImportJob | null>(null);
  const [importPhotos, setImportPhotos] = useState<readonly File[]>([]);
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
        setValues((current) =>
          selectedRecordId.current
            ? current
            : {
                ...current,
                ...(domain === "production"
                  ? { PROD_REPORTER_NAME: session.displayName }
                  : { MKT_REPORTER_NAME: session.displayName }),
              },
        );
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
        setValues((current) =>
          selectedRecordId.current
            ? current
            : {
                ...current,
                ...(domain === "production"
                  ? { PROD_REPORTER_NAME: authenticatedName }
                  : { MKT_REPORTER_NAME: authenticatedName }),
              },
        );
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

  const reload = useCallback(
    async (nextProductCode = productCode): Promise<void> => {
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
    },
    [domain, productCode, repository],
  );

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

  const objectTypeCode =
    values.objectTypeCode ||
    values.MKT_OBJECT_TYPE ||
    objectTypes[0]?.code ||
    "";
  const definitionRequestKey = `${domain}:${productCode}:${objectTypeCode}`;
  const currentDefinitionSnapshot =
    definitionSnapshot.requestKey === definitionRequestKey
      ? definitionSnapshot
      : null;
  const definition = currentDefinitionSnapshot?.definition ?? null;
  const definitionState = currentDefinitionSnapshot?.state ?? "loading";
  const definitionError = currentDefinitionSnapshot?.error ?? "";
  useEffect(() => {
    if (!productCode || !objectTypeCode) return;
    let cancelled = false;
    const request =
      domain === "production"
        ? repository.loadProductionDefinition(productCode, objectTypeCode)
        : repository.loadMarketDefinition(productCode, objectTypeCode);
    void request
      .then((nextDefinition) => {
        if (!cancelled) {
          setDefinitionSnapshot({
            requestKey: definitionRequestKey,
            definition: nextDefinition,
            state: "loaded",
            error: "",
          });
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setDefinitionSnapshot({
            requestKey: definitionRequestKey,
            definition: null,
            state: "failed",
            error:
              loadError instanceof RealtimeApiError &&
              loadError.code === "CONTRACT_MISMATCH"
                ? loadError.message
                : "填报规则读取失败，请稍后重试。",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [definitionRequestKey, domain, objectTypeCode, productCode, repository]);

  const fields = useMemo(() => {
    if (domain === "production") {
      return definition && "contractVersion" in definition
        ? productionFields(definition)
        : [];
    }
    if (!definition || !("coreFields" in definition)) return [];
    return marketFields(definition);
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
    formDirty.current = true;
    setValues((current) => {
      if (code !== "objectTypeCode" && code !== "MKT_OBJECT_TYPE") {
        return { ...current, [code]: value };
      }
      const retained = Object.fromEntries(
        Object.entries(current).filter(([fieldCode]) =>
          retainedObjectIdentityCodes[domain].has(fieldCode),
        ),
      );
      return domain === "production"
        ? { ...retained, objectTypeCode: value }
        : {
            ...retained,
            objectTypeCode: value,
            MKT_OBJECT_TYPE: value,
          };
    });
  }

  function displayedValue(field: RealtimeFormField): string {
    if (field.code === "fillingDate") {
      return selected
        ? values.fillingDate || "系统填报日期暂不可用"
        : "保存后由系统生成";
    }
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

  const openRecord = useCallback(
    async (id: string) => {
      setRecordLoadState("loading");
      selectedRecordId.current = id;
      setSelected(null);
      setBusy(true);
      setError("");
      try {
        const record =
          domain === "production"
            ? await repository.getProduction(id)
            : await repository.getMarket(id);
        if (record.productCode.trim().toUpperCase() !== productCode) {
          setSelected(null);
          setRecordLoadState("failed");
          setError("该记录不属于当前菜单品种，无法打开。");
          return;
        }
        setSelected(record);
        formDirty.current = false;
        setRecordLoadState("loaded");
        setEvidenceFiles([]);
        setValues(
          domain === "production"
            ? productionValues(record as ProductionRecordRow)
            : marketValues(record as MarketRecordRow),
        );
        setMessage("已读取业务记录");
      } catch {
        setSelected(null);
        setRecordLoadState("failed");
        setError("业务记录读取失败，请稍后重试。");
      } finally {
        setBusy(false);
      }
    },
    [domain, productCode, repository],
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
      await reload(productCode);
      if (recordId && !formDirty.current) await openRecord(recordId);
    });
  }, [initialRecordId, openRecord, productCode, refreshToken, reload]);

  function newRecord() {
    formDirty.current = false;
    setSelected(null);
    selectedRecordId.current = undefined;
    setRecordLoadState("new");
    setReturnReason("");
    setEvidenceFiles([]);
    setValues({
      objectTypeCode: objectTypes[0]?.code ?? "",
      MKT_OBJECT_TYPE: objectTypes[0]?.code ?? "",
      ...(domain === "production"
        ? { PROD_REPORTER_NAME: authenticatedName }
        : { MKT_REPORTER_NAME: authenticatedName }),
    });
    setMessage("已新建空白填报，提交审核后生成正式记录");
    setError("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (mode !== "entry") {
      setError("当前为只读处理界面，不能修改或新建业务记录。");
      return;
    }
    if (selected && !allowed.has("SAVE")) {
      setError("该单据当前状态不允许修改，请按服务端分配的业务动作处理。");
      return;
    }
    if (recordLoadState === "loading" || recordLoadState === "failed") {
      setError("原业务记录尚未成功读取，不能按新建记录保存。");
      return;
    }
    if (!definition) return;
    if (identityError) {
      setError(identityError);
      return;
    }
    if (!selected && evidenceFiles.length > 5) {
      setError("现场照片最多上传 5 张。");
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
          ...productionPayloadFromValues(
            values,
            productCode,
            definition as ProductionDefinition,
          ),
          evidencePhotoIds,
        };
        record = selected
          ? await repository.updateAndSubmitProduction(selected.id, {
              ...payload,
              version: selected.version,
            })
          : await repository.createAndSubmitProduction(payload);
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
          ? await repository.updateAndSubmitMarket(selected.id, {
              ...payload,
              version: selected.version,
            })
          : await repository.createAndSubmitMarket(payload);
      }
      setSelected(record);
      formDirty.current = false;
      setValues(
        domain === "production"
          ? productionValues(record as ProductionRecordRow)
          : marketValues(record as MarketRecordRow),
      );
      await reload(record.productCode);
      onRecordsChanged?.();
      setMessage("提交审核成功");
      onSaved?.();
    } catch {
      setError("保存并提交审核失败，请核对填报内容后重试。");
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
      formDirty.current = false;
      await reload(record.productCode);
      onRecordsChanged?.();
      setMessage(
        `${action === "submit" ? "提交" : action === "approve" ? "审核通过" : action === "return" ? "退回" : "作废"}成功`,
      );
      if (mode === "review" && action !== "submit") onSaved?.();
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
    setImportJob(null);
    try {
      const initial =
        domain === "production"
          ? await repository.importProductionCsv(
              file,
              productCode,
              objectTypeCode,
              importPhotos,
            )
          : await repository.importMarketWorkbook?.(
              file,
              productCode,
              objectTypeCode,
              importPhotos,
            );
      if (!initial) throw new Error("IMPORT_NOT_CONFIGURED");
      const terminal = await awaitBusinessImport({
        repository,
        domain,
        initial,
        onUpdate: setImportJob,
      });
      if (terminal.statusCode !== "FAILED") {
        setImportPhotos([]);
        await reload(productCode);
        onRecordsChanged?.();
      }
    } catch {
      setError(
        `${domain === "production" ? "产情" : "市场"}记录导入失败，请核对 XLSX 模板内容后重试。`,
      );
    } finally {
      setImporting(false);
    }
  }

  async function retryImport() {
    if (!repository.retryImportJob || !importJob) return;
    setImporting(true);
    setError("");
    try {
      const initial = await repository.retryImportJob(domain, importJob.id);
      const terminal = await awaitBusinessImport({
        repository,
        domain,
        initial,
        onUpdate: setImportJob,
      });
      if (terminal.statusCode !== "FAILED") {
        await reload(productCode);
        onRecordsChanged?.();
      }
    } catch {
      setError("批量导入任务重试失败，请稍后重试。");
    } finally {
      setImporting(false);
    }
  }

  async function downloadImportErrors() {
    if (!repository.downloadImportErrors || !importJob) return;
    setError("");
    try {
      saveImportErrorFile(
        await repository.downloadImportErrors(domain, importJob.id),
        domain,
        importJob.id,
      );
    } catch {
      setError("导入错误清单下载失败，请稍后重试。");
    }
  }

  async function downloadWorkbook() {
    if (!productCode) return;
    setError("");
    try {
      const blob =
        domain === "production"
          ? await repository.downloadProductionXlsxTemplate?.(productCode)
          : await repository.downloadMarketXlsxTemplate?.(productCode);
      if (!blob) throw new Error("TEMPLATE_NOT_CONFIGURED");
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `${domain === "production" ? "产情" : "市场"}-${productName(productCode, master)}-批量导入模板.xlsx`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch {
      setError("XLSX 模板下载失败，请稍后重试。");
    }
  }

  const allowed = new Set(
    selected?.allowedActions.map((action) => action.toUpperCase()) ?? [],
  );
  const canSave = mode === "entry" && (!selected || allowed.has("SAVE"));
  const readOnlyMode =
    mode === "view" || mode === "review" || (Boolean(selected) && !canSave);
  const canApprove =
    mode === "review" &&
    permissions.includes("BUSINESS_APPROVE") &&
    allowed.has("APPROVE");
  const canReturn =
    mode === "review" &&
    permissions.includes("BUSINESS_RETURN") &&
    allowed.has("RETURN");
  const existingRecordUnavailable =
    recordLoadState === "loading" || recordLoadState === "failed";
  const definitionReady = definitionState === "loaded" && definition !== null;
  const visibleError = definitionError || error;
  return (
    <section
      aria-label={
        domain === "production"
          ? mode === "review"
            ? "产情单据审核"
            : mode === "view"
              ? "产情记录详情"
              : "产情填报"
          : mode === "review"
            ? "市场单据审核"
            : mode === "view"
              ? "市场记录详情"
              : "市场采集"
      }
      className="realtime-business-panel"
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
            {domain === "production"
              ? mode === "review"
                ? "产情单据审核"
                : mode === "view"
                  ? "产情记录详情"
                  : "产情填报"
              : mode === "review"
                ? "市场单据审核"
                : mode === "view"
                  ? "市场记录详情"
                  : "市场采集"}
          </h2>
          <p>
            {mode === "review"
              ? "只读核对原业务单据、现场照片和当前状态，通过或填写原因退回；审核不会新建记录。"
              : mode === "view"
                ? "只读查看原业务记录及现场照片，不会修改或新建记录。"
                : "按当前账号的业务范围填写记录，保存并提交后直接进入审核流程。"}
          </p>
        </div>
        <div className="realtime-business-header-actions">
          {!editorOnly && (
            <>
              <button
                type="button"
                disabled={busy || importing || !productCode}
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
              <label className="realtime-business-file-action">
                随本次 XLSX 一并上传照片（已选 {importPhotos.length} 张）
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  aria-label={`${domain === "production" ? "附加产情照片" : "附加市场照片"}`}
                  disabled={busy || importing}
                  multiple
                  onChange={(event) =>
                    setImportPhotos(Array.from(event.target.files ?? []))
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
      <BusinessImportStatus
        busy={importing}
        className="realtime-business-message"
        job={importJob}
        onDownloadErrors={() => void downloadImportErrors()}
        onRetry={() => void retryImport()}
      />
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
                    <strong>{businessRecordLabel(record.values)}</strong>
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
                ? `${businessRecordLabel(values)} · ${statusLabel(selected.status)}`
                : recordLoadState === "loading"
                  ? "正在读取原业务记录"
                  : recordLoadState === "failed"
                    ? "原业务记录读取失败"
                    : "新建填报"}
            </strong>
          </header>
          <div className="realtime-business-sections">
            {fieldSections.map(([section, sectionFields]) => (
              <fieldset
                disabled={existingRecordUnavailable || readOnlyMode}
                key={section}
              >
                <legend>{section}</legend>
                <div className="realtime-business-fields">
                  {sectionFields.map((field) => {
                    const fieldOptions = options(field);
                    const accountLocked = isAccountLockedReporter(field.code);
                    const readOnly = accountLocked || field.readOnly;
                    const regionField =
                      field.type === "region" ||
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
                            ariaLabel={field.label}
                            requireVillage={false}
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
                            {...(field.type === "decimal"
                              ? decimalInputConstraints(
                                  field.precision,
                                  field.scale,
                                )
                              : {})}
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
            {definitionReady && !selected && recordLoadState === "new" && (
              <fieldset>
                <legend>现场照片</legend>
                <label className="realtime-business-evidence-upload">
                  <span>现场照片（可选，最多 5 张）</span>
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
                      formDirty.current = true;
                      setEvidenceFiles(files);
                      setError("");
                    }}
                  />
                  <small>
                    {evidenceFiles.length > 0
                      ? `已选择 ${evidenceFiles.length} 张：${evidenceFiles.map((file) => file.name).join("、")}`
                      : "没有照片也可正常保存；选择照片后，系统将按填报坐标和时间生成水印。"}
                  </small>
                </label>
              </fieldset>
            )}
            {definitionReady && selected && (
              <fieldset className="realtime-business-evidence-review">
                <legend>现场水印照片</legend>
                {selected.evidencePhotos?.length ? (
                  <ul aria-label="现场水印照片">
                    {selected.evidencePhotos.map((photo) => (
                      <li key={photo.id}>
                        <a
                          href={`/api/v1/evidence-photos/${photo.id}/content`}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {photo.originalFilename}
                        </a>
                        <span>
                          {photo.watermarkText} · {photo.capturedAt} · 纬度
                          {photo.latitude} / 经度{photo.longitude}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p role="status">该记录没有已关联的现场水印照片。</p>
                )}
              </fieldset>
            )}
          </div>
          <div className="realtime-business-actions">
            {editorOnly && (
              <button disabled={busy} type="button" onClick={onCancel}>
                取消并返回
              </button>
            )}
            {canSave && (
              <button
                disabled={busy || !definitionReady || existingRecordUnavailable}
                type="submit"
              >
                保存并提交审核
              </button>
            )}
            {mode === "entry" && selected && allowed.has("VOID") && (
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
            {mode === "review" && selected && !canApprove && !canReturn && (
              <p role="status">
                当前账号无可执行的审核操作，或该单据已离开待审核状态。
              </p>
            )}
          </div>
          <p aria-live="polite" role={visibleError ? "alert" : "status"}>
            {visibleError || message}
          </p>
        </form>
      </div>
    </section>
  );
}
