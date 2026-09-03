import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  BusinessRecordListInput,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";

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
  it("keeps the production table shell while exposing formal-sample maintenance rows", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onEditRecord = vi.fn();
    const onSelectionChange = vi.fn();
    const deleteFormalSamplePoint = vi.fn().mockResolvedValue(undefined);
    const repository = {
      listProduction: vi.fn().mockResolvedValue({
        items: [],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 0,
        totalPages: 0,
      }),
      listEligibleFormalSamples: vi.fn().mockResolvedValue([
        {
          samplePointId: "sample-production-1",
          sampleName: "龙沙区玉米产情样本",
          address: "龙沙区详细地址",
          objectTypeCode: "FARMER",
          objectTypeName: "农户",
          domain: "PRODUCTION",
          productCode: "CORN",
          regionCode: "230202",
          regionName: "龙沙区",
          maintainerSubjectId: "maintainer-1",
          maintainerDisplayName: "样本维护员",
          latitude: "47.3000000",
          longitude: "123.9000000",
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          version: 3,
          annualObservationCount: 1,
          networkMembershipCount: 0,
          latestObservationId: "PROD-DB-001",
          latestObservedAt: "2026-08-08T00:00:00Z",
          latestValues: {
            PROD_SURVEY_YEAR: "2026",
            PROD_SURVEY_MONTH: "8",
            PROD_SURVEY_DATE: "2026-08-08",
            PROD_OBJECT_TYPE: "FARMER",
            PROD_REGION: "龙沙区",
            cultivatedAreaMu: "320.0000",
          },
        },
      ]),
      deleteFormalSamplePoint,
      loadProductionDefinition: productionDefinition,
    } as unknown as RealtimeBusinessRepository;

    render(
      <ProductProductionCollectionWorkspace
        onEditRecord={onEditRecord}
        onScopeChange={vi.fn()}
        onSelectionChange={onSelectionChange}
        permissions={[
          "BUSINESS_UPDATE",
          "FORMAL_SAMPLE_MANAGE",
          "FORMAL_SAMPLE_DELETE",
        ]}
        queryAllowed
        realtimeRepository={repository}
        scope={realtimeScope}
        section="corn-collection"
      />,
    );

    const table = screen.getByRole("table", { name: "玉米产情调查表" });
    expect(table.closest("section")).toHaveClass(
      "enterprise-ledger-table--production",
    );
    const row = await screen.findByRole("row", { name: /龙沙区玉米产情样本/u });
    expect(
      screen.getByRole("columnheader", { name: "详细地址" }),
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "样本点维护人" }),
    ).toBeVisible();
    expect(within(row).getByText("龙沙区详细地址")).toBeVisible();
    expect(within(row).getByText("样本维护员")).toBeVisible();
    expect(
      await screen.findByRole("columnheader", { name: "种植面积（亩）" }),
    ).toBeVisible();
    expect(within(row).getByText("320.0000")).toBeVisible();
    expect(screen.queryByLabelText("填报状态")).not.toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "查看照片" })).toBeNull();
    expect(within(row).getByRole("button", { name: "查看记录" })).toBeVisible();
    expect(within(row).getByRole("button", { name: "编辑" })).toBeVisible();
    expect(within(row).getByRole("button", { name: "删除" })).toBeVisible();
    await userEvent.click(
      within(row).getByRole("button", { name: "查看记录" }),
    );
    expect(onEditRecord).toHaveBeenCalledWith("CORN", "PROD-DB-001");
    await userEvent.click(within(row).getByRole("button", { name: "编辑" }));
    expect(onSelectionChange).toHaveBeenCalledWith({
      type: "formal-sample-observation",
      id: "sample-production-1",
    });
    await userEvent.click(within(row).getByRole("button", { name: "删除" }));
    expect(confirm).toHaveBeenCalledWith(
      "确认删除“龙沙区玉米产情样本”？删除后将从当前台账和分析中移除，历史审计仍保留。",
    );
    await waitFor(() =>
      expect(deleteFormalSamplePoint).toHaveBeenCalledWith(
        "sample-production-1",
        3,
      ),
    );
  });
  it("resolves persisted Chinese production object-type labels through formal master data", async () => {
    const loadProductionDefinition = vi
      .fn()
      .mockResolvedValue(await productionDefinition());
    const repository = {
      listProduction: vi.fn().mockResolvedValue({
        items: [
          {
            id: "PROD-VILLAGE-001",
            values: {
              PROD_OBJECT_TYPE: "村委会",
              PROD_SAMPLE_NAME: "正式村级样本",
              PROD_SURVEY_YEAR: "2026",
              PROD_SURVEY_MONTH: "8",
              PROD_REGION: "龙江县",
              PROD_STATUS: "APPROVED",
            },
          },
          {
            id: "PROD-FARMER-001",
            values: {
              PROD_OBJECT_TYPE: "农户",
              PROD_SAMPLE_NAME: "正式农户样本",
              PROD_SURVEY_YEAR: "2026",
              PROD_SURVEY_MONTH: "8",
              PROD_REGION: "龙江县",
              PROD_STATUS: "APPROVED",
            },
          },
        ],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 2,
        totalPages: 1,
      }),
      listObjectTypes: vi.fn().mockResolvedValue([
        { code: "FARMER", name: "农户", domain: "PRODUCTION" },
        {
          code: "VILLAGE_COMMITTEE",
          name: "村委会",
          domain: "PRODUCTION",
        },
      ]),
      loadMasterData,
      loadProductionDefinition,
    } as unknown as RealtimeBusinessRepository;

    render(
      <ProductProductionCollectionWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={repository}
        scope={realtimeScope}
        section="corn-collection"
      />,
    );

    await waitFor(() =>
      expect(loadProductionDefinition).toHaveBeenCalledWith(
        "CORN",
        "VILLAGE_COMMITTEE",
      ),
    );
    expect(loadProductionDefinition).toHaveBeenCalledTimes(1);
    expect(loadProductionDefinition).not.toHaveBeenCalledWith("CORN", "FARMER");
    expect(screen.getAllByText("村委会")).toHaveLength(2);
  });

  it("adopts the latest approved survey year instead of hiding records behind the calendar year", async () => {
    const listProduction = vi
      .fn<RealtimeBusinessRepository["listProduction"]>()
      .mockResolvedValue({
        items: [],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 0,
        totalPages: 0,
      });
    const approvedYearMasterData = vi.fn().mockResolvedValue({
      products: [{ code: "CORN", name: "玉米" }],
      periods: [],
      regions: [],
      approvedSurveyYears: [2024],
    });

    render(
      <ProductProductionCollectionWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={
          {
            listProduction,
            loadMasterData: approvedYearMasterData,
            loadProductionDefinition: productionDefinition,
          } as unknown as RealtimeBusinessRepository
        }
        scope={realtimeScope}
        section="corn-collection"
      />,
    );

    await waitFor(() =>
      expect(listProduction.mock.lastCall?.[0].filters?.surveyYear).toBe(
        "2024",
      ),
    );
    expect(screen.getByRole("combobox", { name: "数据年份" })).toHaveValue(
      "2024",
    );
    expect(
      screen.getByText("2025年及以前属于历史业务记录，不计入现有样本数量。"),
    ).toBeVisible();
  });

  it("queries by mandatory survey year and optional month without obsolete status or filling-date filters", async () => {
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
    expect(
      screen.queryByRole("option", { name: "填写中" }),
    ).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "数据月份" }),
      "8",
    );
    expect(screen.queryByRole("combobox", { name: "填报状态" })).toBeNull();

    await waitFor(() => {
      const filters = listProduction.mock.lastCall?.[0].filters;
      expect(filters).toMatchObject({
        surveyYear: "2026",
        surveyMonth: "8",
      });
      expect(filters).not.toHaveProperty("status");
      expect(filters).not.toHaveProperty("fillingDateFrom");
      expect(filters).not.toHaveProperty("fillingDateTo");
    });
    expect(screen.queryByLabelText("填报日期起")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("填报日期止")).not.toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "填报日期" }),
    ).toBeVisible();
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

  it("paginates the complete formal-sample projection twenty rows at a time", async () => {
    const user = userEvent.setup();
    const samples = Array.from({ length: 25 }, (_, index) => ({
      samplePointId: `sample-${index + 1}`,
      sampleName: `第 ${index + 1} 个正式样本点`,
      address: null,
      objectTypeCode: "FARMER",
      objectTypeName: "农户",
      domain: "PRODUCTION" as const,
      productCode: "CORN",
      regionCode: "230202",
      regionName: "龙沙区",
      maintainerSubjectId: null,
      maintainerDisplayName: null,
      latitude: "47.3000000",
      longitude: "123.9000000",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      version: 1,
      annualObservationCount: 1,
      networkMembershipCount: 0,
      latestObservationId: `record-${index + 1}`,
      latestObservedAt: "2026-08-08T00:00:00Z",
      latestValues: { PROD_OBJECT_TYPE: "FARMER" },
    }));
    const listEligibleFormalSamples = vi.fn().mockResolvedValue(samples);

    render(
      <ProductProductionCollectionWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={
          {
            listEligibleFormalSamples,
            loadProductionDefinition: productionDefinition,
          } as unknown as RealtimeBusinessRepository
        }
        scope={scope}
        section="corn-collection"
      />,
    );

    expect(await screen.findByText("第 1 个正式样本点")).toBeVisible();
    expect(screen.getByText("共 25 个样本点，当前显示 1–20")).toBeVisible();
    expect(screen.queryByText("第 21 个正式样本点")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "下一页" }));

    expect(await screen.findByText("第 21 个正式样本点")).toBeVisible();
    expect(screen.getByText("共 25 个样本点，当前显示 21–25")).toBeVisible();
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
            PROD_CULTIVAR_NAME: "圆粒粳稻",
            PROD_AREA_MU: "320 亩",
            cultivatedAreaMu: "320",
            PROD_YIELD_PER_MU: "510 公斤/亩",
            PROD_ESTIMATED_OUTPUT: "163200 公斤",
            PROD_REPORTER_NAME: "张三",
            PROD_SURVEYOR_NAME: "王雷",
            PROD_SURVEYOR_PHONE: "13800000000",
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
    expect(screen.getByRole("group", { name: "批量导入" })).toBeVisible();
    expect(screen.queryByRole("group", { name: "退回修正" })).toBeNull();
    expect(screen.getByRole("group", { name: "单条录入" })).toBeVisible();
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
    expect(screen.getByRole("columnheader", { name: "调研人" })).toBeVisible();
    expect(
      screen.queryByRole("columnheader", { name: "具体品种" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("columnheader", { name: "种植面积（亩）" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("columnheader", { name: "销售数量" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "自用数量" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "期初库存" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "期末余粮" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "未销售余粮" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "预计总产" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "填报人" })).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "调研人联系方式" }),
    ).toBeVisible();
    expect(screen.getByText("王雷")).toBeVisible();
    expect(screen.queryByText("圆粒粳稻")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "填报人联系方式" }),
    ).not.toBeInTheDocument();
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
      expect(downloadProductionXlsxTemplate).toHaveBeenCalledWith("CORN"),
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
      await screen.findByText(
        "导入完成：1 行已处理，合格行已自动提交审核，失败 0 行。",
      ),
    ).toBeVisible();
    await waitFor(() => expect(listProduction).toHaveBeenCalledTimes(3));
    await user.click(screen.getByRole("button", { name: "新建调查记录" }));
    expect(onCreateRecord).toHaveBeenCalledWith("CORN");
    await user.click(screen.getByRole("button", { name: "查看记录" }));
    expect(onEditRecord).toHaveBeenCalledWith("CORN", "PROD-DB-001");
    expect(screen.queryByRole("button", { name: "查看照片" })).toBeNull();
  });

  it("does not expose the internal import recovery store as a business draft workflow", async () => {
    const listPendingImportDrafts = vi.fn();
    const listProduction = vi.fn().mockResolvedValue({
      items: [],
      pageNumber: 0,
      pageSize: 20,
      totalElements: 0,
      totalPages: 1,
    });
    const repository = {
      listProduction,
      listPendingImportDrafts,
      loadProductionDefinition: productionDefinition,
    } as unknown as RealtimeBusinessRepository;

    render(
      <ProductProductionCollectionWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={repository}
        scope={scope}
        section="corn-collection"
      />,
    );

    await waitFor(() => expect(listProduction).toHaveBeenCalled());
    expect(listPendingImportDrafts).not.toHaveBeenCalled();
    expect(screen.queryByText(/导入草稿/u)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "全部提交审核" }),
    ).not.toBeInTheDocument();
  });

  it("shows the safe server explanation when a workbook structure is invalid", async () => {
    const user = userEvent.setup();
    const listProduction = vi.fn().mockResolvedValue({
      items: [],
      pageNumber: 0,
      pageSize: 20,
      totalElements: 0,
      totalPages: 0,
    });
    const importProductionCsv = vi.fn().mockRejectedValue(
      new RealtimeApiError({
        code: "INVALID_IMPORT_FORMAT",
        message: "文件多出第 39 列，请删除模板之外的列后重试。",
        status: 400,
      }),
    );
    const repository = {
      listProduction,
      importProductionCsv,
      loadMasterData,
      loadProductionDefinition: productionDefinition,
    } as unknown as RealtimeBusinessRepository;

    render(
      <ProductProductionCollectionWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={repository}
        scope={realtimeScope}
        section="corn-collection"
      />,
    );

    const file = new File(["xlsx"], "production.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    await user.upload(await screen.findByLabelText("批量导入产情记录"), file);

    expect(
      await screen.findByText("文件多出第 39 列，请删除模板之外的列后重试。"),
    ).toBeVisible();
  });

  it("keeps durable production import history out of the collection ledger", async () => {
    const listProduction = vi.fn().mockResolvedValue({
      items: [],
      pageNumber: 0,
      pageSize: 20,
      totalElements: 0,
      totalPages: 0,
    });
    const listImportJobs = vi.fn().mockResolvedValue({
      items: [],
      pageNumber: 0,
      pageSize: 5,
      totalElements: 1,
      totalPages: 1,
    });
    const repository = {
      listProduction,
      listImportJobs,
      loadMasterData,
      loadProductionDefinition: productionDefinition,
    } as unknown as RealtimeBusinessRepository;

    render(
      <ProductProductionCollectionWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={repository}
        scope={realtimeScope}
        section="corn-collection"
      />,
    );

    await waitFor(() => expect(listProduction).toHaveBeenCalled());
    expect(listImportJobs).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("region", { name: "导入任务记录" }),
    ).not.toBeInTheDocument();
  });

  it("keeps ordinary production import while removing returned-record correction controls", async () => {
    const listProduction = vi.fn().mockResolvedValue({
      items: [],
      pageNumber: 0,
      pageSize: 100,
      totalElements: 0,
      totalPages: 0,
    });
    const importReturnedCorrectionWorkbook = vi.fn().mockResolvedValue({
      id: "production-correction-1",
      domainCode: "PRODUCTION",
      statusCode: "COMPLETED",
      importedRows: 1,
      failedRows: 0,
    });
    const repository = {
      listProduction,
      loadProductionDefinition: productionDefinition,
      downloadReturnedCorrectionWorkbook: vi
        .fn()
        .mockResolvedValue(new Blob(["correction"])),
      importReturnedCorrectionWorkbook,
      getReturnedCorrectionJob: vi.fn(),
      downloadReturnedCorrectionErrors: vi.fn(),
    } as unknown as RealtimeBusinessRepository;

    render(
      <ProductProductionCollectionWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={repository}
        scope={scope}
        section="corn-collection"
      />,
    );

    await waitFor(() => expect(listProduction).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByRole("button", { name: "下载退回记录修正表" }),
    ).toBeNull();
    expect(screen.queryByText("批量导入修正结果")).toBeNull();
    expect(importReturnedCorrectionWorkbook).not.toHaveBeenCalled();
  });

  it("never opens the fixture draft workbench in the formal realtime path", async () => {
    const listProduction = vi.fn().mockResolvedValue({
      items: [],
      pageNumber: 0,
      pageSize: 20,
      totalElements: 0,
      totalPages: 0,
    });
    const repository = {
      listProduction,
      loadProductionDefinition: productionDefinition,
    } as unknown as RealtimeBusinessRepository;

    render(
      <ProductProductionCollectionWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={repository}
        scope={scope}
        section="corn-collection"
        selection={{ type: "work-item", id: "WORK-PRODUCTION-FILL-W31" }}
      />,
    );

    await waitFor(() => expect(listProduction).toHaveBeenCalled());
    expect(
      screen.queryByRole("region", { name: /单据工作台$/u }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("保存草稿")).not.toBeInTheDocument();
  });
});
