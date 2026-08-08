import { describe, expect, it } from "vitest";
import { supplyBalanceScopes } from "../supplyBalanceScope";
import { businessWorkFixtures } from "./businessWorkFixtures";
import {
  approvedBusinessReportMetricLineages,
  approvedBusinessReportDatasets,
  findApprovedBusinessReportDataset,
  findApprovedBusinessReportDatasetByMetricRelease,
} from "./businessReportDatasets";

const supplyQuery = {
  application: "supply" as const,
  businessClassificationId: "supply.results",
  region: "齐齐哈尔市全域",
  product: "玉米",
  cultivar: "不按具体品种拆分",
  reportTemplate: "供需平衡分析报告",
  period: "2026/27营销年度",
  frequency: "月报" as const,
  dataBatchId: "SUPPLY-2026-MY-APPROVED",
};

const productionQuery = {
  application: "production" as const,
  businessClassificationId: "production.planting-production",
  region: "齐齐哈尔市全域",
  product: "玉米",
  cultivar: "不按具体品种拆分",
  reportTemplate: "种植生产监测报告",
  period: "2026年第31周",
  frequency: "周报" as const,
  dataBatchId: "PRODUCTION-2026-W31-APPROVED",
};

const marketQuery = {
  application: "market" as const,
  businessClassificationId: "market.quote-trade",
  region: "齐齐哈尔市全域",
  product: "玉米",
  cultivar: "不按具体品种拆分",
  reportTemplate: "价格与交易监测报告",
  period: "2026年第31周",
  frequency: "周报" as const,
  dataBatchId: "MARKET-2026-W31-APPROVED",
};

describe("approved business report datasets", () => {
  it("matches every report coordinate exactly", () => {
    const dataset = findApprovedBusinessReportDataset(supplyQuery);

    expect(dataset).toMatchObject({
      dataBatchLabel: "2026/27营销年度供需已核定数据",
      sourceLabel: "2026/27营销年度市级供需已核定账户",
    });
    expect(dataset?.indicators).toContainEqual(
      expect.objectContaining({ label: "总供给", value: "763.1 万吨" }),
    );
    for (const changedCoordinate of [
      { ...supplyQuery, application: "production" as const },
      { ...supplyQuery, businessClassificationId: "supply.supply" },
      { ...supplyQuery, region: "黑河市全域" },
      { ...supplyQuery, product: "小麦" },
      { ...supplyQuery, cultivar: "京科968" },
      { ...supplyQuery, reportTemplate: "供给构成分析报告" },
      { ...supplyQuery, period: "2025/26营销年度" },
      { ...supplyQuery, frequency: "周报" as const },
      { ...supplyQuery, dataBatchId: "PRODUCTION-2026-W31-APPROVED" },
    ]) {
      expect(findApprovedBusinessReportDataset(changedCoordinate)).toBeNull();
    }
    expect(Object.isFrozen(approvedBusinessReportDatasets)).toBe(true);
    expect(Object.isFrozen(dataset)).toBe(true);
    expect(Object.isFrozen(dataset?.indicators)).toBe(true);
  });

  it("never promotes blocked or unreviewed source work into approved report data", () => {
    const productionWork = businessWorkFixtures.find(
      ({ workId }) => workId === "WORK-PRODUCTION-FILL-W31",
    );
    const marketWork = businessWorkFixtures.find(
      ({ workId }) => workId === "WORK-MARKET-FILL-W31",
    );

    expect(productionWork).toMatchObject({
      reviewStatus: "returned",
      qualityStatus: "blocking",
    });
    expect(marketWork).toMatchObject({
      reviewStatus: "pending",
      qualityStatus: "warning",
    });
    expect(
      findApprovedBusinessReportDataset({
        application: "production",
        businessClassificationId: "production.planting-production",
        region: "讷河市",
        product: "玉米",
        cultivar: "京科968",
        reportTemplate: "种植生产监测报告",
        period: "2026年第31周",
        frequency: "周报",
        dataBatchId: "PRODUCTION-2026-W31-APPROVED",
      }),
    ).toBeNull();
    expect(
      findApprovedBusinessReportDataset({
        ...marketQuery,
        cultivar: "德美亚3号",
      }),
    ).toBeNull();
  });

  it("provides exact official aggregate datasets for all three report domains", () => {
    const production = findApprovedBusinessReportDataset(productionQuery);
    const market = findApprovedBusinessReportDataset(marketQuery);

    expect(production).toMatchObject({
      dataBatchLabel: "2026年第31周产情已核定数据",
      sourceLabel: "齐齐哈尔市第31周正式发布产情指标",
    });
    expect(production?.indicators).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "播种面积", value: "1,284.6 万亩" }),
        expect.objectContaining({
          label: "预计单产",
          value: "468.2 公斤/亩",
        }),
        expect.objectContaining({ label: "预计总产量" }),
      ]),
    );
    expect(market).toMatchObject({
      dataBatchLabel: "2026年第31周市场已核定数据",
      sourceLabel: "齐齐哈尔市第31周正式发布市场指标",
    });
    expect(market?.indicators).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "采购价", value: "2,346 元/吨" }),
        expect.objectContaining({
          label: "实际成交价",
          value: "2,382 元/吨",
        }),
        expect.objectContaining({ label: "成交量", value: "98.5 万吨" }),
      ]),
    );
    expect(
      [...production!.indicators, ...market!.indicators].every((indicator) =>
        /2023年.*2024年.*2025年.*2026年.*较上年/.test(indicator.note),
      ),
    ).toBe(true);
    expect(
      new Set(
        approvedBusinessReportDatasets.map(({ application }) => application),
      ),
    ).toEqual(new Set(["production", "market", "supply"]));
    expect(
      [...production!.chapters, ...market!.chapters].every(
        ({ body }) => !/发布批次|已核定批次/.test(body),
      ),
    ).toBe(true);
  });

  it("supports product-specific comprehensive reports for corn, soybean, and paddy", () => {
    for (const product of ["玉米", "大豆", "稻谷"]) {
      const datasets = approvedBusinessReportDatasets.filter(
        (dataset) =>
          dataset.region === "齐齐哈尔市全域" &&
          dataset.product === product &&
          dataset.frequency === "周报" &&
          dataset.period === "2026年第31周",
      );

      expect(new Set(datasets.map(({ application }) => application))).toEqual(
        new Set(["production", "market"]),
      );
      expect(
        datasets.every(({ indicators }) =>
          indicators.every(({ note }) =>
            /2023年.*2024年.*2025年.*2026年.*较上年/.test(note),
          ),
        ),
      ).toBe(true);
    }

    const soybeanMarket = approvedBusinessReportDatasets.find(
      ({ application, product }) =>
        application === "market" && product === "大豆",
    );
    expect(soybeanMarket?.summary).toContain(
      "采购价4,286 元/吨，销售价4,320 元/吨；两者均为未含车板、包装和运费的基础价",
    );
    expect(soybeanMarket?.summary).toContain(
      "实际成交价4,360 元/吨，已计入车板、包装和运费",
    );
  });

  it("links each formal production and market report batch to its audited metric release", () => {
    expect(approvedBusinessReportMetricLineages).toEqual([
      {
        application: "production",
        reportDataBatchId: "PRODUCTION-2026-W31-APPROVED",
        metricReleaseVersionId: "METRIC-2026-W31-V3",
        metricCoordinates: {
          regionId: "qiqihar-all",
          productId: "corn",
          cultivarId: null,
          samePeriodKey: "W31",
          dataLayer: "official",
          qualityStatus: "passed",
          currentYear: 2026,
        },
      },
      {
        application: "market",
        reportDataBatchId: "MARKET-2026-W31-APPROVED",
        metricReleaseVersionId: "METRIC-2026-W31-V3",
        metricCoordinates: {
          regionId: "qiqihar-all",
          productId: "corn",
          cultivarId: null,
          samePeriodKey: "W31",
          dataLayer: "official",
          qualityStatus: "passed",
          currentYear: 2026,
        },
      },
    ]);

    expect(
      findApprovedBusinessReportDatasetByMetricRelease({
        application: "production",
        businessClassificationId: "production.planting-production",
        region: "齐齐哈尔市全域",
        product: "玉米",
        cultivar: "不按具体品种拆分",
        reportTemplate: "种植生产监测报告",
        period: "2026年第31周",
        frequency: "周报",
        metricReleaseVersionId: "METRIC-2026-W31-V3",
      }),
    )?.toMatchObject({ dataBatchId: "PRODUCTION-2026-W31-APPROVED" });
    expect(
      findApprovedBusinessReportDatasetByMetricRelease({
        application: "market",
        businessClassificationId: "market.quote-trade",
        region: "齐齐哈尔市全域",
        product: "玉米",
        cultivar: "不按具体品种拆分",
        reportTemplate: "价格与交易监测报告",
        period: "2026年第31周",
        frequency: "周报",
        metricReleaseVersionId: "METRIC-2026-W31-V3",
      }),
    )?.toMatchObject({ dataBatchId: "MARKET-2026-W31-APPROVED" });
    expect(
      findApprovedBusinessReportDatasetByMetricRelease({
        application: "production",
        businessClassificationId: "production.planting-production",
        region: "齐齐哈尔市全域",
        product: "玉米",
        cultivar: "不按具体品种拆分",
        reportTemplate: "种植生产监测报告",
        period: "2026年第31周",
        frequency: "周报",
        metricReleaseVersionId: "METRIC-2026-W31-OTHER",
      }),
    ).toBeNull();
  });

  it("uses the exact governed supply account values", () => {
    const dataset = findApprovedBusinessReportDataset(supplyQuery);
    const governedSupply = supplyBalanceScopes.find(
      ({ label, status }) => label === "齐齐哈尔市全域" && status === "已核定",
    );

    expect(dataset).toMatchObject({
      dataBatchLabel: "2026/27营销年度供需已核定数据",
      sourceLabel: "2026/27营销年度市级供需已核定账户",
    });
    expect(dataset?.indicators).toEqual(
      governedSupply?.metrics.map(({ label, value, unit, note }) => ({
        label,
        value: `${value} ${unit}`,
        note,
      })),
    );
  });
});
