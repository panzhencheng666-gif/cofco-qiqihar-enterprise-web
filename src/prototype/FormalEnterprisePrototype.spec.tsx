import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { FormalEnterprisePrototype } from "./FormalEnterprisePrototype";

afterEach(cleanup);

describe("formal enterprise shell", () => {
  it("renders the integrated reporting application without prototype chrome", () => {
    render(
      <FormalEnterprisePrototype initialSearch="?page=reporting&section=overview" />,
    );

    expect(screen.getByText("齐齐哈尔粮食商情企业平台")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "报送与报告运营工作区" }),
    ).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "报送与报告模块" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("界面方案切换")).not.toBeInTheDocument();
  });

  it("keeps reporting functions together in one application", async () => {
    const user = userEvent.setup();
    render(
      <FormalEnterprisePrototype initialSearch="?page=reporting&section=overview" />,
    );

    await user.click(screen.getByRole("button", { name: "填报责任" }));

    expect(
      screen.getByRole("heading", { name: "填报责任与区域负责人" }),
    ).toBeVisible();
    expect(screen.getByText("一人一区 · 每周责任唯一")).toBeVisible();
  });

  it("keeps crop varieties and source actors visible without duplicating applications", () => {
    render(<FormalEnterprisePrototype initialSearch="?page=production" />);

    const businessScope = screen.getByRole("region", {
      name: "业务对象与品种范围",
    });
    expect(businessScope).toBeVisible();
    expect(
      screen.getByRole("button", { name: /玉米.*1,284\.6 万亩/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /大豆.*480\.2 万亩/ }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /稻谷.*274\.8 万亩/ }),
    ).toBeVisible();
    expect(within(businessScope).getByText("农户样本")).toBeVisible();
    expect(within(businessScope).getByText("家庭农场")).toBeVisible();
    expect(within(businessScope).getByText("合作社")).toBeVisible();
  });

  it("allows the owner to fill and disables every proxy-entry path", () => {
    render(
      <FormalEnterprisePrototype initialSearch="?page=reporting&section=weekly" />,
    );

    expect(
      screen.getByRole("button", { name: "填写本人本周报送" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "填写甘南县本周任务" }),
    ).toBeDisabled();
    expect(screen.getByText("任何人无权代填")).toBeVisible();
  });

  it("provides weekly and monthly responsibility report exports", () => {
    const { rerender } = render(
      <FormalEnterprisePrototype initialSearch="?page=reporting&section=duty-weekly" />,
    );
    expect(screen.getByRole("button", { name: "导出责任周报" })).toBeVisible();

    rerender(
      <FormalEnterprisePrototype
        initialSearch="?page=reporting&section=duty-monthly"
        key="duty-monthly"
      />,
    );
    expect(screen.getByRole("button", { name: "导出责任月报" })).toBeVisible();
    expect(screen.getByText("逾期后补填不消除逾期记录")).toBeVisible();
  });
});
