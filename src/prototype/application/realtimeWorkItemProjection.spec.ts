import { describe, expect, it } from "vitest";
import { projectRealtimeWorkItem } from "./realtimeWorkItemProjection";

describe("realtime work item projection", () => {
  it("maps backend status and master product names without fixture data", () => {
    const item = projectRealtimeWorkItem(
      {
        id: "WI-1",
        task: "玉米测产",
        domain: "PRODUCTION",
        regionCode: "230221",
        region: "龙江镇",
        product: "玉米",
        businessPeriodCode: "2026-W31",
        businessPeriod: "2026年第31周",
        dueAt: null,
        workflowNode: "审核",
        statusCode: "TO_REVIEW",
        status: "待审核",
        responsiblePartyCode: "regional-data-admin",
        responsibleParty: "区域数据管理员",
        sourceType: "PRODUCTION",
        sourceId: "production-record-17",
      },
      [{ code: "CORN", name: "玉米" }],
    );
    expect(item.workId).toBe("WI-1");
    expect(item.domain).toBe("production");
    expect(item.productId).toBe("corn");
    expect(item.periodKey).toBe("2026-W31");
    expect(item.effectivePeriod).toBe("2026年第31周");
    expect(item.documentStatus).toBe("submitted");
    expect(item.reviewStatus).toBe("pending");
    expect(item.subject).toMatchObject({
      kind: "monitoring-object",
      objectId: "production-record-17",
    });
  });

  it("keeps fill work editable instead of treating it as review work", () => {
    const item = projectRealtimeWorkItem(
      {
        id: "WI-DRAFT",
        task: "玉米产情草稿",
        domain: "PRODUCTION",
        regionCode: "230221",
        region: "龙江县",
        product: "玉米",
        businessPeriod: "2026-W31",
        dueAt: null,
        workflowNode: "填报",
        statusCode: "TO_FILL",
        status: "待填报",
        responsiblePartyCode: "production-reporter",
        responsibleParty: "产情填报员",
        sourceType: "PRODUCTION",
        sourceId: "production-draft-1",
      },
      [{ code: "CORN", name: "玉米" }],
    );

    expect(item.documentStatus).toBe("draft");
    expect(item.reviewStatus).toBe("pending");
    expect(item.obligationStatus).toBe("in-progress");
  });

  it("projects logistics sources into the logistics work route", () => {
    const item = projectRealtimeWorkItem(
      {
        id: "WI-LOGISTICS",
        task: "物流监测 · logistics-record-1",
        domain: "MARKET",
        regionCode: "230202",
        region: "龙沙区",
        product: "玉米",
        businessPeriod: "2026-W31",
        dueAt: null,
        workflowNode: "审核",
        statusCode: "TO_REVIEW",
        status: "待审核",
        responsiblePartyCode: "logistics-reviewer",
        responsibleParty: "物流审核员",
        sourceType: "LOGISTICS",
        sourceId: "logistics-record-1",
      },
      [{ code: "CORN", name: "玉米" }],
    );

    expect(item.domain).toBe("market");
    expect(item.businessSubtypeId).toBe("market.logistics");
    expect(item.subject).toMatchObject({
      kind: "monitoring-object",
      objectId: "logistics-record-1",
      objectTypeId: "LOGISTICS",
    });
  });
});
