import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  RealtimeBusinessRepository,
  ReportDefinition,
} from "@/platform/api/realtimeBusinessRepository";

import { RealtimeReportCenterPanel } from "./RealtimeReportCenterPanel";

afterEach(cleanup);

function repository() {
  return {
    loadMasterData: vi.fn().mockResolvedValue({
      products: [
        { code: "CORN", name: "玉米" },
        { code: "SOYBEAN", name: "大豆" },
        { code: "RICE", name: "稻谷" },
      ],
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
        definition("COMPREHENSIVE_DAILY", "综合经营日报", "COMPREHENSIVE"),
        definition(
          "COMPREHENSIVE_WEEKLY",
          "综合经营周报",
          "COMPREHENSIVE",
          "WEEKLY",
        ),
        definition(
          "COMPREHENSIVE_MONTHLY",
          "综合经营月报",
          "COMPREHENSIVE",
          "MONTHLY",
        ),
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
      definitionCode: "COMPREHENSIVE_DAILY",
      title: "齐齐哈尔市综合经营日报",
      dataCutoffLabel: "2026年第32周",
      lines: [{ label: "核定数据条数", value: "12", note: "已核定业务数据" }],
      sections: [
        { code: "OVERVIEW", title: "总体概览", body: "已采用12条核定数据。" },
      ],
      products: [
        {
          code: "CORN",
          label: "玉米",
          domains: [
            {
              code: "PRODUCTION",
              label: "产情监测",
              approvedRecordCount: 12,
              dataCutoff: "2026-08-20 09:00",
              metrics: [
                {
                  label: "核定播种面积",
                  value: "1200 亩",
                  note: "采用 12 条审核数据",
                },
              ],
            },
          ],
        },
        {
          code: "SOYBEAN",
          label: "大豆",
          domains: [
            {
              code: "MARKET",
              label: "市场监测",
              approvedRecordCount: 0,
              dataCutoff: "暂无审核数据",
              metrics: [
                {
                  label: "数据状态",
                  value: "暂无审核数据",
                  note: "不以零值替代",
                },
              ],
            },
          ],
        },
        { code: "RICE", label: "稻谷", domains: [] },
      ],
      expiresAt: "2026-08-09T14:00:00Z",
      version: 0,
      legacyReadOnly: false,
    }),
    createReportExport: vi.fn().mockResolvedValue({
      id: "export-1",
      previewId: "preview-1",
      formatCode: "CSV",
      filename: "齐齐哈尔市综合经营日报.csv",
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

function definition(
  code: string,
  name: string,
  businessDomain: ReportDefinition["businessDomain"],
  frequencyCode = "DAILY",
): ReportDefinition {
  return {
    code,
    name,
    businessDomain,
    businessSubtype: "MONITORING",
    frequencyCode,
    sections: [],
  };
}

describe("realtime report center", () => {
  it("generates, exports, and downloads one scoped business report with one action", async () => {
    const api = repository();
    const createReportPreview = vi.spyOn(api, "createReportPreview");
    const createReportExport = vi.spyOn(api, "createReportExport");
    const downloadReportExport = vi.spyOn(api, "downloadReportExport");
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
    expect(screen.getByText("综合经营报告")).toBeVisible();
    expect(screen.queryByLabelText("报告类型")).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation", { name: "综合报告目录" }))
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["综合经营日报", "综合经营周报", "综合经营月报"]);
    expect(screen.queryByLabelText("产品或作物")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "具体品种" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "统计地区" })).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "搜索地级市" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "地级市" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "区县" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "乡镇" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "行政村" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "导出当前报告" }),
    ).not.toBeInTheDocument();

    expect(screen.getByLabelText("报告日期")).toHaveAttribute("type", "date");
    fireEvent.change(screen.getByLabelText("报告日期"), {
      target: { value: "2024-11-15" },
    });

    await user.click(screen.getByRole("button", { name: "生成并下载报告" }));

    await waitFor(() =>
      expect(createReportPreview).toHaveBeenCalledWith({
        definitionCode: "COMPREHENSIVE_DAILY",
        regionLevel: "PREFECTURE",
        regionCode: "230200",
        periodCode: "2024-11-15",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "齐齐哈尔市综合经营日报" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "玉米" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "大豆" })).toBeVisible();
    expect(screen.getByText("不以零值替代")).toBeVisible();
    expect(screen.getByText(/数据覆盖完整/)).toBeVisible();
    expect(screen.getByText("12")).toBeVisible();
    await waitFor(() =>
      expect(createReportExport).toHaveBeenCalledWith("preview-1", "CSV"),
    );
    expect(downloadReportExport).toHaveBeenCalledWith("export-1");
    expect(screen.getByRole("button", { name: "重新下载报告" })).toBeVisible();
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

  it("uses a Safari-safe year and week control without ever rendering NaN", async () => {
    const api = repository();
    const createReportPreview = vi.spyOn(api, "createReportPreview");
    vi.spyOn(api, "loadReportParameterOptions").mockResolvedValue({
      definitions: [
        definition(
          "COMPREHENSIVE_DAILY",
          "综合经营日报",
          "COMPREHENSIVE",
          "DAILY",
        ),
        definition(
          "COMPREHENSIVE_WEEKLY",
          "综合经营周报",
          "COMPREHENSIVE",
          "WEEKLY",
        ),
        definition(
          "COMPREHENSIVE_MONTHLY",
          "综合经营月报",
          "COMPREHENSIVE",
          "MONTHLY",
        ),
      ],
      products: [],
      cultivars: [],
      regionLevels: [],
      regions: [],
      periods: [],
      formats: [{ code: "CSV", label: "CSV（中文列名）" }],
    });
    const user = userEvent.setup();
    render(
      <RealtimeReportCenterPanel
        permissions={["REPORT_PREVIEW"]}
        repository={api}
      />,
    );

    expect(await screen.findByLabelText("报告日期")).toHaveAttribute(
      "type",
      "date",
    );
    await user.click(screen.getByRole("button", { name: "综合经营周报" }));
    expect(screen.queryByLabelText("报告周")).not.toBeInTheDocument();
    expect(document.querySelector('input[type="week"]')).toBeNull();
    await user.selectOptions(screen.getByLabelText("报告年份"), "2024");
    await user.selectOptions(screen.getByLabelText("周次"), "46");
    expect(document.body).toHaveTextContent("2024年第46周");
    expect(document.body).not.toHaveTextContent("NaN");

    await user.click(screen.getByRole("button", { name: "生成报告预览" }));
    await waitFor(() =>
      expect(createReportPreview).toHaveBeenCalledWith(
        expect.objectContaining({
          definitionCode: "COMPREHENSIVE_WEEKLY",
          periodCode: "2024-W46",
        }),
      ),
    );
  });

  it("organizes the three server-owned comprehensive definitions into a real report workflow", async () => {
    render(
      <RealtimeReportCenterPanel
        permissions={["REPORT_PREVIEW"]}
        repository={repository()}
      />,
    );

    const directory = await screen.findByRole("navigation", {
      name: "综合报告目录",
    });
    expect(within(directory).getAllByRole("button")).toHaveLength(3);
    expect(within(directory).getByText("综合经营报告")).toBeVisible();
    expect(
      screen.getByRole("region", { name: "报告范围与交付" }),
    ).toBeVisible();
    const result = screen.getByRole("region", { name: "报告生成结果" });
    expect(result).toHaveTextContent("选择报告范围后可一键生成正式报告");
  });

  it("explains missing preview authority instead of leaving an inert form", async () => {
    render(
      <RealtimeReportCenterPanel permissions={[]} repository={repository()} />,
    );

    expect(await screen.findByText("当前岗位无报告编制权限")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /生成报告/ }),
    ).not.toBeInTheDocument();
  });

  it("preserves partial approved coverage as a visible missing-data state", async () => {
    const api = repository();
    vi.spyOn(api, "createReportPreview").mockResolvedValueOnce({
      id: "preview-partial",
      definitionCode: "MARKET_DAILY",
      datasetId: "dataset-partial",
      title: "齐齐哈尔市玉米市场日报",
      dataCutoffLabel: "2024年11月1日",
      lines: [
        { label: "核定数据条数", value: "12", note: "已核定业务数据" },
        { label: "期末库存", value: "80 吨", note: "采用 5 条审核数据" },
      ],
      sections: [],
      products: [],
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

    await user.click(
      await screen.findByRole("button", { name: "生成报告预览" }),
    );
    expect(await screen.findByText(/部分指标审核来源不足或暂缺/)).toBeVisible();
    expect(screen.getByText(/不按零值处理/)).toBeVisible();
  });

  it("keeps the result empty when the selected range has no approved data", async () => {
    const api = repository();
    vi.spyOn(api, "createReportPreview").mockRejectedValueOnce(
      new Error("NO_APPROVED_DATA"),
    );
    const user = userEvent.setup();
    render(
      <RealtimeReportCenterPanel
        permissions={["REPORT_PREVIEW"]}
        repository={api}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "生成报告预览" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "当前范围暂无可生成报告的已核定数据",
    );
    expect(
      screen.queryByRole("heading", { name: /齐齐哈尔市.*报告/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/无数据时不会生成空文件/)).toBeVisible();
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
        definitionCode: "COMPREHENSIVE_MONTHLY",
        datasetId: "dataset-new",
        title: "新范围综合经营月报",
        dataCutoffLabel: "2026年第32周",
        lines: [],
        sections: [],
        products: [],
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
    await user.click(screen.getByRole("button", { name: "综合经营月报" }));
    await user.click(screen.getByRole("button", { name: "生成报告预览" }));
    expect(
      await screen.findByRole("heading", { name: "新范围综合经营月报" }),
    ).toBeVisible();

    await act(async () => {
      resolveOldPreview?.({
        id: "preview-old",
        definitionCode: "COMPREHENSIVE_DAILY",
        datasetId: "dataset-old",
        title: "旧范围综合经营日报",
        dataCutoffLabel: "2026年第31周",
        lines: [],
        sections: [],
        products: [],
        expiresAt: "2026-08-09T13:00:00Z",
        version: 0,
        legacyReadOnly: false,
      });
      await oldPreview;
    });
    expect(screen.queryByText("旧范围综合经营日报")).not.toBeInTheDocument();
    expect(screen.getByText("新范围综合经营月报")).toBeVisible();
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
    await user.click(
      await screen.findByRole("button", { name: "生成并下载报告" }),
    );
    await screen.findByRole("heading", { name: "齐齐哈尔市综合经营日报" });
    expect(screen.getByRole("button", { name: "正在导出……" })).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("导出格式"), "XLSX");
    expect(screen.getByRole("button", { name: "下载当前报告" })).toBeEnabled();
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

  it("keeps the immutable preview available when automatic export fails", async () => {
    const api = repository();
    vi.spyOn(api, "createReportExport").mockRejectedValueOnce(
      new Error("export unavailable"),
    );
    const user = userEvent.setup();
    render(
      <RealtimeReportCenterPanel
        permissions={["REPORT_PREVIEW", "REPORT_EXPORT"]}
        repository={api}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "生成并下载报告" }),
    );

    expect(
      await screen.findByRole("heading", { name: "齐齐哈尔市综合经营日报" }),
    ).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "报告预览已生成，但文件下载未完成",
    );
    expect(screen.getByRole("button", { name: "重试下载报告" })).toBeEnabled();
  });
});
