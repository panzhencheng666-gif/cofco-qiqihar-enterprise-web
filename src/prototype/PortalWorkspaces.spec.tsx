import { readFileSync } from "node:fs";

import { useState } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExecutiveOverviewWorkspace } from "./ExecutiveOverviewWorkspace";
import { MyWorkWorkspace } from "./MyWorkWorkspace";
import type { OperationalScope } from "./core/operationalScope";
import { businessWorkFixtures } from "./data/businessWorkFixtures";
import type {
  BusinessCoordinates,
  FormalRoute,
  FormalSelection,
  OverviewSection,
} from "./formalEnterpriseModel";
import { prototypeOperationalIdentity } from "./formalEnterpriseData";

afterEach(cleanup);

function ExecutiveHarness({
  initialSection = "operations",
  initialCoordinates = {},
  authorization = {},
  onCoordinateChange = vi.fn(),
  onRouteChange = vi.fn(),
}: {
  initialSection?: OverviewSection;
  initialCoordinates?: Partial<OperationalScope["coordinates"]>;
  authorization?: Partial<OperationalScope["authorization"]>;
  onCoordinateChange?: (coordinates: Partial<BusinessCoordinates>) => void;
  onRouteChange?: (route: FormalRoute) => void;
}) {
  const [section, setSection] = useState<OverviewSection>(initialSection);
  const [scope, setScope] = useState<OperationalScope>({
    ...prototypeOperationalIdentity,
    authorization: {
      ...prototypeOperationalIdentity.authorization,
      ...authorization,
    },
    coordinates: {
      regionId: "authorized-all",
      periodKey: "2026-W31",
      ...initialCoordinates,
    },
    savedView: null,
  });
  return (
    <ExecutiveOverviewWorkspace
      section={section}
      scope={scope}
      onScopeChange={(coordinates) => {
        onCoordinateChange(coordinates);
        setScope((current) => ({
          ...current,
          coordinates: { ...current.coordinates, ...coordinates },
        }));
      }}
      onOpenRoute={(route) => {
        onRouteChange(route);
        if (route.application === "overview") setSection(route.section);
      }}
    />
  );
}

function MyWorkHarness({
  initialCoordinates = {},
  authorization = {},
  identity = prototypeOperationalIdentity.identity,
  onCoordinateChange = vi.fn(),
  onOpenBusiness = vi.fn(),
}: {
  initialCoordinates?: Partial<OperationalScope["coordinates"]>;
  authorization?: Partial<OperationalScope["authorization"]>;
  identity?: OperationalScope["identity"];
  onCoordinateChange?: (coordinates: Partial<BusinessCoordinates>) => void;
  onOpenBusiness?: (route: FormalRoute, selection?: FormalSelection) => void;
}) {
  const [scope, setScope] = useState<OperationalScope>({
    ...prototypeOperationalIdentity,
    identity,
    authorization: {
      ...prototypeOperationalIdentity.authorization,
      ...authorization,
    },
    coordinates: {
      regionId: "authorized-all",
      ...initialCoordinates,
    },
    savedView: null,
  });
  return (
    <MyWorkWorkspace
      section="tasks"
      scope={scope}
      onScopeChange={(coordinates) => {
        onCoordinateChange(coordinates);
        setScope((current) => ({
          ...current,
          coordinates: { ...current.coordinates, ...coordinates },
        }));
      }}
      onOpenBusiness={onOpenBusiness}
    />
  );
}

describe("enterprise portal workspaces", () => {
  it("keeps the executive ledger dense, horizontally operable, and keyboard visible", () => {
    const css = readFileSync("src/prototype/unified-workspaces.css", "utf8");
    const marker = css.slice(
      css.indexOf("/* enterprise-executive-ledger:start */"),
    );

    expect(marker).toContain("/* enterprise-executive-ledger:end */");
    expect(marker).toMatch(
      /\.executive-ledger-scroll\s*\{[^}]*overflow-x:\s*auto/s,
    );
    expect(marker).toMatch(
      /\.executive-ledger-table--operations\s*\{[^}]*min-width:\s*1780px/s,
    );
    expect(marker).toMatch(
      /\.executive-ledger-table__indicator\s*\{[^}]*position:\s*sticky/s,
    );
    expect(marker).toMatch(
      /\.executive-ledger-select:focus-visible\s*\{[^}]*outline:\s*3px/s,
    );
    expect(marker).toMatch(/@media \(max-width:\s*1024px\)/);
    expect(marker).not.toMatch(/font-size:\s*9px/);
    expect(marker).not.toContain("#6f8795");
  });

  it("projects the same governed production work item into My Work and its owning route", async () => {
    const user = userEvent.setup();
    const onOpenBusiness = vi.fn();
    render(<MyWorkHarness onOpenBusiness={onOpenBusiness} />);
    const source = businessWorkFixtures.find(
      ({ domain }) => domain === "production",
    );
    expect(source).toBeDefined();
    expect(source!.subject.kind).toBe("monitoring-object");
    const row = screen.getByRole("row", { name: new RegExp(source!.title) });

    expect(row).toHaveTextContent(
      source!.subject.kind === "monitoring-object"
        ? source!.subject.objectName
        : "监测对象名称待维护",
    );
    expect(row).toHaveTextContent("2026年7月31日 17:00");
    expect(row).toHaveTextContent(
      `${source!.responsiblePerson} · ${source!.responsiblePost}`,
    );
    for (const state of [
      "进行中",
      "已退回",
      "审核退回",
      "质量阻断",
      "未发布",
    ]) {
      expect(row).toHaveTextContent(state);
    }

    await user.click(within(row).getByRole("button", { name: "处理产情单据" }));
    expect(onOpenBusiness).toHaveBeenCalledWith(
      { application: "production", section: "tasks" },
      { type: "work-item", id: source!.workId },
    );
    expect(document.body).not.toHaveTextContent(
      /WORK-|OBJ-|RESP-|SUBMISSION-|REVIEW-|QUALITY-|RELEASE-|in-progress|returned|blocking|unreleased|T\d{2}:/,
    );
  });

  it("renders an authorized-all ledger with explicit filters instead of a card wall", () => {
    const { container } = render(<ExecutiveHarness />);

    expect(screen.getByRole("combobox", { name: "业务地区" })).toHaveValue(
      "authorized-all",
    );
    expect(screen.getByRole("tab", { name: "经营态势" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "异常风险" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "履责监督" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "发布成果" })).toBeVisible();
    expect(
      screen.getByRole("table", { name: "经营指标趋势台账" }),
    ).toBeVisible();
    for (const label of [
      "业务域",
      "业务分类",
      "地区层级",
      "业务地区",
      "产品或作物",
      "具体品种",
      "经营期间",
      "数据层",
      "指标数据版本",
      "风险状态",
    ]) {
      expect(screen.getByRole("combobox", { name: label })).toBeVisible();
    }
    const ledger = screen.getByRole("table", { name: "经营指标趋势台账" });
    expect(
      within(ledger).getByRole("columnheader", { name: "指标数据版本" }),
    ).toBeVisible();
    expect(ledger).toHaveTextContent("2026年第31周正式指标第3版");
    expect(ledger).toHaveTextContent("质量校验通过");
    expect(ledger).toHaveTextContent("存在质量提醒");
    expect(ledger).not.toHaveTextContent(/METRIC|passed|warning/);
    for (const domain of ["产情监测", "市场监测", "供需核算", "经营履责"]) {
      expect(within(ledger).getAllByText(domain).length).toBeGreaterThan(0);
    }
    expect(screen.getByLabelText("已应用业务坐标")).toHaveTextContent(
      "授权汇总 · 全部已授权范围",
    );
    expect(screen.getByLabelText("已应用业务坐标")).toHaveTextContent(
      "全部已授权版本 · 全部风险状态",
    );
    expect(screen.queryByLabelText("经营核心摘要")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".workspace-inline-stats")).toHaveLength(
      0,
    );
    expect(container.querySelector(".unified-context-state")).toBeNull();
    expect(container.querySelector(".executive-card-grid")).toBeNull();
  });

  it("never exposes an unmapped internal product or version code as visible text", () => {
    const internalProductCode = "INTERNAL-PRODUCT-42";
    const internalVersionCode = "INTERNAL-VERSION-42";
    render(
      <ExecutiveHarness
        authorization={{
          authorizedProductIds: [
            ...prototypeOperationalIdentity.authorization.authorizedProductIds,
            internalProductCode,
          ],
          authorizedReleaseVersionIds: [
            ...prototypeOperationalIdentity.authorization
              .authorizedReleaseVersionIds,
            internalVersionCode,
          ],
        }}
        initialCoordinates={{
          productId: internalProductCode,
          releaseVersion: internalVersionCode,
        }}
      />,
    );

    expect(
      screen.getByRole("option", { name: "产品名称待维护" }),
    ).toBeVisible();
    expect(
      screen.getByRole("option", { name: "数据版本名称待维护" }),
    ).toBeVisible();
    expect(document.body).not.toHaveTextContent(
      /INTERNAL-PRODUCT-42|INTERNAL-VERSION-42/,
    );
  });

  it("opens exactly one selected metric track, two charts, and its lineage detail", async () => {
    const user = userEvent.setup();
    const onCoordinateChange = vi.fn();
    const { container } = render(
      <ExecutiveHarness onCoordinateChange={onCoordinateChange} />,
    );

    expect(container.querySelectorAll("svg")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "分析播种面积" }));

    expect(onCoordinateChange).toHaveBeenCalledWith({
      selectedMetricId: "production.planted-area",
    });
    expect(
      screen.getByRole("button", { name: /播种面积四年比较/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(container.querySelectorAll("svg")).toHaveLength(2);
    expect(
      screen.getByRole("complementary", { name: "指标口径与来源" }),
    ).toHaveTextContent("2026年第31周正式指标第3版");
    expect(
      screen.getByRole("complementary", { name: "指标口径与来源" }),
    ).toHaveTextContent("播种面积指标定义第1版");
    expect(
      screen.getByRole("complementary", { name: "指标口径与来源" }),
    ).toHaveTextContent("跨年度可比规则第1版");
    expect(screen.getByLabelText("播种面积选中指标分析")).not.toHaveTextContent(
      /METRIC|metric-|definition|comparability|passed/,
    );
  });

  it("keeps domain and cascading region-level filters URL-owned without fallback", async () => {
    const user = userEvent.setup();
    const onCoordinateChange = vi.fn();
    render(<ExecutiveHarness onCoordinateChange={onCoordinateChange} />);

    expect(screen.getByRole("button", { name: "分析播种面积" })).toBeVisible();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "业务域" }),
      "market",
    );
    expect(onCoordinateChange).toHaveBeenCalledWith(
      expect.objectContaining({ businessDomainId: "market" }),
    );
    expect(
      screen.queryByRole("button", { name: "分析播种面积" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "分析采购价" })).toBeVisible();

    const level = screen.getByRole("combobox", { name: "地区层级" });
    expect(
      within(level)
        .getAllByRole("option")
        .map(({ textContent }) => textContent),
    ).toEqual(["授权汇总", "市域", "区县"]);
    await user.selectOptions(level, "county");
    expect(onCoordinateChange).toHaveBeenCalledWith(
      expect.objectContaining({
        regionLevel: "county",
        regionId: "qiqihar-nehe",
      }),
    );
    expect(screen.getByRole("combobox", { name: "业务地区" })).toHaveValue(
      "qiqihar-nehe",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "当前业务坐标没有可用经营指标",
    );
  });

  it("presents My Work as one authorized four-domain ledger with governed filters", async () => {
    const user = userEvent.setup();
    const onCoordinateChange = vi.fn();
    const { container } = render(
      <MyWorkHarness onCoordinateChange={onCoordinateChange} />,
    );

    const ledger = screen.getByRole("table", { name: "本人工作台账" });
    expect(container.querySelectorAll("table")).toHaveLength(1);
    for (const label of [
      "业务域",
      "业务分类",
      "业务地区",
      "产品或作物",
      "任务期间",
    ]) {
      expect(screen.getByRole("combobox", { name: label })).toBeVisible();
    }
    expect(screen.getByRole("combobox", { name: "业务地区" })).toHaveValue(
      "authorized-all",
    );
    expect(screen.getByRole("combobox", { name: "任务期间" })).toHaveValue("");
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
    for (const domain of ["产情监测", "市场监测", "供需核算", "报告中心"]) {
      expect(within(ledger).getByText(domain)).toBeVisible();
    }
    for (const view of ["待填报", "待审核", "异常逾期", "待发布", "已办"]) {
      expect(
        screen.getByRole("tab", { name: new RegExp(`^${view}`) }),
      ).toBeVisible();
    }
    expect(screen.queryByText("责任岗位有效")).not.toBeInTheDocument();
    expect(screen.queryByText("今日重点事项")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("本人工作摘要")).not.toBeInTheDocument();
    expect(container.querySelector(".workspace-inline-stats")).toBeNull();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "业务域" }),
      "market",
    );
    expect(onCoordinateChange).toHaveBeenLastCalledWith({
      businessDomainId: "market",
      businessSubtypeId: undefined,
    });
    expect(within(ledger).getByText("市场监测")).toBeVisible();
    expect(within(ledger).queryByText("产情监测")).not.toBeInTheDocument();
  });

  it("shows a governed empty state for unauthorized My Work coordinates without fallback", () => {
    render(
      <MyWorkHarness
        initialCoordinates={{ businessSubtypeId: "unauthorized-work-type" }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("当前业务坐标无权查询");
    expect(
      screen.getByRole("combobox", { name: "业务分类" }),
    ).toHaveDisplayValue("业务分类无效（请重新选择）");
    expect(
      screen.queryByRole("row", { name: /讷河市玉米长势/ }),
    ).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("unauthorized-work-type");
  });

  it("resolves a reviewer-only governed identity without defaulting to another person", () => {
    render(
      <MyWorkHarness
        identity={{ userId: "zhao-chen", postId: "business-reviewer" }}
      />,
    );

    const identity = screen.getByRole("region", { name: "当前责任身份" });
    expect(identity).toHaveTextContent("赵晨");
    expect(identity).toHaveTextContent("业务审核岗");
    const ledger = screen.getByRole("table", { name: "本人工作台账" });
    expect(ledger).toHaveTextContent("讷河市玉米长势与测产调查");
    expect(ledger).toHaveTextContent("齐齐哈尔市玉米市场运行周填报");
    expect(ledger).not.toHaveTextContent("2026 年玉米供需差额说明复核");
    expect(ledger).not.toHaveTextContent("第 31 周粮食商情报告审核与分发");
  });

  it("does not infer a person when the identity has no governed assignment", () => {
    render(
      <MyWorkHarness
        identity={{ userId: "wang-yang-copy", postId: "business-reviewer" }}
      />,
    );

    const identity = screen.getByRole("region", { name: "当前责任身份" });
    expect(identity).toHaveTextContent("人员姓名待维护");
    expect(identity).toHaveTextContent("岗位名称待维护");
    expect(
      screen.getByRole("table", { name: "本人工作台账" }),
    ).not.toHaveTextContent(
      /讷河市玉米长势与测产调查|齐齐哈尔市玉米市场运行周填报/,
    );
  });

  it("keeps the Task 5 My Work ledger responsive, internally scrollable, and keyboard visible", () => {
    const css = readFileSync("src/prototype/unified-workspaces.css", "utf8");
    const start = css.indexOf("/* enterprise-task5-my-work:start */");
    const end = css.indexOf("/* enterprise-task5-my-work:end */");
    const marker = css.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(marker).toMatch(
      /\.my-work-task5-ledger-scroll\s*\{[^}]*overflow-x:\s*auto/s,
    );
    expect(marker).toMatch(
      /\.my-work-task5-sticky\s*\{[^}]*position:\s*sticky/s,
    );
    expect(marker).toMatch(
      /\.my-work-task5-filter-grid[^}]*grid-template-columns:\s*repeat\(5,/s,
    );
    expect(marker).toMatch(/@media \(max-width:\s*1280px\)/);
    expect(marker).toMatch(/@media \(max-width:\s*1024px\)/);
    expect(marker).toMatch(/:focus-visible\s*\{[^}]*outline:/s);
    expect(marker).not.toMatch(/font-size:\s*9px/);
  });

  it("styles every Task 5 production job as an aligned responsive work surface", () => {
    const css = readFileSync("src/prototype/unified-workspaces.css", "utf8");
    const start = css.indexOf("/* enterprise-task5-production:start */");
    const end = css.indexOf("/* enterprise-task5-production:end */");
    const marker = css.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(marker).toMatch(
      /\.production-task5-workspace\s*\{[^}]*overflow-x:\s*clip/s,
    );
    expect(marker).toMatch(
      /\.production-task5-filter-grid\s*\{[^}]*grid-template-columns:\s*repeat\(5,/s,
    );
    expect(marker).toMatch(
      /\.production-task5-ledger-scroll\s*\{[^}]*overflow-x:\s*auto/s,
    );
    expect(marker).toMatch(
      /\.production-task5-sticky\s*\{[^}]*position:\s*sticky/s,
    );
    expect(marker).toMatch(
      /\.production-task5-lifecycle-states\s*\{[^}]*grid-template-columns:\s*repeat\(5,/s,
    );
    for (const selector of [
      ".production-task5-object-detail",
      ".production-task5-document",
      ".production-task5-selected-analysis",
      ".production-task5-lineage",
    ]) {
      expect(marker).toContain(selector);
    }
    expect(marker).toMatch(/@media \(max-width:\s*1280px\)/);
    expect(marker).toMatch(/@media \(max-width:\s*1024px\)/);
    expect(marker).toMatch(/:focus-visible\s*\{[^}]*outline:/s);
    expect(marker).not.toMatch(/font-size:\s*9px/);
  });

  it("removes the legacy hard-coded My Work structures", () => {
    const source = readFileSync("src/prototype/MyWorkWorkspace.tsx", "utf8");
    expect(source).not.toMatch(
      /personalTasks|BusinessContextBar|WorkspaceScopeBar|WorkspaceInlineStats|今日重点事项/,
    );
  });

  it("routes among four materially different executive ledgers", async () => {
    const user = userEvent.setup();
    const onRouteChange = vi.fn();
    render(<ExecutiveHarness onRouteChange={onRouteChange} />);

    await user.click(screen.getByRole("tab", { name: "异常风险" }));
    expect(onRouteChange).toHaveBeenLastCalledWith({
      application: "overview",
      section: "risks",
    });
    const risks = screen.getByRole("table", { name: "经营异常风险台账" });
    expect(
      within(risks).getByRole("columnheader", { name: "风险事项" }),
    ).toBeVisible();
    expect(within(risks).getByText("待解释")).toHaveAttribute(
      "data-risk-state",
      "warning",
    );
    expect(within(risks).getByText("待解释")).toHaveClass("is-warning");
    expect(risks).toHaveTextContent("2026年第31周正式指标第3版");
    expect(risks).not.toHaveTextContent(/METRIC|T17:/);
    await user.click(
      within(risks).getAllByRole("button", {
        name: "进入处置工作区",
      })[0],
    );
    expect(onRouteChange).toHaveBeenLastCalledWith({
      application: "market",
      section: "tasks",
    });
    expect(
      screen.queryByRole("table", { name: "经营指标趋势台账" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "履责监督" }));
    const duty = screen.getByRole("table", { name: "经营履责监督台账" });
    expect(
      within(duty).getByRole("columnheader", { name: "责任岗位" }),
    ).toBeVisible();
    expect(
      within(duty).getByRole("columnheader", { name: "履责事项" }),
    ).toBeVisible();
    expect(
      within(duty).getByRole("columnheader", { name: "月度按时率" }),
    ).toBeVisible();
    expect(duty).toHaveTextContent("2026年第31周履责台账第1版");
    expect(duty).not.toHaveTextContent(/DUTY-|T17:|resp-/);

    await user.click(screen.getByRole("tab", { name: "发布成果" }));
    const releases = screen.getByRole("table", { name: "经营发布成果台账" });
    expect(
      within(releases).getByRole("columnheader", { name: "成果发布版本" }),
    ).toBeVisible();
    expect(
      within(releases).getByRole("columnheader", { name: "替代关系" }),
    ).toBeVisible();
    expect(
      within(releases).getByRole("columnheader", { name: "来源业务域" }),
    ).toBeVisible();
    expect(
      within(releases).getByRole("columnheader", { name: "来源业务分类" }),
    ).toBeVisible();
    expect(
      within(releases).getByRole("columnheader", { name: "成果发布版本" }),
    ).toBeVisible();
    expect(
      within(releases).getByRole("columnheader", { name: "采用数据批次" }),
    ).toBeVisible();
    expect(
      within(releases).getByRole("columnheader", { name: "上游指标版本" }),
    ).toBeVisible();
    expect(releases).toHaveTextContent("2026年7月31日市场日报第1版");
    expect(releases).toHaveTextContent("已由 2026年7月供需分析月报第2版 替代");
    expect(releases).not.toHaveTextContent(/PUB-|METRIC|T17:/);
  });

  it("renders an authorized blocking risk from its typed state", () => {
    render(
      <ExecutiveHarness
        authorization={{
          authorizedBusinessClassificationIds: [
            ...prototypeOperationalIdentity.authorization
              .authorizedBusinessClassificationIds,
            "production.quality-survey",
          ],
          authorizedProductIds: [
            ...prototypeOperationalIdentity.authorization.authorizedProductIds,
            "rice",
          ],
        }}
        initialCoordinates={{ riskState: "blocking" }}
        initialSection="risks"
      />,
    );

    const state = within(
      screen.getByRole("table", { name: "经营异常风险台账" }),
    ).getByText("阻断");
    expect(state).toHaveAttribute("data-risk-state", "blocking");
    expect(state).toHaveClass("is-danger");
  });
});
