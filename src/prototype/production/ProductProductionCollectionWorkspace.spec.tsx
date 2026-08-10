import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  BusinessRecordListInput,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";

import type { OperationalScope } from "../core/operationalScope";
import { prototypeOperationalIdentity } from "../formalEnterpriseData";
import { ProductProductionCollectionWorkspace } from "./ProductProductionCollectionWorkspace";

afterEach(cleanup);

const scope: OperationalScope = {
  ...prototypeOperationalIdentity,
  coordinates: { regionId: "authorized-all" },
  authorization: {
    ...prototypeOperationalIdentity.authorization,
    authorizedBusinessClassificationIds: ["production.planting-production"],
    authorizedProductIds: ["corn"],
    authorizedCultivarIds: [],
  },
  savedView: null,
};

const realtimeScope: OperationalScope = {
  ...scope,
  authorization: {
    ...scope.authorization,
    authorizedRegionIds: [
      "230202",
    ] as unknown as OperationalScope["authorization"]["authorizedRegionIds"],
  },
};

const loadMasterData = vi.fn().mockResolvedValue({
  products: [{ code: "CORN", name: "玉米" }],
  periods: [],
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
  ],
});

describe("product production collection workspace", () => {
  it("queries by mandatory survey year, optional month, real filling dates and status", async () => {
    const user = userEvent.setup();
    const listProduction = vi
      .fn<RealtimeBusinessRepository["listProduction"]>()
      .mockResolvedValue({
        items: [],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 0,
        totalPages: 0,
      });
    render(
      <ProductProductionCollectionWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={
          {
            listProduction,
            loadMasterData,
          } as unknown as RealtimeBusinessRepository
        }
        scope={realtimeScope}
        section="corn-collection"
      />,
    );

    await screen.findByRole("combobox", { name: "调查年份" });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "调查月份" }),
      "8",
    );
    await user.type(screen.getByLabelText("填报日期起"), "2026-08-01");
    await user.type(screen.getByLabelText("填报日期止"), "2026-08-31");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "填报状态" }),
      "待审核",
    );

    await waitFor(() =>
      expect(listProduction.mock.lastCall?.[0].filters).toMatchObject({
        surveyYear: "2026",
        surveyMonth: "8",
        fillingDateFrom: "2026-08-01",
        fillingDateTo: "2026-08-31",
        status: "PENDING_REVIEW",
      }),
    );
    expect(screen.queryByLabelText("调查日期")).not.toBeInTheDocument();
  });

  it("loads the next persisted page instead of rendering empty pagination buttons", async () => {
    const user = userEvent.setup();
    const records = Array.from({ length: 25 }, (_, index) => ({
      id: `PROD-PAGE-${String(index + 1).padStart(2, "0")}`,
      values: {
        PROD_SURVEY_DATE: "2026-08-08",
        PROD_SUBJECT_NAME: `第 ${index + 1} 个产情调查点`,
        PROD_OBJECT_TYPE: "FARMER",
        PROD_REGION: "齐齐哈尔市",
        PROD_STATUS: "DRAFT",
      },
      allowedActions: [],
      version: 1,
    }));
    const listProduction = vi.fn(({ page = 0 }: BusinessRecordListInput) =>
      Promise.resolve({
        items: records.slice(page * 20, page * 20 + 20),
        pageNumber: page,
        pageSize: 20,
        totalElements: records.length,
        totalPages: 2,
      }),
    );

    render(
      <ProductProductionCollectionWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={
          {
            listProduction,
            loadMasterData,
          } as unknown as RealtimeBusinessRepository
        }
        scope={realtimeScope}
        section="corn-collection"
      />,
    );

    expect(await screen.findByText("第 1 个产情调查点")).toBeVisible();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "业务地区" }),
      "230202",
    );
    await waitFor(() => {
      expect(listProduction.mock.lastCall?.[0].page).toBe(0);
      expect(listProduction.mock.lastCall?.[0].filters?.regionCode).toBe(
        "230202",
      );
    });
    expect(screen.queryByText("第 21 个产情调查点")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "下一页" }));

    expect(await screen.findByText("第 21 个产情调查点")).toBeVisible();
    expect(listProduction.mock.lastCall?.[0]).toMatchObject({
      page: 1,
      pageSize: 20,
    });
    expect(listProduction.mock.lastCall?.[0].filters?.regionCode).toBe(
      "230202",
    );
  });

  it("shows persisted records and performs a real CSV/XLSX import", async () => {
    const user = userEvent.setup();
    const listProduction = vi.fn().mockResolvedValue({
      items: [
        {
          id: "PROD-DB-001",
          values: {
            PROD_SURVEY_DATE: "2026-08-08",
            PROD_SUBJECT_NAME: "克山县第一调查点",
            PROD_OBJECT_TYPE: "农户",
            PROD_REGION: "克山县",
            PROD_AREA_MU: "320 亩",
            PROD_YIELD_PER_MU: "510 公斤/亩",
            PROD_ESTIMATED_OUTPUT: "163200 公斤",
            PROD_REPORTER_NAME: "张三",
            PROD_REPORTER_PHONE: "13800000000",
            PROD_SAMPLE_CONTACT: "13900000000",
            PROD_SAMPLE_LATITUDE: "47.3543",
            PROD_SAMPLE_LONGITUDE: "123.9182",
            PROD_STATUS: "APPROVED",
          },
          allowedActions: [],
          version: 1,
        },
      ],
      pageNumber: 0,
      pageSize: 100,
      totalElements: 1,
      totalPages: 1,
    });
    const importProductionCsv = vi.fn().mockResolvedValue({
      id: "IMPORT-001",
      domainCode: "PRODUCTION",
      statusCode: "COMPLETED",
      importedRows: 1,
      failedRows: 0,
    });
    const downloadProductionXlsxTemplate = vi
      .fn()
      .mockResolvedValue(new Blob(["xlsx"]));
    const onCreateRecord = vi.fn();
    const onEditRecord = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:template"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );
    const repository = {
      listProduction,
      importProductionCsv,
      downloadProductionXlsxTemplate,
    } as unknown as RealtimeBusinessRepository;

    render(
      <ProductProductionCollectionWorkspace
        onCreateRecord={onCreateRecord}
        onEditRecord={onEditRecord}
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={repository}
        scope={scope}
        section="corn-collection"
      />,
    );

    expect(await screen.findByText("克山县第一调查点")).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "填报人" })).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "填报对象联系方式" }),
    ).toBeVisible();
    expect(screen.getByText("张三")).toBeVisible();
    expect(screen.getByText("47.3543")).toBeVisible();
    expect(
      screen.queryByRole("combobox", { name: "具体品种" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("产情监测 · PROD-CORN-001"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "查询" }));
    await waitFor(() => expect(listProduction).toHaveBeenCalledTimes(2));

    const templateButton = screen.getByRole("button", {
      name: "下载 XLSX 模板",
    });
    expect(templateButton).toBeEnabled();
    await user.click(templateButton);
    await waitFor(() =>
      expect(downloadProductionXlsxTemplate).toHaveBeenCalledWith(
        "CORN",
        "FARMER",
      ),
    );

    const file = new File(["header\nvalue"], "production.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    await user.upload(screen.getByLabelText("批量导入产情记录"), file);

    await waitFor(() =>
      expect(importProductionCsv).toHaveBeenCalledWith(file, "CORN", "FARMER"),
    );
    expect(
      await screen.findByText("导入完成：成功 1 条，失败 0 条。"),
    ).toBeVisible();
    await waitFor(() => expect(listProduction).toHaveBeenCalledTimes(3));
    await user.click(screen.getByRole("button", { name: "新建调查记录" }));
    expect(onCreateRecord).toHaveBeenCalledWith("CORN");
    await user.click(screen.getByRole("button", { name: "查看" }));
    expect(onEditRecord).toHaveBeenCalledWith("CORN", "PROD-DB-001");
  });
});
