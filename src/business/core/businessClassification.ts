export type BusinessClassificationDomain =
  "production" | "market" | "supply" | "operations" | "reporting";

export const requiredBusinessClassificationIds = [
  "production.planting-production",
  "production.cost-support",
  "production.farmer-stock-sales",
  "production.planting-intention",
  "production.quality-survey",
  "market.quote-trade",
  "market.quality",
  "market.inventory",
  "market.processing",
  "market.consumption-use",
  "market.sales",
  "market.logistics",
  "market.agricultural-input",
  "supply.supply",
  "supply.use-outflow",
  "supply.results",
  "supply.auxiliary",
  "operations.obligation-performance",
  "operations.data-quality",
  "reporting.production",
  "reporting.market",
  "reporting.supply",
  "reporting.cross-business",
  "reporting.duty",
] as const;

export interface BusinessClassification {
  id: (typeof requiredBusinessClassificationIds)[number];
  domain: BusinessClassificationDomain;
  label: string;
  productDimension: "none" | "crop" | "commodity" | "product-account";
  taskEnabled: boolean;
  analysisEnabled: boolean;
  reportEnabled: boolean;
}

function classification(
  id: BusinessClassification["id"],
): BusinessClassification {
  const domain = id.split(".", 1)[0] as BusinessClassificationDomain;
  return {
    id,
    domain,
    label: governedLabels[id],
    productDimension:
      domain === "supply"
        ? "product-account"
        : domain === "operations"
          ? "none"
          : "crop",
    taskEnabled: domain !== "reporting",
    analysisEnabled: domain !== "reporting",
    reportEnabled: true,
  };
}

const governedLabels: Record<BusinessClassification["id"], string> = {
  "production.planting-production": "种植生产",
  "production.cost-support": "成本与政策支持",
  "production.farmer-stock-sales": "农户余粮与销售",
  "production.planting-intention": "种植意向",
  "production.quality-survey": "质量调查",
  "market.quote-trade": "报价与交易",
  "market.quality": "市场质量",
  "market.inventory": "市场库存",
  "market.processing": "加工",
  "market.consumption-use": "消费与使用",
  "market.sales": "销售",
  "market.logistics": "物流",
  "market.agricultural-input": "农资",
  "supply.supply": "供给",
  "supply.use-outflow": "使用与外流",
  "supply.results": "结果",
  "supply.auxiliary": "辅助口径",
  "operations.obligation-performance": "履责表现",
  "operations.data-quality": "数据质量",
  "reporting.production": "产情报告",
  "reporting.market": "市场报告",
  "reporting.supply": "供需报告",
  "reporting.cross-business": "跨业务报告",
  "reporting.duty": "履责报告",
};

export const businessClassifications: readonly BusinessClassification[] =
  requiredBusinessClassificationIds.map(classification);

const classificationById = new Map(
  businessClassifications.map((item) => [item.id, item]),
);

function selectClassifications(
  ids: readonly BusinessClassification["id"][],
): readonly BusinessClassification[] {
  return ids.map((id) => classificationById.get(id)!);
}

export const businessClassificationOptionSources = {
  workItems: selectClassifications([
    "production.planting-production",
    "market.quote-trade",
  ]),
  executiveFilters: selectClassifications([
    "operations.obligation-performance",
    "operations.data-quality",
  ]),
  productionAnalysis: selectClassifications([
    "production.planting-production",
    "production.quality-survey",
  ]),
  marketAnalysis: selectClassifications([
    "market.quote-trade",
    "market.inventory",
    "market.logistics",
  ]),
  supplyAnalysis: selectClassifications([
    "supply.supply",
    "supply.use-outflow",
    "supply.results",
  ]),
  reportCompatibility: selectClassifications([
    "reporting.production",
    "reporting.market",
    "reporting.supply",
    "reporting.cross-business",
    "reporting.duty",
  ]),
} as const satisfies Record<string, readonly BusinessClassification[]>;
