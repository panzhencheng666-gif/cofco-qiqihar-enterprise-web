import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const SMOKE_ROUTES = [
  { route: "/#/产情监测/产情分析", content: "产情分析" },
  { route: "/#/市场监测/市场分析", content: "市场分析" },
  { route: "/#/供需分析/供需平衡", content: "供需平衡" },
];

const BUSINESS_FAILURE =
  /业务数据读取失败|当前供需结果暂时无法读取|系统服务异常/u;
const TECHNICAL_LEAK =
  /8090|63182|后端端口|本地数据库|演示数据|VITE_|\bmock\b|\bdemo\b/iu;
const SETTLED_ANALYSIS = /数据截止：|当前范围暂无已审核|尚未填报地区产情/u;

export function assertSuccessfulNavigation(response, route) {
  if (response) {
    assert.equal(response.status(), 200, `${route} must return HTTP 200`);
  }
}

export function hasSettledAnalysisText(text) {
  return SETTLED_ANALYSIS.test(text);
}

async function runSmoke() {
  const baseUrl =
    process.env["COFCO_LOCAL_WEB_URL"] ?? "http://127.0.0.1:63182";
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const browserErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  try {
    for (const { route, content } of SMOKE_ROUTES) {
      const response = await page.goto(`${baseUrl}${route}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      assertSuccessfulNavigation(response, route);
      await page
        .waitForLoadState("networkidle", { timeout: 10_000 })
        .catch(() => {});
      const main = page.locator("main").first();
      await main.waitFor({ state: "visible", timeout: 15_000 });
      await page.waitForFunction(
        ({ expected, settledPattern }) => {
          const text =
            globalThis.document.querySelector("main")?.textContent ?? "";
          return (
            text.includes(expected) &&
            new RegExp(settledPattern, "u").test(text)
          );
        },
        { expected: content, settledPattern: SETTLED_ANALYSIS.source },
        { timeout: 15_000 },
      );
      const text = await main.innerText();
      assert.ok(
        text.length > 100,
        `${route} must render meaningful business content`,
      );
      assert.doesNotMatch(
        text,
        BUSINESS_FAILURE,
        `${route} exposes a business read failure`,
      );
      assert.doesNotMatch(
        text,
        TECHNICAL_LEAK,
        `${route} exposes technical runtime text`,
      );
      const layout = await page.evaluate(() => ({
        viewportWidth: globalThis.innerWidth,
        documentWidth: globalThis.document.documentElement.scrollWidth,
      }));
      assert.ok(
        layout.documentWidth <= layout.viewportWidth,
        `${route} has horizontal overflow: ${layout.documentWidth - layout.viewportWidth}px`,
      );
      console.log(
        `[OK] ${route} HTTP 200, meaningful DOM, no horizontal overflow`,
      );
    }
    assert.deepEqual(
      browserErrors,
      [],
      "browser console and page errors must be empty",
    );
  } finally {
    await context.close();
    await browser.close();
  }
}

const isDirectExecution =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectExecution) {
  await runSmoke();
}
