import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { SupplyBalancePanel } from "./SupplyBalancePanel";

afterEach(cleanup);

describe("SupplyBalancePanel", () => {
  it("shows the governed balance equation and reconciliation result", () => {
    render(<SupplyBalancePanel />);

    const equation = screen.getByRole("region", {
      name: "供需平衡核心公式",
    });
    expect(equation).toHaveTextContent(
      "总供给763.1万吨减期间总使用与外流659.2万吨等于调整前账面推算期末库存103.9万吨",
    );
    expect(within(equation).getByText("采用后账面期末库存")).toBeVisible();
    expect(
      within(equation).getByText("调查汇总期末库存 103.9 万吨"),
    ).toBeVisible();
    expect(within(equation).getByText("库存平衡差额 0.0 万吨")).toBeVisible();
    expect(screen.getByRole("region", { name: "供需账户明细" })).toBeVisible();
  });

  it("switches between separate product accounts without mixing facts", async () => {
    const user = userEvent.setup();
    render(<SupplyBalancePanel />);

    await user.click(screen.getByRole("button", { name: "大豆产品账户" }));

    expect(screen.getByText("压榨投料")).toBeVisible();
    expect(screen.getByText("非压榨蛋白加工投料")).toBeVisible();
    expect(screen.getByText("2026 年第 2 版")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "大米产品账户" }));
    expect(screen.getByText("稻谷加工产出")).toBeVisible();
    expect(screen.queryByText("稻谷期初库存")).not.toBeInTheDocument();
  });

  it("shows the governed input and rule versions for the selected account", async () => {
    const user = userEvent.setup();
    render(<SupplyBalancePanel />);

    const governance = screen.getByRole("region", {
      name: "输入与规则版本",
    });
    expect(within(governance).getByText("指标输入版本")).toBeVisible();
    expect(governance).toHaveTextContent(
      "以下为演示账户的完整版本组合，不代表生产发布",
    );
    expect(within(governance).getByText("玉米指标发布第 7 版")).toBeVisible();
    expect(within(governance).getByText("账户规范版本")).toBeVisible();
    expect(
      within(governance).getByText("玉米原粮账户规范第 3 版"),
    ).toBeVisible();
    expect(within(governance).getByText("库存合并矩阵版本")).toBeVisible();
    expect(
      within(governance).getByText("区域库存合并矩阵第 4 版"),
    ).toBeVisible();
    expect(within(governance).getByText("公式版本")).toBeVisible();
    expect(within(governance).getByText("玉米供需公式第 3 版")).toBeVisible();
    expect(within(governance).getByText("结果版本")).toBeVisible();
    expect(
      within(governance).getByText("玉米账户演示结果第 3 版"),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "大豆产品账户" }));

    expect(within(governance).getByText("大豆指标发布第 5 版")).toBeVisible();
    expect(
      within(governance).queryByText("玉米指标发布第 7 版"),
    ).not.toBeInTheDocument();
    expect(
      within(governance).getByText("大豆原豆供需公式第 2 版"),
    ).toBeVisible();
  });

  it("opens the selected indicator lineage without exposing technical identifiers", async () => {
    const user = userEvent.setup();
    render(<SupplyBalancePanel />);

    await user.click(
      screen.getByRole("button", { name: "查看来源说明 玉米产量" }),
    );

    const lineage = screen.getByRole("dialog", {
      name: "指标来源说明",
    });
    expect(lineage).toHaveTextContent("玉米产量");
    expect(lineage).toHaveTextContent("产情产量");
    expect(lineage).toHaveTextContent("发布指标对应");
    expect(lineage).not.toHaveTextContent(/metric-value|metric-release/);
  });
});
