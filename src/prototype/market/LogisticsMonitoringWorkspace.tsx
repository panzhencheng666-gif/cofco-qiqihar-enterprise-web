import { useEffect, useMemo, useState } from "react";

import type {
  LogisticsDefinition,
  LogisticsRecordRow,
  ProductionImportJob,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";

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
import { marketTaskPeriods } from "../marketMonitoringData";
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
  product: string;
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

const logisticsProducts = [
  { code: "CORN", label: "玉米" },
  { code: "SOYBEAN", label: "大豆" },
  { code: "RICE", label: "稻谷" },
] as const;

const logisticsStatusLabels: Readonly<Record<string, string>> = {
  DRAFT: "填写中",
  SUBMITTED: "待审核",
  APPROVED: "已核定",
  RETURNED: "退回待补充",
};

function persistedValue(record: LogisticsRecordRow, code: string): string {
  return record.displayValues[code] ?? record.values[code] ?? "—";
}

function persistedRow(
  record: LogisticsRecordRow,
  number: number,
): LogisticsRow {
  const origin = persistedValue(record, "LOG_ORIGIN");
  const destination = persistedValue(record, "LOG_DESTINATION");
  const direction = persistedValue(record, "LOG_DIRECTION");
  const volume = persistedValue(record, "LOG_ROUTE_VOLUME");
  const status = persistedValue(record, "LOG_STATUS");
  return {
    workId: record.id,
    number,
    product:
      logisticsProducts.find(({ code }) => code === record.productCode)
        ?.label ?? record.productCode,
    node: record.id,
    nodeType: persistedValue(record, "LOG_TRANSPORT_MODE"),
    region: persistedValue(record, "LOG_REGION"),
    inflow: direction.includes("流入") ? volume : "—",
    outflow: direction.includes("流出") ? volume : "—",
    direction:
      origin !== "—" && destination !== "—"
        ? `${origin} → ${destination}`
        : direction,
    freightRate: persistedValue(record, "LOG_FREIGHT_RATE"),
    transitTime: persistedValue(record, "LOG_TRANSIT_TIME"),
    responsible: persistedValue(record, "LOG_SOURCE_ORGANIZATION"),
    state:
      status !== "—"
        ? status
        : (logisticsStatusLabels[record.status] ?? "待确认"),
  };
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
  queryAllowed,
  workItems = businessWorkFixtures,
  documentDrafts = {},
  onDocumentDraftChange = () => undefined,
  onWorkItemChange = () => undefined,
  onCreateRecord,
  realtimeRepository,
  realtimeRefreshToken = 0,
}: {
  productCode: "CORN" | "SOYBEAN" | "RICE";
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  selection?: FormalSelection;
  onSelectionChange: (selection: FormalSelection) => void;
  queryAllowed: boolean;
  workItems?: readonly BusinessWorkItem[];
  documentDrafts?: Readonly<Record<string, MarketDocumentDraft>>;
  onDocumentDraftChange?: (workId: string, draft: MarketDocumentDraft) => void;
  onWorkItemChange?: (item: BusinessWorkItem) => void;
  onCreateRecord?: (productCode: "CORN" | "SOYBEAN" | "RICE") => void;
  realtimeRepository?: RealtimeBusinessRepository;
  realtimeRefreshToken?: number;
}) {
  const [nodeType, setNodeType] = useState("");
  const [lowerRegion, setLowerRegion] = useState<RegionCascadeValue>({});
  const [persistedRecords, setPersistedRecords] = useState<
    readonly LogisticsRecordRow[]
  >([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState("");
  const [selectedPersistedId, setSelectedPersistedId] = useState<string>();
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [importJob, setImportJob] = useState<ProductionImportJob | null>(null);
  const [recordsRevision, setRecordsRevision] = useState(0);
  const [definition, setDefinition] = useState<LogisticsDefinition | null>(
    null,
  );

  async function downloadTemplate() {
    if (!realtimeRepository?.downloadLogisticsXlsxTemplate) return;
    setImportMessage("");
    try {
      const blob =
        await realtimeRepository.downloadLogisticsXlsxTemplate(productCode);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `物流-${productCode}-批量导入模板.xlsx`;
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
      );
      const result = await awaitBusinessImport({
        repository: realtimeRepository,
        domain: "logistics",
        initial,
        onUpdate: setImportJob,
      });
      if (result.statusCode !== "FAILED") {
        const page = await realtimeRepository.listLogistics({
          productCode,
          page: 0,
          pageSize: 100,
        });
        setPersistedRecords(page.items);
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
    void realtimeRepository
      .listLogistics({ productCode, page: 0, pageSize: 100 })
      .then((page) => {
        if (!cancelled) setPersistedRecords(page.items);
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
  }, [productCode, realtimeRefreshToken, realtimeRepository, recordsRevision]);
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
          (!scope.coordinates.periodKey ||
            item.periodKey === scope.coordinates.periodKey) &&
          (!nodeType ||
            (item.subject.kind === "monitoring-object" &&
              item.subject.objectTypeId === nodeType)),
      ),
    [nodeType, queryAllowed, scope.coordinates, workItems],
  );
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
      node:
        item.subject.kind === "monitoring-object"
          ? item.subject.objectName
          : "物流节点待维护",
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
  const displayedRows = realtimeRepository
    ? persistedRecords.map((record, index) => persistedRow(record, index + 1))
    : rows;
  const definitionFields =
    definition?.fields.filter(({ code }) => code !== "LOG_STATUS") ?? [];
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
        物流监测 / 物流节点监测
      </div>
      <section
        aria-label="物流节点查询条件"
        className="enterprise-ledger-query enterprise-ledger-query--logistics"
        role="search"
      >
        <RegionCascadeSelector
          authorizedRegionIds={scope.authorization.authorizedRegionIds}
          maxLevel="county"
          value={regionValue}
          onChange={(value) => {
            setLowerRegion(value);
            onScopeChange({ regionId: scopeRegionId(value) });
          }}
        />
        <label>
          <span>节点类型</span>
          <select
            aria-label="节点类型"
            value={nodeType}
            onChange={(event) => setNodeType(event.target.value)}
          >
            <option value="">全部节点类型</option>
            <option value="rail-node">铁路站点</option>
            <option value="road-node">公路物流节点</option>
          </select>
        </label>
        <label>
          <span>监测期</span>
          <select
            aria-label="监测期"
            value={scope.coordinates.periodKey ?? ""}
            onChange={(event) =>
              onScopeChange({ periodKey: event.target.value || undefined })
            }
          >
            <option value="">全部可用监测期</option>
            {marketTaskPeriods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.label}
              </option>
            ))}
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

      <header className="enterprise-ledger-title">
        <h1>粮食物流节点监测表</h1>
        <p>铁路站点与公路物流节点 · 当前监测期 · 当前授权地区</p>
      </header>

      <section
        aria-label="粮食物流节点监测表区域"
        className="enterprise-ledger-table"
      >
        <div className="enterprise-ledger-table__toolbar">
          <strong>
            {recordsLoading
              ? "正在读取物流监测记录"
              : `共 ${displayedRows.length} 条物流记录，当前显示 ${displayedRows.length > 0 ? 1 : 0}–${displayedRows.length}`}
          </strong>
          <div>
            {realtimeRepository?.downloadLogisticsXlsxTemplate && (
              <button type="button" onClick={() => void downloadTemplate()}>
                下载 XLSX 模板
              </button>
            )}
            {realtimeRepository?.importLogisticsWorkbook && (
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
            )}
            <button type="button" onClick={() => onCreateRecord?.(productCode)}>
              新建监测记录
            </button>
          </div>
        </div>
        <div className="enterprise-ledger-table__scroll" tabIndex={0}>
          <table aria-label="粮食物流节点监测表">
            <thead>
              {realtimeRepository && definition ? (
                <tr>
                  <th>序号</th>
                  <th>产品品种</th>
                  {definitionFields.map((field) => (
                    <th key={field.code}>
                      {field.label}
                      {field.unit ? `（${field.unit}）` : ""}
                    </th>
                  ))}
                  <th>业务状态</th>
                  <th>操作</th>
                </tr>
              ) : (
                <>
                  <tr>
                    <th rowSpan={2}>序号</th>
                    <th rowSpan={2}>产品品种</th>
                    <th rowSpan={2}>物流节点</th>
                    <th rowSpan={2}>节点类型</th>
                    <th rowSpan={2}>行政区划</th>
                    <th colSpan={3}>运输数量与方向</th>
                    <th colSpan={2}>运输依据</th>
                    <th rowSpan={2}>责任人</th>
                    <th rowSpan={2}>业务状态</th>
                    <th rowSpan={2}>操作</th>
                  </tr>
                  <tr>
                    <th>流入量</th>
                    <th>流出量</th>
                    <th>主要流向</th>
                    <th>运价</th>
                    <th>平均在途时间</th>
                  </tr>
                </>
              )}
            </thead>
            <tbody>
              {realtimeRepository && definition
                ? persistedRecords.map((record, index) => (
                    <tr key={record.id}>
                      <td>{index + 1}</td>
                      <td>
                        {logisticsProducts.find(
                          ({ code }) => code === record.productCode,
                        )?.label ?? record.productCode}
                      </td>
                      {definitionFields.map(({ code }) => (
                        <td className="is-operational" key={code}>
                          {persistedValue(record, code)}
                        </td>
                      ))}
                      <td>
                        {logisticsStatusLabels[record.status] ?? record.status}
                      </td>
                      <td>
                        <button
                          className="enterprise-ledger-row-action"
                          type="button"
                          onClick={() => setSelectedPersistedId(record.id)}
                        >
                          查看
                        </button>
                      </td>
                    </tr>
                  ))
                : displayedRows.map((row) => (
                    <tr key={row.workId}>
                      <td>{row.number}</td>
                      <td>{row.product}</td>
                      <th scope="row">{row.node}</th>
                      <td>{row.nodeType}</td>
                      <td>{row.region}</td>
                      <td className="is-operational">{row.inflow}</td>
                      <td className="is-operational">{row.outflow}</td>
                      <td className="is-operational">{row.direction}</td>
                      <td className="is-operational">{row.freightRate}</td>
                      <td className="is-operational">{row.transitTime}</td>
                      <td>{row.responsible}</td>
                      <td>{row.state}</td>
                      <td>
                        <button
                          className="enterprise-ledger-row-action"
                          type="button"
                          onClick={() => {
                            if (realtimeRepository) {
                              setSelectedPersistedId(row.workId);
                            } else {
                              onSelectionChange({
                                type: "work-item",
                                id: row.workId,
                              });
                            }
                          }}
                        >
                          查看
                        </button>
                      </td>
                    </tr>
                  ))}
              {displayedRows.length === 0 && !recordsLoading && (
                <tr>
                  <td
                    className="enterprise-ledger-table__empty"
                    colSpan={
                      realtimeRepository && definition
                        ? definitionFields.length + 4
                        : 13
                    }
                  >
                    当前范围暂无粮食物流节点监测记录
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
          <nav aria-label="物流节点监测表分页">
            <button type="button">‹</button>
            <button className="is-current" type="button">
              1
            </button>
            <button type="button">›</button>
          </nav>
        </footer>
      </section>

      {selectedPersistedRecord && (
        <section aria-label="物流记录详情" className="enterprise-ledger-title">
          <h2>物流记录详情</h2>
          <p>
            {persistedValue(selectedPersistedRecord, "LOG_ORIGIN")} →{" "}
            {persistedValue(selectedPersistedRecord, "LOG_DESTINATION")} ·{" "}
            {persistedValue(selectedPersistedRecord, "LOG_COLLECTION_DATE")}
          </p>
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
    </div>
  );
}
