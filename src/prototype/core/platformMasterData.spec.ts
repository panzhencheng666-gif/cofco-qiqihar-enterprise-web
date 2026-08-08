import { describe, expect, it } from "vitest";
import { businessClassifications } from "./businessClassification";
import {
  filterPlatformMasterDataByAuthorization,
  getApplicableCultivars,
  getApplicablePeriodTypes,
  getApplicableReleaseBatches,
  isCultivarApplicableToProduct,
  isPeriodTypeApplicableToBusiness,
  isReleaseBatchApplicableToBusiness,
  platformMasterData,
  prototypeMasterDataAuthorization,
  type PlatformProductId,
} from "./platformMasterData";
import { prototypeOperationalIdentity } from "../formalEnterpriseData";

describe("platform master data", () => {
  it("owns the complete region hierarchy independently from user authorization", () => {
    expect(platformMasterData.regionGroups.map(({ id }) => id)).toEqual([
      "qiqihar",
      "heihe",
      "hulunbuir",
    ]);
    expect(
      platformMasterData.regionGroups.flatMap(({ regions }) => regions),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "qiqihar-baiquan",
          parentId: "qiqihar",
        }),
        expect.objectContaining({ id: "heihe-xunke", parentId: "heihe" }),
        expect.objectContaining({
          id: "hulunbuir-oroqen",
          parentId: "hulunbuir",
        }),
      ]),
    );
  });

  it("keeps all governed business domains and classifications in one catalog", () => {
    expect(platformMasterData.businessDomains.map(({ id }) => id)).toEqual([
      "production",
      "market",
      "supply",
      "operations",
      "reporting",
    ]);
    expect(platformMasterData.businessClassifications).toEqual(
      businessClassifications,
    );
  });

  it("contains the four primary grain products and multiple cultivars for each", () => {
    const primaryProductIds: PlatformProductId[] = [
      "corn",
      "soybean",
      "paddy",
      "wheat",
    ];
    expect(platformMasterData.products.map(({ id }) => id)).toEqual(
      expect.arrayContaining(primaryProductIds),
    );

    for (const productId of primaryProductIds) {
      const cultivars = getApplicableCultivars(productId);
      expect(cultivars.length, productId).toBeGreaterThanOrEqual(2);
      expect(
        cultivars.every(({ applicableProductIds }) =>
          applicableProductIds.includes(productId),
        ),
        productId,
      ).toBe(true);
    }
  });

  it("never falls back to another product cultivar when the selection is unknown or mismatched", () => {
    expect(getApplicableCultivars("unknown-product")).toEqual([]);
    expect(isCultivarApplicableToProduct("corn", "longjing-31")).toBe(false);
    expect(isCultivarApplicableToProduct("unknown-product", "jingke-968")).toBe(
      false,
    );
  });

  it("maps each business classification to explicit Chinese period types", () => {
    expect(
      getApplicablePeriodTypes("market.quote-trade").map(({ label }) => label),
    ).toEqual(expect.arrayContaining(["日度", "周度", "月度"]));
    expect(
      getApplicablePeriodTypes("supply.supply").map(({ label }) => label),
    ).toContain("营销年度");
    expect(
      isPeriodTypeApplicableToBusiness("supply.supply", "marketing-year"),
    ).toBe(true);
    expect(isPeriodTypeApplicableToBusiness("supply.supply", "day")).toBe(
      false,
    );
    expect(getApplicablePeriodTypes("unknown-business")).toEqual([]);
  });

  it("maps internal batch ids to Chinese business labels without exposing the ids as labels", () => {
    expect(platformMasterData.releaseBatches.length).toBeGreaterThanOrEqual(5);
    for (const batch of platformMasterData.releaseBatches) {
      expect(batch.label).toMatch(/[\u4e00-\u9fff]/);
      expect(batch.label).not.toContain(batch.id);
    }

    expect(
      getApplicableReleaseBatches("production.planting-production").map(
        ({ id }) => id,
      ),
    ).toContain("METRIC-2026-W31-V3");
    expect(
      isReleaseBatchApplicableToBusiness(
        "supply.supply",
        "SUPPLY-2026-MY-APPROVED",
      ),
    ).toBe(true);
    expect(
      isReleaseBatchApplicableToBusiness(
        "market.quote-trade",
        "SUPPLY-2026-MY-APPROVED",
      ),
    ).toBe(false);
    expect(getApplicableReleaseBatches("unknown-business")).toEqual([]);
  });

  it("uses authorization only to crop the catalog and never mutates the catalog", () => {
    const originalRegionCount = platformMasterData.regionGroups.flatMap(
      ({ regions }) => regions,
    ).length;
    const authorized = filterPlatformMasterDataByAuthorization({
      authorizedRegionIds: ["qiqihar-nehe"],
      authorizedBusinessClassificationIds: ["market.quote-trade"],
      authorizedProductIds: ["corn"],
      authorizedCultivarIds: ["jingke-968", "longjing-31"],
      authorizedReleaseVersionIds: ["METRIC-2026-W31-V3"],
    });

    expect(authorized.regionGroups.flatMap(({ regions }) => regions)).toEqual([
      expect.objectContaining({ id: "qiqihar-nehe" }),
    ]);
    expect(authorized.products.map(({ id }) => id)).toEqual(["corn"]);
    expect(authorized.cultivars.map(({ id }) => id)).toEqual(["jingke-968"]);
    expect(authorized.businessClassifications.map(({ id }) => id)).toEqual([
      "market.quote-trade",
    ]);
    expect(authorized.releaseBatches.map(({ id }) => id)).toEqual([
      "METRIC-2026-W31-V3",
    ]);
    expect(
      platformMasterData.regionGroups.flatMap(({ regions }) => regions),
    ).toHaveLength(originalRegionCount);
  });

  it("provides a multi-region multi-product default authorization with only applicable cultivars and batches", () => {
    const governedRegionIds = platformMasterData.regionGroups.flatMap(
      ({ regions }) => regions.map(({ id }) => id),
    );
    expect(prototypeMasterDataAuthorization.authorizedRegionIds.length).toBe(
      governedRegionIds.length,
    );
    expect(prototypeMasterDataAuthorization.authorizedRegionIds).toEqual(
      governedRegionIds,
    );
    expect(prototypeMasterDataAuthorization.authorizedProductIds).toEqual(
      expect.arrayContaining(["corn", "soybean", "paddy", "wheat"]),
    );
    expect(prototypeMasterDataAuthorization.authorizedProductIds).toEqual(
      platformMasterData.products.map(({ id }) => id),
    );
    expect(
      prototypeMasterDataAuthorization.authorizedReleaseVersionIds.length,
    ).toBeGreaterThan(1);

    for (const cultivarId of prototypeMasterDataAuthorization.authorizedCultivarIds) {
      expect(
        prototypeMasterDataAuthorization.authorizedProductIds.some(
          (productId) => isCultivarApplicableToProduct(productId, cultivarId),
        ),
        cultivarId,
      ).toBe(true);
    }

    expect(prototypeOperationalIdentity.authorization).toMatchObject(
      prototypeMasterDataAuthorization,
    );
  });
});
