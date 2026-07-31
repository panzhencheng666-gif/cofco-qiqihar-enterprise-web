import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import {
  EnterpriseApplicationLauncher,
  managementApplications,
} from "./EnterpriseApplicationLauncher";

afterEach(cleanup);

describe("EnterpriseApplicationLauncher", () => {
  it("exposes governance and system as read-only architecture entries", async () => {
    const user = userEvent.setup();
    render(<EnterpriseApplicationLauncher />);
    await user.click(screen.getByRole("button", { name: "应用菜单" }));

    expect(managementApplications.map((item) => item.key)).toEqual([
      "governance",
      "system",
    ]);
    expect(screen.getByRole("dialog", { name: "应用启动器" })).toHaveTextContent(
      "当前原型仅展示架构入口",
    );
    expect(screen.getByText("数据治理")).toBeVisible();
    expect(screen.getByText("系统管理")).toBeVisible();
    expect(screen.getByText("治理管理员")).toBeVisible();
    expect(screen.getByText("系统管理员")).toBeVisible();
  });
});
