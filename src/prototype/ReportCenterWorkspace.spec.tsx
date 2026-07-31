import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportCenterWorkspace } from "./ReportCenterWorkspace";

afterEach(cleanup);

describe("ReportCenterWorkspace", () => {
  it("builds business reports from an explicit business context", async () => {
    const user = userEvent.setup();
    const onComposeReport = vi.fn();
    render(
      <ReportCenterWorkspace
        section="business-reports"
        onComposeReport={onComposeReport}
      />,
    );

    const context = screen.getByRole("region", {
      name: "业务报告生成条件",
    });
    expect(within(context).getByText("市场监测")).toBeVisible();
    expect(within(context).getByText("齐齐哈尔市全域")).toBeVisible();
    expect(within(context).getByText("2026 年第 31 周")).toBeVisible();
    expect(within(context).getByText("第 31 周已核定数据")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "生成周报" }));
    expect(onComposeReport).toHaveBeenCalledWith(
      expect.objectContaining({
        application: "market",
        product: "玉米",
        region: "齐齐哈尔市全域",
      }),
    );
  });

  it("keeps responsibility supervision centralized and auditable", async () => {
    const user = userEvent.setup();
    render(
      <ReportCenterWorkspace
        section="duty-reports"
        onComposeReport={vi.fn()}
      />,
    );

    expect(screen.getByText("一人一责区")).toBeVisible();
    expect(screen.getByText("他人无权代填")).toBeVisible();
    expect(screen.getByText("逾期补填保留原逾期记录")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "导出责任周报" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "导出责任月报" }),
    ).toBeVisible();

    const table = screen.getByRole("table", { name: "填报履责记录" });
    expect(within(table).getByText("截止未提交")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "月度履责" }));
    expect(
      screen.getByRole("table", { name: "月度履责记录" }),
    ).toBeVisible();
    expect(screen.getByText("连续 2 周异常")).toBeVisible();
  });
});
