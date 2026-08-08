import { describe, expect, it } from "vitest";
import type { WorkTask } from "@/workflows/task-inbox/model";
import { projectMyWorkItem } from "./projection";

const task: WorkTask = {
  id: "task-market-001",
  domain: "market-monitoring",
  title: "玉米市场日报区域复核",
  objectId: "site-qqhr-001",
  objectName: "龙江丰禾粮贸第一经营场所",
  documentId: "doc-market-20260730-001",
  commodity: "玉米",
  reportingPeriod: "2026-07-30",
  dueAt: "2026-07-30T16:00:00+08:00",
  ownerSnapshot: {
    obligationId: "obligation-market-001",
    coordinateId: "coordinate-market-001",
    deadlineAt: "2026-07-30T16:00:00+08:00",
    responsibilityAssignmentId: "assignment-market-001",
    appointmentId: "appointment-market-reviewer",
    deadlineOwnerActorId: "actor-regional-reviewer",
    deadlineOwnerDisplayName: "王洋",
    capturedAt: "2026-07-30T16:00:01+08:00",
  },
  obligationStatus: "进行中",
  timeliness: "按时提交",
  documentStatus: "审核中",
  qualityStatus: "警告",
};

describe("my work projection", () => {
  it("projects the personal queue from one authoritative task without copying independent state", () => {
    expect(
      projectMyWorkItem(task, {
        kind: "审核",
        regionName: "齐齐哈尔市",
      }),
    ).toEqual({
      id: "work:task-market-001",
      taskId: "task-market-001",
      kind: "审核",
      title: "玉米市场日报区域复核",
      businessModule: "市场监测",
      regionName: "齐齐哈尔市",
      dueAt: "2026-07-30T16:00:00+08:00",
      deadlineOwnerName: "王洋",
      obligationStatus: "进行中",
      timeliness: "按时提交",
      documentStatus: "审核中",
      qualityStatus: "警告",
      documentPath: "/objects/site-qqhr-001/documents/doc-market-20260730-001",
    });
  });
});
