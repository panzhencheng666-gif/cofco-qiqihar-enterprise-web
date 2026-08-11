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
  await expect(form.getByLabel("对象采购价格")).toBeVisible();
  await expect(form.getByLabel("对象销售价格")).toBeVisible();
  await expect(form.getByLabel(/买卖方向/u)).toHaveCount(0);

  const surveyRegion = form.getByRole("group", { name: "地区", exact: true });
  await surveyRegion
    .getByRole("combobox", { name: "地级市" })
    .selectOption("230200");
  await surveyRegion
    .getByRole("combobox", { name: "区县" })
    .selectOption("230208");
  await surveyRegion
    .getByRole("combobox", { name: "乡镇" })
    .selectOption("230208101");
  await surveyRegion
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
  await form.getByLabel("库存填报主体唯一标识").fill("e2e-trader-yinqin-1");
  await form.getByLabel("库存权属").selectOption("OWNED");
  const storageRegion = form.getByRole("group", { name: "库存存放地区" });
  await storageRegion
    .getByRole("combobox", { name: "地级市" })
    .selectOption("230200");
  await storageRegion
    .getByRole("combobox", { name: "区县" })
    .selectOption("230208");
  await storageRegion
    .getByRole("combobox", { name: "乡镇" })
    .selectOption("230208101");
  await storageRegion
    .getByRole("combobox", { name: "行政村" })
    .selectOption("230208101001");
  await form.getByLabel("货主唯一标识").fill("e2e-trader-yinqin-1");
  await form.getByLabel("库存统计截止日").fill("2026-08-09");
  await form.getByLabel("库存政策属性").selectOption("COMMERCIAL");
  await form.getByLabel("现场水印照片").setInputFiles({
    name: "e2e-market-scene.png",
    mimeType: "image/png",
    buffer: validPng,
  });
  await form.getByRole("button", { name: "保存业务记录" }).click();
  await expect(createDialog).toHaveCount(0);
  await expect(recordRow(page)).toBeVisible();

  const createdResponse = await request.get(
    "/api/v1/market-records?productCode=SOYBEAN&pageKind=MONITORING&pageNumber=0&pageSize=100",
  );
  expect(createdResponse.ok()).toBe(true);
  const createdList = (await createdResponse.json()) as {
    data: { items: Array<{ id: string; values: Record<string, string> }> };
  };
  const recordId =
    createdList.data.items.find(
      ({ values }) => values["MKT_SAMPLE_NAME"] === marketObject,
    )?.id ?? "";
  expect(recordId).not.toBe("");

  await recordRow(page).getByRole("button", { name: "查看" }).click();
  const viewDialog = page.getByRole("dialog", { name: "市场记录详情" });
  await expect(viewDialog).toBeVisible();
  await expect(viewDialog.getByLabel("来源说明")).toBeDisabled();
  await expect(
    viewDialog.getByRole("button", { name: "保存业务记录" }),
  ).toHaveCount(0);
  await viewDialog.getByRole("button", { name: "关闭市场记录详情" }).click();

  await page.goto("/#/我的工作/待我处理");
  let operatorDialog = await openWorkItem(page, "继续市场填报", "补充市场填报");
  await operatorDialog.getByRole("button", { name: "提交审核" }).click();
  await expect(operatorDialog.locator("form > header strong")).toContainText(
    "待审核",
  );
  await expect(
    operatorDialog.getByRole("button", { name: "提交审核" }),
  ).toHaveCount(0);
  await operatorDialog
    .getByRole("button", { name: "关闭补充市场填报" })
    .click();

  await reviewerPage.goto(
    `${liveBrowserAccounts.reviewer.url}/#/我的工作/待我处理`,
  );
  let reviewerDialog = await openWorkItem(
    reviewerPage,
    "审核市场单据",
    "市场单据审核",
  );
  await expect(reviewerDialog.getByLabel("来源说明")).toBeDisabled();
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
  operatorDialog = await openWorkItem(page, "补充市场填报", "补充市场填报");
  await operatorDialog.getByLabel("来源说明").fill("已补充现场采购量台账核验");
  await operatorDialog.getByRole("button", { name: "保存业务记录" }).click();
  await expect(operatorDialog).toHaveCount(0);
  operatorDialog = await openWorkItem(page, "补充市场填报", "补充市场填报");
  await operatorDialog.getByRole("button", { name: "提交审核" }).click();
  await expect(operatorDialog.locator("form > header strong")).toContainText(
    "待审核",
  );
  await expect(
    operatorDialog.getByRole("button", { name: "提交审核" }),
  ).toHaveCount(0);
  await operatorDialog
    .getByRole("button", { name: "关闭补充市场填报" })
    .click();

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
        MKT_INVENTORY_HOLDER_CODE: "e2e-trader-yinqin-1",
        MKT_INVENTORY_OWNERSHIP_TYPE: "OWNED",
        MKT_STORAGE_REGION_CODE: "230208101001",
        MKT_CARGO_OWNER_CODE: "e2e-trader-yinqin-1",
        MKT_INVENTORY_CUTOFF_DATE: "2026-08-09",
        MKT_INVENTORY_POLICY_ATTRIBUTE: "COMMERCIAL",
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
