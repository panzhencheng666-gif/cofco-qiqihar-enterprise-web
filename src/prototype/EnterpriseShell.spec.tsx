import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFormalRoute } from "./formalEnterpriseModel";
import { EnterpriseShell } from "./EnterpriseShell";

afterEach(cleanup);

describe("EnterpriseShell", () => {
  it("renders frame and typed navigation without owning business facts", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <EnterpriseShell
        shellIdentity={{
          platformName: "平台名称",
          workUnit: {
            organizationLabel: "组织",
            currentUnitLabel: "单位一",
            units: ["单位一", "单位二"],
          },
          account: { displayName: "用户", menuItems: ["账号安全"] },
        }}
        location={{
          route: createFormalRoute("market", "objects"),
          coordinates: { regionId: "authorized-all" },
        }}
        onNavigate={onNavigate}
      >
        <h1>workspace</h1>
      </EnterpriseShell>,
    );

    expect(screen.getByRole("heading", { name: "workspace" })).toBeVisible();
    expect(screen.getByText("平台名称")).toBeVisible();
    const applications = screen.getByRole("navigation", { name: "业务应用" });
    expect(within(applications).getAllByRole("button")).toHaveLength(6);
    await user.click(within(applications).getByRole("button", { name: "产情监测" }));
    expect(onNavigate).toHaveBeenCalledWith(createFormalRoute("production", "tasks"));
  });

  it("renders authorized work-unit and personal-account data supplied by its owner", async () => {
    const user = userEvent.setup();
    render(
      <EnterpriseShell
        location={{ route: createFormalRoute("work", "tasks"), coordinates: { regionId: "authorized-all" } }}
        onNavigate={vi.fn()}
        shellIdentity={{
          platformName: "平台名称",
          workUnit: { organizationLabel: "组织", currentUnitLabel: "单位一", units: ["单位一", "单位二"] },
          account: { displayName: "用户", menuItems: ["账号安全", "退出登录"] },
        }}
      >
        <h1>workspace</h1>
      </EnterpriseShell>,
    );

    await user.click(screen.getByRole("button", { name: /当前工作单位.*单位一/ }));
    expect(screen.getByRole("menu", { name: "工作单位选择" })).toHaveTextContent("单位二");
    await user.click(screen.getByRole("button", { name: /个人账户.*用户/ }));
    expect(screen.getByRole("menu", { name: "个人账户菜单" })).toHaveTextContent("账号安全");
  });
});
