import { useState } from "react";
import type {
  FormalSampleRetirementPreview,
  MasterRegion,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";

export function FormalSampleBatchRetirement({
  repository,
  regions,
  disabled,
  onCompleted,
}: {
  repository: RealtimeBusinessRepository;
  regions: readonly MasterRegion[];
  disabled: boolean;
  onCompleted: () => Promise<void>;
}) {
  const [preview, setPreview] = useState<FormalSampleRetirementPreview | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [submittedReason, setSubmittedReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  if (
    !repository.previewFormalSampleRetirement ||
    !repository.executeFormalSampleRetirement ||
    !repository.getFormalSampleRetirementPreview
  )
    return null;

  const open = async () => {
    setBusy(true);
    setMessage("");
    try {
      setPreview(await repository.previewFormalSampleRetirement!());
      setReason("");
      setSubmittedReason(null);
      setConfirmed(false);
    } catch (error) {
      setMessage(
        error instanceof RealtimeApiError
          ? (error.clientMessage ?? "预览加载失败，请重试。")
          : "预览加载失败，请重试。",
      );
    } finally {
      setBusy(false);
    }
  };
  const complete = async (result: FormalSampleRetirementPreview) => {
    setPreview(result);
    try {
      await onCompleted();
      setMessage(`已淘汰 ${result.retiredCount} 个样本，列表已重新查询。`);
    } catch {
      setMessage(
        `已淘汰 ${result.retiredCount} 个样本，但列表刷新失败，请刷新页面查看。`,
      );
    }
  };
  const execute = async () => {
    if (!preview) return;
    const fixedReason = submittedReason ?? reason.trim();
    setSubmittedReason(fixedReason);
    setBusy(true);
    setMessage("");
    try {
      const result = await repository.executeFormalSampleRetirement!(
        preview.id,
        fixedReason,
      );
      await complete(result);
    } catch (error) {
      try {
        const result = await repository.getFormalSampleRetirementPreview!(
          preview.id,
        );
        if (result.retiredCount !== null) {
          await complete(result);
          return;
        }
      } catch {
        /* Keep the same preview and reason for a safe retry. */
      }
      if (
        error instanceof RealtimeApiError &&
        error.code === "RETIREMENT_PREVIEW_STALE"
      ) {
        setPreview(null);
        setSubmittedReason(null);
        setMessage("样本集合、版本或有效期已变化，未执行淘汰，请重新预览。");
      } else if (
        error instanceof RealtimeApiError &&
        [400, 403, 404, 409].includes(error.status) &&
        error.code !== "RETIREMENT_RETRY_REQUIRED"
      ) {
        setPreview(null);
        setSubmittedReason(null);
        setMessage(
          error.clientMessage ??
            "本次请求未获准执行，请核对权限和原因后重新预览。",
        );
      } else {
        setMessage("本次执行尚未确认完成。请使用同一预览重试并查询结果。");
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button
        type="button"
        disabled={
          disabled ||
          busy ||
          (preview !== null && preview.retiredCount === null)
        }
        onClick={() => void open()}
      >
        批量淘汰现有样本
      </button>
      {message && <p role="status">{message}</p>}
      {preview && (
        <section
          className="formal-sample-page enterprise-ledger-drawer formal-sample-retirement"
          aria-label="批量淘汰现有样本确认"
        >
          <h3>批量淘汰现有样本</h3>
          <p>
            范围：当前账号全部授权地区的现有样本，包含全部品种和业务类型，不受本页筛选及分页影响。同一样本只淘汰一次，保留历史资料。
          </p>
          <p>
            共 {preview.candidateCount} 个样本；淘汰归属{" "}
            {preview.businessDate.slice(0, 4)} 年。预览有效期至{" "}
            {new Date(preview.expiresAt).toLocaleTimeString("zh-CN", {
              timeZone: "Asia/Shanghai",
            })}
            （北京时间）。
          </p>
          <details>
            <summary>查看完整样本清单</summary>
            <ul>
              {preview.candidates.map((point) => (
                <li key={point.id}>
                  {point.name} ·{" "}
                  {regions.find((region) => region.code === point.regionCode)
                    ?.name ?? "授权地区"}
                </li>
              ))}
            </ul>
          </details>
          {preview.retiredCount === null && (
            <>
              <label>
                淘汰原因
                <textarea
                  aria-label="批量淘汰原因"
                  maxLength={500}
                  value={reason}
                  disabled={busy || submittedReason !== null}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={busy}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                我已核对完整清单，确认淘汰上述全部样本
              </label>
              <button
                className="is-danger"
                type="button"
                disabled={
                  busy ||
                  !confirmed ||
                  !reason.trim() ||
                  preview.candidateCount === 0
                }
                onClick={() => void execute()}
              >
                {busy ? "正在处理" : "确认批量淘汰"}
              </button>
            </>
          )}
          <button
            type="button"
            disabled={
              busy ||
              (submittedReason !== null && preview.retiredCount === null)
            }
            onClick={() => setPreview(null)}
          >
            关闭
          </button>
        </section>
      )}
    </>
  );
}
