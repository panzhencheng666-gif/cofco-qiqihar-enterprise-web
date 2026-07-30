import { expect, test } from "@playwright/test";

test("task and review entries open the same canonical document", async ({
  page,
}) => {
  await page.goto("/market/tasks");
  await expect(
    page.getByRole("heading", { name: "市场监测 · 我的任务" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "打开单据" }).click();
  await expect(page).toHaveURL(
    /\/objects\/site-qqhr-001\/documents\/doc-market-20260730-001$/,
  );
  await expect(page.getByText("审核模式")).toBeVisible();
  await expect(page.getByText("实际收购价格")).toBeVisible();

  await page.goto("/review");
  await page.getByRole("button", { name: "进入审核" }).click();
  await expect(page).toHaveURL(
    /\/objects\/site-qqhr-001\/documents\/doc-market-20260730-001$/,
  );
});

test("approved navigation and safe module states remain visible", async ({
  page,
}) => {
  await page.goto("/");
  for (const label of [
    "经营总览",
    "产情监测",
    "市场监测",
    "供需平衡",
    "态势监控",
    "审核中心",
    "数据治理",
    "系统管理",
  ]) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  await page.getByText("态势监控", { exact: true }).click();
  await page.getByText("实时监控平台", { exact: true }).click();
  await expect(page.getByText("该能力尚未接入正式数据")).toBeVisible();
});

test("React 19 compatibility controls operate without static API failures", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/system/compatibility");
  const valueEditor = page.getByRole("spinbutton").first();
  await expect(valueEditor).toBeVisible();
  await valueEditor.fill("120.5");
  await page.getByRole("button", { name: "测试 Modal" }).click();
  await expect(
    page.getByRole("dialog", { name: "React 19 Modal" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /取\s*消/ }).click();
  await page.getByRole("button", { name: "测试 Drawer" }).click();
  await expect(page.getByText("React 19 Drawer")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "测试 Message" }).click();
  await expect(page.getByText("Message 正常")).toBeVisible();
  await page.getByRole("button", { name: "测试 Notification" }).click();
  await expect(page.getByText("Notification 正常")).toBeVisible();
  expect(browserErrors).toEqual([]);
});
