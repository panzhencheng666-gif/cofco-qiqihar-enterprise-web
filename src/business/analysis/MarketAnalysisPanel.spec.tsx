import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { validSnapshot } from "@/platform/api/observableAnalysisContract.fixture";
import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";
import { MarketAnalysisPanel } from "./MarketAnalysisPanel";

afterEach(cleanup);

function repository(): RealtimeBusinessRepository {
  const snapshot = validSnapshot();
  return {
    loadMasterData: vi.fn().mockResolvedValue({
      products: [{ code: "CORN", name: "玉米" }],
      periods: [],
      regions: [{ code: "230200", name: "齐齐哈尔市", parentCode: null, level: "PREFECTURE" }],
    }),
    loadObservableAnalysisSnapshot: vi.fn().mockResolvedValue({
      ...snapshot,
      market: {
        metrics: [
          metric("AVERAGE_TRADE_PRICE", "平均成交价", "2500.0000", "元/吨"),
          metric("AVERAGE_PURCHASE_PRICE", "平均采购价", "2400.0000", "元/吨"),
          metric("AVERAGE_SALE_PRICE", "平均销售价", "2550.0000", "元/吨"),
          metric("PURCHASE_VOLUME", "采购量", "20.0000", "吨"),
          metric("SALES_VOLUME", "销售量", null, "吨", "当前对象类型不适用"),
        ],
      },
      logistics: {
        metrics: [metric("AVERAGE_FREIGHT_RATE", "平均物流运价", "80.0000", "元/吨")],
      },
    }),
    listNotifications: vi.fn().mockResolvedValue({ items: [], unreadCount: 0 }),
    subscribeBusinessEvents: vi.fn(() => vi.fn()),
  } as unknown as RealtimeBusinessRepository;
}

function metric(code: string, label: string, value: string | null, unit: string, missingReason: string | null = null) {
  return { code, label, value, unit, aggregation: "SUM", sourceCount: value ? 1 : 0, missingReason };
}

describe("MarketAnalysisPanel", () => {
  it("organizes approved market facts into six distinct business themes", async () => {
    const { container } = render(<MarketAnalysisPanel repository={repository()} />);

    expect(await screen.findByRole("heading", { name: "市场分析" })).toBeVisible();
    for (const heading of ["价格运行", "购销活动", "库存监测", "流通成本", "市场质量", "地区与主体对比"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeVisible();
    }
    expect(screen.queryByLabelText("分析指标")).not.toBeInTheDocument();
    expect(screen.getAllByText("平均成交价")[0]).toBeVisible();
    expect(screen.getAllByText("平均采购价")[0]).toBeVisible();
    expect(screen.getAllByText("平均销售价")[0]).toBeVisible();
    expect(screen.getByText("当前对象类型不适用")).toBeVisible();
    expect(screen.getByText("市场购销量仅用于市场活动分析，不进入供需平衡总量。")).toBeVisible();
    expect(screen.getByRole("img", { name: "市场价格对比图" })).toBeVisible();
    expect(screen.getByRole("table", { name: "市场价格等价数据表" })).toBeVisible();
    expect(screen.queryByText("MKT_ACTUAL_TRADE_PRICE")).not.toBeInTheDocument();
    expect(screen.queryByText("230200")).not.toBeInTheDocument();

    const versions = [...container.querySelectorAll("[data-analysis-version]")].map((element) => element.getAttribute("data-analysis-version"));
    expect(new Set(versions).size).toBe(1);
    expect(versions.length).toBeGreaterThanOrEqual(6);
  });
});
