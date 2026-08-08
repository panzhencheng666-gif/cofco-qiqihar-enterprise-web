import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  realtimeBusinessRepository,
  type BusinessRecordListItem,
  type MarketDefinition,
  type MarketRecordRow,
  type MasterCultivar,
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

function productionValues(record: ProductionRecordRow): Record<string, string> {
  return {
    productCode: record.productCode,
    objectTypeCode: record.objectTypeCode,
    regionCode: record.regionCode,
    cultivarCode: record.cultivarCode ?? "",
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
  repository = realtimeBusinessRepository,
  onRecordsChanged,
}: {
  actorName: string;
  domain: Domain;
  repository?: RealtimeBusinessRepository;
  onRecordsChanged?: () => void;
}) {
  const [master, setMaster] = useState<MasterDataSnapshot | null>(null);
  const [productCode, setProductCode] = useState("");
  const [objectTypes, setObjectTypes] = useState<readonly MasterObjectType[]>(
    [],
  );
  const [cultivars, setCultivars] = useState<readonly MasterCultivar[]>([]);
  const [definition, setDefinition] = useState<
    ProductionDefinition | MarketDefinition | null
  >(null);
  const [records, setRecords] = useState<readonly BusinessRecordListItem[]>([]);
  const [selected, setSelected] = useState<SelectedRecord | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [returnReason, setReturnReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("正在读取本地数据库配置…");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void repository
      .loadMasterData()
      .then((snapshot) => {
        if (cancelled) return;
        setMaster(snapshot);
        const first = snapshot.products[0]?.code ?? "";
        setProductCode(first);
        setValues((current) => ({
          ...current,
          productCode: first,
          ...(domain === "production"
            ? { PROD_REPORTER_NAME: actorName }
            : { MKT_REPORTER_NAME: actorName }),
        }));
        setMessage(
          snapshot.products.length > 0
            ? "本地数据库配置已连接"
            : "数据库尚未配置产品",
        );
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : "读取主数据失败");
      });
    return () => {
      cancelled = true;
    };
  }, [actorName, domain, repository]);

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
      repository.listCultivars(productCode),
      domain === "production"
        ? repository.listProduction({ productCode, pageSize: 100 })
        : repository.listMarket({ productCode, pageSize: 100 }),
    ])
      .then(([types, nextCultivars, page]) => {
        if (cancelled) return;
        setObjectTypes(types);
        setCultivars(nextCultivars);
        setRecords(page.items);
        setError("");
        const objectTypeCode = types[0]?.code ?? "";
        setValues((current) => ({
          ...(domain === "production"
            ? { PROD_REPORTER_NAME: actorName }
            : { MKT_REPORTER_NAME: actorName }),
          ...current,
          productCode,
          objectTypeCode,
          MKT_OBJECT_TYPE: objectTypeCode,
        }));
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(
            reason instanceof Error ? reason.message : "读取业务记录失败",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [actorName, domain, productCode, repository]);

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
        .catch((reason: unknown) => {
          if (!cancelled)
            setError(
              reason instanceof Error ? reason.message : "刷新业务记录失败",
            );
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
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(
            reason instanceof Error ? reason.message : "读取表单定义失败",
          );
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
      unit: field.unit,
      options: field.options,
    }));
    return [...core, ...definitionFields(definition)];
  }, [definition, domain]);

  function options(
    field: RealtimeFormField,
  ): readonly { value: string; label: string }[] {
    if (field.code === "productCode")
      return (
        master?.products.map(({ code, name }) => ({
          value: code,
          label: name,
        })) ?? []
      );
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
    if (field.code === "cultivarCode")
      return cultivars.map(({ code, name }) => ({ value: code, label: name }));
    return field.options ?? [];
  }

  function edit(code: string, value: string) {
    if (code === "productCode") {
      setSelected(null);
      setDefinition(null);
      setProductCode(value);
    }
    setValues((current) => ({ ...current, [code]: value }));
  }

  async function openRecord(id: string) {
    setBusy(true);
    setError("");
    try {
      const record =
        domain === "production"
          ? await repository.getProduction(id)
          : await repository.getMarket(id);
      setSelected(record);
      setProductCode(record.productCode);
      setValues(
        domain === "production"
          ? productionValues(record as ProductionRecordRow)
          : marketValues(record as MarketRecordRow),
      );
      setMessage(`已从数据库读取 ${id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "读取记录失败");
    } finally {
      setBusy(false);
    }
  }

  function newRecord() {
    setSelected(null);
    setReturnReason("");
    setValues({
      productCode,
      objectTypeCode: objectTypes[0]?.code ?? "",
      MKT_OBJECT_TYPE: objectTypes[0]?.code ?? "",
      ...(domain === "production"
        ? { PROD_REPORTER_NAME: actorName }
        : { MKT_REPORTER_NAME: actorName }),
    });
    setMessage("已新建空白填报，保存后才会写入数据库");
    setError("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!definition) return;
    setBusy(true);
    setError("");
    try {
      let record: SelectedRecord;
      if (domain === "production") {
        const payload = productionPayloadFromValues(values, definition);
        record = selected
          ? await repository.updateProduction(selected.id, {
              ...payload,
              version: selected.version,
            })
          : await repository.createProduction(payload);
      } else {
        const payload = marketPayloadFromValues(
          values,
          productCode,
          definition as MarketDefinition,
        );
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
      setMessage(`保存成功，数据库版本 ${record.version}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败");
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
        `${action === "submit" ? "提交" : action === "approve" ? "审核通过" : "退回"}成功，数据库版本 ${record.version}`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "状态操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function importCsv(file: File | undefined) {
    if (!file || domain !== "production") return;
    setImporting(true);
    setError("");
    try {
      const job = await repository.importProductionCsv(file);
      await reload(productCode);
      onRecordsChanged?.();
      setMessage(
        `导入任务 ${job.id} 状态 ${job.statusCode}：${job.importedRows} 行进入本地数据库，失败 ${job.failedRows} 行。`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "CSV 导入失败");
    } finally {
      setImporting(false);
    }
  }

  const allowed = new Set(
    selected?.allowedActions.map((action) => action.toUpperCase()) ?? [],
  );
  return (
    <section
      aria-label={
        domain === "production" ? "本地实时产情业务" : "本地实时市场业务"
      }
      className="realtime-business-panel"
    >
      <header>
        <div>
          <span>本地数据库实时模式</span>
          <h2>
            {domain === "production" ? "本地实时产情业务" : "本地实时市场业务"}
          </h2>
          <p>
            字段定义、产品、地区和记录均来自 8090 后端；页面不会回退到演示数据。
          </p>
        </div>
        <div className="realtime-business-header-actions">
          {domain === "production" && (
            <label className="realtime-business-file-action">
              导入产情 CSV
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={busy || importing}
                onChange={(event) => void importCsv(event.target.files?.[0])}
              />
            </label>
          )}
          <button
            type="button"
            onClick={newRecord}
            disabled={busy || importing}
          >
            新建填报
          </button>
        </div>
      </header>
      <div className="realtime-business-layout">
        <aside aria-label="数据库业务记录">
          <label>
            <span>品种</span>
            <select
              aria-label="数据库记录品种"
              value={productCode}
              onChange={(event) => edit("productCode", event.target.value)}
            >
              {master?.products.map((product) => (
                <option key={product.code} value={product.code}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <strong>{records.length} 条数据库记录</strong>
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
        <form onSubmit={(event) => void save(event)}>
          <header>
            <strong>
              {selected
                ? `${selected.id} · ${statusLabel(selected.status)}`
                : "新建填报"}
            </strong>
            {selected && <span>数据库版本 {selected.version}</span>}
          </header>
          <div className="realtime-business-fields">
            {fields.map((field) => {
              const fieldOptions = options(field);
              return (
                <label key={field.code}>
                  <span>
                    {field.label}
                    {field.required ? " *" : ""}
                    {field.unit ? `（${field.unit}）` : ""}
                  </span>
                  {fieldOptions.length > 0 || field.type === "select" ? (
                    <select
                      aria-label={field.label}
                      required={field.required}
                      value={values[field.code] ?? ""}
                      onChange={(event) => edit(field.code, event.target.value)}
                    >
                      <option value="">请选择</option>
                      {fieldOptions.map((option) => (
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
                      onChange={(event) => edit(field.code, event.target.value)}
                    />
                  )}
                </label>
              );
            })}
          </div>
          <div className="realtime-business-actions">
            <button disabled={busy || !definition} type="submit">
              保存到本地数据库
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
