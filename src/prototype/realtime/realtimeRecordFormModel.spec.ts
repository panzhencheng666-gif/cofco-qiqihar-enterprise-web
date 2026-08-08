import { describe, expect, it } from "vitest";

import {
  productionCoreFields,
  productionMetadataFields,
  productionPayloadFromValues,
} from "./realtimeRecordFormModel";

describe("realtime record form model", () => {
  it("keeps authoritative production inputs without restoring removed duplicate fields", () => {
    expect(productionCoreFields.map(({ code }) => code)).toEqual([
      "productCode",
      "objectTypeCode",
      "regionCode",
      "cultivarCode",
      "surveyDate",
      "cultivatedAreaMu",
      "yieldPerMuKilograms",
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
      productionPayloadFromValues({
        productCode: "CORN",
        objectTypeCode: "FARMER",
        regionCode: "230200",
        cultivarCode: "CORN-1",
        surveyDate: "2026-08-07",
        cultivatedAreaMu: "10",
        yieldPerMuKilograms: "500",
        PROD_REPORTER_NAME: "张三",
        PROD_REPORTER_PHONE: "13800000000",
        PROD_SAMPLE_CONTACT: "13900000000",
        PROD_SAMPLE_LATITUDE: "47.35",
        PROD_SAMPLE_LONGITUDE: "123.92",
      }),
    ).toMatchObject({
      cultivatedAreaMu: "10",
      yieldPerMuKilograms: "500",
      submissionMetadata: {
        PROD_REPORTER_NAME: "张三",
        PROD_REPORTER_PHONE: "13800000000",
        PROD_SAMPLE_CONTACT: "13900000000",
        PROD_SAMPLE_LATITUDE: "47.35",
        PROD_SAMPLE_LONGITUDE: "123.92",
      },
    });
  });
});
