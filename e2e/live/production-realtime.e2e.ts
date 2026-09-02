import {
  expect,
  liveBrowserAccounts,
  queryE2eDatabase,
  test,
  trackBrowserErrors,
} from "./fixtures";
import type { Page } from "@playwright/test";

const recordMarker = "E2E-20260809-大豆产情-黑农验收1号";
const sampleLatitude = "47.32";
const sampleLongitude = "123.22";
const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function openProductionWorkItem(
  page: Page,
  actionName: "继续产情填报" | "补充产情填报" | "审核产情单据",
  dialogName: "补充产情填报" | "产情单据审核",
) {
  const row = page
    .getByRole("row")
    .filter({ hasText: "大豆种植生产" })
    .filter({ has: page.getByRole("button", { name: actionName }) });
  await expect(row).toHaveCount(1, { timeout: 10_000 });
  await row.getByRole("button", { name: actionName }).click();
  const dialog = page.getByRole("dialog", { name: dialogName });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("persists production data, refreshes a colleague, and enforces region access", async ({
  browser,
  page,
  playwright,
}) => {
  const colleagueContext = await browser.newContext();
  const colleaguePage = await colleagueContext.newPage();
  const colleagueErrors = trackBrowserErrors(colleaguePage);
  await colleaguePage.goto(
    `${liveBrowserAccounts.operatorTwo.url}/#/产情监测/大豆产情填报`,
  );
  await expect(
    colleaguePage.getByRole("table", { name: "大豆产情调查表" }),
  ).toBeVisible();
  await expect(colleaguePage.getByText(recordMarker)).toHaveCount(0);

  await page.goto("/#/产情监测/大豆产情填报");
  await page.getByRole("button", { name: "新建调查记录" }).click();
  const dialog = page.getByRole("dialog", { name: "新建产情填报" });
  const form = dialog.getByRole("region", { name: "产情填报" });
  await expect(form.getByRole("combobox", { name: "品种" })).toHaveCount(0);
  await form.getByLabel("数据年份").selectOption("2026");
  await form.getByLabel("数据月份").selectOption("8");
  await form.getByRole("combobox", { name: "地级市" }).selectOption("230200");
  await form.getByRole("combobox", { name: "区县" }).selectOption("230208");
  await form.getByRole("textbox", { name: "样本点名称" }).fill(recordMarker);
  await form.getByLabel("播种面积").fill("120");
  await form.getByLabel("预计单产").fill("310");
  await form.getByLabel("期初库存").fill("18");
  await form.getByLabel("销售数量").fill("4");
  await form.getByLabel("自用数量").fill("2");
  await form.getByLabel("期末余粮").fill("12");
  await form.getByLabel("样本点联系方式").fill("13900000001");
  await form.getByLabel("纬度").fill(sampleLatitude);
  await form.getByLabel("经度").fill(sampleLongitude);
  await form.getByLabel("现场水印照片").setInputFiles({
    name: "e2e-production-scene.png",
    mimeType: "image/png",
    buffer: validPng,
  });
  await form.getByRole("button", { name: "保存并提交审核" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(recordMarker)).toHaveCount(0);
  await expect(colleaguePage.getByText(recordMarker)).toHaveCount(0);

  const recordId = queryE2eDatabase(
    `SELECT record_id FROM production.production_record_submission_metadata WHERE field_code='PROD_SAMPLE_NAME' AND value='${recordMarker}'`,
  );
  expect(recordId).toMatch(/^[0-9a-f-]{36}$/u);

  const detailResponse = await colleagueContext.request.get(
    `${liveBrowserAccounts.operatorTwo.url}/api/v1/production-records/${recordId}`,
  );
  expect(detailResponse.ok()).toBe(true);
  const detail = (await detailResponse.json()) as {
    data: {
      submissionMetadata: Record<string, string>;
      evidencePhotos: Array<{ id: string }>;
    };
  };
  expect(detail.data.submissionMetadata["PROD_REPORTER_NAME"]).toBe(
    "验收填报员甲",
  );
  expect(detail.data.evidencePhotos).toHaveLength(1);
  const photoId = detail.data.evidencePhotos[0]?.id ?? "";
  expect(
    (
      await colleagueContext.request.get(
        `${liveBrowserAccounts.operatorTwo.url}/api/v1/evidence-photos/${photoId}/content`,
      )
    ).status(),
  ).toBe(200);

  expect(
    queryE2eDatabase(
      `SELECT value FROM production.production_record_submission_metadata WHERE record_id = '${recordId}' AND field_code = 'PROD_REPORTER_NAME'`,
    ),
  ).toBe("验收填报员甲");
  expect(
    queryE2eDatabase(
      `SELECT count(*) FROM platform.business_audit_event WHERE aggregate_id = '${recordId}'`,
    ),
  ).toBe("2");
  expect(
    Number(
      queryE2eDatabase(
        `SELECT count(*) FROM platform.business_event_outbox WHERE aggregate_id = '${recordId}'`,
      ),
    ),
  ).toBeGreaterThanOrEqual(1);

  const reviewerContext = await browser.newContext();
  const reviewerPage = await reviewerContext.newPage();
  const reviewerErrors = trackBrowserErrors(reviewerPage);
  await reviewerPage.goto(
    `${liveBrowserAccounts.reviewer.url}/#/产情监测/数据审核`,
  );
  let reviewerDialog = await openProductionWorkItem(
    reviewerPage,
    "审核产情单据",
    "产情单据审核",
  );
  await expect(
    reviewerDialog.getByRole("button", { name: "保存并提交审核" }),
  ).toHaveCount(0);
  await reviewerDialog.getByLabel("退回原因").fill("请补充期初库存核验数据");
  await reviewerDialog.getByRole("button", { name: "退回补充" }).click();
  await expect(reviewerDialog).toHaveCount(0);

  await page.goto("/#/产情监测/数据审核");
  const operatorDialog = await openProductionWorkItem(
    page,
    "补充产情填报",
    "补充产情填报",
  );
  await operatorDialog.getByLabel("期初库存").fill("25");
  await operatorDialog.getByRole("button", { name: "保存并提交审核" }).click();
  await expect(operatorDialog).toHaveCount(0);
  expect(
    queryE2eDatabase(
      `SELECT status_code FROM production.production_record WHERE record_id = '${recordId}'`,
    ),
  ).toBe("PENDING_REVIEW");

  reviewerDialog = await openProductionWorkItem(
    reviewerPage,
    "审核产情单据",
    "产情单据审核",
  );
  await reviewerDialog.getByRole("button", { name: "审核通过" }).click();
  await expect(reviewerDialog).toHaveCount(0);

  await colleaguePage.reload();
  await expect(colleaguePage.getByText(recordMarker)).toBeVisible({
    timeout: 10_000,
  });

  expect(
    queryE2eDatabase(
      `SELECT status_code FROM production.production_record WHERE record_id = '${recordId}'`,
    ),
  ).toBe("APPROVED");
  expect(
    queryE2eDatabase(
      `SELECT value FROM production.production_record_submission_metadata WHERE record_id = '${recordId}' AND field_code = 'PROD_OPENING_INVENTORY'`,
    ),
  ).toBe("25");
  expect(
    queryE2eDatabase(
      `SELECT count(*) FROM platform.business_audit_event WHERE aggregate_id = '${recordId}'`,
    ),
  ).toBe("6");
  expect(
    Number(
      queryE2eDatabase(
        `SELECT count(*) FROM platform.business_event_outbox WHERE aggregate_id = '${recordId}'`,
      ),
    ),
  ).toBeGreaterThanOrEqual(6);
  reviewerErrors.assertClean();
  await reviewerContext.close();

  const outside = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:63183",
    extraHTTPHeaders: { "X-Actor": "e2e-outside-operator" },
  });
  expect(
    (await outside.get(`/api/v1/production-records/${recordId}`)).status(),
  ).toBe(403);
  expect(
    (await outside.get(`/api/v1/evidence-photos/${photoId}/content`)).status(),
  ).toBe(403);
  await outside.dispose();

  colleagueErrors.assertClean();
  await colleagueContext.close();
});
