import { expect, test } from "@playwright/test";
import { resetControlledApi } from "./fixtures";

test("shows and switches business modules on a narrow screen", async ({
  page,
  request,
}) => {
  await resetControlledApi(request);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/市场监测/玉米市场采集");

  const toggle = page.getByRole("button", { name: "打开模块菜单" });
  const sidebar = page.locator("#mobile-business-modules");
  await expect(toggle).toBeVisible();
  await expect(sidebar).toBeHidden();

  await toggle.click();
  await expect(sidebar).toBeVisible();
  await sidebar.getByRole("button", { name: "供需平衡" }).click();

  await expect
    .poll(() => decodeURIComponent(new URL(page.url()).hash))
    .toBe("#/供需分析/供需平衡");
  await expect(sidebar).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await page.setViewportSize({ width: 680, height: 844 });
  await expect(toggle).toBeVisible();
  expect(
    await page
      .locator("html")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
});
