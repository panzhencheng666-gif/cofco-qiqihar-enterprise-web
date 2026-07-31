import { describe, expect, it } from "vitest";
import {
  getSupplyBalanceEquation,
  getSupplyBalanceMetrics,
  getSupplyBalanceScope,
  supplyBalanceScopes,
} from "./supplyBalanceScope";

describe("supply balance scope", () => {
  it("uses the city consolidated account by default", () => {
    const scope = getSupplyBalanceScope("qiqihar");

    expect(scope.label).toBe("齐齐哈尔市全域");
    expect(scope.level).toBe("市级合并");
    expect(scope.internalFlowElimination).toBe("42.6 万吨");
    expect(scope.coverage).toBe("16 / 16 个县区");
  });

  it("distinguishes county coverage from city consolidation", () => {
    const scope = getSupplyBalanceScope("nehe");

    expect(scope.level).toBe("县级账户");
    expect(scope.coverage).toBe("12 / 14 项已核定");
    expect(scope.internalFlowElimination).toBe("不适用");
  });

  it("returns scope-specific balance metrics", () => {
    expect(getSupplyBalanceMetrics("qiqihar")[0].value).toBe("763.1");
    expect(getSupplyBalanceMetrics("nehe")[0].value).not.toBe("763.1");
  });

  it("marks incomplete county accounts without changing the city status", () => {
    expect(
      supplyBalanceScopes.some((scope) => scope.status === "待补数据"),
    ).toBe(true);
    expect(getSupplyBalanceScope("qiqihar").status).toBe("已核定");
  });

  it("falls back to the city account for an unknown route value", () => {
    expect(getSupplyBalanceScope("unknown").key).toBe("qiqihar");
  });

  it("separates book ending inventory from the inventory balance difference", () => {
    expect(getSupplyBalanceEquation("qiqihar")).toEqual(
      expect.objectContaining({
        totalSupply: "763.1",
        totalUse: "659.2",
        bookEnding: "103.9",
        surveyEnding: "105.6",
        inventoryDifference: "1.7",
      }),
    );
  });
});
