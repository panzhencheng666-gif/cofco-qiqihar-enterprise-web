import { describe, expect, it } from "vitest";

import type { ReportDefinition } from "@/platform/api/realtimeBusinessRepository";

import {
  defaultReportPeriod,
  defaultReportRegionCode,
  groupReportDefinitions,
  reportCoverage,
  reportPeriodLabel,
  weeklyPeriodCode,
  weeklyPeriodParts,
} from "./realtimeReportCenterModel";

function definition(
  code: string,
  name: string,
  businessDomain: ReportDefinition["businessDomain"],
  frequencyCode: "DAILY" | "WEEKLY" | "MONTHLY",
): ReportDefinition {
  return {
    code,
    name,
    businessDomain,
    businessSubtype: "MONITORING",
    frequencyCode,
    sections: [],
  };
}

describe("realtime report center model", () => {
  it("never renders NaN for a degraded Safari weekly value", () => {
    expect(reportPeriodLabel("WEEKLY", "2024")).toBe("报告周待选择");
    expect(reportPeriodLabel("WEEKLY", "2024")).not.toContain("NaN");
    expect(weeklyPeriodParts("2024", "2024-W46")).toEqual({
      year: "2024",
      week: "46",
    });
  });

  it("builds only valid ISO week period codes", () => {
    expect(weeklyPeriodCode("2024", "46")).toBe("2024-W46");
    expect(weeklyPeriodCode("2024", "6")).toBe("2024-W06");
    expect(() => weeklyPeriodCode("2024", "0")).toThrow(
      "报告周次必须为第1至53周",
    );
    expect(() => weeklyPeriodCode("year", "12")).toThrow("报告年份无效");
  });

  it("keeps the server-owned comprehensive daily weekly and monthly order", () => {
    const definitions = [
      definition(
        "COMPREHENSIVE_MONTHLY",
        "综合经营月报",
        "COMPREHENSIVE",
        "MONTHLY",
      ),
      definition(
        "COMPREHENSIVE_DAILY",
        "综合经营日报",
        "COMPREHENSIVE",
        "DAILY",
      ),
      definition(
        "COMPREHENSIVE_WEEKLY",
        "综合经营周报",
        "COMPREHENSIVE",
        "WEEKLY",
      ),
    ];

    const groups = groupReportDefinitions(definitions);

    expect(groups.map(({ label }) => label)).toEqual(["综合经营报告"]);
    expect(
      groups.map(({ definitions: items }) => items.map(({ name }) => name)),
    ).toEqual([["综合经营日报", "综合经营周报", "综合经营月报"]]);
  });

  it("defaults to the first top-level prefecture instead of an arbitrary child row", () => {
    const regions = [
      {
        code: "230221100",
        name: "龙江镇",
        parentCode: "230221",
        level: "TOWNSHIP",
      },
      {
        code: "230200",
        name: "齐齐哈尔市",
        parentCode: null,
        level: "PREFECTURE",
      },
      {
        code: "231100",
        name: "黑河市",
        parentCode: null,
        level: "PREFECTURE",
      },
    ];

    expect(defaultReportRegionCode(regions)).toBe("230200");
  });

  it("uses natural daily weekly and monthly defaults", () => {
    expect(defaultReportPeriod("DAILY", "2026-08-19")).toBe("2026-08-19");
    expect(defaultReportPeriod("MONTHLY", "2026-08-19")).toBe("2026-08");
    expect(defaultReportPeriod("WEEKLY", "2026-08-19")).toBe("2026-W34");
  });

  it("distinguishes complete coverage from missing or partly sourced approved metrics", () => {
    expect(
      reportCoverage([
        { label: "核定数据条数", value: "12", note: "已核定业务数据" },
        { label: "核定播种面积", value: "1200 亩", note: "采用 12 条审核数据" },
      ]),
    ).toEqual(expect.objectContaining({ status: "COMPLETE" }));
    expect(
      reportCoverage([
        { label: "核定数据条数", value: "12", note: "已核定业务数据" },
        { label: "期末库存", value: "80 吨", note: "采用 5 条审核数据" },
      ]),
    ).toEqual(expect.objectContaining({ status: "PARTIAL" }));
    expect(
      reportCoverage([
        { label: "核定数据条数", value: "12", note: "已核定业务数据" },
        { label: "期末库存", value: "暂无审核数据", note: "暂无审核数据" },
      ]),
    ).toEqual(expect.objectContaining({ status: "PARTIAL" }));
  });
});
