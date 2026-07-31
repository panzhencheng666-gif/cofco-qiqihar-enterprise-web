import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketMonitoringWorkspace } from "./MarketMonitoringWorkspace";

afterEach(cleanup);

describe("market monitoring workspace", () => {
  it("shows a clear overview and current administrative-source state", () => {
    render(
      <MarketMonitoringWorkspace
        section="overview"
        onComposeReport={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "粮食市场监测总览" }),
    ).toBeVisible();
    expect(screen.getByText("三大监测区域")).toBeVisible();
    expect(screen.getAllByText("待核定").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "切换到玉米" })).toBeVisible();
    expect(screen.getByRole("button", { name: "切换到大豆" })).toBeVisible();
    expect(screen.getByRole("button", { name: "切换到稻谷" })).toBeVisible();
  });

  it("enters collection from the primary action", async () => {
    const user = userEvent.setup();
    const onSectionChange = vi.fn();
    render(
      <MarketMonitoringWorkspace
        section="overview"
        onSectionChange={onSectionChange}
        onComposeReport={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "进入数据采集" }));

    expect(onSectionChange).toHaveBeenCalledWith("collection");
  });
});
