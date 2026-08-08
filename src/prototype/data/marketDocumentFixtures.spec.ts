import { describe, expect, it } from "vitest";

import {
  marketCapabilityTemplates,
  marketMonitoringObjects,
} from "./monitoringRegistryFixtures";
import {
  marketLogisticsRows,
  marketRegionCoverage,
  marketSubjectRows,
  marketTasks,
} from "../marketMonitoringData";
import { marketDocumentFixtures } from "./marketDocumentFixtures";
import { businessWorkFixtures } from "./businessWorkFixtures";
import {
  marketCultivarNames,
  marketCultivarsByProduct,
} from "../marketMonitoringModel";

const requiredRoleIds = [
  "trader",
  "corn-processor",
  "soy-crusher",
  "soy-protein",
  "food-condiment",
  "rice-mill",
  "feed",
  "livestock",
  "reserve",
  "wholesale-market",
  "agri-dealer",
  "rail-node",
  "road-node",
] as const;

describe("market typed fixtures", () => {
  it("adds the company task without overwriting the original shared market work", () => {
    const original = businessWorkFixtures.find(
      ({ workId }) => workId === "WORK-MARKET-FILL-W31",
    );
    expect(original?.regionId).toBe("qiqihar-all");
    expect(original?.regionLabel).toBe("齐齐哈尔市");
    expect(original?.applicableFields).toBe(26);
    expect(original?.fieldGroupIds).toEqual([
      "quote",
      "trade",
      "quality",
      "evidence",
    ]);
    expect(original?.subject.kind).toBe("monitoring-object");
    if (original?.subject.kind !== "monitoring-object") {
      throw new Error("原市场工作必须关联监测对象");
    }
    expect(original.subject.objectName).toBe("龙江县玉米贸易监测组");
    expect(original.subject.objectTypeId).toBe("trader");
    const company = businessWorkFixtures.find(
      ({ workId }) => workId === "WORK-MARKET-TRADER-W31",
    );
    expect(company?.completedFields).toBe(18);
    expect(company?.applicableFields).toBe(18);
    expect(company?.fieldGroupIds).toEqual([
      "purchase",
      "quality",
      "inventory",
      "sales",
    ]);
    expect(company?.subject.kind).toBe("monitoring-object");
    if (company?.subject.kind !== "monitoring-object") {
      throw new Error("粮贸公司工作必须关联监测对象");
    }
    expect(company.subject.objectId).toBe("OBJ-MARKET-TRADER-COMPANY-01");
    expect(company.subject.objectName).toBe("龙江北方粮贸有限公司");
    expect(company.subject.objectTypeId).toBe("grain-trading-enterprise");
    expect(
      marketTasks.some(({ workId }) => workId === "WORK-MARKET-FILL-W31"),
    ).toBe(true);
    expect(
      marketDocumentFixtures
        .find(({ workId }) => workId === "WORK-MARKET-FILL-W31")
        ?.fieldGroups.map(({ groupId }) => groupId),
    ).toEqual(
      expect.arrayContaining(["purchase", "quality", "sales", "evidence"]),
    );
  });

  it("preserves every effective market role without publishing a capability encyclopedia", () => {
    const roleIds = new Set(
      marketCapabilityTemplates.map(({ roleId }) => roleId),
    );
    expect([...roleIds].sort()).toEqual([...requiredRoleIds].sort());
    expect(marketCapabilityTemplates).toHaveLength(requiredRoleIds.length);
    for (const template of marketCapabilityTemplates) {
      expect(template.capabilityLabels.length).toBeGreaterThan(0);
    }
    expect(
      marketMonitoringObjects
        .find(({ objectName }) => objectName === "龙江北方粮贸有限公司")
        ?.roles.map(({ roleId }) => roleId),
    ).toEqual(["trader"]);
  });

  it("uses market-native object types and source channels outside the compatibility adapter", () => {
    expect(
      marketMonitoringObjects.map(({ objectTypeId }) => objectTypeId),
    ).toEqual(
      expect.arrayContaining([
        "market-monitoring-group",
        "grain-processing-enterprise",
        "grain-trading-enterprise",
        "grain-storage-enterprise",
        "agri-input-operator",
        "rail-node",
        "road-node",
      ]),
    );
    expect(
      marketMonitoringObjects.map(({ sourceChannelId }) => sourceChannelId),
    ).toEqual(
      expect.arrayContaining([
        "enterprise-report",
        "rail-waybill-ledger",
        "road-waybill-weighing",
      ]),
    );
    expect(
      marketMonitoringObjects.some(({ objectTypeId }) =>
        ["cooperative", "agri-station", "field-plot"].includes(objectTypeId),
      ),
    ).toBe(false);
  });

  it("keeps one stable object identity for one governed business name", () => {
    const marketWorks = businessWorkFixtures.filter(
      ({ domain, subject }) =>
        domain === "market" && subject.kind === "monitoring-object",
    );
    const namesByObjectId = new Map<string, Set<string>>();
    for (const work of marketWorks) {
      if (work.subject.kind !== "monitoring-object") continue;
      const names = namesByObjectId.get(work.subject.objectId) ?? new Set();
      names.add(work.subject.objectName);
      namesByObjectId.set(work.subject.objectId, names);
    }
    expect(
      [...namesByObjectId.values()].every((names) => names.size === 1),
    ).toBe(true);
    expect(
      marketMonitoringObjects.find(
        ({ objectId }) => objectId === "OBJ-MARKET-TRADER-01",
      )?.objectName,
    ).toBe("龙江县玉米贸易监测组");
  });

  it("retains every legacy market task field and links each task to shared business work", () => {
    const requiredFields = [
      "id",
      "target",
      "targetName",
      "role",
      "grain",
      "region",
      "owner",
      "deadline",
      "status",
      "completedFields",
      "applicableFields",
      "workId",
    ] as const;
    expect(marketTasks.length).toBeGreaterThan(0);
    for (const task of marketTasks) {
      expect(Object.keys(task)).toEqual(
        expect.arrayContaining([...requiredFields]),
      );
      expect(task.workId).toBeTruthy();
    }
  });

  it("preserves the governed corn cultivar catalog including 先玉335", () => {
    expect(marketCultivarNames["xianyu-335"]).toBe("先玉335");
    expect(marketCultivarsByProduct.corn).toContain("xianyu-335");
  });

  it("retains regional source states and does not turn pending coverage into zero", () => {
    expect(marketRegionCoverage.map(({ sourceState }) => sourceState)).toEqual(
      expect.arrayContaining(["已核定", "部分核定", "待核定"]),
    );
    for (const coverage of marketRegionCoverage) {
      expect(typeof coverage.detail).toBe("string");
      expect(typeof coverage.townshipCount).toBe("string");
      expect(typeof coverage.villageCount).toBe("string");
      expect(typeof coverage.sourceNote).toBe("string");
      expect(typeof coverage.sourceState).toBe("string");
      if (coverage.sourceState === "待核定") {
        expect(coverage.townshipCount).not.toBe("0");
        expect(coverage.villageCount).not.toBe("0");
      }
    }
  });

  it("retains subject fields and logistics coverage and monitoring content", () => {
    const subject = marketSubjectRows[0];
    expect(subject).toBeDefined();
    expect(typeof subject?.name).toBe("string");
    expect(typeof subject?.roles).toBe("string");
    expect(typeof subject?.grain).toBe("string");
    expect(typeof subject?.varieties).toBe("string");
    expect(typeof subject?.qualityScope).toBe("string");
    expect(typeof subject?.region).toBe("string");
    expect(typeof subject?.owner).toBe("string");
    expect(typeof subject?.status).toBe("string");
    expect(marketLogisticsRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          coverage: "齐齐哈尔及周边县区",
          monitoring: "包粮 / 散粮、到达 / 发运、即期报价 / 成交价",
        }),
        expect.objectContaining({
          coverage: "扎兰屯南部通道",
          monitoring: "包粮 / 散粮、流入 / 流出、运单 / 过磅",
        }),
      ]),
    );
  });

  it("moves all market field groups, values, validation and source modes into documents", () => {
    expect(marketDocumentFixtures.length).toBe(marketTasks.length);
    const groupIds = new Set(
      marketDocumentFixtures.flatMap(({ fieldGroups }) =>
        fieldGroups.map(({ groupId }) => groupId),
      ),
    );
    expect([...groupIds].sort()).toEqual(
      [
        "evidence",
        "inventory",
        "movement",
        "processing",
        "purchase",
        "quality",
        "sales",
      ].sort(),
    );
    for (const document of marketDocumentFixtures) {
      const workItem = businessWorkFixtures.find(
        ({ workId }) => workId === document.workId,
      );
      expect(workItem).toBeDefined();
      const requiredFields = document.fieldGroups.flatMap(({ fields }) =>
        fields.filter(({ countsTowardCompletion }) => countsTowardCompletion),
      );
      const pendingFields = requiredFields.filter(
        ({ requiresConfirmation }) => requiresConfirmation,
      );
      expect(requiredFields).toHaveLength(workItem!.applicableFields);
      expect(pendingFields).toHaveLength(
        workItem!.applicableFields - workItem!.completedFields,
      );
      expect(typeof document.validation.title).toBe("string");
      expect(typeof document.validation.detail).toBe("string");
      expect(typeof document.validation.pendingEvidence).toBe("string");
      expect(
        document.collectionChannels.map(({ mode }) => mode).sort(),
      ).toEqual(["excel", "online", "system"]);
    }
    expect(
      marketDocumentFixtures.flatMap(({ collectionChannels }) =>
        collectionChannels.flatMap(({ sourceRows }) =>
          sourceRows.map(({ name }) => name),
        ),
      ),
    ).toEqual(
      expect.arrayContaining([
        "企业仓储库存台账",
        "米厂生产日报",
        "铁路货运运单数据",
        "公路过磅与运单数据",
      ]),
    );
    const subjectSystem = marketDocumentFixtures[0]?.collectionChannels.find(
      ({ mode }) => mode === "system",
    );
    const subjectSpreadsheet =
      marketDocumentFixtures[0]?.collectionChannels.find(
        ({ mode }) => mode === "excel",
      );
    expect(subjectSystem?.systemSummary).toEqual({
      received: 718,
      accepted: 684,
      pending: 29,
      failed: 5,
      latestLabel: "今天 12:48",
    });
    expect(subjectSpreadsheet?.importRowLimit).toBe(5000);
  });

  it("keeps base purchase and sales prices separate from the all-in transaction price", () => {
    const document = marketDocumentFixtures.find(
      ({ workId }) => workId === "WORK-MARKET-FILL-W31",
    );
    const purchaseFields = document?.fieldGroups.find(
      ({ groupId }) => groupId === "purchase",
    )?.fields;
    const salesFields = document?.fieldGroups.find(
      ({ groupId }) => groupId === "sales",
    )?.fields;

    expect(purchaseFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldId: "quote",
          label: "采购价",
          note: "基础价，不含车板、包装与运费",
        }),
        expect.objectContaining({
          fieldId: "transactionPrice",
          label: "实际成交价",
          note: "已计入车板、包装与运费",
        }),
        expect.objectContaining({ fieldId: "wagonPrice", label: "车板价" }),
        expect.objectContaining({ fieldId: "freight", label: "运费" }),
        expect.objectContaining({ fieldId: "packaging", label: "包装形态" }),
      ]),
    );
    expect(salesFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldId: "salesPrice",
          label: "销售价",
          note: "基础价，不含车板、包装与运费",
        }),
      ]),
    );
  });
});
