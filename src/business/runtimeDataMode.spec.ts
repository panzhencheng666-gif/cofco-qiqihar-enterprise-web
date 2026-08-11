import { describe, expect, expectTypeOf, it } from "vitest";
import { resolveRuntimeDataMode } from "./runtimeDataMode";

describe("formal prototype runtime data mode", () => {
  it("exposes only the supported API and fixtures environment values", () => {
    expectTypeOf<
      NonNullable<ImportMetaEnv["VITE_REALTIME_DATA_MODE"]>
    >().toEqualTypeOf<"api" | "fixtures">();
  });

  it.each([
    [undefined, "production"],
    ["api", "production"],
    ["fixtures", "production"],
    [undefined, "development"],
    ["demo", "development"],
  ] as const)(
    "uses the API for requested mode %s in %s",
    (requestedMode, environmentMode) => {
      expect(resolveRuntimeDataMode({ environmentMode, requestedMode })).toBe(
        "api",
      );
    },
  );

  it.each(["development", "test"] as const)(
    "allows fixtures only when explicitly requested in %s",
    (environmentMode) => {
      expect(
        resolveRuntimeDataMode({
          environmentMode,
          requestedMode: "fixtures",
        }),
      ).toBe("fixtures");
    },
  );
});
