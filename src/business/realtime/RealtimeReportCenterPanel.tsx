import { useEffect, useMemo, useRef, useState } from "react";

import {
  realtimeBusinessRepository,
  type MasterDataSnapshot,
  type ReportParameterOptions,
  type ReportPreview,
  type ReportExport,
  type RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";

import { RealtimeRegionCascadePicker } from "./RealtimeRegionCascadePicker";

const reportDomains = new Set(["PRODUCTION", "MARKET", "LOGISTICS", "SUPPLY"]);

function saveReport(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}

export function RealtimeReportCenterPanel({
  permissions = [],
  repository = realtimeBusinessRepository,
}: {
  permissions?: readonly string[];
  repository?: RealtimeBusinessRepository;
}) {
  const [master, setMaster] = useState<MasterDataSnapshot | null>(null);
  const [options, setOptions] = useState<ReportParameterOptions | null>(null);
  const [definitionCode, setDefinitionCode] = useState("");
  const [productCode, setProductCode] = useState("");
  const [cultivarCode, setCultivarCode] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [periodCode, setPeriodCode] = useState("");
  const [formatCode, setFormatCode] = useState("CSV");
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [reportExport, setReportExport] = useState<ReportExport | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [publishedPreviewId, setPublishedPreviewId] = useState("");
  const previewSequence = useRef(0);
  const exportSequence = useRef(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      repository.loadMasterData(),
      repository.loadReportParameterOptions(),
    ])
      .then(([nextMaster, nextOptions]) => {
        if (cancelled) return;
        const definitions = nextOptions.definitions.filter((definition) =>
          reportDomains.has(definition.businessDomain),
        );
        setMaster(nextMaster);
        setOptions({ ...nextOptions, definitions });
        setDefinitionCode(definitions[0]?.code ?? "");
        setProductCode(nextMaster.products[0]?.code ?? "");
        setRegionCode(nextMaster.regions[0]?.code ?? "");
        setPeriodCode(nextMaster.periods[0]?.code ?? "");
        setFormatCode(nextOptions.formats[0]?.code ?? "CSV");
      })
      .catch(() => {
        if (!cancelled) setError("报告筛选范围暂时无法读取，请稍后重试。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const selectedRegion = useMemo(
    () => master?.regions.find((region) => region.code === regionCode),
    [master, regionCode],
  );
  const selectedPeriod = master?.periods.find(
    (period) => period.code === periodCode,
  );
  const ready = Boolean(
    definitionCode && productCode && selectedRegion && periodCode && formatCode,
  );

  function changeScope(action: () => void): void {
    previewSequence.current += 1;
    exportSequence.current += 1;
    action();
    setPreview(null);
    setReportExport(null);
    setPublishedPreviewId("");
    setPreviewing(false);
    setExporting(false);
    setPublishing(false);
    setError("");
    setNotice("");
  }

  async function createPreview(): Promise<void> {
    if (!ready || !selectedRegion) return;
    const sequence = ++previewSequence.current;
    exportSequence.current += 1;
    setPreviewing(true);
    setExporting(false);
    setPublishing(false);
    setPreview(null);
    setReportExport(null);
    setPublishedPreviewId("");
    setError("");
    setNotice("");
    try {
      const created = await repository.createReportPreview({
        definitionCode,
        productCode,
        ...(cultivarCode ? { cultivarCode } : {}),
        regionLevel: selectedRegion.level,
        regionCode,
        periodCode,
      });
      if (sequence === previewSequence.current) setPreview(created);
    } catch {
      if (sequence === previewSequence.current)
        setError("当前范围暂无可生成报告的已核定数据，请调整筛选条件。");
    } finally {
      if (sequence === previewSequence.current) setPreviewing(false);
    }
  }

  async function exportPreview(): Promise<void> {
    if (!preview) return;
    const sequence = ++exportSequence.current;
    const previewId = preview.id;
    setExporting(true);
    setError("");
    try {
      const task = await repository.createReportExport(previewId, formatCode);
      if (sequence !== exportSequence.current || task.previewId !== previewId)
        return;
      const blob = await repository.downloadReportExport(task.id);
      if (sequence !== exportSequence.current) return;
      setReportExport(task);
      saveReport(blob, task.filename || `${preview.title}.csv`);
      setNotice("报告文件已生成并开始下载，可继续执行正式发布。");
    } catch {
      if (sequence === exportSequence.current)
        setError("当前报告导出未完成，请重新生成预览后再试。");
    } finally {
      if (sequence === exportSequence.current) setExporting(false);
    }
  }

  async function publishPreview(): Promise<void> {
    if (
      !preview ||
      !reportExport ||
      reportExport.previewId !== preview.id ||
      publishedPreviewId === preview.id
    )
      return;
    const sequence = exportSequence.current;
    setPublishing(true);
    setError("");
    setNotice("");
    try {
      await repository.createReportPublication(
        preview.id,
        reportExport.id,
        preview.version,
      );
      if (sequence !== exportSequence.current) return;
      setPublishedPreviewId(preview.id);
      setNotice("报告已正式发布并完成留痕。");
    } catch {
      if (sequence === exportSequence.current)
        setError("当前报告未能发布，请重新生成预览和发布文件后再试。");
    } finally {
      if (sequence === exportSequence.current) setPublishing(false);
    }
  }

  return (
    <div className="enterprise-ledger-workbench realtime-report-center">
      <div className="enterprise-ledger-workbench__breadcrumb">
        报表中心 / 业务报告
      </div>
      <header className="enterprise-ledger-title">
        <h1>业务报告</h1>
        <p>按业务类型、地区、品种和时间形成报告，确认预览后导出当前范围</p>
      </header>

      {loading ? (
        <p className="realtime-business-empty" role="status">
          正在读取报告范围……
        </p>
      ) : (
        <section
          aria-label="业务报告筛选条件"
          className="enterprise-ledger-query"
          role="search"
        >
          {(options?.definitions.length ?? 0) > 1 && (
            <label>
              <span>报告类型</span>
              <select
                aria-label="报告类型"
                value={definitionCode}
                onChange={(event) =>
                  changeScope(() => setDefinitionCode(event.target.value))
                }
              >
                {options?.definitions.map((definition) => (
                  <option key={definition.code} value={definition.code}>
                    {definition.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(master?.products.length ?? 0) > 1 && (
            <label>
              <span>产品或作物</span>
              <select
                aria-label="产品或作物"
                value={productCode}
                onChange={(event) =>
                  changeScope(() => {
                    setProductCode(event.target.value);
                    setCultivarCode("");
                  })
                }
              >
                {master?.products.map((product) => (
                  <option key={product.code} value={product.code}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span>具体品种</span>
            <input
              aria-label="具体品种"
              placeholder="全部具体品种"
              type="text"
              value={cultivarCode}
              onChange={(event) =>
                changeScope(() => setCultivarCode(event.target.value))
              }
            />
          </label>
          <RealtimeRegionCascadePicker
            ariaLabel="统计地区"
            onChange={(nextRegionCode) =>
              changeScope(() => setRegionCode(nextRegionCode))
            }
            regions={master?.regions ?? []}
            requireVillage={false}
            value={regionCode}
          />
          {(master?.periods.length ?? 0) > 1 && (
            <label>
              <span>统计时间</span>
              <select
                aria-label="统计时间"
                value={periodCode}
                onChange={(event) =>
                  changeScope(() => setPeriodCode(event.target.value))
                }
              >
                {master?.periods.map((period) => (
                  <option key={period.code} value={period.code}>
                    {period.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(options?.formats.length ?? 0) > 1 && (
            <label>
              <span>导出格式</span>
              <select
                aria-label="导出格式"
                value={formatCode}
                onChange={(event) => {
                  exportSequence.current += 1;
                  setExporting(false);
                  setPublishing(false);
                  setFormatCode(event.target.value);
                  setReportExport(null);
                  setNotice("");
                  setError("");
                }}
              >
                {options?.formats.map((format) => (
                  <option key={format.code} value={format.code}>
                    {format.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="enterprise-ledger-query__summary">
            当前范围：
            {options?.definitions.find(({ code }) => code === definitionCode)
              ?.name ?? "尚无报告类型"}
            {" · "}
            {master?.products.find(({ code }) => code === productCode)?.name ??
              "尚无产品"}
            {" · "}
            {master?.periods.find(({ code }) => code === periodCode)?.name ??
              "尚无统计时间"}
          </p>
          {permissions.includes("REPORT_PREVIEW") && (
            <button
              disabled={!ready || previewing}
              onClick={() => void createPreview()}
              type="button"
            >
              {previewing ? "正在生成……" : "生成报告预览"}
            </button>
          )}
        </section>
      )}

      {error && (
        <div className="market-task6-alert" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <p className="realtime-business-success" role="status">
          {notice}
        </p>
      )}

      {preview && (
        <section
          aria-label="报告预览"
          className="realtime-report-center__preview"
        >
          <header>
            <div>
              <span>当前筛选范围</span>
              <h2>{preview.title}</h2>
              <p>统计时间：{selectedPeriod?.name ?? "当前所选时间"}</p>
            </div>
            <div className="realtime-report-center__actions">
              {permissions.includes("REPORT_EXPORT") && (
                <button
                  disabled={exporting || publishing}
                  onClick={() => void exportPreview()}
                  type="button"
                >
                  {exporting ? "正在导出……" : "导出当前报告"}
                </button>
              )}
              {permissions.includes("REPORT_PUBLISH") &&
                reportExport?.previewId === preview.id &&
                publishedPreviewId !== preview.id && (
                  <button
                    disabled={exporting || publishing}
                    onClick={() => void publishPreview()}
                    type="button"
                  >
                    {publishing ? "正在发布……" : "正式发布报告"}
                  </button>
                )}
            </div>
          </header>
          <div className="realtime-report-center__metrics">
            {preview.lines.map((line) => (
              <article key={line.label}>
                <span>{line.label}</span>
                <strong>{line.value}</strong>
              </article>
            ))}
          </div>
          <div className="realtime-report-center__sections">
            {preview.sections.map((section) => (
              <article key={section.code}>
                <h3>{section.title}</h3>
                <p>{section.body}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
