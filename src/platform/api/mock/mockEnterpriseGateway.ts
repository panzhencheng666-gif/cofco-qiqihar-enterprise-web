import type { MonitoringObject } from "@/domains/monitoring-object/model";
import {
  fixedDecimal,
  type BusinessDocument,
} from "@/workflows/document-workspace/model";
import { enterpriseNotFoundError } from "@/workflows/enterprise-gateway/errors";
import type { WorkTask } from "@/workflows/task-inbox/model";
import type { EnterpriseGateway } from "@/workflows/enterprise-gateway/port";

const objects: readonly MonitoringObject[] = [
  {
    id: "site-qqhr-001",
    name: "龙江丰禾粮贸第一经营场所",
    kind: "operating-site",
    regionPath: ["黑龙江省", "齐齐哈尔市", "龙江县"],
    organizationName: "龙江丰禾粮贸有限公司",
    capabilities: ["贸易", "仓储"],
    status: "active",
  },
  {
    id: "farmer-neh-017",
    name: "讷河农户样本 017",
    kind: "farmer-sample",
    regionPath: ["黑龙江省", "齐齐哈尔市", "讷河市"],
    capabilities: ["种植", "余粮", "销售", "种植意愿"],
    status: "active",
  },
];

const documents: readonly BusinessDocument[] = [
  {
    id: "doc-market-20260730-001",
    objectId: "site-qqhr-001",
    domain: "market-monitoring",
    commodity: "玉米",
    reportingPeriod: "2026-07-30",
    formVersion: "MARKET-CORN-1.0",
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
    objectId: "farmer-neh-017",
    domain: "production-monitoring",
    commodity: "大豆",
    reportingPeriod: "2026 年调查轮次",
    formVersion: "PRODUCTION-SOY-1.0",
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
];

const tasks: readonly WorkTask[] = [
  {
    id: "task-market-001",
    domain: "market-monitoring",
    title: "玉米市场日报区域复核",
    objectId: "site-qqhr-001",
    objectName: "龙江丰禾粮贸第一经营场所",
    documentId: "doc-market-20260730-001",
    commodity: "玉米",
    reportingPeriod: "2026-07-30",
    dueAt: "2026-07-30T16:00:00+08:00",
    assignee: "区域审核员",
    status: "待复核",
  },
  {
    id: "task-production-017",
    domain: "production-monitoring",
    title: "大豆农户样本年度填报",
    objectId: "farmer-neh-017",
    objectName: "讷河农户样本 017",
    documentId: "doc-production-2026-017",
    commodity: "大豆",
    reportingPeriod: "2026 年调查轮次",
    dueAt: "2026-08-05T17:00:00+08:00",
    assignee: "样本维护员",
    status: "质量异常",
  },
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
  listTasks(filter) {
    return Promise.resolve(
      filter?.domain
        ? tasks.filter((task) => task.domain === filter.domain)
        : tasks,
    );
  },
  listReviewTasks() {
    return Promise.resolve(tasks.filter((task) => task.status === "待复核"));
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
