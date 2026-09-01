import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  BusinessNotificationRow,
  EligibleFormalSample,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";
import { ExistingSampleObservationPanel } from "./ExistingSampleObservationPanel";

const sample: EligibleFormalSample = {
  samplePointId: "sample-1",
  sampleName: "中粮生化能源（龙江）有限公司",
  objectTypeCode: "DEEP_PROCESSOR",
  objectTypeName: "深加工企业",
  domain: "MARKET",
  productCode: "CORN",
  regionCode: "230221",
  regionName: "龙江县",
  latitude: "47.5100000",
  longitude: "123.3800000",
  effectiveFrom: "2026-01-01",
  latestObservationId: "record-1",
  latestObservedAt: "2026-08-25T10:58:50Z",
  latestValues: {
    MKT_PURCHASE_BASE_PRICE: "2097.0000",
    MKT_PACKAGING_FORM: "BULK",
    PURCHASE_VOLUME: "743.9000",
    PROCESSING_INPUT: "680.0000",
    ENDING_INVENTORY: "430.0000",
  },
};

function repository() {
  return {
    listObjectTypes: vi.fn().mockResolvedValue([
      { code: "TRADER", name: "贸易商", domain: "MARKET" },
      { code: "DEEP_PROCESSOR", name: "深加工企业", domain: "MARKET" },
      { code: "FEED_MILL", name: "饲料企业", domain: "MARKET" },
      { code: "BREEDING_FACTORY", name: "养殖企业", domain: "MARKET" },
    ]),
    listEligibleFormalSamples: vi.fn().mockResolvedValue([sample]),
    loadMarketDefinition: vi.fn().mockResolvedValue({
      productCode: "CORN",
      objectTypeCode: "DEEP_PROCESSOR",
      coreFields: [
        {
          code: "MKT_OBJECT_TYPE",
          label: "市场对象类型",
          controlType: "SELECT",
          unit: null,
          description: null,
          capability: null,
          required: true,
          precision: null,
          scale: null,
          sortOrder: 10,
          options: [],
        },
        {
          code: "MKT_REGION",
          label: "地区",
          controlType: "SELECT",
          unit: null,
          description: null,
          capability: null,
          required: true,
          precision: null,
          scale: null,
          sortOrder: 20,
          options: [],
        },
        {
          code: "MKT_TRADE_DATE",
          label: "采集日期",
          controlType: "DATE",
          unit: null,
          description: null,
          capability: null,
          required: true,
          precision: null,
          scale: null,
          sortOrder: 30,
          options: [],
        },
        {
          code: "MKT_PURCHASE_BASE_PRICE",
          label: "采购基础价",
          controlType: "NUMBER",
          unit: "元/吨",
          description: null,
          capability: null,
          required: true,
          precision: 18,
          scale: 4,
          sortOrder: 40,
          options: [],
        },
        {
          code: "MKT_PACKAGING_FORM",
          label: "包装形式",
          controlType: "SELECT",
          unit: null,
          description: null,
          capability: null,
          required: true,
          precision: null,
          scale: null,
          sortOrder: 50,
          options: [
            { value: "BULK", label: "散装", sortOrder: 10 },
            { value: "BAGGED", label: "袋装", sortOrder: 20 },
          ],
        },
      ],
      groups: [
        {
          category: "PURCHASE",
          label: "采购情况",
          sortOrder: 10,
          fields: [
            {
              code: "PURCHASE_VOLUME",
              label: "采购量",
              valueType: "DECIMAL",
              unit: "吨",
              description: null,
              precision: 18,
              scale: 4,
              sortOrder: 10,
            },
          ],
        },
        {
          category: "PROCESSING",
          label: "加工情况",
          sortOrder: 20,
          fields: [
            {
              code: "PROCESSING_INPUT",
              label: "加工投入量",
              valueType: "DECIMAL",
              unit: "吨",
              description: null,
              precision: 18,
              scale: 4,
              sortOrder: 10,
            },
          ],
        },
        {
          category: "INVENTORY",
          label: "库存情况",
          sortOrder: 30,
          fields: [
            {
              code: "ENDING_INVENTORY",
              label: "期末库存",
              valueType: "DECIMAL",
              unit: "吨",
              description: null,
              precision: 18,
              scale: 4,
              sortOrder: 10,
            },
          ],
        },
      ],
    }),
    listFormalSampleObservationHistory: vi.fn().mockResolvedValue({
      items: [
        {
          observationId: "observation-1",
          observedAt: "2026-08-25T10:58:50Z",
          officialSavedAt: "2026-08-25T10:59:00Z",
          actorDisplayName: "吴雨桐",
          projectionVersion: "projection-1",
          synchronizedModules: ["OVERVIEW", "MARKET_ANALYSIS", "REPORTS"],
          values: sample.latestValues,
          latest: true,
        },
      ],
      totalElements: 2,
      pageNumber: 0,
      pageSize: 20,
    }),
    saveFormalSampleObservation: vi.fn().mockResolvedValue({
      observationId: "observation-1",
      samplePointId: "sample-1",
      domain: "MARKET",
      productCode: "CORN",
      observedAt: "2026-08-29T02:51:00Z",
      officialSavedAt: "2026-08-29T02:51:01Z",
      projectionVersion: "projection-2",
      synchronizedModules: ["OVERVIEW", "MARKET_ANALYSIS", "REPORTS"],
      values: {},
    }),
  };
}

function renderPanel(api = repository(), onSaved = vi.fn()) {
  render(
    <ExistingSampleObservationPanel
      domain="MARKET"
      productCode="CORN"
      repository={api as unknown as RealtimeBusinessRepository}
      onSaved={onSaved}
    >
      <div>原有采集台账内容</div>
    </ExistingSampleObservationPanel>,
  );
  return { api, onSaved };
}

describe("ExistingSampleObservationPanel", () => {
  afterEach(cleanup);
  it("queries formal sample points, loads authoritative detail, and requeries after versioned deletion", async () => {
    const point = {
      id: "formal-point-1",
      kindCode: "SURVEY_SITE",
      canonicalName: "龙沙区正式样本",
      regionCode: "230202",
      approvalState: "APPROVED",
      locationState: "VALID",
      longitude: "123.95",
      latitude: "47.35",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      version: 4,
      annualObservationCount: 0,
      networkMembershipCount: 0,
    } as const;
    const listFormalSamplePoints = vi
      .fn()
      .mockResolvedValueOnce({
        items: [point],
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
      });
    const getFormalSamplePoint = vi.fn().mockResolvedValue(point);
    const deleteFormalSamplePoint = vi.fn().mockResolvedValue(undefined);
    const api = {
      ...repository(),
      loadMasterData: vi.fn().mockResolvedValue({
        regions: [{ code: "230202", name: "龙沙区", level: "COUNTY" }],
      }),
      listFormalSamplePoints,
      getFormalSamplePoint,
      deleteFormalSamplePoint,
      subscribeBusinessEvents: vi.fn(() => vi.fn()),
    };
    renderPanel(api);

    await userEvent.click(screen.getByRole("tab", { name: "正式样本台账" }));
    expect(await screen.findByText("龙沙区正式样本")).toBeVisible();
    expect(screen.getAllByText("龙沙区").length).toBeGreaterThan(0);
    expect(screen.queryByText("230202")).not.toBeInTheDocument();
    expect(listFormalSamplePoints).toHaveBeenLastCalledWith({
      regionCode: undefined,
      keyword: undefined,
      page: 0,
      pageSize: 20,
    });
    await userEvent.click(screen.getByRole("button", { name: "查看详情" }));
    await waitFor(() =>
      expect(getFormalSamplePoint).toHaveBeenCalledWith("formal-point-1"),
    );
    expect(
      screen.getByRole("region", { name: "正式样本详情" }),
    ).toHaveTextContent("123.95，47.35");

    await userEvent.click(screen.getByRole("button", { name: "删除正式样本" }));
    await userEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() =>
      expect(deleteFormalSamplePoint).toHaveBeenCalledWith("formal-point-1", 4),
    );
    await waitFor(() =>
      expect(listFormalSamplePoints).toHaveBeenCalledTimes(2),
    );
    expect(screen.queryByText("龙沙区正式样本")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "正式样本详情" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "正式样本已删除，列表已重新查询",
    );
  });

  it("refreshes the formal sample list and selected detail after an outbox event", async () => {
    const point = {
      id: "formal-point-1",
      kindCode: "SURVEY_SITE",
      canonicalName: "龙沙区正式样本",
      regionCode: "230202",
      approvalState: "APPROVED",
      locationState: "VALID",
      longitude: "123.95",
      latitude: "47.35",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      version: 4,
      annualObservationCount: 0,
      networkMembershipCount: 0,
    } as const;
    let onChange: (event: BusinessNotificationRow) => void = () => undefined;
    const listFormalSamplePoints = vi.fn().mockResolvedValue({
      items: [point],
      pageNumber: 0,
      pageSize: 20,
      totalElements: 1,
      totalPages: 1,
    });
    const getFormalSamplePoint = vi.fn().mockResolvedValue(point);
    const api = {
      ...repository(),
      listFormalSamplePoints,
      getFormalSamplePoint,
      deleteFormalSamplePoint: vi.fn(),
      subscribeBusinessEvents: vi.fn(
        (
          _after: number,
          listener: (event: BusinessNotificationRow) => void,
        ) => {
          onChange = listener;
          return vi.fn();
        },
      ),
    };
    renderPanel(api);
    await userEvent.click(screen.getByRole("tab", { name: "正式样本台账" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "查看详情" }),
    );
    await waitFor(() => expect(getFormalSamplePoint).toHaveBeenCalledTimes(1));

    onChange({
      id: "event-1",
      sequence: 9,
      aggregateType: "FORMAL_SAMPLE_POINT",
      aggregateId: "formal-point-1",
      actionCode: "FORMAL_SAMPLE_POINT_UPDATED",
      productCode: null,
      regionCodes: ["230202"],
      occurredAt: "2026-09-01T08:00:00Z",
      read: false,
    });

    await waitFor(() =>
      expect(listFormalSamplePoints).toHaveBeenCalledTimes(2),
    );
    await waitFor(() => expect(getFormalSamplePoint).toHaveBeenCalledTimes(2));
    expect(api.subscribeBusinessEvents).toHaveBeenCalledTimes(1);
  });

  it("keeps a version-conflict reason visible after the authoritative requery", async () => {
    const point = {
      id: "formal-point-1",
      kindCode: "SURVEY_SITE",
      canonicalName: "龙沙区正式样本",
      regionCode: "230202",
      approvalState: "APPROVED",
      locationState: "VALID",
      longitude: "123.95",
      latitude: "47.35",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      version: 4,
      annualObservationCount: 0,
      networkMembershipCount: 0,
    } as const;
    const listFormalSamplePoints = vi.fn().mockResolvedValue({
      items: [point],
      pageNumber: 0,
      pageSize: 20,
      totalElements: 1,
      totalPages: 1,
    });
    const refreshedPoint = { ...point, version: 5 };
    const deleteFormalSamplePoint = vi
      .fn()
      .mockRejectedValueOnce(
        new RealtimeApiError({
          code: "FORMAL_SAMPLE_POINT_VERSION_CONFLICT",
          message: "正式样本已发生变化，请刷新后重试",
          status: 409,
        }),
      )
      .mockResolvedValueOnce(undefined);
    const api = {
      ...repository(),
      listFormalSamplePoints,
      getFormalSamplePoint: vi
        .fn()
        .mockResolvedValueOnce(point)
        .mockResolvedValueOnce(refreshedPoint),
      deleteFormalSamplePoint,
      subscribeBusinessEvents: vi.fn(() => vi.fn()),
    };
    renderPanel(api);
    await userEvent.click(screen.getByRole("tab", { name: "正式样本台账" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "查看详情" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "删除正式样本" }));
    await userEvent.click(screen.getByRole("button", { name: "确认删除" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "正式样本已被其他人更新，请刷新后再删除",
    );
    expect(listFormalSamplePoints).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText("龙沙区正式样本").length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: "删除正式样本" }));
    await userEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() =>
      expect(deleteFormalSamplePoint).toHaveBeenLastCalledWith(
        "formal-point-1",
        5,
      ),
    );
  });

  it("uses the agricultural-input server fields without generic grain-price residue", async () => {
    const agriculturalSample: EligibleFormalSample = {
      ...sample,
      samplePointId: "agri-sample-1",
      sampleName: "龙沙区兴农农资店",
      objectTypeCode: "AGRICULTURAL_INPUT_STORE",
      objectTypeName: "农资店",
      latestValues: {
        AGRI_INPUT_SEED_SALES_VOLUME: "1250.5000",
        AGRI_INPUT_SEED_RETAIL_PRICE: "6.7500",
        AGRI_INPUT_SUPPLY_STATUS: "TIGHT",
        AGRI_INPUT_PLANTING_INTENTION_TREND: "INCREASE",
      },
    };
    const api = repository();
    api.listEligibleFormalSamples.mockResolvedValue([agriculturalSample]);
    api.loadMarketDefinition.mockResolvedValue({
      productCode: "CORN",
      objectTypeCode: "AGRICULTURAL_INPUT_STORE",
      coreFields: [
        agriField(
          "AGRI_INPUT_SEED_SALES_VOLUME",
          "种子销售量",
          "DECIMAL",
          "公斤",
        ),
        agriField(
          "AGRI_INPUT_SEED_RETAIL_PRICE",
          "种子零售价",
          "DECIMAL",
          "元/公斤",
        ),
        agriField("AGRI_INPUT_SUPPLY_STATUS", "供货状态", "SELECT", null, [
          { value: "SUFFICIENT", label: "充足" },
          { value: "TIGHT", label: "偏紧" },
        ]),
        agriField(
          "AGRI_INPUT_PLANTING_INTENTION_TREND",
          "种植意向趋势",
          "SELECT",
          null,
          [
            { value: "INCREASE", label: "增加" },
            { value: "STABLE", label: "持平" },
          ],
        ),
      ],
      groups: [],
    });
    renderPanel(api);

    await userEvent.click(
      screen.getByRole("tab", { name: "已有样本数据更新" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /龙沙区兴农农资店/u }),
    );
    const salesVolume = await screen.findByLabelText("种子销售量（公斤）");
    expect(salesVolume).toHaveValue(1250.5);
    expect(salesVolume).toHaveAttribute("step", "0.0001");
    expect(salesVolume).toHaveAttribute("max", "99999999999999.9999");
    expect(salesVolume).toHaveAttribute("min", "-99999999999999.9999");
    expect(screen.getByLabelText("种子零售价（元/公斤）")).toHaveValue(6.75);
    expect(screen.getByLabelText("供货状态")).toHaveValue("TIGHT");
    expect(screen.getByLabelText("种植意向趋势")).toHaveValue("INCREASE");
    expect(screen.queryByLabelText(/采购基础价/u)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/销售基础价/u)).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "保存并正式入库" }),
    );
    await waitFor(() =>
      expect(api.saveFormalSampleObservation).toHaveBeenCalledTimes(1),
    );
    expect(api.saveFormalSampleObservation.mock.calls[0]?.[0]).toMatchObject({
      payload: {
        coreValues: agriculturalSample.latestValues,
        facts: {},
      },
    });
  });

  it("keeps the formal sample workspace free of review and import workflow language", () => {
    const source = [
      "src/business/formal-sample/ExistingSampleObservationPanel.tsx",
      "src/business/formal-sample/FormalSamplePointLedger.tsx",
    ]
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    expect(source).not.toMatch(
      /待我处理|已办事项|导入|审核|DRAFT|PENDING|APPROVE|REJECT|PUBLISH/u,
    );
  });

  it("replaces a clean selected editor with authoritative values after an observation event", async () => {
    let onChange: (event: BusinessNotificationRow) => void = () => undefined;
    const refreshed = {
      ...sample,
      latestObservationId: "record-2",
      latestValues: {
        ...sample.latestValues,
        MKT_PURCHASE_BASE_PRICE: "2200.0000",
      },
    };
    const api = repository();
    api.listEligibleFormalSamples
      .mockResolvedValueOnce([sample])
      .mockResolvedValueOnce([refreshed]);
    const withEvents = {
      ...api,
      subscribeBusinessEvents: vi.fn(
        (
          _after: number,
          listener: (event: BusinessNotificationRow) => void,
        ) => {
          onChange = listener;
          return vi.fn();
        },
      ),
    };
    renderPanel(withEvents);
    await userEvent.click(
      screen.getByRole("tab", { name: "已有样本数据更新" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /中粮生化能源/u }),
    );
    expect(await screen.findByLabelText("采购基础价（元/吨）")).toHaveValue(
      2097,
    );

    act(() => {
      onChange({
        id: "event-observation-2",
        sequence: 10,
        aggregateType: "FORMAL_SAMPLE_OBSERVATION",
        aggregateId: "record-2",
        actionCode: "FORMAL_SAMPLE_OBSERVATION_SAVED",
        productCode: "CORN",
        regionCodes: ["230221"],
        occurredAt: "2026-09-01T08:00:00Z",
        read: false,
      });
    });

    await waitFor(() =>
      expect(screen.getByLabelText("采购基础价（元/吨）")).toHaveValue(2200),
    );
    expect(withEvents.subscribeBusinessEvents).toHaveBeenCalledTimes(1);
  });

  it("switches the whole page between ledger and update modes", async () => {
    renderPanel();
    expect(screen.getByText("原有采集台账内容")).toBeVisible();
    await userEvent.click(
      screen.getByRole("tab", { name: "已有样本数据更新" }),
    );
    expect(screen.queryByText("原有采集台账内容")).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "已有正式样本查询" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "查询与定位" })).toBeVisible();
    const process = screen.getByRole("navigation", {
      name: "已有样本数据更新流程",
    });
    expect(within(process).getAllByRole("listitem")).toHaveLength(3);
    expect(process).toHaveTextContent("查询正式样本");
    expect(process).toHaveTextContent("填写本次观测");
    expect(process).toHaveTextContent("正式入库并联动");
  });

  it("never lets a late response restore samples from an obsolete filter scope", async () => {
    const api = repository();
    let resolveOld: (items: readonly EligibleFormalSample[]) => void = () =>
      undefined;
    api.listEligibleFormalSamples
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValueOnce([]);
    renderPanel(api);
    await userEvent.click(
      screen.getByRole("tab", { name: "已有样本数据更新" }),
    );
    await waitFor(() =>
      expect(api.listEligibleFormalSamples).toHaveBeenCalledTimes(1),
    );
    await screen.findByRole("option", { name: "深加工企业" });
    await userEvent.selectOptions(
      screen.getByLabelText("筛选对象类型"),
      "DEEP_PROCESSOR",
    );
    await userEvent.click(screen.getByRole("button", { name: "查询正式样本" }));
    await waitFor(() =>
      expect(api.listEligibleFormalSamples).toHaveBeenCalledTimes(2),
    );
    resolveOld([sample]);
    await waitFor(() =>
      expect(screen.getByText("当前条件下没有可更新的正式样本")).toBeVisible(),
    );
    expect(
      screen.queryByRole("button", { name: /中粮生化能源/u }),
    ).not.toBeInTheDocument();
  });

  it("filters samples, locks identity, and renders every applicable server field", async () => {
    const { api } = renderPanel();
    await userEvent.click(
      screen.getByRole("tab", { name: "已有样本数据更新" }),
    );
    await screen.findByRole("option", { name: "深加工企业" });
    await userEvent.selectOptions(
      screen.getByLabelText("筛选对象类型"),
      "DEEP_PROCESSOR",
    );
    await userEvent.type(
      screen.getByRole("searchbox", { name: "搜索样本企业" }),
      "中粮生化",
    );
    await userEvent.click(screen.getByRole("button", { name: "查询正式样本" }));
    await waitFor(() =>
      expect(api.listEligibleFormalSamples).toHaveBeenLastCalledWith(
        expect.objectContaining({
          domain: "MARKET",
          productCode: "CORN",
          objectTypeCode: "DEEP_PROCESSOR",
          keyword: "中粮生化",
        }),
      ),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /中粮生化能源/u }),
    );
    expect(screen.getByRole("heading", { name: "本次正式观测" })).toBeVisible();
    expect(screen.getByText("坐标由样本档案管理")).toBeVisible();
    const identity = await screen.findByRole("group", {
      name: "正式样本锁定信息",
    });
    expect(within(identity).getByText(/深加工企业/u)).toBeVisible();
    expect(within(identity).getByText(/龙江县/u)).toBeVisible();
    expect(screen.getByLabelText("采购基础价（元/吨）")).toHaveValue(2097);
    expect(screen.getByLabelText("采购量（吨）")).toHaveValue(743.9);
    expect(screen.getByLabelText("加工投入量（吨）")).toHaveValue(680);
    expect(screen.getByLabelText("期末库存（吨）")).toHaveValue(430);
    expect(screen.getByLabelText("期末库存（吨）")).toHaveAttribute(
      "min",
      "-99999999999999.9999",
    );
    expect(screen.queryByLabelText(/销售基础价/u)).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "历史观测记录" }),
    ).toHaveTextContent("共 2 条");
    expect(
      screen.getByRole("region", { name: "历史观测记录" }),
    ).toHaveTextContent("吴雨桐");
    expect(
      screen.getByRole("region", { name: "历史观测记录" }),
    ).toHaveTextContent("散装");
    expect(
      screen.getByRole("region", { name: "历史观测记录" }),
    ).not.toHaveTextContent("BULK");
  });

  it("queries page-visible history by an explicit data year", async () => {
    const { api } = renderPanel();
    await userEvent.click(
      screen.getByRole("tab", { name: "已有样本数据更新" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /中粮生化能源/u }),
    );
    await screen.findByText("吴雨桐");
    await userEvent.selectOptions(
      screen.getByLabelText("历史数据年份"),
      "2025",
    );
    await waitFor(() =>
      expect(api.listFormalSampleObservationHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({
          domain: "MARKET",
          samplePointId: "sample-1",
          productCode: "CORN",
          year: 2025,
          pageNumber: 0,
          pageSize: 20,
        }),
      ),
    );
  });

  it("never displays a slower previous sample history under the current sample", async () => {
    const api = repository();
    const second = {
      ...sample,
      samplePointId: "sample-2",
      sampleName: "龙江第二正式样本",
    };
    api.listEligibleFormalSamples.mockResolvedValue([sample, second]);
    let resolveFirst: (
      value: Awaited<ReturnType<typeof api.listFormalSampleObservationHistory>>,
    ) => void = () => undefined;
    api.listFormalSampleObservationHistory
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({
        items: [
          {
            observationId: "observation-2",
            observedAt: "2026-08-26T10:58:50Z",
            officialSavedAt: "2026-08-26T10:59:00Z",
            actorDisplayName: "当前样本填报人",
            projectionVersion: "projection-2",
            synchronizedModules: ["OVERVIEW", "MARKET_ANALYSIS", "REPORTS"],
            values: second.latestValues,
            latest: true,
          },
        ],
        totalElements: 1,
        pageNumber: 0,
        pageSize: 20,
      });
    renderPanel(api);
    await userEvent.click(
      screen.getByRole("tab", { name: "已有样本数据更新" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /中粮生化能源/u }),
    );
    await waitFor(() =>
      expect(api.listFormalSampleObservationHistory).toHaveBeenCalledTimes(1),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /龙江第二正式样本/u }),
    );
    await screen.findByText("当前样本填报人");
    resolveFirst({
      items: [
        {
          observationId: "old-observation",
          observedAt: "2026-08-20T10:58:50Z",
          officialSavedAt: "2026-08-20T10:59:00Z",
          actorDisplayName: "上一样本填报人",
          projectionVersion: "projection-old",
          synchronizedModules: ["OVERVIEW", "MARKET_ANALYSIS", "REPORTS"],
          values: sample.latestValues,
          latest: true,
        },
      ],
      totalElements: 1,
      pageNumber: 0,
      pageSize: 20,
    });
    await waitFor(() =>
      expect(screen.queryByText("上一样本填报人")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("当前样本填报人")).toBeVisible();
  });

  it("saves exactly the displayed contract and reports official linkage", async () => {
    const { api, onSaved } = renderPanel();
    await userEvent.click(
      screen.getByRole("tab", { name: "已有样本数据更新" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /中粮生化能源/u }),
    );
    await screen.findByLabelText("采购基础价（元/吨）");
    await userEvent.click(
      screen.getByRole("button", { name: "保存并正式入库" }),
    );
    await waitFor(() =>
      expect(api.saveFormalSampleObservation).toHaveBeenCalledTimes(1),
    );
    const savedCommand: unknown =
      api.saveFormalSampleObservation.mock.calls[0]?.[0];
    expect(savedCommand).toMatchObject({
      domain: "MARKET",
      samplePointId: "sample-1",
      productCode: "CORN",
      payload: {
        productCode: "CORN",
        coreValues: {
          MKT_PURCHASE_BASE_PRICE: "2097.0000",
          MKT_PACKAGING_FORM: "BULK",
        },
        facts: {
          PURCHASE_VOLUME: "743.9000",
          PROCESSING_INPUT: "680.0000",
          ENDING_INVENTORY: "430.0000",
        },
        evidencePhotoIds: [],
      },
    });
    expect(JSON.stringify(savedCommand)).not.toContain("MKT_SALE_BASE_PRICE");
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent(
      /已正式入库.*总揽.*市场分析.*报表/u,
    );
  });

  it("uses a formal two-pane workspace and collapses below tablet width", () => {
    const css = readFileSync("src/business/market-monitoring.css", "utf8");
    const shellCss = readFileSync("src/business/formal-enterprise.css", "utf8");
    expect(css).toMatch(
      /\.existing-observation__workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\([^;]+\)\s+minmax\([^;]+\)/u,
    );
    expect(css).toMatch(
      /@media \(max-width:\s*900px\)[\s\S]*\.existing-observation__workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u,
    );
    expect(css).toMatch(
      /@media \(max-width:\s*900px\)[\s\S]*\.existing-observation__samples\s*\{[^}]*contain:\s*none[^}]*overflow:\s*visible/u,
    );
    expect(css).toMatch(
      /\.existing-observation__samples\s*\{[^}]*display:\s*grid[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)[^}]*contain:\s*size[^}]*overflow:\s*hidden[^}]*position:\s*static/u,
    );
    expect(css).toMatch(
      /\.existing-observation__sample-list\s*\{[^}]*max-height:\s*none[^}]*overflow:\s*auto/u,
    );
    expect(css).not.toMatch(/\.existing-observation[^}]*position:\s*fixed/u);
    expect(css).toMatch(
      /\.existing-observation__filters\s+:is\(input, select\)[^{]*\{[^}]*height:\s*40px/u,
    );
    expect(css).toMatch(
      /\.existing-observation__filters\s*>\s*button\s*\{[^}]*height:\s*40px/u,
    );
    expect(css).toMatch(
      /@media \(max-width:\s*640px\)[\s\S]*\.existing-observation__filters\s+:is\(input, select\)[^{]*\{[^}]*height:\s*48px/u,
    );
    expect(css).toMatch(
      /\.formal-sample-ledger__layout\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\([^;]+\)\s+minmax\([^;]+\)/u,
    );
    expect(css).toMatch(
      /@media \(max-width:\s*900px\)[\s\S]*\.formal-sample-ledger__layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u,
    );
    expect(shellCss).toMatch(
      /@media \(max-width:\s*1180px\)[\s\S]*\.formal-enterprise\s*\{[^}]*min-width:\s*0/u,
    );
    expect(shellCss).toMatch(
      /@media \(max-width:\s*1180px\)[\s\S]*\.formal-enterprise\s+\.formal-enterprise-shell,[\s\S]*\{[^}]*display:\s*grid/u,
    );
    expect(shellCss).toMatch(
      /@media \(max-width:\s*700px\)[\s\S]*\.formal-enterprise\s+\.formal-enterprise-shell[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u,
    );
  });
});

function agriField(
  code: string,
  label: string,
  controlType: string,
  unit: string | null,
  options: readonly { value: string; label: string }[] = [],
) {
  return {
    code,
    label,
    controlType,
    unit,
    description: null,
    capability: null,
    required: false,
    precision: 18,
    scale: 4,
    sortOrder: 130,
    options,
  };
}
