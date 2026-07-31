import { describe, expect, it } from "vitest";
import {
  businessClassifications,
  businessClassificationOptionSources,
  requiredBusinessClassificationIds,
} from "./businessClassification";

describe("business classification catalog", () => {
  it("provides each required classification exactly once", () => {
    expect(businessClassifications.map((item) => item.id)).toEqual(
      requiredBusinessClassificationIds,
    );
    expect(new Set(businessClassifications.map((item) => item.id)).size).toBe(
      requiredBusinessClassificationIds.length,
    );
  });

  it("uses catalog identifiers for each task, analysis, and report fixture source", () => {
    const ids = new Set(businessClassifications.map((item) => item.id));
    for (const source of Object.values(businessClassificationOptionSources)) {
      expect(source.every((id) => ids.has(id))).toBe(true);
    }
  });
});
