import { describe, expect, it } from "vitest";

import {
  deriveSupplyAccountConclusion,
  qiqiharCornSupplyAccountSnapshot,
  qiqiharSupplyAccountSnapshots,
} from "./supplyAccountSnapshot";

describe("approved supply account snapshot", () => {
  it("derives totals and reconciliation from one set of account inputs", () => {
    const { equation, balanceRows } = qiqiharCornSupplyAccountSnapshot;
    expect(equation).toEqual({
      totalSupply: 763.1,
      totalUse: 659.2,
      bookEnding: 103.9,
      approvedAdjustment: 1.2,
      adoptedEnding: 105.1,
      surveyEnding: 105.6,
      inventoryDifference: 0.5,
    });
    expect(qiqiharCornSupplyAccountSnapshot.resultState).toBe("formal");
    expect(qiqiharCornSupplyAccountSnapshot.calculation.bookDifference).toBe(
      -0.5,
    );
    expect(
      qiqiharCornSupplyAccountSnapshot.inputReleases.every(
        ({ approvalStatus, qualityStatus }) =>
          approvalStatus === "approved" && qualityStatus !== "blocking",
      ),
    ).toBe(true);
    expect(balanceRows.find(({ item }) => item === "总供给")?.current).toBe(
      equation.totalSupply,
    );
    expect(
      balanceRows.find(({ item }) => item === "总使用与外流")?.current,
    ).toBe(equation.totalUse);
    expect(
      balanceRows.find(({ item }) => item === "采用后账面期末")?.current,
    ).toBe(equation.adoptedEnding);
    expect(
      balanceRows.find(({ item }) => item === "库存平衡差额")?.current,
    ).toBe(equation.inventoryDifference);
  });

  it("uses the same current account facts in the four-year comparison", () => {
    const { equation, comparisonRows } = qiqiharCornSupplyAccountSnapshot;
    expect(
      comparisonRows.find(({ label }) => label === "总供给")?.values.at(-1),
    ).toBe(equation.totalSupply);
    expect(
      comparisonRows
        .find(({ label }) => label === "总使用与外流")
        ?.values.at(-1),
    ).toBe(equation.totalUse);
    expect(
      comparisonRows
        .find(({ label }) => label === "账面期末库存")
        ?.values.at(-1),
    ).toBe(equation.bookEnding);
    expect(
      comparisonRows
        .find(({ label }) => label === "调查库存差额")
        ?.values.at(-1),
    ).toBe(equation.inventoryDifference);
  });

  it("keeps the corn, soybean and paddy accounts independently closed", () => {
    expect(
      qiqiharSupplyAccountSnapshots.map(({ productId }) => productId),
    ).toEqual(["corn", "soybean", "paddy"]);

    for (const snapshot of qiqiharSupplyAccountSnapshots) {
      expect(snapshot.equation.bookEnding).toBe(
        Number(
          (snapshot.equation.totalSupply - snapshot.equation.totalUse).toFixed(
            1,
          ),
        ),
      );
      expect(snapshot.equation.adoptedEnding).toBe(
        Number(
          (
            snapshot.equation.bookEnding + snapshot.equation.approvedAdjustment
          ).toFixed(1),
        ),
      );
      expect(snapshot.conclusion.bookClosureStatus).toBe("closed");
      expect(snapshot.resultState).toBe("formal");
      expect(
        snapshot.comparisonRows
          .find(({ label }) => label === "总供给")
          ?.values.at(-1),
      ).toBe(snapshot.equation.totalSupply);
    }
  });

  it("derives the business conclusion from equation closure and the governed tolerance", () => {
    const { conclusion, reconciliationDecision } =
      qiqiharCornSupplyAccountSnapshot;

    expect(conclusion).toMatchObject({
      bookClosureStatus: "closed",
      bookClosureLabel: "账面公式已闭合",
      reconciliationCalculationValid: true,
      reconciliationStatus: "within-tolerance",
      reconciliationLabel: "库存差额处于说明线以内",
      reconciliationAction: "可按当前账面结果提交复核",
      tolerance: 0.5,
      tone: "good",
    });
    expect(conclusion.reconciliationDetail).toBe(
      "调查库存与采用后账面库存相差0.5万吨，说明线为0.5万吨。",
    );
    expect(reconciliationDecision).toMatchObject({
      explanationStatus: "approved",
      explanationLabel: "库存核对已通过",
      reportEligible: true,
      nextAction: "以采用后账面期末库存编制正式报告",
    });
  });

  it("returns a within-tolerance conclusion without hardcoded status text", () => {
    expect(
      deriveSupplyAccountConclusion({
        totalSupply: 763.1,
        totalUse: 659.2,
        bookEnding: 103.9,
        approvedAdjustment: 0,
        adoptedEnding: 103.9,
        surveyEnding: 104.2,
        inventoryDifference: 0.3,
      }),
    ).toMatchObject({
      bookClosureStatus: "closed",
      reconciliationStatus: "within-tolerance",
      reconciliationLabel: "库存差额处于说明线以内",
      reconciliationAction: "可按当前账面结果提交复核",
      tone: "good",
    });
  });

  it("keeps book closure separate from inventory reconciliation arithmetic", () => {
    expect(
      deriveSupplyAccountConclusion({
        totalSupply: 763.1,
        totalUse: 659.2,
        bookEnding: 103.9,
        approvedAdjustment: 0,
        adoptedEnding: 103.9,
        surveyEnding: 105.6,
        inventoryDifference: 1.6,
      }),
    ).toMatchObject({
      bookClosureStatus: "closed",
      reconciliationCalculationValid: false,
      reconciliationStatus: "calculation-error",
      reconciliationLabel: "库存核对计算不一致",
      reconciliationAction: "修正库存核对计算后重新判断差额",
      tone: "danger",
    });
  });
});
