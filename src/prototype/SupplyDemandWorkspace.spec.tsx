import { useState } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EnterpriseRegionProvider } from "./EnterpriseRegionContext";
import type { EnterpriseRegionId } from "./enterpriseRegions";
import type { SupplySection } from "./formalEnterpriseModel";
import { SupplyDemandWorkspace } from "./SupplyDemandWorkspace";

afterEach(cleanup);

describe("supply demand workspace", () => {
  function RegionHarness({
    section = "statement",
  }: {
    section?: SupplySection;
  }) {
    const [regionId, setRegionId] = useState<EnterpriseRegionId>("qiqihar-all");
    return (
      <EnterpriseRegionProvider
        regionId={regionId}
        onRegionChange={setRegionId}
      >
        <SupplyDemandWorkspace section={section} onComposeReport={vi.fn()} />
      </EnterpriseRegionProvider>
    );
  }

  it("shows one complete and understandable regional balance statement", () => {
    const { container } = render(<RegionHarness />);

    expect(
      screen.getByRole("heading", { name: "区域粮食供需平衡表" }),
    ).toBeVisible();
    expect(screen.getByRole("combobox", { name: "业务地区" })).toHaveValue(
      "qiqihar-all",
    );
    expect(screen.getByRole("combobox", { name: "产品账户" })).toHaveValue(
      "corn",
    );
    expect(screen.getByRole("combobox", { name: "营销年度" })).toHaveValue(
      "2026-27",
    );

    const statement = screen.getByRole("table", {
      name: "区域粮食供需平衡表数据",
    });
    for (const item of [
      "期初库存",
      "本地生产",
      "区域外流入",
      "国际进口",
      "其他供给",
      "总供给",
      "口粮消费",
      "饲用消费",
      "种用消费",
      "加工投入",
      "损耗",
      "区域外流出",
      "国际出口",
      "其他使用",
      "总使用与外流",
      "调整前账面期末",
      "批准库存调整",
      "采用后账面期末",
      "调查汇总期末",
      "库存平衡差额",
    ]) {
      expect(statement).toHaveTextContent(item);
    }
    expect(within(statement).getByText("来源业务")).toBeVisible();
    expect(within(statement).getByText("来源版本")).toBeVisible();
    expect(
      within(statement).getAllByRole("button", { name: /查看.*来源/ }).length,
    ).toBeGreaterThan(0);
    expect(container.querySelector(".unified-metric-strip")).toBeNull();
    expect(screen.queryByText("供需核心等式")).not.toBeInTheDocument();
  });

  it("uses the region selector for both all-area and county accounts", async () => {
    const user = userEvent.setup();
    render(<RegionHarness />);

    const region = screen.getByRole("combobox", { name: "业务地区" });
    expect(
      within(region).getByRole("option", { name: "黑河市全域" }),
    ).toBeInTheDocument();
    expect(
      within(region).getByRole("option", { name: "讷河市" }),
    ).toBeInTheDocument();

    await user.selectOptions(region, "qiqihar-nehe");
    expect(region).toHaveValue("qiqihar-nehe");
    expect(screen.getAllByText("讷河市 · 玉米原粮").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("table", { name: "区域粮食供需平衡表数据" }),
    ).toBeVisible();
  });

  it("keeps missing account values distinct from zero", async () => {
    const user = userEvent.setup();
    render(<RegionHarness />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "产品账户" }),
      "soybean",
    );

    expect(screen.getAllByText("尚未形成正式账户版本").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("缺失")).toBeVisible();
    expect(screen.queryByText("0.0 万吨")).not.toBeInTheDocument();
  });

  it("opens concise source evidence from the selected balance row", async () => {
    const user = userEvent.setup();
    render(<RegionHarness />);

    await user.click(screen.getByRole("button", { name: "查看本地生产来源" }));

    const detail = screen.getByRole("region", { name: "本地生产来源详情" });
    expect(detail).toHaveTextContent("产情监测");
    expect(detail).toHaveTextContent("2026年第30周正式产量版本");
    expect(detail).toHaveTextContent("齐齐哈尔市全域");
  });

  it("uses a separate version-history table without recreating the balance page", () => {
    render(<RegionHarness section="versions" />);

    expect(screen.getByRole("heading", { name: "供需版本记录" })).toBeVisible();
    expect(screen.getByRole("table", { name: "供需版本记录" })).toBeVisible();
    expect(
      screen.queryByRole("table", { name: "区域粮食供需平衡表数据" }),
    ).not.toBeInTheDocument();
  });
});
