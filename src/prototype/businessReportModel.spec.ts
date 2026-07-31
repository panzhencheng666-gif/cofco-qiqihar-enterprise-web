import { describe, expect, it } from "vitest";
import {
  createBusinessReportArtifact,
  createBusinessReportDraft,
  type BusinessReportContext,
} from "./businessReportModel";

const marketContext: BusinessReportContext = {
  application: "market",
  applicationLabel: "市场监测",
  product: "玉米",
  region: "齐齐哈尔市全域",
  regionLevel: "市级监测",
  period: "2026 年第 31 周",
  dataCutoff: "2026-07-31 17:00",
  dataVersion: "市场监测第 31 周审核版",
  author: "王洋",
  reviewer: "赵晨",
};

describe("business report model", () => {
  it("creates a weekly report from the selected business context", () => {
    const draft = createBusinessReportDraft(marketContext, "周报");

    expect(draft.title).toBe("齐齐哈尔市全域玉米市场监测周报");
    expect(draft.summary).toContain("2,346 元/吨");
    expect(draft.summary).toContain("96 元/吨");
    expect(draft.frequency).toBe("周报");
  });

  it("uses the selected frequency without changing the adopted data version", () => {
    const daily = createBusinessReportDraft(marketContext, "日报");
    const monthly = createBusinessReportDraft(marketContext, "月报");

    expect(daily.dataVersion).toBe(marketContext.dataVersion);
    expect(monthly.dataVersion).toBe(marketContext.dataVersion);
    expect(daily.title).toContain("日报");
    expect(monthly.title).toContain("月报");
  });

  it("builds deterministic Word and Excel artifacts", () => {
    const draft = createBusinessReportDraft(marketContext, "周报");
    const word = createBusinessReportArtifact(draft, "Word");
    const excel = createBusinessReportArtifact(draft, "Excel");

    expect(word.filename).toMatch(/市场监测-玉米-周报/);
    expect(word.mimeType).toBe("application/msword;charset=utf-8");
    expect(excel.content).toContain("指标,本期值,说明");
    expect(excel.filename).toMatch(/\.csv$/);
  });

  it("keeps supply account scope in the report narrative", () => {
    const supplyContext: BusinessReportContext = {
      ...marketContext,
      application: "supply",
      applicationLabel: "供需与态势",
      region: "讷河市",
      regionLevel: "县级账户",
      dataVersion: "讷河市玉米账户第 3 版",
    };

    const draft = createBusinessReportDraft(supplyContext, "月报");

    expect(draft.title).toBe("讷河市玉米供需与态势月报");
    expect(draft.summary).toContain("县级账户");
    expect(draft.summary).toContain("讷河市");
  });
});
