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
  workId: string;
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

export const marketProductNames: Readonly<Record<string, string>> = {
  ...grainLabels,
  wheat: "小麦",
  rice: "大米",
  soymeal: "豆粕",
  soyoil: "豆油",
  "soy-protein": "大豆蛋白",
};

export const marketCultivarNames: Readonly<Record<string, string>> = {
  "jingke-968": "京科968",
  "demeiya-3": "德美亚3号",
  "xianyu-335": "先玉335",
  "heinong-84": "黑农84",
  "dongsheng-22": "东生22",
  "longjing-31": "龙粳31",
  "suijing-18": "绥粳18",
  "longmai-35": "龙麦35",
  "kechun-14": "克春14号",
};

export const marketProductMasterData = [
  { id: "corn", label: "玉米" },
  { id: "paddy", label: "稻谷" },
  { id: "soybean", label: "大豆" },
  { id: "wheat", label: "小麦" },
  { id: "rice", label: "大米" },
  { id: "soymeal", label: "豆粕" },
  { id: "soyoil", label: "豆油" },
  { id: "soy-protein", label: "大豆蛋白" },
  { id: "agri-input", label: "农资" },
] as const;

export const marketCultivarsByProduct: Readonly<
  Record<string, readonly string[]>
> = {
  corn: ["jingke-968", "demeiya-3", "xianyu-335"],
  paddy: ["longjing-31", "suijing-18"],
  soybean: ["heinong-84", "dongsheng-22"],
  wheat: ["longmai-35", "kechun-14"],
  rice: [],
  soymeal: [],
  soyoil: [],
  "soy-protein": [],
  "agri-input": [],
};

export const marketPeriodNames: Readonly<Record<string, string>> = {
  "2026-W31": "2026 年第 31 周",
  "2026": "2026 年",
};

export const marketReleaseVersionNames: Readonly<Record<string, string>> = {
  "METRIC-2026-W31-V3": "2026年第31周已核定数据（当前采用）",
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

export const marketLifecycleLabels = {
  obligation: {
    "not-due": "未到期",
    "in-progress": "进行中",
    "on-time": "按时完成",
    "overdue-completed": "逾期补填",
    missed: "截止未提交",
    exempt: "免报",
  },
  document: {
    draft: "草稿",
    submitted: "已提交",
    returned: "已退回",
    corrected: "已更正",
  },
  review: {
    pending: "待审核",
    reviewing: "审核中",
    approved: "审核通过",
    returned: "审核退回",
  },
  quality: {
    passed: "质量通过",
    warning: "质量警告",
    blocking: "质量阻断",
    "awaiting-explanation": "等待说明",
  },
  release: {
    unreleased: "未发布",
    pending: "待发布",
    published: "已发布",
    superseded: "已由后续发布结果替代",
  },
} as const;

export const marketTaskStateOptions = {
  obligation: Object.entries(marketLifecycleLabels.obligation),
  document: Object.entries(marketLifecycleLabels.document),
  review: Object.entries(marketLifecycleLabels.review),
  quality: Object.entries(marketLifecycleLabels.quality),
  release: Object.entries(marketLifecycleLabels.release),
} as const;

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

export function governedMarketName(
  names: Readonly<Record<string, string>>,
  id: string | null | undefined,
  missingLabel: string,
): string {
  if (!id) return missingLabel;
  return names[id] ?? missingLabel;
}

export function formatMarketDateTime(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return "时间待维护";
  return `${match[1]}年${String(Number(match[2]))}月${String(Number(match[3]))}日 ${match[4]}:${match[5]}`;
}

export function marketStateTone(label: string): string {
  if (
    label.includes("阻断") ||
    label.includes("截止") ||
    label.includes("逾期") ||
    label.includes("退回")
  ) {
    return "is-danger";
  }
  if (
    label.includes("待") ||
    label.includes("警告") ||
    label.includes("进行") ||
    label.includes("审核中")
  ) {
    return "is-warning";
  }
  if (label.includes("通过") || label.includes("完成") || label === "已发布") {
    return "is-good";
  }
  return "";
}

export function marketPriceStatisticLabel(aggregation: string): string {
  if (aggregation === "weighted-average") return "成交量加权平均";
  if (aggregation === "median") return "有效报价中位数";
  return "已声明统计口径";
}
