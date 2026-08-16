import { describe, expect, it } from "vitest";

import type { RealtimeApiError } from "./realtimeApiClient";
import { parseObservableAnalysisSnapshot } from "./observableAnalysisContract";
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
    "unknown top-level contract",
    (snapshot) => ({ ...snapshot, legacySupplyAccount: {} }),
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
  });

  it.each(invalidSnapshots)("rejects %s", (_label, mutate) => {
    expect(() => parseObservableAnalysisSnapshot(mutate(validSnapshot()))).toThrowError(
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
});
