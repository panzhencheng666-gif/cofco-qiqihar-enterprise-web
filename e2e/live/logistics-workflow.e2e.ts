import {
  expect,
  liveBrowserAccounts,
  queryE2eDatabase,
  test,
  trackBrowserErrors,
} from "./fixtures";

const sourceOrganization = "E2E-20260809-大豆物流-音钦村台账";
const revisedSourceOrganization = `${sourceOrganization}-已补充`;

function recordRow(page: Page) {
  return page
    .getByRole("table", { name: "粮食物流节点监测表" })
    .getByRole("row")
    .filter({ hasText: /E2E-20260809-大豆物流-音钦村台账/u });
}

async function openWorkItem(
  page: Page,
  recordId: string,
  actionName: "继续物流填报" | "补充物流填报" | "审核物流单据",
  dialogName: "补充物流监测填报" | "物流监测单据审核",
) {
  const row = page.getByRole("row", { name: new RegExp(recordId, "u") });
  await expect(row).toBeVisible({ timeout: 10_000 });
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
    page.getByRole("table", { name: "粮食物流节点监测表" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "新建监测记录" }).click();
  const createDialog = page.getByRole("dialog", {
    name: "新建物流监测填报",
  });
  const form = createDialog.getByRole("region", { name: "物流监测填报" });
  await form.getByLabel("物流监测期").selectOption("2026-W32");
  await form.getByLabel("物流采集日期").fill("2026-08-09");
  await form.getByLabel("物流起运节点").selectOption("E2E_QQ_RAIL");
  await form.getByLabel("物流到达节点").selectOption("E2E_QQ_ROAD");
  await form.getByLabel("物流运输方式").selectOption("RAIL");
  await form.getByLabel("物流流向类型").selectOption("INFLOW");
  await form.getByLabel("物流运量").fill("125.5");
  await form.getByLabel("物流运价").fill("82.25");
  await form.getByLabel("物流在途时间").fill("5.5");
  await form.getByLabel("物流来源单位").fill(sourceOrganization);
  await expect(form.getByLabel("物流填报人")).toHaveText(
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
      ({ values }) => values.LOG_SOURCE_ORGANIZATION === sourceOrganization,
    )?.id ?? "";
  expect(recordId).not.toBe("");

  await recordRow(page).getByRole("button", { name: "查看" }).click();
  const viewDialog = page.getByRole("dialog", {
    name: "物流监测记录详情",
  });
  await expect(viewDialog).toBeVisible();
  await expect(viewDialog.getByLabel("物流来源单位")).toBeDisabled();
  await expect(
    viewDialog.getByRole("button", { name: "保存物流记录" }),
  ).toHaveCount(0);
  await viewDialog
    .getByRole("button", { name: "关闭物流监测记录详情" })
    .click();

  await page.goto("/#/我的工作/待我处理");
  let operatorDialog = await openWorkItem(
    page,
    recordId,
    "继续物流填报",
    "补充物流监测填报",
  );
  await operatorDialog.getByRole("button", { name: "提交审核" }).click();
  await expect(operatorDialog.getByText("提交成功")).toBeVisible();
  await operatorDialog
    .getByRole("button", { name: "关闭补充物流监测填报" })
    .click();

  await reviewerPage.goto(
    `${liveBrowserAccounts.reviewer.url}/#/我的工作/待我处理`,
  );
  let reviewerDialog = await openWorkItem(
    reviewerPage,
    recordId,
    "审核物流单据",
    "物流监测单据审核",
  );
  await expect(reviewerDialog.getByLabel("物流来源单位")).toBeDisabled();
  await reviewerDialog
    .getByLabel("物流退回原因")
    .fill("请补充运输来源台账说明");
  await reviewerDialog.getByRole("button", { name: "退回补充" }).click();
  await expect(reviewerDialog).toHaveCount(0);

  operatorDialog = await openWorkItem(
    page,
    recordId,
    "补充物流填报",
    "补充物流监测填报",
  );
  await operatorDialog
    .getByLabel("物流来源单位")
    .fill(revisedSourceOrganization);
  await operatorDialog.getByRole("button", { name: "保存物流记录" }).click();
  await expect(operatorDialog).toHaveCount(0);

  operatorDialog = await openWorkItem(
    page,
    recordId,
    "补充物流填报",
    "补充物流监测填报",
  );
  await operatorDialog.getByRole("button", { name: "提交审核" }).click();
  await expect(operatorDialog.getByText("提交成功")).toBeVisible();
  await operatorDialog
    .getByRole("button", { name: "关闭补充物流监测填报" })
    .click();

  reviewerDialog = await openWorkItem(
    reviewerPage,
    recordId,
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
    ({ values }) =>
      values.LOG_SOURCE_ORGANIZATION === revisedSourceOrganization,
  );
  expect(row).toMatchObject({
    status: "APPROVED",
    values: {
      LOG_REPORTER: liveBrowserAccounts.operatorOne.name,
      LOG_ROUTE_VOLUME: "125.5000",
      LOG_FREIGHT_RATE: "82.2500",
      LOG_TRANSIT_TIME: "5.5000",
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
  ).toBe("FREIGHT_RATE=82.2500,ROUTE_VOLUME=125.5000,TRANSIT_TIME=5.5000");
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
