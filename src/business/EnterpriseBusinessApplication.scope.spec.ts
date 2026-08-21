import { describe, expect, it } from "vitest";
import { resolveRealtimeAnalysisRegionCode } from "./EnterpriseBusinessApplication";
import { ALL_AUTHORIZED_REGION_CODE } from "@/platform/api/observableAnalysisContract";

describe("realtime analysis region scope", () => {
  it("preserves the all-authorized scope instead of narrowing it to Qiqihar", () => {
    expect(resolveRealtimeAnalysisRegionCode("authorized-all")).toBe(
      ALL_AUTHORIZED_REGION_CODE,
    );
    expect(resolveRealtimeAnalysisRegionCode("qiqihar-all")).toBe("230200");
  });
});
