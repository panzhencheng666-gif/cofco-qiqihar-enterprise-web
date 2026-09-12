import { useEffect, useState } from "react";
import type {
  FormalSampleObservationDomain,
  HistoricalFormalSample,
  HistoricalFormalSampleQuery,
  Page,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";
import { RealtimeRegionFilterSelect } from "../realtime/RealtimeRegionFilterSelect";
import { useRealtimeMasterData } from "../realtime/useRealtimeMasterData";
import { WorkspacePagination } from "../UnifiedWorkspacePrimitives";

const domains = [
  ["PRODUCTION", "产情"],
  ["MARKET", "市场"],
  ["LOGISTICS", "物流"],
] as const;
const products = [
  ["CORN", "玉米"],
  ["SOYBEAN", "大豆"],
  ["RICE", "稻谷"],
] as const;
function dateLabel(value: string | null): string {
  if (!value) return "无记录";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "日期未记录"
    : date.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
}
export function HistoricalSampleWorkspace({
  repository,
  refreshToken = 0,
  onViewRecord,
}: {
  repository: RealtimeBusinessRepository;
  refreshToken?: number;
  onViewRecord: (
    domain: "market" | "production" | "logistics",
    productCode: "CORN" | "SOYBEAN" | "RICE",
    recordId: string,
  ) => void;
}) {
  const [query, setQuery] = useState<HistoricalFormalSampleQuery>({
    domain: "PRODUCTION",
    productCode: "CORN",
    pageNumber: 0,
    pageSize: 20,
  });
  const [yearInput, setYearInput] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [regionInput, setRegionInput] = useState("");
  const [revision, setRevision] = useState(0);
  const [validationError, setValidationError] = useState("");
  const [loaded, setLoaded] = useState<{
    query: HistoricalFormalSampleQuery;
    page?: Page<HistoricalFormalSample>;
    error?: string;
  }>();
  const { masterData, masterDataError } = useRealtimeMasterData(repository);
  useEffect(() => {
    let active = true;
    if (!repository.listHistoricalFormalSamples) {
      queueMicrotask(() => {
        if (active)
          setLoaded({ query, error: "历史样本点查询暂不可用，请稍后重试。" });
      });
      return () => {
        active = false;
      };
    }
    void repository
      .listHistoricalFormalSamples(query)
      .then((page) => {
        if (active) setLoaded({ query, page });
      })
      .catch((error: unknown) => {
        if (active)
          setLoaded({
            query,
            error:
              error instanceof RealtimeApiError && error.clientMessage
                ? error.clientMessage
                : "历史样本点读取失败，请重试。",
          });
      });
    return () => {
      active = false;
    };
  }, [query, repository, refreshToken, revision]);
  const current = loaded?.query === query ? loaded : undefined;
  const loading = !current;
  const page = current?.page;
  const changeDomain = (domain: FormalSampleObservationDomain) =>
    setQuery((current) => ({ ...current, domain, pageNumber: 0 }));
  return (
    <div className="enterprise-ledger-workbench">
      <div className="enterprise-ledger-workbench__breadcrumb">
        总揽信息 / 历史样本点
      </div>
      <header className="enterprise-ledger-title enterprise-ledger-title--collection">
        <h1>历史样本点</h1>
        <p>查看已淘汰样本点及其最后一次记录</p>
      </header>
      <div
        className="enterprise-ledger-table__toolbar"
        role="tablist"
        aria-label="历史样本业务类型"
      >
        {domains.map(([domain, label]) => (
          <button
            key={domain}
            role="tab"
            aria-selected={query.domain === domain}
            type="button"
            onClick={() => changeDomain(domain)}
          >
            {label}
          </button>
        ))}
      </div>
      <form
        className="enterprise-ledger-query enterprise-ledger-query--market"
        aria-label="历史样本查询条件"
        onSubmit={(event) => {
          event.preventDefault();
          if (yearInput && !/^\d{4}$/.test(yearInput)) {
            setValidationError("请输入四位淘汰年份，或留空查询全部年份。");
            return;
          }
          setValidationError("");
          setQuery((current) => ({
            ...current,
            year: yearInput ? Number(yearInput) : undefined,
            regionCode: regionInput || undefined,
            keyword: keywordInput.trim() || undefined,
            pageNumber: 0,
          }));
        }}
      >
        <label>
          <span>品种</span>
          <select
            aria-label="历史样本品种"
            value={query.productCode}
            onChange={(event) =>
              setQuery((current) => ({
                ...current,
                productCode: event.target.value,
                pageNumber: 0,
              }))
            }
          >
            {products.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>淘汰年份（留空为全部年份）</span>
          <input
            aria-label="淘汰年份"
            inputMode="numeric"
            maxLength={4}
            value={yearInput}
            onChange={(event) => setYearInput(event.target.value)}
          />
        </label>
        <RealtimeRegionFilterSelect
          regions={masterData?.regions ?? []}
          authorizedRegionCodes={["*"]}
          value={regionInput}
          onChange={setRegionInput}
          disabled={!masterData}
        />
        <label>
          <span>样本点名称或地址</span>
          <input
            aria-label="历史样本关键词"
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
          />
        </label>
        <button type="submit">查询</button>
      </form>
      {validationError && <p role="alert">{validationError}</p>}
      {masterDataError && <p role="alert">{masterDataError}</p>}
      <section
        className="enterprise-ledger-table enterprise-ledger-table--market"
        aria-label="历史样本点台账"
      >
        <div className="enterprise-ledger-table__toolbar">
          <strong>
            {loading
              ? "正在读取历史样本点"
              : page
                ? `共 ${page.totalElements} 个历史样本点`
                : "历史样本点"}
          </strong>
        </div>
        {loading && <p role="status">正在读取历史样本点，请稍候。</p>}
        {current?.error && (
          <div role="alert">
            {current.error}{" "}
            <button
              type="button"
              onClick={() => {
                setLoaded(undefined);
                setRevision((value) => value + 1);
              }}
            >
              重试
            </button>
          </div>
        )}
        <div className="enterprise-ledger-table__scroll" tabIndex={0}>
          <table aria-label="历史样本点列表">
            <thead>
              <tr>
                <th>序号</th>
                <th>样本点名称</th>
                <th>所属地区</th>
                <th>详细地址</th>
                <th>样本点类型</th>
                <th>品种</th>
                <th>淘汰日期</th>
                <th>淘汰原因</th>
                <th>最后记录日期</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {page?.items.map((row, index) => (
                <tr key={row.samplePointId}>
                  <td>{page.pageNumber * page.pageSize + index + 1}</td>
                  <td>{row.sampleName}</td>
                  <td>{row.regionName}</td>
                  <td>{row.address || "未记录"}</td>
                  <td>{row.objectTypeName}</td>
                  <td>{row.productName}</td>
                  <td>{dateLabel(row.retiredAt)}</td>
                  <td>{row.retirementReason || "未记录"}</td>
                  <td>{dateLabel(row.lastObservedAt)}</td>
                  <td>
                    {row.lastObservationId ? (
                      <button
                        className="enterprise-ledger-row-action"
                        type="button"
                        onClick={() =>
                          onViewRecord(
                            row.domain.toLowerCase() as
                              "market" | "production" | "logistics",
                            row.productCode as "CORN" | "SOYBEAN" | "RICE",
                            row.lastObservationId!,
                          )
                        }
                      >
                        查看最后记录
                      </button>
                    ) : (
                      "无填报记录"
                    )}
                  </td>
                </tr>
              ))}
              {page?.items.length === 0 && (
                <tr>
                  <td colSpan={10} className="enterprise-ledger-table__empty">
                    当前筛选条件下暂无历史样本点
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {page && (
          <WorkspacePagination
            total={page.totalElements}
            start={page.totalElements ? page.pageNumber * page.pageSize + 1 : 0}
            end={Math.min(
              (page.pageNumber + 1) * page.pageSize,
              page.totalElements,
            )}
            page={page.pageNumber + 1}
            pages={Math.max(1, page.totalPages)}
            onPageChange={(value) =>
              setQuery((current) => ({ ...current, pageNumber: value - 1 }))
            }
          />
        )}
      </section>
    </div>
  );
}
