import type {
  FormalSampleObservationDomain,
  LogisticsDefinition,
  MarketDefinition,
  ProductionDefinition,
} from "@/platform/api/realtimeBusinessRepository";

export interface ObservationField {
  code: string;
  label: string;
  unit: string | null;
  precision: number | null;
  scale: number | null;
  controlType: string;
  required: boolean;
  readOnly: boolean;
  sortOrder: number;
  section: string;
  sectionOrder: number;
  options: readonly { value: string; label: string }[];
}

const lockedCodes: Readonly<
  Record<FormalSampleObservationDomain, ReadonlySet<string>>
> = {
  PRODUCTION: new Set([
    "objectTypeCode",
    "regionCode",
    "surveyYear",
    "surveyMonth",
    "surveyDate",
    "fillingDate",
    "PROD_OBJECT_TYPE",
    "PROD_REGION",
    "PROD_SURVEY_DATE",
    "PROD_FILLING_AT",
    "PROD_STATUS",
    "PROD_SAMPLE_NAME",
    "PROD_SAMPLE_CONTACT",
    "PROD_SAMPLE_LATITUDE",
    "PROD_SAMPLE_LONGITUDE",
    "PROD_REPORTER_NAME",
    "PROD_SURVEYOR_NAME",
    "PROD_SURVEYOR_PHONE",
  ]),
  MARKET: new Set([
    "MKT_OBJECT_TYPE",
    "MKT_REGION",
    "MKT_TRADE_DATE",
    "MKT_REPORTED_AT",
    "MKT_FILLING_AT",
    "MKT_STATUS",
    "MKT_SAMPLE_NAME",
    "MKT_SAMPLE_CONTACT",
    "MKT_SAMPLE_LATITUDE",
    "MKT_SAMPLE_LONGITUDE",
    "MKT_REPORTER_NAME",
    "MKT_SURVEYOR_NAME",
    "MKT_SURVEYOR_PHONE",
  ]),
  LOGISTICS: new Set([
    "surveyYear",
    "surveyMonth",
    "LOG_COLLECTION_DATE",
    "LOG_FILLING_AT",
    "LOG_STATUS",
    "LOG_SAMPLE_NAME",
    "LOG_REGION",
    "LOG_REPORTER",
    "LOG_SURVEYOR_NAME",
    "LOG_SURVEYOR_PHONE",
    "LOG_SAMPLE_CONTACT",
    "LOG_SAMPLE_LATITUDE",
    "LOG_SAMPLE_LONGITUDE",
    "LOG_INTERNAL_LOCATION_KEY",
  ]),
};

export function observationFields(
  domain: FormalSampleObservationDomain,
  definition:
    ProductionDefinition | MarketDefinition | LogisticsDefinition | null,
): readonly ObservationField[] {
  if (!definition) return [];
  if (domain === "PRODUCTION") {
    const production = definition as ProductionDefinition;
    return production.fields
      .filter(
        (field) =>
          field.displayed &&
          !field.calculated &&
          !field.readOnly &&
          !lockedCodes.PRODUCTION.has(field.code),
      )
      .map((field) => ({
        code: field.code,
        label: field.label,
        unit: field.unit,
        precision: field.precision,
        scale: field.scale,
        controlType: field.controlType,
        required: field.required,
        readOnly: false,
        sortOrder: field.sortOrder,
        section: field.groupLabel,
        sectionOrder: field.groupOrder,
        options: field.options.map((value) => ({ value, label: value })),
      }));
  }
  if (domain === "MARKET") {
    const market = definition as MarketDefinition;
    const core = market.coreFields
      .filter(
        (field) =>
          !lockedCodes.MARKET.has(field.code) &&
          !field.controlType.toUpperCase().startsWith("READONLY"),
      )
      .map((field) => ({
        code: field.code,
        label: field.label,
        unit: field.unit,
        precision: field.precision,
        scale: field.scale,
        controlType: field.controlType,
        required: field.required,
        readOnly: false,
        sortOrder: field.sortOrder,
        section: "价格与交易基础",
        sectionOrder: 0,
        options: field.options.map(({ value, label }) => ({ value, label })),
      }));
    const facts = market.groups.flatMap((group) =>
      group.fields.map((field) => ({
        code: field.code,
        label: field.label,
        unit: field.unit,
        precision: field.precision,
        scale: field.scale,
        controlType: field.valueType === "DECIMAL" ? "NUMBER" : field.valueType,
        required: false,
        readOnly: false,
        sortOrder: field.sortOrder,
        section: group.label,
        sectionOrder: group.sortOrder,
        options: [],
      })),
    );
    return [...core, ...facts];
  }
  const logistics = definition as LogisticsDefinition;
  return logistics.fields
    .filter(
      (field) => !field.readOnly && !lockedCodes.LOGISTICS.has(field.code),
    )
    .map((field) => ({
      code: field.code,
      label: field.label,
      unit: field.unit,
      precision: field.precision,
      scale: field.scale,
      controlType: field.controlType,
      required: field.required,
      readOnly: false,
      sortOrder: field.sortOrder,
      section: "本次物流观测",
      sectionOrder: 0,
      options: field.options.map(({ value, label }) => ({ value, label })),
    }));
}

export function mergeObservationFields(
  groups: readonly (readonly ObservationField[])[],
): readonly ObservationField[] {
  const unique = new Map<string, ObservationField>();
  groups.flat().forEach((field) => {
    if (!unique.has(field.code)) unique.set(field.code, field);
  });
  return [...unique.values()].sort(
    (left, right) =>
      left.sectionOrder - right.sectionOrder ||
      left.sortOrder - right.sortOrder ||
      left.code.localeCompare(right.code),
  );
}

export function observationFieldLabel(
  field: Pick<ObservationField, "label" | "unit">,
): string {
  return field.unit ? `${field.label}（${field.unit}）` : field.label;
}
