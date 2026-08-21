import { useCallback, useEffect, useState } from "react";

import type {
  CurrentSession,
  RealtimeBusinessRepository,
  SamplePointCoordinateCorrectionJob,
  SamplePointCoordinateCorrectionRequest,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";

import "./sample-point-coordinate-governance.css";

function errorMessage(error: unknown): string {
  if (error instanceof RealtimeApiError && error.clientMessage) {
    return error.clientMessage;
  }
  return "坐标治理操作未完成，请稍后重试。";
}

function statusLabel(
  status: SamplePointCoordinateCorrectionJob["statusCode"],
): string {
  if (status === "PENDING_REVIEW") return "等待独立审核";
  if (status === "COMPLETED_WITH_ERRORS") return "校验完成，存在失败行";
  return "已完成";
}

function requestStatusLabel(
  status: SamplePointCoordinateCorrectionRequest["statusCode"],
): string {
  if (status === "PENDING_REVIEW") return "待独立审核";
  if (status === "APPLIED") return "已审核并原位应用";
  return "已驳回";
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function SamplePointCoordinateGovernancePanel({
  repository,
}: {
  repository: RealtimeBusinessRepository;
}) {
  const [session, setSession] = useState<CurrentSession | null>(null);
  const [jobs, setJobs] = useState<
    readonly SamplePointCoordinateCorrectionJob[]
  >([]);
  const [requests, setRequests] = useState<
    readonly SamplePointCoordinateCorrectionRequest[]
  >([]);
  const [selectedJob, setSelectedJob] =
    useState<SamplePointCoordinateCorrectionJob | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refreshLists = useCallback(
    async (activeSession: CurrentSession) => {
      const canImport = activeSession.permissions.includes("BUSINESS_IMPORT");
      const nextJobs = canImport
        ? await repository.listSamplePointCoordinateCorrectionJobs?.()
        : [];
      const canReview = activeSession.permissions.includes("BUSINESS_APPROVE");
      const nextRequests = canReview
        ? await repository.listSamplePointCoordinateCorrectionRequests?.()
        : [];
      setJobs(nextJobs ?? []);
      setRequests(nextRequests ?? []);
    },
    [repository],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const nextSession = await repository.loadCurrentSession();
        if (!active) return;
        setSession(nextSession);
        await refreshLists(nextSession);
      } catch (cause) {
        if (active) setError(errorMessage(cause));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshLists, repository]);

  useEffect(() => {
    if (!session || !repository.subscribeBusinessEvents) return undefined;
    return repository.subscribeBusinessEvents(0, (event) => {
      if (event.actionCode !== "SAMPLE_POINT_COORDINATE_CORRECTION_APPLIED") {
        return;
      }
      void refreshLists(session).catch((cause: unknown) => {
        setError(errorMessage(cause));
      });
    });
  }, [refreshLists, repository, session]);

  const canImport = session?.permissions.includes("BUSINESS_IMPORT") ?? false;
  const canReview = session?.permissions.includes("BUSINESS_APPROVE") ?? false;

  async function runAction(action: string, operation: () => Promise<void>) {
    setBusyAction(action);
    setMessage("");
    setError("");
    try {
      await operation();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyAction(null);
    }
  }

  function refreshAfterMutation() {
    if (!session) return Promise.resolve();
    return refreshLists(session);
  }

  function exportWorkbook() {
    if (!repository.downloadSamplePointCoordinateCorrectionWorkbook) return;
    void runAction("export", async () => {
      const blob =
        await repository.downloadSamplePointCoordinateCorrectionWorkbook!();
      saveBlob(blob, "总揽监测全局重复坐标样本点安全修正包.xlsx");
      setMessage("安全修正包已从服务端导出。请仅填写修正坐标和核验依据。");
    });
  }

  function uploadWorkbook() {
    if (!file || !repository.uploadSamplePointCoordinateCorrectionWorkbook)
      return;
    void runAction("upload", async () => {
      const uploaded =
        await repository.uploadSamplePointCoordinateCorrectionWorkbook!(
          file,
          crypto.randomUUID(),
        );
      await refreshAfterMutation();
      const pendingRows = uploaded.pendingReviewRows || 1;
      setMessage(`上传完成，${pendingRows} 行已进入独立审核。`);
    });
  }

  function restoreJob(jobId: string) {
    if (!repository.getSamplePointCoordinateCorrectionJob) return;
    void runAction(`detail:${jobId}`, async () => {
      setSelectedJob(
        await repository.getSamplePointCoordinateCorrectionJob!(jobId),
      );
    });
  }

  function downloadErrors(jobId: string) {
    if (!repository.downloadSamplePointCoordinateCorrectionErrors) return;
    void runAction(`errors:${jobId}`, async () => {
      const blob =
        await repository.downloadSamplePointCoordinateCorrectionErrors!(jobId);
      saveBlob(blob, `样本点坐标修正错误清单_${jobId}.csv`);
    });
  }

  function retryFailedRows(jobId: string) {
    if (!repository.retrySamplePointCoordinateCorrectionJob) return;
    void runAction(`retry:${jobId}`, async () => {
      await repository.retrySamplePointCoordinateCorrectionJob!(
        jobId,
        crypto.randomUUID(),
      );
      await refreshAfterMutation();
      setMessage("失败行已创建新的重试任务，原任务历史继续保留。");
    });
  }

  function review(
    item: SamplePointCoordinateCorrectionRequest,
    decision: "APPROVE" | "REJECT",
  ) {
    if (!repository.reviewSamplePointCoordinateCorrection) return;
    const reason = window.prompt(
      decision === "APPROVE" ? "请填写审核依据" : "请填写驳回原因",
      "",
    );
    if (reason === null || !reason.trim()) return;
    void runAction(`review:${item.requestId}`, async () => {
      await repository.reviewSamplePointCoordinateCorrection!(
        item.requestId,
        decision,
        reason.trim(),
      );
      await refreshAfterMutation();
      setMessage(
        decision === "APPROVE"
          ? "审核通过，服务端已按稳定样本点 ID 和版本原位应用。"
          : "修正请求已驳回，原样本点坐标未改变。",
      );
    });
  }

  return (
    <section
      aria-label="样本点坐标治理"
      className="sample-coordinate-governance"
    >
      <header className="sample-coordinate-governance__header">
        <div>
          <span>稳定样本点主数据治理</span>
          <h2>样本点坐标治理</h2>
          <p>
            导出绑定式修正包并上传校验；上传不会直接更新地图，审核通过后才按同一稳定样本点
            ID
            原位应用。普通账号需他人复核，平台唯一所有者可按特权规则自审并全程留痕。
          </p>
        </div>
        {canImport && (
          <button
            disabled={busyAction === "export"}
            type="button"
            onClick={exportWorkbook}
          >
            导出待修正清单
          </button>
        )}
      </header>

      {loading && <p role="status">正在读取坐标治理历史…</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      {canImport && (
        <div className="sample-coordinate-governance__upload">
          <label>
            <span>选择坐标修正文件</span>
            <input
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-label="选择坐标修正文件"
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <button
            disabled={!file || busyAction === "upload"}
            type="button"
            onClick={uploadWorkbook}
          >
            上传并校验坐标修正文件
          </button>
        </div>
      )}

      <div className="sample-coordinate-governance__section">
        <header>
          <div>
            <h3>修正任务历史</h3>
            <p>
              历史、失败结果和重试链均来自服务端持久记录，刷新或重登后可恢复查看。
            </p>
          </div>
          <button
            disabled={!session || busyAction === "refresh"}
            type="button"
            onClick={() => {
              if (!session) return;
              void runAction("refresh", () => refreshLists(session));
            }}
          >
            重新读取
          </button>
        </header>
        {jobs.length === 0 && !loading ? (
          <p className="sample-coordinate-governance__empty">
            当前账号暂无坐标修正任务。
          </p>
        ) : (
          <div className="sample-coordinate-governance__table-wrap">
            <table>
              <thead>
                <tr>
                  <th>任务</th>
                  <th>状态</th>
                  <th>结果</th>
                  <th>提交时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((item) => (
                  <tr key={item.jobId}>
                    <td>
                      <strong>{item.jobId}</strong>
                      <small>批次 {item.batchId}</small>
                    </td>
                    <td>{statusLabel(item.statusCode)}</td>
                    <td>
                      待审核 {item.pendingReviewRows} 行 · 失败{" "}
                      {item.failedRows} 行
                    </td>
                    <td>{new Date(item.createdAt).toLocaleString("zh-CN")}</td>
                    <td>
                      <div className="sample-coordinate-governance__row-actions">
                        <button
                          type="button"
                          onClick={() => restoreJob(item.jobId)}
                        >
                          查看详情
                        </button>
                        {item.failedRows > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => downloadErrors(item.jobId)}
                            >
                              下载错误清单
                            </button>
                            <button
                              aria-label={`重试任务 ${item.jobId} 的失败行`}
                              type="button"
                              onClick={() => retryFailedRows(item.jobId)}
                            >
                              重试失败行
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedJob && (
        <aside
          aria-label="坐标修正任务详情"
          className="sample-coordinate-governance__detail"
        >
          <header>
            <h3>任务 {selectedJob.jobId}</h3>
            <button type="button" onClick={() => setSelectedJob(null)}>
              关闭
            </button>
          </header>
          <p>
            {statusLabel(selectedJob.statusCode)} · 共 {selectedJob.totalRows}{" "}
            行 · 失败 {selectedJob.failedRows} 行
          </p>
          <ul>
            {selectedJob.rowResults.map((row) => (
              <li key={`${row.rowNumber}-${row.samplePointId}`}>
                第 {row.rowNumber} 行 · {row.samplePointId} · {row.message}
              </li>
            ))}
          </ul>
        </aside>
      )}

      {canReview && (
        <div className="sample-coordinate-governance__section">
          <header>
            <div>
              <h3>独立审核队列</h3>
              <p>
                审核人必须核对身份、原坐标、修正坐标和核验依据；普通提交人不能自审，平台唯一所有者按特权规则处理并留痕。
              </p>
            </div>
          </header>
          {requests.length === 0 ? (
            <p className="sample-coordinate-governance__empty">
              当前授权范围内没有待审核修正。
            </p>
          ) : (
            <div className="sample-coordinate-governance__review-grid">
              {requests.map((item) => (
                <article key={item.requestId}>
                  <header>
                    <div>
                      <h4>{item.canonicalName}</h4>
                      <span>{item.regionCode}</span>
                    </div>
                    <strong>{requestStatusLabel(item.statusCode)}</strong>
                  </header>
                  <dl>
                    <div>
                      <dt>原坐标</dt>
                      <dd>
                        {item.originalLongitude}, {item.originalLatitude}
                      </dd>
                    </div>
                    <div>
                      <dt>修正坐标</dt>
                      <dd>
                        {item.correctedLongitude}, {item.correctedLatitude}
                      </dd>
                    </div>
                    <div>
                      <dt>核验依据</dt>
                      <dd>{item.coordinateSource}</dd>
                    </div>
                    <div>
                      <dt>经办备注</dt>
                      <dd>{item.correctionNote || "未填写"}</dd>
                    </div>
                  </dl>
                  {item.statusCode === "PENDING_REVIEW" && (
                    <div className="sample-coordinate-governance__row-actions">
                      <button
                        aria-label={`审核通过${item.canonicalName}`}
                        disabled={busyAction === `review:${item.requestId}`}
                        type="button"
                        onClick={() => review(item, "APPROVE")}
                      >
                        审核通过
                      </button>
                      <button
                        aria-label={`审核驳回${item.canonicalName}`}
                        disabled={busyAction === `review:${item.requestId}`}
                        type="button"
                        onClick={() => review(item, "REJECT")}
                      >
                        驳回修正
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
