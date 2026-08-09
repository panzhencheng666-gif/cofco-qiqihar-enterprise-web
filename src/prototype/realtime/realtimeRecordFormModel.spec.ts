import { describe, expect, it } from "vitest";

import {
  definitionFields,
  marketPayloadFromValues,
  productionCoreFields,
  productionMetadataFields,
  productionPayloadFromValues,
} from "./realtimeRecordFormModel";

describe("realtime record form model", () => {
  it("keeps authoritative production inputs without restoring removed duplicate fields", () => {
    expect(productionCoreFields.map(({ code }) => code)).toEqual([
      "objectTypeCode",
      "regionCode",
      "PROD_CULTIVAR_NAME",
      "surveyDate",
      "cultivatedAreaMu",
      "yieldPerMuKilograms",
      "estimatedOutputKilograms",
      "yearOnYear",
    ]);
    expect(
      productionCoreFields.map(({ label }) => label).join(" "),
    ).not.toMatch(/样本平均|区域加权|测产轮次|入库|自用|损耗/);
  });

  it("requires reporter and sample-point contact coordinates in every production payload", () => {
    expect(productionMetadataFields.map(({ code }) => code)).toEqual([
      "PROD_REPORTER_NAME",
      "PROD_REPORTER_PHONE",
      "PROD_SAMPLE_CONTACT",
      "PROD_SAMPLE_LATITUDE",
      "PROD_SAMPLE_LONGITUDE",
    ]);

    expect(
      productionPayloadFromValues(
        {
          productCode: "SOYBEAN",
          objectTypeCode: "FARMER",
          regionCode: "230200",
          PROD_CULTIVAR_NAME: "先玉335",
          surveyDate: "2026-08-07",
          cultivatedAreaMu: "10",
          yieldPerMuKilograms: "500",
          PROD_REPORTER_NAME: "张三",
          PROD_REPORTER_PHONE: "13800000000",
          PROD_SAMPLE_CONTACT: "13900000000",
          PROD_SAMPLE_LATITUDE: "47.35",
          PROD_SAMPLE_LONGITUDE: "123.92",
        },
        "CORN",
      ),
    ).toMatchObject({
      productCode: "CORN",
      cultivatedAreaMu: "10",
      yieldPerMuKilograms: "500",
      submissionMetadata: {
        PROD_CULTIVAR_NAME: "先玉335",
        PROD_REPORTER_NAME: "张三",
        PROD_REPORTER_PHONE: "13800000000",
        PROD_SAMPLE_CONTACT: "13900000000",
        PROD_SAMPLE_LATITUDE: "47.35",
        PROD_SAMPLE_LONGITUDE: "123.92",
      },
    });
  });

  it("uses the same survey-detail definition for the modal payload and ledger values", () => {
    const definition = {
      productCode: "CORN",
      objectTypeCode: "FARMER",
      groups: [
        {
          category: "DETAIL",
          label: "业务调查明细",
          sortOrder: 5,
          fields: [
            {
              code: "PROD_SAMPLE_NAME",
              label: "填报对象",
              valueType: "TEXT" as const,
              unit: null,
              description: null,
              precision: 18,
              scale: 4,
              sortOrder: 10,
            },
            {
              code: "PROD_HARVEST_AREA_MU",
              label: "预计收获面积",
              valueType: "DECIMAL" as const,
              unit: "亩",
              description: null,
              precision: 18,
              scale: 4,
              sortOrder: 20,
            },
          ],
        },
        {
          category: "QUALITY",
          label: "质量指标",
          sortOrder: 10,
          fields: [definitionField("MOISTURE", "水分")],
        },
        {
          category: "COST",
          label: "成本费用",
          sortOrder: 20,
          fields: [definitionField("LAND_RENT", "地租")],
        },
        {
          category: "INSURANCE",
          label: "农业保险",
          sortOrder: 30,
          fields: [definitionField("INSURANCE_AMOUNT", "保险金额")],
        },
        {
          category: "SUBSIDY",
          label: "政策补贴",
          sortOrder: 40,
          fields: [definitionField("SUBSIDY_AMOUNT", "补贴金额")],
        },
      ],
    };

    expect(definitionFields(definition).map(({ code }) => code)).toEqual([
      "PROD_SAMPLE_NAME",
      "PROD_HARVEST_AREA_MU",
      "MOISTURE",
      "LAND_RENT",
      "INSURANCE_AMOUNT",
      "SUBSIDY_AMOUNT",
    ]);
    expect(definitionFields(definition)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PROD_SAMPLE_NAME",
          required: true,
          section: "业务调查明细",
        }),
        expect.objectContaining({
          code: "PROD_HARVEST_AREA_MU",
          section: "业务调查明细",
        }),
      ]),
    );
    expect(
      productionPayloadFromValues(
        {
          productCode: "SOYBEAN",
          objectTypeCode: "FARMER",
          regionCode: "230200",
          surveyDate: "2026-08-09",
          cultivatedAreaMu: "100",
          yieldPerMuKilograms: "500",
          PROD_SAMPLE_NAME: "第一调查户",
          PROD_HARVEST_AREA_MU: "96.5",
          MOISTURE: "14.2",
          LAND_RENT: "500",
          INSURANCE_AMOUNT: "1200",
          SUBSIDY_AMOUNT: "800",
        },
        "CORN",
        definition,
      ),
    ).toMatchObject({
      submissionMetadata: {
        PROD_SAMPLE_NAME: "第一调查户",
        PROD_HARVEST_AREA_MU: "96.5",
      },
      quality: { MOISTURE: "14.2" },
      costs: { LAND_RENT: "500" },
      insurance: { INSURANCE_AMOUNT: "1200" },
      subsidies: { SUBSIDY_AMOUNT: "800" },
    });
  });

  it("submits both surveyed-object prices without a platform trade direction", () => {
    const definition = {
      productCode: "CORN",
      objectTypeCode: "TRADER",
      coreFields: [
        marketCoreField("MKT_PURCHASE_BASE_PRICE", "对象采购价格"),
        marketCoreField("MKT_SALE_BASE_PRICE", "对象销售价格"),
        {
          ...marketCoreField("MKT_REPORTED_AT", "填报时间"),
          controlType: "READONLY_DATETIME",
        },
      ],
      groups: [],
    };

    expect(
      marketPayloadFromValues(
        {
          MKT_PURCHASE_BASE_PRICE: "4380",
          MKT_SALE_BASE_PRICE: "4420",
          MKT_TRADE_DIRECTION: "SALE",
          MKT_ACTUAL_TRADE_PRICE: "4420",
          MKT_REPORTED_AT: "2026-08-09T13:39:09Z",
        },
        "CORN",
        definition,
      ),
    ).toEqual({
      productCode: "CORN",
      coreValues: {
        MKT_PURCHASE_BASE_PRICE: "4380",
        MKT_SALE_BASE_PRICE: "4420",
      },
      facts: {},
      evidencePhotoIds: [],
    });
  });
});

function marketCoreField(code: string, label: string) {
  return {
    code,
    label,
    controlType: "DECIMAL" as const,
    unit: "元/吨",
    description: null,
    capability: null,
    required: true,
    precision: 18,
    scale: 4,
    sortOrder: 10,
    options: [],
  };
}

function definitionField(code: string, label: string) {
  return {
    code,
    label,
    valueType: "DECIMAL" as const,
    unit: null,
    description: null,
    precision: 18,
    scale: 4,
    sortOrder: 10,
  };
}
