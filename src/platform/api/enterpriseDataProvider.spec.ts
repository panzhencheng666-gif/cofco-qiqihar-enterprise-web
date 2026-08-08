import { describe, expect, it } from "vitest";
import { mockEnterpriseGateway } from "./mock/mockEnterpriseGateway";
import { createEnterpriseDataProvider } from "./enterpriseDataProvider";

describe("enterprise data provider", () => {
  it("exposes the current workspace and unified work projection", async () => {
    const provider = createEnterpriseDataProvider(mockEnterpriseGateway);

    const workspace = await provider.getOne({
      resource: "workspace",
      id: "current",
      meta: {},
    });
    const myWork = await provider.getList({
      resource: "my-work",
      pagination: { currentPage: 1, pageSize: 20, mode: "server" },
      sorters: [],
      filters: [],
      meta: {},
    });

    expect(workspace.data.id).toBe("current");
    expect(myWork.total).toBeGreaterThan(0);
  });
});
