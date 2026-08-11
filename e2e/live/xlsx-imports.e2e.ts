import type { APIRequestContext, Page } from "@playwright/test";
import { expect, queryE2eDatabase, test } from "./fixtures";
import { fillDownloadedXlsx } from "./xlsx-fixture";

const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function uploadEvidence(
  request: APIRequestContext,
  marker: string,
): Promise<string> {
  const response = await request.post("/api/v1/evidence-photos", {
    multipart: {
      file: {
        name: `${marker}.png`,
        mimeType: "image/png",
        buffer: validPng,
      },
      capturedAt: "2026-08-09T12:00:00Z",
      latitude: "47.3543",
      longitude: "123.9182",
      watermarkText: `音钦村 ${marker} 现场验收`,
    },
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { data: { id: string } };
  return body.data.id;
}

async function downloadTemplate(page: Page, targetPath: string): Promise<void> {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 XLSX 模板" }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/u);
  await download.saveAs(targetPath);
}

test("downloads, fills, and imports the three domain XLSX protocols into PostgreSQL", async ({
  page,
  request,
}, testInfo) => {
  const productionMarker = "E2E-XLSX-玉米产情-通用模板";
  const marketMarker = "E2E-XLSX-玉米市场-通用模板";
  const logisticsMarker = "E2E-XLSX-玉米物流-通用模板";
  const productionPhotoId = await uploadEvidence(request, "production-xlsx");
  const marketPhotoId = await uploadEvidence(request, "market-xlsx");

  await page.goto("/#/产情监测/玉米产情填报");
  const productionTemplatePath = testInfo.outputPath(
    "production-template.xlsx",
  );
  await downloadTemplate(page, productionTemplatePath);
  const productionWorkbook = fillDownloadedXlsx(productionTemplatePath, {
    regionCode: "230208101001",
    PROD_CULTIVAR_NAME: productionMarker,
    surveyDate: "2026-08-09",
    cultivatedAreaMu: "150",
    yieldPerMuKilograms: "520",
    PROD_REPORTER_PHONE: "13800000021",
    PROD_SAMPLE_CONTACT: "13900000021",
    PROD_SAMPLE_LATITUDE: "47.3543",
    PROD_SAMPLE_LONGITUDE: "123.9182",
    PROD_SAMPLE_NAME: "音钦村XLSX产情调查户",
    PROD_HARVEST_AREA_MU: "145",
    PROD_GROWTH_STAGE: "灌浆期",
    PROD_OPENING_INVENTORY: "20",
    PROD_SALES_VOLUME: "5",
    PROD_SELF_USE: "3",
    PROD_ENDING_INVENTORY: "12",
    PROD_SURPLUS_SUBJECT_CODE: "e2e-farmer-yinqin-xlsx-1",
    PROD_SURPLUS_CUTOFF_DATE: "2026-08-09",
    MOISTURE: "14.2",
    evidencePhotoId: productionPhotoId,
  });
  expect(productionWorkbook.headers).toEqual(
    expect.arrayContaining([
      "PROD_CULTIVAR_NAME",
      "PROD_SAMPLE_NAME",
      "PROD_OPENING_INVENTORY",
      "PROD_ENDING_INVENTORY",
      "PROD_SURPLUS_SUBJECT_CODE",
      "PROD_SURPLUS_CUTOFF_DATE",
      "evidencePhotoId",
    ]),
  );
  expect(productionWorkbook.headers).not.toContain("PROD_REPORTER_NAME");
  await page
    .getByLabel("批量导入产情记录")
    .setInputFiles(productionWorkbook.path);
  await expect(page.getByText("导入完成：成功 1 条，失败 0 条。")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(productionMarker)).toBeVisible();
  productionWorkbook.cleanup();

  await page.goto("/#/市场监测/玉米市场采集");
  const marketTemplatePath = testInfo.outputPath("market-template.xlsx");
  await downloadTemplate(page, marketTemplatePath);
  const marketWorkbook = fillDownloadedXlsx(marketTemplatePath, {
    MKT_REGION: "230208101001",
    MKT_TRADE_DATE: "2026-08-09",
    MKT_PURCHASE_BASE_PRICE: "2300",
    MKT_SALE_BASE_PRICE: "2380",
    MKT_CARRIAGE_BOARD_AMOUNT: "36",
    MKT_PACKAGING_FORM: "BULK",
    MKT_PACKAGING_AMOUNT: "12",
    MKT_FREIGHT_AMOUNT: "72",
    MKT_SOURCE_NOTE: "音钦村市场现场台账",
    MKT_REPORTER_PHONE: "13800000022",
    MKT_SAMPLE_CONTACT: "13900000022",
    MKT_SAMPLE_LATITUDE: "47.3543",
    MKT_SAMPLE_LONGITUDE: "123.9182",
    MKT_SAMPLE_NAME: marketMarker,
    MKT_CULTIVAR_NAME: "龙单XLSX验收1号",
    MOISTURE: "14.6",
    IMPURITY: "1.0",
    PURCHASE_VOLUME: "120",
    SALES_VOLUME: "60",
    OPENING_INVENTORY: "300",
    STOCK_OUTFLOW: "70",
    ENDING_INVENTORY: "350",
    MKT_INVENTORY_HOLDER_CODE: "e2e-trader-yinqin-xlsx-1",
    MKT_INVENTORY_OWNERSHIP_TYPE: "OWNED",
    MKT_STORAGE_REGION_CODE: "230208101001",
    MKT_CARGO_OWNER_CODE: "e2e-trader-yinqin-xlsx-1",
    MKT_INVENTORY_CUTOFF_DATE: "2026-08-09",
    MKT_INVENTORY_POLICY_ATTRIBUTE: "COMMERCIAL",
    evidencePhotoId: marketPhotoId,
  });
  expect(marketWorkbook.headers).toEqual(
    expect.arrayContaining([
      "MKT_PURCHASE_BASE_PRICE",
      "MKT_SALE_BASE_PRICE",
      "PURCHASE_VOLUME",
      "SALES_VOLUME",
      "OPENING_INVENTORY",
      "ENDING_INVENTORY",
      "MKT_INVENTORY_HOLDER_CODE",
      "MKT_INVENTORY_OWNERSHIP_TYPE",
      "MKT_STORAGE_REGION_CODE",
      "MKT_CARGO_OWNER_CODE",
      "MKT_INVENTORY_CUTOFF_DATE",
      "MKT_INVENTORY_POLICY_ATTRIBUTE",
      "evidencePhotoId",
    ]),
  );
  expect(marketWorkbook.headers).not.toContain("MKT_REPORTER_NAME");
  await page
    .getByLabel("批量导入市场采集记录")
    .setInputFiles(marketWorkbook.path);
  await expect(page.getByText("导入完成：成功 1 条，失败 0 条。")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(marketMarker)).toBeVisible();
  marketWorkbook.cleanup();

  await page.goto("/#/市场监测/玉米物流监测");
  const logisticsTemplatePath = testInfo.outputPath("logistics-template.xlsx");
  await downloadTemplate(page, logisticsTemplatePath);
  const logisticsWorkbook = fillDownloadedXlsx(logisticsTemplatePath, {
    LOG_PERIOD: "2026-W32",
    LOG_COLLECTION_DATE: "2026-08-09",
    LOG_ORIGIN: "E2E_QQ_RAIL",
    LOG_DESTINATION: "E2E_QQ_ROAD",
    LOG_TRANSPORT_MODE: "RAIL",
    LOG_DIRECTION: "INFLOW",
    LOG_ROUTE_VOLUME: "155.5",
    LOG_FREIGHT_RATE: "85.25",
    LOG_TRANSIT_TIME: "6.5",
    LOG_SOURCE_ORGANIZATION: logisticsMarker,
  });
  expect(logisticsWorkbook.headers).toEqual(
    expect.arrayContaining([
      "LOG_PERIOD",
      "LOG_COLLECTION_DATE",
      "LOG_ORIGIN",
      "LOG_DESTINATION",
      "LOG_TRANSPORT_MODE",
      "LOG_DIRECTION",
      "LOG_ROUTE_VOLUME",
      "LOG_FREIGHT_RATE",
      "LOG_TRANSIT_TIME",
      "LOG_SOURCE_ORGANIZATION",
    ]),
  );
  expect(logisticsWorkbook.headers).not.toEqual(
    expect.arrayContaining(["LOG_REPORTER", "LOG_STATUS", "LOG_REPORTED_AT"]),
  );
  await page
    .getByLabel("批量导入物流记录")
    .setInputFiles(logisticsWorkbook.path);
  await expect(page.getByText("导入完成：成功 1 条，失败 0 条。")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(logisticsMarker)).toBeVisible();
  logisticsWorkbook.cleanup();

  expect(
    queryE2eDatabase(
      `SELECT value FROM production.production_record_submission_metadata WHERE field_code='PROD_CULTIVAR_NAME' AND value='${productionMarker}'`,
    ),
  ).toBe(productionMarker);
  expect(
    queryE2eDatabase(
      "SELECT value FROM production.production_record_submission_metadata WHERE field_code='PROD_SURPLUS_SUBJECT_CODE' AND value='e2e-farmer-yinqin-xlsx-1'",
    ),
  ).toBe("e2e-farmer-yinqin-xlsx-1");
  expect(
    queryE2eDatabase(
      `SELECT value FROM market.market_record_core_value WHERE field_code='MKT_SAMPLE_NAME' AND value='${marketMarker}'`,
    ),
  ).toBe(marketMarker);
  expect(
    queryE2eDatabase(
      `SELECT storage.value
         FROM market.market_record_core_value storage
         JOIN market.market_record_core_value sample
           ON sample.record_id=storage.record_id
          AND sample.field_code='MKT_SAMPLE_NAME'
          AND sample.value='${marketMarker}'
        WHERE storage.field_code='MKT_STORAGE_REGION_CODE'`,
    ),
  ).toBe("230208101001");
  expect(
    queryE2eDatabase(
      `SELECT source_organization FROM logistics.route_event WHERE source_organization='${logisticsMarker}'`,
    ),
  ).toBe(logisticsMarker);
  expect(
    queryE2eDatabase(
      "SELECT string_agg(domain_code || '=' || status_code, ',' ORDER BY domain_code) FROM platform.import_job",
    ),
  ).toBe("LOGISTICS=COMPLETED,MARKET=COMPLETED,PRODUCTION=COMPLETED");
});
