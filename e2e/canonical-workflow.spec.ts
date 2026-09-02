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

test("uses one unified existing-sample ledger and persists row-owned collection", async ({
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
  await page.getByLabel("采集对象收购价格（元/吨）").fill("2422.00");
  await page.getByRole("button", { name: "保存并正式入库" }).click();
  await expect(page.getByRole("status")).toContainText(
    "已正式入库，已实时联动总揽监测、市场分析、报表",
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
});

test("keeps review, report, and design-sample routes reachable", async ({
  page,
}) => {
  const routes = [
    ["#/产情监测/数据审核", "本期工作队列"],
    ["#/市场监测/数据审核", "市场工作队列"],
    ["#/报表中心/报告审核与发布", "报表中心"],
    ["#/报表中心/报告台账", "报表中心"],
    ["#/我的工作/样本点管理", "设计样本点"],
  ] as const;

  for (const [hash, visibleText] of routes) {
    await page.goto(`/${hash}`);
    await expect(
      page.getByText(visibleText, { exact: false }).first(),
    ).toBeVisible();
    await expect
      .poll(() => decodeURIComponent(new URL(page.url()).hash))
      .toBe(hash);
  }

  for (const retiredHash of [
    "#/我的工作/人工审核",
    "#/我的工作/待我处理",
    "#/我的工作/已办事项",
    "#/我的工作/导入任务",
  ]) {
    await page.goto(`/${retiredHash}`);
    await expect
      .poll(() => decodeURIComponent(new URL(page.url()).hash))
      .toBe("#/市场监测/玉米市场采集");
    await expect(page.getByText("待我处理", { exact: true })).toHaveCount(0);
    await expect(page.getByText("已办事项", { exact: true })).toHaveCount(0);
    await expect(page.getByText("导入任务", { exact: true })).toHaveCount(0);
  }
});

test("keeps design-sample filters aligned and persists controlled CRUD", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/我的工作/样本点管理");

  const filters = page.getByRole("search", { name: "设计参考点筛选" });
  const controls = filters.locator("input, select, button");
  await expect(page.getByText("受控设计参考点", { exact: true })).toBeVisible();
  expect(
    await controls.evaluateAll((elements) =>
      elements.map((element) =>
        Math.round(element.getBoundingClientRect().height),
      ),
    ),
  ).toEqual([40, 40, 40, 40, 40, 40, 40]);

  await filters
    .getByRole("searchbox", { name: "搜索点位或行政区" })
    .fill("受控设计参考点");
  await filters.getByRole("button", { name: "查询" }).click();
  await expect(page.getByText("共 1 条 · 第 1 / 1 页")).toBeVisible();
  await filters.getByRole("button", { name: "清除筛选" }).click();

  await page.getByRole("button", { name: "新建设计参考点" }).click();
  const editor = page.getByRole("form", { name: "新建设计参考点" });
  await editor.getByLabel("点位名称").fill("受控新增设计点");
  await editor.getByLabel("行政区").selectOption("230221101001");
  await editor.getByLabel("经度").fill("123.9001");
  await editor.getByLabel("纬度").fill("47.3001");
  await editor.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("受控新增设计点", { exact: true })).toBeVisible();

  const createdRow = page.getByRole("row", { name: /受控新增设计点/ });
  await createdRow.getByRole("button", { name: "编辑受控新增设计点" }).click();
  const editForm = page.getByRole("form", { name: "编辑设计参考点" });
  await editForm.getByLabel("点位名称").fill("受控更新设计点");
  await editForm.getByRole("button", { name: "保存" }).click();
  const updatedRow = page.getByRole("row", { name: /受控更新设计点/ });
  await expect(updatedRow).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  await updatedRow.getByRole("button", { name: "删除受控更新设计点" }).click();
  await expect(page.getByText("受控更新设计点", { exact: true })).toHaveCount(
    0,
  );

  await page.setViewportSize({ width: 720, height: 900 });
  expect(
    await filters.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  expect(
    await controls.evaluateAll((elements) =>
      elements.map((element) =>
        Math.round(element.getBoundingClientRect().height),
      ),
    ),
  ).toEqual([40, 40, 40, 40, 40, 40, 40]);

  const beforeEventResponse = await request.get(
    `${controlledApiBaseUrl}/__e2e/state`,
  );
  const beforeEvent = (await beforeEventResponse.json()) as {
    data: { designSampleReads: number };
  };
  const eventResponse = await request.post(
    `${controlledApiBaseUrl}/__e2e/event`,
    {
      data: {
        id: "E2E-DESIGN-EVENT-1",
        sequence: 901,
        aggregateType: "DESIGN_SAMPLE_POINT",
        aggregateId: "E2E-DESIGN-SAMPLE-001",
        actionCode: "DESIGN_SAMPLE_POINT_UPDATED",
        productCode: "CORN",
        surveyYear: null,
        regionCodes: ["230200"],
        occurredAt: "2026-09-02T02:00:00Z",
        read: false,
      },
    },
  );
  expect(eventResponse.ok()).toBe(true);
  await expect
    .poll(async () => {
      const response = await request.get(`${controlledApiBaseUrl}/__e2e/state`);
      const current = (await response.json()) as {
        data: { designSampleReads: number };
      };
      return current.data.designSampleReads;
    })
    .toBeGreaterThan(beforeEvent.data.designSampleReads);

  const state = await request.get(`${controlledApiBaseUrl}/__e2e/state`);
  const payload = (await state.json()) as {
    data: { writes: readonly { action: string }[] };
  };
  expect(payload.data.writes.map(({ action }) => action)).toEqual(
    expect.arrayContaining([
      "create-design-sample-point",
      "update-design-sample-point",
      "delete-design-sample-point",
    ]),
  );
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
