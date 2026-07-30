import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppErrorBoundary } from "./AppErrorBoundary";

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
});
