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
  const productionCultivars = [2023, 2024, 2025, 2026]
    .map(
      (year) =>
        `('live-analysis-production-${year}','PROD_CULTIVAR_NAME','E2E-四年图表玉米')`,
    )
    .join(",\n");

  queryE2eDatabase(`
    INSERT INTO production.production_record(
      record_id,product_code,object_type_code,region_code,survey_date,reported_at,
      cultivated_area_mu,yield_per_mu_kg,status_code,last_modified_by
    ) VALUES ${productionRows}
    ON CONFLICT DO NOTHING;

    INSERT INTO production.production_record_submission_metadata(
      record_id, field_code, value
    ) VALUES ${productionCultivars}
    ON CONFLICT DO NOTHING;

    INSERT INTO market.market_record(
      record_id,product_code,object_type_code,region_code,trade_date,reported_at,
      purchase_base_price,trade_direction,carriage_board_amount,packaging_amount,
      freight_amount,packaging_form,status_code,last_modified_by
    ) VALUES ${marketRows}
    ON CONFLICT DO NOTHING;
  `);
}

test.beforeAll(() => seedApprovedComparisonFacts());

test("reads current production and market analysis from approved records", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${liveBrowserAccounts.reporter.url}/#/产情监测/产情分析`);
  await expect(
    page.getByRole("heading", { name: "产情分析", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: "分析范围" })).toBeVisible();
  await expect(page.getByRole("group", { name: "责任地区" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "区县" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "乡镇" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "行政村" })).toBeVisible();
  await expect(
    page.getByText("核定播种面积", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("加权预计单产", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: "产情核定数据来源" }),
  ).toBeVisible();

  await page.goto(`${liveBrowserAccounts.reporter.url}/#/市场监测/市场分析`);
  await expect(
    page.getByRole("heading", { name: "市场分析", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: "分析范围" })).toBeVisible();
  await expect(
    page.getByText("平均采集对象收购价格", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: "市场地区与主体来源" }),
  ).toBeVisible();

  await context.close();
});

test("offers the three comprehensive report types and exports one immutable range", async ({
  browser,
}) => {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  await page.goto(`${liveBrowserAccounts.reporter.url}/#/报表中心/业务报告`);
  await expect(page.getByRole("heading", { name: "业务报告" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /综合经营(日报|周报|月报)/u }),
  ).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "综合经营日报" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "统计地区" })).toBeVisible();

  await page.getByLabel("报告日期").fill("2026-08-05");
  await page.getByLabel("导出格式").selectOption("XLSX");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "生成并下载报告" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
  await expect(
    page.getByRole("region", { name: "报告生成结果" }),
  ).toContainText("核定数据条数");

  await page.goto(`${liveBrowserAccounts.reporter.url}/#/供需分析/供需平衡`);
  await expect(
    page.getByRole("heading", { name: "供需平衡", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("供需地区")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /批准|创建不可变输入集|运行并发布/ }),
  ).toHaveCount(0);

  await context.close();
});
