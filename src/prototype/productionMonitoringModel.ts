export type ProductionCrop = "corn" | "soybean" | "paddy";
export type ProductionObjectType =
  | "farmer"
  | "village-committee"
  | "family-farm"
  | "cooperative"
  | "agri-station"
  | "village-ledger"
  | "field-plot";

export interface ProductionFieldGroup {
  key:
    | "variety"
    | "area"
    | "growth"
    | "yield"
    | "quality"
    | "stock-sale"
    | "intention"
    | "cost-support"
    | "evidence";
  label: string;
}

export const productionCropLabels: Record<ProductionCrop, string> = {
  corn: "玉米",
  soybean: "大豆",
  paddy: "稻谷",
};

export const productionObjectLabels: Record<ProductionObjectType, string> = {
  farmer: "农户",
  "village-committee": "村委会",
  "family-farm": "家庭农场",
  cooperative: "合作社",
  "agri-station": "农技站",
  "village-ledger": "行政村台账",
  "field-plot": "田间样方",
};

const fieldLabels: Record<
  ProductionFieldGroup["key"],
  ProductionFieldGroup["label"]
> = {
  variety: "作物与具体品种",
  area: "面积与地块位置",
  growth: "长势、生育期与灾情",
  yield: "测产、单产与产量",
  quality: "质量与检验依据",
  "stock-sale": "余粮、销售、自用与损耗",
  intention: "下年度种植意愿",
  "cost-support": "成本与保障",
  evidence: "照片、检验单与调查依据",
};

const objectFields: Record<
  ProductionObjectType,
  readonly ProductionFieldGroup["key"][]
> = {
  farmer: [
    "variety",
    "area",
    "growth",
    "yield",
    "quality",
    "stock-sale",
    "intention",
    "cost-support",
    "evidence",
  ],
  "village-committee": [
    "variety",
    "area",
    "growth",
    "yield",
    "quality",
    "stock-sale",
    "intention",
    "cost-support",
    "evidence",
  ],
  "family-farm": [
    "variety",
    "area",
    "growth",
    "yield",
    "quality",
    "stock-sale",
    "intention",
    "cost-support",
    "evidence",
  ],
  cooperative: [
    "variety",
    "area",
    "growth",
    "yield",
    "quality",
    "stock-sale",
    "intention",
    "cost-support",
    "evidence",
  ],
  "agri-station": ["growth", "yield", "quality", "evidence"],
  "village-ledger": ["variety", "area", "yield", "stock-sale", "evidence"],
  "field-plot": ["variety", "growth", "yield", "quality", "evidence"],
};

export function getProductionFieldGroups(
  objectType: ProductionObjectType,
): ProductionFieldGroup[] {
  return objectFields[objectType].map((key) => ({
    key,
    label: fieldLabels[key],
  }));
}

export const productionProductNames: Readonly<Record<string, string>> = {
  corn: "玉米",
  soybean: "大豆",
  paddy: "稻谷",
  wheat: "小麦",
};

export const productionCultivarNames: Readonly<Record<string, string>> = {
  "jingke-968": "京科968",
  "demeiya-3": "德美亚3号",
  "heinong-84": "黑农84",
  "dongsheng-22": "东生22",
  "xianyu-335": "先玉335",
  "longjing-31": "龙粳31",
  "suijing-18": "绥粳18",
  "longmai-35": "龙麦35",
  "kechun-14": "克春14号",
};

export const productionObjectTypeNames: Readonly<Record<string, string>> = {
  "village-committee": "村委会",
  "survey-area": "产情调查点",
  farmer: "农户",
  "family-farm": "家庭农场",
  cooperative: "合作社",
  "agri-station": "农技站",
  "field-plot": "田间样方",
};

export const productionSourceChannelNames: Readonly<Record<string, string>> = {
  "administrative-village-ledger": "行政村台账",
  "farmer-sample": "农户样本",
  "family-farm-sample": "家庭农场样本",
  "agricultural-station-observation": "农技站观察",
  "field-yield-survey": "田间测产",
};

export const productionPeriodNames: Readonly<Record<string, string>> = {
  "2026-W31": "2026 年第 31 周",
};

export const productionReleaseVersionNames: Readonly<Record<string, string>> = {
  "METRIC-2026-W31-V3": "2026年第31周已核定数据（当前采用）",
};

export function governedProductionName(
  names: Readonly<Record<string, string>>,
  id: string | null | undefined,
  missingLabel: string,
): string {
  if (!id) return missingLabel;
  return names[id] ?? missingLabel;
}

export function formatProductionDateTime(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return "时间待维护";
  return `${match[1]}年${String(Number(match[2]))}月${String(Number(match[3]))}日 ${match[4]}:${match[5]}`;
}
