import type { ProductionImportJob } from "@/platform/api/realtimeBusinessRepository";

import { businessImportMessage } from "./businessImportWorkflow";

export function BusinessImportStatus({
  busy,
  className,
  compact = false,
  job,
  onDownloadErrors,
  onRetry,
  showSummary = true,
}: {
  busy: boolean;
  className: string;
  compact?: boolean;
  job: ProductionImportJob | null;
  onDownloadErrors: () => void;
  onRetry: () => void;
  showSummary?: boolean;
}) {
  if (!job) return null;
  const hasErrorFile =
    job?.statusCode === "COMPLETED_WITH_ERRORS" || (job?.failedRows ?? 0) > 0;
  const canRetry =
    job.statusCode === "FAILED" || job.statusCode === "COMPLETED_WITH_ERRORS";
  if (!showSummary && !hasErrorFile && !canRetry) return null;
  return (
    <div
      aria-label={showSummary ? "批量导入处理结果" : "导入任务操作"}
      className={className}
      role={showSummary ? "status" : "group"}
    >
      {showSummary && compact ? (
        <>
          <span className="business-import-task-workspace__completed-count">
            <span aria-hidden="true">✓</span> 已完成 {job.importedRows} 行
          </span>
          {job.failedRows > 0 && (
            <span className="business-import-task-workspace__pending-count">
              <span aria-hidden="true">!</span> 待修正 {job.failedRows} 行
            </span>
          )}
        </>
      ) : showSummary ? (
        <span>{businessImportMessage(job)}</span>
      ) : null}
      {hasErrorFile && (
        <button disabled={busy} type="button" onClick={onDownloadErrors}>
          下载错误清单
        </button>
      )}
      {canRetry && (
        <button disabled={busy} type="button" onClick={onRetry}>
          {job.statusCode === "COMPLETED_WITH_ERRORS"
            ? "仅重试待修正行"
            : "重试导入"}
        </button>
      )}
    </div>
  );
}
