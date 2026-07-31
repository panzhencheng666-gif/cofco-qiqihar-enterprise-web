import { useMemo, useState } from "react";
import {
  createBusinessReportArtifact,
  createBusinessReportDraft,
  type BusinessReportArtifact,
  type BusinessReportContext,
  type BusinessReportFormat,
  type BusinessReportFrequency,
} from "./businessReportModel";

interface BusinessReportComposerProps {
  context: BusinessReportContext;
  onClose: () => void;
  onExport?: (
    format: BusinessReportFormat,
    artifact: BusinessReportArtifact,
  ) => void;
}

const frequencies: readonly BusinessReportFrequency[] = [
  "日报",
  "周报",
  "月报",
];

function exportArtifact(artifact: BusinessReportArtifact) {
  if (artifact.action === "print") {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(artifact.content);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    return;
  }

  const url = URL.createObjectURL(
    new Blob([artifact.content], { type: artifact.mimeType }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = artifact.filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function BusinessReportComposer({
  context,
  onClose,
  onExport,
}: BusinessReportComposerProps) {
  const [frequency, setFrequency] = useState<BusinessReportFrequency>("周报");
  const initialDraft = useMemo(
    () => createBusinessReportDraft(context, frequency),
    [context, frequency],
  );
  const [summaryOverride, setSummaryOverride] = useState<string | null>(null);
  const draft = {
    ...initialDraft,
    summary: summaryOverride ?? initialDraft.summary,
  };

  function selectFrequency(nextFrequency: BusinessReportFrequency) {
    setFrequency(nextFrequency);
    setSummaryOverride(null);
  }

  function handleExport(format: BusinessReportFormat) {
    const artifact = createBusinessReportArtifact(draft, format);
    if (onExport) {
      onExport(format, artifact);
      return;
    }
    exportArtifact(artifact);
  }

  return (
    <div className="formal-report-composer-backdrop" role="presentation">
      <section
        aria-label="编制业务报告"
        aria-modal="true"
        className="formal-report-composer"
        role="dialog"
      >
        <header className="formal-report-composer__header">
          <div>
            <span>报告管理</span>
            <h1>编制业务报告</h1>
            <p>采用当前业务范围和已核定数据，不改变原业务记录。</p>
          </div>
          <button
            aria-label="关闭报告编制"
            className="formal-report-composer__close"
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="formal-report-composer__context">
          <div>
            <small>当前业务</small>
            <strong>
              {context.applicationLabel} · {context.product}
            </strong>
          </div>
          <div>
            <small>地区范围</small>
            <strong>{context.region}</strong>
            <span>{context.regionLevel}</span>
          </div>
          <div>
            <small>报告期间</small>
            <strong>{context.period}</strong>
          </div>
          <div>
            <small>数据截止</small>
            <strong>{context.dataCutoff}</strong>
          </div>
        </div>

        <div className="formal-report-composer__toolbar">
          <div aria-label="报告周期" className="formal-frequency-switch">
            {frequencies.map((item) => (
              <button
                aria-pressed={item === frequency}
                className={item === frequency ? "is-active" : undefined}
                key={item}
                type="button"
                onClick={() => selectFrequency(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="formal-report-version">
            <small>采用数据</small>
            <strong>{context.dataVersion}</strong>
          </div>
        </div>

        <div className="formal-report-composer__body">
          <article className="formal-report-document">
            <div className="formal-report-document__title">
              <span>{draft.reportNumber}</span>
              <h2>{draft.title}</h2>
              <p>
                编制：{draft.author} · 审核：{draft.reviewer}
              </p>
            </div>
            <label className="formal-report-summary">
              <span>本期摘要</span>
              <textarea
                aria-label="本期摘要"
                value={draft.summary}
                onChange={(event) => setSummaryOverride(event.target.value)}
              />
            </label>
            <div className="formal-report-indicators">
              {draft.indicators.map((indicator) => (
                <div key={indicator.label}>
                  <small>{indicator.label}</small>
                  <strong>{indicator.value}</strong>
                  <span>{indicator.note}</span>
                </div>
              ))}
            </div>
            <div className="formal-report-chapters">
              {draft.chapters.map((chapter, index) => (
                <section key={chapter.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{chapter.title}</h3>
                    <p>{chapter.body}</p>
                  </div>
                </section>
              ))}
            </div>
          </article>

          <aside className="formal-report-review">
            <h2>编制信息</h2>
            <dl>
              <div>
                <dt>数据状态</dt>
                <dd>已核定</dd>
              </div>
              <div>
                <dt>编制人</dt>
                <dd>{context.author}</dd>
              </div>
              <div>
                <dt>审核人</dt>
                <dd>{context.reviewer}</dd>
              </div>
              <div>
                <dt>报告状态</dt>
                <dd>草稿</dd>
              </div>
            </dl>
            <p>
              正式发布后如需修改，应重新编制并说明替代原因，原报告继续保留。
            </p>
          </aside>
        </div>

        <footer className="formal-report-composer__footer">
          <div>
            <button type="button">保存草稿</button>
            <button type="button">送审</button>
          </div>
          <div>
            <button type="button" onClick={() => handleExport("Excel")}>
              导出 Excel 附件
            </button>
            <button type="button" onClick={() => handleExport("Word")}>
              导出 Word
            </button>
            <button
              className="is-primary"
              type="button"
              onClick={() => handleExport("PDF")}
            >
              导出 PDF
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
