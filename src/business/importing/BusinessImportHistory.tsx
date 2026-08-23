import { type ReactNode, useEffect, useMemo, useState } from "react";

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
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

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

  const displayedJobs = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    return page.items.filter((job) => {
      if (status && job.statusCode !== status) return false;
      if (!normalized) return true;
      return businessImportScopeLabel(job)
        .toLocaleLowerCase("zh-CN")
        .includes(normalized);
    });
  }, [page.items, query, status]);

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
  const statusCount = (code: ProductionImportJob["statusCode"]) =>
    page.items.filter((job) => job.statusCode === code).length;

  return (
    <section aria-label="导入任务列表" className="business-import-history">
      <div className="business-import-history__filters">
        <label>
          <span>搜索批次</span>
          <input
            aria-label="搜索导入批次"
            placeholder="搜索批次编号或产品"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span>任务状态</span>
          <select
            aria-label="导入任务状态"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">全部任务状态</option>
            <option value="QUEUED">等待处理</option>
            <option value="PROCESSING">处理中</option>
            <option value="COMPLETED">已完成</option>
            <option value="COMPLETED_WITH_ERRORS">待修正</option>
            <option value="FAILED">处理失败</option>
          </select>
        </label>
        <button
          aria-label="刷新导入任务记录"
          disabled={loading}
          type="button"
          onClick={refresh}
        >
          {loading ? "正在同步" : "刷新"}
        </button>
      </div>

      <div
        aria-label="导入任务概况"
        className="business-import-history__summary-band"
        role="status"
      >
        <strong>共 {page.totalElements} 个批次</strong>
        <span>处理中 {statusCount("PROCESSING") + statusCount("QUEUED")}</span>
        <span>
          待修正 {statusCount("COMPLETED_WITH_ERRORS") + statusCount("FAILED")}
        </span>
        <span>已完成 {statusCount("COMPLETED")}</span>
        <span className="business-import-history__summary-note">
          导入通过后进入原业务审核流程
        </span>
      </div>

      <header className="business-import-history__header">
        <div>
          <strong>导入批次</strong>
          <small>选择批次查看处理进度、错误原因和下一步。</small>
        </div>
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
      {!loading &&
        !loadFailed &&
        page.items.length > 0 &&
        displayedJobs.length === 0 && (
          <p className="business-import-history__empty">
            当前筛选条件下没有导入任务。
          </p>
        )}

      <div className="business-import-history__split">
        <div className="business-import-history__table-side">
          {displayedJobs.length > 0 && (
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
                  {displayedJobs.map((job, index) => {
                    const selected = selectedJobId === job.id;
                    const totalRows = job.importedRows + job.failedRows;
                    return (
                      <tr
                        aria-selected={selected}
                        className={
                          selected
                            ? "business-import-history__selected"
                            : undefined
                        }
                        key={job.id}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <footer className="business-import-history__pagination">
            <span>
              第 {displayedPage} / {page.totalPages} 页 · 共{" "}
              {page.totalElements} 项
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
        </div>
        <aside
          aria-label="当前导入批次详情"
          className="business-import-history__detail-drawer"
        >
          {selectedDetail ?? (
            <div className="business-import-history__detail-empty">
              <strong>选择一条导入任务</strong>
              <p>
                点击左侧“查看”，可核对失败原因、下载错误清单并继续处理当前真实批次。
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
