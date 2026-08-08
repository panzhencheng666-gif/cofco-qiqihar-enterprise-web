import { expect, test, type Page } from "@playwright/test";

async function openCanonicalMarketTask(page: Page, workView: string) {
  await page.goto(`/#/我的工作/${workView}`);
  await expect(
    page.getByRole("heading", { name: workView, exact: true }),
  ).toBeVisible();
  const task = page.getByRole("row", {
    name: /齐齐哈尔市玉米市场运行周填报/,
  });
  await expect(task).toBeVisible();
  await task.getByRole("button", { name: "处理市场任务" }).click();
  await expect(
    page.getByRole("heading", {
      name: "龙江县玉米贸易监测组第 31 周市场监测单",
    }),
  ).toBeVisible();
  return page.evaluate(() => ({
    hash: decodeURIComponent(window.location.hash),
    selection: (
      window.history.state as {
        formalLocation?: { selection?: { type: string; id: string } };
      } | null
    )?.formalLocation?.selection,
  }));
}

test("task and review entries open the same canonical business item", async ({
  page,
}) => {
  const taskEntry = await openCanonicalMarketTask(page, "待我处理");
  const reviewEntry = await openCanonicalMarketTask(page, "待我审核");

  expect(taskEntry).toEqual({
    hash: "#/市场监测/采集任务",
    selection: { type: "work-item", id: "WORK-MARKET-FILL-W31" },
  });
  expect(reviewEntry).toEqual(taskEntry);
});

test("approved business navigation and safe incomplete states remain visible", async ({
  page,
}) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "业务应用" });
  const entries = [
    ["产情监测", "#/产情监测/玉米产情填报"],
    ["市场监测", "#/市场监测/玉米市场采集"],
    ["物流监测", "#/市场监测/物流节点监测"],
    ["供需分析", "#/供需分析/玉米供需平衡"],
    ["报表中心", "#/报表中心/业务报告"],
    ["我的工作", "#/我的工作/待我处理"],
  ] as const;

  for (const [label, expectedHash] of entries) {
    const entry = navigation.getByRole("button", { name: label, exact: true });
    await expect(entry).toBeVisible();
    await entry.click();
    await expect
      .poll(() => decodeURIComponent(new URL(page.url()).hash))
      .toBe(expectedHash);
    await expect(entry).toHaveAttribute("aria-current", "page");
  }

  await navigation
    .getByRole("button", { name: "供需分析", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "区域粮食供需平衡表" }),
  ).toBeVisible();
  await expect(page.getByText("请完成全部查询条件后查询")).toBeVisible();
});

test("invalid routes and injected identifiers are canonicalized safely", async ({
  page,
}) => {
  await page.goto("/#/不存在的模块/INTERNAL-001");

  await expect(
    page.getByRole("heading", { name: "待我处理", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => decodeURIComponent(new URL(page.url()).hash))
    .toBe("#/我的工作/待我处理");
  await expect(page.getByText("INTERNAL-001", { exact: false })).toHaveCount(0);
  const location = await page.evaluate(
    () =>
      (
        window.history.state as {
          formalLocation?: {
            route: { application: string; section: string };
            selection?: unknown;
          };
        } | null
      )?.formalLocation,
  );
  expect(location).toEqual({
    route: { application: "work", section: "tasks" },
    coordinates: { regionId: "authorized-all" },
  });
});

test("formal controls operate without browser runtime failures", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/#/市场监测/玉米市场采集");
  await expect(
    page.getByRole("heading", { name: "玉米市场采集表" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "对象类型" })
    .selectOption({ label: "贸易商" });
  await page.getByLabel("采集日期").fill("2026-07-30");
  await page.getByRole("button", { name: "查询", exact: true }).click();
  await expect(
    page.getByRole("table", { name: "玉米市场采集表" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "系统设置" }).click();
  const settings = page.getByRole("dialog", { name: "系统设置" });
  await expect(settings).toContainText("仅授权管理员可以维护系统公共配置");
  await settings.getByRole("button", { name: "×" }).click();

  await page.getByRole("button", { name: "个人账户：王洋" }).click();
  const accountMenu = page.getByRole("menu", { name: "个人账户菜单" });
  await expect(accountMenu).toBeVisible();
  await accountMenu.getByRole("menuitem", { name: "个人中心" }).click();
  await expect(page.getByRole("dialog", { name: "个人中心" })).toContainText(
    "当前账号：王洋",
  );
  await page.keyboard.press("Escape");

  await page.getByRole("searchbox", { name: "全局搜索" }).fill("玉米供需平衡");
  await page.getByRole("option", { name: /供需分析 · 玉米供需平衡/ }).click();
  await expect(
    page.getByRole("heading", { name: "区域粮食供需平衡表" }),
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
});
