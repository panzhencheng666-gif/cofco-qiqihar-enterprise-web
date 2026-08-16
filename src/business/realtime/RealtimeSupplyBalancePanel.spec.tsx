import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { validSnapshot } from "@/platform/api/observableAnalysisContract.fixture";
import type { AnalysisQualityState } from "@/platform/api/observableAnalysisContract";
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

function source(qualityState: AnalysisQualityState = "AVAILABLE") {
  let onError: (() => void) | undefined;
  const snapshot = {
    ...validSnapshot(),
    qualityState,
    supply: {
      calculation: {
        ...validSnapshot().supply.calculation,
        qualityState,
      },
    },
  };
  const api = {
    loadMasterData: vi.fn(() =>
      Promise.resolve({
        products: [{ code: "CORN", name: "玉米" }],
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
      }),
    ),
    loadObservableAnalysisSnapshot: vi.fn(() => Promise.resolve(snapshot)),
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
    fail: () => onError?.(),
    snapshot,
  };
}

describe("RealtimeSupplyBalancePanel", () => {
  it("renders one automatic read-only result from the approved snapshot", async () => {
    const data = source();
    render(<RealtimeSupplyBalancePanel repository={data.api} />);

    expect(await screen.findByRole("heading", { name: "实时供需平衡" })).toBeVisible();
    expect((await screen.findAllByText("结果可用"))[0]).toBeVisible();
    expect(screen.getByText("自动计算，只读展示")).toBeVisible();
    expect(screen.getAllByText("预计总产")[0]).toBeVisible();
    expect(screen.getByText("期初可观测库存")).toBeVisible();
    expect(screen.getByText("期末可观测库存")).toBeVisible();
    expect(screen.getByText("推算其他消耗")).toBeVisible();
    expect(screen.getByRole("heading", { name: "供需流向桥" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "生产主体勾稽" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "数据覆盖与质量" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "核定数据来源" })).toBeVisible();

    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /采用|调整|试算|发布|确认来源/u })).not.toBeInTheDocument();
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

  it("shows each quality reason once when snapshot sections report the same issue", async () => {
    const data = source("COVERAGE_REVIEW_REQUIRED");
    Object.assign(data.snapshot, {
      blockingReasons: ["DUPLICATE_REASON"],
      warnings: ["DUPLICATE_REASON"],
      supply: {
        calculation: {
          ...data.snapshot.supply.calculation,
          issues: ["DUPLICATE_REASON"],
        },
      },
    });

    render(<RealtimeSupplyBalancePanel repository={data.api} />);

    expect(await screen.findAllByText("DUPLICATE_REASON")).toHaveLength(1);
  });

  it("keeps the last cutoff visible while the realtime connection reconnects", async () => {
    const data = source();
    render(<RealtimeSupplyBalancePanel repository={data.api} />);
    expect(await screen.findByText(/数据截止：2026/u)).toBeVisible();

    act(() => data.fail());

    expect(screen.getByText("实时连接正在恢复，当前结果继续保留")).toBeVisible();
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
});
