import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  ProductionDraftPayload,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeBusinessOperationsPanel } from "./RealtimeBusinessOperationsPanel";

afterEach(cleanup);

function repository() {
  const createProduction = vi.fn();
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
      Promise.resolve({
        productCode: "CORN",
        objectTypeCode: "FARMER",
        groups: [
          {
            category: "DETAIL",
            label: "业务调查明细",
            sortOrder: 10,
            fields: [
              {
                code: "PROD_SAMPLE_NAME",
                label: "填报对象",
                valueType: "TEXT",
                unit: null,
                description: null,
                precision: 18,
                scale: 4,
                sortOrder: 10,
              },
              ...[
                ["PROD_OPENING_INVENTORY", "期初库存"],
                ["PROD_SALES_VOLUME", "销售数量"],
                ["PROD_SELF_USE", "自用数量"],
              ].map(([code, label], index) => ({
                code,
                label,
                valueType: "DECIMAL" as const,
                unit: "吨",
                description: null,
                precision: 18,
                scale: 4,
                sortOrder: 20 + index,
              })),
            ],
          },
          {
            category: "QUALITY",
            label: "质量指标",
            sortOrder: 20,
            fields: [
              ...[
                ["PROTEIN", "蛋白"],
                ["OIL_YIELD", "出油率"],
              ].map(([code, label], index) => ({
                code,
                label,
                valueType: "DECIMAL" as const,
                unit: "%",
                description: null,
                precision: 18,
                scale: 4,
                sortOrder: 10 + index,
              })),
            ],
          },
        ],
      }),
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
    getProduction: vi.fn(),
    createProduction,
    updateProduction: vi.fn(),
    transitionProduction: vi.fn(),
    listMarket: vi.fn(),
    getMarket: vi.fn(),
    createMarket: vi.fn(),
    updateMarket: vi.fn(),
    transitionMarket: vi.fn(),
    uploadEvidencePhoto,
  } as unknown as RealtimeBusinessRepository;
  return { api, createProduction, uploadEvidencePhoto };
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
  fireEvent.change(screen.getByLabelText("调查日期"), {
    target: { value: "2026-08-08" },
  });
  fireEvent.change(screen.getByLabelText("种植面积"), {
    target: { value: "100" },
  });
  fireEvent.change(screen.getByLabelText("权威采用单产"), {
    target: { value: "650" },
  });
  fireEvent.change(screen.getByLabelText("填报人联系方式"), {
    target: { value: "13800000000" },
  });
  fireEvent.change(screen.getByLabelText("填报对象联系方式"), {
    target: { value: "13900000000" },
  });
  fireEvent.change(screen.getByLabelText("填报对象纬度"), {
    target: { value: "47.3543" },
  });
  fireEvent.change(screen.getByLabelText("填报对象经度"), {
    target: { value: "123.9182" },
  });
}

describe("RealtimeBusinessOperationsPanel", () => {
  it("shows calculated market values as read-only business results", async () => {
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
          code: "MKT_ACTUAL_TRADE_PRICE",
          label: "实际成交价",
          controlType: "READONLY_DECIMAL",
          unit: "元/吨",
          description: null,
          capability: null,
          required: false,
          precision: 18,
          scale: 4,
          sortOrder: 20,
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
        repository={api}
      />,
    );

    expect(await screen.findByLabelText("实际成交价")).toBeInstanceOf(
      HTMLOutputElement,
    );
    expect(
      screen.queryByRole("textbox", { name: "实际成交价" }),
    ).not.toBeInTheDocument();
  });

  it("renders the required production provenance fields without the removed duplicate inputs", async () => {
    render(
      <RealtimeBusinessOperationsPanel
        actorName="张三"
        domain="production"
        repository={repository().api}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "产情填报" }),
    ).toBeVisible();
    expect(screen.getByLabelText("填报人")).toBeVisible();
    await waitFor(() =>
      expect(screen.getByLabelText("填报人")).toHaveTextContent("王洋"),
    );
    expect(screen.getByLabelText("填报对象联系方式")).toBeVisible();
    expect(screen.getByLabelText("填报对象纬度")).toBeVisible();
    expect(screen.getByLabelText("填报对象经度")).toBeVisible();
    expect(screen.queryByLabelText("样本平均结果")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("区域加权估计")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("测产轮次")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("入库数量")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("损耗数量")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "具体品种" })).toBeVisible();
    expect(await screen.findByLabelText("期初库存")).toBeVisible();
    expect(screen.getByLabelText("销售数量")).toBeVisible();
    expect(screen.getByLabelText("自用数量")).toBeVisible();
    expect(screen.getByLabelText("蛋白")).toBeVisible();
    expect(screen.getByLabelText("出油率")).toBeVisible();
    expect(screen.getByLabelText("预计总产")).toBeInstanceOf(HTMLOutputElement);
    expect(screen.getByLabelText("与上年同比")).toBeInstanceOf(
      HTMLOutputElement,
    );
    expect(screen.getByRole("group", { name: "基础信息" })).toBeVisible();
    expect(screen.getByRole("group", { name: "联系与位置" })).toBeVisible();
  });

  it("searches the authorized region list before selecting a region", async () => {
    render(
      <RealtimeBusinessOperationsPanel
        actorName="张三"
        domain="production"
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
        repository={api}
        editorOnly
      />,
    );

    await screen.findByLabelText("所在地区");
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
      cultivarCode: null,
      regionCode: "230221101001",
      evidencePhotoIds: ["photo-1"],
      submissionMetadata: {
        PROD_CULTIVAR_NAME: "龙单86",
      },
    });
  });
});
