import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  businessLauncherApplications,
  EnterpriseApplicationLauncher,
} from "./EnterpriseApplicationLauncher";

afterEach(cleanup);

describe("EnterpriseApplicationLauncher", () => {
  it("shows business workspaces without exposing technical management concepts", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<EnterpriseApplicationLauncher onSelect={onSelect} />);
    await user.click(screen.getByRole("button", { name: "应用菜单" }));

    const launcher = screen.getByRole("dialog", { name: "应用启动器" });
    expect(businessLauncherApplications.map((item) => item.key)).toEqual([
      "work",
      "overview",
      "production",
      "market",
      "supply",
    ]);
    expect(launcher).not.toHaveTextContent("报表中心");
    expect(launcher).not.toHaveTextContent(
      /原型|开发|架构入口|数据治理|血缘|运行配置|治理管理员|系统管理员/,
    );
    await user.click(screen.getByRole("button", { name: "打开市场监测" }));
    expect(onSelect).toHaveBeenCalledWith("market");
    expect(
      screen.queryByRole("dialog", { name: "应用启动器" }),
    ).not.toBeInTheDocument();
  });
});
