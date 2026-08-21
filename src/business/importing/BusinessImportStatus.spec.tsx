import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BusinessImportStatus } from "./BusinessImportStatus";

afterEach(cleanup);

describe("business import status", () => {
  it("reports that valid rows entered review without exposing a draft workflow", () => {
    render(
      <BusinessImportStatus
        busy={false}
        className="business-alert"
        job={{
          id: "import-1",
          domainCode: "LOGISTICS",
          statusCode: "COMPLETED",
          importedRows: 2,
          failedRows: 0,
        }}
        onDownloadErrors={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "导入完成：2 行已处理，合格行已自动提交审核，失败 0 行。",
    );
    expect(screen.queryByText(/草稿/u)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "提交审核" }),
    ).not.toBeInTheDocument();
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

  it("offers the error receipt and failed-row retry after a partially successful import", async () => {
    const user = userEvent.setup();
    const onDownloadErrors = vi.fn();
    const onRetry = vi.fn();
    render(
      <BusinessImportStatus
        busy={false}
        className="business-alert"
        job={{
          id: "import-partial-1",
          domainCode: "PRODUCTION",
          statusCode: "COMPLETED_WITH_ERRORS",
          importedRows: 1,
          failedRows: 2,
        }}
        onDownloadErrors={onDownloadErrors}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "导入完成：1 行已处理，合格行已自动提交审核，失败 2 行。请下载错误清单核对。",
    );
    await user.click(screen.getByRole("button", { name: "下载错误清单" }));
    await user.click(screen.getByRole("button", { name: "仅重试待修正行" }));
    expect(onDownloadErrors).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders nothing before an import job exists", () => {
    const { container } = render(
      <BusinessImportStatus
        busy={false}
        className="business-alert"
        job={null}
        onDownloadErrors={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
