import { mockEnterpriseGateway } from "./mockEnterpriseGateway";
import { describe, expect, it } from "vitest";

describe("mock enterprise gateway", () => {
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
