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
    expect(screen.getByLabelText("企业简称")).toBeVisible();
    expect(screen.getByLabelText("主要能力")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "暗色模式" })).toBeVisible();
    expect(
      screen.getByRole("region", { name: "虚拟滚动表格" }),
    ).toHaveTextContent("120 条模拟记录");
  });
});
