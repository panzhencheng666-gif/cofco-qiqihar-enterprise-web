import { chromium, expect } from "@playwright/test";
const origin = process.argv[2];
if (
  !origin ||
  new URL(origin).origin !== origin ||
  !origin.startsWith("https://")
)
  throw new Error("Provide an explicit HTTPS origin");
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  let registered = false;
  let units = [];
  let regions = [];
  await page.route("**/api/v1/identity/registration/phone", (route) =>
    route.fulfill({ json: { data: { phone: "", registered } } }),
  );
  await page.route("**/api/v1/identity/registration/options?*", (route) =>
    route.fulfill({
      json: { data: { workUnits: units, positions: [], regions } },
    }),
  );
  await page.goto(origin + "/register.html");
  await expect(page.locator("#catalogStatus")).toContainText(
    "暂无可用工作单位",
  );
  await expect(page.locator("#sendSms")).toBeDisabled();
  await expect(page.locator("#submit")).toBeDisabled();
  units = [{ code: "QIQIHAR_BUSINESS", name: "齐齐哈尔经营部" }];
  await page.locator("#retryOptions").click();
  await expect(page.locator("#catalogStatus")).toContainText(
    "暂无可选授权地区",
  );
  await expect(page.locator("#sendSms")).toBeDisabled();
  regions = [{ code: "230202101", name: "测试乡镇" }];
  await page.locator("#name").fill("保留已填写资料");
  await page.locator("#retryOptions").click();
  await expect(page.locator("#regions option")).toHaveCount(1);
  await expect(page.locator("#name")).toHaveValue("保留已填写资料");
  await expect(page.locator("#sendSms")).toBeEnabled();
  await page.route(origin + "/", (route) =>
    route.fulfill({ contentType: "text/html", body: "<h1>系统首页</h1>" }),
  );
  registered = true;
  await page.goto(origin + "/register.html");
  await expect(page).toHaveURL(origin + "/");
  console.log(
    "PASS: empty catalogs block SMS; retry preserves input; established accounts skip employee enrollment.",
  );
} finally {
  await browser.close();
}
