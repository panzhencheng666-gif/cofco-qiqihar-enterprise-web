import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { FormalEnterprisePrototype } from "./FormalEnterprisePrototype";

afterEach(cleanup);

describe("formal enterprise shell", () => {
  it("renders the unified report center without prototype chrome", () => {
    render(
      <FormalEnterprisePrototype initialSearch="?page=reporting&section=business-reports" />,
    );

    expect(screen.getByText("齐齐哈尔粮食商情企业平台")).toBeVisible();
    expect(screen.queryByText("演示环境 · 非生产数据")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "业务报告" })).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "报表中心模块" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("界面方案切换")).not.toBeInTheDocument();
  });

  it("uses one enterprise application bar and a non-repeating sidebar", () => {
    const { container } = render(
      <FormalEnterprisePrototype initialSearch="?page=market&section=collection" />,
    );

    const applications = screen.getByRole("navigation", {
      name: "业务应用",
    });
    expect(within(applications).getAllByRole("button")).toHaveLength(6);
    expect(
      within(applications).getByRole("button", { name: "市场监测" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.queryByText("当前业务应用")).not.toBeInTheDocument();
    expect(
      screen.queryByText("统一业务与数据运营平台"),
    ).not.toBeInTheDocument();
    expect(container.querySelector(".formal-sidebar-description")).toBeNull();
    expect(container.querySelector(".formal-enterprise-shell")).not.toBeNull();
    expect(container.querySelector(".formal-header-primary")).not.toBeNull();
    expect(applications.parentElement).toHaveClass("formal-global-header");
  });

  it("exposes exactly six business applications", () => {
    render(<FormalEnterprisePrototype initialSearch="?page=work" />);

    const applications = screen.getByRole("navigation", {
      name: "业务应用",
    });
    expect(within(applications).getAllByRole("button")).toHaveLength(6);
    expect(within(applications).getByText("经营总览")).toBeVisible();
    expect(within(applications).getByText("供需与态势")).toBeVisible();
    expect(within(applications).getByText("报表中心")).toBeVisible();
  });

  it("uses one complete regional context across production and market monitoring", async () => {
    const user = userEvent.setup();
    render(<FormalEnterprisePrototype initialSearch="?page=market" />);

    const marketRegion = screen.getByRole("combobox", { name: "业务地区" });
    expect(
      within(marketRegion).getByRole("option", { name: "黑河市全域" }),
    ).toBeInTheDocument();
    expect(
      within(marketRegion).getByRole("option", {
        name: "莫力达瓦达斡尔族自治旗",
      }),
    ).toBeInTheDocument();

    await user.selectOptions(marketRegion, "heihe-all");
    expect(marketRegion).toHaveValue("heihe-all");

    await user.click(
      within(screen.getByRole("navigation", { name: "业务应用" })).getByRole(
        "button",
        { name: "产情监测" },
      ),
    );
    expect(screen.getByRole("combobox", { name: "业务地区" })).toHaveValue(
      "heihe-all",
    );

    await user.click(
      within(screen.getByRole("navigation", { name: "业务应用" })).getByRole(
        "button",
        { name: "报表中心" },
      ),
    );
    await user.click(screen.getByRole("button", { name: "履责报告" }));
    expect(screen.getByRole("combobox", { name: "履责责任区域" })).toHaveValue(
      "heihe-all",
    );
  });

  it("labels every icon-only shell tool", () => {
    render(<FormalEnterprisePrototype initialSearch="?page=market" />);

    expect(screen.getByRole("button", { name: /任务中心/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /通知/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "帮助" })).toBeVisible();
    expect(screen.getByRole("button", { name: "收起左侧导航" })).toBeVisible();
  });

  it("uses the real Qiqihar business-unit hierarchy and keeps the personal account at the far right", () => {
    const { container } = render(
      <FormalEnterprisePrototype initialSearch="?page=market" />,
    );

    expect(
      screen.getByRole("button", {
        name: /当前工作单位.*齐齐哈尔经营部.*经营部本部/,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /个人账户.*王洋/ }),
    ).toBeVisible();
    expect(screen.queryByText("东北区域经营中心")).not.toBeInTheDocument();
    expect(
      container.querySelector(".formal-header-primary")?.lastElementChild,
    ).toHaveClass("formal-user");
  });

  it("opens the authorized work-unit hierarchy and personal account menu", async () => {
    const user = userEvent.setup();
    render(<FormalEnterprisePrototype initialSearch="?page=market" />);

    await user.click(
      screen.getByRole("button", {
        name: /当前工作单位.*齐齐哈尔经营部.*经营部本部/,
      }),
    );
    const organizationMenu = screen.getByRole("menu", {
      name: "工作单位选择",
    });
    for (const unit of [
      "经营部本部",
      "讷河库",
      "克山库",
      "克东库",
      "龙镇库",
      "成吉思汗库",
    ]) {
      expect(
        within(organizationMenu).getByRole("menuitem", { name: unit }),
      ).toBeVisible();
    }

    await user.click(screen.getByRole("button", { name: /个人账户.*王洋/ }));
    expect(
      screen.getByRole("menu", { name: "个人账户菜单" }),
    ).toHaveTextContent("所属单位：经营部本部");
    expect(
      screen.getByRole("menu", { name: "个人账户菜单" }),
    ).toHaveTextContent("账号安全");
  });

  it("shows only the canonical balance statement and version history in supply navigation", () => {
    render(<FormalEnterprisePrototype initialSearch="?page=supply" />);

    const navigation = screen.getByRole("navigation", {
      name: "供需与态势模块",
    });
    expect(within(navigation).getAllByRole("button")).toHaveLength(2);
    expect(within(navigation).getByText("供需平衡表")).toBeVisible();
    expect(within(navigation).getByText("版本记录")).toBeVisible();
    for (const oldLabel of [
      "供需总览",
      "产品账户",
      "区域平衡",
      "指标与来源",
      "态势分析",
    ]) {
      expect(within(navigation).queryByText(oldLabel)).not.toBeInTheDocument();
    }
  });

  it("collapses the sidebar without hiding business names from assistive technology", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <FormalEnterprisePrototype initialSearch="?page=production&section=collection" />,
    );

    await user.click(screen.getByRole("button", { name: "收起左侧导航" }));
    expect(container.querySelector(".formal-enterprise")).toHaveClass(
      "is-sidebar-collapsed",
    );
    expect(
      screen.getByRole("navigation", { name: "产情监测模块" }),
    ).toHaveTextContent("数据采集");
    expect(screen.getByRole("button", { name: "展开左侧导航" })).toBeVisible();
  });

  it("keeps reporting supervision centralized and auditable", async () => {
    const user = userEvent.setup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=reporting&section=duty-reports" />,
    );

    await user.click(screen.getByText("查看填报规则"));
    expect(screen.getByText("一人一责区")).toBeVisible();
    expect(screen.getByText("他人无权代填")).toBeVisible();
    expect(screen.getByText("每周填报一次")).toBeVisible();
    expect(screen.getByText("逾期补填保留原逾期记录")).toBeVisible();
    expect(screen.getByRole("button", { name: "导出责任周报" })).toBeVisible();
    expect(screen.getByRole("button", { name: "导出责任月报" })).toBeVisible();
  });

  it("keeps crop varieties, quality, and production collection together", async () => {
    const user = userEvent.setup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=production&section=collection" />,
    );

    expect(
      screen.getByRole("heading", { name: "产情数据采集工作台" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "在线填报" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Excel批量导入" })).toBeVisible();
    expect(screen.getByRole("button", { name: "授权系统接入" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "具体品种" })).toHaveValue(
      "德美亚3号",
    );
    expect(screen.getByRole("textbox", { name: "水分" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "容重" })).toBeVisible();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "作物" }),
      "soybean",
    );
    expect(screen.getByRole("textbox", { name: "具体品种" })).toHaveValue(
      "黑农84",
    );
    expect(screen.getByRole("textbox", { name: "蛋白" })).toBeVisible();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "作物" }),
      "paddy",
    );
    expect(screen.getByRole("textbox", { name: "具体品种" })).toHaveValue(
      "龙粳31",
    );
    expect(screen.getByRole("textbox", { name: "出米率" })).toBeVisible();
  });

  it("opens business entry from My Work without duplicating fields", async () => {
    const user = userEvent.setup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=work&section=reporting" />,
    );

    expect(
      screen.queryByRole("textbox", { name: "本周玉米主流收购价格" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "进入市场填报" }));
    expect(
      screen.getByRole("heading", { name: "市场监测数据采集" }),
    ).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "市场监测模块" }),
    ).toBeVisible();
  });

  it("shows a read-only executive overview with domain drill-down", () => {
    render(<FormalEnterprisePrototype initialSearch="?page=overview" />);

    expect(
      screen.getByRole("heading", { name: "粮食商情经营总览" }),
    ).toBeVisible();
    const businessSummary = screen.getByRole("table", {
      name: "业务运行摘要",
    });
    expect(within(businessSummary).getByText("产情正式指标")).toBeVisible();
    expect(within(businessSummary).getByText("市场运行态势")).toBeVisible();
    expect(within(businessSummary).getByText("供需账户状态")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "维护经营数字" }),
    ).not.toBeInTheDocument();
  });

  it("opens report composition from the selected market workspace", async () => {
    const user = userEvent.setup();
    render(<FormalEnterprisePrototype initialSearch="?page=market" />);

    await user.click(screen.getByRole("button", { name: "编制业务报告" }));

    expect(screen.getByRole("dialog", { name: "编制业务报告" })).toBeVisible();
    expect(screen.getByText("市场监测 · 玉米")).toBeVisible();
    expect(screen.getByText("玉米市场监测第 31 周已核定数据")).toBeVisible();
  });

  it("shows the explicit supply scope and allows county drill-down", async () => {
    const user = userEvent.setup();
    render(<FormalEnterprisePrototype initialSearch="?page=supply" />);

    const scope = screen.getByRole("region", {
      name: "供需平衡查询条件",
    });
    const region = within(scope).getByRole("combobox", {
      name: "业务地区",
    });
    expect(region).toHaveValue("qiqihar-all");

    await user.selectOptions(region, "qiqihar-nehe");
    expect(screen.getAllByText("讷河市 · 玉米原粮").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("table", { name: "区域粮食供需平衡表数据" }),
    ).toBeVisible();
    expect(screen.getAllByText("126.4 万吨").length).toBeGreaterThan(0);
  });

  it("uses compact five-item architectures inside each business", () => {
    render(<FormalEnterprisePrototype initialSearch="?page=market" />);

    const navigation = screen.getByRole("navigation", {
      name: "市场监测模块",
    });
    expect(within(navigation).getAllByRole("button")).toHaveLength(5);
    expect(within(navigation).getByText("监测总览")).toBeVisible();
    expect(within(navigation).getByText("数据采集")).toBeVisible();
    expect(screen.queryByText("业务生命周期")).not.toBeInTheDocument();
  });
});
