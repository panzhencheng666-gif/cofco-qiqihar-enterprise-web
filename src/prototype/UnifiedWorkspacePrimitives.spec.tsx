import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BusinessContextBar,
  CollectionModeSwitch,
  WorkspaceFilterBar,
  WorkspaceSummaryStrip,
  WorkspaceStatus,
  WorkspaceTableToolbar,
  WorkspaceTabs,
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

  it("renders one continuous table workbench sequence", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(
      <>
        <WorkspaceTabs
          active="current"
          label="任务状态"
          tabs={[
            { key: "current", label: "本期报送" },
            { key: "overdue", label: "逾期记录" },
          ]}
          onChange={onTabChange}
        />
        <WorkspaceFilterBar
          actions={<button type="button">查询</button>}
          label="任务筛选"
        >
          <label>
            地区
            <select aria-label="地区">
              <option>齐齐哈尔市</option>
            </select>
          </label>
        </WorkspaceFilterBar>
        <WorkspaceSummaryStrip
          items={[
            { label: "应报", value: "428" },
            { label: "逾期", value: "6", tone: "danger" },
          ]}
        />
        <WorkspaceTableToolbar title="报送任务清单" />
      </>,
    );

    await user.click(screen.getByRole("tab", { name: "逾期记录" }));
    expect(onTabChange).toHaveBeenCalledWith("overdue");
    expect(screen.getByRole("region", { name: "任务筛选" })).toBeVisible();
    expect(screen.getByLabelText("业务状态摘要")).toHaveTextContent(
      "应报428",
    );
    expect(
      screen.getByRole("toolbar", { name: "报送任务清单" }),
    ).toBeVisible();
  });
});
