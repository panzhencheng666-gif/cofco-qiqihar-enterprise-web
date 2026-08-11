import type { EnterpriseRegionId } from "./enterpriseRegions";
import {
  formatSupplyAccountAmount,
  qiqiharCornSupplyAccountSnapshot,
} from "./data/supplyAccountSnapshot";

export type SupplyBalanceScopeKey =
  "qiqihar" | "nehe" | "longjiang" | "gannan" | "tailai";

export interface SupplyBalanceScope {
  key: SupplyBalanceScopeKey;
  label: string;
  level: "市级合并" | "县级账户";
  coverage: string;
  internalFlowElimination: string;
  version: string;
  status: "已核定" | "待补数据";
  metrics: readonly SupplyBalanceMetric[];
}

export interface SupplyBalanceMetric {
  label: string;
  value: string;
  unit: string;
  note: string;
  tone?: "normal" | "good" | "warning" | "danger";
}

export interface SupplyBalanceEquation {
  totalSupply: string;
  totalUse: string;
  bookEnding: string;
  approvedAdjustment: string;
  adoptedEnding: string;
  surveyEnding: string;
  inventoryDifference: string;
}

export const supplyBalanceScopes: readonly SupplyBalanceScope[] = [
  {
    key: "qiqihar",
    label: "齐齐哈尔市全域",
    level: "市级合并",
    coverage: "16 / 16 个县区",
    internalFlowElimination: "42.6 万吨",
    version: qiqiharCornSupplyAccountSnapshot.accountLabel,
    status: "已核定",
    metrics: [
      {
        label: "总供给",
        value: formatSupplyAccountAmount(
          qiqiharCornSupplyAccountSnapshot.equation.totalSupply,
        ),
        unit: "万吨",
        note: "期初库存＋产量＋市外净调入",
      },
      {
        label: "总使用与市外流出",
        value: formatSupplyAccountAmount(
          qiqiharCornSupplyAccountSnapshot.equation.totalUse,
        ),
        unit: "万吨",
        note: "消费＋加工＋损耗＋市外净调出",
      },
      {
        label: "期末库存",
        value: formatSupplyAccountAmount(
          qiqiharCornSupplyAccountSnapshot.equation.adoptedEnding,
        ),
        unit: "万吨",
        note: "作为下一年度期初库存",
        tone: "good",
      },
      {
        label: "平衡差额",
        value: formatSupplyAccountAmount(
          qiqiharCornSupplyAccountSnapshot.equation.inventoryDifference,
        ),
        unit: "万吨",
        note: `处于 0.5 万吨说明线以内；${qiqiharCornSupplyAccountSnapshot.reconciliationDecision.explanationLabel}`,
        tone: "good",
      },
    ],
  },
  {
    key: "nehe",
    label: "讷河市",
    level: "县级账户",
    coverage: "12 / 14 项已核定",
    internalFlowElimination: "不适用",
    version: "2026/27 年度讷河账户",
    status: "待补数据",
    metrics: [
      {
        label: "区域总供给",
        value: "121.8",
        unit: "万吨",
        note: "含县外调入 8.4 万吨",
      },
      {
        label: "区域总使用与流出",
        value: "104.6",
        unit: "万吨",
        note: "含向市内其他县区调出",
      },
      {
        label: "区域期末库存",
        value: "17.2",
        unit: "万吨",
        note: "企业和农户库存合计",
        tone: "good",
      },
      {
        label: "平衡差额",
        value: "0.4",
        unit: "万吨",
        note: "两项流向资料待补",
        tone: "warning",
      },
    ],
  },
  {
    key: "longjiang",
    label: "龙江县",
    level: "县级账户",
    coverage: "14 / 14 项已核定",
    internalFlowElimination: "不适用",
    version: "2026/27 年度龙江账户",
    status: "已核定",
    metrics: [
      {
        label: "区域总供给",
        value: "98.4",
        unit: "万吨",
        note: "含县外调入 5.7 万吨",
      },
      {
        label: "区域总使用与流出",
        value: "87.7",
        unit: "万吨",
        note: "加工和县外调出为主",
      },
      {
        label: "区域期末库存",
        value: "10.7",
        unit: "万吨",
        note: "企业和农户库存合计",
        tone: "good",
      },
      {
        label: "平衡差额",
        value: "0.2",
        unit: "万吨",
        note: "处于说明线以内",
      },
    ],
  },
  {
    key: "gannan",
    label: "甘南县",
    level: "县级账户",
    coverage: "11 / 14 项已核定",
    internalFlowElimination: "不适用",
    version: "2026/27 年度甘南账户",
    status: "待补数据",
    metrics: [
      {
        label: "区域总供给",
        value: "74.9",
        unit: "万吨",
        note: "产量数据已经核定",
      },
      {
        label: "区域总使用与流出",
        value: "66.3",
        unit: "万吨",
        note: "加工量和调出量待复核",
      },
      {
        label: "区域期末库存",
        value: "8.6",
        unit: "万吨",
        note: "企业库存资料待补",
        tone: "warning",
      },
      {
        label: "平衡差额",
        value: "0.9",
        unit: "万吨",
        note: "暂不具备正式发布条件",
        tone: "danger",
      },
    ],
  },
  {
    key: "tailai",
    label: "泰来县",
    level: "县级账户",
    coverage: "14 / 14 项已核定",
    internalFlowElimination: "不适用",
    version: "2026/27 年度泰来账户",
    status: "已核定",
    metrics: [
      {
        label: "区域总供给",
        value: "69.7",
        unit: "万吨",
        note: "稻谷和玉米账户合并观察",
      },
      {
        label: "区域总使用与流出",
        value: "61.8",
        unit: "万吨",
        note: "县外调出占比较高",
      },
      {
        label: "区域期末库存",
        value: "7.9",
        unit: "万吨",
        note: "企业和农户库存合计",
        tone: "good",
      },
      {
        label: "平衡差额",
        value: "0.3",
        unit: "万吨",
        note: "处于说明线以内",
      },
    ],
  },
];

export function getSupplyBalanceScope(
  key: string | null | undefined,
): SupplyBalanceScope | null {
  return supplyBalanceScopes.find((scope) => scope.key === key) ?? null;
}

const enterpriseRegionSupplyScope: Partial<
  Record<EnterpriseRegionId, SupplyBalanceScopeKey>
> = {
  "qiqihar-all": "qiqihar",
  "qiqihar-nehe": "nehe",
  "qiqihar-longjiang": "longjiang",
  "qiqihar-gannan": "gannan",
  "qiqihar-tailai": "tailai",
};

export function getSupplyBalanceScopeForRegion(regionId: EnterpriseRegionId) {
  const scopeKey = enterpriseRegionSupplyScope[regionId];
  return scopeKey ? getSupplyBalanceScope(scopeKey) : null;
}

export function getSupplyBalanceMetrics(key: string | null | undefined) {
  return getSupplyBalanceScope(key)?.metrics ?? null;
}

const supplyBalanceEquations: Record<
  SupplyBalanceScopeKey,
  SupplyBalanceEquation
> = {
  qiqihar: {
    totalSupply: formatSupplyAccountAmount(
      qiqiharCornSupplyAccountSnapshot.equation.totalSupply,
    ),
    totalUse: formatSupplyAccountAmount(
      qiqiharCornSupplyAccountSnapshot.equation.totalUse,
    ),
    bookEnding: formatSupplyAccountAmount(
      qiqiharCornSupplyAccountSnapshot.equation.bookEnding,
    ),
    approvedAdjustment: formatSupplyAccountAmount(
      qiqiharCornSupplyAccountSnapshot.equation.approvedAdjustment,
    ),
    adoptedEnding: formatSupplyAccountAmount(
      qiqiharCornSupplyAccountSnapshot.equation.adoptedEnding,
    ),
    surveyEnding: formatSupplyAccountAmount(
      qiqiharCornSupplyAccountSnapshot.equation.surveyEnding,
    ),
    inventoryDifference: formatSupplyAccountAmount(
      qiqiharCornSupplyAccountSnapshot.equation.inventoryDifference,
    ),
  },
  nehe: {
    totalSupply: "121.8",
    totalUse: "104.6",
    bookEnding: "17.2",
    approvedAdjustment: "0.0",
    adoptedEnding: "17.2",
    surveyEnding: "17.6",
    inventoryDifference: "0.4",
  },
  longjiang: {
    totalSupply: "98.4",
    totalUse: "87.7",
    bookEnding: "10.7",
    approvedAdjustment: "0.0",
    adoptedEnding: "10.7",
    surveyEnding: "10.9",
    inventoryDifference: "0.2",
  },
  gannan: {
    totalSupply: "74.9",
    totalUse: "66.3",
    bookEnding: "8.6",
    approvedAdjustment: "0.0",
    adoptedEnding: "8.6",
    surveyEnding: "9.5",
    inventoryDifference: "0.9",
  },
  tailai: {
    totalSupply: "69.7",
    totalUse: "61.8",
    bookEnding: "7.9",
    approvedAdjustment: "0.0",
    adoptedEnding: "7.9",
    surveyEnding: "8.2",
    inventoryDifference: "0.3",
  },
};

export function getSupplyBalanceEquation(key: string | null | undefined) {
  const scope = getSupplyBalanceScope(key);
  return scope ? supplyBalanceEquations[scope.key] : null;
}
