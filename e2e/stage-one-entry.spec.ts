import { expect, test } from "@playwright/test";

const forbiddenVisibleTerms =
  /prototype|demo|mock|codex|localhost|127\.0\.0\.1|64185|63200|原型|界面样板|测试账号|内部任务|端口|技术栈|React|Vite|Spring|PostgreSQL/iu;

test("serves only the canonical enterprise root without development semantics", async ({
  page,
  request,
}) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("齐齐哈尔粮食商情企业平台");
  await expect(page.locator("#enterprise-root")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(forbiddenVisibleTerms);

  const removedEntry = await request.get("/prototype.html");
  expect(removedEntry.status()).toBe(404);
});
