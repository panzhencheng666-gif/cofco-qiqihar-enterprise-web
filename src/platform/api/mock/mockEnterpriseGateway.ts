import type { MonitoringObject } from "@/domains/monitoring-object/model";
import { monitoringObjectIds } from "@/domains/monitoring-object/identifiers";
import {
  fixedDecimal,
  type BusinessDocument,
} from "@/workflows/document-workspace/model";
import { enterpriseNotFoundError } from "@/workflows/enterprise-gateway/errors";
import type { WorkTask } from "@/workflows/task-inbox/model";
import type { CurrentWorkspace } from "@/workflows/current-workspace/model";
import type { MyWorkItem } from "@/workflows/my-work/model";
import { projectMyWorkItem } from "@/workflows/my-work/projection";
import type { EnterpriseGateway } from "@/workflows/enterprise-gateway/port";

const currentWorkspace: CurrentWorkspace = {
  id: "current",
  organization: {
    id: "northeast-regional-operation-center",
    name: "东北区域经营中心",
  },
  regionName: "齐齐哈尔市",
  marketingYear: "2026/27 年度",
  dataScopeName: "本区域全部样本",
  actor: {
    id: "actor-regional-reviewer",
    displayName: "王洋",
    responsibilityPosition: "区域数据管理员",
  },
  capabilities: [
    "my-work:view",
    "business-overview:view",
    "production-monitoring:view",
    "market-monitoring:view",
    "supply-situation:view",
    "report-center:view",
    "data-governance:view",
    "system-administration:view",
    "business-document:view",
    "business-document:review",
    "account-security:view",
  ],
  documentAccess: [
    {
      objectId: monitoringObjectIds.grainTraderOperatingSite,
      documentId: "doc-market-20260730-001",
      operations: ["view", "review"],
      responsibilityAssignmentId: "assignment:qqhr-market-reviewer",
      appointmentId: "appointment:regional-reviewer",
    },
    {
      objectId: monitoringObjectIds.farmerSample017,
      documentId: "doc-production-2026-017",
      operations: ["view", "edit"],
      responsibilityAssignmentId: "assignment:longjiang-soy-reporter",
      appointmentId: "appointment:regional-data-manager",
    },
    {
      objectId: monitoringObjectIds.farmerSample017,
      documentId: "doc-production-stock-202607-017",
      operations: ["view", "edit"],
      responsibilityAssignmentId: "assignment:longjiang-soy-stock-reporter",
      appointmentId: "appointment:regional-data-manager",
    },
  ],
  dataMode: "演示环境 · 非生产数据",
  session: {
    status: "安全",
  },
};

const objects: readonly MonitoringObject[] = [
  {
    id: monitoringObjectIds.grainTraderOperatingSite,
    name: "龙江丰禾粮贸第一经营场所",
    kind: "operating-site",
    regionPath: ["黑龙江省", "齐齐哈尔市", "龙江县"],
    organizationName: "龙江丰禾粮贸有限公司",
    capabilities: ["贸易", "仓储"],
    status: "active",
  },
  {
    id: monitoringObjectIds.farmerSample017,
    name: "龙江县农户样本 017",
    kind: "farmer-sample",
    regionPath: ["黑龙江省", "齐齐哈尔市", "龙江县", "景星镇"],
    capabilities: ["种植", "余粮", "销售", "种植意愿"],
    status: "active",
  },
];

const documents: readonly BusinessDocument[] = [
  {
    id: "doc-market-20260730-001",
    objectId: monitoringObjectIds.grainTraderOperatingSite,
    domain: "market-monitoring",
    commodity: "玉米",
    reportingPeriod: "2026-07-30",
    formVersion: "市场玉米日报表第 1 版",
    revision: 1,
    state: "PRIMARY_REVIEW",
    quality: { blocking: 0, warning: 1, passed: 8 },
    sections: [
      {
        id: "purchase",
        title: "收购、质量与数量",
        fields: [
          {
            code: "purchase_price",
            label: "实际收购价格",
            value: { status: "reported", amount: fixedDecimal("2168") },
            unit: "元/吨",
            quality: "passed",
          },
          {
            code: "purchase_quantity",
            label: "实际收购数量",
            value: { status: "reported", amount: fixedDecimal("186") },
            unit: "吨",
            quality: "passed",
          },
          {
            code: "moisture",
            label: "水分",
            value: {
              status: "reported",
              amount: fixedDecimal("27.6"),
            },
            unit: "%",
            quality: "warning",
          },
        ],
      },
      {
        id: "inventory",
        title: "库存快照",
        fields: [
          {
            code: "physical_inventory",
            label: "实际库存数量",
            value: { status: "reported", amount: fixedDecimal("4620") },
            unit: "吨",
            quality: "passed",
          },
        ],
      },
    ],
  },
  {
    id: "doc-production-2026-017",
    objectId: monitoringObjectIds.farmerSample017,
    domain: "production-monitoring",
    commodity: "大豆",
    reportingPeriod: "2026 年调查轮次",
    formVersion: "产情大豆调查表第 1 版",
    revision: 1,
    state: "DRAFT",
    quality: { blocking: 1, warning: 0, passed: 5 },
    sections: [
      {
        id: "planting",
        title: "面积、单产与产量",
        fields: [
          {
            code: "area",
            label: "种植面积",
            value: { status: "reported", amount: fixedDecimal("120") },
            unit: "亩",
            quality: "passed",
          },
          {
            code: "yield",
            label: "单产",
            value: { status: "not-reported" },
            unit: "斤/亩",
            quality: "blocking",
          },
        ],
      },
    ],
  },
  {
    id: "doc-production-stock-202607-017",
    objectId: monitoringObjectIds.farmerSample017,
    domain: "production-monitoring",
    commodity: "大豆",
    reportingPeriod: "2026 年 7 月",
    formVersion: "农户余粮月度调查表第 1 版",
    revision: 1,
    state: "DRAFT",
    quality: { blocking: 0, warning: 1, passed: 3 },
    sections: [
      {
        id: "farm-inventory",
        title: "余粮库存与变动",
        fields: [
          {
            code: "closing_inventory",
            label: "本期盘点库存",
            value: { status: "reported", amount: fixedDecimal("18.6") },
            unit: "吨",
            quality: "passed",
          },
          {
            code: "inventory_difference",
            label: "库存勾稽差异",
            value: { status: "not-reported" },
            unit: "吨",
            quality: "warning",
          },
        ],
      },
    ],
  },
];

const tasks: readonly WorkTask[] = [
  {
    id: "task-market-001",
    domain: "market-monitoring",
    title: "玉米市场日报区域复核",
    objectId: monitoringObjectIds.grainTraderOperatingSite,
    objectName: "龙江丰禾粮贸第一经营场所",
    documentId: "doc-market-20260730-001",
    commodity: "玉米",
    reportingPeriod: "2026-07-30",
    dueAt: "2026-07-30T16:00:00+08:00",
    ownerSnapshot: {
      obligationId: "obligation-market-001",
      coordinateId: "responsibility-coordinate:qqhr-market-corn",
      deadlineAt: "2026-07-30T16:00:00+08:00",
      responsibilityAssignmentId: "assignment:qqhr-market-reviewer",
      appointmentId: "appointment:regional-reviewer",
      deadlineOwnerActorId: "actor-regional-reviewer",
      deadlineOwnerDisplayName: "王洋",
      capturedAt: "2026-07-30T16:00:01+08:00",
    },
    obligationStatus: "进行中",
    timeliness: "按时提交",
    documentStatus: "审核中",
    qualityStatus: "警告",
  },
  {
    id: "task-production-017",
    domain: "production-monitoring",
    title: "大豆农户样本质量修正",
    objectId: monitoringObjectIds.farmerSample017,
    objectName: "龙江县农户样本 017",
    documentId: "doc-production-2026-017",
    commodity: "大豆",
    reportingPeriod: "2026 年调查轮次",
    dueAt: "2026-07-31T16:30:00+08:00",
    ownerSnapshot: {
      obligationId: "obligation-production-017",
      coordinateId: "responsibility-coordinate:longjiang-soy-production",
      deadlineAt: "2026-07-31T16:30:00+08:00",
      responsibilityAssignmentId: "assignment:longjiang-soy-reporter",
      appointmentId: "appointment:regional-data-manager",
      deadlineOwnerActorId: "actor-regional-reviewer",
      deadlineOwnerDisplayName: "王洋",
      capturedAt: "2026-07-31T16:30:01+08:00",
    },
    obligationStatus: "进行中",
    timeliness: "待判定",
    documentStatus: "已退回",
    qualityStatus: "阻断",
  },
  {
    id: "task-production-stock-017",
    domain: "production-monitoring",
    title: "大豆农户余粮月度调查",
    objectId: monitoringObjectIds.farmerSample017,
    objectName: "龙江县农户样本 017",
    documentId: "doc-production-stock-202607-017",
    commodity: "大豆",
    reportingPeriod: "2026 年 7 月",
    dueAt: "2026-07-30T17:00:00+08:00",
    ownerSnapshot: {
      obligationId: "obligation-production-stock-017",
      coordinateId: "responsibility-coordinate:longjiang-soy-stock",
      deadlineAt: "2026-07-30T17:00:00+08:00",
      responsibilityAssignmentId: "assignment:longjiang-soy-stock-reporter",
      appointmentId: "appointment:regional-data-manager",
      deadlineOwnerActorId: "actor-regional-reviewer",
      deadlineOwnerDisplayName: "王洋",
      capturedAt: "2026-07-30T17:00:01+08:00",
    },
    obligationStatus: "已到期",
    timeliness: "仍未提交",
    documentStatus: "草稿",
    qualityStatus: "警告",
  },
];

const myWorkItems: readonly MyWorkItem[] = [
  projectMyWorkItem(tasks[0], {
    kind: "审核",
    regionName: "齐齐哈尔市",
  }),
  projectMyWorkItem(tasks[1], {
    kind: "异常处置",
    regionName: "龙江县",
  }),
  projectMyWorkItem(tasks[2], {
    kind: "填报",
    regionName: "龙江县",
  }),
];

function required<T extends { id: string }>(
  records: readonly T[],
  id: string,
  resource: "object" | "document",
): T {
  const record = records.find((item) => item.id === id);
  if (!record) throw enterpriseNotFoundError(resource, id);
  return record;
}

export const mockEnterpriseGateway: EnterpriseGateway = {
  getCurrentWorkspace() {
    return Promise.resolve(currentWorkspace);
  },
  listMyWork() {
    return Promise.resolve(myWorkItems);
  },
  listTasks(filter) {
    return Promise.resolve(
      filter?.domain
        ? tasks.filter((task) => task.domain === filter.domain)
        : tasks,
    );
  },
  listReviewTasks() {
    return Promise.resolve(
      tasks.filter((task) => task.documentStatus === "审核中"),
    );
  },
  getObject(objectId) {
    return Promise.resolve().then(() => required(objects, objectId, "object"));
  },
  getDocument(documentId) {
    return Promise.resolve().then(() =>
      required(documents, documentId, "document"),
    );
  },
};
