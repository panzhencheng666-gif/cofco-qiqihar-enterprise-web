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

  it("opens report composition from the selected market workspace", async () => {
    const user = userEvent.setup();
    render(<FormalEnterprisePrototype initialSearch="?page=market" />);

    await user.click(screen.getByRole("button", { name: "编制业务报告" }));

    expect(screen.getByRole("dialog", { name: "编制业务报告" })).toBeVisible();
    expect(screen.getByText("市场监测 · 玉米")).toBeVisible();
    expect(screen.getByText("玉米市场监测第 31 周已核定数据")).toBeVisible();
  });

  it("shows city consolidation and allows county drill-down", async () => {
    const user = userEvent.setup();
    render(<FormalEnterprisePrototype initialSearch="?page=supply" />);

    const scope = screen.getByRole("region", {
      name: "供需平衡地区范围",
    });
    expect(
      within(scope).getByText("齐齐哈尔市全域", { selector: "strong" }),
    ).toBeVisible();
    expect(within(scope).getByText("市级合并")).toBeVisible();
    expect(within(scope).getByText("内部流转抵销 42.6 万吨")).toBeVisible();

    await user.click(within(scope).getByRole("button", { name: "讷河市" }));

    expect(within(scope).getByText("县级账户")).toBeVisible();
    expect(within(scope).getByText("12 / 14 项已核定")).toBeVisible();
    expect(screen.getByText("121.8")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "编制业务报告" }));
    expect(screen.getByRole("dialog", { name: "编制业务报告" })).toBeVisible();
    const dialog = screen.getByRole("dialog", { name: "编制业务报告" });
    expect(within(dialog).getByText("讷河市")).toBeVisible();
  });

  it("uses formal business language instead of implementation wording", () => {
    render(<FormalEnterprisePrototype initialSearch="?page=market" />);

    expect(screen.queryByText(/事实|血缘|重新计算/)).not.toBeInTheDocument();
    expect(screen.getByText("本周采集进度")).toBeVisible();
    expect(
      screen.getByText("行政村数量只采用2025—2026年最新官方口径"),
    ).toBeVisible();
    expect(screen.getByText("已核定")).toBeVisible();
  });

  it("uses the compact five-item market architecture", () => {
    render(<FormalEnterprisePrototype initialSearch="?page=market" />);

    const navigation = screen.getByRole("navigation", {
      name: "市场监测模块",
    });
    expect(within(navigation).getAllByRole("button")).toHaveLength(5);
    expect(within(navigation).getByText("市场总览")).toBeVisible();
    expect(within(navigation).getByText("数据采集")).toBeVisible();
    expect(screen.queryByText("业务生命周期")).not.toBeInTheDocument();
  });
});
