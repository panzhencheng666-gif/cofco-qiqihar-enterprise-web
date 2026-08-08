import type {
  MarketDefinition,
  MarketDraftPayload,
  ProductionDefinition,
  ProductionDraftPayload,
} from "@/platform/api/realtimeBusinessRepository";

export interface RealtimeFormField {
  code: string;
  label: string;
  type: "text" | "date" | "decimal" | "select";
  required?: boolean;
  unit?: string | null;
  options?: readonly { value: string; label: string }[];
}

export const productionCoreFields: readonly RealtimeFormField[] = [
  { code: "productCode", label: "品种", type: "select", required: true },
  {
    code: "objectTypeCode",
    label: "样本点类型",
    type: "select",
    required: true,
  },
  { code: "regionCode", label: "所在地区", type: "select", required: true },
  { code: "cultivarCode", label: "具体品种", type: "select" },
  { code: "surveyDate", label: "调查日期", type: "date", required: true },
  {
    code: "cultivatedAreaMu",
    label: "种植面积",
    type: "decimal",
    required: true,
    unit: "亩",
  },
  {
    code: "yieldPerMuKilograms",
    label: "权威采用单产",
    type: "decimal",
    required: true,
    unit: "公斤/亩",
  },
];

export const productionMetadataFields: readonly RealtimeFormField[] = [
  { code: "PROD_REPORTER_NAME", label: "填报人", type: "text", required: true },
  {
    code: "PROD_REPORTER_PHONE",
    label: "填报人联系方式",
    type: "text",
    required: true,
  },
  {
    code: "PROD_SAMPLE_CONTACT",
    label: "样本点联系方式",
    type: "text",
    required: true,
  },
  {
    code: "PROD_SAMPLE_LATITUDE",
    label: "样本点纬度",
    type: "decimal",
    required: true,
    unit: "度",
  },
  {
    code: "PROD_SAMPLE_LONGITUDE",
    label: "样本点经度",
    type: "decimal",
    required: true,
    unit: "度",
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
  definition?: ProductionDefinition,
): ProductionDraftPayload {
  return {
    productCode: values.productCode?.trim() ?? "",
    objectTypeCode: values.objectTypeCode?.trim() ?? "",
    regionCode: values.regionCode?.trim() ?? "",
    cultivarCode: values.cultivarCode?.trim() || null,
    surveyDate: values.surveyDate?.trim() ?? "",
    cultivatedAreaMu: values.cultivatedAreaMu?.trim() ?? "",
    yieldPerMuKilograms: values.yieldPerMuKilograms?.trim() ?? "",
    quality: categoryValues(values, definition, "QUALITY"),
    costs: categoryValues(values, definition, "COST"),
    insurance: categoryValues(values, definition, "INSURANCE"),
    subsidies: categoryValues(values, definition, "SUBSIDY"),
    submissionMetadata: populated(
      values,
      productionMetadataFields.map(({ code }) => code),
    ),
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
      definition.coreFields.map(({ code }) => code),
    ),
    facts: populated(
      values,
      definition.groups.flatMap((group) =>
        group.fields.map(({ code }) => code),
      ),
    ),
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
    })),
  );
}
