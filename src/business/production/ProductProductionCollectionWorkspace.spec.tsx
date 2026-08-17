import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  BusinessRecordListInput,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";

import type { OperationalScope } from "../core/operationalScope";
import { fixtureOperationalIdentity } from "../formalEnterpriseData";
import { ProductProductionCollectionWorkspace } from "./ProductProductionCollectionWorkspace";

afterEach(cleanup);

const scope: OperationalScope = {
  ...fixtureOperationalIdentity,
  coordinates: { regionId: "authorized-all" },
  authorization: {
    ...fixtureOperationalIdentity.authorization,
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

const productionDefinition = vi.fn().mockResolvedValue({
  productCode: "CORN",
  objectTypeCode: "FARMER",
  contractVersion: "production-survey-fields-v1",
  contractDigest:
    "sha256:44997993c550cd093d2012bb0eb0520b5f693da046cca2573d4fbe6b93f62e32",
  fields: [
    contractField(
      "PROD_SAMPLE_SUBJECT_CODE",
      "稳定主体码",
      "SUBJECT",
      "调查对象与联系",
      20,
      10,
      {
        controlType: "READONLY_SUBJECT",
        readOnly: true,
        importable: false,
      },
    ),
    contractField(
      "PROD_SAMPLE_NAME",
      "填报对象名称",
      "SUBJECT",
      "调查对象与联系",
      20,
      20,
    ),
    contractField(
      "PROD_REPORTER_NAME",
      "填报人",
      "SUBJECT",
      "调查对象与联系",
      20,
      30,
      {
        controlType: "READONLY_TEXT",
        readOnly: true,
        importable: false,
      },
    ),
    contractField(
      "PROD_SAMPLE_CONTACT",
      "填报对象联系方式",
      "SUBJECT",
      "调查对象与联系",
      20,
      40,
    ),
    contractField(
      "PROD_SAMPLE_LATITUDE",
      "填报对象纬度",
      "SUBJECT",
      "调查对象与联系",
      20,
      50,
      {
        valueType: "DECIMAL",
        controlType: "DECIMAL",
      },
    ),
    contractField(
      "cultivatedAreaMu",
      "种植面积",
      "OUTPUT",
      "产量信息",
      30,
      10,
      {
        valueType: "DECIMAL",
        controlType: "DECIMAL",
        unit: "亩",
      },
    ),
    contractField(
      "estimatedOutputKilograms",
      "预计总产",
      "OUTPUT",
      "产量信息",
      30,
      20,
      {
        valueType: "DECIMAL",
        controlType: "READONLY_DECIMAL",
        unit: "公斤",
        readOnly: true,
        calculated: true,
        importable: false,
      },
    ),
  ],
  groups: [],
});

function contractField(
  code: string,
  label: string,
  groupCode: string,
  groupLabel: string,
  groupOrder: number,
  sortOrder: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    code,
    label,
    groupCode,
    groupLabel,
    groupOrder,
    sortOrder,
    valueType: "TEXT",
    controlType: "TEXT",
    unit: null,
    required: false,
    options: [],
    readOnly: false,
    calculated: false,
    importable: true,
    displayed: true,
    description: null,
    precision: 18,
    scale: 4,
    ...overrides,
  };
}

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
            loadProductionDefinition: productionDefinition,
          } as unknown as RealtimeBusinessRepository
        }
        scope={realtimeScope}
        section="corn-collection"
      />,
    );

    await screen.findByRole("combobox", { name: "数据年份" });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "数据月份" }),
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
            loadProductionDefinition: productionDefinition,
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
            PROD_SURVEY_YEAR: "2026",
            PROD_SURVEY_MONTH: "8",
            PROD_SURVEY_PERIOD_PRECISION: "YEAR_MONTH",
            PROD_FILLING_AT: "2026-08-09T08:30:00+08:00",
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
            PROD_SAMPLE_SUBJECT_CODE: "INTERNAL-SUBJECT-001",
            PROD_SURVEY_PERIOD_GOVERNANCE_STATE: "CONFIRMED",
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
      loadProductionDefinition: productionDefinition,
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
    expect(screen.getAllByRole("columnheader")[0]).toHaveTextContent("序号");
    expect(
      screen.getByRole("columnheader", { name: "数据时间" }),
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "填报日期" }),
    ).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "地区" })).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "样本点名称" }),
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "样本点类型" }),
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "具体品种" }),
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "销售数量" }),
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "自用数量" }),
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "期初库存" }),
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "期末余粮" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("columnheader", { name: "未销售余粮" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "预计总产" }),
    ).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "填报人" })).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "样本点联系方式" }),
    ).toBeVisible();
    expect(screen.getByText("张三")).toBeVisible();
    expect(screen.getByText("47.3543")).toBeVisible();
    expect(screen.getByText("2026年8月")).toBeVisible();
    expect(screen.queryByText("INTERNAL-SUBJECT-001")).not.toBeInTheDocument();
    expect(screen.queryByText("CONFIRMED")).not.toBeInTheDocument();
    expect(screen.queryByText(/EXT-007/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "系统字段" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "稳定主体码" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("调查期间")).not.toBeInTheDocument();
    expect(
      screen.queryByText("调查对象", { exact: true }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("对象类型", { exact: true }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("行政区划", { exact: true }),
    ).not.toBeInTheDocument();
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
      expect(importProductionCsv).toHaveBeenCalledWith(
        file,
        "CORN",
        "FARMER",
        [],
      ),
    );
    expect(
      await screen.findByText("导入完成：1 行已保存到填报草稿，失败 0 行。"),
    ).toBeVisible();
    expect(listProduction).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole("button", { name: "新建调查记录" }));
    expect(onCreateRecord).toHaveBeenCalledWith("CORN");
    await user.click(screen.getByRole("button", { name: "查看记录" }));
    expect(onEditRecord).toHaveBeenCalledWith("CORN", "PROD-DB-001");
    await user.click(screen.getByRole("button", { name: "查看照片" }));
    expect(onEditRecord).toHaveBeenCalledTimes(2);
  });
});
