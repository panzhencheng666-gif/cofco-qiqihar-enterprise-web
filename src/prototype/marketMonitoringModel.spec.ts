import { describe, expect, it } from "vitest";
import {
  getApplicableFieldGroups,
  getMarketCompletion,
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

  it("calculates completion from applicable fields only", () => {
    const task: MarketTask = {
      id: "task-1",
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
});
