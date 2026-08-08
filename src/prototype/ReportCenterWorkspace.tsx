import { useState, useSyncExternalStore } from "react";
import {
  createQuickReportArtifact,
  type BusinessReportArtifact,
  type BusinessReportContext,
  type BusinessReportFrequency,
  type BusinessReportRequest,
  type QuickReportExportKind,
  type ReportableApplication,
} from "./businessReportModel";
import {
  enterpriseRegionGroups,
  getEnterpriseScopeRegion,
  type EnterpriseRegionId,
} from "./enterpriseRegions";
import {
  RegionCascadeSelector,
  type RegionCascadeValue,
} from "./components/RegionCascadeSelector";
import { CompactBusinessQuery } from "./components/CompactBusinessQuery";
import { getEnterpriseRegionPath } from "./data/enterpriseRegionHierarchy";
import {
  dutyMonthlyRows,
  dutyWeeklyRows,
  responsibilityAssignments,
} from "./formalEnterpriseData";
import type { ReportingSection } from "./formalEnterpriseModel";
import type { BusinessCoordinates } from "./formalEnterpriseModel";
import type { OperationalScope } from "./core/operationalScope";
import type { BusinessWorkItem } from "./core/businessWork";
import { projectDomainTasks } from "./application/businessWorkProjection";
import { businessClassificationFixtures } from "./formalEnterpriseData";
import {
  filterPlatformMasterDataByAuthorization,
  getApplicableCultivars,
  getApplicablePeriodTypes,
  getApplicableReleaseBatches,
  platformCultivars,
  platformProducts,
  prototypeMasterDataAuthorization,
  type PlatformMasterDataAuthorization,
  type PlatformProductId,
} from "./core/platformMasterData";
import type { BusinessClassification } from "./core/businessClassification";
import {
  chineseDateTime,
  chinesePeriodRange,
} from "./core/businessDisplayPolicy";
import {
  WorkspaceFilterBar,
  WorkspaceHeader,
  WorkspaceInlineStats,
  FormalWorkspaceScopeProvider,
  useFormalWorkspaceScope,
  WorkspaceStatus,
  WorkspaceTable,
  WorkspaceTableToolbar,
  WorkspaceTabs,
  type WorkspaceTone,
} from "./UnifiedWorkspacePrimitives";
import {
  getFallbackPrototypeBusinessReportWorkflow,
  resolveBusinessReportWorkItem,
  type BusinessReportPermissionKey,
  type BusinessReportRecord,
  type BusinessReportWorkflow,
} from "./businessReportWorkflow";
import {
  approvedBusinessReportDatasets,
  findApprovedBusinessReportDataset,
} from "./data/businessReportDatasets";

const allBusinessReportPermissions: readonly BusinessReportPermissionKey[] = [
  "report.draft.save",
  "report.review.submit",
  "report.review.approve",
  "report.review.return",
  "report.publish.confirm",
  "report.revision.create",
  "report.replacement.confirm",
  "report.audit.read",
  "report.export",
];

const reportActorPostByIdentityPostId: Readonly<Record<string, string>> = {
  "regional-data-admin": "区域数据管理员",
  "business-reviewer": "报告复核岗",
};

function reportActorPost(postId: string) {
  return reportActorPostByIdentityPostId[postId] ?? "报告责任岗位待配置";
}

function hasReportPermission(
  permissionKeys: readonly string[],
  permission: BusinessReportPermissionKey,
) {
  return permissionKeys.includes(permission);
}

function reportOptionLabel(label: string, available: boolean) {
  return available ? label : `${label}（暂无已核定数据）`;
}

const reportBatchAuthorizationIds: Readonly<Record<string, string>> = {
  第31周粮食商情周报核定批次: "REPORTING-2026-W31-APPROVED",
  "7月经营汇总已核定数据": "REPORTING-2026-W31-APPROVED",
};

function reportIsAuthorized(
  report: BusinessReportRecord,
  scope: OperationalScope | undefined,
  queryAllowed: boolean,
) {
  if (!scope) return queryAllowed;
  if (
    !queryAllowed ||
    !scope.authorization.permissionKeys.includes("prototype:read") ||
    !scope.authorization.authorizedBusinessClassificationIds.includes(
      report.scope.businessClassificationId as BusinessClassification["id"],
    ) ||
    (scope.coordinates.businessDomainId &&
      scope.coordinates.businessDomainId !== report.scope.application) ||
    (scope.coordinates.businessSubtypeId &&
      scope.coordinates.businessSubtypeId !==
        report.scope.businessClassificationId)
  ) {
    return false;
  }
  const regionId = enterpriseRegionGroups
    .flatMap(({ regions }) => regions)
    .find(({ label }) => label === report.scope.region)?.id;
  if (
    !regionId ||
    !scope.authorization.authorizedRegionIds.includes(regionId) ||
    (scope.coordinates.regionId !== "authorized-all" &&
      scope.coordinates.regionId !== regionId)
  ) {
    return false;
  }
  const product = platformProducts.find(
    ({ label }) => label === report.scope.product,
  );
  const productAllowed = product
    ? scope.authorization.authorizedProductIds.includes(product.id)
    : report.scope.product === "综合粮食品种" &&
      platformProducts.every(({ id }) =>
        scope.authorization.authorizedProductIds.includes(id),
      );
  if (
    !productAllowed ||
    (scope.coordinates.productId && scope.coordinates.productId !== product?.id)
  ) {
    return false;
  }
  const cultivar = platformCultivars.find(
    ({ label }) => label === report.scope.cultivar,
  );
  if (
    report.scope.cultivar !== "不按具体品种拆分" &&
    (!cultivar ||
      !scope.authorization.authorizedCultivarIds.includes(cultivar.id))
  ) {
    return false;
  }
  if (
    scope.coordinates.cultivarId &&
    scope.coordinates.cultivarId !== cultivar?.id
  ) {
    return false;
  }
  const authorizedBatchId =
    reportBatchAuthorizationIds[report.scope.dataBatchId] ??
    report.scope.dataBatchId;
  return (
    scope.authorization.authorizedReleaseVersionIds.includes(
      authorizedBatchId,
    ) &&
    (!scope.coordinates.releaseVersion ||
      scope.coordinates.releaseVersion === authorizedBatchId)
  );
}

function authorizedReports(
  reports: readonly BusinessReportRecord[],
  scope: OperationalScope | undefined,
  queryAllowed: boolean,
) {
  return reports.filter((report) =>
    reportIsAuthorized(report, scope, queryAllowed),
  );
}

function resolveRequestedReportDataset(
  requestedDatasetId: string,
  authorization: PlatformMasterDataAuthorization,
) {
  const [dataBatchId, requestedApplication, requestedProduct] =
    requestedDatasetId.split("::");
  const dataset = approvedBusinessReportDatasets.find(
    (item) =>
      item.dataBatchId === dataBatchId &&
      (!requestedApplication || item.application === requestedApplication) &&
      (!requestedProduct || item.product === requestedProduct),
  );
  if (!dataset) return null;
  const masterData = filterPlatformMasterDataByAuthorization(authorization);
  const definition = reportApplications.find(
    (item) => item.key === dataset.application,
  );
  const region = enterpriseRegionGroups
    .flatMap(({ regions }) => regions)
    .find(({ label }) => label === dataset.region);
  const product = masterData.products.find(
    ({ label }) => label === dataset.product,
  );
  const cultivarId =
    dataset.cultivar === "不按具体品种拆分"
      ? "not-applicable"
      : masterData.cultivars.find(({ label }) => label === dataset.cultivar)
          ?.id;
  const authorized =
    definition !== undefined &&
    authorization.authorizedBusinessClassificationIds.includes(
      definition.classificationId,
    ) &&
    authorization.authorizedBusinessClassificationIds.some(
      (classificationId) =>
        classificationId === dataset.businessClassificationId,
    ) &&
    region !== undefined &&
    authorization.authorizedRegionIds.includes(region.id) &&
    product !== undefined &&
    authorization.authorizedProductIds.includes(product.id) &&
    cultivarId !== undefined &&
    (cultivarId === "not-applicable" ||
      authorization.authorizedCultivarIds.includes(cultivarId)) &&
    authorization.authorizedReleaseVersionIds.includes(dataset.dataBatchId);
  if (!authorized || !region || !product || !cultivarId) return null;
  return { dataset, regionId: region.id, productId: product.id, cultivarId };
}

function ReportRegionSelect({
  regionId,
  authorizedRegionIds,
  onChange,
}: {
  regionId: string;
  authorizedRegionIds: readonly EnterpriseRegionId[];
  onChange: (regionId: EnterpriseRegionId | "") => void;
}) {
  const path = getEnterpriseRegionPath(regionId);
  const value: RegionCascadeValue = {
    cityId: path.find(({ level }) => level === "prefecture")?.id,
    countyId: path.find(({ level }) => level === "county")?.id,
  };
  const aggregateByCity = {
    qiqihar: "qiqihar-all",
    heihe: "heihe-all",
    hulunbuir: "hulunbuir-designated",
  } as const;

  return (
    <RegionCascadeSelector
      authorizedRegionIds={authorizedRegionIds}
      hideLabel
      maxLevel="county"
      value={value}
      onChange={(next) => {
        if (next.countyId) {
          onChange(next.countyId as EnterpriseRegionId);
          return;
        }
        if (next.cityId) {
          onChange(
            aggregateByCity[next.cityId as keyof typeof aggregateByCity] ??
              (next.cityId as EnterpriseRegionId),
          );
          return;
        }
        onChange("");
      }}
    />
  );
}

const reportApplications: readonly {
  key: ReportableApplication;
  label: string;
  classificationId:
    "reporting.production" | "reporting.market" | "reporting.supply";
  productIds: readonly PlatformProductId[];
}[] = [
  {
    key: "production",
    label: "产情监测",
    classificationId: "reporting.production",
    productIds: ["corn", "soybean", "paddy", "wheat"],
  },
  {
    key: "market",
    label: "市场监测",
    classificationId: "reporting.market",
    productIds: [
      "corn",
      "soybean",
      "paddy",
      "wheat",
      "rice",
      "soymeal",
      "soyoil",
      "soy-protein",
      "agri-input",
    ],
  },
  {
    key: "supply",
    label: "供需与态势",
    classificationId: "reporting.supply",
    productIds: [
      "corn",
      "soybean",
      "paddy",
      "wheat",
      "rice",
      "soymeal",
      "soyoil",
      "soy-protein",
    ],
  },
];

const reportTemplateByClassification: Readonly<
  Record<BusinessClassification["id"], string>
> = {
  "production.planting-production": "种植生产监测报告",
  "production.cost-support": "成本与政策支持报告",
  "production.farmer-stock-sales": "农户余粮与销售报告",
  "production.planting-intention": "种植意向分析报告",
  "production.quality-survey": "产情质量调查报告",
  "market.quote-trade": "价格与交易监测报告",
  "market.quality": "市场质量监测报告",
  "market.inventory": "市场库存监测报告",
  "market.processing": "加工运行监测报告",
  "market.consumption-use": "消费与使用分析报告",
  "market.sales": "销售运行分析报告",
  "market.logistics": "物流运行监测报告",
  "market.agricultural-input": "农资市场监测报告",
  "supply.supply": "供给构成分析报告",
  "supply.use-outflow": "使用与外流分析报告",
  "supply.results": "供需平衡分析报告",
  "supply.auxiliary": "供需辅助口径报告",
  "operations.obligation-performance": "履责表现报告",
  "operations.data-quality": "数据质量报告",
  "reporting.production": "产情综合报告",
  "reporting.market": "市场综合报告",
  "reporting.supply": "供需综合报告",
  "reporting.cross-business": "粮食商情经营报告",
  "reporting.duty": "履责监督报告",
};

const reportPeriodsByFrequency: Record<
  BusinessReportFrequency,
  readonly string[]
> = {
  日报: ["2026年7月31日"],
  周报: ["2026年第31周"],
  月报: ["2026年7月"],
};

function frequencyOptions(
  application: ReportableApplication,
  classificationId: BusinessClassification["id"],
): readonly BusinessReportFrequency[] {
  if (application === "supply") return ["月报"];
  const periodTypes = new Set(
    getApplicablePeriodTypes(classificationId).map(({ id }) => id),
  );
  return [
    ...(periodTypes.has("day") ? (["日报"] as const) : []),
    ...(periodTypes.has("week") ? (["周报"] as const) : []),
    ...(periodTypes.has("month") ? (["月报"] as const) : []),
  ];
}

function reportPeriodOptions(
  application: ReportableApplication,
  frequency: BusinessReportFrequency | "",
) {
  if (!frequency) return [];
  if (application === "supply") return ["2026/27营销年度"];
  return reportPeriodsByFrequency[frequency];
}

function buildReportContext({
  application,
  businessClassificationId,
  businessClassificationLabel,
  product,
  cultivar,
  reportTemplate,
  region,
  period,
  dataVersion,
  dataBatchLabel,
  frequency,
  regionLevel,
  authorPost,
  dataCutoff,
  sectionKeys,
}: {
  application: ReportableApplication;
  businessClassificationId?: string;
  businessClassificationLabel?: string;
  product: string;
  cultivar?: string;
  reportTemplate?: string;
  region: string;
  period: string;
  dataVersion: string;
  dataBatchLabel?: string;
  frequency?: BusinessReportFrequency;
  regionLevel?: string;
  authorPost: string;
  dataCutoff: string;
  sectionKeys?: readonly string[];
}): BusinessReportContext {
  const definition = reportApplications.find(
    (item) => item.key === application,
  )!;
  return {
    application,
    applicationLabel: definition.label,
    businessClassificationId,
    businessClassificationLabel,
    product,
    cultivar,
    reportTemplate,
    region,
    regionLevel:
      regionLevel ?? (region.endsWith("市全域") ? "地市级" : "县级或指定范围"),
    period,
    frequency,
    dataCutoff,
    dataVersion,
    dataBatchLabel,
    author: "当前登录人员",
    authorPost,
    reviewer: "复核人员待指派",
    reviewerPost: "报告复核岗",
    sectionKeys,
  };
}

function toneFor(value: string): WorkspaceTone {
  if (
    value.includes("未提交") ||
    value.includes("逾期") ||
    value.includes("替代")
  ) {
    return "danger";
  }
  if (
    value.includes("等待") ||
    value.includes("生成") ||
    value.includes("复核")
  ) {
    return "warning";
  }
  if (
    value.includes("按时") ||
    value.includes("发布") ||
    value.includes("通过")
  ) {
    return "good";
  }
  return "normal";
}

function displayReportPeriod(period: string) {
  return /^\d{4}-\d{2}-\d{2}/.test(period) ? chineseDateTime(period) : period;
}

function workflowDateTime(timestamp: number) {
  const value = new Date(timestamp);
  return `${String(value.getFullYear())}年${String(value.getMonth() + 1)}月${String(value.getDate())}日 ${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function BusinessReports({
  onComposeReport,
  onQuickExport,
  workflow,
  actorPost,
  permissionKeys,
  requestedDataBatchId,
  queryAllowed,
}: {
  onComposeReport: (context: BusinessReportContext) => void;
  onQuickExport?: (
    kind: QuickReportExportKind,
    artifact: BusinessReportArtifact,
  ) => void;
  workflow: BusinessReportWorkflow;
  actorPost: string;
  permissionKeys: readonly string[];
  requestedDataBatchId?: string;
  queryAllowed: boolean;
  scope?: OperationalScope;
  onScopeChange?: (coordinates: Partial<BusinessCoordinates>) => void;
}) {
  const formalScope = useFormalWorkspaceScope();
  const authorization =
    formalScope?.scope.authorization ?? prototypeMasterDataAuthorization;
  const requestedSelection = requestedDataBatchId
    ? resolveRequestedReportDataset(requestedDataBatchId, authorization)
    : null;
  const [application, setApplication] = useState<ReportableApplication | "">(
    requestedSelection?.dataset.application ?? "",
  );
  const authorizedMasterData =
    filterPlatformMasterDataByAuthorization(authorization);
  const availableDefinitions = reportApplications.filter((item) =>
    authorization.authorizedBusinessClassificationIds.includes(
      item.classificationId,
    ),
  );
  const definition = availableDefinitions.find(
    (item) => item.key === application,
  );
  const [regionId, setRegionId] = useState<EnterpriseRegionId | "">(
    requestedSelection?.regionId ?? "",
  );
  const region = getEnterpriseScopeRegion(regionId);
  const [businessClassificationId, setBusinessClassificationId] =
    useState<string>(
      requestedSelection?.dataset.businessClassificationId ?? "",
    );
  const businessClassification =
    authorizedMasterData.businessClassifications.find(
      ({ id }) => id === businessClassificationId,
    );
  const [productId, setProductId] = useState<string>(
    requestedSelection?.productId ?? "",
  );
  const product = authorizedMasterData.products.find(
    ({ id }) => id === productId,
  );
  const [cultivarId, setCultivarId] = useState<string>(
    requestedSelection?.cultivarId ?? "",
  );
  const [reportTemplate, setReportTemplate] = useState<string>(
    requestedSelection?.dataset.reportTemplate ?? "",
  );
  const cultivar =
    cultivarId === "not-applicable"
      ? { id: "not-applicable", label: "不按具体品种拆分" }
      : authorizedMasterData.cultivars.find(({ id }) => id === cultivarId);
  const [frequency, setFrequency] = useState<BusinessReportFrequency | "">(
    requestedSelection?.dataset.frequency ?? "",
  );
  const [period, setPeriod] = useState<string>(
    requestedSelection?.dataset.period ?? "",
  );
  const [dataVersion, setDataVersion] = useState<string>(
    requestedSelection?.dataset.dataBatchId ?? "",
  );
  const [sectionKeys, setSectionKeys] = useState<readonly string[]>(
    requestedSelection?.dataset.chapters.map(({ title }) => title) ?? [],
  );
  const [quickExportMessage, setQuickExportMessage] = useState("");
  const requestedBatchMessage = !requestedDataBatchId
    ? ""
    : requestedSelection
      ? "已按所选已核定数据精确带入报告生成条件。"
      : "所请求的报告数据尚未核定或不在当前授权范围，未自动带入编制条件。";
  const reports = useSyncExternalStore(
    workflow.subscribe,
    workflow.getSnapshot,
  );
  const resumableReports = authorizedReports(
    reports,
    formalScope?.scope,
    queryAllowed,
  ).filter(
    ({ status, currentHandlerPost }) =>
      currentHandlerPost === actorPost &&
      (status === "草稿" || status === "退回修改"),
  );
  const dataBatch = authorizedMasterData.releaseBatches.find(
    ({ id }) => id === dataVersion,
  );
  const selectedDataset = approvedBusinessReportDatasets.find(
    (dataset) =>
      dataset.dataBatchId === dataVersion &&
      dataset.application === application &&
      dataset.businessClassificationId === businessClassificationId &&
      dataset.region === region?.label &&
      dataset.product === product?.label &&
      dataset.cultivar === cultivar?.label &&
      dataset.reportTemplate === reportTemplate &&
      dataset.frequency === frequency &&
      dataset.period === period,
  );
  const selectedDataCutoff = selectedDataset?.dataCutoff ?? "";
  const productOptions = definition
    ? authorizedMasterData.products.filter(({ id }) =>
        definition.productIds.includes(id),
      )
    : [];
  const businessClassificationOptions = application
    ? authorizedMasterData.businessClassifications.filter(
        ({ domain, reportEnabled }) => domain === application && reportEnabled,
      )
    : [];
  const cultivarOptions = product
    ? [
        { id: "not-applicable", label: "不按具体品种拆分" },
        ...getApplicableCultivars(product.id).filter(({ id }) =>
          authorization.authorizedCultivarIds.includes(id),
        ),
      ]
    : [];
  const templateOptions = businessClassification
    ? [reportTemplateByClassification[businessClassification.id]]
    : [];
  const classificationDatasets = businessClassification
    ? approvedBusinessReportDatasets.filter(
        (dataset) =>
          dataset.application === application &&
          dataset.businessClassificationId === businessClassification.id,
      )
    : [];
  const batchOptions = businessClassification
    ? getApplicableReleaseBatches(businessClassification.id).filter(
        ({ id, label }) =>
          authorization.authorizedReleaseVersionIds.includes(id) &&
          label.includes("已核定"),
      )
    : [];
  const availableFrequencies =
    definition && businessClassification
      ? frequencyOptions(definition.key, businessClassification.id)
      : [];
  const availablePeriods = definition
    ? reportPeriodOptions(definition.key, frequency)
    : [];
  const hasCompleteComposeScope =
    application !== "" &&
    businessClassification !== undefined &&
    region !== undefined &&
    product !== undefined &&
    cultivar !== undefined &&
    reportTemplate.length > 0 &&
    frequency !== "" &&
    period.length > 0 &&
    dataBatch !== undefined &&
    selectedDataCutoff.length > 0 &&
    sectionKeys.length > 0;
  const matchingDataset = hasCompleteComposeScope
    ? findApprovedBusinessReportDataset({
        application,
        businessClassificationId: businessClassification.id,
        region: region.label,
        product: product.label,
        cultivar: cultivar.label,
        reportTemplate,
        period,
        frequency,
        dataBatchId: dataBatch.id,
      })
    : null;
  const canCompose =
    queryAllowed &&
    matchingDataset !== null &&
    hasReportPermission(permissionKeys, "report.draft.save");

  const reportType =
    application === "production"
      ? "产情报告"
      : application === "market"
        ? "市场报告"
        : application === "supply"
          ? "供需报告"
          : null;
  const quickRequest: BusinessReportRequest | null =
    hasCompleteComposeScope &&
    reportType &&
    region &&
    product &&
    cultivar &&
    frequency &&
    dataBatch
      ? {
          reportType,
          regionId: region.id,
          productId: product.id,
          cultivarId: cultivar.id === "not-applicable" ? null : cultivar.id,
          periodKey: period,
          frequency: frequency.replace(
            "报",
            "",
          ) as BusinessReportRequest["frequency"],
          cutoff: selectedDataCutoff,
          approvedDatasetId: dataBatch.id,
          sectionKeys,
        }
      : null;

  function quickArtifact(kind: QuickReportExportKind) {
    if (!quickRequest) return null;
    try {
      return createQuickReportArtifact(quickRequest, kind);
    } catch {
      return null;
    }
  }

  function canQuickExport(kind: QuickReportExportKind) {
    return Boolean(
      queryAllowed &&
      hasReportPermission(permissionKeys, "report.export") &&
      quickArtifact(kind),
    );
  }

  function runQuickExport(kind: QuickReportExportKind) {
    const artifact = quickArtifact(kind);
    if (!artifact) return;
    if (onQuickExport) {
      onQuickExport(kind, artifact);
    } else {
      const link = document.createElement("a");
      link.download = artifact.filename;
      link.href = `data:${artifact.mimeType},${encodeURIComponent(artifact.content)}`;
      link.click();
    }
    setQuickExportMessage(`已生成：${artifact.filename}`);
  }

  function changeApplication(next: ReportableApplication) {
    setApplication(next);
    setBusinessClassificationId("");
    setProductId("");
    setCultivarId("");
    setReportTemplate("");
    setFrequency("");
    setPeriod("");
    setDataVersion("");
    setSectionKeys([]);
  }

  function composeReport() {
    if (
      !canCompose ||
      !application ||
      !businessClassification ||
      !product ||
      !cultivar ||
      !region ||
      !dataBatch
    )
      return;
    onComposeReport(
      buildReportContext({
        application,
        businessClassificationId: businessClassification.id,
        businessClassificationLabel: businessClassification.label,
        product: product.label,
        cultivar: cultivar.label,
        reportTemplate,
        region: region.label,
        regionLevel: region.level,
        period,
        frequency: frequency || undefined,
        dataVersion: dataBatch.id,
        dataBatchLabel: dataBatch.label,
        authorPost: actorPost,
        dataCutoff: selectedDataCutoff,
        sectionKeys,
      }),
    );
  }

  return (
    <div className="unified-workspace">
      <section
        aria-label="业务报告生成条件"
        className="report-unified-query-surface"
      >
        <CompactBusinessQuery
          ariaLabel="业务报告查询条件"
          primaryFields={[
            <label key="application">
              <span>业务</span>
              <select
                aria-label="业务类型"
                value={application}
                onChange={(event) => {
                  const next = event.target.value;
                  if (!next) {
                    setApplication("");
                    setBusinessClassificationId("");
                    setProductId("");
                    setCultivarId("");
                    setReportTemplate("");
                    setFrequency("");
                    setPeriod("");
                    setDataVersion("");
                    setSectionKeys([]);
                    return;
                  }
                  changeApplication(next as ReportableApplication);
                }}
              >
                <option value="">请选择报告业务</option>
                {availableDefinitions.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>,
            <label key="region">
              <span>地区</span>
              <ReportRegionSelect
                regionId={regionId}
                authorizedRegionIds={authorization.authorizedRegionIds}
                onChange={(nextRegionId) => {
                  setRegionId(nextRegionId);
                  setDataVersion("");
                  setSectionKeys([]);
                }}
              />
            </label>,
            <label key="product">
              <span>产品</span>
              <select
                aria-label="产品或专题"
                disabled={!definition}
                value={productId}
                onChange={(event) => {
                  setProductId(event.target.value);
                  setCultivarId("");
                  setDataVersion("");
                  setSectionKeys([]);
                }}
              >
                <option value="">请选择产品或专题</option>
                {productOptions.map((item) => {
                  const available = (
                    businessClassification
                      ? classificationDatasets
                      : approvedBusinessReportDatasets.filter(
                          (dataset) => dataset.application === application,
                        )
                  ).some((dataset) => dataset.product === item.label);
                  return (
                    <option disabled={!available} key={item.id} value={item.id}>
                      {reportOptionLabel(item.label, available)}
                    </option>
                  );
                })}
              </select>
            </label>,
            <label key="frequency">
              <span>报告类型</span>
              <select
                aria-label="报告频率"
                disabled={!businessClassification}
                value={frequency}
                onChange={(event) => {
                  setFrequency(
                    event.target.value as BusinessReportFrequency | "",
                  );
                  setPeriod("");
                  setDataVersion("");
                  setSectionKeys([]);
                }}
              >
                <option value="">请选择报告频率</option>
                {availableFrequencies.map((item) => {
                  const available = classificationDatasets.some(
                    (dataset) => dataset.frequency === item,
                  );
                  return (
                    <option disabled={!available} key={item} value={item}>
                      {reportOptionLabel(item, available)}
                    </option>
                  );
                })}
              </select>
            </label>,
            <label key="period">
              <span>期间</span>
              <select
                aria-label="报告期间"
                disabled={!frequency}
                value={period}
                onChange={(event) => {
                  setPeriod(event.target.value);
                  setDataVersion("");
                  setSectionKeys([]);
                }}
              >
                <option value="">请选择报告期间</option>
                {availablePeriods.map((item) => {
                  const available = classificationDatasets.some(
                    (dataset) => dataset.period === item,
                  );
                  return (
                    <option disabled={!available} key={item} value={item}>
                      {reportOptionLabel(item, available)}
                    </option>
                  );
                })}
              </select>
            </label>,
            <label key="data">
              <span>采用数据</span>
              <select
                aria-label="采用数据"
                disabled={!businessClassification}
                value={dataVersion}
                onChange={(event) => {
                  const nextDataVersion = event.target.value;
                  const nextDataset = approvedBusinessReportDatasets.find(
                    (dataset) =>
                      dataset.dataBatchId === nextDataVersion &&
                      dataset.application === application &&
                      dataset.businessClassificationId ===
                        businessClassificationId &&
                      dataset.region === region?.label &&
                      dataset.product === product?.label &&
                      dataset.cultivar === cultivar?.label &&
                      dataset.reportTemplate === reportTemplate &&
                      dataset.frequency === frequency &&
                      dataset.period === period,
                  );
                  setDataVersion(nextDataVersion);
                  setSectionKeys(
                    nextDataset?.chapters.map(({ title }) => title) ?? [],
                  );
                }}
              >
                <option value="">请选择采用的已核定数据</option>
                {batchOptions.map((item) => {
                  const available = classificationDatasets.some(
                    (dataset) => dataset.dataBatchId === item.id,
                  );
                  return (
                    <option disabled={!available} key={item.id} value={item.id}>
                      {reportOptionLabel(item.label, available)}
                    </option>
                  );
                })}
              </select>
            </label>,
          ]}
          moreFields={[
            <label key="classification">
              <span>业务分类</span>
              <select
                aria-label="业务分类"
                disabled={!definition}
                value={businessClassificationId}
                onChange={(event) => {
                  setBusinessClassificationId(event.target.value);
                  setProductId("");
                  setCultivarId("");
                  setReportTemplate("");
                  setFrequency("");
                  setPeriod("");
                  setDataVersion("");
                  setSectionKeys([]);
                }}
              >
                <option value="">请选择业务分类</option>
                {businessClassificationOptions.map((item) => {
                  const available = approvedBusinessReportDatasets.some(
                    (dataset) =>
                      dataset.application === application &&
                      dataset.businessClassificationId === item.id,
                  );
                  return (
                    <option disabled={!available} key={item.id} value={item.id}>
                      {reportOptionLabel(item.label, available)}
                    </option>
                  );
                })}
              </select>
            </label>,
            <label key="cultivar">
              <span>具体品种</span>
              <select
                aria-label="具体品种"
                disabled={!product}
                value={cultivarId}
                onChange={(event) => {
                  setCultivarId(event.target.value);
                  setDataVersion("");
                  setSectionKeys([]);
                }}
              >
                <option value="">请选择具体品种</option>
                {cultivarOptions.map((item) => {
                  const available =
                    businessClassification === undefined ||
                    classificationDatasets.some(
                      (dataset) =>
                        dataset.product === product?.label &&
                        dataset.cultivar === item.label,
                    );
                  return (
                    <option disabled={!available} key={item.id} value={item.id}>
                      {reportOptionLabel(item.label, available)}
                    </option>
                  );
                })}
              </select>
            </label>,
            <label key="template">
              <span>报告模板</span>
              <select
                aria-label="报告模板"
                disabled={!businessClassification}
                value={reportTemplate}
                onChange={(event) => {
                  setReportTemplate(event.target.value);
                  setDataVersion("");
                  setSectionKeys([]);
                }}
              >
                <option value="">请选择报告模板</option>
                {templateOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>,
            <label key="cutoff">
              <span>数据截止</span>
              <output aria-label="数据截止">
                {selectedDataCutoff
                  ? chineseDateTime(selectedDataCutoff)
                  : "选择采用数据后确定"}
              </output>
            </label>,
            <fieldset
              aria-label="报告章节"
              className="report-section-options report-query-chapters"
              key="chapters"
            >
              <legend>报告章节</legend>
              {selectedDataset ? (
                selectedDataset.chapters.map(({ title }) => (
                  <label key={title}>
                    <input
                      checked={sectionKeys.includes(title)}
                      type="checkbox"
                      onChange={(event) =>
                        setSectionKeys((current) =>
                          event.target.checked
                            ? [...current, title]
                            : current.filter((key) => key !== title),
                        )
                      }
                    />
                    <span>{title}</span>
                  </label>
                ))
              ) : (
                <span>选择采用数据后显示可用章节</span>
              )}
            </fieldset>,
          ]}
          actions={
            <>
              <button
                className="is-primary"
                disabled={!canCompose}
                type="button"
                onClick={composeReport}
              >
                生成报告
              </button>
              <details
                aria-label="一键导出"
                className="quick-report-export-menu"
              >
                <summary>一键导出</summary>
                <div>
                  {(
                    [
                      ["business-daily", "导出业务日报"],
                      ["business-weekly", "导出业务周报"],
                      ["business-monthly", "导出业务月报"],
                      ["submission-weekly", "导出填报记录周报"],
                      ["submission-monthly", "导出填报记录月报"],
                    ] as const
                  ).map(([kind, label]) => (
                    <button
                      disabled={!canQuickExport(kind)}
                      key={kind}
                      type="button"
                      onClick={() => runQuickExport(kind)}
                    >
                      {label}
                    </button>
                  ))}
                  <small>
                    仅导出当前明确选择的业务、地区、产品、期间和已核定数据。
                  </small>
                </div>
              </details>
            </>
          }
        />
      </section>
      {quickExportMessage && <p role="status">{quickExportMessage}</p>}
      {requestedBatchMessage && (
        <p className="report-workspace-note" role="status">
          {requestedBatchMessage}
        </p>
      )}
      {hasCompleteComposeScope && !matchingDataset && (
        <p className="report-generation-blocker" role="status">
          当前生成条件没有对应的已核定报告数据，不能生成报告。
        </p>
      )}
      {!queryAllowed && (
        <p className="report-generation-blocker" role="status">
          当前筛选范围超出您的数据权限，不能生成报告。
        </p>
      )}
      {matchingDataset &&
        queryAllowed &&
        !hasReportPermission(permissionKeys, "report.draft.save") && (
          <p className="report-generation-blocker" role="status">
            当前登录岗位“{actorPost}”没有编制业务报告的权限。
          </p>
        )}
      <WorkspaceTableToolbar
        note="这里只显示尚未提交或被退回的报告；复核、发布和历史沿革统一在报告流转与报告台账中查询。"
        title="待继续编制"
      />
      <WorkspaceTable
        columns={[
          "报告名称",
          "业务分类",
          "产品与具体品种",
          "报告期间",
          "报告模板",
          "状态",
          "当前处理岗位",
          "操作",
        ]}
        label="待继续编制报告"
        rows={resumableReports.map((row) => [
          <strong key={`${row.id}-name`}>{row.title}</strong>,
          row.scope.businessClassificationLabel,
          `${row.scope.product} · ${row.scope.cultivar}`,
          displayReportPeriod(row.scope.period),
          row.scope.reportTemplate,
          <WorkspaceStatus key={`${row.id}-state`} tone={toneFor(row.status)}>
            {row.status}
          </WorkspaceStatus>,
          row.currentHandlerPost,
          <button
            aria-label={`继续编制${row.title}`}
            className="unified-table-action"
            key={`${row.id}-action`}
            type="button"
            onClick={() =>
              onComposeReport({
                application: row.scope.application,
                applicationLabel:
                  reportApplications.find(
                    ({ key }) => key === row.scope.application,
                  )?.label ?? "业务报告",
                businessClassificationId: row.scope.businessClassificationId,
                businessClassificationLabel:
                  row.scope.businessClassificationLabel,
                product: row.scope.product,
                cultivar: row.scope.cultivar,
                reportTemplate: row.scope.reportTemplate,
                region: row.scope.region,
                regionLevel: row.scope.region.endsWith("市全域")
                  ? "地市级"
                  : "县级或指定范围",
                period: row.scope.period,
                frequency: row.scope.frequency,
                dataCutoff: row.scope.dataCutoff,
                dataVersion: row.scope.dataBatchId,
                dataBatchLabel: row.dataBatchLabel,
                author: "编制人员待确认",
                authorPost: row.authorPost,
                reviewer: "复核人员待确认",
                reviewerPost: row.reviewerPost,
              })
            }
          >
            继续编制
          </button>,
        ])}
      />
      {resumableReports.length === 0 && (
        <p className="report-workspace-note" role="status">
          当前没有需要继续编制的报告。
        </p>
      )}
    </div>
  );
}

function tableCsvHref(
  headings: readonly string[],
  rows: readonly (readonly string[])[],
) {
  const content = [headings, ...rows]
    .map((row) =>
      row
        .map((cell) => cell.replaceAll(",", "，").replaceAll(/\r?\n/g, " "))
        .join(","),
    )
    .join("\n");
  return `data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${content}`)}`;
}

function dutyBusiness(item: string) {
  return item.includes("产情") ? "产情监测" : "市场监测";
}

function DutyReports({
  permissionKeys,
}: {
  permissionKeys: readonly string[];
}) {
  const [view, setView] = useState<"weekly" | "monthly">("weekly");
  const [businessFilter, setBusinessFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const regions = Array.from(
    new Set(
      [...dutyWeeklyRows, ...dutyMonthlyRows].map(({ region }) => region),
    ),
  );
  const filteredWeeklyRows = dutyWeeklyRows.filter(
    (row) =>
      (!businessFilter || dutyBusiness(row.item) === businessFilter) &&
      (!regionFilter || row.region === regionFilter) &&
      (!statusFilter || row.status === statusFilter),
  );
  const filteredMonthlyRows = dutyMonthlyRows.filter((row) => {
    const weekly = dutyWeeklyRows.find(({ person }) => person === row.person);
    return (
      (!businessFilter ||
        (weekly && dutyBusiness(weekly.item) === businessFilter)) &&
      (!regionFilter || row.region === regionFilter) &&
      (!statusFilter || weekly?.status === statusFilter)
    );
  });
  const weeklyExportHref = tableCsvHref(
    [
      "责任人",
      "责任区域",
      "业务事项",
      "规定截止",
      "首次合格提交",
      "履责状态",
      "逾期时长",
      "审核结果",
    ],
    filteredWeeklyRows.map((row) => [
      row.person,
      row.region,
      row.item,
      row.deadline,
      row.firstQualifiedSubmission,
      row.status,
      row.overdueDuration,
      row.review,
    ]),
  );
  const monthlyExportHref = tableCsvHref(
    [
      "责任人",
      "责任区域",
      "应报",
      "按时",
      "逾期",
      "缺报",
      "退回",
      "按时率",
      "趋势",
    ],
    filteredMonthlyRows.map((row) => [
      row.person,
      row.region,
      row.expected,
      row.onTime,
      row.overdue,
      row.missing,
      row.returned,
      row.onTimeRate,
      row.trend,
    ]),
  );
  const responsibilityExportHref = tableCsvHref(
    [
      "区域",
      "业务事项",
      "频率",
      "责任人",
      "责任岗位",
      "审核人",
      "截止规则",
      "有效期",
      "状态",
    ],
    responsibilityAssignments.map((row) => [
      row.region,
      row.businessItem,
      row.frequency,
      row.responsiblePerson,
      row.responsiblePost,
      row.reviewer,
      row.deadlineRule,
      chinesePeriodRange(row.effectivePeriod),
      row.status,
    ]),
  );
  return (
    <div className="unified-workspace">
      {hasReportPermission(permissionKeys, "report.export") ? (
        <div className="report-local-actions" aria-label="履责报告导出">
          <a
            className="unified-button"
            download="责任周报.csv"
            href={weeklyExportHref}
          >
            导出责任周报
          </a>
          <a
            className="unified-button"
            download="责任月报.csv"
            href={monthlyExportHref}
          >
            导出责任月报
          </a>
        </div>
      ) : (
        <p className="report-permission-note" role="status">
          当前登录岗位没有导出履责报告的权限。
        </p>
      )}
      <WorkspaceFilterBar label="履责报告筛选条件">
        <label>
          <span>业务类型</span>
          <select
            aria-label="履责业务类型"
            value={businessFilter}
            onChange={(event) => setBusinessFilter(event.target.value)}
          >
            <option value="">全部业务</option>
            <option value="产情监测">产情监测</option>
            <option value="市场监测">市场监测</option>
          </select>
        </label>
        <label>
          <span>责任区域</span>
          <select
            aria-label="履责责任区域"
            value={regionFilter}
            onChange={(event) => setRegionFilter(event.target.value)}
          >
            <option value="">全部责任区域</option>
            {regions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>统计周期</span>
          <select
            aria-label="履责统计周期"
            value={view}
            onChange={(event) =>
              setView(event.target.value as "weekly" | "monthly")
            }
          >
            <option value="weekly">2026 年第 31 周</option>
            <option value="monthly">2026 年 7 月</option>
          </select>
        </label>
        <label>
          <span>履责状态</span>
          <select
            aria-label="履责状态"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">全部状态</option>
            {Array.from(
              new Set(dutyWeeklyRows.map(({ status }) => status)),
            ).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </WorkspaceFilterBar>
      <p className="report-workspace-note">
        本页监督是否按时完成；业务日报、周报、月报请在“业务报告”中生成。
      </p>
      <details aria-label="查看填报规则" className="workspace-policy-details">
        <summary>查看填报规则</summary>
        <WorkspaceTable
          columns={["规则事项", "执行规则", "说明"]}
          label="填报责任规则"
          rows={[
            [
              "责任归属",
              "一人一责区",
              "责任配置按人员、区域、业务和有效期生效",
            ],
            [
              "填写权限",
              "他人无权代填",
              "管理员可以催办和重派未来任务，不能代替责任人填写",
            ],
            ["任务频率", "每周填报一次", "按周生成任务并固定截止时间"],
            [
              "逾期规则",
              "逾期补填保留原逾期记录",
              "补报不覆盖截止快照，周报和月报均可追溯",
            ],
          ]}
        />
      </details>
      <WorkspaceInlineStats
        label="本周履责指标"
        items={[
          {
            label: "当前记录",
            value: `${String(filteredWeeklyRows.length)} 项`,
            note: "与当前筛选条件一致",
          },
          {
            label: "按时完成",
            value: `${String(filteredWeeklyRows.filter(({ status }) => status === "按时完成").length)} 项`,
            note: "首次合格提交在截止前",
            tone: "good",
          },
          {
            label: "截止未提交",
            value: `${String(filteredWeeklyRows.filter(({ status }) => status === "截止未提交").length)} 项`,
            note: "逾期状态已经固定",
            tone: "danger",
          },
          {
            label: "逾期后补填",
            value: `${String(filteredWeeklyRows.filter(({ status }) => status === "逾期补填").length)} 项`,
            note: "原逾期记录继续保留",
            tone: "warning",
          },
        ]}
      />
      <WorkspaceTableToolbar
        actions={
          <div className="unified-mode-switch" aria-label="履责统计周期">
            <button
              aria-pressed={view === "weekly"}
              className={view === "weekly" ? "is-active" : undefined}
              type="button"
              onClick={() => setView("weekly")}
            >
              周度履责
            </button>
            <button
              aria-pressed={view === "monthly"}
              className={view === "monthly" ? "is-active" : undefined}
              type="button"
              onClick={() => setView("monthly")}
            >
              月度履责
            </button>
          </div>
        }
        note={
          view === "weekly"
            ? "以任务截止快照为准，显示首次合格提交和补填情况。"
            : "按责任人汇总应报、按时、逾期、缺报和退回次数。"
        }
        title={view === "weekly" ? "第 31 周履责明细" : "2026 年 7 月履责汇总"}
      />
      {view === "weekly" ? (
        <WorkspaceTable
          columns={[
            "责任人",
            "责任区域",
            "业务事项",
            "规定截止",
            "首次合格提交",
            "履责状态",
            "逾期时长",
            "审核结果",
          ]}
          label="履责监督台账"
          rows={filteredWeeklyRows.map((row) => [
            <strong key={`${row.person}-${row.region}`}>{row.person}</strong>,
            row.region,
            row.item,
            row.deadline,
            row.firstQualifiedSubmission,
            <WorkspaceStatus
              key={`${row.person}-${row.status}`}
              tone={toneFor(row.status)}
            >
              {row.status}
            </WorkspaceStatus>,
            row.overdueDuration,
            row.review,
          ])}
        />
      ) : (
        <WorkspaceTable
          columns={[
            "责任人",
            "责任区域",
            "应报",
            "按时",
            "逾期",
            "缺报",
            "退回",
            "按时率",
            "趋势",
          ]}
          label="月度履责记录"
          rows={filteredMonthlyRows.map((row) => [
            <strong key={`${row.person}-${row.region}`}>{row.person}</strong>,
            row.region,
            row.expected,
            row.onTime,
            row.overdue,
            row.missing,
            row.returned,
            row.onTimeRate,
            row.trend,
          ])}
        />
      )}
      <WorkspaceTableToolbar
        actions={
          hasReportPermission(permissionKeys, "report.export") ? (
            <a
              className="workspace-toolbar-link"
              download="有效责任关系.csv"
              href={responsibilityExportHref}
            >
              导出责任配置
            </a>
          ) : undefined
        }
        note="责任配置决定任务归属和填写权限；历史配置按有效期保留。"
        title="有效责任关系"
      />
      <WorkspaceTable
        columns={[
          "区域",
          "业务事项",
          "频率",
          "责任人",
          "责任岗位",
          "审核人",
          "截止规则",
          "有效期",
          "状态",
        ]}
        label="填报责任配置"
        rows={responsibilityAssignments.map((row) => [
          row.region,
          row.businessItem,
          row.frequency,
          <strong key={`${row.id}-person`}>{row.responsiblePerson}</strong>,
          row.responsiblePost,
          row.reviewer,
          row.deadlineRule,
          chinesePeriodRange(row.effectivePeriod),
          <WorkspaceStatus key={`${row.id}-state`} tone={toneFor(row.status)}>
            {row.status}
          </WorkspaceStatus>,
        ])}
      />
    </div>
  );
}

function ReportAuditList({ report }: { report: BusinessReportRecord }) {
  return (
    <section aria-label="报告审计记录" className="report-audit-trail">
      <h3>审计记录</h3>
      <ol>
        {report.auditTrail.map((event) => (
          <li key={event.id}>
            <strong>{event.action}</strong>
            <span>
              {event.actorPost} · {workflowDateTime(event.occurredAt)}
            </span>
            {event.reason && <p>{event.reason}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function ReviewWorkspace({
  workflow,
  actorPost,
  permissionKeys,
  requestedReportId,
  operationalScope,
  queryAllowed,
}: {
  workflow: BusinessReportWorkflow;
  actorPost: string;
  permissionKeys: readonly string[];
  requestedReportId?: string;
  operationalScope?: OperationalScope;
  queryAllowed: boolean;
}) {
  const reports = authorizedReports(
    useSyncExternalStore(workflow.subscribe, workflow.getSnapshot),
    operationalScope,
    queryAllowed,
  );
  const pendingReports = reports.filter(({ status }) => status === "待复核");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    requestedReportId ?? null,
  );
  const [returnReason, setReturnReason] = useState("");
  const [message, setMessage] = useState("");
  const selectedReport = reports.find(({ id }) => id === selectedReportId);
  const isAssignedReviewer =
    selectedReport !== undefined &&
    selectedReport.currentHandlerPost === actorPost &&
    selectedReport.reviewerPost === actorPost;
  const canApprove =
    isAssignedReviewer &&
    hasReportPermission(permissionKeys, "report.review.approve");
  const canReturn =
    isAssignedReviewer &&
    hasReportPermission(permissionKeys, "report.review.return");

  function approveReport() {
    if (!selectedReport) return;
    const result = workflow.transition(selectedReport.id, {
      action: "复核通过",
      actorPost,
    });
    setMessage(
      result.ok ? "复核已通过，报告已转交报告发布岗。" : result.reason,
    );
  }

  function returnReport() {
    if (!selectedReport) return;
    const result = workflow.transition(selectedReport.id, {
      action: "退回修改",
      actorPost,
      reason: returnReason,
    });
    setMessage(
      result.ok ? "报告已退回编制岗位，并已记录退回原因。" : result.reason,
    );
  }

  return (
    <div className="unified-workspace">
      <WorkspaceTableToolbar
        note="复核不修改原始业务值；数据问题退回所属业务重新审核。"
        title="待复核报告"
      />
      <WorkspaceTable
        columns={[
          "报告",
          "业务范围",
          "报告期间",
          "采用数据",
          "当前处理岗位",
          "最近更新",
          "操作",
        ]}
        label="待复核报告"
        rows={pendingReports.map((report) => [
          <strong key={`${report.id}-title`}>{report.title}</strong>,
          `${report.scope.region} · ${report.scope.product}`,
          displayReportPeriod(report.scope.period),
          report.dataBatchLabel,
          report.currentHandlerPost,
          workflowDateTime(report.updatedAt),
          <button
            aria-label={`处理${report.title}`}
            className="unified-table-action"
            key={`${report.id}-review`}
            type="button"
            onClick={() => {
              setSelectedReportId(report.id);
              setReturnReason("");
              setMessage("");
            }}
          >
            处理
          </button>,
        ])}
      />
      {pendingReports.length === 0 && (
        <p className="report-workspace-note" role="status">
          当前没有等待复核的报告。
        </p>
      )}
      {selectedReport && (
        <aside
          aria-label="报告复核详情"
          className="report-ledger-detail report-workflow-detail"
          role="region"
        >
          <header>
            <div>
              <small>报告复核</small>
              <h2>{selectedReport.title}</h2>
            </div>
            <button type="button" onClick={() => setSelectedReportId(null)}>
              关闭详情
            </button>
          </header>
          <dl>
            <div>
              <dt>业务范围</dt>
              <dd>
                {selectedReport.scope.region} · {selectedReport.scope.product}
              </dd>
            </div>
            <div>
              <dt>报告期间</dt>
              <dd>{displayReportPeriod(selectedReport.scope.period)}</dd>
            </div>
            <div>
              <dt>数据来源</dt>
              <dd>{selectedReport.dataSourceLabel}</dd>
            </div>
            <div>
              <dt>当前状态</dt>
              <dd>{selectedReport.status}</dd>
            </div>
          </dl>
          <label className="report-workflow-reason">
            <span>退回原因</span>
            <textarea
              aria-label="退回原因"
              placeholder="退回时必须填写具体业务原因"
              value={returnReason}
              disabled={!canReturn}
              onChange={(event) => setReturnReason(event.target.value)}
            />
          </label>
          <div className="report-workflow-actions">
            <button
              disabled={selectedReport.status !== "待复核" || !canApprove}
              type="button"
              onClick={approveReport}
            >
              复核通过
            </button>
            <button
              disabled={
                selectedReport.status !== "待复核" ||
                !canReturn ||
                !returnReason.trim()
              }
              type="button"
              onClick={returnReport}
            >
              退回修改
            </button>
          </div>
          {!isAssignedReviewer && (
            <p className="report-permission-note" role="status">
              当前登录岗位“{actorPost}”不是本报告的复核处理岗位，只能查看。
            </p>
          )}
          {isAssignedReviewer && (!canApprove || !canReturn) && (
            <p className="report-permission-note" role="status">
              当前登录岗位缺少报告复核操作权限，只能查看。
            </p>
          )}
          {message && <p role="status">{message}</p>}
          {hasReportPermission(permissionKeys, "report.audit.read") ? (
            <ReportAuditList report={selectedReport} />
          ) : (
            <p className="report-permission-note" role="status">
              当前登录岗位没有查看报告审计记录的权限。
            </p>
          )}
        </aside>
      )}
    </div>
  );
}

function DistributionWorkspace({
  workflow,
  actorPost,
  permissionKeys,
  requestedReportId,
  operationalScope,
  queryAllowed,
}: {
  workflow: BusinessReportWorkflow;
  actorPost: string;
  permissionKeys: readonly string[];
  requestedReportId?: string;
  operationalScope?: OperationalScope;
  queryAllowed: boolean;
}) {
  const reports = authorizedReports(
    useSyncExternalStore(workflow.subscribe, workflow.getSnapshot),
    operationalScope,
    queryAllowed,
  );
  const distributionReports = reports.filter(
    ({ status }) => status === "待发布" || status === "已发布",
  );
  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    requestedReportId ?? null,
  );
  const [message, setMessage] = useState("");
  const selectedReport = reports.find(({ id }) => id === selectedReportId);
  const canPublish =
    selectedReport?.status === "待发布" &&
    selectedReport.currentHandlerPost === actorPost &&
    selectedReport.publisherPost === actorPost &&
    hasReportPermission(permissionKeys, "report.publish.confirm");

  function publishReport() {
    if (!selectedReport) return;
    const result = workflow.transition(selectedReport.id, {
      action: "发布报告",
      actorPost,
    });
    setMessage(
      result.ok
        ? "报告已正式发布，发布动作和处理岗位已写入审计记录。"
        : result.reason,
    );
  }

  return (
    <div className="unified-workspace">
      <WorkspaceTableToolbar
        note="仅复核通过并进入待发布状态的报告可以确认发布。"
        title="报告分发任务"
      />
      <WorkspaceTable
        columns={[
          "报告",
          "发布范围",
          "报告期间",
          "数据来源",
          "状态",
          "最近更新",
          "操作",
        ]}
        label="报告分发任务"
        rows={distributionReports.map((report) => [
          <strong key={`${report.id}-title`}>{report.title}</strong>,
          report.scope.region,
          displayReportPeriod(report.scope.period),
          report.dataSourceLabel,
          <WorkspaceStatus
            key={`${report.id}-status`}
            tone={toneFor(report.status)}
          >
            {report.status}
          </WorkspaceStatus>,
          workflowDateTime(report.updatedAt),
          <button
            aria-label={`查看${report.title}发布详情`}
            className="unified-table-action"
            key={`${report.id}-distribution`}
            type="button"
            onClick={() => {
              setSelectedReportId(report.id);
              setMessage("");
            }}
          >
            查看发布详情
          </button>,
        ])}
      />
      {distributionReports.length === 0 && (
        <p className="report-workspace-note" role="status">
          当前没有待发布或已发布报告。
        </p>
      )}
      {selectedReport && (
        <aside
          aria-label="报告发布详情"
          className="report-ledger-detail report-workflow-detail"
          role="region"
        >
          <header>
            <div>
              <small>发布与分发</small>
              <h2>{selectedReport.title}</h2>
            </div>
            <button type="button" onClick={() => setSelectedReportId(null)}>
              关闭详情
            </button>
          </header>
          <dl>
            <div>
              <dt>发布范围</dt>
              <dd>{selectedReport.scope.region}</dd>
            </div>
            <div>
              <dt>报告状态</dt>
              <dd>{selectedReport.status}</dd>
            </div>
            <div>
              <dt>当前处理岗位</dt>
              <dd>{selectedReport.currentHandlerPost}</dd>
            </div>
            <div>
              <dt>数据来源</dt>
              <dd>{selectedReport.dataSourceLabel}</dd>
            </div>
          </dl>
          <div className="report-workflow-actions">
            <button
              disabled={!canPublish}
              type="button"
              onClick={publishReport}
            >
              确认发布
            </button>
          </div>
          {selectedReport.status === "待发布" && !canPublish && (
            <p className="report-permission-note" role="status">
              当前登录岗位“{actorPost}”无权发布本报告，只能查看。
            </p>
          )}
          {selectedReport.status === "已发布" && (
            <p>该报告已发布，后续修改必须创建修订草稿并保留原报告。</p>
          )}
          {message && <p role="status">{message}</p>}
          {hasReportPermission(permissionKeys, "report.audit.read") ? (
            <ReportAuditList report={selectedReport} />
          ) : (
            <p className="report-permission-note" role="status">
              当前登录岗位没有查看报告审计记录的权限。
            </p>
          )}
        </aside>
      )}
    </div>
  );
}

function revisionDirectoryHref(reports: readonly BusinessReportRecord[]) {
  const headings = [
    "报告名称",
    "报告状态",
    "业务范围",
    "报告期间",
    "创建时间",
    "最近更新时间",
    "当前处理岗位",
  ];
  const lines = reports.map((report) => [
    report.title,
    report.status,
    `${report.scope.region} · ${report.scope.product}`,
    displayReportPeriod(report.scope.period),
    workflowDateTime(report.createdAt),
    workflowDateTime(report.updatedAt),
    report.currentHandlerPost,
  ]);
  const content = [headings, ...lines]
    .map((line) => line.map((cell) => cell.replaceAll(",", "，")).join(","))
    .join("\n");
  return `data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${content}`)}`;
}

function escapeReportText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function comprehensiveReportHref(
  regionLabel: string,
  productLabel: string,
  period: string,
  datasets: readonly (typeof approvedBusinessReportDatasets)[number][],
) {
  const sections = datasets
    .map(
      (dataset) =>
        `<section><h2>${escapeReportText(
          reportApplications.find(({ key }) => key === dataset.application)
            ?.label ?? "业务报告",
        )}</h2><p>${escapeReportText(dataset.summary)}</p><table><thead><tr><th>指标</th><th>本期值</th><th>说明</th></tr></thead><tbody>${dataset.indicators
          .map(
            (indicator) =>
              `<tr><td>${escapeReportText(indicator.label)}</td><td>${escapeReportText(indicator.value)}</td><td>${escapeReportText(indicator.note)}</td></tr>`,
          )
          .join("")}</tbody></table></section>`,
    )
    .join("");
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeReportText(
    regionLabel,
  )}${escapeReportText(productLabel)}综合经营报告</title><style>body{max-width:1000px;margin:36px auto;color:#173652;font:15px/1.7 "Microsoft YaHei",sans-serif}h1{text-align:center}h2{margin-top:28px;border-bottom:2px solid #177bbb;padding-bottom:8px}table{width:100%;border-collapse:collapse}th,td{padding:9px;border:1px solid #bed0dc;text-align:left}th{background:#edf5fa}.meta{text-align:center;color:#647e91}</style></head><body><h1>${escapeReportText(
    regionLabel,
  )}${escapeReportText(productLabel)}综合经营报告</h1><p class="meta">${escapeReportText(
    period,
  )} · 采用已核定业务数据</p>${sections}</body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function ComprehensiveReports({
  onComposeReport,
  permissionKeys,
  queryAllowed,
}: {
  onComposeReport: (context: BusinessReportContext) => void;
  permissionKeys: readonly string[];
  queryAllowed: boolean;
}) {
  const formalScope = useFormalWorkspaceScope();
  const authorization =
    formalScope?.scope.authorization ?? prototypeMasterDataAuthorization;
  const masterData = filterPlatformMasterDataByAuthorization(authorization);
  const [regionId, setRegionId] = useState<EnterpriseRegionId | "">("");
  const [productId, setProductId] = useState("");
  const [frequency, setFrequency] = useState<BusinessReportFrequency | "">("");
  const [period, setPeriod] = useState("");
  const region = getEnterpriseScopeRegion(regionId);
  const product = masterData.products.find(({ id }) => id === productId);
  const productDatasets = approvedBusinessReportDatasets.filter(
    (dataset) =>
      (!region || dataset.region === region.label) &&
      (!product || dataset.product === product.label),
  );
  const periodOptions = [
    ...new Set(
      productDatasets
        .filter((dataset) => !frequency || dataset.frequency === frequency)
        .map(({ period: label }) => label),
    ),
  ];
  const includedDatasets = approvedBusinessReportDatasets.filter(
    (dataset) =>
      Boolean(region && product && frequency && period) &&
      dataset.region === region?.label &&
      dataset.product === product?.label &&
      dataset.frequency === frequency &&
      dataset.period === period &&
      new Set<string>(authorization.authorizedReleaseVersionIds).has(
        dataset.dataBatchId,
      ),
  );
  const canExport =
    queryAllowed &&
    includedDatasets.length >= 2 &&
    hasReportPermission(permissionKeys, "report.export") &&
    region !== null &&
    product !== undefined;

  return (
    <div className="enterprise-ledger-workbench">
      <div className="enterprise-ledger-workbench__breadcrumb">
        报表中心 / 综合报告
      </div>
      <section
        aria-label="综合报告生成条件"
        className="enterprise-ledger-query enterprise-ledger-query--report"
        role="search"
      >
        <label>
          <span>报告地区</span>
          <ReportRegionSelect
            authorizedRegionIds={authorization.authorizedRegionIds}
            regionId={regionId}
            onChange={(next) => {
              setRegionId(next);
              setPeriod("");
            }}
          />
        </label>
        <label>
          <span>产品或作物</span>
          <select
            aria-label="综合报告产品"
            value={productId}
            onChange={(event) => {
              setProductId(event.target.value);
              setPeriod("");
            }}
          >
            <option value="">请选择产品或作物</option>
            {masterData.products
              .filter((item) =>
                approvedBusinessReportDatasets.some(
                  (dataset) => dataset.product === item.label,
                ),
              )
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span>报告类型</span>
          <select
            aria-label="综合报告类型"
            value={frequency}
            onChange={(event) => {
              setFrequency(event.target.value as BusinessReportFrequency | "");
              setPeriod("");
            }}
          >
            <option value="">请选择报告类型</option>
            <option value="日报">日报</option>
            <option value="周报">周报</option>
            <option value="月报">月报</option>
          </select>
        </label>
        <label>
          <span>报告期间</span>
          <select
            aria-label="综合报告期间"
            disabled={!frequency}
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            <option value="">请选择报告期间</option>
            {periodOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <div className="enterprise-ledger-query__actions">
          <button className="is-primary" type="button">
            查询
          </button>
          <button
            type="button"
            onClick={() => {
              setRegionId("");
              setProductId("");
              setFrequency("");
              setPeriod("");
            }}
          >
            重置
          </button>
        </div>
      </section>

      <header className="enterprise-ledger-title">
        <h1>综合经营报告</h1>
        <p>
          {region?.label ?? "请选择报告地区"} ·{" "}
          {product?.label ?? "请选择产品或作物"} · {period || "请选择报告期间"}
        </p>
      </header>

      <section
        aria-label="综合报告数据清单"
        className="enterprise-ledger-table"
      >
        <div className="enterprise-ledger-table__toolbar">
          <strong>已纳入 {includedDatasets.length} 项已核定业务数据</strong>
          <div>
            {region && product && (
              <a
                aria-disabled={!canExport}
                className={
                  canExport ? "unified-button" : "unified-button is-disabled"
                }
                download={`${region.label}-${product.label}-${period || "本期"}-综合经营报告.html`}
                href={
                  canExport
                    ? comprehensiveReportHref(
                        region.label,
                        product.label,
                        period,
                        includedDatasets,
                      )
                    : undefined
                }
              >
                生成综合报告
              </a>
            )}
          </div>
        </div>
        <div className="enterprise-ledger-table__scroll" tabIndex={0}>
          <table aria-label="综合报告数据清单">
            <thead>
              <tr>
                <th>来源业务</th>
                <th>业务分类</th>
                <th>地区</th>
                <th>产品与品种</th>
                <th>报告类型</th>
                <th>报告期间</th>
                <th>采用数据</th>
                <th>数据截止</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {includedDatasets.map((dataset) => {
                const definition = reportApplications.find(
                  ({ key }) => key === dataset.application,
                );
                const classification = masterData.businessClassifications.find(
                  ({ id }) => id === dataset.businessClassificationId,
                );
                return (
                  <tr
                    key={`${dataset.application}:${dataset.product}:${dataset.dataBatchId}`}
                  >
                    <th scope="row">{definition?.label ?? "业务数据"}</th>
                    <td>{classification?.label ?? "业务分类待维护"}</td>
                    <td>{dataset.region}</td>
                    <td>
                      {dataset.product} · {dataset.cultivar}
                    </td>
                    <td>{dataset.frequency}</td>
                    <td>{dataset.period}</td>
                    <td>{dataset.dataBatchLabel}</td>
                    <td>{chineseDateTime(dataset.dataCutoff)}</td>
                    <td>
                      <button
                        className="enterprise-ledger-row-action"
                        type="button"
                        onClick={() =>
                          onComposeReport(
                            buildReportContext({
                              application: dataset.application,
                              businessClassificationId:
                                dataset.businessClassificationId,
                              businessClassificationLabel:
                                classification?.label,
                              product: dataset.product,
                              cultivar: dataset.cultivar,
                              reportTemplate: dataset.reportTemplate,
                              region: dataset.region,
                              regionLevel:
                                getEnterpriseScopeRegion(regionId)?.level,
                              period: dataset.period,
                              frequency: dataset.frequency,
                              dataVersion: dataset.dataBatchId,
                              dataBatchLabel: dataset.dataBatchLabel,
                              authorPost: "区域数据管理员",
                              dataCutoff: dataset.dataCutoff,
                              sectionKeys: dataset.chapters.map(
                                ({ title }) => title,
                              ),
                            }),
                          )
                        }
                      >
                        查看分项报告
                      </button>
                    </td>
                  </tr>
                );
              })}
              {includedDatasets.length === 0 && (
                <tr>
                  <td className="enterprise-ledger-table__empty" colSpan={9}>
                    请选择地区、产品、报告类型和期间；系统只纳入同范围已核定数据。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function VersionWorkspace({
  workflow,
  actorPost,
  permissionKeys,
  operationalScope,
  queryAllowed,
}: {
  workflow: BusinessReportWorkflow;
  actorPost: string;
  permissionKeys: readonly string[];
  operationalScope?: OperationalScope;
  queryAllowed: boolean;
}) {
  const reports = authorizedReports(
    useSyncExternalStore(workflow.subscribe, workflow.getSnapshot),
    operationalScope,
    queryAllowed,
  );
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [revisionReason, setRevisionReason] = useState("");
  const [replacementReason, setReplacementReason] = useState("");
  const [message, setMessage] = useState("");
  const selectedReport = reports.find(({ id }) => id === selectedReportId);
  const publishedRevision = selectedReport
    ? reports.find(
        (report) =>
          report.revisionOfReportId === selectedReport.id &&
          report.status === "已发布" &&
          !report.replacesReportId,
      )
    : undefined;
  const canCreateRevision =
    selectedReport?.status === "已发布" &&
    selectedReport.authorPost === actorPost &&
    hasReportPermission(permissionKeys, "report.revision.create");
  const canConfirmReplacement =
    selectedReport?.status === "已发布" &&
    selectedReport.publisherPost === actorPost &&
    hasReportPermission(permissionKeys, "report.replacement.confirm");

  function createRevision() {
    if (!selectedReport) return;
    const result = workflow.createRevision(selectedReport.id, {
      actorPost,
      reason: revisionReason,
    });
    setMessage(
      result.ok
        ? "修订草稿已创建，原报告保持有效；修订稿须重新复核发布。"
        : result.reason,
    );
    if (result.ok) setRevisionReason("");
  }

  function confirmReplacement() {
    if (!selectedReport || !publishedRevision) return;
    const result = workflow.transition(selectedReport.id, {
      action: "确认替代",
      actorPost,
      relatedReportId: publishedRevision.id,
      reason: replacementReason,
    });
    setMessage(
      result.ok
        ? "替代关系已确认，原报告已标记为已替代并继续保留。"
        : result.reason,
    );
    if (result.ok) setReplacementReason("");
  }

  if (!hasReportPermission(permissionKeys, "report.audit.read")) {
    return (
      <div className="unified-workspace">
        <WorkspaceHeader
          eyebrow="报表中心 / 修订记录"
          summary="查询报告生成、复核、发布和替代全过程，已发布报告不可覆盖。"
          title="报告修订记录"
        />
        <p className="report-permission-note" role="status">
          当前登录岗位“{actorPost}”没有查看报告沿革和审计记录的权限。
        </p>
      </div>
    );
  }

  return (
    <div className="unified-workspace">
      <WorkspaceHeader
        actions={
          hasReportPermission(permissionKeys, "report.export") ? (
            <a
              className="unified-button"
              download="报告修订记录.csv"
              href={revisionDirectoryHref(reports)}
            >
              导出修订记录
            </a>
          ) : undefined
        }
        eyebrow="报表中心 / 修订记录"
        summary="查询报告生成、复核、发布和替代全过程，已发布报告不可覆盖。"
        title="报告修订记录"
      />
      <WorkspaceTableToolbar
        note="同一报告的修订稿通过替代关系关联，原发布报告继续留痕。"
        title="正式报告沿革"
      />
      <WorkspaceTable
        columns={[
          "报告",
          "业务范围",
          "报告期间",
          "创建时间",
          "最近更新时间",
          "当前效力",
          "操作",
        ]}
        label="报告修订记录"
        rows={reports.map((report) => [
          <strong key={`${report.id}-title`}>{report.title}</strong>,
          `${report.scope.region} · ${report.scope.product}`,
          displayReportPeriod(report.scope.period),
          workflowDateTime(report.createdAt),
          workflowDateTime(report.updatedAt),
          <WorkspaceStatus
            key={`${report.id}-status`}
            tone={toneFor(report.status)}
          >
            {report.status === "已发布" ? "当前有效" : report.status}
          </WorkspaceStatus>,
          <button
            aria-label={`查看${report.title}报告沿革`}
            className="unified-table-action"
            key={`${report.id}-history`}
            type="button"
            onClick={() => {
              setSelectedReportId(report.id);
              setRevisionReason("");
              setReplacementReason("");
              setMessage("");
            }}
          >
            查看沿革
          </button>,
        ])}
      />
      {selectedReport && (
        <aside
          aria-label="报告修订详情"
          className="report-ledger-detail report-workflow-detail"
          role="region"
        >
          <header>
            <div>
              <small>报告修订与替代</small>
              <h2>{selectedReport.title}</h2>
            </div>
            <button type="button" onClick={() => setSelectedReportId(null)}>
              关闭详情
            </button>
          </header>
          <dl>
            <div>
              <dt>当前状态</dt>
              <dd>{selectedReport.status}</dd>
            </div>
            <div>
              <dt>创建时间</dt>
              <dd>{workflowDateTime(selectedReport.createdAt)}</dd>
            </div>
            <div>
              <dt>最近更新时间</dt>
              <dd>{workflowDateTime(selectedReport.updatedAt)}</dd>
            </div>
            <div>
              <dt>当前处理岗位</dt>
              <dd>{selectedReport.currentHandlerPost}</dd>
            </div>
          </dl>
          <label className="report-workflow-reason">
            <span>修订原因</span>
            <textarea
              aria-label="修订原因"
              placeholder="创建修订草稿前必须说明原因"
              value={revisionReason}
              onChange={(event) => setRevisionReason(event.target.value)}
            />
          </label>
          <div className="report-workflow-actions">
            <button
              disabled={!canCreateRevision || !revisionReason.trim()}
              title={
                selectedReport.status !== "已发布"
                  ? "只有已发布报告可以创建修订草稿"
                  : !canCreateRevision
                    ? "当前登录岗位无权创建本报告的修订草稿"
                    : undefined
              }
              type="button"
              onClick={createRevision}
            >
              创建修订草稿
            </button>
          </div>
          <label className="report-workflow-reason">
            <span>替代原因</span>
            <textarea
              aria-label="替代原因"
              placeholder="修订报告发布后填写替代原因"
              value={replacementReason}
              onChange={(event) => setReplacementReason(event.target.value)}
            />
          </label>
          <div className="report-workflow-actions">
            <button
              disabled={
                !canConfirmReplacement ||
                !publishedRevision ||
                !replacementReason.trim()
              }
              title={
                !canConfirmReplacement
                  ? "当前登录岗位无权确认本报告的替代关系"
                  : publishedRevision
                    ? undefined
                    : "尚无完成复核并发布的修订报告"
              }
              type="button"
              onClick={confirmReplacement}
            >
              确认替代原报告
            </button>
          </div>
          {!publishedRevision && (
            <p>尚无完成复核并发布的修订报告，暂不能确认替代关系。</p>
          )}
          {message && <p role="status">{message}</p>}
          <ReportAuditList report={selectedReport} />
        </aside>
      )}
    </div>
  );
}

export function ReportCenterWorkspace({
  section,
  onComposeReport,
  onQuickExport,
  workflow = getFallbackPrototypeBusinessReportWorkflow(),
  actorPost = "区域数据管理员",
  permissionKeys = allBusinessReportPermissions,
  requestedDataBatchId,
  requestedWorkItemId,
  queryAllowed = true,
  workItems,
}: {
  section: ReportingSection;
  onComposeReport: (context: BusinessReportContext) => void;
  onQuickExport?: (
    kind: QuickReportExportKind,
    artifact: BusinessReportArtifact,
  ) => void;
  workflow?: BusinessReportWorkflow;
  actorPost?: string;
  permissionKeys?: readonly string[];
  requestedDataBatchId?: string;
  requestedWorkItemId?: string;
  queryAllowed?: boolean;
  workItems?: readonly BusinessWorkItem[];
}) {
  const formalScope = useFormalWorkspaceScope();
  const operationalScope = formalScope?.scope;
  const initializationError = workflow.getInitializationError();
  if (initializationError) {
    return (
      <div className="unified-workspace">
        <WorkspaceHeader
          eyebrow="报表中心 / 数据恢复"
          summary="报告记录校验未通过，系统已停止报告编制、复核、发布和修订操作。"
          title="报告记录暂时无法读取"
        />
        <section className="report-generation-blocker" role="alert">
          <strong>报告记录暂时无法读取</strong>
          <p>{initializationError}</p>
          <p>原始内容已保留，请联系系统管理员恢复后再继续操作。</p>
        </section>
      </div>
    );
  }
  const visibleReports = authorizedReports(
    workflow.getSnapshot(),
    operationalScope,
    queryAllowed,
  );
  const requestedWorkItemIsAuthorized =
    !requestedWorkItemId ||
    !workItems ||
    (operationalScope
      ? projectDomainTasks(workItems, {
          domain: "reporting",
          scope: operationalScope,
          queryAllowed,
          availablePeriodKeys: [
            ...new Set(workItems.map(({ periodKey }) => periodKey)),
          ],
          workId: requestedWorkItemId,
        }).length === 1
      : workItems.some(
          ({ workId, domain }) =>
            workId === requestedWorkItemId && domain === "reporting",
        ));
  const requestedWorkItem =
    requestedWorkItemId && requestedWorkItemIsAuthorized
      ? resolveBusinessReportWorkItem(requestedWorkItemId, visibleReports)
      : null;
  if (requestedWorkItemId && !requestedWorkItem) {
    return (
      <div className="unified-workspace">
        <WorkspaceHeader
          eyebrow="报表中心 / 任务定位"
          summary="系统根据已登记的报告任务和业务范围查找对应报告，不按报告名称模糊匹配。"
          title="报告任务无法定位"
        />
        <section className="report-generation-blocker" role="alert">
          <strong>未找到该报告任务对应的报告</strong>
          <p>请核对任务关联关系，或联系报告管理员补充关联信息。</p>
        </section>
      </div>
    );
  }
  if (requestedWorkItem) {
    return (
      <ReportReviewDistribution
        actorPost={actorPost}
        initialSubview={requestedWorkItem.target}
        permissionKeys={permissionKeys}
        requestedReportId={requestedWorkItem.report.id}
        operationalScope={operationalScope}
        queryAllowed={queryAllowed}
        workflow={workflow}
      />
    );
  }
  if (section === "compose")
    return (
      <ReportCompose
        actorPost={actorPost}
        onComposeReport={onComposeReport}
        onQuickExport={onQuickExport}
        permissionKeys={permissionKeys}
        requestedDataBatchId={requestedDataBatchId}
        queryAllowed={queryAllowed}
        workflow={workflow}
      />
    );
  if (section === "comprehensive")
    return (
      <ComprehensiveReports
        onComposeReport={onComposeReport}
        permissionKeys={permissionKeys}
        queryAllowed={queryAllowed}
      />
    );
  if (section === "review-distribution")
    return (
      <ReportReviewDistribution
        actorPost={actorPost}
        permissionKeys={permissionKeys}
        operationalScope={operationalScope}
        queryAllowed={queryAllowed}
        workflow={workflow}
      />
    );
  return (
    <VersionWorkspace
      actorPost={actorPost}
      permissionKeys={permissionKeys}
      operationalScope={operationalScope}
      queryAllowed={queryAllowed}
      workflow={workflow}
    />
  );
}

function ReportReviewDistribution({
  workflow,
  actorPost,
  permissionKeys,
  initialSubview = "review",
  requestedReportId,
  operationalScope,
  queryAllowed,
}: {
  workflow: BusinessReportWorkflow;
  actorPost: string;
  permissionKeys: readonly string[];
  initialSubview?: "review" | "distribution";
  requestedReportId?: string;
  operationalScope?: OperationalScope;
  queryAllowed: boolean;
}) {
  const [subview, setSubview] = useState<"review" | "distribution">(
    initialSubview,
  );
  return (
    <div>
      <WorkspaceHeader
        eyebrow="报表中心 / 报告流转"
        summary={
          subview === "review"
            ? "依据报告的业务范围、数据来源和审核记录完成复核。"
            : "仅发布已复核通过的报告，并保留发布动作和处理岗位。"
        }
        title={subview === "review" ? "报告复核" : "发布与分发"}
      />
      <WorkspaceTabs
        label="报告复核与分发子视图"
        active={subview}
        onChange={(key) => setSubview(key as typeof subview)}
        tabs={[
          { key: "review", label: "报告复核" },
          { key: "distribution", label: "报告分发" },
        ]}
      />
      <div
        aria-labelledby={`报告复核与分发子视图-${subview}-tab`}
        id={`报告复核与分发子视图-${subview}-panel`}
        role="tabpanel"
      >
        {subview === "review" ? (
          <ReviewWorkspace
            actorPost={actorPost}
            permissionKeys={permissionKeys}
            requestedReportId={requestedReportId}
            operationalScope={operationalScope}
            queryAllowed={queryAllowed}
            workflow={workflow}
          />
        ) : (
          <DistributionWorkspace
            actorPost={actorPost}
            permissionKeys={permissionKeys}
            requestedReportId={requestedReportId}
            operationalScope={operationalScope}
            queryAllowed={queryAllowed}
            workflow={workflow}
          />
        )}
      </div>
    </div>
  );
}

function ReportCompose({
  onComposeReport,
  onQuickExport,
  workflow,
  actorPost,
  permissionKeys,
  requestedDataBatchId,
  queryAllowed,
}: {
  onComposeReport: (context: BusinessReportContext) => void;
  onQuickExport?: (
    kind: QuickReportExportKind,
    artifact: BusinessReportArtifact,
  ) => void;
  workflow: BusinessReportWorkflow;
  actorPost: string;
  permissionKeys: readonly string[];
  requestedDataBatchId?: string;
  queryAllowed: boolean;
}) {
  const [subview, setSubview] = useState<"business" | "duty">("business");
  return (
    <div>
      <WorkspaceHeader
        actions={
          subview === "business" ? (
            <details
              aria-label="报告口径说明"
              className="workspace-header-guidance"
            >
              <summary>报告口径说明</summary>
              <p>
                报告只使用当前生成条件对应的已核定数据；业务、地区、产品、品种、期间、报告频率、数据截止、采用数据或章节发生变化时，必须重新确认。
              </p>
            </details>
          ) : undefined
        }
        eyebrow="报表中心 / 报告编制"
        summary={
          subview === "business"
            ? "选择完整业务范围生成报告，保存后进入可追溯的复核发布流程。"
            : "监督填报责任和完成情况，业务数据仍由所属业务工作台维护。"
        }
        title={subview === "business" ? "业务报告" : "履责报告"}
      />
      <WorkspaceTabs
        label="报告编制子视图"
        active={subview}
        onChange={(key) => setSubview(key as typeof subview)}
        tabs={[
          { key: "business", label: "业务报告" },
          { key: "duty", label: "履责报告" },
        ]}
      />
      <div
        aria-labelledby={`报告编制子视图-${subview}-tab`}
        id={`报告编制子视图-${subview}-panel`}
        role="tabpanel"
      >
        {subview === "duty" ? (
          <DutyReports permissionKeys={permissionKeys} />
        ) : (
          <BusinessReports
            key={requestedDataBatchId ?? "手动选择报告数据"}
            actorPost={actorPost}
            onComposeReport={onComposeReport}
            onQuickExport={onQuickExport}
            permissionKeys={permissionKeys}
            requestedDataBatchId={requestedDataBatchId}
            queryAllowed={queryAllowed}
            workflow={workflow}
          />
        )}
      </div>
    </div>
  );
}

export function FormalReportCenterWorkspace({
  section,
  scope,
  onScopeChange,
  onComposeReport,
  onQuickExport,
  workflow,
  actorPost,
  permissionKeys,
  requestedDataBatchId,
  requestedWorkItemId,
  queryAllowed = true,
  workItems,
}: {
  section: ReportingSection;
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  onComposeReport: (context: BusinessReportContext) => void;
  onQuickExport?: (
    kind: QuickReportExportKind,
    artifact: BusinessReportArtifact,
  ) => void;
  workflow?: BusinessReportWorkflow;
  actorPost?: string;
  permissionKeys?: readonly string[];
  requestedDataBatchId?: string;
  requestedWorkItemId?: string;
  queryAllowed?: boolean;
  workItems?: readonly BusinessWorkItem[];
}) {
  return (
    <FormalWorkspaceScopeProvider
      scope={scope}
      onScopeChange={onScopeChange}
      classificationOptions={businessClassificationFixtures.reportCompatibility}
    >
      <ReportCenterWorkspace
        section={section}
        onComposeReport={onComposeReport}
        onQuickExport={onQuickExport}
        workflow={workflow}
        actorPost={actorPost ?? reportActorPost(scope.identity.postId)}
        permissionKeys={permissionKeys ?? scope.authorization.permissionKeys}
        requestedDataBatchId={requestedDataBatchId}
        requestedWorkItemId={requestedWorkItemId}
        queryAllowed={queryAllowed}
        workItems={workItems}
      />
    </FormalWorkspaceScopeProvider>
  );
}
