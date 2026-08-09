import { useState } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OperationalScope } from "./core/operationalScope";
import type { BusinessWorkItem } from "./core/businessWork";
import type { BusinessReportContext } from "./businessReportModel";
import { businessWorkFixtures } from "./data/businessWorkFixtures";
import { prototypeOperationalIdentity } from "./formalEnterpriseData";
import type {
  BusinessCoordinates,
  FormalSelection,
  ProductionSection,
} from "./formalEnterpriseModel";
import { ProductionObjectRegistry } from "./production/ProductionObjectRegistry";
import { ProductionMonitoringWorkspace } from "./ProductionMonitoringWorkspace";
import type { ProductionDocumentDraft } from "./production/ProductionDocumentWorkbench";

afterEach(cleanup);

function ProductionHarness({
  section,
  initialCoordinates = {},
  initialSelection,
  authorization = {},
  queryAllowed = true,
  onComposeReport = vi.fn(),
}: {
  section: ProductionSection;
  initialCoordinates?: Partial<BusinessCoordinates>;
  initialSelection?: FormalSelection;
  authorization?: Partial<OperationalScope["authorization"]>;
  queryAllowed?: boolean;
  onComposeReport?: (context: BusinessReportContext) => void;
}) {
  const [scope, setScope] = useState<OperationalScope>({
    ...prototypeOperationalIdentity,
    authorization: {
      ...prototypeOperationalIdentity.authorization,
      ...authorization,
    },
    coordinates: { regionId: "authorized-all", ...initialCoordinates },
    savedView: null,
  });
  const [selection, setSelection] = useState(initialSelection);
  const [workItems, setWorkItems] = useState<readonly BusinessWorkItem[]>(() =>
    businessWorkFixtures.map((item) => ({ ...item })),
  );
  const [documentDrafts, setDocumentDrafts] = useState<
    Record<string, ProductionDocumentDraft>
  >({});
  return (
    <ProductionMonitoringWorkspace
      documentDrafts={documentDrafts}
      onComposeReport={onComposeReport}
      onScopeChange={(coordinates) =>
        setScope((current) => ({
          ...current,
          coordinates: { ...current.coordinates, ...coordinates },
        }))
      }
      onSelectionChange={setSelection}
      onSelectionClear={() => setSelection(undefined)}
      onDocumentDraftChange={(workId, draft) =>
        setDocumentDrafts((current) => ({ ...current, [workId]: draft }))
      }
      onWorkItemChange={(next) =>
        setWorkItems((current) =>
          current.map((item) => (item.workId === next.workId ? next : item)),
        )
      }
      scope={scope}
      queryAllowed={queryAllowed}
      section={section}
      selection={selection}
      workItems={workItems}
    />
  );
}

const forbiddenVisibleText =
  /(?:PROD|WORK|OBJ|RESP|METRIC|DUTY|PUB)-|not-due|in-progress|on-time|overdue-completed|missed|exempt|draft|submitted|returned|corrected|pending|reviewing|approved|passed|warning|blocking|awaiting-explanation|unreleased|published|superseded|current|stale|\d{4}-\d{2}-\d{2}T/;

describe("production monitoring workspace", () => {
  it("uses governed production object types and soybean-specific quality columns", () => {
    render(<ProductionHarness section="soybean-collection" />);

    const objectType = screen.getByRole("combobox", { name: "对象类型" });
    expect(
      within(objectType)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["全部对象类型", "农户", "村委会", "农技站"]);

    const table = screen.getByRole("table", { name: "大豆产情调查表" });
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

  it("uses only the four governed paddy quality columns", () => {
    render(<ProductionHarness section="rice-collection" />);

    const table = screen.getByRole("table", { name: "稻谷产情调查表" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(expect.arrayContaining(["水分", "出米率", "出糙率", "杂质"]));
    expect(
      within(table).queryByRole("columnheader", { name: "蛋白" }),
    ).not.toBeInTheDocument();
    expect(
      within(table).queryByRole("columnheader", { name: "容重" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["corn-collection", "玉米"],
    ["soybean-collection", "大豆"],
    ["rice-collection", "稻谷"],
  ] as const)(
    "renders %s as a product-owned production worktable",
    (section, productLabel) => {
      render(
        <ProductionHarness
          initialCoordinates={{ periodKey: "2026-W31" }}
          section={section}
        />,
      );

      expect(document.body).toHaveTextContent(
        `产情监测 / ${productLabel}产情填报`,
      );
      expect(
        screen.getByRole("table", { name: `${productLabel}产情调查表` }),
      ).toBeVisible();
      expect(
        screen.queryByRole("combobox", { name: "产品或作物" }),
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText("选择地区")).toBeVisible();
      for (const column of [
        "调查对象",
        "播种面积",
        "预计单产",
        "预计总产",
        "与上年相比",
      ]) {
        expect(
          screen.getByRole("columnheader", { name: column }),
        ).toBeVisible();
      }

      const rows = within(
        screen.getByRole("table", { name: `${productLabel}产情调查表` }),
      ).getAllByRole("row");
      expect(rows.length).toBeGreaterThan(2);
    },
  );

  it("filters the production worktable at city, county, township and village level", async () => {
    const user = userEvent.setup();
    render(
      <ProductionHarness
        initialCoordinates={{ periodKey: "2026-W31" }}
        section="rice-collection"
      />,
    );

    await user.click(screen.getByLabelText("选择地区"));
    await user.click(screen.getByRole("button", { name: "齐齐哈尔市" }));
    await user.click(screen.getByRole("button", { name: "讷河市" }));
    await user.click(screen.getByRole("button", { name: "同义镇" }));
    await user.click(screen.getByRole("button", { name: "庆宝村" }));
    await user.click(screen.getByRole("button", { name: "完成" }));

    const table = screen.getByRole("table", { name: "稻谷产情调查表" });
    expect(table).toHaveTextContent("讷河市同义镇农技站");
    expect(table).not.toHaveTextContent("当前范围暂无稻谷产情调查记录");
  });

  it("renders a period task queue with progressive filters and seven decision columns", async () => {
    const user = userEvent.setup();
    render(
      <ProductionHarness
        initialCoordinates={{ periodKey: "2026-W31" }}
        section="tasks"
      />,
    );

    expect(screen.getByRole("heading", { name: "产情任务作业" })).toBeVisible();
    const ledger = screen.getByRole("table", { name: "产情任务台账" });
    expect(ledger).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "表格分页" }),
    ).toHaveTextContent("共 3 条 · 当前 1–3");
    expect(screen.queryByText("产情对象名录")).not.toBeInTheDocument();
    for (const filter of ["业务地区", "业务分类", "产品或作物", "任务期间"]) {
      expect(screen.getByRole("combobox", { name: filter })).toBeVisible();
    }
    for (const hiddenFilter of [
      "具体品种",
      "义务状态",
      "单据状态",
      "审核状态",
      "质量状态",
      "发布状态",
    ]) {
      expect(
        screen.queryByRole("combobox", { name: hiddenFilter }),
      ).not.toBeInTheDocument();
    }
    const moreFilters = screen.getByRole("button", { name: "更多筛选" });
    expect(moreFilters).toHaveAttribute("aria-expanded", "false");
    await user.click(moreFilters);
    for (const advancedFilter of [
      "具体品种",
      "义务状态",
      "单据状态",
      "审核状态",
      "质量状态",
      "发布状态",
    ]) {
      expect(
        screen.getByRole("combobox", { name: advancedFilter }),
      ).toBeVisible();
    }
    expect(
      within(ledger)
        .getAllByRole("columnheader")
        .map(({ textContent }) => textContent),
    ).toEqual([
      "任务与监测对象",
      "业务分类",
      "地区与作物",
      "期间与截止",
      "责任与完成度",
      "当前处理节点",
      "操作",
    ]);
    for (const removedColumn of [
      "义务状态",
      "单据状态",
      "审核状态",
      "质量状态",
      "发布状态",
    ]) {
      expect(
        within(ledger).queryByRole("columnheader", { name: removedColumn }),
      ).not.toBeInTheDocument();
    }
    const summary = screen.getByRole("region", {
      name: "产情任务结果摘要",
    });
    const filters = screen.getByRole("region", { name: "产情任务筛选" });
    const ledgerRegion = screen.getByRole("region", {
      name: "产情任务台账区域",
    });
    expect(summary).toHaveTextContent("3 项任务");
    expect(
      filters.compareDocumentPosition(summary) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      summary.compareDocumentPosition(ledgerRegion) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const row = screen.getByRole("row", {
      name: /讷河市玉米长势与测产调查/,
    });
    expect(row).toHaveTextContent("查看全部状态");
    for (const status of [
      "进行中",
      "已退回",
      "审核退回",
      "质量阻断",
      "未发布",
    ]) {
      expect(row).toHaveTextContent(status);
    }
    expect(document.body).not.toHaveTextContent(forbiddenVisibleText);
  });

  it("cascades task cultivars from the selected product and clears an old cultivar", async () => {
    const user = userEvent.setup();
    render(
      <ProductionHarness
        initialCoordinates={{ productId: "soybean", cultivarId: "heinong-84" }}
        section="tasks"
      />,
    );

    await user.click(screen.getByRole("button", { name: /更多筛选/ }));
    const cultivar = screen.getByRole("combobox", { name: "具体品种" });
    expect(
      within(cultivar).getByRole("option", { name: "黑农84" }),
    ).toBeVisible();
    expect(
      within(cultivar).getByRole("option", { name: "东生22" }),
    ).toBeVisible();
    expect(
      within(cultivar).queryByRole("option", { name: "京科968" }),
    ).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "产品或作物" }),
      "corn",
    );
    expect(cultivar).toHaveValue("");
    expect(
      within(cultivar).getByRole("option", { name: "京科968" }),
    ).toBeVisible();
    expect(
      within(cultivar).queryByRole("option", { name: "黑农84" }),
    ).not.toBeInTheDocument();
  });

  it("keeps an incompatible task cultivar explicit instead of using another option", async () => {
    const user = userEvent.setup();
    render(
      <ProductionHarness
        initialCoordinates={{ productId: "soybean", cultivarId: "jingke-968" }}
        section="tasks"
      />,
    );

    await user.click(screen.getByRole("button", { name: /更多筛选/ }));
    expect(screen.getByRole("combobox", { name: "具体品种" })).toHaveValue(
      "jingke-968",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "所选具体品种不适用于当前产品，请重新选择",
    );
    expect(document.body).not.toHaveTextContent("产品或品种已自动替换");
  });

  it("opens collection and review lifecycle sections inside the same task document workbench", async () => {
    const user = userEvent.setup();
    render(
      <ProductionHarness
        initialCoordinates={{ periodKey: "2026-W31" }}
        section="tasks"
      />,
    );
    await user.click(
      screen.getAllByRole("button", { name: "补充产情填报" })[0],
    );

    expect(
      screen.getByRole("region", {
        name: "讷河市玉米长势与测产调查单据工作台",
      }),
    ).toBeVisible();
    for (const action of ["在线填报", "电子表格批量导入", "授权系统接入"]) {
      expect(screen.getByRole("button", { name: action })).toBeVisible();
    }
    for (const heading of [
      "种植与面积",
      "长势与灾情",
      "单产与总产",
      "质量调查",
      "余粮与销售",
      "种植意愿",
      "成本与保障",
      "来源与校验",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeVisible();
    }
    expect(document.body).not.toHaveTextContent("本单据不适用");
    expect(document.body).not.toHaveTextContent("责任人已确认");
    expect(document.body).toHaveTextContent("本章节数据已由责任人确认");
    for (const independentField of ["监测面积", "预计单产"]) {
      expect(
        screen.getByRole("textbox", { name: independentField }),
      ).toBeVisible();
    }
    expect(
      screen.queryByRole("textbox", { name: "样本平均结果" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "区域加权估计" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "单据与审核流程" }),
    ).toBeVisible();
    expect(document.body).toHaveTextContent("质量检验依据需要补充");
    expect(document.body).not.toHaveTextContent(forbiddenVisibleText);
  });

  it("persists edits and completes the returned document save-check-resubmit lifecycle", async () => {
    const user = userEvent.setup();
    render(
      <ProductionHarness
        initialCoordinates={{ periodKey: "2026-W31" }}
        section="tasks"
      />,
    );
    await user.click(
      screen.getAllByRole("button", { name: "补充产情填报" })[0],
    );

    const yieldInput = screen.getByRole("textbox", { name: "预计单产" });
    await user.clear(yieldInput);
    await user.type(yieldInput, "470.0 公斤/亩");
    expect(yieldInput).toHaveValue("470.0 公斤/亩");

    const pendingConfirmations = screen.getAllByRole("button", {
      name: "确认本章节来源值",
    });
    for (const button of pendingConfirmations) await user.click(button);
    expect(
      screen.queryByRole("button", { name: "确认本章节来源值" }),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: "保存更正草稿" }));
    expect(
      screen.getByText("更正草稿已保存，原提交与退回记录继续保留"),
    ).toBeVisible();
    expect(screen.getByText("更正中")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "执行提交前检查" }));
    expect(screen.getByText(/提交前检查已通过，已核验/)).toBeVisible();
    expect(screen.getByText("提交前检查：已通过")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "重新提交审核" }));
    expect(screen.getByText(/已由王洋提交审核/)).toBeVisible();
    const lifecycleStates = screen.getByLabelText("任务五状态");
    expect(within(lifecycleStates).getByText("已提交")).toBeVisible();
    expect(within(lifecycleStates).getByText("待审核")).toBeVisible();
    expect(screen.getByText(/更正提交 · 王洋/)).toBeVisible();
    expect(screen.getByRole("textbox", { name: "预计单产" })).toHaveValue(
      "470.0 公斤/亩",
    );
  });

  it("closes a controlled task detail when the external selection is cleared", () => {
    const scope: OperationalScope = {
      ...prototypeOperationalIdentity,
      coordinates: { regionId: "authorized-all", periodKey: "2026-W31" },
      savedView: null,
    };
    const renderWorkspace = (selection?: FormalSelection) => (
      <ProductionMonitoringWorkspace
        onComposeReport={vi.fn()}
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        scope={scope}
        section="tasks"
        selection={selection}
      />
    );
    const { rerender } = render(
      renderWorkspace({
        type: "work-item",
        id: "WORK-PRODUCTION-FILL-W31",
      }),
    );

    expect(
      screen.getByRole("region", {
        name: "讷河市玉米长势与测产调查单据工作台",
      }),
    ).toBeVisible();

    rerender(renderWorkspace(undefined));
    expect(
      screen.queryByRole("region", {
        name: "讷河市玉米长势与测产调查单据工作台",
      }),
    ).not.toBeInTheDocument();
  });

  it("renders the cross-period object registry and shows capabilities only after selecting an object", async () => {
    const user = userEvent.setup();
    render(
      <ProductionHarness
        authorization={{
          authorizedRegionIds: ["qiqihar-nehe"],
          authorizedProductIds: ["corn", "soybean"],
          authorizedCultivarIds: ["demeiya-3", "heinong-84", "jingke-968"],
        }}
        section="objects"
      />,
    );

    expect(screen.getByRole("heading", { name: "产情对象名录" })).toBeVisible();
    const registry = screen.getByRole("table", { name: "产情监测对象名录" });
    expect(screen.getByRole("navigation", { name: "表格分页" })).toBeVisible();
    for (const filter of ["对象类型", "业务地区", "作物", "有效状态"]) {
      expect(screen.getByRole("combobox", { name: filter })).toBeVisible();
    }
    await user.click(screen.getByRole("button", { name: "更多筛选" }));
    for (const filter of ["具体品种", "来源渠道"]) {
      expect(screen.getByRole("combobox", { name: filter })).toBeVisible();
    }
    expect(
      within(screen.getByRole("combobox", { name: "对象类型" }))
        .getAllByRole("option")
        .map(({ textContent }) => textContent),
    ).not.toContain("田间样方");
    expect(
      within(screen.getByRole("combobox", { name: "来源渠道" }))
        .getAllByRole("option")
        .map(({ textContent }) => textContent),
    ).not.toContain("田间测产");
    for (const column of [
      "对象名称",
      "对象类型",
      "行政区划",
      "作物",
      "具体品种",
      "来源渠道",
      "责任人",
      "有效状态",
    ]) {
      expect(
        within(registry).getByRole("columnheader", { name: column }),
      ).toBeVisible();
    }
    expect(registry).toHaveTextContent("村委会");
    expect(registry).toHaveTextContent("行政村台账");
    expect(registry).not.toHaveTextContent("稻谷");
    expect(
      screen.queryByRole("heading", { name: "当前适用能力" }),
    ).not.toBeInTheDocument();

    await user.click(
      within(registry).getByRole("button", {
        name: "查看讷河市同义镇保国村村委会",
      }),
    );
    expect(screen.getByRole("heading", { name: "当前适用能力" })).toBeVisible();
    const objectDetail = screen.getByRole("complementary", {
      name: "讷河市同义镇保国村村委会对象详情",
    });
    for (const capability of [
      "种植面积调查",
      "长势与灾情调查",
      "测产与产量调查",
      "余粮与销售调查",
    ]) {
      expect(within(objectDetail).getByText(capability)).toBeVisible();
    }
    expect(objectDetail).not.toHaveTextContent(
      /模板|第[一二三四五六七八九十\d]+版|CAPABILITY/,
    );
    expect(document.body).not.toHaveTextContent(forbiddenVisibleText);

    await user.click(screen.getByRole("button", { name: "新增监测对象" }));
    for (const field of [
      "编辑对象类型",
      "编辑行政区划",
      "编辑来源渠道",
      "编辑责任人",
      "编辑有效状态",
    ]) {
      expect(screen.getByRole("combobox", { name: field })).toBeVisible();
    }
    for (const group of ["编辑作物", "编辑具体品种", "编辑业务角色"]) {
      expect(screen.getByRole("group", { name: group })).toBeVisible();
    }
    expect(screen.getByRole("combobox", { name: "编辑行政区划" })).toHaveValue(
      "",
    );
    expect(screen.getByLabelText("产情调查对象角色生效日期")).toBeVisible();
    expect(screen.getByLabelText("产情调查对象角色失效日期")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "保存对象草稿" }));
    expect(screen.getByRole("alert")).toHaveTextContent("请选择对象类型");
    expect(screen.getByRole("alert")).toHaveTextContent("请选择来源渠道");
    expect(screen.getByRole("alert")).not.toHaveTextContent("治理对象类型");
    expect(screen.getByRole("alert")).not.toHaveTextContent("治理来源渠道");
    expect(screen.getByRole("alert")).toHaveTextContent("请选择已授权行政区划");

    await user.type(
      screen.getByRole("textbox", { name: "对象名称" }),
      "新增测试对象",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "编辑对象类型" }),
      "village-committee",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "编辑行政区划" }),
      "qiqihar-nehe",
    );
    await user.click(screen.getByRole("checkbox", { name: "玉米" }));
    await user.click(screen.getByRole("checkbox", { name: "京科968" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "编辑来源渠道" }),
      "administrative-village-ledger",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "编辑责任人" }),
      "wang-yang",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "编辑有效状态" }),
      "active",
    );
    await user.click(screen.getByRole("checkbox", { name: "产情调查对象" }));
    await user.type(
      screen.getByLabelText("产情调查对象角色生效日期"),
      "2026-08-01",
    );
    await user.click(screen.getByRole("button", { name: "保存对象草稿" }));
    expect(screen.getByRole("status")).toHaveTextContent("对象草稿已保存");
    expect(registry).toHaveTextContent("新增测试对象");
  });

  it("grants production object maintenance only through the explicit manage permission", async () => {
    const user = userEvent.setup();
    expect(prototypeOperationalIdentity.authorization.permissionKeys).toContain(
      "production:object:manage",
    );
    render(<ProductionHarness section="objects" />);

    expect(screen.getByRole("button", { name: "新增监测对象" })).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "查看讷河市同义镇保国村村委会" }),
    );
    expect(screen.getByRole("button", { name: "编辑对象" })).toBeVisible();
  });

  it("keeps a directly rendered production object registry read-only without the manage permission", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn<(selection: FormalSelection) => void>();
    const onRegistryObjectsChange = vi.fn();
    const readOnlyScope: OperationalScope = {
      ...prototypeOperationalIdentity,
      authorization: {
        ...prototypeOperationalIdentity.authorization,
        permissionKeys: ["prototype:read"],
      },
      coordinates: { regionId: "authorized-all" },
      savedView: null,
    };
    const props = {
      onRegistryObjectsChange,
      onScopeChange: vi.fn(),
      onSelectionClear: vi.fn(),
      onSelectionChange,
      queryAllowed: true,
      scope: readOnlyScope,
    };
    const { rerender } = render(<ProductionObjectRegistry {...props} />);

    expect(screen.getByRole("heading", { name: "产情对象名录" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "新增监测对象" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "查看讷河市同义镇保国村村委会" }),
    );
    const selection = onSelectionChange.mock.calls[0][0];
    rerender(<ProductionObjectRegistry {...props} selection={selection} />);

    expect(
      screen.getByRole("complementary", {
        name: "讷河市同义镇保国村村委会对象详情",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "编辑对象" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(onRegistryObjectsChange).not.toHaveBeenCalled();
  });

  it("opens and closes a production object detail without resetting the registry filters", async () => {
    const user = userEvent.setup();
    render(<ProductionHarness section="objects" />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "对象类型" }),
      "village-committee",
    );
    await user.click(
      screen.getByRole("button", { name: "查看讷河市同义镇保国村村委会" }),
    );
    const detail = screen.getByRole("complementary", {
      name: "讷河市同义镇保国村村委会对象详情",
    });
    expect(detail).toHaveTextContent("身份与业务角色");
    expect(detail).toHaveTextContent("附件与来源凭证");
    await user.click(within(detail).getByRole("button", { name: "关闭详情" }));

    expect(
      screen.queryByRole("complementary", {
        name: "讷河市同义镇保国村村委会对象详情",
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "对象类型" })).toHaveValue(
      "village-committee",
    );
    expect(
      screen.getByRole("table", { name: "产情监测对象名录" }),
    ).toBeVisible();
  });

  it("keeps object type in the primary object filters and moves secondary conditions behind more filters", async () => {
    const user = userEvent.setup();
    render(
      <ProductionHarness
        authorization={{
          authorizedRegionIds: ["qiqihar-nehe"],
          authorizedProductIds: ["corn", "soybean"],
          authorizedCultivarIds: ["demeiya-3", "jingke-968", "heinong-84"],
        }}
        initialCoordinates={{ productId: "soybean" }}
        section="objects"
      />,
    );

    const filters = screen.getByRole("region", { name: "产情对象筛选" });
    for (const primaryFilter of ["对象类型", "业务地区", "作物", "有效状态"]) {
      expect(
        within(filters).getByRole("combobox", { name: primaryFilter }),
      ).toBeVisible();
    }
    for (const secondaryFilter of ["具体品种", "来源渠道"]) {
      expect(
        within(filters).queryByRole("combobox", { name: secondaryFilter }),
      ).not.toBeInTheDocument();
    }
    const moreFilters = within(filters).getByRole("button", {
      name: "更多筛选",
    });
    expect(moreFilters).toHaveAttribute("aria-expanded", "false");
    await user.click(moreFilters);

    const cultivars = within(filters).getByRole("combobox", {
      name: "具体品种",
    });
    expect(
      within(cultivars).getByRole("option", { name: "黑农84" }),
    ).toBeVisible();
    expect(
      within(cultivars).queryByRole("option", { name: "京科968" }),
    ).not.toBeInTheDocument();
    expect(
      within(filters).getByRole("combobox", { name: "来源渠道" }),
    ).toBeVisible();

    const summary = screen.getByRole("region", {
      name: "产情对象结果摘要",
    });
    const ledgerRegion = screen.getByRole("region", {
      name: "产情对象名录区域",
    });
    expect(summary).toHaveTextContent("1 个对象");
    expect(
      filters.compareDocumentPosition(summary) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      summary.compareDocumentPosition(ledgerRegion) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      within(screen.getByRole("table", { name: "产情监测对象名录" }))
        .getAllByRole("columnheader")
        .map(({ textContent }) => textContent),
    ).toContain("对象类型");
  });

  it("limits the object registry product selector to authorized production crops", async () => {
    const user = userEvent.setup();
    render(<ProductionHarness section="objects" />);

    const products = screen.getByRole("combobox", { name: "作物" });
    for (const crop of ["玉米", "大豆", "稻谷", "小麦"]) {
      expect(
        within(products).getByRole("option", { name: crop }),
      ).toBeVisible();
    }
    expect(
      within(products).queryByRole("option", { name: "大米" }),
    ).not.toBeInTheDocument();
    expect(
      within(products).queryByRole("option", { name: "作物名称待维护" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "新增监测对象" }));
    const editorProducts = screen.getByRole("group", { name: "编辑作物" });
    expect(
      within(editorProducts).getByRole("checkbox", { name: "小麦" }),
    ).toBeVisible();
    expect(
      within(editorProducts).queryByRole("checkbox", { name: "大米" }),
    ).not.toBeInTheDocument();
  });

  it("describes an empty object registry with business filter language", () => {
    render(<ProductionHarness queryAllowed={false} section="objects" />);

    expect(screen.getByRole("status")).toHaveTextContent("当前筛选范围");
    expect(screen.getByRole("status")).not.toHaveTextContent("业务坐标");
  });

  it("round-trips every authorized product, cultivar and effective role when editing an object", async () => {
    const user = userEvent.setup();
    render(
      <ProductionHarness
        authorization={{
          authorizedProductIds: ["corn", "soybean"],
          authorizedCultivarIds: ["demeiya-3", "heinong-84", "jingke-968"],
        }}
        section="objects"
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "查看讷河市同义镇保国村村委会" }),
    );
    await user.click(screen.getByRole("button", { name: "编辑对象" }));
    for (const option of [
      "玉米",
      "大豆",
      "德美亚3号",
      "黑农84",
      "京科968",
      "产情调查对象",
      "质量调查对象",
    ]) {
      expect(screen.getByRole("checkbox", { name: option })).toBeChecked();
    }
    const name = screen.getByRole("textbox", { name: "对象名称" });
    await user.clear(name);
    await user.type(name, "讷河市同义镇保国村村委会草稿");
    await user.click(screen.getByRole("button", { name: "保存对象草稿" }));
    expect(screen.getByRole("status")).toHaveTextContent("对象草稿已保存");
    expect(
      screen.getByRole("table", { name: "产情监测对象名录" }),
    ).toHaveTextContent("玉米、大豆");
    expect(
      screen.getByRole("heading", { name: "当前业务角色" }).parentElement,
    ).toHaveTextContent("产情调查对象");
    expect(
      screen.getByRole("heading", { name: "当前业务角色" }).parentElement,
    ).toHaveTextContent("质量调查对象");

    await user.click(screen.getByRole("button", { name: "编辑对象" }));
    for (const option of [
      "玉米",
      "大豆",
      "德美亚3号",
      "黑农84",
      "京科968",
      "产情调查对象",
      "质量调查对象",
    ]) {
      expect(screen.getByRole("checkbox", { name: option })).toBeChecked();
    }
    expect(screen.getByLabelText("产情调查对象角色生效日期")).toHaveValue(
      "2025-01-01",
    );
    expect(screen.getByLabelText("质量调查对象角色生效日期")).toHaveValue(
      "2026-01-01",
    );
  });

  it("uses governed people and role master data instead of deriving creation choices from existing objects", async () => {
    const user = userEvent.setup();
    render(
      <ProductionHarness
        authorization={{ authorizedRegionIds: ["qiqihar-nehe"] }}
        section="objects"
      />,
    );
    await user.click(screen.getByRole("button", { name: "新增监测对象" }));
    const people = screen.getByRole("combobox", { name: "编辑责任人" });
    expect(within(people).getByRole("option", { name: "王洋" })).toBeVisible();
    expect(within(people).getByRole("option", { name: "赵晨" })).toBeVisible();
    expect(within(people).getByRole("option", { name: "孙悦" })).toBeVisible();
    const roles = screen.getByRole("group", { name: "编辑业务角色" });
    expect(
      within(roles).getByRole("checkbox", { name: "产情调查对象" }),
    ).toBeVisible();
    expect(
      within(roles).getByRole("checkbox", { name: "质量调查对象" }),
    ).toBeVisible();
    expect(
      within(roles).getByRole("checkbox", { name: "专业产情观察" }),
    ).toBeVisible();
  });

  it("can create the first governed object in an authorized region with no existing registry row", async () => {
    const user = userEvent.setup();
    render(
      <ProductionHarness
        authorization={{ authorizedRegionIds: ["qiqihar-longsha"] }}
        section="objects"
      />,
    );

    expect(
      screen.getByText(
        "当前筛选范围内没有可查看的监测对象，请调整筛选条件后重试。",
      ),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "新增监测对象" }));

    const region = screen.getByRole("combobox", { name: "编辑行政区划" });
    expect(
      within(region).getByRole("option", { name: "龙沙区" }),
    ).toBeVisible();
    const objectType = screen.getByRole("combobox", {
      name: "编辑对象类型",
    });
    expect(
      within(objectType).getByRole("option", { name: "农户" }),
    ).toBeVisible();
    expect(
      within(objectType).getByRole("option", { name: "村委会" }),
    ).toBeVisible();
    const source = screen.getByRole("combobox", { name: "编辑来源渠道" });
    expect(
      within(source).getByRole("option", { name: "农户样本" }),
    ).toBeVisible();
  });

  it("renders an official four-year metric ledger and charts only after metric selection", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ProductionHarness
        authorization={{
          authorizedRegionIds: ["qiqihar-all", "qiqihar-nehe"],
        }}
        initialCoordinates={{
          businessDomainId: "production",
          regionId: "qiqihar-all",
          productId: "corn",
          periodKey: "2026-W31",
          dataLayer: "official",
          releaseVersion: "METRIC-2026-W31-V3",
        }}
        section="analysis"
      />,
    );

    expect(screen.getByRole("heading", { name: "产情监测分析" })).toBeVisible();
    expect(
      screen.getByRole("search", { name: "产情分析查询条件" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "产情分析结果摘要" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "产情四年指标台账" }),
    ).toBeVisible();
    const ledger = screen.getByRole("table", { name: "产情四年指标台账" });
    expect(within(ledger).getAllByText("采用数据").length).toBeGreaterThan(0);
    expect(ledger).not.toHaveTextContent(/数据发布批次|采用数据批次/);
    expect(
      within(ledger)
        .getAllByRole("columnheader")
        .map(({ textContent }) => textContent),
    ).toEqual([
      "指标",
      "当前值",
      "四年指标值",
      "相邻同比",
      "当前较前三年",
      "数据依据",
      "操作",
    ]);
    const plantingAreaRow = screen.getByRole("row", { name: /播种面积/ });
    expect(plantingAreaRow).toHaveTextContent("三年复合增长率");
    expect(plantingAreaRow).toHaveTextContent("官方已发布产情指标");
    expect(plantingAreaRow).toHaveTextContent(
      "2026年第31周已核定数据（当前采用）",
    );
    expect(container.querySelectorAll("svg")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "分析播种面积" }));
    expect(container.querySelectorAll("svg")).toHaveLength(2);
    expect(
      screen.getAllByText("2026年第31周已核定数据（当前采用）").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "统计口径与数据来源" }),
    ).toBeVisible();
    expect(
      screen.getByRole("region", { name: "产情四年指标台账区域" }),
    ).toHaveTextContent("3 项");
    expect(screen.getByText("查看 30 项暂不可比指标及原因")).toBeVisible();
    expect(
      screen.queryByRole("table", { name: "产情暂不可比指标目录" }),
    ).not.toBeVisible();
    await user.click(screen.getByText("查看 30 项暂不可比指标及原因"));
    const unavailableCatalog = screen.getByRole("table", {
      name: "产情暂不可比指标目录",
    });
    expect(unavailableCatalog).toHaveTextContent("收获面积");
    expect(unavailableCatalog).toHaveTextContent("总产量");
    expect(unavailableCatalog).toHaveTextContent(
      "尚未形成连续四个年度的已核定数据",
    );
    expect(unavailableCatalog).not.toHaveTextContent("production.");
    expect(document.body).not.toHaveTextContent(forbiddenVisibleText);
  });

  it("blocks a production report while the source work is returned and quality-blocked", () => {
    const onComposeReport = vi.fn();
    render(
      <ProductionHarness
        initialCoordinates={{
          businessSubtypeId: "production.planting-production",
          regionId: "qiqihar-nehe",
          productId: "corn",
          cultivarId: "jingke-968",
          periodKey: "2026-W31",
          dataLayer: "official",
          releaseVersion: "METRIC-2026-W31-V3",
        }}
        onComposeReport={onComposeReport}
        section="analysis"
      />,
    );

    const compose = screen.getByRole("button", {
      name: "按当前范围编制报告",
    });
    expect(compose).toBeDisabled();
    expect(screen.getByText(/尚无完全匹配的已核定报告数据/)).toBeVisible();
    expect(onComposeReport).not.toHaveBeenCalled();
  });

  it("composes an aggregate production report from the exact approved metric batch", async () => {
    const user = userEvent.setup();
    const onComposeReport = vi.fn();
    render(
      <ProductionHarness
        initialCoordinates={{
          businessSubtypeId: "production.planting-production",
          regionId: "qiqihar-all",
          productId: "corn",
          periodKey: "2026-W31",
          dataLayer: "official",
          releaseVersion: "METRIC-2026-W31-V3",
        }}
        onComposeReport={onComposeReport}
        section="analysis"
      />,
    );

    const compose = screen.getByRole("button", {
      name: "按当前范围编制报告",
    });
    expect(compose).toBeEnabled();
    await user.click(compose);
    expect(onComposeReport).toHaveBeenCalledWith(
      expect.objectContaining({
        application: "production",
        region: "齐齐哈尔市全域",
        product: "玉米",
        cultivar: "不按具体品种拆分",
        reportTemplate: "种植生产监测报告",
        frequency: "周报",
        dataVersion: "PRODUCTION-2026-W31-APPROVED",
      }),
    );
  });

  it("does not open production report composition without draft-save permission", () => {
    const onComposeReport = vi.fn();
    render(
      <ProductionHarness
        authorization={{ permissionKeys: ["prototype:read"] }}
        initialCoordinates={{
          businessSubtypeId: "production.planting-production",
          regionId: "qiqihar-all",
          productId: "corn",
          periodKey: "2026-W31",
          dataLayer: "official",
          releaseVersion: "METRIC-2026-W31-V3",
        }}
        onComposeReport={onComposeReport}
        section="analysis"
      />,
    );

    expect(
      screen.getByText("当前登录岗位没有编制业务报告的权限。"),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "按当前范围编制报告" }),
    ).toBeDisabled();
    expect(onComposeReport).not.toHaveBeenCalled();
  });

  it("does not compose a production report when the approved dataset is not an exact match", async () => {
    const user = userEvent.setup();
    const onComposeReport = vi.fn();
    render(
      <ProductionHarness
        initialCoordinates={{
          businessSubtypeId: "production.planting-production",
          regionId: "qiqihar-nehe",
          productId: "corn",
          cultivarId: "demeiya-3",
          periodKey: "2026-W31",
          dataLayer: "official",
          releaseVersion: "METRIC-2026-W31-V3",
        }}
        onComposeReport={onComposeReport}
        section="analysis"
      />,
    );

    const compose = screen.getByRole("button", {
      name: "按当前范围编制报告",
    });
    expect(compose).toBeDisabled();
    await user.click(compose);
    expect(onComposeReport).not.toHaveBeenCalled();
    const reason = screen.getByText(/尚无完全匹配的已核定报告数据/);
    expect(reason).toHaveTextContent("系统未改用其他范围");
  });

  it("uses four primary analysis filters and reveals data-governance conditions progressively", async () => {
    const user = userEvent.setup();
    render(
      <ProductionHarness
        initialCoordinates={{
          productId: "corn",
          periodKey: "2026-W31",
          dataLayer: "official",
          releaseVersion: "METRIC-2026-W31-V3",
        }}
        section="analysis"
      />,
    );

    const filters = screen.getByRole("search", {
      name: "产情分析查询条件",
    });
    for (const primaryFilter of [
      "业务分类",
      "业务地区",
      "产品或作物",
      "分析期间",
    ]) {
      expect(
        within(filters).getByRole("combobox", { name: primaryFilter }),
      ).toBeVisible();
    }
    for (const secondaryFilter of ["具体品种", "数据状态", "采用数据"]) {
      expect(
        within(filters).queryByRole("combobox", { name: secondaryFilter }),
      ).not.toBeInTheDocument();
    }
    const moreFilters = within(filters).getByRole("button", {
      name: "更多条件",
    });
    expect(moreFilters).toHaveAttribute("aria-expanded", "false");
    await user.click(moreFilters);
    for (const secondaryFilter of ["具体品种", "数据状态", "采用数据"]) {
      expect(
        within(filters).getByRole("combobox", { name: secondaryFilter }),
      ).toBeVisible();
    }

    const ledgerRegion = screen.getByRole("region", {
      name: "产情四年指标台账区域",
    });
    expect(
      screen.queryByRole("region", { name: "产情分析结果摘要" }),
    ).not.toBeInTheDocument();
    expect(
      filters.compareDocumentPosition(ledgerRegion) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("uses the shared product catalog and only shows cultivars applicable to the product", async () => {
    const user = userEvent.setup();
    render(
      <ProductionHarness
        initialCoordinates={{ productId: "soybean" }}
        section="analysis"
      />,
    );

    const products = screen.getByRole("combobox", { name: "产品或作物" });
    expect(
      within(products).getByRole("option", { name: "小麦" }),
    ).toBeVisible();
    expect(
      within(products).queryByRole("option", { name: "大米" }),
    ).not.toBeInTheDocument();
    expect(
      within(products).queryByRole("option", { name: "产品名称待维护" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "更多条件" }));
    const cultivars = screen.getByRole("combobox", { name: "具体品种" });
    expect(
      within(cultivars).getByRole("option", { name: "黑农84" }),
    ).toBeVisible();
    expect(
      within(cultivars).getByRole("option", { name: "东生22" }),
    ).toBeVisible();
    expect(
      within(cultivars).queryByRole("option", { name: "京科968" }),
    ).not.toBeInTheDocument();
  });

  it("shows an unavailable product explicitly instead of falling back to the all-products view", () => {
    const { unmount } = render(
      <ProductionHarness
        initialCoordinates={{ productId: "unknown-product" }}
        section="objects"
      />,
    );

    expect(screen.getByRole("combobox", { name: "作物" })).toHaveDisplayValue(
      "作物不可用（请重新选择）",
    );
    expect(
      screen.getByRole("region", { name: "产情对象结果摘要" }),
    ).not.toHaveTextContent("全部已授权作物");

    unmount();
    render(
      <ProductionHarness
        initialCoordinates={{ productId: "unknown-product" }}
        section="analysis"
      />,
    );
    expect(
      screen.getByRole("combobox", { name: "产品或作物" }),
    ).toHaveDisplayValue("产品不可用（请重新选择）");
    expect(
      screen.queryByRole("region", { name: "产情分析结果摘要" }),
    ).not.toBeInTheDocument();
  });

  it("returns a governed Chinese error for an invalid task period without fallback", () => {
    render(
      <ProductionHarness
        initialCoordinates={{ periodKey: "2099-W99" }}
        section="tasks"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("任务期间无效");
    expect(
      within(screen.getByRole("table", { name: "产情任务台账" })).queryByText(
        "讷河市玉米长势与测产调查",
      ),
    ).not.toBeInTheDocument();
  });

  it("returns a governed Chinese error for an unavailable task selection without fallback", () => {
    render(
      <ProductionHarness
        initialCoordinates={{ periodKey: "2026-W31" }}
        initialSelection={{ type: "work-item", id: "WORK-UNKNOWN" }}
        section="tasks"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("任务不可用或无权查看");
    expect(document.body).not.toHaveTextContent("WORK-UNKNOWN");
  });

  it("blocks task results when the operational query is not allowed", () => {
    render(
      <ProductionHarness
        initialCoordinates={{ periodKey: "2026-W31" }}
        queryAllowed={false}
        section="tasks"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "当前筛选范围超出您的数据权限",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("业务坐标");
    expect(
      screen.getByRole("table", { name: "产情任务台账" }),
    ).not.toHaveTextContent("讷河市玉米长势与测产调查");
  });

  it("describes an empty production task ledger with filter conditions", () => {
    render(
      <ProductionHarness
        authorization={{
          authorizedProductIds: [],
          authorizedCultivarIds: [],
        }}
        section="tasks"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "当前筛选范围内没有可处理的产情任务，请调整筛选条件后重试",
    );
    expect(screen.getByRole("status")).not.toHaveTextContent("业务坐标");
  });

  it("blocks analysis results when the operational query is not allowed", () => {
    render(
      <ProductionHarness
        initialCoordinates={{
          productId: "corn",
          periodKey: "2026-W31",
          dataLayer: "official",
          releaseVersion: "METRIC-2026-W31-V3",
        }}
        queryAllowed={false}
        section="analysis"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "当前筛选范围超出您的数据权限",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("业务坐标");
    expect(
      screen.getByRole("table", { name: "产情四年指标台账" }),
    ).not.toHaveTextContent("播种面积");
  });

  it("keeps coordinate and version implementation wording out of production task surfaces", () => {
    for (const sourceFile of [
      "src/prototype/production/ProductionTaskWorkspace.tsx",
      "src/prototype/production/ProductionDocumentWorkbench.tsx",
    ]) {
      expect(readFileSync(sourceFile, "utf8")).not.toMatch(
        /业务坐标|已被新版本替代/,
      );
    }
  });
});
