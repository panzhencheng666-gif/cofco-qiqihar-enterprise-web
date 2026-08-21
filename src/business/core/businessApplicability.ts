export type GrainProductId = "corn" | "soybean" | "paddy";

export type ProductionBusinessObjectTypeId =
  "farmer" | "village-committee" | "agri-station";

export type MarketBusinessObjectTypeId =
  | "trader"
  | "deep-processing"
  | "rice-mill"
  | "breeding-farm"
  | "feed-mill"
  | "wholesale-market"
  | "reserve-storage";

export interface BusinessOption<TId extends string> {
  id: TId;
  label: string;
}

export interface ApplicableBusinessField {
  id: string;
  label: string;
  unit?: string;
}

export interface ApplicableBusinessFieldGroup {
  id: string;
  label: string;
  fields: readonly ApplicableBusinessField[];
}

const productionObjectTypes = [
  { id: "farmer", label: "农户" },
  { id: "village-committee", label: "村委会" },
  { id: "agri-station", label: "农技站" },
] as const satisfies readonly BusinessOption<ProductionBusinessObjectTypeId>[];

const marketObjectTypes = {
  trader: { id: "trader", label: "贸易商" },
  "deep-processing": { id: "deep-processing", label: "深加工企业" },
  "rice-mill": { id: "rice-mill", label: "米厂" },
  "breeding-farm": { id: "breeding-farm", label: "养殖场" },
  "feed-mill": { id: "feed-mill", label: "饲料厂" },
  "wholesale-market": { id: "wholesale-market", label: "批发市场" },
  "reserve-storage": { id: "reserve-storage", label: "承储企业" },
} as const satisfies Record<
  MarketBusinessObjectTypeId,
  BusinessOption<MarketBusinessObjectTypeId>
>;

const marketObjectTypeIdsByProduct: Readonly<
  Record<GrainProductId, readonly MarketBusinessObjectTypeId[]>
> = {
  corn: [
    "trader",
    "deep-processing",
    "breeding-farm",
    "feed-mill",
    "wholesale-market",
    "reserve-storage",
  ],
  soybean: ["trader", "deep-processing", "wholesale-market", "reserve-storage"],
  paddy: ["trader", "deep-processing", "wholesale-market", "reserve-storage"],
};

const processingSubtypes: Readonly<
  Record<GrainProductId, readonly BusinessOption<string>[]>
> = {
  corn: [{ id: "corn-processing", label: "玉米深加工" }],
  soybean: [
    { id: "soybean-crushing", label: "大豆压榨" },
    { id: "soybean-protein", label: "大豆蛋白加工" },
    { id: "soybean-food", label: "大豆食品加工" },
  ],
  paddy: [{ id: "rice-mill", label: "米厂" }],
};

const grainQualityFields: Readonly<
  Record<GrainProductId, readonly ApplicableBusinessField[]>
> = {
  corn: [
    { id: "moisture", label: "水分", unit: "%" },
    { id: "testWeight", label: "容重", unit: "克/升" },
    { id: "toxin", label: "毒素" },
    { id: "impurity", label: "杂质", unit: "%" },
    { id: "imperfectGrain", label: "不完善粒", unit: "%" },
    { id: "mildew", label: "霉变粒", unit: "%" },
  ],
  soybean: [
    { id: "protein", label: "蛋白", unit: "%" },
    { id: "oilYield", label: "出油率", unit: "%" },
    { id: "imperfectGrain", label: "不完善粒", unit: "%" },
    { id: "moisture", label: "水分", unit: "%" },
    { id: "impurity", label: "杂质", unit: "%" },
  ],
  paddy: [
    { id: "moisture", label: "水分", unit: "%" },
    { id: "milledRiceRate", label: "出米率", unit: "%" },
    { id: "brownRiceRate", label: "出糙率", unit: "%" },
    { id: "impurity", label: "杂质", unit: "%" },
  ],
};

const procurementFields: readonly ApplicableBusinessField[] = [
  { id: "purchasePrice", label: "采集对象收购价格", unit: "元/吨" },
  { id: "salesPrice", label: "采集对象销售价格", unit: "元/吨" },
  { id: "purchaseVolume", label: "采购量", unit: "吨" },
  { id: "wagonPrice", label: "车板价", unit: "元/吨" },
  { id: "freight", label: "运费", unit: "元/吨" },
  { id: "packaging", label: "包装形态" },
];

const inventoryFields: readonly ApplicableBusinessField[] = [
  { id: "inventory", label: "现有库存", unit: "吨" },
];

const salesFields: readonly ApplicableBusinessField[] = [
  { id: "salesVolume", label: "销售量", unit: "吨" },
];

const allInTransactionFields: readonly ApplicableBusinessField[] = [
  { id: "purchasePrice", label: "采集对象收购价格", unit: "元/吨" },
  { id: "salesPrice", label: "采集对象销售价格", unit: "元/吨" },
  { id: "wagonPrice", label: "车板价", unit: "元/吨" },
  { id: "freight", label: "运费", unit: "元/吨" },
  { id: "packaging", label: "包装形态" },
];

export function getProductionObjectTypeOptions(): readonly BusinessOption<ProductionBusinessObjectTypeId>[] {
  return productionObjectTypes;
}

export function normalizeProductionObjectType(
  objectTypeId: string,
): ProductionBusinessObjectTypeId {
  if (
    objectTypeId === "survey-area" ||
    objectTypeId === "village-ledger" ||
    objectTypeId === "village-committee"
  ) {
    return "village-committee";
  }
  if (objectTypeId === "agri-station" || objectTypeId === "field-plot") {
    return "agri-station";
  }
  return "farmer";
}

export function getMarketObjectTypeOptions(
  productId: GrainProductId,
): readonly BusinessOption<MarketBusinessObjectTypeId>[] {
  return marketObjectTypeIdsByProduct[productId].map(
    (objectTypeId) => marketObjectTypes[objectTypeId],
  );
}

export function getMarketObjectSubtypeOptions(
  productId: GrainProductId,
  objectTypeId: MarketBusinessObjectTypeId,
): readonly BusinessOption<string>[] {
  return objectTypeId === "deep-processing"
    ? processingSubtypes[productId]
    : [];
}

export function getGrainQualityFields(
  productId: GrainProductId,
): readonly ApplicableBusinessField[] {
  return grainQualityFields[productId];
}

export function getMarketCapabilityGroups(
  productId: GrainProductId,
  objectTypeId: MarketBusinessObjectTypeId,
): readonly ApplicableBusinessFieldGroup[] {
  const procurement: ApplicableBusinessFieldGroup = {
    id: "procurement",
    label: "交易信息",
    fields: procurementFields,
  };
  const quality: ApplicableBusinessFieldGroup = {
    id: "quality",
    label: `${productId === "corn" ? "玉米" : productId === "soybean" ? "大豆" : "稻谷"}质量`,
    fields: grainQualityFields[productId],
  };
  const inventory: ApplicableBusinessFieldGroup = {
    id: "inventory",
    label: "库存",
    fields: inventoryFields,
  };
  if (objectTypeId === "trader") {
    return [
      { ...procurement, fields: [...procurement.fields, ...salesFields] },
      quality,
      inventory,
    ];
  }
  if (
    objectTypeId === "deep-processing" ||
    objectTypeId === "rice-mill" ||
    objectTypeId === "feed-mill"
  ) {
    return [procurement, quality, inventory];
  }
  if (objectTypeId === "breeding-farm") {
    return [procurement, quality, inventory];
  }
  if (objectTypeId === "wholesale-market") {
    return [
      {
        id: "sales",
        label: "交易信息",
        fields: [...salesFields, ...allInTransactionFields],
      },
      quality,
      inventory,
    ];
  }
  return [
    {
      id: "prices",
      label: "交易信息",
      fields: allInTransactionFields,
    },
    quality,
    inventory,
  ];
}

export function normalizeMarketObjectType(
  objectTypeId: string,
  roleId?: string,
): MarketBusinessObjectTypeId {
  if (
    roleId === "corn-processor" ||
    roleId === "soy-crusher" ||
    roleId === "soy-protein" ||
    roleId === "food-condiment" ||
    roleId === "rice-mill" ||
    objectTypeId === "grain-processing-enterprise"
  ) {
    return "deep-processing";
  }
  if (roleId === "feed" || objectTypeId === "feed-mill") return "feed-mill";
  if (roleId === "livestock" || objectTypeId === "breeding-farm") {
    return "breeding-farm";
  }
  if (roleId === "wholesale-market" || objectTypeId === "wholesale-market") {
    return "wholesale-market";
  }
  if (
    roleId === "reserve" ||
    objectTypeId === "grain-storage-enterprise" ||
    objectTypeId === "reserve-storage"
  ) {
    return "reserve-storage";
  }
  return "trader";
}
