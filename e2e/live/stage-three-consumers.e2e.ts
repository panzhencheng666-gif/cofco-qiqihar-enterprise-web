import type { APIRequestContext } from "@playwright/test";
import {
  expect,
  liveBrowserAccounts,
  queryE2eDatabase,
  test,
  trackBrowserErrors,
} from "./fixtures";

const marker = "S3C-20260812-CONSUMER-RICE";
const sampleLatitude = "47.31";
const sampleLongitude = "123.21";
const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function uploadEvidence(request: APIRequestContext): Promise<string> {
  const response = await request.post("/api/v1/evidence-photos", {
    multipart: {
      file: { name: `${marker}.png`, mimeType: "image/png", buffer: validPng },
      capturedAt: "2026-08-09T12:00:00Z",
      latitude: sampleLatitude,
      longitude: sampleLongitude,
      watermarkText: marker,
    },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { data: { id: string } }).data.id;
}

test("reconciles one approved source identity across list, work, notification, overview, analysis, supply, and report", async ({
  browser,
  page,
  request,
}) => {
  const photoId = await uploadEvidence(request);
  const created = await request.post("/api/v1/production-records", {
    data: {
      productCode: "RICE",
      objectTypeCode: "FARMER",
      regionCode: "230208",
      cultivarCode: null,
      surveyYear: "2026",
      surveyMonth: "8",
      cultivatedAreaMu: "2",
      yieldPerMuKilograms: "500",
      quality: { MILLING_YIELD: "68" },
      costs: {},
      insurance: {},
      subsidies: {},
      submissionMetadata: {
        PROD_REPORTER_NAME: "验收填报员甲",
        PROD_SAMPLE_NAME: marker,
        PROD_SAMPLE_CONTACT: "13900000051",
        PROD_SAMPLE_LATITUDE: sampleLatitude,
        PROD_SAMPLE_LONGITUDE: sampleLongitude,
      },
      evidencePhotoIds: [photoId],
    },
  });
  expect(created.status()).toBe(201);
  const recordId = ((await created.json()) as { data: { id: string } }).data.id;
  expect(
    (
      await request.post(`/api/v1/production-records/${recordId}/submit`, {
        data: { version: 0 },
      })
    ).status(),
  ).toBe(200);

  const reviewerContext = await browser.newContext();
  expect(
    (
      await reviewerContext.request.post(
        `${liveBrowserAccounts.reviewer.url}/api/v1/production-records/${recordId}/approve`,
        { data: { version: 1 } },
      )
    ).status(),
  ).toBe(200);
  await reviewerContext.close();

  const list = await request.get(
    "/api/v1/production-records?productCode=RICE&pageKind=MONITORING&pageNumber=0&pageSize=100",
  );
  expect(list.status()).toBe(200);
  expect(await list.json()).toMatchObject({
    data: {
      items: expect.arrayContaining([
        expect.objectContaining({
          id: recordId,
          values: expect.objectContaining({ PROD_STATUS: "已审核" }),
        }),
      ]),
    },
  });

  await expect
    .poll(async () => {
      const response = await request.get(
        "/api/v1/work-items?scope=COMPLETED&page=0&pageSize=100&productCode=RICE",
      );
      const body = (await response.json()) as {
        data: { items: Array<{ sourceId: string | null }> };
      };
      return body.data.items.some(({ sourceId }) => sourceId === recordId);
    })
    .toBe(true);

  await expect
    .poll(async () => {
      const response = await request.get("/api/v1/notifications");
      const body = (await response.json()) as {
        data: { items: Array<{ aggregateId: string; actionCode: string }> };
      };
      return body.data.items.some(
        (item) =>
          item.aggregateId === recordId &&
          item.actionCode === "PRODUCTION_RECORD_APPROVED",
      );
    })
    .toBe(true);

  expect(
    queryE2eDatabase(
      `SELECT source_record_id FROM overview.sample_point_query_source WHERE source_record_id='${recordId}'`,
    ),
  ).toBe(recordId);

  const definitions = await request.get(
    "/api/v1/overview/annual-comparison-definitions?sourceDomain=PRODUCTION&productCode=RICE",
  );
  expect(definitions.status()).toBe(200);
  const indicatorCode = (
    (await definitions.json()) as { data: Array<{ code: string }> }
  ).data[0]?.code;
  expect(indicatorCode).toBeTruthy();
  const comparison = await request.get("/api/v1/overview/annual-comparisons", {
    params: {
      productCode: "RICE",
      regionCode: "230208",
      surveyYear: 2026,
      indicatorCode: indicatorCode ?? "",
    },
  });
  expect(comparison.status()).toBe(200);
  expect(await comparison.json()).toMatchObject({
    data: {
      productCode: "RICE",
      cultivarCode: null,
      points: expect.arrayContaining([
        expect.objectContaining({ businessYear: "2026", value: 2 }),
      ]),
    },
  });

  const release = await request.post("/api/v1/supply-sources/releases", {
    data: {
      sourceDomain: "PRODUCTION",
      sourceRecordId: recordId,
      sourceVersion: 2,
      productCode: "RICE",
      regionCode: "230208",
      periodCode: "2026-Q3",
      roleCode: "LOCAL_PRODUCTION",
      sourceFieldCode: "PROD_ESTIMATED_OUTPUT",
      qualityState: "PASSED",
    },
  });
  expect(release.status()).toBe(200);
  expect(
    queryE2eDatabase(
      `SELECT source_record_id FROM supply.source_release WHERE source_record_id='${recordId}'`,
    ),
  ).toBe(recordId);

  const reporterContext = await browser.newContext();
  const reporterPage = await reporterContext.newPage();
  const reporterErrors = trackBrowserErrors(reporterPage);
  const preview = await reporterContext.request.post(
    `${liveBrowserAccounts.reporter.url}/api/v1/reports/previews`,
    {
      data: {
        definitionCode: "PRODUCTION_DAILY",
        productCode: "RICE",
        regionLevel: "COUNTY",
        regionCode: "230208",
        periodCode: "2026-08-01",
      },
    },
  );
  expect(preview.status()).toBe(201);
  const previewBody = (await preview.json()) as {
    data: { datasetId: string; lines: Array<{ label: string; value: string }> };
  };
  expect(previewBody.data.lines).toContainEqual(
    expect.objectContaining({ label: "核定数据条数", value: "1" }),
  );
  expect(
    queryE2eDatabase(
      `SELECT parameter_snapshot->>'regionCode' FROM reporting.report_preview WHERE dataset_id='${previewBody.data.datasetId}'`,
    ),
  ).toBe("230208");

  await page.goto("/#/经营总览/风险关注");
  await expect(page.getByRole("main")).toContainText("粮食商情经营总览");
  await page.goto("/#/供需分析/供需平衡");
  await expect(page.getByRole("heading", { name: "供需平衡" })).toBeVisible();
  await reporterPage.goto(
    `${liveBrowserAccounts.reporter.url}/#/产情监测/产情分析`,
  );
  await expect(
    reporterPage.getByRole("heading", { name: "产情分析" }),
  ).toBeVisible();
  await reporterPage.goto(
    `${liveBrowserAccounts.reporter.url}/#/报表中心/业务报告`,
  );
  await expect(
    reporterPage.getByRole("heading", { name: "业务报告" }),
  ).toBeVisible();
  reporterErrors.assertClean();
  await reporterContext.close();
});
