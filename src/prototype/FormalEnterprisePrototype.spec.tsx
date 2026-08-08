import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FormalEnterprisePrototype as RuntimeFormalEnterprisePrototype,
  type FormalEnterprisePrototypeProps,
} from "./FormalEnterprisePrototype";
import type { OperationalScopeIdentity } from "./core/operationalScope";
import { prototypeOperationalIdentity } from "./formalEnterpriseData";
import {
  createDefaultPrototypeOperationalState,
  prototypeOperationalStateStorageKey,
  savePrototypeOperationalState,
} from "./prototypeOperationalState";
import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";
import { createPrototypeBusinessReportSeeds } from "./businessReportWorkflow";

const prototypeBusinessReportStorageKey =
  "齐齐哈尔粮食商情业务报告工作流-业务真值三";

function FormalEnterprisePrototype(props: FormalEnterprisePrototypeProps) {
  return (
    <RuntimeFormalEnterprisePrototype
      {...props}
      dataMode={props.dataMode ?? "fixtures"}
    />
  );
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  window.localStorage.removeItem(prototypeOperationalStateStorageKey);
  window.localStorage.removeItem(prototypeBusinessReportStorageKey);
});

describe("formal enterprise prototype", () => {
  it("keeps API reporting empty without reading report seeds or search fixtures", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      prototypeBusinessReportStorageKey,
      JSON.stringify(createPrototypeBusinessReportSeeds()),
    );
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const repository = {
      loadMasterData: () =>
        Promise.resolve({
          products: [{ code: "CORN", name: "服务端玉米" }],
          periods: [
            {
              code: "2026-W32",
              name: "2026 年第 32 周",
              startsOn: "2026-08-03",
              endsOn: "2026-08-09",
            },
          ],
          regions: [],
        }),
      listWorkItems: () =>
        Promise.resolve({
          items: [],
          pageNumber: 0,
          pageSize: 100,
          totalElements: 0,
          totalPages: 0,
        }),
    } as unknown as RealtimeBusinessRepository;

    render(
      <FormalEnterprisePrototype
        dataMode="api"
        initialSearch="?page=reporting&section=compose"
        repository={repository}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "报表服务尚未配置" }),
    ).toBeVisible();
    expect(screen.getByText("当前暂无可用报告数据")).toBeVisible();
    expect(document.body).not.toHaveTextContent("第31周粮食商情周报");
    expect(
      screen.queryByRole("button", { name: /生成报告|导出/ }),
    ).not.toBeInTheDocument();

    await user.type(
      screen.getByRole("searchbox", { name: "全局搜索" }),
      "齐齐哈尔市全域玉米供需平衡分析报告",
    );
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.getByText("未找到匹配的业务页面")).toBeVisible();
    expect(
      getItem.mock.calls.some(
        ([key]) => key === prototypeBusinessReportStorageKey,
      ),
    ).toBe(false);
    expect(
      setItem.mock.calls.some(
        ([key]) => key === prototypeBusinessReportStorageKey,
      ),
    ).toBe(false);
  });

  it("keeps API empty data fail-closed and uses an authorization-pending identity", async () => {
    savePrototypeOperationalState(
      window.localStorage,
      createDefaultPrototypeOperationalState(),
    );
    const repository = {
      loadMasterData: () =>
        Promise.resolve({
          products: [{ code: "CORN", name: "服务端玉米" }],
          periods: [],
          regions: [],
        }),
      listWorkItems: () =>
        Promise.resolve({
          items: [],
          pageNumber: 0,
          pageSize: 100,
          totalElements: 0,
          totalPages: 0,
        }),
      listCultivars: () => Promise.resolve([]),
    } as unknown as RealtimeBusinessRepository;

    render(
      <FormalEnterprisePrototype
        dataMode="api"
        initialSearch="?page=work&section=tasks"
        repository={repository}
      />,
    );

    expect(
      await screen.findByRole("status", {
        name: "实时业务数据连接状态",
      }),
    ).toHaveTextContent("当前没有可用业务期间或待办记录");
    expect(document.body).not.toHaveTextContent("齐齐哈尔市玉米市场运行周填报");
    expect(
      screen.getByRole("button", { name: "个人账户：已认证用户" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "系统设置" }),
    ).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("王洋");
  });

  it("keeps API failures fail-closed without restoring stored fixtures", async () => {
    savePrototypeOperationalState(
      window.localStorage,
      createDefaultPrototypeOperationalState(),
    );
    const repository = {
      loadMasterData: () => Promise.reject(new Error("受控服务不可用")),
      listWorkItems: () => Promise.reject(new Error("受控服务不可用")),
    } as unknown as RealtimeBusinessRepository;

    render(
      <FormalEnterprisePrototype
        dataMode="api"
        initialSearch="?page=work&section=tasks"
        repository={repository}
      />,
    );

    expect(
      await screen.findByRole("alert", {
        name: "实时业务数据连接状态",
      }),
    ).toHaveTextContent("业务数据服务连接异常");
    expect(document.body).not.toHaveTextContent("齐齐哈尔市玉米市场运行周填报");
  });

  it("keeps developer terminology and internal identifiers off business screens", async () => {
    const user = userEvent.setup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=production&section=tasks" />,
    );

    await user.click(
      screen.getAllByRole("button", { name: "处理产情单据" })[0],
    );
    const forbidden = [
      /METRIC-/i,
      /VERSION-/i,
      /指标数据版本/,
      /采用版本/,
      /数据层/,
      /业务对象能力清单/,
      /工作项生命周期/,
      /本单据不适用/,
      /责任人已确认/,
      /调查片区/,
      /样本户组/,
    ];
    for (const pattern of forbidden) {
      expect(document.body).not.toHaveTextContent(pattern);
    }
  });

  it("uses the enterprise shell and the product-owned production navigation", () => {
    render(
      <FormalEnterprisePrototype initialSearch="?page=production&section=objects" />,
    );

    expect(screen.getByText("齐齐哈尔粮食商情企业平台")).toBeVisible();
    const navigation = screen.getByRole("navigation", { name: "产情监测模块" });
    expect(within(navigation).getAllByRole("button")).toHaveLength(17);
    expect(within(navigation).getByText("玉米产情填报")).toBeVisible();
    expect(within(navigation).getByText("大豆产情填报")).toBeVisible();
    expect(within(navigation).getByText("稻谷产情填报")).toBeVisible();
    expect(within(navigation).getByText("产情分析")).toBeVisible();
    expect(within(navigation).getByText("玉米市场采集")).toBeVisible();
    expect(within(navigation).getByText("物流节点监测")).toBeVisible();
    expect(within(navigation).getByText("玉米供需平衡")).toBeVisible();
    expect(within(navigation).getByText("业务报告")).toBeVisible();
    expect(within(navigation).getByText("待我处理")).toBeVisible();
    expect(within(navigation).queryByText("产情任务")).not.toBeInTheDocument();
    expect(within(navigation).queryByText("调查对象")).not.toBeInTheDocument();
    expect(within(navigation).queryByText("数据审核")).not.toBeInTheDocument();
  });

  it("changes applications through the location-owned route", async () => {
    const user = userEvent.setup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=market&section=tasks" />,
    );

    await user.click(
      within(screen.getByRole("navigation", { name: "业务应用" })).getByRole(
        "button",
        { name: "供需分析" },
      ),
    );

    expect(window.location.search).toBe("");
    expect(decodeURIComponent(window.location.hash)).toBe(
      "#/供需分析/玉米供需平衡",
    );
    expect(
      screen.getByRole("navigation", { name: "供需分析模块" }),
    ).toHaveTextContent("玉米供需平衡");
  });

  it("ignores unauthorized URL coordinates without exposing the raw value", () => {
    render(
      <FormalEnterprisePrototype initialSearch="?page=production&section=tasks&region=not-authorized" />,
    );

    expect(screen.getByRole("combobox", { name: "业务地区" })).toHaveValue(
      "authorized-all",
    );
    expect(document.body).not.toHaveTextContent("not-authorized");
  });

  it("keeps recovery filters visible when a stored coordinate becomes invalid", async () => {
    const user = userEvent.setup();
    window.history.replaceState(
      {
        formalLocation: {
          route: { application: "production", section: "tasks" },
          coordinates: { regionId: "outside-current-authorization" },
        },
      },
      "",
      "/#/产情监测/业务任务",
    );
    render(<FormalEnterprisePrototype />);

    expect(
      screen.getByRole("heading", { name: "玉米产情调查表" }),
    ).toBeVisible();
    expect(screen.getByLabelText("选择地区")).toBeVisible();
    expect(
      screen.getByText(
        "地区不在当前授权范围。系统未使用其他地区或产品的数据。",
      ),
    ).toBeVisible();
    expect(document.body).not.toHaveTextContent(
      "outside-current-authorization",
    );

    await user.click(
      screen.getByRole("button", { name: "恢复全部已授权范围" }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("选择地区")).toHaveTextContent("请选择地区");
  });

  it("keeps page-owned scope coordinates out of the visible URL", async () => {
    const user = userEvent.setup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=production&section=tasks" />,
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "业务地区" }),
      "qiqihar-nehe",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "产品或作物" }),
      "corn",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "任务期间" }),
      "2026-W31",
    );

    expect(window.location.search).not.toMatch(/region=|product=|period=/);
    expect(screen.getByRole("combobox", { name: "业务地区" })).toHaveValue(
      "qiqihar-nehe",
    );
    expect(screen.getByRole("combobox", { name: "产品或作物" })).toHaveValue(
      "corn",
    );
  });

  it("keeps executive filters in memory while the route remains stable", async () => {
    const user = userEvent.setup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=overview&section=operations" />,
    );

    expect(screen.getByRole("combobox", { name: "授权地区" })).toHaveValue(
      "authorized-all",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "经营期间" }),
      "2026-W31",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "业务域" }),
      "market",
    );
    expect(window.location.search).not.toContain("businessDomain=market");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "当前授权范围内部分地区尚无已发布数据",
    );
    expect(screen.getByText("当前筛选范围没有可用经营指标")).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "风险事项" }));
    expect(window.location.search).toBe("");
    expect(decodeURIComponent(window.location.hash)).toBe(
      "#/经营总览/风险关注",
    );
    expect(screen.getByText("当前筛选范围没有经营风险记录")).toBeVisible();
  });

  it("requires a governed period before executing the executive query", async () => {
    const user = userEvent.setup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=overview&section=operations" />,
    );

    expect(screen.getByRole("combobox", { name: "经营期间" })).toHaveValue("");
    expect(screen.getByRole("alert")).toHaveTextContent("请选择经营期间");
    expect(screen.getByRole("alert")).toHaveTextContent("系统未执行数据查询");
    expect(screen.getByText("当前筛选范围没有可用经营指标")).toBeVisible();
    expect(document.body).not.toHaveTextContent(
      /2026-W31|periodKey|prototypeExecutiveDefaultPeriodKey/,
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "经营期间" }),
      "2026-W31",
    );

    expect(window.location.search).not.toContain("period=2026-W31");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "当前授权范围内部分地区尚无已发布数据",
    );
    expect(screen.getByText("当前筛选范围没有可用经营指标")).toBeVisible();
  });

  it("never writes executive business coordinates to the formal URL", async () => {
    const user = userEvent.setup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=overview&section=operations" />,
    );

    await user.click(screen.getByText("更多筛选"));

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
      screen.getByRole("combobox", { name: "数据状态" }),
      "preliminary",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "采用数据" }),
      "METRIC-2026-W31-V3",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "风险状态" }),
      "warning",
    );

    expect(window.location.search).not.toMatch(
      /businessDomain|businessSubtype|regionLevel|region=|period=|product=|cultivar=|dataLayer|releaseVersion|riskState/,
    );
  });

  it("does not accept inconsistent region coordinates from a shared URL", () => {
    render(
      <FormalEnterprisePrototype initialSearch="?page=overview&section=operations&region=qiqihar-nehe&regionLevel=city&period=2026-W31" />,
    );

    expect(screen.getByRole("combobox", { name: "授权地区" })).toHaveValue(
      "authorized-all",
    );
    expect(document.body).not.toHaveTextContent(/qiqihar-nehe|2026-W31/);
  });

  it("ignores unsupported executive URL coordinates with no raw-code echo", () => {
    render(
      <FormalEnterprisePrototype initialSearch="?page=overview&section=operations&businessDomain=bogus-domain&riskState=bogus-risk&period=2026-W31" />,
    );

    expect(document.body).not.toHaveTextContent(/bogus-domain|bogus-risk/);
    expect(screen.getByRole("combobox", { name: "经营期间" })).toHaveValue("");
  });

  it("drops an invalid executive period supplied through the URL", () => {
    render(
      <FormalEnterprisePrototype initialSearch="?page=overview&section=operations&period=unsupported-period" />,
    );

    expect(screen.getByRole("combobox", { name: "经营期间" })).toHaveValue("");
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
    expect(window.location.search).not.toContain("region=qiqihar-nehe");

    await user.click(
      within(screen.getByRole("navigation", { name: "业务应用" })).getByRole(
        "button",
        { name: "市场监测" },
      ),
    );
    expect(window.location.search).toBe("");
    expect(decodeURIComponent(window.location.hash)).toBe(
      "#/市场监测/玉米市场采集",
    );

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
    expect(screen.getByLabelText("选择地区")).toHaveTextContent("请选择地区");
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

  it("uses only authorized regions and domain-specific governed classifications", async () => {
    const user = userEvent.setup();
    const cases = [
      ["?page=overview&section=operations", "种植生产", null],
      ["?page=work&section=tasks", "种植生产", null],
      ["?page=production&section=tasks", "种植生产", "报价与交易"],
      ["?page=market&section=tasks", "报价与交易", "种植生产"],
    ] as const;

    for (const [search, expected, excluded] of cases) {
      cleanup();
      render(<FormalEnterprisePrototype initialSearch={search} />);
      if (search.startsWith("?page=work")) {
        await user.click(screen.getByRole("button", { name: "更多筛选" }));
      }
      if (search.startsWith("?page=overview")) {
        await user.click(screen.getByText("更多筛选"));
      }
      const classification = screen.getByRole("combobox", { name: "业务分类" });
      expect(
        within(classification).getByRole("option", { name: expected }),
      ).toBeVisible();
      if (excluded) {
        expect(
          within(classification).queryByRole("option", { name: excluded }),
        ).not.toBeInTheDocument();
      }
      expect(
        within(
          screen.getByRole("combobox", { name: /^(产品或作物|产品或品类)$/ }),
        ).queryByRole("option", { name: "产品名称待维护" }),
      ).not.toBeInTheDocument();
      const region = screen.getByRole("combobox", {
        name: /^(授权地区|业务地区|报告地区)$/,
      });
      expect(
        within(region).getByRole("option", { name: "全部已授权范围" }),
      ).toHaveValue("authorized-all");
      expect(
        within(region).getByRole("option", { name: "黑河市全域" }),
      ).toBeVisible();
      if (search.startsWith("?page=overview")) {
        expect(
          within(screen.getByRole("combobox", { name: "地区层级" })).getByRole(
            "option",
            { name: "市域" },
          ),
        ).toBeVisible();
      }
    }

    cleanup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=supply&section=calculation" />,
    );
    await user.click(
      within(screen.getByRole("group", { name: "业务地区" })).getByLabelText(
        "选择地区",
      ),
    );
    expect(
      within(screen.getByLabelText("地市选项")).getByRole("button", {
        name: "黑河市",
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("combobox", { name: "产品账户" })).getByRole(
        "option",
        { name: "小麦原粮" },
      ),
    ).toBeVisible();

    cleanup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=reporting&section=compose" />,
    );
    await user.click(screen.getByLabelText("选择地区"));
    expect(
      within(screen.getByLabelText("地市选项")).getByRole("button", {
        name: "黑河市",
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("combobox", { name: "业务类型" })).getByRole(
        "option",
        { name: "供需与态势" },
      ),
    ).toBeVisible();
  });

  it("keeps production analysis and reporting flows reachable within formal sections", async () => {
    const user = userEvent.setup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=production&section=tasks" />,
    );

    await user.click(
      within(
        screen.getByRole("navigation", { name: "产情监测模块" }),
      ).getByRole("button", { name: "产情分析" }),
    );
    expect(screen.getByRole("heading", { name: "产情监测分析" })).toBeVisible();

    window.history.replaceState({}, "", "/?page=reporting&section=compose");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await user.click(screen.getByRole("tab", { name: "履责报告" }));
    expect(screen.getByRole("heading", { name: "履责报告" })).toBeVisible();
  });

  it("opens an approved report search result at the exact nine-field compose scope", async () => {
    const user = userEvent.setup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=overview&section=operations" />,
    );

    await user.type(
      screen.getByRole("searchbox", { name: "全局搜索" }),
      "齐齐哈尔市全域玉米供需平衡分析报告",
    );
    await user.click(
      screen.getByRole("option", {
        name: /齐齐哈尔市全域玉米供需平衡分析报告.*报告数据/,
      }),
    );

    expect(decodeURIComponent(window.location.hash)).toBe(
      "#/报表中心/业务报告",
    );
    expect(
      await screen.findByText("已按所选已核定数据精确带入报告生成条件。"),
    ).toBeVisible();
    expect(screen.getByRole("combobox", { name: "业务类型" })).toHaveValue(
      "supply",
    );
    await user.click(screen.getByRole("button", { name: "更多条件" }));
    expect(screen.getByRole("combobox", { name: "业务分类" })).toHaveValue(
      "supply.results",
    );
    expect(screen.getByLabelText("选择地区")).toHaveTextContent("齐齐哈尔市");
    expect(screen.getByRole("combobox", { name: "产品或专题" })).toHaveValue(
      "corn",
    );
    expect(screen.getByRole("combobox", { name: "具体品种" })).toHaveValue(
      "not-applicable",
    );
    expect(screen.getByRole("combobox", { name: "报告频率" })).toHaveValue(
      "月报",
    );
    expect(screen.getByRole("combobox", { name: "报告期间" })).toHaveValue(
      "2026/27营销年度",
    );
    expect(screen.getByRole("combobox", { name: "报告模板" })).toHaveValue(
      "供需平衡分析报告",
    );
    expect(screen.getByRole("combobox", { name: "采用数据" })).toHaveValue(
      "SUPPLY-2026-MY-APPROVED",
    );
    expect(screen.getByRole("button", { name: "生成报告" })).toBeEnabled();
    expect(document.body).not.toHaveTextContent("SUPPLY-2026-MY-APPROVED");
  });

  it("keeps report workflow actions within the current identity permissions", async () => {
    const user = userEvent.setup();
    window.localStorage.removeItem("齐齐哈尔粮食商情业务报告工作流-业务真值三");
    const draftOnlyIdentity: OperationalScopeIdentity = {
      ...prototypeOperationalIdentity,
      authorization: {
        ...prototypeOperationalIdentity.authorization,
        permissionKeys: ["prototype:read", "report.draft.save"],
      },
    };
    render(
      <FormalEnterprisePrototype
        initialSearch="?page=overview&section=operations"
        operationalIdentity={draftOnlyIdentity}
      />,
    );

    await user.type(
      screen.getByRole("searchbox", { name: "全局搜索" }),
      "齐齐哈尔市全域玉米种植生产监测报告",
    );
    await user.click(
      screen.getByRole("option", {
        name: /齐齐哈尔市全域玉米种植生产监测报告.*报告数据/,
      }),
    );
    await user.click(screen.getByRole("button", { name: "生成报告" }));
    expect(screen.getByRole("dialog", { name: "编制业务报告" })).toBeVisible();
    const saveDraft = screen.getByRole("button", { name: "保存草稿" });
    expect(saveDraft).toBeEnabled();
    await user.click(saveDraft);

    expect(await screen.findByText("草稿已保存")).toBeVisible();
    expect(screen.getByRole("button", { name: "送审" })).toBeDisabled();
  });

  it("opens a report work item at its explicitly mapped workflow instance", async () => {
    const user = userEvent.setup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=overview&section=operations" />,
    );

    await user.type(
      screen.getByRole("searchbox", { name: "全局搜索" }),
      "第 31 周粮食商情报告审核与分发",
    );
    await user.click(
      screen.getByRole("option", {
        name: /第 31 周粮食商情报告审核与分发.*业务任务/,
      }),
    );

    expect(decodeURIComponent(window.location.hash)).toBe(
      "#/报表中心/报告审核与发布",
    );
    expect(
      screen.getByRole("heading", { name: "发布与分发", level: 1 }),
    ).toBeVisible();
    expect(screen.getByRole("tab", { name: "报告分发" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const detail = screen.getByRole("region", { name: "报告发布详情" });
    expect(detail).toHaveTextContent("第31周粮食商情周报");
    expect(detail).toHaveTextContent("齐齐哈尔市全域");
    expect(document.body).not.toHaveTextContent("WORK-REPORT-REVIEW-W31");
  });

  it("keeps application navigation and report subviews keyboard operable", async () => {
    const user = userEvent.setup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=production&section=tasks" />,
    );

    const productionNavigation = screen.getByRole("navigation", {
      name: "产情监测模块",
    });
    const analysis = within(productionNavigation).getByRole("button", {
      name: "产情分析",
    });
    analysis.focus();
    await user.keyboard("{Enter}");
    expect(
      within(
        screen.getByRole("navigation", { name: "产情监测模块" }),
      ).getByRole("button", { name: "产情分析" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "产情监测分析" })).toBeVisible();

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

    await user.click(
      within(
        screen.getByRole("navigation", { name: "市场监测模块" }),
      ).getByRole("button", { name: "玉米市场采集" }),
    );
    expect(
      screen.getByRole("heading", { name: "玉米市场采集表" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "新建采集记录" })).toBeVisible();
    await user.click(
      within(
        screen.getByRole("navigation", { name: "市场监测模块" }),
      ).getByRole("button", { name: "市场分析" }),
    );
    expect(screen.getByRole("heading", { name: "市场监测分析" })).toBeVisible();

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
    const reviewView = within(
      screen.getByRole("navigation", { name: "我的工作模块" }),
    ).getByRole("button", { name: "待我处理" });
    await user.click(reviewView);
    expect(reviewView).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("table", { name: "本人工作台账" })).toBeVisible();
  });

  it("deep-links My Work review and record actions to their owning workflow subviews", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/?page=work");
    render(<FormalEnterprisePrototype initialSearch="?page=work" />);

    await user.click(
      within(
        screen.getByRole("navigation", { name: "我的工作模块" }),
      ).getByRole("button", { name: "待我处理" }),
    );
    await user.click(
      within(
        screen.getByRole("row", {
          name: /齐齐哈尔市玉米市场运行周填报/,
        }),
      ).getByRole("button", { name: "处理市场任务" }),
    );
    expect(window.location.search).toBe("");
    expect(decodeURIComponent(window.location.hash)).toBe(
      "#/市场监测/采集任务",
    );
    expect(window.location.search).not.toMatch(
      /selectionType|selectionId|WORK-/,
    );
    expect(screen.getByRole("heading", { name: "市场任务作业" })).toBeVisible();
    expect(screen.getByRole("region", { name: /单据工作台/ })).toBeVisible();

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
    expect(screen.getByRole("heading", { name: "市场任务作业" })).toBeVisible();

    window.history.replaceState({}, "", "/?page=work");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await user.click(
      screen.getAllByRole("button", { name: "处理产情单据" })[0],
    );
    expect(window.location.search).toBe("");
    expect(decodeURIComponent(window.location.hash)).toBe(
      "#/产情监测/产情任务",
    );
    expect(window.location.search).not.toMatch(/selectionId|WORK-/);
    expect(screen.getByRole("heading", { name: "产情任务作业" })).toBeVisible();
    expect(screen.getByRole("region", { name: /单据工作台/ })).toBeVisible();
  });

  it("opens a supply work-item selection at its exact account and review task", async () => {
    const user = userEvent.setup();
    render(<FormalEnterprisePrototype initialSearch="?page=work" />);

    await user.click(
      within(
        screen.getByRole("navigation", { name: "我的工作模块" }),
      ).getByRole("button", { name: "待我处理" }),
    );
    const supplyRow = screen.getByRole("row", {
      name: /2026 年玉米供需差额说明复核/,
    });
    await user.click(
      within(supplyRow).getByRole("button", { name: "复核供需说明" }),
    );

    expect(decodeURIComponent(window.location.hash)).toBe(
      "#/供需分析/供需测算",
    );
    expect(
      screen.getByRole("region", { name: "当前供需复核任务" }),
    ).toHaveTextContent("2026 年玉米供需差额说明复核");
    const region = screen.getByRole("group", { name: "业务地区" });
    expect(within(region).getByLabelText("选择地区")).toHaveTextContent(
      "齐齐哈尔市",
    );
    expect(screen.getByRole("combobox", { name: "产品账户" })).toHaveValue(
      "corn",
    );
    expect(screen.getByRole("combobox", { name: "营销年度" })).toHaveValue(
      "2026-27",
    );
    expect(screen.getByRole("combobox", { name: "账户核定记录" })).toHaveValue(
      "approval-2",
    );
    expect(screen.getByText("已按当前条件完成查询")).toBeVisible();
    expect(screen.getByText("当前筛选范围尚无已核定供需账户")).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "本次供需测算结果" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编制供需报告" })).toBeDisabled();
  });

  it("persists an approved supply explanation from the exact requested task", async () => {
    const user = userEvent.setup();
    render(<FormalEnterprisePrototype initialSearch="?page=work" />);

    await user.click(
      within(
        screen.getByRole("navigation", { name: "我的工作模块" }),
      ).getByRole("button", { name: "待我处理" }),
    );
    await user.click(
      within(
        screen.getByRole("row", {
          name: /2026 年玉米供需差额说明复核/,
        }),
      ).getByRole("button", { name: "复核供需说明" }),
    );
    const task = screen.getByRole("region", { name: "当前供需复核任务" });
    await user.click(within(task).getByRole("button", { name: "审核通过" }));

    expect(task).toHaveTextContent("供需说明审核已通过，审核记录已保存");
    await waitFor(() => {
      const raw = window.localStorage.getItem(
        prototypeOperationalStateStorageKey,
      );
      const stored = raw
        ? (JSON.parse(raw) as {
            state: {
              workItems: readonly {
                workId: string;
                reviewStatus: string;
                qualityStatus: string;
              }[];
            };
          })
        : null;
      expect(
        stored?.state.workItems.find(
          ({ workId }) => workId === "WORK-SUPPLY-EXPLANATION-2026",
        ),
      ).toMatchObject({ reviewStatus: "approved", qualityStatus: "warning" });
    });
  });

  it("moves a submitted market item out of the responsible queue while preserving its domain state", async () => {
    const user = userEvent.setup();
    render(<FormalEnterprisePrototype initialSearch="?page=work" />);

    await user.click(
      within(
        screen.getByRole("navigation", { name: "我的工作模块" }),
      ).getByRole("button", { name: "待我处理" }),
    );
    await user.click(
      within(
        screen.getByRole("row", {
          name: /齐齐哈尔市玉米市场运行周填报/,
        }),
      ).getByRole("button", { name: "处理市场任务" }),
    );

    while (
      screen.queryAllByRole("button", { name: /确认.+章节来源值/ }).length > 0
    ) {
      await user.click(
        screen.getAllByRole("button", { name: /确认.+章节来源值/ })[0],
      );
    }
    await user.click(screen.getByRole("button", { name: "执行提交前检查" }));
    await user.click(screen.getByRole("button", { name: "提交审核" }));
    expect(screen.getByLabelText("任务五状态")).toHaveTextContent("已提交");

    await user.click(
      within(screen.getByRole("navigation", { name: "业务应用" })).getByRole(
        "button",
        { name: "我的工作" },
      ),
    );
    expect(
      screen.queryByRole("row", {
        name: /齐齐哈尔市玉米市场运行周填报/,
      }),
    ).not.toBeInTheDocument();

    await user.click(
      within(screen.getByRole("navigation", { name: "业务应用" })).getByRole(
        "button",
        { name: "市场监测" },
      ),
    );
    await user.click(
      within(
        screen.getByRole("navigation", { name: "市场监测模块" }),
      ).getByRole("button", { name: "玉米市场采集" }),
    );
    const marketRow = screen.getByRole("row", {
      name: /龙江县玉米贸易监测组/,
    });
    expect(marketRow).toHaveTextContent("待审核");
    await user.click(within(marketRow).getByRole("button", { name: "查看" }));
    expect(screen.getByLabelText("任务五状态")).toHaveTextContent("已提交");
    expect(screen.getByLabelText("任务五状态")).toHaveTextContent("待审核");
  });

  it("keeps production corrections and submission state across application navigation", async () => {
    const user = userEvent.setup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=production&section=tasks" />,
    );

    await user.click(
      screen.getAllByRole("button", { name: "处理产情单据" })[0],
    );
    const yieldInput = screen.getByRole("textbox", { name: "预计单产" });
    await user.clear(yieldInput);
    await user.type(yieldInput, "470.0 公斤/亩");
    while (
      screen.queryAllByRole("button", { name: "确认本章节来源值" }).length > 0
    ) {
      await user.click(
        screen.getAllByRole("button", { name: "确认本章节来源值" })[0],
      );
    }
    await user.click(screen.getByRole("button", { name: "保存更正草稿" }));
    await user.click(screen.getByRole("button", { name: "执行提交前检查" }));
    await user.click(screen.getByRole("button", { name: "重新提交审核" }));
    expect(screen.getByLabelText("任务五状态")).toHaveTextContent("已提交");

    await user.click(
      within(screen.getByRole("navigation", { name: "业务应用" })).getByRole(
        "button",
        { name: "我的工作" },
      ),
    );
    await user.click(
      within(
        screen.getByRole("navigation", { name: "我的工作模块" }),
      ).getByRole("button", { name: "待我处理" }),
    );
    const productionRow = screen.getByRole("row", {
      name: /讷河市玉米长势与测产调查/,
    });
    expect(productionRow).toHaveTextContent("已提交");
    expect(productionRow).toHaveTextContent("待审核");
    expect(productionRow).toHaveTextContent("26/26 项");

    await user.click(
      within(screen.getByRole("navigation", { name: "业务应用" })).getByRole(
        "button",
        { name: "产情监测" },
      ),
    );
    await user.click(
      within(
        screen.getByRole("row", {
          name: /讷河市同义镇保国村村委会/,
        }),
      ).getByRole("button", { name: "查看" }),
    );
    expect(screen.getByRole("textbox", { name: "预计单产" })).toHaveValue(
      "470.0 公斤/亩",
    );
  });

  it("restores a saved production draft after a full prototype remount", async () => {
    const user = userEvent.setup();
    const firstMount = render(
      <FormalEnterprisePrototype initialSearch="?page=production&section=tasks" />,
    );

    await user.click(
      screen.getAllByRole("button", { name: "处理产情单据" })[0],
    );
    const yieldInput = screen.getByRole("textbox", { name: "预计单产" });
    await user.clear(yieldInput);
    await user.type(yieldInput, "472.5 公斤/亩");
    await user.click(screen.getByRole("button", { name: "保存更正草稿" }));
    firstMount.unmount();

    render(
      <FormalEnterprisePrototype initialSearch="?page=production&section=tasks" />,
    );
    await user.click(
      screen.getAllByRole("button", { name: "处理产情单据" })[0],
    );
    expect(screen.getByRole("textbox", { name: "预计单产" })).toHaveValue(
      "472.5 公斤/亩",
    );
  });

  it("loads persisted object registries instead of reconstructing them on refresh", () => {
    const initial = createDefaultPrototypeOperationalState();
    const firstMarketObject = initial.marketRegistryObjects[0];
    expect(firstMarketObject).toBeDefined();
    const saved = {
      ...initial,
      marketRegistryObjects: initial.marketRegistryObjects.map((object) =>
        object.objectId === firstMarketObject?.objectId
          ? { ...object, objectName: "持久化后的市场监测对象名称" }
          : object,
      ),
    };
    expect(savePrototypeOperationalState(window.localStorage, saved)).toEqual({
      status: "saved",
    });

    render(
      <FormalEnterprisePrototype initialSearch="?page=market&section=objects" />,
    );

    expect(screen.getByText("持久化后的市场监测对象名称")).toBeVisible();
  });

  it("preserves damaged local state and shows an explicit Chinese recovery action", () => {
    const damaged = "{not-json";
    window.localStorage.setItem(prototypeOperationalStateStorageKey, damaged);

    render(<FormalEnterprisePrototype initialSearch="?page=work" />);

    expect(
      screen.getByRole("alert", { name: "工作状态恢复提示" }),
    ).toHaveTextContent("业务工作状态无法读取，原始数据已保留且未被覆盖。");
    expect(screen.getByRole("button", { name: "重建工作状态" })).toBeVisible();
    expect(
      window.localStorage.getItem(prototypeOperationalStateStorageKey),
    ).toBe(damaged);
  });
});
