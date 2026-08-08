export type ProductAccountKey = "corn" | "soybean" | "paddy" | "rice";
export type BalanceSection =
  "供给" | "需求" | "库存勾稽" | "政策账户备查" | "备查分项";
export type BalanceGeneration = "发布指标对应" | "系统公式计算" | "已批准调整";
export type BalanceInput =
  | { state: "有值"; scaledValue: number }
  | { state: "真实为零"; scaledValue: 0 }
  | { state: "缺失" }
  | { state: "不适用" }
  | { state: "暂估"; estimatedScaledValue: number }
  | { state: "质量阻断" };
export type BalanceInputState = BalanceInput["state"];

export type MetricValueId = `metric-value:${string}`;
export type MetricReleaseVersionId = `metric-release:${string}`;
export type AccountRoleMappingId = `account-role-mapping:${string}`;
export type ProcessingRunId = `processing-run:${string}`;
export type ConversionRuleVersionId = `conversion-rule:${string}`;

interface SupplyBalanceRowBase {
  role: string;
  section: BalanceSection;
  label: string;
  unit: "万吨";
  generation: BalanceGeneration;
  source: string;
  quality: "通过" | "待复核";
  input: BalanceInput;
  countingRule: string;
  processingRunId?: ProcessingRunId;
  conversionRuleVersionId?: ConversionRuleVersionId;
}

export interface AdditiveSupplyBalanceRow extends SupplyBalanceRowBase {
  accountingSide: "supply" | "demand";
  metricValueId: MetricValueId;
  metricReleaseVersionId: MetricReleaseVersionId;
  accountRoleMappingId: AccountRoleMappingId;
}

export interface ReferenceSupplyBalanceRow extends SupplyBalanceRowBase {
  accountingSide?: never;
}

export type SupplyBalanceRow =
  AdditiveSupplyBalanceRow | ReferenceSupplyBalanceRow;

export interface ProductAccount {
  accountKey: ProductAccountKey;
  accountName: string;
  productName: string;
  versionName: string;
  status: "演示结果已生成" | "演示待复核";
  metricReleaseVersions: readonly string[];
  metricReleaseVersionIds: readonly MetricReleaseVersionId[];
  formulaVersionId: `formula-version:${string}`;
  formulaVersionName: string;
  calculationRunId: `calculation-run:${string}`;
  resultVersionId: `result-version:${string}`;
  resultVersionName: string;
  inputSetValidationId: `input-set-validation:${string}`;
  accountStandardVersion: string;
  inventoryMatrixVersion: string;
  rows: readonly SupplyBalanceRow[];
}

function row(
  role: string,
  section: BalanceSection,
  label: string,
  scaledValue: number,
  options: {
    generation?: BalanceGeneration;
    source?: string;
    quality?: "通过" | "待复核";
    input?: BalanceInput;
    accountingSide?: "supply" | "demand";
    countingRule?: string;
    processingRunId?: ProcessingRunId;
    conversionRuleVersionId?: ConversionRuleVersionId;
  } = {},
): SupplyBalanceRow {
  const base = {
    role,
    section,
    label,
    unit: "万吨" as const,
    generation: options.generation ?? "发布指标对应",
    source: options.source ?? "演示输入 · 预置演示指标版本",
    quality: options.quality ?? "通过",
    input:
      options.input ??
      (scaledValue === 0
        ? ({ state: "真实为零", scaledValue: 0 } as const)
        : ({ state: "有值", scaledValue } as const)),
    countingRule:
      options.countingRule ?? "该指标只映射一个账户角色，不与其他指标重复。",
    processingRunId: options.processingRunId,
    conversionRuleVersionId: options.conversionRuleVersionId,
  };

  if (!options.accountingSide) return base;

  const accountKey = role.split("-")[0] as ProductAccountKey;
  return {
    ...base,
    accountingSide: options.accountingSide,
    metricValueId: `metric-value:${role}`,
    metricReleaseVersionId: `metric-release:${accountKey}`,
    accountRoleMappingId: `account-role-mapping:${accountKey}:${role}`,
  };
}

function totalRow(
  role: string,
  section: BalanceSection,
  label: string,
  scaledValue: number,
  countingRule: string,
): SupplyBalanceRow {
  return row(role, section, label, scaledValue, {
    generation: "系统公式计算",
    source: "当前演示账户分项",
    countingRule,
  });
}

const corn: ProductAccount = {
  accountKey: "corn",
  accountName: "玉米产品账户",
  productName: "玉米",
  versionName: "2026 年第 3 版",
  status: "演示结果已生成",
  metricReleaseVersions: ["玉米指标发布第 7 版"],
  metricReleaseVersionIds: ["metric-release:corn"],
  formulaVersionId: "formula-version:corn-v3",
  formulaVersionName: "玉米供需公式第 3 版",
  calculationRunId: "calculation-run:corn-2026-v3",
  resultVersionId: "result-version:corn-2026-v3",
  resultVersionName: "玉米账户演示结果第 3 版",
  inputSetValidationId: "input-set-validation:corn-2026-v3",
  accountStandardVersion: "玉米原粮账户规范第 3 版",
  inventoryMatrixVersion: "区域库存合并矩阵第 4 版",
  rows: [
    row("corn-commercial-opening", "供给", "商业期初库存", 286, {
      accountingSide: "supply",
    }),
    row("corn-policy-opening", "供给", "政策期初库存", 154, {
      accountingSide: "supply",
      countingRule:
        "国产政策库存与进口政策库存是本指标分项，不得再次计入总供给。",
    }),
    row(
      "corn-policy-domestic-opening",
      "备查分项",
      "其中：政策国产玉米期初库存",
      121,
    ),
    row(
      "corn-policy-imported-opening",
      "备查分项",
      "其中：政策进口玉米期初库存",
      33,
    ),
    totalRow(
      "opening-total",
      "备查分项",
      "期初库存（商业＋政策）",
      440,
      "商业期初库存＋政策期初库存，仅作期初结构校验。",
    ),
    row("corn-production", "供给", "玉米产量", 5012, {
      accountingSide: "supply",
      source: "演示输入 · 预置演示指标版本 · 产情产量",
    }),
    row("corn-area", "备查分项", "玉米种植面积", 3320, {
      source: "演示输入 · 产情监测面积指标",
    }),
    row("corn-yield", "备查分项", "玉米单产", 151, {
      source: "产量÷面积的受控公式",
    }),
    row("corn-inflow", "供给", "国内玉米流入量", 2179, {
      accountingSide: "supply",
      source: "演示输入 · 预置演示指标版本 · 区域流入",
      countingRule:
        "铁路与公路是运输方式分项，由唯一运输事件汇总，不得重复计入。",
    }),
    row("corn-rail-inflow", "备查分项", "其中：铁路流入", 924),
    row("corn-road-inflow", "备查分项", "其中：公路流入", 1255),
    totalRow(
      "total-supply",
      "供给",
      "总供给",
      7631,
      "商业期初库存＋政策期初库存＋产量＋国内流入量。",
    ),
    row("corn-feed-use", "需求", "饲料需求", 4203, {
      accountingSide: "demand",
    }),
    row("corn-processing-use", "需求", "加工投料", 1156, {
      accountingSide: "demand",
      countingRule:
        "淀粉、酒精、食品等用途仅作为加工投料构成，不得再次并列加总。",
    }),
    row("corn-outflow", "需求", "国内玉米流出量", 1233, {
      accountingSide: "demand",
      source: "演示输入 · 预置演示指标版本 · 区域流出",
    }),
    row("corn-rail-outflow", "备查分项", "其中：铁路流出", 482),
    row("corn-road-outflow", "备查分项", "其中：公路流出", 751),
    totalRow(
      "total-demand",
      "需求",
      "总需求",
      6592,
      "直接饲用＋加工投料＋区域外流出。",
    ),
    totalRow(
      "pre-adjustment-closing",
      "库存勾稽",
      "调整前账面推算期末库存",
      1039,
      "总供给－总需求。",
    ),
    row("approved-inventory-adjustment", "库存勾稽", "已批准库存调整", 0, {
      generation: "已批准调整",
      source: "库存调整批准记录",
      countingRule: "只有完成质量、覆盖率、去重和勾稽审批的差异才能进入。",
    }),
    totalRow(
      "adopted-closing",
      "库存勾稽",
      "采用后账面期末库存",
      1039,
      "调整前账面推算期末库存＋已批准库存调整。",
    ),
    row("survey-closing", "库存勾稽", "调查汇总期末库存", 1039, {
      source: "演示输入 · 已发布库存调查指标版本",
      countingRule: "只作独立调查汇总，不直接覆盖采用后账面期末库存。",
    }),
    totalRow(
      "inventory-balance-difference",
      "库存勾稽",
      "库存平衡差额",
      0,
      "调查汇总期末库存－采用后账面期末库存。",
    ),
  ],
};

const soybean: ProductAccount = {
  accountKey: "soybean",
  accountName: "大豆产品账户",
  productName: "大豆",
  versionName: "2026 年第 2 版",
  status: "演示待复核",
  metricReleaseVersions: ["大豆指标发布第 5 版"],
  metricReleaseVersionIds: ["metric-release:soybean"],
  formulaVersionId: "formula-version:soybean-v2",
  formulaVersionName: "大豆原豆供需公式第 2 版",
  calculationRunId: "calculation-run:soybean-2026-v2",
  resultVersionId: "result-version:soybean-2026-v2",
  resultVersionName: "大豆原豆账户演示结果第 2 版",
  inputSetValidationId: "input-set-validation:soybean-2026-v2",
  accountStandardVersion: "原豆账户规范第 2 版",
  inventoryMatrixVersion: "区域库存合并矩阵第 4 版",
  rows: [
    row("soybean-opening", "供给", "期初库存", 240, {
      accountingSide: "supply",
    }),
    row("soybean-area", "备查分项", "播种面积", 980),
    row("soybean-production", "供给", "产量", 1680, {
      accountingSide: "supply",
    }),
    row("soybean-reserve-release", "政策账户备查", "储备投放", 60, {
      countingRule:
        "政策体系内部投放不增加区域物理总供给；跨区域部分只进入区域流入。",
    }),
    row("soybean-import", "供给", "大豆进口", 20, {
      accountingSide: "supply",
      countingRule:
        "进口总量作为供给角色；非转基因属性仅作构成说明，不得再次加总。",
    }),
    row("soybean-non-gmo-import", "备查分项", "其中：非转基因大豆进口", 20, {
      countingRule: "本指标是大豆进口的属性分项，不单独进入总供给。",
    }),
    totalRow(
      "total-supply",
      "供给",
      "总供给",
      1940,
      "期初库存＋产量＋大豆进口；政策内部投放不计入。",
    ),
    row("soybean-food-use", "需求", "食用消费", 180, {
      accountingSide: "demand",
    }),
    row("soybean-crushing-use", "需求", "压榨投料", 850, {
      accountingSide: "demand",
      countingRule: "仅统计进入压榨工艺的原豆，不得计入蛋白加工用量。",
    }),
    row("soybean-protein-use", "需求", "非压榨蛋白加工投料", 160, {
      accountingSide: "demand",
      countingRule: "仅统计直接蛋白加工原豆，不含已经计入压榨的原豆。",
    }),
    row("soybean-seed-use", "需求", "种用消费", 30, {
      accountingSide: "demand",
    }),
    row("soybean-reserve-purchase", "政策账户备查", "储备收购", 40, {
      countingRule:
        "政策体系内部收购不增加区域物理总使用；跨区域部分只进入区域流出。",
    }),
    row("soybean-outflow", "需求", "外流量", 420, {
      accountingSide: "demand",
    }),
    totalRow(
      "total-demand",
      "需求",
      "总需求",
      1640,
      "直接食用＋压榨投料＋非压榨蛋白加工投料＋种用＋区域外流出。",
    ),
    totalRow(
      "pre-adjustment-closing",
      "库存勾稽",
      "调整前账面推算期末库存",
      300,
      "总供给－总需求。",
    ),
    row("approved-inventory-adjustment", "库存勾稽", "已批准库存调整", 0, {
      generation: "已批准调整",
      source: "库存调整批准记录",
    }),
    totalRow(
      "adopted-closing",
      "库存勾稽",
      "采用后账面期末库存",
      300,
      "调整前账面推算期末库存＋已批准库存调整。",
    ),
    row("survey-closing", "库存勾稽", "调查汇总期末库存", 300, {
      source: "演示输入 · 已发布库存调查指标版本",
    }),
    totalRow(
      "inventory-balance-difference",
      "库存勾稽",
      "库存平衡差额",
      0,
      "调查汇总期末库存－采用后账面期末库存。",
    ),
    row("soybean-policy-closing", "政策账户备查", "其中：政策性库存", 120),
    row("soybean-commercial-closing", "备查分项", "其中：商业库存", 200),
  ],
};

const paddy: ProductAccount = {
  accountKey: "paddy",
  accountName: "稻谷产品账户",
  productName: "稻谷",
  versionName: "2026 年第 1 版",
  status: "演示待复核",
  metricReleaseVersions: ["稻谷指标发布第 4 版"],
  metricReleaseVersionIds: ["metric-release:paddy"],
  formulaVersionId: "formula-version:paddy-v1",
  formulaVersionName: "稻谷供需公式第 1 版",
  calculationRunId: "calculation-run:paddy-2026-v1",
  resultVersionId: "result-version:paddy-2026-v1",
  resultVersionName: "稻谷账户演示结果第 1 版",
  inputSetValidationId: "input-set-validation:paddy-2026-v1",
  accountStandardVersion: "稻谷账户规范第 1 版",
  inventoryMatrixVersion: "区域库存合并矩阵第 4 版",
  rows: [
    row("paddy-opening", "供给", "稻谷期初库存", 120, {
      accountingSide: "supply",
    }),
    row("paddy-area", "备查分项", "种植面积", 760),
    row("paddy-yield", "备查分项", "单产", 191),
    row("paddy-production", "供给", "产量", 1450, {
      accountingSide: "supply",
    }),
    row("paddy-inflow", "供给", "流入", 180, {
      accountingSide: "supply",
    }),
    totalRow("total-supply", "供给", "总供给", 1750, "期初库存＋产量＋流入。"),
    row("paddy-food-use", "需求", "食用加工投料", 980, {
      accountingSide: "demand",
      processingRunId: "processing-run:paddy-to-rice-2026-v1",
      conversionRuleVersionId: "conversion-rule:paddy-to-rice-v1",
      countingRule:
        "进入大米账户的产出按转换规则记录，不能同时作为稻谷和大米供给重复相加。",
    }),
    row("paddy-feed-use", "需求", "饲用", 50, {
      accountingSide: "demand",
    }),
    row("paddy-loss", "需求", "损耗", 40, {
      accountingSide: "demand",
    }),
    row("paddy-seed-use", "需求", "种用", 30, {
      accountingSide: "demand",
    }),
    row("paddy-outflow", "需求", "流出", 250, {
      accountingSide: "demand",
    }),
    totalRow(
      "total-demand",
      "需求",
      "总需求",
      1350,
      "食用加工投料＋饲用＋损耗＋种用＋流出。",
    ),
    totalRow(
      "pre-adjustment-closing",
      "库存勾稽",
      "调整前账面推算期末库存",
      400,
      "总供给－总需求。",
    ),
    row("approved-inventory-adjustment", "库存勾稽", "已批准库存调整", 0, {
      generation: "已批准调整",
      source: "库存调整批准记录",
    }),
    totalRow(
      "adopted-closing",
      "库存勾稽",
      "采用后账面期末库存",
      400,
      "调整前账面推算期末库存＋已批准库存调整。",
    ),
    row("survey-closing", "库存勾稽", "调查汇总期末库存", 400, {
      source: "演示输入 · 已发布库存调查指标版本",
    }),
    totalRow(
      "inventory-balance-difference",
      "库存勾稽",
      "库存平衡差额",
      0,
      "调查汇总期末库存－采用后账面期末库存。",
    ),
    row("paddy-reserve-purchase", "政策账户备查", "托市收购", 90),
    row("paddy-reserve-auction", "政策账户备查", "托市拍卖", 35),
    row("paddy-reserve-closing", "政策账户备查", "其中：储备库存", 80),
    row("paddy-policy-closing", "政策账户备查", "其中：托市库存", 90),
    row("paddy-commercial-closing", "备查分项", "其中：商业库存", 150),
    row("paddy-farmer-closing", "备查分项", "其中：农户库存", 80),
  ],
};

const rice: ProductAccount = {
  accountKey: "rice",
  accountName: "大米产品账户",
  productName: "大米",
  versionName: "2026 年第 1 版",
  status: "演示待复核",
  metricReleaseVersions: ["大米指标发布第 3 版"],
  metricReleaseVersionIds: ["metric-release:rice"],
  formulaVersionId: "formula-version:rice-v1",
  formulaVersionName: "大米供需公式第 1 版",
  calculationRunId: "calculation-run:rice-2026-v1",
  resultVersionId: "result-version:rice-2026-v1",
  resultVersionName: "大米账户演示结果第 1 版",
  inputSetValidationId: "input-set-validation:rice-2026-v1",
  accountStandardVersion: "大米账户规范第 1 版",
  inventoryMatrixVersion: "区域库存合并矩阵第 4 版",
  rows: [
    row("rice-opening", "供给", "期初库存", 70, {
      accountingSide: "supply",
    }),
    row("rice-production", "供给", "稻谷加工产出", 650, {
      accountingSide: "supply",
      processingRunId: "processing-run:paddy-to-rice-2026-v1",
      conversionRuleVersionId: "conversion-rule:paddy-to-rice-v1",
      source: "演示输入 · 预置演示指标版本 · 稻谷加工产出",
      countingRule: "只接收稻谷加工产出，不重复接收稻谷原粮数量。",
    }),
    row("rice-inflow", "供给", "流入", 50, {
      accountingSide: "supply",
    }),
    totalRow(
      "total-supply",
      "供给",
      "总供给",
      770,
      "期初库存＋稻谷加工产出＋流入。",
    ),
    row("rice-food-use", "需求", "食用消费", 600, {
      accountingSide: "demand",
    }),
    row("rice-industrial-use", "需求", "工业消费", 40, {
      accountingSide: "demand",
    }),
    row("rice-outflow", "需求", "流出", 80, {
      accountingSide: "demand",
    }),
    totalRow(
      "total-demand",
      "需求",
      "总需求",
      720,
      "食用消费＋工业消费＋流出。",
    ),
    totalRow(
      "pre-adjustment-closing",
      "库存勾稽",
      "调整前账面推算期末库存",
      50,
      "总供给－总需求。",
    ),
    row("approved-inventory-adjustment", "库存勾稽", "已批准库存调整", 0, {
      generation: "已批准调整",
      source: "库存调整批准记录",
    }),
    totalRow(
      "adopted-closing",
      "库存勾稽",
      "采用后账面期末库存",
      50,
      "调整前账面推算期末库存＋已批准库存调整。",
    ),
    row("survey-closing", "库存勾稽", "调查汇总期末库存", 50, {
      source: "演示输入 · 已发布库存调查指标版本",
    }),
    totalRow(
      "inventory-balance-difference",
      "库存勾稽",
      "库存平衡差额",
      0,
      "调查汇总期末库存－采用后账面期末库存。",
    ),
  ],
};

export const productAccountCatalog = {
  corn,
  soybean,
  paddy,
  rice,
} as const satisfies Record<ProductAccountKey, ProductAccount>;

function requiredValue(account: ProductAccount, role: string) {
  const row = account.rows.find((candidate) => candidate.role === role);
  if (!row) throw new Error(`缺少账户角色：${role}`);
  const value = formalScaledValue(row.input);
  if (value === undefined) {
    throw new Error(`${role} 没有可用于正式计算的值`);
  }
  return value;
}

function formatScaled(value: number) {
  return (value / 10).toFixed(1);
}

export function buildBalanceSummary(account: ProductAccount) {
  if (publishableInputErrors(account).length > 0) {
    throw new Error("账户输入未通过可发布校验");
  }

  const totalSupply = requiredValue(account, "total-supply");
  const totalDemand = requiredValue(account, "total-demand");
  const preAdjustmentClosing = requiredValue(account, "pre-adjustment-closing");
  const approvedAdjustment = requiredValue(
    account,
    "approved-inventory-adjustment",
  );
  const adoptedClosing = requiredValue(account, "adopted-closing");
  const surveyClosing = requiredValue(account, "survey-closing");

  return {
    totalSupply: formatScaled(totalSupply),
    totalDemand: formatScaled(totalDemand),
    preAdjustmentClosing: formatScaled(preAdjustmentClosing),
    approvedAdjustment: formatScaled(approvedAdjustment),
    adoptedClosing: formatScaled(adoptedClosing),
    surveyClosing: formatScaled(surveyClosing),
    reconciliationDifference: formatScaled(surveyClosing - adoptedClosing),
    unit: "万吨" as const,
  };
}

export function validateProductAccount(account: ProductAccount): string[] {
  const errors: string[] = [];
  const roles = account.rows.map((row) => row.role);
  if (new Set(roles).size !== roles.length) {
    errors.push("账户角色重复");
  }

  errors.push(...publishableInputErrors(account));
  for (const candidate of account.rows) {
    if (
      candidate.accountingSide &&
      !account.metricReleaseVersionIds.includes(
        candidate.metricReleaseVersionId,
      )
    ) {
      errors.push(`${candidate.role} 未包含在固定指标输入版本集合中`);
    }
  }

  const supplyFacts = account.rows
    .filter((row) => row.accountingSide === "supply")
    .reduce((total, row) => total + (formalScaledValue(row.input) ?? 0), 0);
  const demandFacts = account.rows
    .filter((row) => row.accountingSide === "demand")
    .reduce((total, row) => total + (formalScaledValue(row.input) ?? 0), 0);
  const totalSupply = requiredValue(account, "total-supply");
  const totalDemand = requiredValue(account, "total-demand");
  const preAdjustmentClosing = requiredValue(account, "pre-adjustment-closing");
  const approvedAdjustment = requiredValue(
    account,
    "approved-inventory-adjustment",
  );
  const adoptedClosing = requiredValue(account, "adopted-closing");
  const surveyClosing = requiredValue(account, "survey-closing");
  const recordedDifference = requiredValue(
    account,
    "inventory-balance-difference",
  );

  if (supplyFacts !== totalSupply) errors.push("总供给与分项不一致");
  if (demandFacts !== totalDemand) errors.push("总需求与分项不一致");
  if (totalSupply - totalDemand !== preAdjustmentClosing) {
    errors.push("调整前账面推算期末库存公式不平衡");
  }
  if (preAdjustmentClosing + approvedAdjustment !== adoptedClosing) {
    errors.push("采用后账面期末库存公式不平衡");
  }
  if (surveyClosing - adoptedClosing !== recordedDifference) {
    errors.push("库存平衡差额不一致");
  }

  return errors;
}

export function displayScaledValue(value: number) {
  return formatScaled(value);
}

export function formalScaledValue(input: BalanceInput): number | undefined {
  return input.state === "有值" || input.state === "真实为零"
    ? input.scaledValue
    : undefined;
}

export function validateProductAccountCatalog(
  catalog: Record<ProductAccountKey, ProductAccount>,
): string[] {
  const errors = Object.values(catalog).flatMap((account) =>
    validateProductAccount(account).map(
      (error) => `${account.accountKey}: ${error}`,
    ),
  );
  const paddyInput = catalog.paddy.rows.find(
    (candidate) => candidate.role === "paddy-food-use",
  );
  const riceOutput = catalog.rice.rows.find(
    (candidate) => candidate.role === "rice-production",
  );

  if (!paddyInput || !riceOutput) {
    errors.push("缺少稻谷投料或大米加工产出角色");
    return errors;
  }
  if (
    !paddyInput.processingRunId ||
    paddyInput.processingRunId !== riceOutput.processingRunId
  ) {
    errors.push("稻谷投料与大米产出未关联同一加工运行");
  }
  if (
    !paddyInput.conversionRuleVersionId ||
    paddyInput.conversionRuleVersionId !== riceOutput.conversionRuleVersionId
  ) {
    errors.push("稻谷投料与大米产出未使用同一转换规则版本");
  }

  const inputValue = formalScaledValue(paddyInput.input);
  const outputValue = formalScaledValue(riceOutput.input);
  if (
    inputValue === undefined ||
    outputValue === undefined ||
    outputValue * 98 !== inputValue * 65
  ) {
    errors.push("稻谷投料与大米产出不符合转换规则版本的 65/98 出米率");
  }

  return errors;
}

function publishableInputErrors(account: ProductAccount): string[] {
  return account.rows.flatMap((candidate) => {
    if (!candidate.accountingSide) return [];
    if (formalScaledValue(candidate.input) !== undefined) return [];
    return [
      `${candidate.role} 输入状态为${candidate.input.state}，不可发布计算`,
    ];
  });
}
