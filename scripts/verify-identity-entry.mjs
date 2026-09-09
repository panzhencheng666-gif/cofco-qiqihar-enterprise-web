import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const origin = process.argv[2];
if (
  !origin ||
  new URL(origin).protocol !== "https:" ||
  new URL(origin).origin !== origin
) {
  throw new Error(
    "Usage: node scripts/verify-identity-entry.mjs https://host:port (explicit HTTPS origin, no trailing slash)",
  );
}
const evidence = process.env.IDENTITY_ENTRY_EVIDENCE_DIR;
if (evidence) fs.mkdirSync(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const size of [
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport: size });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && !m.text().includes("401"))
        errors.push(m.text());
    });
    await page.goto(origin);
    await page.getByRole("link", { name: "进入统一身份认证" }).click();
    await expect(page.locator("#kc-form-login")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "短信验证码", exact: true }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText("无效的参数");
    if (evidence)
      await page.screenshot({
        path: `${evidence}/login-password-${size.width}.png`,
        fullPage: true,
      });
    await page.getByRole("link", { name: "短信验证码", exact: true }).click();
    await expect(page).toHaveURL(origin + "/phone.html");
    await expect(page.locator("#phone")).toBeVisible();
    await expect(page.locator("#modeLabel")).toBeHidden();
    if (evidence)
      await page.screenshot({
        path: `${evidence}/login-sms-${size.width}.png`,
        fullPage: true,
      });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw new Error("Mobile overflow");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(page).toHaveURL(origin + "/phone.html");
    await page.getByRole("link", { name: "员工注册", exact: true }).click();
    await expect(page.locator("#kc-register-form")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      "第一步：创建登录账号",
    );
    if (evidence)
      await page.screenshot({
        path: `${evidence}/employee-register-${size.width}.png`,
        fullPage: true,
      });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw new Error("Registration overflow");
    await page.goto(origin + "/register.html");
    await expect(page.locator("#kc-register-form")).toBeVisible();
    for (let repeat = 0; repeat < 3; repeat++) {
      await page.goto(origin + "/oauth2/authorization/enterprise");
      await expect(page.locator("#kc-form-login")).toBeVisible();
      await page.reload();
      await expect(page.locator("#kc-form-login")).toBeVisible();
    }
    results.push({
      viewport: size,
      identity: true,
      nonblank: true,
      forms: true,
      registerDirect: true,
      repeatedLogin: 3,
      consoleErrors: errors,
    });
    if (errors.length) throw new Error(JSON.stringify(errors));
    await context.close();
  }
  if (evidence)
    fs.writeFileSync(
      `${evidence}/entry-browser-results.json`,
      JSON.stringify(results, null, 2),
    );
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
