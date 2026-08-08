import { describe, expect, it } from "vitest";

import {
  getAuthorizedRegionChildren,
  getAuthorizedRegionsByLevel,
  getEnterpriseRegionPath,
} from "./enterpriseRegionHierarchy";

describe("enterpriseRegionHierarchy", () => {
  it("builds a readable administrative path from the verified fixture", () => {
    expect(
      getEnterpriseRegionPath("qiqihar-nehe-tongyi").map(({ label }) => label),
    ).toEqual(["黑龙江省", "齐齐哈尔市", "讷河市", "同义镇"]);
  });

  it("continues the operational sample path from township to administrative village", () => {
    expect(
      getAuthorizedRegionChildren("qiqihar-nehe-tongyi", ["qiqihar-nehe"]).map(
        ({ label }) => label,
      ),
    ).toEqual(["保国村", "庆宝村"]);
    expect(
      getEnterpriseRegionPath("qiqihar-nehe-tongyi-baoguo").map(
        ({ label }) => label,
      ),
    ).toEqual(["黑龙江省", "齐齐哈尔市", "讷河市", "同义镇", "保国村"]);
  });

  it("returns only authorized county children", () => {
    expect(getAuthorizedRegionChildren("qiqihar", ["qiqihar-nehe"])).toEqual([
      expect.objectContaining({
        id: "qiqihar-nehe",
        label: "讷河市",
        level: "county",
      }),
    ]);
    expect(
      getAuthorizedRegionChildren("qiqihar", ["qiqihar-nehe"]),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "qiqihar-longjiang" }),
      ]),
    );
  });

  it("derives authorized cities from their authorized descendants", () => {
    expect(
      getAuthorizedRegionsByLevel("prefecture", ["qiqihar-nehe"]).map(
        ({ label }) => label,
      ),
    ).toEqual(["齐齐哈尔市"]);
  });
});
