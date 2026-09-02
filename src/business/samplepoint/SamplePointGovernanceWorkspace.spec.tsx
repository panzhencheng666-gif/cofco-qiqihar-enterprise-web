import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  BusinessNotificationRow,
  CurrentSession,
  DesignSamplePointMutation,
  DesignSamplePointRow,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import type {
  DesignSampleContext,
  DesignSampleFieldContract,
  DesignSampleFieldDefinition,
} from "@/platform/api/designSampleFieldContract";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";
import { SamplePointGovernanceWorkspace } from "./SamplePointGovernanceWorkspace";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const session: CurrentSession = {
  subjectId: "governance-user",
  displayName: "治理专员",
  workUnitCode: "QIQIHAR_BUSINESS",
  workUnitName: "齐齐哈尔经营部",
  accountStatus: "ACTIVE",
  employmentStatus: "ACTIVE",
  roleCodes: ["BUSINESS_OPERATOR"],
  positions: [],
  permissions: ["BUSINESS_READ", "BUSINESS_IMPORT", "BUSINESS_APPROVE"],
  regionCodes: ["230200"],
};

function repository(): RealtimeBusinessRepository {
  return {
    loadMasterData: vi.fn().mockResolvedValue({
      products: [],
      periods: [],
      regions: [],
    }),
    listDesignSamplePoints: vi.fn().mockResolvedValue({
      items: [designPoint()],
      pageNumber: 0,
      pageSize: 20,
      totalElements: 1,
      totalPages: 1,
    }),
    getSampleNetwork: vi.fn().mockResolvedValue({
      networkYear: 2026,
      statusCode: "PUBLISHED",
      carriedFromYear: null,
      version: 3,
      createdBy: "operator",
      createdAt: "2026-08-20T00:00:00Z",
      submittedBy: "operator",
      submittedAt: "2026-08-20T01:00:00Z",
      reviewedBy: "reviewer",
      reviewedAt: "2026-08-20T02:00:00Z",
      reviewReason: "通过",
      memberships: [],
    }),
    getSampleNetworkComparison: vi.fn().mockResolvedValue({
      networkYear: 2026,
      networkStatus: "PUBLISHED",
      designPointCount: 1,
      designCoordinateCount: 0,
      activeSamplePointCount: 0,
      approvedSubmissionSamplePointCount: 0,
      pendingVerificationDesignPointCount: 1,
      multipleActualPerDesignPointCount: 0,
      anomalyCount: 0,
      exactCoveredDesignPointCount: 0,
      representedDesignPointCount: 0,
      regionalAssociationDesignPointCount: 0,
      unrelatedDesignPointCount: 1,
      actualLevelCounts: { prefecture: 0, county: 0, township: 0, village: 0 },
      designPoints: [
        {
          villageRegionCode: "230231100201",
          villageName: "众兴村",
          townshipRegionCode: "230231100",
          townshipName: "兴农镇",
          countyRegionCode: "230231",
          countyName: "拜泉县",
          designLongitude: 126.1,
          designLatitude: 47.62,
        },
      ],
      actualPoints: [],
      relations: [],
    }),
  } as unknown as RealtimeBusinessRepository;
}

function designPoint(
  overrides: Partial<DesignSamplePointRow> = {},
): DesignSamplePointRow {
  return {
    id: "point-1",
    contractVersion: "design-sample-fields-v1",
    contractDigest: `sha256:${"a".repeat(64)}`,
    context: {
      domainCode: "PRODUCTION",
      productCode: "CORN",
      objectTypeCode: "FARMER",
    },
    values: {
      DSP_NAME: "众兴村",
      DSP_REGION_CODE: "230231100201",
      DSP_LONGITUDE: "126.1",
      DSP_LATITUDE: "47.62",
      OBSERVED_ON: "2026-08-31",
      PROD_AREA_MU: "100",
    },
    name: "众兴村",
    regionCode: "230231100201",
    regionPath: "齐齐哈尔市 / 拜泉县 / 兴农镇 / 众兴村",
    longitude: 126.1,
    latitude: 47.62,
    version: 2,
    updatedAt: "2026-08-31T08:00:00Z",
    ...overrides,
  };
}

function contractField(
  code: string,
  label: string,
  valueType: "STRING" | "DATE" | "DECIMAL" | "ENUM",
  required: boolean,
  sortOrder: number,
  overrides: Record<string, unknown> = {},
): DesignSampleFieldDefinition {
  const sectionCode = sortOrder < 200 ? "IDENTITY" : "OBSERVATION";
  return {
    code,
    sectionCode,
    label,
    description: label,
    valueType,
    precision: valueType === "DECIMAL" ? 18 : null,
    scale: valueType === "DECIMAL" ? 4 : null,
    maxLength: valueType === "STRING" ? 200 : null,
    unit: null,
    enumOptions: [],
    required,
    nullable: !required,
    defaultValue: null,
    editable: true,
    minimumValue: null,
    maximumValue: null,
    groupCode: sectionCode,
    sortOrder,
    analysisRole: "NONE",
    ...overrides,
  };
}

function designFieldContract(): DesignSampleFieldContract {
  return {
    contractVersion: "design-sample-fields-v1",
    contractDigest: `sha256:${"a".repeat(64)}`,
    context: {
      domainCode: "PRODUCTION",
      productCode: "CORN",
      objectTypeCode: "FARMER",
    },
    domains: [
      {
        code: "PRODUCTION",
        label: "产情",
        description: "产情",
        aliases: [],
        sortOrder: 10,
      },
      {
        code: "MARKET",
        label: "市场",
        description: "市场",
        aliases: [],
        sortOrder: 20,
      },
    ],
    products: [
      { code: "CORN", label: "玉米", aliases: [], sortOrder: 10 },
      { code: "SOYBEAN", label: "大豆", aliases: [], sortOrder: 20 },
      { code: "RICE", label: "水稻", aliases: [], sortOrder: 30 },
    ],
    objectTypes: [
      {
        domainCode: "PRODUCTION",
        code: "FARMER",
        label: "农户",
        aliases: [],
        sortOrder: 10,
      },
      ...Array.from({ length: 10 }, (_, index) => ({
        domainCode: "MARKET",
        code: `MARKET_OBJECT_${index}`,
        label: `市场对象${index + 1}`,
        aliases: [],
        sortOrder: 20 + index,
      })),
    ],
    supportedContexts: Array.from({ length: 27 }, (_, index) => ({
      domainCode: index === 0 ? "PRODUCTION" : "MARKET",
      productCode: index === 0 ? "CORN" : "SOYBEAN",
      objectTypeCode: index === 0 ? "FARMER" : `MARKET_OBJECT_${index % 10}`,
      sortOrder: index + 1,
    })),
    identityFields: [
      contractField("DSP_NAME", "点位名称", "STRING", true, 50),
      contractField("DSP_REGION_CODE", "行政区代码", "STRING", true, 60),
      contractField("DSP_LONGITUDE", "经度", "DECIMAL", true, 70),
      contractField("DSP_LATITUDE", "纬度", "DECIMAL", true, 80),
    ],
    observationFields: [
      contractField("OBSERVED_ON", "观测日期", "DATE", true, 200),
      contractField("PROD_AREA_MU", "播种面积", "DECIMAL", false, 310, {
        unit: "亩",
      }),
    ],
  };
}

function marketFieldContract(
  objectTypeCode: string,
  objectTypeLabel: string,
  observationFields: DesignSampleFieldContract["observationFields"],
): DesignSampleFieldContract {
  const base = designFieldContract();
  const context = {
    domainCode: "MARKET",
    productCode: "CORN",
    objectTypeCode,
  };
  return {
    ...base,
    context,
    objectTypes: base.objectTypes.map((option, index) =>
      index === 1
        ? {
            domainCode: "MARKET",
            code: objectTypeCode,
            label: objectTypeLabel,
            aliases: [],
            sortOrder: 110,
          }
        : option,
    ),
    supportedContexts: base.supportedContexts.map((candidate, index) =>
      index === 1 ? { ...context, sortOrder: 20 } : candidate,
    ),
    observationFields: [
      contractField("OBSERVED_ON", "观测日期", "DATE", true, 200),
      ...observationFields,
    ],
  };
}

function agriculturalInputContract() {
  return marketFieldContract("AGRICULTURAL_INPUT_STORE", "农资店", [
    contractField(
      "AGRI_INPUT_SEED_SALES_VOLUME",
      "种子销售量",
      "DECIMAL",
      false,
      310,
      { unit: "公斤", minimumValue: "0" },
    ),
    contractField(
      "AGRI_INPUT_SEED_RETAIL_PRICE",
      "种子零售价",
      "DECIMAL",
      false,
      320,
      { unit: "元/公斤", minimumValue: "0" },
    ),
    contractField("AGRI_INPUT_SUPPLY_STATUS", "供货状态", "ENUM", false, 330, {
      enumOptions: ["SUFFICIENT", "NORMAL", "TIGHT", "OUT_OF_STOCK"],
    }),
    contractField(
      "AGRI_INPUT_PLANTING_INTENTION_TREND",
      "种植意向趋势",
      "ENUM",
      false,
      340,
      { enumOptions: ["INCREASE", "STABLE", "DECREASE"] },
    ),
  ]);
}

function marketPurchaseContract(
  objectTypeCode: string,
  objectTypeLabel: string,
) {
  return marketFieldContract(objectTypeCode, objectTypeLabel, [
    contractField(
      "MKT_PURCHASE_BASE_PRICE",
      "收购基础价",
      "DECIMAL",
      false,
      310,
      { unit: "元/吨", minimumValue: "0" },
    ),
    ...(objectTypeCode === "TRADER"
      ? [
          contractField(
            "MKT_SALE_BASE_PRICE",
            "销售基础价",
            "DECIMAL",
            false,
            320,
            { unit: "元/吨", minimumValue: "0" },
          ),
        ]
      : []),
  ]);
}

describe("SamplePointGovernanceWorkspace", () => {
  it("uses the shared ledger filter alignment contract at desktop and narrow widths", () => {
    const css = readFileSync(
      "src/business/samplepoint/sample-point-governance-workspace.css",
      "utf8",
    );

    expect(css).toMatch(
      /grid-template-columns:\s*minmax\(220px, 1\.4fr\) repeat\(\s*4,\s*minmax\(140px, 1fr\)\s*\)\s*auto auto;/u,
    );
    expect(css).toContain("grid-template-rows: minmax(18px, auto) 40px;");
    expect(css).toContain("height: 40px;");
    expect(css).toMatch(
      /@media \(max-width: 760px\)[\s\S]*\.sample-point-governance-workspace__filters \{[\s\S]*grid-template-columns: minmax\(0, 1fr\);/u,
    );
  });

  it("shows only the design ledger without workflow modules in design mode", async () => {
    render(
      <SamplePointGovernanceWorkspace
        currentYear={2026}
        mode="design"
        repository={repository()}
        session={session}
      />,
    );

    expect(screen.getByRole("heading", { name: "设计样本点" })).toBeVisible();
    expect(
      screen.queryByRole("tablist", { name: "样本点治理模块" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("样本点名册")).not.toBeInTheDocument();
    expect(screen.queryByText("年度样本")).not.toBeInTheDocument();
    expect(screen.queryByText("变更与审核")).not.toBeInTheDocument();
    expect(
      await screen.findByRole("table", { name: "设计参考点清单" }),
    ).toBeVisible();
  });

  it("renders a routed design create page without nesting the ledger", async () => {
    const onSelectionChange = vi.fn();
    render(
      <SamplePointGovernanceWorkspace
        currentYear={2026}
        mode="design"
        repository={repository()}
        selection={{ type: "design-sample-create", id: "new" }}
        onSelectionChange={onSelectionChange}
        session={{
          ...session,
          permissions: [...session.permissions, "BUSINESS_UPDATE"],
        }}
      />,
    );

    expect(
      await screen.findByRole("form", { name: "新建设计参考点" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("table", { name: "设计参考点清单" }),
    ).not.toBeInTheDocument();
    expect(document.querySelector(".design-sample-point-editor")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(onSelectionChange).toHaveBeenCalledWith({
      type: "design-sample-list",
      id: "list",
    });
  });

  it("uses the authoritative V159 page for read-only listing and count", async () => {
    const listDesignSamplePoints = vi.fn().mockResolvedValue({
      items: [designPoint()],
      pageNumber: 0,
      pageSize: 20,
      totalElements: 1,
      totalPages: 1,
    });
    const data = { ...repository(), listDesignSamplePoints };
    render(
      <SamplePointGovernanceWorkspace
        currentYear={2026}
        repository={data}
        session={session}
      />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "设计参考点" }));
    expect(await screen.findByText("众兴村")).toBeVisible();
    expect(listDesignSamplePoints).toHaveBeenCalledWith({
      page: 0,
      pageSize: 20,
    });
    expect(screen.getByText("共 1 条 · 第 1 / 1 页")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "新建设计参考点" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("point-1")).not.toBeInTheDocument();
    expect(screen.queryByText("PRODUCTION")).not.toBeInTheDocument();
  });

  it("creates, edits and deletes with metadata fields, versions and authoritative requeries", async () => {
    const listDesignSamplePoints = vi.fn().mockResolvedValue({
      items: [designPoint()],
      pageNumber: 0,
      pageSize: 20,
      totalElements: 1,
      totalPages: 1,
    });
    const createDesignSamplePoint = vi
      .fn<
        (
          input: DesignSamplePointMutation,
          idempotencyKey: string,
        ) => Promise<DesignSamplePointRow>
      >()
      .mockRejectedValueOnce(
        new RealtimeApiError({
          code: "FIELD_VALUE_INVALID",
          message: "填写内容不符合要求",
          status: 400,
          details: {
            fieldErrors: { DSP_LONGITUDE: "请填写所选行政区内的经度" },
          },
        }),
      )
      .mockResolvedValueOnce(designPoint());
    const updateDesignSamplePoint = vi
      .fn<
        (
          id: string,
          input: DesignSamplePointMutation,
          expectedVersion: number,
        ) => Promise<DesignSamplePointRow>
      >()
      .mockResolvedValue(designPoint({ version: 3 }));
    const getDesignSamplePoint = vi
      .fn<(id: string) => Promise<DesignSamplePointRow>>()
      .mockResolvedValueOnce(designPoint({ version: 3 }))
      .mockResolvedValueOnce(
        designPoint({
          version: 5,
          values: {
            ...designPoint().values,
            DSP_NAME: "权威重查点",
          },
        }),
      )
      .mockResolvedValueOnce(designPoint({ version: 6 }));
    const deleteDesignSamplePoint = vi
      .fn<(id: string, expectedVersion: number) => Promise<void>>()
      .mockResolvedValue(undefined);
    const data = {
      ...repository(),
      listDesignSamplePoints,
      loadDesignSamplePointFields: vi
        .fn()
        .mockResolvedValue(designFieldContract()),
      loadMasterData: vi.fn().mockResolvedValue({
        products: [],
        periods: [],
        regions: [
          {
            code: "230231100201",
            name: "众兴村",
            parentCode: "230231100",
            level: "VILLAGE",
          },
        ],
      }),
      createDesignSamplePoint,
      getDesignSamplePoint,
      updateDesignSamplePoint,
      deleteDesignSamplePoint,
    } as RealtimeBusinessRepository;
    const writableSession = {
      ...session,
      permissions: [...session.permissions, "BUSINESS_UPDATE"],
    };
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <SamplePointGovernanceWorkspace
        currentYear={2026}
        repository={data}
        session={writableSession}
      />,
    );
    await userEvent.click(screen.getByRole("tab", { name: "设计参考点" }));
    await within(
      await screen.findByRole("table", { name: "设计参考点清单" }),
    ).findByText("众兴村");

    await userEvent.click(
      screen.getByRole("button", { name: "新建设计参考点" }),
    );
    const createForm = await screen.findByRole("form", {
      name: "新建设计参考点",
    });
    await userEvent.type(
      within(createForm).getByRole("textbox", { name: "点位名称" }),
      "新建示范点",
    );
    await userEvent.selectOptions(
      within(createForm).getByRole("combobox", { name: "行政区" }),
      "众兴村",
    );
    await userEvent.type(
      within(createForm).getByRole("spinbutton", { name: "经度" }),
      "126.2",
    );
    await userEvent.type(
      within(createForm).getByRole("spinbutton", { name: "纬度" }),
      "47.7",
    );
    fireEvent.change(within(createForm).getByLabelText("观测日期"), {
      target: { value: "2026-08-31" },
    });
    await userEvent.type(
      within(createForm).getByRole("spinbutton", { name: "播种面积（亩）" }),
      "100",
    );
    await userEvent.click(
      within(createForm).getByRole("button", { name: "保存" }),
    );
    expect(await within(createForm).findByRole("alert")).toHaveTextContent(
      "经度：请填写所选行政区内的经度",
    );
    expect(screen.queryByText("DSP_LONGITUDE")).not.toBeInTheDocument();
    await userEvent.click(
      within(createForm).getByRole("button", { name: "保存" }),
    );
    await vi.waitFor(() => expect(createDesignSamplePoint).toHaveBeenCalled());
    expect(createDesignSamplePoint.mock.calls[1]?.[1]).toEqual(
      expect.any(String),
    );
    expect(getDesignSamplePoint).toHaveBeenNthCalledWith(1, "point-1");
    expect(listDesignSamplePoints).toHaveBeenCalledTimes(2);

    await userEvent.click(screen.getByRole("button", { name: "编辑众兴村" }));
    const editForm = await screen.findByRole("form", {
      name: "编辑设计参考点",
    });
    expect(getDesignSamplePoint).toHaveBeenNthCalledWith(2, "point-1");
    expect(
      within(editForm).getByRole("textbox", { name: "点位名称" }),
    ).toHaveValue("权威重查点");
    await userEvent.clear(
      within(editForm).getByRole("textbox", { name: "点位名称" }),
    );
    await userEvent.type(
      within(editForm).getByRole("textbox", { name: "点位名称" }),
      "众兴村更新点",
    );
    await userEvent.click(
      within(editForm).getByRole("button", { name: "保存" }),
    );
    await vi.waitFor(() => expect(updateDesignSamplePoint).toHaveBeenCalled());
    const updateCall = updateDesignSamplePoint.mock.calls[0];
    expect(updateCall?.[0]).toBe("point-1");
    expect(updateCall?.[1].values).toMatchObject({
      DSP_NAME: "众兴村更新点",
    });
    expect(updateCall?.[2]).toBe(5);
    expect(getDesignSamplePoint).toHaveBeenNthCalledWith(3, "point-1");
    expect(listDesignSamplePoints).toHaveBeenCalledTimes(3);

    await userEvent.click(screen.getByRole("button", { name: "删除众兴村" }));
    await vi.waitFor(() =>
      expect(deleteDesignSamplePoint).toHaveBeenCalledWith("point-1", 2),
    );
    expect(confirm).toHaveBeenCalledWith("确认删除“众兴村”？");
    expect(listDesignSamplePoints).toHaveBeenCalledTimes(4);
    confirm.mockRestore();
  });

  it("does not invite a second write when the post-save authoritative requery fails", async () => {
    const listDesignSamplePoints = vi.fn().mockResolvedValue({
      items: [designPoint()],
      pageNumber: 0,
      pageSize: 20,
      totalElements: 1,
      totalPages: 1,
    });
    const createDesignSamplePoint = vi.fn().mockResolvedValue(designPoint());
    const data = {
      ...repository(),
      listDesignSamplePoints,
      loadDesignSamplePointFields: vi
        .fn()
        .mockResolvedValue(designFieldContract()),
      loadMasterData: vi.fn().mockResolvedValue({
        products: [],
        periods: [],
        regions: [
          {
            code: "230231100201",
            name: "众兴村",
            parentCode: "230231100",
            level: "VILLAGE",
          },
        ],
      }),
      createDesignSamplePoint,
      getDesignSamplePoint: vi.fn().mockRejectedValue(
        new RealtimeApiError({
          code: "SERVICE_UNAVAILABLE",
          message: "读取最新点位失败",
          status: 503,
        }),
      ),
    } as RealtimeBusinessRepository;
    const writableSession = {
      ...session,
      permissions: [...session.permissions, "BUSINESS_UPDATE"],
    };

    render(
      <SamplePointGovernanceWorkspace
        currentYear={2026}
        repository={data}
        session={writableSession}
      />,
    );
    await userEvent.click(screen.getByRole("tab", { name: "设计参考点" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "新建设计参考点" }),
    );
    const form = await screen.findByRole("form", { name: "新建设计参考点" });
    await userEvent.type(
      within(form).getByRole("textbox", { name: "点位名称" }),
      "新建示范点",
    );
    await userEvent.selectOptions(
      within(form).getByRole("combobox", { name: "行政区" }),
      "众兴村",
    );
    await userEvent.type(
      within(form).getByRole("spinbutton", { name: "经度" }),
      "126.2",
    );
    await userEvent.type(
      within(form).getByRole("spinbutton", { name: "纬度" }),
      "47.7",
    );
    fireEvent.change(within(form).getByLabelText("观测日期"), {
      target: { value: "2026-09-01" },
    });
    await userEvent.click(within(form).getByRole("button", { name: "保存" }));

    await vi.waitFor(() =>
      expect(screen.queryByRole("form", { name: "新建设计参考点" })).toBeNull(),
    );
    expect(createDesignSamplePoint).toHaveBeenCalledTimes(1);
    expect(listDesignSamplePoints).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "保存已完成，但最新点位信息读取失败，请刷新清单确认。",
    );
  });

  it("renders the four agricultural-input fields from V157 metadata without workflow or internal-code copy", async () => {
    const point = designPoint({
      name: "龙沙农资店",
      context: {
        domainCode: "MARKET",
        productCode: "CORN",
        objectTypeCode: "AGRICULTURAL_INPUT_STORE",
      },
      values: {
        ...designPoint().values,
        DSP_NAME: "龙沙农资店",
        AGRI_INPUT_SEED_SALES_VOLUME: "25",
        AGRI_INPUT_SEED_RETAIL_PRICE: "6.5",
        AGRI_INPUT_SUPPLY_STATUS: "SUFFICIENT",
        AGRI_INPUT_PLANTING_INTENTION_TREND: "STABLE",
      },
    });
    const contract = agriculturalInputContract();
    const data = {
      ...repository(),
      listDesignSamplePoints: vi.fn().mockResolvedValue({
        items: [point],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 1,
        totalPages: 1,
      }),
      getDesignSamplePoint: vi.fn().mockResolvedValue(point),
      loadDesignSamplePointFields: vi.fn((context: DesignSampleContext) =>
        Promise.resolve(
          context.objectTypeCode === "AGRICULTURAL_INPUT_STORE"
            ? contract
            : designFieldContract(),
        ),
      ),
    } as RealtimeBusinessRepository;
    const writableSession = {
      ...session,
      permissions: [...session.permissions, "BUSINESS_UPDATE"],
    };

    render(
      <SamplePointGovernanceWorkspace
        currentYear={2026}
        repository={data}
        session={writableSession}
      />,
    );
    await userEvent.click(screen.getByRole("tab", { name: "设计参考点" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "编辑龙沙农资店" }),
    );
    const form = await screen.findByRole("form", { name: "编辑设计参考点" });

    expect(
      within(form).getByRole("spinbutton", { name: "种子销售量（公斤）" }),
    ).toHaveAttribute("step", "0.0001");
    expect(
      within(form).getByRole("spinbutton", { name: "种子销售量（公斤）" }),
    ).toHaveAttribute("min", "0");
    expect(
      within(form).getByRole("spinbutton", { name: "种子零售价（元/公斤）" }),
    ).toHaveValue(6.5);
    expect(
      within(
        within(form).getByRole("combobox", { name: "供货状态" }),
      ).getByRole("option", { name: "充足" }),
    ).toBeVisible();
    expect(
      within(
        within(form).getByRole("combobox", { name: "种植意向趋势" }),
      ).getByRole("option", { name: "稳定" }),
    ).toBeVisible();
    expect(within(form).queryByText("收购基础价")).not.toBeInTheDocument();
    expect(within(form).queryByText("surveyYear")).not.toBeInTheDocument();
    expect(
      within(form).queryByText("AGRI_INPUT_SEED_SALES_VOLUME"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/DRAFT|PENDING|APPROVE|PUBLISH/u)).toBeNull();
  });

  it.each([
    ["TRADER", "贸易商", true],
    ["DEEP_PROCESSOR", "加工企业", false],
    ["BREEDING_FACTORY", "养殖场", false],
    ["FEED_MILL", "饲料厂", false],
  ])(
    "shows contract-applicable purchase fields for %s",
    async (objectTypeCode, objectTypeLabel, hasSalePrice) => {
      const contract = marketPurchaseContract(objectTypeCode, objectTypeLabel);
      const point = designPoint({
        name: `${objectTypeLabel}点位`,
        context: {
          domainCode: "MARKET",
          productCode: "CORN",
          objectTypeCode,
        },
        values: {
          ...designPoint().values,
          DSP_NAME: `${objectTypeLabel}点位`,
          MKT_PURCHASE_BASE_PRICE: "2200",
          ...(hasSalePrice ? { MKT_SALE_BASE_PRICE: "2300" } : {}),
        },
      });
      const data = {
        ...repository(),
        listDesignSamplePoints: vi.fn().mockResolvedValue({
          items: [point],
          pageNumber: 0,
          pageSize: 20,
          totalElements: 1,
          totalPages: 1,
        }),
        getDesignSamplePoint: vi.fn().mockResolvedValue(point),
        loadDesignSamplePointFields: vi.fn((context: DesignSampleContext) =>
          Promise.resolve(
            context.objectTypeCode === objectTypeCode
              ? contract
              : designFieldContract(),
          ),
        ),
      } as RealtimeBusinessRepository;
      const writableSession = {
        ...session,
        permissions: [...session.permissions, "BUSINESS_UPDATE"],
      };

      render(
        <SamplePointGovernanceWorkspace
          currentYear={2026}
          repository={data}
          session={writableSession}
        />,
      );
      await userEvent.click(screen.getByRole("tab", { name: "设计参考点" }));
      await userEvent.click(
        await screen.findByRole("button", {
          name: `编辑${objectTypeLabel}点位`,
        }),
      );
      const form = await screen.findByRole("form", {
        name: "编辑设计参考点",
      });

      expect(
        within(form).getByRole("spinbutton", { name: "收购基础价（元/吨）" }),
      ).toHaveValue(2200);
      if (hasSalePrice) {
        expect(
          within(form).getByRole("spinbutton", { name: "销售基础价（元/吨）" }),
        ).toHaveValue(2300);
      } else {
        expect(
          within(form).queryByRole("spinbutton", {
            name: "销售基础价（元/吨）",
          }),
        ).not.toBeInTheDocument();
      }
    },
  );

  it("uses one table-led module at a time instead of stacking governance cards", async () => {
    render(
      <SamplePointGovernanceWorkspace
        currentYear={2026}
        repository={repository()}
        session={session}
      />,
    );

    expect(screen.getByRole("heading", { name: "样本点管理" })).toBeVisible();
    expect(
      screen.getByRole("main", { name: "样本点管理工作台" }),
    ).toHaveAttribute("data-layout", "ledger-workbench");
    expect(
      screen.queryByRole("status", { name: "样本网络概况" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("tablist", { name: "样本点治理模块" }),
    ).toBeVisible();
    expect(screen.getByRole("tab", { name: "样本点名册" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "年度样本" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "变更与审核" })).toBeVisible();
    expect(
      await screen.findByRole("region", { name: "样本点身份治理" }),
    ).toBeVisible();
    expect(screen.queryByRole("region", { name: "样本点坐标治理" })).toBeNull();
    expect(
      screen.queryByRole("region", { name: "年度样本网络管理" }),
    ).toBeNull();

    await userEvent.click(screen.getByRole("tab", { name: "设计参考点" }));

    expect(
      await screen.findByRole("table", { name: "设计参考点清单" }),
    ).toBeVisible();
    expect(
      screen.getByRole("toolbar", { name: "设计参考点台账工具栏" }),
    ).toBeVisible();
    expect(
      screen.getByRole("region", { name: "设计参考点滚动清单" }),
    ).toHaveAttribute("tabindex", "0");
    expect(
      screen.getByRole("status", { name: "设计参考点概况" }),
    ).toBeVisible();
    expect(screen.getByText("众兴村")).toBeVisible();
    expect(
      screen.getByRole("main", { name: "样本点管理工作台" }),
    ).not.toHaveTextContent(/2[,]?332/u);
    expect(
      within(screen.getByRole("status", { name: "设计参考点概况" }))
        .getByText("设计参考点")
        .closest("div"),
    ).toHaveTextContent("1 个");
    expect(
      screen.queryByRole("columnheader", { name: "行政区代码" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("230231100201")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "年度样本网络管理" }),
    ).toBeNull();
  });

  it("keeps the selected module and reloads only for realtime changes to its year", async () => {
    const initialRepository = repository();
    const getComparison = vi.fn(
      (year: number, regionCode?: string, productCode?: string) =>
        initialRepository.getSampleNetworkComparison!(
          year,
          regionCode,
          productCode,
        ),
    );
    const data = {
      ...initialRepository,
      getSampleNetworkComparison: getComparison,
    } as RealtimeBusinessRepository;
    const { rerender } = render(
      <SamplePointGovernanceWorkspace
        currentYear={2026}
        refreshSequenceByYear={{}}
        repository={data}
        session={session}
      />,
    );

    await screen.findByRole("region", { name: "样本点身份治理" });
    await userEvent.click(screen.getByRole("tab", { name: "设计参考点" }));
    await screen.findByRole("table", { name: "设计参考点清单" });
    expect(getComparison).toHaveBeenCalledTimes(1);

    rerender(
      <SamplePointGovernanceWorkspace
        currentYear={2026}
        refreshSequenceByYear={{ 2025: 1 }}
        repository={data}
        session={session}
      />,
    );
    expect(screen.getByRole("tab", { name: "设计参考点" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(getComparison).toHaveBeenCalledTimes(1);

    rerender(
      <SamplePointGovernanceWorkspace
        currentYear={2026}
        refreshSequenceByYear={{ 2025: 1, 2026: 1 }}
        repository={data}
        session={session}
      />,
    );
    await vi.waitFor(() => expect(getComparison).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("tab", { name: "设计参考点" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("debounces the V158 design dataset event into authoritative list and comparison requeries", async () => {
    vi.useFakeTimers();
    const initialRepository = repository();
    const initialComparison =
      await initialRepository.getSampleNetworkComparison!(2026);
    const getSampleNetworkComparison = vi
      .fn()
      .mockResolvedValueOnce(initialComparison)
      .mockResolvedValueOnce({
        ...initialComparison,
        designPointCount: 0,
        pendingVerificationDesignPointCount: 0,
        unrelatedDesignPointCount: 0,
        designPoints: [],
      })
      .mockResolvedValue(initialComparison);
    let onChange: ((event: BusinessNotificationRow) => void) | undefined;
    const unsubscribe = vi.fn();
    const subscribeBusinessEvents = vi.fn(
      (
        _afterSequence: number,
        listener: (event: BusinessNotificationRow) => void,
      ) => {
        onChange = listener;
        return unsubscribe;
      },
    );
    const listDesignSamplePoints = vi
      .fn()
      .mockResolvedValueOnce({
        items: [designPoint()],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 1,
        totalPages: 1,
      })
      .mockResolvedValueOnce({
        items: [],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 0,
        totalPages: 0,
      })
      .mockResolvedValue({
        items: [designPoint(), designPoint({ id: "point-2", name: "新点" })],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 2,
        totalPages: 1,
      });
    const data = {
      ...initialRepository,
      getSampleNetworkComparison,
      listDesignSamplePoints,
      subscribeBusinessEvents,
    } as RealtimeBusinessRepository;
    const event: BusinessNotificationRow = {
      id: "event-v158",
      sequence: 42,
      aggregateType: "DESIGN_COORDINATE_DATASET",
      aggregateId: "legacy-village-design-coordinate-cleanup-v1",
      actionCode: "LEGACY_VILLAGE_DESIGN_COORDINATES_DELETED",
      productCode: null,
      surveyYear: null,
      regionCodes: ["230200"],
      occurredAt: "2026-08-31T04:00:00Z",
      read: false,
    };

    const view = render(
      <SamplePointGovernanceWorkspace
        currentYear={2026}
        repository={data}
        session={session}
      />,
    );
    await act(() => Promise.resolve());
    fireEvent.click(screen.getByRole("tab", { name: "设计参考点" }));
    await act(() => Promise.resolve());
    expect(getSampleNetworkComparison).toHaveBeenCalledTimes(1);
    expect(listDesignSamplePoints).toHaveBeenCalledTimes(1);
    expect(subscribeBusinessEvents).toHaveBeenCalledWith(
      0,
      expect.any(Function),
    );

    act(() => {
      onChange?.({
        ...event,
        id: "unrelated-event",
        aggregateType: "SAMPLE_NETWORK_YEAR",
        actionCode: "SAMPLE_NETWORK_PUBLISHED",
        surveyYear: 2026,
      });
      vi.advanceTimersByTime(500);
    });
    expect(getSampleNetworkComparison).toHaveBeenCalledTimes(1);
    expect(listDesignSamplePoints).toHaveBeenCalledTimes(1);

    act(() => {
      onChange?.(event);
      vi.advanceTimersByTime(250);
      onChange?.({ ...event, id: "event-v158-replayed", sequence: 43 });
      vi.advanceTimersByTime(499);
    });
    expect(getSampleNetworkComparison).toHaveBeenCalledTimes(1);
    expect(listDesignSamplePoints).toHaveBeenCalledTimes(1);

    await act(() => {
      vi.advanceTimersByTime(1);
      return Promise.resolve();
    });
    expect(getSampleNetworkComparison).toHaveBeenCalledTimes(2);
    expect(listDesignSamplePoints).toHaveBeenCalledTimes(2);
    expect(
      within(screen.getByRole("status", { name: "设计参考点概况" }))
        .getByText("设计参考点")
        .closest("div"),
    ).toHaveTextContent("0 个");

    act(() => {
      onChange?.({
        ...event,
        id: "event-v159-created",
        sequence: 44,
        aggregateType: "DESIGN_SAMPLE_POINT",
        aggregateId: "point-2",
        actionCode: "DESIGN_SAMPLE_POINT_CREATED",
      });
      vi.advanceTimersByTime(200);
      onChange?.({
        ...event,
        id: "event-v159-updated",
        sequence: 45,
        aggregateType: "DESIGN_SAMPLE_POINT",
        aggregateId: "point-2",
        actionCode: "DESIGN_SAMPLE_POINT_UPDATED",
      });
      vi.advanceTimersByTime(499);
    });
    expect(listDesignSamplePoints).toHaveBeenCalledTimes(2);
    await act(() => {
      vi.advanceTimersByTime(1);
      return Promise.resolve();
    });
    expect(getSampleNetworkComparison).toHaveBeenCalledTimes(3);
    expect(listDesignSamplePoints).toHaveBeenCalledTimes(3);
    expect(
      within(screen.getByRole("status", { name: "设计参考点概况" }))
        .getByText("设计参考点")
        .closest("div"),
    ).toHaveTextContent("2 个");

    view.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("sends design reference filters and pagination to the authoritative API", async () => {
    const listDesignSamplePoints = vi.fn(
      (input: { page: number; keyword?: string; regionCode?: string }) => {
        if (input.keyword) {
          return Promise.resolve({
            items: [designPoint({ name: "参考点55" })],
            pageNumber: 0,
            pageSize: 20,
            totalElements: 1,
            totalPages: 1,
          });
        }
        const first = input.page === 0 ? 1 : 21;
        return Promise.resolve({
          items: Array.from({ length: 20 }, (_, index) =>
            designPoint({
              id: `point-${first + index}`,
              name: `参考点${first + index}`,
            }),
          ),
          pageNumber: input.page,
          pageSize: 20,
          totalElements: 55,
          totalPages: 3,
        });
      },
    );
    const data = {
      ...repository(),
      listDesignSamplePoints,
      loadDesignSamplePointFields: vi
        .fn()
        .mockResolvedValue(designFieldContract()),
      loadMasterData: vi.fn().mockResolvedValue({
        products: [],
        periods: [],
        regions: [
          {
            code: "230232",
            name: "目标县",
            parentCode: "230200",
            level: "COUNTY",
          },
        ],
      }),
    } as RealtimeBusinessRepository;

    render(
      <SamplePointGovernanceWorkspace
        currentYear={2026}
        repository={data}
        session={session}
      />,
    );
    await userEvent.click(screen.getByRole("tab", { name: "设计参考点" }));

    const filters = await screen.findByRole("search", {
      name: "设计参考点筛选",
    });
    const table = await screen.findByRole("table", {
      name: "设计参考点清单",
    });
    expect(within(table).getAllByRole("row")).toHaveLength(21);
    expect(screen.getByText("共 55 条 · 第 1 / 3 页")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "下一页" }));
    await vi.waitFor(() =>
      expect(listDesignSamplePoints).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
      }),
    );
    expect(await screen.findByText("参考点21")).toBeVisible();

    await userEvent.selectOptions(
      within(filters).getByRole("combobox", { name: "筛选行政区" }),
      "目标县",
    );
    await userEvent.type(
      within(filters).getByRole("searchbox", {
        name: "搜索点位或行政区",
      }),
      "参考点55",
    );
    await userEvent.click(
      within(filters).getByRole("button", { name: "查询" }),
    );
    await vi.waitFor(() =>
      expect(listDesignSamplePoints).toHaveBeenLastCalledWith({
        keyword: "参考点55",
        regionCode: "230232",
        page: 0,
        pageSize: 20,
      }),
    );
    expect(await screen.findByText("共 1 条 · 第 1 / 1 页")).toBeVisible();
    expect(screen.getByText("参考点55")).toBeVisible();
  });
});
