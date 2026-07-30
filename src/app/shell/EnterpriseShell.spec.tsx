import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EnterpriseShell } from "./EnterpriseShell";
import { renderWithApp } from "@/testing/renderWithApp";

describe("EnterpriseShell", () => {
  it("shows the company system identity and approved navigation", () => {
    renderWithApp(
      <EnterpriseShell>
        <div>页面内容</div>
      </EnterpriseShell>,
    );

    expect(screen.getByText("齐齐哈尔粮食商情企业系统")).toBeVisible();
    expect(screen.getByText("产情监测")).toBeVisible();
    expect(screen.getByText("市场监测")).toBeVisible();
    expect(screen.getByText("供需平衡")).toBeVisible();
  });
});
