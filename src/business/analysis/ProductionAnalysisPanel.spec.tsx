import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { validSnapshot } from "@/platform/api/observableAnalysisContract.fixture";
import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";
import { ProductionAnalysisPanel } from "./ProductionAnalysisPanel";

afterEach(cleanup);

function repository(): RealtimeBusinessRepository {
  const snapshot = validSnapshot();
  return {
    loadMasterData: vi.fn().mockResolvedValue({
      products: [{ code: "CORN", name: "玉米" }],
      periods: [],
      regions: [
        { code: "230200", name: "齐齐哈尔市", parentCode: null, level: "PREFECTURE" },
      ],
    }),
    loadObservableAnalysisSnapshot: vi.fn().mockResolvedValue({
      ...snapshot,
      production: {
        ...snapshot.production,
        metrics: [
          metric("CULTIVATED_AREA", "核定播种面积", "100.0000", "亩"),
          metric("HARVEST_AREA", "预计收获面积", "90.0000", "亩"),
          metric("WEIGHTED_YIELD_PER_MU", "加权亩产", "500.0000", "公斤/亩"),
          metric("EXPECTED_OUTPUT", "预计总产", "50.0000", "吨"),
          metric("AFFECTED_AREA", "灾损面积", null, "亩", "当前模板无核定值"),
          metric("INTENDED_AREA", "下年度意向面积", "105.0000", "亩"),
        ],
      },
    }),
    listNotifications: vi.fn().mockResolvedValue({ items: [], unreadCount: 0 }),
    subscribeBusinessEvents: vi.fn(() => vi.fn()),
  } as unknown as RealtimeBusinessRepository;
}

function metric(
  code: string,
  label: string,
  value: string | null,
  unit: string,
  missingReason: string | null = null,
) {
  return { code, label, value, unit, aggregation: "SUM", sourceCount: value ? 1 : 0, missingReason };
}

describe("ProductionAnalysisPanel", () => {
  it("organizes approved production facts by five business questions", async () => {
    const { container } = render(
      <ProductionAnalysisPanel repository={repository()} />,
    );

    expect(await screen.findByRole("heading", { name: "产情分析" })).toBeVisible();
    for (const heading of [
      "生产概况",
      "长势与灾损",
      "余粮与去向",
      "质量与成本",
      "下年种植意向",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeVisible();
    }
    expect(screen.queryByLabelText("分析指标")).not.toBeInTheDocument();
    expect(screen.queryByText("产情年度对比分析")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "生产概况指标图" })).toBeVisible();
    expect(screen.getByRole("table", { name: "生产概况等价数据表" })).toBeVisible();
    expect(screen.getByText("当前模板无核定值")).toBeVisible();
    expect(screen.getByText(/预计收获面积为播种面积的 90.0%/u)).toBeVisible();
    expect(screen.queryByText("AI分析")).not.toBeInTheDocument();
    expect(screen.queryByText("230200")).not.toBeInTheDocument();

    const versions = [...container.querySelectorAll("[data-analysis-version]")].map(
      (element) => element.getAttribute("data-analysis-version"),
    );
    expect(new Set(versions).size).toBe(1);
    expect(versions.length).toBeGreaterThanOrEqual(5);
  });
});
