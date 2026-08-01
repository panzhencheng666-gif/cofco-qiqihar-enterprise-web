import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { FormalEnterprisePrototype } from "./FormalEnterprisePrototype";

afterEach(cleanup);

describe("formal enterprise prototype", () => {
  it("uses the enterprise shell and the three-section production navigation", () => {
    render(
      <FormalEnterprisePrototype initialSearch="?page=production&section=objects" />,
    );

    expect(screen.getByText("齐齐哈尔粮食商情企业平台")).toBeVisible();
    const navigation = screen.getByRole("navigation", { name: "产情监测模块" });
    expect(within(navigation).getAllByRole("button")).toHaveLength(3);
    expect(within(navigation).getByText("业务任务")).toBeVisible();
    expect(within(navigation).getByText("监测对象")).toBeVisible();
    expect(within(navigation).getByText("监测分析")).toBeVisible();
  });

  it("changes applications through the location-owned route", async () => {
    const user = userEvent.setup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=market&section=tasks" />,
    );

    await user.click(
      within(screen.getByRole("navigation", { name: "业务应用" })).getByRole(
        "button",
        { name: "供需与态势" },
      ),
    );

    expect(window.location.search).toContain("page=supply");
    expect(
      screen.getByRole("navigation", { name: "供需与态势模块" }),
    ).toHaveTextContent("供需测算");
  });

  it("blocks workspace actions when a URL coordinate is unauthorized", () => {
    render(
      <FormalEnterprisePrototype initialSearch="?page=production&section=tasks&region=not-authorized" />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("当前范围无权查询");
    expect(
      screen.queryByRole("button", { name: "在线填报" }),
    ).not.toBeInTheDocument();
  });

  it("writes page-owned scope coordinates from visible workspace controls", async () => {
    const user = userEvent.setup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=production&section=tasks" />,
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "业务地区" }),
      "qiqihar-nehe",
    );
    await user.clear(screen.getByRole("textbox", { name: "范围产品" }));
    await user.type(screen.getByRole("textbox", { name: "范围产品" }), "corn");
    await user.clear(screen.getByRole("textbox", { name: "范围期间" }));
    await user.type(
      screen.getByRole("textbox", { name: "范围期间" }),
      "2026-W31",
    );

    expect(window.location.search).toContain("region=qiqihar-nehe");
    expect(window.location.search).toContain("product=corn");
    expect(window.location.search).toContain("period=2026-W31");
  });

  it("owns executive filters, route tabs, and selected metrics in the URL", async () => {
    const user = userEvent.setup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=overview&section=operations&period=2026-W31" />,
    );

    expect(screen.getByRole("combobox", { name: "业务地区" })).toHaveValue(
      "authorized-all",
    );
    expect(
      screen.getByRole("table", { name: "经营指标趋势台账" }),
    ).toBeVisible();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "业务域" }),
      "market",
    );
    expect(window.location.search).toContain("businessDomain=market");
    expect(screen.getByRole("button", { name: "分析采购价" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "分析采购价" }));
    expect(window.location.search).toContain(
      "selectedMetric=market.purchase-price",
    );
    expect(screen.getAllByRole("img")).toHaveLength(2);

    await user.click(screen.getByRole("tab", { name: "异常风险" }));
    expect(window.location.search).toContain("section=risks");
    expect(
      screen.getByRole("table", { name: "经营异常风险台账" }),
    ).toBeVisible();
  });

  it("requires a governed period before executing the executive query", async () => {
    const user = userEvent.setup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=overview&section=operations" />,
    );

    expect(screen.getByRole("combobox", { name: "经营期间" })).toHaveValue("");
    expect(screen.getByRole("alert")).toHaveTextContent("请选择经营期间");
    expect(screen.getByRole("alert")).toHaveTextContent("系统未执行数据查询");
    expect(screen.getByRole("status")).toHaveTextContent(
      "当前业务坐标没有可用经营指标",
    );
    expect(document.body).not.toHaveTextContent(
      /2026-W31|periodKey|prototypeExecutiveDefaultPeriodKey/,
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "经营期间" }),
      "2026-W31",
    );

    expect(window.location.search).toContain("period=2026-W31");
    expect(
      screen.getByRole("table", { name: "经营指标趋势台账" }),
    ).toBeVisible();
  });

  it("writes every executive business coordinate to the formal URL", async () => {
    const user = userEvent.setup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=overview&section=operations" />,
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "业务域" }),
      "market",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "业务分类" }),
      "market.quote-trade",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "地区层级" }),
      "county",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "经营期间" }),
      "2025-W31",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "产品或作物" }),
      "corn",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "具体品种" }),
      "jingke-968",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "数据层" }),
      "preliminary",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "指标数据版本" }),
      "METRIC-2026-W31-V3",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "风险状态" }),
      "warning",
    );

    expect(window.location.search).toContain("businessDomain=market");
    expect(window.location.search).toContain(
      "businessSubtype=market.quote-trade",
    );
    expect(window.location.search).toContain("regionLevel=county");
    expect(window.location.search).toContain("region=qiqihar-nehe");
    expect(window.location.search).toContain("period=2025-W31");
    expect(window.location.search).toContain("product=corn");
    expect(window.location.search).toContain("cultivar=jingke-968");
    expect(window.location.search).toContain("dataLayer=preliminary");
    expect(window.location.search).toContain(
      "releaseVersion=METRIC-2026-W31-V3",
    );
    expect(window.location.search).toContain("riskState=warning");
  });

  it("does not silently execute a shared URL with inconsistent region coordinates", () => {
    render(
      <FormalEnterprisePrototype initialSearch="?page=overview&section=operations&region=qiqihar-nehe&regionLevel=city&period=2026-W31" />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "地区层级与业务地区不一致",
    );
    expect(screen.getByRole("combobox", { name: "地区层级" })).toHaveValue(
      "city",
    );
    expect(screen.getByRole("combobox", { name: "业务地区" })).toHaveValue(
      "qiqihar-nehe",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "当前业务坐标没有可用经营指标",
    );
  });

  it("rejects unsupported executive coordinates with a Chinese explanation and no raw codes", () => {
    render(
      <FormalEnterprisePrototype initialSearch="?page=overview&section=operations&businessDomain=bogus-domain&riskState=bogus-risk&period=2026-W31" />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("业务筛选参数无效");
    expect(screen.getByRole("alert")).toHaveTextContent("系统未执行数据查询");
    expect(
      screen.getByRole("option", { name: "无效业务域（请重新选择）" }),
    ).toHaveProperty("selected", true);
    expect(
      screen.getByRole("option", { name: "无效风险状态（请重新选择）" }),
    ).toHaveProperty("selected", true);
    expect(screen.getByRole("status")).toHaveTextContent(
      "当前业务坐标没有可用经营指标",
    );
    expect(document.body).not.toHaveTextContent(/bogus-domain|bogus-risk/);
  });

  it("distinguishes an invalid executive period from a period that has not been selected", () => {
    render(
      <FormalEnterprisePrototype initialSearch="?page=overview&section=operations&period=unsupported-period" />,
    );

    expect(screen.getByRole("combobox", { name: "经营期间" })).toHaveValue(
      "unsupported-period",
    );
    expect(screen.getByLabelText("已应用业务坐标")).toHaveTextContent(
      "经营期间无效，请重新选择",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("请选择经营期间");
    expect(document.body).not.toHaveTextContent("unsupported-period");
  });

  it("restores the replaced page filter across application Back and Forward", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/?page=production&section=tasks");
    render(
      <FormalEnterprisePrototype initialSearch="?page=production&section=tasks" />,
    );

    const region = screen.getByRole("combobox", { name: "业务地区" });
    await user.selectOptions(region, "qiqihar-nehe");
    expect(window.location.search).toContain("region=qiqihar-nehe");

    await user.click(
      within(screen.getByRole("navigation", { name: "业务应用" })).getByRole(
        "button",
        { name: "市场监测" },
      ),
    );
    expect(window.location.search).toContain("page=market");

    window.history.back();
    await new Promise((resolve) => setTimeout(resolve, 20));
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByRole("combobox", { name: "业务地区" })).toHaveValue(
      "qiqihar-nehe",
    );

    window.history.forward();
    await new Promise((resolve) => setTimeout(resolve, 20));
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByRole("combobox", { name: "业务地区" })).toHaveValue(
      "authorized-all",
    );
  });

  it("renders authorized classification catalog entries in the visible scope filter", () => {
    render(
      <FormalEnterprisePrototype initialSearch="?page=production&section=tasks" />,
    );

    const classification = screen.getByRole("combobox", { name: "业务分类" });
    expect(
      within(classification).getByRole("option", { name: "种植生产" }),
    ).toHaveValue("production.planting-production");
    expect(
      within(classification).queryByRole("option", { name: "市场库存" }),
    ).not.toBeInTheDocument();
  });

  it("uses only authorized regions and domain-specific governed classifications", () => {
    const cases = [
      ["?page=overview&section=operations", "种植生产", "成本与政策支持"],
      ["?page=work&section=tasks", "种植生产", "供给"],
      ["?page=production&section=tasks", "种植生产", "报价与交易"],
      ["?page=market&section=tasks", "报价与交易", "种植生产"],
      ["?page=supply&section=calculation", "供给", "报价与交易"],
      ["?page=reporting&section=compose", "产情报告", "种植生产"],
    ] as const;

    for (const [search, expected, excluded] of cases) {
      cleanup();
      render(<FormalEnterprisePrototype initialSearch={search} />);
      const classification = screen.getByRole("combobox", { name: "业务分类" });
      expect(
        within(classification).getByRole("option", { name: expected }),
      ).toBeVisible();
      expect(
        within(classification).queryByRole("option", { name: excluded }),
      ).not.toBeInTheDocument();
      const region = screen.getByRole("combobox", {
        name: /^(业务地区|报告地区)$/,
      });
      expect(
        within(region).getByRole("option", { name: "全部已授权范围" }),
      ).toHaveValue("authorized-all");
      expect(
        within(region).queryByRole("option", { name: "黑河市全域" }),
      ).not.toBeInTheDocument();
    }
  });

  it("keeps preserved production and reporting flows reachable within formal sections", async () => {
    const user = userEvent.setup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=production&section=tasks" />,
    );

    await user.click(screen.getByRole("tab", { name: "产情总览" }));
    expect(
      screen.getByRole("heading", { name: "种植生产监测工作区" }),
    ).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "产情审核" }));
    expect(
      screen.getByRole("heading", { name: "产情审核与结果发布" }),
    ).toBeVisible();

    window.history.replaceState({}, "", "/?page=reporting&section=compose");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await user.click(screen.getByRole("tab", { name: "履责报告" }));
    expect(screen.getByRole("heading", { name: "填报履责监督" })).toBeVisible();
  });

  it("exposes production and reporting subviews as keyboard-operable tabs", async () => {
    const user = userEvent.setup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=production&section=tasks" />,
    );

    const collection = screen.getByRole("tab", { name: "数据采集" });
    expect(collection).toHaveAttribute("aria-selected", "true");
    await user.click(collection);
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "产情审核" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel", { name: "产情审核" })).toBeVisible();

    window.history.replaceState({}, "", "/?page=reporting&section=compose");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    const business = screen.getByRole("tab", { name: "业务报告" });
    expect(business).toHaveAttribute("aria-selected", "true");
    await user.click(business);
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "履责报告" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel", { name: "履责报告" })).toBeVisible();
  });

  it("keeps market, reporting distribution, and work queues inside formal sections", async () => {
    const user = userEvent.setup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=market&section=tasks" />,
    );

    await user.click(screen.getByRole("tab", { name: "市场总览" }));
    expect(
      screen.getByRole("heading", { name: "粮食市场监测总览" }),
    ).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "市场审核" }));
    expect(
      screen.getByRole("heading", { name: "市场数据审核与发布" }),
    ).toBeVisible();

    window.history.replaceState(
      {},
      "",
      "/?page=reporting&section=review-distribution",
    );
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await user.click(screen.getByRole("tab", { name: "报告分发" }));
    expect(screen.getByRole("heading", { name: "发布与分发" })).toBeVisible();

    window.history.replaceState({}, "", "/?page=work&section=tasks");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await user.click(screen.getByRole("tab", { name: "待我审核" }));
    expect(screen.getByRole("heading", { name: "待我审核" })).toBeVisible();
  });

  it("deep-links My Work review and record actions to their owning workflow subviews", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/?page=work");
    render(<FormalEnterprisePrototype initialSearch="?page=work" />);

    await user.click(screen.getByRole("tab", { name: "待我审核" }));
    await user.click(screen.getByRole("button", { name: "进入市场审核" }));
    expect(window.location.search).toContain("page=market");
    expect(window.location.search).toContain("selectionType=work-item");
    expect(window.location.search).toContain(
      "selectionId=WORK-MARKET-REVIEW-W31",
    );
    expect(
      screen.getByRole("heading", { name: "市场数据审核与发布" }),
    ).toBeVisible();

    window.history.back();
    await new Promise((resolve) => setTimeout(resolve, 20));
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByRole("heading", { name: "待我处理" })).toBeVisible();

    window.history.forward();
    await new Promise((resolve) => setTimeout(resolve, 20));
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(
      screen.getByRole("heading", { name: "市场数据审核与发布" }),
    ).toBeVisible();

    window.history.replaceState({}, "", "/?page=work");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await user.click(screen.getByRole("tab", { name: "已办跟踪" }));
    await user.click(screen.getByRole("button", { name: "查看产情记录" }));
    expect(window.location.search).toContain("page=production");
    expect(window.location.search).toContain(
      "selectionId=WORK-PRODUCTION-RECORD-W30",
    );
    expect(
      screen.getByRole("heading", { name: "种植生产监测工作区" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "产情数据采集工作台" }),
    ).not.toBeInTheDocument();
  });
});
