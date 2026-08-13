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

export function productionFields(
  definition: ProductionDefinition,
): readonly RealtimeFormField[] {
  return definition.fields
    .filter(({ displayed }) => displayed)
    .map((field) => ({
      code: field.code,
      label: field.label,
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
      section: field.groupLabel,
      readOnly: field.readOnly || field.calculated,
    }));
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
  const metadataCodes = definition.fields
    .filter(
      ({ code, groupCode }) =>
        code.startsWith("PROD_") &&
        !["QUALITY", "COST", "INSURANCE", "SUBSIDY"].includes(groupCode),
    )
    .map(({ code }) => code);
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
    submissionMetadata: populated(values, metadataCodes),
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
  if ("contractVersion" in definition) {
    const dynamicGroups = new Set(
      definition.groups.map(({ category }) => category.toUpperCase()),
    );
    return productionFields(definition).filter(({ code }) => {
      const field = definition.fields.find(
        (candidate) => candidate.code === code,
      );
      return field ? dynamicGroups.has(field.groupCode.toUpperCase()) : false;
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
