export type MarketCollectionTarget = "subject" | "logistics";
export type MarketCollectionMode = "online" | "excel" | "system";
export type GrainKind = "corn" | "soybean" | "paddy";
export type MarketProductKind = GrainKind | "agri-input";
export type MarketRole =
  | "trader"
  | "corn-processor"
  | "soy-crusher"
  | "soy-protein"
  | "food-condiment"
  | "rice-mill"
  | "feed"
  | "livestock"
  | "reserve"
  | "wholesale-market"
  | "agri-dealer"
  | "rail-node"
  | "road-node";

export type MarketFieldGroupKey =
  | "purchase"
  | "quality"
  | "processing"
  | "inventory"
  | "sales"
  | "movement"
  | "evidence";

export interface MarketFieldGroup {
  key: MarketFieldGroupKey;
  label: string;
}

export interface MarketTask {
  id: string;
  target: MarketCollectionTarget;
  targetName: string;
  role: MarketRole;
  grain: MarketProductKind;
  region: string;
  owner: string;
  deadline: string;
  status: "待填写" | "填写中" | "待审核" | "已退回" | "审核通过" | "逾期";
  completedFields: number;
  applicableFields: number;
}

export interface MarketRegionCoverage {
  label: string;
  detail: string;
  townshipCount: string;
  villageCount: string;
  sourceNote: string;
  sourceState: "已核定" | "部分核定" | "待核定";
}

export const grainLabels: Record<MarketProductKind, string> = {
  corn: "玉米",
  soybean: "大豆",
  paddy: "稻谷",
  "agri-input": "农资",
};

export const marketRoleLabels: Record<MarketRole, string> = {
  trader: "贸易商",
  "corn-processor": "玉米深加工企业",
  "soy-crusher": "大豆压榨企业",
  "soy-protein": "大豆蛋白加工企业",
  "food-condiment": "食品和调味品企业",
  "rice-mill": "米厂",
  feed: "饲料企业",
  livestock: "养殖企业",
  reserve: "承储企业 / 储备库",
  "wholesale-market": "批发市场",
  "agri-dealer": "农资经销商",
  "rail-node": "铁路站点",
  "road-node": "公路物流节点",
};

const fieldGroupLabels: Record<MarketFieldGroupKey, string> = {
  purchase: "收购与价格",
  quality: "质量条件",
  processing: "加工与开机",
  inventory: "库存",
  sales: "销售",
  movement: "流入流出",
  evidence: "运输依据",
};

const roleFieldGroups: Record<MarketRole, readonly MarketFieldGroupKey[]> = {
  trader: ["purchase", "quality", "inventory", "sales"],
  "corn-processor": ["purchase", "quality", "processing", "inventory"],
  "soy-crusher": ["purchase", "quality", "processing", "inventory"],
  "soy-protein": ["purchase", "quality", "processing", "inventory"],
  "food-condiment": ["purchase", "quality", "processing", "inventory"],
  "rice-mill": ["purchase", "quality", "processing", "inventory", "sales"],
  feed: ["purchase", "quality", "processing", "inventory"],
  livestock: ["purchase", "quality", "inventory"],
  reserve: ["inventory"],
  "wholesale-market": ["sales", "quality"],
  "agri-dealer": ["sales", "inventory"],
  "rail-node": ["movement", "purchase", "evidence"],
  "road-node": ["movement", "evidence"],
};

export function getApplicableFieldGroups(
  role: MarketRole,
  product: MarketProductKind,
): MarketFieldGroup[] {
  const templateRole = product === "agri-input" ? "agri-dealer" : role;
  return roleFieldGroups[templateRole].map((key) => ({
    key,
    label: fieldGroupLabels[key],
  }));
}

export function getMarketCompletion(task: MarketTask): number {
  if (task.applicableFields === 0) return 0;
  return Math.round((task.completedFields / task.applicableFields) * 100);
}
