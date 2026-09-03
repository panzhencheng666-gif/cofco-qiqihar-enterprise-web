import { useEffect, useMemo, useState } from "react";

import type {
  LogisticsDefinition,
  LogisticsRecordRow,
  ProductionImportJob,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";

import {
  RegionCascadeSelector,
  type RegionCascadeValue,
} from "../components/RegionCascadeSelector";
import type { BusinessWorkItem } from "../core/businessWork";
import type { OperationalScope } from "../core/operationalScope";
import { businessWorkFixtures } from "../data/businessWorkFixtures";
import {
  getEnterpriseRegionPath,
  type EnterpriseRegionNode,
} from "../data/enterpriseRegionHierarchy";
import {
  marketDocumentFixtures,
  type MarketDocumentField,
} from "../data/marketDocumentFixtures";
import type {
  BusinessCoordinates,
  FormalSelection,
} from "../formalEnterpriseModel";
import { marketLifecycleLabels } from "../marketMonitoringModel";
import {
  MarketDocumentWorkbench,
  type MarketDocumentDraft,
} from "./MarketDocumentWorkbench";
import { BusinessImportStatus } from "../importing/BusinessImportStatus";
import {
  awaitBusinessImport,
  saveImportErrorFile,
} from "../importing/businessImportWorkflow";
import { RealtimeRegionFilterSelect } from "../realtime/RealtimeRegionFilterSelect";
import {
  currentSurveyYear,
  formatExplicitSurveyPeriod,
  formatRealFillingTime,
  formatSurveyPeriodFromDate,
  matchesSurveyPeriod,
  surveyMonthOptions,
  surveyYearOptions,
} from "../realtime/explicitRecordTime";
import { useRealtimeMasterData } from "../realtime/useRealtimeMasterData";
import { WorkspacePagination } from "../UnifiedWorkspacePrimitives";
import { ExistingSampleObservationPanel } from "../formal-sample/ExistingSampleObservationPanel";
import { observationFields } from "../formal-sample/formalSampleObservationFields";

const collectionPageSize = 20;

const logisticsNodeTypeCodeById: Readonly<Record<string, string>> = {
  "rail-node": "RAIL_NODE",
  "road-node": "ROAD_NODE",
};

const aggregateRegionByCity = {
  qiqihar: "qiqihar-all",
  heihe: "heihe-all",
  hulunbuir: "hulunbuir-designated",
} as const;

const nodeTypeLabels: Readonly<Record<string, string>> = {
  "rail-node": "铁路站点",
  "road-node": "公路物流节点",
};

interface LogisticsRow {
  workId: string;
  number: number;
  surveyPeriod: string;
  fillingTime: string;
  node: string;
  nodeType: string;
  region: string;
  inflow: string;
  outflow: string;
  direction: string;
  freightRate: string;
  transitTime: string;
  responsible: string;
  state: string;
}

const publicLogisticsListFields = [
  { code: "LOG_SAMPLE_NAME", label: "物流样本点名称" },
  { code: "LOG_REGION", label: "地区" },
  { code: "LOG_REPORTER", label: "填报人" },
  { code: "LOG_SURVEYOR_NAME", label: "调研人" },
  { code: "LOG_SURVEYOR_PHONE", label: "调研人联系方式" },
  { code: "LOG_SAMPLE_CONTACT", label: "物流样本点联系方式" },
  { code: "LOG_SAMPLE_LATITUDE", label: "纬度（度）" },
  { code: "LOG_SAMPLE_LONGITUDE", label: "经度（度）" },
  { code: "LOG_TRANSPORT_MODE", label: "运输方式" },
  { code: "LOG_DIRECTION", label: "运输方向" },
  { code: "LOG_ROUTE_VOLUME", label: "运输数量（吨）" },
  { code: "LOG_FREIGHT_RATE", label: "物流运价（不含车板价）（元/吨）" },
  { code: "LOG_BOARD_PRICE", label: "车板价（元/吨）" },
] as const;

const logisticsIdentityListFields = publicLogisticsListFields.slice(0, 8);

const logisticsProducts = [
  { code: "CORN", label: "玉米" },
  { code: "SOYBEAN", label: "大豆" },
  { code: "RICE", label: "稻谷" },
] as const;

const logisticsStatusLabels: Readonly<Record<string, string>> = {
  DRAFT: "填写中",
  PENDING_REVIEW: "待审核",
  SUBMITTED: "待审核",
  APPROVED: "已核定",
  RETURNED: "退回待补充",
  VOIDED: "已作废",
};

function persistedValue(record: LogisticsRecordRow, code: string): string {
  return record.displayValues[code] ?? record.values[code] ?? "—";
}

function persistedSurveyPeriod(record: LogisticsRecordRow): string {
  return formatExplicitSurveyPeriod(
    { ...record.values, ...record.displayValues },
    "LOG",
    "LOG_COLLECTION_DATE",
  );
}

function persistedFillingTime(record: LogisticsRecordRow): string {
  return formatRealFillingTime(
    { ...record.values, ...record.displayValues },
    "LOG",
  );
}

function persistedRow(
  record: LogisticsRecordRow,
  number: number,
): LogisticsRow {
  const direction = persistedValue(record, "LOG_DIRECTION");
  const volume = persistedValue(record, "LOG_ROUTE_VOLUME");
  const status = persistedValue(record, "LOG_STATUS");
  return {
    workId: record.id,
    number,
    surveyPeriod: persistedSurveyPeriod(record),
    fillingTime: persistedFillingTime(record),
    node: record.id,
    nodeType: persistedValue(record, "LOG_TRANSPORT_MODE"),
    region: persistedValue(record, "LOG_REGION"),
    inflow: direction.includes("流入") ? volume : "—",
    outflow: direction.includes("流出") ? volume : "—",
    direction,
    freightRate: persistedValue(record, "LOG_FREIGHT_RATE"),
    transitTime: "—",
    responsible: persistedValue(record, "LOG_REPORTER"),
    state:
      status !== "—"
        ? status
        : (logisticsStatusLabels[record.status] ?? "待确认"),
  };
}

function fixturePublicValue(row: LogisticsRow, code: string): string {
  switch (code) {
    case "LOG_SAMPLE_NAME":
      return row.node;
    case "LOG_REGION":
      return row.region;
    case "LOG_REPORTER":
      return row.responsible;
    case "LOG_TRANSPORT_MODE":
      return row.nodeType;
    case "LOG_DIRECTION":
      return row.inflow !== "—" && row.outflow !== "—"
        ? "流入 / 流出"
        : row.inflow !== "—"
          ? "流入"
          : "流出";
    case "LOG_ROUTE_VOLUME":
      return row.inflow !== "—" ? row.inflow : row.outflow;
    case "LOG_FREIGHT_RATE":
      return row.freightRate;
    default:
      return "—";
  }
}

function pathValue(path: readonly EnterpriseRegionNode[]): RegionCascadeValue {
  return {
    cityId: path.find(({ level }) => level === "prefecture")?.id,
    countyId: path.find(({ level }) => level === "county")?.id,
  };
}

function scopeRegionId(value: RegionCascadeValue): string {
  if (value.countyId) return value.countyId;
  if (value.cityId) {
    return (
      aggregateRegionByCity[
        value.cityId as keyof typeof aggregateRegionByCity
      ] ?? value.cityId
    );
  }
  return "authorized-all";
}

function regionContains(scopeRegion: string, itemRegion: string): boolean {
  if (scopeRegion === "authorized-all") return true;
  const requestedPath = getEnterpriseRegionPath(scopeRegion).map(
    ({ id }) => id,
  );
  const itemPath = getEnterpriseRegionPath(itemRegion).map(({ id }) => id);
  return (
    requestedPath.some((id) => itemPath.includes(id)) ||
    itemPath.some((id) => requestedPath.includes(id))
  );
}

function field(
  workId: string,
  fieldId: string,
): MarketDocumentField | undefined {
  return marketDocumentFixtures
    .find((candidate) => candidate.workId === workId)
    ?.fieldGroups.flatMap(({ fields }) => fields)
    .find((candidate) => candidate.fieldId === fieldId);
}

function fieldValue(workId: string, fieldId: string): string {
  const candidate = field(workId, fieldId);
  if (!candidate) return "—";
  return `${candidate.value}${candidate.unit ? ` ${candidate.unit}` : ""}`;
}

function firstAvailable(workId: string, fieldIds: readonly string[]): string {
  for (const fieldId of fieldIds) {
    const value = fieldValue(workId, fieldId);
    if (value !== "—") return value;
  }
  return "—";
}

export function LogisticsMonitoringWorkspace({
  productCode,
  scope,
  onScopeChange,
  selection,
  onSelectionChange,
  onSelectionClear,
  queryAllowed,
  workItems = businessWorkFixtures,
  documentDrafts = {},
  onDocumentDraftChange = () => undefined,
  onWorkItemChange = () => undefined,
  onCreateRecord,
  onEditRecord,
  realtimeRepository,
  realtimeRefreshToken = 0,
  permissions = [],
}: {
  productCode: "CORN" | "SOYBEAN" | "RICE";
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  selection?: FormalSelection;
  onSelectionChange: (selection: FormalSelection) => void;
  onSelectionClear?: () => void;
  queryAllowed: boolean;
  workItems?: readonly BusinessWorkItem[];
  documentDrafts?: Readonly<Record<string, MarketDocumentDraft>>;
  onDocumentDraftChange?: (workId: string, draft: MarketDocumentDraft) => void;
  onWorkItemChange?: (item: BusinessWorkItem) => void;
  onCreateRecord?: (productCode: "CORN" | "SOYBEAN" | "RICE") => void;
  onEditRecord?: (
    productCode: "CORN" | "SOYBEAN" | "RICE",
    recordId: string,
  ) => void;
  realtimeRepository?: RealtimeBusinessRepository;
  realtimeRefreshToken?: number;
  permissions?: readonly string[];
}) {
  const [nodeType, setNodeType] = useState("");
  const [lowerRegion, setLowerRegion] = useState<RegionCascadeValue>({});
  const [realtimeRegionCode, setRealtimeRegionCode] = useState("");
  const [surveyYear, setSurveyYear] = useState(currentSurveyYear);
  const [surveyMonth, setSurveyMonth] = useState("");
  const [persistedRecords, setPersistedRecords] = useState<
    readonly LogisticsRecordRow[]
  >([]);
  const [pageNumber, setPageNumber] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState("");
  const [selectedPersistedId, setSelectedPersistedId] = useState<string>();
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [importJob, setImportJob] = useState<ProductionImportJob | null>(null);
  const [importPhotos, setImportPhotos] = useState<readonly File[]>([]);
  const [recordsRevision, setRecordsRevision] = useState(0);
  const [definition, setDefinition] = useState<LogisticsDefinition | null>(
    null,
  );
  const { masterData, masterDataError } =
    useRealtimeMasterData(realtimeRepository);

  async function downloadTemplate() {
    if (!realtimeRepository?.downloadLogisticsXlsxTemplate) return;
    setImportMessage("");
    try {
      const blob =
        await realtimeRepository.downloadLogisticsXlsxTemplate(productCode);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const productName =
        masterData?.products.find((product) => product.code === productCode)
          ?.name ?? "粮食";
      anchor.download = `物流-${productName}-批量导入模板.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
      setImportMessage("物流导入模板已下载");
    } catch {
      setImportMessage("物流导入模板下载失败，请稍后重试。");
    }
  }

  async function importWorkbook(file: File | undefined) {
    if (!file || !realtimeRepository?.importLogisticsWorkbook) return;
    setImporting(true);
    setImportMessage("");
    setImportJob(null);
    try {
      const initial = await realtimeRepository.importLogisticsWorkbook(
        file,
        productCode,
        importPhotos,
      );
      const result = await awaitBusinessImport({
        repository: realtimeRepository,
        domain: "logistics",
        initial,
        onUpdate: setImportJob,
      });
      if (result.statusCode !== "FAILED") {
        setImportPhotos([]);
        setPageNumber(0);
        setRecordsRevision((value) => value + 1);
      }
    } catch {
      setImportMessage("物流记录导入失败，请核对模板和填报内容。");
    } finally {
      setImporting(false);
    }
  }

  async function retryImport() {
    if (!realtimeRepository?.retryImportJob || !importJob) return;
    setImporting(true);
    setRecordsError("");
    try {
      const initial = await realtimeRepository.retryImportJob(
        "logistics",
        importJob.id,
      );
      const result = await awaitBusinessImport({
        repository: realtimeRepository,
        domain: "logistics",
        initial,
        onUpdate: setImportJob,
      });
      if (result.statusCode !== "FAILED") {
        setPageNumber(0);
        setRecordsRevision((value) => value + 1);
      }
    } catch {
      setRecordsError("物流导入任务重试失败，请稍后重试。");
    } finally {
      setImporting(false);
    }
  }

  async function downloadImportErrors() {
    if (!realtimeRepository?.downloadImportErrors || !importJob) return;
    setRecordsError("");
    try {
      saveImportErrorFile(
        await realtimeRepository.downloadImportErrors(
          "logistics",
          importJob.id,
        ),
        "logistics",
        importJob.id,
      );
    } catch {
      setRecordsError("物流导入错误清单下载失败，请稍后重试。");
    }
  }

  useEffect(() => {
    if (!realtimeRepository) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setRecordsLoading(true);
      setRecordsError("");
      setSelectedPersistedId(undefined);
    });
    const request = realtimeRepository.listEligibleFormalSamples
      ? realtimeRepository
          .listEligibleFormalSamples({
            domain: "LOGISTICS",
            productCode,
            regionCode: realtimeRegionCode || undefined,
            objectTypeCode: nodeType
              ? logisticsNodeTypeCodeById[nodeType]
              : undefined,
            year: Number(surveyYear),
            observedAt: new Date(
              `${surveyYear}-${surveyMonth ? surveyMonth.padStart(2, "0") : "12"}-01T00:00:00+08:00`,
            ).toISOString(),
          })
          .then((samples) => ({
            items: samples.map((sample) => ({
              id: sample.latestObservationId ?? sample.samplePointId,
              productCode,
              values: {
                ...sample.latestValues,
                LOG_SAMPLE_NAME: sample.sampleName,
                LOG_REGION: sample.regionName,
                LOG_SAMPLE_LATITUDE: sample.latitude,
                LOG_SAMPLE_LONGITUDE: sample.longitude,
                __FORMAL_SAMPLE_ID: sample.samplePointId,
                __FORMAL_SAMPLE_ADDRESS: sample.address,
                __FORMAL_SAMPLE_MAINTAINER: sample.maintainerDisplayName ?? "—",
                __FORMAL_LATEST_OBSERVATION_ID:
                  sample.latestObservationId ?? "",
              },
              displayValues: {},
              status: "DRAFT",
              returnReason: null,
              allowedActions: [],
              version: sample.version,
            })),
            pageNumber: 0,
            pageSize: samples.length,
            totalElements: samples.length,
            totalPages: samples.length > 0 ? 1 : 0,
          }))
      : realtimeRepository.listLogistics({
          productCode,
          page: pageNumber,
          pageSize: collectionPageSize,
          filters: {
            regionCode: realtimeRegionCode || undefined,
            surveyYear,
            surveyMonth: surveyMonth || undefined,
            nodeTypeCode: nodeType
              ? logisticsNodeTypeCodeById[nodeType]
              : undefined,
          },
        });
    void request
      .then((page) => {
        if (!cancelled) {
          const nextTotalPages = Math.max(1, page.totalPages);
          if (pageNumber >= nextTotalPages && pageNumber > 0) {
            setPageNumber(nextTotalPages - 1);
            return;
          }
          setPersistedRecords(page.items);
          setTotalElements(page.totalElements);
          setServerTotalPages(nextTotalPages);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPersistedRecords([]);
          setRecordsError("物流监测记录读取失败，请稍后重试。");
        }
      })
      .finally(() => {
        if (!cancelled) setRecordsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    nodeType,
    pageNumber,
    productCode,
    realtimeRefreshToken,
    realtimeRegionCode,
    realtimeRepository,
    recordsRevision,
    surveyMonth,
    surveyYear,
  ]);
  useEffect(() => {
    if (!realtimeRepository?.loadLogisticsDefinition) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setDefinition(null);
    });
    void realtimeRepository
      .loadLogisticsDefinition(productCode)
      .then((nextDefinition) => {
        if (!cancelled) setDefinition(nextDefinition);
      })
      .catch(() => {
        if (!cancelled) {
          setDefinition(null);
          setRecordsError("物流填报规则读取失败，请稍后重试。");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [productCode, realtimeRepository]);
  const scopedRegion = pathValue(
    getEnterpriseRegionPath(scope.coordinates.regionId),
  );
  const governedRegion: RegionCascadeValue = scopedRegion.cityId
    ? scopedRegion
    : { cityId: "qiqihar" };
  const regionValue: RegionCascadeValue = {
    ...governedRegion,
    ...(governedRegion.countyId === lowerRegion.countyId ? lowerRegion : {}),
  };
  const items = useMemo(
    () =>
      workItems.filter(
        (item) =>
          queryAllowed &&
          item.domain === "market" &&
          item.businessSubtypeId === "market.logistics" &&
          regionContains(scope.coordinates.regionId, item.regionId) &&
          matchesSurveyPeriod(
            item.deadline.slice(0, 10),
            surveyYear,
            surveyMonth,
          ) &&
          (!nodeType ||
            (item.subject.kind === "monitoring-object" &&
              item.subject.objectTypeId === nodeType)),
      ),
    [
      nodeType,
      queryAllowed,
      scope.coordinates.regionId,
      surveyMonth,
      surveyYear,
      workItems,
    ],
  );
  const ledgerListFields = realtimeRepository
    ? [
        ...logisticsIdentityListFields,
        ...observationFields("LOGISTICS", definition).map((field) => ({
          code: field.code,
          label: field.unit ? `${field.label}（${field.unit}）` : field.label,
        })),
      ]
    : publicLogisticsListFields;
  const rows: readonly LogisticsRow[] = items.map((item, index) => {
    const objectTypeId =
      item.subject.kind === "monitoring-object"
        ? item.subject.objectTypeId
        : "unknown";
    const origin = fieldValue(item.workId, "origin");
    const destination = fieldValue(item.workId, "destination");
    return {
      workId: item.workId,
      number: index + 1,
      product:
        logisticsProducts.find(({ code }) => code === productCode)?.label ??
        productCode,
      surveyPeriod: formatSurveyPeriodFromDate(item.deadline.slice(0, 10)),
      fillingTime: "—",
      node:
        item.subject.kind === "monitoring-object"
          ? item.subject.objectName
          : "物流节点未提供",
      nodeType: nodeTypeLabels[objectTypeId] ?? "其他物流节点",
      region: item.regionLabel,
      inflow: firstAvailable(item.workId, ["railArrival", "roadInflow"]),
      outflow: firstAvailable(item.workId, ["railDispatch", "roadOutflow"]),
      direction:
        origin !== "—" && destination !== "—"
          ? `${origin} → ${destination}`
          : "待采集",
      freightRate: firstAvailable(item.workId, ["freightRate", "railFreight"]),
      transitTime: firstAvailable(item.workId, [
        "transitTime",
        "averageTransit",
      ]),
      responsible: item.responsiblePerson,
      state: `${marketLifecycleLabels.review[item.reviewStatus]} · ${marketLifecycleLabels.quality[item.qualityStatus]}`,
    };
  });
  const filteredRows = rows;
  const fixturePageCount = Math.max(
    1,
    Math.ceil(filteredRows.length / collectionPageSize),
  );
  const pageCount = realtimeRepository ? serverTotalPages : fixturePageCount;
  const currentPageNumber = Math.min(pageNumber, pageCount - 1);
  const displayedRows = realtimeRepository
    ? persistedRecords.map((record, index) =>
        persistedRow(
          record,
          currentPageNumber * collectionPageSize + index + 1,
        ),
      )
    : filteredRows.slice(
        currentPageNumber * collectionPageSize,
        (currentPageNumber + 1) * collectionPageSize,
      );
  const rowTotal = realtimeRepository ? totalElements : filteredRows.length;
  const rowStart =
    rowTotal === 0 ? 0 : currentPageNumber * collectionPageSize + 1;
  const rowEnd = Math.min(
    (currentPageNumber + 1) * collectionPageSize,
    rowTotal,
  );
  const selectedPersistedRecord = realtimeRepository
    ? persistedRecords.find(({ id }) => id === selectedPersistedId)
    : undefined;
  const selectedItem =
    selection?.type === "work-item"
      ? items.find(({ workId }) => workId === selection.id)
      : undefined;
  const selectedDocument = selectedItem
    ? marketDocumentFixtures.find(
        ({ workId }) => workId === selectedItem.workId,
      )
    : undefined;
  const completedFields = items.reduce(
    (sum, item) => sum + item.completedFields,
    0,
  );
  const missingFields = items.reduce(
    (sum, item) =>
      sum + Math.max(0, item.applicableFields - item.completedFields),
    0,
  );

  return (
    <div className="enterprise-ledger-workbench">
      <div className="enterprise-ledger-workbench__breadcrumb">
        物流监测 / 物流业务监测
      </div>
      <ExistingSampleObservationPanel
        domain="LOGISTICS"
        permissions={permissions}
        productCode={productCode}
        repository={realtimeRepository}
        selection={selection}
        onSelectionChange={onSelectionChange}
        onSelectionClear={onSelectionClear}
        onSaved={() => setRecordsRevision((value) => value + 1)}
      >
        <section
          aria-label="物流业务查询条件"
          className="enterprise-ledger-query enterprise-ledger-query--logistics"
          role="search"
        >
          <label>
            <span>调查年份</span>
            <select
              aria-label="调查年份"
              required
              value={surveyYear}
              onChange={(event) => {
                setSurveyYear(event.target.value);
                setPageNumber(0);
              }}
            >
              {surveyYearOptions.map((year) => (
                <option key={year} value={year}>
                  {year} 年
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>调查月份</span>
            <select
              aria-label="调查月份"
              value={surveyMonth}
              onChange={(event) => {
                setSurveyMonth(event.target.value);
                setPageNumber(0);
              }}
            >
              <option value="">全年（含年度与月度数据）</option>
              {surveyMonthOptions.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {realtimeRepository ? (
            <RealtimeRegionFilterSelect
              authorizedRegionCodes={scope.authorization.authorizedRegionIds}
              disabled={!masterData}
              onChange={(regionCode) => {
                setRealtimeRegionCode(regionCode);
                setPageNumber(0);
              }}
              regions={masterData?.regions ?? []}
              value={realtimeRegionCode}
            />
          ) : (
            <RegionCascadeSelector
              authorizedRegionIds={scope.authorization.authorizedRegionIds}
              maxLevel="county"
              value={regionValue}
              onChange={(value) => {
                setLowerRegion(value);
                setPageNumber(0);
                onScopeChange({ regionId: scopeRegionId(value) });
              }}
            />
          )}
          <label>
            <span>运输方式</span>
            <select
              aria-label="运输方式"
              value={nodeType}
              onChange={(event) => {
                setNodeType(event.target.value);
                setPageNumber(0);
              }}
            >
              <option value="">全部运输方式</option>
              <option value="rail-node">铁路</option>
              <option value="road-node">公路</option>
            </select>
          </label>
          <div className="enterprise-ledger-query__actions">
            <button
              className="is-primary"
              type="button"
              onClick={() => setRecordsRevision((value) => value + 1)}
            >
              查询
            </button>
            <button
              type="button"
              onClick={() => {
                setNodeType("");
                setLowerRegion({});
                setRealtimeRegionCode("");
                setSurveyYear(currentSurveyYear);
                setSurveyMonth("");
                setPageNumber(0);
                onScopeChange({
                  regionId: "qiqihar-all",
                  periodKey: undefined,
                });
              }}
            >
              重置
            </button>
          </div>
        </section>

        {!queryAllowed && (
          <div className="market-task6-alert" role="alert">
            当前查询条件超出您的授权范围，系统未展示其他地区的数据。
          </div>
        )}

        {recordsError && (
          <div className="market-task6-alert" role="alert">
            {recordsError}
          </div>
        )}
        {masterDataError && (
          <div className="market-task6-alert" role="alert">
            {masterDataError}
          </div>
        )}
        {!importJob && importMessage && (
          <div className="market-task6-alert" role="status">
            {importMessage}
          </div>
        )}
        <BusinessImportStatus
          busy={importing}
          className="market-task6-alert"
          job={importJob}
          onDownloadErrors={() => void downloadImportErrors()}
          onRetry={() => void retryImport()}
        />

        <header className="enterprise-ledger-title enterprise-ledger-title--collection">
          <h1>粮食物流监测表</h1>
          <p>
            物流运输业务 · {surveyYear}年
            {surveyMonth ? `${Number(surveyMonth)}月` : "全年"} · 当前授权地区
          </p>
        </header>

        <section
          aria-label="粮食物流监测表区域"
          className="enterprise-ledger-table"
        >
          <div className="enterprise-ledger-table__toolbar enterprise-ledger-table__toolbar--collection">
            <strong>
              {recordsLoading
                ? "正在读取物流监测记录"
                : `共 ${displayedRows.length} 条物流记录，当前显示 ${displayedRows.length > 0 ? 1 : 0}–${displayedRows.length}`}
            </strong>
            <div className="enterprise-ledger-table__actions">
              {(realtimeRepository?.downloadLogisticsXlsxTemplate ||
                realtimeRepository?.importLogisticsWorkbook) && (
                <div
                  aria-label="批量导入"
                  className="enterprise-ledger-action-group"
                  role="group"
                >
                  <span className="enterprise-ledger-action-group__label">
                    批量导入
                  </span>
                  {realtimeRepository.downloadLogisticsXlsxTemplate && (
                    <button
                      type="button"
                      onClick={() => void downloadTemplate()}
                    >
                      下载 XLSX 模板
                    </button>
                  )}
                  {realtimeRepository.importLogisticsWorkbook && (
                    <>
                      <label className="realtime-business-file-action">
                        {importing ? "正在导入" : "批量导入 XLSX"}
                        <input
                          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                          aria-label="批量导入物流记录"
                          disabled={importing}
                          type="file"
                          onChange={(event) => {
                            void importWorkbook(event.target.files?.[0]);
                            event.target.value = "";
                          }}
                        />
                      </label>
                      <label className="realtime-business-file-action">
                        随 XLSX 上传照片（{importPhotos.length} 张）
                        <input
                          accept="image/jpeg,image/png"
                          aria-label="附加物流照片"
                          disabled={importing}
                          multiple
                          type="file"
                          onChange={(event) =>
                            setImportPhotos(
                              Array.from(event.target.files ?? []),
                            )
                          }
                        />
                      </label>
                    </>
                  )}
                </div>
              )}
              <div
                aria-label="单条录入"
                className="enterprise-ledger-action-group enterprise-ledger-action-group--primary"
                role="group"
              >
                <span className="enterprise-ledger-action-group__label">
                  单条录入
                </span>
                <button
                  type="button"
                  onClick={() => onCreateRecord?.(productCode)}
                >
                  新建监测记录
                </button>
              </div>
            </div>
          </div>
          <div className="enterprise-ledger-table__scroll" tabIndex={0}>
            <table aria-label="粮食物流监测表">
              <thead>
                <tr>
                  <th>序号</th>
                  <th>数据时间</th>
                  <th>填报日期</th>
                  <th>详细地址</th>
                  <th>样本点维护人</th>
                  {ledgerListFields.map((field) => (
                    <th data-field-code={field.code} key={field.code}>
                      {field.label}
                    </th>
                  ))}
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {realtimeRepository
                  ? persistedRecords.map((record, index) => (
                      <tr key={record.id}>
                        <td>
                          {currentPageNumber * collectionPageSize + index + 1}
                        </td>
                        <td>{persistedSurveyPeriod(record)}</td>
                        <td>{persistedFillingTime(record)}</td>
                        <td>{record.values.__FORMAL_SAMPLE_ADDRESS ?? "—"}</td>
                        <td>
                          {record.values.__FORMAL_SAMPLE_MAINTAINER ?? "—"}
                        </td>
                        {ledgerListFields.map(({ code }) => (
                          <td className="is-operational" key={code}>
                            {persistedValue(record, code)}
                          </td>
                        ))}
                        <td>
                          <button
                            className="enterprise-ledger-row-action"
                            type="button"
                            disabled={
                              Boolean(record.values.__FORMAL_SAMPLE_ID) &&
                              !record.values.__FORMAL_LATEST_OBSERVATION_ID
                            }
                            onClick={() => {
                              if (
                                onEditRecord &&
                                (!record.values.__FORMAL_SAMPLE_ID ||
                                  record.values.__FORMAL_LATEST_OBSERVATION_ID)
                              ) {
                                onEditRecord(productCode, record.id);
                                return;
                              }
                              setSelectedPersistedId(record.id);
                            }}
                          >
                            查看记录
                          </button>
                          {record.values.__FORMAL_SAMPLE_ID &&
                            permissions.includes("FORMAL_SAMPLE_MANAGE") && (
                              <button
                                className="enterprise-ledger-row-action"
                                type="button"
                                onClick={() =>
                                  onSelectionChange({
                                    type: "formal-sample-observation",
                                    id: record.values.__FORMAL_SAMPLE_ID,
                                  })
                                }
                              >
                                编辑
                              </button>
                            )}
                          {record.values.__FORMAL_SAMPLE_ID &&
                            permissions.includes("FORMAL_SAMPLE_DELETE") && (
                              <button
                                className="enterprise-ledger-row-action"
                                type="button"
                                onClick={() => {
                                  if (
                                    !realtimeRepository?.deleteFormalSamplePoint
                                  )
                                    return;
                                  void realtimeRepository
                                    .deleteFormalSamplePoint(
                                      record.values.__FORMAL_SAMPLE_ID,
                                      record.version,
                                    )
                                    .then(() =>
                                      setRecordsRevision((value) => value + 1),
                                    )
                                    .catch((error: unknown) =>
                                      setRecordsError(
                                        error instanceof RealtimeApiError &&
                                          error.clientMessage
                                          ? error.clientMessage
                                          : "样本点删除失败，请稍后重试。",
                                      ),
                                    );
                                }}
                              >
                                删除
                              </button>
                            )}
                        </td>
                      </tr>
                    ))
                  : displayedRows.map((row) => (
                      <tr key={row.workId}>
                        <td>{row.number}</td>
                        <td>{row.surveyPeriod}</td>
                        <td>{row.fillingTime}</td>
                        <td>—</td>
                        <td>—</td>
                        {ledgerListFields.map(({ code }) => (
                          <td className="is-operational" key={code}>
                            {fixturePublicValue(row, code)}
                          </td>
                        ))}
                        <td>
                          <button
                            className="enterprise-ledger-row-action"
                            type="button"
                            onClick={() => {
                              if (realtimeRepository) {
                                if (onEditRecord) {
                                  onEditRecord(productCode, row.workId);
                                  return;
                                }
                                setSelectedPersistedId(row.workId);
                              } else {
                                onSelectionChange({
                                  type: "work-item",
                                  id: row.workId,
                                });
                              }
                            }}
                          >
                            查看记录
                          </button>
                        </td>
                      </tr>
                    ))}
                {displayedRows.length === 0 && !recordsLoading && (
                  <tr>
                    <td
                      className="enterprise-ledger-table__empty"
                      colSpan={ledgerListFields.length + 6}
                    >
                      当前范围暂无粮食物流监测记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <footer>
            <span>
              {realtimeRepository
                ? `本页共 ${displayedRows.length} 条业务记录`
                : `本页已填 ${completedFields} 项，缺失 ${missingFields} 项`}
            </span>
            <WorkspacePagination
              end={rowEnd}
              onPageChange={(nextPage) => setPageNumber(nextPage - 1)}
              page={currentPageNumber + 1}
              pages={pageCount}
              start={rowStart}
              total={rowTotal}
            />
          </footer>
        </section>

        {selectedPersistedRecord && (
          <section
            aria-label="物流记录详情"
            className="enterprise-ledger-title"
          >
            <h2>物流记录详情</h2>
            <p>
              {persistedValue(selectedPersistedRecord, "LOG_SAMPLE_NAME")} ·{" "}
              {persistedValue(selectedPersistedRecord, "LOG_REGION")} ·{" "}
              {persistedSurveyPeriod(selectedPersistedRecord)} ·{" "}
              {persistedFillingTime(selectedPersistedRecord)}
            </p>
            <dl>
              {ledgerListFields.map(({ code, label }) => (
                <div key={code}>
                  <dt>{label}</dt>
                  <dd>{persistedValue(selectedPersistedRecord, code)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {selectedItem && selectedDocument && (
          <MarketDocumentWorkbench
            actor={{
              userId: scope.identity.userId,
              displayName: scope.identity.displayName ?? "当前登录人员",
              canRelease:
                scope.authorization.permissionKeys.includes("market:release"),
            }}
            document={selectedDocument}
            draft={documentDrafts[selectedItem.workId]}
            item={selectedItem}
            onDraftChange={(draft) =>
              onDocumentDraftChange(selectedItem.workId, draft)
            }
            onItemChange={onWorkItemChange}
          />
        )}
      </ExistingSampleObservationPanel>
    </div>
  );
}
