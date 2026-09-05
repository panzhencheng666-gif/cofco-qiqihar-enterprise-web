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
import { parseProductionDefinition } from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";
import { ExistingSampleObservationPanel } from "./ExistingSampleObservationPanel";

const sample: EligibleFormalSample = {
  samplePointId: "sample-1",
  sampleName: "中粮生化能源（龙江）有限公司",
  address: "龙江县工业园区 1 号",
  objectTypeCode: "DEEP_PROCESSOR",
  objectTypeName: "深加工企业",
  domain: "MARKET",
  productCode: "CORN",
  regionCode: "230221",
  regionName: "龙江县",
  maintainerSubjectId: "employee-maintainer",
  maintainerDisplayName: "王维护",
  latitude: "47.5100000",
  longitude: "123.3800000",
  effectiveFrom: "2026-01-01",
  version: 2,
  annualObservationCount: 4,
  networkMembershipCount: 1,
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

const maintainer = {
  subjectId: "employee-maintainer",
  displayName: "王维护",
  workUnitCode: "QIQIHAR_BUSINESS",
  workUnitName: "齐齐哈尔业务组",
  accountStatus: "ACTIVE",
  employmentStatus: "ACTIVE",
  roles: [{ code: "BUSINESS_OPERATOR", name: "业务填报员" }],
  positions: [{ code: "REPORTER", name: "填报岗", primaryPosition: true }],
  regionCodes: ["230202", "230221"],
  version: 1,
} as const;

function repository() {
  const point = formalPoint({
    id: sample.samplePointId,
    canonicalName: sample.sampleName,
    objectTypeCode: sample.objectTypeCode ?? "DEEP_PROCESSOR",
    objectTypeName: sample.objectTypeName ?? "深加工企业",
  });
  return {
    listObjectTypes: vi.fn().mockResolvedValue([
      { code: "TRADER", name: "贸易商", domain: "MARKET" },
      { code: "DEEP_PROCESSOR", name: "深加工企业", domain: "MARKET" },
      { code: "FEED_MILL", name: "饲料企业", domain: "MARKET" },
      { code: "BREEDING_FACTORY", name: "养殖企业", domain: "MARKET" },
    ]),
    listEligibleFormalSamples: vi.fn().mockResolvedValue([sample]),
    listEmployees: vi.fn().mockResolvedValue([maintainer]),
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
    listFormalSamplePoints: vi.fn().mockResolvedValue({
      items: [point],
      pageNumber: 0,
      pageSize: 20,
      totalElements: 1,
      totalPages: 1,
    }),
    getFormalSamplePoint: vi.fn().mockResolvedValue(point),
    createFormalSamplePoint: vi.fn(),
    updateFormalSamplePoint: vi.fn(),
    assignFormalSampleMaintainer: vi.fn(),
    deleteFormalSamplePoint: vi.fn(),
    retireFormalSamplePoint: vi.fn(),
    subscribeBusinessEvents: vi.fn(
      (after: number, listener: (event: BusinessNotificationRow) => void) => {
        void after;
        void listener;
        return vi.fn();
      },
    ),
  };
}

function renderPanel(
  api = repository(),
  onSaved = vi.fn(),
  permissions: readonly string[] = [
    "BUSINESS_CREATE",
    "FORMAL_SAMPLE_MANAGE",
    "FORMAL_SAMPLE_DELETE",
  ],
  initialMode: "LEDGER" | "POINTS" = "POINTS",
) {
  render(
    <ExistingSampleObservationPanel
      domain="MARKET"
      permissions={permissions}
      productCode="CORN"
      repository={api as unknown as RealtimeBusinessRepository}
      selection={
        initialMode === "POINTS"
          ? { type: "formal-sample-list", id: "list" }
          : undefined
      }
      onSaved={onSaved}
    >
      <div>原有采集台账内容</div>
    </ExistingSampleObservationPanel>,
  );
  return { api, onSaved };
}

async function openCollectionData() {
  const [firstAction] = await screen.findAllByRole("button", {
    name: /填写采集数据|更新采集数据/u,
  });
  await userEvent.click(firstAction);
}

function formalPoint(
  overrides: Partial<{
    id: string;
    canonicalName: string;
    regionCode: string;
    address: string;
    longitude: number;
    latitude: number;
    objectTypeCode: string;
    objectTypeName: string;
    businessDomain: string;
    maintainerSubjectId: string | null;
    maintainerDisplayName: string | null;
    version: number;
  }> = {},
) {
  return {
    id: "formal-point-1",
    kindCode: "SURVEY_SITE",
    canonicalName: "龙沙区贸易商样本",
    regionCode: "230202",
    objectTypeCode: "TRADER",
    objectTypeName: "贸易商",
    businessDomain: "MARKET",
    address: "龙沙区新立街 1 号",
    maintainerSubjectId: maintainer.subjectId,
    maintainerDisplayName: maintainer.displayName,
    approvalState: "APPROVED",
    locationState: "VALID",
    longitude: 123.94,
    latitude: 47.31,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    version: 0,
    annualObservationCount: 0,
    networkMembershipCount: 0,
    ...overrides,
  } as const;
}

function eligibleSampleFor(point: {
  id: string;
  canonicalName: string;
  regionCode: string;
  longitude: number | string | null;
  latitude: number | string | null;
  objectTypeCode?: string;
  objectTypeName?: string;
  maintainerSubjectId?: string | null;
  maintainerDisplayName?: string | null;
}): EligibleFormalSample {
  return {
    ...sample,
    samplePointId: point.id,
    sampleName: point.canonicalName,
    regionCode: point.regionCode,
    regionName: point.regionCode === "230202" ? "龙沙区" : sample.regionName,
    longitude: String(point.longitude ?? ""),
    latitude: String(point.latitude ?? ""),
    objectTypeCode: point.objectTypeCode ?? "TRADER",
    objectTypeName: point.objectTypeName ?? "贸易商",
    maintainerSubjectId:
      point.maintainerSubjectId === undefined
        ? sample.maintainerSubjectId
        : point.maintainerSubjectId,
    maintainerDisplayName:
      point.maintainerDisplayName === undefined
        ? sample.maintainerDisplayName
        : point.maintainerDisplayName,
  };
}

describe("ExistingSampleObservationPanel", () => {
  it("resolves the retired formal-sample list route to the existing business list", () => {
    render(
      <ExistingSampleObservationPanel
        domain="MARKET"
        productCode="CORN"
        repository={repository() as unknown as RealtimeBusinessRepository}
        selection={{ type: "formal-sample-list", id: "list" }}
        onSelectionChange={vi.fn()}
        onSaved={() => undefined}
      >
        <div>原有采集台账内容</div>
      </ExistingSampleObservationPanel>,
    );

    expect(screen.getByText("原有采集台账内容")).toBeVisible();
    expect(screen.queryByText("维护样本与期间数据")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "采集台账" }),
    ).not.toBeInTheDocument();
  });

  it("blocks a direct observation route without collection permission", async () => {
    const api = repository();
    render(
      <ExistingSampleObservationPanel
        domain="MARKET"
        permissions={[]}
        productCode="CORN"
        repository={api as unknown as RealtimeBusinessRepository}
        selection={{ type: "formal-sample-observation", id: "sample-1" }}
        onSelectionChange={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole("region", { name: "采集数据填写权限不足" }),
    ).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "当前账号没有填写正式采集数据的权限。",
    );
    expect(
      screen.queryByRole("button", { name: "保存并正式入库" }),
    ).not.toBeInTheDocument();
    expect(api.listEligibleFormalSamples).not.toHaveBeenCalled();
    expect(api.saveFormalSampleObservation).not.toHaveBeenCalled();
  });

  it("preserves the locked sample when a direct observation route is queried again", async () => {
    const api = repository();
    render(
      <ExistingSampleObservationPanel
        domain="MARKET"
        permissions={["BUSINESS_CREATE"]}
        productCode="CORN"
        repository={api as unknown as RealtimeBusinessRepository}
        selection={{
          type: "formal-sample-observation",
          id: sample.samplePointId,
        }}
        onSelectionChange={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole("group", { name: "正式样本锁定信息" }),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "查询正式样本" }));

    expect(
      await screen.findByRole("group", { name: "正式样本锁定信息" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "保存并正式入库" }),
    ).toBeVisible();
    expect(api.listEligibleFormalSamples).toHaveBeenLastCalledWith(
      expect.objectContaining({ domain: "MARKET", productCode: "CORN" }),
    );
  });

  it("edits location inline and submits it atomically with the selected sample observation", async () => {
    const api = repository();
    const onSelectionChange = vi.fn();
    render(
      <ExistingSampleObservationPanel
        domain="MARKET"
        permissions={["BUSINESS_CREATE", "FORMAL_SAMPLE_MANAGE"]}
        productCode="CORN"
        repository={api as unknown as RealtimeBusinessRepository}
        selection={{
          type: "formal-sample-observation",
          id: sample.samplePointId,
        }}
        onSelectionChange={onSelectionChange}
        onSaved={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole("group", { name: "正式样本锁定信息" }),
    ).toBeVisible();
    const longitude = await screen.findByRole("spinbutton", { name: "经度" });
    expect(longitude.closest("form")).toContainElement(
      screen.getByRole("button", { name: "保存并正式入库" }),
    );
    expect(screen.getByRole("combobox", { name: "样本业务地区" })).toHaveValue(
      sample.regionCode,
    );
    expect(screen.getByRole("spinbutton", { name: "纬度" })).toHaveValue(
      Number(sample.latitude),
    );
    await userEvent.clear(longitude);
    await userEvent.type(longitude, "123.4567890");
    await userEvent.click(
      screen.getByRole("button", { name: "保存并正式入库" }),
    );
    await waitFor(() =>
      expect(api.saveFormalSampleObservation).toHaveBeenCalledWith(
        expect.objectContaining({
          samplePointId: sample.samplePointId,
          sampleLocation: {
            expectedVersion: sample.version,
            regionCode: sample.regionCode,
            longitude: "123.456789",
            latitude: sample.latitude,
          },
        }),
        expect.any(String),
      ),
    );
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(api.updateFormalSamplePoint).not.toHaveBeenCalled();
    expect(api.createFormalSamplePoint).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "编辑业务地区与定位坐标" }),
    ).not.toBeInTheDocument();
  });

  it("does not coerce a cleared inline coordinate to zero or submit it", async () => {
    const { api } = renderPanel();
    await openCollectionData();
    const longitude = await screen.findByRole("spinbutton", { name: "经度" });
    await userEvent.clear(longitude);
    await userEvent.click(
      screen.getByRole("button", { name: "保存并正式入库" }),
    );
    expect(longitude).toHaveValue(null);
    expect(api.saveFormalSampleObservation).not.toHaveBeenCalled();
  });

  it("preserves location drafts and their version across realtime updates and failed saves", async () => {
    const api = repository();
    const { onSaved } = renderPanel(api);
    await openCollectionData();
    const longitude = await screen.findByRole("spinbutton", { name: "经度" });
    await userEvent.clear(longitude);
    await userEvent.type(longitude, "123.456789");
    const listener = api.subscribeBusinessEvents.mock.calls.at(-1)![1];
    api.listEligibleFormalSamples.mockResolvedValue([
      { ...sample, version: 3, longitude: "123.4" },
    ]);
    act(() =>
      listener({
        id: "location-update",
        sequence: 88,
        aggregateType: "FORMAL_SAMPLE_POINT",
        aggregateId: sample.samplePointId,
        actionCode: "FORMAL_SAMPLE_POINT_UPDATED",
        productCode: null,
        regionCodes: [sample.regionCode],
        occurredAt: "2026-09-05T00:00:00Z",
        read: false,
      }),
    );
    await screen.findByText(/当前未保存内容未被覆盖/u);
    expect(longitude).toHaveValue(123.456789);
    api.saveFormalSampleObservation.mockRejectedValue(
      new RealtimeApiError({
        code: "FORMAL_SAMPLE_POINT_VERSION_CONFLICT",
        message: "正式样本已发生变化，请刷新后重试",
        status: 409,
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "保存并正式入库" }),
    );
    await screen.findByText("正式样本已发生变化，请刷新后重试");
    expect(api.saveFormalSampleObservation).toHaveBeenLastCalledWith(
      expect.objectContaining({
        samplePointId: sample.samplePointId,
        sampleLocation: {
          expectedVersion: 2,
          longitude: "123.456789",
          latitude: sample.latitude,
          regionCode: sample.regionCode,
        },
      }),
      expect.any(String),
    );
    expect(longitude).toHaveValue(123.456789);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("retains a dirty selected sample when a realtime move removes it from the filtered result", async () => {
    const api = repository();
    renderPanel(api);
    await openCollectionData();
    const longitude = await screen.findByRole("spinbutton", { name: "经度" });
    await userEvent.clear(longitude);
    await userEvent.type(longitude, "123.456789");
    const listener = api.subscribeBusinessEvents.mock.calls.at(-1)![1];
    api.listEligibleFormalSamples.mockResolvedValue([]);

    act(() =>
      listener({
        id: "location-moved-outside-filter",
        sequence: 89,
        aggregateType: "FORMAL_SAMPLE_POINT",
        aggregateId: sample.samplePointId,
        actionCode: "FORMAL_SAMPLE_POINT_UPDATED",
        productCode: null,
        regionCodes: [sample.regionCode, "230202"],
        occurredAt: "2026-09-05T00:01:00Z",
        read: false,
      }),
    );

    expect(
      await screen.findByText(/已不在当前查询结果.*未保存内容未被覆盖/u),
    ).toBeVisible();
    expect(longitude).toHaveValue(123.456789);
    expect(screen.getByRole("spinbutton", { name: "纬度" })).toHaveValue(
      Number(sample.latitude),
    );
    expect(
      screen.getByRole("button", { name: "保存并正式入库" }),
    ).toBeVisible();
  });

  it("drains a relevant realtime event after a failed save without resetting the draft", async () => {
    let rejectSave: (error: unknown) => void = () => undefined;
    const api = repository();
    api.saveFormalSampleObservation.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectSave = reject;
        }),
    );
    renderPanel(api);
    await openCollectionData();
    const longitude = await screen.findByRole("spinbutton", { name: "经度" });
    await userEvent.clear(longitude);
    await userEvent.type(longitude, "123.456789");
    const listener = api.subscribeBusinessEvents.mock.calls.at(-1)![1];
    const callsBeforeSave = api.listEligibleFormalSamples.mock.calls.length;
    await userEvent.click(
      screen.getByRole("button", { name: "保存并正式入库" }),
    );
    await waitFor(() =>
      expect(api.saveFormalSampleObservation).toHaveBeenCalledTimes(1),
    );

    act(() =>
      listener({
        id: "location-update-during-save",
        sequence: 90,
        aggregateType: "FORMAL_SAMPLE_POINT",
        aggregateId: sample.samplePointId,
        actionCode: "FORMAL_SAMPLE_POINT_UPDATED",
        productCode: null,
        regionCodes: [sample.regionCode],
        occurredAt: "2026-09-05T00:02:00Z",
        read: false,
      }),
    );
    expect(api.listEligibleFormalSamples).toHaveBeenCalledTimes(
      callsBeforeSave,
    );

    act(() =>
      rejectSave(
        new RealtimeApiError({
          code: "FORMAL_SAMPLE_POINT_VERSION_CONFLICT",
          message: "正式样本已发生变化，请刷新后重试",
          status: 409,
        }),
      ),
    );

    await waitFor(() =>
      expect(api.listEligibleFormalSamples).toHaveBeenCalledTimes(
        callsBeforeSave + 1,
      ),
    );
    expect(longitude).toHaveValue(123.456789);
    expect(screen.getByRole("status")).toHaveTextContent(
      "正式样本已发生变化，请刷新后重试",
    );
  });

  it("keeps inline location read-only without master-data permission and submits only observation data", async () => {
    const { api } = renderPanel(repository(), vi.fn(), ["BUSINESS_CREATE"]);
    await openCollectionData();
    expect(
      await screen.findByRole("spinbutton", { name: "经度" }),
    ).toBeDisabled();
    expect(screen.getByRole("spinbutton", { name: "纬度" })).toBeDisabled();
    expect(
      screen.getByRole("combobox", { name: "样本业务地区" }),
    ).toBeDisabled();
    await userEvent.click(
      screen.getByRole("button", { name: "保存并正式入库" }),
    );
    await waitFor(() =>
      expect(api.saveFormalSampleObservation).toHaveBeenCalledTimes(1),
    );
    expect(api.saveFormalSampleObservation.mock.calls[0][0]).not.toHaveProperty(
      "sampleLocation",
    );
  });

  it("keeps the mature business ledger visible behind the routed formal editor drawer", async () => {
    const onSelectionChange = vi.fn();
    render(
      <ExistingSampleObservationPanel
        domain="MARKET"
        permissions={[
          "BUSINESS_CREATE",
          "FORMAL_SAMPLE_MANAGE",
          "FORMAL_SAMPLE_DELETE",
        ]}
        productCode="CORN"
        repository={repository() as unknown as RealtimeBusinessRepository}
        selection={{ type: "formal-sample-create", id: "new" }}
        onSelectionChange={onSelectionChange}
        onSaved={() => undefined}
      >
        <div>原有采集台账内容</div>
      </ExistingSampleObservationPanel>,
    );

    expect(
      await screen.findByRole("region", { name: "正式样本稳定信息" }),
    ).toBeVisible();
    expect(screen.getByText("原有采集台账内容")).toBeVisible();
    expect(
      screen.getByRole("region", { name: "正式样本稳定信息" }),
    ).toHaveClass("enterprise-ledger-drawer");
    expect(
      screen.queryByRole("heading", { name: "采集台账" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "返回正式样本台账" }),
    );
    expect(onSelectionChange).toHaveBeenCalledWith({
      type: "formal-sample-list",
      id: "list",
    });
  });

  it("renders the routed retirement entry as a focused enterprise drawer over the mature ledger", async () => {
    const onSelectionChange = vi.fn();
    render(
      <ExistingSampleObservationPanel
        domain="MARKET"
        permissions={["FORMAL_SAMPLE_MANAGE", "FORMAL_SAMPLE_DELETE"]}
        productCode="CORN"
        repository={repository() as unknown as RealtimeBusinessRepository}
        selection={{ type: "formal-sample-view", id: "formal-point-1" }}
        onSelectionChange={onSelectionChange}
        onSaved={() => undefined}
      >
        <div>原有采集台账内容</div>
      </ExistingSampleObservationPanel>,
    );

    const drawer = await screen.findByRole("region", {
      name: "淘汰现有样本点",
    });
    expect(drawer).toHaveClass("enterprise-ledger-drawer");
    expect(screen.getByText("原有采集台账内容")).toBeVisible();
    expect(within(drawer).getByText("淘汰不是删除")).toBeVisible();
    expect(within(drawer).getByText("历史归档年度")).toBeVisible();
    expect(within(drawer).queryByText("版本")).not.toBeInTheDocument();
    expect(
      within(drawer).queryByRole("button", { name: "编辑稳定信息" }),
    ).not.toBeInTheDocument();
    expect(
      within(drawer).queryByRole("button", { name: "删除正式样本" }),
    ).not.toBeInTheDocument();
    expect(within(drawer).getAllByRole("button")).toHaveLength(2);

    await userEvent.click(
      within(drawer).getByRole("button", { name: "返回台账" }),
    );
    expect(onSelectionChange).toHaveBeenCalledWith({
      type: "formal-sample-list",
      id: "list",
    });
  });

  afterEach(cleanup);

  it("keeps legacy embedded ledger coverage without exposing a second entry", async () => {
    const point = formalPoint({
      id: sample.samplePointId,
      canonicalName: "龙沙区兴农农资店",
      objectTypeCode: "AGRICULTURAL_INPUT_STORE",
      objectTypeName: "农资店",
    });
    const api = {
      ...repository(),
      listEligibleFormalSamples: vi.fn().mockResolvedValue([
        {
          ...sample,
          sampleName: point.canonicalName,
          objectTypeCode: point.objectTypeCode,
          objectTypeName: point.objectTypeName,
          latestObservationId: "",
          latestObservedAt: "",
          latestValues: {},
        },
      ]),
      loadMasterData: vi.fn().mockResolvedValue({
        regions: [{ code: "230202", name: "龙沙区", level: "COUNTY" }],
      }),
      listFormalSamplePoints: vi.fn().mockResolvedValue({
        items: [point],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 1,
        totalPages: 1,
      }),
      getFormalSamplePoint: vi.fn().mockResolvedValue(point),
      createFormalSamplePoint: vi.fn(),
      updateFormalSamplePoint: vi.fn(),
      deleteFormalSamplePoint: vi.fn(),
      subscribeBusinessEvents: vi.fn(() => vi.fn()),
    };

    renderPanel(
      api,
      vi.fn(),
      ["BUSINESS_CREATE", "FORMAL_SAMPLE_MANAGE", "FORMAL_SAMPLE_DELETE"],
      "POINTS",
    );

    expect(screen.queryByText("原有采集台账内容")).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "维护样本与期间数据" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "采集台账" }),
    ).toBeVisible();
    const row = await screen.findByRole("row", {
      name: /龙沙区兴农农资店/u,
    });
    expect(row).toHaveTextContent("农资店");
    expect(within(row).getByRole("button", { name: "查看" })).toBeVisible();
    expect(within(row).getByRole("button", { name: "编辑" })).toBeVisible();
    expect(within(row).getByRole("button", { name: "彻底删除" })).toBeVisible();
    expect(
      within(row).getByRole("button", { name: "淘汰为历史" }),
    ).toBeVisible();
    expect(
      within(row).getByRole("button", { name: "填写采集数据" }),
    ).toBeVisible();
  });

  it("queries the collection ledger with the mature authoritative filter set", async () => {
    const api = {
      ...repository(),
      loadMasterData: vi.fn().mockResolvedValue({
        regions: [{ code: "230202", name: "龙沙区", level: "COUNTY" }],
      }),
    };
    renderPanel(api);

    await screen.findByRole("option", { name: "深加工企业" });
    const ledger = screen.getByRole("table");
    for (const heading of [
      "样本名称",
      "地区",
      "业务类别",
      "品种",
      "对象类型",
      "维护人",
      "填报状态",
      "更新时间",
      "操作",
    ]) {
      expect(
        within(ledger).getByRole("columnheader", { name: heading }),
      ).toBeVisible();
    }
    expect(
      within(ledger).queryByRole("columnheader", {
        name: "采购基础价（元/吨）",
      }),
    ).not.toBeInTheDocument();
    const observedAt = screen.getByLabelText("采集台账观测时间");
    await userEvent.clear(observedAt);
    await userEvent.type(observedAt, "2026-09-02T08:30");
    await userEvent.selectOptions(
      screen.getByLabelText("采集台账对象类型"),
      "DEEP_PROCESSOR",
    );
    await userEvent.selectOptions(
      screen.getByLabelText("采集台账业务地区"),
      "230202",
    );
    await userEvent.type(screen.getByLabelText("采集台账样本名称"), "中粮生化");
    await userEvent.click(screen.getByRole("button", { name: "查询" }));

    await waitFor(() =>
      expect(api.listEligibleFormalSamples).toHaveBeenLastCalledWith({
        domain: "MARKET",
        productCode: "CORN",
        objectTypeCode: "DEEP_PROCESSOR",
        regionCode: "230202",
        keyword: "中粮生化",
        year: 2026,
        observedAt: new Date("2026-09-02T08:30").toISOString(),
      }),
    );
    expect(
      await within(ledger).findByRole("columnheader", {
        name: "采购基础价（元/吨）",
      }),
    ).toBeVisible();
    expect(within(ledger).getByText("2097.0000")).toBeVisible();
  });

  it("fails closed for mutation controls when the account has read-only permissions", async () => {
    renderPanel(repository(), vi.fn(), []);

    const row = await screen.findByRole("row", {
      name: /中粮生化能源/u,
    });
    expect(screen.queryByRole("button", { name: "新增样本" })).toBeNull();
    expect(within(row).queryByRole("button", { name: "编辑" })).toBeNull();
    expect(within(row).queryByRole("button", { name: "删除" })).toBeNull();
    expect(
      within(row).getByRole("button", { name: "无采集权限" }),
    ).toBeDisabled();
  });

  it("requires an employee-directory maintainer for creation and assigns a historical unowned sample with a reason", async () => {
    const unassigned = formalPoint({
      maintainerSubjectId: null,
      maintainerDisplayName: null,
      version: 4,
    });
    const assigned = formalPoint({ version: 5 });
    const assignFormalSampleMaintainer = vi.fn().mockResolvedValue({
      id: assigned.id,
      kindCode: assigned.kindCode,
      canonicalName: assigned.canonicalName,
      regionCode: assigned.regionCode,
      maintainerSubjectId: maintainer.subjectId,
      maintainerDisplayName: maintainer.displayName,
      version: assigned.version,
    });
    const api = {
      ...repository(),
      listEligibleFormalSamples: vi
        .fn()
        .mockResolvedValue([eligibleSampleFor(unassigned)]),
      getFormalSamplePoint: vi
        .fn()
        .mockResolvedValueOnce(unassigned)
        .mockResolvedValueOnce(assigned),
      assignFormalSampleMaintainer,
    };
    renderPanel(api);

    const row = await screen.findByRole("row", {
      name: new RegExp(unassigned.canonicalName, "u"),
    });
    expect(row).toHaveTextContent("未指定维护人");
    expect(
      within(row).getByRole("button", { name: "填写采集数据" }),
    ).toBeEnabled();
    await userEvent.click(within(row).getByRole("button", { name: "查看" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "指定维护人" }),
    );
    await userEvent.selectOptions(
      screen.getByLabelText("指派维护人"),
      maintainer.subjectId,
    );
    await userEvent.type(
      screen.getByLabelText("维护人变更原因"),
      "明确后续期间数据维护责任",
    );
    await userEvent.click(screen.getByRole("button", { name: "保存维护人" }));

    await waitFor(() =>
      expect(assignFormalSampleMaintainer).toHaveBeenCalledWith(unassigned.id, {
        maintainerSubjectId: maintainer.subjectId,
        maintainerChangeReason: "明确后续期间数据维护责任",
        expectedVersion: 4,
      }),
    );
    expect(api.getFormalSamplePoint).toHaveBeenLastCalledWith(unassigned.id);
    expect(screen.getByRole("status")).toHaveTextContent(
      "维护人已更新并重新查询",
    );
    expect(
      screen.getByRole("region", { name: "正式样本详情" }),
    ).toHaveTextContent(maintainer.displayName);
  });

  it.each([
    ["ACCESS_PERMISSION_DENIED", 403, "当前账号没有指派正式样本维护人的权限"],
    [
      "INVALID_FORMAL_SAMPLE_MAINTAINER",
      400,
      "所选人员无效、未在岗或没有该地区的填报权限",
    ],
    ["FORMAL_SAMPLE_POINT_NOT_FOUND", 404, "正式样本不存在或已被删除"],
    [
      "FORMAL_SAMPLE_POINT_VERSION_CONFLICT",
      409,
      "正式样本已被其他人更新，请按最新版本重新指派",
    ],
  ])(
    "shows a clear maintainer assignment error for %s",
    async (code, status, message) => {
      const point = formalPoint({
        maintainerSubjectId: null,
        maintainerDisplayName: null,
        version: 4,
      });
      const api = {
        ...repository(),
        listEligibleFormalSamples: vi
          .fn()
          .mockResolvedValue([eligibleSampleFor(point)]),
        getFormalSamplePoint: vi.fn().mockResolvedValue(point),
        assignFormalSampleMaintainer: vi.fn().mockRejectedValue(
          new RealtimeApiError({
            code,
            message: "server message",
            status,
          }),
        ),
      };
      renderPanel(api);
      await userEvent.click(
        await screen.findByRole("button", { name: "查看" }),
      );
      await userEvent.click(
        await screen.findByRole("button", { name: "指定维护人" }),
      );
      await userEvent.selectOptions(
        screen.getByLabelText("指派维护人"),
        maintainer.subjectId,
      );
      await userEvent.type(screen.getByLabelText("维护人变更原因"), "工作调整");
      await userEvent.click(screen.getByRole("button", { name: "保存维护人" }));

      expect(await screen.findByRole("status")).toHaveTextContent(message);
    },
  );

  it("focuses the authoritative detail region after a row view action", async () => {
    renderPanel();
    await userEvent.click(await screen.findByRole("button", { name: "查看" }));

    expect(
      await screen.findByRole("region", { name: "正式样本详情" }),
    ).toHaveFocus();
  });

  it("focuses the stable-information editor after a row edit action", async () => {
    renderPanel();
    await userEvent.click(await screen.findByRole("button", { name: "编辑" }));

    expect(
      await screen.findByRole("region", { name: "正式样本稳定信息" }),
    ).toHaveFocus();
  });

  it.each([
    { networkMembershipCount: 2, annualObservationCount: 0 },
    { networkMembershipCount: 0, annualObservationCount: 3 },
  ])(
    "allows an authorized hard delete when the sample has business or network references",
    async (counts) => {
      const point = {
        ...formalPoint(),
        ...counts,
      };
      const deleteFormalSamplePoint = vi.fn();
      const api = {
        ...repository(),
        listEligibleFormalSamples: vi
          .fn()
          .mockResolvedValue([eligibleSampleFor(point)]),
        listFormalSamplePoints: vi.fn().mockResolvedValue({
          items: [point],
          pageNumber: 0,
          pageSize: 20,
          totalElements: 1,
          totalPages: 1,
        }),
        getFormalSamplePoint: vi.fn().mockResolvedValue(point),
        deleteFormalSamplePoint,
      };

      renderPanel(api);
      const row = await screen.findByRole("row", {
        name: new RegExp(point.canonicalName, "u"),
      });
      await userEvent.click(
        within(row).getByRole("button", { name: "彻底删除" }),
      );
      await userEvent.click(screen.getByRole("button", { name: "确认删除" }));

      await waitFor(() =>
        expect(deleteFormalSamplePoint).toHaveBeenCalledWith(
          point.id,
          point.version,
        ),
      );
    },
  );

  it("creates and edits the same stable fields with an authoritative GET after each write", async () => {
    const created = formalPoint();
    const updated = formalPoint({
      canonicalName: "建华区重点贸易商样本",
      regionCode: "230203",
      address: "建华区新立街 2 号",
      longitude: 123.97,
      latitude: 47.36,
      version: 1,
    });
    const listEligibleFormalSamples = vi
      .fn()
      .mockResolvedValue([eligibleSampleFor(created)]);
    const getFormalSamplePoint = vi
      .fn()
      .mockResolvedValueOnce(created)
      .mockResolvedValueOnce(updated);
    const createFormalSamplePoint = vi.fn().mockResolvedValue(created);
    const updateFormalSamplePoint = vi.fn().mockResolvedValue(updated);
    const api = {
      ...repository(),
      loadMasterData: vi.fn().mockResolvedValue({
        regions: [
          { code: "230202", name: "龙沙区", level: "COUNTY" },
          { code: "230203", name: "建华区", level: "COUNTY" },
        ],
      }),
      listEligibleFormalSamples,
      getFormalSamplePoint,
      createFormalSamplePoint,
      updateFormalSamplePoint,
      deleteFormalSamplePoint: vi.fn(),
      subscribeBusinessEvents: vi.fn(() => vi.fn()),
    };
    const onSaved = vi.fn();
    renderPanel(api, onSaved);

    await userEvent.click(
      await screen.findByRole("button", { name: "新增样本" }),
    );
    await userEvent.type(
      screen.getByLabelText("正式样本名称"),
      created.canonicalName,
    );
    await userEvent.selectOptions(
      screen.getByLabelText("正式样本地区"),
      "230202",
    );
    await userEvent.type(
      screen.getByLabelText("正式样本详细地址"),
      created.address,
    );
    await userEvent.type(
      screen.getByLabelText("正式样本经度"),
      String(created.longitude),
    );
    await userEvent.type(
      screen.getByLabelText("正式样本纬度"),
      String(created.latitude),
    );
    await userEvent.selectOptions(
      screen.getByLabelText("正式样本对象分类"),
      created.objectTypeCode,
    );
    await userEvent.selectOptions(
      screen.getByLabelText("正式样本维护人"),
      maintainer.subjectId,
    );
    await userEvent.click(screen.getByRole("button", { name: "保存正式样本" }));

    await waitFor(() =>
      expect(createFormalSamplePoint).toHaveBeenCalledWith({
        canonicalName: created.canonicalName,
        regionCode: created.regionCode,
        address: created.address,
        longitude: 123.94,
        latitude: 47.31,
        objectTypeCode: created.objectTypeCode,
        maintainerSubjectId: maintainer.subjectId,
      }),
    );
    expect(getFormalSamplePoint).toHaveBeenLastCalledWith(created.id);
    expect(listEligibleFormalSamples).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("region", { name: "正式样本详情" }),
    ).toHaveTextContent("龙沙区新立街 1 号");
    expect(
      screen.getByRole("region", { name: "正式样本详情" }),
    ).toHaveTextContent("版本 0");

    await userEvent.click(screen.getByRole("button", { name: "编辑稳定信息" }));
    const name = screen.getByLabelText("正式样本名称");
    const address = screen.getByLabelText("正式样本详细地址");
    const longitude = screen.getByLabelText("正式样本经度");
    const latitude = screen.getByLabelText("正式样本纬度");
    await userEvent.clear(name);
    await userEvent.type(name, updated.canonicalName);
    await userEvent.selectOptions(
      screen.getByLabelText("正式样本地区"),
      updated.regionCode,
    );
    await userEvent.clear(address);
    await userEvent.type(address, updated.address);
    await userEvent.clear(longitude);
    await userEvent.type(longitude, String(updated.longitude));
    await userEvent.clear(latitude);
    await userEvent.type(latitude, String(updated.latitude));
    await userEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() =>
      expect(updateFormalSamplePoint).toHaveBeenCalledWith(
        created.id,
        {
          canonicalName: updated.canonicalName,
          regionCode: updated.regionCode,
          address: updated.address,
          longitude: updated.longitude,
          latitude: updated.latitude,
          objectTypeCode: updated.objectTypeCode,
          maintainerSubjectId: maintainer.subjectId,
        },
        0,
      ),
    );
    expect(getFormalSamplePoint).toHaveBeenLastCalledWith(updated.id);
    expect(listEligibleFormalSamples).toHaveBeenCalledTimes(3);
    expect(
      screen.queryByDisplayValue(created.canonicalName),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "正式样本详情" }),
    ).toHaveTextContent(updated.address);
    expect(screen.getByRole("status")).toHaveTextContent(
      "正式样本稳定信息已更新并重新查询",
    );
  });

  it("requeries after a stale edit and removes the obsolete draft", async () => {
    const point = formalPoint({ version: 4 });
    const refreshed = formalPoint({
      canonicalName: "其他人更新后的样本",
      address: "最新权威地址",
      version: 5,
    });
    const listEligibleFormalSamples = vi
      .fn()
      .mockResolvedValue([eligibleSampleFor(refreshed)]);
    const getFormalSamplePoint = vi
      .fn()
      .mockResolvedValueOnce(point)
      .mockResolvedValueOnce(refreshed);
    const updateFormalSamplePoint = vi.fn().mockRejectedValue(
      new RealtimeApiError({
        code: "FORMAL_SAMPLE_POINT_VERSION_CONFLICT",
        message: "正式样本已发生变化，请刷新后重试",
        status: 409,
      }),
    );
    const api = {
      ...repository(),
      loadMasterData: vi.fn().mockResolvedValue({
        regions: [{ code: "230202", name: "龙沙区", level: "COUNTY" }],
      }),
      listEligibleFormalSamples,
      getFormalSamplePoint,
      createFormalSamplePoint: vi.fn(),
      updateFormalSamplePoint,
      deleteFormalSamplePoint: vi.fn(),
      subscribeBusinessEvents: vi.fn(() => vi.fn()),
    };
    renderPanel(api);

    await userEvent.click(await screen.findByRole("button", { name: "查看" }));
    await userEvent.click(screen.getByRole("button", { name: "编辑稳定信息" }));
    const name = screen.getByLabelText("正式样本名称");
    await userEvent.clear(name);
    await userEvent.type(name, "将被丢弃的旧草稿");
    await userEvent.click(screen.getByRole("button", { name: "保存修改" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "正式样本已被其他人更新，请根据最新内容重新修改",
    );
    expect(updateFormalSamplePoint).toHaveBeenCalledWith(
      point.id,
      expect.any(Object),
      4,
    );
    expect(listEligibleFormalSamples).toHaveBeenCalledTimes(2);
    expect(getFormalSamplePoint).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByDisplayValue("将被丢弃的旧草稿"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "正式样本详情" }),
    ).toHaveTextContent("最新权威地址");
  });

  it.each([
    ["ACCESS_PERMISSION_DENIED", 403, "当前账号没有新增或修改正式样本的权限"],
    ["ACCESS_REGION_DENIED", 403, "所选地区不在当前账号的授权范围内"],
    ["COORDINATE_OUTSIDE_REGION", 400, "正式样本坐标不在所选行政区范围内"],
    ["SAMPLE_POINT_COORDINATE_OCCUPIED", 409, "该坐标已被其他样本占用"],
    ["ADMIN_BOUNDARY_UNAVAILABLE", 503, "所选行政区边界数据暂不可用"],
  ])(
    "shows a clear master-data write error for %s",
    async (code, status, message) => {
      const createFormalSamplePoint = vi
        .fn()
        .mockRejectedValue(
          new RealtimeApiError({ code, message: "server message", status }),
        );
      const api = {
        ...repository(),
        loadMasterData: vi.fn().mockResolvedValue({
          regions: [{ code: "230202", name: "龙沙区", level: "COUNTY" }],
        }),
        listFormalSamplePoints: vi.fn().mockResolvedValue({
          items: [],
          pageNumber: 0,
          pageSize: 20,
          totalElements: 0,
          totalPages: 0,
        }),
        getFormalSamplePoint: vi.fn(),
        createFormalSamplePoint,
        updateFormalSamplePoint: vi.fn(),
        deleteFormalSamplePoint: vi.fn(),
        subscribeBusinessEvents: vi.fn(() => vi.fn()),
      };
      renderPanel(api);

      await userEvent.click(
        await screen.findByRole("button", { name: "新增样本" }),
      );
      await userEvent.type(
        screen.getByLabelText("正式样本名称"),
        "错误处理样本",
      );
      await userEvent.selectOptions(
        screen.getByLabelText("正式样本地区"),
        "230202",
      );
      await userEvent.type(
        screen.getByLabelText("正式样本详细地址"),
        "龙沙区测试地址",
      );
      await userEvent.type(screen.getByLabelText("正式样本经度"), "123.94");
      await userEvent.type(screen.getByLabelText("正式样本纬度"), "47.31");
      await userEvent.selectOptions(
        screen.getByLabelText("正式样本对象分类"),
        "TRADER",
      );
      await userEvent.selectOptions(
        screen.getByLabelText("正式样本维护人"),
        maintainer.subjectId,
      );
      await userEvent.click(
        screen.getByRole("button", { name: "保存正式样本" }),
      );

      expect(await screen.findByRole("status")).toHaveTextContent(message);
    },
  );

  it("rejects missing coordinates before calling the formal sample create API", async () => {
    const createFormalSamplePoint = vi.fn();
    const api = {
      ...repository(),
      loadMasterData: vi.fn().mockResolvedValue({
        regions: [{ code: "230202", name: "龙沙区", level: "COUNTY" }],
      }),
      listFormalSamplePoints: vi.fn().mockResolvedValue({
        items: [],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 0,
        totalPages: 0,
      }),
      getFormalSamplePoint: vi.fn(),
      createFormalSamplePoint,
      updateFormalSamplePoint: vi.fn(),
      deleteFormalSamplePoint: vi.fn(),
      subscribeBusinessEvents: vi.fn(() => vi.fn()),
    };
    renderPanel(api);

    await userEvent.click(
      await screen.findByRole("button", { name: "新增样本" }),
    );
    await userEvent.type(screen.getByLabelText("正式样本名称"), "待校验样本");
    await userEvent.selectOptions(
      screen.getByLabelText("正式样本地区"),
      "230202",
    );
    await userEvent.type(
      screen.getByLabelText("正式样本详细地址"),
      "龙沙区测试地址",
    );
    await userEvent.selectOptions(
      screen.getByLabelText("正式样本对象分类"),
      "TRADER",
    );
    await userEvent.selectOptions(
      screen.getByLabelText("正式样本维护人"),
      maintainer.subjectId,
    );
    await userEvent.click(screen.getByRole("button", { name: "保存正式样本" }));

    expect(createFormalSamplePoint).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "请完整填写正确的正式样本稳定信息",
    );
  });

  it("queries eligible formal samples, loads authoritative detail, and requeries after versioned deletion", async () => {
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
    const listEligibleFormalSamples = vi
      .fn()
      .mockResolvedValueOnce([eligibleSampleFor(point)])
      .mockResolvedValueOnce([]);
    const getFormalSamplePoint = vi.fn().mockResolvedValue(point);
    const deleteFormalSamplePoint = vi.fn().mockResolvedValue(undefined);
    const api = {
      ...repository(),
      loadMasterData: vi.fn().mockResolvedValue({
        regions: [{ code: "230202", name: "龙沙区", level: "COUNTY" }],
      }),
      listEligibleFormalSamples,
      getFormalSamplePoint,
      deleteFormalSamplePoint,
      subscribeBusinessEvents: vi.fn(() => vi.fn()),
    };
    const onSaved = vi.fn();
    renderPanel(api, onSaved);

    expect(await screen.findByText("龙沙区正式样本")).toBeVisible();
    expect(screen.getAllByText("龙沙区").length).toBeGreaterThan(0);
    expect(screen.queryByText("230202")).not.toBeInTheDocument();
    expect(listEligibleFormalSamples).toHaveBeenLastCalledWith(
      expect.objectContaining({
        domain: "MARKET",
        productCode: "CORN",
        regionCode: undefined,
        keyword: undefined,
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "查看" }));
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
      expect(listEligibleFormalSamples).toHaveBeenCalledTimes(2),
    );
    expect(screen.queryByText("龙沙区正式样本")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "正式样本详情" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "正式样本已删除，列表已重新查询",
    );
  });

  it("retires an existing market sample from the ledger without using physical deletion", async () => {
    const onSaved = vi.fn();
    const point = formalPoint({ version: 4 });
    const listEligibleFormalSamples = vi
      .fn()
      .mockResolvedValueOnce([eligibleSampleFor(point)])
      .mockResolvedValueOnce([]);
    const retireFormalSamplePoint = vi.fn().mockResolvedValue(undefined);
    const deleteFormalSamplePoint = vi.fn();
    const api = {
      ...repository(),
      listEligibleFormalSamples,
      getFormalSamplePoint: vi.fn().mockResolvedValue(point),
      retireFormalSamplePoint,
      deleteFormalSamplePoint,
      subscribeBusinessEvents: vi.fn(() => vi.fn()),
    };
    renderPanel(api, onSaved);

    const row = await screen.findByRole("row", { name: /龙沙区贸易商样本/u });
    await userEvent.click(
      within(row).getByRole("button", { name: "淘汰为历史" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "确认淘汰该样本点" }),
    );

    await waitFor(() =>
      expect(retireFormalSamplePoint).toHaveBeenCalledWith(
        point.id,
        4,
        "现有样本点不再使用，由维护人在业务台账执行淘汰",
      ),
    );
    expect(deleteFormalSamplePoint).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(point.canonicalName)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "正式样本已淘汰为历史样本，列表已重新查询",
    );
  });

  it("refreshes the eligible sample list and selected detail after an outbox event", async () => {
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
    const listEligibleFormalSamples = vi
      .fn()
      .mockResolvedValue([eligibleSampleFor(point)]);
    const getFormalSamplePoint = vi.fn().mockResolvedValue(point);
    const api = {
      ...repository(),
      listEligibleFormalSamples,
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
    await userEvent.click(await screen.findByRole("button", { name: "查看" }));
    await waitFor(() => expect(getFormalSamplePoint).toHaveBeenCalledTimes(1));
    const queryButton = screen.getByRole("button", { name: "查询" });
    queryButton.focus();
    expect(queryButton).toHaveFocus();

    act(() => {
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
    });

    await waitFor(() =>
      expect(listEligibleFormalSamples).toHaveBeenCalledTimes(2),
    );
    await waitFor(() => expect(getFormalSamplePoint).toHaveBeenCalledTimes(2));
    expect(queryButton).toHaveFocus();
    expect(api.subscribeBusinessEvents).toHaveBeenCalledTimes(1);
  });

  it("preserves an active edit when an outbox event belongs to another sample", async () => {
    const point = formalPoint({ canonicalName: "龙沙区当前编辑样本" });
    let onChange: (event: BusinessNotificationRow) => void = () => undefined;
    const listEligibleFormalSamples = vi
      .fn()
      .mockResolvedValue([eligibleSampleFor(point)]);
    const api = {
      ...repository(),
      listEligibleFormalSamples,
      getFormalSamplePoint: vi.fn().mockResolvedValue(point),
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
    await userEvent.click(await screen.findByRole("button", { name: "编辑" }));
    const name = await screen.findByLabelText("正式样本名称");
    await userEvent.clear(name);
    await userEvent.type(name, "尚未保存的名称");

    act(() => {
      onChange({
        id: "event-other-sample",
        sequence: 10,
        aggregateType: "FORMAL_SAMPLE_POINT",
        aggregateId: "another-formal-point",
        actionCode: "FORMAL_SAMPLE_POINT_UPDATED",
        productCode: null,
        regionCodes: ["230202"],
        occurredAt: "2026-09-01T08:00:00Z",
        read: false,
      });
    });

    await waitFor(() =>
      expect(listEligibleFormalSamples).toHaveBeenCalledTimes(2),
    );
    expect(name).toHaveValue("尚未保存的名称");
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
    const listEligibleFormalSamples = vi
      .fn()
      .mockResolvedValue([eligibleSampleFor(point)]);
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
      listEligibleFormalSamples,
      getFormalSamplePoint: vi
        .fn()
        .mockResolvedValueOnce(point)
        .mockResolvedValueOnce(refreshedPoint),
      deleteFormalSamplePoint,
      subscribeBusinessEvents: vi.fn(() => vi.fn()),
    };
    renderPanel(api);
    await userEvent.click(await screen.findByRole("button", { name: "查看" }));
    await userEvent.click(screen.getByRole("button", { name: "删除正式样本" }));
    await userEvent.click(screen.getByRole("button", { name: "确认删除" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "正式样本已被其他人更新，请刷新后再删除",
    );
    expect(listEligibleFormalSamples).toHaveBeenCalledTimes(2);
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
    api.listFormalSamplePoints.mockResolvedValue({
      items: [
        formalPoint({
          id: agriculturalSample.samplePointId,
          canonicalName: agriculturalSample.sampleName,
          objectTypeCode: agriculturalSample.objectTypeCode ?? "",
          objectTypeName: agriculturalSample.objectTypeName ?? "",
        }),
      ],
      pageNumber: 0,
      pageSize: 20,
      totalElements: 1,
      totalPages: 1,
    });
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

    await openCollectionData();
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

  it.each([
    [
      "FORMAL_SAMPLE_MAINTAINER_REQUIRED",
      "该正式样本尚未指定维护人，请先由管理员指定后再填写期间数据",
    ],
    [
      "FORMAL_SAMPLE_MAINTAINER_DENIED",
      "当前账号不是该正式样本的维护人，不能填写期间数据",
    ],
  ])("shows the maintainer write boundary for %s", async (code, message) => {
    const api = repository();
    api.saveFormalSampleObservation.mockRejectedValue(
      new RealtimeApiError({ code, message: "server message", status: 403 }),
    );
    renderPanel(api);
    await openCollectionData();
    await userEvent.click(
      await screen.findByRole("button", {
        name: new RegExp(sample.sampleName, "u"),
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "保存并正式入库" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(message);
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
    await openCollectionData();
    await userEvent.click(
      await screen.findByRole("button", { name: /中粮生化能源/u }),
    );
    expect(await screen.findByLabelText("采购基础价（元/吨）")).toHaveValue(
      2097,
    );

    const callsBeforeUnscopedEvent =
      api.listEligibleFormalSamples.mock.calls.length;
    act(() => {
      onChange({
        id: "event-observation-unscoped",
        sequence: 9,
        aggregateType: "FORMAL_SAMPLE_OBSERVATION",
        aggregateId: "record-other",
        actionCode: "FORMAL_SAMPLE_OBSERVATION_SAVED",
        productCode: null,
        regionCodes: ["230221"],
        occurredAt: "2026-09-01T07:59:00Z",
        read: false,
      });
    });
    await Promise.resolve();
    expect(api.listEligibleFormalSamples).toHaveBeenCalledTimes(
      callsBeforeUnscopedEvent,
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
    expect(withEvents.subscribeBusinessEvents).toHaveBeenCalledTimes(2);
  });

  it("returns from period-data editing to the existing business list", async () => {
    const { api } = renderPanel();
    expect(
      await screen.findByRole("heading", { name: "采集台账" }),
    ).toBeVisible();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    await openCollectionData();
    expect(
      screen.getByRole("region", { name: "已有正式样本查询" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "填写或更新采集数据" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "本次正式观测" })).toBeVisible();
    await waitFor(() =>
      expect(api.listFormalSampleObservationHistory).toHaveBeenCalled(),
    );
    await userEvent.selectOptions(
      screen.getByLabelText("筛选对象类型"),
      "DEEP_PROCESSOR",
    );
    await userEvent.type(screen.getByLabelText("搜索样本企业"), "旧筛选");
    await userEvent.click(screen.getByRole("button", { name: "返回业务列表" }));
    expect(screen.getByText("原有采集台账内容")).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "采集台账" }),
    ).not.toBeInTheDocument();
  });

  it("never lets a late response restore samples from an obsolete filter scope", async () => {
    const api = repository();
    let resolveOld: (items: readonly EligibleFormalSample[]) => void = () =>
      undefined;
    api.listEligibleFormalSamples
      .mockResolvedValueOnce([sample])
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValueOnce([]);
    renderPanel(api);
    await openCollectionData();
    await waitFor(() =>
      expect(api.listEligibleFormalSamples).toHaveBeenCalledTimes(2),
    );
    await screen.findByRole("option", { name: "深加工企业" });
    await userEvent.selectOptions(
      screen.getByLabelText("筛选对象类型"),
      "DEEP_PROCESSOR",
    );
    await userEvent.click(screen.getByRole("button", { name: "查询正式样本" }));
    await waitFor(() =>
      expect(api.listEligibleFormalSamples).toHaveBeenCalledTimes(3),
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
    await openCollectionData();
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
    expect(
      screen.getByRole("combobox", { name: "样本业务地区" }),
    ).toBeEnabled();
    expect(screen.getByRole("spinbutton", { name: "经度" })).toBeEnabled();
    expect(screen.getByRole("spinbutton", { name: "纬度" })).toBeEnabled();
    const identity = await screen.findByRole("group", {
      name: "正式样本锁定信息",
    });
    const page = screen.getByRole("region", { name: "采集数据填写工作台" });
    const filters = screen.getByRole("region", { name: "已有正式样本查询" });
    expect(
      identity.compareDocumentPosition(filters) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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
    expect(within(page).getByRole("button", { name: "取消" })).toBeVisible();
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
    await openCollectionData();
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
    await openCollectionData();
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
    await openCollectionData();
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
      /已正式入库.*总揽.*市场分析/u,
    );
    expect(screen.getByRole("status")).not.toHaveTextContent("报表");
  });

  it("renders the v5 agricultural tech station fields when yield inputs are optional", async () => {
    const productionSample: EligibleFormalSample = {
      ...sample,
      domain: "PRODUCTION",
      objectTypeCode: "AGRICULTURAL_TECH_STATION",
      objectTypeName: "农业技术推广站",
      latestValues: {
        cultivatedAreaMu: "177.7000",
        yieldPerMuKilograms: "650.0000",
      },
    };
    const api = {
      ...repository(),
      listObjectTypes: vi.fn().mockResolvedValue([
        {
          code: "AGRICULTURAL_TECH_STATION",
          name: "农业技术推广站",
          domain: "PRODUCTION",
        },
      ]),
      listEligibleFormalSamples: vi.fn().mockResolvedValue([productionSample]),
      loadProductionDefinition: vi.fn().mockImplementation(() =>
        Promise.resolve(
          parseProductionDefinition(productionAgriculturalTechDefinition(), {
            productCode: "CORN",
            objectTypeCode: "AGRICULTURAL_TECH_STATION",
          }),
        ),
      ),
    };
    const { container } = render(
      <ExistingSampleObservationPanel
        domain="PRODUCTION"
        permissions={["BUSINESS_CREATE"]}
        productCode="CORN"
        repository={api as unknown as RealtimeBusinessRepository}
        selection={{ type: "formal-sample-observation", id: "sample-1" }}
        onSelectionChange={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        container.querySelectorAll("[data-field-code]").length,
      ).toBeGreaterThan(0),
    );
    expect(
      screen.queryByText(
        "产情字段契约与当前页面版本不一致，请刷新页面或联系管理员",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("播种面积（亩）")).toHaveValue(177.7);
  });

  it("uses a shared enterprise drawer without changing the mature ledger grid", () => {
    const panelSource = readFileSync(
      "src/business/formal-sample/ExistingSampleObservationPanel.tsx",
      "utf8",
    );
    const ledgerSource = readFileSync(
      "src/business/formal-sample/FormalSamplePointLedger.tsx",
      "utf8",
    );
    const css = readFileSync("src/business/market-monitoring.css", "utf8");
    const shellCss = readFileSync("src/business/formal-enterprise.css", "utf8");
    expect(panelSource).not.toContain("existing-observation__drawer");
    expect(panelSource).not.toContain('role="dialog"');
    expect(panelSource).not.toContain("LedgerDrawer");
    expect(ledgerSource).not.toContain("formal-sample-ledger__layout--detail");
    expect(ledgerSource).not.toContain("formal-sample-ledger__editor");
    expect(css).toMatch(/\.existing-observation__page\s*\{[^}]*width:\s*100%/u);
    const unifiedCss = readFileSync(
      "src/business/unified-workspaces.css",
      "utf8",
    );
    expect(unifiedCss).toMatch(
      /\.enterprise-ledger-query--design[\s\S]*:is\(input, select, \.region-cascader > summary\)[^{]*\{[^}]*height:\s*36px/u,
    );
    expect(css).toMatch(
      /\.formal-sample-ledger__layout\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u,
    );
    expect(css).toMatch(
      /\.enterprise-ledger-drawer\s*\{[^}]*width:\s*min\(540px,\s*calc\(100vw\s*-\s*24px\)\)/u,
    );
    expect(css).toMatch(
      /\.formal-sample-ledger\.enterprise-ledger-workbench\.formal-sample-ledger--overlay-only\s*\{[^}]*background:\s*rgba\(8,\s*29,\s*45,\s*0\.28\)/u,
    );
    expect(css).toMatch(
      /\.formal-sample-ledger__row-actions\s*\{[^}]*flex-wrap:\s*nowrap[^}]*white-space:\s*nowrap/u,
    );
    expect(css).toMatch(
      /\.formal-sample-ledger__filters\s*\{[^}]*grid-template-columns:[^;]*minmax\([^;]+\)[^;]*minmax\([^;]+\)[^;]*minmax\([^;]+\)[^;]*minmax\([^;]+\)\s+auto/u,
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

function productionField(
  code: string,
  sortOrder: number,
  overrides: Partial<{
    label: string;
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
    label: code,
    groupCode: "CONTEXT",
    groupLabel: "基础信息",
    groupOrder: 10,
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

function productionAgriculturalTechDefinition() {
  return {
    productCode: "CORN",
    objectTypeCode: "AGRICULTURAL_TECH_STATION",
    contractVersion: "production-survey-fields-v5",
    contractDigest:
      "sha256:b18e705dbf3da916aeb03df93d7e2ab4ea54c0ef23786de8bbe204a3cdca2031",
    fields: [
      productionField("objectTypeCode", 10, {
        controlType: "SELECT",
        required: true,
      }),
      productionField("regionCode", 20, {
        controlType: "REGION",
        required: true,
      }),
      productionField("surveyYear", 30, {
        controlType: "SELECT",
        required: true,
      }),
      productionField("surveyMonth", 40, { controlType: "SELECT" }),
      productionField("PROD_SAMPLE_NAME", 50),
      productionField("PROD_REPORTER_NAME", 60, {
        controlType: "READONLY_TEXT",
        required: true,
        readOnly: true,
        importable: false,
      }),
      ...["PROD_SURVEYOR_NAME", "PROD_SURVEYOR_PHONE"].map((code, index) =>
        productionField(code, 70 + index * 10),
      ),
      productionField("PROD_SAMPLE_CONTACT", 90, {
        required: true,
      }),
      ...["PROD_SAMPLE_LATITUDE", "PROD_SAMPLE_LONGITUDE"].map((code, index) =>
        productionField(code, 100 + index * 10, {
          valueType: "DECIMAL",
          controlType: "DECIMAL",
          required: true,
        }),
      ),
      productionField("cultivatedAreaMu", 120, {
        label: "播种面积",
        valueType: "DECIMAL",
        controlType: "DECIMAL",
        unit: "亩",
      }),
      productionField("yieldPerMuKilograms", 130, {
        valueType: "DECIMAL",
        controlType: "DECIMAL",
      }),
      productionField("estimatedOutputKilograms", 140, {
        valueType: "DECIMAL",
        controlType: "READONLY_DECIMAL",
        readOnly: true,
        calculated: true,
        importable: false,
      }),
      productionField("yearOnYear", 150, {
        controlType: "READONLY_TEXT",
        readOnly: true,
        calculated: true,
        importable: false,
      }),
    ],
    groups: [],
  };
}
