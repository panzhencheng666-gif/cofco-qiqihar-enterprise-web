import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EnterpriseBusinessErrorBoundary } from "./EnterpriseBusinessErrorBoundary";

function BrokenWorkspace(): never {
  throw new Error("BUILD_INTERNAL_42 /Users/example/source.tsx");
}

describe("EnterpriseBusinessErrorBoundary", () => {
  it("shows a stable Chinese business message without technical details", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <EnterpriseBusinessErrorBoundary>
        <BrokenWorkspace />
      </EnterpriseBusinessErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "当前页面暂时无法显示，请重新加载或联系系统管理员",
    );
    expect(document.body).not.toHaveTextContent(/BUILD|source\.tsx|Users/);
    error.mockRestore();
  });
});
