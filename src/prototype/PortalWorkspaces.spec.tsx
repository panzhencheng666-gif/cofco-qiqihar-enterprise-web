import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExecutiveOverviewWorkspace } from "./ExecutiveOverviewWorkspace";
import { MyWorkWorkspace } from "./MyWorkWorkspace";

afterEach(cleanup);

describe("enterprise portal workspaces", () => {
  it("routes personal tasks to the owning business document", async () => {
    const user = userEvent.setup();
    const onOpenBusiness = vi.fn();
    render(
      <MyWorkWorkspace section="tasks" onOpenBusiness={onOpenBusiness} />,
    );
    await user.click(screen.getByRole("tab", { name: "待我填报" }));

    await user.click(screen.getByRole("button", { name: "进入市场填报" }));
    expect(onOpenBusiness).toHaveBeenCalledWith(
      { application: "market", section: "tasks" },
      { type: "work-item", id: "WORK-MARKET-FILL-W31" },
    );
    expect(
      screen.queryByRole("textbox", { name: "本周玉米主流收购价格" }),
    ).not.toBeInTheDocument();
  });

  it("shows a read-only executive overview with domain drill-down", async () => {
    const user = userEvent.setup();
    const onOpenRoute = vi.fn();
    render(
      <ExecutiveOverviewWorkspace section="operations" onOpenRoute={onOpenRoute} />,
    );

    const businessSummary = screen.getByRole("table", {
      name: "业务运行摘要",
    });
    expect(within(businessSummary).getByText("产情正式指标")).toBeVisible();
    expect(within(businessSummary).getByText("市场运行态势")).toBeVisible();
    expect(within(businessSummary).getByText("供需账户状态")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "维护经营数字" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "进入产情监测" }));
    expect(onOpenRoute).toHaveBeenCalledWith({ application: "production", section: "tasks" });
  });

  it("presents My Work as one task-led table instead of a dashboard grid", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MyWorkWorkspace section="tasks" onOpenBusiness={vi.fn()} />,
    );
    await user.click(screen.getByRole("tab", { name: "待我处理" }));

    expect(screen.getByRole("table", { name: "本人责任任务" })).toBeVisible();
    expect(screen.getByRole("table", { name: "今日重点事项" })).toBeVisible();
    expect(container.querySelector(".unified-two-column")).toBeNull();
    expect(container.querySelector(".unified-attention-panel")).toBeNull();
  });

  it("limits executive overview to one summary strip and operational tables", () => {
    const { container } = render(
      <ExecutiveOverviewWorkspace section="operations" onOpenRoute={vi.fn()} />,
    );

    expect(screen.getByLabelText("经营核心摘要").children).toHaveLength(4);
    expect(screen.getByRole("table", { name: "业务运行摘要" })).toBeVisible();
    expect(screen.getByRole("table", { name: "经营风险清单" })).toBeVisible();
    expect(container.querySelector(".unified-three-column")).toBeNull();
  });
});
