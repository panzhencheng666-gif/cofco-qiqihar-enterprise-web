import { useEffect, useMemo, useState } from "react";

import type {
  BusinessRecordListItem,
  MasterObjectType,
  ProductionDefinition,
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
  getGrainQualityFields,
  getProductionObjectTypeOptions,
  normalizeProductionObjectType,
  type ProductionBusinessObjectTypeId,
} from "../core/businessApplicability";
import type { OperationalScope } from "../core/operationalScope";
import { getApplicableCultivars } from "../core/platformMasterData";
import {
  getProductWorkspaceContext,
  type ProductWorkspaceContext,
} from "../core/productWorkspaceContext";
import { businessWorkFixtures } from "../data/businessWorkFixtures";
import {
  getEnterpriseRegionPath,
  type EnterpriseRegionNode,
} from "../data/enterpriseRegionHierarchy";
import { productionDocumentFixtures } from "../data/productionDocumentFixtures";
import {
  createFormalRoute,
  type BusinessCoordinates,
  type FormalSelection,
  type ProductionSection,
} from "../formalEnterpriseModel";
import { productionTaskPeriods } from "../productionMonitoringData";
import {
  ProductionDocumentWorkbench,
  type ProductionDocumentDraft,
} from "./ProductionDocumentWorkbench";
import { BusinessImportStatus } from "../importing/BusinessImportStatus";
import {
  awaitBusinessImport,
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
import { ExistingSampleObservationPanel } from "../formal-sample/ExistingSampleObservationPanel";
import {
  mergeObservationFields,
  observationFields,
} from "../formal-sample/formalSampleObservationFields";

const collectionPageSize = 20;

const aggregateRegionByCity = {
  qiqihar: "qiqihar-all",
  heihe: "heihe-all",
  hulunbuir: "hulunbuir-designated",
} as const;

interface ProductionCollectionRow {
  workId: string;
  samplePointId?: string;
  sampleVersion?: number;
  address: string;
  maintainer: string;
  values: Readonly<Record<string, string>>;
  number: number;
  surveyDate: string;
  subject: string;
  objectType: string;
  objectTypeId: ProductionBusinessObjectTypeId;
  region: string;
  cultivar: string;
  surveyor: string;
  reporter: string;
  surveyorPhone: string;
  subjectContact: string;
  latitude: string;
  longitude: string;
  plantingArea: string;
  harvestArea: string;
  affectedArea: string;
  growth: string;
  stage: string;
  expectedYield: string;
  expectedOutput: string;
  yearOnYear: string;
  moisture: string;
  testWeight: string;
  toxin: string;
  impurity: string;
  imperfectGrain: string;
  mildew: string;
  protein: string;
  oilYield: string;
  milledRiceRate: string;
  brownRiceRate: string;
  openingStock: string;
  sales: string;
  selfUse: string;
  endingStock: string;
  intendedArea: string;
  intentionReason: string;
  landRent: string;
  seedCost: string;
  pesticideCost: string;
  fertilizerCost: string;
  irrigationCost: string;
  laborCost: string;
  machineryCost: string;
  otherCost: string;
  subsidy: string;
  insurance: string;
  sourceDetail: string;
  validation: string;
  lastSaved: string;
  status: string;
}

function requiredContext(section: ProductionSection): ProductWorkspaceContext {
  const context = getProductWorkspaceContext(
    createFormalRoute("production", section),
  );
  if (!context) throw new Error("当前入口不是分品种产情填报入口");
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

function selectedRegionId(value: RegionCascadeValue): string {
  return (
    value.villageId ??
    value.townshipId ??
    value.countyId ??
    value.cityId ??
    "authorized-all"
  );
}

function productionObjectTypeCode(
  objectType: ProductionBusinessObjectTypeId,
): "FARMER" | "VILLAGE_COMMITTEE" | "AGRICULTURAL_TECH_STATION" {
  if (objectType === "farmer") return "FARMER";
  if (objectType === "village-committee") return "VILLAGE_COMMITTEE";
  return "AGRICULTURAL_TECH_STATION";
}

const productionObjectTypeIdByCode: Readonly<
  Record<string, ProductionBusinessObjectTypeId>
> = {
  FARMER: "farmer",
  VILLAGE_COMMITTEE: "village-committee",
  AGRICULTURAL_TECH_STATION: "agri-station",
};

function formalProductionObjectTypeOptions(types: readonly MasterObjectType[]) {
  return types.flatMap(({ code, name }) => {
    const id = productionObjectTypeIdByCode[code];
    return id ? [{ id, label: name }] : [];
  });
}

function formalProductionObjectTypeCode(
  storedValue: string,
  options: readonly {
    id: ProductionBusinessObjectTypeId;
    label: string;
  }[],
): string | undefined {
  if (productionObjectTypeIdByCode[storedValue]) return storedValue;
  const matched = options.find(({ label }) => label === storedValue);
  return matched ? productionObjectTypeCode(matched.id) : undefined;
}

function itemLocationRegionId(item: BusinessWorkItem): string {
  return item.subject.kind === "monitoring-object"
    ? (item.subject.locationRegionId ?? item.regionId)
    : item.regionId;
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

function fieldValue(workId: string, fieldId: string): string {
  return (
    productionDocumentFixtures
      .find((candidate) => candidate.workId === workId)
      ?.fieldGroups.flatMap(({ fields }) => fields)
      .find((field) => field.fieldId === fieldId)?.value ?? "—"
  );
}

function lastSavedValue(workId: string): string {
  return (
    productionDocumentFixtures.find((candidate) => candidate.workId === workId)
      ?.lastSavedLabel ?? "尚未保存"
  );
}

function productionObjectTypeId(
  item: BusinessWorkItem,
): ProductionBusinessObjectTypeId {
  if (item.subject.kind !== "monitoring-object") return "farmer";
  return normalizeProductionObjectType(item.subject.objectTypeId);
}

function productionObjectType(item: BusinessWorkItem): string {
  if (item.subject.kind !== "monitoring-object") return "样本点类型未提供";
  const typeId = productionObjectTypeId(item);
  return (
    getProductionObjectTypeOptions().find(({ id }) => id === typeId)?.label ??
    "样本点类型未提供"
  );
}

function qualityValue(row: ProductionCollectionRow, fieldId: string): string {
  const values: Readonly<Record<string, string>> = {
    moisture: row.moisture,
    testWeight: row.testWeight,
    toxin: row.toxin,
    impurity: row.impurity,
    imperfectGrain: row.imperfectGrain,
    mildew: row.mildew,
    protein: row.protein,
    oilYield: row.oilYield,
    milledRiceRate: row.milledRiceRate,
    brownRiceRate: row.brownRiceRate,
  };
  return values[fieldId] ?? "—";
}

function cleanSubjectName(value: string): string {
  return value
    .replace(/产情调查点$/u, "监测点")
    .replace(/调查片区$/u, "监测点");
}

function collectionStatus(item: BusinessWorkItem): string {
  if (item.qualityStatus === "blocking") return "退回待补充";
  if (item.reviewStatus === "returned") return "审核退回";
  if (item.reviewStatus === "pending" || item.reviewStatus === "reviewing") {
    return "待审核";
  }
  if (item.reviewStatus === "approved" && item.qualityStatus === "passed") {
    return "已核定";
  }
  return "填写中";
}

function persistedProductionStatus(value: string | undefined): string {
  if (value === "已审核" || value === "已核定" || value === "APPROVED")
    return "已核定";
  if (value === "已退回" || value === "RETURNED") return "审核退回";
  if (value === "已作废" || value === "VOIDED") return "已作废";
  if (value === "待审核" || value === "SUBMITTED") return "待审核";
  return "填写中";
}

function persistedValue(
  record: BusinessRecordListItem,
  ...codes: readonly string[]
): string {
  for (const code of codes) {
    const value = record.values[code];
    if (value !== undefined && value !== "") return value;
  }
  return "—";
}

function businessDate(item: BusinessWorkItem | undefined): string {
  if (!item) return "当前调查期";
  const date = new Date(item.deadline);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function ProductProductionCollectionWorkspace({
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
  section: ProductionSection;
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  selection?: FormalSelection;
  onSelectionChange: (selection: FormalSelection) => void;
  onSelectionClear?: () => void;
  queryAllowed: boolean;
  workItems?: readonly BusinessWorkItem[];
  documentDrafts?: Readonly<Record<string, ProductionDocumentDraft>>;
  onDocumentDraftChange?: (
    workId: string,
    draft: ProductionDocumentDraft,
  ) => void;
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
  const [objectType, setObjectType] = useState<
    "" | ProductionBusinessObjectTypeId
  >("");
  const [formalObjectTypeSnapshot, setFormalObjectTypeSnapshot] = useState<{
    productCode: string;
    repository: RealtimeBusinessRepository;
    values: readonly {
      id: ProductionBusinessObjectTypeId;
      label: string;
    }[];
  } | null>(null);
  const usesFormalObjectTypes =
    realtimeRepository &&
    typeof realtimeRepository.listObjectTypes === "function";
  const productionObjectTypes = useMemo(
    () =>
      !usesFormalObjectTypes
        ? getProductionObjectTypeOptions()
        : formalObjectTypeSnapshot?.productCode === productCode &&
            formalObjectTypeSnapshot.repository === realtimeRepository
          ? formalObjectTypeSnapshot.values
          : [],
    [
      formalObjectTypeSnapshot,
      productCode,
      realtimeRepository,
      usesFormalObjectTypes,
    ],
  );
  const importObjectType = objectType || productionObjectTypes[0]?.id || "";
  const [lowerRegion, setLowerRegion] = useState<RegionCascadeValue>({});
  const [realtimeRegionCode, setRealtimeRegionCode] = useState("");
  const [surveyYear, setSurveyYear] = useState(currentSurveyYear);
  const [surveyYearWasSelected, setSurveyYearWasSelected] = useState(false);
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
  const [recordsRevision, setRecordsRevision] = useState(0);
  const [ledgerDefinitions, setLedgerDefinitions] = useState<
    readonly ProductionDefinition[]
  >([]);
  const [importing, setImporting] = useState(false);
  const [importJob, setImportJob] = useState<ProductionImportJob | null>(null);
  const [importPhotos, setImportPhotos] = useState<readonly File[]>([]);
  const { masterData, masterDataError } =
    useRealtimeMasterData(realtimeRepository);
  useEffect(() => {
    if (!realtimeRepository?.listObjectTypes) return;
    let cancelled = false;
    void realtimeRepository
      .listObjectTypes(productCode, "PRODUCTION")
      .then((types) => {
        if (!cancelled)
          setFormalObjectTypeSnapshot({
            productCode,
            repository: realtimeRepository,
            values: formalProductionObjectTypeOptions(types),
          });
      })
      .catch(() => {
        if (!cancelled) {
          setFormalObjectTypeSnapshot({
            productCode,
            repository: realtimeRepository,
            values: [],
          });
          setRecordsError("当前产品样本点类型暂时无法读取，请稍后重试。");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [productCode, realtimeRepository]);
  useEffect(() => {
    if (surveyYearWasSelected || !masterData?.approvedSurveyYears?.length)
      return;
    if (!masterData.approvedSurveyYears.includes(Number(surveyYear))) {
      const approvedYear = String(masterData.approvedSurveyYears[0]);
      queueMicrotask(() => {
        setSurveyYear(approvedYear);
        setPageNumber(0);
      });
    }
  }, [masterData, surveyYear, surveyYearWasSelected]);
  useEffect(() => {
    if (!realtimeRepository?.loadProductionDefinition) return;
    const typeCodes = [
      ...(objectType ? [productionObjectTypeCode(objectType)] : []),
      ...persistedRecords
        .map(({ values }) =>
          formalProductionObjectTypeCode(
            values.PROD_OBJECT_TYPE ?? "",
            productionObjectTypes,
          ),
        )
        .filter((code): code is string => Boolean(code)),
    ];
    const uniqueTypeCodes = [...new Set(typeCodes)];
    if (uniqueTypeCodes.length === 0) {
      queueMicrotask(() => setLedgerDefinitions([]));
      return;
    }
    let cancelled = false;
    void Promise.all(
      uniqueTypeCodes.map((typeCode) =>
        realtimeRepository.loadProductionDefinition(productCode, typeCode),
      ),
    )
      .then((definitions) => {
        if (!cancelled) setLedgerDefinitions(definitions);
      })
      .catch(() => {
        if (!cancelled) {
          setLedgerDefinitions([]);
          setRecordsError(
            "产情业务字段定义读取失败，请稍后重试，系统未使用旧字段口径。",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    objectType,
    persistedRecords,
    productCode,
    productionObjectTypes,
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
  const authorizedCultivars = getApplicableCultivars(context.productId).filter(
    ({ id }) => scope.authorization.authorizedCultivarIds.includes(id),
  );
  const productItems = workItems.filter(
    (item) =>
      queryAllowed &&
      item.domain === "production" &&
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
        item.cultivarIds.includes(scope.coordinates.cultivarId)) &&
      (!objectType || productionObjectTypeId(item) === objectType),
  );
  const fixtureRows: readonly ProductionCollectionRow[] = productItems.map(
    (item, index) => ({
      workId: item.workId,
      address: "—",
      maintainer: "—",
      values: {},
      number: index + 1,
      surveyDate: formatSurveyPeriodFromDate(item.deadline.slice(0, 10)),
      subject:
        item.subject.kind === "monitoring-object"
          ? cleanSubjectName(item.subject.objectName)
          : "样本点名称未提供",
      objectType: productionObjectType(item),
      objectTypeId: productionObjectTypeId(item),
      region: item.regionLabel,
      cultivar: fieldValue(item.workId, "cultivar"),
      surveyor: fieldValue(item.workId, "surveyor"),
      reporter: fieldValue(item.workId, "reporter"),
      surveyorPhone: fieldValue(item.workId, "surveyorPhone"),
      subjectContact: fieldValue(item.workId, "subjectContact"),
      latitude: fieldValue(item.workId, "latitude"),
      longitude: fieldValue(item.workId, "longitude"),
      plantingArea: fieldValue(item.workId, "area"),
      harvestArea: fieldValue(item.workId, "harvestArea"),
      affectedArea: fieldValue(item.workId, "affectedArea"),
      growth: fieldValue(item.workId, "growth"),
      stage: fieldValue(item.workId, "stage"),
      expectedYield: fieldValue(item.workId, "expectedYield"),
      expectedOutput: fieldValue(item.workId, "output"),
      yearOnYear: "尚无上年同口径记录",
      moisture: fieldValue(item.workId, "moisture"),
      testWeight: fieldValue(item.workId, "testWeight"),
      toxin: fieldValue(item.workId, "toxin"),
      impurity: fieldValue(item.workId, "impurity"),
      imperfectGrain: fieldValue(item.workId, "imperfectGrain"),
      mildew: fieldValue(item.workId, "mildew"),
      protein: fieldValue(item.workId, "protein"),
      oilYield: fieldValue(item.workId, "oilYield"),
      milledRiceRate: fieldValue(item.workId, "milledRiceRate"),
      brownRiceRate: fieldValue(item.workId, "brownRiceRate"),
      openingStock: fieldValue(item.workId, "openingStock"),
      sales: fieldValue(item.workId, "sales"),
      selfUse: fieldValue(item.workId, "selfUse"),
      endingStock: fieldValue(item.workId, "endingStock"),
      intendedArea: fieldValue(item.workId, "intendedArea"),
      intentionReason: fieldValue(item.workId, "intentionReason"),
      landRent: fieldValue(item.workId, "landRent"),
      seedCost: fieldValue(item.workId, "seedCost"),
      pesticideCost: fieldValue(item.workId, "pesticideCost"),
      fertilizerCost: fieldValue(item.workId, "fertilizerCost"),
      irrigationCost: fieldValue(item.workId, "irrigationCost"),
      laborCost: fieldValue(item.workId, "laborCost"),
      machineryCost: fieldValue(item.workId, "machineryCost"),
      otherCost: fieldValue(item.workId, "otherCost"),
      subsidy: fieldValue(item.workId, "subsidy"),
      insurance: fieldValue(item.workId, "insurance"),
      sourceDetail: fieldValue(item.workId, "sourceDetail"),
      validation: fieldValue(item.workId, "validation"),
      lastSaved: lastSavedValue(item.workId),
      status: collectionStatus(item),
    }),
  );
  useEffect(() => {
    if (!realtimeRepository) return;
    if (typeof realtimeRepository.loadMasterData === "function" && !masterData)
      return;
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
    const request = realtimeRepository.listEligibleFormalSamples
      ? realtimeRepository
          .listEligibleFormalSamples({
            domain: "PRODUCTION",
            productCode,
            regionCode: realtimeRegionCode || undefined,
            objectTypeCode: objectType
              ? productionObjectTypeCode(objectType)
              : undefined,
            year: Number(surveyYear),
            observedAt: new Date(
              `${surveyYear}-${surveyMonth ? surveyMonth.padStart(2, "0") : "12"}-01T00:00:00+08:00`,
            ).toISOString(),
          })
          .then((samples) => ({
            items: samples.map((sample) => ({
              id: sample.samplePointId,
              values: {
                ...sample.latestValues,
                __FORMAL_SAMPLE_ID: sample.samplePointId,
                __FORMAL_SAMPLE_NAME: sample.sampleName,
                __FORMAL_SAMPLE_ADDRESS: sample.address,
                __FORMAL_SAMPLE_OBJECT_TYPE: sample.objectTypeCode ?? "",
                __FORMAL_SAMPLE_OBJECT_TYPE_NAME: sample.objectTypeName ?? "",
                __FORMAL_SAMPLE_REGION: sample.regionName,
                __FORMAL_SAMPLE_MAINTAINER: sample.maintainerDisplayName ?? "—",
                __FORMAL_SAMPLE_LATITUDE: sample.latitude,
                __FORMAL_SAMPLE_LONGITUDE: sample.longitude,
                __FORMAL_LATEST_OBSERVATION_ID: sample.latestObservationId,
              },
              allowedActions: [],
              version: sample.version,
            })),
            pageNumber: 0,
            pageSize: samples.length,
            totalElements: samples.length,
            totalPages: samples.length > 0 ? 1 : 0,
          }))
      : realtimeRepository.listProduction({
          productCode,
          page: pageNumber,
          pageSize: collectionPageSize,
          filters: {
            regionCode: realtimeRegionCode || undefined,
            surveyYear,
            surveyMonth: surveyMonth || undefined,
            objectTypeCode: objectType
              ? productionObjectTypeCode(objectType)
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
          setRecordsError("当前产情调查记录暂时无法读取，请稍后重试。");
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
    masterData,
    objectType,
    pageNumber,
    realtimeRefreshToken,
    realtimeRegionCode,
    realtimeRepository,
    recordsRevision,
    surveyMonth,
    surveyYear,
  ]);

  const importRecords = async (file: File | undefined) => {
    if (!file || !realtimeRepository || !importObjectType) return;
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
      const objectTypeCode = productionObjectTypeCode(importObjectType);
      const initial = await realtimeRepository.importProductionCsv(
        file,
        productCode,
        objectTypeCode,
        importPhotos,
      );
      const terminal = await awaitBusinessImport({
        repository: realtimeRepository,
        domain: "production",
        initial,
        onUpdate: setImportJob,
      });
      if (terminal.statusCode !== "FAILED") {
        setImportPhotos([]);
        setPageNumber(0);
        setRecordsRevision((value) => value + 1);
      }
    } catch (error) {
      setRecordsError(
        error instanceof RealtimeApiError && error.clientMessage
          ? error.clientMessage
          : "产情记录导入失败，请核对文件内容后重试。",
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
        "production",
        importJob.id,
      );
      const terminal = await awaitBusinessImport({
        repository: realtimeRepository,
        domain: "production",
        initial,
        onUpdate: setImportJob,
      });
      if (terminal.statusCode !== "FAILED") {
        setPageNumber(0);
        setRecordsRevision((value) => value + 1);
      }
    } catch {
      setRecordsError("产情导入任务重试失败，请稍后重试。");
    } finally {
      setImporting(false);
    }
  };

  const downloadImportErrors = async () => {
    if (!realtimeRepository?.downloadImportErrors || !importJob) return;
    setRecordsError("");
    try {
      saveImportErrorFile(
        await realtimeRepository.downloadImportErrors(
          "production",
          importJob.id,
        ),
        "production",
        importJob.id,
      );
    } catch {
      setRecordsError("产情导入错误清单下载失败，请稍后重试。");
    }
  };

  const downloadTemplate = async () => {
    if (
      !realtimeRepository?.downloadProductionXlsxTemplate ||
      !importObjectType
    )
      return;
    setRecordsError("");
    try {
      const productCode =
        context.productId === "corn"
          ? "CORN"
          : context.productId === "soybean"
            ? "SOYBEAN"
            : "RICE";
      const objectTypeCode = productionObjectTypeCode(importObjectType);
      const blob = await realtimeRepository.downloadProductionXlsxTemplate(
        productCode,
        objectTypeCode,
      );
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `产情-${context.productLabel}-批量导入模板.xlsx`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch {
      setRecordsError("XLSX 模板下载失败，请稍后重试。");
    }
  };

  const persistedRows: readonly ProductionCollectionRow[] =
    persistedRecords.map((record, index) => {
      const rawObjectType = persistedValue(record, "PROD_OBJECT_TYPE");
      const formalObjectType = productionObjectTypes.find(
        ({ id, label }) =>
          label === rawObjectType ||
          productionObjectTypeCode(id) === rawObjectType,
      );
      const normalizedObjectType =
        formalObjectType?.id ?? normalizeProductionObjectType(rawObjectType);
      return {
        workId: record.id,
        samplePointId: record.values.__FORMAL_SAMPLE_ID,
        sampleVersion: record.version,
        address: record.values.__FORMAL_SAMPLE_ADDRESS ?? "—",
        maintainer: record.values.__FORMAL_SAMPLE_MAINTAINER ?? "—",
        values: record.values,
        number: pageNumber * collectionPageSize + index + 1,
        surveyDate: formatExplicitSurveyPeriod(
          record.values,
          "PROD",
          "PROD_SURVEY_DATE",
        ),
        subject: persistedValue(
          record,
          "__FORMAL_SAMPLE_NAME",
          "PROD_SAMPLE_NAME",
          "PROD_SUBJECT_NAME",
          "PROD_OBJECT_NAME",
          "PROD_OBJECT_TYPE",
        ),
        objectType:
          record.values.__FORMAL_SAMPLE_OBJECT_TYPE_NAME ||
          formalObjectType?.label ||
          getProductionObjectTypeOptions().find(
            ({ id }) => id === normalizedObjectType,
          )?.label ||
          rawObjectType,
        objectTypeId: normalizedObjectType,
        region: persistedValue(record, "__FORMAL_SAMPLE_REGION", "PROD_REGION"),
        cultivar: persistedValue(record, "PROD_CULTIVAR_NAME", "PROD_CULTIVAR"),
        surveyor: persistedValue(record, "PROD_SURVEYOR_NAME"),
        reporter: persistedValue(record, "PROD_REPORTER_NAME"),
        surveyorPhone: persistedValue(record, "PROD_SURVEYOR_PHONE"),
        subjectContact: persistedValue(record, "PROD_SAMPLE_CONTACT"),
        latitude: persistedValue(
          record,
          "__FORMAL_SAMPLE_LATITUDE",
          "PROD_SAMPLE_LATITUDE",
        ),
        longitude: persistedValue(
          record,
          "__FORMAL_SAMPLE_LONGITUDE",
          "PROD_SAMPLE_LONGITUDE",
        ),
        plantingArea: persistedValue(record, "PROD_AREA_MU"),
        harvestArea: persistedValue(
          record,
          "PROD_HARVEST_AREA_MU",
          "HARVEST_AREA",
        ),
        affectedArea: persistedValue(
          record,
          "PROD_AFFECTED_AREA_MU",
          "AFFECTED_AREA",
        ),
        growth: persistedValue(record, "PROD_GROWTH_STATUS", "GROWTH"),
        stage: persistedValue(record, "PROD_GROWTH_STAGE", "STAGE"),
        expectedYield: persistedValue(record, "PROD_YIELD_PER_MU"),
        expectedOutput: persistedValue(record, "PROD_ESTIMATED_OUTPUT"),
        yearOnYear: "尚无上年同口径记录",
        moisture: persistedValue(record, "MOISTURE"),
        testWeight: persistedValue(record, "TEST_WEIGHT"),
        toxin: persistedValue(record, "TOXIN"),
        impurity: persistedValue(record, "IMPURITY"),
        imperfectGrain: persistedValue(record, "IMPERFECT_GRAIN"),
        mildew: persistedValue(record, "MILDEW"),
        protein: persistedValue(record, "PROTEIN"),
        oilYield: persistedValue(record, "OIL_YIELD"),
        milledRiceRate: persistedValue(record, "MILLING_YIELD"),
        brownRiceRate: persistedValue(record, "BROWN_RICE_YIELD"),
        openingStock: persistedValue(
          record,
          "PROD_OPENING_INVENTORY",
          "OPENING_INVENTORY",
        ),
        sales: persistedValue(record, "PROD_SALES_VOLUME", "SALES_VOLUME"),
        selfUse: persistedValue(record, "PROD_SELF_USE", "SELF_USE"),
        endingStock: persistedValue(
          record,
          "PROD_ENDING_INVENTORY",
          "ENDING_INVENTORY",
        ),
        intendedArea: persistedValue(
          record,
          "PROD_INTENDED_AREA_MU",
          "INTENDED_AREA",
        ),
        intentionReason: persistedValue(
          record,
          "PROD_INTENTION_REASON",
          "INTENTION_REASON",
        ),
        landRent: persistedValue(record, "LAND_RENT"),
        seedCost: persistedValue(record, "SEED_COST"),
        pesticideCost: persistedValue(record, "PESTICIDE_COST"),
        fertilizerCost: persistedValue(record, "FERTILIZER_COST"),
        irrigationCost: persistedValue(record, "IRRIGATION_COST"),
        laborCost: persistedValue(record, "LABOR_COST"),
        machineryCost: persistedValue(record, "MACHINERY_COST"),
        otherCost: persistedValue(record, "OTHER_COST"),
        subsidy: persistedValue(record, "SUBSIDY_AMOUNT", "SUBSIDY"),
        insurance: persistedValue(record, "INSURANCE_AMOUNT", "INSURANCE"),
        sourceDetail: persistedValue(record, "EVIDENCE_PHOTO_COUNT"),
        validation:
          persistedProductionStatus(record.values.PROD_STATUS) === "已核定"
            ? "校验通过"
            : "等待审核校验",
        lastSaved: formatRealFillingTime(record.values, "PROD"),
        status: persistedProductionStatus(record.values.PROD_STATUS),
      };
    });
  const filteredRows = (
    realtimeRepository ? persistedRows : fixtureRows
  ).filter(
    (row) =>
      realtimeRepository || !objectType || row.objectTypeId === objectType,
  );
  const formalLedgerFields = mergeObservationFields(
    ledgerDefinitions.map((definition) =>
      observationFields("PRODUCTION", definition),
    ),
  );
  const formalLedgerSections = [
    ...new Set(formalLedgerFields.map(({ section }) => section)),
  ];
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
    ? productionDocumentFixtures.find(
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
  const qualityFields = getGrainQualityFields(context.productId);

  return (
    <div className="enterprise-ledger-workbench">
      <div className="enterprise-ledger-workbench__breadcrumb">
        产情监测 / {context.productLabel}产情填报
      </div>
      <ExistingSampleObservationPanel
        domain="PRODUCTION"
        permissions={permissions}
        productCode={productCode}
        repository={realtimeRepository}
        selection={selection}
        onSelectionChange={onSelectionChange}
        onSelectionClear={onSelectionClear}
        onSaved={() => setRecordsRevision((value) => value + 1)}
      >
        <section
          aria-label={`${context.productLabel}产情查询条件`}
          className="enterprise-ledger-query enterprise-ledger-query--production"
          role="search"
        >
          <label>
            <span>数据年份</span>
            <select
              aria-label="数据年份"
              required
              value={surveyYear}
              onChange={(event) => {
                setSurveyYearWasSelected(true);
                setSurveyYear(event.target.value);
                setPageNumber(0);
              }}
            >
              {[
                ...new Set([
                  ...(masterData?.approvedSurveyYears ?? []).map(String),
                  ...surveyYearOptions,
                ]),
              ]
                .sort((left, right) => Number(right) - Number(left))
                .map((year) => (
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
              <span>调查批次</span>
              <select
                aria-label="调查批次"
                value={scope.coordinates.periodKey ?? ""}
                onChange={(event) => {
                  setPageNumber(0);
                  onScopeChange({ periodKey: event.target.value || undefined });
                }}
              >
                <option value="">全部可用调查期</option>
                {productionTaskPeriods.map((period) => (
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
                  event.target.value as "" | ProductionBusinessObjectTypeId,
                );
              }}
            >
              <option value="">全部样本点类型</option>
              {productionObjectTypes.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {!realtimeRepository &&
            (authorizedCultivars.length > 0 ||
              scope.coordinates.cultivarId) && (
              <label>
                <span>具体品种</span>
                <select
                  aria-label="具体品种"
                  value={scope.coordinates.cultivarId ?? ""}
                  onChange={(event) => {
                    setPageNumber(0);
                    onScopeChange({
                      cultivarId: event.target.value || undefined,
                    });
                  }}
                >
                  <option value="">全部{context.productLabel}品种</option>
                  {authorizedCultivars.map(({ id, label }) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
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
          <div className="production-task5-alert" role="alert">
            当前查询条件超出您的授权范围，系统未展示其他地区的数据。
          </div>
        )}

        {recordsError && (
          <div className="production-task5-alert" role="alert">
            {recordsError}
          </div>
        )}
        {masterDataError && (
          <div className="production-task5-alert" role="alert">
            {masterDataError}
          </div>
        )}

        <BusinessImportStatus
          busy={importing}
          className="production-task5-alert"
          job={importJob}
          onDownloadErrors={() => void downloadImportErrors()}
          onRetry={() => void retryImport()}
        />
        <header className="enterprise-ledger-title enterprise-ledger-title--collection">
          <h1>{context.productLabel}产情调查表</h1>
          <p>{businessDate(sourceItem)} · 当前授权地区 · 当前样本点</p>
          <p className="enterprise-ledger-title__sample-note">
            {annualSampleStatusNote(surveyYear)}
          </p>
        </header>

        <section
          aria-label={`${context.productLabel}产情调查表区域`}
          className="enterprise-ledger-table enterprise-ledger-table--production"
        >
          <div className="enterprise-ledger-table__toolbar enterprise-ledger-table__toolbar--collection">
            <strong>
              {recordsLoading
                ? "正在读取产情调查记录"
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
                        !importObjectType ||
                        importing ||
                        !realtimeRepository.downloadProductionXlsxTemplate
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
                        aria-label="批量导入产情记录"
                        disabled={!importObjectType || importing}
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
                        aria-label="附加产情照片"
                        disabled={importing}
                        multiple
                        type="file"
                        onChange={(event) =>
                          setImportPhotos(Array.from(event.target.files ?? []))
                        }
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
                  新建调查记录
                </button>
              </div>
            </div>
          </div>
          <div className="enterprise-ledger-table__scroll" tabIndex={0}>
            <table aria-label={`${context.productLabel}产情调查表`}>
              <>
                <thead>
                  <tr>
                    <th rowSpan={2}>序号</th>
                    <th rowSpan={2}>数据时间</th>
                    <th rowSpan={2}>填报日期</th>
                    <th rowSpan={2}>样本点名称</th>
                    <th rowSpan={2}>样本点类型</th>
                    <th rowSpan={2}>地区</th>
                    <th rowSpan={2}>详细地址</th>
                    <th rowSpan={2}>样本点维护人</th>
                    <th rowSpan={2}>调研人</th>
                    <th colSpan={5}>填报与定位</th>
                    {realtimeRepository ? (
                      formalLedgerSections.map((section) => (
                        <th
                          colSpan={
                            formalLedgerFields.filter(
                              (field) => field.section === section,
                            ).length
                          }
                          key={section}
                        >
                          {section}
                        </th>
                      ))
                    ) : (
                      <>
                        <th colSpan={5}>面积与长势</th>
                        <th colSpan={3}>测产与产量</th>
                        <th colSpan={qualityFields.length}>
                          {context.productLabel}质量
                        </th>
                        <th colSpan={4}>余粮、销售与使用</th>
                        <th colSpan={2}>种植意向</th>
                        <th colSpan={8}>成本费用</th>
                        <th colSpan={2}>补贴与保险</th>
                        <th colSpan={2}>来源校验</th>
                      </>
                    )}
                    <th rowSpan={2}>操作</th>
                  </tr>
                  <tr>
                    <th>填报人</th>
                    <th>调研人联系方式</th>
                    <th>样本点联系方式</th>
                    <th>纬度</th>
                    <th>经度</th>
                    {realtimeRepository ? (
                      formalLedgerFields.map((field) => (
                        <th data-field-code={field.code} key={field.code}>
                          {field.label}
                          {field.unit ? `（${field.unit}）` : ""}
                        </th>
                      ))
                    ) : (
                      <>
                        <th>播种面积</th>
                        <th>预计收获面积</th>
                        <th>灾损面积</th>
                        <th>当前长势</th>
                        <th>生育阶段</th>
                        <th>预计单产</th>
                        <th>预计总产</th>
                        <th>与上年相比</th>
                        {qualityFields.map(({ id, label }) => (
                          <th key={id}>{label}</th>
                        ))}
                        <th>期初库存</th>
                        <th>销售数量</th>
                        <th>自用数量</th>
                        <th>期末余粮</th>
                        <th>下年度意向面积</th>
                        <th>调整原因</th>
                        <th>地租</th>
                        <th>种子费用</th>
                        <th>农药费用</th>
                        <th>化肥费用</th>
                        <th>灌溉费用</th>
                        <th>人工费用</th>
                        <th>机耕费用</th>
                        <th>其他成本</th>
                        <th>政策补贴</th>
                        <th>农业保险</th>
                        <th>数据来源</th>
                        <th>校验结果</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.workId}>
                      <td>{row.number}</td>
                      <td>{row.surveyDate}</td>
                      <td>{row.lastSaved}</td>
                      <th scope="row">{row.subject}</th>
                      <td>{row.objectType}</td>
                      <td>{row.region}</td>
                      <td>{row.address}</td>
                      <td>{row.maintainer}</td>
                      <td>{row.surveyor}</td>
                      <td>{row.reporter}</td>
                      <td>{row.surveyorPhone}</td>
                      <td>{row.subjectContact}</td>
                      <td className="is-operational">{row.latitude}</td>
                      <td className="is-operational">{row.longitude}</td>
                      {realtimeRepository ? (
                        formalLedgerFields.map((field) => (
                          <td className="is-operational" key={field.code}>
                            {row.values[field.code] || "—"}
                          </td>
                        ))
                      ) : (
                        <>
                          <td className="is-operational">{row.plantingArea}</td>
                          <td className="is-operational">{row.harvestArea}</td>
                          <td className="is-operational">{row.affectedArea}</td>
                          <td className="is-operational">{row.growth}</td>
                          <td className="is-operational">{row.stage}</td>
                          <td className="is-operational">
                            {row.expectedYield}
                          </td>
                          <td className="is-operational">
                            {row.expectedOutput}
                          </td>
                          <td className="is-operational">{row.yearOnYear}</td>
                          {qualityFields.map(({ id }) => (
                            <td className="is-operational" key={id}>
                              {qualityValue(row, id)}
                            </td>
                          ))}
                          <td className="is-operational">{row.openingStock}</td>
                          <td className="is-operational">{row.sales}</td>
                          <td className="is-operational">{row.selfUse}</td>
                          <td className="is-operational">{row.endingStock}</td>
                          <td className="is-operational">{row.intendedArea}</td>
                          <td>{row.intentionReason}</td>
                          <td className="is-operational">{row.landRent}</td>
                          <td className="is-operational">{row.seedCost}</td>
                          <td className="is-operational">
                            {row.pesticideCost}
                          </td>
                          <td className="is-operational">
                            {row.fertilizerCost}
                          </td>
                          <td className="is-operational">
                            {row.irrigationCost}
                          </td>
                          <td className="is-operational">{row.laborCost}</td>
                          <td className="is-operational">
                            {row.machineryCost}
                          </td>
                          <td className="is-operational">{row.otherCost}</td>
                          <td className="is-operational">{row.subsidy}</td>
                          <td className="is-operational">{row.insurance}</td>
                          <td>{row.sourceDetail}</td>
                          <td>{row.validation}</td>
                        </>
                      )}
                      <td>
                        <button
                          className="enterprise-ledger-row-action"
                          type="button"
                          onClick={() => {
                            if (row.samplePointId) {
                              onSelectionChange({
                                type: "formal-sample-observation",
                                id: row.samplePointId,
                              });
                              return;
                            }
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
                        {row.samplePointId &&
                          permissions.includes("FORMAL_SAMPLE_MANAGE") && (
                            <button
                              className="enterprise-ledger-row-action"
                              type="button"
                              onClick={() =>
                                onSelectionChange({
                                  type: "formal-sample-edit",
                                  id: row.samplePointId!,
                                })
                              }
                            >
                              编辑
                            </button>
                          )}
                        {row.samplePointId &&
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
                                    row.samplePointId!,
                                    row.sampleVersion ?? 0,
                                  )
                                  .then(() =>
                                    setRecordsRevision((value) => value + 1),
                                  )
                                  .catch((error: unknown) =>
                                    setRecordsError(
                                      error instanceof RealtimeApiError &&
                                        error.clientMessage
                                        ? error.clientMessage
                                        : "该样本已有业务记录或年度样本关系，不能删除。",
                                    ),
                                  );
                              }}
                            >
                              删除
                            </button>
                          )}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td
                        className="enterprise-ledger-table__empty"
                        colSpan={
                          realtimeRepository
                            ? 15 + formalLedgerFields.length
                            : 41 + qualityFields.length
                        }
                      >
                        当前范围暂无{context.productLabel}产情调查记录
                      </td>
                    </tr>
                  )}
                </tbody>
              </>
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
          <ProductionDocumentWorkbench
            actor={{
              userId: scope.identity.userId,
              displayName: scope.identity.displayName ?? "当前登录人员",
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
