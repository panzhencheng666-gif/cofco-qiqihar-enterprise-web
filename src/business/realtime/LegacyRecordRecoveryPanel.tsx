import { useEffect, useState } from "react";
import type {
  BusinessRecordListItem,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";

/** Separate recovery queue: these rows are not formal observations or statistics. */
export function LegacyRecordRecoveryPanel({
  domain,
  productCode,
  repository,
  refreshToken,
  onOpen,
}: {
  domain: "market" | "production" | "logistics";
  productCode: "CORN" | "SOYBEAN" | "RICE";
  repository: RealtimeBusinessRepository;
  refreshToken: number;
  onOpen: (product: "CORN" | "SOYBEAN" | "RICE", id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState("PENDING_REVIEW");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    items: readonly BusinessRecordListItem[];
    totalPages: number;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    const input = {
      productCode,
      recovery: true,
      page,
      pageSize: 20,
      filters: { status },
    };
    const list = () =>
      domain === "market"
        ? repository.listMarket(input)
        : domain === "production"
          ? repository.listProduction(input)
          : repository.listLogistics(input);
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setResult(null);
      setError("");
      return list()
        .then((next) => {
          if (!cancelled) setResult(next);
        })
        .catch(() => {
          if (!cancelled)
            setError("旧填报记录读取失败，请确认登录和访问权限后重试。");
        });
    });
    return () => {
      cancelled = true;
    };
  }, [
    domain,
    productCode,
    repository,
    refreshToken,
    expanded,
    status,
    page,
    revision,
  ]);
  return (
    <section aria-label="旧填报恢复" className="realtime-business-panel">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        旧填报待校验
      </button>
      {expanded && (
        <>
          <p>
            旧记录尚未入库。打开后查看校验结果，修正并保存原记录；校验通过后进入正式数据。
          </p>
          <label>
            记录状态{" "}
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(0);
                setResult(null);
              }}
            >
              <option value="PENDING_REVIEW">待校验</option>
              <option value="RETURNED">待修正</option>
              <option value="DRAFT">旧草稿</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => setRevision((value) => value + 1)}
          >
            刷新旧记录
          </button>
          {error ? (
            <p role="alert">{error}</p>
          ) : !result ? (
            <p role="status">正在读取旧记录…</p>
          ) : (
            <>
              {!result.items.length ? (
                <p role="status">当前状态下没有可访问的旧记录。</p>
              ) : (
                <ul>
                  {result.items.map((row) => (
                    <li key={row.id}>
                      <span>
                        {row.values.MKT_SAMPLE_NAME ||
                          row.values.PROD_SAMPLE_NAME ||
                          row.values.LOG_SAMPLE_NAME ||
                          "未命名旧填报"}
                      </span>{" "}
                      <button
                        type="button"
                        onClick={() => onOpen(productCode, row.id)}
                      >
                        {row.allowedActions.includes("SAVE")
                          ? "查看并修正"
                          : "查看校验结果"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                disabled={page === 0}
                onClick={() => {
                  setResult(null);
                  setPage(page - 1);
                }}
              >
                上一页
              </button>
              <span>第 {page + 1} 页</span>
              <button
                type="button"
                disabled={page + 1 >= result.totalPages}
                onClick={() => {
                  setResult(null);
                  setPage(page + 1);
                }}
              >
                下一页
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
