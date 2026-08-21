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
import {
  defaultReportPeriod,
  defaultReportRegionCode,
  groupReportDefinitions,
  reportCoverage,
  reportFrequency,
  reportPeriodLabel,
  weeklyPeriodCode,
  weeklyPeriodParts,
} from "./realtimeReportCenterModel";

function shanghaiToday(): string {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

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
  const [regionCode, setRegionCode] = useState("");
  const [periodCode, setPeriodCode] = useState("");
  const [formatCode, setFormatCode] = useState("CSV");
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [reportExport, setReportExport] = useState<ReportExport | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
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
        const definitions = groupReportDefinitions(
          nextOptions.definitions,
        ).flatMap(({ definitions: items }) => items);
        setMaster(nextMaster);
        setOptions({ ...nextOptions, definitions });
        const initialDefinition = definitions[0];
        setDefinitionCode(initialDefinition?.code ?? "");
        setRegionCode(defaultReportRegionCode(nextMaster.regions));
        setPeriodCode(
          defaultReportPeriod(
            reportFrequency(initialDefinition?.frequencyCode),
            shanghaiToday(),
          ),
        );
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
  const selectedDefinition = options?.definitions.find(
    (definition) => definition.code === definitionCode,
  );
  const definitionGroups = useMemo(
    () => groupReportDefinitions(options?.definitions ?? []),
    [options?.definitions],
  );
  const selectedFrequency = reportFrequency(selectedDefinition?.frequencyCode);
  const selectedTimeLabel = reportPeriodLabel(selectedFrequency, periodCode);
  const weeklyFallback = defaultReportPeriod("WEEKLY", shanghaiToday());
  const weeklyParts = weeklyPeriodParts(periodCode, weeklyFallback);
  const currentYear = Number(shanghaiToday().slice(0, 4));
  const reportYears = Array.from({ length: 8 }, (_, index) =>
    String(currentYear + 1 - index),
  );
  if (!reportYears.includes(weeklyParts.year))
    reportYears.push(weeklyParts.year);
  reportYears.sort((left, right) => Number(right) - Number(left));
  const ready = Boolean(
    definitionCode && selectedRegion && periodCode && formatCode,
  );
  const canExport = permissions.includes("REPORT_EXPORT");
  const canPreview = permissions.includes("REPORT_PREVIEW");
  const coverage = preview ? reportCoverage(preview.lines) : null;
  const previewProducts = preview?.products ?? [];

  function changeScope(action: () => void): void {
    previewSequence.current += 1;
    exportSequence.current += 1;
    action();
    setPreview(null);
    setReportExport(null);
    setPublishedPreviewId("");
    setPreviewing(false);
    setExporting(false);
    setDownloadFailed(false);
    setPublishing(false);
    setError("");
    setNotice("");
  }

  async function createPreview(downloadAfterCreation = false): Promise<void> {
    if (!ready || !selectedRegion) return;
    const sequence = ++previewSequence.current;
    const downloadSequence = ++exportSequence.current;
    const requestedFormat = formatCode;
    setPreviewing(true);
    setExporting(false);
    setDownloadFailed(false);
    setPublishing(false);
    setPreview(null);
    setReportExport(null);
    setPublishedPreviewId("");
    setError("");
    setNotice("");
    try {
      const created = await repository.createReportPreview({
        definitionCode,
        regionLevel: selectedRegion.level,
        regionCode,
        periodCode,
      });
      if (sequence !== previewSequence.current) return;
      setPreview(created);
      setPreviewing(false);
      if (
        downloadAfterCreation &&
        downloadSequence === exportSequence.current
      ) {
        await exportPreview(created, downloadSequence, requestedFormat);
      }
    } catch {
      if (sequence === previewSequence.current)
        setError("当前范围暂无可生成报告的已核定数据，请调整筛选条件。");
    } finally {
      if (sequence === previewSequence.current) setPreviewing(false);
    }
  }

  async function exportPreview(
    targetPreview: ReportPreview | null = preview,
    sequence = ++exportSequence.current,
    requestedFormat = formatCode,
  ): Promise<void> {
    if (!targetPreview || sequence !== exportSequence.current) return;
    const previewId = targetPreview.id;
    setExporting(true);
    setDownloadFailed(false);
    setReportExport(null);
    setPublishedPreviewId("");
    setError("");
    setNotice("");
    try {
      const task = await repository.createReportExport(
        previewId,
        requestedFormat,
      );
      if (sequence !== exportSequence.current || task.previewId !== previewId)
        return;
      const blob = await repository.downloadReportExport(task.id);
      if (sequence !== exportSequence.current) return;
      setReportExport(task);
      saveReport(blob, task.filename || `${targetPreview.title}.csv`);
      setNotice("报告文件已生成并开始下载，可继续执行正式发布。");
    } catch {
      if (sequence === exportSequence.current) {
        setDownloadFailed(true);
        setError("报告预览已生成，但文件下载未完成，请重试下载。");
      }
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
        <p>
          按日、周、月生成一份综合经营报告，三品种四业务域使用同一审核后数据快照
        </p>
      </header>

      {loading ? (
        <p className="realtime-business-empty" role="status">
          正在读取报告范围……
        </p>
      ) : (
        <>
          <nav
            aria-label="综合报告目录"
            className="realtime-report-center__catalog"
          >
            <div className="realtime-report-center__section-heading">
              <span>步骤 1</span>
              <div>
                <h2>选择业务报告</h2>
                <p>报告目录由服务端维护，仅提供综合经营日报、周报和月报。</p>
              </div>
            </div>
            <div className="realtime-report-center__catalog-grid">
              {definitionGroups.map((group) => (
                <section key={group.code}>
                  <header>
                    <h3>{group.label}</h3>
                    <p>{group.description}</p>
                  </header>
                  <div>
                    {group.definitions.map((definition) => (
                      <button
                        aria-pressed={definition.code === definitionCode}
                        className={
                          definition.code === definitionCode ? "is-active" : ""
                        }
                        key={definition.code}
                        onClick={() => {
                          const nextFrequency = reportFrequency(
                            definition.frequencyCode,
                          );
                          changeScope(() => {
                            setDefinitionCode(definition.code);
                            if (nextFrequency !== selectedFrequency)
                              setPeriodCode(
                                defaultReportPeriod(
                                  nextFrequency,
                                  shanghaiToday(),
                                ),
                              );
                          });
                        }}
                        type="button"
                      >
                        {definition.name}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </nav>

          <section
            aria-label="报告范围与交付"
            className="realtime-report-center__scope"
          >
            <div className="realtime-report-center__section-heading">
              <span>步骤 2</span>
              <div>
                <h2>确定报告范围与交付格式</h2>
                <p>地区、时间和文件格式共同确定本次不可变报告快照。</p>
              </div>
            </div>
            <div className="realtime-report-center__scope-grid">
              <RealtimeRegionCascadePicker
                ariaLabel="统计地区"
                onChange={(nextRegionCode) =>
                  changeScope(() => setRegionCode(nextRegionCode))
                }
                regions={master?.regions ?? []}
                requireVillage={false}
                value={regionCode}
              />
              {selectedFrequency === "WEEKLY" ? (
                <div
                  aria-label="报告周次"
                  className="realtime-report-center__week-fields"
                  role="group"
                >
                  <label>
                    <span>报告年份</span>
                    <select
                      aria-label="报告年份"
                      value={weeklyParts.year}
                      onChange={(event) =>
                        changeScope(() =>
                          setPeriodCode(
                            weeklyPeriodCode(
                              event.target.value,
                              weeklyParts.week,
                            ),
                          ),
                        )
                      }
                    >
                      {reportYears.map((year) => (
                        <option key={year} value={year}>
                          {year}年
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>周次</span>
                    <select
                      aria-label="周次"
                      value={weeklyParts.week}
                      onChange={(event) =>
                        changeScope(() =>
                          setPeriodCode(
                            weeklyPeriodCode(
                              weeklyParts.year,
                              event.target.value,
                            ),
                          ),
                        )
                      }
                    >
                      {Array.from({ length: 53 }, (_, index) => {
                        const week = String(index + 1).padStart(2, "0");
                        return (
                          <option key={week} value={week}>
                            第{index + 1}周
                          </option>
                        );
                      })}
                    </select>
                  </label>
                </div>
              ) : (
                <label>
                  <span>
                    {selectedFrequency === "MONTHLY" ? "报告月份" : "报告日期"}
                  </span>
                  <input
                    aria-label={
                      selectedFrequency === "MONTHLY" ? "报告月份" : "报告日期"
                    }
                    type={selectedFrequency === "MONTHLY" ? "month" : "date"}
                    value={periodCode}
                    onChange={(event) =>
                      changeScope(() => setPeriodCode(event.target.value))
                    }
                  />
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
                      setDownloadFailed(false);
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
            </div>
            <div className="realtime-report-center__scope-action">
              <p>
                <span>当前任务</span>
                <strong>
                  {selectedDefinition?.name ?? "尚无报告类型"}
                  {" · "}
                  玉米、大豆、稻谷
                  {" · "}
                  {selectedTimeLabel}
                </strong>
              </p>
              {canPreview ? (
                <button
                  disabled={!ready || previewing || exporting}
                  onClick={() => void createPreview(canExport)}
                  type="button"
                >
                  {previewing
                    ? "正在生成报告……"
                    : exporting
                      ? "正在下载报告……"
                      : canExport
                        ? "生成并下载报告"
                        : "生成报告预览"}
                </button>
              ) : (
                <p className="realtime-report-center__permission">
                  当前岗位无报告编制权限
                </p>
              )}
            </div>
          </section>
        </>
      )}

      <section
        aria-label="报告生成结果"
        className="realtime-report-center__result"
      >
        <div className="realtime-report-center__section-heading">
          <span>步骤 3</span>
          <div>
            <h2>报告生成结果</h2>
            <p>预览、下载和正式发布始终关联同一份核定数据快照。</p>
          </div>
        </div>
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
        {preview ? (
          <div className="realtime-report-center__preview">
            <header>
              <div>
                <span>当前核定报告</span>
                <h2>{preview.title}</h2>
                <p>统计时间：{selectedTimeLabel}</p>
              </div>
              <div className="realtime-report-center__actions">
                {permissions.includes("REPORT_EXPORT") && (
                  <button
                    disabled={exporting || publishing}
                    onClick={() => void exportPreview()}
                    type="button"
                  >
                    {exporting
                      ? "正在导出……"
                      : downloadFailed
                        ? "重试下载报告"
                        : reportExport?.previewId === preview.id
                          ? "重新下载报告"
                          : "下载当前报告"}
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
            {coverage ? (
              <p
                className={`realtime-report-center__coverage is-${coverage.status.toLowerCase()}`}
              >
                {coverage.message}
              </p>
            ) : null}
            <div className="realtime-report-center__metrics">
              {preview.lines
                .slice(0, previewProducts.length ? 3 : undefined)
                .map((line) => (
                  <article key={line.label}>
                    <span>{line.label}</span>
                    <strong>{line.value}</strong>
                    {line.note ? <small>{line.note}</small> : null}
                  </article>
                ))}
            </div>
            {previewProducts.length ? (
              <div
                aria-label="三品种审核后数据"
                className="realtime-report-center__products"
                role="region"
              >
                {previewProducts.map((product) => (
                  <article key={product.code}>
                    <header>
                      <h3>{product.label}</h3>
                      <span>
                        已审核{" "}
                        {product.domains.reduce(
                          (total, domain) => total + domain.approvedRecordCount,
                          0,
                        )}{" "}
                        条
                      </span>
                    </header>
                    <div>
                      {product.domains.map((domain) => (
                        <section key={domain.code}>
                          <header>
                            <h4>{domain.label}</h4>
                            <span>已审核 {domain.approvedRecordCount} 条</span>
                          </header>
                          <small>数据截止：{domain.dataCutoff}</small>
                          <dl>
                            {domain.metrics.map((metric) => (
                              <div key={metric.label}>
                                <dt>{metric.label}</dt>
                                <dd>{metric.value}</dd>
                                {metric.note ? (
                                  <small>{metric.note}</small>
                                ) : null}
                              </div>
                            ))}
                          </dl>
                        </section>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
            <div className="realtime-report-center__sections">
              {preview.sections.map((section) => (
                <article key={section.code}>
                  <h3>{section.title}</h3>
                  <p>{section.body}</p>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="realtime-report-center__placeholder">
            <strong>选择报告范围后可一键生成正式报告</strong>
            <p>系统只使用当前范围内的核定业务数据；无数据时不会生成空文件。</p>
          </div>
        )}
      </section>
    </div>
  );
}
