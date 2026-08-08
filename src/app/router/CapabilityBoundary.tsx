import type { ReactNode } from "react";
import type { CapabilityCode } from "@/domains/identity-organization/model";
import { EnterpriseBlocked, EnterpriseLoading } from "@/shared/enterprise-ui";
import { useCurrentWorkspace } from "@/workflows/current-workspace/useCurrentWorkspace";

export function CapabilityBoundary({
  capability,
  children,
}: {
  capability: CapabilityCode;
  children: ReactNode;
}) {
  const { workspace, isLoading, isError } = useCurrentWorkspace();

  if (isLoading) {
    return <EnterpriseLoading title="正在验证业务权限" />;
  }
  if (isError || !workspace) {
    return (
      <EnterpriseBlocked
        title="无法验证业务权限"
        description="系统未能确认当前账号、组织和责任范围，已拒绝显示业务内容。"
      />
    );
  }
  if (!workspace.capabilities.includes(capability)) {
    return (
      <EnterpriseBlocked
        title="当前账号无权访问"
        description="该业务能力不在当前账号的有效职责和数据范围内。"
      />
    );
  }
  return children;
}
