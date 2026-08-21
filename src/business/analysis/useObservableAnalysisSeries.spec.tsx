import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { validSnapshot } from "@/platform/api/observableAnalysisContract.fixture";
import type { ObservableAnalysisQuery } from "@/platform/api/observableAnalysisContract";
import { useObservableAnalysisSeries } from "./useObservableAnalysisSeries";

afterEach(cleanup);

const query: ObservableAnalysisQuery = {
  productCode: "CORN",
  regionCode: "230200",
  surveyYear: 2025,
  surveyMonth: 9,
};

function source() {
  const loadObservableAnalysisSnapshot = vi.fn(
    (next: ObservableAnalysisQuery) =>
      Promise.resolve({
        ...validSnapshot(),
        scope: {
          ...validSnapshot().scope,
          surveyYear: next.surveyYear,
          surveyMonth: next.surveyMonth ?? null,
        },
        production: {
          ...validSnapshot().production,
          metrics: [
            {
              code: "EXPECTED_OUTPUT",
              label: "预计总产",
              value: `${next.surveyMonth}.0000`,
              unit: "吨",
              aggregation: "SUM",
              sourceCount: next.surveyMonth ?? 0,
              missingReason: null,
            },
          ],
        },
      }),
  );
  return { loadObservableAnalysisSnapshot };
}

describe("observable analysis annual series", () => {
  it("loads twelve server-calculated monthly snapshots without changing their values", async () => {
    const repository = source();
    const { result } = renderHook(() =>
      useObservableAnalysisSeries({ query, repository }),
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(repository.loadObservableAnalysisSnapshot).toHaveBeenCalledTimes(12);
    expect(repository.loadObservableAnalysisSnapshot).toHaveBeenNthCalledWith(
      1,
      { ...query, surveyMonth: 1 },
    );
    expect(repository.loadObservableAnalysisSnapshot).toHaveBeenNthCalledWith(
      12,
      { ...query, surveyMonth: 12 },
    );
    expect(result.current.points[8]).toMatchObject({
      month: 9,
      error: null,
      snapshot: {
        production: {
          metrics: [{ value: "9.0000", sourceCount: 9 }],
        },
      },
    });
  });

  it("keeps a failed month distinct from an approved month with no data", async () => {
    const repository = source();
    repository.loadObservableAnalysisSnapshot.mockImplementation(
      (next: ObservableAnalysisQuery) => {
        if (next.surveyMonth === 2) return Promise.reject(new Error("offline"));
        if (next.surveyMonth === 3) {
          return Promise.resolve({
            ...validSnapshot(),
            scope: {
              ...validSnapshot().scope,
              surveyYear: next.surveyYear,
              surveyMonth: 3,
            },
            qualityState: "NO_APPROVED_DATA",
            dataCutoffAt: null,
            coverage: {
              recordCount: 0,
              uniqueSubjectCount: 0,
              coveredRegionCount: 0,
              excludedRecordCount: 0,
              pendingReviewRecordCount: 0,
            },
            production: { metrics: [], sourceBalances: [] },
            market: { metrics: [] },
            logistics: { metrics: [] },
            lineage: [],
          });
        }
        return source().loadObservableAnalysisSnapshot(next);
      },
    );

    const { result } = renderHook(() =>
      useObservableAnalysisSeries({ query, repository }),
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.points[1]).toMatchObject({
      month: 2,
      snapshot: null,
      error: "该月数据暂时无法读取",
    });
    expect(result.current.points[2]).toMatchObject({
      month: 3,
      error: null,
      snapshot: { qualityState: "NO_APPROVED_DATA" },
    });
    expect(result.current.failedMonthCount).toBe(1);
  });

  it("reloads the year when its refresh key changes", async () => {
    const repository = source();
    const { result, rerender } = renderHook(
      ({ refreshKey }) =>
        useObservableAnalysisSeries({ query, refreshKey, repository }),
      { initialProps: { refreshKey: "version-1" } },
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(repository.loadObservableAnalysisSnapshot).toHaveBeenCalledTimes(12);

    rerender({ refreshKey: "version-2" });
    await waitFor(() =>
      expect(repository.loadObservableAnalysisSnapshot).toHaveBeenCalledTimes(
        24,
      ),
    );
  });
});
