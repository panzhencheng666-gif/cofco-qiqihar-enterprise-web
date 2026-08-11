import { describe, expect, it } from "vitest";

import {
  calculateSupplyAccount,
  createSupplyAccountSnapshot,
  resolveSupplyResultState,
} from "./supplyAccountEngine";

const approvedInput = {
  openingInventory: 126.4,
  localProduction: 512.8,
  externalInflow: 118.7,
  imports: 5.2,
  otherSupply: 0,
  foodUse: 32.4,
  feedUse: 176.8,
  seedUse: 7.6,
  processingUse: 321.7,
  loss: 18.6,
  externalOutflow: 95.1,
  exports: 6,
  otherUse: 1,
  approvedAdjustment: 1.2,
  surveyedEndingInventory: 105.6,
} as const;

describe("supply account engine", () => {
  it("calculates the governed supply equation with one-decimal precision", () => {
    expect(calculateSupplyAccount(approvedInput)).toEqual({
      totalSupply: 763.1,
      totalUse: 659.2,
      calculatedEndingInventory: 103.9,
      approvedAdjustment: 1.2,
      adoptedEndingInventory: 105.1,
      surveyedEndingInventory: 105.6,
      bookDifference: -0.5,
    });
  });

  it("classifies drafts, qualified candidates and approved publication separately", () => {
    const qualifiedInputs = [
      {
        source: "产情监测",
        approvalStatus: "approved" as const,
        qualityStatus: "passed" as const,
        required: true,
      },
      {
        source: "市场与物流监测",
        approvalStatus: "approved" as const,
        qualityStatus: "warning" as const,
        required: true,
      },
    ];

    expect(resolveSupplyResultState(qualifiedInputs, false)).toBe(
      "formal-candidate",
    );
    expect(resolveSupplyResultState(qualifiedInputs, true)).toBe("formal");
    expect(
      resolveSupplyResultState(
        qualifiedInputs.map((input, index) =>
          index === 0 ? { ...input, approvalStatus: "draft" as const } : input,
        ),
        true,
      ),
    ).toBe("trial");
    expect(
      resolveSupplyResultState(
        qualifiedInputs.map((input, index) =>
          index === 0
            ? { ...input, qualityStatus: "blocking" as const }
            : input,
        ),
        true,
      ),
    ).toBe("trial");
  });

  it("keeps a formal snapshot immutable when a later draft creates a trial", () => {
    const formal = createSupplyAccountSnapshot(
      "正式结果",
      approvedInput,
      "formal",
    );
    const trial = createSupplyAccountSnapshot(
      "试算结果",
      { ...approvedInput, localProduction: 520 },
      "trial",
    );

    expect(Object.isFrozen(formal)).toBe(true);
    expect(formal.calculation.totalSupply).toBe(763.1);
    expect(trial.calculation.totalSupply).toBe(770.3);
    expect(formal.calculation.totalSupply).toBe(763.1);
  });
});
