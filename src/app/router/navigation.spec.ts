import { describe, expect, it } from "vitest";
import { projectNavigation } from "./navigation";

describe("enterprise navigation", () => {
  it("only exposes implemented capabilities granted by the workspace", () => {
    const navigation = projectNavigation([
      "my-work:view",
      "business-overview:view",
      "production-monitoring:view",
      "market-monitoring:view",
      "supply-situation:view",
      "data-governance:view",
      "system-administration:view",
      "account-security:view",
    ]);

    expect(navigation.map((item) => item.label)).toEqual([
      "我的工作",
      "经营总览",
      "产情监测",
      "市场监测",
      "供需与态势",
      "数据治理",
      "系统管理",
    ]);
    expect(navigation.map((item) => item.label)).not.toContain("账号与安全");
  });

  it("does not expose an implemented page without the required capability", () => {
    expect(projectNavigation([])).toEqual([]);
  });

  it("does not put technical compatibility pages in business navigation", () => {
    const labels = projectNavigation([
      "my-work:view",
      "account-security:view",
    ]).map((item) => item.label);

    expect(labels).not.toContain("技术兼容门禁");
  });

  it("keeps market facts complete without binding inventory to processing or duplicating quality and price", () => {
    const market = projectNavigation(["market-monitoring:view"]).find(
      (item) => item.key === "market-monitoring",
    );

    expect(market?.contextItems.map((item) => item.label)).toEqual([
      "监测总览",
      "市场主体全景",
      "行情与交易",
      "库存与仓储",
      "加工与转化",
      "物流流向",
      "农资市场",
    ]);
    expect(market?.contextItems.map((item) => item.label)).not.toContain(
      "库存与加工",
    );
    expect(market?.contextItems.map((item) => item.label)).not.toContain(
      "质量与价格",
    );
  });
});
