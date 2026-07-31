import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BusinessContextBar,
  CollectionModeSwitch,
  WorkspaceStatus,
} from "./UnifiedWorkspacePrimitives";

afterEach(cleanup);

describe("unified workspace primitives", () => {
  it("renders one compact business context coordinate", () => {
    render(
      <BusinessContextBar
        items={[
          ["组织", "东北区域经营中心"],
          ["地区", "齐齐哈尔指定范围"],
          ["期间", "2026 年第 31 周"],
        ]}
        state="本期采集中"
      />,
    );

    expect(screen.getByText("东北区域经营中心")).toBeVisible();
    expect(screen.getByText("齐齐哈尔指定范围")).toBeVisible();
    expect(screen.getByText("2026 年第 31 周")).toBeVisible();
    expect(screen.getByText("本期采集中")).toBeVisible();
  });

  it("keeps status dimensions explicit", () => {
    render(
      <div>
        <WorkspaceStatus tone="warning">质量警告</WorkspaceStatus>
        <WorkspaceStatus tone="danger">截止未提交</WorkspaceStatus>
        <WorkspaceStatus tone="good">已发布</WorkspaceStatus>
      </div>,
    );

    expect(screen.getByText("质量警告")).toHaveClass("is-warning");
    expect(screen.getByText("截止未提交")).toHaveClass("is-danger");
    expect(screen.getByText("已发布")).toHaveClass("is-good");
  });

  it("switches collection mode without creating another workflow", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CollectionModeSwitch mode="online" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "在线填报" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Excel批量导入" }));
    expect(onChange).toHaveBeenCalledWith("excel");
  });
});
