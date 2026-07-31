import { describe, expect, it } from "vitest";
import {
  businessClassifications,
  businessClassificationOptionSources,
  requiredBusinessClassificationIds,
} from "./businessClassification";
import { businessClassificationFixtures } from "../formalEnterpriseData";

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

  it("shares the catalog option sources with real workspace fixtures", () => {
    expect(businessClassificationFixtures.workItems).toBe(
      businessClassificationOptionSources.workItems,
    );
    expect(businessClassificationFixtures.executiveFilters).toBe(
      businessClassificationOptionSources.executiveFilters,
    );
    expect(businessClassificationFixtures.productionAnalysis).toBe(
      businessClassificationOptionSources.productionAnalysis,
    );
    expect(businessClassificationFixtures.marketAnalysis).toBe(
      businessClassificationOptionSources.marketAnalysis,
    );
    expect(businessClassificationFixtures.supplyAnalysis).toBe(
      businessClassificationOptionSources.supplyAnalysis,
    );
    expect(businessClassificationFixtures.reportCompatibility).toBe(
      businessClassificationOptionSources.reportCompatibility,
    );
  });
});
