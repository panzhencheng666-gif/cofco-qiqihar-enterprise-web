import { describe, expect, it } from "vitest";

import {
  PRODUCTION_SURVEY_CONTRACT_DIGEST,
  PRODUCTION_SURVEY_CONTRACT_VERSION,
} from "@/platform/api/productionSurveyContract";

import {
  definitionFields,
  marketFields,
  marketPayloadFromValues,
  productionFields,
  productionPayloadFromValues,
} from "./realtimeRecordFormModel";

describe("realtime record form model", () => {
  it("derives the ordered online form and edit boundaries from the production contract", () => {
    const fields = productionFields(productionDefinition());

    expect(fields.map(({ code }) => code)).toEqual([
      "surveyYear",
      "surveyMonth",
      "fillingDate",
      "PROD_SAMPLE_NAME",
      "objectTypeCode",
      "regionCode",
      "PROD_REPORTER_NAME",
      "PROD_SURVEYOR_NAME",
      "PROD_SURVEYOR_PHONE",
      "PROD_SAMPLE_CONTACT",
      "PROD_SAMPLE_LATITUDE",
      "PROD_SAMPLE_LONGITUDE",
      "cultivatedAreaMu",
      "PROD_HARVEST_AREA_MU",
      "yieldPerMuKilograms",
      "estimatedOutputKilograms",
      "yearOnYear",
      "MOISTURE",
    ]);
    expect(fields.map(({ label }) => label).join(" ")).not.toMatch(
      /样本平均|区域加权|测产轮次|入库|自用|损耗/,
    );
    expect(fields.find(({ code }) => code === "regionCode")).toMatchObject({
      label: "地区",
      section: "基础信息",
    });
    expect(fields.find(({ code }) => code === "objectTypeCode")?.label).toBe(
      "样本点类型",
    );
    expect(fields.find(({ code }) => code === "PROD_SAMPLE_NAME")?.label).toBe(
      "样本点名称",
    );
    expect(fields.find(({ code }) => code === "surveyYear")).toMatchObject({
      label: "数据年份",
      required: true,
      section: "数据时间",
    });
    expect(fields.find(({ code }) => code === "surveyMonth")).toMatchObject({
      label: "数据月份",
      required: false,
      section: "数据时间",
    });
    expect(fields.find(({ code }) => code === "fillingDate")).toMatchObject({
      label: "填报日期",
      required: false,
      section: "数据时间",
      readOnly: true,
    });
    expect(fields.map(({ code }) => code)).not.toContain(
      "PROD_SAMPLE_SUBJECT_CODE",
    );
  });

  it("uses contract fields for production metadata without guessing a subject code", () => {
    const payload = productionPayloadFromValues(
      {
        productCode: "SOYBEAN",
        objectTypeCode: "FARMER",
        regionCode: "230200",
        PROD_CULTIVAR_NAME: "先玉335",
        surveyYear: "2026",
        surveyMonth: "8",
        cultivatedAreaMu: "10",
        yieldPerMuKilograms: "500",
        PROD_REPORTER_NAME: "张三",
        PROD_SURVEYOR_NAME: "王雷",
        PROD_SURVEYOR_PHONE: "13800000000",
        PROD_SAMPLE_CONTACT: "13900000000",
        PROD_SAMPLE_LATITUDE: "47.35",
        PROD_SAMPLE_LONGITUDE: "123.92",
      },
      "CORN",
      productionDefinition(),
    );
    expect(payload).toMatchObject({
      productCode: "CORN",
      surveyYear: "2026",
      surveyMonth: "8",
      cultivatedAreaMu: "10",
      yieldPerMuKilograms: "500",
      submissionMetadata: {
        PROD_REPORTER_NAME: "张三",
        PROD_SURVEYOR_NAME: "王雷",
        PROD_SURVEYOR_PHONE: "13800000000",
        PROD_SAMPLE_CONTACT: "13900000000",
        PROD_SAMPLE_LATITUDE: "47.35",
        PROD_SAMPLE_LONGITUDE: "123.92",
      },
    });
    expect(payload.submissionMetadata).not.toHaveProperty("PROD_CULTIVAR_NAME");
    expect(payload).not.toHaveProperty("surveyDate");
    expect(
      productionPayloadFromValues(
        {
          objectTypeCode: "FARMER",
          regionCode: "230200",
          surveyYear: "2026",
          surveyMonth: "",
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
          section: "基础信息",
        }),
        expect.objectContaining({
          code: "PROD_HARVEST_AREA_MU",
          section: "面积与长势",
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
          surveyYear: "2026",
          surveyMonth: "8",
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
        marketCoreField("MKT_PURCHASE_BASE_PRICE", "采集对象收购价格"),
        marketCoreField("MKT_SALE_BASE_PRICE", "采集对象销售价格"),
        {
          surveyYear: "2026",
          surveyMonth: "8",
          ...marketCoreField("MKT_REPORTED_AT", "填报时间"),
          controlType: "READONLY_DATETIME",
        },
      ],
      groups: [],
    };

    expect(
      marketPayloadFromValues(
        {
          surveyYear: "2026",
          surveyMonth: "8",
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
      surveyYear: "2026",
      surveyMonth: "8",
      coreValues: {
        MKT_PURCHASE_BASE_PRICE: "4380",
        MKT_SALE_BASE_PRICE: "4420",
        MKT_TRADE_DATE: "2026-08-01",
      },
      facts: {},
      evidencePhotoIds: [],
    });
  });

  it("uses the audited market whitelist without cultivar, duplicate inventory or removed fields", () => {
    const definition = {
      productCode: "CORN",
      objectTypeCode: "TRADER",
      coreFields: [
        marketCoreField("MKT_OBJECT_TYPE", "对象类型"),
        marketCoreField("MKT_REGION", "行政区划"),
        marketCoreField("MKT_CULTIVAR_NAME", "具体品种"),
        marketCoreField("MKT_SAMPLE_NAME", "采集对象"),
        marketCoreField("MKT_REPORTER_NAME", "填报人"),
        marketCoreField("MKT_SURVEYOR_NAME", "调研人"),
        marketCoreField("MKT_SURVEYOR_PHONE", "调研人联系方式"),
        marketCoreField("MKT_SAMPLE_CONTACT", "样本点联系方式"),
        marketCoreField("MKT_SAMPLE_LATITUDE", "样本点纬度"),
        marketCoreField("MKT_SAMPLE_LONGITUDE", "样本点经度"),
        marketCoreField("MKT_STORAGE_REGION_CODE", "库存存放地区"),
        marketCoreField("MKT_PURCHASE_BASE_PRICE", "对象采购价格"),
      ],
      groups: [
        {
          category: "INVENTORY",
          label: "库存",
          sortOrder: 1,
          fields: [
            definitionField("ENDING_INVENTORY", "期末库存"),
            definitionField("STOCK_OUTFLOW", "出库量"),
            definitionField("PROCESSING_INPUT", "加工投入量"),
          ],
        },
      ],
    };
    const fields = marketFields(definition);
    expect(fields.slice(0, 5).map(({ code }) => code)).toEqual([
      "surveyYear",
      "surveyMonth",
      "MKT_SAMPLE_NAME",
      "MKT_OBJECT_TYPE",
      "MKT_REGION",
    ]);
    expect(fields.map(({ label }) => label)).toEqual(
      expect.arrayContaining([
        "数据年份",
        "数据月份",
        "样本点名称",
        "样本点类型",
        "地区",
        "填报人",
        "调研人",
        "调研人联系方式",
        "样本点联系方式",
        "纬度",
        "经度",
        "采集对象收购价格",
        "现有库存",
      ]),
    );
    expect(
      fields
        .filter(({ section }) => section === "填报与定位")
        .map(({ code }) => code),
    ).toEqual([
      "MKT_REPORTER_NAME",
      "MKT_SURVEYOR_NAME",
      "MKT_SURVEYOR_PHONE",
      "MKT_SAMPLE_CONTACT",
      "MKT_SAMPLE_LATITUDE",
      "MKT_SAMPLE_LONGITUDE",
    ]);
    expect(fields.map(({ label }) => label).join(" ")).not.toMatch(
      /具体品种|库存量|期末库存|库存存放地|出库量|加工投入量|调查期间|调查对象|对象类型|行政区划/,
    );

    const payload = marketPayloadFromValues(
      {
        surveyYear: "2026",
        surveyMonth: "",
        MKT_CULTIVAR_NAME: "不应提交",
        MKT_SAMPLE_NAME: "第一样本点",
        MKT_REGION: "230202",
        MKT_REPORTER_NAME: "当前登录人员",
        MKT_SURVEYOR_NAME: "王雷",
        MKT_SURVEYOR_PHONE: "13800000000",
        MKT_SAMPLE_CONTACT: "13900000000",
        MKT_SAMPLE_LATITUDE: "47.35",
        MKT_SAMPLE_LONGITUDE: "123.92",
        ENDING_INVENTORY: "12",
        STOCK_OUTFLOW: "3",
        PROCESSING_INPUT: "8",
      },
      "CORN",
      definition,
    );
    expect(payload.coreValues).not.toHaveProperty("MKT_CULTIVAR_NAME");
    expect(payload.facts).toEqual({ ENDING_INVENTORY: "12" });
    expect(payload.coreValues).toMatchObject({
      MKT_SAMPLE_NAME: "第一样本点",
      MKT_REPORTER_NAME: "当前登录人员",
      MKT_SURVEYOR_NAME: "王雷",
      MKT_SURVEYOR_PHONE: "13800000000",
      MKT_SAMPLE_CONTACT: "13900000000",
      MKT_SAMPLE_LATITUDE: "47.35",
      MKT_SAMPLE_LONGITUDE: "123.92",
      MKT_STORAGE_REGION_CODE: "230202",
      MKT_TRADE_DATE: "2026-01-01",
    });

    const editing = marketPayloadFromValues(
      {
        surveyYear: "2026",
        MKT_REGION: "230202",
        MKT_STORAGE_REGION_CODE: "230208",
        ENDING_INVENTORY: "9",
      },
      "CORN",
      definition,
    );
    expect(editing.coreValues.MKT_STORAGE_REGION_CODE).toBe("230208");
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
    contractVersion: PRODUCTION_SURVEY_CONTRACT_VERSION,
    contractDigest: PRODUCTION_SURVEY_CONTRACT_DIGEST,
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
        "PROD_SURVEYOR_NAME",
        "调研人",
        "SUBJECT",
        "调查对象与联系",
      ),
      productionField(
        "PROD_SURVEYOR_PHONE",
        "调研人联系方式",
        "SUBJECT",
        "调查对象与联系",
        {
          required: false,
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
