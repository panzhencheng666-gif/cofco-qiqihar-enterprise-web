import { readFileSync } from "node:fs";
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

  it("routes both realtime supply sections to the authoritative account workspace", () => {
    const source = readFileSync(
      `${process.cwd()}/src/business/EnterpriseBusinessApplication.tsx`,
      "utf8",
    );

    expect(source).toContain(
      'import { SupplyAccountWorkspace } from "./SupplyAccountWorkspace";',
    );
    expect(source).toMatch(
      /<SupplyAccountWorkspace[\s\S]*section=\{\s*location\.route\.section === "records" \? "records" : "balance"\s*\}/,
    );
    expect(source).not.toContain(
      'import { SupplyBalanceWorkspace } from "./SupplyBalanceWorkspace";',
    );
  });
});
