import type {
  BusinessImportDraft,
  ProductionImportJob,
} from "@/platform/api/realtimeBusinessRepository";

import { businessImportMessage } from "./businessImportWorkflow";

export function BusinessImportStatus({
  busy,
  className,
  job,
  drafts = [],
  onDownloadErrors,
  onRetry,
  onSubmitDraft,
}: {
  busy: boolean;
  className: string;
  job: ProductionImportJob | null;
  drafts?: readonly BusinessImportDraft[];
  onDownloadErrors: () => void;
  onRetry: () => void;
  onSubmitDraft?: (draftId: string) => void;
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
      {drafts.length > 0 && (
        <div aria-label="本次导入草稿">
          <p>
            每行已独立保存；业务数据可留空，具备正式审核基础信息的行可提交审核。
          </p>
          <ul>
            {drafts.map((draft) => (
              <li key={draft.id}>
                <span>
                  第 {draft.sourceRowNumber} 行 ·{" "}
                  {draft.sampleName || "未命名样本点"} ·{" "}
                  {draft.stateCode === "PROMOTED"
                    ? "已提交审核"
                    : draft.missingFields.length > 0
                      ? "已保存为草稿，需补充基础信息后重新导入"
                      : "已保存为草稿"}
                </span>
                {draft.stateCode === "DRAFT" &&
                  draft.missingFields.length === 0 &&
                  onSubmitDraft && (
                    <button
                      disabled={busy}
                      type="button"
                      onClick={() => onSubmitDraft(draft.id)}
                    >
                      提交审核
                    </button>
                  )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
