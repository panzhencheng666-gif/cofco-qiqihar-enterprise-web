import { describe, expect, it } from "vitest";
import type { CurrentWorkspace } from "./model";
import { resolveDocumentAccess } from "./document-access";

const workspace: CurrentWorkspace = {
  id: "current",
  organization: { id: "organization-1", name: "东北区域经营中心" },
  regionName: "齐齐哈尔市",
  marketingYear: "2026/27 年度",
  dataScopeName: "本区域全部样本",
  actor: {
    id: "actor-1",
    displayName: "王洋",
    responsibilityPosition: "区域审核员",
  },
  capabilities: ["business-document:view", "business-document:review"],
  documentAccess: [
    {
      objectId: "object-a",
      documentId: "document-a",
      operations: ["view", "review"],
      responsibilityAssignmentId: "assignment-review-a",
      appointmentId: "appointment-reviewer",
    },
  ],
  dataMode: "演示环境 · 非生产数据",
  session: { status: "安全" },
};

describe("document access projection", () => {
  it("grants only the operations projected for an exact object and document coordinate", () => {
    expect([
      ...resolveDocumentAccess(workspace, "object-a", "document-a"),
    ]).toEqual(["view", "review"]);
  });

  it("denies by default when either the object or document coordinate differs", () => {
    expect(
      resolveDocumentAccess(workspace, "object-b", "document-a").size,
    ).toBe(0);
    expect(
      resolveDocumentAccess(workspace, "object-a", "document-b").size,
    ).toBe(0);
  });
});
