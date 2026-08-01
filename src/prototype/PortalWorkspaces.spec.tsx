import { readFileSync } from "node:fs";

import { useState } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExecutiveOverviewWorkspace } from "./ExecutiveOverviewWorkspace";
import { MyWorkWorkspace } from "./MyWorkWorkspace";
import type { OperationalScope } from "./core/operationalScope";
import type {
  BusinessCoordinates,
  FormalRoute,
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
    coordinates: { regionId: "authorized-all", ...initialCoordinates },
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

  it("routes personal tasks to the owning business document", async () => {
    const user = userEvent.setup();
    const onOpenBusiness = vi.fn();
    render(<MyWorkWorkspace section="tasks" onOpenBusiness={onOpenBusiness} />);
    await user.click(screen.getByRole("tab", { name: "待我填报" }));

    await user.click(screen.getByRole("button", { name: "进入市场填报" }));
    expect(onOpenBusiness).toHaveBeenCalledWith(
      { application: "market", section: "tasks" },
      { type: "work-item", id: "WORK-MARKET-FILL-W31" },
    );
    expect(
      screen.queryByRole("textbox", { name: "本周玉米主流收购价格" }),
    ).not.toBeInTheDocument();
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

  it("presents My Work as one task-led table instead of a dashboard grid", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MyWorkWorkspace section="tasks" onOpenBusiness={vi.fn()} />,
    );
    await user.click(screen.getByRole("tab", { name: "待我处理" }));

    expect(screen.getByRole("table", { name: "本人责任任务" })).toBeVisible();
    expect(screen.getByRole("table", { name: "今日重点事项" })).toBeVisible();
    expect(container.querySelector(".unified-two-column")).toBeNull();
    expect(container.querySelector(".unified-attention-panel")).toBeNull();
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
