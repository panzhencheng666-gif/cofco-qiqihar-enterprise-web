import type {
  MarketDefinition,
  MarketDraftPayload,
  ProductionDefinition,
  ProductionDraftPayload,
} from "@/platform/api/realtimeBusinessRepository";

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

export const productionCoreFields: readonly RealtimeFormField[] = [
  {
    code: "objectTypeCode",
    label: "样本点类型",
    type: "select",
    required: true,
    section: "基础信息",
  },
  {
    code: "regionCode",
    label: "所在地区",
    type: "select",
    required: true,
    section: "基础信息",
  },
  {
    code: "PROD_CULTIVAR_NAME",
    label: "具体品种",
    type: "text",
    section: "基础信息",
  },
  {
    code: "surveyDate",
    label: "调查日期",
    type: "date",
    required: true,
    section: "基础信息",
  },
  {
    code: "cultivatedAreaMu",
    label: "种植面积",
    type: "decimal",
    required: true,
    unit: "亩",
    section: "产量信息",
  },
  {
    code: "yieldPerMuKilograms",
    label: "权威采用单产",
    type: "decimal",
    required: true,
    unit: "公斤/亩",
    section: "产量信息",
  },
  {
    code: "estimatedOutputKilograms",
    label: "预计总产",
    type: "decimal",
    unit: "公斤",
    section: "产量信息",
    readOnly: true,
  },
  {
    code: "yearOnYear",
    label: "与上年同比",
    type: "text",
    section: "产量信息",
    readOnly: true,
  },
];

export const productionMetadataFields: readonly RealtimeFormField[] = [
  {
    code: "PROD_REPORTER_NAME",
    label: "填报人",
    type: "text",
    required: true,
    section: "联系与位置",
  },
  {
    code: "PROD_REPORTER_PHONE",
    label: "填报人联系方式",
    type: "text",
    required: true,
    section: "联系与位置",
  },
  {
    code: "PROD_SAMPLE_CONTACT",
    label: "填报对象联系方式",
    type: "text",
    required: true,
    section: "联系与位置",
  },
  {
    code: "PROD_SAMPLE_LATITUDE",
    label: "填报对象纬度",
    type: "decimal",
    required: true,
    unit: "度",
    section: "联系与位置",
  },
  {
    code: "PROD_SAMPLE_LONGITUDE",
    label: "填报对象经度",
    type: "decimal",
    required: true,
    unit: "度",
    section: "联系与位置",
  },
];

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
    definition?.groups
      .filter((group) => group.category.toUpperCase() === category)
      .flatMap((group) => group.fields.map((field) => field.code)) ?? [];
  return populated(values, codes);
}

export function productionPayloadFromValues(
  values: Readonly<Record<string, string>>,
  lockedProductCode: string,
  definition?: ProductionDefinition,
): ProductionDraftPayload {
  return {
    productCode: lockedProductCode.trim().toUpperCase(),
    objectTypeCode: values.objectTypeCode?.trim() ?? "",
    regionCode: values.regionCode?.trim() ?? "",
    cultivarCode: null,
    surveyDate: values.surveyDate?.trim() ?? "",
    cultivatedAreaMu: values.cultivatedAreaMu?.trim() ?? "",
    yieldPerMuKilograms: values.yieldPerMuKilograms?.trim() ?? "",
    quality: categoryValues(values, definition, "QUALITY"),
    costs: categoryValues(values, definition, "COST"),
    insurance: categoryValues(values, definition, "INSURANCE"),
    subsidies: categoryValues(values, definition, "SUBSIDY"),
    submissionMetadata: {
      ...populated(values, [
        "PROD_CULTIVAR_NAME",
        ...productionMetadataFields.map(({ code }) => code),
      ]),
      ...categoryValues(values, definition, "DETAIL"),
    },
    evidencePhotoIds: [],
  };
}

export function marketPayloadFromValues(
  values: Readonly<Record<string, string>>,
  productCode: string,
  definition: MarketDefinition,
): MarketDraftPayload {
  return {
    productCode,
    coreValues: populated(
      values,
      definition.coreFields
        .filter(({ controlType }) => !controlType.startsWith("READONLY"))
        .map(({ code }) => code),
    ),
    facts: populated(
      values,
      definition.groups.flatMap((group) =>
        group.fields.map(({ code }) => code),
      ),
    ),
    evidencePhotoIds: [],
  };
}

export function definitionFields(
  definition: ProductionDefinition | MarketDefinition,
): readonly RealtimeFormField[] {
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
