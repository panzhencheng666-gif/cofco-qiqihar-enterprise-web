import { useEffect, useState } from "react";

import type {
  BusinessRecordListItem,
  MarketDefinition,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";

import {
  RegionCascadeSelector,
  type RegionCascadeValue,
} from "../components/RegionCascadeSelector";
import type { BusinessWorkItem } from "../core/businessWork";
import {
  getMarketCapabilityGroups,
  getMarketObjectTypeOptions,
  normalizeMarketObjectType,
  type ApplicableBusinessField,
  type MarketBusinessObjectTypeId,
} from "../core/businessApplicability";
import type { OperationalScope } from "../core/operationalScope";
import { getApplicableCultivars } from "../core/platformMasterData";
import {
  getProductWorkspaceContext,
  type ProductWorkspaceContext,
} from "../core/productWorkspaceContext";
import { businessWorkFixtures } from "../data/businessWorkFixtures";
import {
  enterpriseRegionHierarchy,
  getEnterpriseRegionPath,
  type EnterpriseRegionNode,
} from "../data/enterpriseRegionHierarchy";
import {
  marketDocumentFixtures,
  type MarketDocumentField,
} from "../data/marketDocumentFixtures";
import {
  createFormalRoute,
  type BusinessCoordinates,
  type FormalSelection,
  type MarketSection,
} from "../formalEnterpriseModel";
import { marketCultivarNames } from "../marketMonitoringModel";
import { marketTaskPeriods } from "../marketMonitoringData";
import { marketTasks } from "../marketMonitoringData";
import {
  MarketDocumentWorkbench,
  type MarketDocumentDraft,
} from "./MarketDocumentWorkbench";

const aggregateRegionByCity = {
  qiqihar: "qiqihar-all",
  heihe: "heihe-all",
  hulunbuir: "hulunbuir-designated",
} as const;

interface MarketCollectionRow {
  rowId: string;
  workId: string;
  number: number;
  collectionDate: string;
  submittedAt: string;
  subject: string;
  objectType: string;
  objectTypeId: MarketBusinessObjectTypeId;
  county: string;
  cultivar: string;
  purchasePrice: string;
  transactionPrice: string;
  salesPrice: string;
  moisture: string;
  testWeight: string;
  mildew: string;
  inventory: string;
  transactionVolume: string;
  salesVolume: string;
  state: "待审核" | "已核定" | "需补充" | "填写中";
  values: Readonly<Record<string, string>>;
}

function requiredContext(section: MarketSection): ProductWorkspaceContext {
  const context = getProductWorkspaceContext(
    createFormalRoute("market", section),
  );
  if (!context) throw new Error("当前入口不是分品种市场采集入口");
  return context;
}

function pathValue(path: readonly EnterpriseRegionNode[]): RegionCascadeValue {
  return {
    cityId: path.find(({ level }) => level === "prefecture")?.id,
    countyId: path.find(({ level }) => level === "county")?.id,
    townshipId: path.find(({ level }) => level === "township")?.id,
    villageId: path.find(({ level }) => level === "village")?.id,
  };
}

function selectedRegionId(value: RegionCascadeValue): string {
  return (
    value.villageId ??
    value.townshipId ??
    value.countyId ??
    value.cityId ??
    "authorized-all"
  );
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
  const requestedLeaf = requestedPath.at(-1) ?? scopeRegion;
  const itemLeaf = itemPath.at(-1) ?? itemRegion;
  return itemPath.includes(requestedLeaf) || requestedPath.includes(itemLeaf);
}

function itemLocationRegionId(item: BusinessWorkItem): string {
  return item.subject.kind === "monitoring-object"
    ? (item.subject.locationRegionId ?? item.regionId)
    : item.regionId;
}

function field(
  workId: string,
  fieldId: string,
): MarketDocumentField | undefined {
  return marketDocumentFixtures
    .find((document) => document.workId === workId)
    ?.fieldGroups.flatMap(({ fields }) => fields)
    .find((candidate) => candidate.fieldId === fieldId);
}

function fieldValue(workId: string, fieldId: string): string {
  return field(workId, fieldId)?.value ?? "—";
}

function inventoryValue(workId: string): string {
  for (const fieldId of ["cornStock", "soyStock", "paddyStock"]) {
    const value = fieldValue(workId, fieldId);
    if (value !== "—") return value;
  }
  return "—";
}

function salesPriceValue(workId: string): string {
  const document = marketDocumentFixtures.find(
    (candidate) => candidate.workId === workId,
  );
  return (
    document?.fieldGroups
      .find(({ groupId }) => groupId === "sales")
      ?.fields.find(({ fieldId }) => fieldId === "salesPrice")?.value ?? "—"
  );
}

function marketValue(workId: string, fieldId: string): string {
  if (fieldId === "purchasePrice") return fieldValue(workId, "quote");
  if (fieldId === "purchaseVolume") {
    const value = fieldValue(workId, "purchaseVolume");
    return value !== "—" ? value : fieldValue(workId, "tradeVolume");
  }
  if (fieldId === "salesPrice") return salesPriceValue(workId);
  if (fieldId === "inventory") return inventoryValue(workId);
  return fieldValue(workId, fieldId);
}

const marketFieldCodeByCapability: Readonly<Record<string, string>> = {
  purchasePrice: "MKT_PURCHASE_BASE_PRICE",
  transactionPrice: "MKT_ACTUAL_TRADE_PRICE",
  salesPrice: "MKT_SALE_BASE_PRICE",
  purchaseVolume: "PURCHASE_VOLUME",
  salesVolume: "SALES_VOLUME",
  inventory: "ENDING_INVENTORY",
  transactionVolume: "PURCHASE_VOLUME",
  moisture: "MOISTURE",
  testWeight: "TEST_WEIGHT",
  mildew: "MILDEW",
};

const marketObjectTypeCode: Readonly<
  Record<MarketBusinessObjectTypeId, string>
> = {
  trader: "TRADER",
  "deep-processing": "DEEP_PROCESSOR",
  "breeding-farm": "BREEDING_FACTORY",
  "feed-mill": "FEED_MILL",
  "wholesale-market": "WHOLESALE_MARKET",
  "reserve-storage": "RESERVE_ENTERPRISE",
};

const marketBaseListCodes = new Set([
  "MKT_OBJECT_TYPE",
  "MKT_REGION",
  "MKT_TRADE_DATE",
  "MKT_REPORTED_AT",
  "MKT_SAMPLE_NAME",
]);

export function marketDefinitionListGroups(
  definition: MarketDefinition,
): readonly {
  id: string;
  label: string;
  fields: readonly ApplicableBusinessField[];
}[] {
  const coreFields = definition.coreFields
    .filter(({ code }) => !marketBaseListCodes.has(code))
    .map(({ code, label, unit }) => ({
      id: code,
      label,
      ...(unit ? { unit } : {}),
    }));
  return [
    ...(coreFields.length > 0
      ? [{ id: "market-core", label: "交易与填报信息", fields: coreFields }]
      : []),
    ...definition.groups
      .map((group) => ({
        id: group.category,
        label: group.label,
        fields: group.fields.map(({ code, label, unit }) => ({
          id: code,
          label,
          ...(unit ? { unit } : {}),
        })),
      }))
      .filter(({ fields }) => fields.length > 0),
  ];
}

function persistedMarketValue(
  record: BusinessRecordListItem,
  fieldId: string,
): string {
  const fieldCode = marketFieldCodeByCapability[fieldId] ?? fieldId;
  if (fieldId === "purchasePrice") {
    return (
      record.values[fieldCode] ??
      record.values.MKT_PRICE ??
      record.values[fieldId] ??
      "—"
    );
  }
  return record.values[fieldCode] ?? record.values[fieldId] ?? "—";
}

function persistedMarketState(
  value: string | undefined,
): MarketCollectionRow["state"] {
  if (value === "已审核" || value === "已核定" || value === "APPROVED")
    return "已核定";
  if (value === "已退回" || value === "RETURNED") return "需补充";
  if (value === "草稿" || value === "DRAFT") return "填写中";
  return "待审核";
}

function objectTypeForWork(item: BusinessWorkItem): MarketBusinessObjectTypeId {
  const task = marketTasks.find(({ workId }) => workId === item.workId);
  const storedType =
    item.subject.kind === "monitoring-object"
      ? item.subject.objectTypeId
      : "trader";
  return normalizeMarketObjectType(storedType, task?.role);
}

function fieldHeader(field: ApplicableBusinessField) {
  const scopeHint =
    field.id === "purchasePrice" || field.id === "salesPrice"
      ? "未含车板、包装、运费"
      : field.id === "transactionPrice"
        ? "含车板、包装、运费"
        : undefined;
  return (
    <>
      {field.label}
      {field.unit && (
        <>
          <br />
          <small>{field.unit}</small>
        </>
      )}
      {scopeHint && (
        <>
          <br />
          <small>{scopeHint}</small>
        </>
      )}
    </>
  );
}

function submittedAtValue(workId: string): string {
  const value =
    marketDocumentFixtures.find((candidate) => candidate.workId === workId)
      ?.lastSavedLabel ?? "尚未填报";
  return value.replace(/^今天\s+/u, "2026 年 7 月 31 日 ");
}

function businessRegionLabel(item: BusinessWorkItem): string {
  if (item.subject.kind !== "monitoring-object") return item.regionLabel;
  const objectName = item.subject.objectName;
  const namedCounty = enterpriseRegionHierarchy.find(
    ({ label, level }) => level === "county" && objectName.includes(label),
  );
  return namedCounty?.label ?? item.regionLabel;
}

function businessState(item: BusinessWorkItem): MarketCollectionRow["state"] {
  if (item.reviewStatus === "approved" && item.qualityStatus === "passed")
    return "已核定";
  if (item.reviewStatus === "returned" || item.qualityStatus === "blocking")
    return "需补充";
  if (item.documentStatus === "draft") return "填写中";
  return "待审核";
}

function businessDate(item: BusinessWorkItem | undefined): string {
  if (!item) return "当前监测期";
  const date = new Date(item.deadline);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function ProductMarketCollectionWorkspace({
  section,
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
  section: MarketSection;
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
  const context = requiredContext(section);
  const productCode =
    context.productId === "corn"
      ? "CORN"
      : context.productId === "soybean"
        ? "SOYBEAN"
        : "RICE";
  const [objectType, setObjectType] = useState<"" | MarketBusinessObjectTypeId>(
    "",
  );
  const [state, setState] = useState("");
  const [lowerRegion, setLowerRegion] = useState<RegionCascadeValue>({});
  const defaultCollectionDate =
    workItems
      .find(
        (item) =>
          item.domain === "market" &&
          item.businessSubtypeId !== "market.logistics" &&
          item.productId === context.productId,
      )
      ?.deadline.slice(0, 10) ?? "";
  const [collectionDate, setCollectionDate] = useState(defaultCollectionDate);
  const [persistedRecords, setPersistedRecords] = useState<
    readonly BusinessRecordListItem[]
  >([]);
  const [recordsLoading, setRecordsLoading] = useState(
    realtimeRepository !== undefined,
  );
  const [recordsError, setRecordsError] = useState("");
  const [marketDefinition, setMarketDefinition] =
    useState<MarketDefinition | null>(null);
  const [recordsRevision, setRecordsRevision] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const scopedRegion = pathValue(
    getEnterpriseRegionPath(scope.coordinates.regionId),
  );
  const governedRegion: RegionCascadeValue = scopedRegion.cityId
    ? scopedRegion
    : {};
  const regionValue: RegionCascadeValue = {
    ...governedRegion,
    ...(governedRegion.countyId === lowerRegion.countyId ? lowerRegion : {}),
  };
  const activeRegionId = selectedRegionId(regionValue);
  const authorizedCultivars = getApplicableCultivars(context.productId).filter(
    ({ id }) => scope.authorization.authorizedCultivarIds.includes(id),
  );
  const productItems = workItems.filter(
    (item) =>
      queryAllowed &&
      item.domain === "market" &&
      item.businessSubtypeId !== "market.logistics" &&
      item.productId === context.productId &&
      (!collectionDate || item.deadline.slice(0, 10) === collectionDate) &&
      regionContains(activeRegionId, itemLocationRegionId(item)) &&
      (!scope.coordinates.periodKey ||
        item.periodKey === scope.coordinates.periodKey) &&
      (!scope.coordinates.cultivarId ||
        item.cultivarIds.includes(scope.coordinates.cultivarId)),
  );
  const fixtureRows: readonly MarketCollectionRow[] = productItems.map(
    (item, index) => {
      const subject = item.subject;
      const itemObjectTypeId = objectTypeForWork(item);
      const itemObjectType =
        getMarketObjectTypeOptions(context.productId).find(
          ({ id }) => id === itemObjectTypeId,
        )?.label ?? item.businessLabel;
      const capabilityFields = getMarketCapabilityGroups(
        context.productId,
        itemObjectTypeId,
      ).flatMap(({ fields }) => fields);
      return {
        rowId: item.workId,
        workId: item.workId,
        number: index + 1,
        collectionDate: item.deadline.slice(0, 10),
        submittedAt: submittedAtValue(item.workId),
        subject:
          subject.kind === "monitoring-object"
            ? subject.objectName
            : "监测对象待维护",
        objectType: itemObjectType,
        objectTypeId: itemObjectTypeId,
        county: businessRegionLabel(item),
        cultivar:
          fieldValue(item.workId, "cultivar") !== "—"
            ? fieldValue(item.workId, "cultivar")
            : item.cultivarIds
                .map((id) => marketCultivarNames[id] ?? id)
                .join("、") || "不按具体品种拆分",
        purchasePrice: fieldValue(item.workId, "quote"),
        transactionPrice: fieldValue(item.workId, "transactionPrice"),
        salesPrice: salesPriceValue(item.workId),
        moisture: fieldValue(item.workId, "moisture"),
        testWeight: fieldValue(item.workId, "testWeight"),
        mildew: fieldValue(item.workId, "mildew"),
        inventory: inventoryValue(item.workId),
        transactionVolume: fieldValue(item.workId, "tradeVolume"),
        salesVolume: fieldValue(item.workId, "salesVolume"),
        state: businessState(item),
        values: Object.fromEntries(
          capabilityFields.map(({ id }) => [id, marketValue(item.workId, id)]),
        ),
      };
    },
  );
  useEffect(() => {
    if (!realtimeRepository) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setRecordsLoading(true);
      setRecordsError("");
    });
    const productCode =
      context.productId === "corn"
        ? "CORN"
        : context.productId === "soybean"
          ? "SOYBEAN"
          : "RICE";
    void realtimeRepository
      .listMarket({ productCode, pageSize: 100 })
      .then((page) => {
        if (!cancelled) setPersistedRecords(page.items);
      })
      .catch(() => {
        if (!cancelled) {
          setPersistedRecords([]);
          setRecordsError("当前市场采集记录暂时无法读取，请稍后重试。");
        }
      })
      .finally(() => {
        if (!cancelled) setRecordsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    context.productId,
    realtimeRefreshToken,
    realtimeRepository,
    recordsRevision,
  ]);

  const persistedRows: readonly MarketCollectionRow[] = persistedRecords.map(
    (record, index) => {
      const rawObjectType = record.values.MKT_OBJECT_TYPE ?? "TRADER";
      const itemObjectTypeId = normalizeMarketObjectType(
        rawObjectType.toLowerCase().replaceAll("_", "-"),
      );
      return {
        rowId: record.id,
        workId: record.id,
        number: index + 1,
        collectionDate: record.values.MKT_TRADE_DATE ?? "—",
        submittedAt: record.values.MKT_REPORTED_AT ?? "尚未填报",
        subject:
          record.values.MKT_SAMPLE_NAME ??
          record.values.MKT_SUBJECT_NAME ??
          record.values.MKT_OBJECT_NAME ??
          rawObjectType,
        objectType:
          getMarketObjectTypeOptions(context.productId).find(
            ({ id }) => id === itemObjectTypeId,
          )?.label ?? rawObjectType,
        objectTypeId: itemObjectTypeId,
        county: record.values.MKT_REGION ?? "—",
        cultivar:
          record.values.MKT_CULTIVAR_NAME ?? record.values.MKT_CULTIVAR ?? "—",
        purchasePrice: persistedMarketValue(record, "purchasePrice"),
        transactionPrice: persistedMarketValue(record, "transactionPrice"),
        salesPrice: persistedMarketValue(record, "salesPrice"),
        moisture: persistedMarketValue(record, "moisture"),
        testWeight: persistedMarketValue(record, "testWeight"),
        mildew: persistedMarketValue(record, "mildew"),
        inventory: persistedMarketValue(record, "inventory"),
        transactionVolume: persistedMarketValue(record, "transactionVolume"),
        salesVolume: persistedMarketValue(record, "salesVolume"),
        state: persistedMarketState(record.values.MKT_STATUS),
        values: record.values,
      };
    },
  );
  const allRows = realtimeRepository ? persistedRows : fixtureRows;
  const rows = allRows
    .filter((row) => !objectType || row.objectTypeId === objectType)
    .filter((row) => !state || row.state === state);
  const objectTypes = getMarketObjectTypeOptions(context.productId);
  const sourceItem = productItems[0];
  const selectedItem =
    selection?.type === "work-item"
      ? productItems.find(({ workId }) => workId === selection.id)
      : undefined;
  const selectedDocument = selectedItem
    ? marketDocumentFixtures.find(
        ({ workId }) => workId === selectedItem.workId,
      )
    : undefined;
  const completedFields = productItems.reduce(
    (sum, item) => sum + item.completedFields,
    0,
  );
  const missingFields = productItems.reduce(
    (sum, item) =>
      sum + Math.max(0, item.applicableFields - item.completedFields),
    0,
  );
  const abnormalRows = productItems.filter(
    (item) => item.qualityStatus !== "passed",
  ).length;
  const displayedObjectType: MarketBusinessObjectTypeId =
    objectType || rows[0]?.objectTypeId || objectTypes[0]?.id || "trader";
  useEffect(() => {
    if (!realtimeRepository) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setMarketDefinition(null);
    });
    const productCode =
      context.productId === "corn"
        ? "CORN"
        : context.productId === "soybean"
          ? "SOYBEAN"
          : "RICE";
    const objectTypeCode =
      displayedObjectType === "deep-processing" && context.productId === "paddy"
        ? "RICE_MILL"
        : marketObjectTypeCode[displayedObjectType];
    void realtimeRepository
      .loadMarketDefinition(productCode, objectTypeCode)
      .then((definition) => {
        if (!cancelled) setMarketDefinition(definition);
      })
      .catch(() => {
        if (!cancelled) {
          setMarketDefinition(null);
          setRecordsError("当前市场字段规则暂时无法读取，请稍后重试。");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [context.productId, displayedObjectType, realtimeRepository]);
  const displayedGroups =
    realtimeRepository && marketDefinition
      ? marketDefinitionListGroups(marketDefinition)
      : getMarketCapabilityGroups(context.productId, displayedObjectType);
  const displayedFields = displayedGroups.flatMap(({ fields }) => fields);

  const importRecords = async (file: File | undefined) => {
    if (!file || !realtimeRepository?.importMarketWorkbook) return;
    setImporting(true);
    setRecordsError("");
    setImportMessage("");
    try {
      const productCode =
        context.productId === "corn"
          ? "CORN"
          : context.productId === "soybean"
            ? "SOYBEAN"
            : "RICE";
      const objectTypeCode = marketObjectTypeCode[displayedObjectType];
      const job = await realtimeRepository.importMarketWorkbook(
        file,
        productCode,
        objectTypeCode,
      );
      setImportMessage(
        `导入完成：成功 ${job.importedRows} 条，失败 ${job.failedRows} 条。`,
      );
      setRecordsRevision((value) => value + 1);
    } catch {
      setRecordsError("市场采集记录导入失败，请核对文件内容后重试。");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = async () => {
    if (!realtimeRepository?.downloadMarketXlsxTemplate) return;
    setRecordsError("");
    try {
      const productCode =
        context.productId === "corn"
          ? "CORN"
          : context.productId === "soybean"
            ? "SOYBEAN"
            : "RICE";
      const objectTypeCode = marketObjectTypeCode[displayedObjectType];
      const blob = await realtimeRepository.downloadMarketXlsxTemplate(
        productCode,
        objectTypeCode,
      );
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `${context.productLabel}市场-${objectTypeCode}-批量导入模板.xlsx`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch {
      setRecordsError("XLSX 模板下载失败，请稍后重试。");
    }
  };

  return (
    <div className="enterprise-ledger-workbench">
      <div className="enterprise-ledger-workbench__breadcrumb">
        市场监测 / {context.productLabel}市场采集
      </div>

      <section
        aria-label={`${context.productLabel}市场查询条件`}
        className="enterprise-ledger-query enterprise-ledger-query--market"
        role="search"
      >
        <label>
          <span>采集日期</span>
          <input
            aria-label="采集日期"
            value={collectionDate}
            onChange={(event) => setCollectionDate(event.target.value)}
            type="date"
          />
        </label>
        <RegionCascadeSelector
          authorizedRegionIds={scope.authorization.authorizedRegionIds}
          maxLevel="village"
          value={regionValue}
          onChange={(value) => {
            setLowerRegion(value);
            onScopeChange({ regionId: scopeRegionId(value) });
          }}
        />
        <label>
          <span>监测批次</span>
          <select
            aria-label="监测批次"
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
        <label>
          <span>对象类型</span>
          <select
            aria-label="对象类型"
            value={objectType}
            onChange={(event) =>
              setObjectType(
                event.target.value as "" | MarketBusinessObjectTypeId,
              )
            }
          >
            <option value="">全部适用对象</option>
            {objectTypes.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>具体品种</span>
          <select
            aria-label="具体品种"
            value={scope.coordinates.cultivarId ?? ""}
            onChange={(event) =>
              onScopeChange({ cultivarId: event.target.value || undefined })
            }
          >
            <option value="">全部{context.productLabel}品种</option>
            {authorizedCultivars.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>填报状态</span>
          <select
            aria-label="填报状态"
            value={state}
            onChange={(event) => setState(event.target.value)}
          >
            <option value="">全部状态</option>
            <option value="填写中">填写中</option>
            <option value="待审核">待审核</option>
            <option value="已核定">已核定</option>
            <option value="需补充">需补充</option>
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
              setObjectType("");
              setState("");
              setCollectionDate(defaultCollectionDate);
              setLowerRegion({});
              onScopeChange({
                regionId: "authorized-all",
                periodKey: undefined,
                cultivarId: undefined,
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

      {importMessage && (
        <div className="market-task6-alert" role="status">
          {importMessage}
        </div>
      )}

      <header className="enterprise-ledger-title">
        <h1>{context.productLabel}市场采集表</h1>
        <p>当前业务对象 · {businessDate(sourceItem)} · 当前授权地区</p>
      </header>

      <section
        className="enterprise-ledger-table enterprise-ledger-table--market"
        aria-label={`${context.productLabel}市场采集表区域`}
      >
        <div className="enterprise-ledger-table__toolbar">
          <strong>
            {recordsLoading
              ? "正在读取市场采集记录"
              : `共 ${rows.length} 个采集对象，当前显示 ${rows.length > 0 ? 1 : 0}–${rows.length}`}
          </strong>
          <div>
            {realtimeRepository && (
              <>
                <button
                  disabled={
                    importing || !realtimeRepository.downloadMarketXlsxTemplate
                  }
                  type="button"
                  onClick={() => void downloadTemplate()}
                >
                  下载 XLSX 模板
                </button>
                <label className="realtime-business-file-action">
                  {importing ? "正在导入" : "批量导入 XLSX"}
                  <input
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    aria-label="批量导入市场采集记录"
                    disabled={
                      importing || !realtimeRepository.importMarketWorkbook
                    }
                    type="file"
                    onChange={(event) => {
                      void importRecords(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
              </>
            )}
            <button type="button" onClick={() => onCreateRecord?.(productCode)}>
              新建采集记录
            </button>
          </div>
        </div>
        <div className="enterprise-ledger-table__scroll" tabIndex={0}>
          <table aria-label={`${context.productLabel}市场采集表`}>
            <thead>
              <tr>
                <th rowSpan={2}>序号</th>
                <th rowSpan={2}>采集日期</th>
                <th rowSpan={2}>填报日期</th>
                <th rowSpan={2}>采集对象</th>
                <th rowSpan={2}>对象类型</th>
                <th rowSpan={2}>行政区划</th>
                <th rowSpan={2}>具体品种</th>
                {displayedGroups.map((group) => (
                  <th colSpan={group.fields.length} key={group.id}>
                    {group.label}
                  </th>
                ))}
                <th rowSpan={2}>填报状态</th>
                <th rowSpan={2}>操作</th>
              </tr>
              <tr>
                {displayedFields.map((field) => (
                  <th aria-label={field.label} key={field.id}>
                    {fieldHeader(field)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.rowId}>
                  <td>{row.number}</td>
                  <td>{row.collectionDate}</td>
                  <td>{row.submittedAt}</td>
                  <th scope="row">{row.subject}</th>
                  <td>{row.objectType}</td>
                  <td>{row.county}</td>
                  <td>{row.cultivar}</td>
                  {displayedFields.map(({ id }) => (
                    <td className="is-operational" key={id}>
                      {row.values[id] ?? "—"}
                    </td>
                  ))}
                  <td>
                    <span className={`enterprise-ledger-state is-${row.state}`}>
                      {row.state}
                    </span>
                  </td>
                  <td>
                    <button
                      className="enterprise-ledger-row-action"
                      type="button"
                      onClick={() =>
                        onSelectionChange({ type: "work-item", id: row.workId })
                      }
                    >
                      查看
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    className="enterprise-ledger-table__empty"
                    colSpan={9 + displayedFields.length}
                  >
                    当前范围暂无{context.productLabel}市场采集记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer>
          <span>
            本页已填 {completedFields} 项，缺失 {missingFields} 项，异常{" "}
            {abnormalRows} 项
          </span>
          <nav aria-label="采集表分页">
            <button type="button">‹</button>
            <button className="is-current" type="button">
              1
            </button>
            <button type="button">›</button>
          </nav>
        </footer>
      </section>

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
