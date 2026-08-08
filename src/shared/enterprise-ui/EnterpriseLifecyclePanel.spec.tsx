import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EnterpriseLifecyclePanel } from "./EnterpriseLifecyclePanel";

describe("EnterpriseLifecyclePanel", () => {
  it("adapts the lifecycle grid to the number of supplied steps", () => {
    render(
      <EnterpriseLifecyclePanel
        title="报送生命周期"
        note="当前报告期"
        steps={[
          { key: "draft", label: "填报", detail: "进行中", state: "current" },
          { key: "review", label: "审核", detail: "待处理", state: "pending" },
          { key: "publish", label: "发布", detail: "未开始", state: "pending" },
        ]}
      />,
    );

    expect(screen.getByRole("list", { name: "报送生命周期" })).toHaveStyle(
      "--enterprise-lifecycle-step-count: 3",
    );
  });
});
