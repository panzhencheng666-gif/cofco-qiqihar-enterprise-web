import { describe, expect, it } from "vitest";

import { createFormalRoute } from "../formalEnterpriseModel";
import { getProductWorkspaceContext } from "./productWorkspaceContext";

describe("productWorkspaceContext", () => {
  it.each([
    ["production", "corn-collection", "corn", "玉米产情填报"],
    ["production", "soybean-collection", "soybean", "大豆产情填报"],
    ["production", "rice-collection", "paddy", "稻谷产情填报"],
    ["market", "corn-collection", "corn", "玉米市场采集"],
    ["market", "soybean-collection", "soybean", "大豆市场采集"],
    ["market", "paddy-collection", "paddy", "稻谷市场采集"],
    ["supply", "corn-balance", "corn", "玉米供需平衡"],
    ["supply", "soybean-balance", "soybean", "大豆供需平衡"],
    ["supply", "paddy-balance", "paddy", "稻谷供需平衡"],
  ] as const)(
    "maps %s/%s to its product context",
    (application, section, productId, titleStem) => {
      expect(
        getProductWorkspaceContext(createFormalRoute(application, section)),
      ).toMatchObject({ productId, titleStem });
    },
  );

  it("keeps non-product workspaces free from an implied product", () => {
    expect(
      getProductWorkspaceContext(createFormalRoute("overview", "operations")),
    ).toBeNull();
    expect(
      getProductWorkspaceContext(createFormalRoute("reporting", "compose")),
    ).toBeNull();
  });
});
