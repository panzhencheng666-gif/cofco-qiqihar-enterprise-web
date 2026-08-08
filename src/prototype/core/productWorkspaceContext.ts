import type { FormalRoute } from "../formalEnterpriseModel";

export interface ProductWorkspaceContext {
  domain: "production" | "market" | "supply";
  productId: "corn" | "soybean" | "paddy";
  productLabel: string;
  titleStem: string;
}

const productContextByRoute = {
  "production:corn-collection": {
    domain: "production",
    productId: "corn",
    productLabel: "玉米",
    titleStem: "玉米产情填报",
  },
  "production:soybean-collection": {
    domain: "production",
    productId: "soybean",
    productLabel: "大豆",
    titleStem: "大豆产情填报",
  },
  "production:rice-collection": {
    domain: "production",
    productId: "paddy",
    productLabel: "稻谷",
    titleStem: "稻谷产情填报",
  },
  "market:corn-collection": {
    domain: "market",
    productId: "corn",
    productLabel: "玉米",
    titleStem: "玉米市场采集",
  },
  "market:soybean-collection": {
    domain: "market",
    productId: "soybean",
    productLabel: "大豆",
    titleStem: "大豆市场采集",
  },
  "market:paddy-collection": {
    domain: "market",
    productId: "paddy",
    productLabel: "稻谷",
    titleStem: "稻谷市场采集",
  },
  "supply:corn-balance": {
    domain: "supply",
    productId: "corn",
    productLabel: "玉米",
    titleStem: "玉米供需平衡",
  },
  "supply:soybean-balance": {
    domain: "supply",
    productId: "soybean",
    productLabel: "大豆",
    titleStem: "大豆供需平衡",
  },
  "supply:paddy-balance": {
    domain: "supply",
    productId: "paddy",
    productLabel: "稻谷",
    titleStem: "稻谷供需平衡",
  },
} as const satisfies Record<string, ProductWorkspaceContext>;

export function getProductWorkspaceContext(
  route: FormalRoute,
): ProductWorkspaceContext | null {
  const key = `${route.application}:${route.section}`;
  return (
    productContextByRoute[key as keyof typeof productContextByRoute] ?? null
  );
}
