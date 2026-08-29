import { useCallback, useEffect, useState } from "react";

import type {
  CurrentSession,
  RealtimeBusinessRepository,
  SampleIdentityMergeJob,
  SampleIdentityMergeRequest,
  SampleIdentityReviewItem,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";

import "./sample-point-coordinate-governance.css";

function errorMessage(error: unknown): string {
  if (error instanceof RealtimeApiError && error.clientMessage) {
    return error.clientMessage;
  }
  return "样本点身份治理操作未完成，请稍后重试。";
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function jobStatus(status: SampleIdentityMergeJob["statusCode"]): string {
  if (status === "PENDING_REVIEW") return "等待身份归并审核";
  if (status === "COMPLETED_WITH_ERRORS") return "校验完成，存在失败行";
  return "已完成";
}

function isCoordinateSharingReview(item: SampleIdentityReviewItem): boolean {
  return item.reasonCode === "SAMPLE_COORDINATE_SHARED_REVIEW_REQUIRED";
}

export function SamplePointIdentityGovernancePanel({
  mode = "all",
  repository,
}: {
  mode?: "all" | "manage" | "import-review" | "merge-review";
  repository: RealtimeBusinessRepository;
}) {
  const [session, setSession] = useState<CurrentSession | null>(null);
  const [reviews, setReviews] = useState<readonly SampleIdentityReviewItem[]>(
    [],
  );
  const [jobs, setJobs] = useState<readonly SampleIdentityMergeJob[]>([]);
  const [mergeRequests, setMergeRequests] = useState<
    readonly SampleIdentityMergeRequest[]
  >([]);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(
    async (activeSession: CurrentSession) => {
      const canReview = activeSession.permissions.includes("BUSINESS_APPROVE");
      const canImport = activeSession.permissions.includes("BUSINESS_IMPORT");
      const [nextReviews, nextJobs, nextRequests] = await Promise.all([
        canReview && (mode === "all" || mode === "import-review")
          ? repository.listSampleIdentityReviews?.()
          : [],
        canImport && (mode === "all" || mode === "manage")
          ? repository.listSampleIdentityMergeJobs?.()
          : [],
        canReview && (mode === "all" || mode === "merge-review")
          ? repository.listSampleIdentityMergeRequests?.()
          : [],
      ]);
      setReviews(nextReviews ?? []);
      setJobs(nextJobs ?? []);
      setMergeRequests(nextRequests ?? []);
    },
    [mode, repository],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const nextSession = await repository.loadCurrentSession();
        if (!active) return;
        setSession(nextSession);
        await refresh(nextSession);
      } catch (cause) {
        if (active) setError(errorMessage(cause));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refresh, repository]);

  useEffect(() => {
    if (!session || !repository.subscribeBusinessEvents) return undefined;
    return repository.subscribeBusinessEvents(0, (event) => {
      if (
        event.actionCode !== "SAMPLE_IDENTITY_MERGE_APPLIED" &&
        !event.actionCode.startsWith("SAMPLE_IDENTITY_REVIEW_")
      ) {
        return;
      }
      void refresh(session).catch((cause: unknown) => {
        setError(errorMessage(cause));
      });
    });
  }, [refresh, repository, session]);

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
    return session ? refresh(session) : Promise.resolve();
  }

  function decideImportIdentity(
    item: SampleIdentityReviewItem,
    decision: "LINK_EXISTING" | "CONFIRM_DISTINCT" | "RETURN_FOR_CORRECTION",
  ) {
    if (!repository.decideSampleIdentityReview) return;
    const target = decision === "LINK_EXISTING" ? targets[item.draftId] : null;
    if (decision === "LINK_EXISTING" && !target) return;
    const promptLabel =
      decision === "LINK_EXISTING"
        ? "请填写认定为同一真实样本点的核验依据"
        : decision === "CONFIRM_DISTINCT"
          ? isCoordinateSharingReview(item)
            ? "请填写证明不同对象合法共址的真实材料和核验依据"
            : "请填写认定为不同真实样本点的核验依据"
          : "请填写退回修正原因";
    const reason = window.prompt(promptLabel, "");
    if (reason === null || !reason.trim()) return;
    void runAction(`identity:${item.draftId}`, async () => {
      await repository.decideSampleIdentityReview!(
        item.draftId,
        decision,
        target,
        item.version,
        reason.trim(),
      );
      await refreshAfterMutation();
      setMessage(
        decision === "RETURN_FOR_CORRECTION"
          ? "已退回修正，当前行不会进入正式业务记录。"
          : isCoordinateSharingReview(item)
            ? "合法共址核验已记录，原导入草稿已继续进入业务审核链；最终审核时还会复核坐标占用情况。"
            : "身份核验完成，原导入草稿已继续进入业务审核链。",
      );
    });
  }

  function exportWorkbook() {
    if (!repository.downloadSampleIdentityMergeWorkbook) return;
    void runAction("merge-export", async () => {
      const blob = await repository.downloadSampleIdentityMergeWorkbook!();
      saveBlob(blob, "历史重复样本身份安全治理包.xlsx");
      setMessage("历史身份治理包已从服务端导出；灰色列不可修改。 ");
    });
  }

  function uploadWorkbook() {
    if (!file || !repository.uploadSampleIdentityMergeWorkbook) return;
    void runAction("merge-upload", async () => {
      const job = await repository.uploadSampleIdentityMergeWorkbook!(
        file,
        crypto.randomUUID(),
      );
      await refreshAfterMutation();
      setMessage(`上传完成，${job.pendingRequests} 条归并申请等待审核。`);
    });
  }

  function reviewMerge(
    item: SampleIdentityMergeRequest,
    decision: "APPROVE" | "REJECT",
  ) {
    if (!repository.reviewSampleIdentityMergeRequest) return;
    const reason = window.prompt(
      decision === "APPROVE" ? "请填写身份归并审核依据" : "请填写驳回原因",
      "",
    );
    if (reason === null || !reason.trim()) return;
    void runAction(`merge-review:${item.requestId}`, async () => {
      await repository.reviewSampleIdentityMergeRequest!(
        item.requestId,
        decision,
        reason.trim(),
      );
      await refreshAfterMutation();
      setMessage(
        decision === "APPROVE"
          ? "归并审核通过：原记录与业务事实未改，地图读取统一规范样本点。"
          : "归并申请已驳回，原身份关联保持不变。",
      );
    });
  }

  return (
    <section
      aria-label="样本点身份治理"
      className="sample-coordinate-governance sample-identity-governance"
    >
      <header className="sample-coordinate-governance__header">
        <div>
          <span>稳定样本身份与跨期连续性</span>
          <h2>样本点身份治理</h2>
          <p>
            名称相同不等于同一个样本点。系统结合联系方式、地区、坐标和期间先拦截不清楚的记录；人工核验后才继续审核。历史重复身份只追加解析关系，不删除样本点、不重写原业务记录。
          </p>
        </div>
      </header>

      {loading && <p role="status">正在读取身份治理任务…</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      {(mode === "all" || mode === "import-review") && canReview && (
        <div className="sample-coordinate-governance__section">
          <header>
            <div>
              <h3>新导入身份待核验</h3>
              <p>
                “待核验”表示系统发现同名、多个候选或坐标已被占用，尚不能安全判断。选择真实已有样本点、确认确为不同对象，或退回填报人补充证据。
              </p>
            </div>
          </header>
          {reviews.length === 0 ? (
            <p className="sample-coordinate-governance__empty">
              当前授权范围内没有新导入身份待核验记录。
            </p>
          ) : (
            <div className="sample-coordinate-governance__review-grid">
              {reviews.map((item) => (
                <article key={item.draftId}>
                  <header>
                    <div>
                      <h4>{item.sampleName}</h4>
                      <span>
                        {item.domainCode === "PRODUCTION" ? "产情" : "市场"} ·{" "}
                        {item.surveyPeriod}
                      </span>
                    </div>
                    <strong>
                      {isCoordinateSharingReview(item)
                        ? "坐标共址待核验"
                        : "身份待核验"}
                    </strong>
                  </header>
                  <dl>
                    <div>
                      <dt>联系方式</dt>
                      <dd>{item.sampleContact || "未填写"}</dd>
                    </div>
                    <div>
                      <dt>地区</dt>
                      <dd>{item.regionCode}</dd>
                    </div>
                    <div>
                      <dt>坐标</dt>
                      <dd>
                        {item.longitude}, {item.latitude}
                      </dd>
                    </div>
                    <div>
                      <dt>判断原因</dt>
                      <dd>{item.reasonMessage}</dd>
                    </div>
                  </dl>
                  {isCoordinateSharingReview(item) && (
                    <p>
                      确认前请核对经营主体、联系方式、现场地址或其他真实材料；证据不足请退回补充。
                    </p>
                  )}
                  {item.candidates.length > 0 && (
                    <label className="sample-identity-governance__candidate">
                      <span>
                        {isCoordinateSharingReview(item)
                          ? "同坐标已有样本点"
                          : "规范样本点候选"}
                      </span>
                      <select
                        aria-label={`选择${item.sampleName}的规范样本点`}
                        value={targets[item.draftId] ?? ""}
                        onChange={(event) =>
                          setTargets((current) => ({
                            ...current,
                            [item.draftId]: event.target.value,
                          }))
                        }
                      >
                        <option value="">请选择核验后的真实样本点</option>
                        {item.candidates.map((candidate) => (
                          <option
                            key={candidate.samplePointId}
                            value={candidate.samplePointId}
                          >
                            {candidate.canonicalName} ·{" "}
                            {candidate.sampleContact} · 已审核{" "}
                            {candidate.approvedRecordCount} 条
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="sample-coordinate-governance__row-actions">
                    <button
                      aria-label={`关联已有样本点${item.sampleName}`}
                      disabled={
                        !targets[item.draftId] ||
                        busyAction === `identity:${item.draftId}`
                      }
                      type="button"
                      onClick={() =>
                        decideImportIdentity(item, "LINK_EXISTING")
                      }
                    >
                      关联已有样本点
                    </button>
                    <button
                      aria-label={`${isCoordinateSharingReview(item) ? "确认合法共址" : "确认不同身份"}${item.sampleName}`}
                      disabled={busyAction === `identity:${item.draftId}`}
                      type="button"
                      onClick={() =>
                        decideImportIdentity(item, "CONFIRM_DISTINCT")
                      }
                    >
                      {isCoordinateSharingReview(item)
                        ? "确认不同对象且合法共址"
                        : "确认是不同对象"}
                    </button>
                    <button
                      aria-label={`退回修正${item.sampleName}`}
                      disabled={busyAction === `identity:${item.draftId}`}
                      type="button"
                      onClick={() =>
                        decideImportIdentity(item, "RETURN_FOR_CORRECTION")
                      }
                    >
                      退回补充证据
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {(mode === "all" || mode === "manage") && canImport && (
        <div className="sample-coordinate-governance__section">
          <header>
            <div>
              <h3>历史重复身份治理</h3>
              <p>
                导出系统绑定的全量清单，在黄色列填写归并、保留或暂缓；上传只形成申请，审核通过后才生效。
              </p>
            </div>
            <button
              disabled={busyAction === "merge-export"}
              type="button"
              onClick={exportWorkbook}
            >
              导出历史重复身份清单
            </button>
          </header>
          <div className="sample-coordinate-governance__upload">
            <label>
              <span>选择历史身份治理文件</span>
              <input
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                aria-label="选择历史身份治理文件"
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <button
              disabled={!file || busyAction === "merge-upload"}
              type="button"
              onClick={uploadWorkbook}
            >
              上传并校验身份治理文件
            </button>
          </div>
        </div>
      )}

      {(mode === "all" || mode === "manage") && (
        <div className="sample-coordinate-governance__section">
          <header>
            <div>
              <h3>身份治理任务历史</h3>
              <p>刷新或重新登录后仍可查看服务端任务结果。</p>
            </div>
          </header>
          {jobs.length === 0 ? (
            <p className="sample-coordinate-governance__empty">
              当前账号暂无历史身份治理任务。
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
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.jobId}>
                      <td>
                        <strong>历史重复身份治理</strong>
                        <small>
                          {job.pendingRequests > 0
                            ? "待复核治理申请"
                            : "已处理治理任务"}
                        </small>
                      </td>
                      <td>{jobStatus(job.statusCode)}</td>
                      <td>
                        待审核 {job.pendingRequests} · 保持现状{" "}
                        {job.skippedRows} · 失败 {job.failedRows}
                      </td>
                      <td>{new Date(job.createdAt).toLocaleString("zh-CN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(mode === "all" || mode === "merge-review") && canReview && (
        <div className="sample-coordinate-governance__section">
          <header>
            <div>
              <h3>历史身份归并审核</h3>
              <p>核对原记录、当前样本点、规范样本点和经办依据后形成结论。</p>
            </div>
          </header>
          {mergeRequests.length === 0 ? (
            <p className="sample-coordinate-governance__empty">
              当前授权范围内没有待审核身份归并。
            </p>
          ) : (
            <div className="sample-coordinate-governance__review-grid">
              {mergeRequests.map((item) => (
                <article key={item.requestId}>
                  <header>
                    <div>
                      <h4>{item.sourceRecordId}</h4>
                      <span>
                        {item.sourceDomain} · {item.regionCode}
                      </span>
                    </div>
                    <strong>待审核</strong>
                  </header>
                  <dl>
                    <div>
                      <dt>当前 ID</dt>
                      <dd>{item.currentSamplePointId}</dd>
                    </div>
                    <div>
                      <dt>规范 ID</dt>
                      <dd>{item.targetSamplePointId}</dd>
                    </div>
                    <div>
                      <dt>核验依据</dt>
                      <dd>{item.reviewBasis}</dd>
                    </div>
                    <div>
                      <dt>提交人</dt>
                      <dd>{item.requestedBy}</dd>
                    </div>
                  </dl>
                  <div className="sample-coordinate-governance__row-actions">
                    <button
                      aria-label={`审核通过身份归并${item.sourceRecordId}`}
                      disabled={busyAction === `merge-review:${item.requestId}`}
                      type="button"
                      onClick={() => reviewMerge(item, "APPROVE")}
                    >
                      审核通过
                    </button>
                    <button
                      aria-label={`审核驳回身份归并${item.sourceRecordId}`}
                      disabled={busyAction === `merge-review:${item.requestId}`}
                      type="button"
                      onClick={() => reviewMerge(item, "REJECT")}
                    >
                      驳回归并
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
