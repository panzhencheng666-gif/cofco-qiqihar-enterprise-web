import type {
  BusinessReportChapter,
  BusinessReportFrequency,
  BusinessReportIndicator,
  ReportableApplication,
} from "../businessReportModel";
import { formatFixedDecimal, percentageChange } from "../core/fixedDecimal";
import { supplyBalanceScopes } from "../supplyBalanceScope";
import {
  qiqiharPaddySupplyAccountSnapshot,
  qiqiharSoybeanSupplyAccountSnapshot,
  type SupplyAccountSnapshot,
} from "./supplyAccountSnapshot";
import {
  enterpriseMetricDefinitions,
  findApprovedMetricSeries,
  fixtureCurrentMetricReleaseVersionId,
  type ApprovedMetricSeriesQuery,
} from "./enterpriseMetricFixtures";

export interface ApprovedBusinessReportDatasetQuery {
  application: ReportableApplication;
  businessClassificationId: string;
  region: string;
  product: string;
  cultivar: string;
  reportTemplate: string;
  period: string;
  frequency: BusinessReportFrequency;
  dataBatchId: string;
}

export interface ApprovedBusinessReportDataset extends ApprovedBusinessReportDatasetQuery {
  dataCutoff: string;
  dataBatchLabel: string;
  sourceLabel: string;
  summary: string;
  indicators: readonly BusinessReportIndicator[];
  chapters: readonly BusinessReportChapter[];
}

export interface ApprovedBusinessReportMetricLineage {
  application: Extract<ReportableApplication, "production" | "market">;
  reportDataBatchId: string;
  metricReleaseVersionId: string;
  metricCoordinates: Omit<
    ApprovedMetricSeriesQuery,
    "metricId" | "metricReleaseVersionId"
  >;
}

const approvedReportMetricCoordinates = Object.freeze({
  regionId: "qiqihar-all",
  productId: "corn",
  cultivarId: null,
  samePeriodKey: "W31",
  dataLayer: "official" as const,
  qualityStatus: "passed" as const,
  currentYear: 2026,
});

export const approvedBusinessReportMetricLineages: readonly ApprovedBusinessReportMetricLineage[] =
  Object.freeze([
    Object.freeze({
      application: "production" as const,
      reportDataBatchId: "PRODUCTION-2026-W31-APPROVED",
      metricReleaseVersionId: fixtureCurrentMetricReleaseVersionId,
      metricCoordinates: approvedReportMetricCoordinates,
    }),
    Object.freeze({
      application: "market" as const,
      reportDataBatchId: "MARKET-2026-W31-APPROVED",
      metricReleaseVersionId: fixtureCurrentMetricReleaseVersionId,
      metricCoordinates: approvedReportMetricCoordinates,
    }),
  ]);

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`缺少${label}`);
  return value;
}

function businessValue(value: string, unit?: string) {
  return unit ? `${value} ${unit}` : value;
}

function businessNumber(value: Parameters<typeof formatFixedDecimal>[0]) {
  const [integer, fraction = ""] = formatFixedDecimal(value, 1).split(".");
  const groupedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction === "0" ? groupedInteger : `${groupedInteger}.${fraction}`;
}

interface ApprovedMetricFact {
  label: string;
  currentValue: string;
  unit: string;
  yearOnYear: string;
  trend: string;
  indicator: BusinessReportIndicator;
}

function approvedMetricFact(
  metricId: string,
  lineage: ApprovedBusinessReportMetricLineage,
): ApprovedMetricFact {
  const definition = required(
    enterpriseMetricDefinitions.find((item) => item.metricId === metricId),
    `正式指标定义“${metricId}”`,
  );
  const points = findApprovedMetricSeries({
    metricId,
    ...lineage.metricCoordinates,
    metricReleaseVersionId: lineage.metricReleaseVersionId,
  });
  if (!points)
    throw new Error(`缺少正式指标“${metricId}”完整业务坐标对应的四年数据`);
  const previous = required(points.at(-2), `${definition.label}上年数据`);
  const current = required(points.at(-1), `${definition.label}本年数据`);
  const yearOnYearValue = formatFixedDecimal(
    percentageChange(current.value, previous.value, 1),
    1,
  );
  const yearOnYearNumber = Number(yearOnYearValue);
  const yearOnYear =
    yearOnYearNumber === 0
      ? "与上年持平"
      : `较上年${yearOnYearNumber > 0 ? "增长" : "下降"}${Math.abs(yearOnYearNumber).toFixed(1)}%`;
  const trend = points
    .map(
      (point) =>
        `${String(point.coordinate.period.year)}年${businessNumber(point.value)}${point.unit}`,
    )
    .join("、");
  const currentValue = businessNumber(current.value);
  return {
    label: definition.label,
    currentValue,
    unit: current.unit,
    yearOnYear,
    trend,
    indicator: {
      label: definition.label,
      value: businessValue(currentValue, current.unit),
      note: `${trend}；${yearOnYear}`,
    },
  };
}

function freezeDataset(
  dataset: ApprovedBusinessReportDataset,
): ApprovedBusinessReportDataset {
  return Object.freeze({
    ...dataset,
    indicators: Object.freeze(
      dataset.indicators.map((indicator) => Object.freeze(indicator)),
    ),
    chapters: Object.freeze(
      dataset.chapters.map((chapter) => Object.freeze(chapter)),
    ),
  });
}

const citySupplyScope = required(
  supplyBalanceScopes.find(
    ({ label, status }) => label === "齐齐哈尔市全域" && status === "已核定",
  ),
  "齐齐哈尔市已核定供需账户",
);
const supplyMetric = (label: string) =>
  required(
    citySupplyScope.metrics.find((metric) => metric.label === label),
    `供需已核定指标“${label}”`,
  );
const totalSupply = supplyMetric("总供给");
const totalUse = supplyMetric("总使用与市外流出");
const endingInventory = supplyMetric("期末库存");
const balanceDifference = supplyMetric("平衡差额");

const supplyReportFacts = {
  dataCutoff: "2026-07-31 17:00",
  dataBatchLabel: "2026/27营销年度供需已核定数据",
  sourceLabel: "2026/27营销年度市级供需已核定账户",
  summary: `齐齐哈尔市全域玉米供需账户总供给${businessValue(totalSupply.value, totalSupply.unit)}，总使用与市外流出${businessValue(totalUse.value, totalUse.unit)}，期末库存${businessValue(endingInventory.value, endingInventory.unit)}；平衡差额${businessValue(balanceDifference.value, balanceDifference.unit)}，${balanceDifference.note}。`,
  indicators: citySupplyScope.metrics.map(({ label, value, unit, note }) => ({
    label,
    value: businessValue(value, unit),
    note,
  })),
  chapters: [
    {
      title: "供给构成",
      body: `本期总供给${businessValue(totalSupply.value, totalSupply.unit)}，${totalSupply.note}。`,
    },
    {
      title: "使用与流出",
      body: `本期总使用与市外流出${businessValue(totalUse.value, totalUse.unit)}，${totalUse.note}。`,
    },
    {
      title: "平衡说明",
      body: `期末库存${businessValue(endingInventory.value, endingInventory.unit)}；平衡差额${businessValue(balanceDifference.value, balanceDifference.unit)}，${balanceDifference.note}。`,
    },
  ],
} satisfies Omit<
  ApprovedBusinessReportDataset,
  | "application"
  | "businessClassificationId"
  | "region"
  | "product"
  | "cultivar"
  | "reportTemplate"
  | "period"
  | "frequency"
  | "dataBatchId"
>;

function productSupplyReportFacts(snapshot: SupplyAccountSnapshot) {
  const value = (amount: number) => `${amount.toFixed(1)} 万吨`;
  return {
    dataCutoff: "2026-07-31 17:00",
    dataBatchLabel: "2026/27营销年度供需已核定数据",
    sourceLabel: `2026/27营销年度${snapshot.productLabel}市级供需核定账户`,
    summary: `${snapshot.regionLabel}${snapshot.productLabel}供需账户总供给${value(snapshot.equation.totalSupply)}，总使用与外流${value(snapshot.equation.totalUse)}，采用后期末库存${value(snapshot.equation.adoptedEnding)}；库存核对差额${value(snapshot.equation.inventoryDifference)}，${snapshot.conclusion.reconciliationLabel}。`,
    indicators: [
      {
        label: "总供给",
        value: value(snapshot.equation.totalSupply),
        note: "由期初库存、本地生产、区域外流入、国际进口和其他供给自动汇总",
      },
      {
        label: "总使用与外流",
        value: value(snapshot.equation.totalUse),
        note: "由消费、种用、加工、损耗、区域外流出和出口自动汇总",
      },
      {
        label: "采用后期末库存",
        value: value(snapshot.equation.adoptedEnding),
        note: "总供给减总使用与外流，再加批准库存调整",
      },
      {
        label: "库存核对差额",
        value: value(snapshot.equation.inventoryDifference),
        note: snapshot.conclusion.reconciliationDetail,
      },
    ],
    chapters: [
      {
        title: "供给构成",
        body: `本期${snapshot.productLabel}总供给${value(snapshot.equation.totalSupply)}，来源于产情、库存、市场和物流已核定数据。`,
      },
      {
        title: "使用与外流",
        body: `本期总使用与外流${value(snapshot.equation.totalUse)}，按消费、加工、损耗和流出项目逐项汇总。`,
      },
      {
        title: "期末库存与核对",
        body: `采用后期末库存${value(snapshot.equation.adoptedEnding)}，调查汇总期末${value(snapshot.equation.surveyEnding)}；${snapshot.conclusion.reconciliationDetail}`,
      },
    ],
  };
}

const soybeanSupplyReportFacts = productSupplyReportFacts(
  qiqiharSoybeanSupplyAccountSnapshot,
);
const paddySupplyReportFacts = productSupplyReportFacts(
  qiqiharPaddySupplyAccountSnapshot,
);

const productionMetricLineage = required(
  approvedBusinessReportMetricLineages.find(
    ({ application }) => application === "production",
  ),
  "产情正式报告指标来源",
);
const marketMetricLineage = required(
  approvedBusinessReportMetricLineages.find(
    ({ application }) => application === "market",
  ),
  "市场正式报告指标来源",
);

const plantedArea = approvedMetricFact(
  "production.planted-area",
  productionMetricLineage,
);
const expectedYield = approvedMetricFact(
  "production.expected-yield",
  productionMetricLineage,
);
const estimatedOutput = approvedMetricFact(
  "production.estimated-total-output",
  productionMetricLineage,
);
const productionReportFacts = {
  dataCutoff: "2026-07-31 17:00",
  dataBatchLabel: "2026年第31周产情已核定数据",
  sourceLabel: "齐齐哈尔市第31周正式发布产情指标",
  summary: `齐齐哈尔市全域玉米播种面积${businessValue(plantedArea.currentValue, plantedArea.unit)}，预计单产${businessValue(expectedYield.currentValue, expectedYield.unit)}，预计总产量${businessValue(estimatedOutput.currentValue, estimatedOutput.unit)}；三项指标分别${plantedArea.yearOnYear}、${expectedYield.yearOnYear}、${estimatedOutput.yearOnYear}。`,
  indicators: [
    plantedArea.indicator,
    expectedYield.indicator,
    estimatedOutput.indicator,
  ],
  chapters: [
    {
      title: "种植生产",
      body: `播种面积${businessValue(plantedArea.currentValue, plantedArea.unit)}，预计单产${businessValue(expectedYield.currentValue, expectedYield.unit)}，预计总产量${businessValue(estimatedOutput.currentValue, estimatedOutput.unit)}。`,
    },
    {
      title: "需要关注",
      body: `${plantedArea.trend}；${expectedYield.trend}。后续按相同统计口径持续跟踪面积、单产和预计总产量变化。`,
    },
  ],
} satisfies Omit<
  ApprovedBusinessReportDataset,
  | "application"
  | "businessClassificationId"
  | "region"
  | "product"
  | "cultivar"
  | "reportTemplate"
  | "period"
  | "frequency"
  | "dataBatchId"
>;

const purchasePrice = approvedMetricFact(
  "market.purchase-price",
  marketMetricLineage,
);
const transactionPrice = approvedMetricFact(
  "market.transaction-price",
  marketMetricLineage,
);
const tradeVolume = approvedMetricFact(
  "market.trade-volume",
  marketMetricLineage,
);

const marketReportFacts = {
  dataCutoff: "2026-07-31 17:00",
  dataBatchLabel: "2026年第31周市场已核定数据",
  sourceLabel: "齐齐哈尔市第31周正式发布市场指标",
  summary: `齐齐哈尔市全域玉米主流采购价${businessValue(purchasePrice.currentValue, purchasePrice.unit)}，该价格未含车板、包装和运费；实际成交价${businessValue(transactionPrice.currentValue, transactionPrice.unit)}，已计入车板、包装和运费；成交量${businessValue(tradeVolume.currentValue, tradeVolume.unit)}。三项指标分别${purchasePrice.yearOnYear}、${transactionPrice.yearOnYear}、${tradeVolume.yearOnYear}。`,
  indicators: [
    {
      ...purchasePrice.indicator,
      note: `未含车板、包装和运费的基础采购价。${purchasePrice.indicator.note}`,
    },
    {
      ...transactionPrice.indicator,
      label: "实际成交价",
      note: `已计入车板、包装和运费。${transactionPrice.indicator.note}`,
    },
    tradeVolume.indicator,
  ],
  chapters: [
    {
      title: "价格与交易",
      body: `本期主流采购价${businessValue(purchasePrice.currentValue, purchasePrice.unit)}，未含车板、包装和运费；实际成交价${businessValue(transactionPrice.currentValue, transactionPrice.unit)}，已计入上述费用；成交量${businessValue(tradeVolume.currentValue, tradeVolume.unit)}。`,
    },
    {
      title: "库存与加工",
      body: "当前采用的已核定数据未包含可与价格、成交量同口径联动的库存和加工指标，本报告不以草稿或其他范围数据补齐。",
    },
    {
      title: "物流与风险",
      body: `${purchasePrice.trend}；${transactionPrice.trend}。持续关注价格与成交量是否出现背离，并在形成同口径正式物流指标后纳入联动分析。`,
    },
  ],
} satisfies Omit<
  ApprovedBusinessReportDataset,
  | "application"
  | "businessClassificationId"
  | "region"
  | "product"
  | "cultivar"
  | "reportTemplate"
  | "period"
  | "frequency"
  | "dataBatchId"
>;

function approvedIndicator(
  label: string,
  value: string,
  note: string,
): BusinessReportIndicator {
  return { label, value, note };
}

const soybeanProductionReportFacts = {
  dataCutoff: "2026-07-31 17:00",
  dataBatchLabel: "2026年第31周产情已核定数据",
  sourceLabel: "齐齐哈尔市第31周大豆产情核定结果",
  summary:
    "齐齐哈尔市全域大豆播种面积480.2万亩，预计单产164.8公斤/亩，预计总产量79.1万吨；分别较上年增长1.0%、1.4%和2.3%。",
  indicators: [
    approvedIndicator(
      "播种面积",
      "480.2 万亩",
      "2023年456.0万亩、2024年467.4万亩、2025年475.6万亩、2026年480.2万亩；较上年增长1.0%",
    ),
    approvedIndicator(
      "预计单产",
      "164.8 公斤/亩",
      "2023年158.2公斤/亩、2024年160.4公斤/亩、2025年162.6公斤/亩、2026年164.8公斤/亩；较上年增长1.4%",
    ),
    approvedIndicator(
      "预计总产量",
      "79.1 万吨",
      "2023年72.1万吨、2024年75.0万吨、2025年77.3万吨、2026年79.1万吨；较上年增长2.3%",
    ),
    approvedIndicator(
      "样本平均单产",
      "166.1 公斤/亩",
      "2023年159.5公斤/亩、2024年161.7公斤/亩、2025年163.9公斤/亩、2026年166.1公斤/亩；较上年增长1.3%",
    ),
  ],
  chapters: [
    {
      title: "面积、单产与总产",
      body: "大豆播种面积480.2万亩，区域加权预计单产164.8公斤/亩，预计总产量79.1万吨。",
    },
    {
      title: "质量与品种",
      body: "按大豆口径跟踪蛋白、出油率、不完善粒、水分和杂质，不套用玉米质量指标。",
    },
    {
      title: "同比变化",
      body: "播种面积、预计单产和预计总产量均保留2023—2026年同口径序列，并展示本年同比。",
    },
  ],
};

const paddyProductionReportFacts = {
  dataCutoff: "2026-07-31 17:00",
  dataBatchLabel: "2026年第31周产情已核定数据",
  sourceLabel: "齐齐哈尔市第31周稻谷产情核定结果",
  summary:
    "齐齐哈尔市全域稻谷播种面积274.8万亩，预计单产612.4公斤/亩，预计总产量168.3万吨；分别较上年增长1.2%、1.1%和2.3%。",
  indicators: [
    approvedIndicator(
      "播种面积",
      "274.8 万亩",
      "2023年260.6万亩、2024年266.9万亩、2025年271.5万亩、2026年274.8万亩；较上年增长1.2%",
    ),
    approvedIndicator(
      "预计单产",
      "612.4 公斤/亩",
      "2023年594.8公斤/亩、2024年601.6公斤/亩、2025年605.8公斤/亩、2026年612.4公斤/亩；较上年增长1.1%",
    ),
    approvedIndicator(
      "预计总产量",
      "168.3 万吨",
      "2023年155.0万吨、2024年160.6万吨、2025年164.5万吨、2026年168.3万吨；较上年增长2.3%",
    ),
    approvedIndicator(
      "样本平均单产",
      "618.3 公斤/亩",
      "2023年600.4公斤/亩、2024年606.9公斤/亩、2025年611.7公斤/亩、2026年618.3公斤/亩；较上年增长1.1%",
    ),
  ],
  chapters: [
    {
      title: "面积、单产与总产",
      body: "稻谷播种面积274.8万亩，区域加权预计单产612.4公斤/亩，预计总产量168.3万吨。",
    },
    {
      title: "质量与品种",
      body: "按稻谷口径跟踪水分、出米率、出糙率和杂质，不套用玉米质量指标。",
    },
    {
      title: "同比变化",
      body: "播种面积、预计单产和预计总产量均保留2023—2026年同口径序列，并展示本年同比。",
    },
  ],
};

function productMarketReportFacts({
  product,
  purchasePrice,
  transactionPrice,
  salesPrice,
  tradeVolume,
  purchaseTrend,
  transactionTrend,
  salesTrend,
  volumeTrend,
  qualityScope,
}: {
  product: "大豆" | "稻谷";
  purchasePrice: string;
  transactionPrice: string;
  salesPrice: string;
  tradeVolume: string;
  purchaseTrend: string;
  transactionTrend: string;
  salesTrend: string;
  volumeTrend: string;
  qualityScope: string;
}) {
  return {
    dataCutoff: "2026-07-31 17:00",
    dataBatchLabel: "2026年第31周市场已核定数据",
    sourceLabel: `齐齐哈尔市第31周${product}市场核定结果`,
    summary: `齐齐哈尔市全域${product}采购价${purchasePrice}，销售价${salesPrice}；两者均为未含车板、包装和运费的基础价。实际成交价${transactionPrice}，已计入车板、包装和运费；本期成交量${tradeVolume}。`,
    indicators: [
      approvedIndicator("采购价", purchasePrice, purchaseTrend),
      approvedIndicator("销售价", salesPrice, salesTrend),
      approvedIndicator(
        "实际成交价",
        transactionPrice,
        `${transactionTrend}；已计入车板、包装和运费`,
      ),
      approvedIndicator("成交量", tradeVolume, volumeTrend),
    ],
    chapters: [
      {
        title: "报价与成交",
        body: `${product}采购价${purchasePrice}、销售价${salesPrice}均为基础价；实际成交价${transactionPrice}已计入车板、包装和运费。`,
      },
      {
        title: `${product}质量`,
        body: `本报告按${product}业务口径跟踪${qualityScope}，不复用其他品种质量字段。`,
      },
      {
        title: "价格与成交量同比",
        body: `${purchaseTrend}；${transactionTrend}；${volumeTrend}。`,
      },
    ],
  };
}

const soybeanMarketReportFacts = productMarketReportFacts({
  product: "大豆",
  purchasePrice: "4,286 元/吨",
  transactionPrice: "4,360 元/吨",
  salesPrice: "4,320 元/吨",
  tradeVolume: "35.4 万吨",
  purchaseTrend:
    "2023年4,112元/吨、2024年4,168元/吨、2025年4,238元/吨、2026年4,286元/吨；较上年增长1.1%",
  transactionTrend:
    "2023年4,184元/吨、2024年4,236元/吨、2025年4,308元/吨、2026年4,360元/吨；较上年增长1.2%",
  salesTrend:
    "2023年4,150元/吨、2024年4,206元/吨、2025年4,272元/吨、2026年4,320元/吨；较上年增长1.1%",
  volumeTrend:
    "2023年32.1万吨、2024年33.2万吨、2025年34.6万吨、2026年35.4万吨；较上年增长2.3%",
  qualityScope: "蛋白、出油率、不完善粒、水分和杂质",
});

const paddyMarketReportFacts = productMarketReportFacts({
  product: "稻谷",
  purchasePrice: "3,092 元/吨",
  transactionPrice: "3,168 元/吨",
  salesPrice: "5,126 元/吨",
  tradeVolume: "42.6 万吨",
  purchaseTrend:
    "2023年2,948元/吨、2024年3,002元/吨、2025年3,046元/吨、2026年3,092元/吨；较上年增长1.5%",
  transactionTrend:
    "2023年3,024元/吨、2024年3,078元/吨、2025年3,122元/吨、2026年3,168元/吨；较上年增长1.5%",
  salesTrend:
    "2023年4,860元/吨、2024年4,956元/吨、2025年5,064元/吨、2026年5,126元/吨；较上年增长1.2%",
  volumeTrend:
    "2023年38.7万吨、2024年40.1万吨、2025年41.5万吨、2026年42.6万吨；较上年增长2.7%",
  qualityScope: "水分、出米率、出糙率和杂质",
});

export const approvedBusinessReportDatasets: readonly ApprovedBusinessReportDataset[] =
  Object.freeze([
    freezeDataset({
      application: "production",
      businessClassificationId: "production.planting-production",
      region: "齐齐哈尔市全域",
      product: "玉米",
      cultivar: "不按具体品种拆分",
      reportTemplate: "种植生产监测报告",
      period: "2026年第31周",
      frequency: "周报",
      dataBatchId: productionMetricLineage.reportDataBatchId,
      ...productionReportFacts,
    }),
    freezeDataset({
      application: "market",
      businessClassificationId: "market.quote-trade",
      region: "齐齐哈尔市全域",
      product: "玉米",
      cultivar: "不按具体品种拆分",
      reportTemplate: "价格与交易监测报告",
      period: "2026年第31周",
      frequency: "周报",
      dataBatchId: marketMetricLineage.reportDataBatchId,
      ...marketReportFacts,
    }),
    freezeDataset({
      application: "production",
      businessClassificationId: "production.planting-production",
      region: "齐齐哈尔市全域",
      product: "大豆",
      cultivar: "不按具体品种拆分",
      reportTemplate: "种植生产监测报告",
      period: "2026年第31周",
      frequency: "周报",
      dataBatchId: productionMetricLineage.reportDataBatchId,
      ...soybeanProductionReportFacts,
    }),
    freezeDataset({
      application: "market",
      businessClassificationId: "market.quote-trade",
      region: "齐齐哈尔市全域",
      product: "大豆",
      cultivar: "不按具体品种拆分",
      reportTemplate: "价格与交易监测报告",
      period: "2026年第31周",
      frequency: "周报",
      dataBatchId: marketMetricLineage.reportDataBatchId,
      ...soybeanMarketReportFacts,
    }),
    freezeDataset({
      application: "production",
      businessClassificationId: "production.planting-production",
      region: "齐齐哈尔市全域",
      product: "稻谷",
      cultivar: "不按具体品种拆分",
      reportTemplate: "种植生产监测报告",
      period: "2026年第31周",
      frequency: "周报",
      dataBatchId: productionMetricLineage.reportDataBatchId,
      ...paddyProductionReportFacts,
    }),
    freezeDataset({
      application: "market",
      businessClassificationId: "market.quote-trade",
      region: "齐齐哈尔市全域",
      product: "稻谷",
      cultivar: "不按具体品种拆分",
      reportTemplate: "价格与交易监测报告",
      period: "2026年第31周",
      frequency: "周报",
      dataBatchId: marketMetricLineage.reportDataBatchId,
      ...paddyMarketReportFacts,
    }),
    freezeDataset({
      application: "supply",
      businessClassificationId: "supply.results",
      region: "齐齐哈尔市全域",
      product: "玉米",
      cultivar: "不按具体品种拆分",
      reportTemplate: "供需平衡分析报告",
      period: "2026/27营销年度",
      frequency: "月报",
      dataBatchId: "SUPPLY-2026-MY-APPROVED",
      ...supplyReportFacts,
    }),
    freezeDataset({
      application: "supply",
      businessClassificationId: "supply.results",
      region: "齐齐哈尔市全域",
      product: "大豆",
      cultivar: "不按具体品种拆分",
      reportTemplate: "供需平衡分析报告",
      period: "2026/27营销年度",
      frequency: "月报",
      dataBatchId: "SUPPLY-2026-MY-APPROVED",
      ...soybeanSupplyReportFacts,
    }),
    freezeDataset({
      application: "supply",
      businessClassificationId: "supply.results",
      region: "齐齐哈尔市全域",
      product: "稻谷",
      cultivar: "不按具体品种拆分",
      reportTemplate: "供需平衡分析报告",
      period: "2026/27营销年度",
      frequency: "月报",
      dataBatchId: "SUPPLY-2026-MY-APPROVED",
      ...paddySupplyReportFacts,
    }),
  ]);

export function findApprovedBusinessReportDataset(
  query: ApprovedBusinessReportDatasetQuery,
): ApprovedBusinessReportDataset | null {
  return (
    approvedBusinessReportDatasets.find(
      (dataset) =>
        dataset.application === query.application &&
        dataset.businessClassificationId === query.businessClassificationId &&
        dataset.region === query.region &&
        dataset.product === query.product &&
        dataset.cultivar === query.cultivar &&
        dataset.reportTemplate === query.reportTemplate &&
        dataset.period === query.period &&
        dataset.frequency === query.frequency &&
        dataset.dataBatchId === query.dataBatchId,
    ) ?? null
  );
}

export interface ApprovedBusinessReportMetricReleaseQuery extends Omit<
  ApprovedBusinessReportDatasetQuery,
  "dataBatchId"
> {
  metricReleaseVersionId: string;
}

export function findApprovedBusinessReportDatasetByMetricRelease(
  query: ApprovedBusinessReportMetricReleaseQuery,
): ApprovedBusinessReportDataset | null {
  const lineage = approvedBusinessReportMetricLineages.find(
    (item) =>
      item.application === query.application &&
      item.metricReleaseVersionId === query.metricReleaseVersionId,
  );
  if (!lineage) return null;
  return findApprovedBusinessReportDataset({
    application: query.application,
    businessClassificationId: query.businessClassificationId,
    region: query.region,
    product: query.product,
    cultivar: query.cultivar,
    reportTemplate: query.reportTemplate,
    period: query.period,
    frequency: query.frequency,
    dataBatchId: lineage.reportDataBatchId,
  });
}
