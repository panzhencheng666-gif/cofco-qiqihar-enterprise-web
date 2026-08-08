import type { AccessControlProvider } from "@refinedev/core";
import type { CapabilityCode } from "@/domains/identity-organization/model";
import type { EnterpriseGateway } from "@/workflows/enterprise-gateway/port";

const capabilityByAction = new Map<string, CapabilityCode>([
  ["workspace:show", "my-work:view"],
  ["my-work:list", "my-work:view"],
  ["objects:show", "business-document:view"],
  ["documents:show", "business-document:view"],
  ["documents:review", "business-document:review"],
  ["account-security:show", "account-security:view"],
]);

export function createAccessControlProvider(
  gateway: EnterpriseGateway,
): AccessControlProvider {
  let currentCapabilities: Promise<ReadonlySet<CapabilityCode>> | undefined;

  function capabilities() {
    currentCapabilities ??= gateway
      .getCurrentWorkspace()
      .then((workspace) => new Set(workspace.capabilities));
    return currentCapabilities;
  }

  return {
    async can({ resource, action }) {
      const required = capabilityByAction.get(`${resource}:${action}`);
      if (!required) {
        return {
          can: false,
          reason: "当前能力未在正式权限映射中启用",
        };
      }

      return {
        can: (await capabilities()).has(required),
        reason: "权限由当前服务端工作空间投影决定",
      };
    },
  };
}
