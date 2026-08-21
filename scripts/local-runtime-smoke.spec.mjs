import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const moduleUrl = pathToFileURL(
  join(import.meta.dirname, "local-runtime-smoke.mjs"),
).href;

test("defines the three read-only business analysis smoke routes", async () => {
  const smokeModule = await import(moduleUrl).catch(() => null);
  assert.notEqual(smokeModule, null, "the browser smoke module must exist");
  assert.deepEqual(smokeModule.SMOKE_ROUTES, [
    { route: "/#/产情监测/产情分析", content: "产情分析" },
    { route: "/#/市场监测/市场分析", content: "市场分析" },
    { route: "/#/供需分析/供需平衡", content: "供需平衡" },
  ]);
});

test("accepts hash-only navigation without a second document response", async () => {
  const smokeModule = await import(moduleUrl);
  assert.doesNotThrow(() =>
    smokeModule.assertSuccessfulNavigation(undefined, "/#/市场监测/市场分析"),
  );
  assert.throws(
    () =>
      smokeModule.assertSuccessfulNavigation(
        { status: () => 503 },
        "/#/市场监测/市场分析",
      ),
    /must return HTTP 200/u,
  );
});

test("waits for an analysis result or explicit approved-data gap", async () => {
  const smokeModule = await import(moduleUrl);
  assert.equal(smokeModule.hasSettledAnalysisText("市场分析 正在读取"), false);
  assert.equal(
    smokeModule.hasSettledAnalysisText("市场分析 数据截止：2026/08/21"),
    true,
  );
  assert.equal(
    smokeModule.hasSettledAnalysisText(
      "当前范围暂无已审核的市场或物流分析数据。",
    ),
    true,
  );
});
