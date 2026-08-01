import { useState } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OperationalScope } from "./core/operationalScope";
import { prototypeOperationalIdentity } from "./formalEnterpriseData";
import type {
  BusinessCoordinates,
  FormalSelection,
  ProductionSection,
} from "./formalEnterpriseModel";
import { ProductionMonitoringWorkspace } from "./ProductionMonitoringWorkspace";

afterEach(cleanup);

function ProductionHarness({
  section,
  initialCoordinates = {},
  initialSelection,
  authorization = {},
  queryAllowed = true,
}: {
  section: ProductionSection;
  initialCoordinates?: Partial<BusinessCoordinates>;
  initialSelection?: FormalSelection;
  authorization?: Partial<OperationalScope["authorization"]>;
  queryAllowed?: boolean;
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
  return (
    <ProductionMonitoringWorkspace
      onComposeReport={vi.fn()}
      onScopeChange={(coordinates) =>
        setScope((current) => ({
          ...current,
          coordinates: { ...current.coordinates, ...coordinates },
        }))
      }
      onSelectionChange={setSelection}
      scope={scope}
      queryAllowed={queryAllowed}
      section={section}
      selection={selection}
    />
  );
}

const forbiddenVisibleText =
  /(?:PROD|WORK|OBJ|RESP|METRIC|DUTY|PUB)-|not-due|in-progress|on-time|overdue-completed|missed|exempt|draft|submitted|returned|corrected|pending|reviewing|approved|passed|warning|blocking|awaiting-explanation|unreleased|published|superseded|current|stale|\d{4}-\d{2}-\d{2}T/;

describe("production monitoring workspace", () => {
  it("renders a period task queue with governed aligned selectors and five independent states", () => {
    render(
      <ProductionHarness
        initialCoordinates={{ periodKey: "2026-W31" }}
        section="tasks"
      />,
    );

    expect(screen.getByRole("heading", { name: "产情任务作业" })).toBeVisible();
    const ledger = screen.getByRole("table", { name: "产情任务台账" });
    expect(ledger).toBeVisible();
    expect(screen.queryByText("产情对象名录")).not.toBeInTheDocument();
    for (const filter of [
      "业务地区",
      "业务分类",
      "产品或作物",
      "具体品种",
      "任务期间",
      "义务状态",
      "单据状态",
      "审核状态",
      "质量状态",
      "发布状态",
    ]) {
      expect(screen.getByRole("combobox", { name: filter })).toBeVisible();
    }
    for (const column of [
      "义务状态",
      "单据状态",
      "审核状态",
      "质量状态",
      "发布状态",
    ]) {
      expect(
        within(ledger).getByRole("columnheader", { name: column }),
      ).toBeVisible();
    }
    expect(document.body).not.toHaveTextContent(forbiddenVisibleText);
  });

  it("opens collection and review lifecycle sections inside the same task document workbench", async () => {
    const user = userEvent.setup();
    render(
      <ProductionHarness
        initialCoordinates={{ periodKey: "2026-W31" }}
        section="tasks"
      />,
    );
    await user.click(screen.getByRole("button", { name: "处理产情单据" }));

    expect(
      screen.getByRole("region", {
        name: "讷河市玉米长势与测产调查单据工作台",
      }),
    ).toBeVisible();
    for (const action of ["在线填报", "Excel批量导入", "授权系统接入"]) {
      expect(screen.getByRole("button", { name: action })).toBeVisible();
    }
    for (const heading of [
      "具体品种",
      "面积与地块位置",
      "长势、生育阶段与灾情",
      "测产、单产与产量",
      "质量与证据",
      "库存、销售、自用与损耗",
      "种植意愿",
      "成本、支持、补贴与保险",
      "采集来源与校验",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeVisible();
    }
    for (const independentField of [
      "监测面积",
      "预计单产",
      "样本平均结果",
      "区域加权估计",
    ]) {
      expect(screen.getByText(independentField)).toBeVisible();
    }
    expect(
      screen.getByRole("heading", { name: "单据与审核流程" }),
    ).toBeVisible();
    expect(screen.getByText("质量检验依据需要补充")).toBeVisible();
    expect(document.body).not.toHaveTextContent(forbiddenVisibleText);
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
    render(<ProductionHarness section="objects" />);

    expect(screen.getByRole("heading", { name: "产情对象名录" })).toBeVisible();
    const registry = screen.getByRole("table", { name: "产情监测对象名录" });
    for (const filter of [
      "对象类型",
      "业务地区",
      "作物",
      "具体品种",
      "来源渠道",
      "有效状态",
    ]) {
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
    expect(registry).toHaveTextContent("调查片区");
    expect(registry).toHaveTextContent("行政村台账");
    expect(registry).not.toHaveTextContent("稻谷");
    expect(
      screen.queryByRole("heading", { name: "当前适用能力" }),
    ).not.toBeInTheDocument();

    await user.click(
      within(registry).getByRole("button", {
        name: "查看讷河市同义镇调查片区",
      }),
    );
    expect(screen.getByRole("heading", { name: "当前适用能力" })).toBeVisible();
    expect(screen.getByText("种植面积调查")).toBeVisible();
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
    expect(screen.getByRole("alert")).toHaveTextContent("请选择已授权行政区划");

    await user.type(
      screen.getByRole("textbox", { name: "对象名称" }),
      "新增测试对象",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "编辑对象类型" }),
      "survey-area",
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
      screen.getByRole("button", { name: "查看讷河市同义镇调查片区" }),
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
    await user.type(name, "讷河市同义镇调查片区草稿");
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

  it("derives editor people and role candidates only from the authorized object projection", async () => {
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
    expect(
      within(people).queryByRole("option", { name: "赵晨" }),
    ).not.toBeInTheDocument();
    expect(
      within(people).queryByRole("option", { name: "孙悦" }),
    ).not.toBeInTheDocument();
    const roles = screen.getByRole("group", { name: "编辑业务角色" });
    expect(
      within(roles).getByRole("checkbox", { name: "产情调查对象" }),
    ).toBeVisible();
    expect(
      within(roles).getByRole("checkbox", { name: "质量调查对象" }),
    ).toBeVisible();
    expect(
      within(roles).queryByRole("checkbox", { name: "专业产情观察" }),
    ).not.toBeInTheDocument();
  });

  it("renders an official four-year metric ledger and charts only after metric selection", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ProductionHarness
        initialCoordinates={{
          businessDomainId: "production",
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
      screen.getByRole("table", { name: "产情四年指标台账" }),
    ).toBeVisible();
    expect(container.querySelectorAll("svg")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "分析播种面积" }));
    expect(container.querySelectorAll("svg")).toHaveLength(2);
    expect(
      screen.getAllByText("2026年第31周正式指标第3版").length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "来源与口径" })).toBeVisible();
    expect(document.body).not.toHaveTextContent(forbiddenVisibleText);
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
    expect(screen.getByRole("alert")).toHaveTextContent("当前业务坐标无权查询");
    expect(
      screen.getByRole("table", { name: "产情任务台账" }),
    ).not.toHaveTextContent("讷河市玉米长势与测产调查");
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
    expect(screen.getByRole("alert")).toHaveTextContent("当前业务坐标无权查询");
    expect(
      screen.getByRole("table", { name: "产情四年指标台账" }),
    ).not.toHaveTextContent("播种面积");
  });
});
