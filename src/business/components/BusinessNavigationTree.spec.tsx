import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { formalApplicationDefinitions } from "../formalEnterpriseData";
import { createFormalRoute } from "../formalEnterpriseModel";
import { BusinessNavigationTree } from "./BusinessNavigationTree";

afterEach(cleanup);

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

  it("removes retired workflow navigation instead of hiding it inside My Work", () => {
    const onNavigate = vi.fn();
    const application = formalApplicationDefinitions.find(
      ({ key }) => key === "production",
    );
    if (!application) throw new Error("missing work application");

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
    expect(navigation).not.toHaveTextContent("我的工作");
    expect(navigation).not.toHaveTextContent("待我处理");
    expect(navigation).not.toHaveTextContent("已办事项");
    expect(navigation).not.toHaveTextContent("导入任务");
    expect(navigation).not.toHaveTextContent("数据审核");
  });
});
