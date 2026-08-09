import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OperationalScope } from "./core/operationalScope";
import type { BusinessReportContext } from "./businessReportModel";
import { businessWorkFixtures } from "./data/businessWorkFixtures";
import { marketMonitoringObjects } from "./data/monitoringRegistryFixtures";
import { prototypeOperationalIdentity } from "./formalEnterpriseData";
import type { FormalSelection, MarketSection } from "./formalEnterpriseModel";
import { MarketMonitoringWorkspace } from "./MarketMonitoringWorkspace";

afterEach(cleanup);

const defaultScope: OperationalScope = {
  ...prototypeOperationalIdentity,
  coordinates: { regionId: "authorized-all" },
  savedView: null,
};

const allMarketScope: OperationalScope = {
  ...defaultScope,
  authorization: {
    ...defaultScope.authorization,
    authorizedBusinessClassificationIds: [
      "market.quote-trade",
      "market.quality",
      "market.inventory",
      "market.processing",
      "market.consumption-use",
      "market.sales",
      "market.logistics",
      "market.agricultural-input",
    ],
    authorizedProductIds: ["corn", "soybean", "paddy", "wheat", "agri-input"],
    authorizedCultivarIds: [
      "jingke-968",
      "demeiya-3",
      "xianyu-335",
      "heinong-84",
      "dongsheng-22",
      "longjing-31",
      "suijing-18",
      "longmai-35",
      "kechun-14",
    ],
    permissionKeys: ["prototype:read", "market:object:manage"],
  },
};

function renderWorkspace(
  section: MarketSection,
  options: {
    scope?: OperationalScope;
    selection?: { type: "work-item" | "object"; id: string };
    onScopeChange?: (coordinates: Record<string, unknown>) => void;
    queryAllowed?: boolean;
    onComposeReport?: (context: BusinessReportContext) => void;
  } = {},
) {
  return render(
    <MarketMonitoringWorkspace
      onComposeReport={options.onComposeReport ?? vi.fn()}
      onScopeChange={options.onScopeChange ?? vi.fn()}
      queryAllowed={options.queryAllowed ?? true}
      scope={options.scope ?? allMarketScope}
      section={section}
      selection={options.selection}
    />,
  );
}

describe("market monitoring workspace", () => {
  it("uses product-applicable market object types and soybean quality columns", () => {
    renderWorkspace("soybean-collection");

    const objectType = screen.getByRole("combobox", { name: "对象类型" });
    expect(
      within(objectType)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["全部适用对象", "贸易商", "深加工企业", "批发市场", "承储企业"]);

    const table = screen.getByRole("table", { name: "大豆市场采集表" });
    for (const label of ["蛋白", "出油率", "不完善粒", "水分", "杂质"]) {
      expect(
        within(table).getByRole("columnheader", { name: label }),
      ).toBeVisible();
    }
    for (const cornOnly of ["容重", "毒素", "霉变粒"]) {
      expect(
        within(table).queryByRole("columnheader", { name: cornOnly }),
      ).not.toBeInTheDocument();
    }
  });

  it("keeps procurement price, procurement volume and quality for processors", async () => {
    const user = userEvent.setup();
    renderWorkspace("paddy-collection");

    await user.selectOptions(
      screen.getByRole("combobox", { name: "对象类型" }),
      "deep-processing",
    );
    const table = screen.getByRole("table", { name: "稻谷市场采集表" });
    for (const label of [
      "对象采购价格",
      "对象销售价格",
      "采购量",
      "水分",
      "出米率",
      "出糙率",
      "杂质",
      "加工投入量",
      "主产品产出量",
    ]) {
      expect(
        within(table).getByRole("columnheader", { name: label }),
      ).toBeVisible();
    }
  });

  it("explains both surveyed-object prices in the worktable header", () => {
    renderWorkspace("corn-collection");

    const table = screen.getByRole("table", { name: "玉米市场采集表" });
    expect(
      within(table).getByRole("columnheader", { name: "对象采购价格" }),
    ).toHaveTextContent("未含车板、包装、运费");
    expect(
      within(table).getByRole("columnheader", { name: "对象销售价格" }),
    ).toHaveTextContent("未含车板、包装、运费");
    expect(
      within(table).queryByRole("columnheader", { name: "实际成交价" }),
    ).not.toBeInTheDocument();
    for (const condition of ["车板价", "运费", "包装形态"]) {
      expect(
        within(table).getByRole("columnheader", { name: condition }),
      ).toBeVisible();
    }
  });

  it.each([
    ["corn-collection", "玉米", "龙江县玉米贸易监测组"],
    ["soybean-collection", "大豆", "北安大豆蛋白有限公司"],
    ["paddy-collection", "稻谷", "讷河恒泰米业"],
  ] as const)(
    "uses the %s route as the product owner instead of repeating a product filter",
    (section, productLabel, expectedObject) => {
      renderWorkspace(section);

      expect(
        screen.getByRole("heading", { name: `${productLabel}市场采集表` }),
      ).toBeVisible();
      expect(
        screen.queryByRole("combobox", { name: "产品" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("combobox", { name: "产品或品类" }),
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText("选择地区")).toBeVisible();
      const table = screen.getByRole("table", {
        name: `${productLabel}市场采集表`,
      });
      expect(table).toHaveTextContent(expectedObject);
      expect(
        within(table).getByText(new RegExp(`${productLabel}质量`)),
      ).toBeVisible();
      expect(
        within(table).getByRole("columnheader", { name: "对象采购价格" }),
      ).toBeVisible();
      expect(
        within(table).getByRole("columnheader", { name: "对象销售价格" }),
      ).toBeVisible();
      expect(
        within(table).getByRole("columnheader", { name: "期末库存" }),
      ).toBeVisible();
    },
  );

  it("separates the market task job from registry and capability governance", () => {
    renderWorkspace("tasks");

    expect(screen.queryByText("市场对象业务能力清单")).not.toBeInTheDocument();
    expect(screen.getByRole("table", { name: "市场任务台账" })).toBeVisible();
    expect(
      screen.queryByRole("table", { name: "市场对象名录" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "数据采集" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "市场审核" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["tasks", "任务"],
    ["objects", "对象"],
    ["analysis", "分析结果"],
  ] as const)(
    "uses business filter language when %s queries exceed authorization",
    (section, resultLabel) => {
      renderWorkspace(section, { queryAllowed: false });

      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("当前筛选范围超出您的数据权限");
      expect(alert).toHaveTextContent(`系统未展示其他${resultLabel}`);
      expect(alert).not.toHaveTextContent("业务坐标");
    },
  );

  it.each([
    ["tasks", "可处理的市场任务"],
    ["objects", "已授权监测对象"],
  ] as const)(
    "describes an empty %s ledger with filter conditions",
    (section, resultLabel) => {
      renderWorkspace(section, {
        scope: {
          ...allMarketScope,
          authorization: {
            ...allMarketScope.authorization,
            authorizedProductIds: [],
            authorizedCultivarIds: [],
          },
        },
      });

      const status = screen.getByRole("status");
      expect(status).toHaveTextContent(
        `当前筛选范围内没有${resultLabel}，请调整筛选条件后重试`,
      );
      expect(status).not.toHaveTextContent("业务坐标");
    },
  );

  it("keeps the original shared market task reachable for the default authorized identity", () => {
    renderWorkspace("tasks", {
      scope: defaultScope,
      selection: { type: "work-item", id: "WORK-MARKET-FILL-W31" },
    });

    expect(
      screen.getByRole("table", { name: "市场任务台账" }),
    ).toHaveTextContent("齐齐哈尔市玉米市场运行周填报");
    expect(
      screen.getByRole("region", { name: /单据工作台/ }),
    ).toHaveTextContent("龙江县玉米贸易监测组");
    expect(
      screen.getByRole("region", { name: /单据工作台/ }),
    ).toHaveTextContent("来源与校验");
  });

  it("uses governed task filters and opens collection and review in one selected document", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn<(selection: FormalSelection) => void>();
    const { container, rerender } = render(
      <MarketMonitoringWorkspace
        onComposeReport={vi.fn()}
        onScopeChange={vi.fn()}
        onSelectionChange={onSelectionChange}
        queryAllowed
        scope={allMarketScope}
        section="tasks"
      />,
    );

    expect(screen.getByRole("combobox", { name: "产品或品类" })).toHaveValue(
      "",
    );
    expect(screen.getByRole("combobox", { name: "任务期间" })).toHaveValue("");
    expect(
      container.querySelectorAll(".market-task6-filter-grid > label > select"),
    ).toHaveLength(5);
    expect(screen.getByText("更多筛选（0 项已生效）")).toBeVisible();
    await user.click(screen.getByText("更多筛选（0 项已生效）"));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "质量状态" }),
      "blocking",
    );
    expect(screen.getByText("更多筛选（1 项已生效）")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "清除条件：质量阻断" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "清除更多筛选" }));
    expect(screen.getByText("更多筛选（0 项已生效）")).toBeVisible();
    expect(
      screen.queryByRole("textbox", { name: /产品|期间/ }),
    ).not.toBeInTheDocument();
    const ledger = screen.getByRole("table", { name: "市场任务台账" });
    expect(ledger).toHaveTextContent("市场主体");
    expect(ledger).toHaveTextContent("物流节点");
    expect(ledger).toHaveTextContent("字段完成");
    expect(ledger).toHaveTextContent("当前处理节点");
    expect(within(ledger).getAllByRole("columnheader")).toHaveLength(8);
    expect(
      within(ledger).queryByRole("columnheader", { name: "义务状态" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getAllByRole("button", { name: "处理市场任务" })[0],
    );
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: "work-item" }),
    );
    const selection = onSelectionChange.mock.calls[0][0];
    rerender(
      <MarketMonitoringWorkspace
        onComposeReport={vi.fn()}
        onScopeChange={vi.fn()}
        onSelectionChange={onSelectionChange}
        queryAllowed
        scope={allMarketScope}
        section="tasks"
        selection={selection}
      />,
    );

    expect(screen.getByRole("region", { name: /单据工作台/ })).toBeVisible();
    expect(
      screen.getByRole("region", { name: "采集与审核生命周期" }),
    ).toBeVisible();
    expect(screen.getByLabelText("任务五状态")).toHaveTextContent("义务状态");
    expect(screen.getByLabelText("任务五状态")).toHaveTextContent("发布状态");
    expect(screen.getByRole("button", { name: "在线填报" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "电子表格批量导入" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "授权系统接入" })).toBeVisible();
    expect(screen.getByText("审核通过不等于正式发布")).toBeVisible();
  });

  it("uses role-based work views and keeps cultivar in progressive filters", async () => {
    const user = userEvent.setup();
    renderWorkspace("tasks", {
      scope: {
        ...allMarketScope,
        coordinates: { regionId: "authorized-all", productId: "corn" },
      },
    });

    const view = screen.getByRole("combobox", { name: "工作视图" });
    for (const label of [
      "待我填报",
      "待我审核",
      "质量异常",
      "待发布",
      "已办任务",
    ]) {
      expect(within(view).getByRole("option", { name: label })).toBeVisible();
    }
    await user.selectOptions(view, "quality-attention");
    expect(
      screen.getByRole("button", { name: "清除条件：质量异常" }),
    ).toBeVisible();
    await user.click(screen.getByText("更多筛选（0 项已生效）"));
    expect(screen.getByRole("combobox", { name: "具体品种" })).toBeVisible();
    expect(
      within(screen.getByRole("combobox", { name: "具体品种" })).getByRole(
        "option",
        { name: "先玉335" },
      ),
    ).toBeVisible();
  });

  it("shows object type in filter and table and reveals capabilities only for the selected object", async () => {
    const user = userEvent.setup();
    renderWorkspace("objects");

    expect(screen.getByRole("combobox", { name: "对象类型" })).toBeVisible();
    const registry = screen.getByRole("table", { name: "市场对象名录" });
    expect(
      within(registry).getByRole("columnheader", { name: "对象名称与类型" }),
    ).toBeVisible();
    expect(within(registry).getAllByRole("columnheader")).toHaveLength(8);
    expect(screen.queryByText("市场对象业务能力清单")).not.toBeInTheDocument();
    expect(screen.queryByText("稻谷收购价格采集")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "查看讷河恒泰米业" }));

    const detail = screen.getByRole("region", { name: "讷河恒泰米业对象详情" });
    expect(detail).toHaveTextContent("米厂");
    expect(detail).toHaveTextContent("稻谷收购价格采集");
    expect(detail).not.toHaveTextContent("公路流入流出采集");
    expect(detail).toHaveTextContent("业务角色有效期");
    expect(detail).toHaveTextContent("当前有效角色与实际能力");
  });

  it("opens and closes a market object detail without resetting the registry filters", async () => {
    const user = userEvent.setup();
    renderWorkspace("objects");

    await user.selectOptions(
      screen.getByRole("combobox", { name: "对象类型" }),
      "grain-processing-enterprise",
    );
    await user.click(screen.getByRole("button", { name: "查看讷河恒泰米业" }));
    const detail = screen.getByRole("region", { name: "讷河恒泰米业对象详情" });
    expect(detail).toHaveTextContent("身份与业务角色");
    expect(detail).toHaveTextContent("附件与来源凭证");
    await user.click(within(detail).getByRole("button", { name: "关闭详情" }));

    expect(
      screen.queryByRole("region", { name: "讷河恒泰米业对象详情" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "对象类型" })).toHaveValue(
      "grain-processing-enterprise",
    );
    expect(screen.getByRole("table", { name: "市场对象名录" })).toBeVisible();
  });

  it("creates a complete governed object from explicit master-data, role and validity choices", async () => {
    const user = userEvent.setup();
    renderWorkspace("objects");

    await user.click(screen.getByRole("button", { name: "新增监测对象" }));
    await user.type(
      screen.getByRole("textbox", { name: "新增对象名称" }),
      "齐齐哈尔市新建贸易监测组",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "新增对象类型" }),
      "grain-trading-enterprise",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "新增对象业务地区" }),
      "qiqihar-all",
    );
    await user.click(
      screen.getByRole("checkbox", { name: "新增对象经营产品：玉米" }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "新增对象适用品种：京科968" }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "新增对象来源渠道" }),
      "enterprise-report",
    );
    await user.type(
      screen.getByRole("textbox", { name: "新增对象责任人" }),
      "王洋",
    );
    await user.type(screen.getByLabelText("新增对象生效日期"), "2026-08-01");
    await user.click(
      screen.getByRole("checkbox", { name: "新增对象业务角色：贸易商" }),
    );
    await user.type(
      screen.getByLabelText("新增对象贸易商角色生效日期"),
      "2026-08-01",
    );
    await user.click(screen.getByRole("button", { name: "保存监测对象" }));

    const registry = screen.getByRole("table", { name: "市场对象名录" });
    expect(registry).toHaveTextContent("齐齐哈尔市新建贸易监测组");
    expect(registry).toHaveTextContent("贸易商");
    expect(registry).toHaveTextContent("贸易商");
    expect(registry).toHaveTextContent("玉米 · 京科968");
    expect(registry).toHaveTextContent("企业直报");
    const detail = screen.getByRole("region", {
      name: "齐齐哈尔市新建贸易监测组对象详情",
    });
    expect(detail).toHaveTextContent("王洋");
    expect(detail).toHaveTextContent("2026 年 8 月 1 日起，长期有效");
    expect(
      within(detail).getByRole("region", { name: "当前对象实际业务能力" }),
    ).toHaveTextContent("实际成交与数量采集");
  });

  it("never derives a business role silently from object type or product", async () => {
    const user = userEvent.setup();
    renderWorkspace("objects");

    await user.click(screen.getByRole("button", { name: "新增监测对象" }));
    await user.type(
      screen.getByRole("textbox", { name: "新增对象名称" }),
      "齐齐哈尔小麦加工监测企业",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "新增对象类型" }),
      "grain-processing-enterprise",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "新增对象业务地区" }),
      "qiqihar-all",
    );
    await user.click(
      screen.getByRole("checkbox", { name: "新增对象经营产品：小麦" }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "新增对象来源渠道" }),
      "enterprise-report",
    );
    await user.type(
      screen.getByRole("textbox", { name: "新增对象责任人" }),
      "王洋",
    );
    await user.type(screen.getByLabelText("新增对象生效日期"), "2026-08-01");
    await user.click(screen.getByRole("button", { name: "保存监测对象" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "请明确勾选至少一个业务角色",
    );
    expect(
      screen.queryByRole("region", {
        name: "齐齐哈尔小麦加工监测企业对象详情",
      }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("checkbox", { name: "新增对象业务角色：贸易商" }),
    );
    await user.type(
      screen.getByLabelText("新增对象贸易商角色生效日期"),
      "2026-08-01",
    );
    await user.click(screen.getByRole("button", { name: "保存监测对象" }));

    const detail = screen.getByRole("region", {
      name: "齐齐哈尔小麦加工监测企业对象详情",
    });
    const roleRegister = within(detail).getByRole("region", {
      name: "业务角色有效期",
    });
    const capabilities = within(detail).getByRole("region", {
      name: "当前对象实际业务能力",
    });
    expect(roleRegister).toHaveTextContent("贸易商");
    expect(roleRegister).not.toHaveTextContent("玉米深加工企业");
    expect(roleRegister).not.toHaveTextContent("食品和调味品企业");
    expect(capabilities).not.toHaveTextContent("玉米深加工企业");
    expect(
      screen.getByRole("region", {
        name: "齐齐哈尔小麦加工监测企业对象详情",
      }),
    ).toHaveTextContent("贸易监测");
  });

  it("limits new-object products to the selected object type's business applicability", async () => {
    const user = userEvent.setup();
    renderWorkspace("objects");

    await user.click(screen.getByRole("button", { name: "新增监测对象" }));
    const objectType = screen.getByRole("combobox", {
      name: "新增对象类型",
    });
    await user.selectOptions(objectType, "grain-processing-enterprise");
    expect(
      screen.getByRole("checkbox", { name: "新增对象经营产品：小麦" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("checkbox", { name: "新增对象经营产品：农资" }),
    ).not.toBeInTheDocument();

    await user.selectOptions(objectType, "breeding-farm");
    expect(
      screen.getByRole("checkbox", { name: "新增对象经营产品：玉米" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("checkbox", { name: "新增对象经营产品：大豆" }),
    ).not.toBeInTheDocument();
  });

  it("cascades cultivars from explicitly selected products without choosing a fallback", async () => {
    const user = userEvent.setup();
    renderWorkspace("objects");

    await user.click(screen.getByRole("button", { name: "新增监测对象" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "新增对象类型" }),
      "grain-processing-enterprise",
    );
    await user.click(
      screen.getByRole("checkbox", { name: "新增对象经营产品：玉米" }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "新增对象适用品种：京科968" }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "新增对象经营产品：大豆" }),
    );
    expect(
      screen.getByRole("checkbox", { name: "新增对象适用品种：黑农84" }),
    ).not.toBeChecked();

    await user.click(
      screen.getByRole("checkbox", { name: "新增对象经营产品：玉米" }),
    );

    expect(
      screen.queryByRole("checkbox", { name: "新增对象适用品种：京科968" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "新增对象经营产品：大豆" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "新增对象适用品种：黑农84" }),
    ).not.toBeChecked();
  });

  it("blocks saving a product-cultivar mismatch instead of silently dropping or replacing it", async () => {
    const user = userEvent.setup();
    const mismatchedObject = {
      ...marketMonitoringObjects[1],
      cultivarIds: ["longjing-31"],
      cultivarLabels: ["龙粳31"],
    };
    render(
      <MarketMonitoringWorkspace
        onComposeReport={vi.fn()}
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        registryObjects={[mismatchedObject]}
        scope={allMarketScope}
        section="objects"
        selection={{ type: "object", id: mismatchedObject.objectId }}
      />,
    );

    expect(
      screen.queryByRole("form", { name: "编辑监测对象资料" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "编辑监测对象" }));
    await user.click(screen.getByRole("button", { name: "保存对象资料" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "适用具体品种与所选产品不匹配，未保存对象",
    );
    expect(
      screen.getByRole("region", {
        name: "龙江县玉米贸易监测组对象详情",
      }),
    ).toHaveTextContent("龙粳31");
  });

  it("edits every governed object field and synchronizes the ledger and detail", async () => {
    const user = userEvent.setup();
    renderWorkspace("objects");
    await user.click(screen.getByRole("button", { name: "查看讷河恒泰米业" }));

    expect(
      screen.queryByRole("form", { name: "编辑监测对象资料" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "编辑监测对象" }));

    const name = screen.getByRole("textbox", { name: "编辑对象名称" });
    await user.clear(name);
    await user.type(name, "齐齐哈尔综合粮食监测企业");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "编辑对象业务地区" }),
      "qiqihar-all",
    );
    await user.click(
      screen.getByRole("checkbox", { name: "编辑对象经营产品：稻谷" }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "编辑对象适用品种：先玉335" }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "编辑对象来源渠道" }),
      "rail-waybill-ledger",
    );
    const owner = screen.getByRole("textbox", { name: "编辑对象责任人" });
    await user.clear(owner);
    await user.type(owner, "赵晨");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "编辑对象有效状态" }),
      "inactive",
    );
    await user.type(screen.getByLabelText("编辑对象失效日期"), "2026-08-01");
    await user.click(
      screen.getByRole("checkbox", { name: "编辑对象业务角色：米厂" }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "编辑对象业务角色：承储企业" }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "编辑对象业务角色：铁路站点" }),
    );
    await user.type(
      screen.getByLabelText("编辑对象铁路站点角色生效日期"),
      "2026-08-01",
    );
    await user.click(screen.getByRole("button", { name: "保存对象资料" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "对象资料已更新，名录与详情已同步",
    );
    expect(
      screen.queryByRole("form", { name: "编辑监测对象资料" }),
    ).not.toBeInTheDocument();
    const registry = screen.getByRole("table", { name: "市场对象名录" });
    expect(registry).toHaveTextContent("齐齐哈尔综合粮食监测企业");
    expect(registry).toHaveTextContent("贸易商、铁路站点");
    expect(registry).toHaveTextContent("玉米 · 先玉335");
    expect(registry).toHaveTextContent("铁路运单与站点台账");
    expect(registry).toHaveTextContent("赵晨 · 正常监测 · 已停用");
    const detail = screen.getByRole("region", {
      name: "齐齐哈尔综合粮食监测企业对象详情",
    });
    expect(detail).toHaveTextContent("齐齐哈尔市全域");
    expect(detail).toHaveTextContent("2025 年 1 月 1 日起至2026 年 8 月 1 日");
    expect(detail).not.toHaveTextContent("稻谷收购价格采集");
    expect(detail).toHaveTextContent("铁路运单依据采集");
  });

  it("does not derive capabilities from a role whose effective period has not started", async () => {
    const user = userEvent.setup();
    renderWorkspace("objects");
    await user.click(screen.getByRole("button", { name: "新增监测对象" }));
    await user.type(
      screen.getByRole("textbox", { name: "新增对象名称" }),
      "齐齐哈尔计划监测对象",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "新增对象类型" }),
      "grain-trading-enterprise",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "新增对象业务地区" }),
      "qiqihar-all",
    );
    await user.click(
      screen.getByRole("checkbox", { name: "新增对象经营产品：玉米" }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "新增对象来源渠道" }),
      "enterprise-report",
    );
    await user.type(
      screen.getByRole("textbox", { name: "新增对象责任人" }),
      "王洋",
    );
    await user.type(screen.getByLabelText("新增对象生效日期"), "2026-08-01");
    await user.click(
      screen.getByRole("checkbox", { name: "新增对象业务角色：贸易商" }),
    );
    await user.type(
      screen.getByLabelText("新增对象贸易商角色生效日期"),
      "2026-09-01",
    );
    await user.click(screen.getByRole("button", { name: "保存监测对象" }));

    const detail = screen.getByRole("region", {
      name: "齐齐哈尔计划监测对象对象详情",
    });
    expect(detail).toHaveTextContent("贸易商尚未生效");
    expect(
      within(detail).getByRole("region", { name: "当前对象实际业务能力" }),
    ).toHaveTextContent("系统未派生业务能力");
    expect(detail).not.toHaveTextContent("实际成交与数量采集");
  });

  it("keeps regional coverage fields reachable without publishing them on the first screen", async () => {
    const user = userEvent.setup();
    renderWorkspace("objects");

    expect(
      screen.queryByRole("table", { name: "地区监测覆盖情况" }),
    ).not.toBeVisible();
    await user.click(screen.getByText("查看地区监测覆盖情况"));
    const coverage = screen.getByRole("table", { name: "地区监测覆盖情况" });
    expect(within(coverage).getAllByRole("columnheader")).toHaveLength(6);
    expect(coverage).toHaveTextContent("乡镇范围");
    expect(coverage).toHaveTextContent("底册依据");
    expect(coverage).toHaveTextContent("部分核定");
  });

  it("paginates the object ledger by ten and resets to page one after filtering", async () => {
    const user = userEvent.setup();
    const baseObject = marketMonitoringObjects[1];
    const registryObjects = Array.from({ length: 12 }, (_, index) => ({
      ...baseObject,
      objectId: `TEST-MARKET-${index + 1}`,
      objectName: `分页监测对象${index + 1}`,
      ...(index === 11
        ? {
            objectTypeId: "rail-node" as const,
            objectTypeLabel: "铁路站点",
          }
        : {}),
    }));
    render(
      <MarketMonitoringWorkspace
        onComposeReport={vi.fn()}
        onScopeChange={vi.fn()}
        queryAllowed
        registryObjects={registryObjects}
        scope={allMarketScope}
        section="objects"
      />,
    );

    const pagination = screen.getByRole("navigation", { name: "表格分页" });
    const registry = screen.getByRole("table", { name: "市场对象名录" });
    expect(pagination).toHaveTextContent("共 12 条 · 当前 1–10");
    expect(within(registry).getAllByRole("row")).toHaveLength(11);

    await user.click(
      within(pagination).getByRole("button", { name: "下一页" }),
    );
    expect(pagination).toHaveTextContent("共 12 条 · 当前 11–12");
    expect(registry).toHaveTextContent("分页监测对象11");

    await user.selectOptions(
      screen.getByRole("combobox", { name: "对象类型" }),
      "rail-node",
    );
    expect(pagination).toHaveTextContent("共 1 条 · 当前 1–1");
    expect(pagination).toHaveTextContent("1/ 1");
    expect(registry).toHaveTextContent("分页监测对象12");

    await user.selectOptions(
      screen.getByRole("combobox", { name: "有效状态" }),
      "inactive",
    );
    expect(pagination).toHaveTextContent("共 0 条 · 当前 0–0");
    expect(within(registry).getAllByRole("row")).toHaveLength(1);
  });

  it("paginates the market task ledger by ten and resets to page one after filtering", async () => {
    const user = userEvent.setup();
    const baseWorkItem = businessWorkFixtures.find(
      ({ workId }) => workId === "WORK-MARKET-FILL-W31",
    )!;
    const workItems = Array.from({ length: 12 }, (_, index) => ({
      ...baseWorkItem,
      title: `分页市场任务${index + 1}`,
    }));
    render(
      <MarketMonitoringWorkspace
        onComposeReport={vi.fn()}
        onScopeChange={vi.fn()}
        queryAllowed
        scope={allMarketScope}
        section="tasks"
        workItems={workItems}
      />,
    );

    const region = screen.getByRole("region", { name: "市场任务台账区域" });
    const scroll = screen.getByLabelText("市场任务台账横向滚动区域");
    const ledger = screen.getByRole("table", { name: "市场任务台账" });
    const pagination = within(region).getByRole("navigation", {
      name: "表格分页",
    });
    expect(within(scroll).queryByRole("navigation")).not.toBeInTheDocument();
    expect(pagination).toHaveTextContent("共 12 条 · 当前 1–10");
    expect(within(ledger).getAllByRole("row")).toHaveLength(11);

    await user.click(
      within(pagination).getByRole("button", { name: "下一页" }),
    );
    expect(pagination).toHaveTextContent("共 12 条 · 当前 11–12");
    expect(within(ledger).getAllByRole("row")).toHaveLength(3);
    expect(ledger).toHaveTextContent("分页市场任务11");

    await user.click(screen.getByText("更多筛选（0 项已生效）"));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "质量状态" }),
      "warning",
    );
    expect(pagination).toHaveTextContent("共 12 条 · 当前 1–10");
    expect(ledger).toHaveTextContent("分页市场任务1");

    await user.selectOptions(
      screen.getByRole("combobox", { name: "质量状态" }),
      "passed",
    );
    expect(pagination).toHaveTextContent("共 0 条 · 当前 0–0");
    expect(pagination).toHaveTextContent("1/ 1");
    expect(within(ledger).getAllByRole("row")).toHaveLength(1);
  });

  it("keeps object maintenance hidden for the default read-only scope", async () => {
    const user = userEvent.setup();
    renderWorkspace("objects", {
      scope: {
        ...allMarketScope,
        authorization: {
          ...allMarketScope.authorization,
          permissionKeys: ["prototype:read"],
        },
      },
    });

    const viewButton = screen.getAllByRole("button", { name: /^查看/ })[0];
    await user.click(viewButton);
    expect(screen.queryByText("编辑监测对象")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "编辑对象类型" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("新增监测对象")).not.toBeInTheDocument();
  });

  it("keeps analysis coordinates unselected and exposes every market subtype", () => {
    renderWorkspace("analysis");

    const subtype = screen.getByRole("combobox", { name: "业务分类" });
    for (const label of [
      "报价与交易",
      "市场质量",
      "市场库存",
      "加工",
      "消费与使用",
      "销售",
      "物流",
      "农资",
    ]) {
      expect(
        within(subtype).getByRole("option", { name: label }),
      ).toBeVisible();
    }
    expect(screen.getByRole("combobox", { name: "产品或品类" })).toHaveValue(
      "",
    );
    expect(screen.getByRole("combobox", { name: "分析期间" })).toHaveValue("");
    expect(
      screen.queryByRole("combobox", { name: "数据状态" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/数据状态：正式发布数据/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "采用数据" }),
    ).not.toBeInTheDocument();
    expect(
      within(
        screen.getByRole("search", { name: "市场分析查询条件" }),
      ).getAllByRole("combobox"),
    ).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "更多条件" }));
    expect(screen.getByRole("combobox", { name: "采用数据" })).toHaveValue("");
    expect(screen.queryByText("指标数据版本")).not.toBeInTheDocument();
    expect(screen.queryByText("请选择分析条件")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("分析坐标");
    expect(
      screen.getByText(/请选择业务分类、产品或品类、分析期间和采用数据/),
    ).toBeVisible();
  });

  it("shows source-backed four-year price and transaction comparisons with on-demand charts", async () => {
    const user = userEvent.setup();
    function StatefulAnalysis() {
      const [scope, setScope] = useState<OperationalScope>({
        ...allMarketScope,
        authorization: {
          ...allMarketScope.authorization,
          authorizedRegionIds: ["qiqihar-all", "qiqihar-nehe"],
        },
        coordinates: {
          regionId: "qiqihar-all",
          businessSubtypeId: "market.quote-trade",
          productId: "corn",
          periodKey: "2026-W31",
          dataLayer: "official",
          releaseVersion: "METRIC-2026-W31-V3",
        },
      });
      return (
        <MarketMonitoringWorkspace
          onComposeReport={vi.fn()}
          onScopeChange={(coordinates) =>
            setScope((current) => ({
              ...current,
              coordinates: { ...current.coordinates, ...coordinates },
            }))
          }
          queryAllowed
          scope={scope}
          section="analysis"
        />
      );
    }
    render(<StatefulAnalysis />);

    expect(
      screen.getByRole("search", { name: "市场分析查询条件" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "市场分析结果摘要" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/数据状态：正式发布数据/),
    ).not.toBeInTheDocument();
    const ledger = screen.getByRole("table", { name: "市场四年指标台账" });
    expect(within(ledger).getAllByRole("row")).toHaveLength(4);
    expect(within(ledger).getAllByRole("columnheader")).toHaveLength(8);
    expect(
      within(ledger).getByRole("columnheader", { name: "采用数据" }),
    ).toBeVisible();
    expect(ledger).not.toHaveTextContent(/数据发布批次|采用数据批次/);
    for (const metric of ["采购价", "成交价", "成交量"]) {
      const row = within(ledger)
        .getByRole("rowheader", { name: metric })
        .closest("tr");
      expect(row).not.toBeNull();
      expect(row).toHaveTextContent("2023");
      expect(row).toHaveTextContent("2024");
      expect(row).toHaveTextContent("2025");
      expect(row).toHaveTextContent("年均复合增长率");
    }
    expect(
      screen.queryByText("当前条件下暂无四年可比指标"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/暂不可比指标及原因/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "分析采购价" }));
    expect(screen.getByLabelText("采购价选中指标分析")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "统计口径与数据来源" }),
    ).toBeVisible();
  });

  it("blocks a market report while the source work is pending and quality-warning", () => {
    const onComposeReport = vi.fn();
    renderWorkspace("analysis", {
      onComposeReport,
      scope: {
        ...allMarketScope,
        authorization: {
          ...allMarketScope.authorization,
          permissionKeys: [
            ...allMarketScope.authorization.permissionKeys,
            "report.draft.save",
          ],
        },
        coordinates: {
          regionId: "qiqihar-all",
          businessSubtypeId: "market.quote-trade",
          productId: "corn",
          cultivarId: "demeiya-3",
          periodKey: "2026-W31",
          dataLayer: "official",
          releaseVersion: "METRIC-2026-W31-V3",
        },
      },
    });

    const compose = screen.getByRole("button", {
      name: "按当前范围编制报告",
    });
    expect(compose).toBeDisabled();
    expect(screen.getByText(/尚无完全匹配的已核定报告数据/)).toBeVisible();
    expect(onComposeReport).not.toHaveBeenCalled();
  });

  it("composes an aggregate market report from the exact approved metric batch", async () => {
    const user = userEvent.setup();
    const onComposeReport = vi.fn();
    renderWorkspace("analysis", {
      onComposeReport,
      scope: {
        ...allMarketScope,
        authorization: {
          ...allMarketScope.authorization,
          permissionKeys: [
            ...allMarketScope.authorization.permissionKeys,
            "report.draft.save",
          ],
        },
        coordinates: {
          regionId: "qiqihar-all",
          businessSubtypeId: "market.quote-trade",
          productId: "corn",
          periodKey: "2026-W31",
          dataLayer: "official",
          releaseVersion: "METRIC-2026-W31-V3",
        },
      },
    });

    const compose = screen.getByRole("button", {
      name: "按当前范围编制报告",
    });
    expect(compose).toBeEnabled();
    await user.click(compose);
    expect(onComposeReport).toHaveBeenCalledWith(
      expect.objectContaining({
        application: "market",
        region: "齐齐哈尔市全域",
        product: "玉米",
        cultivar: "不按具体品种拆分",
        reportTemplate: "价格与交易监测报告",
        frequency: "周报",
        dataVersion: "MARKET-2026-W31-APPROVED",
      }),
    );
  });

  it("does not open market report composition without draft-save permission", () => {
    const onComposeReport = vi.fn();
    renderWorkspace("analysis", {
      onComposeReport,
      scope: {
        ...allMarketScope,
        coordinates: {
          regionId: "qiqihar-all",
          businessSubtypeId: "market.quote-trade",
          productId: "corn",
          periodKey: "2026-W31",
          dataLayer: "official",
          releaseVersion: "METRIC-2026-W31-V3",
        },
      },
    });

    expect(
      screen.getByText("当前登录岗位没有编制业务报告的权限。"),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "按当前范围编制报告" }),
    ).toBeDisabled();
    expect(onComposeReport).not.toHaveBeenCalled();
  });

  it("does not compose a market report when the approved dataset is not an exact match", async () => {
    const user = userEvent.setup();
    const onComposeReport = vi.fn();
    renderWorkspace("analysis", {
      onComposeReport,
      scope: {
        ...allMarketScope,
        authorization: {
          ...allMarketScope.authorization,
          permissionKeys: [
            ...allMarketScope.authorization.permissionKeys,
            "report.draft.save",
          ],
        },
        coordinates: {
          regionId: "qiqihar-all",
          businessSubtypeId: "market.quote-trade",
          productId: "corn",
          cultivarId: "jingke-968",
          periodKey: "2026-W31",
          dataLayer: "official",
          releaseVersion: "METRIC-2026-W31-V3",
        },
      },
    });

    const compose = screen.getByRole("button", {
      name: "按当前范围编制报告",
    });
    expect(compose).toBeDisabled();
    await user.click(compose);
    expect(onComposeReport).not.toHaveBeenCalled();
    const reason = screen.getByText(/尚无完全匹配的已核定报告数据/);
    expect(reason).toHaveTextContent("系统未改用其他范围");
  });

  it("returns a Chinese empty state for an invalid coordinate without Qiqihar fallback", () => {
    const invalidScope: OperationalScope = {
      ...allMarketScope,
      coordinates: {
        regionId: "unauthorized-region",
        businessSubtypeId: "market.quote-trade",
        productId: "corn",
        periodKey: "2026-W31",
        dataLayer: "official",
        releaseVersion: "METRIC-2026-W31-V3",
      },
    };
    const { container } = renderWorkspace("analysis", { scope: invalidScope });

    expect(screen.getByText("当前条件下暂无四年可比指标")).toBeVisible();
    expect(screen.getByText(/所选地区不在当前授权范围/)).toBeVisible();
    expect(
      within(
        screen.getByRole("table", { name: "市场四年指标台账" }),
      ).getAllByRole("row"),
    ).toHaveLength(1);
    expect(screen.getByText("查看 3 项暂不可比指标及原因")).toBeVisible();
    expect(container).not.toHaveTextContent("market.purchase-price");
  });

  it("blocks a product-cultivar mismatch without falling back to another metric", () => {
    renderWorkspace("analysis", {
      scope: {
        ...allMarketScope,
        coordinates: {
          regionId: "authorized-all",
          businessSubtypeId: "market.quote-trade",
          productId: "paddy",
          cultivarId: "jingke-968",
          periodKey: "2026-W31",
          releaseVersion: "METRIC-2026-W31-V3",
        },
      },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "具体品种与所选产品不匹配",
    );
    expect(
      screen.queryByText("当前条件下暂无四年可比指标"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "市场四年指标台账" }),
    ).not.toHaveTextContent("采购价");
  });

  it("shows governed wheat master data but no invented formal metric", () => {
    renderWorkspace("analysis", {
      scope: {
        ...allMarketScope,
        coordinates: {
          regionId: "authorized-all",
          businessSubtypeId: "market.quote-trade",
          productId: "wheat",
          periodKey: "2026-W31",
          releaseVersion: "METRIC-2026-W31-V3",
        },
      },
    });

    expect(screen.getByRole("combobox", { name: "产品或品类" })).toHaveValue(
      "wheat",
    );
    expect(screen.getByText("当前条件下暂无四年可比指标")).toBeVisible();
    expect(
      screen.getByRole("table", { name: "市场四年指标台账" }),
    ).not.toHaveTextContent("采购价");
  });

  it("never exposes internal object, work, responsibility, metric, publication or duty keys", () => {
    const { container } = renderWorkspace("tasks");
    expect(container.textContent).not.toMatch(
      /(?:MK|WORK|OBJ|DOCUMENT|RESP|METRIC|PUB|DUTY)-/,
    );
    expect(container.textContent).not.toMatch(
      /(?:not-due|in-progress|overdue-completed|unreleased|superseded)/,
    );
    expect(container.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });

  it("keeps implementation and governance wording out of market business workspaces", () => {
    for (const sourceFile of [
      "src/prototype/market/MarketObjectRegistry.tsx",
      "src/prototype/market/MarketTaskWorkspace.tsx",
      "src/prototype/market/MarketAnalysisWorkspace.tsx",
    ]) {
      expect(readFileSync(sourceFile, "utf8")).not.toMatch(
        /业务坐标|治理口径|已被新版本替代/,
      );
    }
  });

  it("uses the shared dense filter baseline and named internal ledger scrolling", () => {
    const css = readFileSync("src/prototype/market-monitoring.css", "utf8");
    expect(css).toContain("/* enterprise-task6-market:start */");
    expect(css).toContain(
      "grid-template-columns: repeat(5, minmax(132px, 1fr))",
    );
    expect(css).toContain("gap: 9px 10px");
    expect(css).toContain("padding: 11px 12px 12px");
    expect(css).toContain("min-height: 36px");
    expect(css).toContain("font-size: 12px");
    expect(css).toContain("font-size: 13px");
    expect(css).toMatch(
      /@media \(max-width: 1280px\)[\s\S]*repeat\(4, minmax\(132px, 1fr\)\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 1024px\)[\s\S]*repeat\(2, minmax\(132px, 1fr\)\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 720px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)/,
    );
    expect(css).toMatch(/\.market-task6-workspace[\s\S]*overflow-x: clip/);
    expect(css).toMatch(/\.market-task6-ledger-scroll[\s\S]*overflow-x: auto/);
    expect(css).toMatch(
      /\.market-task6-object-editor \{[\s\S]*max-width: 100%;[\s\S]*overflow: hidden/,
    );
    expect(css).toMatch(
      /\.market-task6-object-editor-role-list \{[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/,
    );
  });
});
