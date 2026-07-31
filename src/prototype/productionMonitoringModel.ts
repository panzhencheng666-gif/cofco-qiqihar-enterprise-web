export type ProductionCrop = "corn" | "soybean" | "paddy";
export type ProductionObjectType =
  | "farmer"
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
  "cost-support": "投入、政策支持与保险",
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
    "evidence",
  ],
  "agri-station": ["growth", "yield", "quality", "evidence"],
  "village-ledger": ["variety", "area", "yield", "stock-sale", "evidence"],
  "field-plot": ["variety", "growth", "yield", "quality", "evidence"],
};

export function getProductionFieldGroups(
  objectType: ProductionObjectType,
  _crop: ProductionCrop,
): ProductionFieldGroup[] {
  return objectFields[objectType].map((key) => ({
    key,
    label: fieldLabels[key],
  }));
}
