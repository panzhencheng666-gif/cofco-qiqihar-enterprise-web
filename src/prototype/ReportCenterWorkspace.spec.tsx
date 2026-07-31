import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportCenterWorkspace } from "./ReportCenterWorkspace";

afterEach(cleanup);

describe("ReportCenterWorkspace", () => {
  it("builds business reports from an explicit business context", async () => {
    const user = userEvent.setup();
    const onComposeReport = vi.fn();
    const { container } = render(
      <ReportCenterWorkspace
        section="business-reports"
        onComposeReport={onComposeReport}
      />,
    );

    const context = screen.getByRole("region", {
      name: "业务报告生成条件",
    });
    expect(
      within(context).getByRole("combobox", { name: "业务类型" }),
    ).toHaveValue("market");
    expect(
      within(context).getByRole("combobox", { name: "报告地区" }),
    ).toHaveValue("齐齐哈尔市全域");
    expect(
      within(context).getByRole("combobox", { name: "报告期间" }),
    ).toHaveValue("2026 年第 31 周");
    expect(
      within(context).getByRole("combobox", { name: "采用数据版本" }),
    ).toHaveValue("第 31 周已核定数据");

    await user.selectOptions(
      within(context).getByRole("combobox", { name: "业务类型" }),
      "production",
    );
    await user.selectOptions(
      within(context).getByRole("combobox", { name: "报告地区" }),
      "讷河市",
    );

    await user.click(screen.getByRole("button", { name: "生成周报" }));
    expect(onComposeReport).toHaveBeenCalledWith(
      expect.objectContaining({
        application: "production",
        product: "玉米",
        region: "讷河市",
      }),
    );
    expect(
      screen.getByRole("table", { name: "业务报告台账" }),
    ).toBeVisible();
    expect(container.querySelector(".unified-metric-strip")).toBeNull();
  });

  it("keeps responsibility supervision centralized and auditable", async () => {
    const user = userEvent.setup();
    const { container } = render(
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
    expect(
      screen.getByRole("combobox", { name: "履责业务类型" }),
    ).toHaveValue("all");
    expect(
      screen.getByRole("combobox", { name: "履责责任区域" }),
    ).toHaveValue("all");
    expect(
      screen.getByText(/业务日报、周报、月报请在“业务报告”中生成/),
    ).toBeVisible();

    const table = screen.getByRole("table", { name: "履责监督台账" });
    expect(within(table).getByText("截止未提交")).toBeVisible();
    expect(container.querySelector(".duty-rule-strip")).toBeNull();
    expect(container.querySelector(".unified-metric-strip")).toBeNull();

    await user.click(screen.getByRole("button", { name: "月度履责" }));
    expect(
      screen.getByRole("table", { name: "月度履责记录" }),
    ).toBeVisible();
    expect(screen.getByText("连续 2 周异常")).toBeVisible();
  });
});
