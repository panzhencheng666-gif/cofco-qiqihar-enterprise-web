import { describe, expect, it } from "vitest";
import { mockEnterpriseGateway } from "@/platform/api/mock/mockEnterpriseGateway";
import { createAccessControlProvider } from "./accessControlProvider";

describe("access control provider", () => {
  it("projects server-authoritative workspace capabilities", async () => {
    const provider = createAccessControlProvider(mockEnterpriseGateway);

    await expect(
      provider.can({ resource: "my-work", action: "list", params: undefined }),
    ).resolves.toMatchObject({ can: true });
    await expect(
      provider.can({
        resource: "system-management",
        action: "list",
        params: undefined,
      }),
    ).resolves.toMatchObject({ can: false });
  });
});
