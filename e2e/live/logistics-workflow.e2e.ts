import {
  expect,
  liveBrowserAccounts,
  queryE2eDatabase,
  test,
  trackBrowserErrors,
} from "./fixtures";

const sourceOrganization = "E2E-20260809-大豆物流-音钦村台账";
const revisedSourceOrganization = `${sourceOrganization}-已补充`;
const sampleLatitude = "47.34";
const sampleLongitude = "123.24";

function recordRow(page: Page) {
  return page
    .getByRole("table", { name: "粮食物流监测表" })
    .getByRole("row")
    .filter({ hasText: /E2E-20260809-大豆物流-音钦村台账/u });
}

async function openWorkItem(
  page: Page,
  actionName: "继续物流填报" | "补充物流填报" | "审核物流单据",
  dialogName: "补充物流监测填报" | "物流监测单据审核",
) {
  const row = page
    .getByRole("row")
    .filter({ hasText: "大豆物流监测" })
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

test("runs a logistics return, revision, resubmission, and approval against PostgreSQL", async ({
  browser,
  page,
  request,
}) => {
  const reviewerContext = await browser.newContext();
  const reviewerPage = await reviewerContext.newPage();
  const reviewerErrors = trackBrowserErrors(reviewerPage);

  await page.goto("/#/市场监测/大豆物流监测");
  await expect(
    page.getByRole("table", { name: "粮食物流监测表" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "新建监测记录" }).click();
  const createDialog = page.getByRole("dialog", {
    name: "新建物流监测填报",
  });
  const form = createDialog.getByRole("region", { name: "物流监测填报" });
  await form.getByLabel("数据年份").fill("2026");
  await form.getByLabel("数据月份").fill("8");
  await form.getByLabel("物流样本点名称").fill(sourceOrganization);
  await form
    .getByRole("combobox", { name: "地区", exact: true })
    .selectOption("230208");
  await form.getByLabel("物流样本点联系方式").fill("13900000012");
  await form.getByLabel("纬度").fill(sampleLatitude);
  await form.getByLabel("经度").fill(sampleLongitude);
  await form.getByLabel("运输方式").selectOption("RAIL");
  await form.getByLabel("运输方向").selectOption("INFLOW");
  await form.getByLabel("运输数量").fill("125.5");
  await form.getByLabel("物流运价（不含车板价）").fill("82.25");
  await form.getByLabel("车板价", { exact: true }).fill("2650");
  await expect(form.getByLabel("填报人")).toHaveText(
    liveBrowserAccounts.operatorOne.name,
  );
  await form.getByRole("button", { name: "保存物流记录" }).click();
  await expect(createDialog).toHaveCount(0);
  await expect(recordRow(page)).toBeVisible();

  const createdResponse = await request.get(
    "/api/v1/logistics-records?productCode=SOYBEAN&pageNumber=0&pageSize=100",
  );
  expect(createdResponse.ok()).toBe(true);
  const createdList = (await createdResponse.json()) as {
    data: {
      items: Array<{
        id: string;
        values: Record<string, string>;
      }>;
    };
  };
  const recordId =
    createdList.data.items.find(
      ({ values }) => values.LOG_SAMPLE_NAME === sourceOrganization,
    )?.id ?? "";
  expect(recordId).not.toBe("");

  await recordRow(page).getByRole("button", { name: "查看" }).click();
  const viewDialog = page.getByRole("dialog", {
    name: "物流监测记录详情",
  });
  await expect(viewDialog).toBeVisible();
  await expect(viewDialog.getByLabel("物流样本点名称")).toBeDisabled();
  await expect(
    viewDialog.getByRole("button", { name: "保存物流记录" }),
  ).toHaveCount(0);
  await viewDialog
    .getByRole("button", { name: "关闭物流监测记录详情" })
    .click();

  await page.goto("/#/我的工作/待我处理");
  let operatorDialog = await openWorkItem(
    page,
    "继续物流填报",
    "补充物流监测填报",
  );
  await operatorDialog.getByRole("button", { name: "提交审核" }).click();
  await expect(operatorDialog.locator("form > header strong")).toContainText(
    "待审核",
  );
  await expect(
    operatorDialog.getByRole("button", { name: "提交审核" }),
  ).toHaveCount(0);
  await operatorDialog
    .getByRole("button", { name: "关闭补充物流监测填报" })
    .click();

  await reviewerPage.goto(
    `${liveBrowserAccounts.reviewer.url}/#/我的工作/待我处理`,
  );
  let reviewerDialog = await openWorkItem(
    reviewerPage,
    "审核物流单据",
    "物流监测单据审核",
  );
  await expect(reviewerDialog.getByLabel("物流样本点名称")).toBeDisabled();
  await reviewerDialog
    .getByLabel("物流退回原因")
    .fill("请补充运输来源台账说明");
  await reviewerDialog.getByRole("button", { name: "退回补充" }).click();
  await expect(reviewerDialog).toHaveCount(0);

  operatorDialog = await openWorkItem(page, "补充物流填报", "补充物流监测填报");
  await operatorDialog
    .getByLabel("物流样本点名称")
    .fill(revisedSourceOrganization);
  await operatorDialog.getByRole("button", { name: "保存物流记录" }).click();
  await expect(operatorDialog).toHaveCount(0);

  operatorDialog = await openWorkItem(page, "补充物流填报", "补充物流监测填报");
  await operatorDialog.getByRole("button", { name: "提交审核" }).click();
  await expect(operatorDialog.locator("form > header strong")).toContainText(
    "待审核",
  );
  await expect(
    operatorDialog.getByRole("button", { name: "提交审核" }),
  ).toHaveCount(0);
  await operatorDialog
    .getByRole("button", { name: "关闭补充物流监测填报" })
    .click();

  reviewerDialog = await openWorkItem(
    reviewerPage,
    "审核物流单据",
    "物流监测单据审核",
  );
  await reviewerDialog.getByRole("button", { name: "审核通过" }).click();
  await expect(reviewerDialog).toHaveCount(0);

  const listResponse = await request.get(
    "/api/v1/logistics-records?productCode=SOYBEAN&pageNumber=0&pageSize=100",
  );
  expect(listResponse.ok()).toBe(true);
  const list = (await listResponse.json()) as {
    data: {
      items: Array<{
        id: string;
        status: string;
        values: Record<string, string>;
      }>;
    };
  };
  const row = list.data.items.find(
    ({ values }) => values.LOG_SAMPLE_NAME === revisedSourceOrganization,
  );
  expect(row).toMatchObject({
    status: "APPROVED",
    values: {
      LOG_REPORTER: liveBrowserAccounts.operatorOne.name,
      LOG_ROUTE_VOLUME: "125.5000",
      LOG_FREIGHT_RATE: "82.2500",
      LOG_BOARD_PRICE: "2650.0000",
    },
  });
  expect(row?.id).toBe(recordId);
  expect(
    queryE2eDatabase(
      `SELECT status_code || '|' || reporter || '|' || source_organization FROM logistics.route_event WHERE event_id = '${recordId}'`,
    ),
  ).toBe(
    `APPROVED|${liveBrowserAccounts.operatorOne.name}|${revisedSourceOrganization}`,
  );
  expect(
    queryE2eDatabase(
      `SELECT string_agg(fact_code || '=' || value, ',' ORDER BY fact_code) FROM logistics.route_fact WHERE event_id = '${recordId}'`,
    ),
  ).toBe("BOARD_PRICE=2650.0000,FREIGHT_RATE=82.2500,ROUTE_VOLUME=125.5000");
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
