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
        businessPeriod: "2026-W31",
        dueAt: null,
        workflowNode: "审核",
        statusCode: "TO_REVIEW",
        status: "待审核",
        responsiblePartyCode: "regional-data-admin",
        responsibleParty: "区域数据管理员",
      },
      [{ code: "CORN", name: "玉米" }],
    );
    expect(item.workId).toBe("WI-1");
    expect(item.domain).toBe("production");
    expect(item.productId).toBe("corn");
    expect(item.documentStatus).toBe("submitted");
    expect(item.reviewStatus).toBe("pending");
  });
});
