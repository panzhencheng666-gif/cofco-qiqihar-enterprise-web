import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OperationalScope } from "../core/operationalScope";
import { prototypeOperationalIdentity } from "../formalEnterpriseData";
import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";
import { LogisticsMonitoringWorkspace } from "./LogisticsMonitoringWorkspace";

afterEach(cleanup);

const authorizedScope: OperationalScope = {
  ...prototypeOperationalIdentity,
  coordinates: { regionId: "authorized-all" },
  authorization: {
    ...prototypeOperationalIdentity.authorization,
    authorizedBusinessClassificationIds: ["market.logistics"],
    authorizedProductIds: ["corn", "soybean", "paddy"],
    authorizedCultivarIds: [],
  },
  savedView: null,
};

describe("logistics monitoring workspace", () => {
  it("uses a dedicated node ledger instead of mixing logistics into market subjects", () => {
    render(
      <LogisticsMonitoringWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        productCode="CORN"
        queryAllowed
        scope={authorizedScope}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "粮食物流节点监测表" }),
    ).toBeVisible();
    expect(
      within(screen.getByRole("combobox", { name: "节点类型" })).getByRole(
        "option",
        { name: "铁路站点" },
      ),
    ).toBeVisible();
    const table = screen.getByRole("table", {
      name: "粮食物流节点监测表",
    });
    expect(
      within(table).getByRole("columnheader", { name: "流入量" }),
    ).toBeVisible();
    expect(
      within(table).getByRole("columnheader", { name: "流出量" }),
    ).toBeVisible();
    expect(table).toHaveTextContent("齐齐哈尔铁路货运站");
    expect(table).toHaveTextContent("待审核");
    expect(table).toHaveTextContent("质量警告");
  });

  it("lists persisted logistics records by product without falling back to preset rows", async () => {
    const user = userEvent.setup();
    const listLogistics = vi.fn().mockResolvedValue({
      items: [
        {
          id: "LOG-DB-001",
          productCode: "CORN",
          values: {},
          displayValues: {
            LOG_COLLECTION_DATE: "2026-08-08",
            LOG_ORIGIN: "齐齐哈尔",
            LOG_DESTINATION: "黑河",
            LOG_TRANSPORT_MODE: "铁路",
            LOG_DIRECTION: "流出",
            LOG_ROUTE_VOLUME: "680 吨",
            LOG_FREIGHT_RATE: "86 元/吨",
            LOG_TRANSIT_TIME: "18 小时",
            LOG_SOURCE_ORGANIZATION: "齐齐哈尔物流中心",
            LOG_STATUS: "已核定",
          },
          status: "APPROVED",
          returnReason: null,
          allowedActions: [],
          version: 1,
        },
      ],
      pageNumber: 0,
      pageSize: 100,
      totalElements: 1,
      totalPages: 1,
    });
    const onCreateRecord = vi.fn();
    const repository = {
      listLogistics,
    } as unknown as RealtimeBusinessRepository;

    render(
      <LogisticsMonitoringWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        productCode="SOYBEAN"
        queryAllowed
        realtimeRepository={repository}
        scope={authorizedScope}
        onCreateRecord={onCreateRecord}
      />,
    );

    expect(await screen.findByText("LOG-DB-001")).toBeVisible();
    expect(screen.getByText("齐齐哈尔 → 黑河")).toBeVisible();
    expect(screen.queryByText("齐齐哈尔铁路货运站")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "批量导入" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "查询" }));
    await waitFor(() => expect(listLogistics).toHaveBeenCalledTimes(2));

    expect(
      screen.queryByRole("combobox", { name: "产品品种" }),
    ).not.toBeInTheDocument();
    expect(listLogistics).toHaveBeenLastCalledWith({
      page: 0,
      pageSize: 100,
      productCode: "SOYBEAN",
    });
    await user.click(screen.getByRole("button", { name: "新建监测记录" }));
    expect(onCreateRecord).toHaveBeenCalledWith("SOYBEAN");
  });

  it("downloads and imports the same product-specific logistics workbook", async () => {
    const user = userEvent.setup();
    const listLogistics = vi.fn().mockResolvedValue({
      items: [],
      pageNumber: 0,
      pageSize: 100,
      totalElements: 0,
      totalPages: 0,
    });
    const downloadLogisticsXlsxTemplate = vi
      .fn()
      .mockResolvedValue(new Blob(["workbook"]));
    const importLogisticsWorkbook = vi.fn().mockResolvedValue({
      id: "IMPORT-LOGISTICS-1",
      domainCode: "LOGISTICS",
      statusCode: "COMPLETED",
      importedRows: 1,
      failedRows: 0,
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:logistics-template"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );
    const repository = {
      listLogistics,
      downloadLogisticsXlsxTemplate,
      importLogisticsWorkbook,
    } as unknown as RealtimeBusinessRepository;
    render(
      <LogisticsMonitoringWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        productCode="CORN"
        queryAllowed
        realtimeRepository={repository}
        scope={authorizedScope}
      />,
    );

    await user.click(screen.getByRole("button", { name: "下载 XLSX 模板" }));
    expect(downloadLogisticsXlsxTemplate).toHaveBeenCalledWith("CORN");
    await user.upload(
      screen.getByLabelText("批量导入物流记录"),
      new File(["xlsx"], "物流.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    await waitFor(() =>
      expect(importLogisticsWorkbook).toHaveBeenCalledWith(
        expect.any(File),
        "CORN",
      ),
    );
    expect(await screen.findByText("已导入 1 条物流记录。")).toBeVisible();
    expect(listLogistics).toHaveBeenCalledTimes(2);
  });

  it("uses the same active field definition for the logistics form ledger", async () => {
    const loadLogisticsDefinition = vi.fn().mockResolvedValue({
      productCode: "CORN",
      fields: [
        {
          code: "LOG_COLLECTION_DATE",
          label: "采集日期",
          controlType: "DATE",
          unit: null,
          precision: null,
          scale: null,
          required: true,
          readOnly: false,
          sortOrder: 10,
          options: [],
        },
        {
          code: "LOG_REPORTER",
          label: "填报人",
          controlType: "TEXT",
          unit: null,
          precision: null,
          scale: null,
          required: true,
          readOnly: true,
          sortOrder: 20,
          options: [],
        },
        {
          code: "LOG_ROUTE_VOLUME",
          label: "运输数量",
          controlType: "DECIMAL",
          unit: "吨",
          precision: 18,
          scale: 4,
          required: true,
          readOnly: false,
          sortOrder: 30,
          options: [],
        },
      ],
      actions: [],
    });
    const listLogistics = vi.fn().mockResolvedValue({
      items: [
        {
          id: "LOG-EXACT-001",
          productCode: "CORN",
          values: {
            LOG_COLLECTION_DATE: "2026-08-09",
            LOG_REPORTER: "张三",
            LOG_ROUTE_VOLUME: "500",
          },
          displayValues: {
            LOG_COLLECTION_DATE: "2026-08-09",
            LOG_REPORTER: "张三",
            LOG_ROUTE_VOLUME: "500 吨",
          },
          status: "DRAFT",
          returnReason: null,
          allowedActions: [],
          version: 1,
        },
      ],
      pageNumber: 0,
      pageSize: 100,
      totalElements: 1,
      totalPages: 1,
    });
    const repository = {
      listLogistics,
      loadLogisticsDefinition,
    } as unknown as RealtimeBusinessRepository;

    render(
      <LogisticsMonitoringWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        productCode="CORN"
        queryAllowed
        realtimeRepository={repository}
        scope={authorizedScope}
      />,
    );

    expect(
      await screen.findByRole("columnheader", { name: "采集日期" }),
    ).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "填报人" })).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "运输数量（吨）" }),
    ).toBeVisible();
    expect(screen.getByText("张三")).toBeVisible();
    expect(screen.getByText("500 吨")).toBeVisible();
  });
});
