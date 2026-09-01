import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  FormalSampleObservationDomain,
  FormalSamplePointMutation,
  FormalSamplePointRow,
  MasterObjectType,
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

function formalSampleWriteError(error: unknown, fallback: string): string {
  if (!(error instanceof RealtimeApiError)) return fallback;
  const messages: Readonly<Record<string, string>> = {
    FORMAL_SAMPLE_POINT_VERSION_CONFLICT:
      "正式样本已被其他人更新，请根据最新内容重新修改。",
    ACCESS_PERMISSION_DENIED: "当前账号没有新增或修改正式样本的权限。",
    ACCESS_REGION_DENIED: "所选地区不在当前账号的授权范围内。",
    COORDINATE_OUTSIDE_REGION: "正式样本坐标不在所选行政区范围内。",
    SAMPLE_POINT_COORDINATE_OCCUPIED: "该坐标已被其他样本占用。",
    ADMIN_BOUNDARY_UNAVAILABLE: "所选行政区边界数据暂不可用。",
    INVALID_FORMAL_SAMPLE_POINT: "请完整填写正确的正式样本稳定信息。",
    FORMAL_SAMPLE_POINT_CONFLICT: "正式样本与现有记录冲突。",
    FORMAL_SAMPLE_POINT_NOT_FOUND: "正式样本不存在或已被删除。",
  };
  return messages[error.code] ?? error.clientMessage ?? fallback;
}

function coordinate(point: FormalSamplePointRow): string {
  return point.longitude === null || point.latitude === null
    ? "待补充"
    : `${point.longitude}，${point.latitude}`;
}

interface EditorState {
  mode: "CREATE" | "EDIT";
  pointId: string | null;
  expectedVersion: number | null;
  canonicalName: string;
  regionCode: string;
  address: string;
  longitude: string;
  latitude: string;
  objectTypeCode: string;
}

function createEditor(): EditorState {
  return {
    mode: "CREATE",
    pointId: null,
    expectedVersion: null,
    canonicalName: "",
    regionCode: "",
    address: "",
    longitude: "",
    latitude: "",
    objectTypeCode: "",
  };
}

function editEditor(point: FormalSamplePointRow): EditorState {
  return {
    mode: "EDIT",
    pointId: point.id,
    expectedVersion: point.version,
    canonicalName: point.canonicalName,
    regionCode: point.regionCode,
    address: point.address,
    longitude: point.longitude ?? "",
    latitude: point.latitude ?? "",
    objectTypeCode: point.objectTypeCode,
  };
}

function decimalPlaces(value: string): number {
  const fraction = value.trim().split(".")[1];
  return fraction?.length ?? 0;
}

function mutation(editor: EditorState): FormalSamplePointMutation | null {
  const canonicalName = editor.canonicalName.trim();
  const regionCode = editor.regionCode.trim();
  const address = editor.address.trim();
  const objectTypeCode = editor.objectTypeCode.trim();
  const longitude = Number(editor.longitude);
  const latitude = Number(editor.latitude);
  if (
    !canonicalName ||
    canonicalName.length > 200 ||
    !regionCode ||
    !address ||
    address.length > 500 ||
    !objectTypeCode ||
    !editor.longitude.trim() ||
    !editor.latitude.trim() ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90 ||
    decimalPlaces(editor.longitude) > 7 ||
    decimalPlaces(editor.latitude) > 7
  ) {
    return null;
  }
  return {
    canonicalName,
    regionCode,
    address,
    longitude,
    latitude,
    objectTypeCode,
  };
}

export function FormalSamplePointLedger({
  domain,
  productCode,
  repository,
}: {
  domain: FormalSampleObservationDomain;
  productCode: string;
  repository: RealtimeBusinessRepository;
}) {
  const [regions, setRegions] = useState<readonly MasterRegion[]>([]);
  const [objectTypes, setObjectTypes] = useState<readonly MasterObjectType[]>(
    [],
  );
  const [regionCode, setRegionCode] = useState("");
  const [keyword, setKeyword] = useState("");
  const [pageNumber, setPageNumber] = useState(0);
  const [page, setPage] = useState<Page<FormalSamplePointRow>>(emptyPage);
  const [detail, setDetail] = useState<FormalSamplePointRow | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [listBusy, setListBusy] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [writeBusy, setWriteBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const requestVersion = useRef(0);
  const detailRequestVersion = useRef(0);
  const regionNames = useMemo(
    () => new Map(regions.map(({ code, name }) => [code, name])),
    [regions],
  );
  const regionName = (code: string) =>
    regionNames.get(code) ?? "地区名称待同步";
  const busy = listBusy || detailBusy || deleteBusy || writeBusy;
  const canWrite =
    typeof repository.createFormalSamplePoint === "function" &&
    typeof repository.updateFormalSamplePoint === "function";
  const availableObjectTypes =
    !editor?.objectTypeCode ||
    objectTypes.some(({ code }) => code === editor.objectTypeCode)
      ? objectTypes
      : [
          ...objectTypes,
          {
            code: editor.objectTypeCode,
            name: detail?.objectTypeName ?? editor.objectTypeCode,
            domain: detail?.businessDomain ?? domain,
          },
        ];

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
          setEditor(null);
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
    void repository
      .listObjectTypes(productCode, domain)
      .then((items) => {
        if (active) setObjectTypes(items);
      })
      .catch(() => undefined);
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
  }, [domain, productCode, repository]);

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
        setEditor(null);
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

  const save = async () => {
    if (!editor || !repository.getFormalSamplePoint) return;
    const input = mutation(editor);
    if (!input) {
      setNotice("请完整填写正确的正式样本稳定信息。");
      return;
    }
    setWriteBusy(true);
    setNotice("");
    try {
      const written =
        editor.mode === "CREATE"
          ? await repository.createFormalSamplePoint!(input)
          : await repository.updateFormalSamplePoint!(
              editor.pointId!,
              input,
              editor.expectedVersion!,
            );
      const authoritative = await repository.getFormalSamplePoint(written.id);
      setDetail(authoritative);
      setEditor(null);
      setConfirmingId(null);
      await query(editor.mode === "CREATE" ? 0 : pageNumber);
      setDetail(authoritative);
      setNotice(
        editor.mode === "CREATE"
          ? "正式样本已新增并重新查询。"
          : "正式样本稳定信息已更新并重新查询。",
      );
    } catch (error) {
      const message = formalSampleWriteError(
        error,
        editor.mode === "CREATE"
          ? "正式样本新增失败，请稍后重试。"
          : "正式样本修改失败，请稍后重试。",
      );
      const conflict =
        error instanceof RealtimeApiError &&
        error.code === "FORMAL_SAMPLE_POINT_VERSION_CONFLICT";
      if (conflict && editor.pointId) {
        const selectedId = editor.pointId;
        setEditor(null);
        await query(pageNumber);
        await loadDetail(selectedId);
      }
      setNotice(message);
    } finally {
      setWriteBusy(false);
    }
  };

  const remove = async () => {
    if (!detail || !repository.deleteFormalSamplePoint) return;
    setDeleteBusy(true);
    setNotice("");
    try {
      await repository.deleteFormalSamplePoint(detail.id, detail.version);
      detailRequestVersion.current += 1;
      setDetail(null);
      setConfirmingId(null);
      setEditor(null);
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
          <p>
            稳定信息在此维护；销量、价格等期间观测继续在已有样本数据更新中填写。
          </p>
        </div>
        <div className="formal-sample-ledger__header-actions">
          <strong>共 {page.totalElements} 个</strong>
          {canWrite && (
            <button
              disabled={busy}
              type="button"
              onClick={() => {
                setDetail(null);
                setConfirmingId(null);
                setEditor(createEditor());
                setNotice("");
              }}
            >
              新增正式样本
            </button>
          )}
        </div>
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
      {editor && (
        <section
          className="formal-sample-ledger__editor"
          aria-label="正式样本稳定信息"
        >
          <header>
            <div>
              <h3>
                {editor.mode === "CREATE" ? "新增正式样本" : "编辑稳定信息"}
              </h3>
              <p>
                名称、地区、地址、经纬度和对象分类属于稳定主数据；版本由系统自动校验。
              </p>
            </div>
            {editor.expectedVersion !== null && (
              <strong>版本 {editor.expectedVersion}</strong>
            )}
          </header>
          <div className="formal-sample-ledger__editor-grid">
            <label>
              <span>名称</span>
              <input
                aria-label="正式样本名称"
                maxLength={200}
                value={editor.canonicalName}
                onChange={(event) =>
                  setEditor({ ...editor, canonicalName: event.target.value })
                }
              />
            </label>
            <label>
              <span>地区</span>
              <select
                aria-label="正式样本地区"
                value={editor.regionCode}
                onChange={(event) =>
                  setEditor({ ...editor, regionCode: event.target.value })
                }
              >
                <option value="">请选择地区</option>
                {regions.map((region) => (
                  <option key={region.code} value={region.code}>
                    {region.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="formal-sample-ledger__editor-address">
              <span>地址</span>
              <input
                aria-label="正式样本地址"
                maxLength={500}
                value={editor.address}
                onChange={(event) =>
                  setEditor({ ...editor, address: event.target.value })
                }
              />
            </label>
            <label>
              <span>经度</span>
              <input
                aria-label="正式样本经度"
                inputMode="decimal"
                value={editor.longitude}
                onChange={(event) =>
                  setEditor({ ...editor, longitude: event.target.value })
                }
              />
            </label>
            <label>
              <span>纬度</span>
              <input
                aria-label="正式样本纬度"
                inputMode="decimal"
                value={editor.latitude}
                onChange={(event) =>
                  setEditor({ ...editor, latitude: event.target.value })
                }
              />
            </label>
            <label>
              <span>当前对象分类</span>
              <select
                aria-label="正式样本对象分类"
                value={editor.objectTypeCode}
                onChange={(event) =>
                  setEditor({ ...editor, objectTypeCode: event.target.value })
                }
              >
                <option value="">请选择对象分类</option>
                {availableObjectTypes.map((objectType) => (
                  <option key={objectType.code} value={objectType.code}>
                    {objectType.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="formal-sample-ledger__editor-actions">
            <button disabled={busy} type="button" onClick={() => void save()}>
              {editor.mode === "CREATE" ? "保存正式样本" : "保存修改"}
            </button>
            <button
              disabled={writeBusy}
              type="button"
              onClick={() => setEditor(null)}
            >
              取消
            </button>
          </div>
        </section>
      )}
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
                <dt>地址</dt>
                <dd>{detail.address}</dd>
              </div>
              <div>
                <dt>当前对象分类</dt>
                <dd>{detail.objectTypeName}</dd>
              </div>
              <div>
                <dt>版本</dt>
                <dd>版本 {detail.version}</dd>
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
            {canWrite && (
              <button
                disabled={busy}
                type="button"
                onClick={() => {
                  setConfirmingId(null);
                  setEditor(editEditor(detail));
                  setNotice("");
                }}
              >
                编辑稳定信息
              </button>
            )}
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
