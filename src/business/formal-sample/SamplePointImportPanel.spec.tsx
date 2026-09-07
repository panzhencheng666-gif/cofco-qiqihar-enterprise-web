import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";
import { SamplePointImportPanel } from "./SamplePointImportPanel";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SamplePointImportPanel", () => {
  it("keeps a confirmed import successful when refreshing the list fails", async () => {
    const repository = {
      importDesignSamplePoints: vi.fn().mockResolvedValue({
        id: "saved-import",
        statusCode: "COMPLETED",
        importedRows: 1,
        failedRows: 0,
      }),
    } as unknown as RealtimeBusinessRepository;
    render(
      <SamplePointImportPanel
        kind="design"
        repository={repository}
        onImported={vi.fn().mockRejectedValue(new Error("refresh failed"))}
      />,
    );
    const input = screen.getByLabelText<HTMLInputElement>("选择 XLSX 文件");
    await userEvent.upload(
      input,
      new File(["data"], "样本.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "校验并导入" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "导入结果已保存，但列表刷新失败，请刷新页面查看，无需重复导入。",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "导入完成，已新增 1 条",
    );
    expect(input.files).toHaveLength(0);
    expect(screen.getByRole("button", { name: "校验并导入" })).toBeDisabled();
  });
  it.each(["design", "formal"] as const)(
    "shows the actual %s import error and preserves the selected file",
    async (kind) => {
      const failure = new RealtimeApiError({
        code: "INVALID_IMPORT_FORMAT",
        status: 400,
        message: "文件多出第 9 列，请删除模板之外的内容后重试。",
      });
      const submit = vi.fn().mockRejectedValue(failure);
      const repository = {
        importDesignSamplePoints: submit,
        importFormalSamplePoints: submit,
      } as unknown as RealtimeBusinessRepository;
      render(
        <SamplePointImportPanel
          kind={kind}
          repository={repository}
          onImported={vi.fn()}
        />,
      );
      const input = screen.getByLabelText<HTMLInputElement>("选择 XLSX 文件");
      const file = new File(["data"], "样本.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      await userEvent.upload(input, file);
      await userEvent.click(screen.getByRole("button", { name: "校验并导入" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        failure.message,
      );
      expect(input.files?.[0]).toBe(file);
    },
  );

  it("does not describe an unknown system failure as a bad workbook", async () => {
    const repository = {
      importDesignSamplePoints: vi
        .fn()
        .mockRejectedValue(new Error("internal database exception")),
    } as unknown as RealtimeBusinessRepository;
    render(
      <SamplePointImportPanel
        kind="design"
        repository={repository}
        onImported={vi.fn()}
      />,
    );
    await userEvent.upload(
      screen.getByLabelText("选择 XLSX 文件"),
      new File(["data"], "样本.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "校验并导入" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "未能确认导入结果，请刷新列表核对后再重试。",
    );
    expect(screen.queryByText(/internal database/)).not.toBeInTheDocument();
  });

  it("preserves the formal standalone import DOM and fixed file label", async () => {
    render(
      <SamplePointImportPanel
        kind="formal"
        repository={{} as RealtimeBusinessRepository}
        onImported={vi.fn()}
      />,
    );

    const panel = screen.getByLabelText("正式样本批量导入");
    expect(panel).toHaveClass("sample-point-import");
    expect(panel).not.toHaveClass("sample-point-import--ledger-toolbar");
    expect(
      panel.querySelector(":scope > .sample-point-import__actions"),
    ).not.toBeNull();
    const input = screen.getByLabelText("选择 XLSX 文件");
    expect(input.closest("label")).not.toHaveAttribute("class");
    await userEvent.upload(
      input,
      new File(["formal"], "正式样本.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    expect(screen.getByText("选择 XLSX 文件")).toBeVisible();
  });

  it("imports each workbook once, refreshes authority, and exposes atomic errors", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000001")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000002")
      .mockReturnValue("00000000-0000-4000-8000-000000000003");
    const downloadTemplate = vi.fn().mockResolvedValue(new Blob(["template"]));
    const importPoints = vi
      .fn()
      .mockResolvedValueOnce({
        id: "import-1",
        statusCode: "COMPLETED",
        importedRows: 2,
        failedRows: 0,
        completedAt: "2026-09-02T08:00:00Z",
      })
      .mockResolvedValueOnce({
        id: "import-2",
        statusCode: "COMPLETED_WITH_ERRORS",
        importedRows: 0,
        failedRows: 1,
        completedAt: "2026-09-02T08:01:00Z",
      });
    const downloadErrors = vi.fn().mockResolvedValue(new Blob(["errors"]));
    const onImported = vi.fn();
    const repository = {
      downloadDesignSamplePointTemplate: downloadTemplate,
      importDesignSamplePoints: importPoints,
      downloadDesignSamplePointImportErrors: downloadErrors,
    } as unknown as RealtimeBusinessRepository;
    const user = userEvent.setup();

    render(
      <SamplePointImportPanel
        kind="design"
        repository={repository}
        onImported={onImported}
      />,
    );

    await user.click(screen.getByRole("button", { name: "下载 XLSX 模板" }));
    expect(
      screen.queryByRole("combobox", { name: "设计参考点导入分类" }),
    ).not.toBeInTheDocument();
    expect(downloadTemplate.mock.calls).toEqual([[]]);

    const firstFile = new File(["valid"], "设计样本.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    await user.upload(screen.getByLabelText("选择 XLSX 文件"), firstFile);
    await user.click(screen.getByRole("button", { name: "校验并导入" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "导入完成，已新增 2 条",
    );
    expect(onImported).toHaveBeenCalledTimes(1);
    expect(importPoints.mock.calls[0]?.[1]).toBe(
      "00000000-0000-4000-8000-000000000001",
    );

    const invalidFile = new File(["invalid"], "设计样本-错误.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    await user.upload(screen.getByLabelText("选择 XLSX 文件"), invalidFile);
    await user.click(screen.getByRole("button", { name: "校验并导入" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "本次零条入库，请下载错误明细查看具体原因（共 1 行）",
    );
    expect(importPoints.mock.calls[1]?.[1]).toBe(
      "00000000-0000-4000-8000-000000000002",
    );
    await user.click(screen.getByRole("button", { name: "下载错误明细" }));
    expect(downloadErrors).toHaveBeenCalledWith("import-2");
    expect(
      screen.queryByText(/草稿|审核|发布|二次校验/u),
    ).not.toBeInTheDocument();
  });
});
