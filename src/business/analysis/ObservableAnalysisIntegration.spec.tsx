import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RealtimeSupplyBalancePanel } from "@/business/realtime/RealtimeSupplyBalancePanel";
import { validSnapshot } from "@/platform/api/observableAnalysisContract.fixture";
import type { BusinessNotificationRow, RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";
import { MarketAnalysisPanel } from "./MarketAnalysisPanel";
import { ProductionAnalysisPanel } from "./ProductionAnalysisPanel";

afterEach(cleanup);

function source() {
  let current = validSnapshot();
  const listeners: ((event: BusinessNotificationRow) => void)[] = [];
  const loadObservableAnalysisSnapshot = vi.fn(() => Promise.resolve(current));
  const api = {
    loadMasterData: vi.fn().mockResolvedValue({
      products: [{ code: "CORN", name: "玉米" }],
      periods: [],
      regions: [{ code: "230200", name: "齐齐哈尔市", parentCode: null, level: "PREFECTURE" }],
    }),
    loadObservableAnalysisSnapshot,
    listNotifications: vi.fn().mockResolvedValue({ items: [], unreadCount: 0 }),
    subscribeBusinessEvents: vi.fn((_after: number, next: (event: BusinessNotificationRow) => void) => {
      listeners.push(next);
      return vi.fn();
    }),
  } as unknown as RealtimeBusinessRepository;
  return {
    api,
    loadObservableAnalysisSnapshot,
    emit(actionCode: string, sequence: number) {
      const event: BusinessNotificationRow = {
        id: `event-${sequence}`,
        sequence,
        aggregateType: "PRODUCTION_RECORD",
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
      };
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

    await waitFor(() => expect(data.loadObservableAnalysisSnapshot).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(container.querySelectorAll("[data-analysis-version]").length).toBeGreaterThan(12));
    expect(versions(container)).toEqual(new Set([validSnapshot().analysisVersion]));

    act(() => data.emit("PRODUCTION_RECORD_CREATED", 1));
    await Promise.resolve();
    expect(data.loadObservableAnalysisSnapshot).toHaveBeenCalledTimes(3);

    const approved = data.advance();
    act(() => data.emit("PRODUCTION_RECORD_APPROVED", 2));
    await waitFor(() => expect(data.loadObservableAnalysisSnapshot).toHaveBeenCalledTimes(6));
    await waitFor(() => expect(versions(container)).toEqual(new Set([approved.analysisVersion])));
  });
});

function versions(container: HTMLElement): Set<string | null> {
  return new Set([...container.querySelectorAll("[data-analysis-version]")].map((element) => element.getAttribute("data-analysis-version")));
}
