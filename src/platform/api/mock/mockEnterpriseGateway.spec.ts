import { mockEnterpriseGateway } from "./mockEnterpriseGateway";
import { describe, expect, it } from "vitest";

describe("mock enterprise gateway", () => {
  it("returns one server-authoritative current workspace", async () => {
    const workspace = await mockEnterpriseGateway.getCurrentWorkspace();

    expect(workspace.id).toBe("current");
    expect(workspace.organization.name).toBe("东北区域经营中心");
    expect(workspace.capabilities).toContain("my-work:view");
    expect(workspace.dataMode).toBe("演示环境 · 非生产数据");
  });

  it("returns the unified personal work projection instead of domain task copies", async () => {
    const workItems = await mockEnterpriseGateway.listMyWork();
    const tasks = await mockEnterpriseGateway.listTasks();

    expect(workItems.map((item) => item.businessModule)).toEqual(
      expect.arrayContaining(["产情监测", "市场监测"]),
    );
    expect(
      workItems.every((item) => item.documentPath.startsWith("/objects/")),
    ).toBe(true);
    for (const item of workItems) {
      const task = tasks.find((candidate) => candidate.id === item.taskId);
      expect(task).toBeDefined();
      expect(item).toMatchObject({
        obligationStatus: task?.obligationStatus,
        timeliness: task?.timeliness,
        documentStatus: task?.documentStatus,
        qualityStatus: task?.qualityStatus,
        deadlineOwnerName: task?.ownerSnapshot.deadlineOwnerDisplayName,
      });
    }
  });

  it("resolves every task to one canonical object and document", async () => {
    const tasks = await mockEnterpriseGateway.listTasks();

    expect(tasks.length).toBeGreaterThan(1);
    for (const task of tasks) {
      const dossier = await mockEnterpriseGateway.getObject(task.objectId);
      const document = await mockEnterpriseGateway.getDocument(task.documentId);

      expect(document.objectId).toBe(dossier.id);
      expect(document.id).toBe(task.documentId);
    }
  });

  it("uses the same document in the review queue", async () => {
    const tasks = await mockEnterpriseGateway.listTasks();
    const reviews = await mockEnterpriseGateway.listReviewTasks();

    expect(reviews[0]?.documentId).toBe(tasks[0]?.documentId);
    expect(reviews[0]?.objectId).toBe(tasks[0]?.objectId);
  });
});
