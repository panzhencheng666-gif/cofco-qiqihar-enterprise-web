import { readFileSync } from "node:fs";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BusinessClassification } from "./core/businessClassification";
import type { OperationalScope } from "./core/operationalScope";
import {
  BusinessContextBar,
  CollectionModeSwitch,
  FormalWorkspaceScopeProvider,
  WorkspaceFilterBar,
  WorkspaceInlineStats,
  WorkspacePagination,
  WorkspaceSummaryStrip,
  WorkspaceStatus,
  WorkspaceScopeBar,
  WorkspaceRegionSelect,
  WorkspaceTableToolbar,
  WorkspaceTabs,
} from "./UnifiedWorkspacePrimitives";

afterEach(cleanup);

describe("unified workspace primitives", () => {
  it("adapts operational region selection to authorized city and county levels", async () => {
    const user = userEvent.setup();
    const onScopeChange = vi.fn();
    const scope: OperationalScope = {
      workUnit: {
        organizationId: "qiqihar-operation",
        unitId: "operation-hq",
        label: "齐齐哈尔经营部",
      },
      identity: { userId: "user-1", postId: "post-1" },
      authorization: {
        authorizedRegionIds: ["qiqihar-nehe"],
        authorizedBusinessClassificationIds: [],
        authorizedProductIds: [],
        authorizedCultivarIds: [],
        authorizedReleaseVersionIds: [],
        permissionKeys: [],
      },
      coordinates: { regionId: "qiqihar-all" },
      savedView: null,
    };

    render(
      <FormalWorkspaceScopeProvider
        classificationOptions={[]}
        onScopeChange={onScopeChange}
        scope={scope}
      >
        <WorkspaceRegionSelect />
      </FormalWorkspaceScopeProvider>,
    );

    const regionGroup = screen.getByRole("group", { name: "业务地区" });
    expect(within(regionGroup).getByLabelText("选择地区")).toHaveTextContent(
      "齐齐哈尔市",
    );
    expect(regionGroup).not.toHaveTextContent("全部已授权范围");
    expect(regionGroup).not.toHaveTextContent("黑河市");

    await user.click(within(regionGroup).getByLabelText("选择地区"));
    await user.click(
      within(screen.getByLabelText("区县选项")).getByRole("button", {
        name: "讷河市",
      }),
    );
    expect(onScopeChange).toHaveBeenCalledWith({ regionId: "qiqihar-nehe" });
  });

  it("renders operational scope without a generic responsibility status", () => {
    render(
      <WorkspaceScopeBar
        items={[
          ["范围", "已授权范围"],
          ["期间", "当前期间"],
        ]}
      />,
    );

    expect(
      screen.getByRole("region", { name: "工作区范围" }),
    ).toHaveTextContent("范围已授权范围期间当前期间");
    expect(screen.queryByText("当前状态")).not.toBeInTheDocument();
  });

  it("renders only explicitly supplied read-only business summaries inside a formal scope", () => {
    const internalClassificationId =
      "BUILD_2026_INTERNAL" as BusinessClassification["id"];
    const scope: OperationalScope = {
      workUnit: {
        organizationId: "organization-internal",
        unitId: "unit-internal",
        label: "齐齐哈尔经营部",
      },
      identity: { userId: "user-internal", postId: "post-internal" },
      authorization: {
        authorizedRegionIds: ["qiqihar-nehe"],
        authorizedBusinessClassificationIds: [internalClassificationId],
        authorizedProductIds: ["corn"],
        authorizedCultivarIds: [],
        authorizedReleaseVersionIds: [],
        permissionKeys: [],
      },
      coordinates: {
        regionId: "qiqihar-nehe",
        businessSubtypeId: internalClassificationId,
        productId: "corn",
        periodKey: "2026-W31",
      },
      savedView: null,
    };
    const { container } = render(
      <FormalWorkspaceScopeProvider
        scope={scope}
        onScopeChange={vi.fn()}
        classificationOptions={[
          {
            id: internalClassificationId,
            domain: "market",
            label: "报价与交易",
            productDimension: "commodity",
            taskEnabled: true,
            analysisEnabled: true,
            reportEnabled: true,
          },
        ]}
      >
        <WorkspaceScopeBar
          items={[
            ["业务范围", "全部已授权范围"],
            ["数据状态", "正式数据"],
          ]}
        />
      </FormalWorkspaceScopeProvider>,
    );

    const scopeBar = screen.getByRole("region", { name: "工作区范围" });
    expect(scopeBar).toHaveTextContent("业务范围全部已授权范围");
    expect(scopeBar).toHaveTextContent("数据状态正式数据");
    expect(container.querySelector("input, select")).toBeNull();
    expect(document.body).not.toHaveTextContent(
      /BUILD_2026_INTERNAL|corn|2026-W31/,
    );
  });

  it("renders one compact business context coordinate", () => {
    render(
      <BusinessContextBar
        items={[
          ["组织", "齐齐哈尔经营部"],
          ["地区", "齐齐哈尔指定范围"],
          ["期间", "2026 年第 31 周"],
        ]}
        state="本期采集中"
      />,
    );

    expect(screen.getByText("齐齐哈尔经营部")).toBeVisible();
    expect(screen.getByText("齐齐哈尔指定范围")).toBeVisible();
    expect(screen.getByText("2026 年第 31 周")).toBeVisible();
    expect(screen.getByText("本期采集中")).toBeVisible();
  });

  it("keeps status dimensions explicit", () => {
    render(
      <div>
        <WorkspaceStatus tone="warning">质量警告</WorkspaceStatus>
        <WorkspaceStatus tone="danger">截止未提交</WorkspaceStatus>
        <WorkspaceStatus tone="good">已发布</WorkspaceStatus>
      </div>,
    );

    expect(screen.getByText("质量警告")).toHaveClass("is-warning");
    expect(screen.getByText("截止未提交")).toHaveClass("is-danger");
    expect(screen.getByText("已发布")).toHaveClass("is-good");
  });

  it("switches collection mode without creating another workflow", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CollectionModeSwitch mode="online" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "在线填报" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "电子表格批量导入" }));
    expect(onChange).toHaveBeenCalledWith("excel");
  });

  it("renders one continuous table workbench sequence", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(
      <>
        <WorkspaceTabs
          active="current"
          label="任务状态"
          tabs={[
            { key: "current", label: "本期报送" },
            { key: "overdue", label: "逾期记录" },
          ]}
          onChange={onTabChange}
        />
        <WorkspaceFilterBar
          actions={<button type="button">查询</button>}
          label="任务筛选"
        >
          <label>
            地区
            <select aria-label="地区">
              <option>齐齐哈尔市</option>
            </select>
          </label>
        </WorkspaceFilterBar>
        <WorkspaceSummaryStrip
          items={[
            { label: "应报", value: "428" },
            { label: "逾期", value: "6", tone: "danger" },
          ]}
        />
        <WorkspaceTableToolbar title="报送任务清单" />
      </>,
    );

    await user.click(screen.getByRole("tab", { name: "逾期记录" }));
    expect(onTabChange).toHaveBeenCalledWith("overdue");
    expect(screen.getByRole("region", { name: "任务筛选" })).toBeVisible();
    expect(screen.getByLabelText("业务状态摘要")).toHaveTextContent("应报428");
    expect(screen.getByRole("toolbar", { name: "报送任务清单" })).toBeVisible();
  });

  it("changes table pages through explicit previous and next actions", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <WorkspacePagination
        end={3}
        onPageChange={onPageChange}
        page={1}
        pages={2}
        start={1}
        total={4}
      />,
    );

    expect(screen.getByText("共 4 条 · 当前 1–3")).toBeVisible();
    expect(screen.getByRole("button", { name: "上一页" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "下一页" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("supports a dedicated class for a consistent report filter surface", () => {
    render(
      <WorkspaceFilterBar
        className="report-workspace-filter"
        label="报告生成条件"
      >
        <fieldset className="report-filter-group">
          <legend>报告范围</legend>
          <label>
            地区
            <select aria-label="报告地区">
              <option>齐齐哈尔市全域</option>
            </select>
          </label>
        </fieldset>
      </WorkspaceFilterBar>,
    );

    expect(screen.getByRole("region", { name: "报告生成条件" })).toHaveClass(
      "report-workspace-filter",
    );
    expect(screen.getByRole("group", { name: "报告范围" })).toBeVisible();
    const css = readFileSync("src/prototype/unified-workspaces.css", "utf8");
    expect(css).toMatch(
      /\.report-filter-group\s*>\s*label\s*\{[^}]*font-size:\s*12px/s,
    );
    expect(css).toMatch(
      /\.report-workspace-filter\s+\.workspace-filter-fields\s+(?:input,\s*)?\.report-workspace-filter\s+\.workspace-filter-fields\s+select\s*\{[^}]*min-height:\s*36px[^}]*font-size:\s*13px/s,
    );
  });

  it("uses one enterprise density contract for filters and business ledgers", () => {
    const formalCss = readFileSync(
      "src/prototype/formal-enterprise.css",
      "utf8",
    );
    const unifiedCss = readFileSync(
      "src/prototype/unified-workspaces.css",
      "utf8",
    );
    const marketCss = readFileSync(
      "src/prototype/market-monitoring.css",
      "utf8",
    );

    for (const declaration of [
      "--enterprise-density-label-size: 12px",
      "--enterprise-density-body-size: 12px",
      "--enterprise-density-control-size: 13px",
      "--enterprise-density-control-height: 36px",
      "--enterprise-density-ledger-row-height: 42px",
    ]) {
      expect(formalCss).toContain(declaration);
    }

    const extractDensityContract = (css: string) => {
      const start = css.indexOf("/* enterprise-density-contract:start */");
      const end = css.indexOf("/* enterprise-density-contract:end */");

      expect(start).toBeGreaterThan(-1);
      expect(end).toBeGreaterThan(start);
      return css.slice(start, end);
    };
    const unifiedContract = extractDensityContract(unifiedCss);
    const marketContract = extractDensityContract(marketCss);

    for (const contract of [unifiedContract, marketContract]) {
      expect(contract).toContain("var(--enterprise-density-label-size)");
      expect(contract).toContain("var(--enterprise-density-body-size)");
      expect(contract).toContain("var(--enterprise-density-control-size)");
      expect(contract).toContain("var(--enterprise-density-control-height)");
      expect(contract).toContain("var(--enterprise-density-ledger-row-height)");
      expect(contract).not.toMatch(/font-size:\s*(?:9|10|11)px/);
    }

    expect(unifiedContract).toContain(
      ".production-task5-availability-scroll table",
    );
    expect(marketContract).toContain(".market-task6-availability-scroll table");
    expect(unifiedContract).toMatch(
      /:is\([\s\S]*?\.production-task5-ledger[\s\S]*?\)\s+:is\(th, td\)\s+\*/s,
    );
    expect(marketContract).toMatch(
      /:is\([\s\S]*?\.market-task6-ledger[\s\S]*?\)\s+:is\(th, td\)\s+\*/s,
    );

    expect(unifiedCss).toMatch(
      /\.unified-table-scroll\s*,[\s\S]*?\.executive-ledger-scroll\s*,[\s\S]*?\{[^}]*overflow-x:\s*auto/s,
    );
    expect(marketCss).toMatch(
      /\.market-task6-ledger-scroll\s*,[\s\S]*?\.market-table-scroll\s*,[\s\S]*?\{[^}]*overflow-x:\s*auto/s,
    );
  });

  it("keeps ledger query controls on one shared responsive width contract", () => {
    const css = readFileSync("src/prototype/unified-workspaces.css", "utf8");

    expect(css).toContain("--enterprise-query-control-width: 188px");
    expect(css).toContain("--enterprise-query-region-width: 220px");
    expect(css).toMatch(
      /\.enterprise-ledger-query input\[type="date"\]\s*\{[^}]*padding-inline-end:\s*10px/s,
    );
    expect(css).toMatch(
      /\.enterprise-ledger-query__actions\s*\{[^}]*margin-inline-start:\s*auto/s,
    );
    expect(css).not.toMatch(
      /\.enterprise-ledger-query--production\s*\{[^}]*170px 280px/s,
    );
  });

  it("keeps shell navigation and visible workspace guidance at a readable enterprise size", () => {
    const formalCss = readFileSync(
      "src/prototype/formal-enterprise.css",
      "utf8",
    );
    const unifiedCss = readFileSync(
      "src/prototype/unified-workspaces.css",
      "utf8",
    );

    const extractReadabilityContract = (css: string) => {
      const start = css.indexOf("/* enterprise-readability-contract:start */");
      const end = css.indexOf("/* enterprise-readability-contract:end */");

      expect(start).toBeGreaterThan(-1);
      expect(end).toBeGreaterThan(start);
      return css.slice(start, end);
    };
    const shellContract = extractReadabilityContract(formalCss);
    const workspaceContract = extractReadabilityContract(unifiedCss);

    expect(shellContract).toContain(".formal-application-nav > button");
    expect(shellContract).toContain(".formal-nav-group > span");
    expect(shellContract).toContain(".formal-global-search input");
    expect(shellContract).toContain(".formal-report-composer__context small");
    expect(shellContract).toContain(".formal-report-indicators span");
    expect(shellContract).toContain(".formal-report-chapters section p");
    expect(shellContract).toContain(
      "min-height: var(--enterprise-density-control-height)",
    );
    expect(workspaceContract).toContain(".workspace-pagination");
    expect(workspaceContract).toContain(".workspace-table-toolbar > span");
    expect(workspaceContract).toContain(".report-workspace-note");
    expect(workspaceContract).toContain(".market-task6-ledger-actions button");

    for (const contract of [shellContract, workspaceContract]) {
      expect(contract).toContain("var(--enterprise-density-body-size)");
      expect(contract).not.toMatch(/font-size:\s*(?:9|10|11)px/);
      expect(contract).not.toMatch(/(?:height|min-height):\s*28px/);
    }
  });

  it("wraps inline statistics instead of giving them a horizontal scrollbar", () => {
    render(
      <WorkspaceInlineStats
        items={[{ label: "报告总数", value: "4 份", note: "全部报告" }]}
      />,
    );
    const css = readFileSync("src/prototype/unified-workspaces.css", "utf8");

    expect(screen.getByLabelText("业务状态统计")).toBeVisible();
    expect(css).toMatch(
      /\.workspace-inline-stats\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,[^}]*overflow:\s*visible/s,
    );
    expect(css).not.toMatch(
      /\.workspace-inline-stats\s*\{[^}]*overflow:\s*auto hidden/s,
    );
  });
});
