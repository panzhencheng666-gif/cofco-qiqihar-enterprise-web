export interface SupplyAccountInput {
  openingInventory: number;
  localProduction: number;
  externalInflow: number;
  imports: number;
  otherSupply: number;
  foodUse: number;
  feedUse: number;
  seedUse: number;
  processingUse: number;
  loss: number;
  externalOutflow: number;
  exports: number;
  otherUse: number;
  approvedAdjustment: number;
  surveyedEndingInventory: number;
}

export interface SupplyAccountCalculation {
  totalSupply: number;
  totalUse: number;
  calculatedEndingInventory: number;
  approvedAdjustment: number;
  adoptedEndingInventory: number;
  surveyedEndingInventory: number;
  bookDifference: number;
}

export interface SupplyInputRelease {
  source: string;
  approvalStatus: "draft" | "approved";
  qualityStatus: "passed" | "warning" | "blocking";
  required: boolean;
}

export type SupplyResultState = "trial" | "formal-candidate" | "formal";

export interface SupplyAccountSnapshotRecord {
  label: string;
  resultState: SupplyResultState;
  calculation: Readonly<SupplyAccountCalculation>;
}

function roundOne(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 10) / 10;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function assertFiniteInput(input: SupplyAccountInput): void {
  for (const [field, value] of Object.entries(input)) {
    if (!Number.isFinite(value)) {
      throw new Error(`供需计算输入“${field}”必须是有效数字`);
    }
  }
}

export function calculateSupplyAccount(
  input: SupplyAccountInput,
): SupplyAccountCalculation {
  assertFiniteInput(input);
  const totalSupply = roundOne(
    input.openingInventory +
      input.localProduction +
      input.externalInflow +
      input.imports +
      input.otherSupply,
  );
  const totalUse = roundOne(
    input.foodUse +
      input.feedUse +
      input.seedUse +
      input.processingUse +
      input.loss +
      input.externalOutflow +
      input.exports +
      input.otherUse,
  );
  const calculatedEndingInventory = roundOne(totalSupply - totalUse);
  const adoptedEndingInventory = roundOne(
    calculatedEndingInventory + input.approvedAdjustment,
  );
  return {
    totalSupply,
    totalUse,
    calculatedEndingInventory,
    approvedAdjustment: roundOne(input.approvedAdjustment),
    adoptedEndingInventory,
    surveyedEndingInventory: roundOne(input.surveyedEndingInventory),
    bookDifference: roundOne(
      adoptedEndingInventory - input.surveyedEndingInventory,
    ),
  };
}

export function resolveSupplyResultState(
  inputs: readonly SupplyInputRelease[],
  publishApproved: boolean,
): SupplyResultState {
  const requiredInputs = inputs.filter(({ required }) => required);
  const qualified =
    requiredInputs.length > 0 &&
    requiredInputs.every(
      ({ approvalStatus, qualityStatus }) =>
        approvalStatus === "approved" && qualityStatus !== "blocking",
    );
  if (!qualified) return "trial";
  return publishApproved ? "formal" : "formal-candidate";
}

export function createSupplyAccountSnapshot(
  label: string,
  input: SupplyAccountInput,
  resultState: SupplyResultState,
): Readonly<SupplyAccountSnapshotRecord> {
  const calculation = Object.freeze(calculateSupplyAccount(input));
  return Object.freeze({ label, resultState, calculation });
}
