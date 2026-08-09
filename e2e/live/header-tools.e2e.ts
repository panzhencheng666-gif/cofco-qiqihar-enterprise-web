import { randomUUID } from "node:crypto";

import {
  expect,
  liveBrowserAccounts,
  queryE2eDatabase,
  test,
} from "./fixtures";

test("uses durable notifications, business deep links, work navigation, and page help", async ({
  page,
}) => {
  const eventId = randomUUID();
  const aggregateId = randomUUID();
  queryE2eDatabase(`
    INSERT INTO platform.business_event_outbox(
      event_id, aggregate_type, aggregate_id, action_code,
      actor_subject_id, work_unit_code, region_codes, product_code,
      occurred_at, detail
    ) VALUES (
      '${eventId}'::uuid, 'PRODUCTION_RECORD', '${aggregateId}',
      'PRODUCTION_RECORD_CREATED', 'e2e-operator-two', 'E2E_QIQIHAR',
      ARRAY['230208101001'], 'CORN', now(),
      '{"source":"live-header-tools"}'::jsonb
    )
  `);

  await page.goto("/#/产情监测/玉米产情填报");
  const notificationButton = page.getByRole("button", { name: /^通知/u });
  await expect(notificationButton).toContainText("1");
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
    .toEqual({ type: "document", id: aggregateId });
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
  await expect(notificationButton).toContainText("0");

  await page.getByRole("button", { name: /^待办/u }).click();
  await expect(page).toHaveURL(
    /#\/%E6%88%91%E7%9A%84%E5%B7%A5%E4%BD%9C\/%E5%BE%85%E6%88%91%E5%A4%84%E7%90%86/u,
  );
  await expect(
    page.getByRole("heading", { name: "待我处理", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "帮助" }).click();
  const helpPanel = page.getByRole("dialog", { name: "当前页面帮助" });
  await expect(helpPanel).toContainText("我的工作");
  await expect(helpPanel).toContainText(/选择地区、品种和时间/u);
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
