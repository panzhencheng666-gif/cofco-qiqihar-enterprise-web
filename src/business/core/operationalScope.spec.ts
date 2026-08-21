import { describe, expect, it } from "vitest";
import { readOperationalScope } from "./operationalScope";
import {
  formalSectionsByApplication,
  getDefaultFormalSection,
  readFormalLocation,
} from "../formalEnterpriseModel";

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
    permissionKeys: ["enterprise:fixtures:read"],
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

  it("keeps a product selected from server-authoritative work items", () => {
    const realtimeIdentity = {
      ...authorization,
      authorization: {
        ...authorization.authorization,
        serverAuthoritative: true,
        authorizedProductIds: [],
      },
    } as const;

    const result = readOperationalScope("?product=soybean", realtimeIdentity);

    expect(result.scope.coordinates.productId).toBe("soybean");
    expect(result.issues).toEqual([]);
    expect(result.queryAllowed).toBe(true);
  });

  it("ignores business coordinates injected into every visible application URL", () => {
    const invalidQueries = [
      ["businessSubtype", "not-authorized"],
      ["product", "not-authorized"],
      ["cultivar", "not-authorized"],
      ["dataLayer", "invalid"],
      ["releaseVersion", "not-authorized"],
    ] as const;

    for (const application of Object.keys(formalSectionsByApplication) as Array<
      keyof typeof formalSectionsByApplication
    >) {
      for (const [key, value] of invalidQueries) {
        const result = readFormalLocation(
          `?page=${application}&section=${getDefaultFormalSection(application)}&${key}=${value}`,
          authorization,
        );
        expect(result.queryAllowed).toBe(true);
        expect(result.issues).toEqual([]);
        expect(result.location.coordinates).toEqual({
          regionId: "authorized-all",
        });
      }
    }
  });
});
