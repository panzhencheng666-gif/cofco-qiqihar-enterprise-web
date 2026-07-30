import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { EnterpriseShell } from "./EnterpriseShell";
import { renderWithApp } from "@/testing/renderWithApp";

afterEach(cleanup);

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

  it("opens the owning module on a direct child route and still allows manual collapse", async () => {
    const user = userEvent.setup();
    renderWithApp(
      <EnterpriseShell>
        <div>市场任务页面</div>
      </EnterpriseShell>,
      { initialEntries: ["/market/tasks"] },
    );

    const marketModule = screen.getByRole("button", { name: "市场监测" });
    expect(marketModule).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "我的任务" })).toBeVisible();

    await user.click(marketModule);

    expect(marketModule).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: "我的任务" }),
    ).not.toBeInTheDocument();
  });
});
