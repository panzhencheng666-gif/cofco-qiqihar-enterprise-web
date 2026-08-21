import { Fragment, type ReactNode, useEffect, useState } from "react";

import type {
  BusinessImportDomain,
  Page,
  ProductionImportJob,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";

import { businessImportScopeLabel } from "./businessImportPresentation";

import "./BusinessImportHistory.css";

const historyPageSize = 5;

const emptyPage: Page<ProductionImportJob> = {
  items: [],
  pageNumber: 0,
  pageSize: historyPageSize,
  totalElements: 0,
  totalPages: 0,
};

const statusLabel: Readonly<Record<ProductionImportJob["statusCode"], string>> =
  {
    QUEUED: "等待处理",
    PROCESSING: "处理中",
    COMPLETED: "已完成",
    COMPLETED_WITH_ERRORS: "待修正",
    FAILED: "待修正",
  };

const statusIcon: Readonly<Record<ProductionImportJob["statusCode"], string>> =
  {
    QUEUED: "…",
    PROCESSING: "↻",
    COMPLETED: "✓",
    COMPLETED_WITH_ERRORS: "!",
    FAILED: "×",
  };

function formatCreatedAt(value: string | undefined) {
  if (!value) return "提交时间待同步";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "提交时间待同步";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function BusinessImportHistory({
  busy,
  domain,
  onRestore,
  refreshToken,
  repository,
  selectedDetail,
  selectedJobId,
}: {
  busy: boolean;
  domain: BusinessImportDomain;
  onRestore: (job: ProductionImportJob) => void;
  refreshToken?: string | number;
  repository?: RealtimeBusinessRepository;
  selectedDetail?: ReactNode;
  selectedJobId?: string;
}) {
  const [pageNumber, setPageNumber] = useState(0);
  const [page, setPage] = useState<Page<ProductionImportJob>>(emptyPage);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshRevision, setRefreshRevision] = useState(0);

  useEffect(() => {
    if (!repository?.listImportJobs) return;
    let cancelled = false;
    void repository
      .listImportJobs(domain, pageNumber, historyPageSize)
      .then((result) => {
        if (!cancelled) {
          setPage(result);
          setLoadFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [domain, pageNumber, refreshRevision, refreshToken, repository]);

  if (!repository?.listImportJobs) return null;

  const displayedPage = page.totalPages === 0 ? 0 : page.pageNumber + 1;
  const refresh = () => {
    setLoading(true);
    setLoadFailed(false);
    setRefreshRevision((value) => value + 1);
  };
  const moveToPage = (nextPageNumber: number) => {
    setLoading(true);
    setLoadFailed(false);
    setPageNumber(nextPageNumber);
  };

  return (
    <section aria-label="导入任务列表" className="business-import-history">
      <header className="business-import-history__header">
        <strong>导入任务台账</strong>
        <button
          aria-label="刷新导入任务记录"
          disabled={loading}
          type="button"
          onClick={refresh}
        >
          {loading ? "正在同步" : "刷新"}
        </button>
      </header>

      {loadFailed && (
        <div className="business-import-history__error" role="alert">
          任务列表暂时无法读取，请稍后重试。
        </div>
      )}

      {!loading && !loadFailed && page.items.length === 0 && (
        <p className="business-import-history__empty">
          当前没有可恢复的导入任务。
        </p>
      )}

      {page.items.length > 0 && (
        <div className="business-import-history__table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">批次范围</th>
                <th scope="col">总行数</th>
                <th scope="col">已完成</th>
                <th scope="col">待修正</th>
                <th scope="col">提交时间</th>
                <th scope="col">当前节点</th>
                <th aria-label="操作" scope="col" />
              </tr>
            </thead>
            <tbody>
              {page.items.map((job, index) => {
                const selected = selectedJobId === job.id;
                const totalRows = job.importedRows + job.failedRows;
                return (
                  <Fragment key={job.id}>
                    <tr
                      className={
                        selected
                          ? "business-import-history__selected"
                          : undefined
                      }
                    >
                      <th scope="row">{businessImportScopeLabel(job)}</th>
                      <td className="business-import-history__number">
                        {totalRows}
                      </td>
                      <td className="business-import-history__number business-import-history__completed">
                        {job.importedRows}
                      </td>
                      <td className="business-import-history__number business-import-history__pending">
                        {job.failedRows}
                      </td>
                      <td>{formatCreatedAt(job.createdAt)}</td>
                      <td>
                        <span
                          aria-hidden="true"
                          className={`business-import-history__status-icon business-import-history__status-icon--${job.statusCode.toLowerCase()}`}
                        >
                          {statusIcon[job.statusCode]}
                        </span>
                        {statusLabel[job.statusCode]}
                      </td>
                      <td>
                        <button
                          aria-label={`查看第 ${index + 1} 项导入结果`}
                          aria-current={selected ? "true" : undefined}
                          disabled={busy}
                          type="button"
                          onClick={() => onRestore(job)}
                        >
                          查看
                        </button>
                      </td>
                    </tr>
                    {selected && selectedDetail && (
                      <tr className="business-import-history__detail-row">
                        <td colSpan={7}>{selectedDetail}</td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <footer className="business-import-history__pagination">
        <span>
          第 {displayedPage} / {page.totalPages} 页 · 共 {page.totalElements} 项
        </span>
        <div>
          <button
            aria-label="导入任务上一页"
            disabled={loading || pageNumber <= 0}
            type="button"
            onClick={() => moveToPage(Math.max(0, pageNumber - 1))}
          >
            上一页
          </button>
          <button
            aria-label="导入任务下一页"
            disabled={loading || pageNumber + 1 >= page.totalPages}
            type="button"
            onClick={() => moveToPage(pageNumber + 1)}
          >
            下一页
          </button>
        </div>
      </footer>
    </section>
  );
}
