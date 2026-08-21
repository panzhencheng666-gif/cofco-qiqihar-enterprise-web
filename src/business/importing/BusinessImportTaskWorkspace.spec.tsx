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
  ProductionImportJob,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";

import { BusinessImportTaskWorkspace } from "./BusinessImportTaskWorkspace";

afterEach(cleanup);

const productionJob: ProductionImportJob = {
  id: "production-import-1",
  domainCode: "PRODUCTION",
  statusCode: "COMPLETED_WITH_ERRORS",
  importedRows: 216,
  failedRows: 56,
  productCodes: ["CORN"],
  surveyPeriods: ["2025-09"],
  createdAt: "2026-08-20T05:39:00Z",
};

describe("business import task workspace", () => {
  it("owns durable import history under My Work and switches business domains", async () => {
    const user = userEvent.setup();
    const listImportJobs = vi.fn().mockResolvedValue({
      items: [productionJob],
      pageNumber: 0,
      pageSize: 5,
      totalElements: 1,
      totalPages: 1,
    });
    const repository = {
      listImportJobs,
    } as unknown as RealtimeBusinessRepository;

    render(<BusinessImportTaskWorkspace repository={repository} />);

    expect(
      await screen.findByRole("region", { name: "导入任务列表" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "导入任务详情" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("产情导入任务")).not.toBeInTheDocument();
    expect(listImportJobs).toHaveBeenCalledWith("production", 0, 5);
    await user.click(screen.getByRole("button", { name: "市场导入" }));
    await waitFor(() =>
      expect(listImportJobs).toHaveBeenLastCalledWith("market", 0, 5),
    );
  });

  it("opens one task result without exposing its internal id in the ledger", async () => {
    const user = userEvent.setup();
    const repository = {
      listImportJobs: vi.fn().mockResolvedValue({
        items: [productionJob],
        pageNumber: 0,
        pageSize: 5,
        totalElements: 1,
        totalPages: 1,
      }),
    } as unknown as RealtimeBusinessRepository;

    render(<BusinessImportTaskWorkspace repository={repository} />);

    await user.click(
      await screen.findByRole("button", { name: "查看第 1 项导入结果" }),
    );
    const detail = screen.getByRole("region", { name: "导入任务详情" });
    expect(detail).not.toHaveTextContent("已完成 216 行");
    expect(detail).not.toHaveTextContent("待修正 56 行");
    expect(
      within(detail).getByRole("button", { name: "仅重试待修正行" }),
    ).toBeVisible();
    expect(detail).not.toHaveTextContent("合格行已自动提交审核");
    expect(
      screen.getByRole("region", { name: "导入任务列表" }),
    ).toContainElement(
      within(detail).getByRole("group", { name: "导入任务操作" }),
    );
    expect(screen.queryByText(productionJob.id)).not.toBeInTheDocument();
  });

  it("updates the original batch row to completed after all pending rows succeed", async () => {
    const user = userEvent.setup();
    let retried = false;
    const completedBatch: ProductionImportJob = {
      ...productionJob,
      statusCode: "COMPLETED",
      importedRows: 272,
      failedRows: 0,
      actionJobId: "retry-action-1",
    };
    const listImportJobs = vi.fn(
      (_domain: string, _page: number, pageSize: number) =>
        Promise.resolve({
          items: [retried ? completedBatch : productionJob],
          pageNumber: 0,
          pageSize,
          totalElements: 1,
          totalPages: 1,
        }),
    );
    const repository = {
      listImportJobs,
      retryImportJob: vi.fn().mockImplementation(() => {
        retried = true;
        return Promise.resolve({
          ...completedBatch,
          id: "retry-action-1",
          importedRows: 56,
        });
      }),
    } as unknown as RealtimeBusinessRepository;

    render(<BusinessImportTaskWorkspace repository={repository} />);
    await user.click(
      await screen.findByRole("button", { name: "查看第 1 项导入结果" }),
    );
    await user.click(screen.getByRole("button", { name: "仅重试待修正行" }));

    await waitFor(() =>
      expect(
        within(
          screen.getByRole("region", { name: "导入任务列表" }),
        ).getAllByRole("cell", { name: "272" }),
      ).toHaveLength(2),
    );
    expect(
      screen.getByRole("region", { name: "导入任务列表" }),
    ).toContainElement(screen.getByRole("cell", { name: "已完成" }));
    expect(
      screen.getAllByRole("button", { name: /查看第 1 项导入结果/u }),
    ).toHaveLength(1);
  });

  it("filters a historical photo folder by the task manifest and uploads only eligible files", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const getProductionImportPhotoManifest = vi.fn().mockResolvedValue({
      totalFileCount: 2,
      eligibleFileCount: 1,
      deferredFileCount: 1,
      totalTargetAttachments: 2,
      attachedTargetAttachments: 0,
      files: [
        {
          filename: "成功现场.png",
          referencedRows: [2, 3],
          targetRecords: ["record-1", "record-2"],
          failedRows: [],
          attachedRecords: [],
        },
        {
          filename: "失败现场.png",
          referencedRows: [4],
          targetRecords: [],
          failedRows: [4],
          attachedRecords: [],
        },
      ],
    });
    const supplementProductionImportPhoto = vi.fn().mockResolvedValue({
      filename: "成功现场.png",
      statusCode: "ATTACHED",
      referencedRows: 2,
      targetRecords: 2,
      failedRows: 0,
      newAttachments: 2,
      alreadyAttached: 0,
    });
    const repository = {
      listImportJobs: vi.fn().mockResolvedValue({
        items: [productionJob],
        pageNumber: 0,
        pageSize: 5,
        totalElements: 1,
        totalPages: 1,
      }),
      getProductionImportPhotoManifest,
      supplementProductionImportPhoto,
    } as unknown as RealtimeBusinessRepository;

    render(<BusinessImportTaskWorkspace repository={repository} />);
    await user.click(
      await screen.findByRole("button", { name: "查看第 1 项导入结果" }),
    );
    const photos = await screen.findByRole("region", { name: "照片补传" });
    expect(photos).toHaveTextContent("待补传 1 个文件 · 2 个记录");

    const eligible = new File(["eligible"], "成功现场.png", {
      type: "image/png",
    });
    const deferred = new File(["deferred"], "失败现场.png", {
      type: "image/png",
    });
    const unrelated = new File(["unrelated"], "无关现场.png", {
      type: "image/png",
    });
    const unsupported = new File(["unsupported"], "成功现场.png", {
      type: "image/gif",
    });
    await user.upload(screen.getByLabelText("选择历史导入照片"), [
      eligible,
      deferred,
      unrelated,
      unsupported,
    ]);
    expect(
      screen.getByText("已匹配 1 个；文件名不匹配 2 个；格式不支持 1 个"),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "补传照片" }));

    await waitFor(() =>
      expect(supplementProductionImportPhoto).toHaveBeenCalledWith(
        productionJob.id,
        eligible,
      ),
    );
    expect(supplementProductionImportPhoto).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText("照片补传完成：新增挂接 2 张"),
    ).toBeVisible();
  });
});
