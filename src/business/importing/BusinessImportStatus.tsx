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
      {(hasErrorFile || job.statusCode === "FAILED") && showSummary && (
        <details className="business-import-correction" open>
          <summary>填写范例</summary>
          <p>
            下载错误清单，对照每行原始内容和错误说明逐项修正；已成功的行无需再次上传。修改文件后，请上传更正后的
            XLSX；重试按钮仍使用原任务内容。
          </p>
          <table>
            <thead>
              <tr>
                <th>检查项</th>
                <th>不合格填写</th>
                <th>正确范例与处理</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>数值与单位</td>
                <td>100亩、1,000</td>
                <td>填写 100 或 1000；单位按表头，小数位数按模板要求。</td>
              </tr>
              <tr>
                <td>日期与月份</td>
                <td>9月15号、月份13</td>
                <td>
                  日期填写 2026-09-15；月份填写 1 至 12，年份填写四位数字。
                </td>
              </tr>
              <tr>
                <td>地区</td>
                <td>仅写同名村、上下级不一致</td>
                <td>
                  按模板选项填写完整所属地市、区县、乡镇和村；代码列使用模板中的地区代码。
                </td>
              </tr>
              <tr>
                <td>必填与重复</td>
                <td>必填项空白、同一条记录重复</td>
                <td>
                  补齐模板标记的必填项；相同样本、月份的重复行须先核对已有记录。
                </td>
              </tr>
            </tbody>
          </table>
        </details>
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
