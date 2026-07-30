import { navigationItems } from "./navigation";
import { describe, expect, it } from "vitest";

describe("enterprise navigation", () => {
  it("contains the eight approved top-level modules exactly once", () => {
    expect(navigationItems.map((item) => item.label)).toEqual([
      "经营总览",
      "产情监测",
      "市场监测",
      "供需平衡",
      "态势监控",
      "审核中心",
      "数据治理",
      "系统管理",
    ]);
  });

  it("preserves real-time monitoring and the regional map", () => {
    const monitoring = navigationItems.find(
      (item) => item.label === "态势监控",
    );

    expect(monitoring?.children?.map((item) => item.label)).toEqual([
      "实时监控平台",
      "区域地图",
    ]);
  });
});
