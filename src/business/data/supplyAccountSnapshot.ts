import {
  calculateSupplyAccount,
  resolveSupplyResultState,
  type SupplyAccountCalculation,
  type SupplyInputRelease,
  type SupplyResultState,
} from "../core/supplyAccountEngine";

export type SupplyAccountTone = "normal" | "good" | "warning" | "danger";

export type SupplyAccountGroup = "供给" | "使用与外流" | "期末与核对";

export interface SupplyAccountRow {
  group: SupplyAccountGroup;
  item: string;
  current: number;
  previous: number;
  sourceBusiness: string;
  sourceBatchLabel: string;
  status: string;
  tone: SupplyAccountTone;
  total?: boolean;
}

export interface SupplyAccountComparisonRow {
  label: string;
  unit: "万吨";
  values: readonly [number, number, number, number];
  tone: SupplyAccountTone;
}

export interface SupplyAccountEquationValues {
  totalSupply: number;
  totalUse: number;
  bookEnding: number;
  approvedAdjustment: number;
  adoptedEnding: number;
  surveyEnding: number;
  inventoryDifference: number;
}

export interface SupplyAccountConclusion {
  bookClosureStatus: "closed" | "not-closed";
  bookClosureLabel: string;
  bookClosureDetail: string;
  reconciliationCalculationValid: boolean;
  reconciliationStatus:
    "calculation-error" | "within-tolerance" | "explanation-required";
  reconciliationLabel: string;
  reconciliationDetail: string;
  reconciliationAction: string;
  tolerance: number;
  tone: SupplyAccountTone;
}

export interface SupplyAccountReconciliationDecision {
  explanationStatus: "approved";
  explanationLabel: string;
  explanationReferenceLabel: string;
  approvedBy: string;
  approvedAt: string;
  reportEligible: true;
  nextAction: string;
}

export interface SupplyAccountSnapshot {
  regionId: "qiqihar-all";
  regionLabel: "齐齐哈尔市全域";
  productId: "corn" | "soybean" | "paddy";
  productLabel: string;
  marketingYearId: "2026-27";
  marketingYearLabel: "2026/27 营销年度";
  accountVersionId: string;
  approvalId: "approval-3";
  approvalLabel: "第3次核定（当前采用）";
  dataCutoff: "2026年7月31日 17:00";
  accountLabel: string;
  resultState: SupplyResultState;
  calculation: Readonly<SupplyAccountCalculation>;
  inputReleases: readonly SupplyInputRelease[];
  balanceRows: readonly SupplyAccountRow[];
  equation: SupplyAccountEquationValues;
  conclusion: SupplyAccountConclusion;
  reconciliationDecision: SupplyAccountReconciliationDecision;
  comparisonRows: readonly SupplyAccountComparisonRow[];
}

type BaseSupplyAccountRow = Omit<SupplyAccountRow, "total">;

function roundOne(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export const supplyInventoryDifferenceTolerance = 0.5;

export function deriveSupplyAccountConclusion(
  equation: SupplyAccountEquationValues,
  tolerance = supplyInventoryDifferenceTolerance,
): SupplyAccountConclusion {
  if (!Number.isFinite(tolerance) || tolerance < 0)
    throw new Error("库存差额说明线必须是非负数");
  const calculatedBookEnding = roundOne(
    equation.totalSupply - equation.totalUse,
  );
  const calculatedAdoptedEnding = roundOne(
    equation.bookEnding + equation.approvedAdjustment,
  );
  const calculatedInventoryDifference = roundOne(
    equation.surveyEnding - equation.adoptedEnding,
  );
  const bookClosed =
    calculatedBookEnding === equation.bookEnding &&
    calculatedAdoptedEnding === equation.adoptedEnding;
  const reconciliationCalculationValid =
    calculatedInventoryDifference === equation.inventoryDifference;
  const requiresExplanation =
    Math.abs(equation.inventoryDifference) > tolerance;
  return {
    bookClosureStatus: bookClosed ? "closed" : "not-closed",
    bookClosureLabel: bookClosed ? "账面公式已闭合" : "账面公式未闭合",
    bookClosureDetail: bookClosed
      ? "总供给减总使用与外流等于账面期末库存，批准调整后结果与账面一致。"
      : "账面期末、批准调整或调查差额之间存在计算不一致，不能进入复核。",
    reconciliationCalculationValid,
    reconciliationStatus: !reconciliationCalculationValid
      ? "calculation-error"
      : requiresExplanation
        ? "explanation-required"
        : "within-tolerance",
    reconciliationLabel: !reconciliationCalculationValid
      ? "库存核对计算不一致"
      : requiresExplanation
        ? "库存差额超出说明线"
        : "库存差额处于说明线以内",
    reconciliationDetail: !reconciliationCalculationValid
      ? `调查库存减采用后账面库存应为${calculatedInventoryDifference.toFixed(1)}万吨，当前记录为${equation.inventoryDifference.toFixed(1)}万吨。`
      : `调查库存与采用后账面库存相差${Math.abs(equation.inventoryDifference).toFixed(1)}万吨，说明线为${tolerance.toFixed(1)}万吨。`,
    reconciliationAction: !bookClosed
      ? "先修正账面公式，再进行库存核对"
      : !reconciliationCalculationValid
        ? "修正库存核对计算后重新判断差额"
        : requiresExplanation
          ? "补充差异原因和处置意见后提交复核"
          : "可按当前账面结果提交复核",
    tolerance,
    tone:
      !bookClosed || !reconciliationCalculationValid
        ? "danger"
        : requiresExplanation
          ? "warning"
          : "good",
  };
}

function sumRows(
  rows: readonly BaseSupplyAccountRow[],
  field: "current" | "previous",
): number {
  return roundOne(rows.reduce((total, row) => total + row[field], 0));
}

function derivedRow(
  group: SupplyAccountGroup,
  item: string,
  current: number,
  previous: number,
  status: string,
  tone: SupplyAccountTone,
): SupplyAccountRow {
  return {
    group,
    item,
    current: roundOne(current),
    previous: roundOne(previous),
    sourceBusiness: "供需平衡测算",
    sourceBatchLabel: "2026/27营销年度第3次核定",
    status,
    tone,
    total: true,
  };
}

const supplyInputs: readonly BaseSupplyAccountRow[] = [
  {
    group: "供给",
    item: "期初库存",
    current: 126.4,
    previous: 121.8,
    sourceBusiness: "上期供需平衡",
    sourceBatchLabel: "2025/26营销年度期末库存已核定数据",
    status: "已采用",
    tone: "good",
  },
  {
    group: "供给",
    item: "本地生产",
    current: 512.8,
    previous: 498.6,
    sourceBusiness: "产情监测",
    sourceBatchLabel: "2026年第30周产量已核定数据",
    status: "已采用",
    tone: "good",
  },
  {
    group: "供给",
    item: "区域外流入",
    current: 118.7,
    previous: 114.3,
    sourceBusiness: "市场监测 · 物流",
    sourceBatchLabel: "2026年第31周区域流入已核定数据",
    status: "已采用",
    tone: "good",
  },
  {
    group: "供给",
    item: "国际进口",
    current: 5.2,
    previous: 4.9,
    sourceBusiness: "市场监测 · 进口",
    sourceBatchLabel: "2026年第31周进口已核定数据",
    status: "已采用",
    tone: "good",
  },
  {
    group: "供给",
    item: "其他供给",
    current: 0,
    previous: 0,
    sourceBusiness: "供需调整",
    sourceBatchLabel: "2026/27营销年度第3次核定",
    status: "已核定",
    tone: "normal",
  },
];

const useInputs: readonly BaseSupplyAccountRow[] = [
  {
    group: "使用与外流",
    item: "口粮消费",
    current: 32.4,
    previous: 33.1,
    sourceBusiness: "消费采用值",
    sourceBatchLabel: "2026/27营销年度消费已核定数据",
    status: "已采用",
    tone: "good",
  },
  {
    group: "使用与外流",
    item: "饲用消费",
    current: 176.8,
    previous: 170.4,
    sourceBusiness: "市场监测 · 饲料养殖",
    sourceBatchLabel: "2026年第31周饲用消费已核定数据",
    status: "已采用",
    tone: "good",
  },
  {
    group: "使用与外流",
    item: "种用消费",
    current: 7.6,
    previous: 7.3,
    sourceBusiness: "产情监测 · 用种",
    sourceBatchLabel: "2026年播种用种已核定数据",
    status: "已采用",
    tone: "good",
  },
  {
    group: "使用与外流",
    item: "加工投入",
    current: 321.7,
    previous: 308.9,
    sourceBusiness: "市场监测 · 加工",
    sourceBatchLabel: "2026年第31周加工投入已核定数据",
    status: "已采用",
    tone: "good",
  },
  {
    group: "使用与外流",
    item: "损耗",
    current: 18.6,
    previous: 17.9,
    sourceBusiness: "产情与市场监测",
    sourceBatchLabel: "2026/27营销年度损耗已核定数据",
    status: "已采用",
    tone: "good",
  },
  {
    group: "使用与外流",
    item: "区域外流出",
    current: 95.1,
    previous: 91.7,
    sourceBusiness: "市场监测 · 物流",
    sourceBatchLabel: "2026年第31周区域流出已核定数据",
    status: "已采用",
    tone: "good",
  },
  {
    group: "使用与外流",
    item: "国际出口",
    current: 6,
    previous: 5.7,
    sourceBusiness: "市场监测 · 出口",
    sourceBatchLabel: "2026年第31周出口已核定数据",
    status: "已采用",
    tone: "good",
  },
  {
    group: "使用与外流",
    item: "其他使用",
    current: 1,
    previous: 0.8,
    sourceBusiness: "供需调整",
    sourceBatchLabel: "2026/27营销年度第3次核定",
    status: "已核定",
    tone: "normal",
  },
];

const totalSupply = sumRows(supplyInputs, "current");
const previousTotalSupply = sumRows(supplyInputs, "previous");
const totalUse = sumRows(useInputs, "current");
const previousTotalUse = sumRows(useInputs, "previous");
const calculation = Object.freeze(
  calculateSupplyAccount({
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
  }),
);
const inputReleases: readonly SupplyInputRelease[] = Object.freeze([
  {
    source: "上年度供需账户期末库存",
    approvalStatus: "approved",
    qualityStatus: "passed",
    required: true,
  },
  {
    source: "产情监测已核定产量与用种",
    approvalStatus: "approved",
    qualityStatus: "passed",
    required: true,
  },
  {
    source: "市场监测已核定消费、加工与库存",
    approvalStatus: "approved",
    qualityStatus: "warning",
    required: true,
  },
  {
    source: "物流监测已核定流入与流出",
    approvalStatus: "approved",
    qualityStatus: "passed",
    required: true,
  },
  {
    source: "库存调整审批记录",
    approvalStatus: "approved",
    qualityStatus: "passed",
    required: true,
  },
]);
const resultState = resolveSupplyResultState(inputReleases, true);
const bookEnding = calculation.calculatedEndingInventory;
const previousBookEnding = roundOne(previousTotalSupply - previousTotalUse);
const approvedAdjustment = calculation.approvedAdjustment;
const previousApprovedAdjustment = 0;
const adoptedEnding = calculation.adoptedEndingInventory;
const previousAdoptedEnding = roundOne(
  previousBookEnding + previousApprovedAdjustment,
);
const surveyEnding = calculation.surveyedEndingInventory;
const previousSurveyEnding = 104.2;
const inventoryDifference = roundOne(-calculation.bookDifference);
const previousInventoryDifference = roundOne(
  previousSurveyEnding - previousAdoptedEnding,
);
const equation: SupplyAccountEquationValues = Object.freeze({
  totalSupply,
  totalUse,
  bookEnding,
  approvedAdjustment,
  adoptedEnding,
  surveyEnding,
  inventoryDifference,
});
const conclusion = Object.freeze(deriveSupplyAccountConclusion(equation));

const reconciliationRows: readonly SupplyAccountRow[] = [
  derivedRow(
    "期末与核对",
    "调整前账面期末",
    bookEnding,
    previousBookEnding,
    "已计算",
    "good",
  ),
  {
    group: "期末与核对",
    item: "批准库存调整",
    current: approvedAdjustment,
    previous: previousApprovedAdjustment,
    sourceBusiness: "库存调整审批",
    sourceBatchLabel: "2026/27营销年度第3次核定",
    status: "已批准",
    tone: "good",
  },
  derivedRow(
    "期末与核对",
    "采用后账面期末",
    adoptedEnding,
    previousAdoptedEnding,
    "候选期初",
    "good",
  ),
  {
    group: "期末与核对",
    item: "调查汇总期末",
    current: surveyEnding,
    previous: previousSurveyEnding,
    sourceBusiness: "市场与产情库存调查",
    sourceBatchLabel: "2026年第31周库存调查已核定数据",
    status: "待核对",
    tone: "warning",
  },
  derivedRow(
    "期末与核对",
    "库存平衡差额",
    inventoryDifference,
    previousInventoryDifference,
    conclusion.reconciliationLabel,
    conclusion.tone,
  ),
];

const balanceRows: readonly SupplyAccountRow[] = Object.freeze([
  ...supplyInputs,
  derivedRow(
    "供给",
    "总供给",
    totalSupply,
    previousTotalSupply,
    "已计算",
    "good",
  ),
  ...useInputs,
  derivedRow(
    "使用与外流",
    "总使用与外流",
    totalUse,
    previousTotalUse,
    "已计算",
    "good",
  ),
  ...reconciliationRows,
]);

const comparisonRows: readonly SupplyAccountComparisonRow[] = Object.freeze([
  {
    label: "总供给",
    unit: "万吨",
    values: [701.4, 722.8, previousTotalSupply, totalSupply],
    tone: "good",
  },
  {
    label: "总使用与外流",
    unit: "万吨",
    values: [605.2, 619.4, previousTotalUse, totalUse],
    tone: "good",
  },
  {
    label: "账面期末库存",
    unit: "万吨",
    values: [96.2, 103.4, previousBookEnding, bookEnding],
    tone: "normal",
  },
  {
    label: "调查库存差额",
    unit: "万吨",
    values: [0.6, 0.8, previousInventoryDifference, inventoryDifference],
    tone: "warning",
  },
]);

export const qiqiharCornSupplyAccountSnapshot: SupplyAccountSnapshot =
  Object.freeze({
    regionId: "qiqihar-all",
    regionLabel: "齐齐哈尔市全域",
    productId: "corn",
    productLabel: "玉米原粮",
    marketingYearId: "2026-27",
    marketingYearLabel: "2026/27 营销年度",
    accountVersionId: "ACCOUNT-VERSION-CORN-2026-3",
    approvalId: "approval-3",
    approvalLabel: "第3次核定（当前采用）",
    dataCutoff: "2026年7月31日 17:00",
    accountLabel: "2026/27 营销年度市级合并账户",
    resultState,
    calculation,
    inputReleases,
    balanceRows,
    equation,
    conclusion,
    reconciliationDecision: Object.freeze({
      explanationStatus: "approved",
      explanationLabel: "库存核对已通过",
      explanationReferenceLabel: "第3次核定库存调整审批记录",
      approvedBy: "赵晨",
      approvedAt: "2026年7月31日 16:10",
      reportEligible: true,
      nextAction: "以采用后账面期末库存编制正式报告",
    }),
    comparisonRows,
  });

function scaledAccountRows(
  factor: number,
  equation: SupplyAccountEquationValues,
  conclusion: SupplyAccountConclusion,
): readonly SupplyAccountRow[] {
  const scaled = (value: number) => roundOne(value * factor);
  return Object.freeze(
    balanceRows.map((row) => {
      const calculatedCurrent: Partial<Record<string, number>> = {
        总供给: equation.totalSupply,
        总使用与外流: equation.totalUse,
        调整前账面期末: equation.bookEnding,
        批准库存调整: equation.approvedAdjustment,
        采用后账面期末: equation.adoptedEnding,
        调查汇总期末: equation.surveyEnding,
        库存平衡差额: equation.inventoryDifference,
      };
      return Object.freeze({
        ...row,
        current: calculatedCurrent[row.item] ?? scaled(row.current),
        previous: scaled(row.previous),
        ...(row.item === "库存平衡差额"
          ? {
              status: conclusion.reconciliationLabel,
              tone: conclusion.tone,
            }
          : {}),
      });
    }),
  );
}

function scaledSupplyAccountSnapshot({
  productId,
  productLabel,
  accountVersionId,
  factor,
}: {
  productId: "soybean" | "paddy";
  productLabel: string;
  accountVersionId: string;
  factor: number;
}): SupplyAccountSnapshot {
  const scaled = (value: number) => roundOne(value * factor);
  const totalSupply = scaled(equation.totalSupply);
  const totalUse = scaled(equation.totalUse);
  const bookEnding = roundOne(totalSupply - totalUse);
  const approvedAdjustment = scaled(equation.approvedAdjustment);
  const adoptedEnding = roundOne(bookEnding + approvedAdjustment);
  const surveyEnding = scaled(equation.surveyEnding);
  const inventoryDifference = roundOne(surveyEnding - adoptedEnding);
  const productEquation: SupplyAccountEquationValues = Object.freeze({
    totalSupply,
    totalUse,
    bookEnding,
    approvedAdjustment,
    adoptedEnding,
    surveyEnding,
    inventoryDifference,
  });
  const productConclusion = Object.freeze(
    deriveSupplyAccountConclusion(productEquation),
  );
  const productCalculation: SupplyAccountCalculation = Object.freeze({
    totalSupply,
    totalUse,
    calculatedEndingInventory: bookEnding,
    approvedAdjustment,
    adoptedEndingInventory: adoptedEnding,
    surveyedEndingInventory: surveyEnding,
    bookDifference: roundOne(adoptedEnding - surveyEnding),
  });
  const productComparisonRows = Object.freeze(
    comparisonRows.map((row) =>
      Object.freeze({
        ...row,
        values: row.values.map(scaled) as unknown as readonly [
          number,
          number,
          number,
          number,
        ],
      }),
    ),
  );

  return Object.freeze({
    ...qiqiharCornSupplyAccountSnapshot,
    productId,
    productLabel,
    accountVersionId,
    accountLabel: `2026/27 营销年度${productLabel}市级合并账户`,
    calculation: productCalculation,
    balanceRows: scaledAccountRows(factor, productEquation, productConclusion),
    equation: productEquation,
    conclusion: productConclusion,
    comparisonRows: productComparisonRows,
  });
}

export const qiqiharSoybeanSupplyAccountSnapshot = scaledSupplyAccountSnapshot({
  productId: "soybean",
  productLabel: "大豆原粮",
  accountVersionId: "ACCOUNT-VERSION-SOYBEAN-2026-3",
  factor: 0.1542,
});

export const qiqiharPaddySupplyAccountSnapshot = scaledSupplyAccountSnapshot({
  productId: "paddy",
  productLabel: "稻谷原粮",
  accountVersionId: "ACCOUNT-VERSION-PADDY-2026-3",
  factor: 0.3282,
});

export const qiqiharSupplyAccountSnapshots: readonly SupplyAccountSnapshot[] =
  Object.freeze([
    qiqiharCornSupplyAccountSnapshot,
    qiqiharSoybeanSupplyAccountSnapshot,
    qiqiharPaddySupplyAccountSnapshot,
  ]);

export function formatSupplyAccountAmount(value: number): string {
  return value.toFixed(1);
}
