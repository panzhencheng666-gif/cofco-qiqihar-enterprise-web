import { expect, liveBrowserAccounts, test } from "./fixtures";

test("loads five real employee sessions spanning four business roles", async ({
  browser,
}) => {
  for (const account of Object.values(liveBrowserAccounts)) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${account.url}/#/市场监测/玉米市场采集`);
    await expect(page.getByLabel(`当前用户：${account.name}`)).toBeVisible();
    await context.close();
  }
});
