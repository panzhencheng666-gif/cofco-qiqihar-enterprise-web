import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BusinessImportStatus } from "./BusinessImportStatus";

afterEach(cleanup);

describe("business import status", () => {
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
