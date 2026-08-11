import { useMemo, useState, useSyncExternalStore } from "react";
import {
  createBusinessReportArtifact,
  createBusinessReportDraft,
  type BusinessReportArtifact,
  type BusinessReportContext,
  type BusinessReportFormat,
} from "./businessReportModel";
import {
  getFallbackFixtureBusinessReportWorkflow,
  type BusinessReportRecord,
  type BusinessReportScopeSnapshot,
  type BusinessReportWorkflow,
} from "./businessReportWorkflow";

interface BusinessReportComposerProps {
  context: BusinessReportContext;
  onClose: () => void;
  onExport?: (
    format: BusinessReportFormat,
    artifact: BusinessReportArtifact,
  ) => void;
  workflow?: BusinessReportWorkflow;
  actorPost?: string;
  permissionKeys?: readonly string[];
}

function hasSameReportScope(
  record: BusinessReportRecord,
  scope: BusinessReportScopeSnapshot,
) {
  return (
    record.scope.application === scope.application &&
    record.scope.businessClassificationId === scope.businessClassificationId &&
    record.scope.region === scope.region &&
    record.scope.product === scope.product &&
    record.scope.cultivar === scope.cultivar &&
    record.scope.reportTemplate === scope.reportTemplate &&
    record.scope.period === scope.period &&
    record.scope.frequency === scope.frequency &&
    record.scope.dataCutoff === scope.dataCutoff &&
    record.scope.dataBatchId === scope.dataBatchId
  );
}

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
  workflow: injectedWorkflow,
  actorPost: injectedActorPost,
  permissionKeys = [
    "report.draft.save",
    "report.review.submit",
    "report.export",
  ],
}: BusinessReportComposerProps) {
  const workflow =
    injectedWorkflow ?? getFallbackFixtureBusinessReportWorkflow();
  const workflowInitializationError = workflow.getInitializationError();
  const workflowAvailable = workflowInitializationError === null;
  const frequency =
    context.frequency ?? (context.application === "supply" ? "月报" : "周报");
  const actorPost = injectedActorPost ?? context.authorPost;
  const canSaveDraft =
    workflowAvailable && permissionKeys.includes("report.draft.save");
  const canSubmitReview =
    workflowAvailable && permissionKeys.includes("report.review.submit");
  const canExportReport =
    workflowAvailable && permissionKeys.includes("report.export");
  const scopeSnapshot: BusinessReportScopeSnapshot = {
    application: context.application,
    businessClassificationId: context.businessClassificationId ?? "",
    businessClassificationLabel:
      context.businessClassificationLabel ?? "未选择业务分类",
    region: context.region,
    product: context.product,
    cultivar: context.cultivar ?? "",
    reportTemplate: context.reportTemplate ?? "",
    period: context.period,
    frequency,
    dataCutoff: context.dataCutoff,
    dataBatchId: context.dataVersion,
  };
  const workflowReports = useSyncExternalStore(
    workflow.subscribe,
    workflow.getSnapshot,
  );
  const recoverableReport = [...workflowReports]
    .reverse()
    .find(
      (report) =>
        hasSameReportScope(report, scopeSnapshot) &&
        (report.status === "草稿" || report.status === "退回修改"),
    );
  const initialDraft = useMemo(
    () => createBusinessReportDraft(context, frequency),
    [context, frequency],
  );
  const [reportId, setReportId] = useState<string | null>(
    () => recoverableReport?.id ?? null,
  );
  const [summaryOverride, setSummaryOverride] = useState<string | null>(
    () => recoverableReport?.summary ?? null,
  );
  const [isDirty, setIsDirty] = useState(false);
  const [workflowMessage, setWorkflowMessage] = useState(
    recoverableReport ? "已恢复此前保存的报告草稿。" : "",
  );
  const activeReport = workflowReports.find(({ id }) => id === reportId);
  const actorOwnsActiveReport =
    activeReport === undefined || activeReport.currentHandlerPost === actorPost;
  const canExportCurrentReport =
    canExportReport && activeReport !== undefined && !isDirty;
  const draft = {
    ...initialDraft,
    summary: summaryOverride ?? activeReport?.summary ?? initialDraft.summary,
  };

  function handleExport(format: BusinessReportFormat) {
    if (workflowInitializationError) {
      setWorkflowMessage(workflowInitializationError);
      return;
    }
    if (!canExportReport) {
      setWorkflowMessage("当前登录岗位没有报告导出权限。");
      return;
    }
    if (!draft.hasApprovedIndicators) {
      setWorkflowMessage("当前生成条件没有已核定数据，不能导出正式报告。");
      return;
    }
    if (!activeReport) {
      setWorkflowMessage("请先保存报告草稿，再导出内部工作稿。");
      return;
    }
    if (isDirty) {
      setWorkflowMessage("报告内容已修改，请重新保存后再导出。");
      return;
    }
    const documentStatus =
      activeReport.status === "已发布" ? "正式报告" : "内部工作稿";
    const artifact = createBusinessReportArtifact(
      draft,
      format,
      documentStatus,
    );
    if (onExport) {
      onExport(format, artifact);
      return;
    }
    exportArtifact(artifact);
  }

  function saveDraft() {
    if (workflowInitializationError) {
      setWorkflowMessage(workflowInitializationError);
      return;
    }
    if (!canSaveDraft) {
      setWorkflowMessage("当前登录岗位没有保存报告草稿的权限。");
      return;
    }
    if (!actorOwnsActiveReport) {
      setWorkflowMessage(
        `当前应由“${activeReport?.currentHandlerPost ?? "报告责任岗位"}”处理，当前登录岗位只能查看。`,
      );
      return;
    }
    if (!draft.hasApprovedIndicators) {
      setWorkflowMessage("当前生成条件没有已核定数据，不能保存报告草稿。");
      return;
    }
    if (!activeReport) {
      const report = workflow.createDraft({
        title: draft.title,
        summary: draft.summary,
        scope: scopeSnapshot,
        dataBatchLabel: draft.adoptedDataLabel,
        dataSourceLabel: draft.dataSourceLabel,
        authorPost: actorPost,
        reviewerPost: context.reviewerPost,
        publisherPost: "报告发布岗",
      });
      setReportId(report.id);
      setIsDirty(false);
      setWorkflowMessage("草稿已保存");
      return;
    }
    const result = workflow.saveDraft(activeReport.id, {
      actorPost,
      summary: draft.summary,
    });
    if (!result.ok) {
      setWorkflowMessage(result.reason);
      return;
    }
    setIsDirty(false);
    setWorkflowMessage("草稿已保存");
  }

  function submitForReview() {
    if (workflowInitializationError) {
      setWorkflowMessage(workflowInitializationError);
      return;
    }
    if (!canSubmitReview) {
      setWorkflowMessage("当前登录岗位没有提交报告复核的权限。");
      return;
    }
    if (!actorOwnsActiveReport) {
      setWorkflowMessage(
        `当前应由“${activeReport?.currentHandlerPost ?? "报告责任岗位"}”处理，当前登录岗位不能提交复核。`,
      );
      return;
    }
    if (!activeReport) {
      setWorkflowMessage("请先保存草稿，再提交复核。");
      return;
    }
    const result = workflow.transition(activeReport.id, {
      action: "提交复核",
      actorPost,
    });
    setWorkflowMessage(
      result.ok ? "报告已提交复核，请等待报告复核岗处理。" : result.reason,
    );
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
              {draft.applicationLabel} · {context.businessClassificationLabel}
            </strong>
          </div>
          <div>
            <small>产品与具体品种</small>
            <strong>
              {context.product} · {context.cultivar}
            </strong>
          </div>
          <div>
            <small>报告模板</small>
            <strong>{context.reportTemplate}</strong>
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
            <strong>{draft.dataCutoffLabel}</strong>
          </div>
        </div>

        <div className="formal-report-composer__toolbar">
          <div className="formal-report-version formal-report-version--leading">
            <small>报告周期</small>
            <strong>{frequency}</strong>
          </div>
          <div className="formal-report-version">
            <small>采用数据</small>
            <strong>{draft.adoptedDataLabel}</strong>
          </div>
          <div className="formal-report-version">
            <small>数据来源</small>
            <strong>{draft.dataSourceLabel}</strong>
          </div>
        </div>

        {workflowInitializationError && (
          <section className="report-generation-blocker" role="alert">
            <strong>报告记录暂时无法读取</strong>
            <p>{workflowInitializationError}</p>
          </section>
        )}

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
                onChange={(event) => {
                  setSummaryOverride(event.target.value);
                  setIsDirty(true);
                  setWorkflowMessage("内容已修改，请重新保存草稿。");
                }}
              />
            </label>
            <div className="formal-report-indicators">
              {draft.hasApprovedIndicators ? (
                draft.indicators.map((indicator) => (
                  <div key={indicator.label}>
                    <small>{indicator.label}</small>
                    <strong>{indicator.value}</strong>
                    <span>{indicator.note}</span>
                  </div>
                ))
              ) : (
                <p role="status">当前筛选范围尚无已核定指标</p>
              )}
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
                <dd>
                  {draft.hasApprovedIndicators ? "已核定" : "无可用核定数据"}
                </dd>
              </div>
              <div>
                <dt>编制人</dt>
                <dd>{context.author}</dd>
              </div>
              <div>
                <dt>编制岗位</dt>
                <dd>{actorPost}</dd>
              </div>
              <div>
                <dt>审核人</dt>
                <dd>{context.reviewer}</dd>
              </div>
              <div>
                <dt>审核岗位</dt>
                <dd>{context.reviewerPost}</dd>
              </div>
              <div>
                <dt>报告状态</dt>
                <dd>{activeReport?.status ?? "尚未保存"}</dd>
              </div>
              <div>
                <dt>文档性质</dt>
                <dd>
                  {activeReport?.status === "已发布"
                    ? "正式报告"
                    : "内部工作稿"}
                </dd>
              </div>
              <div>
                <dt>当前处理岗位</dt>
                <dd>{activeReport?.currentHandlerPost ?? actorPost}</dd>
              </div>
            </dl>
            <p>
              正式发布后如需修改，应重新编制并说明替代原因，原报告继续保留。
            </p>
          </aside>
        </div>

        <footer className="formal-report-composer__footer">
          <div>
            <button
              disabled={
                !draft.hasApprovedIndicators ||
                !canSaveDraft ||
                !actorOwnsActiveReport ||
                (activeReport !== undefined &&
                  activeReport.status !== "草稿" &&
                  activeReport.status !== "退回修改")
              }
              type="button"
              onClick={saveDraft}
            >
              保存草稿
            </button>
            <button
              disabled={
                !draft.hasApprovedIndicators ||
                !canSubmitReview ||
                !actorOwnsActiveReport ||
                !activeReport ||
                activeReport.status !== "草稿" ||
                isDirty
              }
              type="button"
              onClick={submitForReview}
            >
              送审
            </button>
            {workflowMessage && (
              <span aria-live="polite" className="formal-report-workflow-note">
                {workflowMessage}
              </span>
            )}
          </div>
          <div>
            <button
              disabled={!draft.hasApprovedIndicators || !canExportCurrentReport}
              type="button"
              onClick={() => handleExport("Excel")}
            >
              导出电子表格附件
            </button>
            <button
              disabled={!draft.hasApprovedIndicators || !canExportCurrentReport}
              type="button"
              onClick={() => handleExport("Word")}
            >
              导出文字文档
            </button>
            <button
              className="is-primary"
              disabled={!draft.hasApprovedIndicators || !canExportCurrentReport}
              type="button"
              onClick={() => handleExport("PDF")}
            >
              导出版式文档
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
