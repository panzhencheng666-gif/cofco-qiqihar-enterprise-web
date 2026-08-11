import { randomUUID } from "node:crypto";

import {
  expect,
  liveBrowserAccounts,
  queryE2eDatabase,
  test,
  trackBrowserErrors,
} from "./fixtures";

test("uses durable notifications, permission-scoped work navigation, and page help", async ({
  browser,
  page,
}) => {
  const eventId = randomUUID();
  const submissionAuditId = randomUUID();
  const productionRecordId = randomUUID();
  queryE2eDatabase(`
    INSERT INTO platform.business_event_outbox(
      event_id, aggregate_type, aggregate_id, action_code,
      actor_subject_id, work_unit_code, region_codes, product_code,
      occurred_at, detail
    ) VALUES (
      '${eventId}'::uuid, 'PRODUCTION_RECORD', '${productionRecordId}',
      'PRODUCTION_RECORD_CREATED', 'e2e-operator-two', 'E2E_QIQIHAR',
      ARRAY['230208101001'], 'CORN', now(),
      '{"source":"live-header-tools"}'::jsonb
    )
  `);
  queryE2eDatabase(`
    INSERT INTO production.production_record(
      record_id, product_code, object_type_code, region_code,
      survey_date, reported_at, cultivated_area_mu, yield_per_mu_kg,
      status_code, last_modified_by
    ) VALUES (
      '${productionRecordId}', 'CORN', 'FARMER', '230208101001',
      DATE '2026-08-09', TIMESTAMPTZ '2026-08-09 10:30:00+08',
      135, 482, 'PENDING_REVIEW', 'e2e-operator-one'
    )
  `);
  queryE2eDatabase(`
    INSERT INTO platform.business_audit_event(
      event_id, aggregate_type, aggregate_id, action_code,
      actor_subject_id, work_unit_code, occurred_at, detail
    ) VALUES (
      '${submissionAuditId}'::uuid, 'PRODUCTION_RECORD', '${productionRecordId}',
      'PRODUCTION_RECORD_SUBMITTED', 'e2e-operator-one', 'E2E_QIQIHAR',
      TIMESTAMPTZ '2026-08-09 10:31:00+08',
      '{"source":"live-header-tools"}'::jsonb
    )
  `);

  await page.goto("/#/产情监测/玉米产情填报");
  const notificationButton = page.getByRole("button", { name: /^通知/u });
  await expect
    .poll(async () =>
      Number((await notificationButton.textContent())?.replace(/\D/gu, "")),
    )
    .toBeGreaterThan(0);
  const unreadBefore = Number(
    (await notificationButton.textContent())?.replace(/\D/gu, ""),
  );
  await notificationButton.click();

  const notificationPanel = page.getByRole("dialog", { name: "业务通知" });
  const notification = notificationPanel.getByRole("button", {
    name: /玉米产情记录已新建/u,
  });
  await expect(notification).toContainText("未读");
  await notification.click();

  await expect(page).toHaveURL(
    /#\/%E4%BA%A7%E6%83%85%E7%9B%91%E6%B5%8B\/%E7%8E%89%E7%B1%B3%E4%BA%A7%E6%83%85%E5%A1%AB%E6%8A%A5/u,
  );
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = window.history.state as {
          formalLocation?: { selection?: { type: string; id: string } };
        };
        return state.formalLocation?.selection;
      }),
    )
    .toEqual({ type: "document", id: productionRecordId });
  await expect
    .poll(() =>
      queryE2eDatabase(`
        SELECT count(*)
        FROM platform.notification_read_receipt
        WHERE event_id='${eventId}'::uuid
          AND subject_id='e2e-operator-one'
      `),
    )
    .toBe("1");
  await expect
    .poll(async () =>
      Number((await notificationButton.textContent())?.replace(/\D/gu, "")),
    )
    .toBe(unreadBefore - 1);

  await page.getByRole("button", { name: /^待办/u }).click();
  await expect(page).toHaveURL(
    /#\/%E6%88%91%E7%9A%84%E5%B7%A5%E4%BD%9C\/%E5%BE%85%E6%88%91%E5%A4%84%E7%90%86/u,
  );
  await expect(
    page.getByRole("heading", { name: "待我处理", exact: true }),
  ).toBeVisible();

  const operatorReviewItem = page
    .getByRole("row")
    .filter({ hasText: "玉米种植生产" })
    .filter({ has: page.getByRole("button", { name: "审核产情单据" }) });
  await expect(operatorReviewItem).toHaveCount(0);

  const reviewerContext = await browser.newContext();
  const reviewerPage = await reviewerContext.newPage();
  const reviewerErrors = trackBrowserErrors(reviewerPage);
  await reviewerPage.goto(
    `${liveBrowserAccounts.reviewer.url}/#/我的工作/待我处理`,
  );
  const sourceWorkItem = reviewerPage
    .getByRole("row")
    .filter({ hasText: "玉米种植生产" })
    .filter({
      has: reviewerPage.getByRole("button", { name: "审核产情单据" }),
    });
  await expect(sourceWorkItem).toHaveCount(1);
  await sourceWorkItem.getByRole("button", { name: "审核产情单据" }).click();
  const recordDialog = reviewerPage.getByRole("dialog", {
    name: "产情单据审核",
  });
  await expect(recordDialog).toBeVisible();
  await expect(recordDialog.getByLabel("调查日期")).toHaveValue("2026-08-09");
  await expect(recordDialog.getByLabel("种植面积")).toHaveValue("135.0000");
  await expect(recordDialog.getByLabel("调查日期")).toBeDisabled();
  await expect(
    recordDialog.getByRole("button", { name: "保存业务记录" }),
  ).toHaveCount(0);
  await expect(
    recordDialog.getByRole("button", { name: "审核通过" }),
  ).toBeVisible();
  await recordDialog.getByRole("button", { name: "审核通过" }).click();
  await expect(recordDialog).toHaveCount(0);
  await expect
    .poll(() =>
      queryE2eDatabase(`
        SELECT status_code
        FROM production.production_record
        WHERE record_id='${productionRecordId}'
      `),
    )
    .toBe("APPROVED");

  reviewerErrors.assertClean();
  await reviewerContext.close();

  await page.getByRole("button", { name: "帮助" }).click();
  const helpPanel = page.getByRole("dialog", { name: "当前页面帮助" });
  await expect(helpPanel).toContainText("我的工作 · 待我处理");
  await expect(helpPanel).toContainText("操作步骤");
  await expect(helpPanel).toContainText("权限与数据规则");
  await expect(helpPanel).toContainText("异常处理");
  await helpPanel.getByRole("button", { name: "×" }).click();
  await expect(helpPanel).toHaveCount(0);

  await expect(
    page.getByLabel(`当前用户：${liveBrowserAccounts.operatorOne.name}`),
  ).toBeVisible();
  await expect(page.getByRole("menu", { name: "个人账户菜单" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /账号安全|登录设备|退出登录/u }),
  ).toHaveCount(0);
});
