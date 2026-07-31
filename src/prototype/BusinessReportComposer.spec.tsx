import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  BusinessReportArtifact,
  BusinessReportContext,
  BusinessReportFormat,
} from "./businessReportModel";
import { BusinessReportComposer } from "./BusinessReportComposer";

afterEach(cleanup);

const marketContext: BusinessReportContext = {
  application: "market",
  applicationLabel: "市场监测",
  product: "玉米",
  region: "齐齐哈尔市全域",
  regionLevel: "市级监测",
  period: "2026 年第 31 周",
  dataCutoff: "2026-07-31 17:00",
  dataVersion: "市场监测第 31 周审核版",
  author: "王洋",
  reviewer: "赵晨",
};

describe("business report composer", () => {
  it("inherits the selected business context", () => {
    render(
      <BusinessReportComposer context={marketContext} onClose={vi.fn()} />,
    );

    expect(screen.getByRole("dialog", { name: "编制业务报告" })).toBeVisible();
    expect(screen.getByText("市场监测 · 玉米")).toBeVisible();
    expect(screen.getByText("齐齐哈尔市全域")).toBeVisible();
    expect(screen.getByText("市场监测第 31 周审核版")).toBeVisible();
  });

  it("switches daily weekly and monthly report content", async () => {
    const user = userEvent.setup();
    render(
      <BusinessReportComposer context={marketContext} onClose={vi.fn()} />,
    );

    expect(
      screen.getByRole("heading", {
        name: "齐齐哈尔市全域玉米市场监测周报",
      }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "月报" }));
    expect(
      screen.getByRole("heading", {
        name: "齐齐哈尔市全域玉米市场监测月报",
      }),
    ).toBeVisible();
    expect(screen.getByText(/重点企业库存为 103.9 万吨/)).toBeVisible();
  });

  it("offers PDF Word and Excel output", async () => {
    const user = userEvent.setup();
    const onExport =
      vi.fn<
        (format: BusinessReportFormat, artifact: BusinessReportArtifact) => void
      >();
    render(
      <BusinessReportComposer
        context={marketContext}
        onClose={vi.fn()}
        onExport={onExport}
      />,
    );

    await user.click(screen.getByRole("button", { name: "导出 Word" }));

    expect(screen.getByRole("button", { name: "导出 PDF" })).toBeVisible();
    expect(screen.getByRole("button", { name: "导出 Word" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "导出 Excel 附件" }),
    ).toBeVisible();
    expect(onExport).toHaveBeenCalledOnce();
    expect(onExport.mock.calls[0][0]).toBe("Word");
    expect(onExport.mock.calls[0][1].action).toBe("download");
    expect(onExport.mock.calls[0][1].filename).toMatch(/\.doc$/);
  });

  it("closes without changing business context", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <BusinessReportComposer context={marketContext} onClose={onClose} />,
    );

    await user.click(screen.getByRole("button", { name: "关闭报告编制" }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
