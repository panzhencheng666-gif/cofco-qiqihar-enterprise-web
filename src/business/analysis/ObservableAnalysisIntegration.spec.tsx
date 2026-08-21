import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RealtimeSupplyBalancePanel } from "@/business/realtime/RealtimeSupplyBalancePanel";
import { validSnapshot } from "@/platform/api/observableAnalysisContract.fixture";
import type {
  BusinessNotificationRow,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { MarketAnalysisPanel } from "./MarketAnalysisPanel";
import { ProductionAnalysisPanel } from "./ProductionAnalysisPanel";

afterEach(cleanup);

function source() {
  let current = validSnapshot();
  const listeners = new Set<(event: BusinessNotificationRow) => void>();
  const loadObservableAnalysisSnapshot = vi.fn(() => Promise.resolve(current));
  const subscribeBusinessEvents = vi.fn(
    (_after: number, next: (event: BusinessNotificationRow) => void) => {
      listeners.add(next);
      return () => listeners.delete(next);
    },
  );
  const api = {
    loadMasterData: vi.fn().mockResolvedValue({
      products: [{ code: "CORN", name: "玉米" }],
      periods: [],
      regions: [
        {
          code: "230200",
          name: "齐齐哈尔市",
          parentCode: null,
          level: "PREFECTURE",
        },
      ],
    }),
    loadObservableAnalysisSnapshot,
    listNotifications: vi.fn().mockResolvedValue({ items: [], unreadCount: 0 }),
    subscribeBusinessEvents,
  } as unknown as RealtimeBusinessRepository;
  return {
    api,
    activeListenerCount: () => listeners.size,
    loadObservableAnalysisSnapshot,
    subscribeBusinessEvents,
    emit(aggregateType: string, actionCode: string, sequence: number) {
      const event: BusinessNotificationRow = {
        id: `event-${sequence}`,
        sequence,
        aggregateType,
        aggregateId: `record-${sequence}`,
        actionCode,
        productCode: "CORN",
        regionCodes: ["230200"],
        occurredAt: "2026-08-16T12:00:00+08:00",
        read: false,
      };
      listeners.forEach((listener) => listener(event));
    },
    advance() {
      current = {
        ...current,
        analysisVersion: `sha256:${"a".repeat(64)}`,
        dataCutoffAt: "2026-08-16T13:00:00+08:00",
        supply: {
          calculation: {
            ...current.supply.calculation,
            endingObservableInventoryTonnes: "40.0000",
          },
          inventory: {
            ...current.supply.inventory,
            enterpriseEndingTonnes: "25.0000",
          },
        },
      };
      return current;
    },
    noApprovedData() {
      Object.assign(current, {
        dataCutoffAt: null,
        qualityState: "NO_APPROVED_DATA",
        coverage: {
          recordCount: 0,
          uniqueSubjectCount: 0,
          coveredRegionCount: 0,
          excludedRecordCount: 0,
          pendingReviewRecordCount: 0,
        },
        lineage: [],
      });
      Object.assign(current.supply.calculation, {
        qualityState: "NO_APPROVED_DATA",
        issues: ["NO_APPROVED_DATA"],
      });
      return current;
    },
  };
}

describe("observable analysis cross-menu integration", () => {
  it("keeps drafts out and refreshes all three menus to one approved version", async () => {
    const data = source();
    const { container } = render(
      <>
        <RealtimeSupplyBalancePanel repository={data.api} />
        <ProductionAnalysisPanel repository={data.api} />
        <MarketAnalysisPanel repository={data.api} />
      </>,
    );

    await waitFor(() =>
      expect(data.loadObservableAnalysisSnapshot).toHaveBeenCalledTimes(39),
    );
    await waitFor(() => expect(data.activeListenerCount()).toBe(3));
    await waitFor(() =>
      expect(
        container.querySelectorAll("[data-analysis-version]").length,
      ).toBeGreaterThan(12),
    );
    expect(versions(container)).toEqual(
      new Set([validSnapshot().analysisVersion]),
    );

    act(() => data.emit("PRODUCTION_RECORD", "PRODUCTION_RECORD_CREATED", 1));
    await Promise.resolve();
    expect(data.loadObservableAnalysisSnapshot).toHaveBeenCalledTimes(39);

    const approved = data.advance();
    act(() => data.emit("MARKET_RECORD", "MARKET_RECORD_APPROVED", 2));
    await waitFor(() =>
      expect(data.loadObservableAnalysisSnapshot).toHaveBeenCalledTimes(78),
    );
    await waitFor(() =>
      expect(versions(container)).toEqual(new Set([approved.analysisVersion])),
    );
    expect(
      screen.getByText("企业端最近已审核库存（按期末替代）").parentElement,
    ).toHaveTextContent("25.00 吨");
  });

  it("shows no fabricated cutoff in all three menus when there is no approved data", async () => {
    const data = source();
    data.noApprovedData();
    render(
      <>
        <RealtimeSupplyBalancePanel repository={data.api} />
        <ProductionAnalysisPanel repository={data.api} />
        <MarketAnalysisPanel repository={data.api} />
      </>,
    );

    await waitFor(() =>
      expect(screen.getAllByText("数据截止：暂无核定数据")).toHaveLength(3),
    );
  });
});

function versions(container: HTMLElement): Set<string | null> {
  return new Set(
    [...container.querySelectorAll("[data-analysis-version]")].map((element) =>
      element.getAttribute("data-analysis-version"),
    ),
  );
}
