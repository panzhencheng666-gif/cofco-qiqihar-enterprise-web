import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";
import { RealtimeLogisticsOperationsPanel } from "./RealtimeLogisticsOperationsPanel";

afterEach(cleanup);

function logisticsField(
  code: string,
  label: string,
  controlType = "TEXT",
  required = true,
) {
  return {
    code,
    label,
    controlType,
    unit: null,
    precision: null,
    scale: null,
    required,
    readOnly: controlType.startsWith("READONLY"),
    sortOrder: 10,
    options: [],
  };
}

const publicLogisticsFields = [
  logisticsField("surveyYear", "数据年份"),
  logisticsField("surveyMonth", "数据月份", "TEXT", false),
  logisticsField("fillingDate", "填报日期", "READONLY_DATETIME", false),
  logisticsField("LOG_SAMPLE_NAME", "物流样本点名称"),
  logisticsField("LOG_REGION", "地区"),
  logisticsField("LOG_REPORTER", "填报人"),
  logisticsField("LOG_SURVEYOR_NAME", "调研人", "TEXT", false),
  logisticsField("LOG_SURVEYOR_PHONE", "调研人联系方式", "TEXT", false),
  logisticsField("LOG_SAMPLE_CONTACT", "物流样本点联系方式"),
  logisticsField("LOG_SAMPLE_LATITUDE", "纬度"),
  logisticsField("LOG_SAMPLE_LONGITUDE", "经度"),
  logisticsField("LOG_TRANSPORT_MODE", "运输方式"),
  logisticsField("LOG_DIRECTION", "运输方向"),
  logisticsField("LOG_ROUTE_VOLUME", "运输数量"),
  logisticsField("LOG_FREIGHT_RATE", "物流运价（不含车板价）"),
  logisticsField("LOG_BOARD_PRICE", "车板价"),
  logisticsField("LOG_STATUS", "填报状态", "READONLY_STATUS", false),
];

const publicEditableValues = {
  surveyYear: "2026",
  surveyMonth: "8",
  LOG_SAMPLE_NAME: "齐齐哈尔物流样本点",
  LOG_REGION: "230200",
  LOG_REPORTER: "物流填报员",
  LOG_SURVEYOR_NAME: "王雷",
  LOG_SURVEYOR_PHONE: "13800000000",
  LOG_SAMPLE_CONTACT: "13900000000",
  LOG_SAMPLE_LATITUDE: "47.354300",
  LOG_SAMPLE_LONGITUDE: "123.918200",
  LOG_TRANSPORT_MODE: "RAIL",
  LOG_DIRECTION: "INFLOW",
  LOG_ROUTE_VOLUME: "12.5000",
  LOG_FREIGHT_RATE: "80.2500",
  LOG_BOARD_PRICE: "2650.0000",
};

function repository(): RealtimeBusinessRepository {
  return {
    loadObservableAnalysisSnapshot: vi.fn(),
    loadCurrentSession: vi.fn(),
    bootstrapInvitationActivation: vi.fn(),
    activateInvitation: vi.fn(),
    loadEmployeeInvitation: vi.fn(),
    revokeInvitation: vi.fn(),
    reissueInvitation: vi.fn(),
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
    createAndSubmitProduction: vi.fn(),
    updateProduction: vi.fn(),
    updateAndSubmitProduction: vi.fn(),
    transitionProduction: vi.fn(),
    listMarket: vi.fn(),
    getMarket: vi.fn(),
    createMarket: vi.fn(),
    createAndSubmitMarket: vi.fn(),
    updateMarket: vi.fn(),
    updateAndSubmitMarket: vi.fn(),
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
        fields: publicLogisticsFields,
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
  it("uses logistics decimal scales as number input steps", async () => {
    const service = {
      ...repository(),
      loadLogisticsDefinition: vi.fn().mockResolvedValue({
        productCode: "CORN",
        fields: publicLogisticsFields.map((field) => {
          if (
            field.code === "LOG_SAMPLE_LATITUDE" ||
            field.code === "LOG_SAMPLE_LONGITUDE"
          ) {
            return {
              ...field,
              controlType: "DECIMAL",
              precision: 9,
              scale: 6,
            };
          }
          if (
            field.code === "LOG_ROUTE_VOLUME" ||
            field.code === "LOG_FREIGHT_RATE" ||
            field.code === "LOG_BOARD_PRICE"
          ) {
            return {
              ...field,
              controlType: "DECIMAL",
              precision: 18,
              scale: 4,
            };
          }
          return field;
        }),
        actions: [],
      }),
    };

    render(
      <RealtimeLogisticsOperationsPanel
        actorName="物流测试员"
        editorOnly
        repository={service}
      />,
    );

    expect(await screen.findByLabelText("纬度")).toHaveAttribute(
      "step",
      "0.000001",
    );
    expect(screen.getByLabelText("经度")).toHaveAttribute("step", "0.000001");
    expect(screen.getByLabelText("运输数量")).toHaveAttribute("step", "0.0001");
    expect(screen.getByLabelText("物流运价（不含车板价）")).toHaveAttribute(
      "step",
      "0.0001",
    );
  });

  it("renders only the approved logistics business contract even when backend metadata adds internal fields", async () => {
    const field = (
      code: string,
      label: string,
      options: readonly {
        value: string;
        label: string;
        sortOrder: number;
      }[] = [],
      readOnly = false,
    ) => ({
      code,
      label,
      controlType: readOnly ? "READONLY_DATETIME" : "TEXT",
      unit: null,
      precision: null,
      scale: null,
      required: !readOnly,
      readOnly,
      sortOrder: 10,
      options,
    });
    const service = {
      ...repository(),
      loadLogisticsDefinition: vi.fn().mockResolvedValue({
        productCode: "CORN",
        fields: [
          field("surveyYear", "数据年份"),
          field("surveyMonth", "数据月份"),
          field("fillingDate", "填报日期", [], true),
          field("LOG_SAMPLE_NAME", "物流样本点名称"),
          field("LOG_REGION", "地区"),
          field("LOG_REPORTER", "填报人"),
          field("LOG_SURVEYOR_NAME", "调研人"),
          field("LOG_SURVEYOR_PHONE", "调研人联系方式"),
          field("LOG_SAMPLE_CONTACT", "物流样本点联系方式"),
          field("LOG_SAMPLE_LATITUDE", "纬度"),
          field("LOG_SAMPLE_LONGITUDE", "经度"),
          field("LOG_TRANSPORT_MODE", "运输方式"),
          field("LOG_DIRECTION", "运输方向"),
          field("LOG_ROUTE_VOLUME", "运输数量"),
          field("LOG_FREIGHT_RATE", "物流运价（不含车板价）"),
          field("LOG_BOARD_PRICE", "车板价"),
          field("LOG_PERIOD", "物流监测期"),
          field("LOG_COLLECTION_DATE", "物流采集期"),
          field("LOG_ORIGIN", "物流起运节点"),
          field("LOG_DESTINATION", "物流到达节点"),
          field("LOG_TRANSIT_TIME", "物流在途时间"),
          field("LOG_INTERNAL_LOCATION_KEY", "内部位置键"),
        ],
        actions: [],
      }),
    };

    render(
      <RealtimeLogisticsOperationsPanel
        actorName="物流测试员"
        editorOnly
        repository={service}
      />,
    );

    expect(await screen.findByLabelText("数据年份")).toBeVisible();
    expect(screen.getByLabelText("数据月份")).toBeVisible();
    expect(screen.getByLabelText("填报日期")).toHaveTextContent(
      "保存后由系统生成",
    );
    expect(screen.getByLabelText("车板价")).toBeVisible();
    expect(screen.getByLabelText("物流运价（不含车板价）")).toBeVisible();
    expect(screen.getByLabelText("填报人")).toHaveTextContent("物流测试员");
    expect(screen.getByLabelText("调研人")).toBeVisible();
    expect(screen.getByLabelText("调研人联系方式")).toBeVisible();
    expect(screen.queryByLabelText("填报人联系方式")).not.toBeInTheDocument();
    expect(screen.getByLabelText("物流样本点联系方式")).toBeVisible();
    expect(screen.queryByLabelText("物流监测期")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("物流采集期")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("物流起运节点")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("物流到达节点")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("物流在途时间")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("内部位置键")).not.toBeInTheDocument();
  });

  it("voids an editable logistics draft and leaves the terminal record read-only", async () => {
    const user = userEvent.setup();
    const draft = {
      id: "LOG-3C-VOID-001",
      productCode: "CORN",
      values: {
        surveyYear: "2026",
        surveyMonth: "8",
        LOG_REPORTER: "物流填报员",
      },
      displayValues: {
        surveyYear: "2026",
        surveyMonth: "8",
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

    await user.click(await screen.findByRole("button", { name: "作废记录" }));
    expect(transitionLogistics).toHaveBeenCalledWith(
      draft.id,
      "void",
      0,
      undefined,
    );
    await screen.findByText(/作废成功/);
    expect(screen.getByLabelText("填报状态")).toHaveTextContent("已作废");
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
        surveyYear: "2026",
        surveyMonth: "8",
        LOG_REPORTER: "物流填报员",
        fillingDate: "2026-08-09T13:00:00Z",
        LOG_STATUS: "PENDING_REVIEW",
      },
      displayValues: {
        surveyYear: "2026",
        surveyMonth: "8",
        LOG_REPORTER: "物流填报员",
        fillingDate: "2026-08-09 21:00",
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
    expect(screen.getByLabelText(/数据年份/)).toBeDisabled();
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
      values: {
        surveyYear: "2026",
        surveyMonth: "8",
        LOG_REPORTER: "物流填报员",
      },
      displayValues: {
        surveyYear: "2026",
        surveyMonth: "8",
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
      values: {
        surveyYear: "2026",
        surveyMonth: "8",
        LOG_REPORTER: "物流填报员",
      },
      displayValues: {
        surveyYear: "2026",
        surveyMonth: "8",
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

    expect(await screen.findByLabelText(/数据年份/)).toBeDisabled();
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
      values: {
        surveyYear: "2026",
        surveyMonth: "8",
        LOG_REPORTER: "物流填报员",
      },
      displayValues: {
        surveyYear: "2026",
        surveyMonth: "8",
        LOG_REPORTER: "物流填报员",
      },
      status: "DRAFT",
      returnReason: null,
      allowedActions: ["SAVE", "SUBMIT"],
      version: 1,
    } as const;
    const second = {
      ...first,
      values: { ...first.values, surveyMonth: "9" },
      displayValues: {
        ...first.displayValues,
        surveyMonth: "9",
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
    expect(await screen.findByLabelText(/数据月份/)).toHaveValue("8");

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
    expect(screen.getByLabelText(/数据月份/)).toHaveValue("9");
  });

  it("does not overwrite unsaved logistics edits when a business event arrives", async () => {
    const user = userEvent.setup();
    const record = {
      id: "LOG-LIVE-DIRTY-001",
      productCode: "CORN",
      values: {
        ...publicEditableValues,
        LOG_SAMPLE_NAME: "原物流样本点",
      },
      displayValues: {
        ...publicEditableValues,
        LOG_SAMPLE_NAME: "原物流样本点",
      },
      status: "RETURNED",
      returnReason: "请补充物流样本点名称",
      allowedActions: ["SAVE", "SUBMIT"],
      version: 2,
    } as const;
    const getLogistics = vi.fn().mockResolvedValue(record);
    const updateLogistics = vi.fn().mockResolvedValue({
      ...record,
      values: {
        ...record.values,
        LOG_SAMPLE_NAME: "已补充物流样本点",
      },
      displayValues: {
        ...record.displayValues,
        LOG_SAMPLE_NAME: "已补充物流样本点",
      },
      version: 3,
    });
    const service = {
      ...repository(),
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
    const source = await screen.findByLabelText(/物流样本点名称/);
    await user.clear(source);
    await user.type(source, "已补充物流样本点");

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
    expect(screen.getByLabelText(/物流样本点名称/)).toHaveValue(
      "已补充物流样本点",
    );

    await user.click(screen.getByRole("button", { name: "保存物流记录" }));
    expect(updateLogistics).toHaveBeenCalledWith(record.id, {
      productCode: "CORN",
      values: {
        ...publicEditableValues,
        LOG_SAMPLE_NAME: "已补充物流样本点",
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
        ...publicEditableValues,
        LOG_REPORTER: "物流测试员",
        fillingDate: "2026-08-09T13:00:00Z",
        LOG_STATUS: "RETURNED",
      },
      displayValues: {
        ...publicEditableValues,
        LOG_REPORTER: "物流测试员",
        fillingDate: "2026-08-09 21:00",
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
        ...publicEditableValues,
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
    expect(importWorkbook).toHaveBeenCalledWith(expect.any(File), "CORN", []);
    expect(await screen.findByLabelText("批量导入处理结果")).toHaveTextContent(
      "导入完成：2 行已处理，合格行已自动提交审核，失败 0 行。",
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

  it("renders the fixed public logistics definition and no legacy fields", async () => {
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
    expect(screen.getByLabelText(/数据年份/)).toBeVisible();
    expect(screen.getByLabelText("填报人")).toHaveTextContent("物流测试员");
    expect(screen.getByLabelText("填报日期")).toHaveTextContent(
      "保存后由系统生成",
    );
    expect(screen.getByLabelText("填报状态")).toHaveTextContent(
      "保存后由系统生成",
    );
    expect(
      screen.queryByRole("textbox", { name: "填报日期" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "填报状态" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("物流监测期")).not.toBeInTheDocument();
  });
});
