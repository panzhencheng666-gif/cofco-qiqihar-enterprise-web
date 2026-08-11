import { afterEach, describe, expect, it, vi } from "vitest";
import { formatFixedDecimal } from "../core/fixedDecimal";
import { getEnterpriseRegionOptions } from "../enterpriseRegions";
import {
  executiveAggregateRegionMembershipFixtures,
  executiveSupplyReleasePoints,
} from "./executiveLedgerFixtures";

afterEach(() => {
  vi.doUnmock("./supplyAccountSnapshot");
  vi.resetModules();
});

describe("executive ledger aggregate membership fixtures", () => {
  it("keeps aggregate membership explicit, coordinate-bound, and duplicate-free", () => {
    const governedRegionIds = new Set(
      getEnterpriseRegionOptions().map(({ id }) => id),
    );
    expect(executiveAggregateRegionMembershipFixtures.length).toBeGreaterThan(
      0,
    );

    for (const fixture of executiveAggregateRegionMembershipFixtures) {
      expect(fixture.aggregateRegionId).toBe("authorized-all");
      expect(fixture.periodKey).not.toBe("");
      expect(["official", "preliminary"]).toContain(fixture.dataLayer);
      expect(fixture.releaseVersion).not.toBe("");
      expect(fixture.regionBoundaryVersionId).not.toBe("");
      expect(fixture.memberRegionIds).not.toContain("authorized-all");
      expect(new Set(fixture.memberRegionIds).size).toBe(
        fixture.memberRegionIds.length,
      );
      expect(
        fixture.memberRegionIds.every((regionId) =>
          governedRegionIds.has(regionId),
        ),
      ).toBe(true);
    }
  });

  it("keeps the executive total-supply trend aligned with the formal supply account", () => {
    expect(
      executiveSupplyReleasePoints.map((point) =>
        point.availability === "available"
          ? formatFixedDecimal(point.value, 1)
          : null,
      ),
    ).toEqual(["701.4", "722.8", "739.6", "763.1"]);
  });

  it("derives the executive total-supply trend from the supply account snapshot", async () => {
    vi.resetModules();
    vi.doMock("./supplyAccountSnapshot", () => ({
      qiqiharCornSupplyAccountSnapshot: {
        comparisonRows: [
          {
            label: "总供给",
            values: [611.1, 622.2, 633.3, 644.4],
          },
        ],
      },
    }));

    const { executiveSupplyReleasePoints: derivedPoints } =
      await import("./executiveLedgerFixtures");

    expect(
      derivedPoints.map((point) =>
        point.availability === "available"
          ? formatFixedDecimal(point.value, 1)
          : null,
      ),
    ).toEqual(["611.1", "622.2", "633.3", "644.4"]);
  });
});
