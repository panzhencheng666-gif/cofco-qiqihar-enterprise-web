import type { ProductionImportJob } from "@/platform/api/realtimeBusinessRepository";

function correctionMessage(job: ProductionImportJob) {
  switch (job.statusCode) {
    case "QUEUED":
      return "批量修正已提交，正在排队处理。";
    case "PROCESSING":
      return "正在批量修正退回原单，请稍候。";
    case "COMPLETED":
    case "COMPLETED_WITH_ERRORS":
      return `批量修正完成：${job.importedRows} 条原单已重新进入待审核，失败 ${job.failedRows} 条。`;
    case "FAILED":
      return `批量修正未完成：${job.failureMessage || "请重新核对并下载最新修正表。"}`;
  }
}

export function ReturnedCorrectionStatus({
  busy,
  className,
  job,
  onDownloadErrors,
}: {
  busy: boolean;
  className: string;
  job: ProductionImportJob | null;
  onDownloadErrors: () => void;
}) {
  if (!job) return null;
  const hasErrorFile =
    job.statusCode === "COMPLETED_WITH_ERRORS" || job.failedRows > 0;
  return (
    <div aria-label="退回记录批量修正结果" className={className} role="status">
      <span>{correctionMessage(job)}</span>
      {hasErrorFile && (
        <button disabled={busy} type="button" onClick={onDownloadErrors}>
          下载修正错误清单
        </button>
      )}
    </div>
  );
}
