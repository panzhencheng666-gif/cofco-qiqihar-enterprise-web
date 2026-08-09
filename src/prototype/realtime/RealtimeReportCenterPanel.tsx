import { useEffect, useMemo, useState } from "react";

import {
  realtimeBusinessRepository,
  type MasterCultivar,
  type MasterDataSnapshot,
  type ReportParameterOptions,
  type ReportPreview,
  type RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";

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
  repository = realtimeBusinessRepository,
}: {
  repository?: RealtimeBusinessRepository;
}) {
  const [master, setMaster] = useState<MasterDataSnapshot | null>(null);
  const [options, setOptions] = useState<ReportParameterOptions | null>(null);
  const [cultivars, setCultivars] = useState<readonly MasterCultivar[]>([]);
  const [definitionCode, setDefinitionCode] = useState("");
  const [productCode, setProductCode] = useState("");
  const [cultivarCode, setCultivarCode] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [periodCode, setPeriodCode] = useState("");
  const [formatCode, setFormatCode] = useState("CSV");
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

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

  useEffect(() => {
    if (!productCode) return;
    let cancelled = false;
    repository
      .listCultivars(productCode)
      .then((nextCultivars) => {
        if (!cancelled) setCultivars(nextCultivars);
      })
      .catch(() => {
        if (!cancelled) setCultivars([]);
      });
    return () => {
      cancelled = true;
    };
  }, [productCode, repository]);

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
    action();
    setPreview(null);
    setError("");
  }

  async function createPreview(): Promise<void> {
    if (!ready || !selectedRegion) return;
    setPreviewing(true);
    setError("");
    try {
      setPreview(
        await repository.createReportPreview({
          definitionCode,
          productCode,
          ...(cultivarCode ? { cultivarCode } : {}),
          regionLevel: selectedRegion.level,
          regionCode,
          periodCode,
        }),
      );
    } catch {
      setError("当前范围暂无可生成报告的已核定数据，请调整筛选条件。");
    } finally {
      setPreviewing(false);
    }
  }

  async function exportPreview(): Promise<void> {
    if (!preview) return;
    setExporting(true);
    setError("");
    try {
      const task = await repository.createReportExport(preview.id, formatCode);
      const blob = await repository.downloadReportExport(task.id);
      saveReport(blob, task.filename || `${preview.title}.csv`);
    } catch {
      setError("当前报告导出未完成，请重新生成预览后再试。");
    } finally {
      setExporting(false);
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
          <label>
            <span>产品品种</span>
            <select
              aria-label="产品品种"
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
          <label>
            <span>具体品种</span>
            <select
              aria-label="具体品种"
              value={cultivarCode}
              onChange={(event) =>
                changeScope(() => setCultivarCode(event.target.value))
              }
            >
              <option value="">全部具体品种</option>
              {cultivars.map((cultivar) => (
                <option key={cultivar.code} value={cultivar.code}>
                  {cultivar.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>统计地区</span>
            <select
              aria-label="统计地区"
              value={regionCode}
              onChange={(event) =>
                changeScope(() => setRegionCode(event.target.value))
              }
            >
              {master?.regions.map((region) => (
                <option key={region.code} value={region.code}>
                  {region.name}
                </option>
              ))}
            </select>
          </label>
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
          <label>
            <span>导出格式</span>
            <select
              aria-label="导出格式"
              value={formatCode}
              onChange={(event) => setFormatCode(event.target.value)}
            >
              {options?.formats.map((format) => (
                <option key={format.code} value={format.code}>
                  {format.label}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={!ready || previewing}
            onClick={() => void createPreview()}
            type="button"
          >
            {previewing ? "正在生成……" : "生成报告预览"}
          </button>
        </section>
      )}

      {error && (
        <div className="market-task6-alert" role="alert">
          {error}
        </div>
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
            <button
              disabled={exporting}
              onClick={() => void exportPreview()}
              type="button"
            >
              {exporting ? "正在导出……" : "导出当前报告"}
            </button>
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
