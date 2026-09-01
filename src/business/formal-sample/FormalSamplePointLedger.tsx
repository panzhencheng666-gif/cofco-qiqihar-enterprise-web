import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  FormalSamplePointRow,
  MasterRegion,
  Page,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";

const emptyPage: Page<FormalSamplePointRow> = {
  items: [],
  pageNumber: 0,
  pageSize: 20,
  totalElements: 0,
  totalPages: 0,
};

function formalSampleError(error: unknown, fallback: string): string {
  if (!(error instanceof RealtimeApiError)) return fallback;
  const messages: Readonly<Record<string, string>> = {
    FORMAL_SAMPLE_POINT_VERSION_CONFLICT:
      "正式样本已被其他人更新，请刷新后再删除。",
    FORMAL_SAMPLE_POINT_REGION_CONFLICT:
      "正式样本所属地区已变化，请刷新后再删除。",
    ACCESS_PERMISSION_DENIED: "当前账号没有删除正式样本的权限。",
    ACCESS_REGION_DENIED: "该正式样本不在当前账号的授权地区内。",
    FORMAL_SAMPLE_POINT_NETWORK_REFERENCED:
      "该正式样本仍属于年度样本网，不能删除。",
    FORMAL_SAMPLE_POINT_HISTORY_REFERENCED:
      "该正式样本仍有关联的正式业务历史，不能删除。",
    FORMAL_SAMPLE_POINT_NOT_FOUND: "正式样本不存在或已被删除。",
  };
  return messages[error.code] ?? error.clientMessage ?? fallback;
}

function coordinate(point: FormalSamplePointRow): string {
  return point.longitude === null || point.latitude === null
    ? "待补充"
    : `${point.longitude}，${point.latitude}`;
}

export function FormalSamplePointLedger({
  repository,
}: {
  repository: RealtimeBusinessRepository;
}) {
  const [regions, setRegions] = useState<readonly MasterRegion[]>([]);
  const [regionCode, setRegionCode] = useState("");
  const [keyword, setKeyword] = useState("");
  const [pageNumber, setPageNumber] = useState(0);
  const [page, setPage] = useState<Page<FormalSamplePointRow>>(emptyPage);
  const [detail, setDetail] = useState<FormalSamplePointRow | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [listBusy, setListBusy] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const requestVersion = useRef(0);
  const detailRequestVersion = useRef(0);
  const regionNames = useMemo(
    () => new Map(regions.map(({ code, name }) => [code, name])),
    [regions],
  );
  const regionName = (code: string) =>
    regionNames.get(code) ?? "地区名称待同步";
  const busy = listBusy || detailBusy || deleteBusy;

  const query = useCallback(
    async (requestedPage = pageNumber) => {
      if (!repository.listFormalSamplePoints) return;
      const version = ++requestVersion.current;
      setListBusy(true);
      setNotice("");
      try {
        const next = await repository.listFormalSamplePoints({
          regionCode: regionCode || undefined,
          keyword: keyword.trim() || undefined,
          page: requestedPage,
          pageSize: 20,
        });
        if (version !== requestVersion.current) return;
        setPage(next);
        setPageNumber(next.pageNumber);
        if (detail && !next.items.some(({ id }) => id === detail.id)) {
          setDetail(null);
          setConfirmingId(null);
        }
      } catch (error) {
        if (version === requestVersion.current) {
          setPage(emptyPage);
          setDetail(null);
          setNotice(
            formalSampleError(error, "正式样本列表读取失败，请稍后重试。"),
          );
        }
      } finally {
        if (version === requestVersion.current) setListBusy(false);
      }
    },
    [detail, keyword, pageNumber, regionCode, repository],
  );

  const loadDetail = useCallback(
    async (id: string) => {
      if (!repository.getFormalSamplePoint) return;
      const version = ++detailRequestVersion.current;
      setDetailBusy(true);
      setNotice("");
      try {
        const next = await repository.getFormalSamplePoint(id);
        if (version === detailRequestVersion.current) {
          setDetail(next);
          setConfirmingId(null);
        }
      } catch (error) {
        if (version === detailRequestVersion.current) {
          setDetail(null);
          setNotice(
            formalSampleError(error, "正式样本详情读取失败，请稍后重试。"),
          );
        }
      } finally {
        if (version === detailRequestVersion.current) setDetailBusy(false);
      }
    },
    [repository],
  );

  useEffect(() => {
    let active = true;
    if (typeof repository.loadMasterData === "function") {
      void repository
        .loadMasterData()
        .then((master) => {
          if (active) setRegions(master.regions);
        })
        .catch(() => undefined);
    }
    queueMicrotask(() => {
      if (active) void query(0);
    });
    return () => {
      active = false;
      requestVersion.current += 1;
      detailRequestVersion.current += 1;
    };
    // Initial authoritative query belongs to this mounted ledger instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository]);

  const eventSequence = useRef(0);
  const eventState = useRef({ query, loadDetail, selectedId: detail?.id });
  useEffect(() => {
    eventState.current = { query, loadDetail, selectedId: detail?.id };
  }, [detail?.id, loadDetail, query]);

  useEffect(() => {
    if (!repository.subscribeBusinessEvents) return undefined;
    return repository.subscribeBusinessEvents(
      eventSequence.current,
      (event) => {
        if (event.sequence <= eventSequence.current) return;
        eventSequence.current = event.sequence;
        if (
          event.aggregateType !== "FORMAL_SAMPLE_POINT" &&
          !event.actionCode.startsWith("FORMAL_SAMPLE_POINT_")
        ) {
          return;
        }
        const {
          query: refresh,
          loadDetail: refreshDetail,
          selectedId,
        } = eventState.current;
        void refresh().then(() => {
          if (!selectedId) return;
          if (
            event.actionCode === "FORMAL_SAMPLE_POINT_DELETED" &&
            event.aggregateId === selectedId
          ) {
            setDetail(null);
            setConfirmingId(null);
            return;
          }
          void refreshDetail(selectedId);
        });
      },
    );
  }, [repository]);

  const remove = async () => {
    if (!detail || !repository.deleteFormalSamplePoint) return;
    setDeleteBusy(true);
    setNotice("");
    try {
      await repository.deleteFormalSamplePoint(detail.id, detail.version);
      detailRequestVersion.current += 1;
      setDetail(null);
      setConfirmingId(null);
      await query(pageNumber);
      setNotice("正式样本已删除，列表已重新查询。");
    } catch (error) {
      const message = formalSampleError(
        error,
        "正式样本删除失败，请稍后重试。",
      );
      const refreshDetail =
        error instanceof RealtimeApiError &&
        [
          "FORMAL_SAMPLE_POINT_VERSION_CONFLICT",
          "FORMAL_SAMPLE_POINT_REGION_CONFLICT",
        ].includes(error.code);
      const selectedId = detail.id;
      setConfirmingId(null);
      await query(pageNumber);
      if (refreshDetail) await loadDetail(selectedId);
      setNotice(message);
    } finally {
      setDeleteBusy(false);
    }
  };

  if (
    !repository.listFormalSamplePoints ||
    !repository.getFormalSamplePoint ||
    !repository.deleteFormalSamplePoint
  ) {
    return <p role="status">正式样本档案服务暂不可用。</p>;
  }

  return (
    <section className="formal-sample-ledger" aria-label="正式样本台账工作台">
      <header>
        <div>
          <h2>正式样本台账</h2>
          <p>查询正式样本档案、查看权威详情，并按版本安全删除。</p>
        </div>
        <strong>共 {page.totalElements} 个</strong>
      </header>
      <div className="formal-sample-ledger__filters" role="search">
        <label>
          <span>业务地区</span>
          <select
            aria-label="正式样本业务地区"
            value={regionCode}
            onChange={(event) => {
              setRegionCode(event.target.value);
              setPageNumber(0);
            }}
          >
            <option value="">全部授权地区</option>
            {regions.map((region) => (
              <option key={region.code} value={region.code}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>样本名称</span>
          <input
            aria-label="正式样本名称关键字"
            maxLength={200}
            type="search"
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPageNumber(0);
            }}
          />
        </label>
        <button disabled={busy} type="button" onClick={() => void query(0)}>
          查询
        </button>
      </div>
      <div className="formal-sample-ledger__layout">
        <div className="formal-sample-ledger__table">
          <table>
            <thead>
              <tr>
                <th>样本名称</th>
                <th>地区</th>
                <th>定位</th>
                <th>年度观测</th>
                <th>年度样本网</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((point) => (
                <tr key={point.id}>
                  <td>{point.canonicalName}</td>
                  <td>{regionName(point.regionCode)}</td>
                  <td>{coordinate(point)}</td>
                  <td>{point.annualObservationCount}</td>
                  <td>{point.networkMembershipCount}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => void loadDetail(point.id)}
                    >
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {page.items.length === 0 && <p>当前条件下没有正式样本。</p>}
          {page.totalPages > 1 && (
            <div className="formal-sample-ledger__pagination">
              <button
                disabled={busy || page.pageNumber === 0}
                type="button"
                onClick={() => void query(page.pageNumber - 1)}
              >
                上一页
              </button>
              <span>第 {page.pageNumber + 1} 页</span>
              <button
                disabled={busy || page.pageNumber + 1 >= page.totalPages}
                type="button"
                onClick={() => void query(page.pageNumber + 1)}
              >
                下一页
              </button>
            </div>
          )}
        </div>
        {detail && (
          <section
            className="formal-sample-ledger__detail"
            aria-label="正式样本详情"
          >
            <h3>{detail.canonicalName}</h3>
            <dl>
              <div>
                <dt>地区</dt>
                <dd>{regionName(detail.regionCode)}</dd>
              </div>
              <div>
                <dt>定位坐标</dt>
                <dd>{coordinate(detail)}</dd>
              </div>
              <div>
                <dt>生效日期</dt>
                <dd>{detail.effectiveFrom}</dd>
              </div>
              <div>
                <dt>年度观测记录</dt>
                <dd>{detail.annualObservationCount}</dd>
              </div>
              <div>
                <dt>年度样本网引用</dt>
                <dd>{detail.networkMembershipCount}</dd>
              </div>
            </dl>
            {detail.networkMembershipCount > 0 ? (
              <p>该样本仍属于年度样本网，需先在年度治理中解除引用。</p>
            ) : confirmingId === detail.id ? (
              <div className="formal-sample-ledger__delete-confirmation">
                <p>删除会同步清理可删除的正式业务数据，且不可撤销。</p>
                <button
                  disabled={busy}
                  type="button"
                  onClick={() => void remove()}
                >
                  确认删除
                </button>
                <button type="button" onClick={() => setConfirmingId(null)}>
                  取消
                </button>
              </div>
            ) : (
              <button
                disabled={busy}
                type="button"
                onClick={() => setConfirmingId(detail.id)}
              >
                删除正式样本
              </button>
            )}
          </section>
        )}
      </div>
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
