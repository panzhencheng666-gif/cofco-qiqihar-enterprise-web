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
import { ProductMarketCollectionWorkspace } from "./ProductMarketCollectionWorkspace";

afterEach(cleanup);

const scope: OperationalScope = {
  ...fixtureOperationalIdentity,
  coordinates: { regionId: "authorized-all" },
  authorization: {
    ...fixtureOperationalIdentity.authorization,
    authorizedBusinessClassificationIds: ["market.quote-trade"],
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

describe("product market collection workspace", () => {
  it("keeps the market table shell while exposing formal-sample maintenance rows", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onEditRecord = vi.fn();
    const onSelectionChange = vi.fn();
    const deleteFormalSamplePoint = vi.fn().mockResolvedValue(undefined);
    const repository = {
      listMarket: vi.fn().mockResolvedValue({
        items: [],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 0,
        totalPages: 0,
      }),
      listEligibleFormalSamples: vi.fn().mockResolvedValue([
        {
          samplePointId: "sample-market-1",
          sampleName: "龙沙区兴农农资店",
          address: "龙沙区农资街 8 号",
          objectTypeCode: "AGRICULTURAL_INPUT_STORE",
          objectTypeName: "农资店",
          domain: "MARKET",
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
          latestObservationId: "MKT-DB-001",
          latestObservedAt: "2026-08-08T00:00:00Z",
          latestValues: {
            MKT_TRADE_DATE: "2026-08-08",
            MKT_OBJECT_TYPE: "AGRICULTURAL_INPUT_STORE",
            MKT_REGION: "龙沙区",
            AGRI_INPUT_SEED_SALES_VOLUME: "1250.5000",
            AGRI_INPUT_SEED_RETAIL_PRICE: "8.7500",
            AGRI_INPUT_SUPPLY_STATUS: "TIGHT",
            AGRI_INPUT_PLANTING_INTENTION_TREND: "INCREASE",
          },
        },
      ]),
      deleteFormalSamplePoint,
      loadMarketDefinition: vi.fn().mockResolvedValue({
        productCode: "CORN",
        objectTypeCode: "AGRICULTURAL_INPUT_STORE",
        coreFields: [
          {
            code: "AGRI_INPUT_SEED_SALES_VOLUME",
            label: "种子销售量",
            controlType: "DECIMAL",
            unit: "公斤",
            description: null,
            capability: null,
            required: false,
            precision: 18,
            scale: 4,
            sortOrder: 130,
            options: [],
          },
          {
            code: "AGRI_INPUT_SEED_RETAIL_PRICE",
            label: "种子零售价",
            controlType: "DECIMAL",
            unit: "元/公斤",
            description: null,
            capability: null,
            required: false,
            precision: 18,
            scale: 4,
            sortOrder: 131,
            options: [],
          },
        ],
        groups: [],
      }),
    } as unknown as RealtimeBusinessRepository;

    render(
      <ProductMarketCollectionWorkspace
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

    const table = screen.getByRole("table", { name: "玉米市场采集表" });
    expect(table.closest("section")).toHaveClass(
      "enterprise-ledger-table--market",
    );
    const row = await screen.findByRole("row", { name: /龙沙区兴农农资店/u });
    expect(
      screen.getByRole("columnheader", { name: "详细地址" }),
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "样本点维护人" }),
    ).toBeVisible();
    expect(within(row).getByText("龙沙区农资街 8 号")).toBeVisible();
    expect(within(row).getByText("样本维护员")).toBeVisible();
    expect(
      await screen.findByRole("columnheader", { name: "种子销售量" }),
    ).toHaveTextContent("种子销售量公斤");
    expect(within(row).getByText("1250.5000")).toBeVisible();
    expect(screen.queryByLabelText("填报状态")).not.toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "查看照片" })).toBeNull();
    expect(within(row).getByRole("button", { name: "查看记录" })).toBeVisible();
    expect(within(row).getByRole("button", { name: "编辑" })).toBeVisible();
    expect(within(row).getByRole("button", { name: "删除" })).toBeVisible();
    await userEvent.click(
      within(row).getByRole("button", { name: "查看记录" }),
    );
    expect(onEditRecord).toHaveBeenCalledWith("CORN", "MKT-DB-001");
    await userEvent.click(within(row).getByRole("button", { name: "编辑" }));
    expect(onSelectionChange).toHaveBeenCalledWith({
      type: "formal-sample-observation",
      id: "sample-market-1",
    });
    await userEvent.click(within(row).getByRole("button", { name: "删除" }));
    expect(confirm).toHaveBeenCalledWith(
      "确认删除“龙沙区兴农农资店”？删除后将从当前台账和分析中移除，历史审计仍保留。",
    );
    await waitFor(() =>
      expect(deleteFormalSamplePoint).toHaveBeenCalledWith(
        "sample-market-1",
        3,
      ),
    );
  });
  it("resolves persisted Chinese object-type labels to formal definition codes", async () => {
    const loadMarketDefinition = vi.fn().mockResolvedValue({
      productCode: "CORN",
      objectTypeCode: "FEED_MILL",
      coreFields: [],
      groups: [],
    });
    const repository = {
      listMarket: vi.fn().mockResolvedValue({
        items: [
          {
            id: "MKT-FEED-001",
            values: {
              MKT_OBJECT_TYPE: "饲料厂",
              MKT_SAMPLE_NAME: "正式饲料样本",
              MKT_SURVEY_YEAR: "2026",
              MKT_SURVEY_MONTH: "8",
              MKT_FILLING_AT: "2026-08-29T04:46:46Z",
              MKT_REGION: "龙江县",
              MKT_STATUS: "已审核",
            },
          },
          {
            id: "MKT-TRADER-001",
            values: {
              MKT_OBJECT_TYPE: "贸易商",
              MKT_SAMPLE_NAME: "正式贸易商样本",
              MKT_SURVEY_YEAR: "2026",
              MKT_SURVEY_MONTH: "8",
              MKT_REGION: "龙江县",
              MKT_STATUS: "已审核",
            },
          },
        ],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 2,
        totalPages: 1,
      }),
      listObjectTypes: vi.fn().mockResolvedValue([
        { code: "TRADER", name: "贸易商", domain: "MARKET" },
        { code: "FEED_MILL", name: "饲料厂", domain: "MARKET" },
      ]),
      loadMasterData,
      loadMarketDefinition,
    } as unknown as RealtimeBusinessRepository;

    render(
      <ProductMarketCollectionWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={repository}
        scope={realtimeScope}
        section="corn-collection"
      />,
    );

    await waitFor(() =>
      expect(loadMarketDefinition).toHaveBeenCalledWith("CORN", "FEED_MILL"),
    );
    expect(loadMarketDefinition).toHaveBeenCalledTimes(1);
    expect(loadMarketDefinition).not.toHaveBeenCalledWith("CORN", "TRADER");
    expect(
      screen.queryByText(/市场业务字段定义读取失败/u),
    ).not.toBeInTheDocument();
  });

  it("clears a transient field-definition error after a successful retry", async () => {
    const user = userEvent.setup();
    const definition = {
      productCode: "CORN",
      objectTypeCode: "FEED_MILL",
      coreFields: [],
      groups: [],
    };
    const loadMarketDefinition = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary unavailable"))
      .mockResolvedValue(definition);
    const repository = {
      listMarket: vi.fn().mockResolvedValue({
        items: [
          {
            id: "MKT-FEED-RETRY",
            values: {
              MKT_OBJECT_TYPE: "饲料厂",
              MKT_SAMPLE_NAME: "重试样本",
              MKT_SURVEY_YEAR: "2026",
              MKT_SURVEY_MONTH: "8",
              MKT_REGION: "龙江县",
              MKT_STATUS: "已审核",
            },
          },
        ],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 1,
        totalPages: 1,
      }),
      listObjectTypes: vi
        .fn()
        .mockResolvedValue([
          { code: "FEED_MILL", name: "饲料厂", domain: "MARKET" },
        ]),
      loadMasterData,
      loadMarketDefinition,
    } as unknown as RealtimeBusinessRepository;

    render(
      <ProductMarketCollectionWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={repository}
        scope={realtimeScope}
        section="corn-collection"
      />,
    );

    expect(await screen.findByText(/市场业务字段定义读取失败/u)).toBeVisible();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "样本点类型" }),
      "feed-mill",
    );
    await waitFor(() => expect(loadMarketDefinition).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.queryByText(/市场业务字段定义读取失败/u),
      ).not.toBeInTheDocument(),
    );
  });

  it("uses the formal product object-type applicability and names from the backend", async () => {
    const listObjectTypes = vi.fn().mockResolvedValue([
      { code: "TRADER", name: "贸易商", domain: "MARKET" },
      { code: "DEEP_PROCESSOR", name: "深加工企业", domain: "MARKET" },
      { code: "BREEDING_FACTORY", name: "养殖场", domain: "MARKET" },
    ]);
    const repository = {
      listMarket: vi.fn().mockResolvedValue({
        items: [],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 0,
        totalPages: 0,
      }),
      listObjectTypes,
      loadMasterData,
      loadMarketDefinition: vi.fn().mockResolvedValue({
        productCode: "CORN",
        objectTypeCode: "TRADER",
        coreFields: [],
        groups: [],
      }),
    } as unknown as RealtimeBusinessRepository;

    render(
      <ProductMarketCollectionWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={repository}
        scope={realtimeScope}
        section="corn-collection"
      />,
    );

    await waitFor(() =>
      expect(listObjectTypes).toHaveBeenCalledWith("CORN", "MARKET"),
    );
    expect(screen.getByRole("option", { name: "深加工企业" })).toBeVisible();
    expect(screen.getByRole("option", { name: "养殖场" })).toBeVisible();
    expect(
      screen.queryByRole("option", { name: "米厂" }),
    ).not.toBeInTheDocument();
  });

  it("queries by mandatory survey year and optional month without workflow-state filters", async () => {
    const user = userEvent.setup();
    const listMarket = vi
      .fn<RealtimeBusinessRepository["listMarket"]>()
      .mockResolvedValue({
        items: [],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 0,
        totalPages: 0,
      });
    const repository = {
      listMarket,
      loadMasterData,
      loadMarketDefinition: vi.fn().mockResolvedValue({
        productCode: "CORN",
        objectTypeCode: "TRADER",
        coreFields: [],
        groups: [],
      }),
    } as unknown as RealtimeBusinessRepository;
    render(
      <ProductMarketCollectionWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={repository}
        scope={realtimeScope}
        section="corn-collection"
      />,
    );

    await screen.findByRole("combobox", { name: "数据年份" });
    expect(
      screen.getByText(
        "2026年度业务记录；现有样本以已批准的年度样本名单为准。",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("option", { name: "填写中" }),
    ).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "数据月份" }),
      "8",
    );
    expect(screen.queryByLabelText("填报状态")).not.toBeInTheDocument();

    await waitFor(() => {
      const filters = listMarket.mock.lastCall?.[0].filters;
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
    expect(screen.queryByLabelText("采集日期")).not.toBeInTheDocument();
  });

  it("loads the next persisted market page from the backend", async () => {
    const user = userEvent.setup();
    const records = Array.from({ length: 25 }, (_, index) => ({
      id: `MKT-PAGE-${String(index + 1).padStart(2, "0")}`,
      values: {
        MKT_SAMPLE_NAME: `第 ${index + 1} 个市场监测点`,
        MKT_OBJECT_TYPE: "TRADER",
        MKT_STATUS: "DRAFT",
      },
      allowedActions: [],
      version: 1,
    }));
    const listMarket = vi.fn(({ page = 0 }: BusinessRecordListInput) =>
      Promise.resolve({
        items: records.slice(page * 20, page * 20 + 20),
        pageNumber: page,
        pageSize: 20,
        totalElements: records.length,
        totalPages: 2,
      }),
    );
    const repository = {
      listMarket,
      loadMasterData,
      loadMarketDefinition: vi.fn().mockResolvedValue({
        productCode: "CORN",
        objectTypeCode: "TRADER",
        coreFields: [],
        groups: [],
      }),
    } as unknown as RealtimeBusinessRepository;

    render(
      <ProductMarketCollectionWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={repository}
        scope={realtimeScope}
        section="corn-collection"
      />,
    );

    expect(await screen.findByText("第 1 个市场监测点")).toBeVisible();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "业务地区" }),
      "230202",
    );
    await waitFor(() => {
      expect(listMarket.mock.lastCall?.[0].page).toBe(0);
      expect(listMarket.mock.lastCall?.[0].filters?.regionCode).toBe("230202");
    });
    await user.click(screen.getByRole("button", { name: "下一页" }));

    expect(await screen.findByText("第 21 个市场监测点")).toBeVisible();
    expect(listMarket.mock.lastCall?.[0]).toMatchObject({
      page: 1,
      pageSize: 20,
    });
    expect(listMarket.mock.lastCall?.[0].filters?.regionCode).toBe("230202");
  });

  it("downloads and imports the backend-owned market XLSX template from the list", async () => {
    const user = userEvent.setup();
    const listMarket = vi.fn().mockResolvedValue({
      items: [
        {
          id: "MKT-DB-001",
          values: {
            MKT_OBJECT_TYPE: "TRADER",
            MKT_SAMPLE_NAME: "验收贸易商",
            MKT_SURVEY_YEAR: "2026",
            MKT_SURVEY_MONTH: "8",
            MKT_SURVEY_PERIOD_PRECISION: "YEAR_MONTH",
            MKT_FILLING_AT: "2026-08-09T08:30:00+08:00",
            MKT_REGION: "克山县",
            MKT_REPORTER_NAME: "李四",
            MKT_SURVEYOR_NAME: "赵敏",
            MKT_SURVEYOR_PHONE: "13800000001",
            MKT_SAMPLE_CONTACT: "13900000001",
            MKT_SAMPLE_LATITUDE: "47.3543",
            MKT_SAMPLE_LONGITUDE: "123.9182",
            MKT_PURCHASE_BASE_PRICE: "2380",
            MKT_SALE_BASE_PRICE: "2420",
            PURCHASE_VOLUME: "30",
            ENDING_INVENTORY: "12",
            MKT_SAMPLE_SUBJECT_CODE: "INTERNAL-MARKET-001",
            MKT_INVENTORY_OWNERSHIP_TYPE: "OWNED",
            MKT_INVENTORY_POLICY_ATTRIBUTE: "POLICY_AND_COMMERCIAL",
            MKT_STATUS: "退回补充",
          },
        },
      ],
      pageNumber: 0,
      pageSize: 100,
      totalElements: 1,
      totalPages: 1,
    });
    const loadMarketDefinition = vi.fn().mockResolvedValue({
      productCode: "CORN",
      objectTypeCode: "TRADER",
      coreFields: [
        {
          code: "MKT_SAMPLE_SUBJECT_CODE",
          label: "稳定主体码",
          controlType: "READONLY_TEXT",
          unit: null,
          description: null,
          capability: null,
          required: false,
          precision: null,
          scale: null,
          sortOrder: 1,
          options: [],
        },
        {
          code: "MKT_PURCHASE_BASE_PRICE",
          label: "采集对象收购价格",
          controlType: "DECIMAL",
          unit: "元/吨",
          description: null,
          capability: null,
          required: true,
          precision: 18,
          scale: 4,
          sortOrder: 2,
          options: [],
        },
        {
          code: "MKT_SALE_BASE_PRICE",
          label: "采集对象销售价格",
          controlType: "DECIMAL",
          unit: "元/吨",
          description: null,
          capability: null,
          required: true,
          precision: 18,
          scale: 4,
          sortOrder: 3,
          options: [],
        },
      ],
      groups: [
        {
          category: "INVENTORY",
          label: "库存",
          sortOrder: 1,
          fields: [
            {
              code: "ENDING_INVENTORY",
              label: "期末库存",
              valueType: "DECIMAL",
              unit: "吨",
              description: null,
              precision: 18,
              scale: 4,
              sortOrder: 1,
            },
            {
              code: "STOCK_OUTFLOW",
              label: "出库量",
              valueType: "DECIMAL",
              unit: "吨",
              description: null,
              precision: 18,
              scale: 4,
              sortOrder: 2,
            },
            {
              code: "PROCESSING_INPUT",
              label: "加工投入量",
              valueType: "DECIMAL",
              unit: "吨",
              description: null,
              precision: 18,
              scale: 4,
              sortOrder: 3,
            },
          ],
        },
      ],
    });
    const importMarketWorkbook = vi.fn().mockResolvedValue({
      id: "IMPORT-MARKET-001",
      domainCode: "MARKET",
      statusCode: "COMPLETED",
      importedRows: 2,
      failedRows: 0,
    });
    const downloadMarketXlsxTemplate = vi
      .fn()
      .mockResolvedValue(new Blob(["xlsx"]));
    const onCreateRecord = vi.fn();
    const onEditRecord = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:market-template"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );
    const repository = {
      listMarket,
      loadMarketDefinition,
      importMarketWorkbook,
      downloadMarketXlsxTemplate,
    } as unknown as RealtimeBusinessRepository;

    render(
      <ProductMarketCollectionWorkspace
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

    expect(
      await screen.findByRole("button", { name: "下载 XLSX 模板" }),
    ).toBeEnabled();
    expect(screen.getByRole("group", { name: "批量导入" })).toBeVisible();
    expect(
      screen.queryByRole("group", { name: "退回修正" }),
    ).not.toBeInTheDocument();
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
    expect(
      screen.getByRole("columnheader", { name: "填报与定位" }),
    ).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "填报人" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "调研人" })).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "调研人联系方式" }),
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "样本点联系方式" }),
    ).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "纬度" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "经度" })).toBeVisible();
    expect(screen.getByText("李四")).toBeVisible();
    expect(screen.getByText("赵敏")).toBeVisible();
    expect(
      screen.queryByRole("columnheader", { name: "填报人联系方式" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("13900000001")).toBeVisible();
    expect(
      await screen.findByRole("columnheader", {
        name: "采集对象收购价格",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", {
        name: "采集对象销售价格",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("columnheader", { name: "现有库存" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "库存量" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("columnheader", { name: "期末库存" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("columnheader", { name: "库存存放地" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "具体品种" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "出库量" })).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "加工投入量" }),
    ).toBeVisible();
    expect(screen.getByText("2026年8月")).toBeVisible();
    expect(screen.queryByText("INTERNAL-MARKET-001")).not.toBeInTheDocument();
    expect(screen.queryByText("OWNED")).not.toBeInTheDocument();
    expect(screen.queryByText("POLICY_AND_COMMERCIAL")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "稳定主体码" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("调查期间")).not.toBeInTheDocument();
    expect(screen.queryByText("调查对象")).not.toBeInTheDocument();
    expect(
      screen.queryByText("采集对象", { exact: true }),
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
      screen.queryByRole("cell", { name: "需补充" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "查询" }));
    await waitFor(() => expect(listMarket).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole("button", { name: "下载 XLSX 模板" }));
    await waitFor(() =>
      expect(downloadMarketXlsxTemplate).toHaveBeenCalledWith("CORN"),
    );

    const file = new File(["market"], "market.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    await user.upload(screen.getByLabelText("批量导入市场采集记录"), file);

    await waitFor(() =>
      expect(importMarketWorkbook).toHaveBeenCalledWith(
        file,
        "CORN",
        "TRADER",
        [],
      ),
    );
    expect(
      await screen.findByText(
        "导入完成：2 行已处理，合格行已自动提交审核，失败 0 行。",
      ),
    ).toBeVisible();
    await waitFor(() => expect(listMarket).toHaveBeenCalledTimes(3));
    await user.click(screen.getByRole("button", { name: "新建采集记录" }));
    expect(onCreateRecord).toHaveBeenCalledWith("CORN");
    await user.click(screen.getByRole("button", { name: "查看记录" }));
    expect(onEditRecord).toHaveBeenCalledWith("CORN", "MKT-DB-001");
    expect(
      screen.queryByRole("button", { name: "查看照片" }),
    ).not.toBeInTheDocument();
    expect(onEditRecord).toHaveBeenCalledTimes(1);
  });

  it("shows an actionable business reason when market XLSX import is rejected", async () => {
    const user = userEvent.setup();
    const repository = {
      listMarket: vi.fn().mockResolvedValue({
        items: [],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 0,
        totalPages: 0,
      }),
      loadMasterData,
      loadMarketDefinition: vi.fn().mockResolvedValue({
        productCode: "CORN",
        objectTypeCode: "TRADER",
        coreFields: [],
        groups: [],
      }),
      importMarketWorkbook: vi.fn().mockRejectedValue(
        new RealtimeApiError({
          code: "INVALID_IMPORT_FORMAT",
          message: "包装形态只能选择“包粮”或“散粮”，请修正后重新导入。",
          status: 400,
        }),
      ),
    } as unknown as RealtimeBusinessRepository;

    render(
      <ProductMarketCollectionWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={repository}
        scope={scope}
        section="corn-collection"
      />,
    );

    await screen.findByLabelText("批量导入市场采集记录");
    const file = new File(["market"], "market.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    await user.upload(screen.getByLabelText("批量导入市场采集记录"), file);

    expect(
      await screen.findByText(
        "包装形态只能选择“包粮”或“散粮”，请修正后重新导入。",
      ),
    ).toHaveAttribute("role", "alert");
  });

  it("keeps ordinary creation while removing returned-record correction controls", async () => {
    const listMarket = vi.fn().mockResolvedValue({
      items: [],
      pageNumber: 0,
      pageSize: 20,
      totalElements: 0,
      totalPages: 0,
    });
    const importMarketWorkbook = vi.fn();
    const importMarketReturnedCorrectionWorkbook = vi.fn().mockResolvedValue({
      id: "correction-1",
      domainCode: "MARKET",
      statusCode: "COMPLETED_WITH_ERRORS",
      importedRows: 2,
      failedRows: 1,
    });
    const downloadMarketReturnedCorrectionErrors = vi
      .fn()
      .mockResolvedValue(new Blob(["errors"]));
    const repository = {
      listMarket,
      loadMasterData,
      loadMarketDefinition: vi.fn().mockResolvedValue({
        productCode: "CORN",
        objectTypeCode: "TRADER",
        coreFields: [],
        groups: [],
      }),
      importMarketWorkbook,
      downloadMarketXlsxTemplate: vi.fn().mockResolvedValue(new Blob(["new"])),
      downloadMarketReturnedCorrectionWorkbook: vi
        .fn()
        .mockResolvedValue(new Blob(["correction"])),
      importMarketReturnedCorrectionWorkbook,
      getMarketReturnedCorrectionJob: vi.fn(),
      downloadMarketReturnedCorrectionErrors,
    } as unknown as RealtimeBusinessRepository;

    render(
      <ProductMarketCollectionWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={repository}
        scope={scope}
        section="corn-collection"
      />,
    );

    expect(
      await screen.findByRole("button", { name: "下载 XLSX 模板" }),
    ).toBeEnabled();
    expect(screen.getByLabelText("批量导入市场采集记录")).toHaveAttribute(
      "accept",
      ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(
      screen.queryByRole("button", { name: "下载退回记录修正表" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("批量导入修正结果")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("批量导入市场退回修正结果"),
    ).not.toBeInTheDocument();
    expect(importMarketReturnedCorrectionWorkbook).not.toHaveBeenCalled();
    expect(importMarketWorkbook).not.toHaveBeenCalled();
    expect(downloadMarketReturnedCorrectionErrors).not.toHaveBeenCalled();
    await waitFor(() => expect(listMarket).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/草稿/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/新建导入/u)).not.toBeInTheDocument();
  });

  it("keeps durable market import history out of the collection ledger", async () => {
    const listMarket = vi.fn().mockResolvedValue({
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
      listMarket,
      listImportJobs,
      loadMasterData,
      loadMarketDefinition: vi.fn().mockResolvedValue({
        productCode: "CORN",
        objectTypeCode: "TRADER",
        coreFields: [],
        groups: [],
      }),
    } as unknown as RealtimeBusinessRepository;

    render(
      <ProductMarketCollectionWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={repository}
        scope={realtimeScope}
        section="corn-collection"
      />,
    );

    await waitFor(() => expect(listMarket).toHaveBeenCalled());
    expect(listImportJobs).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("region", { name: "导入任务记录" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["corn-collection", "CORN", "玉米市场退回记录修正表.xlsx"],
    ["soybean-collection", "SOYBEAN", "大豆市场退回记录修正表.xlsx"],
    ["paddy-collection", "RICE", "稻谷市场退回记录修正表.xlsx"],
  ] as const)(
    "removes %s correction downloads for %s",
    async (section, productCode, filename) => {
      const downloaded: string[] = [];
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
        function captureDownload(this: HTMLAnchorElement) {
          downloaded.push(this.download);
        },
      );
      const downloadMarketReturnedCorrectionWorkbook = vi
        .fn()
        .mockResolvedValue(new Blob([productCode]));
      const repository = {
        listMarket: vi.fn().mockResolvedValue({
          items: [],
          pageNumber: 0,
          pageSize: 20,
          totalElements: 0,
          totalPages: 0,
        }),
        loadMasterData,
        loadMarketDefinition: vi.fn().mockResolvedValue({
          productCode,
          objectTypeCode: "TRADER",
          coreFields: [],
          groups: [],
        }),
        downloadMarketReturnedCorrectionWorkbook,
      } as unknown as RealtimeBusinessRepository;

      render(
        <ProductMarketCollectionWorkspace
          onScopeChange={vi.fn()}
          onSelectionChange={vi.fn()}
          queryAllowed
          realtimeRepository={repository}
          scope={scope}
          section={section}
        />,
      );

      await screen.findByRole("heading", { name: /市场采集表$/u });
      expect(
        screen.queryByRole("button", { name: "下载退回记录修正表" }),
      ).not.toBeInTheDocument();
      expect(downloadMarketReturnedCorrectionWorkbook).not.toHaveBeenCalled();
      expect(downloaded).not.toContain(filename);
    },
  );

  it("never opens the fixture draft workbench in the formal realtime path", async () => {
    const listMarket = vi.fn().mockResolvedValue({
      items: [],
      pageNumber: 0,
      pageSize: 20,
      totalElements: 0,
      totalPages: 0,
    });
    const repository = {
      listMarket,
      loadMasterData,
      loadMarketDefinition: vi.fn().mockResolvedValue({
        productCode: "CORN",
        objectTypeCode: "TRADER",
        coreFields: [],
        groups: [],
      }),
    } as unknown as RealtimeBusinessRepository;

    render(
      <ProductMarketCollectionWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={repository}
        scope={scope}
        section="corn-collection"
        selection={{ type: "work-item", id: "WORK-MARKET-FILL-W31" }}
      />,
    );

    await waitFor(() => expect(listMarket).toHaveBeenCalled());
    expect(
      screen.queryByRole("region", { name: /单据工作台$/u }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("保存草稿")).not.toBeInTheDocument();
  });
});
