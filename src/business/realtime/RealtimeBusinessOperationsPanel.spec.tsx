import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  CurrentSession,
  ProductionDraftPayload,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";
import { RealtimeBusinessOperationsPanel } from "./RealtimeBusinessOperationsPanel";

afterEach(cleanup);

function productionContractField(
  code: string,
  label: string,
  groupCode: string,
  groupLabel: string,
  groupOrder: number,
  sortOrder: number,
  overrides: Partial<{
    valueType: string;
    controlType: string;
    unit: string | null;
    required: boolean;
    readOnly: boolean;
    calculated: boolean;
    importable: boolean;
  }> = {},
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

function productionDefinition() {
  const dynamic = [
    productionContractField(
      "PROD_OPENING_INVENTORY",
      "期初库存",
      "DETAIL",
      "业务调查明细",
      40,
      10,
      {
        valueType: "DECIMAL",
        controlType: "DECIMAL",
        unit: "吨",
      },
    ),
    productionContractField(
      "PROD_SALES_VOLUME",
      "销售数量",
      "DETAIL",
      "业务调查明细",
      40,
      20,
      {
        valueType: "DECIMAL",
        controlType: "DECIMAL",
        unit: "吨",
      },
    ),
    productionContractField(
      "PROD_SELF_USE",
      "自用数量",
      "DETAIL",
      "业务调查明细",
      40,
      30,
      {
        valueType: "DECIMAL",
        controlType: "DECIMAL",
        unit: "吨",
      },
    ),
    productionContractField(
      "PROD_ENDING_INVENTORY",
      "期末余粮",
      "DETAIL",
      "业务调查明细",
      40,
      35,
      {
        valueType: "DECIMAL",
        controlType: "DECIMAL",
        unit: "吨",
      },
    ),
    productionContractField("PROTEIN", "蛋白", "QUALITY", "质量指标", 50, 10, {
      valueType: "DECIMAL",
      controlType: "DECIMAL",
      unit: "%",
    }),
    productionContractField(
      "OIL_YIELD",
      "出油率",
      "QUALITY",
      "质量指标",
      50,
      20,
      {
        valueType: "DECIMAL",
        controlType: "DECIMAL",
        unit: "%",
      },
    ),
  ];
  return {
    productCode: "CORN",
    objectTypeCode: "FARMER",
    contractVersion: "production-survey-fields-v1" as const,
    contractDigest:
      "sha256:44997993c550cd093d2012bb0eb0520b5f693da046cca2573d4fbe6b93f62e32" as const,
    fields: [
      productionContractField(
        "objectTypeCode",
        "样本点类型",
        "CONTEXT",
        "基础信息",
        10,
        10,
        {
          controlType: "SELECT",
          required: true,
          importable: false,
        },
      ),
      productionContractField(
        "regionCode",
        "所在地区",
        "CONTEXT",
        "基础信息",
        10,
        20,
        {
          controlType: "REGION",
          required: true,
        },
      ),
      productionContractField(
        "PROD_CULTIVAR_NAME",
        "具体品种",
        "CONTEXT",
        "基础信息",
        10,
        30,
      ),
      productionContractField(
        "surveyDate",
        "调查日期",
        "CONTEXT",
        "基础信息",
        10,
        40,
        {
          valueType: "DATE",
          controlType: "DATE",
          required: true,
        },
      ),
      productionContractField(
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
      productionContractField(
        "PROD_SAMPLE_NAME",
        "填报对象名称",
        "SUBJECT",
        "调查对象与联系",
        20,
        20,
      ),
      productionContractField(
        "PROD_REPORTER_NAME",
        "填报人",
        "SUBJECT",
        "调查对象与联系",
        20,
        30,
        {
          controlType: "READONLY_TEXT",
          required: true,
          readOnly: true,
          importable: false,
        },
      ),
      productionContractField(
        "PROD_REPORTER_PHONE",
        "填报人联系方式",
        "SUBJECT",
        "调查对象与联系",
        20,
        40,
        {
          required: true,
        },
      ),
      productionContractField(
        "PROD_SAMPLE_CONTACT",
        "填报对象联系方式",
        "SUBJECT",
        "调查对象与联系",
        20,
        50,
        {
          required: true,
        },
      ),
      productionContractField(
        "PROD_SAMPLE_LATITUDE",
        "填报对象纬度",
        "SUBJECT",
        "调查对象与联系",
        20,
        60,
        {
          valueType: "DECIMAL",
          controlType: "DECIMAL",
          required: true,
        },
      ),
      productionContractField(
        "PROD_SAMPLE_LONGITUDE",
        "填报对象经度",
        "SUBJECT",
        "调查对象与联系",
        20,
        70,
        {
          valueType: "DECIMAL",
          controlType: "DECIMAL",
          required: true,
        },
      ),
      productionContractField(
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
          required: true,
        },
      ),
      productionContractField(
        "yieldPerMuKilograms",
        "权威采用单产",
        "OUTPUT",
        "产量信息",
        30,
        20,
        {
          valueType: "DECIMAL",
          controlType: "DECIMAL",
          unit: "公斤/亩",
          required: true,
        },
      ),
      productionContractField(
        "estimatedOutputKilograms",
        "预计总产",
        "OUTPUT",
        "产量信息",
        30,
        30,
        {
          valueType: "DECIMAL",
          controlType: "READONLY_DECIMAL",
          unit: "公斤",
          readOnly: true,
          calculated: true,
          importable: false,
        },
      ),
      productionContractField(
        "yearOnYear",
        "与上年同比",
        "OUTPUT",
        "产量信息",
        30,
        40,
        {
          controlType: "READONLY_TEXT",
          readOnly: true,
          calculated: true,
          importable: false,
        },
      ),
      ...dynamic,
    ],
    groups: [
      {
        category: "DETAIL",
        label: "业务调查明细",
        sortOrder: 10,
        fields: dynamic
          .slice(0, 3)
          .map(
            ({
              code,
              label,
              valueType,
              unit,
              description,
              precision,
              scale,
              sortOrder,
            }) => ({
              code,
              label,
              valueType,
              unit,
              description,
              precision,
              scale,
              sortOrder,
            }),
          ),
      },
      {
        category: "QUALITY",
        label: "质量指标",
        sortOrder: 20,
        fields: dynamic
          .slice(3)
          .map(
            ({
              code,
              label,
              valueType,
              unit,
              description,
              precision,
              scale,
              sortOrder,
            }) => ({
              code,
              label,
              valueType,
              unit,
              description,
              precision,
              scale,
              sortOrder,
            }),
          ),
      },
    ],
  };
}

function repository() {
  const createProduction = vi.fn();
  const getProduction = vi.fn();
  const transitionProduction = vi.fn();
  const uploadEvidencePhoto = vi.fn(() =>
    Promise.resolve({
      id: "photo-1",
      originalFilename: "field.png",
      mediaType: "image/png",
      byteLength: 12,
      sha256: "a".repeat(64),
      capturedAt: "2026-08-08T10:00:00+08:00",
      latitude: "47.3543",
      longitude: "123.9182",
      watermarkText: "齐齐哈尔市 产情调查",
      state: "STAGED",
    }),
  );
  const api = {
    loadCurrentSession: vi.fn(() =>
      Promise.resolve({
        subjectId: "wang-yang",
        displayName: "王洋",
        workUnitCode: "QIQIHAR_BUSINESS",
        permissions: ["BUSINESS_CREATE"],
        regionCodes: ["230200"],
      }),
    ),
    loadMasterData: vi.fn(() =>
      Promise.resolve({
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
            code: "231100",
            name: "黑河市",
            parentCode: null,
            level: "PREFECTURE",
          },
          {
            code: "150700",
            name: "呼伦贝尔市",
            parentCode: null,
            level: "PREFECTURE",
          },
          {
            code: "230221",
            name: "龙江县",
            parentCode: "230200",
            level: "COUNTY",
          },
          {
            code: "230221101",
            name: "龙江镇",
            parentCode: "230221",
            level: "TOWNSHIP",
          },
          {
            code: "230221101001",
            name: "龙东村",
            parentCode: "230221101",
            level: "VILLAGE",
          },
        ],
      }),
    ),
    listCultivars: vi.fn(() => Promise.resolve([])),
    listObjectTypes: vi.fn(() =>
      Promise.resolve([{ code: "FARMER", name: "农户", domain: "PRODUCTION" }]),
    ),
    loadProductionDefinition: vi.fn(() =>
      Promise.resolve(productionDefinition()),
    ),
    loadMarketDefinition: vi.fn(),
    listWorkItems: vi.fn(),
    listProduction: vi.fn(() =>
      Promise.resolve({
        items: [],
        pageNumber: 0,
        pageSize: 100,
        totalElements: 0,
        totalPages: 0,
      }),
    ),
    getProduction,
    createProduction,
    updateProduction: vi.fn(),
    transitionProduction,
    listMarket: vi.fn(),
    getMarket: vi.fn(),
    createMarket: vi.fn(),
    updateMarket: vi.fn(),
    transitionMarket: vi.fn(),
    uploadEvidencePhoto,
  } as unknown as RealtimeBusinessRepository;
  return {
    api,
    createProduction,
    getProduction,
    transitionProduction,
    uploadEvidencePhoto,
  };
}

function fillRequiredProductionFields() {
  fireEvent.change(screen.getByRole("combobox", { name: "地级市" }), {
    target: { value: "230200" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "区县" }), {
    target: { value: "230221" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "乡镇" }), {
    target: { value: "230221101" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "行政村" }), {
    target: { value: "230221101001" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "具体品种" }), {
    target: { value: "龙单86" },
  });
  fireEvent.change(screen.getByLabelText("数据年份"), {
    target: { value: "2026" },
  });
  fireEvent.change(screen.getByLabelText("数据月份"), {
    target: { value: "8" },
  });
  fireEvent.change(screen.getByLabelText("播种面积"), {
    target: { value: "100" },
  });
  fireEvent.change(screen.getByLabelText("预计单产"), {
    target: { value: "650" },
  });
  fireEvent.change(screen.getByLabelText("填报人联系方式"), {
    target: { value: "13800000000" },
  });
  fireEvent.change(screen.getByLabelText("样本点联系方式"), {
    target: { value: "13900000000" },
  });
  fireEvent.change(screen.getByLabelText("纬度"), {
    target: { value: "47.3543" },
  });
  fireEvent.change(screen.getByLabelText("经度"), {
    target: { value: "123.9182" },
  });
}

describe("RealtimeBusinessOperationsPanel", () => {
  it("voids an editable production draft and leaves the terminal record read-only", async () => {
    const { api, getProduction, transitionProduction } = repository();
    const draft = {
      id: "production-void-1",
      productCode: "CORN",
      objectTypeCode: "FARMER",
      regionCode: "230221101001",
      cultivarCode: "龙单86",
      surveyDate: "2026-08-08",
      cultivatedAreaMu: "100",
      yieldPerMuKilograms: "650",
      quality: {},
      costs: {},
      insurance: {},
      subsidies: {},
      submissionMetadata: { PROD_SAMPLE_NAME: "3C-VOID-PRODUCTION" },
      reportedAt: "2026-08-08T10:00:00+08:00",
      estimatedOutputKilograms: "65000",
      status: "DRAFT",
      returnReason: null,
      allowedActions: ["SAVE", "SUBMIT", "VOID"],
      evidencePhotos: [],
      version: 0,
    } as const;
    getProduction.mockResolvedValue(draft);
    transitionProduction.mockResolvedValue({
      ...draft,
      status: "VOIDED",
      allowedActions: ["VIEW"],
      version: 1,
    });

    render(
      <RealtimeBusinessOperationsPanel
        actorName="产情填报员"
        domain="production"
        editorOnly
        initialRecordId={draft.id}
        lockedProductCode="CORN"
        mode="entry"
        repository={api}
      />,
    );

    await screen
      .findByRole("button", { name: "作废记录" })
      .then((button) => fireEvent.click(button));
    expect(transitionProduction).toHaveBeenCalledWith(
      draft.id,
      "void",
      0,
      undefined,
    );
    await screen.findByText(/作废成功/);
    expect(screen.getByText(/已作废/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "保存业务记录" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "提交审核" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "作废记录" }),
    ).not.toBeInTheDocument();
  });

  it("reviews the existing source record read-only and limits decisions to assigned permissions", async () => {
    const { api, createProduction, getProduction, transitionProduction } =
      repository();
    const pending = {
      id: "production-review-1",
      productCode: "CORN",
      objectTypeCode: "FARMER",
      regionCode: "230221101001",
      cultivarCode: null,
      surveyYear: "2026",
      surveyMonth: "8",
      surveyDate: "2026-08-08",
      fillingDate: "2026-08-09",
      cultivatedAreaMu: "100",
      yieldPerMuKilograms: "650",
      quality: {},
      costs: {},
      insurance: {},
      subsidies: {},
      submissionMetadata: {
        PROD_REPORTER_NAME: "原始填报员",
        PROD_SAMPLE_NAME: "龙东村样本户",
      },
      reportedAt: "2026-08-08T10:00:00+08:00",
      estimatedOutputKilograms: "65000",
      status: "PENDING_REVIEW",
      returnReason: null,
      allowedActions: ["APPROVE", "RETURN"],
      evidencePhotos: [
        {
          id: "photo-review-1",
          originalFilename: "field.png",
          mediaType: "image/png",
          byteLength: 12,
          sha256: "a".repeat(64),
          capturedAt: "2026-08-08T10:00:00+08:00",
          latitude: "47.3543",
          longitude: "123.9182",
          watermarkText: "龙东村 王洋",
          state: "ATTACHED",
        },
      ],
      version: 3,
    };
    let resolveSession!: (session: CurrentSession) => void;
    api.loadCurrentSession = vi.fn(
      () =>
        new Promise<CurrentSession>((resolve) => {
          resolveSession = resolve;
        }),
    );
    getProduction.mockResolvedValue(pending);
    transitionProduction.mockResolvedValue({
      ...pending,
      status: "APPROVED",
      allowedActions: [],
      version: 4,
    });
    const onSaved = vi.fn();

    render(
      <RealtimeBusinessOperationsPanel
        actorName="系统管理员"
        domain="production"
        editorOnly
        initialRecordId={pending.id}
        lockedProductCode="CORN"
        mode="review"
        onSaved={onSaved}
        permissions={["BUSINESS_APPROVE", "BUSINESS_RETURN"]}
        repository={api}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "产情单据审核" }),
    ).toBeVisible();
    expect(await screen.findByLabelText("填报人")).toHaveTextContent(
      "原始填报员",
    );
    await act(async () => {
      resolveSession({
        subjectId: "reviewer",
        displayName: "当前审核员",
        workUnitCode: "QIQIHAR_BUSINESS",
        workUnitName: "齐齐哈尔业务部",
        accountStatus: "ACTIVE",
        employmentStatus: "ACTIVE",
        roleCodes: ["BUSINESS_REVIEWER"],
        positions: [
          {
            code: "BUSINESS_REVIEWER",
            name: "业务审核员",
            primaryPosition: true,
          },
        ],
        permissions: ["BUSINESS_APPROVE"],
        regionCodes: ["230200"],
      });
      await Promise.resolve();
    });
    expect(screen.getByLabelText("填报人")).toHaveTextContent("原始填报员");
    expect(screen.getByLabelText("数据年份")).toBeDisabled();
    expect(screen.getByLabelText("数据月份")).toBeDisabled();
    expect(screen.getByLabelText("填报日期")).toHaveTextContent("2026-08-09");
    expect(
      screen.queryByRole("button", { name: "保存业务记录" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("新建填报")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "field.png" })).toHaveAttribute(
      "href",
      "/api/v1/evidence-photos/photo-review-1/content",
    );
    expect(screen.getByRole("button", { name: "审核通过" })).toBeVisible();
    expect(screen.getByRole("button", { name: "退回补充" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "审核通过" }));
    await waitFor(() =>
      expect(transitionProduction).toHaveBeenCalledWith(
        pending.id,
        "approve",
        3,
        undefined,
      ),
    );
    expect(createProduction).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("does not expose review decisions without assigned review permissions", async () => {
    const { api, getProduction } = repository();
    getProduction.mockResolvedValue({
      id: "production-review-2",
      productCode: "CORN",
      objectTypeCode: "FARMER",
      regionCode: "230221101001",
      cultivarCode: null,
      surveyDate: "2026-08-08",
      cultivatedAreaMu: "100",
      yieldPerMuKilograms: "650",
      quality: {},
      costs: {},
      insurance: {},
      subsidies: {},
      submissionMetadata: {},
      evidencePhotoIds: [],
      reportedAt: "2026-08-08T10:00:00+08:00",
      estimatedOutputKilograms: "65000",
      status: "PENDING_REVIEW",
      returnReason: null,
      allowedActions: ["APPROVE", "RETURN"],
      evidencePhotos: [],
      version: 1,
    });

    render(
      <RealtimeBusinessOperationsPanel
        actorName="未授权审核岗位员工"
        domain="production"
        editorOnly
        initialRecordId="production-review-2"
        lockedProductCode="CORN"
        mode="review"
        permissions={["BUSINESS_CREATE", "BUSINESS_UPDATE"]}
        repository={api}
      />,
    );

    await screen.findByRole("heading", { name: "产情单据审核" });
    expect(
      screen.queryByRole("button", { name: "审核通过" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "退回补充" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/当前账号无可执行的审核操作/)).toBeVisible();
  });

  it("does not expose editable actions after a record leaves an editable state", async () => {
    const { api, getProduction } = repository();
    getProduction.mockResolvedValue({
      id: "production-pending-locked-1",
      productCode: "CORN",
      objectTypeCode: "FARMER",
      regionCode: "230221101001",
      cultivarCode: null,
      surveyDate: "2026-08-08",
      cultivatedAreaMu: "100",
      yieldPerMuKilograms: "650",
      quality: {},
      costs: {},
      insurance: {},
      subsidies: {},
      submissionMetadata: {},
      reportedAt: "2026-08-08T10:00:00+08:00",
      estimatedOutputKilograms: "65000",
      status: "PENDING_REVIEW",
      returnReason: null,
      allowedActions: ["APPROVE", "RETURN"],
      evidencePhotos: [],
      version: 1,
    });

    render(
      <RealtimeBusinessOperationsPanel
        actorName="产情填报员"
        domain="production"
        editorOnly
        initialRecordId="production-pending-locked-1"
        lockedProductCode="CORN"
        mode="entry"
        repository={api}
      />,
    );

    expect(await screen.findByLabelText("数据年份")).toBeDisabled();
    expect(screen.getByLabelText("数据月份")).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "保存业务记录" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "提交审核" }),
    ).not.toBeInTheDocument();
  });

  it("fails closed when an existing source record cannot be loaded", async () => {
    const { api, createProduction, getProduction } = repository();
    getProduction.mockRejectedValue(new Error("record unavailable"));

    render(
      <RealtimeBusinessOperationsPanel
        actorName="张三"
        domain="production"
        editorOnly
        initialRecordId="production-source-missing"
        lockedProductCode="CORN"
        repository={api}
      />,
    );

    expect(
      screen.queryByText("新建填报", { selector: "strong" }),
    ).not.toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "业务记录读取失败",
    );
    expect(
      screen.getByText("原业务记录读取失败", { selector: "strong" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "保存业务记录" })).toBeDisabled();
    expect(screen.queryByLabelText("现场水印照片")).not.toBeInTheDocument();
    expect(createProduction).not.toHaveBeenCalled();
  });

  it("does not poll because durable business events own refresh timing", async () => {
    const interval = vi.spyOn(window, "setInterval");
    render(
      <RealtimeBusinessOperationsPanel
        actorName="张三"
        domain="production"
        lockedProductCode="CORN"
        repository={repository().api}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "产情填报" }),
    ).toBeVisible();
    expect(interval.mock.calls.some(([, delay]) => delay === 10_000)).toBe(
      false,
    );
    interval.mockRestore();
  });

  it("does not overwrite unsaved production edits when a business event arrives", async () => {
    const { api, getProduction } = repository();
    const listProduction = vi.spyOn(api, "listProduction");
    const record = {
      id: "production-live-dirty-1",
      productCode: "CORN",
      objectTypeCode: "FARMER",
      regionCode: "230221101001",
      cultivarCode: "龙单86",
      surveyDate: "2026-08-08",
      cultivatedAreaMu: "100",
      yieldPerMuKilograms: "650",
      quality: {},
      costs: {},
      insurance: {},
      subsidies: {},
      submissionMetadata: { PROD_SALES_VOLUME: "10" },
      reportedAt: "2026-08-08T10:00:00+08:00",
      estimatedOutputKilograms: "65000",
      status: "RETURNED",
      returnReason: "请补充库存",
      allowedActions: ["SAVE", "SUBMIT"],
      evidencePhotos: [],
      version: 2,
    } as const;
    getProduction.mockResolvedValue(record);

    const view = render(
      <RealtimeBusinessOperationsPanel
        actorName="产情填报员"
        domain="production"
        editorOnly
        initialRecordId={record.id}
        lockedProductCode="CORN"
        mode="entry"
        refreshToken={0}
        repository={api}
      />,
    );
    const sales = await screen.findByLabelText(/销售数量/);
    fireEvent.change(sales, { target: { value: "25" } });

    view.rerender(
      <RealtimeBusinessOperationsPanel
        actorName="产情填报员"
        domain="production"
        editorOnly
        initialRecordId={record.id}
        lockedProductCode="CORN"
        mode="entry"
        refreshToken={1}
        repository={api}
      />,
    );

    await waitFor(() => expect(listProduction).toHaveBeenCalledTimes(2));
    expect(getProduction).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/销售数量/)).toHaveValue("25");
  });

  it("saves a returned production record whose API survey period values are numeric", async () => {
    const { api, getProduction } = repository();
    const updateProduction = vi.spyOn(api, "updateProduction");
    const returnedRecord = {
      id: "production-returned-numeric-period-1",
      productCode: "CORN",
      objectTypeCode: "FARMER",
      regionCode: "230221101001",
      cultivarCode: null,
      surveyYear: 2026,
      surveyMonth: 8,
      surveyDate: "2026-08-01",
      fillingDate: "2026-08-14",
      cultivatedAreaMu: "100",
      yieldPerMuKilograms: "650",
      quality: {},
      costs: {},
      insurance: {},
      subsidies: {},
      submissionMetadata: {
        PROD_REPORTER_NAME: "产情填报员",
        PROD_REPORTER_PHONE: "13800000000",
        PROD_SAMPLE_CONTACT: "13900000000",
        PROD_SAMPLE_LATITUDE: "47.3543",
        PROD_SAMPLE_LONGITUDE: "123.9182",
      },
      reportedAt: "2026-08-14T10:00:00+08:00",
      estimatedOutputKilograms: "65000",
      status: "RETURNED",
      returnReason: "请修订预计单产",
      allowedActions: ["VIEW", "SAVE", "SUBMIT"],
      evidencePhotos: [
        {
          id: "photo-returned-1",
          state: "ATTACHED",
          originalFilename: "field.png",
          mediaType: "image/png",
          byteLength: 12,
          sha256: "a".repeat(64),
          capturedAt: "2026-08-14T09:00:00+08:00",
          latitude: "47.3543000",
          longitude: "123.9182000",
          watermarkText: "龙江县 产情调查",
        },
      ],
      version: 2,
    } as const;
    getProduction.mockResolvedValue(returnedRecord);
    updateProduction.mockResolvedValue({
      ...returnedRecord,
      surveyYear: 2026,
      surveyMonth: 8,
      yieldPerMuKilograms: "651",
      estimatedOutputKilograms: "65100",
      version: 3,
    } as never);

    render(
      <RealtimeBusinessOperationsPanel
        actorName="产情填报员"
        domain="production"
        editorOnly
        initialRecordId={returnedRecord.id}
        lockedProductCode="CORN"
        mode="entry"
        repository={api}
      />,
    );

    const yieldInput = await screen.findByLabelText("预计单产");
    await waitFor(() => expect(yieldInput).toHaveValue("650"));
    fireEvent.change(yieldInput, { target: { value: "651" } });
    fireEvent.submit(yieldInput.closest("form") as HTMLFormElement);

    await waitFor(() => expect(updateProduction).toHaveBeenCalledOnce());
    expect(updateProduction).toHaveBeenCalledWith(
      returnedRecord.id,
      expect.objectContaining({
        surveyYear: "2026",
        surveyMonth: "8",
        yieldPerMuKilograms: "651",
        evidencePhotoIds: [],
        version: 2,
      }),
    );
  });

  it("captures both surveyed-object prices without a direction selector", async () => {
    const { api } = repository();
    vi.spyOn(api, "listObjectTypes").mockResolvedValue([
      { code: "TRADER", name: "贸易商", domain: "MARKET" },
    ]);
    vi.spyOn(api, "loadMarketDefinition").mockResolvedValue({
      productCode: "CORN",
      objectTypeCode: "TRADER",
      coreFields: [
        {
          code: "MKT_OBJECT_TYPE",
          label: "对象类型",
          controlType: "SELECT",
          unit: null,
          description: null,
          capability: null,
          required: true,
          precision: null,
          scale: null,
          sortOrder: 10,
          options: [{ value: "TRADER", label: "贸易商", sortOrder: 10 }],
        },
        {
          code: "MKT_PURCHASE_BASE_PRICE",
          label: "对象采购价格",
          controlType: "DECIMAL",
          unit: "元/吨",
          description: "被调查对象当前对外采购报价",
          capability: null,
          required: true,
          precision: 18,
          scale: 4,
          sortOrder: 30,
          options: [],
        },
        {
          code: "MKT_SALE_BASE_PRICE",
          label: "对象销售价格",
          controlType: "DECIMAL",
          unit: "元/吨",
          description: "被调查对象当前对外销售报价",
          capability: null,
          required: true,
          precision: 18,
          scale: 4,
          sortOrder: 40,
          options: [],
        },
      ],
      groups: [],
    });
    vi.spyOn(api, "listMarket").mockResolvedValue({
      items: [],
      pageNumber: 0,
      pageSize: 100,
      totalElements: 0,
      totalPages: 0,
    });

    render(
      <RealtimeBusinessOperationsPanel
        actorName="张三"
        domain="market"
        lockedProductCode="CORN"
        repository={api}
      />,
    );

    expect(await screen.findByLabelText("采集对象收购价格")).toBeVisible();
    expect(screen.getByLabelText("采集对象销售价格")).toBeVisible();
    expect(screen.queryByLabelText("本次成交价格方向")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("实际成交价")).not.toBeInTheDocument();
  });

  it("shows only existing inventory while keeping governed storage fields internal", async () => {
    const { api } = repository();
    vi.spyOn(api, "listObjectTypes").mockResolvedValue([
      { code: "TRADER", name: "贸易商", domain: "MARKET" },
    ]);
    vi.spyOn(api, "loadMarketDefinition").mockResolvedValue({
      productCode: "CORN",
      objectTypeCode: "TRADER",
      coreFields: [
        {
          code: "MKT_STORAGE_REGION_CODE",
          label: "库存存放地区",
          controlType: "REGION_HIERARCHY",
          unit: null,
          description: "库存实物存放地行政区划代码",
          capability: null,
          required: false,
          precision: null,
          scale: null,
          sortOrder: 142,
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
          ],
        },
        {
          category: "PROCESSING",
          label: "加工生产",
          sortOrder: 2,
          fields: [
            {
              code: "PROCESSING_INPUT",
              label: "加工投入量",
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
          ],
        },
      ],
    });
    vi.spyOn(api, "listMarket").mockResolvedValue({
      items: [],
      pageNumber: 0,
      pageSize: 100,
      totalElements: 0,
      totalPages: 0,
    });

    render(
      <RealtimeBusinessOperationsPanel
        actorName="张三"
        domain="market"
        lockedProductCode="CORN"
        repository={api}
      />,
    );

    await screen.findByRole("heading", { name: "市场采集" });
    expect(await screen.findByLabelText("现有库存")).toBeVisible();
    expect(
      screen.queryByRole("group", { name: "库存存放地" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("期末库存")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("库存量")).not.toBeInTheDocument();
    expect(
      screen.queryByText("MKT_STORAGE_REGION_CODE"),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("加工投入量")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("出库量")).not.toBeInTheDocument();
  });

  it("renders the required production provenance fields without the removed duplicate inputs", async () => {
    render(
      <RealtimeBusinessOperationsPanel
        actorName="张三"
        domain="production"
        lockedProductCode="CORN"
        repository={repository().api}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "产情填报" }),
    ).toBeVisible();
    expect(await screen.findByLabelText("填报人")).toBeVisible();
    await waitFor(() =>
      expect(screen.getByLabelText("填报人")).toHaveTextContent("王洋"),
    );
    expect(screen.getByLabelText("样本点联系方式")).toBeVisible();
    expect(screen.getByLabelText("纬度")).toBeVisible();
    expect(screen.getByLabelText("经度")).toBeVisible();
    expect(screen.queryByLabelText("样本平均结果")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("区域加权估计")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("测产轮次")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("入库数量")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("损耗数量")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "具体品种" })).toBeVisible();
    expect(
      screen.queryByRole("combobox", { name: "品种" }),
    ).not.toBeInTheDocument();
    expect(await screen.findByLabelText("期初库存")).toBeVisible();
    expect(screen.getByLabelText("期末余粮")).toBeVisible();
    expect(screen.queryByLabelText("未销售余粮")).not.toBeInTheDocument();
    expect(screen.getByLabelText("销售数量")).toBeVisible();
    expect(screen.getByLabelText("自用数量")).toBeVisible();
    expect(screen.getByLabelText("蛋白")).toBeVisible();
    expect(screen.getByLabelText("出油率")).toBeVisible();
    expect(screen.getByLabelText("预计总产")).toBeInstanceOf(HTMLOutputElement);
    expect(screen.getByLabelText("与上年相比")).toBeInstanceOf(
      HTMLOutputElement,
    );
    expect(screen.queryByLabelText("稳定主体码")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "地区" })).toBeVisible();
    expect(screen.getByLabelText("数据年份")).toBeVisible();
    expect(screen.getByLabelText("数据月份")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "行政村" })).not.toBeRequired();
    expect(screen.getByRole("group", { name: "基础信息" })).toBeVisible();
    expect(screen.getByRole("group", { name: "填报与定位" })).toBeVisible();
  });

  it("blocks the whole production form when its contract is invalid instead of leaving a photo-only island", async () => {
    const { api, createProduction } = repository();
    vi.spyOn(api, "loadProductionDefinition").mockRejectedValue(
      new RealtimeApiError({
        code: "CONTRACT_MISMATCH",
        message: "产情字段契约与当前页面版本不一致，请刷新页面或联系管理员",
        status: 200,
        details: {
          reason: "INVALID_PRODUCTION_FIELD_BOUNDARY",
          missingRequiredCodes: ["PROD_REPORTER_PHONE"],
        },
      }),
    );

    render(
      <RealtimeBusinessOperationsPanel
        actorName="张三"
        domain="production"
        lockedProductCode="CORN"
        repository={api}
        editorOnly
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "产情字段契约与当前页面版本不一致",
    );
    expect(screen.queryByLabelText("现场水印照片")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "现场照片" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存业务记录" })).toBeDisabled();
    expect(createProduction).not.toHaveBeenCalled();
  });

  it("refuses to open a record that does not belong to the menu-locked product", async () => {
    const { api } = repository();
    vi.spyOn(api, "listProduction").mockResolvedValue({
      items: [
        {
          id: "production-soybean",
          values: {},
          allowedActions: [],
          version: 1,
        },
      ],
      pageNumber: 0,
      pageSize: 100,
      totalElements: 1,
      totalPages: 1,
    });
    vi.spyOn(api, "getProduction").mockResolvedValue({
      id: "production-soybean",
      productCode: "SOYBEAN",
      objectTypeCode: "FARMER",
      regionCode: "230221101001",
      cultivarCode: null,
      surveyYear: "2026",
      surveyMonth: "8",
      surveyDate: "2026-08-08",
      cultivatedAreaMu: "100",
      yieldPerMuKilograms: "650",
      quality: {},
      costs: {},
      insurance: {},
      subsidies: {},
      submissionMetadata: {},
      reportedAt: "2026-08-08T10:01:00+08:00",
      estimatedOutputKilograms: "65000",
      status: "DRAFT",
      returnReason: null,
      allowedActions: [],
      version: 1,
    });

    render(
      <RealtimeBusinessOperationsPanel
        actorName="张三"
        domain="production"
        lockedProductCode="CORN"
        repository={api}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: /production-soybean/ }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "该记录不属于当前菜单品种，无法打开",
    );
    expect(
      screen.getByText("原业务记录读取失败", { selector: "strong" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "保存业务记录" })).toBeDisabled();
  });

  it("searches the authorized region list before selecting a region", async () => {
    render(
      <RealtimeBusinessOperationsPanel
        actorName="张三"
        domain="production"
        lockedProductCode="CORN"
        repository={repository().api}
      />,
    );

    const search = await screen.findByRole("searchbox", {
      name: "搜索地级市",
    });
    fireEvent.change(search, { target: { value: "黑河" } });
    const select = screen.getByRole("combobox", { name: "地级市" });
    expect(select).toHaveTextContent("黑河市");
    expect(select).not.toHaveTextContent("齐齐哈尔市");
    expect(select).not.toHaveTextContent("呼伦贝尔市");
  });

  it("requires watermarked field photos and binds their ids to a new production record", async () => {
    const { api, createProduction, uploadEvidencePhoto } = repository();
    vi.mocked(createProduction).mockResolvedValue({
      id: "production-1",
      productCode: "CORN",
      objectTypeCode: "FARMER",
      regionCode: "230221101001",
      cultivarCode: null,
      surveyDate: "2026-08-08",
      cultivatedAreaMu: "100",
      yieldPerMuKilograms: "650",
      quality: {},
      costs: {},
      insurance: {},
      subsidies: {},
      submissionMetadata: {
        PROD_CULTIVAR_NAME: "龙单86",
        PROD_REPORTER_NAME: "张三",
        PROD_REPORTER_PHONE: "13800000000",
        PROD_SAMPLE_CONTACT: "13900000000",
        PROD_SAMPLE_LATITUDE: "47.3543",
        PROD_SAMPLE_LONGITUDE: "123.9182",
      },
      reportedAt: "2026-08-08T10:01:00+08:00",
      estimatedOutputKilograms: "65000",
      status: "DRAFT",
      returnReason: null,
      allowedActions: ["SUBMIT"],
      version: 1,
    });

    render(
      <RealtimeBusinessOperationsPanel
        actorName="张三"
        domain="production"
        lockedProductCode="CORN"
        repository={api}
        editorOnly
      />,
    );

    await screen.findByRole("group", { name: "地区" });
    fillRequiredProductionFields();

    const saveButton = screen.getByRole("button", {
      name: "保存业务记录",
    });
    await waitFor(() => expect(saveButton).not.toBeDisabled());
    fireEvent.submit(saveButton.closest("form") as HTMLFormElement);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "请上传 1–5 张现场水印照片",
    );
    expect(createProduction).not.toHaveBeenCalled();

    const photo = new File(["field-photo"], "field.png", {
      type: "image/png",
    });
    fireEvent.change(screen.getByLabelText("现场水印照片"), {
      target: { files: [photo] },
    });
    fireEvent.submit(saveButton.closest("form") as HTMLFormElement);

    await waitFor(() => expect(uploadEvidencePhoto).toHaveBeenCalled());
    expect(uploadEvidencePhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        file: photo,
        latitude: "47.3543",
        longitude: "123.9182",
      }),
    );
    expect(createProduction).toHaveBeenCalledOnce();
    const created = createProduction.mock.calls[0]?.[0] as unknown as
      ProductionDraftPayload | undefined;
    expect(created).toMatchObject({
      productCode: "CORN",
      cultivarCode: null,
      regionCode: "230221101001",
      evidencePhotoIds: ["photo-1"],
      submissionMetadata: {
        PROD_CULTIVAR_NAME: "龙单86",
      },
    });
  });
});
