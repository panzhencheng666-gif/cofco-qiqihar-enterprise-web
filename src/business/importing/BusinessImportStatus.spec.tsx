import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BusinessImportStatus } from "./BusinessImportStatus";

afterEach(cleanup);

describe("business import status", () => {
  it("shows independently stored rows and submits only a complete draft", async () => {
    const user = userEvent.setup();
    const onSubmitDraft = vi.fn();
    render(
      <BusinessImportStatus
        busy={false}
        className="business-alert"
        drafts={[
          {
            id: "draft-1",
            domainCode: "LOGISTICS",
            productCode: "CORN",
            sampleName: "铁路样本点",
            regionCode: "230208",
            surveyPeriod: "2026-08",
            missingFields: [],
            completenessPercent: 100,
            stateCode: "DRAFT",
            canonicalRecordId: null,
            sourceRowNumber: 2,
            version: 1,
          },
          {
            id: "draft-2",
            domainCode: "LOGISTICS",
            productCode: "CORN",
            sampleName: "公路样本点",
            regionCode: "",
            surveyPeriod: null,
            missingFields: ["地区"],
            completenessPercent: 50,
            stateCode: "DRAFT",
            canonicalRecordId: null,
            sourceRowNumber: 3,
            version: 1,
          },
        ]}
        job={{
          id: "import-1",
          domainCode: "LOGISTICS",
          statusCode: "COMPLETED",
          importedRows: 2,
          failedRows: 0,
        }}
        onDownloadErrors={vi.fn()}
        onRetry={vi.fn()}
        onSubmitDraft={onSubmitDraft}
      />,
    );

    expect(screen.getByText(/第 2 行 · 铁路样本点/u)).toHaveTextContent(
      "已保存为草稿（当前完整度 100%）",
    );
    expect(screen.getByText(/第 3 行 · 公路样本点/u)).toHaveTextContent(
      "已保存为草稿（当前完整度 50%）",
    );
    expect(screen.getAllByRole("button", { name: "提交审核" })).toHaveLength(2);
    await user.click(screen.getAllByRole("button", { name: "提交审核" })[0]!);
    expect(onSubmitDraft).toHaveBeenCalledWith("draft-1");
  });

  it("offers the durable error receipt and retry action for a failed job", async () => {
    const user = userEvent.setup();
    const onDownloadErrors = vi.fn();
    const onRetry = vi.fn();
    render(
      <BusinessImportStatus
        busy={false}
        className="business-alert"
        job={{
          id: "import-1",
          domainCode: "MARKET",
          statusCode: "FAILED",
          importedRows: 0,
          failedRows: 2,
          failureMessage: "两行数据需要修正",
        }}
        onDownloadErrors={onDownloadErrors}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "导入未完成：两行数据需要修正",
    );
    await user.click(screen.getByRole("button", { name: "下载错误清单" }));
    await user.click(screen.getByRole("button", { name: "重试导入" }));
    expect(onDownloadErrors).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
