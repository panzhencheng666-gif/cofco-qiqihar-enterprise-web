import { describe, expect, it } from "vitest";

import type { RealtimeApiError } from "./realtimeApiClient";
import {
  observableAnalysisLineageKey,
  parseObservableAnalysisSnapshot,
} from "./observableAnalysisContract";
import { validSnapshot } from "./observableAnalysisContract.fixture";

type SnapshotFixture = ReturnType<typeof validSnapshot>;

const invalidSnapshots: ReadonlyArray<
  readonly [string, (snapshot: SnapshotFixture) => unknown]
> = [
  [
    "missing analysis version",
    (snapshot) => {
      const missingVersion: Partial<SnapshotFixture> = { ...snapshot };
      delete missingVersion.analysisVersion;
      return missingVersion;
    },
  ],
  [
    "invalid quality state",
    (snapshot) => ({ ...snapshot, qualityState: "READY" }),
  ],
  [
    "non-string formal decimal",
    (snapshot) => ({
      ...snapshot,
      supply: {
        calculation: {
          ...snapshot.supply.calculation,
          expectedOutputTonnes: 50,
        },
      },
    }),
  ],
  [
    "missing backend supply total",
    (snapshot) => {
      const calculation: Partial<SnapshotFixture["supply"]["calculation"]> = {
        ...snapshot.supply.calculation,
      };
      delete calculation.totalSupplyTonnes;
      return { ...snapshot, supply: { ...snapshot.supply, calculation } };
    },
  ],
  [
    "unknown top-level contract",
    (snapshot) => ({ ...snapshot, legacySupplyAccount: {} }),
  ],
  [
    "missing inventory breakdown",
    (snapshot) => ({
      ...snapshot,
      supply: { calculation: snapshot.supply.calculation },
    }),
  ],
  [
    "negative pending-review count",
    (snapshot) => ({
      ...snapshot,
      coverage: { ...snapshot.coverage, pendingReviewRecordCount: -1 },
    }),
  ],
  [
    "non-formal inventory decimal",
    (snapshot) => ({
      ...snapshot,
      supply: {
        ...snapshot.supply,
        inventory: {
          ...snapshot.supply.inventory,
          enterpriseEndingTonnes: "10",
        },
      },
    }),
  ],
  [
    "private record identity",
    (snapshot) => ({
      ...snapshot,
      lineage: [{ ...snapshot.lineage[0], recordId: "private-record-1" }],
    }),
  ],
];

describe("observable analysis snapshot contract", () => {
  it("strictly parses one complete approved-fact snapshot", () => {
    const snapshot = validSnapshot();

    expect(parseObservableAnalysisSnapshot(snapshot)).toEqual(snapshot);
    expect(snapshot.coverage.pendingReviewRecordCount).toBe(2);
    expect(snapshot.supply.inventory).toMatchObject({
      productionEndingTonnes: "15.0000",
      enterpriseEndingTonnes: "10.0000",
      adoptedRecordCount: 2,
      reviewGroupCount: 0,
    });
    expect(snapshot.supply.calculation).toMatchObject({
      totalSupplyTonnes: "65.0000",
      totalUseTonnes: "40.0000",
    });
  });

  it("uses a null cutoff only when the approved snapshot has no adopted records", () => {
    const snapshot = validSnapshot();
    const noApprovedData = {
      ...snapshot,
      dataCutoffAt: null,
      coverage: {
        ...snapshot.coverage,
        recordCount: 0,
        uniqueSubjectCount: 0,
        coveredRegionCount: 0,
      },
      lineage: [],
    };

    expect(
      parseObservableAnalysisSnapshot(noApprovedData).dataCutoffAt,
    ).toBeNull();
    expect(() =>
      parseObservableAnalysisSnapshot({ ...snapshot, dataCutoffAt: null }),
    ).toThrowError(
      expect.objectContaining<Partial<RealtimeApiError>>({
        code: "CONTRACT_MISMATCH",
      }),
    );
  });

  it.each(invalidSnapshots)("rejects %s", (_label, mutate) => {
    expect(() =>
      parseObservableAnalysisSnapshot(mutate(validSnapshot())),
    ).toThrowError(
      expect.objectContaining<Partial<RealtimeApiError>>({
        code: "CONTRACT_MISMATCH",
      }),
    );
  });

  it("rejects duplicate lineage and ambiguous missing values", () => {
    const snapshot = validSnapshot();
    expect(() =>
      parseObservableAnalysisSnapshot({
        ...snapshot,
        lineage: [snapshot.lineage[0], snapshot.lineage[0]],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<RealtimeApiError>>({
        code: "CONTRACT_MISMATCH",
      }),
    );
    expect(() =>
      parseObservableAnalysisSnapshot({
        ...snapshot,
        market: {
          metrics: [
            {
              ...snapshot.market.metrics[0],
              value: null,
              missingReason: null,
            },
          ],
        },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<RealtimeApiError>>({
        code: "CONTRACT_MISMATCH",
      }),
    );
  });

  it("keeps distinct approved source rows unique when their visible labels match", () => {
    const first = validSnapshot().lineage[0];
    const laterApproval = {
      ...first,
      approvedAt: "2026-08-07T09:00:00+08:00",
    };
    const otherFacts = {
      ...first,
      factCodes: [...first.factCodes, "PROD_EXPECTED_OUTPUT"],
    };

    expect(observableAnalysisLineageKey(laterApproval)).not.toBe(
      observableAnalysisLineageKey(first),
    );
    expect(observableAnalysisLineageKey(otherFacts)).not.toBe(
      observableAnalysisLineageKey(first),
    );
  });

  it("accepts complete enterprise inventory observation ranges", () => {
    const snapshot = validSnapshot();
    const inventory = {
      ...snapshot.supply.inventory,
      enterpriseOpeningObservedFrom: "2026-07-31",
      enterpriseOpeningObservedThrough: "2026-07-31",
      enterpriseEndingObservedFrom: "2026-08-10",
      enterpriseEndingObservedThrough: "2026-08-31",
    };
    const withObservationDates = {
      ...snapshot,
      supply: { ...snapshot.supply, inventory },
    };

    expect(parseObservableAnalysisSnapshot(withObservationDates)).toEqual(
      withObservationDates,
    );
  });
});
