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

    expect(screen.getByRole("combobox", { name: "业务地区" })).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: "调查对象类型" }),
    ).toBeVisible();
    expect(screen.getByRole("combobox", { name: "监测作物" })).toHaveValue(
      "corn",
    );
    expect(
      screen.getByRole("table", { name: "产情调查任务清单" }),
    ).toHaveTextContent("德美亚3号");
    expect(
      screen.getByRole("table", { name: "产情调查任务清单" }),
    ).toHaveTextContent("水分");
    expect(
      screen.getByRole("table", { name: "产情调查任务清单" }),
    ).toHaveTextContent("容重");
    expect(
      screen.getByRole("table", { name: "产情调查任务清单" }),
    ).toHaveTextContent("毒素");
    expect(screen.getByLabelText("产情业务统计")).toBeVisible();
    expect(
      screen.getByRole("table", { name: "产情调查任务清单" }),
    ).toBeVisible();
    expect(container.querySelector(".production-estimate-grid")).toBeNull();
    expect(container.querySelector(".unified-two-column")).toBeNull();
    expect(container.querySelector(".production-scope-panel")).toBeNull();
    expect(container.querySelector(".workspace-summary-strip")).toBeNull();
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

  it("keeps the complete cost, insurance and subsidy ledger in the production task", () => {
    render(
      <ProductionMonitoringWorkspace
        section="collection"
        onComposeReport={vi.fn()}
        onSectionChange={vi.fn()}
      />,
    );

    expect(screen.getByText("成本与保障")).toBeVisible();
    for (const field of [
      "土地租金",
      "种子费用",
      "化肥费用",
      "农药费用",
      "灌溉费用",
      "人工费用",
      "机械作业费用",
      "其他生产支出",
      "保费总额",
      "财政保费补贴",
      "农户自缴保费",
      "保险赔款",
      "种植补贴应收",
      "种植补贴实收",
    ]) {
      expect(screen.getByRole("textbox", { name: field })).toBeVisible();
    }
    expect(
      screen.getByRole("table", { name: "成本与保障汇总" }),
    ).toHaveTextContent("生产经济成本");
    expect(
      screen.getByRole("table", { name: "成本与保障汇总" }),
    ).toHaveTextContent("赔付后净现金负担");
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
