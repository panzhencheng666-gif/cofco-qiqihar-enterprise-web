import { describe, expect, it } from "vitest";

import { requiredBusinessClassificationIds } from "../core/businessClassification";
import { businessComparisonCoverage } from "./businessComparisonCoverage";
import { enterpriseMetricDefinitions } from "./enterpriseMetricFixtures";

describe("business comparison coverage", () => {
  it("covers every governed business classification exactly once", () => {
    expect(
      businessComparisonCoverage
        .map(({ classificationId }) => classificationId)
        .sort(),
    ).toEqual([...requiredBusinessClassificationIds].sort());
  });

  it("maps every governed field to catalog metrics or an explicit not-comparable reason", () => {
    const metricIds = new Set(
      enterpriseMetricDefinitions.map(({ metricId }) => metricId),
    );
    for (const coverage of businessComparisonCoverage) {
      expect(coverage.fields.length, coverage.classificationId).toBeGreaterThan(
        0,
      );
      for (const field of coverage.fields) {
        expect(
          Boolean(field.metricIds?.length) !==
            Boolean(field.notComparableReason),
          `${coverage.classificationId}.${field.field}`,
        ).toBe(true);
        for (const metricId of field.metricIds ?? [])
          expect(metricIds.has(metricId), metricId).toBe(true);
      }
    }
  });

  it("retains disaster, quality, cost, stock, logistics, processing, and agricultural-input semantics", () => {
    const fields = businessComparisonCoverage.flatMap((item) =>
      item.fields.map(({ field }) => field),
    );
    expect(fields).toEqual(
      expect.arrayContaining([
        "受灾面积",
        "成灾面积",
        "绝收面积",
        "水分",
        "容重",
        "杂质",
        "不完善粒",
        "霉变",
        "毒素",
        "地租",
        "种子成本",
        "农药成本",
        "化肥成本",
        "灌溉成本",
        "人工成本",
        "机耕成本",
        "补贴",
        "保险",
        "期初库存",
        "入库",
        "出库",
        "损耗",
        "期末库存",
        "运输方式",
        "流入",
        "流出",
        "运价",
        "原料投入",
        "产品产出",
        "副产品",
        "加工损耗",
        "开机率",
        "农资价格",
        "农资库存",
        "农资销量",
        "成交价格",
        "其他使用",
      ]),
    );
  });
});
