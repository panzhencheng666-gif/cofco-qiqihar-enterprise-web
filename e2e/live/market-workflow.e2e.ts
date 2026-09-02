import {
  expect,
  liveBrowserAccounts,
  queryE2eDatabase,
  test,
  trackBrowserErrors,
} from "./fixtures";

const marketObject = "E2E-20260809-大豆市场-音钦村贸易商";
const sampleLatitude = "47.33";
const sampleLongitude = "123.23";
const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function recordRow(page: Page) {
  return page
    .getByRole("table", { name: "大豆市场采集表" })
    .getByRole("row")
    .filter({ hasText: marketObject });
}

async function openWorkItem(
  page: Page,
  actionName: "继续市场填报" | "补充市场填报" | "审核市场单据",
  dialogName: "补充市场填报" | "市场单据审核",
) {
  const row = page
    .getByRole("row")
    .filter({ hasText: "大豆报价与交易" })
    .filter({ has: page.getByRole("button", { name: actionName }) });
  await expect(row).toHaveCount(1, { timeout: 10_000 });
  await row.getByRole("button", { name: actionName }).click();
  const dialog = page.getByRole("dialog", { name: dialogName });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("form > header strong")).toContainText(
    /草稿|待审核|退回补充|审核通过/u,
  );
  return dialog;
}

test("runs a market return, resubmission, and approval against PostgreSQL", async ({
  browser,
  page,
  request,
}) => {
  await page.addInitScript(() => {
    const NativeEventSource = window.EventSource;
    const observed: string[] = [];
    Object.defineProperty(window, "__liveE2eBusinessEvents", {
      configurable: false,
      value: observed,
    });
    window.EventSource = class extends NativeEventSource {
      constructor(url: string | URL, eventSourceInitDict?: EventSourceInit) {
        super(url, eventSourceInitDict);
        this.addEventListener("business-change", (event) => {
          observed.push(String(event.data));
        });
      }
    };
  });
  const reviewerContext = await browser.newContext();
  const reviewerPage = await reviewerContext.newPage();
  const reviewerErrors = trackBrowserErrors(reviewerPage);

  await page.goto("/#/市场监测/大豆市场采集");
  await expect(
    page.getByRole("table", { name: "大豆市场采集表" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "新建采集记录" }).click();
  const createDialog = page.getByRole("dialog", { name: "新建市场填报" });
  const form = createDialog.getByRole("region", { name: "市场采集" });
  await expect(form.getByLabel("采集对象收购价格")).toBeVisible();
  await expect(form.getByLabel("采集对象销售价格")).toBeVisible();
  await expect(form.getByLabel(/买卖方向/u)).toHaveCount(0);
  await form.getByLabel("数据年份").selectOption("2026");
  await form.getByLabel("数据月份").selectOption("8");

  const surveyRegion = form.getByRole("group", { name: "地区", exact: true });
  await surveyRegion
    .getByRole("combobox", { name: "地级市" })
    .selectOption("230200");
  await surveyRegion
    .getByRole("combobox", { name: "区县" })
    .selectOption("230208");
  await form.getByLabel("采集对象收购价格").fill("4380");
  await form.getByLabel("采集对象销售价格").fill("4460");
  await form.getByLabel("车板组成").fill("25");
  await form.getByLabel("包装形态").selectOption("BULK");
  await form.getByLabel("运费组成").fill("62");
  await form.getByLabel("样本点联系方式").fill("13900000011");
  await form.getByLabel("纬度").fill(sampleLatitude);
  await form.getByLabel("经度").fill(sampleLongitude);
  await form.getByLabel("样本点名称").fill(marketObject);
  await form.getByLabel("水分").fill("12.5");
  await form.getByLabel("杂质").fill("1.0");
  await form.getByLabel("蛋白").fill("38.5");
  await form.getByLabel("出油率").fill("19.0");
  await form.getByLabel("采购量").fill("120");
  await form.getByLabel("销售量").fill("65");
  await form.getByLabel("现有库存").fill("350");
  await form.getByLabel("现场水印照片").setInputFiles({
    name: "e2e-market-scene.png",
    mimeType: "image/png",
    buffer: validPng,
  });
  const submitResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/market-records/submit") &&
      response.request().method() === "POST",
  );
  await form.getByRole("button", { name: "保存并提交审核" }).click();
  const submitResponse = await submitResponsePromise;
  expect(submitResponse.status()).toBe(201);
  const submitted = (await submitResponse.json()) as {
    data: { id: string; status: string };
  };
  expect(submitted.data.status).toBe("PENDING_REVIEW");
  const recordId = submitted.data.id;
  expect(recordId).toMatch(/^[0-9a-f-]{36}$/u);
  await expect(createDialog).toHaveCount(0);
  await expect(recordRow(page)).toHaveCount(0);

  const createdResponse = await request.get(
    "/api/v1/market-records?productCode=SOYBEAN&pageKind=MONITORING&pageNumber=0&pageSize=100",
  );
  expect(createdResponse.ok()).toBe(true);
  const createdList = (await createdResponse.json()) as {
    data: { items: Array<{ id: string; values: Record<string, string> }> };
  };
  expect(
    createdList.data.items.find(
      ({ values }) => values["MKT_SAMPLE_NAME"] === marketObject,
    ),
  ).toBeUndefined();
  expect(
    queryE2eDatabase(
      `SELECT status_code FROM market.market_record WHERE record_id = '${recordId}'`,
    ),
  ).toBe("PENDING_REVIEW");

  await reviewerPage.goto(
    `${liveBrowserAccounts.reviewer.url}/#/市场监测/数据审核`,
  );
  let reviewerDialog = await openWorkItem(
    reviewerPage,
    "审核市场单据",
    "市场单据审核",
  );
  await expect(reviewerDialog.getByLabel("样本点名称")).toBeDisabled();
  await reviewerDialog.getByLabel("退回原因").fill("请补充采购量现场核验说明");
  await reviewerDialog.getByRole("button", { name: "退回补充" }).click();
  await expect(reviewerDialog).toHaveCount(0);

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & { __liveE2eBusinessEvents: string[] }
          ).__liveE2eBusinessEvents.filter((event) =>
            event.includes("MARKET_RECORD_RETURNED"),
          ).length,
      ),
    )
    .toBeGreaterThan(0);
  await page.goto("/#/市场监测/数据审核");
  const operatorDialog = await openWorkItem(
    page,
    "补充市场填报",
    "补充市场填报",
  );
  await operatorDialog.getByLabel("采购量").fill("125");
  await operatorDialog.getByRole("button", { name: "保存并提交审核" }).click();
  await expect(operatorDialog).toHaveCount(0);
  expect(
    queryE2eDatabase(
      `SELECT status_code FROM market.market_record WHERE record_id = '${recordId}'`,
    ),
  ).toBe("PENDING_REVIEW");

  reviewerDialog = await openWorkItem(
    reviewerPage,
    "审核市场单据",
    "市场单据审核",
  );
  await reviewerDialog.getByRole("button", { name: "审核通过" }).click();
  await expect(reviewerDialog).toHaveCount(0);

  const listResponse = await request.get(
    "/api/v1/market-records?productCode=SOYBEAN&pageKind=MONITORING&pageNumber=0&pageSize=100",
  );
  expect(listResponse.ok()).toBe(true);
  const list = (await listResponse.json()) as {
    data: { items: Array<{ id: string; values: Record<string, string> }> };
  };
  const row = list.data.items.find(
    ({ values }) => values["MKT_SAMPLE_NAME"] === marketObject,
  );
  expect(row).toBeDefined();
  expect(row?.id).toBe(recordId);
  const detail = await request.get(`/api/v1/market-records/${recordId}`);
  expect(detail.ok()).toBe(true);
  expect(await detail.json()).toMatchObject({
    data: {
      status: "APPROVED",
      coreValues: {
        MKT_PURCHASE_BASE_PRICE: "4380.0000",
        MKT_SALE_BASE_PRICE: "4460.0000",
        MKT_REPORTER_NAME: "验收填报员甲",
        MKT_SAMPLE_NAME: marketObject,
      },
      facts: {
        PURCHASE_VOLUME: "125.0000",
        ENDING_INVENTORY: "350.0000",
      },
    },
  });
  expect(
    queryE2eDatabase(
      `SELECT purchase_base_price || '|' || sale_base_price || '|' || trade_direction FROM market.market_record WHERE record_id = '${recordId}'`,
    ),
  ).toBe("4380.0000|4460.0000|BOTH");
  expect(
    Number(
      queryE2eDatabase(
        `SELECT count(*) FROM platform.business_audit_event WHERE aggregate_id = '${recordId}'`,
      ),
    ),
  ).toBeGreaterThanOrEqual(5);
  expect(
    Number(
      queryE2eDatabase(
        `SELECT count(*) FROM platform.business_event_outbox WHERE aggregate_id = '${recordId}'`,
      ),
    ),
  ).toBeGreaterThanOrEqual(4);

  reviewerErrors.assertClean();
  await reviewerContext.close();
});
import type { Page } from "@playwright/test";
