import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";

import { RealtimeReportCenterPanel } from "./RealtimeReportCenterPanel";

afterEach(cleanup);

function repository() {
  return {
    loadMasterData: vi.fn().mockResolvedValue({
      products: [{ code: "CORN", name: "玉米" }],
      periods: [
        {
          code: "2026-W32",
          name: "2026年第32周",
          startsOn: "2026-08-03",
          endsOn: "2026-08-09",
        },
      ],
      regions: [
        {
          code: "230200",
          name: "齐齐哈尔市",
          parentCode: null,
          level: "PREFECTURE",
        },
        {
          code: "230202",
          name: "龙沙区",
          parentCode: "230200",
          level: "COUNTY",
        },
        {
          code: "230202100",
          name: "大民街道",
          parentCode: "230202",
          level: "TOWNSHIP",
        },
        {
          code: "230202100001",
          name: "大民村",
          parentCode: "230202100",
          level: "VILLAGE",
        },
      ],
    }),
    loadReportParameterOptions: vi.fn().mockResolvedValue({
      definitions: [
        definition("PRODUCTION_DAILY", "产情日报", "PRODUCTION"),
        definition("MARKET_DAILY", "市场日报", "MARKET"),
        definition("LOGISTICS_WEEKLY", "物流周报", "LOGISTICS"),
        definition("SUPPLY_MONTHLY", "供需月报", "SUPPLY"),
      ],
      formats: [
        { code: "CSV", label: "CSV（中文列名）" },
        { code: "XLSX", label: "Excel 工作簿" },
      ],
    }),
    listCultivars: vi
      .fn()
      .mockResolvedValue([
        { code: "CORN_COMMON", name: "普通玉米", productCode: "CORN" },
      ]),
    createReportPreview: vi.fn().mockResolvedValue({
      id: "preview-1",
      definitionCode: "MARKET_DAILY",
      title: "齐齐哈尔市玉米市场日报",
      dataCutoffLabel: "2026年第32周",
      lines: [{ label: "核定数据条数", value: "12", note: "已核定业务数据" }],
      sections: [
        { code: "OVERVIEW", title: "总体概览", body: "已采用12条核定数据。" },
      ],
      expiresAt: "2026-08-09T14:00:00Z",
      version: 0,
      legacyReadOnly: false,
    }),
    createReportExport: vi.fn().mockResolvedValue({
      id: "export-1",
      previewId: "preview-1",
      formatCode: "CSV",
      filename: "齐齐哈尔市玉米市场日报.csv",
      contentType: "text/csv;charset=utf-8",
      requestedAt: "2026-08-09T13:31:00Z",
    }),
    downloadReportExport: vi.fn().mockResolvedValue(new Blob(["报告内容"])),
    createReportPublication: vi.fn().mockResolvedValue({
      id: "publication-1",
      previewId: "preview-1",
      exportTaskId: "export-1",
      publishedAt: "2026-08-09T13:32:00Z",
      version: 1,
    }),
  } as unknown as RealtimeBusinessRepository;
}

function definition(code: string, name: string, businessDomain: string) {
  return {
    code,
    name,
    businessDomain,
    businessSubtype: "MONITORING",
    frequencyCode: "DAILY",
    sections: [],
  };
}

describe("realtime report center", () => {
  it("requires an explicit business scope and previews only that scope before export", async () => {
    const api = repository();
    const createReportPreview = vi.spyOn(api, "createReportPreview");
    const createReportExport = vi.spyOn(api, "createReportExport");
    const createReportPublication = vi.spyOn(api, "createReportPublication");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:report"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );
    const user = userEvent.setup();
    render(
      <RealtimeReportCenterPanel
        permissions={["REPORT_PREVIEW", "REPORT_EXPORT", "REPORT_PUBLISH"]}
        repository={api}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "业务报告" }),
    ).toBeVisible();
    expect(screen.queryByText(/综合/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("报告类型")).toHaveTextContent(
      "产情日报市场日报物流周报供需月报",
    );
    await waitFor(() =>
      expect(screen.getByLabelText("具体品种")).toHaveTextContent(
        "全部品种普通玉米",
      ),
    );
    expect(screen.getByRole("group", { name: "统计地区" })).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "搜索地级市" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "地级市" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "区县" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "乡镇" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "行政村" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "导出当前报告" }),
    ).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("报告类型"), "MARKET_DAILY");
    await user.click(screen.getByRole("button", { name: "生成报告预览" }));

    await waitFor(() =>
      expect(createReportPreview).toHaveBeenCalledWith({
        definitionCode: "MARKET_DAILY",
        productCode: "CORN",
        regionLevel: "PREFECTURE",
        regionCode: "230200",
        periodCode: "2026-W32",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "齐齐哈尔市玉米市场日报" }),
    ).toBeVisible();
    expect(screen.getByText("12")).toBeVisible();
    expect(screen.getByRole("button", { name: "导出当前报告" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "导出当前报告" }));
    await waitFor(() =>
      expect(createReportExport).toHaveBeenCalledWith("preview-1", "CSV"),
    );
    expect(screen.getByRole("button", { name: "正式发布报告" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "正式发布报告" }));
    await waitFor(() =>
      expect(createReportPublication).toHaveBeenCalledWith(
        "preview-1",
        "export-1",
        0,
      ),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "报告已正式发布并完成留痕",
    );
  });

  it("ignores an old preview response after the employee changes report scope", async () => {
    const api = repository();
    let resolveOldPreview:
      | ((value: Awaited<ReturnType<typeof api.createReportPreview>>) => void)
      | undefined;
    const oldPreview = new Promise<
      Awaited<ReturnType<typeof api.createReportPreview>>
    >((resolve) => {
      resolveOldPreview = resolve;
    });
    vi.spyOn(api, "createReportPreview")
      .mockReturnValueOnce(oldPreview)
      .mockResolvedValueOnce({
        id: "preview-new",
        definitionCode: "MARKET_DAILY",
        datasetId: "dataset-new",
        title: "新范围市场日报",
        dataCutoffLabel: "2026年第32周",
        lines: [],
        sections: [],
        expiresAt: "2026-08-09T14:00:00Z",
        version: 0,
        legacyReadOnly: false,
      });
    const user = userEvent.setup();
    render(
      <RealtimeReportCenterPanel
        permissions={["REPORT_PREVIEW"]}
        repository={api}
      />,
    );
    await screen.findByRole("heading", { name: "业务报告" });

    await user.click(screen.getByRole("button", { name: "生成报告预览" }));
    await user.selectOptions(screen.getByLabelText("报告类型"), "MARKET_DAILY");
    await user.click(screen.getByRole("button", { name: "生成报告预览" }));
    expect(
      await screen.findByRole("heading", { name: "新范围市场日报" }),
    ).toBeVisible();

    await act(async () => {
      resolveOldPreview?.({
        id: "preview-old",
        definitionCode: "PRODUCTION_DAILY",
        datasetId: "dataset-old",
        title: "旧范围产情日报",
        dataCutoffLabel: "2026年第31周",
        lines: [],
        sections: [],
        expiresAt: "2026-08-09T13:00:00Z",
        version: 0,
        legacyReadOnly: false,
      });
      await oldPreview;
    });
    expect(screen.queryByText("旧范围产情日报")).not.toBeInTheDocument();
    expect(screen.getByText("新范围市场日报")).toBeVisible();
  });

  it("unlocks export when an in-flight file is invalidated by a format change", async () => {
    const api = repository();
    let resolveOldExport:
      | ((value: Awaited<ReturnType<typeof api.createReportExport>>) => void)
      | undefined;
    const oldExport = new Promise<
      Awaited<ReturnType<typeof api.createReportExport>>
    >((resolve) => {
      resolveOldExport = resolve;
    });
    vi.spyOn(api, "createReportExport").mockReturnValueOnce(oldExport);
    const download = vi.spyOn(api, "downloadReportExport");
    const user = userEvent.setup();
    render(
      <RealtimeReportCenterPanel
        permissions={["REPORT_PREVIEW", "REPORT_EXPORT"]}
        repository={api}
      />,
    );
    await screen.findByRole("heading", { name: "业务报告" });
    await user.click(screen.getByRole("button", { name: "生成报告预览" }));
    await screen.findByRole("heading", { name: "齐齐哈尔市玉米市场日报" });
    await user.click(screen.getByRole("button", { name: "导出当前报告" }));
    expect(screen.getByRole("button", { name: "正在导出……" })).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("导出格式"), "XLSX");
    expect(screen.getByRole("button", { name: "导出当前报告" })).toBeEnabled();
    await act(async () => {
      resolveOldExport?.({
        id: "export-old",
        previewId: "preview-1",
        formatCode: "CSV",
        filename: "旧格式.csv",
        contentType: "text/csv",
        requestedAt: "2026-08-09T13:31:00Z",
      });
      await oldExport;
    });
    expect(download).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
