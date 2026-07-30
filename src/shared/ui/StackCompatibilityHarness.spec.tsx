import { App } from "antd";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { StackCompatibilityHarness } from "./StackCompatibilityHarness";

describe("StackCompatibilityHarness", () => {
  it("labels its editable record as simulated compatibility-only data", () => {
    render(
      <App>
        <StackCompatibilityHarness />
      </App>,
    );

    expect(screen.getByText("模拟数据 · 仅用于兼容性验证")).toBeVisible();
  });
});
