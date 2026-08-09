import {
  expect,
  liveBrowserAccounts,
  queryE2eDatabase,
  test,
  trackBrowserErrors,
} from "./fixtures";

const marketObject = "E2E-20260809-大豆市场-音钦村贸易商";
const cultivar = "E2E-黑农市场验收1号";
const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function recordRow(page: import("@playwright/test").Page) {
  return page
    .getByRole("table", { name: "大豆市场采集表" })
    .getByRole("row")
    .filter({ hasText: marketObject });
}

async function openRecord(
  page: import("@playwright/test").Page,
  dialogName = "市场记录处理",
) {
  await recordRow(page).getByRole("button", { name: "查看" }).click();
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
  const operatorListStatuses: string[] = [];
  page.on("response", async (response) => {
    if (
      response.request().method() !== "GET" ||
      !response.url().includes("/api/v1/market-records?")
    )
      return;
    try {
      const body = (await response.json()) as {
        data?: { items?: Array<{ values?: Record<string, string> }> };
      };
      const status = body.data?.items?.find(
        ({ values }) => values?.["MKT_SAMPLE_NAME"] === marketObject,
      )?.values?.["MKT_STATUS"];
      if (status) operatorListStatuses.push(status);
    } catch {
      // A malformed list response is asserted by the business UI and is not
      // converted into test fixture data here.
    }
  });
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
          observed.push(String((event as MessageEvent).data));
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
  await expect(form.getByLabel("对象采购价格")).toBeVisible();
  await expect(form.getByLabel("对象销售价格")).toBeVisible();
  await expect(form.getByLabel(/买卖方向/u)).toHaveCount(0);

  await form.getByRole("combobox", { name: "地级市" }).selectOption("230200");
  await form.getByRole("combobox", { name: "区县" }).selectOption("230208");
  await form.getByRole("combobox", { name: "乡镇" }).selectOption("230208101");
  await form
    .getByRole("combobox", { name: "行政村" })
    .selectOption("230208101001");
  await form.getByLabel("交易日期").fill("2026-08-09");
  await form.getByLabel("对象采购价格").fill("4380");
  await form.getByLabel("对象销售价格").fill("4460");
  await form.getByLabel("车板组成").fill("25");
  await form.getByLabel("包装形态").selectOption("BULK");
  await form.getByLabel("包装组成").fill("8");
  await form.getByLabel("运费组成").fill("62");
  await form.getByLabel("填报人联系方式").fill("13800000001");
  await form.getByLabel("填报对象/客户联系方式").fill("13900000011");
  await form.getByLabel("样本点纬度").fill("47.3543");
  await form.getByLabel("样本点经度").fill("123.9182");
  await form.getByLabel("填报对象/客户名称").fill(marketObject);
  await form.getByRole("textbox", { name: "具体品种" }).fill(cultivar);
  await form.getByLabel("水分").fill("12.5");
  await form.getByLabel("杂质").fill("1.0");
  await form.getByLabel("蛋白").fill("38.5");
  await form.getByLabel("出油率").fill("19.0");
  await form.getByLabel("采购量").fill("120");
  await form.getByLabel("销售量").fill("65");
  await form.getByLabel("期初库存").fill("300");
  await form.getByLabel("出库量").fill("70");
  await form.getByLabel("期末库存").fill("350");
  await form.getByLabel("现场水印照片").setInputFiles({
    name: "e2e-market-scene.png",
    mimeType: "image/png",
    buffer: validPng,
  });
  await form.getByRole("button", { name: "保存业务记录" }).click();
  await expect(createDialog).toHaveCount(0);
  await expect(recordRow(page)).toBeVisible();

  await reviewerPage.goto(
    `${liveBrowserAccounts.reviewer.url}/#/市场监测/大豆市场采集`,
  );
  await expect(recordRow(reviewerPage)).toBeVisible();

  let operatorDialog = await openRecord(page);
  await operatorDialog.getByRole("button", { name: "提交审核" }).click();
  await expect(operatorDialog.getByText("提交成功")).toBeVisible();
  await operatorDialog
    .getByRole("button", { name: "关闭市场记录处理" })
    .click();

  await expect(recordRow(reviewerPage)).toContainText("待审核", {
    timeout: 10_000,
  });
  let reviewerDialog = await openRecord(reviewerPage);
  await reviewerDialog.getByLabel("退回原因").fill("请补充采购量现场核验说明");
  await reviewerDialog.getByRole("button", { name: "退回补充" }).click();
  await expect(reviewerDialog.getByText("退回成功")).toBeVisible();
  await reviewerDialog
    .getByRole("button", { name: "关闭市场记录处理" })
    .click();

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
  await expect
    .poll(() => operatorListStatuses.at(-1), {
      message: `operator market list responses: ${operatorListStatuses.join(",")}`,
    })
    .toBe("退回补充");
  await expect(recordRow(page)).toContainText("需补充", { timeout: 10_000 });
  operatorDialog = await openRecord(page);
  await operatorDialog.getByLabel("来源说明").fill("已补充现场采购量台账核验");
  await operatorDialog.getByRole("button", { name: "保存业务记录" }).click();
  await expect(operatorDialog).toHaveCount(0);
  operatorDialog = await openRecord(page);
  await operatorDialog.getByRole("button", { name: "提交审核" }).click();
  await expect(operatorDialog.getByText("提交成功")).toBeVisible();
  await operatorDialog
    .getByRole("button", { name: "关闭市场记录处理" })
    .click();

  await expect(recordRow(reviewerPage)).toContainText("待审核", {
    timeout: 10_000,
  });
  reviewerDialog = await openRecord(reviewerPage);
  await reviewerDialog.getByRole("button", { name: "审核通过" }).click();
  await expect(reviewerDialog.getByText("审核通过成功")).toBeVisible();

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
  const recordId = row?.id ?? "";
  const detail = await request.get(`/api/v1/market-records/${recordId}`);
  expect(detail.ok()).toBe(true);
  expect(await detail.json()).toMatchObject({
    data: {
      status: "APPROVED",
      coreValues: {
        MKT_PURCHASE_BASE_PRICE: "4380.0000",
        MKT_SALE_BASE_PRICE: "4460.0000",
        MKT_REPORTER_NAME: "验收填报员甲",
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
