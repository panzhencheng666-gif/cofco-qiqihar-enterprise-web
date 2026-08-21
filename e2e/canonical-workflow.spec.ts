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

test("reads service-owned work and opens its canonical business route", async ({
  page,
}) => {
  await page.goto("/#/我的工作/待我处理");

  const task = page.getByRole("row", { name: /服务端玉米市场采集任务/ });
  await expect(task).toBeVisible();
  await task.getByRole("button", { name: "继续市场填报" }).click();
  await expect
    .poll(() => decodeURIComponent(new URL(page.url()).hash))
    .toBe("#/我的工作/待我处理");
  const dialog = page.getByRole("dialog", { name: "补充市场填报" });
  await expect(
    dialog.getByRole("heading", { name: "市场采集", exact: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel("采集对象收购价格")).toHaveValue("2410.00");
  await expect(dialog.getByLabel("采集对象销售价格")).toHaveValue("2430.00");
  await expect(
    dialog.getByRole("button", { name: "保存业务记录" }),
  ).toBeVisible();
  await expect(dialog.getByText("新建填报", { exact: true })).toHaveCount(0);

  const location = await page.evaluate(
    () =>
      (
        window.history.state as {
          formalLocation?: { selection?: { type: string; id: string } };
        } | null
      )?.formalLocation,
  );
  expect(location?.selection).toEqual({
    type: "work-item",
    id: "E2E-WORK-MARKET-001",
  });
});

test("persists a market record and returns to its service-owned list", async ({
  page,
  request,
}) => {
  await page.goto("/#/市场监测/玉米市场采集");
  await expect(
    page.getByRole("table", { name: "玉米市场采集表" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog", { name: "新建市场填报" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "新建采集记录" }).click();

  const dialog = page.getByRole("dialog", { name: "新建市场填报" });
  const panel = dialog.getByRole("region", { name: "市场采集" });
  await expect(panel.getByText("已加载业务填报规则")).toBeVisible();
  await panel.getByRole("combobox", { name: "数据年份" }).selectOption("2026");
  await panel.getByRole("combobox", { name: "数据月份" }).selectOption("8");
  await panel
    .getByRole("combobox", { name: "样本点类型" })
    .selectOption("TRADER");
  await panel.getByRole("combobox", { name: "地级市" }).selectOption("230200");
  await panel.getByRole("combobox", { name: "区县" }).selectOption("230221");
  await panel.getByRole("combobox", { name: "乡镇" }).selectOption("230221101");
  await panel
    .getByRole("combobox", { name: "行政村" })
    .selectOption("230221101001");
  await panel.getByLabel("采集对象收购价格").fill("2418.50");
  await panel.getByLabel("采集对象销售价格").fill("2438.50");
  await panel.getByLabel("现场水印照片").setInputFiles({
    name: "market-scene.png",
    mimeType: "image/png",
    buffer: Buffer.from([137, 80, 78, 71]),
  });
  await panel.getByRole("button", { name: "保存业务记录" }).click();
  await expect(
    page.getByRole("table", { name: "玉米市场采集表" }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: "玉米市场采集表" }).getByText("2418.50"),
  ).toBeVisible();
  await expect(page.getByRole("dialog", { name: "新建市场填报" })).toHaveCount(
    0,
  );

  const response = await request.get(`${controlledApiBaseUrl}/__e2e/state`);
  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as {
    data: {
      actorHeaders: Array<string | null>;
      writes: Array<{ action: string; body: unknown }>;
    };
  };
  expect(payload.data.writes.map(({ action }) => action)).toEqual([
    "create-market",
  ]);
  expect(payload.data.writes[0]?.body).toMatchObject({
    productCode: "CORN",
    surveyYear: "2026",
    surveyMonth: "8",
    coreValues: {
      MKT_OBJECT_TYPE: "TRADER",
      MKT_PURCHASE_BASE_PRICE: "2418.50",
      MKT_SALE_BASE_PRICE: "2438.50",
      MKT_REGION: "230221101001",
    },
  });
  expect(payload.data.actorHeaders).toEqual([null]);
});

test("keeps product-owned entry and workbook contracts aligned across business domains", async ({
  page,
  request,
}) => {
  await page.goto("/#/产情监测/大豆产情填报");
  await expect(
    page.getByRole("table", { name: "大豆产情调查表" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "新建调查记录" }).click();

  const productionDialog = page.getByRole("dialog", {
    name: "新建产情填报",
  });
  const productionPanel = productionDialog.getByRole("region", {
    name: "产情填报",
  });
  await expect(productionPanel.getByText("已加载业务填报规则")).toBeVisible();
  await expect(
    productionPanel.getByRole("combobox", { name: "品种" }),
  ).toHaveCount(0);
  await expect(
    productionPanel.getByRole("textbox", { name: "具体品种" }),
  ).toHaveCount(0);
  await productionPanel
    .getByRole("combobox", { name: "地级市" })
    .selectOption("230200");
  await productionPanel
    .getByRole("combobox", { name: "区县" })
    .selectOption("230221");
  await productionPanel
    .getByRole("combobox", { name: "乡镇" })
    .selectOption("230221101");
  await productionPanel
    .getByRole("combobox", { name: "行政村" })
    .selectOption("230221101001");
  await productionPanel
    .getByRole("combobox", { name: "数据年份" })
    .selectOption("2026");
  await productionPanel
    .getByRole("combobox", { name: "数据月份" })
    .selectOption("8");
  await productionPanel.getByLabel("播种面积").fill("120");
  await productionPanel.getByLabel("预计单产").fill("310");
  await productionPanel
    .getByRole("textbox", { name: "样本点名称", exact: true })
    .fill("通齐村第一调查户");
  await productionPanel.getByLabel("期初库存").fill("18");
  await productionPanel.getByLabel("销售数量").fill("4");
  await productionPanel.getByLabel("自用数量").fill("2");
  await productionPanel.getByLabel("期末余粮").fill("12");
  await productionPanel
    .getByRole("textbox", { name: "调研人", exact: true })
    .fill("李敏");
  await productionPanel.getByLabel("调研人联系方式").fill("13800000000");
  await productionPanel.getByLabel("样本点联系方式").fill("13900000000");
  await productionPanel.getByLabel("纬度").fill("47.3543");
  await productionPanel.getByLabel("经度").fill("123.9182");
  await productionPanel.getByLabel("现场水印照片").setInputFiles({
    name: "soybean-scene.png",
    mimeType: "image/png",
    buffer: Buffer.from([137, 80, 78, 71]),
  });
  await productionPanel.getByRole("button", { name: "保存业务记录" }).click();
  await expect(productionDialog).toHaveCount(0);
  await expect(
    page
      .getByRole("table", { name: "大豆产情调查表" })
      .getByText("通齐村第一调查户"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("table", { name: "大豆产情调查表" })
      .getByRole("cell", { name: "18", exact: true }),
  ).toBeVisible();

  await page
    .getByRole("combobox", { name: "样本点类型" })
    .selectOption({ label: "农户" });
  const productionDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 XLSX 模板" }).click();
  await productionDownload;
  await page.getByLabel("批量导入产情记录").setInputFiles({
    name: "soybean-production.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from("SOYBEAN-WORKBOOK"),
  });
  await expect(page.getByText(/导入完成：1 行已处理.*失败 0 行/)).toBeVisible();

  await page.goto("/#/市场监测/大豆市场采集");
  const marketDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 XLSX 模板" }).click();
  await marketDownload;
  await page.getByLabel("批量导入市场采集记录").setInputFiles({
    name: "soybean-market.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from("SOYBEAN-WORKBOOK"),
  });
  await expect(page.getByText(/导入完成：1 行已处理.*失败 0 行/)).toBeVisible();

  await page.goto("/#/市场监测/大豆物流监测");
  const logisticsDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 XLSX 模板" }).click();
  await logisticsDownload;
  await page.getByLabel("批量导入物流记录").setInputFiles({
    name: "soybean-logistics.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from("SOYBEAN-WORKBOOK"),
  });
  await expect(page.getByText(/导入完成：1 行已处理.*失败 0 行/)).toBeVisible();

  const response = await request.get(`${controlledApiBaseUrl}/__e2e/state`);
  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as {
    data: {
      templateDownloads: Array<{ domain: string; productCode: string }>;
      workbookImports: Array<{
        domain: string;
        embeddedProduct: string;
        productCode: string;
      }>;
      writes: Array<{ action: string; body: unknown }>;
    };
  };
  expect(payload.data.writes).toContainEqual(
    expect.objectContaining({
      action: "create-production",
      body: expect.objectContaining({
        productCode: "SOYBEAN",
        surveyYear: "2026",
        surveyMonth: "8",
        submissionMetadata: expect.objectContaining({
          PROD_SURVEYOR_NAME: "李敏",
          PROD_SURVEYOR_PHONE: "13800000000",
          PROD_OPENING_INVENTORY: "18",
        }),
      }),
    }),
  );
  expect(payload.data.templateDownloads).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ domain: "production", productCode: "SOYBEAN" }),
      expect.objectContaining({ domain: "market", productCode: "SOYBEAN" }),
      expect.objectContaining({ domain: "logistics", productCode: "SOYBEAN" }),
    ]),
  );
  expect(payload.data.workbookImports).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        domain: "production",
        embeddedProduct: "SOYBEAN",
        productCode: "SOYBEAN",
      }),
      expect.objectContaining({
        domain: "market",
        embeddedProduct: "SOYBEAN",
        productCode: "SOYBEAN",
      }),
      expect.objectContaining({
        domain: "logistics",
        embeddedProduct: "SOYBEAN",
        productCode: "SOYBEAN",
      }),
    ]),
  );
  await expect(page.locator("body")).not.toContainText(
    /localhost|127\.0\.0\.1|后端|数据库|fixture|demo|VITE/u,
  );
});

test("keeps an empty API store empty without loading browser fixtures", async ({
  page,
  request,
}) => {
  await setControlledApiMode(request, "empty");
  await page.goto("/#/我的工作/待我处理");

  await expect(
    page.getByRole("status", { name: "业务数据状态" }),
  ).toContainText("当前暂无可用业务数据");
  await expect(page.getByText("服务端玉米市场采集任务")).toHaveCount(0);
  await expect(page.getByText("齐齐哈尔市玉米市场运行周填报")).toHaveCount(0);
});

test("fails closed when the API response contract fails", async ({
  page,
  request,
}) => {
  await setControlledApiMode(request, "failure");
  await page.goto("/#/我的工作/待我处理");

  await expect(
    page.getByRole("alert", { name: "工作状态恢复提示" }),
  ).toContainText("业务数据读取失败");
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

  await expect(page.getByRole("heading", { name: "业务报告" })).toBeVisible();
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
    page.getByRole("heading", { name: "待我处理", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /服务端玉米市场采集任务/ }),
  ).toBeVisible();
  await expect
    .poll(() => decodeURIComponent(new URL(page.url()).hash))
    .toBe("#/我的工作/待我处理");
  await expect(page.getByText("INTERNAL-001", { exact: false })).toHaveCount(0);
});

test("uses the minimal API session view and keeps page navigation operable", async ({
  page,
}) => {
  await page.goto("/#/我的工作/待我处理");
  await expect(page.getByLabel("当前用户：已认证用户")).toBeVisible();
  await expect(page.getByRole("button", { name: "系统设置" })).toHaveCount(0);
  await expect(page.getByText("王洋", { exact: false })).toHaveCount(0);

  const navigation = page.getByRole("navigation", { name: "业务应用" });
  const market = navigation.getByRole("button", {
    name: "市场监测",
    exact: true,
  });
  await market.click();
  await expect
    .poll(() => decodeURIComponent(new URL(page.url()).hash))
    .toBe("#/市场监测/玉米市场采集");
  await expect(market).toHaveAttribute("aria-current", "page");
});
