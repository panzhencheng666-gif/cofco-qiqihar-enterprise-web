import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  BusinessReportArtifact,
  BusinessReportRequest,
  QuickReportExportKind,
} from "../businessReportModel";
import { QuickReportExportMenu } from "./QuickReportExportMenu";

afterEach(cleanup);

const request: BusinessReportRequest = {
  reportType: "市场报告",
  regionId: "qiqihar-all",
  productId: "corn",
  cultivarId: null,
  periodKey: "2026年第31周",
  frequency: "周",
  cutoff: "2026-07-31 17:00",
  approvedDatasetId: "MARKET-2026-W31-APPROVED",
  sectionKeys: ["价格与交易", "库存与加工", "物流与风险"],
};

describe("quick report export menu", () => {
  it("exports only exact business frequencies and matching submission records", async () => {
    const user = userEvent.setup();
    const onExport =
      vi.fn<
        (kind: QuickReportExportKind, artifact: BusinessReportArtifact) => void
      >();
    render(
      <QuickReportExportMenu
        exportAllowed
        onExport={onExport}
        request={request}
      />,
    );

    await user.click(screen.getByText("生成与导出"));
    expect(screen.getByRole("button", { name: "导出业务日报" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "导出业务周报" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "导出业务月报" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "导出填报记录周报" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "导出填报记录月报" }),
    ).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "导出业务周报" }));
    const [exportKind, artifact] = onExport.mock.calls[0];
    expect(exportKind).toBe("business-weekly");
    expect(artifact.filename).toContain("周报");
  });

  it("keeps every export disabled until the business scope is complete", async () => {
    const user = userEvent.setup();
    render(<QuickReportExportMenu exportAllowed request={null} />);
    await user.click(screen.getByText("生成与导出"));
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });
});
