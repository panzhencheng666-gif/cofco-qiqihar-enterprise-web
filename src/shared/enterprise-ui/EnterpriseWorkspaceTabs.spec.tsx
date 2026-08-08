import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EnterpriseWorkspaceTabs } from "./EnterpriseWorkspaceTabs";

describe("EnterpriseWorkspaceTabs", () => {
  it("renders business workspaces as accessible anchors and marks the active item", () => {
    render(
      <EnterpriseWorkspaceTabs
        activeKey="samples"
        items={[
          { key: "overview", label: "运营总览", target: "/production" },
          { key: "samples", label: "样本对象", target: "/production/samples" },
          { key: "tasks", label: "采集任务", target: "/production/tasks" },
        ]}
      />,
    );

    expect(
      screen.getByRole("navigation", { name: "业务工作区导航" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "样本对象" })).toHaveAttribute(
      "href",
      "/production/samples",
    );
    expect(screen.getByRole("link", { name: "样本对象" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "运营总览" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
