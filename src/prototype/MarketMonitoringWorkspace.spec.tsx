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

  it("keeps subject and logistics collection in one workbench", async () => {
    const user = userEvent.setup();
    render(
      <MarketMonitoringWorkspace
        section="collection"
        onComposeReport={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "市场主体填报" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "物流节点填报" }),
    ).toBeVisible();
    expect(screen.getAllByText("讷河恒泰米业").length).toBeGreaterThan(0);
    expect(screen.getAllByText("收购与价格").length).toBeGreaterThan(0);
    expect(screen.getAllByText("质量条件").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "物流节点填报" }));

    expect(
      screen.getAllByText("齐齐哈尔铁路货运站").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("流入流出").length).toBeGreaterThan(0);
  });

  it("supports Excel precheck without creating a second workflow", async () => {
    const user = userEvent.setup();
    render(
      <MarketMonitoringWorkspace
        section="collection"
        onComposeReport={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Excel批量导入" }));

    expect(screen.getByText("上传后先预检，不直接提交")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "下载当前任务模板" }),
    ).toBeVisible();
    expect(screen.getByText("错误定位到工作表、行和列")).toBeVisible();
  });
});
