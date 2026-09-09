import { chromium, expect } from "@playwright/test";
const origin = process.argv[2];
if (
  !origin ||
  new URL(origin).origin !== origin ||
  !origin.startsWith("https://")
)
  throw new Error("Provide explicit HTTPS origin");
const browser = await chromium.launch();
try {
  const p = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(origin + "/oauth2/authorization/enterprise");
  await expect(p.locator("#kc-form-login")).toBeVisible();
  await p.locator("#cofco-sms-tab").click();
  await expect(p.locator("#cofco-sms-login")).toBeVisible();
  await expect(p.locator("#kc-form-login")).toBeHidden();
  await p.locator("#cofco-password-tab").click();
  await expect(p.locator("#kc-form-login")).toBeVisible();
  await p.goto(origin + "/register.html");
  await expect(p.locator("#kc-register-form")).toBeVisible();
  await expect(p.locator("#cofco-unit")).toBeEnabled({ timeout: 15000 });
  const units = await p.locator("#cofco-unit option").count();
  const regions = await p.locator("#cofco-regions option").count();
  console.log(
    JSON.stringify({
      units,
      regions,
      error: await p.locator("#cofco-entry-error").textContent(),
      pageErrors: errors,
    }),
  );
  if (units !== 6 || regions < 1)
    throw new Error("Registration catalog is incomplete");
  const unitNames = await p.locator("#cofco-unit option").allTextContents();
  expect(unitNames).toEqual([
    "齐齐哈尔经营部",
    "讷河库",
    "克山库",
    "克东库",
    "龙镇库",
    "成吉思汗库",
  ]);
  expect(await p.locator("#cofco-regions").evaluate((el) => el.multiple)).toBe(
    false,
  );
  const catalog = await p.evaluate(
    async (origin) =>
      (
        await (
          await fetch(
            origin +
              "/api/v1/identity/registration-entry/options?workUnitCode=QIQIHAR_BUSINESS",
            { credentials: "include" },
          )
        ).json()
      ).data,
    origin,
  );
  expect(catalog.regions.length).toBeGreaterThan(0);
  expect(
    catalog.regions.every((r) => r.administrativeLevel === "TOWNSHIP"),
  ).toBe(true);
  await p.locator("#cofco-regions").selectOption(catalog.regions[0].code);
  await p.locator("#cofco-regions").selectOption(catalog.regions[1].code);
  expect(
    await p
      .locator("#cofco-regions")
      .evaluate((el) => Array.from(el.selectedOptions).map((o) => o.value)),
  ).toEqual([catalog.regions[1].code]);
  await p.locator("#cofco-unit").selectOption("NEHE_DEPOT");
  await expect(p.locator("#cofco-regions")).toBeEnabled();
  await expect(p.locator("#cofco-regions")).toHaveValue("");
  await p.screenshot({
    path:
      process.env.REGISTRATION_SCREENSHOT ||
      "/tmp/cofco-township-registration.png",
    fullPage: true,
  });
  await expect(p.locator('[name="phone_number"]')).toBeVisible();
  await expect(p.locator("#password")).toBeVisible();
  await p.setViewportSize({ width: 390, height: 844 });
  if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    throw new Error("Mobile overflow");
  const csrf = await p.evaluate(async (origin) => {
    const r = await fetch(
      origin + "/api/v1/identity/registration-entry/draft",
      {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    );
    return r.status;
  }, origin);
  if (![401, 403].includes(csrf))
    throw new Error("Missing CSRF not rejected: " + csrf);
  console.log(
    "Combined login, direct complete registration, catalog, mobile, and CSRF verified",
  );
} finally {
  await browser.close();
}
