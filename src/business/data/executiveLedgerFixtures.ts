import type { BusinessClassification } from "../core/businessClassification";
import type { PublishedMetricPoint } from "../core/comparableSeries";
import type { EnterpriseRegionId } from "../enterpriseRegions";
import type {
  ExecutiveDrillDownTarget,
  ExecutiveDutyRow,
  ExecutiveReleaseRow,
  ExecutiveRiskRow,
} from "../core/executiveLedger";
import { fixedDecimal } from "../core/fixedDecimal";
import {
  businessReportRows,
  dutyMonthlyRows,
  dutyWeeklyRows,
  responsibilityAssignments,
} from "../formalEnterpriseData";
import { qiqiharCornSupplyAccountSnapshot } from "./supplyAccountSnapshot";

export interface ExecutiveFixtureCoordinates {
  domain: "production" | "market" | "supply" | "operations" | "reporting";
  businessSubtype: BusinessClassification["id"];
  regionId: string;
  productId: string | null;
  cultivarId: string | null;
  periodKey: string;
  dataLayer: "preliminary" | "official";
  releaseVersion: string;
}

type RiskFixture = ExecutiveRiskRow & ExecutiveFixtureCoordinates;
type DutyFixture = ExecutiveDutyRow & ExecutiveFixtureCoordinates;
type ReleaseFixture = ExecutiveReleaseRow & ExecutiveFixtureCoordinates;

const metricReleaseVersion = "METRIC-2026-W31-V3";
const executiveCutoff = "2026-07-31T17:00:00+08:00";

export const fixtureExecutiveDefaultPeriodKey = "2026-W31" as const;
export const fixtureExecutiveSupportedPeriodKeys = [
  fixtureExecutiveDefaultPeriodKey,
  "2025-W31",
] as const;

export interface ExecutiveAggregateRegionMembershipFixture {
  aggregateRegionId: "authorized-all";
  periodKey: string;
  dataLayer: "preliminary" | "official";
  releaseVersion: string;
  regionBoundaryVersionId: string;
  memberRegionIds: readonly Exclude<EnterpriseRegionId, "authorized-all">[];
}

export const executiveAggregateRegionMembershipFixtures: readonly ExecutiveAggregateRegionMembershipFixture[] =
  [
    {
      aggregateRegionId: "authorized-all",
      periodKey: fixtureExecutiveDefaultPeriodKey,
      dataLayer: "official",
      releaseVersion: metricReleaseVersion,
      regionBoundaryVersionId: "authorized-membership-2026-v1",
      memberRegionIds: ["qiqihar-all", "qiqihar-nehe"],
    },
  ];

export const executiveCoordinateOptions = {
  domains: [
    { id: "all", label: "全部业务类型" },
    { id: "production", label: "产情监测" },
    { id: "market", label: "市场监测" },
    { id: "supply", label: "供需核算" },
    { id: "operations", label: "经营履责" },
    { id: "reporting", label: "报告发布" },
  ],
  regionLevels: [
    { id: "custom", label: "授权汇总" },
    { id: "city", label: "市域" },
    { id: "county", label: "区县" },
    { id: "township", label: "乡镇" },
    { id: "village", label: "村级" },
  ],
  products: [{ id: "corn", label: "玉米" }],
  cultivars: [{ id: "jingke-968", label: "京科 968" }],
  periods: [
    { id: fixtureExecutiveDefaultPeriodKey, label: "2026 年第 31 周" },
    { id: fixtureExecutiveSupportedPeriodKeys[1], label: "2025 年第 31 周" },
  ],
  dataLayers: [
    { id: "official", label: "正式数据" },
    { id: "preliminary", label: "初步数据" },
  ],
  riskStates: [
    { id: "all", label: "全部风险状态" },
    { id: "warning", label: "预警" },
    { id: "blocking", label: "阻断" },
  ],
  releaseVersions: [
    { id: metricReleaseVersion, label: "2026年第31周正式指标第3版" },
  ],
} as const;

export const executiveRiskFixtures: readonly RiskFixture[] = [
  {
    id: "risk-production-nehe-quality",
    domain: "production",
    businessSubtype: "production.quality-survey",
    regionId: "qiqihar-nehe",
    productId: "rice",
    cultivarId: null,
    periodKey: "2026-W31",
    dataLayer: "official",
    releaseVersion: metricReleaseVersion,
    riskItem: "讷河市稻谷质量检验单缺失",
    business: "产情监测",
    region: "讷河市",
    impact: "阻断正式发布",
    currentState: "阻断",
    riskState: "blocking",
    sourceVersionId: metricReleaseVersion,
    cutoff: executiveCutoff,
    coverage: "讷河市正式发布范围",
    drillDownTarget: { application: "production", section: "tasks" },
  },
  {
    id: "risk-market-authorized-price-spread",
    domain: "market",
    businessSubtype: "market.quote-trade",
    regionId: "authorized-all",
    productId: "corn",
    cultivarId: null,
    periodKey: "2026-W31",
    dataLayer: "official",
    releaseVersion: metricReleaseVersion,
    riskItem: "北部县区玉米价差扩大",
    business: "市场监测",
    region: "全部已授权范围",
    impact: "需要补充交易依据",
    currentState: "待解释",
    riskState: "warning",
    sourceVersionId: metricReleaseVersion,
    cutoff: executiveCutoff,
    coverage: "当前身份全部已授权地区",
    drillDownTarget: { application: "market", section: "tasks" },
  },
  {
    id: "risk-supply-nehe-flow",
    domain: "supply",
    businessSubtype: "supply.supply",
    regionId: "qiqihar-nehe",
    productId: "corn",
    cultivarId: null,
    periodKey: "2026-W31",
    dataLayer: "official",
    releaseVersion: metricReleaseVersion,
    riskItem: "区域流向两项资料待核",
    business: "供需核算",
    region: "讷河市",
    impact: "暂不具备正式发布条件",
    currentState: "待核定",
    riskState: "warning",
    sourceVersionId: metricReleaseVersion,
    cutoff: executiveCutoff,
    coverage: "讷河市玉米产品账户",
    drillDownTarget: { application: "supply", section: "calculation" },
  },
  {
    id: "risk-market-gannan-unreleased",
    domain: "market",
    businessSubtype: "market.quote-trade",
    regionId: "qiqihar-gannan",
    productId: "corn",
    cultivarId: null,
    periodKey: "2026-W31",
    dataLayer: "preliminary",
    releaseVersion: "METRIC-2026-W31-PRELIMINARY-V1",
    riskItem: "甘南县市场报送逾期",
    business: "市场监测",
    region: "甘南县",
    impact: "影响初步汇总覆盖",
    currentState: "待处置",
    riskState: "warning",
    sourceVersionId: "METRIC-2026-W31-PRELIMINARY-V1",
    cutoff: executiveCutoff,
    coverage: "未授权保全样例，不进入当前投影",
    drillDownTarget: { application: "market", section: "tasks" },
  },
];

const dutyCoordinateByAssignmentId: Readonly<
  Record<
    string,
    {
      regionId: string;
      domain: "production" | "market";
      businessSubtype: BusinessClassification["id"];
      drillDownTarget: ExecutiveDrillDownTarget;
    }
  >
> = {
  "resp-qqhr-market": {
    regionId: "qiqihar-all",
    domain: "market",
    businessSubtype: "market.quote-trade",
    drillDownTarget: { application: "market", section: "tasks" },
  },
  "resp-nehe-market": {
    regionId: "qiqihar-nehe",
    domain: "market",
    businessSubtype: "market.quote-trade",
    drillDownTarget: { application: "market", section: "tasks" },
  },
  "resp-gannan-market": {
    regionId: "qiqihar-gannan",
    domain: "market",
    businessSubtype: "market.quote-trade",
    drillDownTarget: { application: "market", section: "tasks" },
  },
  "resp-baiquan-production": {
    regionId: "qiqihar-baiquan",
    domain: "production",
    businessSubtype: "production.planting-production",
    drillDownTarget: { application: "production", section: "tasks" },
  },
  "resp-longjiang-production": {
    regionId: "qiqihar-longjiang",
    domain: "production",
    businessSubtype: "production.planting-production",
    drillDownTarget: { application: "production", section: "tasks" },
  },
};

export const executiveDutyFixtures: readonly DutyFixture[] =
  responsibilityAssignments.map((assignment) => {
    const coordinate = dutyCoordinateByAssignmentId[assignment.id];
    if (!coordinate)
      throw new Error(`履责分配未配置治理坐标：${assignment.id}`);
    const weekly =
      dutyWeeklyRows.find(
        (row) =>
          row.person === assignment.responsiblePerson &&
          row.region === assignment.region &&
          row.item === assignment.businessItem,
      ) ?? null;
    const monthly =
      dutyMonthlyRows.find(
        (row) =>
          row.person === assignment.responsiblePerson &&
          row.region === assignment.region,
      ) ?? null;
    return {
      id: `duty-${assignment.id}`,
      domain: coordinate.domain,
      businessSubtype: coordinate.businessSubtype,
      regionId: coordinate.regionId,
      productId: "corn",
      cultivarId: null,
      periodKey: "2026-W31",
      dataLayer: "official",
      releaseVersion: metricReleaseVersion,
      assignment: {
        id: assignment.id,
        region: assignment.region,
        businessItem: assignment.businessItem,
        frequency: assignment.frequency,
        responsibleUserId: assignment.responsibleUserId,
        person: assignment.responsiblePerson,
        post: assignment.responsiblePost,
        reviewer: assignment.reviewer,
        deadlineRule: assignment.deadlineRule,
        effectivePeriod: assignment.effectivePeriod,
        status: assignment.status,
      },
      weekly,
      monthly,
      sourceVersionId: "DUTY-2026-W31-V1",
      cutoff: executiveCutoff,
      coverage: "责任分配、周履责与月度汇总独立投影",
      drillDownTarget: coordinate.drillDownTarget,
    };
  });

interface ReleaseMetadata {
  publicationId: string;
  publicationLabel: string;
  businessSubtype: BusinessClassification["id"];
  sourceBusinessDomain: ReleaseFixture["sourceBusinessDomain"];
  sourceBusinessSubtype: BusinessClassification["id"];
  regionId: string;
  productId: string | null;
  cultivarId: string | null;
  replacesPublicationId: string | null;
  replacesPublicationLabel: string | null;
  replacedByPublicationId: string | null;
  replacedByPublicationLabel: string | null;
}

const releaseMetadataByReportName: Readonly<Record<string, ReleaseMetadata>> = {
  齐齐哈尔玉米市场运行日报: {
    publicationId: "PUB-MARKET-DAILY-2026-07-31-V1",
    publicationLabel: "2026年7月31日市场日报第1版",
    businessSubtype: "reporting.market",
    sourceBusinessDomain: "market",
    sourceBusinessSubtype: "market.quote-trade",
    regionId: "qiqihar-all",
    productId: "corn",
    cultivarId: null,
    replacesPublicationId: null,
    replacesPublicationLabel: null,
    replacedByPublicationId: null,
    replacedByPublicationLabel: null,
  },
  齐齐哈尔玉米产情监测周报: {
    publicationId: "PUB-PRODUCTION-W31-2026-V1",
    publicationLabel: "2026年第31周产情周报第1版",
    businessSubtype: "reporting.production",
    sourceBusinessDomain: "production",
    sourceBusinessSubtype: "production.planting-production",
    regionId: "authorized-all",
    productId: "corn",
    cultivarId: null,
    replacesPublicationId: null,
    replacesPublicationLabel: null,
    replacedByPublicationId: null,
    replacedByPublicationLabel: null,
  },
  齐齐哈尔粮食商情月报: {
    publicationId: "PUB-CROSS-BUSINESS-2026-07-V2",
    publicationLabel: "2026年7月综合商情月报第2版",
    businessSubtype: "reporting.cross-business",
    sourceBusinessDomain: "reporting",
    sourceBusinessSubtype: "reporting.cross-business",
    regionId: "authorized-all",
    productId: null,
    cultivarId: null,
    replacesPublicationId: "PUB-CROSS-BUSINESS-2026-07-V1",
    replacesPublicationLabel: "2026年7月综合商情月报第1版",
    replacedByPublicationId: null,
    replacedByPublicationLabel: null,
  },
  玉米供需账户分析月报: {
    publicationId: "PUB-SUPPLY-2026-07-V1",
    publicationLabel: "2026年7月供需分析月报第1版",
    businessSubtype: "reporting.supply",
    sourceBusinessDomain: "supply",
    sourceBusinessSubtype: "supply.supply",
    regionId: "authorized-all",
    productId: "corn",
    cultivarId: null,
    replacesPublicationId: "PUB-SUPPLY-2026-06-V1",
    replacesPublicationLabel: "2026年6月供需分析月报第1版",
    replacedByPublicationId: "PUB-SUPPLY-2026-07-V2",
    replacedByPublicationLabel: "2026年7月供需分析月报第2版",
  },
};

export const executiveReleaseFixtures: readonly ReleaseFixture[] =
  businessReportRows.map((report) => {
    const metadata = releaseMetadataByReportName[report.name];
    if (!metadata) throw new Error(`报告发布元数据缺失：${report.name}`);
    return {
      id: `release-${metadata.publicationId}`,
      domain: "reporting",
      businessSubtype: metadata.businessSubtype,
      sourceBusinessDomain: metadata.sourceBusinessDomain,
      sourceBusinessSubtype: metadata.sourceBusinessSubtype,
      regionId: metadata.regionId,
      productId: metadata.productId,
      cultivarId: metadata.cultivarId,
      periodKey: "2026-W31",
      dataLayer: "official",
      releaseVersion: metricReleaseVersion,
      publicationId: metadata.publicationId,
      publicationLabel: metadata.publicationLabel,
      replacesPublicationId: metadata.replacesPublicationId,
      replacesPublicationLabel: metadata.replacesPublicationLabel,
      replacedByPublicationId: metadata.replacedByPublicationId,
      replacedByPublicationLabel: metadata.replacedByPublicationLabel,
      reportName: report.name,
      frequency: report.frequency,
      scope: report.scope,
      period: report.period,
      dataVersion: report.dataVersion,
      publicationStatus: report.status,
      owner: report.owner,
      publishedAt: report.publishedAt,
      sourceVersionId: metricReleaseVersion,
      cutoff: executiveCutoff,
      coverage: report.scope,
      drillDownTarget: { application: "reporting", section: "ledger" },
    };
  });

const totalSupplyComparisonRow =
  qiqiharCornSupplyAccountSnapshot.comparisonRows.find(
    ({ label }) => label === "总供给",
  );

if (!totalSupplyComparisonRow) {
  throw new Error("供需账户四年对比缺少总供给指标");
}

export const executiveSupplyReleasePoints: readonly PublishedMetricPoint[] =
  totalSupplyComparisonRow.values.map((value, index) => {
    const year = 2023 + index;
    const current = year === 2026;
    return {
      availability: "available",
      coordinate: {
        metricId: "supply.total-supply",
        regionId: "authorized-all",
        regionBoundaryVersionId: "authorized-membership-2026-v1",
        cropId: "corn",
        commodityId: null,
        productFormId: "grain-unprocessed",
        productAccountId: "corn-account",
        cultivarId: null,
        qualityConditionId: null,
        priceConditionId: null,
        deliveryConditionId: null,
        populationOrSampleId: "authorized-supply-account-population",
        unitDefinitionVersionId: "万吨.definition-v1",
        inventoryNatureId: "commercial",
        statisticalMomentId: "year-end",
        consolidationMatrixVersionId: "supply-consolidation-v1",
        domainDimensions: {
          domain: "supply",
          accountStandardVersionId: "supply-account-standard-v1",
          consolidationScopeId: "authorized-scope-v1",
          ruleComparabilityVersionId: "supply-rule-comparison-v1",
          marketingYearStageKey: "final",
        },
        period: {
          year,
          granularity: "marketing-year",
          periodKey: `${String(year)}/${String(year + 1).slice(-2)}`,
          samePeriodKey: "marketing-year-final",
          cutoff: `${String(year)}-07-31T17:00:00+08:00`,
        },
        dataLayer: "official",
        inputReleaseVersionIds: [`SUPPLY-ACCOUNT-${String(year)}-V1`],
        metricReleaseVersionId: current
          ? metricReleaseVersion
          : `SUPPLY-METRIC-${String(year)}-V1`,
        releaseLineage: {
          kind: "supply-result",
          supplyAccountVersionId: `SUPPLY-ACCOUNT-${String(year)}-V1`,
          ruleVersionId: "SUPPLY-RULE-V1",
          resultReleaseVersionId: `SUPPLY-RESULT-${String(year)}-V1`,
        },
      },
      value: fixedDecimal(String(value)),
      unit: "万吨",
      coverageRate: fixedDecimal("96.8"),
      qualityStatus: "warning",
      definitionVersionId: "supply.total-supply.definition-v1",
      conversionVersionId: null,
    } satisfies PublishedMetricPoint;
  });
