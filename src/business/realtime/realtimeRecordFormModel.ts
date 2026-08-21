import type {
  MarketDefinition,
  MarketDraftPayload,
  ProductionDefinition,
  ProductionDraftPayload,
} from "@/platform/api/realtimeBusinessRepository";
import {
  getMarketCapabilityGroups,
  type GrainProductId,
  type MarketBusinessObjectTypeId,
} from "../core/businessApplicability";
import { PRODUCTION_PUBLIC_FIELD_ORDER } from "@/platform/api/productionSurveyContract";

export interface RealtimeFormField {
  code: string;
  label: string;
  type: "text" | "date" | "decimal" | "select" | "region";
  required?: boolean;
  unit?: string | null;
  options?: readonly { value: string; label: string }[];
  section?: string;
  readOnly?: boolean;
}

const productionBusinessFieldOrder = PRODUCTION_PUBLIC_FIELD_ORDER;

const productionBusinessCodes = new Set<string>(productionBusinessFieldOrder);
const productionLabels: Readonly<Record<string, string>> = {
  objectTypeCode: "样本点类型",
  regionCode: "地区",
  PROD_SAMPLE_NAME: "样本点名称",
  PROD_SAMPLE_CONTACT: "样本点联系方式",
  PROD_SAMPLE_LATITUDE: "纬度",
  PROD_SAMPLE_LONGITUDE: "经度",
  PROD_OPENING_INVENTORY: "期初库存",
  PROD_ENDING_INVENTORY: "期末余粮",
  cultivatedAreaMu: "播种面积",
  yieldPerMuKilograms: "预计单产",
  yearOnYear: "与上年相比",
  SUBSIDY_AMOUNT: "政策补贴",
  INSURANCE_AMOUNT: "农业保险",
  PROD_SOURCE_NOTE: "数据来源/来源说明",
};

function productionSection(code: string): string {
  if (
    [
      "objectTypeCode",
      "regionCode",
      "PROD_CULTIVAR_NAME",
      "PROD_SAMPLE_NAME",
    ].includes(code)
  )
    return "基础信息";
  if (
    code.startsWith("PROD_REPORTER_") ||
    code.startsWith("PROD_SAMPLE_CONTACT") ||
    code.startsWith("PROD_SAMPLE_LATITUDE") ||
    code.startsWith("PROD_SAMPLE_LONGITUDE")
  )
    return "填报与定位";
  if (
    [
      "cultivatedAreaMu",
      "PROD_HARVEST_AREA_MU",
      "PROD_AFFECTED_AREA_MU",
      "PROD_GROWTH_STATUS",
      "PROD_GROWTH_STAGE",
    ].includes(code)
  )
    return "面积与长势";
  if (
    ["yieldPerMuKilograms", "estimatedOutputKilograms", "yearOnYear"].includes(
      code,
    )
  )
    return "测产与产量";
  if (
    [
      "MOISTURE",
      "TEST_WEIGHT",
      "TOXIN",
      "IMPURITY",
      "IMPERFECT_GRAIN",
      "MILDEW",
      "PROTEIN",
      "OIL_YIELD",
      "MILLING_YIELD",
      "BROWN_RICE_YIELD",
    ].includes(code)
  )
    return "品种质量";
  if (
    [
      "PROD_OPENING_INVENTORY",
      "PROD_SALES_VOLUME",
      "PROD_SELF_USE",
      "PROD_ENDING_INVENTORY",
    ].includes(code)
  )
    return "余粮、销售与使用";
  if (["PROD_INTENDED_AREA_MU", "PROD_INTENTION_REASON"].includes(code))
    return "种植意向";
  if (
    [
      "LAND_RENT",
      "SEED_COST",
      "PESTICIDE_COST",
      "FERTILIZER_COST",
      "IRRIGATION_COST",
      "LABOR_COST",
      "MACHINERY_COST",
      "OTHER_COST",
    ].includes(code)
  )
    return "成本费用";
  if (["SUBSIDY_AMOUNT", "INSURANCE_AMOUNT"].includes(code))
    return "补贴与保险";
  return "业务来源";
}

const surveyYearOptions = Array.from({ length: 12 }, (_, index) => {
  const value = String(new Date().getFullYear() + 1 - index);
  return { value, label: `${value} 年` };
});
const surveyMonthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: `${index + 1} 月`,
}));

const marketObjectTypeByCode: Readonly<
  Record<string, MarketBusinessObjectTypeId>
> = {
  TRADER: "trader",
  DEEP_PROCESSOR: "deep-processing",
  RICE_MILL: "rice-mill",
  BREEDING_FACTORY: "breeding-farm",
  FEED_MILL: "feed-mill",
  WHOLESALE_MARKET: "wholesale-market",
  RESERVE_ENTERPRISE: "reserve-storage",
};
const marketProductByCode: Readonly<Record<string, GrainProductId>> = {
  CORN: "corn",
  SOYBEAN: "soybean",
  RICE: "paddy",
};
const marketCodeByCapability: Readonly<Record<string, string>> = {
  purchasePrice: "MKT_PURCHASE_BASE_PRICE",
  salesPrice: "MKT_SALE_BASE_PRICE",
  purchaseVolume: "PURCHASE_VOLUME",
  salesVolume: "SALES_VOLUME",
  wagonPrice: "MKT_CARRIAGE_BOARD_AMOUNT",
  freight: "MKT_FREIGHT_AMOUNT",
  packaging: "MKT_PACKAGING_FORM",
  moisture: "MOISTURE",
  testWeight: "TEST_WEIGHT",
  toxin: "TOXIN",
  impurity: "IMPURITY",
  imperfectGrain: "IMPERFECT_GRAIN",
  mildew: "MILDEW",
  protein: "PROTEIN",
  oilYield: "OIL_YIELD",
  milledRiceRate: "MILLING_YIELD",
  brownRiceRate: "BROWN_RICE_YIELD",
  inventory: "ENDING_INVENTORY",
};
const marketBaseOrder = [
  "MKT_SAMPLE_NAME",
  "MKT_OBJECT_TYPE",
  "MKT_REGION",
  "MKT_REPORTER_NAME",
  "MKT_REPORTER_PHONE",
  "MKT_SAMPLE_CONTACT",
  "MKT_SAMPLE_LATITUDE",
  "MKT_SAMPLE_LONGITUDE",
] as const;
const marketLabels: Readonly<Record<string, string>> = {
  MKT_OBJECT_TYPE: "样本点类型",
  MKT_REGION: "地区",
  MKT_SAMPLE_NAME: "样本点名称",
  MKT_REPORTER_NAME: "填报人",
  MKT_REPORTER_PHONE: "填报人联系方式",
  MKT_SAMPLE_CONTACT: "样本点联系方式",
  MKT_SAMPLE_LATITUDE: "纬度",
  MKT_SAMPLE_LONGITUDE: "经度",
  MKT_PURCHASE_BASE_PRICE: "采集对象收购价格",
  MKT_SALE_BASE_PRICE: "采集对象销售价格",
  ENDING_INVENTORY: "现有库存",
};

function marketSection(code: string): string {
  if (["MKT_SAMPLE_NAME", "MKT_OBJECT_TYPE", "MKT_REGION"].includes(code))
    return "基础信息";
  if (
    [
      "MKT_REPORTER_NAME",
      "MKT_REPORTER_PHONE",
      "MKT_SAMPLE_CONTACT",
      "MKT_SAMPLE_LATITUDE",
      "MKT_SAMPLE_LONGITUDE",
    ].includes(code)
  )
    return "填报与定位";
  if (
    [
      "MKT_PURCHASE_BASE_PRICE",
      "MKT_SALE_BASE_PRICE",
      "PURCHASE_VOLUME",
      "SALES_VOLUME",
      "MKT_CARRIAGE_BOARD_AMOUNT",
      "MKT_FREIGHT_AMOUNT",
      "MKT_PACKAGING_FORM",
    ].includes(code)
  )
    return "交易信息";
  if (code === "ENDING_INVENTORY") return "库存信息";
  return "品种质量";
}

export function marketFields(
  definition: MarketDefinition,
): readonly RealtimeFormField[] {
  const productId = marketProductByCode[definition.productCode] ?? "corn";
  const objectTypeId = definition.objectTypeCode
    ? (marketObjectTypeByCode[definition.objectTypeCode] ?? "trader")
    : "trader";
  const applicableCodes = getMarketCapabilityGroups(productId, objectTypeId)
    .flatMap(({ fields }) => fields)
    .map(({ id }) => marketCodeByCapability[id])
    .filter((code): code is string => Boolean(code));
  const coreByCode = new Map(
    definition.coreFields.map((field) => [field.code, field]),
  );
  const factByCode = new Map(
    definition.groups
      .flatMap(({ fields }) => fields)
      .map((field) => [field.code, field]),
  );
  const orderedCodes = [
    ...marketBaseOrder,
    ...applicableCodes.filter(
      (code, index) => applicableCodes.indexOf(code) === index,
    ),
  ];
  const mapped = orderedCodes.flatMap((code) => {
    const core = coreByCode.get(code);
    const fact = factByCode.get(code);
    if (!core && !fact) return [];
    const controlType = core?.controlType;
    const options = core?.options ?? [];
    return [
      {
        code,
        label: marketLabels[code] ?? core?.label ?? fact?.label ?? code,
        type:
          code === "MKT_REGION" || code === "MKT_STORAGE_REGION_CODE"
            ? ("region" as const)
            : controlType === "SELECT"
              ? ("select" as const)
              : core?.controlType === "DATE"
                ? ("date" as const)
                : core?.controlType === "DECIMAL" ||
                    fact?.valueType === "DECIMAL"
                  ? ("decimal" as const)
                  : ("text" as const),
        required: core?.required ?? false,
        unit: core?.unit ?? fact?.unit ?? null,
        options,
        section: marketSection(code),
        readOnly: core?.controlType.startsWith("READONLY") ?? false,
      },
    ];
  });
  return [
    {
      code: "surveyYear",
      label: "数据年份",
      type: "select" as const,
      required: true,
      options: surveyYearOptions,
      section: "数据时间",
    },
    {
      code: "surveyMonth",
      label: "数据月份",
      type: "select" as const,
      required: false,
      options: surveyMonthOptions,
      section: "数据时间",
    },
    ...mapped,
  ];
}

export function productionFields(
  definition: ProductionDefinition,
): readonly RealtimeFormField[] {
  const byCode = new Map(definition.fields.map((field) => [field.code, field]));
  const fields = productionBusinessFieldOrder.flatMap((code) => {
    const field = byCode.get(code);
    return field ? [field] : [];
  });
  const mapped = fields.map((field) => ({
    code: field.code,
    label: productionLabels[field.code] ?? field.label,
    type:
      field.controlType === "REGION"
        ? ("region" as const)
        : field.controlType === "SELECT"
          ? ("select" as const)
          : field.controlType === "DATE"
            ? ("date" as const)
            : field.valueType === "DECIMAL"
              ? ("decimal" as const)
              : ("text" as const),
    required: field.required,
    unit: field.unit,
    options: field.options.map((value) => ({ value, label: value })),
    section: productionSection(field.code),
    readOnly: field.readOnly || field.calculated,
  }));
  return [
    {
      code: "surveyYear",
      label: "数据年份",
      type: "select" as const,
      required: true,
      options: surveyYearOptions,
      section: "数据时间",
    },
    {
      code: "surveyMonth",
      label: "数据月份",
      type: "select" as const,
      required: false,
      options: surveyMonthOptions,
      section: "数据时间",
    },
    {
      code: "fillingDate",
      label: "填报日期",
      type: "date" as const,
      required: false,
      section: "数据时间",
      readOnly: true,
    },
    ...mapped,
  ];
}

function populated(
  values: Readonly<Record<string, string>>,
  codes: readonly string[],
): Record<string, string> {
  return Object.fromEntries(
    codes.flatMap((code) => {
      const value = values[code]?.trim();
      return value ? [[code, value] as const] : [];
    }),
  );
}

function categoryValues(
  values: Readonly<Record<string, string>>,
  definition: ProductionDefinition | undefined,
  category: string,
): Record<string, string> {
  const codes =
    definition?.fields
      .filter((field) => field.groupCode.toUpperCase() === category)
      .map((field) => field.code) ?? [];
  return populated(values, codes);
}

export function productionPayloadFromValues(
  values: Readonly<Record<string, string>>,
  lockedProductCode: string,
  definition: ProductionDefinition,
): ProductionDraftPayload {
  const metadataCodes = productionBusinessFieldOrder.filter(
    (code) =>
      code.startsWith("PROD_") &&
      definition.fields.some(
        (field) =>
          field.code === code &&
          !["QUALITY", "COST", "INSURANCE", "SUBSIDY"].includes(
            field.groupCode,
          ),
      ),
  );
  const surveyYear = values.surveyYear?.trim() ?? "";
  const surveyMonth = values.surveyMonth?.trim() ?? "";
  return {
    productCode: lockedProductCode.trim().toUpperCase(),
    objectTypeCode: values.objectTypeCode?.trim() ?? "",
    regionCode: values.regionCode?.trim() ?? "",
    cultivarCode: null,
    surveyYear,
    surveyMonth: surveyMonth || null,
    cultivatedAreaMu: values.cultivatedAreaMu?.trim() ?? "",
    yieldPerMuKilograms: values.yieldPerMuKilograms?.trim() ?? "",
    quality: categoryValues(values, definition, "QUALITY"),
    costs: categoryValues(values, definition, "COST"),
    insurance: categoryValues(values, definition, "INSURANCE"),
    subsidies: categoryValues(values, definition, "SUBSIDY"),
    submissionMetadata: populated(values, metadataCodes),
    evidencePhotoIds: [],
  };
}

export function marketPayloadFromValues(
  values: Readonly<Record<string, string>>,
  productCode: string,
  definition: MarketDefinition,
): MarketDraftPayload {
  const surveyYear = values.surveyYear?.trim() ?? "";
  const surveyMonth = values.surveyMonth?.trim() ?? "";
  const businessCodes = marketFields(definition)
    .map(({ code }) => code)
    .filter((code) => code !== "surveyYear" && code !== "surveyMonth");
  const coreCodes = new Set(definition.coreFields.map(({ code }) => code));
  const coreValues = populated(
    values,
    businessCodes.filter((code) => coreCodes.has(code)),
  );
  const facts = populated(
    values,
    businessCodes.filter((code) => !coreCodes.has(code)),
  );
  if (facts.ENDING_INVENTORY && coreValues.MKT_REGION) {
    coreValues.MKT_STORAGE_REGION_CODE =
      values.MKT_STORAGE_REGION_CODE?.trim() || coreValues.MKT_REGION;
  }
  if (!coreValues.MKT_TRADE_DATE && surveyYear) {
    coreValues.MKT_TRADE_DATE = `${surveyYear}-${(surveyMonth || "1").padStart(2, "0")}-01`;
  }
  return {
    productCode,
    surveyYear,
    surveyMonth: surveyMonth || null,
    coreValues,
    facts,
    evidencePhotoIds: [],
  };
}

export function definitionFields(
  definition: ProductionDefinition | MarketDefinition,
): readonly RealtimeFormField[] {
  if ("contractVersion" in definition) {
    const dynamicGroups = new Set(
      definition.groups.map(({ category }) => category.toUpperCase()),
    );
    return productionFields(definition).filter(({ code }) => {
      const field = definition.fields.find(
        (candidate) => candidate.code === code,
      );
      return field
        ? productionBusinessCodes.has(code) &&
            dynamicGroups.has(field.groupCode.toUpperCase())
        : false;
    });
  }
  return definition.groups.flatMap((group) =>
    group.fields.map((field) => ({
      code: field.code,
      label: field.label,
      type:
        field.valueType === "DECIMAL"
          ? ("decimal" as const)
          : ("text" as const),
      unit: field.unit,
      section: group.label,
      required: field.code === "PROD_SAMPLE_NAME",
    })),
  );
}
