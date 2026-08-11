import type { ProductionImportJob } from "@/platform/api/realtimeBusinessRepository";

import { businessImportMessage } from "./businessImportWorkflow";

export function BusinessImportStatus({
  busy,
  className,
  job,
  onDownloadErrors,
  onRetry,
}: {
  busy: boolean;
  className: string;
  job: ProductionImportJob | null;
  onDownloadErrors: () => void;
  onRetry: () => void;
}) {
  if (!job) return null;
  const hasErrorFile =
    job.statusCode === "COMPLETED_WITH_ERRORS" || job.failedRows > 0;
  return (
    <div aria-label="批量导入处理结果" className={className} role="status">
      <span>{businessImportMessage(job)}</span>
      {hasErrorFile && (
        <button disabled={busy} type="button" onClick={onDownloadErrors}>
          下载错误清单
        </button>
      )}
      {job.statusCode === "FAILED" && (
        <button disabled={busy} type="button" onClick={onRetry}>
          重试导入
        </button>
      )}
    </div>
  );
}
