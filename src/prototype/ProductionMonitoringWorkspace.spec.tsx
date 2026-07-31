import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductionMonitoringWorkspace } from "./ProductionMonitoringWorkspace";

afterEach(cleanup);

describe("production monitoring workspace", () => {
  it("keeps crop varieties, quality, sample results and regional estimates visible", () => {
    const { container } = render(
      <ProductionMonitoringWorkspace
        section="overview"
        onComposeReport={vi.fn()}
        onSectionChange={vi.fn()}
      />,
    );

    expect(screen.getByText("德美亚3号")).toBeVisible();
    expect(screen.getByText("黑农84")).toBeVisible();
    expect(screen.getByText("龙粳31")).toBeVisible();
    expect(
      screen.getByRole("toolbar", { name: "品种与质量监测范围" }),
    ).toBeVisible();
    expect(screen.getByText("样本结果")).toBeVisible();
    expect(screen.getByText("区域估计")).toBeVisible();
    expect(screen.getByText("样本响应率 92.4%")).toBeVisible();
    expect(screen.getByLabelText("产情业务摘要").children).toHaveLength(4);
    expect(
      screen.getByRole("table", { name: "样本结果与区域估计" }),
    ).toBeVisible();
    expect(
      screen.getByRole("table", { name: "产情调查任务" }),
    ).toBeVisible();
    expect(container.querySelector(".production-estimate-grid")).toBeNull();
    expect(container.querySelector(".unified-two-column")).toBeNull();
  });

  it("supports three collection channels in the same production task", async () => {
    const user = userEvent.setup();
    render(
      <ProductionMonitoringWorkspace
        section="collection"
        onComposeReport={vi.fn()}
        onSectionChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "在线填报" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Excel批量导入" })).toBeVisible();
    expect(screen.getByRole("button", { name: "授权系统接入" })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "质量与检验依据" }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Excel批量导入" }));
    expect(screen.getByText("产情调查批量导入")).toBeVisible();
    expect(screen.getByText("进入同一校验与审核流程")).toBeVisible();
  });

  it("builds a report from approved production data", async () => {
    const user = userEvent.setup();
    const onComposeReport = vi.fn();
    render(
      <ProductionMonitoringWorkspace
        section="reports"
        onComposeReport={onComposeReport}
        onSectionChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "生成产情周报" }));
    expect(onComposeReport).toHaveBeenCalledWith(
      expect.objectContaining({
        application: "production",
        product: "玉米",
        dataVersion: "产情监测第 30 周正式指标版本",
      }),
    );
  });
});
