import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { formalApplicationDefinitions } from "../formalEnterpriseData";
import { createFormalRoute } from "../formalEnterpriseModel";
import { BusinessNavigationTree } from "./BusinessNavigationTree";

describe("BusinessNavigationTree", () => {
  it("renders the current application as one stable keyboard-operable business tree", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const application = formalApplicationDefinitions.find(
      ({ key }) => key === "production",
    );
    if (!application) throw new Error("missing production application");

    render(
      <BusinessNavigationTree
        application={application}
        currentRoute={createFormalRoute("production", "corn-collection")}
        onNavigate={onNavigate}
      />,
    );

    const navigation = screen.getByRole("navigation", {
      name: "产情监测模块",
    });
    expect(
      within(navigation).getByRole("button", { name: "玉米产情填报" }),
    ).toHaveAttribute("aria-current", "page");
    expect(navigation).toHaveTextContent("大豆产情填报");
    expect(navigation).toHaveTextContent("稻谷产情填报");
    expect(navigation).toHaveTextContent("地区产情填报");

    within(navigation).getByRole("button", { name: "玉米产情填报" }).focus();
    await user.keyboard("{Enter}");
    expect(onNavigate).toHaveBeenCalledWith(
      createFormalRoute("production", "corn-collection"),
    );

    await user.click(
      within(navigation).getByRole("button", { name: "大豆产情填报" }),
    );
    expect(onNavigate).toHaveBeenLastCalledWith(
      createFormalRoute("production", "soybean-collection"),
    );
  });

  it("keeps only design-sample maintenance under My Work", () => {
    const onNavigate = vi.fn();
    const application = formalApplicationDefinitions.find(
      ({ key }) => key === "work",
    );
    if (!application) throw new Error("missing work application");

    render(
      <BusinessNavigationTree
        application={application}
        currentRoute={createFormalRoute("work", "sample-governance")}
        onNavigate={onNavigate}
      />,
    );

    const navigation = screen.getByRole("navigation", {
      name: "我的工作模块",
    });
    expect(
      within(navigation).getByRole("button", { name: "样本点管理" }),
    ).toHaveAttribute("aria-current", "page");
    expect(navigation).not.toHaveTextContent("人工审核");
    expect(navigation).not.toHaveTextContent("待我处理");
    expect(navigation).not.toHaveTextContent("已办事项");
    expect(navigation).not.toHaveTextContent("导入任务");
  });

  it.each([
    ["production", "review", "数据审核"],
    ["market", "review", "数据审核"],
    ["reporting", "review-distribution", "报告审核与发布"],
    ["reporting", "ledger", "报告台账"],
  ] as const)("keeps %s %s navigation reachable", (key, section, label) => {
    const application = formalApplicationDefinitions.find(
      ({ key: applicationKey }) => applicationKey === key,
    );
    if (!application) throw new Error(`missing ${key} application`);

    render(
      <BusinessNavigationTree
        application={application}
        currentRoute={createFormalRoute(key, section)}
        onNavigate={vi.fn()}
      />,
    );

    expect(
      screen
        .getAllByRole("button", { name: label })
        .some((button) => button.getAttribute("aria-current") === "page"),
    ).toBe(true);
  });
});
