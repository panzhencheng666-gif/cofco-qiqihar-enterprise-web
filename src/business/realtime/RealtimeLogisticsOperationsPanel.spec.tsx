import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";
import { RealtimeLogisticsOperationsPanel } from "./RealtimeLogisticsOperationsPanel";

afterEach(cleanup);

function repository(): RealtimeBusinessRepository {
  return {
    loadCurrentSession: vi.fn(),
    listEmployees: vi.fn(),
    loadAssignmentOptions: vi.fn(),
    inviteEmployee: vi.fn(),
    updateEmployee: vi.fn(),
    listAccessReviews: vi.fn(),
    createAccessReview: vi.fn(),
    decideAccessReview: vi.fn(),
    listAuditEvents: vi.fn(),
    loadWorkObligationWeeklyReport: vi.fn(),
    createWorkObligationReportExport: vi.fn(),
    downloadWorkObligationReport: vi.fn(),
    listNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
    subscribeBusinessEvents: vi.fn(),
    uploadEvidencePhoto: vi.fn(),
    loadMasterData: vi.fn(),
    loadSupplySurveyPeriods: vi.fn(),
    listAnnualComparisonDefinitions: vi.fn(),
    loadAnnualComparison: vi.fn(),
    loadReportParameterOptions: vi.fn(),
    createReportPreview: vi.fn(),
    createReportExport: vi.fn(),
    downloadReportExport: vi.fn(),
    createReportPublication: vi.fn(),
    listCultivars: vi.fn(),
    listObjectTypes: vi.fn(),
    loadProductionDefinition: vi.fn(),
    loadMarketDefinition: vi.fn(),
    listWorkItems: vi.fn(),
    listProduction: vi.fn(),
    getProduction: vi.fn(),
    createProduction: vi.fn(),
    updateProduction: vi.fn(),
    transitionProduction: vi.fn(),
    listMarket: vi.fn(),
    getMarket: vi.fn(),
    createMarket: vi.fn(),
    updateMarket: vi.fn(),
    transitionMarket: vi.fn(),
    loadSupplyInputWorkspace: vi.fn(),
    listSupplyAccounts: vi.fn(),
    createSupplyInputSet: vi.fn(),
    approveSupplyManualDecision: vi.fn(),
    releaseSupplySource: vi.fn(),
    runSupplyAccount: vi.fn(),
    importProductionCsv: vi.fn(),
    importLogisticsWorkbook: vi.fn(),
    downloadLogisticsXlsxTemplate: vi.fn(),
    loadLogisticsDefinition: vi.fn(() =>
      Promise.resolve({
        productCode: "CORN",
        fields: [
          {
            code: "LOG_PERIOD",
            label: "物流监测期",
            controlType: "SELECT",
            unit: null,
            precision: null,
            scale: null,
            required: true,
            readOnly: false,
            sortOrder: 10,
            options: [
              { value: "2026-W32", label: "2026年第32周", sortOrder: 1 },
              { value: "2026-W33", label: "2026年第33周", sortOrder: 2 },
            ],
          },
          {
            code: "LOG_REPORTER",
            label: "物流填报人",
            controlType: "TEXT",
            unit: null,
            precision: null,
            scale: null,
            required: true,
            readOnly: false,
            sortOrder: 20,
            options: [],
          },
          {
            code: "LOG_REPORTED_AT",
            label: "物流填报时间",
            controlType: "READONLY_DATETIME",
            unit: null,
            precision: null,
            scale: null,
            required: false,
            readOnly: true,
            sortOrder: 30,
            options: [],
          },
          {
            code: "LOG_STATUS",
            label: "物流状态",
            controlType: "READONLY_STATUS",
            unit: null,
            precision: null,
            scale: null,
            required: false,
            readOnly: true,
            sortOrder: 40,
            options: [],
          },
        ],
        actions: [],
      }),
    ),
    listLogistics: vi.fn(() =>
      Promise.resolve({
        items: [],
        pageNumber: 0,
        pageSize: 100,
        totalElements: 0,
        totalPages: 0,
      }),
    ),
    getLogistics: vi.fn(),
    createLogistics: vi.fn(),
    updateLogistics: vi.fn(),
    transitionLogistics: vi.fn(),
  };
}

describe("RealtimeLogisticsOperationsPanel", () => {
  it("voids an editable logistics draft and leaves the terminal record read-only", async () => {
    const user = userEvent.setup();
    const draft = {
      id: "LOG-3C-VOID-001",
      productCode: "CORN",
      values: { LOG_PERIOD: "2026-W32", LOG_REPORTER: "物流填报员" },
      displayValues: {
        LOG_PERIOD: "2026年第32周",
        LOG_REPORTER: "物流填报员",
      },
      status: "DRAFT",
      returnReason: null,
      allowedActions: ["SAVE", "SUBMIT", "VOID"],
      version: 0,
    } as const;
    const transitionLogistics = vi.fn().mockResolvedValue({
      ...draft,
      status: "VOIDED",
      allowedActions: ["VIEW"],
      version: 1,
    });
    const service = {
      ...repository(),
      getLogistics: vi.fn().mockResolvedValue(draft),
      transitionLogistics,
    };

    render(
      <RealtimeLogisticsOperationsPanel
        editorOnly
        initialRecordId={draft.id}
        mode="entry"
        repository={service}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "作废记录" }),
    );
    expect(transitionLogistics).toHaveBeenCalledWith(
      draft.id,
      "void",
      0,
      undefined,
    );
    await screen.findByText(/作废成功/);
    expect(screen.getByLabelText("物流状态")).toHaveTextContent("已作废");
    expect(
      screen.queryByRole("button", { name: "保存物流记录" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "提交审核" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "作废记录" }),
    ).not.toBeInTheDocument();
  });

  it("reviews the original logistics record without opening an editable entry form", async () => {
    const user = userEvent.setup();
    const record = {
      id: "LOG-REVIEW-001",
      productCode: "CORN",
      values: {
        LOG_PERIOD: "2026-W32",
        LOG_REPORTER: "物流填报员",
        LOG_REPORTED_AT: "2026-08-09T13:00:00Z",
        LOG_STATUS: "PENDING_REVIEW",
      },
      displayValues: {
        LOG_PERIOD: "2026年第32周",
        LOG_REPORTER: "物流填报员",
        LOG_REPORTED_AT: "2026-08-09 21:00",
        LOG_STATUS: "待审核",
      },
      status: "PENDING_REVIEW",
      returnReason: null,
      allowedActions: ["APPROVE", "RETURN"],
      version: 3,
    } as const;
    const transitionLogistics = vi.fn().mockResolvedValue({
      ...record,
      status: "APPROVED",
      allowedActions: [],
      version: 4,
    });
    const createLogistics = vi.fn();
    const onSaved = vi.fn();
    const service = {
      ...repository(),
      getLogistics: vi.fn().mockResolvedValue(record),
      createLogistics,
      transitionLogistics,
    };

    render(
      <RealtimeLogisticsOperationsPanel
        actorName="审核员工"
        editorOnly
        initialRecordId={record.id}
        mode="review"
        onSaved={onSaved}
        permissions={["BUSINESS_APPROVE", "BUSINESS_RETURN"]}
        repository={service}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "物流监测单据审核" }),
    ).toBeVisible();
    expect(screen.getByLabelText(/物流监测期/)).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "保存物流记录" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "新建物流记录" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "审核通过" }));
    expect(transitionLogistics).toHaveBeenCalledWith(
      record.id,
      "approve",
      3,
      undefined,
    );
    expect(createLogistics).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("uses permissions and record state to expose logistics review actions", async () => {
    const record = {
      id: "LOG-REVIEW-002",
      productCode: "CORN",
      values: { LOG_PERIOD: "2026-W32", LOG_REPORTER: "物流填报员" },
      displayValues: {
        LOG_PERIOD: "2026年第32周",
        LOG_REPORTER: "物流填报员",
      },
      status: "PENDING_REVIEW",
      returnReason: null,
      allowedActions: ["APPROVE", "RETURN"],
      version: 1,
    } as const;
    const service = {
      ...repository(),
      getLogistics: vi.fn().mockResolvedValue(record),
    };

    render(
      <RealtimeLogisticsOperationsPanel
        editorOnly
        initialRecordId={record.id}
        mode="review"
        permissions={[]}
        repository={service}
      />,
    );

    expect(await screen.findByText(/当前账号无可执行的审核操作/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "审核通过" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "退回补充" }),
    ).not.toBeInTheDocument();
  });

  it("removes editable logistics actions after submission", async () => {
    const record = {
      id: "LOG-PENDING-LOCKED-001",
      productCode: "CORN",
      values: { LOG_PERIOD: "2026-W32", LOG_REPORTER: "物流填报员" },
      displayValues: {
        LOG_PERIOD: "2026年第32周",
        LOG_REPORTER: "物流填报员",
      },
      status: "PENDING_REVIEW",
      returnReason: null,
      allowedActions: ["APPROVE", "RETURN"],
      version: 1,
    } as const;
    const service = {
      ...repository(),
      getLogistics: vi.fn().mockResolvedValue(record),
    };

    render(
      <RealtimeLogisticsOperationsPanel
        editorOnly
        initialRecordId={record.id}
        mode="entry"
        repository={service}
      />,
    );

    expect(await screen.findByLabelText(/物流监测期/)).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "保存物流记录" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "提交审核" }),
    ).not.toBeInTheDocument();
  });

  it("refreshes the open logistics record when a business event arrives", async () => {
    const first = {
      id: "LOG-LIVE-001",
      productCode: "CORN",
      values: { LOG_PERIOD: "2026-W32", LOG_REPORTER: "物流填报员" },
      displayValues: {
        LOG_PERIOD: "2026年第32周",
        LOG_REPORTER: "物流填报员",
      },
      status: "DRAFT",
      returnReason: null,
      allowedActions: ["SAVE", "SUBMIT"],
      version: 1,
    } as const;
    const second = {
      ...first,
      values: { ...first.values, LOG_PERIOD: "2026-W33" },
      displayValues: {
        ...first.displayValues,
        LOG_PERIOD: "2026年第33周",
      },
      version: 2,
    } as const;
    const getLogistics = vi
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValue(second);
    const service = { ...repository(), getLogistics };
    const view = render(
      <RealtimeLogisticsOperationsPanel
        editorOnly
        initialRecordId={first.id}
        mode="view"
        refreshToken={0}
        repository={service}
      />,
    );
    expect(await screen.findByLabelText(/物流监测期/)).toHaveValue("2026-W32");

    view.rerender(
      <RealtimeLogisticsOperationsPanel
        editorOnly
        initialRecordId={first.id}
        mode="view"
        refreshToken={1}
        repository={service}
      />,
    );

    await waitFor(() => expect(getLogistics).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText(/物流监测期/)).toHaveValue("2026-W33");
  });

  it("does not overwrite unsaved logistics edits when a business event arrives", async () => {
    const user = userEvent.setup();
    const record = {
      id: "LOG-LIVE-DIRTY-001",
      productCode: "CORN",
      values: {
        LOG_PERIOD: "2026-W32",
        LOG_SOURCE_ORGANIZATION: "原物流来源单位",
      },
      displayValues: {
        LOG_PERIOD: "2026年第32周",
        LOG_SOURCE_ORGANIZATION: "原物流来源单位",
      },
      status: "RETURNED",
      returnReason: "请补充来源单位",
      allowedActions: ["SAVE", "SUBMIT"],
      version: 2,
    } as const;
    const getLogistics = vi.fn().mockResolvedValue(record);
    const updateLogistics = vi.fn().mockResolvedValue({
      ...record,
      values: {
        ...record.values,
        LOG_SOURCE_ORGANIZATION: "已补充物流来源单位",
      },
      displayValues: {
        ...record.displayValues,
        LOG_SOURCE_ORGANIZATION: "已补充物流来源单位",
      },
      version: 3,
    });
    const service = {
      ...repository(),
      loadLogisticsDefinition: vi.fn().mockResolvedValue({
        productCode: "CORN",
        fields: [
          {
            code: "LOG_PERIOD",
            label: "物流监测期",
            controlType: "SELECT",
            unit: null,
            precision: null,
            scale: null,
            required: true,
            readOnly: false,
            sortOrder: 10,
            options: [
              { value: "2026-W32", label: "2026年第32周", sortOrder: 1 },
            ],
          },
          {
            code: "LOG_SOURCE_ORGANIZATION",
            label: "物流来源单位",
            controlType: "TEXT",
            unit: null,
            precision: null,
            scale: null,
            required: true,
            readOnly: false,
            sortOrder: 20,
            options: [],
          },
        ],
        actions: [],
      }),
      getLogistics,
      updateLogistics,
    };
    const listLogistics = vi.spyOn(service, "listLogistics");
    const view = render(
      <RealtimeLogisticsOperationsPanel
        editorOnly
        initialRecordId={record.id}
        mode="entry"
        refreshToken={0}
        repository={service}
      />,
    );
    const source = await screen.findByLabelText(/物流来源单位/);
    await user.clear(source);
    await user.type(source, "已补充物流来源单位");

    view.rerender(
      <RealtimeLogisticsOperationsPanel
        editorOnly
        initialRecordId={record.id}
        mode="entry"
        refreshToken={1}
        repository={service}
      />,
    );

    await waitFor(() => expect(listLogistics).toHaveBeenCalledTimes(2));
    expect(getLogistics).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/物流来源单位/)).toHaveValue(
      "已补充物流来源单位",
    );

    await user.click(screen.getByRole("button", { name: "保存物流记录" }));
    expect(updateLogistics).toHaveBeenCalledWith(record.id, {
      productCode: "CORN",
      values: {
        LOG_PERIOD: "2026-W32",
        LOG_SOURCE_ORGANIZATION: "已补充物流来源单位",
      },
      version: 2,
    });
  });

  it("excludes backend-owned read-only fields when revising a record", async () => {
    const user = userEvent.setup();
    const record = {
      id: "LOG-E2E-001",
      productCode: "CORN",
      values: {
        LOG_PERIOD: "2026-W32",
        LOG_REPORTER: "物流测试员",
        LOG_REPORTED_AT: "2026-08-09T13:00:00Z",
        LOG_STATUS: "RETURNED",
      },
      displayValues: {
        LOG_PERIOD: "2026年第32周",
        LOG_REPORTER: "物流测试员",
        LOG_REPORTED_AT: "2026-08-09 21:00",
        LOG_STATUS: "退回补充",
      },
      status: "RETURNED",
      returnReason: "补充来源台账",
      allowedActions: ["SAVE", "SUBMIT"],
      version: 2,
    } as const;
    const updateLogistics = vi.fn().mockResolvedValue(record);
    const service = {
      ...repository(),
      getLogistics: vi.fn().mockResolvedValue(record),
      updateLogistics,
    };

    render(
      <RealtimeLogisticsOperationsPanel
        actorName="物流测试员"
        editorOnly
        initialRecordId={record.id}
        repository={service}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "保存物流记录" }),
    );
    expect(updateLogistics).toHaveBeenCalledWith(record.id, {
      productCode: "CORN",
      values: {
        LOG_PERIOD: "2026-W32",
        LOG_REPORTER: "物流测试员",
      },
      version: 2,
    });
  });

  it("downloads the product template and imports XLSX records through a durable job", async () => {
    const user = userEvent.setup();
    const template = new Blob(["template"], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const downloadTemplate = vi.fn().mockResolvedValue(template);
    const importWorkbook = vi.fn().mockResolvedValue({
      id: "logistics-import-1",
      domainCode: "LOGISTICS",
      statusCode: "COMPLETED",
      importedRows: 2,
      failedRows: 0,
    });
    const listLogistics = vi.fn().mockResolvedValue({
      items: [],
      pageNumber: 0,
      pageSize: 100,
      totalElements: 0,
      totalPages: 0,
    });
    const service = {
      ...repository(),
      downloadLogisticsXlsxTemplate: downloadTemplate,
      importLogisticsWorkbook: importWorkbook,
      listLogistics,
    };
    const createObjectUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:logistics-template");
    const revokeObjectUrl = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const clickAnchor = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(
      <RealtimeLogisticsOperationsPanel
        actorName="物流测试员"
        repository={service}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "下载 XLSX 模板" }),
    );
    expect(downloadTemplate).toHaveBeenCalledWith("CORN");

    await user.upload(
      screen.getByLabelText("导入 XLSX"),
      new File(["workbook"], "物流批量导入.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    expect(importWorkbook).toHaveBeenCalledWith(expect.any(File), "CORN");
    expect(await screen.findByLabelText("批量导入处理结果")).toHaveTextContent(
      "导入完成：成功 2 条，失败 0 条。",
    );
    expect(listLogistics).toHaveBeenCalledTimes(2);

    createObjectUrl.mockRestore();
    revokeObjectUrl.mockRestore();
    clickAnchor.mockRestore();
  });

  it("does not poll because durable business events own refresh timing", async () => {
    const interval = vi.spyOn(window, "setInterval");
    render(
      <RealtimeLogisticsOperationsPanel
        actorName="物流测试员"
        editorOnly
        repository={repository()}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "物流监测填报" }),
    ).toBeVisible();
    expect(interval.mock.calls.some(([, delay]) => delay === 10_000)).toBe(
      false,
    );
    interval.mockRestore();
  });

  it("renders backend-owned logistics definitions and an empty real list", async () => {
    render(
      <RealtimeLogisticsOperationsPanel
        actorName="物流测试员"
        editorOnly
        repository={repository()}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "物流监测填报" }),
    ).toBeVisible();
    expect(screen.getByLabelText(/物流监测期/)).toBeVisible();
    expect(screen.getByLabelText("物流填报人")).toHaveTextContent("物流测试员");
    expect(screen.getByLabelText("物流填报时间")).toHaveTextContent(
      "保存后由系统生成",
    );
    expect(screen.getByLabelText("物流状态")).toHaveTextContent(
      "保存后由系统生成",
    );
    expect(
      screen.queryByRole("textbox", { name: "物流填报时间" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "物流状态" }),
    ).not.toBeInTheDocument();
  });
});
