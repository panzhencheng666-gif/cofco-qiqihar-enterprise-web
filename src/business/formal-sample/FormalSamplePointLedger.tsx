import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  EligibleFormalSample,
  EmployeeProfile,
  FormalSampleObservationDomain,
  FormalSamplePointMutation,
  FormalSamplePointRow,
  LogisticsDefinition,
  MarketDefinition,
  MasterObjectType,
  MasterRegion,
  ProductionDefinition,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";
import type { FormalSelection } from "../formalEnterpriseModel";
import { SamplePointImportPanel } from "./SamplePointImportPanel";
import {
  mergeObservationFields,
  observationFieldLabel,
  observationFields,
} from "./formalSampleObservationFields";
import {
  SamplePointEditorForm,
  SamplePointLedgerFilters,
  SamplePointLedgerPage,
  SamplePointLedgerPagination,
  SamplePointLedgerRowActions,
  SamplePointLedgerTable,
  SamplePointLedgerTitle,
  SamplePointLedgerToolbar,
} from "./SamplePointLedgerPrimitives";

const pageSize = 20;

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
    INVALID_FORMAL_SAMPLE_MAINTAINER:
      "请选择在岗、账号正常且有当前地区填报权限的维护人。",
    FORMAL_SAMPLE_POINT_CONFLICT: "正式样本与现有记录冲突。",
    FORMAL_SAMPLE_POINT_NOT_FOUND: "正式样本不存在或已被删除。",
  };
  return messages[error.code] ?? error.clientMessage ?? fallback;
}

function formalSampleMaintainerError(error: unknown, fallback: string): string {
  if (!(error instanceof RealtimeApiError)) return fallback;
  const messages: Readonly<Record<string, string>> = {
    ACCESS_PERMISSION_DENIED: "当前账号没有指派正式样本维护人的权限。",
    ACCESS_REGION_DENIED: "该正式样本不在当前账号的授权地区内。",
    INVALID_FORMAL_SAMPLE_MAINTAINER:
      "所选人员无效、未在岗或没有该地区的填报权限。",
    FORMAL_SAMPLE_POINT_NOT_FOUND: "正式样本不存在或已被删除。",
    FORMAL_SAMPLE_POINT_VERSION_CONFLICT:
      "正式样本已被其他人更新，请按最新版本重新指派。",
  };
  return messages[error.code] ?? error.clientMessage ?? fallback;
}

function coordinate(
  point:
    Pick<FormalSamplePointRow, "longitude" | "latitude"> | EligibleFormalSample,
): string {
  return point.longitude === null || point.latitude === null
    ? "待补充"
    : `${point.longitude}，${point.latitude}`;
}

function localDateTimeValue(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function latestObservation(value: string | null | undefined): string {
  if (!value) return "暂无";
  return value.replace("T", " ").slice(0, 16);
}

function domainLabel(domain: FormalSampleObservationDomain): string {
  return { PRODUCTION: "产情", MARKET: "市场", LOGISTICS: "物流" }[domain];
}

function productLabel(code: string): string {
  const labels: Readonly<Record<string, string>> = {
    CORN: "玉米",
    SOYBEAN: "大豆",
    RICE: "水稻",
  };
  return labels[code] ?? code;
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
  maintainerSubjectId: string;
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
    maintainerSubjectId: "",
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
    longitude: point.longitude === null ? "" : String(point.longitude),
    latitude: point.latitude === null ? "" : String(point.latitude),
    objectTypeCode: point.objectTypeCode,
    maintainerSubjectId: point.maintainerSubjectId ?? "",
  };
}

interface MaintainerEditorState {
  pointId: string;
  expectedVersion: number;
  targetSubjectId: string;
  reason: string;
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
  const maintainerSubjectId = editor.maintainerSubjectId.trim();
  const longitude = Number(editor.longitude);
  const latitude = Number(editor.latitude);
  if (
    !canonicalName ||
    canonicalName.length > 200 ||
    !regionCode ||
    !address ||
    address.length > 500 ||
    !objectTypeCode ||
    !maintainerSubjectId ||
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
    maintainerSubjectId,
  };
}

function employeeCanMaintain(
  employee: EmployeeProfile,
  regionCode: string,
): boolean {
  return (
    employee.accountStatus === "ACTIVE" &&
    employee.employmentStatus === "ACTIVE" &&
    (!regionCode ||
      employee.regionCodes.includes("*") ||
      employee.regionCodes.includes(regionCode))
  );
}

export function FormalSamplePointLedger({
  domain,
  productCode,
  repository,
  permissions,
  selection,
  onSelectionChange,
  onSelectionClear,
  onCollectData,
  showAllApplicableFields = false,
}: {
  domain: FormalSampleObservationDomain;
  productCode: string;
  repository: RealtimeBusinessRepository;
  permissions: readonly string[];
  selection?: FormalSelection;
  onSelectionChange?: (selection: FormalSelection) => void;
  onSelectionClear?: () => void;
  onCollectData: (samplePointId: string) => void;
  showAllApplicableFields?: boolean;
}) {
  const [regions, setRegions] = useState<readonly MasterRegion[]>([]);
  const [objectTypes, setObjectTypes] = useState<readonly MasterObjectType[]>(
    [],
  );
  const [employees, setEmployees] = useState<readonly EmployeeProfile[]>([]);
  const [observedAt, setObservedAt] = useState(localDateTimeValue);
  const [objectTypeCode, setObjectTypeCode] = useState("");
  const [listDefinition, setListDefinition] = useState<
    ProductionDefinition | MarketDefinition | LogisticsDefinition | null
  >(null);
  const [listDefinitionKey, setListDefinitionKey] = useState("");
  const [applicableListFields, setApplicableListFields] = useState<
    ReturnType<typeof observationFields>
  >([]);
  const [regionCode, setRegionCode] = useState("");
  const [keyword, setKeyword] = useState("");
  const [pageNumber, setPageNumber] = useState(0);
  const [eligibleSamples, setEligibleSamples] = useState<
    readonly EligibleFormalSample[]
  >([]);
  const [detail, setDetail] = useState<FormalSamplePointRow | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [maintainerEditor, setMaintainerEditor] =
    useState<MaintainerEditorState | null>(null);
  const [listBusy, setListBusy] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [writeBusy, setWriteBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const requestVersion = useRef(0);
  const detailRequestVersion = useRef(0);
  const detailRegion = useRef<HTMLElement>(null);
  const editorRegion = useRef<HTMLElement>(null);
  const pendingFocusTarget = useRef<"DETAIL" | "EDITOR" | null>(null);
  const hydratedSelection = useRef("");
  const regionNames = useMemo(
    () => new Map(regions.map(({ code, name }) => [code, name])),
    [regions],
  );
  const regionName = (code: string) =>
    regionNames.get(code) ?? "地区名称待同步";
  const busy = listBusy || detailBusy || deleteBusy || writeBusy;
  const canManage = permissions.includes("FORMAL_SAMPLE_MANAGE");
  const canCreate =
    canManage && typeof repository.createFormalSamplePoint === "function";
  const canUpdate =
    canManage && typeof repository.updateFormalSamplePoint === "function";
  const canDelete =
    permissions.includes("FORMAL_SAMPLE_DELETE") &&
    typeof repository.deleteFormalSamplePoint === "function";
  const canCollect = permissions.includes("BUSINESS_CREATE");
  const canImport = permissions.includes("BUSINESS_IMPORT");
  const totalPages = Math.ceil(eligibleSamples.length / pageSize);
  const visibleSamples = useMemo(
    () =>
      eligibleSamples.slice(pageNumber * pageSize, (pageNumber + 1) * pageSize),
    [eligibleSamples, pageNumber],
  );
  const listObservationFields = useMemo(
    () =>
      showAllApplicableFields
        ? applicableListFields
        : objectTypeCode &&
            listDefinitionKey === `${domain}:${productCode}:${objectTypeCode}`
          ? observationFields(domain, listDefinition)
          : [],
    [
      applicableListFields,
      domain,
      listDefinition,
      listDefinitionKey,
      objectTypeCode,
      productCode,
      showAllApplicableFields,
    ],
  );
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
  const availableMaintainers = employees.filter((employee) =>
    employeeCanMaintain(
      employee,
      editor?.regionCode ?? detail?.regionCode ?? "",
    ),
  );
  const showList = selection ? selection.type === "formal-sample-list" : true;
  const navigate = (next: FormalSelection) => onSelectionChange?.(next);

  useEffect(() => {
    let active = true;
    if (!objectTypeCode)
      return () => {
        active = false;
      };
    const request =
      domain === "PRODUCTION"
        ? repository.loadProductionDefinition(productCode, objectTypeCode)
        : domain === "MARKET"
          ? repository.loadMarketDefinition(productCode, objectTypeCode)
          : repository.loadLogisticsDefinition(productCode);
    void request
      .then((next) => {
        if (active) {
          setListDefinition(next);
          setListDefinitionKey(`${domain}:${productCode}:${objectTypeCode}`);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [domain, objectTypeCode, productCode, repository]);

  useEffect(() => {
    if (!showAllApplicableFields) return undefined;
    let active = true;
    const objectTypeCodes = [
      ...new Set(
        eligibleSamples
          .map(({ objectTypeCode: code }) => code)
          .filter((code): code is string => Boolean(code)),
      ),
    ];
    const requests =
      domain === "LOGISTICS"
        ? [repository.loadLogisticsDefinition(productCode)]
        : objectTypeCodes.map((code) =>
            domain === "PRODUCTION"
              ? repository.loadProductionDefinition(productCode, code)
              : repository.loadMarketDefinition(productCode, code),
          );
    void Promise.all(requests)
      .then((definitions) => {
        if (active) {
          setApplicableListFields(
            mergeObservationFields(
              definitions.map((definition) =>
                observationFields(domain, definition, true),
              ),
            ),
          );
        }
      })
      .catch(() => {
        if (active) setApplicableListFields([]);
      });
    return () => {
      active = false;
    };
  }, [
    domain,
    eligibleSamples,
    productCode,
    repository,
    showAllApplicableFields,
  ]);

  const query = useCallback(
    async (requestedPage = pageNumber) => {
      if (!repository.listEligibleFormalSamples) return;
      const version = ++requestVersion.current;
      setListBusy(true);
      setNotice("");
      try {
        const instant = new Date(observedAt);
        if (Number.isNaN(instant.getTime())) {
          setNotice("请选择正确的观测时间。");
          return;
        }
        const eligible = await repository.listEligibleFormalSamples({
          domain,
          productCode,
          objectTypeCode: objectTypeCode || undefined,
          regionCode: regionCode || undefined,
          keyword: keyword.trim() || undefined,
          year: instant.getFullYear(),
          observedAt: instant.toISOString(),
        });
        if (version !== requestVersion.current) return;
        setEligibleSamples(eligible);
        const nextPage = Math.min(
          requestedPage,
          Math.max(0, Math.ceil(eligible.length / pageSize) - 1),
        );
        setPageNumber(nextPage);
        if (
          detail &&
          !eligible.some(({ samplePointId }) => samplePointId === detail.id)
        ) {
          setDetail(null);
          setConfirmingId(null);
          setEditor(null);
        }
      } catch (error) {
        if (version === requestVersion.current) {
          setEligibleSamples([]);
          setDetail(null);
          setNotice(formalSampleError(error, "采集台账读取失败，请稍后重试。"));
        }
      } finally {
        if (version === requestVersion.current) setListBusy(false);
      }
    },
    [
      detail,
      domain,
      keyword,
      objectTypeCode,
      observedAt,
      pageNumber,
      productCode,
      regionCode,
      repository,
    ],
  );

  const loadDetail = useCallback(
    async (
      id: string,
      intent: "VIEW" | "EDIT" | "DELETE" | "REFRESH" = "VIEW",
    ) => {
      if (!repository.getFormalSamplePoint) return;
      const version = ++detailRequestVersion.current;
      setDetailBusy(true);
      setNotice("");
      try {
        const next = await repository.getFormalSamplePoint(id);
        if (version === detailRequestVersion.current) {
          pendingFocusTarget.current =
            intent === "REFRESH"
              ? null
              : intent === "EDIT"
                ? "EDITOR"
                : "DETAIL";
          setDetail(next);
          setConfirmingId(intent === "DELETE" ? next.id : null);
          setEditor(intent === "EDIT" ? editEditor(next) : null);
          setMaintainerEditor(null);
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
    if (canManage) {
      void repository
        .listEmployees()
        .then((items) => {
          if (active) setEmployees(items);
        })
        .catch((error: unknown) => {
          if (active)
            setNotice(
              formalSampleMaintainerError(
                error,
                "员工目录读取失败，暂时不能指派维护人。",
              ),
            );
        });
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
  }, [canManage, domain, productCode, repository]);

  useEffect(() => {
    if (!selection || !selection.type.startsWith("formal-sample-")) return;
    const key = `${selection.type}:${selection.id}`;
    if (hydratedSelection.current === key) return;
    hydratedSelection.current = key;
    if (selection.type === "formal-sample-list") {
      queueMicrotask(() => {
        setConfirmingId(null);
        setMaintainerEditor(null);
        setNotice("");
        setDetail(null);
        setEditor(null);
      });
      return;
    }
    if (selection.type === "formal-sample-create") {
      queueMicrotask(() => {
        setConfirmingId(null);
        setMaintainerEditor(null);
        setNotice("");
        pendingFocusTarget.current = "EDITOR";
        setDetail(null);
        setEditor(createEditor());
      });
      return;
    }
    if (selection.type === "formal-sample-view") {
      queueMicrotask(() => void loadDetail(selection.id, "VIEW"));
      return;
    }
    if (selection.type === "formal-sample-edit") {
      queueMicrotask(() => void loadDetail(selection.id, "EDIT"));
    }
  }, [loadDetail, selection]);

  useEffect(() => {
    const target = pendingFocusTarget.current;
    if (target === "EDITOR" && editor) {
      editorRegion.current?.focus();
      pendingFocusTarget.current = null;
    } else if (target === "DETAIL" && detail && !editor) {
      detailRegion.current?.focus();
      pendingFocusTarget.current = null;
    }
  }, [detail, editor]);

  const eventSequence = useRef(0);
  const eventState = useRef({
    query,
    loadDetail,
    selectedId: detail?.id,
    editedId: editor?.pointId,
  });
  useEffect(() => {
    eventState.current = {
      query,
      loadDetail,
      selectedId: detail?.id,
      editedId: editor?.pointId,
    };
  }, [detail?.id, editor?.pointId, loadDetail, query]);

  useEffect(() => {
    if (!repository.subscribeBusinessEvents) return undefined;
    return repository.subscribeBusinessEvents(
      eventSequence.current,
      (event) => {
        if (event.sequence <= eventSequence.current) return;
        eventSequence.current = event.sequence;
        const observationChanged =
          event.actionCode === "FORMAL_SAMPLE_OBSERVATION_SAVED" &&
          event.productCode === productCode;
        const samplePointChanged =
          event.aggregateType === "FORMAL_SAMPLE_POINT" ||
          event.actionCode.startsWith("FORMAL_SAMPLE_POINT_");
        if (!observationChanged && !samplePointChanged) {
          return;
        }
        const {
          query: refresh,
          loadDetail: refreshDetail,
          selectedId,
          editedId,
        } = eventState.current;
        if (samplePointChanged && event.aggregateId === editedId)
          setEditor(null);
        if (
          samplePointChanged &&
          event.aggregateId === maintainerEditor?.pointId
        )
          setMaintainerEditor(null);
        void refresh().then(() => {
          if (
            !samplePointChanged ||
            !selectedId ||
            event.aggregateId !== selectedId
          )
            return;
          if (
            event.actionCode === "FORMAL_SAMPLE_POINT_DELETED" &&
            event.aggregateId === selectedId
          ) {
            setDetail(null);
            setConfirmingId(null);
            return;
          }
          void refreshDetail(selectedId, "REFRESH");
        });
      },
    );
  }, [maintainerEditor?.pointId, productCode, repository]);

  const assignMaintainer = async () => {
    if (
      !maintainerEditor ||
      !repository.assignFormalSampleMaintainer ||
      !maintainerEditor.targetSubjectId ||
      !maintainerEditor.reason.trim()
    ) {
      setNotice("请选择维护人并填写指派或改派原因。");
      return;
    }
    setWriteBusy(true);
    setNotice("");
    try {
      const assigned = await repository.assignFormalSampleMaintainer(
        maintainerEditor.pointId,
        {
          maintainerSubjectId: maintainerEditor.targetSubjectId,
          maintainerChangeReason: maintainerEditor.reason.trim(),
          expectedVersion: maintainerEditor.expectedVersion,
        },
      );
      const authoritative = await repository.getFormalSamplePoint!(assigned.id);
      setMaintainerEditor(null);
      await query(pageNumber);
      setDetail(authoritative);
      setNotice("维护人已更新并重新查询。");
    } catch (error) {
      const conflict =
        error instanceof RealtimeApiError &&
        error.code === "FORMAL_SAMPLE_POINT_VERSION_CONFLICT";
      const selectedId = maintainerEditor.pointId;
      if (conflict) {
        setMaintainerEditor(null);
        await query(pageNumber);
        await loadDetail(selectedId);
      }
      setNotice(
        formalSampleMaintainerError(
          error,
          "维护人更新失败，请核对人员和权限后重试。",
        ),
      );
    } finally {
      setWriteBusy(false);
    }
  };

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
      navigate({ type: "formal-sample-view", id: authoritative.id });
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
    if (!canDelete || !detail || !repository.deleteFormalSamplePoint) return;
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
      navigate({ type: "formal-sample-list", id: "list" });
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
    !repository.listEligibleFormalSamples ||
    !repository.getFormalSamplePoint
  ) {
    return <p role="status">正式样本档案服务暂不可用。</p>;
  }

  return (
    <SamplePointLedgerPage
      className="formal-sample-ledger enterprise-ledger-workbench"
      ariaLabel="采集台账工作台"
    >
      {onSelectionClear && (
        <div className="enterprise-ledger-table__toolbar">
          <button type="button" onClick={onSelectionClear}>
            返回业务台账
          </button>
        </div>
      )}
      {showList && (
        <>
          <SamplePointLedgerTitle
            title="采集台账"
            description="统一维护样本稳定信息，并从每行填写或更新期间采集数据。"
            actions={
              <SamplePointLedgerToolbar
                ariaLabel="采集台账操作"
                count={`共 ${eligibleSamples.length} 个`}
                variant="header"
              >
                {canCreate && (
                  <button
                    disabled={busy}
                    type="button"
                    onClick={() => {
                      if (onSelectionChange) {
                        navigate({ type: "formal-sample-create", id: "new" });
                        return;
                      }
                      pendingFocusTarget.current = "EDITOR";
                      setDetail(null);
                      setConfirmingId(null);
                      setEditor(createEditor());
                      setMaintainerEditor(null);
                      setNotice("");
                    }}
                  >
                    新增样本
                  </button>
                )}
              </SamplePointLedgerToolbar>
            }
          />
          {canImport && (
            <SamplePointImportPanel
              kind="formal"
              repository={repository}
              onImported={() => query(0)}
            />
          )}
          <SamplePointLedgerFilters>
            <label>
              <span>实际观测时间</span>
              <input
                aria-label="采集台账观测时间"
                type="datetime-local"
                value={observedAt}
                onChange={(event) => {
                  setObservedAt(event.target.value);
                  setPageNumber(0);
                }}
              />
            </label>
            <label>
              <span>对象类型</span>
              <select
                aria-label="采集台账对象类型"
                value={objectTypeCode}
                onChange={(event) => {
                  setObjectTypeCode(event.target.value);
                  setPageNumber(0);
                }}
              >
                <option value="">全部对象类型</option>
                {objectTypes.map((objectType) => (
                  <option key={objectType.code} value={objectType.code}>
                    {objectType.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>业务地区</span>
              <select
                aria-label="采集台账业务地区"
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
                aria-label="采集台账样本名称"
                maxLength={200}
                type="search"
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPageNumber(0);
                }}
              />
            </label>
            <div className="enterprise-ledger-query__actions">
              <button
                className="is-primary"
                disabled={busy}
                type="button"
                onClick={() => void query(0)}
              >
                查询
              </button>
            </div>
          </SamplePointLedgerFilters>
        </>
      )}
      {editor && (
        <SamplePointEditorForm
          sectionRef={editorRegion}
          ariaLabel="正式样本稳定信息"
          title={editor.mode === "CREATE" ? "新增正式样本" : "编辑稳定信息"}
          description="名称、地区、详细地址、经纬度和对象分类属于稳定主数据；版本由系统自动校验。"
          version={
            editor.expectedVersion !== null ? (
              <strong>版本 {editor.expectedVersion}</strong>
            ) : undefined
          }
          actions={
            <>
              <button disabled={busy} type="button" onClick={() => void save()}>
                {editor.mode === "CREATE" ? "保存正式样本" : "保存修改"}
              </button>
              <button
                disabled={writeBusy}
                type="button"
                onClick={() => {
                  setEditor(null);
                  navigate({ type: "formal-sample-list", id: "list" });
                }}
              >
                返回正式样本台账
              </button>
            </>
          }
        >
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
          <label className="formal-sample-page__address">
            <span>详细地址</span>
            <input
              aria-label="正式样本详细地址"
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
          <label>
            <span>维护人</span>
            <select
              aria-label="正式样本维护人"
              disabled={editor.mode === "EDIT"}
              required
              value={editor.maintainerSubjectId}
              onChange={(event) =>
                setEditor({
                  ...editor,
                  maintainerSubjectId: event.target.value,
                })
              }
            >
              <option value="">请选择维护人</option>
              {availableMaintainers.map((employee) => (
                <option key={employee.subjectId} value={employee.subjectId}>
                  {employee.displayName} · {employee.workUnitName}
                </option>
              ))}
            </select>
          </label>
        </SamplePointEditorForm>
      )}
      <div className="formal-sample-ledger__layout">
        {showList && (
          <SamplePointLedgerTable
            className="formal-sample-ledger__table enterprise-ledger-table"
            headers={[
              "样本名称",
              "地区",
              "业务类别",
              "品种",
              "对象类型",
              "维护人",
              "填报状态",
              "更新时间",
              ...listObservationFields.map(observationFieldLabel),
              "操作",
            ]}
            empty={
              visibleSamples.length === 0 ? (
                <p>当前条件下没有可采集的正式样本。</p>
              ) : undefined
            }
            footer={
              totalPages > 1 ? (
                <SamplePointLedgerPagination
                  disabled={busy}
                  pageNumber={pageNumber}
                  pageCount={totalPages}
                  onPrevious={() => setPageNumber((value) => value - 1)}
                  onNext={() => setPageNumber((value) => value + 1)}
                />
              ) : undefined
            }
          >
            {visibleSamples.map((samplePoint) => {
              const collectionAllowed = canCollect;
              return (
                <tr key={samplePoint.samplePointId}>
                  <td>{samplePoint.sampleName}</td>
                  <td>{samplePoint.regionName}</td>
                  <td>{domainLabel(samplePoint.domain)}</td>
                  <td>{productLabel(samplePoint.productCode)}</td>
                  <td>{samplePoint.objectTypeName ?? "待同步"}</td>
                  <td>{samplePoint.maintainerDisplayName ?? "未指定维护人"}</td>
                  <td>
                    {samplePoint.latestObservationId ? "已填报" : "未填报"}
                  </td>
                  <td>{latestObservation(samplePoint.latestObservedAt)}</td>
                  {listObservationFields.map((field) => (
                    <td key={field.code}>
                      {samplePoint.latestValues[field.code] || "—"}
                    </td>
                  ))}
                  <td>
                    <SamplePointLedgerRowActions>
                      <button
                        className="enterprise-ledger-row-action"
                        type="button"
                        onClick={() => {
                          if (onSelectionChange) {
                            navigate({
                              type: "formal-sample-view",
                              id: samplePoint.samplePointId,
                            });
                          } else void loadDetail(samplePoint.samplePointId);
                        }}
                      >
                        查看
                      </button>
                      {canUpdate && (
                        <button
                          className="enterprise-ledger-row-action"
                          type="button"
                          onClick={() => {
                            if (onSelectionChange) {
                              navigate({
                                type: "formal-sample-edit",
                                id: samplePoint.samplePointId,
                              });
                            } else
                              void loadDetail(
                                samplePoint.samplePointId,
                                "EDIT",
                              );
                          }}
                        >
                          编辑
                        </button>
                      )}
                      {canDelete && (
                        <button
                          className="enterprise-ledger-row-action"
                          type="button"
                          onClick={() => {
                            if (onSelectionChange) {
                              navigate({
                                type: "formal-sample-view",
                                id: samplePoint.samplePointId,
                              });
                            } else
                              void loadDetail(
                                samplePoint.samplePointId,
                                "DELETE",
                              );
                          }}
                        >
                          删除
                        </button>
                      )}
                      <button
                        className="enterprise-ledger-row-action"
                        disabled={!collectionAllowed}
                        title={
                          !canCollect
                            ? "当前账号没有填写正式采集数据的权限"
                            : undefined
                        }
                        type="button"
                        onClick={() => {
                          if (collectionAllowed)
                            onCollectData(samplePoint.samplePointId);
                        }}
                      >
                        {samplePoint.latestObservationId
                          ? canCollect
                            ? samplePoint.maintainerSubjectId
                              ? "更新采集数据"
                              : "填写采集数据"
                            : "无采集权限"
                          : canCollect
                            ? "填写采集数据"
                            : "无采集权限"}
                      </button>
                    </SamplePointLedgerRowActions>
                  </td>
                </tr>
              );
            })}
          </SamplePointLedgerTable>
        )}
        {detail && (
          <section
            ref={detailRegion}
            tabIndex={-1}
            className="formal-sample-page formal-sample-page--detail"
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
                <dt>详细地址</dt>
                <dd>{detail.address}</dd>
              </div>
              <div>
                <dt>当前对象分类</dt>
                <dd>{detail.objectTypeName}</dd>
              </div>
              <div>
                <dt>维护人</dt>
                <dd>{detail.maintainerDisplayName ?? "未指定维护人"}</dd>
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
            {canUpdate && (
              <button
                disabled={busy}
                type="button"
                onClick={() => {
                  if (onSelectionChange) {
                    navigate({ type: "formal-sample-edit", id: detail.id });
                    return;
                  }
                  pendingFocusTarget.current = "EDITOR";
                  setConfirmingId(null);
                  setEditor(editEditor(detail));
                  setNotice("");
                }}
              >
                编辑稳定信息
              </button>
            )}
            {canManage && repository.assignFormalSampleMaintainer && (
              <button
                disabled={busy}
                type="button"
                onClick={() => {
                  setConfirmingId(null);
                  setEditor(null);
                  setMaintainerEditor({
                    pointId: detail.id,
                    expectedVersion: detail.version,
                    targetSubjectId: detail.maintainerSubjectId ?? "",
                    reason: "",
                  });
                  setNotice("");
                }}
              >
                {detail.maintainerSubjectId ? "改派维护人" : "指定维护人"}
              </button>
            )}
            {maintainerEditor?.pointId === detail.id && (
              <section
                className="formal-sample-ledger__maintainer-editor"
                aria-label="维护人指派"
              >
                <label>
                  <span>维护人</span>
                  <select
                    aria-label="指派维护人"
                    value={maintainerEditor.targetSubjectId}
                    onChange={(event) =>
                      setMaintainerEditor({
                        ...maintainerEditor,
                        targetSubjectId: event.target.value,
                      })
                    }
                  >
                    <option value="">请选择维护人</option>
                    {employees
                      .filter((employee) =>
                        employeeCanMaintain(employee, detail.regionCode),
                      )
                      .map((employee) => (
                        <option
                          key={employee.subjectId}
                          value={employee.subjectId}
                        >
                          {employee.displayName} · {employee.workUnitName}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  <span>指派或改派原因</span>
                  <input
                    aria-label="维护人变更原因"
                    maxLength={500}
                    value={maintainerEditor.reason}
                    onChange={(event) =>
                      setMaintainerEditor({
                        ...maintainerEditor,
                        reason: event.target.value,
                      })
                    }
                  />
                </label>
                <div>
                  <button
                    disabled={busy}
                    type="button"
                    onClick={() => void assignMaintainer()}
                  >
                    保存维护人
                  </button>
                  <button
                    disabled={writeBusy}
                    type="button"
                    onClick={() => setMaintainerEditor(null)}
                  >
                    取消
                  </button>
                </div>
              </section>
            )}
            {!canDelete ? null : confirmingId === detail.id ? (
              <div className="formal-sample-ledger__delete-confirmation">
                <p>删除会同步清理该样本及其关联正式业务数据，且不可撤销。</p>
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
            <button
              disabled={busy}
              type="button"
              onClick={() =>
                navigate({ type: "formal-sample-list", id: "list" })
              }
            >
              返回正式样本台账
            </button>
          </section>
        )}
      </div>
      {notice && <p role="status">{notice}</p>}
    </SamplePointLedgerPage>
  );
}
