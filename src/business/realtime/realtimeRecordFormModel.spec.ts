import { describe, expect, it } from "vitest";

import {
  definitionFields,
  marketPayloadFromValues,
  productionFields,
  productionPayloadFromValues,
} from "./realtimeRecordFormModel";

describe("realtime record form model", () => {
  it("derives the ordered online form and edit boundaries from the production contract", () => {
    const fields = productionFields(productionDefinition());

    expect(fields.map(({ code }) => code)).toEqual([
      "objectTypeCode",
      "regionCode",
      "PROD_CULTIVAR_NAME",
      "surveyDate",
      "PROD_SAMPLE_SUBJECT_CODE",
      "PROD_SAMPLE_NAME",
      "PROD_REPORTER_NAME",
      "PROD_REPORTER_PHONE",
      "PROD_SAMPLE_CONTACT",
      "PROD_SAMPLE_LATITUDE",
      "PROD_SAMPLE_LONGITUDE",
      "cultivatedAreaMu",
      "yieldPerMuKilograms",
      "estimatedOutputKilograms",
      "yearOnYear",
      "PROD_HARVEST_AREA_MU",
      "MOISTURE",
    ]);
    expect(fields.map(({ label }) => label).join(" ")).not.toMatch(
      /样本平均|区域加权|测产轮次|入库|自用|损耗/,
    );
    expect(
      fields.find(({ code }) => code === "PROD_SAMPLE_SUBJECT_CODE"),
    ).toMatchObject({
      label: "稳定主体码",
      readOnly: true,
      section: "调查对象与联系",
    });
  });

  it("uses contract fields for production metadata without guessing a subject code", () => {
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
        productionDefinition(),
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
    expect(
      productionPayloadFromValues(
        {
          objectTypeCode: "FARMER",
          regionCode: "230200",
          surveyDate: "2026-08-07",
          cultivatedAreaMu: "10",
          yieldPerMuKilograms: "500",
          PROD_SAMPLE_NAME: "仅展示名称",
        },
        "CORN",
        productionDefinition(),
      ).submissionMetadata,
    ).not.toHaveProperty("PROD_SAMPLE_SUBJECT_CODE");
  });

  it("uses the same survey-detail definition for the modal payload and ledger values", () => {
    const definition = productionDefinition();

    expect(productionFields(definition).map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "PROD_SAMPLE_NAME",
        "PROD_HARVEST_AREA_MU",
        "MOISTURE",
      ]),
    );
    expect(productionFields(definition)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PROD_SAMPLE_NAME",
          required: false,
          section: "调查对象与联系",
        }),
        expect.objectContaining({
          code: "PROD_HARVEST_AREA_MU",
          section: "业务调查明细",
        }),
      ]),
    );
    expect(definitionFields(definition).map(({ code }) => code)).toEqual([
      "PROD_HARVEST_AREA_MU",
      "MOISTURE",
    ]);
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
      costs: {},
      insurance: {},
      subsidies: {},
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

function productionDefinition() {
  return {
    productCode: "CORN",
    objectTypeCode: "FARMER",
    contractVersion: "production-survey-fields-v1" as const,
    fields: [
      productionField("objectTypeCode", "样本点类型", "CONTEXT", "基础信息", {
        controlType: "SELECT",
        required: true,
      }),
      productionField("regionCode", "所在地区", "CONTEXT", "基础信息", {
        controlType: "REGION",
        required: true,
      }),
      productionField("PROD_CULTIVAR_NAME", "具体品种", "CONTEXT", "基础信息"),
      productionField("surveyDate", "调查日期", "CONTEXT", "基础信息", {
        valueType: "DATE",
        controlType: "DATE",
        required: true,
      }),
      productionField(
        "PROD_SAMPLE_SUBJECT_CODE",
        "稳定主体码",
        "SUBJECT",
        "调查对象与联系",
        { controlType: "READONLY_SUBJECT", readOnly: true, importable: false },
      ),
      productionField(
        "PROD_SAMPLE_NAME",
        "填报对象名称",
        "SUBJECT",
        "调查对象与联系",
      ),
      productionField(
        "PROD_REPORTER_NAME",
        "填报人",
        "SUBJECT",
        "调查对象与联系",
        {
          controlType: "READONLY_TEXT",
          required: true,
          readOnly: true,
          importable: false,
        },
      ),
      productionField(
        "PROD_REPORTER_PHONE",
        "填报人联系方式",
        "SUBJECT",
        "调查对象与联系",
        {
          required: true,
        },
      ),
      productionField(
        "PROD_SAMPLE_CONTACT",
        "填报对象联系方式",
        "SUBJECT",
        "调查对象与联系",
        {
          required: true,
        },
      ),
      productionField(
        "PROD_SAMPLE_LATITUDE",
        "填报对象纬度",
        "SUBJECT",
        "调查对象与联系",
        {
          valueType: "DECIMAL",
          controlType: "DECIMAL",
          required: true,
        },
      ),
      productionField(
        "PROD_SAMPLE_LONGITUDE",
        "填报对象经度",
        "SUBJECT",
        "调查对象与联系",
        {
          valueType: "DECIMAL",
          controlType: "DECIMAL",
          required: true,
        },
      ),
      productionField("cultivatedAreaMu", "种植面积", "OUTPUT", "产量信息", {
        valueType: "DECIMAL",
        controlType: "DECIMAL",
        required: true,
      }),
      productionField(
        "yieldPerMuKilograms",
        "权威采用单产",
        "OUTPUT",
        "产量信息",
        {
          valueType: "DECIMAL",
          controlType: "DECIMAL",
          required: true,
        },
      ),
      productionField(
        "estimatedOutputKilograms",
        "预计总产",
        "OUTPUT",
        "产量信息",
        {
          valueType: "DECIMAL",
          controlType: "READONLY_DECIMAL",
          readOnly: true,
          calculated: true,
          importable: false,
        },
      ),
      productionField("yearOnYear", "与上年同比", "OUTPUT", "产量信息", {
        controlType: "READONLY_TEXT",
        readOnly: true,
        calculated: true,
        importable: false,
      }),
      productionField(
        "PROD_HARVEST_AREA_MU",
        "预计收获面积",
        "DETAIL",
        "业务调查明细",
        {
          valueType: "DECIMAL",
          controlType: "DECIMAL",
        },
      ),
      productionField("MOISTURE", "水分", "QUALITY", "质量指标", {
        valueType: "DECIMAL",
        controlType: "DECIMAL",
      }),
    ],
    groups: [
      {
        category: "DETAIL",
        label: "业务调查明细",
        sortOrder: 5,
        fields: [definitionField("PROD_HARVEST_AREA_MU", "预计收获面积")],
      },
      {
        category: "QUALITY",
        label: "质量指标",
        sortOrder: 10,
        fields: [definitionField("MOISTURE", "水分")],
      },
    ],
  };
}

function productionField(
  code: string,
  label: string,
  groupCode: string,
  groupLabel: string,
  overrides: Partial<{
    valueType: string;
    controlType: string;
    required: boolean;
    readOnly: boolean;
    calculated: boolean;
    importable: boolean;
  }> = {},
) {
  return {
    code,
    label,
    groupCode,
    groupLabel,
    groupOrder:
      groupCode === "CONTEXT"
        ? 10
        : groupCode === "SUBJECT"
          ? 20
          : groupCode === "OUTPUT"
            ? 30
            : 40,
    sortOrder: 10,
    valueType: "TEXT",
    controlType: "TEXT",
    unit: null,
    required: false,
    options: [],
    readOnly: false,
    calculated: false,
    importable: true,
    displayed: true,
    description: null,
    precision: 18,
    scale: 4,
    ...overrides,
  };
}
