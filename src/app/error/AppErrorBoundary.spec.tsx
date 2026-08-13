import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppErrorBoundary, reportRenderFailure } from "./AppErrorBoundary";

function BrokenPage(): never {
  throw new Error("页面加载失败");
}

describe("AppErrorBoundary", () => {
  it("shows a recoverable failure instead of a blank screen", () => {
    render(
      <AppErrorBoundary>
        <BrokenPage />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("当前页面暂时无法显示");
    expect(screen.getByRole("button", { name: "重新加载页面" })).toBeEnabled();
  });

  it("reports only a fixed event code without serializing render details", () => {
    const logger = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    reportRenderFailure();

    expect(logger).toHaveBeenCalledOnce();
    expect(logger).toHaveBeenCalledWith("page-render-failure");
    logger.mockRestore();
  });
});
