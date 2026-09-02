import { readFileSync } from "node:fs";

import { useState } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExecutiveOverviewWorkspace } from "./ExecutiveOverviewWorkspace";
import { MyWorkWorkspace } from "./MyWorkWorkspace";
import type { OperationalScope } from "./core/operationalScope";
import { businessWorkFixtures } from "./data/businessWorkFixtures";
import type { BusinessWorkItem } from "./core/businessWork";
import type {
  BusinessCoordinates,
  FormalRoute,
  FormalSelection,
  OverviewSection,
  WorkSection,
} from "./formalEnterpriseModel";
import { fixtureOperationalIdentity } from "./formalEnterpriseData";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";

afterEach(cleanup);

function ExecutiveHarness({
  initialSection = "operations",
  initialCoordinates = {},
  authorization = {},
  onCoordinateChange = vi.fn(),
  onRouteChange = vi.fn(),
  workItems,
}: {
  initialSection?: OverviewSection;
  initialCoordinates?: Partial<OperationalScope["coordinates"]>;
  authorization?: Partial<OperationalScope["authorization"]>;
  onCoordinateChange?: (coordinates: Partial<BusinessCoordinates>) => void;
  onRouteChange?: (route: FormalRoute) => void;
  workItems?: readonly BusinessWorkItem[];
}) {
  const [section, setSection] = useState<OverviewSection>(initialSection);
  const [scope, setScope] = useState<OperationalScope>({
    ...fixtureOperationalIdentity,
    authorization: {
      ...fixtureOperationalIdentity.authorization,
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
      workItems={workItems}
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
  initialSection = "tasks",
  initialCoordinates = {},
  authorization = {},
  identity = fixtureOperationalIdentity.identity,
  onCoordinateChange = vi.fn(),
  onOpenBusiness = vi.fn(),
  workItems = businessWorkFixtures,
  canBatchApprove = false,
  onBatchApprove,
  onReviewItem,
}: {
  initialSection?: Exclude<WorkSection, "sample-governance">;
  initialCoordinates?: Partial<OperationalScope["coordinates"]>;
  authorization?: Partial<OperationalScope["authorization"]>;
  identity?: OperationalScope["identity"];
  onCoordinateChange?: (coordinates: Partial<BusinessCoordinates>) => void;
  onOpenBusiness?: (route: FormalRoute, selection?: FormalSelection) => void;
  workItems?: readonly BusinessWorkItem[];
  canBatchApprove?: boolean;
  onBatchApprove?: () => Promise<{
    requestedCount: number;
    approvedCount: number;
    failedCount: number;
    failures: readonly [];
  }>;
  onReviewItem?: (
    item: BusinessWorkItem,
    action: "approve" | "return",
    reason?: string,
  ) => Promise<void>;
}) {
  const [scope, setScope] = useState<OperationalScope>({
    ...fixtureOperationalIdentity,
    identity,
    authorization: {
      ...fixtureOperationalIdentity.authorization,
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
      section={initialSection}
      scope={scope}
      onScopeChange={(coordinates) => {
        onCoordinateChange(coordinates);
        setScope((current) => ({
          ...current,
          coordinates: { ...current.coordinates, ...coordinates },
        }));
      }}
      onOpenBusiness={onOpenBusiness}
      workItems={workItems}
      canBatchApprove={canBatchApprove}
      onBatchApprove={onBatchApprove}
      onReviewItem={onReviewItem}
    />
  );
}

describe("enterprise portal workspaces", () => {
  it("offers administrators one confirmed batch review for every visible pending record", async () => {
    const user = userEvent.setup();
    const pending = businessWorkFixtures.find(
      ({ domain, reviewStatus }) =>
        domain === "production" && reviewStatus === "pending",
    );
    if (!pending) throw new Error("missing pending production fixture");
    const workItems = [pending, { ...pending, workId: `${pending.workId}-2` }];
    const onBatchApprove = vi.fn().mockResolvedValue({
      requestedCount: 2,
      approvedCount: 2,
      failedCount: 0,
      failures: [],
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <MyWorkHarness
        authorization={{ serverAuthoritative: true }}
        canBatchApprove
        onBatchApprove={onBatchApprove}
        workItems={workItems}
      />,
    );

    expect(screen.getByText("2 项")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "一键审核当前筛选（2 项）" }),
    );

    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining("2 条待审核业务记录"),
    );
    expect(onBatchApprove).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText("批量审核完成：2 条已审核通过并自动发布。"),
    ).toBeVisible();
  });

  it("requires a reason when a reviewer returns one pending record", async () => {
    const user = userEvent.setup();
    const pending = businessWorkFixtures.find(
      ({ domain, reviewStatus }) =>
        domain === "production" && reviewStatus === "pending",
    );
    if (!pending) throw new Error("missing pending production fixture");
    const onReviewItem = vi.fn().mockResolvedValue(undefined);

    render(
      <MyWorkHarness
        authorization={{ serverAuthoritative: true }}
        canBatchApprove
        onReviewItem={onReviewItem}
        workItems={[pending]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "驳回" }));
    const confirmReturn = screen.getByRole("button", { name: "确认驳回" });
    expect(confirmReturn).toBeDisabled();
    await user.type(screen.getByLabelText("驳回原因"), "联系方式需要核实");
    await user.click(confirmReturn);

    expect(onReviewItem).toHaveBeenCalledWith(
      pending,
      "return",
      "联系方式需要核实",
    );
    expect(
      await screen.findByText("该记录已驳回并通知填报人修改。"),
    ).toBeVisible();
  });

  it("does not expose an English backend error when one record cannot be returned", async () => {
    const user = userEvent.setup();
    const pending = businessWorkFixtures.find(
      ({ domain, reviewStatus }) =>
        domain === "market" && reviewStatus === "pending",
    );
    if (!pending) throw new Error("missing pending market fixture");
    const onReviewItem = vi.fn().mockRejectedValue(
      new RealtimeApiError({
        code: "SELF_RETURN_FORBIDDEN",
        message: "The submitting employee cannot return the same record",
        status: 403,
      }),
    );

    render(
      <MyWorkHarness
        authorization={{ serverAuthoritative: true }}
        canBatchApprove
        onReviewItem={onReviewItem}
        workItems={[pending]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "驳回" }));
    await user.type(screen.getByLabelText("驳回原因"), "经纬度与地区不匹配");
    await user.click(screen.getByRole("button", { name: "确认驳回" }));

    expect(
      await screen.findByText("审核操作未完成，请稍后重试。"),
    ).toBeVisible();
    expect(
      screen.queryByText(
        "The submitting employee cannot return the same record",
      ),
    ).not.toBeInTheDocument();
  });

  it("builds the realtime executive filters only from visible workflow records and never presents prototype metrics", () => {
    const source = businessWorkFixtures.find(
      ({ workId }) => workId === "WORK-PRODUCTION-FILL-W31",
    );
    if (!source) throw new Error("missing production work fixture");
    const workItems: readonly BusinessWorkItem[] = [
      {
        ...source,
        regionId: "230200",
        regionLabel: "齐齐哈尔市",
        productId: "corn",
        productLabel: "玉米",
        periodKey: "2026-W32",
        effectivePeriod: "2026年第32周",
      },
      {
        ...source,
        workId: "realtime-soybean-work",
        regionId: "230281",
        regionLabel: "讷河市",
        productId: "soybean",
        productLabel: "大豆",
        periodKey: "2026-W32",
        effectivePeriod: "2026年第32周",
      },
    ];
    render(
      <ExecutiveHarness
        authorization={{
          serverAuthoritative: true,
          authorizedRegionIds: ["authorized-all"],
          authorizedBusinessClassificationIds: [],
          authorizedProductIds: [],
          authorizedCultivarIds: [],
          authorizedReleaseVersionIds: [],
          permissionKeys: [],
        }}
        initialCoordinates={{ periodKey: "2026-W32" }}
        workItems={workItems}
      />,
    );

    expect(screen.queryByRole("combobox", { name: "业务类型" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "任务期间" })).toBeNull();
    expect(
      within(screen.getByRole("combobox", { name: "业务地区" }))
        .getAllByRole("option")
        .map(({ textContent }) => textContent),
    ).toEqual(["全部地区", "齐齐哈尔市", "讷河市"]);
    expect(
      within(screen.getByRole("combobox", { name: "产品或作物" }))
        .getAllByRole("option")
        .map(({ textContent }) => textContent),
    ).toEqual(["全部产品或作物", "玉米", "大豆"]);
    expect(screen.getByText("当前筛选范围没有可用经营指标")).toBeVisible();
    expect(document.body).not.toHaveTextContent(
      /2026 年第 31 周|地区名称待维护|业务域|产品名称待维护|METRIC-/,
    );
  });

  it("keeps the executive ledger dense, horizontally operable, and keyboard visible", () => {
    const css = readFileSync("src/business/unified-workspaces.css", "utf8");
    const marker = css.slice(
      css.indexOf("/* enterprise-executive-ledger:start */"),
    );

    expect(marker).toContain("/* enterprise-executive-ledger:end */");
    expect(marker).toMatch(
      /\.executive-ledger-scroll\s*\{[^}]*overflow-x:\s*auto/s,
    );
    expect(marker).toMatch(
      /\.executive-ledger-workspace\s*\{[^}]*contain:\s*inline-size[^}]*overflow-x:\s*clip/s,
    );
    expect(marker).toMatch(
      /\.executive-filter-grid--primary\s*\{[^}]*grid-template-columns:\s*repeat\(4,/s,
    );
    expect(marker).toMatch(
      /\.executive-filter-grid\s*>\s*label\s*>\s*span\s*\{[^}]*font-size:\s*12px/s,
    );
    expect(marker).toMatch(
      /\.executive-filter-grid\s+select\s*\{[^}]*min-height:\s*36px[^}]*font-size:\s*13px/s,
    );
    expect(marker).toContain(".executive-more-filters");
    expect(marker).toMatch(
      /\.executive-ledger-primary\s*\{[^}]*overflow:\s*hidden/s,
    );
    expect(marker).toMatch(
      /\.executive-result-summary\s*\{[^}]*flex-wrap:\s*wrap/s,
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
    expect(marker).toMatch(/@media \(max-width:\s*1280px\)/);
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
    expect(row).toHaveTextContent(source!.responsiblePerson);
    expect(row).toHaveTextContent(source!.responsiblePost);
    for (const state of [
      "进行中",
      "已退回",
      "审核退回",
      "质量阻断",
      "未发布",
    ]) {
      expect(row).toHaveTextContent(state);
    }

    await user.click(within(row).getByRole("button", { name: "补充产情填报" }));
    expect(onOpenBusiness).toHaveBeenCalledWith(
      { application: "production", section: "corn-collection" },
      { type: "work-item", id: source!.workId },
    );
    expect(document.body).not.toHaveTextContent(
      /WORK-|OBJ-|RESP-|SUBMISSION-|REVIEW-|QUALITY-|RELEASE-|in-progress|returned|blocking|unreleased|T\d{2}:/,
    );
  });

  it("renders the mature title-view-filter-summary-ledger hierarchy without a card wall", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ExecutiveHarness
        authorization={{
          authorizedRegionIds: ["qiqihar-all", "qiqihar-nehe"],
          authorizedProductIds: ["corn"],
          authorizedCultivarIds: ["jingke-968"],
          authorizedReleaseVersionIds: ["METRIC-2026-W31-V3"],
        }}
        initialCoordinates={{ productId: "corn" }}
      />,
    );

    expect(screen.getByRole("combobox", { name: "授权地区" })).toHaveValue(
      "authorized-all",
    );
    expect(screen.getByRole("tab", { name: "经营运行" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "风险事项" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "履责监督" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "发布成果" })).toBeVisible();
    expect(screen.getByRole("table", { name: "经营运行台账" })).toBeVisible();
    for (const label of ["业务类型", "授权地区", "经营期间", "产品或作物"]) {
      expect(screen.getByRole("combobox", { name: label })).toBeVisible();
    }
    expect(
      container.querySelectorAll(".executive-filter-grid--primary > label"),
    ).toHaveLength(4);
    const moreFilters = screen.getByText("更多筛选").closest("details");
    expect(moreFilters).not.toHaveAttribute("open");
    for (const label of [
      "业务分类",
      "地区层级",
      "具体品种",
      "数据状态",
      "采用数据",
      "风险状态",
    ]) {
      expect(
        screen.getByRole("combobox", { name: label, hidden: true }),
      ).not.toBeVisible();
    }
    await user.click(screen.getByText("更多筛选"));
    expect(moreFilters).toHaveAttribute("open");
    expect(screen.getByRole("combobox", { name: "业务分类" })).toBeVisible();

    const pageHeader = container.querySelector(".unified-page-header")!;
    const tabs = container.querySelector(".workspace-tabs")!;
    const filters = container.querySelector(".executive-filter-surface")!;
    const resultSummary = screen.getByRole("status", {
      name: "查询结果摘要",
    });
    const primaryLedger = container.querySelector(".executive-ledger-primary")!;
    expect(
      pageHeader.compareDocumentPosition(tabs) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(
      tabs.compareDocumentPosition(filters) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(
      filters.compareDocumentPosition(resultSummary) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(
      resultSummary.compareDocumentPosition(primaryLedger) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    const ledger = screen.getByRole("table", { name: "经营运行台账" });
    for (const header of [
      "2023",
      "2024",
      "2024同比",
      "2025",
      "2025同比",
      "2026",
      "2026同比",
    ]) {
      expect(
        within(ledger).getByRole("columnheader", { name: header }),
      ).toBeVisible();
    }
    expect(
      within(ledger).getByRole("columnheader", { name: "采用数据" }),
    ).toBeVisible();
    expect(ledger).toHaveTextContent("2026年第31周已核定数据（当前采用）");
    expect(ledger).toHaveTextContent("存在质量提醒");
    expect(ledger).not.toHaveTextContent(/METRIC|passed|warning/);
    expect(resultSummary).toHaveTextContent("全部已授权范围");
    expect(resultSummary).toHaveTextContent("2026 年第 31 周");
    expect(screen.queryByLabelText("已应用筛选条件")).not.toBeInTheDocument();
    const pagination = screen.getByRole("navigation", { name: "经营总览分页" });
    expect(pagination).toHaveTextContent("共 1 条 · 当前 1–1");
    expect(
      within(pagination).getByRole("button", { name: "上一页" }),
    ).toBeDisabled();
    expect(
      within(pagination).getByRole("button", { name: "下一页" }),
    ).toBeDisabled();
    expect(screen.queryByLabelText("经营核心摘要")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".workspace-inline-stats")).toHaveLength(
      0,
    );
    expect(container.querySelector(".unified-context-state")).toBeNull();
    expect(container.querySelector(".executive-card-grid")).toBeNull();
    expect(container.querySelector(".unified-metric-card")).toBeNull();
  });

  it("re-renders executive risk and duty views from the supplied current workflow state", () => {
    const source = businessWorkFixtures.find(
      ({ workId }) => workId === "WORK-PRODUCTION-FILL-W31",
    );
    if (!source) throw new Error("missing production work fixture");
    const createScope = (): OperationalScope => ({
      ...fixtureOperationalIdentity,
      authorization: {
        ...fixtureOperationalIdentity.authorization,
        authorizedRegionIds: ["qiqihar-all", "qiqihar-nehe"],
        authorizedProductIds: ["corn"],
        authorizedCultivarIds: ["jingke-968"],
        authorizedReleaseVersionIds: ["METRIC-2026-W31-V3"],
      },
      coordinates: {
        regionId: "qiqihar-nehe",
        periodKey: "2026-W31",
        businessDomainId: "production",
        productId: "corn",
      },
      savedView: null,
    });
    const renderOverview = (
      section: OverviewSection,
      workItems: readonly BusinessWorkItem[],
    ) => (
      <ExecutiveOverviewWorkspace
        section={section}
        scope={createScope()}
        workItems={workItems}
        onOpenRoute={vi.fn()}
        onScopeChange={vi.fn()}
      />
    );
    const { rerender } = render(
      renderOverview("risks", [{ ...source, title: "动态风险事项" }]),
    );
    expect(screen.getByText("动态风险事项")).toBeVisible();

    rerender(
      renderOverview("risks", [
        {
          ...source,
          title: "动态风险事项",
          obligationStatus: "on-time",
          documentStatus: "submitted",
          reviewStatus: "approved",
          qualityStatus: "passed",
        },
      ]),
    );
    expect(screen.queryByText("动态风险事项")).not.toBeInTheDocument();
    expect(screen.getByText("当前筛选范围没有经营风险记录")).toBeVisible();

    rerender(
      renderOverview("duty", [
        {
          ...source,
          title: "动态履责事项",
          obligationStatus: "on-time",
          documentStatus: "submitted",
          reviewStatus: "approved",
          qualityStatus: "passed",
        },
      ]),
    );
    const dutyRow = screen.getByRole("row", { name: /动态履责事项/ });
    expect(dutyRow).toHaveTextContent("已按时完成");
    expect(dutyRow).toHaveTextContent("审核通过");
  });

  it("explains incomplete published coverage for the complete authorized scope", () => {
    render(<ExecutiveHarness />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "当前授权范围内部分地区尚无已发布数据",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "系统没有改用齐齐哈尔或其他首个地区的数据",
    );
    expect(screen.getByText("当前筛选范围没有可用经营指标")).toBeVisible();
    expect(
      screen.queryByRole("table", { name: "经营运行台账" }),
    ).not.toBeInTheDocument();
  });

  it("explains why the all-product view only contains cross-product indicators", () => {
    render(
      <ExecutiveHarness initialCoordinates={{ regionId: "qiqihar-all" }} />,
    );

    expect(
      screen.getByRole("status", { name: "查询结果摘要" }),
    ).toHaveTextContent(
      "当前未选择具体产品，仅展示跨产品经营指标；选择产品后可查看对应的产情、市场和供需指标。",
    );
    expect(
      screen.getByRole("table", { name: "经营运行台账" }),
    ).toHaveTextContent("质量阻断率");
  });

  it("never exposes an unmapped internal product or version code as visible text", () => {
    const internalProductCode = "INTERNAL-PRODUCT-42";
    const internalVersionCode = "INTERNAL-VERSION-42";
    render(
      <ExecutiveHarness
        authorization={{
          authorizedProductIds: [
            ...fixtureOperationalIdentity.authorization.authorizedProductIds,
            internalProductCode,
          ],
          authorizedReleaseVersionIds: [
            ...fixtureOperationalIdentity.authorization
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
      screen.getByRole("option", { name: "所选产品已不可用" }),
    ).toBeVisible();
    expect(
      screen.getByRole("option", {
        name: "所选采用数据已不可用",
        hidden: true,
      }),
    ).not.toBeVisible();
    expect(document.body).not.toHaveTextContent(
      /INTERNAL-PRODUCT-42|INTERNAL-VERSION-42/,
    );
  });

  it("opens exactly one selected metric track, two charts, and its lineage detail", async () => {
    const user = userEvent.setup();
    const onCoordinateChange = vi.fn();
    const { container } = render(
      <ExecutiveHarness
        authorization={{
          authorizedRegionIds: ["qiqihar-all", "qiqihar-nehe"],
          authorizedProductIds: ["corn"],
          authorizedCultivarIds: ["jingke-968"],
          authorizedReleaseVersionIds: ["METRIC-2026-W31-V3"],
        }}
        initialCoordinates={{ regionId: "qiqihar-all", productId: "corn" }}
        onCoordinateChange={onCoordinateChange}
      />,
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
      screen.getByRole("complementary", { name: "统计口径与数据来源" }),
    ).toHaveTextContent("2026年第31周已核定数据（当前采用）");
    expect(
      screen.getByRole("complementary", { name: "统计口径与数据来源" }),
    ).toHaveTextContent("播种面积统计公式");
    expect(
      screen.getByRole("complementary", { name: "统计口径与数据来源" }),
    ).toHaveTextContent("四年统计口径连续可比");
    expect(screen.getByLabelText("播种面积选中指标分析")).not.toHaveTextContent(
      /METRIC|metric-|definition|comparability|passed/,
    );
    expect(document.body).not.toHaveTextContent(
      /指标数据版本|数据层|业务坐标|治理口径与发布血缘|口径定义版本|可比规则版本|有效治理值|有效治理期间/,
    );
  });

  it("keeps domain and cascading region-level filters URL-owned without fallback", async () => {
    const user = userEvent.setup();
    const onCoordinateChange = vi.fn();
    render(
      <ExecutiveHarness
        authorization={{
          authorizedRegionIds: ["qiqihar-all", "qiqihar-nehe"],
        }}
        initialCoordinates={{ productId: "corn" }}
        onCoordinateChange={onCoordinateChange}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "分析播种面积" }),
    ).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "业务类型" }),
      "market",
    );
    expect(onCoordinateChange).toHaveBeenCalledWith(
      expect.objectContaining({ businessDomainId: "market" }),
    );
    expect(
      screen.queryByRole("button", { name: "分析播种面积" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "分析采购价" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("当前筛选范围没有可用经营指标")).toBeVisible();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "授权地区" }),
      "qiqihar-all",
    );
    expect(onCoordinateChange).toHaveBeenLastCalledWith({
      regionId: "qiqihar-all",
      regionLevel: "city",
      selectedMetricId: undefined,
    });
    expect(screen.getByRole("button", { name: "分析采购价" })).toBeVisible();

    await user.click(screen.getByText("更多筛选"));
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
        regionId: "",
      }),
    );
    expect(screen.getByRole("combobox", { name: "授权地区" })).toHaveValue("");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "地区层级已更新，请重新选择授权地区",
    );
    expect(screen.getByText("当前筛选范围没有可用经营指标")).toBeVisible();
  });

  it("keeps cultivars cascaded to the selected product and explains every cleared mismatch", async () => {
    const user = userEvent.setup();
    const onCoordinateChange = vi.fn();
    render(
      <ExecutiveHarness
        authorization={{
          authorizedRegionIds: ["qiqihar-all", "qiqihar-nehe"],
          authorizedProductIds: ["corn", "soybean"],
          authorizedCultivarIds: ["jingke-968", "heinong-84"],
        }}
        initialCoordinates={{
          productId: "corn",
          cultivarId: "jingke-968",
        }}
        onCoordinateChange={onCoordinateChange}
      />,
    );

    await user.click(screen.getByText("更多筛选"));
    const cultivar = screen.getByRole("combobox", { name: "具体品种" });
    expect(
      within(cultivar).getByRole("option", { name: "京科968" }),
    ).toBeVisible();
    expect(
      within(cultivar).queryByRole("option", { name: "黑农84" }),
    ).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "产品或作物" }),
      "soybean",
    );

    expect(onCoordinateChange).toHaveBeenLastCalledWith({
      productId: "soybean",
      cultivarId: undefined,
      selectedMetricId: undefined,
    });
    expect(cultivar).toHaveValue("");
    expect(
      within(cultivar).getByRole("option", { name: "黑农84" }),
    ).toBeVisible();
    expect(
      within(cultivar).queryByRole("option", { name: "京科968" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "已移除与大豆不适用的品种：京科968",
    );
  });

  it("presents My Work as one current-node ledger with governed filters", async () => {
    const user = userEvent.setup();
    const onCoordinateChange = vi.fn();
    const { container } = render(
      <MyWorkHarness onCoordinateChange={onCoordinateChange} />,
    );

    const ledger = screen.getByRole("table", { name: "本人工作台账" });
    expect(
      screen.getByRole("navigation", { name: "表格分页" }),
    ).toHaveTextContent(/共 [1-9]\d* 条/);
    expect(container.querySelectorAll("table")).toHaveLength(1);
    expect(
      screen.getByRole("searchbox", { name: "搜索事项名称或单据编号" }),
    ).toBeVisible();
    for (const label of ["业务类型", "业务地区", "待处理状态"]) {
      expect(screen.getByRole("combobox", { name: label })).toBeVisible();
    }
    expect(
      screen.queryByRole("combobox", { name: "产品或作物" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "业务分类" }),
    ).not.toBeInTheDocument();
    const moreFilters = screen.getByRole("button", { name: "更多筛选" });
    expect(moreFilters).toHaveAttribute("aria-expanded", "false");
    await user.click(moreFilters);
    expect(screen.getByRole("combobox", { name: "业务分类" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "产品或作物" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "任务期间" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "业务地区" })).toHaveValue(
      "authorized-all",
    );
    expect(
      within(ledger)
        .getAllByRole("columnheader")
        .map(({ textContent }) => textContent),
    ).toEqual(["事项", "业务范围", "期间与截止", "责任人", "当前状态", "处理"]);
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
    for (const domain of ["产情监测", "市场监测", "供需核算"]) {
      expect(ledger).toHaveTextContent(domain);
    }
    expect(within(ledger).queryByText("报告中心")).not.toBeInTheDocument();
    expect(ledger).not.toHaveTextContent("第 31 周粮食商情报告审核与分发");
    expect(screen.getByRole("heading", { name: "待我处理" })).toBeVisible();
    expect(
      screen.queryByRole("tablist", { name: "我的工作状态视图" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("责任岗位有效")).not.toBeInTheDocument();
    expect(screen.queryByText("今日重点事项")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("本人工作摘要")).not.toBeInTheDocument();
    expect(container.querySelector(".workspace-inline-stats")).toBeNull();

    const filters = screen.getByRole("region", { name: "我的工作筛选" });
    const ledgerRegion = screen.getByRole("region", {
      name: "本人工作台账区域",
    });
    expect(
      filters.compareDocumentPosition(ledgerRegion) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.queryByRole("region", { name: "当前责任身份" }),
    ).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "业务类型" }),
      "market",
    );
    expect(onCoordinateChange).toHaveBeenLastCalledWith({
      businessDomainId: "market",
      businessSubtypeId: undefined,
    });
    expect(ledger).toHaveTextContent("市场监测");
    expect(within(ledger).queryByText("产情监测")).not.toBeInTheDocument();
  });

  it("keeps the V8 primary filters stable and derives advanced choices from real rows", async () => {
    const user = userEvent.setup();
    const first = businessWorkFixtures[0];
    const second: BusinessWorkItem = {
      ...first,
      workId: `${first.workId}-second`,
      regionId: "230281",
      regionLabel: "讷河市",
      productId: "soybean",
      productLabel: "大豆",
      periodKey: "2026-W32",
      effectivePeriod: "2026 年第 32 周",
    };

    const { rerender } = render(<MyWorkHarness workItems={[first, second]} />);

    expect(screen.getByRole("combobox", { name: "业务类型" })).toBeVisible();
    const region = screen.getByRole("combobox", { name: "业务地区" });
    expect(
      within(region)
        .getAllByRole("option")
        .map(({ textContent }) => textContent),
    ).toEqual(["全部地区", first.regionLabel, "讷河市"]);
    expect(
      within(region).queryByText("地区名称待维护"),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "更多筛选" }));
    const product = screen.getByRole("combobox", { name: "产品或作物" });
    expect(
      within(product)
        .getAllByRole("option")
        .map(({ textContent }) => textContent),
    ).toEqual(["全部产品或作物", expect.any(String), "大豆"]);
    const period = screen.getByRole("combobox", { name: "任务期间" });
    expect(
      within(period)
        .getAllByRole("option")
        .map(({ textContent }) => textContent),
    ).toEqual(["全部任务期间", "2026 年第 31 周", "2026 年第 32 周"]);

    rerender(<MyWorkHarness workItems={[first]} />);
    expect(screen.getByRole("combobox", { name: "业务类型" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "业务地区" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "待处理状态" })).toBeVisible();
    expect(
      screen.queryByRole("combobox", { name: "产品或作物" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "任务期间" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the real query surface available before and after live work items arrive", () => {
    const first = businessWorkFixtures[0];
    const second: BusinessWorkItem = {
      ...first,
      workId: `${first.workId}-live`,
      regionId: "230281",
      regionLabel: "讷河市",
      productId: "soybean",
      productLabel: "大豆",
    };

    const { rerender } = render(<MyWorkHarness workItems={[]} />);

    expect(screen.getByRole("region", { name: "我的工作筛选" })).toBeVisible();

    rerender(<MyWorkHarness workItems={[first, second]} />);

    const filters = screen.getByRole("region", { name: "我的工作筛选" });
    expect(
      within(filters).getByRole("combobox", { name: "业务地区" }),
    ).toBeVisible();
    expect(
      within(filters).getByRole("button", { name: "更多筛选" }),
    ).toBeVisible();
  });

  it("shows a governed empty state for unauthorized My Work coordinates without fallback", () => {
    render(
      <MyWorkHarness
        initialCoordinates={{ businessSubtypeId: "unauthorized-work-type" }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "当前筛选范围超出您的数据权限",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("业务坐标");
    expect(screen.getByRole("button", { name: /更多筛选/ })).toHaveTextContent(
      "已启用 1 项",
    );
    expect(
      screen.queryByRole("row", { name: /讷河市玉米长势/ }),
    ).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("unauthorized-work-type");
  });

  it("uses current-node assignments for a governed reviewer identity", () => {
    render(
      <MyWorkHarness
        identity={{ userId: "zhao-chen", postId: "business-reviewer" }}
      />,
    );

    const ledger = screen.getByRole("table", { name: "本人工作台账" });
    expect(ledger).toHaveTextContent("龙江北方粮贸玉米市场周填报");
    expect(ledger).not.toHaveTextContent("讷河市玉米长势与测产调查");
    expect(ledger).not.toHaveTextContent("2026 年玉米供需差额说明复核");
    expect(ledger).not.toHaveTextContent("第 31 周粮食商情报告审核与分发");
  });

  it("does not infer a person when the identity has no governed assignment", () => {
    render(
      <MyWorkHarness
        identity={{ userId: "wang-yang-copy", postId: "business-reviewer" }}
      />,
    );

    expect(
      screen.queryByRole("region", { name: "当前责任身份" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "本人工作台账" }),
    ).not.toHaveTextContent(
      /讷河市玉米长势与测产调查|齐齐哈尔市玉米市场运行周填报/,
    );
    expect(
      screen.getByText(
        /当前筛选条件或状态视图下没有本人事项，请调整筛选条件后重试/,
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("status", { name: "待我处理概况" }),
    ).not.toHaveTextContent("业务坐标");
  });

  it("keeps the Task 5 My Work ledger responsive, internally scrollable, and keyboard visible", () => {
    const css = readFileSync("src/business/unified-workspaces.css", "utf8");
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
      /\.my-work-task5-filter-grid--primary\s*\{[^}]*grid-template-columns:\s*repeat\(4,/s,
    );
    expect(marker).toMatch(
      /\.my-work-task5-workspace\s*\{[^}]*contain:\s*inline-size/s,
    );
    expect(marker).not.toMatch(/overflow-x:\s*clip/);
    expect(marker).toMatch(
      /\.my-work-task5-ledger\s*\{[^}]*min-width:\s*980px/s,
    );
    expect(marker).toMatch(/@media \(max-width:\s*1280px\)/);
    expect(marker).toMatch(/@media \(max-width:\s*1024px\)/);
    expect(marker).toMatch(/:focus-visible\s*\{[^}]*outline:/s);
    expect(marker).not.toMatch(/font-size:\s*9px/);
  });

  it("styles every Task 5 production job as an aligned responsive work surface", () => {
    const css = readFileSync("src/business/unified-workspaces.css", "utf8");
    const start = css.indexOf("/* enterprise-task5-production:start */");
    const end = css.indexOf("/* enterprise-task5-production:end */");
    const marker = css.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(marker).toMatch(
      /\.production-task5-workspace\s*\{[^}]*contain:\s*inline-size/s,
    );
    expect(marker).not.toMatch(/overflow-x:\s*clip/);
    expect(marker).toMatch(
      /\.production-task5-filter-grid--task-primary\s*\{[^}]*grid-template-columns:\s*repeat\(4,/s,
    );
    expect(marker).toMatch(
      /\.production-task5-ledger-scroll\s*\{[^}]*overflow-x:\s*auto/s,
    );
    expect(marker).toMatch(
      /\.production-task5-sticky\s*\{[^}]*position:\s*sticky/s,
    );
    expect(marker).toMatch(
      /\.production-task5-task-ledger\s*\{[^}]*min-width:\s*1120px/s,
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
    const source = readFileSync("src/business/MyWorkWorkspace.tsx", "utf8");
    expect(source).not.toMatch(
      /personalTasks|BusinessContextBar|WorkspaceScopeBar|WorkspaceInlineStats|今日重点事项|业务坐标|已被新版本替代/,
    );
    expect(source).toContain("已由新批次替代");
  });

  it("routes among four materially different executive ledgers", async () => {
    const user = userEvent.setup();
    const onRouteChange = vi.fn();
    render(
      <ExecutiveHarness
        authorization={{
          authorizedRegionIds: ["qiqihar-all", "qiqihar-nehe"],
          authorizedProductIds: ["corn"],
          authorizedCultivarIds: ["jingke-968"],
          authorizedReleaseVersionIds: ["METRIC-2026-W31-V3"],
        }}
        initialCoordinates={{ productId: "corn" }}
        onRouteChange={onRouteChange}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "风险事项" }));
    expect(onRouteChange).toHaveBeenLastCalledWith({
      application: "overview",
      section: "risks",
    });
    const risks = screen.getByRole("table", { name: "经营异常风险台账" });
    expect(
      within(risks).getByRole("columnheader", { name: "风险事项" }),
    ).toBeVisible();
    expect(
      within(risks).getByRole("columnheader", { name: "风险识别依据" }),
    ).toBeVisible();
    expect(within(risks).getByText("待解释")).toHaveAttribute(
      "data-risk-state",
      "warning",
    );
    expect(within(risks).getByText("待解释")).toHaveClass("is-warning");
    expect(risks).toHaveTextContent("2026年第31周已核定数据（当前采用）");
    expect(risks).not.toHaveTextContent(/METRIC|T17:/);
    await user.click(
      within(risks).getAllByRole("button", {
        name: "进入处置工作区",
      })[0],
    );
    expect(onRouteChange).toHaveBeenLastCalledWith({
      application: "market",
      section: "corn-collection",
    });
    expect(
      screen.queryByRole("table", { name: "经营运行台账" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "履责监督" }));
    const duty = screen.getByRole("table", { name: "经营履责监督台账" });
    expect(
      within(duty).getByRole("columnheader", { name: "责任人及岗位" }),
    ).toBeVisible();
    expect(
      within(duty).getByRole("columnheader", { name: "履责事项" }),
    ).toBeVisible();
    expect(within(duty).getAllByRole("columnheader")).toHaveLength(8);
    expect(
      within(duty).queryByRole("columnheader", { name: "月度按时率" }),
    ).not.toBeInTheDocument();
    await user.click(
      within(duty).getAllByText("查看完整履责记录", {
        selector: "summary",
      })[0],
    );
    for (const preservedField of [
      "填报频率",
      "复核人",
      "有效期",
      "责任状态",
      "首次合格提交",
      "月度应报",
      "月度按时",
      "月度逾期",
      "月度缺报",
      "月度退回",
      "月度按时率",
      "月度趋势",
      "数据截止",
      "履责统计依据",
    ]) {
      expect(duty).toHaveTextContent(preservedField);
    }
    expect(duty).toHaveTextContent("2026年第31周履责已核定数据");
    expect(duty).not.toHaveTextContent(/DUTY-|T17:|resp-/);

    await user.click(screen.getByRole("tab", { name: "发布成果" }));
    const releases = screen.getByRole("table", { name: "经营发布成果台账" });
    expect(
      within(releases).getByRole("columnheader", { name: "发布成果" }),
    ).toBeVisible();
    expect(
      within(releases).getByRole("columnheader", { name: "来源业务" }),
    ).toBeVisible();
    expect(within(releases).getAllByRole("columnheader")).toHaveLength(9);
    expect(
      within(releases).queryByRole("columnheader", { name: "修订记录" }),
    ).not.toBeInTheDocument();
    await user.click(
      within(releases).getAllByText("查看完整发布记录", {
        selector: "summary",
      })[0],
    );
    for (const preservedField of [
      "发布频率",
      "来源业务分类",
      "采用数据",
      "修订记录",
      "数据截止",
      "数据来源",
    ]) {
      expect(releases).toHaveTextContent(preservedField);
    }
    expect(releases).toHaveTextContent("2026年7月31日市场日报（初次发布）");
    expect(releases).toHaveTextContent(
      "2026年7月供需分析月报（第1次修订发布）",
    );
    expect(releases).toHaveTextContent("修订替代");
    expect(releases).not.toHaveTextContent(/PUB-|METRIC|T17:|版本|第\d+版/);
  });

  it("renders an authorized blocking risk from its typed state", () => {
    render(
      <ExecutiveHarness
        authorization={{
          authorizedRegionIds: ["qiqihar-all", "qiqihar-nehe"],
          authorizedBusinessClassificationIds: [
            ...fixtureOperationalIdentity.authorization
              .authorizedBusinessClassificationIds,
            "production.quality-survey",
          ],
          authorizedProductIds: [
            ...fixtureOperationalIdentity.authorization.authorizedProductIds,
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
