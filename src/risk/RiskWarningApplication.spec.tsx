import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as RealtimeApiClientModule from "@/platform/api/realtimeApiClient";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";
import * as automaticLogin from "@/business/automaticLogin";
import { RiskWarningApplication } from "./RiskWarningApplication";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/platform/api/realtimeApiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof RealtimeApiClientModule>();
  return {
    ...actual,
    createRealtimeApiClient: () => ({
      get,
      post: vi.fn(),
    }),
  };
});

afterEach(() => {
  cleanup();
  get.mockReset();
  vi.restoreAllMocks();
});

describe("RiskWarningApplication navigation", () => {
  it("returns to the platform application center instead of the workbench", () => {
    get.mockRejectedValue(new Error("offline"));
    render(<RiskWarningApplication />);

    expect(
      screen.getByRole("link", { name: "返回平台应用中心" }),
    ).toHaveAttribute("href", "/#/applications");
    expect(screen.getByRole("link", { name: "返回应用中心" })).toHaveAttribute(
      "href",
      "/#/applications",
    );
  });

  it("starts unified login and returns to the risk application when no session exists", async () => {
    get.mockRejectedValue(
      new RealtimeApiError({
        code: "AUTHENTICATION_REQUIRED",
        message: "请先登录",
        status: 401,
      }),
    );
    const redirect = vi
      .spyOn(automaticLogin, "redirectToEnterpriseLogin")
      .mockReturnValue(true);

    render(<RiskWarningApplication />);

    await waitFor(() =>
      expect(redirect).toHaveBeenCalledWith(
        "/api/v1/session/login?returnTo=%2Frisk%2F",
      ),
    );
    expect(screen.getByRole("status")).toHaveTextContent("正在进入登录界面");
  });
});
