import { useEffect, useMemo, useState } from "react";

import type {
  BusinessRecordListItem,
  MarketDefinition,
  MasterObjectType,
  ProductionImportJob,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";

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
import { BusinessImportStatus } from "../importing/BusinessImportStatus";
import {
  awaitBusinessImport,
  awaitImportJob,
  saveImportErrorFile,
} from "../importing/businessImportWorkflow";
import { RealtimeRegionFilterSelect } from "../realtime/RealtimeRegionFilterSelect";
import {
  annualSampleStatusNote,
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
import { MarketReturnedCorrectionStatus } from "./MarketReturnedCorrectionStatus";
import { ExistingSampleObservationPanel } from "../formal-sample/ExistingSampleObservationPanel";
import {
  mergeObservationFields,
  observationFields,
  type ObservationField,
} from "../formal-sample/formalSampleObservationFields";

const collectionPageSize = 20;

const marketStatusCodeByLabel: Readonly<Record<string, string>> = {
  填写中: "DRAFT",
  待审核: "PENDING_REVIEW",
  已核定: "APPROVED",
  需补充: "RETURNED",
  已作废: "VOIDED",
};

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
  reporter: string;
  surveyor: string;
  surveyorPhone: string;
  sampleContact: string;
  latitude: string;
  longitude: string;
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
  state: "待审核" | "已核定" | "需补充" | "填写中" | "已作废";
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
  salesPrice: "MKT_SALE_BASE_PRICE",
  purchaseVolume: "PURCHASE_VOLUME",
  salesVolume: "SALES_VOLUME",
  inventory: "ENDING_INVENTORY",
  inventoryLocation: "MKT_STORAGE_REGION_CODE",
  transactionVolume: "PURCHASE_VOLUME",
  moisture: "MOISTURE",
  testWeight: "TEST_WEIGHT",
  toxin: "TOXIN",
  impurity: "IMPURITY",
  imperfectGrain: "IMPERFECT_GRAIN",
  mildew: "MILDEW",
  protein: "PROTEIN",
  oilYield: "OIL_YIELD",
  milledRiceRate: "MILLING_YIELD",
  brownRiceRate: "BROWN_RICE_YIELD",
  wagonPrice: "MKT_CARRIAGE_BOARD_AMOUNT",
  freight: "MKT_FREIGHT_AMOUNT",
  packaging: "MKT_PACKAGING_FORM",
};

const marketObjectTypeCode: Readonly<
  Record<MarketBusinessObjectTypeId, string>
> = {
  trader: "TRADER",
  "deep-processing": "DEEP_PROCESSOR",
  "rice-mill": "RICE_MILL",
  "breeding-farm": "BREEDING_FACTORY",
  "feed-mill": "FEED_MILL",
  "wholesale-market": "WHOLESALE_MARKET",
  "reserve-storage": "RESERVE_ENTERPRISE",
};

const marketObjectTypeIdByCode: Readonly<
  Record<string, MarketBusinessObjectTypeId>
> = {
  TRADER: "trader",
  DEEP_PROCESSOR: "deep-processing",
  RICE_MILL: "rice-mill",
  BREEDING_FACTORY: "breeding-farm",
  FEED_MILL: "feed-mill",
  WHOLESALE_MARKET: "wholesale-market",
  RESERVE_ENTERPRISE: "reserve-storage",
};

function formalMarketObjectTypeOptions(types: readonly MasterObjectType[]) {
  return types.flatMap(({ code, name }) => {
    const id = marketObjectTypeIdByCode[code];
    return id ? [{ id, label: name }] : [];
  });
}

function formalMarketObjectTypeCode(
  storedValue: string,
  options: readonly { id: MarketBusinessObjectTypeId; label: string }[],
): string | undefined {
  if (marketObjectTypeIdByCode[storedValue]) return storedValue;
  const matched = options.find(({ label }) => label === storedValue);
  return matched ? marketObjectTypeCode[matched.id] : undefined;
}

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
  if (
    value === "已退回" ||
    value === "退回补充" ||
    value === "需补充" ||
    value === "RETURNED"
  )
    return "需补充";
  if (value === "草稿" || value === "DRAFT") return "填写中";
  if (value === "已作废" || value === "VOIDED") return "已作废";
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

type LedgerDisplayField = Pick<ObservationField, "code" | "label" | "unit">;

function fieldHeader(field: LedgerDisplayField) {
  const fieldCode = field.code;
  const scopeHint =
    fieldCode === "purchasePrice" ||
    fieldCode === "salesPrice" ||
    fieldCode === "MKT_PURCHASE_BASE_PRICE" ||
    fieldCode === "MKT_SALE_BASE_PRICE"
      ? "未含车板、包装、运费"
      : fieldCode === "transactionPrice"
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
  section: MarketSection;
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
  const context = requiredContext(section);
  const productCode =
    context.productId === "corn"
      ? "CORN"
      : context.productId === "soybean"
        ? "SOYBEAN"
        : "RICE";
  const [objectTypeSelection, setObjectTypeSelection] = useState<{
    productId: ProductWorkspaceContext["productId"];
    repository: RealtimeBusinessRepository | undefined;
    value: "" | MarketBusinessObjectTypeId;
  }>(() => ({
    productId: context.productId,
    repository: realtimeRepository,
    value: "",
  }));
  const objectType =
    objectTypeSelection.productId === context.productId &&
    objectTypeSelection.repository === realtimeRepository
      ? objectTypeSelection.value
      : "";
  const setObjectType = (value: "" | MarketBusinessObjectTypeId) => {
    setObjectTypeSelection({
      productId: context.productId,
      repository: realtimeRepository,
      value,
    });
  };
  const [state, setState] = useState("");
  const [lowerRegion, setLowerRegion] = useState<RegionCascadeValue>({});
  const [realtimeRegionCode, setRealtimeRegionCode] = useState("");
  const [surveyYear, setSurveyYear] = useState(currentSurveyYear);
  const [surveyMonth, setSurveyMonth] = useState("");
  const [persistedRecords, setPersistedRecords] = useState<
    readonly BusinessRecordListItem[]
  >([]);
  const [pageNumber, setPageNumber] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [recordsLoading, setRecordsLoading] = useState(
    realtimeRepository !== undefined,
  );
  const [recordsError, setRecordsError] = useState("");
  const [formalObjectTypeSnapshot, setFormalObjectTypeSnapshot] = useState<{
    productCode: string;
    repository: RealtimeBusinessRepository;
    values: readonly { id: MarketBusinessObjectTypeId; label: string }[];
  } | null>(null);
  const [ledgerDefinitions, setLedgerDefinitions] = useState<
    readonly MarketDefinition[]
  >([]);
  const [recordsRevision, setRecordsRevision] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importJob, setImportJob] = useState<ProductionImportJob | null>(null);
  const [importPhotos, setImportPhotos] = useState<readonly File[]>([]);
  const [correcting, setCorrecting] = useState(false);
  const [correctionJob, setCorrectionJob] =
    useState<ProductionImportJob | null>(null);
  const { masterData, masterDataError } =
    useRealtimeMasterData(realtimeRepository);
  const usesFormalObjectTypes =
    realtimeRepository &&
    typeof realtimeRepository.listObjectTypes === "function";
  const objectTypes = useMemo(
    () =>
      !usesFormalObjectTypes
        ? getMarketObjectTypeOptions(context.productId)
        : formalObjectTypeSnapshot?.productCode === productCode &&
            formalObjectTypeSnapshot.repository === realtimeRepository
          ? formalObjectTypeSnapshot.values
          : [],
    [
      context.productId,
      formalObjectTypeSnapshot,
      productCode,
      realtimeRepository,
      usesFormalObjectTypes,
    ],
  );
  useEffect(() => {
    if (!realtimeRepository?.listObjectTypes) return;
    let cancelled = false;
    void realtimeRepository
      .listObjectTypes(productCode, "MARKET")
      .then((types) => {
        if (!cancelled)
          setFormalObjectTypeSnapshot({
            productCode,
            repository: realtimeRepository,
            values: formalMarketObjectTypeOptions(types),
          });
      })
      .catch(() => {
        if (!cancelled) {
          setFormalObjectTypeSnapshot({
            productCode,
            repository: realtimeRepository,
            values: [],
          });
          setRecordsError("当前产品对象类型暂时无法读取，请稍后重试。");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [productCode, realtimeRepository]);
  useEffect(() => {
    if (!realtimeRepository?.loadMarketDefinition) return;
    const recordTypeCodes = persistedRecords
      .map(({ values }) =>
        values.MKT_OBJECT_TYPE
          ? formalMarketObjectTypeCode(values.MKT_OBJECT_TYPE, objectTypes)
          : undefined,
      )
      .filter((code): code is string => Boolean(code));
    const requestedTypeCodes = [
      ...(objectType ? [marketObjectTypeCode[objectType]] : []),
      ...recordTypeCodes,
    ];
    const uniqueTypeCodes = [...new Set(requestedTypeCodes)];
    if (uniqueTypeCodes.length === 0) {
      queueMicrotask(() => setLedgerDefinitions([]));
      return;
    }
    let cancelled = false;
    void Promise.all(
      uniqueTypeCodes.map((typeCode) =>
        realtimeRepository.loadMarketDefinition(productCode, typeCode),
      ),
    )
      .then((definitions) => {
        if (!cancelled) setLedgerDefinitions(definitions);
      })
      .catch(() => {
        if (!cancelled) {
          setLedgerDefinitions([]);
          setRecordsError(
            "市场业务字段定义读取失败，请稍后重试，系统未使用旧字段口径。",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    objectType,
    objectTypes,
    persistedRecords,
    productCode,
    realtimeRepository,
  ]);
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
  const productItems = workItems.filter(
    (item) =>
      queryAllowed &&
      item.domain === "market" &&
      item.businessSubtypeId !== "market.logistics" &&
      item.productId === context.productId &&
      matchesSurveyPeriod(
        item.deadline.slice(0, 10),
        surveyYear,
        surveyMonth,
      ) &&
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
        collectionDate: formatSurveyPeriodFromDate(item.deadline.slice(0, 10)),
        submittedAt: submittedAtValue(item.workId),
        subject:
          subject.kind === "monitoring-object"
            ? subject.objectName
            : "监测对象未提供",
        objectType: itemObjectType,
        objectTypeId: itemObjectTypeId,
        county: businessRegionLabel(item),
        reporter: fieldValue(item.workId, "reporter"),
        surveyor: fieldValue(item.workId, "surveyor"),
        surveyorPhone: fieldValue(item.workId, "surveyorPhone"),
        sampleContact: fieldValue(item.workId, "sampleContact"),
        latitude: fieldValue(item.workId, "latitude"),
        longitude: fieldValue(item.workId, "longitude"),
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
      .listMarket({
        productCode,
        page: pageNumber,
        pageSize: collectionPageSize,
        filters: {
          regionCode: realtimeRegionCode || undefined,
          surveyYear,
          surveyMonth: surveyMonth || undefined,
          objectTypeCode: objectType
            ? marketObjectTypeCode[objectType]
            : undefined,
          status: state ? marketStatusCodeByLabel[state] : undefined,
        },
      })
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
    objectType,
    pageNumber,
    realtimeRefreshToken,
    realtimeRegionCode,
    realtimeRepository,
    recordsRevision,
    state,
    surveyMonth,
    surveyYear,
  ]);

  const persistedRows: readonly MarketCollectionRow[] = persistedRecords.map(
    (record, index) => {
      const rawObjectType = record.values.MKT_OBJECT_TYPE ?? "TRADER";
      const formalObjectType = objectTypes.find(
        ({ id, label }) =>
          label === rawObjectType || marketObjectTypeCode[id] === rawObjectType,
      );
      const itemObjectTypeId =
        formalObjectType?.id ??
        marketObjectTypeIdByCode[rawObjectType] ??
        normalizeMarketObjectType(
          rawObjectType.toLowerCase().replaceAll("_", "-"),
        );
      return {
        rowId: record.id,
        workId: record.id,
        number: pageNumber * collectionPageSize + index + 1,
        collectionDate: formatExplicitSurveyPeriod(
          record.values,
          "MKT",
          "MKT_TRADE_DATE",
        ),
        submittedAt: formatRealFillingTime(record.values, "MKT"),
        subject:
          record.values.MKT_SAMPLE_NAME ??
          record.values.MKT_SUBJECT_NAME ??
          record.values.MKT_OBJECT_NAME ??
          rawObjectType,
        objectType:
          formalObjectType?.label ??
          getMarketObjectTypeOptions(context.productId).find(
            ({ id }) => id === itemObjectTypeId,
          )?.label ??
          rawObjectType,
        objectTypeId: itemObjectTypeId,
        county: record.values.MKT_REGION ?? "—",
        reporter: record.values.MKT_REPORTER_NAME ?? "—",
        surveyor: record.values.MKT_SURVEYOR_NAME ?? "—",
        surveyorPhone: record.values.MKT_SURVEYOR_PHONE ?? "—",
        sampleContact: record.values.MKT_SAMPLE_CONTACT ?? "—",
        latitude: record.values.MKT_SAMPLE_LATITUDE ?? "—",
        longitude: record.values.MKT_SAMPLE_LONGITUDE ?? "—",
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
  const filteredRows = allRows
    .filter(
      (row) =>
        realtimeRepository || !objectType || row.objectTypeId === objectType,
    )
    .filter((row) => realtimeRepository || !state || row.state === state);
  const pageCount = realtimeRepository
    ? serverTotalPages
    : Math.max(1, Math.ceil(filteredRows.length / collectionPageSize));
  const currentPageNumber = Math.min(pageNumber, pageCount - 1);
  const rows = realtimeRepository
    ? filteredRows
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
  const formalLedgerFields = mergeObservationFields(
    ledgerDefinitions.map((definition) =>
      observationFields("MARKET", definition),
    ),
  );
  const displayedGroups: readonly {
    id: string;
    label: string;
    fields: readonly LedgerDisplayField[];
  }[] = realtimeRepository
    ? [...new Set(formalLedgerFields.map(({ section }) => section))].map(
        (section) => ({
          id: section,
          label: section,
          fields: formalLedgerFields.filter(
            (field) => field.section === section,
          ),
        }),
      )
    : getMarketCapabilityGroups(context.productId, displayedObjectType).map(
        (group) => ({
          ...group,
          fields: group.fields.map((field) => ({
            code: field.id,
            label: field.label,
            unit: field.unit ?? null,
          })),
        }),
      );
  const displayedFields = displayedGroups.flatMap(({ fields }) => fields);

  const importRecords = async (file: File | undefined) => {
    if (!file || !realtimeRepository?.importMarketWorkbook) return;
    setImporting(true);
    setRecordsError("");
    setImportJob(null);
    try {
      const productCode =
        context.productId === "corn"
          ? "CORN"
          : context.productId === "soybean"
            ? "SOYBEAN"
            : "RICE";
      const objectTypeCode = marketObjectTypeCode[displayedObjectType];
      const initial = await realtimeRepository.importMarketWorkbook(
        file,
        productCode,
        objectTypeCode,
        importPhotos,
      );
      const terminal = await awaitBusinessImport({
        repository: realtimeRepository,
        domain: "market",
        initial,
        onUpdate: setImportJob,
      });
      if (terminal.statusCode !== "FAILED") {
        setImportPhotos([]);
        setPageNumber(0);
        setRecordsRevision((value) => value + 1);
      }
    } catch (reason) {
      setRecordsError(
        reason instanceof RealtimeApiError && reason.clientMessage
          ? reason.clientMessage
          : "市场采集记录导入失败，请核对文件内容后重试。",
      );
    } finally {
      setImporting(false);
    }
  };

  const retryImport = async () => {
    if (!realtimeRepository?.retryImportJob || !importJob) return;
    setImporting(true);
    setRecordsError("");
    try {
      const initial = await realtimeRepository.retryImportJob(
        "market",
        importJob.id,
      );
      const terminal = await awaitBusinessImport({
        repository: realtimeRepository,
        domain: "market",
        initial,
        onUpdate: setImportJob,
      });
      if (terminal.statusCode !== "FAILED") {
        setPageNumber(0);
        setRecordsRevision((value) => value + 1);
      }
    } catch (reason) {
      setRecordsError(
        reason instanceof RealtimeApiError && reason.clientMessage
          ? reason.clientMessage
          : "市场导入任务重试失败，请稍后重试。",
      );
    } finally {
      setImporting(false);
    }
  };

  const downloadImportErrors = async () => {
    if (!realtimeRepository?.downloadImportErrors || !importJob) return;
    setRecordsError("");
    try {
      saveImportErrorFile(
        await realtimeRepository.downloadImportErrors("market", importJob.id),
        "market",
        importJob.id,
      );
    } catch {
      setRecordsError("市场导入错误清单下载失败，请稍后重试。");
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
      anchor.download = `市场-${context.productLabel}-批量导入模板.xlsx`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch {
      setRecordsError("XLSX 模板下载失败，请稍后重试。");
    }
  };

  const downloadReturnedCorrectionWorkbook = async () => {
    if (!realtimeRepository?.downloadMarketReturnedCorrectionWorkbook) return;
    setRecordsError("");
    try {
      const blob =
        await realtimeRepository.downloadMarketReturnedCorrectionWorkbook(
          productCode,
        );
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `${context.productLabel}市场退回记录修正表.xlsx`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (reason) {
      setRecordsError(
        reason instanceof RealtimeApiError && reason.clientMessage
          ? reason.clientMessage
          : "退回记录修正表下载失败，请稍后重试。",
      );
    }
  };

  const correctReturnedRecords = async (file: File | undefined) => {
    if (!file || !realtimeRepository?.importMarketReturnedCorrectionWorkbook)
      return;
    setCorrecting(true);
    setRecordsError("");
    setCorrectionJob(null);
    try {
      const initial =
        await realtimeRepository.importMarketReturnedCorrectionWorkbook(
          file,
          productCode,
        );
      const terminal = await awaitImportJob({
        initial,
        onUpdate: setCorrectionJob,
        loadJob: realtimeRepository.getMarketReturnedCorrectionJob
          ? (importJobId) =>
              realtimeRepository.getMarketReturnedCorrectionJob!(importJobId)
          : undefined,
      });
      if (terminal.statusCode !== "FAILED") {
        setPageNumber(0);
        setRecordsRevision((value) => value + 1);
      }
    } catch (reason) {
      setRecordsError(
        reason instanceof RealtimeApiError && reason.clientMessage
          ? reason.clientMessage
          : "退回记录批量修正失败，请重新核对并下载最新修正表。",
      );
    } finally {
      setCorrecting(false);
    }
  };

  const downloadReturnedCorrectionErrors = async () => {
    if (
      !realtimeRepository?.downloadMarketReturnedCorrectionErrors ||
      !correctionJob
    )
      return;
    setRecordsError("");
    try {
      const blob =
        await realtimeRepository.downloadMarketReturnedCorrectionErrors(
          correctionJob.id,
        );
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `${context.productLabel}市场退回记录修正错误清单.csv`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch {
      setRecordsError("修正错误清单下载失败，请稍后重试。");
    }
  };

  return (
    <div className="enterprise-ledger-workbench">
      <div className="enterprise-ledger-workbench__breadcrumb">
        市场监测 / {context.productLabel}市场采集
      </div>
      <ExistingSampleObservationPanel
        domain="MARKET"
        permissions={permissions}
        productCode={productCode}
        repository={realtimeRepository}
        selection={selection}
        onSelectionChange={onSelectionChange}
        onSelectionClear={onSelectionClear}
        onSaved={() => setRecordsRevision((value) => value + 1)}
      >
        <section
          aria-label={`${context.productLabel}市场查询条件`}
          className="enterprise-ledger-query enterprise-ledger-query--market"
          role="search"
        >
          <label>
            <span>数据年份</span>
            <select
              aria-label="数据年份"
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
            <span>数据月份</span>
            <select
              aria-label="数据月份"
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
              maxLevel="village"
              value={regionValue}
              onChange={(value) => {
                setLowerRegion(value);
                setPageNumber(0);
                onScopeChange({ regionId: scopeRegionId(value) });
              }}
            />
          )}
          {!realtimeRepository && (
            <label>
              <span>监测批次</span>
              <select
                aria-label="监测批次"
                value={scope.coordinates.periodKey ?? ""}
                onChange={(event) => {
                  setPageNumber(0);
                  onScopeChange({ periodKey: event.target.value || undefined });
                }}
              >
                <option value="">全部可用监测期</option>
                {marketTaskPeriods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span>样本点类型</span>
            <select
              aria-label="样本点类型"
              value={objectType}
              onChange={(event) => {
                setPageNumber(0);
                setObjectType(
                  event.target.value as "" | MarketBusinessObjectTypeId,
                );
              }}
            >
              <option value="">全部适用样本点</option>
              {objectTypes.map(({ id, label }) => (
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
              onChange={(event) => {
                setState(event.target.value);
                setPageNumber(0);
              }}
            >
              <option value="">全部状态</option>
              <option value="待审核">待审核</option>
              <option value="已核定">已核定</option>
              <option value="需补充">需补充</option>
              <option value="已作废">已作废</option>
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
                setSurveyYear(currentSurveyYear);
                setSurveyMonth("");
                setLowerRegion({});
                setRealtimeRegionCode("");
                setPageNumber(0);
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
        {masterDataError && (
          <div className="market-task6-alert" role="alert">
            {masterDataError}
          </div>
        )}

        <BusinessImportStatus
          busy={importing}
          className="market-task6-alert"
          job={importJob}
          onDownloadErrors={() => void downloadImportErrors()}
          onRetry={() => void retryImport()}
        />
        <MarketReturnedCorrectionStatus
          busy={correcting}
          className="market-task6-alert"
          job={correctionJob}
          onDownloadErrors={() => void downloadReturnedCorrectionErrors()}
        />

        <header className="enterprise-ledger-title enterprise-ledger-title--collection">
          <h1>{context.productLabel}市场采集表</h1>
          <p>当前业务对象 · {businessDate(sourceItem)} · 当前授权地区</p>
          <p className="enterprise-ledger-title__sample-note">
            {annualSampleStatusNote(surveyYear)}
          </p>
        </header>

        <section
          className="enterprise-ledger-table enterprise-ledger-table--market"
          aria-label={`${context.productLabel}市场采集表区域`}
        >
          <div className="enterprise-ledger-table__toolbar enterprise-ledger-table__toolbar--collection">
            <strong>
              {recordsLoading
                ? "正在读取市场采集记录"
                : `共 ${rows.length} 个样本点，当前显示 ${rows.length > 0 ? 1 : 0}–${rows.length}`}
            </strong>
            <div className="enterprise-ledger-table__actions">
              {realtimeRepository && (
                <>
                  <div
                    aria-label="批量导入"
                    className="enterprise-ledger-action-group"
                    role="group"
                  >
                    <span className="enterprise-ledger-action-group__label">
                      批量导入
                    </span>
                    <button
                      disabled={
                        importing ||
                        !realtimeRepository.downloadMarketXlsxTemplate
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
                    <label className="realtime-business-file-action">
                      随 XLSX 上传照片（{importPhotos.length} 张）
                      <input
                        accept="image/jpeg,image/png"
                        aria-label="附加市场照片"
                        disabled={importing}
                        multiple
                        type="file"
                        onChange={(event) =>
                          setImportPhotos(Array.from(event.target.files ?? []))
                        }
                      />
                    </label>
                  </div>
                  <div
                    aria-label="退回修正"
                    className="enterprise-ledger-action-group"
                    role="group"
                  >
                    <span className="enterprise-ledger-action-group__label">
                      退回修正
                    </span>
                    <button
                      disabled={
                        correcting ||
                        !realtimeRepository.downloadMarketReturnedCorrectionWorkbook
                      }
                      type="button"
                      onClick={() => void downloadReturnedCorrectionWorkbook()}
                    >
                      下载退回记录修正表
                    </button>
                    <label className="realtime-business-file-action">
                      {correcting ? "正在修正" : "批量导入修正结果"}
                      <input
                        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        aria-label="批量导入市场退回修正结果"
                        disabled={
                          correcting ||
                          !realtimeRepository.importMarketReturnedCorrectionWorkbook
                        }
                        type="file"
                        onChange={(event) => {
                          void correctReturnedRecords(event.target.files?.[0]);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </>
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
                  新建采集记录
                </button>
              </div>
            </div>
          </div>
          <div className="enterprise-ledger-table__scroll" tabIndex={0}>
            <table aria-label={`${context.productLabel}市场采集表`}>
              <thead>
                <tr>
                  <th rowSpan={2}>序号</th>
                  <th rowSpan={2}>数据时间</th>
                  <th rowSpan={2}>填报日期</th>
                  <th rowSpan={2}>样本点名称</th>
                  <th rowSpan={2}>样本点类型</th>
                  <th rowSpan={2}>地区</th>
                  <th colSpan={6}>填报与定位</th>
                  {displayedGroups.map((group) => (
                    <th colSpan={group.fields.length} key={group.id}>
                      {group.label}
                    </th>
                  ))}
                  <th rowSpan={2}>填报状态</th>
                  <th rowSpan={2}>操作</th>
                </tr>
                <tr>
                  <th>填报人</th>
                  <th>调研人</th>
                  <th>调研人联系方式</th>
                  <th>样本点联系方式</th>
                  <th>纬度</th>
                  <th>经度</th>
                  {displayedFields.map((field) => (
                    <th
                      aria-label={field.label}
                      data-field-code={field.code}
                      key={field.code}
                    >
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
                    <td>{row.reporter}</td>
                    <td>{row.surveyor}</td>
                    <td>{row.surveyorPhone}</td>
                    <td>{row.sampleContact}</td>
                    <td className="is-operational">{row.latitude}</td>
                    <td className="is-operational">{row.longitude}</td>
                    {displayedFields.map((field) => {
                      const code = field.code;
                      return (
                        <td className="is-operational" key={code}>
                          {row.values[code] ?? "—"}
                        </td>
                      );
                    })}
                    <td>
                      <span
                        className={`enterprise-ledger-state is-${row.state}`}
                      >
                        {row.state}
                      </span>
                    </td>
                    <td>
                      <button
                        className="enterprise-ledger-row-action"
                        type="button"
                        onClick={() => {
                          if (realtimeRepository && onEditRecord) {
                            onEditRecord(productCode, row.workId);
                            return;
                          }
                          onSelectionChange({
                            type: "work-item",
                            id: row.workId,
                          });
                        }}
                      >
                        查看记录
                      </button>
                      <button
                        className="enterprise-ledger-row-action"
                        type="button"
                        onClick={() => {
                          if (realtimeRepository && onEditRecord) {
                            onEditRecord(productCode, row.workId);
                            return;
                          }
                          onSelectionChange({
                            type: "work-item",
                            id: row.workId,
                          });
                        }}
                      >
                        查看照片
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      className="enterprise-ledger-table__empty"
                      colSpan={14 + displayedFields.length}
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

        {!realtimeRepository && selectedItem && selectedDocument && (
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
