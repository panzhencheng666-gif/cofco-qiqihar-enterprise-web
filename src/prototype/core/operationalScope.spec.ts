import { describe, expect, it } from "vitest";
import { readOperationalScope } from "./operationalScope";

const authorization = {
  workUnit: {
    organizationId: "qiqihar-operation",
    unitId: "operation-hq",
    label: "齐齐哈尔经营部本部",
  },
  identity: { userId: "wang-yang", postId: "regional-data-admin" },
  authorization: {
    authorizedRegionIds: ["qiqihar-all", "qiqihar-nehe"],
    authorizedBusinessClassificationIds: ["production.planting-production"],
    authorizedProductIds: ["corn"],
    authorizedCultivarIds: ["jingke-968"],
    authorizedReleaseVersionIds: ["METRIC-2026-W31-V3"],
    permissionKeys: ["prototype:read"],
  },
} as const;

describe("operational scope", () => {
  it("reads authorized coordinates without confusing work unit and region", () => {
    expect(
      readOperationalScope(
        "?region=authorized-all&product=corn&period=2026-W31",
        authorization,
      ).scope.coordinates,
    ).toEqual({
      regionId: "authorized-all",
      productId: "corn",
      periodKey: "2026-W31",
    });
  });

  it("keeps an unauthorized region visible but prevents querying it", () => {
    const invalidScope = readOperationalScope(
      "?region=not-authorized",
      authorization,
    );

    expect(invalidScope.scope.coordinates).toEqual({
      regionId: "authorized-all",
    });
    expect(invalidScope.issues).toEqual([
      { code: "unknown-or-unauthorized-region", value: "not-authorized" },
    ]);
    expect(invalidScope.queryAllowed).toBe(false);
  });
});
