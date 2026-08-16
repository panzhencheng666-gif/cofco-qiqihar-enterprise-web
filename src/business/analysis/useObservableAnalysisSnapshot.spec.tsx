import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { validSnapshot } from "@/platform/api/observableAnalysisContract.fixture";
import type { BusinessNotificationRow } from "@/platform/api/realtimeBusinessRepository";
import { useObservableAnalysisSnapshot } from "./useObservableAnalysisSnapshot";

afterEach(cleanup);

function repository() {
  let onChange: ((event: BusinessNotificationRow) => void) | undefined;
  let onError: (() => void) | undefined;
  const unsubscribe = vi.fn();
  const loadObservableAnalysisSnapshot = vi.fn(() =>
    Promise.resolve(validSnapshot()),
  );
  return {
    api: {
      loadObservableAnalysisSnapshot,
      listNotifications: vi.fn(() =>
        Promise.resolve({
          items: [event(12, "CORN", ["230200"])],
          unreadCount: 0,
        }),
      ),
      subscribeBusinessEvents: vi.fn(
        (
          _after: number,
          next: (event: BusinessNotificationRow) => void,
          failed?: () => void,
        ) => {
          onChange = next;
          onError = failed;
          return unsubscribe;
        },
      ),
    },
    emit: (next: BusinessNotificationRow) => onChange?.(next),
    fail: () => onError?.(),
    loadObservableAnalysisSnapshot,
    unsubscribe,
  };
}

const query = {
  productCode: "CORN",
  regionCode: "230200",
  surveyYear: 2026,
  surveyMonth: 8,
};

describe("observable analysis realtime state", () => {
  it("loads one snapshot, refreshes matching events and ignores outside or duplicate events", async () => {
    const source = repository();
    const { result } = renderHook(() =>
      useObservableAnalysisSnapshot({
        query,
        relatedRegionCodes: ["230200", "230221"],
        repository: source.api,
      }),
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(source.loadObservableAnalysisSnapshot).toHaveBeenCalledTimes(1);

    act(() => source.emit(event(13, "SOYBEAN", ["230200"])));
    act(() => source.emit(event(14, "CORN", ["231100"])));
    act(() => source.emit(event(12, "CORN", ["230200"])));
    expect(source.loadObservableAnalysisSnapshot).toHaveBeenCalledTimes(1);

    act(() => source.emit(event(15, "CORN", ["230221"])));
    await waitFor(() =>
      expect(source.loadObservableAnalysisSnapshot).toHaveBeenCalledTimes(2),
    );
  });

  it("performs a full refetch on a cursor gap and keeps the last snapshot visible while disconnected", async () => {
    const source = repository();
    const { result, unmount } = renderHook(() =>
      useObservableAnalysisSnapshot({ query, repository: source.api }),
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => source.emit(event(20, "CORN", ["230200"])));
    await waitFor(() =>
      expect(source.loadObservableAnalysisSnapshot).toHaveBeenCalledTimes(2),
    );
    expect(result.current.cursorGapDetected).toBe(true);

    act(() => source.fail());
    expect(result.current.status).toBe("reconnecting");
    expect(result.current.snapshot?.analysisVersion).toMatch(/^sha256:/u);

    unmount();
    expect(source.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("distinguishes an approved empty result from a failed request", async () => {
    const source = repository();
    source.loadObservableAnalysisSnapshot.mockResolvedValueOnce({
      ...validSnapshot(),
      qualityState: "NO_APPROVED_DATA" as const,
    });
    const { result } = renderHook(() =>
      useObservableAnalysisSnapshot({ query, repository: source.api }),
    );

    await waitFor(() => expect(result.current.status).toBe("empty"));
    expect(result.current.error).toBeNull();
  });
});

function event(
  sequence: number,
  productCode: string,
  regionCodes: readonly string[],
): BusinessNotificationRow {
  return {
    id: `event-${sequence}`,
    sequence,
    aggregateType: "PRODUCTION_RECORD",
    aggregateId: `record-${sequence}`,
    actionCode: "PRODUCTION_RECORD_APPROVED",
    productCode,
    regionCodes,
    occurredAt: "2026-08-16T12:00:00+08:00",
    read: false,
  };
}
