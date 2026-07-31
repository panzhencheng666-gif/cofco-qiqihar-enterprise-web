import { cleanup, render, screen } from "@testing-library/react";
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
      <MyWorkWorkspace
        section="reporting"
        onOpenBusiness={onOpenBusiness}
      />,
    );

    await user.click(screen.getByRole("button", { name: "进入市场填报" }));
    expect(onOpenBusiness).toHaveBeenCalledWith("market", "collection");
    expect(
      screen.queryByRole("textbox", { name: "本周玉米主流收购价格" }),
    ).not.toBeInTheDocument();
  });

  it("shows a read-only executive overview with domain drill-down", async () => {
    const user = userEvent.setup();
    const onOpenApplication = vi.fn();
    render(
      <ExecutiveOverviewWorkspace onOpenApplication={onOpenApplication} />,
    );

    expect(
      screen.getByRole("heading", { name: "产情正式指标" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "市场运行态势" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "供需账户状态" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "维护经营数字" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "进入产情监测" }));
    expect(onOpenApplication).toHaveBeenCalledWith("production", "overview");
  });
});
