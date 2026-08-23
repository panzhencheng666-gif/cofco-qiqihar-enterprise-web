import { useState } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { validSnapshot } from "@/platform/api/observableAnalysisContract.fixture";
import type {
  AnalysisQualityState,
  ObservableAnalysisQuery,
} from "@/platform/api/observableAnalysisContract";
import type {
  BusinessNotificationRow,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeSupplyBalancePanel } from "./RealtimeSupplyBalancePanel";

afterEach(cleanup);

const qualityLabels: Readonly<Record<AnalysisQualityState, string>> = {
  AVAILABLE: "结果可用",
  PARTIAL: "数据不完整",
  COVERAGE_REVIEW_REQUIRED: "覆盖口径待复核",
  BLOCKED: "计算已阻断",
  NO_APPROVED_DATA: "暂无核定数据",
};

function source(
  qualityState: AnalysisQualityState = "AVAILABLE",
  approvedSurveyYears?: readonly number[],
) {
  let onError: (() => void) | undefined;
  const baseSnapshot = validSnapshot();
  const snapshot = {
    ...baseSnapshot,
    qualityState,
    supply: {
      ...baseSnapshot.supply,
      calculation: {
        ...baseSnapshot.supply.calculation,
        qualityState,
      },
    },
  };
  const loadObservableAnalysisSnapshot = vi.fn(
    (query: ObservableAnalysisQuery) => {
      void query;
      return Promise.resolve(snapshot);
    },
  );
  const api = {
    loadMasterData: vi.fn(() =>
      Promise.resolve({
        products: [
          { code: "CORN", name: "玉米" },
          { code: "SOYBEAN", name: "大豆" },
        ],
        periods: [],
        regions: [
          {
            code: "230200",
            name: "齐齐哈尔市",
            parentCode: null,
            level: "PREFECTURE",
          },
          {
            code: "230221",
            name: "龙江县",
            parentCode: "230200",
            level: "COUNTY",
          },
          {
            code: "230221100",
            name: "龙江镇",
            parentCode: "230221",
            level: "TOWNSHIP",
          },
        ],
        approvedSurveyYears,
      }),
    ),
    loadObservableAnalysisSnapshot,
    getSampleNetworkComparison: vi.fn(() =>
      Promise.resolve({
        networkYear: 2026,
        networkStatus: "PUBLISHED",
        designPointCount: 2332,
        activeSamplePointCount: 650,
        coveredDesignPointCount: 640,
        uncoveredDesignPointCount: 1692,
        points: [],
      }),
    ),
    listNotifications: vi.fn(() =>
      Promise.resolve({ items: [], unreadCount: 0 }),
    ),
    subscribeBusinessEvents: vi.fn(
      (
        _after: number,
        _next: (event: BusinessNotificationRow) => void,
        failed?: () => void,
      ) => {
        onError = failed;
        return vi.fn();
      },
    ),
  };
  return {
    api: api as unknown as RealtimeBusinessRepository,
    loadObservableAnalysisSnapshot,
    fail: () => onError?.(),
    snapshot,
  };
}

describe("RealtimeSupplyBalancePanel", () => {
  it("uses the same all-region and latest-approved-year scope as production analysis", async () => {
    const data = source("AVAILABLE", [2024]);
    render(<RealtimeSupplyBalancePanel repository={data.api} />);

    await waitFor(() =>
      expect(
        data.loadObservableAnalysisSnapshot.mock.lastCall?.[0],
      ).toMatchObject({
        productCode: "CORN",
        regionCode: "__ALL_AUTHORIZED__",
        surveyYear: 2024,
      }),
    );
    expect(screen.getByRole("combobox", { name: "调查年份" })).toHaveValue(
      "2024",
    );
  });

  it("renders one automatic read-only result from the approved snapshot", async () => {
    const data = source();
    const { container } = render(
      <RealtimeSupplyBalancePanel repository={data.api} />,
    );

    expect(
      await screen.findByRole("heading", { name: "供需平衡" }),
    ).toBeVisible();
    expect(container.firstElementChild).toHaveAttribute(
      "data-dashboard",
      "supply",
    );
    expect(
      screen.getByText("核定产情、市场库存与物流结果自动勾稽"),
    ).toBeVisible();
    expect((await screen.findAllByText("结果可用"))[0]).toBeVisible();
    expect(screen.queryByText("自动计算，只读展示")).not.toBeInTheDocument();
    expect(screen.getAllByText("期初可观测库存")[0]).toBeVisible();
    expect(screen.getAllByText("预计总产")[0]).toBeVisible();
    expect(screen.getAllByText("物流流入")[0]).toBeVisible();
    expect(screen.getAllByText("可观测总供给")[0]).toBeVisible();
    expect(screen.getAllByText("可观测总使用")[0]).toBeVisible();
    expect(screen.getAllByText("期末可观测库存")[0]).toBeVisible();
    expect(
      await screen.findByRole("heading", { name: "期末库存月份趋势" }),
    ).toBeVisible();
    expect(
      await screen.findByRole("region", { name: "样本网络覆盖" }),
    ).toHaveTextContent("仅用于样本网络覆盖对照，不参与业务指标计算");
    expect(
      await screen.findByRole("img", { name: "期末可观测库存趋势" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "供需如何平衡" })).toBeVisible();
    expect(
      screen.queryByRole("group", { name: "供需量对比" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "期初期末库存对比" })).toBeVisible();
    expect(screen.getByRole("img", { name: "期末库存持有结构" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "库存口径明细" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "生产主体勾稽" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "数据质量" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "数据覆盖与质量" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("统计范围")).toBeVisible();
    expect(screen.getByText("1 个地区")).toBeVisible();
    expect(screen.getByText("1 个调查对象")).toBeVisible();
    expect(screen.getByText("3 条采用记录")).toBeVisible();
    expect(screen.getByRole("heading", { name: "核定数据来源" })).toBeVisible();
    expect(screen.queryByText("EXPECTED_OUTPUT")).not.toBeInTheDocument();
    expect(screen.queryByText(/服务端|接口|开发/u)).not.toBeInTheDocument();
    expect(
      container.querySelector(".observable-analysis-report__metric-band"),
    ).toHaveAttribute("data-card-count", "4");
    expect(
      container.querySelectorAll(
        ".observable-analysis-report__metric-band-card",
      ),
    ).toHaveLength(4);
    expect(screen.getAllByText("期初可观测库存")[0]).toBeVisible();
    expect(screen.getAllByText("预计总产")[0]).toBeVisible();
    expect(screen.getAllByText("期末可观测库存")[0]).toBeVisible();
    expect(screen.getAllByText("企业端最近已审核库存")[0]).toBeVisible();
    expect(
      container.querySelector(
        '.observable-analysis-dashboard__grid[data-layout="primary"]',
      ),
    ).toBeVisible();
    expect(
      container.querySelector(
        '.observable-analysis-dashboard__grid[data-layout="supporting"]',
      ),
    ).toBeVisible();
    expect(
      container.querySelector(".observable-analysis-dashboard__masthead"),
    ).toBeVisible();
    expect(
      container.querySelector(
        '.observable-analysis-dashboard__masthead[data-layout="compact"]',
      ),
    ).toBeVisible();
    expect(
      container.querySelector(".observable-analysis-report__lineage-viewport"),
    ).toBeVisible();
    expect(container.querySelector('[data-chart-type="column"]')).toBeNull();
    expect(
      container.querySelector('[data-chart-type="vertical-bar"]'),
    ).toBeVisible();
    expect(container.querySelector('[data-chart-type="bridge"]')).toBeVisible();
    expect(
      container.querySelector('[data-chart-type="distribution"]'),
    ).toBeVisible();
    expect(
      container.querySelector(
        '.observable-analysis-report__lineage-viewport[data-layout="business-ledger"]',
      ),
    ).toBeVisible();
    expect(
      container.querySelector(".realtime-supply-kpis--observable"),
    ).not.toBeInTheDocument();

    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /采用|调整|试算|发布|确认来源/u }),
    ).not.toBeInTheDocument();
  });

  it("uses current inventory structure instead of an empty trend section for one approved month", async () => {
    const data = source();
    data.api.loadObservableAnalysisSnapshot = vi.fn(
      (query: ObservableAnalysisQuery) =>
        Promise.resolve(
          query.surveyMonth == null || query.surveyMonth === 11
            ? data.snapshot
            : {
                ...data.snapshot,
                dataCutoffAt: null,
                qualityState: "NO_APPROVED_DATA" as const,
                supply: {
                  ...data.snapshot.supply,
                  calculation: {
                    ...data.snapshot.supply.calculation,
                    endingObservableInventoryTonnes: null,
                  },
                },
              },
        ),
    );

    render(<RealtimeSupplyBalancePanel repository={data.api} />);

    expect(
      await screen.findByRole("img", { name: "期初期末库存对比" }),
    ).toBeVisible();
    expect(
      screen.queryByText("当前年度仅 1 个有效月份，改用本期库存分层。"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "期末库存月份趋势" }),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector(
        '.observable-analysis-dashboard__grid[data-layout="supporting"]',
      ),
    ).toHaveAttribute("data-card-count", "1");
    const reconciliation = screen
      .getByRole("heading", { name: "生产主体勾稽" })
      .closest(".realtime-supply-detail");
    expect(reconciliation).toContainElement(
      screen.getByRole("heading", { name: "数据质量" }),
    );
  });

  it("shows adopted inventory segments while unrelated records remain pending", async () => {
    const data = source("PARTIAL");
    Object.assign(data.snapshot.coverage, { pendingReviewRecordCount: 22 });
    Object.assign(data.snapshot.supply.inventory, {
      productionEndingTonnes: "35.0000",
      enterpriseEndingTonnes: "500.0000",
      adoptedRecordCount: 3,
      reviewGroupCount: 1,
      endingComplete: false,
    });

    render(<RealtimeSupplyBalancePanel repository={data.api} />);

    expect(await screen.findByText("生产端已核定期末库存")).toBeVisible();
    expect(
      screen.getByText("企业端最近已审核库存（按期末替代）"),
    ).toBeVisible();
    expect(screen.getAllByText("500.00 吨")[0]).toBeVisible();
    expect(
      screen.getByText("各库存位置最近统计日期：2026年8月10日至2026年8月31日"),
    ).toBeVisible();
    expect(
      screen.getByText(
        "企业库存采用各持有位置最近一次已审核值，具体日期逐项列示",
      ),
    ).toBeVisible();
    expect(screen.queryByText("企业端已核定期末库存")).not.toBeInTheDocument();
    expect(screen.getByText("22 条待审核记录暂不计入")).toBeVisible();
    expect(
      screen.getByText("1 组库存口径待复核，其他已核定库存已先计算"),
    ).toBeVisible();
    expect(
      screen.queryByText("INVENTORY_POSITION_REVIEW_REQUIRED"),
    ).not.toBeInTheDocument();
  });

  it.each(Object.entries(qualityLabels) as [AnalysisQualityState, string][])(
    "shows the business state %s",
    async (qualityState, label) => {
      const data = source(qualityState);
      render(<RealtimeSupplyBalancePanel repository={data.api} />);
      expect((await screen.findAllByText(label))[0]).toBeVisible();
    },
  );

  it("binds every result section to one analysis version", async () => {
    const data = source();
    const { container } = render(
      <RealtimeSupplyBalancePanel repository={data.api} />,
    );
    await screen.findAllByText("结果可用");
    const versionedSections = container.querySelectorAll(
      "[data-analysis-version]",
    );
    expect(versionedSections.length).toBeGreaterThanOrEqual(4);
    expect(
      new Set(
        [...versionedSections].map((element) =>
          element.getAttribute("data-analysis-version"),
        ),
      ),
    ).toEqual(new Set([data.snapshot.analysisVersion]));
  });

  it("shows each quality reason once in business language when sections report the same issue", async () => {
    const data = source("COVERAGE_REVIEW_REQUIRED");
    Object.assign(data.snapshot, {
      blockingReasons: ["DUPLICATE_REASON"],
      warnings: ["DUPLICATE_REASON"],
      supply: {
        ...data.snapshot.supply,
        calculation: {
          ...data.snapshot.supply.calculation,
          issues: ["DUPLICATE_REASON"],
        },
      },
    });

    render(<RealtimeSupplyBalancePanel repository={data.api} />);

    expect(await screen.findAllByText("存在需复核的数据项")).toHaveLength(1);
    expect(screen.queryByText("DUPLICATE_REASON")).not.toBeInTheDocument();
  });

  it("hides internal state codes and omits the cutoff when no approved source exists", async () => {
    const data = source("NO_APPROVED_DATA");
    Object.assign(data.snapshot, {
      dataCutoffAt: null,
      blockingReasons: [],
      warnings: [],
      supply: {
        ...data.snapshot.supply,
        calculation: {
          ...data.snapshot.supply.calculation,
          issues: ["NO_APPROVED_DATA"],
        },
      },
    });

    render(<RealtimeSupplyBalancePanel repository={data.api} />);

    expect(await screen.findByText("数据截止：暂无核定数据")).toBeVisible();
    expect(screen.queryByText("NO_APPROVED_DATA")).not.toBeInTheDocument();
    expect(
      screen.getByText("当前范围暂无可计算的核定供需数据。"),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "供需如何平衡" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "库存口径拆分" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the last cutoff visible while the realtime connection reconnects", async () => {
    const data = source();
    render(<RealtimeSupplyBalancePanel repository={data.api} />);
    expect(await screen.findByText(/数据截止：2026/u)).toBeVisible();

    act(() => data.fail());

    expect(
      screen.getByText("实时连接正在恢复，当前结果继续保留"),
    ).toBeVisible();
    expect(screen.getByText(/数据截止：2026/u)).toBeVisible();
  });

  it("resets filters to the route scope and reloads the snapshot", async () => {
    const user = userEvent.setup();
    const data = source();
    render(
      <RealtimeSupplyBalancePanel
        periodCode="2025"
        regionCode="230200"
        repository={data.api}
      />,
    );
    await screen.findAllByText("结果可用");

    await user.selectOptions(screen.getByLabelText("调查年份"), "2026");
    await user.click(screen.getByRole("button", { name: "重置筛选" }));

    await waitFor(() =>
      expect(screen.getByLabelText("调查年份")).toHaveValue("2025"),
    );
  });

  it("keeps product and region selections when the year updates the route period", async () => {
    const user = userEvent.setup();
    const data = source("AVAILABLE", [2025, 2024]);

    function ControlledPeriodPanel() {
      const [periodCode, setPeriodCode] = useState("2025");
      return (
        <RealtimeSupplyBalancePanel
          onPeriodCodeChange={setPeriodCode}
          periodCode={periodCode}
          repository={data.api}
        />
      );
    }

    render(<ControlledPeriodPanel />);
    await screen.findAllByText("结果可用");

    await user.selectOptions(
      screen.getByRole("combobox", { name: "产品或作物" }),
      "SOYBEAN",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "地级市" }),
      "230200",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "调查年份" }),
      "2024",
    );

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "调查年份" })).toHaveValue(
        "2024",
      ),
    );
    expect(screen.getByRole("combobox", { name: "产品或作物" })).toHaveValue(
      "SOYBEAN",
    );
    expect(screen.getByRole("combobox", { name: "地级市" })).toHaveValue(
      "230200",
    );
  });
});
