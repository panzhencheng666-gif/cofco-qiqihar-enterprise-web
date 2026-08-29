import { describe, expect, it } from "vitest";

import type {
  LogisticsDefinition,
  MarketDefinition,
  ProductionDefinition,
} from "@/platform/api/realtimeBusinessRepository";
import {
  mergeObservationFields,
  observationFields,
} from "./formalSampleObservationFields";

describe("formal sample observation field contract", () => {
  it("uses one market definition for both ledger columns and update inputs", () => {
    const definition: MarketDefinition = {
      productCode: "CORN",
      objectTypeCode: "DEEP_PROCESSOR",
      coreFields: [
        {
          code: "MKT_SAMPLE_NAME",
          label: "样本点名称",
          controlType: "TEXT",
          unit: null,
          description: null,
          capability: null,
          required: true,
          precision: null,
          scale: null,
          sortOrder: 1,
          options: [],
        },
        {
          code: "MKT_PURCHASE_BASE_PRICE",
          label: "采购基础价",
          controlType: "DECIMAL",
          unit: "元/吨",
          description: null,
          capability: null,
          required: true,
          precision: 18,
          scale: 4,
          sortOrder: 2,
          options: [],
        },
      ],
      groups: [
        {
          category: "INVENTORY",
          label: "库存情况",
          sortOrder: 20,
          fields: [
            {
              code: "ENDING_INVENTORY",
              label: "期末库存",
              valueType: "DECIMAL",
              unit: "吨",
              description: null,
              precision: 18,
              scale: 4,
              sortOrder: 1,
            },
            {
              code: "STOCK_OUTFLOW",
              label: "出库量",
              valueType: "DECIMAL",
              unit: "吨",
              description: null,
              precision: 18,
              scale: 4,
              sortOrder: 2,
            },
          ],
        },
      ],
    };

    expect(
      observationFields("MARKET", definition).map(({ code }) => code),
    ).toEqual(["MKT_PURCHASE_BASE_PRICE", "ENDING_INVENTORY", "STOCK_OUTFLOW"]);
  });

  it("normalizes production and logistics without editable identity fields", () => {
    const production = {
      productCode: "CORN",
      objectTypeCode: "FARMER",
      contractVersion: "2026.1",
      contractDigest: "digest",
      fields: [
        {
          code: "PROD_SAMPLE_LATITUDE",
          label: "纬度",
          groupCode: "IDENTITY",
          groupLabel: "身份",
          groupOrder: 0,
          sortOrder: 1,
          valueType: "DECIMAL",
          controlType: "NUMBER",
          unit: null,
          required: true,
          options: [],
          readOnly: false,
          calculated: false,
          importable: true,
          displayed: true,
          description: null,
          precision: 18,
          scale: 7,
        },
        {
          code: "PROD_AREA_MU",
          label: "播种面积",
          groupCode: "AREA",
          groupLabel: "面积与长势",
          groupOrder: 10,
          sortOrder: 1,
          valueType: "DECIMAL",
          controlType: "NUMBER",
          unit: "亩",
          required: true,
          options: [],
          readOnly: false,
          calculated: false,
          importable: true,
          displayed: true,
          description: null,
          precision: 18,
          scale: 4,
        },
      ],
      groups: [],
    } as unknown as ProductionDefinition;
    const logistics = {
      productCode: "CORN",
      fields: [
        {
          code: "LOG_REGION",
          label: "地区",
          controlType: "TEXT",
          unit: null,
          precision: null,
          scale: null,
          required: true,
          readOnly: false,
          sortOrder: 1,
          options: [],
        },
        {
          code: "LOG_ROUTE_VOLUME",
          label: "运输数量",
          controlType: "DECIMAL",
          unit: "吨",
          precision: 18,
          scale: 4,
          required: true,
          readOnly: false,
          sortOrder: 2,
          options: [],
        },
      ],
      actions: [],
    } satisfies LogisticsDefinition;

    expect(
      observationFields("PRODUCTION", production).map(({ code }) => code),
    ).toEqual(["PROD_AREA_MU"]);
    expect(
      observationFields("LOGISTICS", logistics).map(({ code }) => code),
    ).toEqual(["LOG_ROUTE_VOLUME"]);
  });

  it("merges multiple object-type definitions by field code and stable order", () => {
    const fields = mergeObservationFields([
      [
        {
          code: "A",
          label: "字段A",
          unit: null,
          controlType: "DECIMAL",
          required: true,
          readOnly: false,
          sortOrder: 2,
          section: "基础",
          sectionOrder: 0,
          options: [],
        },
        {
          code: "B",
          label: "字段B",
          unit: null,
          controlType: "DECIMAL",
          required: false,
          readOnly: false,
          sortOrder: 1,
          section: "库存",
          sectionOrder: 20,
          options: [],
        },
      ],
      [
        {
          code: "A",
          label: "字段A",
          unit: null,
          controlType: "DECIMAL",
          required: true,
          readOnly: false,
          sortOrder: 2,
          section: "基础",
          sectionOrder: 0,
          options: [],
        },
        {
          code: "C",
          label: "字段C",
          unit: null,
          controlType: "DECIMAL",
          required: false,
          readOnly: false,
          sortOrder: 2,
          section: "库存",
          sectionOrder: 20,
          options: [],
        },
      ],
    ]);

    expect(fields.map(({ code }) => code)).toEqual(["A", "B", "C"]);
  });
});
