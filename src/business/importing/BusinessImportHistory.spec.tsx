import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  Page,
  ProductionImportJob,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";

import { BusinessImportHistory } from "./BusinessImportHistory";

afterEach(cleanup);

const completedJob: ProductionImportJob = {
  id: "import-internal-id-1",
  domainCode: "MARKET",
  statusCode: "COMPLETED_WITH_ERRORS",
  importedRows: 8,
  failedRows: 2,
  productCodes: ["CORN"],
  surveyPeriods: ["2025-09"],
  createdAt: "2026-08-20T00:15:00Z",
};

function page(
  items: readonly ProductionImportJob[],
  pageNumber = 0,
  totalPages = 1,
): Page<ProductionImportJob> {
  return {
    items,
    pageNumber,
    pageSize: 5,
    totalElements: totalPages > 1 ? 6 : items.length,
    totalPages,
  };
}

describe("business import history", () => {
  it("loads durable account-scoped history and restores one job into the existing result workflow", async () => {
    const user = userEvent.setup();
    const listImportJobs = vi.fn().mockResolvedValue(page([completedJob]));
    const onRestore = vi.fn();
    const repository = {
      listImportJobs,
    } as unknown as RealtimeBusinessRepository;

    render(
      <BusinessImportHistory
        busy={false}
        domain="market"
        onRestore={onRestore}
        repository={repository}
        selectedJobId={completedJob.id}
      />,
    );

    const taskList = await screen.findByRole("region", {
      name: "导入任务列表",
    });
    expect(
      within(taskList).getByRole("columnheader", { name: "批次范围" }),
    ).toBeVisible();
    expect(
      within(taskList).getByRole("columnheader", { name: "总行数" }),
    ).toBeVisible();
    expect(
      within(taskList).getByRole("columnheader", { name: "已完成" }),
    ).toBeVisible();
    expect(
      within(taskList).getByRole("columnheader", { name: "待修正" }),
    ).toBeVisible();
    expect(
      within(taskList).getByRole("columnheader", { name: "提交时间" }),
    ).toBeVisible();
    expect(
      within(taskList).getByRole("columnheader", { name: "当前节点" }),
    ).toBeVisible();
    expect(taskList).toHaveTextContent("玉米");
    expect(taskList).toHaveTextContent("2025年9月");
    expect(within(taskList).getByRole("cell", { name: "10" })).toBeVisible();
    expect(within(taskList).getByRole("cell", { name: "8" })).toBeVisible();
    expect(within(taskList).getByRole("cell", { name: "2" })).toBeVisible();
    expect(
      within(taskList).getByRole("cell", { name: "待修正" }),
    ).toBeVisible();
    expect(taskList).not.toHaveTextContent("部分完成");
    expect(screen.queryByText(completedJob.id)).not.toBeInTheDocument();
    expect(listImportJobs).toHaveBeenCalledWith("market", 0, 5);

    const selectedTask = within(taskList).getByRole("button", {
      name: "查看第 1 项导入结果",
    });
    expect(selectedTask).toHaveAttribute("aria-current", "true");
    await user.click(selectedTask);
    expect(onRestore).toHaveBeenCalledWith(completedJob);
  });

  it("paginates through backend history and keeps a failed refresh recoverable", async () => {
    const user = userEvent.setup();
    const nextJob = { ...completedJob, id: "import-internal-id-2" };
    const listImportJobs = vi
      .fn()
      .mockResolvedValueOnce(page([completedJob], 0, 2))
      .mockResolvedValueOnce(page([nextJob], 1, 2))
      .mockRejectedValueOnce(new Error("temporary failure"));
    const repository = {
      listImportJobs,
    } as unknown as RealtimeBusinessRepository;

    render(
      <BusinessImportHistory
        busy={false}
        domain="market"
        onRestore={vi.fn()}
        repository={repository}
      />,
    );

    await screen.findByText("第 1 / 2 页 · 共 6 项");
    await user.click(screen.getByRole("button", { name: "导入任务下一页" }));
    await screen.findByText("第 2 / 2 页 · 共 6 项");
    expect(listImportJobs).toHaveBeenNthCalledWith(2, "market", 1, 5);

    await user.click(screen.getByRole("button", { name: "刷新导入任务记录" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "任务列表暂时无法读取，请稍后重试。",
      ),
    );
    expect(
      screen.getByRole("button", { name: "刷新导入任务记录" }),
    ).toBeEnabled();
  });
});
