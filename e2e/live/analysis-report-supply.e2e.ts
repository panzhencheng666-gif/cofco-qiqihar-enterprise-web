import {
  liveBrowserAccounts,
  expect,
  queryE2eDatabase,
  test,
} from "./fixtures";

function seedApprovedComparisonFacts(): void {
  const productionRows = [2023, 2024, 2025, 2026]
    .map(
      (year, index) =>
        `('live-analysis-production-${year}','CORN','FARMER','230208101001',DATE '${year}-08-05',TIMESTAMPTZ '${year}-08-06 08:00:00+08',${100 + index * 10},${500 + index * 10},'APPROVED','e2e-reviewer')`,
    )
    .join(",\n");
  const marketRows = [2023, 2024, 2025, 2026]
    .map(
      (year, index) =>
        `('live-analysis-market-${year}','CORN','TRADER','230208101001',DATE '${year}-08-05',TIMESTAMPTZ '${year}-08-06 08:00:00+08',${2400 + index * 100},'PURCHASE',10,5,20,'BULK','APPROVED','e2e-reviewer')`,
    )
    .join(",\n");

  queryE2eDatabase(`
    INSERT INTO production.production_record(
      record_id,product_code,object_type_code,region_code,survey_date,reported_at,
      cultivated_area_mu,yield_per_mu_kg,status_code,last_modified_by
    ) VALUES ${productionRows};

    INSERT INTO market.market_record(
      record_id,product_code,object_type_code,region_code,trade_date,reported_at,
      purchase_base_price,trade_direction,carriage_board_amount,packaging_amount,
      freight_amount,packaging_form,status_code,last_modified_by
    ) VALUES ${marketRows};
  `);
}

test.beforeAll(() => seedApprovedComparisonFacts());

test("reads dynamic production and market indicators with interactive enterprise charts", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${liveBrowserAccounts.reporter.url}/#/产情监测/产情分析`);
  await expect(
    page.getByRole("heading", { name: "产情年度对比分析" }),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: "统计地区" })).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "搜索地级市" }),
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: "区县" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "乡镇" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "行政村" })).toBeVisible();
  await expect(page.getByLabel("分析指标")).toContainText("核定播种面积");
  await expect(page.getByLabel(/四年对比柱状图/)).toBeVisible();
  await expect(page.getByLabel(/四年趋势折线图/)).toBeVisible();
  await expect(page.getByLabel(/四年合计占比环图/)).toBeVisible();
  const productionPoint = page.getByRole("button", {
    name: /柱状图 2025年/,
  });
  await productionPoint.hover();
  await expect(
    page.getByRole("status", { name: "当前图表数据" }),
  ).toContainText("2025年");

  await page.goto(`${liveBrowserAccounts.reporter.url}/#/市场监测/市场分析`);
  await expect(
    page.getByRole("heading", { name: "市场年度对比分析" }),
  ).toBeVisible();
  await expect(page.getByLabel("分析指标")).toContainText("平均成交价");
  await expect(page.getByLabel(/四年对比柱状图/)).toBeVisible();

  await context.close();
});

test("offers twelve scoped report types and exports only a previewed range", async ({
  browser,
}) => {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  await page.goto(`${liveBrowserAccounts.reporter.url}/#/报表中心/业务报告`);
  await expect(page.getByRole("heading", { name: "业务报告" })).toBeVisible();
  const definitions = page.getByLabel("报告类型").locator("option");
  await expect(definitions).toHaveCount(12);
  await expect(page.getByLabel("报告类型")).toContainText("产情日报");
  await expect(page.getByLabel("报告类型")).toContainText("产情周报");
  await expect(page.getByLabel("报告类型")).toContainText("产情月报");
  await expect(page.getByLabel("报告类型")).toContainText("市场日报");
  await expect(page.getByLabel("报告类型")).toContainText("物流周报");
  await expect(page.getByLabel("报告类型")).toContainText("供需月报");
  await expect(page.getByLabel("具体品种")).toHaveCount(0);
  await expect(page.getByRole("group", { name: "统计地区" })).toBeVisible();

  await page.getByLabel("报告类型").selectOption("PRODUCTION_DAILY");
  await page.getByRole("button", { name: "生成报告预览" }).click();
  await expect(page.getByRole("region", { name: "报告预览" })).toContainText(
    "核定数据条数",
  );
  await page.getByLabel("导出格式").selectOption("XLSX");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出当前报告" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);

  await page.goto(
    `${liveBrowserAccounts.reporter.url}/#/供需分析/供需平衡`,
  );
  await expect(
    page.getByRole("heading", { name: "实时供需平衡" }),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: "统计地区" })).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "搜索地级市" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /批准|创建不可变输入集|运行并发布/ }),
  ).toHaveCount(0);

  await context.close();
});
