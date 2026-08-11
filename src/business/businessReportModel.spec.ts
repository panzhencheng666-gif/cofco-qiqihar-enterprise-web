import { describe, expect, it } from "vitest";
import {
  createBusinessReportArtifact,
  createBusinessReportDraft,
  createQuickReportArtifact,
  type BusinessReportContext,
  type BusinessReportRequest,
} from "./businessReportModel";

const marketContext: BusinessReportContext = {
  application: "market",
  applicationLabel: "市场监测",
  businessClassificationId: "market.quote-trade",
  businessClassificationLabel: "报价与交易",
  product: "玉米",
  cultivar: "德美亚3号",
  reportTemplate: "价格与交易监测报告",
  region: "齐齐哈尔市全域",
  regionLevel: "市级监测",
  period: "2026年第31周",
  frequency: "周报",
  dataCutoff: "2026-07-31 17:00",
  dataVersion: "MARKET-2026-W31-APPROVED",
  dataBatchLabel: "2026年第31周市场已核定数据",
  author: "王洋",
  authorPost: "区域数据管理员",
  reviewer: "赵晨",
  reviewerPost: "报告复核岗",
};

const supplyContext: BusinessReportContext = {
  ...marketContext,
  application: "supply",
  applicationLabel: "供需与态势",
  businessClassificationId: "supply.results",
  businessClassificationLabel: "结果",
  cultivar: "不按具体品种拆分",
  reportTemplate: "供需平衡分析报告",
  period: "2026/27营销年度",
  frequency: "月报",
  dataVersion: "SUPPLY-2026-MY-APPROVED",
  dataBatchLabel: "2026/27营销年度供需已核定数据",
};

describe("business report model", () => {
  const exactMarketRequest: BusinessReportRequest = {
    reportType: "市场报告",
    regionId: "qiqihar-all",
    productId: "corn",
    cultivarId: null,
    periodKey: "2026年第31周",
    frequency: "周",
    cutoff: "2026-07-31 17:00",
    approvedDatasetId: "MARKET-2026-W31-APPROVED",
    sectionKeys: ["价格与交易", "库存与加工", "物流与风险"],
  };

  it("creates exact-scope business and submission exports without exposing internal codes", () => {
    const business = createQuickReportArtifact(
      exactMarketRequest,
      "business-weekly",
    );
    const submission = createQuickReportArtifact(
      exactMarketRequest,
      "submission-weekly",
    );

    expect(business.filename).toContain("齐齐哈尔市全域-市场监测-玉米-周报");
    expect(business.content).toContain("采购价");
    expect(business.content).toContain("价格与交易");
    expect(submission.filename).toContain(
      "齐齐哈尔市全域-市场监测-填报记录周报",
    );
    expect(submission.content).toContain("责任人,责任区域,业务事项");
    expect(submission.content).toContain("玉米市场运行周填报");
    expect(
      `${business.filename}${business.content}${submission.filename}${submission.content}`,
    ).not.toMatch(/MARKET-|METRIC-|VERSION-|2026-07-31T/);
  });

  it("rejects a quick business export when the selected frequency has no exact approved dataset", () => {
    expect(() =>
      createQuickReportArtifact(exactMarketRequest, "business-daily"),
    ).toThrow("当前范围没有可用于业务日报的已核定数据");
    expect(() =>
      createQuickReportArtifact(
        { ...exactMarketRequest, regionId: "" },
        "submission-weekly",
      ),
    ).toThrow("一键导出必须明确选择业务、地区、产品、期间和采用数据");
  });

  it("creates a monthly report from an exactly approved business context", () => {
    const draft = createBusinessReportDraft(supplyContext, "月报");

    expect(draft.title).toBe("齐齐哈尔市全域玉米供需与态势月报");
    expect(draft.reportNumber).toBe("报告编号待分配");
    expect(draft.summary).toContain("763.1 万吨");
    expect(draft.summary).toContain("105.1 万吨");
    expect(draft.frequency).toBe("月报");
  });

  it.each([
    [
      "production",
      "production.planting-production",
      "产情监测",
      "种植生产",
      "种植生产监测报告",
      "PRODUCTION-2026-W31-APPROVED",
      "播种面积",
      "1,284.6 万亩",
    ],
    [
      "market",
      "market.quote-trade",
      "市场监测",
      "报价与交易",
      "价格与交易监测报告",
      "MARKET-2026-W31-APPROVED",
      "采购价",
      "2,346 元/吨",
    ],
  ] as const)(
    "creates an exact approved %s aggregate report without substituting cultivar data",
    (
      application,
      businessClassificationId,
      applicationLabel,
      businessClassificationLabel,
      reportTemplate,
      dataVersion,
      indicatorLabel,
      indicatorValue,
    ) => {
      const draft = createBusinessReportDraft(
        {
          ...marketContext,
          application,
          applicationLabel,
          businessClassificationId,
          businessClassificationLabel,
          cultivar: "不按具体品种拆分",
          reportTemplate,
          dataVersion,
        },
        "周报",
      );

      expect(draft.hasApprovedIndicators).toBe(true);
      expect(draft.adoptedDataLabel).not.toBe("未采用核定数据");
      const indicator = draft.indicators.find(
        ({ label }) => label === indicatorLabel,
      );
      expect(indicator).toMatchObject({ value: indicatorValue });
      expect(indicator?.note).toMatch(/2023年.*2026年.*较上年/);
      expect(draft.title).not.toContain("不按具体品种拆分");
      expect(createBusinessReportArtifact(draft, "Word").content).not.toContain(
        dataVersion,
      );
    },
  );

  it("uses the selected frequency without changing the adopted data batch", () => {
    const daily = createBusinessReportDraft(marketContext, "日报");
    const monthly = createBusinessReportDraft(marketContext, "月报");

    expect(daily.dataVersion).toBe(marketContext.dataVersion);
    expect(monthly.dataVersion).toBe(marketContext.dataVersion);
    expect(daily.adoptedDataLabel).toBe("未采用核定数据");
    expect(daily.title).toContain("日报");
    expect(monthly.title).toContain("月报");
  });

  it("builds deterministic Word and Excel artifacts", () => {
    const draft = createBusinessReportDraft(supplyContext, "月报");
    const word = createBusinessReportArtifact(draft, "Word");
    const excel = createBusinessReportArtifact(draft, "Excel");

    expect(word.filename).toMatch(/齐齐哈尔市全域-供需与态势-玉米-月报/);
    expect(word.mimeType).toBe("application/msword;charset=utf-8");
    expect(excel.content).toContain("指标,本期值,说明");
    expect(excel.filename).toMatch(/\.csv$/);
  });

  it("marks an unpublished export as an internal working draft instead of a formal report", () => {
    const draft = createBusinessReportDraft(supplyContext, "月报");

    const artifact = createBusinessReportArtifact(draft, "Word", "内部工作稿");

    expect(artifact.documentStatus).toBe("内部工作稿");
    expect(artifact.filename).toContain("内部工作稿");
    expect(artifact.filename).not.toContain("正式报告");
    expect(artifact.content).toContain("未经复核发布，不得作为正式报告使用");
  });

  it("keeps technical codes out of report content and artifact names", () => {
    const technicalContext: BusinessReportContext = {
      ...marketContext,
      applicationLabel: "MARKET",
      dataCutoff: "2026-07-31T17:00:00",
      dataVersion: "METRIC-2026-W31-V3",
      dataBatchLabel: undefined,
    };
    const draft = createBusinessReportDraft(technicalContext, "周报");
    const artifacts = (["PDF", "Word", "Excel"] as const).map((format) =>
      createBusinessReportArtifact(draft, format, "正式报告"),
    );
    const artifactFromUntrustedDraft = createBusinessReportArtifact(
      { ...draft, applicationLabel: "MARKET" },
      "Word",
      "正式报告",
    );

    expect(draft.reportNumber).toBe("报告编号待分配");
    expect(draft.applicationLabel).toBe("市场监测");
    expect(draft.adoptedDataLabel).toBe("未采用核定数据");
    expect(artifacts.map((artifact) => artifact.filename)).toEqual([
      "齐齐哈尔市全域-市场监测-玉米-周报-2026年第31周-正式报告.pdf",
      "齐齐哈尔市全域-市场监测-玉米-周报-2026年第31周-正式报告.doc",
      "齐齐哈尔市全域-市场监测-玉米-周报-2026年第31周-正式报告-数据附件.csv",
    ]);
    expect(artifactFromUntrustedDraft.filename).toContain("市场监测");
    expect(artifactFromUntrustedDraft.filename).not.toContain("MARKET");

    for (const artifact of artifacts) {
      expect(`${artifact.filename}\n${artifact.content}`).not.toMatch(
        /QQHE|MARKET|SUPPLY|PRODUCTION|METRIC-2026-W31-V3|V1\.0|版本|第1版/,
      );
      expect(artifact.content).not.toContain("2026-07-31T17:00:00");
      expect(artifact.content).toContain("报告编号待分配");
      expect(artifact.content).toContain("2026年7月31日 17:00");
      expect(artifact.content).toContain("未采用核定数据");
    }
  });

  it("keeps supply account scope in the report narrative", () => {
    const supplyContext: BusinessReportContext = {
      ...marketContext,
      application: "supply",
      applicationLabel: "供需与态势",
      businessClassificationId: "supply.results",
      businessClassificationLabel: "结果",
      region: "讷河市",
      regionLevel: "县级账户",
      cultivar: "不按具体品种拆分",
      reportTemplate: "供需平衡分析报告",
      period: "2026/27营销年度",
      dataVersion: "SUPPLY-2026-MY-APPROVED",
      dataBatchLabel: "2026/27营销年度供需已核定数据",
    };

    const draft = createBusinessReportDraft(supplyContext, "月报");

    expect(draft.title).toBe("讷河市玉米供需与态势月报");
    expect(draft.summary).toContain("县级账户");
    expect(draft.summary).toContain("讷河市");
  });

  it.each([
    ["production", "黑河市全域", "大豆", "产情监测"],
    ["market", "呼伦贝尔指定范围", "稻谷", "市场监测"],
    ["supply", "黑河市全域", "小麦", "供需与态势"],
  ] as const)(
    "does not borrow unrelated indicators for %s %s %s",
    (application, region, product, applicationLabel) => {
      const draft = createBusinessReportDraft(
        {
          ...marketContext,
          application,
          applicationLabel,
          region,
          product,
          dataVersion:
            application === "production"
              ? "PRODUCTION-2026-W31-APPROVED"
              : application === "market"
                ? "MARKET-2026-W31-APPROVED"
                : "SUPPLY-2026-MY-APPROVED",
          dataBatchLabel:
            application === "supply"
              ? "2026/27营销年度供需已核定数据"
              : `2026年第31周${applicationLabel.replace("监测", "")}已核定数据`,
        },
        "周报",
      );

      expect(draft.title).toBe(
        `${region}${product}德美亚3号${applicationLabel}周报`,
      );
      expect(draft.summary).toBe(
        application === "supply"
          ? `${region}按市级监测编制，${product}当前筛选范围尚无已核定指标。`
          : `${region}${product}当前筛选范围尚无已核定指标。`,
      );
      expect(draft.indicators).toEqual([]);
      expect(JSON.stringify(draft)).not.toContain("齐齐哈尔市玉米");
    },
  );

  it("uses only a Chinese business batch label in documents and filenames", () => {
    const draft = createBusinessReportDraft(supplyContext, "月报");
    const word = createBusinessReportArtifact(draft, "Word");

    expect(word.content).toContain("2026/27营销年度供需已核定数据");
    expect(`${word.filename}${word.content}`).not.toMatch(
      /SUPPLY-2026-MY-APPROVED|2026-07-31|版本|第1版/,
    );
  });

  it("does not reuse indicators from a different business data batch", () => {
    const draft = createBusinessReportDraft(
      {
        ...marketContext,
        dataVersion: "PRODUCTION-2026-W31-APPROVED",
        dataBatchLabel: "2026年第31周产情已核定数据",
      },
      "周报",
    );

    expect(draft.hasApprovedIndicators).toBe(false);
    expect(draft.summary).toBe(
      "齐齐哈尔市全域玉米当前筛选范围尚无已核定指标。",
    );
  });

  it("does not reuse an approved dataset across report periods or frequencies", () => {
    const wrongPeriod = createBusinessReportDraft(
      { ...marketContext, period: "2026年第30周" },
      "周报",
    );
    const wrongFrequency = createBusinessReportDraft(marketContext, "日报");

    for (const draft of [wrongPeriod, wrongFrequency]) {
      expect(draft.hasApprovedIndicators).toBe(false);
      expect(draft.indicators).toEqual([]);
      expect(draft.summary).toContain("当前筛选范围尚无已核定指标");
      expect(JSON.stringify(draft)).not.toMatch(/2,346|2,480|18,420/);
    }
  });
});
