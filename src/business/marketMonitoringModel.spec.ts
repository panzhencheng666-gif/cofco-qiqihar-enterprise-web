import { describe, expect, it } from "vitest";
import {
  getApplicableFieldGroups,
  getMarketCompletion,
  marketLifecycleLabels,
  marketRoleLabels,
  type MarketRole,
  type MarketTask,
} from "./marketMonitoringModel";

describe("market collection presentation model", () => {
  it("shows rice-mill purchase, quality, processing, inventory and sales together", () => {
    expect(
      getApplicableFieldGroups("rice-mill", "paddy").map((group) => group.key),
    ).toEqual(["purchase", "quality", "processing", "inventory", "sales"]);
  });

  it("keeps road logistics separate from subject prices", () => {
    expect(
      getApplicableFieldGroups("road-node", "corn").map((group) => group.key),
    ).toEqual(["movement", "evidence"]);
  });

  it("keeps agricultural-input monitoring outside grain quality and supply fields", () => {
    expect(
      getApplicableFieldGroups("agri-dealer", "agri-input").map(
        (group) => group.key,
      ),
    ).toEqual(["sales", "inventory"]);
  });

  it("keeps every confirmed market role in a usable field template", () => {
    const roles = Object.keys(marketRoleLabels) as MarketRole[];

    expect(roles).toHaveLength(13);
    roles.forEach((role) => {
      expect(
        getApplicableFieldGroups(
          role,
          role === "agri-dealer" ? "agri-input" : "corn",
        ).length,
      ).toBeGreaterThan(0);
    });
  });

  it("calculates completion from applicable fields only", () => {
    const task: MarketTask = {
      id: "task-1",
      workId: "WORK-MARKET-TEST",
      target: "subject",
      targetName: "讷河恒泰米业",
      role: "rice-mill",
      grain: "paddy",
      region: "讷河市",
      owner: "王洋",
      deadline: "今天 17:00",
      status: "填写中",
      completedFields: 18,
      applicableFields: 24,
    };

    expect(getMarketCompletion(task)).toBe(75);
  });

  it("describes a superseded release as a later published result", () => {
    expect(marketLifecycleLabels.release.superseded).toBe(
      "已由后续发布结果替代",
    );
    expect(marketLifecycleLabels.release.superseded).not.toContain("新版本");
  });
});
