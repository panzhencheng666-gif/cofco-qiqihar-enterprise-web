import { describe, expect, it } from "vitest";

import {
  definitionFields,
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
      ],
    };

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
        },
        "CORN",
        definition,
      ).submissionMetadata,
    ).toMatchObject({
      PROD_SAMPLE_NAME: "第一调查户",
      PROD_HARVEST_AREA_MU: "96.5",
    });
  });
});
