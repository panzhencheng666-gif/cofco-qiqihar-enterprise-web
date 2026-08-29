import type { Page } from "@playwright/test";
import { expect, queryE2eDatabase, test } from "./fixtures";
import { fillDownloadedXlsx } from "./xlsx-fixture";

const sampleRegion = "齐齐哈尔市 / 梅里斯达斡尔族区";
const productionLatitude = "47.38";
const productionLongitude = "123.28";
const marketLatitude = "47.39";
const marketLongitude = "123.29";
const logisticsLatitude = "47.4";
const logisticsLongitude = "123.3";

async function downloadTemplate(page: Page, targetPath: string): Promise<void> {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 XLSX 模板" }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/u);
  await download.saveAs(targetPath);
}

test("downloads, fills, and imports the three domain XLSX protocols into PostgreSQL", async ({
  page,
}, testInfo) => {
  const productionMarker = "E2E-XLSX-玉米产情-通用模板";
  const marketMarker = "E2E-XLSX-玉米市场-通用模板";
  const logisticsMarker = "E2E-XLSX-玉米物流-通用模板";
  await page.goto("/#/产情监测/玉米产情填报");
  const productionTemplatePath = testInfo.outputPath(
    "production-template.xlsx",
  );
  await downloadTemplate(page, productionTemplatePath);
  const productionWorkbook = fillDownloadedXlsx(productionTemplatePath, {
    样本点类型: "农户",
    数据年份: "2026",
    数据月份: "8",
    样本点名称: productionMarker,
    地区: sampleRegion,
    调研人: "验收调研员甲",
    调研人联系方式: "13800000021",
    样本点联系方式: "13900000021",
    "纬度（度）": productionLatitude,
    "经度（度）": productionLongitude,
    "播种面积（亩）": "150",
    "预计收获面积（亩）": "145",
    生育阶段: "灌浆期",
    "预计单产（公斤/亩）": "520",
    "期初库存（吨）": "20",
    "销售数量（吨）": "5",
    "自用数量（吨）": "3",
    "期末余粮（吨）": "12",
    "水分（%）": "14.2",
  });
  expect(productionWorkbook.headers).toEqual(
    expect.arrayContaining([
      "样本点名称",
      "期初库存（吨）",
      "期末余粮（吨）",
      "现场照片文件名（可选，最多5张，分号分隔）",
    ]),
  );
  expect(productionWorkbook.headers).not.toContain("PROD_SAMPLE_NAME");
  await page
    .getByLabel("批量导入产情记录")
    .setInputFiles(productionWorkbook.path);
  await expect(
    page.getByText(/导入完成：1 行已处理，.*失败 0 行/u),
  ).toBeVisible({ timeout: 15_000 });
  productionWorkbook.cleanup();

  await page.goto("/#/市场监测/玉米市场采集");
  const marketTemplatePath = testInfo.outputPath("market-template.xlsx");
  await downloadTemplate(page, marketTemplatePath);
  const marketWorkbook = fillDownloadedXlsx(marketTemplatePath, {
    样本点类型: "贸易商",
    数据年份: "2026",
    数据月份: "8",
    样本点名称: marketMarker,
    地区: sampleRegion,
    调研人: "验收调研员乙",
    调研人联系方式: "13800000022",
    样本点联系方式: "13900000022",
    "纬度（度）": marketLatitude,
    "经度（度）": marketLongitude,
    "采集对象收购价格（元/吨）": "2300",
    "采集对象销售价格（元/吨）": "2380",
    "车板组成（元/吨）": "36",
    包装形态: "散粮",
    "运费组成（元/吨）": "72",
    "采购量（吨）": "120",
    "销售量（吨）": "60",
    "水分（%）": "14.6",
    "杂质（%）": "1.0",
    "现有库存（吨）": "350",
  });
  expect(marketWorkbook.headers).toEqual(
    expect.arrayContaining([
      "样本点名称",
      "采集对象收购价格（元/吨）",
      "采购量（吨）",
      "现有库存（吨）",
      "现场照片文件名（可选，最多5张，分号分隔）",
    ]),
  );
  expect(marketWorkbook.headers).not.toContain("MKT_SAMPLE_NAME");
  await page
    .getByLabel("批量导入市场采集记录")
    .setInputFiles(marketWorkbook.path);
  await expect(
    page.getByText(/导入完成：1 行已处理，.*失败 0 行/u),
  ).toBeVisible({ timeout: 15_000 });
  marketWorkbook.cleanup();

  await page.goto("/#/市场监测/玉米物流监测");
  const logisticsTemplatePath = testInfo.outputPath("logistics-template.xlsx");
  await downloadTemplate(page, logisticsTemplatePath);
  const logisticsWorkbook = fillDownloadedXlsx(logisticsTemplatePath, {
    数据年份: "2026",
    数据月份: "8",
    物流样本点名称: logisticsMarker,
    地区: sampleRegion,
    调研人: "验收调研员丙",
    调研人联系方式: "13800000023",
    物流样本点联系方式: "13900000023",
    "纬度（度）": logisticsLatitude,
    "经度（度）": logisticsLongitude,
    运输方式: "铁路",
    运输方向: "流入",
    "运输数量（吨）": "155.5",
    "物流运价（不含车板价）（元/吨）": "85.25",
    "车板价（元/吨）": "2650",
  });
  expect(logisticsWorkbook.headers).toEqual(
    expect.arrayContaining([
      "物流样本点名称",
      "运输方式",
      "运输数量（吨）",
      "物流运价（不含车板价）（元/吨）",
      "车板价（元/吨）",
    ]),
  );
  expect(logisticsWorkbook.headers).not.toContain("LOG_SAMPLE_NAME");
  await page
    .getByLabel("批量导入物流记录")
    .setInputFiles(logisticsWorkbook.path);
  await expect(
    page.getByText(/导入完成：1 行已处理，.*失败 0 行/u),
  ).toBeVisible({ timeout: 15_000 });
  logisticsWorkbook.cleanup();

  expect(
    queryE2eDatabase(
      `SELECT value FROM production.production_record_submission_metadata WHERE field_code='PROD_SAMPLE_NAME' AND value='${productionMarker}'`,
    ),
  ).toBe(productionMarker);
  expect(
    queryE2eDatabase(
      `SELECT value FROM market.market_record_core_value WHERE field_code='MKT_SAMPLE_NAME' AND value='${marketMarker}'`,
    ),
  ).toBe(marketMarker);
  expect(
    queryE2eDatabase(
      `SELECT fact.value FROM market.market_record_fact fact JOIN market.market_record_core_value sample ON sample.record_id=fact.record_id AND sample.field_code='MKT_SAMPLE_NAME' AND sample.value='${marketMarker}' WHERE fact.fact_code='ENDING_INVENTORY'`,
    ),
  ).toBe("350.0000");
  expect(
    queryE2eDatabase(
      `SELECT source_organization FROM logistics.route_event WHERE source_organization='${logisticsMarker}'`,
    ),
  ).toBe(logisticsMarker);
  expect(
    queryE2eDatabase(
      "SELECT string_agg(domain_code || '=' || status_code, ',' ORDER BY domain_code) FROM platform.import_job",
    ),
  ).toBe("LOGISTICS=COMPLETED,MARKET=COMPLETED,PRODUCTION=COMPLETED");
});
