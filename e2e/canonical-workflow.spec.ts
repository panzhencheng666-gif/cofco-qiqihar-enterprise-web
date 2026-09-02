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
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/#/市场监测/玉米市场采集");

  await expect(
    page.getByRole("heading", { name: "玉米市场采集表", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("tablist", { name: "采集业务模式" })).toHaveCount(
    0,
  );
  await expect(page.getByText("已有样本数据更新", { exact: true })).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: "维护样本与期间数据" }).click();
  const ledger = page.getByRole("region", { name: "采集台账工作台" });
  await expect(
    ledger.getByRole("heading", { name: "采集台账", exact: true }),
  ).toBeVisible();
  const filters = ledger.getByRole("search");
  const filterControls = filters.locator("input, select, button");
  expect(
    await filterControls.evaluateAll((elements) =>
      elements.map((element) =>
        Math.round(element.getBoundingClientRect().height),
      ),
    ),
  ).toEqual([36, 36, 36, 36, 36]);
  const [ledgerWidth, tableWidth] = await Promise.all([
    ledger.evaluate((element) => element.getBoundingClientRect().width),
    ledger
      .locator(".formal-sample-ledger__table")
      .evaluate((element) => element.getBoundingClientRect().width),
  ]);
  expect(tableWidth / ledgerWidth).toBeGreaterThan(0.95);

  const row = page.getByRole("row", { name: /龙江县粮食贸易样本一号/ });
  await expect(row).toContainText("贸易商");
  await expect(row.getByRole("button", { name: "查看" })).toBeVisible();
  await expect(row.getByRole("button", { name: "编辑" })).toBeVisible();
  await expect(row.getByRole("button", { name: "删除" })).toBeVisible();
  expect(
    await row
      .locator("button")
      .evaluateAll(
        (buttons) =>
          new Set(
            buttons.map((button) =>
              Math.round(button.getBoundingClientRect().top),
            ),
          ).size,
      ),
  ).toBe(1);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await ledger.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  expect(
    await filterControls.evaluateAll((elements) =>
      elements.map((element) =>
        Math.round(element.getBoundingClientRect().height),
      ),
    ),
  ).toEqual([36, 36, 36, 36, 36]);
  await page.setViewportSize({ width: 1600, height: 900 });

  await row.getByRole("button", { name: "查看" }).click();
  await expect(
    page.getByRole("region", { name: "正式样本详情" }),
  ).toContainText("龙江县龙江镇通齐村");

  await page.getByRole("button", { name: "返回正式样本台账" }).click();
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
    "已正式入库，已实时联动总揽监测、市场分析",
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

test("retires review and report routes while keeping design samples reachable", async ({
  page,
}) => {
  const retiredRoutes = [
    ["#/产情监测/数据审核", "#/产情监测/玉米产情填报"],
    ["#/市场监测/数据审核", "#/市场监测/玉米市场采集"],
    ["#/报表中心/报告审核与发布", "#/市场监测/玉米市场采集"],
    ["#/报表中心/报告台账", "#/市场监测/玉米市场采集"],
  ] as const;

  for (const [hash, destination] of retiredRoutes) {
    await page.goto(`/${hash}`);
    await expect
      .poll(() => decodeURIComponent(new URL(page.url()).hash))
      .toBe(destination);
    await expect(page.getByText("报表中心", { exact: true })).toHaveCount(0);
    await expect(page.getByText("数据审核", { exact: true })).toHaveCount(0);
  }

  await page.goto("/#/我的工作/样本点管理");
  await expect(page.getByText("设计样本点", { exact: true })).toBeVisible();

  for (const retiredHash of [
    "#/我的工作/人工审核",
    "#/我的工作/待我处理",
    "#/我的工作/已办事项",
    "#/我的工作/记录",
  ]) {
    await page.goto(`/${retiredHash}`);
    await expect
      .poll(() => decodeURIComponent(new URL(page.url()).hash))
      .toBe("#/市场监测/玉米市场采集");
    await expect(page.getByText("待我处理", { exact: true })).toHaveCount(0);
    await expect(page.getByText("已办事项", { exact: true })).toHaveCount(0);
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
  ).toEqual([36, 36, 36, 36]);

  await filters
    .getByRole("searchbox", { name: "搜索点位或行政区" })
    .fill("受控设计参考点");
  await filters.getByRole("button", { name: "查询" }).click();
  await expect(
    page.getByText("共 1 个参考点，当前显示 1 个"),
  ).toBeVisible();
  await expect(page.getByText("第 1 页")).toBeVisible();
  await filters.getByRole("button", { name: "清除筛选" }).click();

  await page.getByRole("button", { name: "新建设计参考点" }).click();
  const editor = page.getByRole("form", { name: "新建设计参考点" });
  await editor.getByLabel("点位名称").fill("受控新增设计点");
  await editor.getByLabel("行政区").selectOption("230221101001");
  await editor.getByLabel("详细地址").fill("龙江镇通齐村兴农路2号");
  await editor.getByLabel("经度").fill("123.9001");
  await editor.getByLabel("纬度").fill("47.3001");
  await editor.getByRole("button", { name: "保存" }).click();
  const createdDetail = page.getByRole("region", { name: "设计参考点详情" });
  await expect(createdDetail).toContainText("受控新增设计点");

  await createdDetail.getByRole("button", { name: "编辑" }).click();
  const editForm = page.getByRole("form", { name: "编辑设计参考点" });
  await editForm.getByLabel("点位名称").fill("受控更新设计点");
  await editForm.getByRole("button", { name: "保存" }).click();
  await expect(createdDetail).toContainText("受控更新设计点");
  await createdDetail.getByRole("button", { name: "返回设计样本台账" }).click();
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
  ).toEqual([36, 36, 36, 36]);

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

  await expect(page.getByText("当前范围暂无玉米市场采集记录")).toBeVisible();
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
  await expect(page.getByText("服务端玉米市场采集任务")).toHaveCount(0);
  await expect(page.getByText("齐齐哈尔市玉米市场运行周填报")).toHaveCount(0);
});

test("canonicalizes invalid routes without exposing injected identifiers", async ({
  page,
}) => {
  await page.goto("/#/不存在的模块/INTERNAL-001");

  await expect(
    page.getByRole("heading", { name: "玉米市场采集表", exact: true }),
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
