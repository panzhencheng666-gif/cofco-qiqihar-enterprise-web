import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SupplyDemandWorkspace } from "./SupplyDemandWorkspace";

afterEach(cleanup);

describe("supply demand workspace", () => {
  it("explains ending inventory and the inventory balance difference", () => {
    render(
      <SupplyDemandWorkspace
        section="overview"
        onComposeReport={vi.fn()}
      />,
    );

    expect(screen.getByText("调整前账面期末")).toBeVisible();
    expect(screen.getAllByText("库存平衡差额").length).toBeGreaterThan(0);
    expect(
      screen.getByText("调查汇总期末 − 调整前账面期末"),
    ).toBeVisible();
    expect(
      screen.getAllByText("103.9", { selector: "strong" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("1.7", { selector: "strong" }).length,
    ).toBeGreaterThan(0);
  });

  it("shows region, product, period and adopted input version together", () => {
    render(
      <SupplyDemandWorkspace
        section="lineage"
        onComposeReport={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "指标与来源追溯" }),
    ).toBeVisible();
    expect(screen.getByText("齐齐哈尔市全域")).toBeVisible();
    expect(screen.getByText("玉米原粮")).toBeVisible();
    expect(screen.getByText("2026/27 营销年度")).toBeVisible();
    expect(screen.getByText("第 31 周市场正式指标版本")).toBeVisible();
  });

  it("drills from city consolidation to a county account", async () => {
    const user = userEvent.setup();
    render(
      <SupplyDemandWorkspace
        section="regional"
        onComposeReport={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "讷河市" }));
    const region = screen.getByRole("region", {
      name: "供需平衡地区范围",
    });
    expect(within(region).getByText("2026/27 年度讷河账户")).toBeVisible();
    expect(within(region).getByText("县级账户")).toBeVisible();
    expect(screen.getByText("12 / 14 项已核定")).toBeVisible();
  });
});
