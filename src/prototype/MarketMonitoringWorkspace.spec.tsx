import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getAllByText(/德美亚3号、京科968/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("region", { name: "价格对应质量条件" }),
    ).toHaveTextContent("水分");
    expect(
      screen.getByRole("region", { name: "价格对应质量条件" }),
    ).toHaveTextContent("容重");
    expect(
      screen.getByRole("region", { name: "价格对应质量条件" }),
    ).toHaveTextContent("毒素");
  });

  it("shows registered varieties in the monitoring-object registry", () => {
    render(
      <MarketMonitoringWorkspace section="objects" onComposeReport={vi.fn()} />,
    );

    expect(
      screen.getByRole("columnheader", { name: "当前监测品种" }),
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "质量采集范围" }),
    ).toBeVisible();
    expect(screen.getByText("龙粳31 · 绥粳18")).toBeVisible();
    expect(screen.getByText("德美亚3号 · 黑农84")).toBeVisible();
    expect(screen.getByText(/玉米深加工/)).toBeVisible();
    expect(screen.getByText("种子 · 农药 · 化肥")).toBeVisible();
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

  it("builds the report from the grain selected on the overview", async () => {
    const user = userEvent.setup();
    const onComposeReport = vi.fn();
    render(
      <MarketMonitoringWorkspace
        section="overview"
        onComposeReport={onComposeReport}
      />,
    );

    await user.click(screen.getByRole("button", { name: "切换到大豆" }));
    await user.click(screen.getByRole("button", { name: "编制业务报告" }));

    expect(onComposeReport).toHaveBeenCalledWith(
      expect.objectContaining({ product: "大豆" }),
    );
  });

  it("keeps subject and logistics collection in one workbench", async () => {
    const user = userEvent.setup();
    render(
      <MarketMonitoringWorkspace
        section="collection"
        onComposeReport={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "市场主体填报" })).toBeVisible();
    expect(screen.getByRole("button", { name: "物流节点填报" })).toBeVisible();
    expect(screen.getAllByText("讷河恒泰米业").length).toBeGreaterThan(0);
    expect(screen.getAllByText("收购与价格").length).toBeGreaterThan(0);
    expect(screen.getAllByText("质量条件").length).toBeGreaterThan(0);

    await user.click(
      screen.getByRole("button", {
        name: /MK-2026-31021.*龙江北方粮贸有限公司/,
      }),
    );

    expect(screen.getByDisplayValue("德美亚3号")).toBeVisible();
    expect(screen.getByDisplayValue("716")).toBeVisible();
    expect(screen.queryByDisplayValue("龙粳31")).not.toBeInTheDocument();
    expect(screen.getByText(/当前任务仅责任人 赵晨 可编辑/)).toBeVisible();
    expect(screen.getByRole("button", { name: "提交审核" })).toBeDisabled();

    await user.click(
      screen.getByRole("button", {
        name: /MK-2026-31025.*梅里斯惠农农资服务部/,
      }),
    );

    expect(screen.getByDisplayValue("种子")).toBeVisible();
    expect(screen.getByDisplayValue("48")).toBeVisible();
    expect(screen.getByText("商品、规格和计量口径")).toBeVisible();
    expect(screen.queryByText("质量条件")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "物流节点填报" }));

    expect(screen.getAllByText("齐齐哈尔铁路货运站").length).toBeGreaterThan(0);
    expect(screen.getAllByText("流入流出").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("德美亚3号")).toBeVisible();
    expect(screen.queryByDisplayValue("龙粳31")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "提交审核" })).toBeEnabled();
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

    expect(
      screen.getByRole("heading", { name: "市场主体任务批量录入" }),
    ).toBeVisible();
    expect(screen.getByText("上传后先预检，不直接提交")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "下载当前任务模板" }),
    ).toBeVisible();
    expect(screen.getByText("错误定位到工作表、行和列")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "物流节点填报" }));
    expect(
      screen.getByRole("heading", { name: "物流节点任务批量录入" }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "系统接入记录" }));
    expect(
      screen.getByRole("heading", {
        name: "物流节点稳定来源接入与异常处理",
      }),
    ).toBeVisible();
    expect(screen.getByText("铁路货运运单数据")).toBeVisible();
    expect(screen.getByText("公路过磅与运单数据")).toBeVisible();
    expect(screen.queryByText("米厂生产日报")).not.toBeInTheDocument();
  });

  it("shows supply adoption and keeps duty supervision out of market business", () => {
    const { rerender } = render(
      <MarketMonitoringWorkspace section="review" onComposeReport={vi.fn()} />,
    );

    expect(
      screen.getByRole("region", { name: "市场数据发布与供需采用关系" }),
    ).toHaveTextContent("库存、加工和去重物流按版本引用");

    rerender(
      <MarketMonitoringWorkspace section="reports" onComposeReport={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "生成日报" })).toBeVisible();
    expect(screen.getByRole("button", { name: "生成周报" })).toBeVisible();
    expect(screen.getByRole("button", { name: "生成月报" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "导出履责周报" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "导出履责月报" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "农资" }));
    expect(screen.getByText("农资市场专题日报")).toBeVisible();
    expect(screen.getAllByText(/农资专题不进入粮食供需数量/).length).toBe(3);
  });
});
