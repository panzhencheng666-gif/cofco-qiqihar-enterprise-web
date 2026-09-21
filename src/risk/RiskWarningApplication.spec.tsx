import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type * as RealtimeApiClientModule from "@/platform/api/realtimeApiClient";
import { RiskWarningApplication } from "./RiskWarningApplication";

vi.mock("@/platform/api/realtimeApiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof RealtimeApiClientModule>();
  return {
    ...actual,
    createRealtimeApiClient: () => ({
      get: vi.fn().mockRejectedValue(new Error("offline")),
      post: vi.fn(),
    }),
  };
});

describe("RiskWarningApplication navigation", () => {
  it("returns to the platform application center instead of the workbench", () => {
    render(<RiskWarningApplication />);

    expect(
      screen.getByRole("link", { name: "返回平台应用中心" }),
    ).toHaveAttribute("href", "/portal/");
    expect(screen.getByRole("link", { name: "返回应用中心" })).toHaveAttribute(
      "href",
      "/portal/",
    );
  });
});
