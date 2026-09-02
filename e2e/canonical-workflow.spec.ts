import {
  controlledApiBaseUrl,
  expect,
  resetControlledApi,
  setControlledApiMode,
  test,
} from "./fixtures";

test.beforeEach(async ({ request }) => {
  await resetControlledApi(request);
});

test("uses one unified existing-sample ledger and opens row-owned collection", async ({
  page,
  request,
}) => {
  await page.goto("/#/市场监测/玉米市场采集");

  await expect(
    page.getByRole("heading", { name: "采集台账", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("tablist", { name: "采集业务模式" })).toHaveCount(
    0,
  );
  await expect(page.getByText("已有样本数据更新", { exact: true })).toHaveCount(
    0,
  );

  const row = page.getByRole("row", { name: /龙江县粮食贸易样本一号/ });
  await expect(row).toContainText("贸易商");
  await expect(row.getByRole("button", { name: "查看" })).toBeVisible();
  await expect(row.getByRole("button", { name: "编辑" })).toBeVisible();
  await expect(row.getByRole("button", { name: "删除" })).toBeVisible();

  await row.getByRole("button", { name: "查看" }).click();
  await expect(
    page.getByRole("region", { name: "正式样本详情" }),
  ).toContainText("龙江县龙江镇通齐村");

  await row.getByRole("button", { name: "更新采集数据" }).click();
  await expect(
    page.getByRole("heading", { name: "填写或更新采集数据" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "本次正式观测" }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "已认证用户" })).toBeVisible();
  await page.getByLabel("采集对象收购价格（元/吨）").fill("2422.00");
  await page.getByRole("button", { name: "保存并正式入库" }).click();
  await expect(page.getByRole("status")).toContainText(
    "已正式入库，已实时联动总揽监测、市场分析、报表",
  );
  await expect(page.getByLabel("采集对象收购价格（元/吨）")).toHaveValue(
    "2422.00",
  );

  const stateResponse = await request.get(
    `${controlledApiBaseUrl}/__e2e/state`,
  );
  expect(stateResponse.ok()).toBe(true);
  const state = (await stateResponse.json()) as {
    data: { formalObservationReads: number; writes: readonly unknown[] };
  };
  expect(state.data.formalObservationReads).toBeGreaterThanOrEqual(5);
  expect(state.data.writes).toContainEqual(
    expect.objectContaining({
      action: "save-formal-sample-observation",
      idempotencyKey: expect.any(String),
      body: expect.objectContaining({
        domain: "MARKET",
        samplePointId: "E2E-FORMAL-SAMPLE-001",
        productCode: "CORN",
        payload: expect.objectContaining({
          coreValues: expect.objectContaining({
            MKT_PURCHASE_BASE_PRICE: "2422.00",
          }),
        }),
      }),
    }),
  );
  await expect(
    page.getByRole("button", { name: "返回采集台账" }),
  ).toBeVisible();
  await expect
    .poll(() => decodeURIComponent(new URL(page.url()).hash))
    .toBe("#/市场监测/玉米市场采集");
});

test("keeps an empty API store empty without loading browser fixtures", async ({
  page,
  request,
}) => {
  await setControlledApiMode(request, "empty");
  await page.goto("/#/市场监测/玉米市场采集");

  await expect(page.getByText("当前条件下没有正式样本。")).toBeVisible();
  await expect(page.getByText("服务端玉米市场采集任务")).toHaveCount(0);
  await expect(page.getByText("齐齐哈尔市玉米市场运行周填报")).toHaveCount(0);
});

test("fails closed when the API response contract fails", async ({
  page,
  request,
}) => {
  await setControlledApiMode(request, "failure");
  await page.goto("/#/市场监测/玉米市场采集");

  await expect(page.getByRole("alert", { name: "业务数据状态" })).toContainText(
    "业务数据读取失败",
  );
  await expect(
    page.getByRole("region", { name: "采集台账工作台" }).getByRole("status"),
  ).toContainText("服务端返回格式无效");
  await expect(page.getByText("服务端玉米市场采集任务")).toHaveCount(0);
  await expect(page.getByText("齐齐哈尔市玉米市场运行周填报")).toHaveCount(0);
});

test("keeps reports fail-closed when the report API is not implemented", async ({
  page,
  request,
}) => {
  const reportResponse = await request.get(
    `${controlledApiBaseUrl}/api/v1/reports`,
  );
  expect(reportResponse.status()).toBe(404);
  await expect(reportResponse.json()).resolves.toMatchObject({
    code: "API_ROUTE_NOT_IMPLEMENTED",
  });

  const storageKey = "齐齐哈尔粮食商情业务报告工作流-业务真值三";
  const storedSeed = JSON.stringify({
    title: "第31周粮食商情周报",
    source: "browser-fixture",
  });
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: storageKey, value: storedSeed },
  );
  await page.goto("/#/报表中心/业务报告");

  await expect(
    page.getByRole("heading", { name: "业务报告", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("第31周粮食商情周报")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "生成报告预览" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: /导出当前报告/ })).toHaveCount(
    0,
  );

  await page
    .getByRole("searchbox", { name: "全局搜索" })
    .fill("齐齐哈尔市全域玉米供需平衡分析报告");
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(0);
  await expect(page.getByText("未找到匹配的业务页面")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate((key) => window.localStorage.getItem(key), storageKey),
    )
    .toBe(storedSeed);
});

test("canonicalizes invalid routes without exposing injected identifiers", async ({
  page,
}) => {
  await page.goto("/#/不存在的模块/INTERNAL-001");

  await expect(
    page.getByRole("heading", { name: "采集台账", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /龙江县粮食贸易样本一号/ }),
  ).toBeVisible();
  await expect
    .poll(() => decodeURIComponent(new URL(page.url()).hash))
    .toBe("#/市场监测/玉米市场采集");
  await expect(page.getByText("INTERNAL-001", { exact: false })).toHaveCount(0);
});

test("uses the minimal API session view and keeps page navigation operable", async ({
  page,
}) => {
  await page.goto("/#/市场监测/玉米市场采集");
  await expect(page.getByLabel("当前用户：已认证用户")).toBeVisible();
  await expect(page.getByRole("button", { name: "系统设置" })).toHaveCount(0);
  await expect(page.getByText("王洋", { exact: false })).toHaveCount(0);

  const navigation = page.getByRole("navigation", { name: "业务应用" });
  const production = navigation.getByRole("button", {
    name: "产情监测",
    exact: true,
  });
  await production.click();
  await expect
    .poll(() => decodeURIComponent(new URL(page.url()).hash))
    .toBe("#/产情监测/玉米产情填报");
  await expect(production).toHaveAttribute("aria-current", "page");
});
