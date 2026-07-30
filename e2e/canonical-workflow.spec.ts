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

test("cross-object document coordinates are blocked safely", async ({
  page,
}) => {
  await page.goto("/objects/farmer-neh-017/documents/doc-market-20260730-001");
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("对象与业务单据坐标不一致");
  await expect(alert).toContainText("未修改任何业务数据");
  await expect(page.getByText("实际收购价格")).not.toBeVisible();
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

  await page.getByLabel("企业简称").fill("齐齐哈尔兼容样本企业");
  await page.getByLabel("主要能力").click();
  await page
    .locator(".ant-select-dropdown:visible")
    .getByText("贸易", { exact: true })
    .click();
  await page.getByRole("button", { name: "验证企业表单" }).click();
  await expect(page.getByText("企业表单验证通过")).toBeVisible();

  const themePreview = page.getByRole("region", { name: "主题兼容预览" });
  await expect(themePreview).toHaveAttribute("data-theme", "light");
  await page.getByRole("switch", { name: "暗色模式" }).click();
  await expect(themePreview).toHaveAttribute("data-theme", "dark");

  const virtualTable = page.getByRole("region", { name: "虚拟滚动表格" });
  await expect(virtualTable.getByText("120 条模拟记录")).toBeVisible();
  await virtualTable
    .locator(".ant-table-tbody-virtual-holder")
    .evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll"));
    });
  await expect(virtualTable.getByText("兼容样本 120")).toBeVisible();

  await page.getByRole("button", { name: "测试 Modal" }).click();
  await expect(
    page.getByRole("dialog", { name: "React 19 Modal" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /取\s*消/ }).click();
  await page.getByRole("button", { name: "测试 Drawer" }).click();
  await expect(page.getByText("React 19 Drawer")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "测试 Message" }).click();
  await expect(page.getByText("Message 正常")).toBeVisible();
  await page.getByRole("button", { name: "测试 Notification" }).click();
  await expect(page.getByText("Notification 正常")).toBeVisible();
  expect(browserErrors).toEqual([]);
});
