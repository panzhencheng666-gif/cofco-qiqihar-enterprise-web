import { describe, expect, it } from "vitest";
import {
  enterpriseRegionGroups,
  getEnterpriseRegion,
  getEnterpriseRegionOptions,
  isStatisticalEnterpriseRegionId,
} from "./enterpriseRegions";

describe("enterprise region catalog", () => {
  it("provides the three monitored regional groups and every in-scope jurisdiction", () => {
    expect(enterpriseRegionGroups.map((group) => group.label)).toEqual([
      "齐齐哈尔市",
      "黑河市",
      "呼伦贝尔指定范围",
    ]);

    const options = getEnterpriseRegionOptions();
    expect(options).toHaveLength(29);
    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "qiqihar-all",
          label: "齐齐哈尔市全域",
        }),
        expect.objectContaining({
          id: "heihe-all",
          label: "黑河市全域",
        }),
        expect.objectContaining({
          id: "hulunbuir-designated",
          label: "呼伦贝尔指定范围",
        }),
      ]),
    );
  });

  it("contains all sixteen Qiqihar county-level jurisdictions", () => {
    const qiqihar = enterpriseRegionGroups.find(
      (group) => group.id === "qiqihar",
    );

    expect(qiqihar?.regions.slice(1)).toHaveLength(16);
    expect(qiqihar?.regions.map((region) => region.label)).toEqual(
      expect.arrayContaining([
        "龙沙区",
        "梅里斯达斡尔族区",
        "讷河市",
        "龙江县",
        "拜泉县",
      ]),
    );
  });

  it("keeps official source status separate and never exposes natural-village scope", () => {
    expect(getEnterpriseRegion("heihe-all").sourceStatus).toBe("已核定");
    expect(getEnterpriseRegion("qiqihar-all").villageCount).toBe("待核定");
    expect(
      getEnterpriseRegionOptions().some((region) =>
        region.label.includes("自然村"),
      ),
    ).toBe(false);
  });

  it("keeps the authorized-all scope separate from statistical regions", () => {
    expect(isStatisticalEnterpriseRegionId("authorized-all")).toBe(false);
    expect(isStatisticalEnterpriseRegionId("qiqihar-nehe")).toBe(true);
  });
});
