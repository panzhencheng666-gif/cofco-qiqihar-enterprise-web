import { Typography } from "antd";
import { StackCompatibilityHarness } from "@/shared/ui";

export function StackCompatibilityPage() {
  return (
    <>
      <Typography.Title level={2}>技术兼容门禁</Typography.Title>
      <StackCompatibilityHarness />
    </>
  );
}
