export type BusinessClassificationDomain =
  | "production"
  | "market"
  | "supply"
  | "operations"
  | "reporting";

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
  const [domain, label] = id.split(".") as [
    BusinessClassificationDomain,
    string,
  ];
  return {
    id,
    domain,
    label,
    productDimension:
      domain === "supply" ? "product-account" : domain === "operations" ? "none" : "crop",
    taskEnabled: domain !== "reporting",
    analysisEnabled: domain !== "reporting",
    reportEnabled: true,
  };
}

export const businessClassifications: readonly BusinessClassification[] =
  requiredBusinessClassificationIds.map(classification);

export const businessClassificationOptionSources = {
  workItems: ["production.planting-production", "market.quote-trade"],
  executiveFilters: ["operations.obligation-performance", "operations.data-quality"],
  productionAnalysis: ["production.planting-production", "production.quality-survey"],
  marketAnalysis: ["market.quote-trade", "market.inventory", "market.logistics"],
  supplyAnalysis: ["supply.supply", "supply.use-outflow", "supply.results"],
  reportCompatibility: [
    "reporting.production",
    "reporting.market",
    "reporting.supply",
    "reporting.cross-business",
    "reporting.duty",
  ],
} as const satisfies Record<string, readonly BusinessClassification["id"][]>;
