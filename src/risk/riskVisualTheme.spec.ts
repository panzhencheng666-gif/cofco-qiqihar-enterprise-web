import { describe, expect, it } from "vitest";
import { riskAntTheme, riskVisualTokens } from "./riskVisualTheme";

describe("risk visual theme", () => {
  it("uses a light low-fatigue canvas and one interaction accent", () => {
    expect(riskVisualTokens).toMatchObject({
      canvas: "#ffffff",
      surface: "#f4f6f8",
      primary: "#0f62fe",
      text: "#161616",
    });
    expect(riskAntTheme.token).toMatchObject({
      colorBgBase: riskVisualTokens.canvas,
      colorPrimary: riskVisualTokens.primary,
      colorText: riskVisualTokens.text,
      borderRadius: 2,
      fontSize: 14,
    });
  });

  it("reserves semantic colors for real service and risk states", () => {
    expect(riskVisualTokens.success).not.toBe(riskVisualTokens.primary);
    expect(riskVisualTokens.warning).not.toBe(riskVisualTokens.primary);
    expect(riskVisualTokens.error).not.toBe(riskVisualTokens.primary);
    expect(riskAntTheme.token?.colorError).toBe(riskVisualTokens.error);
  });
});
