import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketMonitoringWorkspace } from "./MarketMonitoringWorkspace";

afterEach(cleanup);

describe("market monitoring workspace", () => {
  it("shows a clear overview and current administrative-source state", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MarketMonitoringWorkspace
        section="tasks"
        onComposeReport={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "市场总览" }));

    expect(
      screen.getByRole("heading", { name: "粮食市场监测总览" }),
    ).toBeVisible();
    expect(screen.getByRole("combobox", { name: "业务地区" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "样本类型" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "粮食品种" })).toHaveValue(
      "corn",
    );
    expect(
      screen.getByRole("table", { name: "市场报送任务清单" }),
    ).toHaveTextContent("德美亚3号");
    expect(
      screen.getByRole("table", { name: "市场报送任务清单" }),
    ).toHaveTextContent("水分");
    expect(
      screen.getByRole("table", { name: "市场报送任务清单" }),
    ).toHaveTextContent("容重");
    expect(
      screen.getByRole("table", { name: "市场报送任务清单" }),
    ).toHaveTextContent("毒素");
    expect(screen.getByLabelText("市场业务统计")).toBeVisible();
    expect(
      screen.getByRole("table", { name: "市场报送任务清单" }),
    ).toBeVisible();
    expect(container.querySelector(".market-metric-strip")).toBeNull();
    expect(container.querySelector(".market-overview-grid")).toBeNull();
    expect(container.querySelector(".market-grain-strip")).toBeNull();
    expect(container.querySelector(".market-quality-basis")).toBeNull();
    expect(container.querySelector(".workspace-summary-strip")).toBeNull();
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

  it("keeps every approved market role and its capability in one object registry", () => {
    render(
      <MarketMonitoringWorkspace section="objects" onComposeReport={vi.fn()} />,
    );

    const registry = screen.getByRole("table", {
      name: "市场对象业务能力清单",
    });
    for (const role of [
      "贸易商",
      "玉米深加工企业",
      "大豆压榨企业",
      "大豆蛋白加工企业",
      "食品和调味品企业",
      "米厂",
      "饲料企业",
      "养殖企业",
      "承储企业 / 储备库",
      "批发市场",
      "农资经销商",
      "铁路站点",
      "公路物流节点",
    ]) {
      expect(registry).toHaveTextContent(role);
    }
    expect(registry).toHaveTextContent("报价与成交");
    expect(registry).toHaveTextContent("货权、库点、批次");
    expect(registry).toHaveTextContent("投入、产出、副产品、损耗");
    expect(registry).toHaveTextContent("包粮 / 散粮到达与发运");
  });

  it("binds prices and inventory to complete market facts in online collection", () => {
    render(
      <MarketMonitoringWorkspace
        section="tasks"
        onComposeReport={vi.fn()}
      />,
    );

    for (const field of [
      "报价",
      "实际成交价",
      "成交数量",
      "包装形态",
      "交货方式",
      "结算条件",
      "货权人",
      "保管库点",
      "库存批次",
      "库存性质",
    ]) {
      expect(screen.getByRole("textbox", { name: field })).toBeVisible();
    }
  });

  it("keeps collection inside the formal tasks section", async () => {
    const user = userEvent.setup();
    render(
      <MarketMonitoringWorkspace
        section="tasks"
        onComposeReport={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "数据采集" }));
    expect(screen.getByRole("button", { name: "市场主体填报" })).toBeVisible();
  });

  it("builds the report from the grain selected on the overview", async () => {
    const user = userEvent.setup();
    const onComposeReport = vi.fn();
    render(
      <MarketMonitoringWorkspace
        section="tasks"
        onComposeReport={onComposeReport}
      />,
    );
    await user.click(screen.getByRole("button", { name: "市场总览" }));

    await user.selectOptions(
      screen.getByRole("combobox", { name: "粮食品种" }),
      "soybean",
    );
    await user.click(screen.getByRole("button", { name: "编制业务报告" }));

    expect(onComposeReport).toHaveBeenCalledWith(
      expect.objectContaining({ product: "大豆" }),
    );
  });

  it("keeps subject and logistics collection in one workbench", async () => {
    const user = userEvent.setup();
    render(
      <MarketMonitoringWorkspace
        section="tasks"
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
        section="tasks"
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

  it("shows supply adoption and keeps duty supervision out of market business", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <MarketMonitoringWorkspace section="tasks" onComposeReport={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: "市场审核" }));

    expect(
      screen.getByRole("region", { name: "市场数据发布与供需采用关系" }),
    ).toHaveTextContent("库存、加工和去重物流按版本引用");

    rerender(
      <MarketMonitoringWorkspace section="analysis" onComposeReport={vi.fn()} />,
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
