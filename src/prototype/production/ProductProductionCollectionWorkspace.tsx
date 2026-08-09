import { useEffect, useState } from "react";

import type {
  BusinessRecordListItem,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";

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

const aggregateRegionByCity = {
  qiqihar: "qiqihar-all",
  heihe: "heihe-all",
  hulunbuir: "hulunbuir-designated",
} as const;

interface ProductionCollectionRow {
  workId: string;
  number: number;
  surveyDate: string;
  subject: string;
  objectType: string;
  objectTypeId: ProductionBusinessObjectTypeId;
  region: string;
  cultivar: string;
  reporter: string;
  reporterPhone: string;
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
  if (item.subject.kind !== "monitoring-object") return "对象类型待维护";
  const typeId = productionObjectTypeId(item);
  return (
    getProductionObjectTypeOptions().find(({ id }) => id === typeId)?.label ??
    "对象类型待维护"
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
  queryAllowed,
  workItems = businessWorkFixtures,
  documentDrafts = {},
  onDocumentDraftChange = () => undefined,
  onWorkItemChange = () => undefined,
  onCreateRecord,
  realtimeRepository,
  realtimeRefreshToken = 0,
}: {
  section: ProductionSection;
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  selection?: FormalSelection;
  onSelectionChange: (selection: FormalSelection) => void;
  queryAllowed: boolean;
  workItems?: readonly BusinessWorkItem[];
  documentDrafts?: Readonly<Record<string, ProductionDocumentDraft>>;
  onDocumentDraftChange?: (
    workId: string,
    draft: ProductionDocumentDraft,
  ) => void;
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
  const [status, setStatus] = useState("");
  const [objectType, setObjectType] = useState<
    "" | ProductionBusinessObjectTypeId
  >("");
  const [lowerRegion, setLowerRegion] = useState<RegionCascadeValue>({});
  const defaultSurveyDate = realtimeRepository
    ? ""
    : (workItems
        .find(
          (item) =>
            item.domain === "production" &&
            item.productId === context.productId,
        )
        ?.deadline.slice(0, 10) ?? "");
  const [surveyDate, setSurveyDate] = useState(defaultSurveyDate);
  const [persistedRecords, setPersistedRecords] = useState<
    readonly BusinessRecordListItem[]
  >([]);
  const [recordsLoading, setRecordsLoading] = useState(
    realtimeRepository !== undefined,
  );
  const [recordsError, setRecordsError] = useState("");
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
      item.domain === "production" &&
      item.productId === context.productId &&
      (!surveyDate || item.deadline.slice(0, 10) === surveyDate) &&
      regionContains(activeRegionId, itemLocationRegionId(item)) &&
      (!scope.coordinates.periodKey ||
        item.periodKey === scope.coordinates.periodKey) &&
      (!scope.coordinates.cultivarId ||
        item.cultivarIds.includes(scope.coordinates.cultivarId)) &&
      (!objectType || productionObjectTypeId(item) === objectType) &&
      (!status || collectionStatus(item) === status),
  );
  const fixtureRows: readonly ProductionCollectionRow[] = productItems.map(
    (item, index) => ({
      workId: item.workId,
      number: index + 1,
      surveyDate: item.deadline.slice(0, 10),
      subject:
        item.subject.kind === "monitoring-object"
          ? cleanSubjectName(item.subject.objectName)
          : "调查对象待维护",
      objectType: productionObjectType(item),
      objectTypeId: productionObjectTypeId(item),
      region: item.regionLabel,
      cultivar: fieldValue(item.workId, "cultivar"),
      reporter: fieldValue(item.workId, "reporter"),
      reporterPhone: fieldValue(item.workId, "reporterPhone"),
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
      .listProduction({ productCode, pageSize: 100 })
      .then((page) => {
        if (!cancelled) setPersistedRecords(page.items);
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
    realtimeRefreshToken,
    realtimeRepository,
    recordsRevision,
  ]);

  const importRecords = async (file: File | undefined) => {
    if (!file || !realtimeRepository) return;
    setImporting(true);
    setRecordsError("");
    setImportMessage("");
    try {
      const job = await realtimeRepository.importProductionCsv(file);
      setImportMessage(
        `导入完成：成功 ${job.importedRows} 条，失败 ${job.failedRows} 条。`,
      );
      setRecordsRevision((value) => value + 1);
    } catch {
      setRecordsError("产情记录导入失败，请核对文件内容后重试。");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = async () => {
    if (!realtimeRepository?.downloadProductionXlsxTemplate || !objectType)
      return;
    setRecordsError("");
    try {
      const productCode =
        context.productId === "corn"
          ? "CORN"
          : context.productId === "soybean"
            ? "SOYBEAN"
            : "RICE";
      const objectTypeCode =
        objectType === "farmer"
          ? "FARMER"
          : objectType === "village-committee"
            ? "VILLAGE_COMMITTEE"
            : "AGRICULTURAL_TECH_STATION";
      const blob = await realtimeRepository.downloadProductionXlsxTemplate(
        productCode,
        objectTypeCode,
      );
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `${context.productLabel}产情-${objectTypeCode}-批量导入模板.xlsx`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch {
      setRecordsError("XLSX 模板下载失败，请稍后重试。");
    }
  };

  const persistedRows: readonly ProductionCollectionRow[] =
    persistedRecords.map((record, index) => {
      const rawObjectType = persistedValue(record, "PROD_OBJECT_TYPE");
      return {
        workId: record.id,
        number: index + 1,
        surveyDate: persistedValue(record, "PROD_SURVEY_DATE"),
        subject: persistedValue(
          record,
          "PROD_SAMPLE_NAME",
          "PROD_SUBJECT_NAME",
          "PROD_OBJECT_NAME",
          "PROD_OBJECT_TYPE",
        ),
        objectType:
          getProductionObjectTypeOptions().find(
            ({ id }) => id === normalizeProductionObjectType(rawObjectType),
          )?.label ?? rawObjectType,
        objectTypeId: normalizeProductionObjectType(rawObjectType),
        region: persistedValue(record, "PROD_REGION"),
        cultivar: persistedValue(record, "PROD_CULTIVAR"),
        reporter: persistedValue(record, "PROD_REPORTER_NAME"),
        reporterPhone: persistedValue(record, "PROD_REPORTER_PHONE"),
        subjectContact: persistedValue(record, "PROD_SAMPLE_CONTACT"),
        latitude: persistedValue(record, "PROD_SAMPLE_LATITUDE"),
        longitude: persistedValue(record, "PROD_SAMPLE_LONGITUDE"),
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
        lastSaved: persistedValue(record, "PROD_REPORTED_AT"),
        status: persistedProductionStatus(record.values.PROD_STATUS),
      };
    });
  const rows = (realtimeRepository ? persistedRows : fixtureRows)
    .filter((row) => !surveyDate || row.surveyDate === surveyDate)
    .filter((row) => !objectType || row.objectTypeId === objectType)
    .filter((row) => !status || row.status === status);
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

      <section
        aria-label={`${context.productLabel}产情查询条件`}
        className="enterprise-ledger-query enterprise-ledger-query--production"
        role="search"
      >
        <label>
          <span>调查日期</span>
          <input
            aria-label="调查日期"
            type="date"
            value={surveyDate}
            onChange={(event) => setSurveyDate(event.target.value)}
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
          <span>调查批次</span>
          <select
            aria-label="调查批次"
            value={scope.coordinates.periodKey ?? ""}
            onChange={(event) =>
              onScopeChange({ periodKey: event.target.value || undefined })
            }
          >
            <option value="">全部可用调查期</option>
            {productionTaskPeriods.map((period) => (
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
                event.target.value as "" | ProductionBusinessObjectTypeId,
              )
            }
          >
            <option value="">全部对象类型</option>
            {getProductionObjectTypeOptions().map(({ id, label }) => (
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
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">全部状态</option>
            {["填写中", "退回待补充", "审核退回", "待审核", "已核定"].map(
              (label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ),
            )}
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
              setStatus("");
              setObjectType("");
              setSurveyDate(defaultSurveyDate);
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
        <div className="production-task5-alert" role="alert">
          当前查询条件超出您的授权范围，系统未展示其他地区的数据。
        </div>
      )}

      {recordsError && (
        <div className="production-task5-alert" role="alert">
          {recordsError}
        </div>
      )}

      {importMessage && (
        <div className="production-task5-alert" role="status">
          {importMessage}
        </div>
      )}

      <header className="enterprise-ledger-title">
        <h1>{context.productLabel}产情调查表</h1>
        <p>{businessDate(sourceItem)} · 当前授权地区 · 当前调查对象</p>
      </header>

      <section
        aria-label={`${context.productLabel}产情调查表区域`}
        className="enterprise-ledger-table enterprise-ledger-table--production"
      >
        <div className="enterprise-ledger-table__toolbar">
          <strong>
            {recordsLoading
              ? "正在读取产情调查记录"
              : `共 ${rows.length} 个调查对象，当前显示 ${rows.length > 0 ? 1 : 0}–${rows.length}`}
          </strong>
          <div>
            {realtimeRepository && (
              <>
                <button
                  disabled={
                    !objectType ||
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
                    disabled={importing}
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
              新建调查记录
            </button>
          </div>
        </div>
        <div className="enterprise-ledger-table__scroll" tabIndex={0}>
          <table aria-label={`${context.productLabel}产情调查表`}>
            <thead>
              <tr>
                <th rowSpan={2}>序号</th>
                <th rowSpan={2}>调查日期</th>
                <th rowSpan={2}>填报日期</th>
                <th rowSpan={2}>调查对象</th>
                <th rowSpan={2}>对象类型</th>
                <th rowSpan={2}>行政区划</th>
                <th rowSpan={2}>具体品种</th>
                <th colSpan={5}>填报与定位</th>
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
                <th rowSpan={2}>填报状态</th>
                <th rowSpan={2}>操作</th>
              </tr>
              <tr>
                <th>填报人</th>
                <th>填报人联系方式</th>
                <th>填报对象联系方式</th>
                <th>纬度</th>
                <th>经度</th>
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
                  <td>{row.cultivar}</td>
                  <td>{row.reporter}</td>
                  <td>{row.reporterPhone}</td>
                  <td>{row.subjectContact}</td>
                  <td className="is-operational">{row.latitude}</td>
                  <td className="is-operational">{row.longitude}</td>
                  <td className="is-operational">{row.plantingArea}</td>
                  <td className="is-operational">{row.harvestArea}</td>
                  <td className="is-operational">{row.affectedArea}</td>
                  <td className="is-operational">{row.growth}</td>
                  <td className="is-operational">{row.stage}</td>
                  <td className="is-operational">{row.expectedYield}</td>
                  <td className="is-operational">{row.expectedOutput}</td>
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
                  <td className="is-operational">{row.pesticideCost}</td>
                  <td className="is-operational">{row.fertilizerCost}</td>
                  <td className="is-operational">{row.irrigationCost}</td>
                  <td className="is-operational">{row.laborCost}</td>
                  <td className="is-operational">{row.machineryCost}</td>
                  <td className="is-operational">{row.otherCost}</td>
                  <td className="is-operational">{row.subsidy}</td>
                  <td className="is-operational">{row.insurance}</td>
                  <td>{row.sourceDetail}</td>
                  <td>{row.validation}</td>
                  <td>
                    <span
                      className={`enterprise-ledger-state is-${row.status}`}
                    >
                      {row.status}
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
                    colSpan={40 + qualityFields.length}
                  >
                    当前范围暂无{context.productLabel}产情调查记录
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
          <nav aria-label="产情调查表分页">
            <button type="button">‹</button>
            <button className="is-current" type="button">
              1
            </button>
            <button type="button">›</button>
          </nav>
        </footer>
      </section>

      {selectedItem && selectedDocument && (
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
    </div>
  );
}
