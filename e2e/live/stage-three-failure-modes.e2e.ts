import { writeFile } from "node:fs/promises";
import type { APIRequestContext } from "@playwright/test";
import {
  expect,
  queryE2eDatabase,
  stageThreeBrowserEndpoints,
  test,
  trackBrowserErrors,
} from "./fixtures";
import { fillDownloadedXlsx } from "./xlsx-fixture";

const namespace = "S3C-20260812-FAILURE-";
const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function uploadEvidence(request: APIRequestContext): Promise<string> {
  const response = await request.post("/api/v1/evidence-photos", {
    multipart: {
      file: {
        name: `${namespace}PHOTO.png`,
        mimeType: "image/png",
        buffer: validPng,
      },
      capturedAt: "2026-08-12T01:15:00Z",
      latitude: "47.3543",
      longitude: "123.9182",
      watermarkText: namespace,
    },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { data: { id: string } }).data.id;
}

test("fails closed for missing sessions, unavailable HTTP, and insufficient region permission", async ({
  browser,
  page,
  request,
}, testInfo) => {
  const matrix: Array<Record<string, string | number>> = [];

  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  const anonymousErrors = trackBrowserErrors(anonymousPage);
  const anonymousSession = await anonymousContext.request.get(
    `${stageThreeBrowserEndpoints.anonymous.url}/api/v1/session/me`,
  );
  expect(anonymousSession.status()).toBe(401);
  await anonymousPage.goto(
    `${stageThreeBrowserEndpoints.anonymous.url}/#/我的工作/待我处理`,
  );
  await expect(
    anonymousPage.getByRole("heading", { name: "登录企业账号" }),
  ).toBeVisible();
  await expect(anonymousPage.getByText("我的工作")).toHaveCount(0);
  expect(anonymousErrors.errors).toEqual([
    "Failed to load resource: the server responded with a status of 401 (Unauthorized)",
  ]);
  await anonymousContext.close();
  matrix.push({
    scenario: "LOCAL_ANONYMOUS_FAIL_CLOSED",
    http: 401,
    consoleErrors: 1,
    status: "PASS_WITH_EXPECTED_BROWSER_DIAGNOSTIC",
  });
  matrix.push({
    scenario: "ENTERPRISE_IDP_SESSION_EXPIRY_WITH_ZERO_CONSOLE_ERRORS",
    status: "BLOCKED_EXTERNAL",
  });

  const unavailableContext = await browser.newContext();
  const unavailablePage = await unavailableContext.newPage();
  const unavailableErrors = trackBrowserErrors(unavailablePage);
  await unavailablePage.goto(
    `${stageThreeBrowserEndpoints.unavailable.url}/#/我的工作/待我处理`,
  );
  await expect(
    unavailablePage.getByRole("heading", { name: "身份服务暂时不可用" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(unavailablePage.getByText("我的工作")).toHaveCount(0);
  expect(unavailableErrors.errors).toEqual([
    "Failed to load resource: the server responded with a status of 502 (Bad Gateway)",
  ]);
  await unavailableContext.close();
  matrix.push({
    scenario: "BACKEND_UNAVAILABLE_FAIL_CLOSED",
    consoleErrors: 1,
    status: "PASS_WITH_EXPECTED_BROWSER_DIAGNOSTIC",
  });

  const evidencePhotoId = await uploadEvidence(request);
  const created = await request.post("/api/v1/production-records", {
    data: {
      productCode: "CORN",
      objectTypeCode: "FARMER",
      regionCode: "230208101001",
      cultivarCode: null,
      surveyDate: "2026-08-12",
      cultivatedAreaMu: "1",
      yieldPerMuKilograms: "1",
      quality: { MOISTURE: "14" },
      costs: {},
      insurance: {},
      subsidies: {},
      submissionMetadata: {
        PROD_REPORTER_NAME: "验收填报员甲",
        PROD_REPORTER_PHONE: "13800000041",
        PROD_SAMPLE_NAME: `${namespace}REGION-DENIAL`,
        PROD_SAMPLE_CONTACT: "13900000041",
        PROD_SAMPLE_LATITUDE: "47.3543",
        PROD_SAMPLE_LONGITUDE: "123.9182",
      },
      evidencePhotoIds: [evidencePhotoId],
    },
  });
  expect(created.status()).toBe(201);
  const recordId = ((await created.json()) as { data: { id: string } }).data.id;
  const partialDetail = await request.get(
    `/api/v1/production-records/${recordId}`,
  );
  expect(partialDetail.status()).toBe(200);
  expect(await partialDetail.json()).toMatchObject({
    data: {
      status: "DRAFT",
      quality: { MOISTURE: "14.0000" },
      costs: {},
      insurance: {},
      subsidies: {},
    },
  });
  matrix.push({ scenario: "PARTIAL_OPTIONAL_DATA", http: 200, status: "PASS" });

  const outsideContext = await browser.newContext();
  const outsideEmpty = await outsideContext.request.get(
    `${stageThreeBrowserEndpoints.outsideOperator.url}/api/v1/production-records?productCode=CORN&pageKind=MONITORING&pageNumber=0&pageSize=100`,
  );
  expect(outsideEmpty.status()).toBe(200);
  expect(await outsideEmpty.json()).toMatchObject({
    data: { totalElements: 0, items: [] },
  });
  expect(
    (
      await outsideContext.request.get(
        `${stageThreeBrowserEndpoints.outsideOperator.url}/api/v1/production-records/${recordId}`,
      )
    ).status(),
  ).toBe(403);
  await outsideContext.close();
  expect(
    (
      await request.post(`/api/v1/production-records/${recordId}/void`, {
        data: { version: 0 },
      })
    ).status(),
  ).toBe(200);
  matrix.push({ scenario: "EMPTY_SCOPED_DATA", http: 200, status: "PASS" });
  matrix.push({ scenario: "OUTSIDE_REGION_PERMISSION", http: 403, status: "PASS" });

  await page.goto("/#/产情监测/玉米产情填报");
  await page.getByRole("button", { name: "新建调查记录" }).click();
  const dialog = page.getByRole("dialog", { name: "新建产情填报" });
  await dialog.getByRole("button", { name: "保存业务记录" }).click();
  expect(await dialog.locator(":invalid").count()).toBeGreaterThan(0);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "关闭新建产情填报" }).click();
  matrix.push({ scenario: "INVALID_MANUAL_INPUT", status: "PASS" });

  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 XLSX 模板" }).click();
  const download = await downloadEvent;
  const templatePath = testInfo.outputPath("invalid-production-template.xlsx");
  await download.saveAs(templatePath);
  const invalidWorkbook = fillDownloadedXlsx(templatePath, {
    regionCode: "230208101001",
    PROD_CULTIVAR_NAME: `${namespace}INVALID-XLSX`,
    surveyDate: "2026-08-12",
    cultivatedAreaMu: "NOT_A_NUMBER",
    yieldPerMuKilograms: "520",
    PROD_REPORTER_PHONE: "13800000042",
    PROD_SAMPLE_CONTACT: "13900000042",
    PROD_SAMPLE_LATITUDE: "47.3543",
    PROD_SAMPLE_LONGITUDE: "123.9182",
    evidencePhotoId,
  });
  const importResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/api/v1/imports/production?"),
  );
  await page
    .getByLabel("批量导入产情记录")
    .setInputFiles(invalidWorkbook.path);
  const importResponse = await importResponsePromise;
  expect(importResponse.status()).toBe(201);
  const importJob = (await importResponse.json()) as { data: { id: string } };
  await expect(
    page.getByText(/导入完成：成功 0 条，失败 1 条/u),
  ).toBeVisible({ timeout: 15_000 });
  const errorDownloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载错误清单" }).click();
  const errorDownload = await errorDownloadEvent;
  expect(errorDownload.suggestedFilename()).toMatch(/\.csv$/u);
  invalidWorkbook.cleanup();
  matrix.push({ scenario: "INVALID_XLSX_ROW_AND_ERROR_FILE", status: "PASS" });

  queryE2eDatabase(
    `DELETE FROM platform.import_row_result WHERE import_job_id='${importJob.data.id}'; DELETE FROM platform.import_job WHERE import_job_id='${importJob.data.id}'`,
  );
  expect(
    queryE2eDatabase(
      `SELECT count(*) FROM platform.import_job WHERE import_job_id='${importJob.data.id}'`,
    ),
  ).toBe("0");
  matrix.push({ scenario: "FAILURE_FIXTURE_CLEANUP", status: "PASS" });

  const matrixPath = testInfo.outputPath("FAILURE-MATRIX.json");
  await writeFile(
    matrixPath,
    `${JSON.stringify({ namespace, rows: matrix }, null, 2)}\n`,
    "utf8",
  );
  await testInfo.attach("FAILURE-MATRIX.json", {
    path: matrixPath,
    contentType: "application/json",
  });
});
