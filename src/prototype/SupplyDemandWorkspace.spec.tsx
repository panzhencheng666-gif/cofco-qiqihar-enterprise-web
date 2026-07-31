import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EnterpriseRegionProvider } from "./EnterpriseRegionContext";
import { SupplyDemandWorkspace } from "./SupplyDemandWorkspace";
import type { EnterpriseRegionId } from "./enterpriseRegions";

afterEach(cleanup);

describe("supply demand workspace", () => {
  function RegionHarness() {
    const [regionId, setRegionId] = useState<EnterpriseRegionId>("qiqihar-all");
    return (
      <EnterpriseRegionProvider
        regionId={regionId}
        onRegionChange={setRegionId}
      >
        <SupplyDemandWorkspace section="overview" onComposeReport={vi.fn()} />
      </EnterpriseRegionProvider>
    );
  }

  it("presents one authoritative balance statement without repeating the equation", () => {
    const { container } = render(
      <SupplyDemandWorkspace section="overview" onComposeReport={vi.fn()} />,
    );

    expect(screen.getAllByText("调整前账面期末").length).toBeGreaterThan(0);
    expect(screen.getAllByText("库存平衡差额").length).toBeGreaterThan(0);
    expect(screen.getByText("调查汇总期末 − 调整前账面期末")).toBeVisible();
    expect(
      screen.getByRole("table", { name: "区域粮食供需平衡表" }),
    ).toBeVisible();
    expect(screen.queryByRole("region", { name: "供需核心等式" })).toBeNull();
    expect(screen.queryByRole("table", { name: "供需账户构成" })).toBeNull();
    expect(screen.queryByRole("table", { name: "库存差异解释" })).toBeNull();
    expect(container.querySelector(".unified-metric-strip")).toBeNull();
  });

  it("shows region, product, period and adopted input version together", () => {
    render(
      <SupplyDemandWorkspace section="lineage" onComposeReport={vi.fn()} />,
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
    function RegionalHarness() {
      const [regionId, setRegionId] =
        useState<EnterpriseRegionId>("qiqihar-all");
      return (
        <EnterpriseRegionProvider
          regionId={regionId}
          onRegionChange={setRegionId}
        >
          <SupplyDemandWorkspace section="regional" onComposeReport={vi.fn()} />
        </EnterpriseRegionProvider>
      );
    }
    render(<RegionalHarness />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "业务地区" }),
      "qiqihar-nehe",
    );
    expect(screen.getAllByText("2026/27 年度讷河账户").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("县级账户")).toBeVisible();
    expect(screen.getByText("12 / 14 项已核定")).toBeVisible();
    expect(
      screen.getByRole("table", { name: "市县供需账户对比" }),
    ).toBeVisible();
    expect(screen.queryByRole("region", { name: "供需核心等式" })).toBeNull();
    expect(screen.queryByRole("table", { name: "供需账户构成" })).toBeNull();
  });

  it("shows a truthful unavailable state for regions without a formal account", async () => {
    const user = userEvent.setup();
    const { container } = render(<RegionHarness />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "业务地区" }),
      "heihe-all",
    );

    expect(screen.getByRole("combobox", { name: "业务地区" })).toHaveValue(
      "heihe-all",
    );
    expect(screen.getAllByText("尚未建立正式供需账户").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByRole("table", { name: "供需账户准备状态" }),
    ).toBeVisible();
    expect(screen.queryByRole("region", { name: "供需核心等式" })).toBeNull();
    expect(container.querySelector(".workspace-summary-strip")).toBeNull();
    expect(screen.queryByRole("region", { name: "当前业务上下文" })).toBeNull();
  });

  it("does not mix Qiqihar county rows into another region's comparison", async () => {
    const user = userEvent.setup();
    function RegionalHarness() {
      const [regionId, setRegionId] =
        useState<EnterpriseRegionId>("qiqihar-all");
      return (
        <EnterpriseRegionProvider
          regionId={regionId}
          onRegionChange={setRegionId}
        >
          <SupplyDemandWorkspace section="regional" onComposeReport={vi.fn()} />
        </EnterpriseRegionProvider>
      );
    }
    render(<RegionalHarness />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "业务地区" }),
      "heihe-all",
    );

    expect(
      screen.getByRole("table", { name: "供需账户准备状态" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("table", { name: "市县供需账户对比" }),
    ).toBeNull();
  });
});
