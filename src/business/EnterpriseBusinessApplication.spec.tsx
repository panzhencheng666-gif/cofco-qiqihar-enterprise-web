import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EnterpriseBusinessApplication as RuntimeEnterpriseBusinessApplication,
  loadAllWorkItems,
  type EnterpriseBusinessApplicationProps,
} from "./EnterpriseBusinessApplication";
import type { OperationalScopeIdentity } from "./core/operationalScope";
import { fixtureOperationalIdentity } from "./formalEnterpriseData";
import {
  createDefaultFixtureOperationalState,
  fixtureOperationalStateStorageKey,
  saveFixtureOperationalState,
} from "./fixtureOperationalState";
import type {
  BusinessNotificationRow,
  ProductionDefinition,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";
import {
  PRODUCTION_SURVEY_CONTRACT_DIGEST,
  PRODUCTION_SURVEY_CONTRACT_VERSION,
} from "@/platform/api/productionSurveyContract";
import { createFixtureBusinessReportSeeds } from "./businessReportWorkflow";

const fixtureBusinessReportStorageKey =
  "齐齐哈尔粮食商情业务报告工作流-业务真值三";

function EnterpriseBusinessApplication(
  props: EnterpriseBusinessApplicationProps,
) {
  return (
    <RuntimeEnterpriseBusinessApplication
      {...props}
      dataMode={props.dataMode ?? "fixtures"}
    />
  );
}

function apiSession(overrides: Record<string, unknown> = {}) {
  return {
    subjectId: "business-user",
    displayName: "业务员工",
    workUnitCode: "QIQIHAR_BUSINESS",
    workUnitName: "齐齐哈尔经营部",
    accountStatus: "ACTIVE",
    employmentStatus: "ACTIVE",
    roleCodes: ["BUSINESS_OPERATOR"],
    positions: [
      {
        code: "REGIONAL_REPORTER",
        name: "区域填报专员",
        primaryPosition: true,
      },
    ],
    permissions: ["BUSINESS_READ", "BUSINESS_CREATE"],
    regionCodes: ["230200"],
    ...overrides,
  };
}

function productionDefinitionFixture(): ProductionDefinition {
  const field = (
    code: string,
    label: string,
    groupCode: string,
    groupLabel: string,
    groupOrder: number,
    sortOrder: number,
    overrides: Partial<ProductionDefinition["fields"][number]> = {},
  ): ProductionDefinition["fields"][number] => ({
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
    precision: 0,
    scale: 0,
    ...overrides,
  });
  return {
    productCode: "CORN",
    objectTypeCode: "FARMER",
    contractVersion: PRODUCTION_SURVEY_CONTRACT_VERSION,
    contractDigest: PRODUCTION_SURVEY_CONTRACT_DIGEST,
    fields: [
      field("surveyDate", "调查日期", "CONTEXT", "基础信息", 10, 10, {
        valueType: "DATE",
        controlType: "DATE",
        required: true,
      }),
      field(
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
      field(
        "PROD_SAMPLE_NAME",
        "填报对象名称",
        "SUBJECT",
        "调查对象与联系",
        20,
        20,
      ),
      field("cultivatedAreaMu", "种植面积", "OUTPUT", "产量信息", 30, 10, {
        valueType: "DECIMAL",
        controlType: "DECIMAL",
        unit: "亩",
        required: true,
        precision: 18,
        scale: 4,
      }),
      field(
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
          precision: 18,
          scale: 4,
        },
      ),
      field(
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
          precision: 18,
          scale: 4,
        },
      ),
    ],
    groups: [],
  };
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  window.localStorage.removeItem(fixtureOperationalStateStorageKey);
  window.localStorage.removeItem(fixtureBusinessReportStorageKey);
});

describe("formal enterprise prototype", () => {
  it("loads every server work-item page instead of truncating the queue at 100", async () => {
    const listWorkItems = vi.fn(({ page = 0 }: { page?: number }) =>
      Promise.resolve({
        items: [{ id: `work-${page}` }],
        pageNumber: page,
        pageSize: 100,
        totalElements: 201,
        totalPages: 3,
      }),
    );
    const repository = {
      listWorkItems,
    } as unknown as RealtimeBusinessRepository;

    const rows = await loadAllWorkItems(repository, "PENDING");

    expect(rows.map(({ id }) => id)).toEqual(["work-0", "work-1", "work-2"]);
    expect(listWorkItems).toHaveBeenNthCalledWith(1, {
      scope: "PENDING",
      page: 0,
      pageSize: 100,
    });
    expect(listWorkItems).toHaveBeenNthCalledWith(3, {
      scope: "PENDING",
      page: 2,
      pageSize: 100,
    });
  });

  it("keeps a server-authoritative product filter selected and filters the real work rows", async () => {
    const user = userEvent.setup();
    const rows = [
      ["corn-work", "玉米产情审核任务", "CORN", "玉米"],
      ["soybean-work", "大豆产情审核任务", "SOYBEAN", "大豆"],
      ["rice-work", "稻谷产情审核任务", "RICE", "稻谷"],
    ].map(([id, task, product, productLabel]) => ({
      id,
      task,
      domain: "PRODUCTION",
      regionCode: "230225",
      region: "甘南县",
      product,
      businessPeriodCode: "2026-W32",
      businessPeriod: "2026年第32周",
      dueAt: null,
      workflowNode: "审核",
      statusCode: "PENDING_REVIEW",
      status: "待审核",
      responsiblePartyCode: "admin-1",
      responsibleParty: "管理员",
      sourceType: "PRODUCTION",
      sourceId: `${id}-source`,
      productLabel,
    }));
    const repository = {
      loadCurrentSession: () =>
        Promise.resolve(
          apiSession({
            roleCodes: ["PLATFORM_ADMIN"],
            permissions: ["BUSINESS_READ", "BUSINESS_APPROVE"],
            regionCodes: [],
          }),
        ),
      loadMasterData: () =>
        Promise.resolve({
          products: [
            { code: "CORN", name: "玉米" },
            { code: "SOYBEAN", name: "大豆" },
            { code: "RICE", name: "稻谷" },
          ],
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
              code: "230225",
              name: "甘南县",
              parentCode: "230200",
              level: "COUNTY",
            },
          ],
        }),
      listWorkItems: () =>
        Promise.resolve({
          items: rows,
          pageNumber: 0,
          pageSize: 100,
          totalElements: rows.length,
          totalPages: 1,
        }),
    } as unknown as RealtimeBusinessRepository;

    render(
      <EnterpriseBusinessApplication
        dataMode="api"
        initialSearch="?page=work&section=tasks"
        repository={repository}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "更多筛选" }));
    const product = await screen.findByRole("combobox", {
      name: "产品或作物",
    });
    await user.selectOptions(product, "soybean");

    expect(product).toHaveValue("soybean");
    expect(screen.getByText("1 项")).toBeVisible();
    expect(screen.getAllByText("大豆产情审核任务").length).toBeGreaterThan(0);
    expect(screen.queryByText("玉米产情审核任务")).not.toBeInTheDocument();
    expect(screen.queryByText("稻谷产情审核任务")).not.toBeInTheDocument();
  });

  it("does not expose sample-point management in the business navigation", async () => {
    render(
      <EnterpriseBusinessApplication initialSearch="?page=work&section=tasks" />,
    );

    expect(
      await screen.findByRole("heading", { name: "待我处理" }),
    ).toBeVisible();
    expect(screen.queryByText("样本点管理")).not.toBeInTheDocument();
  });

  it("fails closed at the enterprise login boundary when no session exists", async () => {
    const loadMasterData = vi.fn();
    const listWorkItems = vi.fn();
    const repository = {
      loadCurrentSession: () =>
        Promise.reject(
          new RealtimeApiError({
            code: "UNAUTHENTICATED",
            message: "Authentication is required",
            status: 401,
          }),
        ),
      loadMasterData,
      listWorkItems,
    } as unknown as RealtimeBusinessRepository;

    render(
      <RuntimeEnterpriseBusinessApplication
        dataMode="api"
        repository={repository}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "登录企业账号" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "进入统一身份认证" }),
    ).toHaveAttribute("href", "/api/v1/session/login");
    expect(screen.queryByText("产情监测")).not.toBeInTheDocument();
    expect(loadMasterData).not.toHaveBeenCalled();
    expect(listWorkItems).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("link", { name: /注册/u }),
    ).not.toBeInTheDocument();
  });

  it("blocks disabled or unauthorized enterprise accounts without exposing the business shell", async () => {
    const loadMasterData = vi.fn();
    const repository = {
      loadCurrentSession: () =>
        Promise.reject(
          new RealtimeApiError({
            code: "ACCOUNT_UNAVAILABLE",
            message: "Account is unavailable",
            status: 403,
          }),
        ),
      loadMasterData,
      listWorkItems: vi.fn(),
    } as unknown as RealtimeBusinessRepository;

    render(
      <RuntimeEnterpriseBusinessApplication
        dataMode="api"
        repository={repository}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "账号暂不可用" }),
    ).toBeVisible();
    expect(screen.getByText(/联系本单位系统管理员/)).toBeVisible();
    expect(screen.queryByText("我的工作")).not.toBeInTheDocument();
    expect(loadMasterData).not.toHaveBeenCalled();
  });

  it("binds the authenticated organization and account menus to real governance data", async () => {
    const user = userEvent.setup();
    const repository = {
      loadCurrentSession: () =>
        Promise.resolve({
          subjectId: "identity-admin",
          displayName: "李主任",
          workUnitCode: "QIQIHAR_BUSINESS",
          workUnitName: "齐齐哈尔经营部",
          accountStatus: "ACTIVE",
          employmentStatus: "ACTIVE",
          roleCodes: ["IDENTITY_ADMIN"],
          positions: [],
          permissions: ["BUSINESS_READ", "IDENTITY_READ", "IDENTITY_ADMIN"],
          regionCodes: ["230200"],
        }),
      loadMasterData: () =>
        Promise.resolve({ products: [], periods: [], regions: [] }),
      listWorkItems: () =>
        Promise.resolve({
          items: [],
          pageNumber: 0,
          pageSize: 100,
          totalElements: 0,
          totalPages: 0,
        }),
      listNotifications: () => Promise.resolve({ items: [], unreadCount: 0 }),
      subscribeBusinessEvents: () => () => undefined,
      listEmployees: () => Promise.resolve([]),
      loadAssignmentOptions: () =>
        Promise.resolve({
          workUnits: [],
          roles: [],
          positions: [],
          regionCodes: [],
        }),
    } as unknown as RealtimeBusinessRepository;

    render(
      <EnterpriseBusinessApplication
        dataMode="api"
        initialSearch="?page=work&section=tasks"
        repository={repository}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "当前用户：李主任" }),
    );
    expect(
      screen.getByRole("dialog", { name: "账号与授权" }),
    ).toHaveTextContent("管理员");
    expect(
      screen.getByRole("dialog", { name: "账号与授权" }),
    ).not.toHaveTextContent("岗位");
    await user.click(screen.getByRole("button", { name: "返回业务页面" }));
    await user.click(
      screen.getByRole("button", { name: "当前工作单位：齐齐哈尔经营部" }),
    );
    expect(
      screen.getByRole("dialog", { name: "账号与授权" }),
    ).toHaveTextContent("已授权 1 个责任地区");
    expect(
      screen.getByRole("dialog", { name: "账号与授权" }),
    ).not.toHaveTextContent("230200");
  });

  it("opens a pending production item as an administrator review of its source record", async () => {
    const user = userEvent.setup();
    const getProduction = vi.fn(() =>
      Promise.resolve({
        id: "production-source-17",
        productCode: "CORN",
        objectTypeCode: "FARMER",
        regionCode: "230221101001",
        cultivarCode: null,
        surveyDate: "2026-08-09",
        cultivatedAreaMu: "120",
        yieldPerMuKilograms: "475",
        quality: {},
        costs: {},
        insurance: {},
        subsidies: {},
        submissionMetadata: {},
        reportedAt: "2026-08-09T10:00:00+08:00",
        estimatedOutputKilograms: "57000",
        status: "PENDING_REVIEW",
        returnReason: null,
        allowedActions: ["APPROVE", "RETURN"],
        evidencePhotos: [],
        version: 1,
      }),
    );
    const repository = {
      loadCurrentSession: () =>
        Promise.resolve({
          subjectId: "employee-17",
          displayName: "业务员工",
          workUnitCode: "QIQIHAR_BUSINESS",
          permissions: ["BUSINESS_APPROVE", "BUSINESS_RETURN"],
          regionCodes: ["230221101001"],
        }),
      loadMasterData: () =>
        Promise.resolve({
          products: [{ code: "CORN", name: "玉米" }],
          periods: [
            {
              code: "2026-W32",
              name: "2026 年第 32 周",
              startsOn: "2026-08-03",
              endsOn: "2026-08-09",
            },
          ],
          regions: [],
        }),
      listWorkItems: () =>
        Promise.resolve({
          items: [
            {
              id: "work-item-17",
              task: "玉米产情待处理单据",
              domain: "PRODUCTION",
              regionCode: "230221101001",
              region: "通齐村",
              product: "玉米",
              businessPeriod: "2026-W32",
              dueAt: null,
              workflowNode: "审核",
              statusCode: "PENDING_REVIEW",
              status: "待审核",
              responsiblePartyCode: "employee-17",
              responsibleParty: "业务员工",
              sourceType: "PRODUCTION",
              sourceId: "production-source-17",
            },
          ],
          pageNumber: 0,
          pageSize: 100,
          totalElements: 1,
          totalPages: 1,
        }),
      listObjectTypes: () =>
        Promise.resolve([
          { code: "FARMER", name: "农户", domain: "PRODUCTION" },
        ]),
      listProduction: () =>
        Promise.resolve({
          items: [],
          pageNumber: 0,
          pageSize: 100,
          totalElements: 0,
          totalPages: 0,
        }),
      loadProductionDefinition: () =>
        Promise.resolve(productionDefinitionFixture()),
      getProduction,
    } as unknown as RealtimeBusinessRepository;

    render(
      <EnterpriseBusinessApplication
        dataMode="api"
        initialSearch="?page=work&section=tasks"
        repository={repository}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "审核产情单据" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "产情单据审核",
    });
    expect(dialog).toBeVisible();
    await waitFor(() =>
      expect(getProduction).toHaveBeenCalledWith("production-source-17"),
    );
    expect(within(dialog).getByLabelText("数据年份")).toHaveValue("2026");
    expect(within(dialog).getByLabelText("数据年份")).toBeDisabled();
    expect(within(dialog).getByLabelText("数据月份")).toHaveValue("8");
    expect(within(dialog).getByLabelText("数据月份")).toBeDisabled();
    expect(within(dialog).getByLabelText("填报日期")).toHaveValue("2026-08-09");
    expect(within(dialog).getByLabelText("填报日期").tagName).toBe("OUTPUT");
    expect(
      within(dialog).queryByRole("button", { name: "保存并提交审核" }),
    ).not.toBeInTheDocument();
  });

  it("opens a pending logistics work item against the original logistics record", async () => {
    const user = userEvent.setup();
    const getLogistics = vi.fn(() =>
      Promise.resolve({
        id: "logistics-source-17",
        productCode: "CORN",
        values: {
          LOG_REPORTER: "物流填报员",
          LOG_ROUTE_VOLUME: "120.0000",
        },
        displayValues: {
          LOG_REPORTER: "物流填报员",
          LOG_ROUTE_VOLUME: "120.0000",
        },
        status: "PENDING_REVIEW",
        returnReason: null,
        allowedActions: ["APPROVE", "RETURN"],
        version: 2,
      }),
    );
    const repository = {
      loadCurrentSession: () =>
        Promise.resolve({
          subjectId: "logistics-reviewer",
          displayName: "物流审核员",
          workUnitCode: "QIQIHAR_BUSINESS",
          permissions: ["BUSINESS_APPROVE", "BUSINESS_RETURN"],
          regionCodes: ["230202"],
        }),
      loadMasterData: () =>
        Promise.resolve({
          products: [{ code: "CORN", name: "玉米" }],
          periods: [
            {
              code: "2026-W32",
              name: "2026 年第 32 周",
              startsOn: "2026-08-03",
              endsOn: "2026-08-09",
            },
          ],
          regions: [],
        }),
      listWorkItems: () =>
        Promise.resolve({
          items: [
            {
              id: "work-logistics-17",
              task: "物流监测 · logistics-source-17",
              domain: "MARKET",
              regionCode: "230202",
              region: "龙沙区",
              product: "玉米",
              businessPeriod: "2026-W32",
              dueAt: null,
              workflowNode: "审核",
              statusCode: "TO_REVIEW",
              status: "待审核",
              responsiblePartyCode: "logistics-reviewer",
              responsibleParty: "物流审核员",
              sourceType: "LOGISTICS",
              sourceId: "logistics-source-17",
            },
          ],
          pageNumber: 0,
          pageSize: 100,
          totalElements: 1,
          totalPages: 1,
        }),
      loadLogisticsDefinition: () =>
        Promise.resolve({
          productCode: "CORN",
          fields: [
            {
              code: "LOG_REPORTER",
              label: "填报人",
              controlType: "TEXT",
              unit: null,
              precision: null,
              scale: null,
              required: true,
              readOnly: false,
              sortOrder: 10,
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
              sortOrder: 20,
              options: [],
            },
          ],
          actions: [],
        }),
      listLogistics: () =>
        Promise.resolve({
          items: [],
          pageNumber: 0,
          pageSize: 100,
          totalElements: 0,
          totalPages: 0,
        }),
      getLogistics,
    } as unknown as RealtimeBusinessRepository;

    render(
      <EnterpriseBusinessApplication
        dataMode="api"
        initialSearch="?page=work&section=tasks"
        repository={repository}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "审核物流单据" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "物流监测单据审核",
    });
    expect(dialog).toBeVisible();
    await waitFor(() =>
      expect(getLogistics).toHaveBeenCalledWith("logistics-source-17"),
    );
    const routeVolume = within(dialog).getByRole("spinbutton", {
      name: /运输数量/,
    });
    expect(routeVolume).toHaveValue(120);
    expect(routeVolume).toBeDisabled();
    expect(
      within(dialog).queryByRole("button", { name: "保存物流记录" }),
    ).not.toBeInTheDocument();
  });

  it("refreshes authorized business data from the durable event stream without polling", async () => {
    const user = userEvent.setup();
    let receiveBusinessEvent:
      ((event: BusinessNotificationRow) => void) | undefined;
    const unsubscribe = vi.fn();
    const listWorkItems = vi.fn(() =>
      Promise.resolve({
        items: [],
        pageNumber: 0,
        pageSize: 100,
        totalElements: 0,
        totalPages: 0,
      }),
    );
    const listNotifications = vi.fn(() =>
      Promise.resolve({
        items: [
          {
            id: "event-1",
            sequence: 1,
            aggregateType: "PRODUCTION_RECORD",
            aggregateId: "production-1",
            actionCode: "PRODUCTION_RECORD_CREATED",
            productCode: "CORN",
            regionCodes: ["230200"],
            occurredAt: "2026-08-09T10:00:00Z",
            read: false,
          },
        ],
        unreadCount: 7,
      }),
    );
    const markNotificationRead = vi.fn(() =>
      Promise.resolve({
        id: "event-1",
        sequence: 1,
        aggregateType: "PRODUCTION_RECORD",
        aggregateId: "production-1",
        actionCode: "PRODUCTION_RECORD_CREATED",
        productCode: "CORN",
        regionCodes: ["230200"],
        occurredAt: "2026-08-09T10:00:00Z",
        read: true,
      }),
    );
    const getProduction = vi.fn(() =>
      Promise.resolve({
        id: "production-1",
        productCode: "CORN",
        objectTypeCode: "FARMER",
        regionCode: "230200",
        cultivarCode: null,
        surveyDate: "2026-08-09",
        cultivatedAreaMu: "120",
        yieldPerMuKilograms: "475",
        quality: {},
        costs: {},
        insurance: {},
        subsidies: {},
        submissionMetadata: {},
        reportedAt: "2026-08-09T10:00:00+08:00",
        estimatedOutputKilograms: "57000",
        status: "APPROVED",
        returnReason: null,
        allowedActions: [],
        evidencePhotos: [],
        version: 1,
      }),
    );
    const subscribeBusinessEvents = vi.fn(
      (
        _afterSequence: number,
        onChange: (event: BusinessNotificationRow) => void,
      ) => {
        receiveBusinessEvent = onChange;
        return unsubscribe;
      },
    );
    const repository = {
      loadCurrentSession: () =>
        Promise.resolve({
          subjectId: "employee-1",
          displayName: "当前员工",
          workUnitCode: "QIQIHAR_BUSINESS",
          permissions: ["BUSINESS_READ"],
          regionCodes: ["230200"],
        }),
      loadMasterData: () =>
        Promise.resolve({
          products: [{ code: "CORN", name: "玉米" }],
          periods: [
            {
              code: "2026-W32",
              name: "2026 年第 32 周",
              startsOn: "2026-08-03",
              endsOn: "2026-08-09",
            },
          ],
          regions: [],
        }),
      listWorkItems,
      listProduction: () =>
        Promise.resolve({
          items: [],
          pageNumber: 0,
          pageSize: 100,
          totalElements: 0,
          totalPages: 0,
        }),
      listObjectTypes: () =>
        Promise.resolve([
          { code: "FARMER", name: "农户", domain: "PRODUCTION" },
        ]),
      loadProductionDefinition: () =>
        Promise.resolve(productionDefinitionFixture()),
      getProduction,
      listNotifications,
      markNotificationRead,
      subscribeBusinessEvents,
    } as unknown as RealtimeBusinessRepository;

    const { unmount } = render(
      <EnterpriseBusinessApplication
        dataMode="api"
        initialSearch="?page=work&section=tasks"
        repository={repository}
      />,
    );

    await waitFor(() => {
      expect(subscribeBusinessEvents).toHaveBeenCalledTimes(1);
      expect(subscribeBusinessEvents).toHaveBeenCalledWith(
        1,
        expect.any(Function),
      );
      expect(listNotifications).toHaveBeenCalledTimes(1);
      expect(listWorkItems).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole("button", { name: /^通知/ })).toHaveTextContent(
      "7",
    );
    await user.click(screen.getByRole("button", { name: /^通知/ }));
    await user.click(
      screen.getByRole("button", { name: /玉米产情记录已新建/ }),
    );
    await waitFor(() =>
      expect(markNotificationRead).toHaveBeenCalledWith("event-1"),
    );
    await waitFor(() =>
      expect(getProduction).toHaveBeenCalledWith("production-1"),
    );
    expect(
      await screen.findByRole("dialog", { name: "产情记录详情" }),
    ).toBeVisible();
    const workItemCallsBeforeEvent = listWorkItems.mock.calls.length;
    if (!receiveBusinessEvent) throw new Error("event stream not subscribed");
    const businessEvent: BusinessNotificationRow = {
      id: "event-1",
      sequence: 1,
      aggregateType: "PRODUCTION_RECORD",
      aggregateId: "production-1",
      actionCode: "PRODUCTION_RECORD_CREATED",
      productCode: "CORN",
      regionCodes: ["230200"],
      occurredAt: "2026-08-09T10:00:00Z",
      read: false,
    };
    act(() => receiveBusinessEvent?.(businessEvent));
    await new Promise((resolve) => setTimeout(resolve, 50));
    act(() =>
      receiveBusinessEvent?.({
        ...businessEvent,
        id: "event-2",
        sequence: 2,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    act(() =>
      receiveBusinessEvent?.({
        ...businessEvent,
        id: "event-3",
        sequence: 3,
      }),
    );
    await waitFor(
      () => {
        expect(listNotifications).toHaveBeenCalledTimes(2);
        expect(listWorkItems).toHaveBeenCalledTimes(
          workItemCallsBeforeEvent + 1,
        );
      },
      { timeout: 2_000 },
    );

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("lets the embedded overview own realtime refresh without opening a duplicate outer stream", async () => {
    const loadMasterData = vi.fn(() =>
      Promise.resolve({ products: [], periods: [], regions: [] }),
    );
    const listNotifications = vi.fn(() =>
      Promise.resolve({ items: [], unreadCount: 0 }),
    );
    const subscribeBusinessEvents = vi.fn(() => vi.fn());
    const repository = {
      loadCurrentSession: () => Promise.resolve(apiSession({ positions: [] })),
      loadMasterData,
      listWorkItems: () =>
        Promise.resolve({
          items: [],
          pageNumber: 0,
          pageSize: 100,
          totalElements: 0,
          totalPages: 0,
        }),
      listNotifications,
      subscribeBusinessEvents,
    } as unknown as RealtimeBusinessRepository;

    render(
      <EnterpriseBusinessApplication
        dataMode="api"
        initialSearch="?page=overview&section=map"
        repository={repository}
      />,
    );

    expect(
      await screen.findByTitle("齐齐哈尔粮食商情总览监测地图"),
    ).toBeVisible();
    await waitFor(() => expect(loadMasterData).toHaveBeenCalledTimes(1));
    expect(listNotifications).not.toHaveBeenCalled();
    expect(subscribeBusinessEvents).not.toHaveBeenCalled();
  });

  it("shows the production ledger without mounting the entry form by default", async () => {
    const user = userEvent.setup();
    const listObjectTypes = vi.fn(() =>
      Promise.resolve([{ code: "FARMER", name: "农户", domain: "PRODUCTION" }]),
    );
    const repository = {
      loadCurrentSession: () =>
        Promise.resolve({
          subjectId: "wang-yang",
          displayName: "王洋",
          workUnitCode: "QIQIHAR_BUSINESS",
          permissions: ["REPORT_PREVIEW", "REPORT_EXPORT"],
          regionCodes: ["230200"],
        }),
      loadMasterData: () =>
        Promise.resolve({
          products: [
            { code: "SOYBEAN", name: "大豆" },
            { code: "CORN", name: "玉米" },
          ],
          periods: [
            {
              code: "2026-W32",
              name: "2026 年第 32 周",
              startsOn: "2026-08-03",
              endsOn: "2026-08-09",
            },
          ],
          regions: [],
        }),
      listWorkItems: () =>
        Promise.resolve({
          items: [],
          pageNumber: 0,
          pageSize: 100,
          totalElements: 0,
          totalPages: 0,
        }),
      listCultivars: () => Promise.resolve([]),
      listObjectTypes,
      listProduction: () =>
        Promise.resolve({
          items: [],
          pageNumber: 0,
          pageSize: 100,
          totalElements: 0,
          totalPages: 0,
        }),
      loadProductionDefinition: () =>
        Promise.resolve(productionDefinitionFixture()),
    } as unknown as RealtimeBusinessRepository;

    render(
      <EnterpriseBusinessApplication
        dataMode="api"
        initialSearch="?page=production&section=corn-collection"
        repository={repository}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "玉米产情调查表" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "产情填报" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "保存常用条件" }),
    ).not.toBeInTheDocument();
    for (const removedColumn of [
      "病虫害与灾情",
      "样本平均单产",
      "区域加权单产",
      "测产轮次",
      "现场依据",
      "入库数量",
      "损耗数量",
    ]) {
      expect(
        screen.queryByRole("columnheader", { name: removedColumn }),
      ).not.toBeInTheDocument();
    }

    await user.click(screen.getByRole("button", { name: "新建调查记录" }));
    expect(
      await screen.findByRole("dialog", { name: "新建产情填报" }),
    ).toBeVisible();
    expect(
      await screen.findByRole("region", { name: "产情填报" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "玉米产情调查表" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "关闭新建产情填报" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("combobox", { name: "品种" }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(listObjectTypes).toHaveBeenCalledWith("CORN", "PRODUCTION"),
    );

    await user.click(screen.getByRole("button", { name: "关闭新建产情填报" }));
    expect(
      screen.queryByRole("dialog", { name: "新建产情填报" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "新建调查记录" }));

    await user.click(screen.getByRole("button", { name: "取消并返回" }));
    expect(
      await screen.findByRole("heading", { name: "玉米产情调查表" }),
    ).toBeVisible();
  });

  it("keeps market collection in the ledger until the user starts a new record", async () => {
    const user = userEvent.setup();
    const repository = {
      loadCurrentSession: () => Promise.resolve(apiSession()),
      loadMasterData: () =>
        Promise.resolve({
          products: [{ code: "CORN", name: "玉米" }],
          periods: [
            {
              code: "2026-W32",
              name: "2026 年第 32 周",
              startsOn: "2026-08-03",
              endsOn: "2026-08-09",
            },
          ],
          regions: [],
        }),
      listWorkItems: () =>
        Promise.resolve({
          items: [],
          pageNumber: 0,
          pageSize: 100,
          totalElements: 0,
          totalPages: 0,
        }),
      listCultivars: () => Promise.resolve([]),
      listObjectTypes: () =>
        Promise.resolve([{ code: "TRADER", name: "贸易商", domain: "MARKET" }]),
      listMarket: () =>
        Promise.resolve({
          items: [],
          pageNumber: 0,
          pageSize: 100,
          totalElements: 0,
          totalPages: 0,
        }),
      loadMarketDefinition: () =>
        Promise.resolve({
          productCode: "CORN",
          objectTypeCode: "TRADER",
          coreFields: [],
          groups: [],
        }),
      createMarket: () =>
        Promise.resolve({
          id: "market-record-1",
          productCode: "CORN",
          coreValues: {},
          facts: {},
          status: "DRAFT",
          returnReason: null,
          allowedActions: ["SUBMIT"],
          version: 1,
        }),
      uploadEvidencePhoto: () =>
        Promise.resolve({
          id: "photo-1",
          state: "STAGED",
          originalFilename: "market.png",
          mediaType: "image/png",
          byteLength: 12,
          sha256: "a".repeat(64),
          capturedAt: "2026-08-08T10:00:00+08:00",
          latitude: "47.3543",
          longitude: "123.9182",
          watermarkText: "齐齐哈尔市 市场采集 王洋",
        }),
    } as unknown as RealtimeBusinessRepository;

    render(
      <EnterpriseBusinessApplication
        dataMode="api"
        initialSearch="?page=market&section=corn-collection"
        repository={repository}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "玉米市场采集表" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "市场采集" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "保存常用条件" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "新建采集记录" }));
    expect(
      await screen.findByRole("dialog", { name: "新建市场填报" }),
    ).toBeVisible();
    expect(
      await screen.findByRole("region", { name: "市场采集" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "玉米市场采集表" }),
    ).toBeInTheDocument();

    const save = screen.getByRole("button", { name: "保存并提交审核" });
    await waitFor(() => expect(save).toBeEnabled());
    await user.upload(
      screen.getByLabelText("现场水印照片"),
      new File(["market"], "market.png", { type: "image/png" }),
    );
    await user.click(save);
    expect(
      await screen.findByRole("heading", { name: "玉米市场采集表" }),
    ).toBeVisible();
  });

  it("keeps logistics monitoring in the ledger until the user starts a new record", async () => {
    const user = userEvent.setup();
    const repository = {
      loadCurrentSession: () => Promise.resolve(apiSession()),
      loadMasterData: () =>
        Promise.resolve({
          products: [{ code: "CORN", name: "玉米" }],
          periods: [
            {
              code: "2026-W32",
              name: "2026 年第 32 周",
              startsOn: "2026-08-03",
              endsOn: "2026-08-09",
            },
          ],
          regions: [],
        }),
      listWorkItems: () =>
        Promise.resolve({
          items: [],
          pageNumber: 0,
          pageSize: 100,
          totalElements: 0,
          totalPages: 0,
        }),
      loadLogisticsDefinition: () =>
        Promise.resolve({ productCode: "CORN", fields: [], actions: [] }),
      listLogistics: () =>
        Promise.resolve({
          items: [],
          pageNumber: 0,
          pageSize: 100,
          totalElements: 0,
          totalPages: 0,
        }),
    } as unknown as RealtimeBusinessRepository;

    render(
      <EnterpriseBusinessApplication
        dataMode="api"
        initialSearch="?page=market&section=logistics"
        repository={repository}
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: "粮食物流监测表",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "物流监测填报" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "新建监测记录" }));
    expect(
      await screen.findByRole("dialog", { name: "新建物流监测填报" }),
    ).toBeVisible();
    expect(
      await screen.findByRole("region", { name: "物流监测填报" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "粮食物流监测表" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "取消并返回" }));
    expect(
      await screen.findByRole("heading", {
        name: "粮食物流监测表",
      }),
    ).toBeVisible();
  });

  it("uses scoped business reports without reading report seeds or search fixtures", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      fixtureBusinessReportStorageKey,
      JSON.stringify(createFixtureBusinessReportSeeds()),
    );
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const repository = {
      loadCurrentSession: () =>
        Promise.resolve({
          subjectId: "wang-yang",
          displayName: "王洋",
          workUnitCode: "QIQIHAR_BUSINESS",
          permissions: ["REPORT_PREVIEW", "REPORT_EXPORT"],
          regionCodes: ["230200"],
        }),
      loadMasterData: () =>
        Promise.resolve({
          products: [{ code: "CORN", name: "服务端玉米" }],
          periods: [
            {
              code: "2026-W32",
              name: "2026 年第 32 周",
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
          ],
        }),
      listCultivars: () => Promise.resolve([]),
      loadReportParameterOptions: () =>
        Promise.resolve({
          definitions: [
            {
              code: "COMPREHENSIVE_DAILY",
              name: "综合经营日报",
              businessDomain: "COMPREHENSIVE",
              businessSubtype: "MANAGEMENT",
              frequencyCode: "DAILY",
              sections: [],
            },
          ],
          formats: [{ code: "CSV", label: "CSV（中文列名）" }],
        }),
      listWorkItems: () =>
        Promise.resolve({
          items: [],
          pageNumber: 0,
          pageSize: 100,
          totalElements: 0,
          totalPages: 0,
        }),
    } as unknown as RealtimeBusinessRepository;

    render(
      <EnterpriseBusinessApplication
        dataMode="api"
        initialSearch="?page=reporting&section=compose"
        repository={repository}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "业务报告" }),
    ).toBeVisible();
    expect(await screen.findByText("王洋")).toBeVisible();
    expect(
      await screen.findByRole("button", { name: "生成并下载报告" }),
    ).toBeVisible();
    expect(document.body).not.toHaveTextContent("第31周粮食商情周报");
    expect(
      screen.getByText(
        "按日、周、月生成一份综合经营报告，三品种四业务域使用同一审核后数据快照",
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        "报告目录由服务端维护，仅提供综合经营日报、周报和月报。",
      ),
    ).toBeVisible();

    await user.type(
      screen.getByRole("searchbox", { name: "全局搜索" }),
      "齐齐哈尔市全域玉米供需平衡分析报告",
    );
    expect(
      within(screen.getByRole("listbox")).queryByRole("option"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("未找到匹配的业务页面")).toBeVisible();
    expect(
      getItem.mock.calls.some(
        ([key]) => key === fixtureBusinessReportStorageKey,
      ),
    ).toBe(false);
    expect(
      setItem.mock.calls.some(
        ([key]) => key === fixtureBusinessReportStorageKey,
      ),
    ).toBe(false);
  });

  it("keeps API empty data fail-closed and uses an authorization-pending identity", async () => {
    saveFixtureOperationalState(
      window.localStorage,
      createDefaultFixtureOperationalState(),
    );
    const repository = {
      loadCurrentSession: () => Promise.resolve(apiSession()),
      loadMasterData: () =>
        Promise.resolve({
          products: [{ code: "CORN", name: "服务端玉米" }],
          periods: [],
          regions: [],
        }),
      listWorkItems: () =>
        Promise.resolve({
          items: [],
          pageNumber: 0,
          pageSize: 100,
          totalElements: 0,
          totalPages: 0,
        }),
      listCultivars: () => Promise.resolve([]),
    } as unknown as RealtimeBusinessRepository;

    render(
      <EnterpriseBusinessApplication
        dataMode="api"
        initialSearch="?page=work&section=tasks"
        repository={repository}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("status", {
          name: "业务数据状态",
        }),
      ).toHaveTextContent("当前暂无可用业务数据"),
    );
    expect(document.body).not.toHaveTextContent("齐齐哈尔市玉米市场运行周填报");
    expect(screen.getByLabelText("当前用户：业务员工")).toBeVisible();
    expect(document.body).not.toHaveTextContent("未分配岗位");
    expect(
      screen.queryByRole("button", { name: "系统设置" }),
    ).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("王洋");
  });

  it("keeps API failures fail-closed without restoring stored fixtures", async () => {
    saveFixtureOperationalState(
      window.localStorage,
      createDefaultFixtureOperationalState(),
    );
    const repository = {
      loadCurrentSession: () => Promise.resolve(apiSession()),
      loadMasterData: () => Promise.reject(new Error("受控服务不可用")),
      listWorkItems: () => Promise.reject(new Error("受控服务不可用")),
    } as unknown as RealtimeBusinessRepository;

    render(
      <EnterpriseBusinessApplication
        dataMode="api"
        initialSearch="?page=work&section=tasks"
        repository={repository}
      />,
    );

    expect(
      await screen.findByRole("alert", {
        name: "业务数据状态",
      }),
    ).toHaveTextContent("业务数据读取失败");
    expect(document.body).not.toHaveTextContent("齐齐哈尔市玉米市场运行周填报");
  });

  it("clears a transient business-data error after the event stream recovers", async () => {
    let receiveBusinessEvent:
      ((event: BusinessNotificationRow) => void) | undefined;
    const masterData = {
      products: [{ code: "CORN", name: "玉米" }],
      periods: [
        {
          code: "2026-W32",
          name: "2026 年第 32 周",
          startsOn: "2026-08-03",
          endsOn: "2026-08-09",
        },
      ],
      regions: [],
    };
    const loadMasterData = vi
      .fn()
      .mockRejectedValueOnce(new Error("短暂不可用"))
      .mockResolvedValue(masterData);
    const listWorkItems = vi.fn(() =>
      Promise.resolve({
        items: [],
        pageNumber: 0,
        pageSize: 100,
        totalElements: 0,
        totalPages: 0,
      }),
    );
    const repository = {
      loadCurrentSession: () => Promise.resolve(apiSession()),
      loadMasterData,
      listWorkItems,
      listNotifications: () => Promise.resolve({ items: [], unreadCount: 0 }),
      subscribeBusinessEvents: (
        _afterSequence: number,
        onChange: (event: BusinessNotificationRow) => void,
      ) => {
        receiveBusinessEvent = onChange;
        return vi.fn();
      },
    } as unknown as RealtimeBusinessRepository;

    render(
      <EnterpriseBusinessApplication
        dataMode="api"
        initialSearch="?page=work&section=tasks"
        repository={repository}
      />,
    );

    expect(
      await screen.findByRole("alert", { name: "业务数据状态" }),
    ).toHaveTextContent("业务数据读取失败");
    expect(
      screen.getByRole("alert", { name: "工作状态恢复提示" }),
    ).toHaveTextContent("业务数据读取失败");
    if (!receiveBusinessEvent) throw new Error("event stream not subscribed");
    act(() =>
      receiveBusinessEvent?.({
        id: "event-recovery",
        sequence: 1,
        aggregateType: "PRODUCTION_RECORD",
        aggregateId: "production-1",
        actionCode: "PRODUCTION_RECORD_APPROVED",
        productCode: "CORN",
        regionCodes: ["230200"],
        occurredAt: "2026-08-09T10:00:00Z",
        read: false,
      }),
    );

    await waitFor(
      () => {
        expect(loadMasterData).toHaveBeenCalledTimes(2);
        expect(
          screen.queryByRole("alert", { name: "业务数据状态" }),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole("alert", { name: "工作状态恢复提示" }),
        ).not.toBeInTheDocument();
      },
      { timeout: 2_000 },
    );
  });

  it("keeps developer terminology and internal identifiers off business screens", async () => {
    const user = userEvent.setup();
    render(
      <EnterpriseBusinessApplication initialSearch="?page=production&section=tasks" />,
    );

    await user.click(screen.getByRole("button", { name: "补充产情填报" }));
    const forbidden = [
      /METRIC-/i,
      /VERSION-/i,
      /指标数据版本/,
      /采用版本/,
      /数据层/,
      /业务对象能力清单/,
      /工作项生命周期/,
      /本单据不适用/,
      /责任人已确认/,
      /调查片区/,
      /样本户组/,
    ];
    for (const pattern of forbidden) {
      expect(document.body).not.toHaveTextContent(pattern);
    }
  });

  it("uses the enterprise shell and the product-owned production navigation", () => {
    render(
      <EnterpriseBusinessApplication initialSearch="?page=production&section=objects" />,
    );

    expect(screen.getByText("齐齐哈尔粮食商情企业平台")).toBeVisible();
    const navigation = screen.getByRole("navigation", { name: "产情监测模块" });
    expect(within(navigation).getAllByRole("button")).toHaveLength(18);
    expect(within(navigation).getByText("导入任务")).toBeVisible();
    expect(within(navigation).getByText("玉米产情填报")).toBeVisible();
    expect(within(navigation).getByText("大豆产情填报")).toBeVisible();
    expect(within(navigation).getByText("稻谷产情填报")).toBeVisible();
    expect(within(navigation).getByText("地区产情填报")).toBeVisible();
    expect(within(navigation).getByText("产情分析")).toBeVisible();
    expect(within(navigation).getByText("玉米市场采集")).toBeVisible();
    expect(within(navigation).getByText("玉米物流监测")).toBeVisible();
    expect(within(navigation).getByText("大豆物流监测")).toBeVisible();
    expect(within(navigation).getByText("稻谷物流监测")).toBeVisible();
    expect(within(navigation).getByText("供需平衡")).toBeVisible();
    expect(
      within(navigation).queryByText("玉米供需平衡"),
    ).not.toBeInTheDocument();
    expect(
      within(navigation).queryByText("大豆供需平衡"),
    ).not.toBeInTheDocument();
    expect(
      within(navigation).queryByText("稻谷供需平衡"),
    ).not.toBeInTheDocument();
    expect(within(navigation).getByText("业务报告")).toBeVisible();
    expect(within(navigation).getByText("待我处理")).toBeVisible();
    expect(
      within(navigation).queryByText("样本点管理"),
    ).not.toBeInTheDocument();
    expect(within(navigation).queryByText("产情任务")).not.toBeInTheDocument();
    expect(within(navigation).queryByText("调查对象")).not.toBeInTheDocument();
    expect(within(navigation).queryByText("数据审核")).not.toBeInTheDocument();
  });

  it("changes applications through the location-owned route", async () => {
    const user = userEvent.setup();
    render(
      <EnterpriseBusinessApplication initialSearch="?page=market&section=tasks" />,
    );

    await user.click(
      within(screen.getByRole("navigation", { name: "业务应用" })).getByRole(
        "button",
        { name: "供需分析" },
      ),
    );

    expect(window.location.search).toBe("");
    expect(decodeURIComponent(window.location.hash)).toBe(
      "#/供需分析/供需平衡",
    );
    expect(
      screen.getByRole("navigation", { name: "供需分析模块" }),
    ).toHaveTextContent("供需平衡");
  });

  it("ignores unauthorized URL coordinates without exposing the raw value", () => {
    render(
      <EnterpriseBusinessApplication initialSearch="?page=production&section=tasks&region=not-authorized" />,
    );

    expect(
      screen.queryByRole("combobox", { name: "业务地区" }),
    ).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("not-authorized");
  });

  it("keeps recovery filters visible when a stored coordinate becomes invalid", () => {
    window.history.replaceState(
      {
        formalLocation: {
          route: { application: "production", section: "tasks" },
          coordinates: { regionId: "outside-current-authorization" },
        },
      },
      "",
      "/#/产情监测/业务任务",
    );
    render(<EnterpriseBusinessApplication />);

    expect(
      screen.getByRole("heading", { name: "玉米产情调查表" }),
    ).toBeVisible();
    expect(screen.getByLabelText("选择地区")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(
      "outside-current-authorization",
    );
    expect(screen.getByLabelText("选择地区")).toHaveTextContent("请选择地区");
  });

  it("keeps page-owned scope coordinates out of the visible URL", async () => {
    const user = userEvent.setup();
    render(
      <EnterpriseBusinessApplication initialSearch="?page=production&section=tasks" />,
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "产品或作物" }),
      "soybean",
    );

    expect(window.location.search).not.toMatch(/region=|product=|period=/);
    expect(screen.getByRole("combobox", { name: "产品或作物" })).toHaveValue(
      "soybean",
    );
  });

  it("keeps executive filters in memory while the route remains stable", async () => {
    const user = userEvent.setup();
    render(
      <EnterpriseBusinessApplication initialSearch="?page=overview&section=operations" />,
    );

    expect(screen.getByRole("combobox", { name: "授权地区" })).toHaveValue(
      "authorized-all",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "经营期间" }),
      "2026-W31",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "业务类型" }),
      "market",
    );
    expect(window.location.search).not.toContain("businessDomain=market");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "当前授权范围内部分地区尚无已发布数据",
    );
    expect(screen.getByText("当前筛选范围没有可用经营指标")).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "风险事项" }));
    expect(window.location.search).toBe("");
    expect(decodeURIComponent(window.location.hash)).toBe(
      "#/经营总览/风险关注",
    );
    expect(screen.getByText("当前筛选范围没有经营风险记录")).toBeVisible();
  });

  it("requires a governed period before executing the executive query", async () => {
    const user = userEvent.setup();
    render(
      <EnterpriseBusinessApplication initialSearch="?page=overview&section=operations" />,
    );

    expect(screen.getByRole("combobox", { name: "经营期间" })).toHaveValue("");
    expect(screen.getByRole("alert")).toHaveTextContent("请选择经营期间");
    expect(screen.getByRole("alert")).toHaveTextContent("系统未执行数据查询");
    expect(screen.getByText("当前筛选范围没有可用经营指标")).toBeVisible();
    expect(document.body).not.toHaveTextContent(
      /2026-W31|periodKey|fixtureExecutiveDefaultPeriodKey/,
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "经营期间" }),
      "2026-W31",
    );

    expect(window.location.search).not.toContain("period=2026-W31");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "当前授权范围内部分地区尚无已发布数据",
    );
    expect(screen.getByText("当前筛选范围没有可用经营指标")).toBeVisible();
  });

  it("never writes executive business coordinates to the formal URL", async () => {
    const user = userEvent.setup();
    render(
      <EnterpriseBusinessApplication initialSearch="?page=overview&section=operations" />,
    );

    await user.click(screen.getByText("更多筛选"));

    await user.selectOptions(
      screen.getByRole("combobox", { name: "业务类型" }),
      "market",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "业务分类" }),
      "market.quote-trade",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "地区层级" }),
      "county",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "经营期间" }),
      "2025-W31",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "产品或作物" }),
      "corn",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "具体品种" }),
      "jingke-968",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "数据状态" }),
      "preliminary",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "采用数据" }),
      "METRIC-2026-W31-V3",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "风险状态" }),
      "warning",
    );

    expect(window.location.search).not.toMatch(
      /businessDomain|businessSubtype|regionLevel|region=|period=|product=|cultivar=|dataLayer|releaseVersion|riskState/,
    );
  });

  it("does not accept inconsistent region coordinates from a shared URL", () => {
    render(
      <EnterpriseBusinessApplication initialSearch="?page=overview&section=operations&region=qiqihar-nehe&regionLevel=city&period=2026-W31" />,
    );

    expect(screen.getByRole("combobox", { name: "授权地区" })).toHaveValue(
      "authorized-all",
    );
    expect(document.body).not.toHaveTextContent(/qiqihar-nehe|2026-W31/);
  });

  it("ignores unsupported executive URL coordinates with no raw-code echo", () => {
    render(
      <EnterpriseBusinessApplication initialSearch="?page=overview&section=operations&businessDomain=bogus-domain&riskState=bogus-risk&period=2026-W31" />,
    );

    expect(document.body).not.toHaveTextContent(/bogus-domain|bogus-risk/);
    expect(screen.getByRole("combobox", { name: "经营期间" })).toHaveValue("");
  });

  it("drops an invalid executive period supplied through the URL", () => {
    render(
      <EnterpriseBusinessApplication initialSearch="?page=overview&section=operations&period=unsupported-period" />,
    );

    expect(screen.getByRole("combobox", { name: "经营期间" })).toHaveValue("");
    expect(screen.getByRole("alert")).toHaveTextContent("请选择经营期间");
    expect(document.body).not.toHaveTextContent("unsupported-period");
  });

  it("restores the replaced page filter across application Back and Forward", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/?page=production&section=tasks");
    render(
      <EnterpriseBusinessApplication initialSearch="?page=production&section=tasks" />,
    );

    const product = screen.getByRole("combobox", { name: "产品或作物" });
    await user.selectOptions(product, "soybean");
    expect(window.location.search).not.toContain("product=soybean");

    await user.click(
      within(screen.getByRole("navigation", { name: "业务应用" })).getByRole(
        "button",
        { name: "市场监测" },
      ),
    );
    expect(window.location.search).toBe("");
    expect(decodeURIComponent(window.location.hash)).toBe(
      "#/市场监测/玉米市场采集",
    );

    window.history.back();
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "产品或作物" })).toHaveValue(
        "soybean",
      );
    });

    window.history.forward();
    await waitFor(() => {
      expect(screen.getByLabelText("选择地区")).toHaveTextContent("请选择地区");
    });
  });

  it("renders authorized classification catalog entries in the visible scope filter", () => {
    render(
      <EnterpriseBusinessApplication initialSearch="?page=production&section=tasks" />,
    );

    expect(
      screen.queryByRole("combobox", { name: "业务分类" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("种植生产").length).toBeGreaterThan(0);
    expect(document.body).not.toHaveTextContent("市场库存");
  });

  it("uses only authorized regions and domain-specific governed classifications", async () => {
    const user = userEvent.setup();
    const cases = [
      ["?page=overview&section=operations", "种植生产", null],
      ["?page=work&section=tasks", "种植生产", null],
      ["?page=production&section=tasks", "种植生产", "报价与交易"],
      ["?page=market&section=tasks", "报价与交易", "种植生产"],
    ] as const;

    for (const [search, expected, excluded] of cases) {
      cleanup();
      render(<EnterpriseBusinessApplication initialSearch={search} />);
      if (search.startsWith("?page=work")) {
        await user.click(screen.getByRole("button", { name: "更多筛选" }));
      }
      if (search.startsWith("?page=overview")) {
        await user.click(screen.getByText("更多筛选"));
      }
      const classification = screen.queryByRole("combobox", {
        name: "业务分类",
      });
      if (classification) {
        expect(
          within(classification).getByRole("option", { name: expected }),
        ).toBeVisible();
        if (excluded) {
          expect(
            within(classification).queryByRole("option", { name: excluded }),
          ).not.toBeInTheDocument();
        }
      } else {
        expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
        if (excluded) expect(document.body).not.toHaveTextContent(excluded);
      }
      expect(
        within(
          screen.getByRole("combobox", { name: /^(产品或作物|产品或品类)$/ }),
        ).queryByRole("option", { name: "产品名称未提供" }),
      ).not.toBeInTheDocument();
      const region = screen.queryByRole("combobox", {
        name: /^(授权地区|业务地区|报告地区)$/,
      });
      if (region) {
        expect(
          within(region).getByRole("option", {
            name: /全部(?:地区|已授权范围)/,
          }),
        ).toHaveValue("authorized-all");
        expect(
          within(region).getByRole("option", { name: /黑河/ }),
        ).toBeVisible();
      }
      if (search.startsWith("?page=overview")) {
        expect(
          within(screen.getByRole("combobox", { name: "地区层级" })).getByRole(
            "option",
            { name: "市域" },
          ),
        ).toBeVisible();
      }
    }

    cleanup();
    render(
      <EnterpriseBusinessApplication initialSearch="?page=supply&section=calculation" />,
    );
    await user.click(
      within(screen.getByRole("group", { name: "业务地区" })).getByLabelText(
        "选择地区",
      ),
    );
    expect(
      within(screen.getByLabelText("地市选项")).getByRole("button", {
        name: "黑河市",
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("combobox", { name: "产品账户" })).getByRole(
        "option",
        { name: "小麦原粮" },
      ),
    ).toBeVisible();

    cleanup();
    render(
      <EnterpriseBusinessApplication initialSearch="?page=reporting&section=compose" />,
    );
    await user.click(await screen.findByLabelText("选择地区"));
    expect(
      within(screen.getByLabelText("地市选项")).getByRole("button", {
        name: "黑河市",
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("combobox", { name: "业务类型" })).getByRole(
        "option",
        { name: "供需与态势" },
      ),
    ).toBeVisible();
  });

  it("keeps production analysis and reporting flows reachable within formal sections", async () => {
    const user = userEvent.setup();
    render(
      <EnterpriseBusinessApplication initialSearch="?page=production&section=tasks" />,
    );

    await user.click(
      within(
        screen.getByRole("navigation", { name: "产情监测模块" }),
      ).getByRole("button", { name: "产情分析" }),
    );
    expect(screen.getByRole("heading", { name: "产情监测分析" })).toBeVisible();

    window.history.replaceState({}, "", "/?page=reporting&section=compose");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await user.click(screen.getByRole("tab", { name: "履责报告" }));
    expect(screen.getByRole("heading", { name: "履责报告" })).toBeVisible();
  });

  it("opens an approved report search result at the exact nine-field compose scope", async () => {
    const user = userEvent.setup();
    render(
      <EnterpriseBusinessApplication initialSearch="?page=overview&section=operations" />,
    );

    await user.type(
      screen.getByRole("searchbox", { name: "全局搜索" }),
      "齐齐哈尔市全域玉米供需平衡分析报告",
    );
    await user.click(
      screen.getByRole("option", {
        name: /齐齐哈尔市全域玉米供需平衡分析报告.*报告数据/,
      }),
    );

    expect(decodeURIComponent(window.location.hash)).toBe(
      "#/报表中心/业务报告",
    );
    expect(
      await screen.findByText("已按所选已核定数据精确带入报告生成条件。"),
    ).toBeVisible();
    expect(screen.getByRole("combobox", { name: "业务类型" })).toHaveValue(
      "supply",
    );
    await user.click(screen.getByRole("button", { name: "更多条件" }));
    expect(screen.getByRole("combobox", { name: "业务分类" })).toHaveValue(
      "supply.results",
    );
    expect(screen.getByLabelText("选择地区")).toHaveTextContent("齐齐哈尔市");
    expect(screen.getByRole("combobox", { name: "产品或专题" })).toHaveValue(
      "corn",
    );
    expect(screen.getByRole("combobox", { name: "具体品种" })).toHaveValue(
      "not-applicable",
    );
    expect(screen.getByRole("combobox", { name: "报告频率" })).toHaveValue(
      "月报",
    );
    expect(screen.getByRole("combobox", { name: "报告期间" })).toHaveValue(
      "2026/27营销年度",
    );
    expect(screen.getByRole("combobox", { name: "报告模板" })).toHaveValue(
      "供需平衡分析报告",
    );
    expect(screen.getByRole("combobox", { name: "采用数据" })).toHaveValue(
      "SUPPLY-2026-MY-APPROVED",
    );
    expect(screen.getByRole("button", { name: "生成报告" })).toBeEnabled();
    expect(document.body).not.toHaveTextContent("SUPPLY-2026-MY-APPROVED");
  });

  it("keeps report workflow actions within the current identity permissions", async () => {
    const user = userEvent.setup();
    window.localStorage.removeItem("齐齐哈尔粮食商情业务报告工作流-业务真值三");
    const draftOnlyIdentity: OperationalScopeIdentity = {
      ...fixtureOperationalIdentity,
      authorization: {
        ...fixtureOperationalIdentity.authorization,
        permissionKeys: ["enterprise:fixtures:read", "report.draft.save"],
      },
    };
    render(
      <EnterpriseBusinessApplication
        initialSearch="?page=overview&section=operations"
        operationalIdentity={draftOnlyIdentity}
      />,
    );

    await user.type(
      screen.getByRole("searchbox", { name: "全局搜索" }),
      "齐齐哈尔市全域玉米种植生产监测报告",
    );
    await user.click(
      screen.getByRole("option", {
        name: /齐齐哈尔市全域玉米种植生产监测报告.*报告数据/,
      }),
    );
    await user.click(screen.getByRole("button", { name: "生成报告" }));
    expect(screen.getByRole("dialog", { name: "编制业务报告" })).toBeVisible();
    const saveDraft = screen.getByRole("button", { name: "保存草稿" });
    expect(saveDraft).toBeEnabled();
    await user.click(saveDraft);

    expect(await screen.findByText("草稿已保存")).toBeVisible();
    expect(screen.getByRole("button", { name: "送审" })).toBeDisabled();
  });

  it("opens a report work item at its explicitly mapped workflow instance", async () => {
    const user = userEvent.setup();
    render(
      <EnterpriseBusinessApplication initialSearch="?page=overview&section=operations" />,
    );

    await user.type(
      screen.getByRole("searchbox", { name: "全局搜索" }),
      "第 31 周粮食商情报告审核与分发",
    );
    await user.click(
      screen.getByRole("option", {
        name: /第 31 周粮食商情报告审核与分发.*业务任务/,
      }),
    );

    expect(decodeURIComponent(window.location.hash)).toBe(
      "#/报表中心/报告审核与发布",
    );
    expect(
      screen.getByRole("heading", { name: "发布与分发", level: 1 }),
    ).toBeVisible();
    expect(screen.getByRole("tab", { name: "报告分发" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const detail = screen.getByRole("region", { name: "报告发布详情" });
    expect(detail).toHaveTextContent("第31周粮食商情周报");
    expect(detail).toHaveTextContent("齐齐哈尔市全域");
    expect(document.body).not.toHaveTextContent("WORK-REPORT-REVIEW-W31");
  });

  it("keeps application navigation and report subviews keyboard operable", async () => {
    const user = userEvent.setup();
    render(
      <EnterpriseBusinessApplication initialSearch="?page=production&section=tasks" />,
    );

    const productionNavigation = screen.getByRole("navigation", {
      name: "产情监测模块",
    });
    const analysis = within(productionNavigation).getByRole("button", {
      name: "产情分析",
    });
    analysis.focus();
    await user.keyboard("{Enter}");
    expect(
      within(
        screen.getByRole("navigation", { name: "产情监测模块" }),
      ).getByRole("button", { name: "产情分析" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "产情监测分析" })).toBeVisible();

    window.history.replaceState({}, "", "/?page=reporting&section=compose");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    const business = screen.getByRole("tab", { name: "业务报告" });
    expect(business).toHaveAttribute("aria-selected", "true");
    await user.click(business);
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "履责报告" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel", { name: "履责报告" })).toBeVisible();
  });

  it("keeps market, reporting distribution, and work queues inside formal sections", async () => {
    const user = userEvent.setup();
    render(
      <EnterpriseBusinessApplication initialSearch="?page=market&section=tasks" />,
    );

    await user.click(
      within(
        screen.getByRole("navigation", { name: "市场监测模块" }),
      ).getByRole("button", { name: "玉米市场采集" }),
    );
    expect(
      screen.getByRole("heading", { name: "玉米市场采集表" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "新建采集记录" })).toBeVisible();
    await user.click(
      within(
        screen.getByRole("navigation", { name: "市场监测模块" }),
      ).getByRole("button", { name: "市场分析" }),
    );
    expect(screen.getByRole("heading", { name: "市场监测分析" })).toBeVisible();

    window.history.replaceState(
      {},
      "",
      "/?page=reporting&section=review-distribution",
    );
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await user.click(screen.getByRole("tab", { name: "报告分发" }));
    expect(screen.getByRole("heading", { name: "发布与分发" })).toBeVisible();

    window.history.replaceState({}, "", "/?page=work&section=tasks");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    const reviewView = within(
      screen.getByRole("navigation", { name: "我的工作模块" }),
    ).getByRole("button", { name: "待我处理" });
    await user.click(reviewView);
    expect(reviewView).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("table", { name: "本人工作台账" })).toBeVisible();
  });

  it("deep-links My Work review and record actions to their owning workflow subviews", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/?page=work");
    render(<EnterpriseBusinessApplication initialSearch="?page=work" />);

    await user.click(
      within(
        screen.getByRole("navigation", { name: "我的工作模块" }),
      ).getByRole("button", { name: "待我处理" }),
    );
    await user.click(
      within(
        screen.getByRole("row", {
          name: /齐齐哈尔市玉米市场运行周填报/,
        }),
      ).getByRole("button", { name: "继续市场填报" }),
    );
    expect(window.location.search).toBe("");
    expect(decodeURIComponent(window.location.hash)).toBe(
      "#/市场监测/采集任务",
    );
    expect(window.location.search).not.toMatch(
      /selectionType|selectionId|WORK-/,
    );
    expect(screen.getByRole("heading", { name: "市场任务作业" })).toBeVisible();
    expect(screen.getByRole("region", { name: /单据工作台/ })).toBeVisible();

    window.history.back();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "待我处理" })).toBeVisible();
    });

    window.history.forward();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "市场任务作业" }),
      ).toBeVisible();
    });

    window.history.replaceState({}, "", "/?page=work");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await user.click(screen.getByRole("button", { name: "补充产情填报" }));
    expect(window.location.search).toBe("");
    expect(decodeURIComponent(window.location.hash)).toBe(
      "#/产情监测/产情任务",
    );
    expect(window.location.search).not.toMatch(/selectionId|WORK-/);
    expect(screen.getByRole("heading", { name: "产情任务作业" })).toBeVisible();
    expect(screen.getByRole("region", { name: /单据工作台/ })).toBeVisible();
  });

  it("opens a supply work-item selection at its exact account and review task", async () => {
    const user = userEvent.setup();
    render(<EnterpriseBusinessApplication initialSearch="?page=work" />);

    await user.click(
      within(
        screen.getByRole("navigation", { name: "我的工作模块" }),
      ).getByRole("button", { name: "待我处理" }),
    );
    const supplyRow = screen.getByRole("row", {
      name: /2026 年玉米供需差额说明复核/,
    });
    await user.click(
      within(supplyRow).getByRole("button", { name: "复核供需说明" }),
    );

    expect(decodeURIComponent(window.location.hash)).toBe(
      "#/供需分析/供需测算",
    );
    expect(
      screen.getByRole("region", { name: "当前供需复核任务" }),
    ).toHaveTextContent("2026 年玉米供需差额说明复核");
    const region = screen.getByRole("group", { name: "业务地区" });
    expect(within(region).getByLabelText("选择地区")).toHaveTextContent(
      "齐齐哈尔市",
    );
    expect(screen.getByRole("combobox", { name: "产品账户" })).toHaveValue(
      "corn",
    );
    expect(screen.getByRole("combobox", { name: "营销年度" })).toHaveValue(
      "2026-27",
    );
    expect(screen.getByRole("combobox", { name: "账户核定记录" })).toHaveValue(
      "approval-2",
    );
    expect(screen.getByText("已按当前条件完成查询")).toBeVisible();
    expect(screen.getByText("当前筛选范围尚无已核定供需账户")).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "本次供需测算结果" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编制供需报告" })).toBeDisabled();
  });

  it("persists an approved supply explanation from the exact requested task", async () => {
    const user = userEvent.setup();
    render(<EnterpriseBusinessApplication initialSearch="?page=work" />);

    await user.click(
      within(
        screen.getByRole("navigation", { name: "我的工作模块" }),
      ).getByRole("button", { name: "待我处理" }),
    );
    await user.click(
      within(
        screen.getByRole("row", {
          name: /2026 年玉米供需差额说明复核/,
        }),
      ).getByRole("button", { name: "复核供需说明" }),
    );
    const task = screen.getByRole("region", { name: "当前供需复核任务" });
    await user.click(within(task).getByRole("button", { name: "审核通过" }));

    expect(task).toHaveTextContent("供需说明审核已通过，审核记录已保存");
    await waitFor(() => {
      const raw = window.localStorage.getItem(
        fixtureOperationalStateStorageKey,
      );
      const stored = raw
        ? (JSON.parse(raw) as {
            state: {
              workItems: readonly {
                workId: string;
                reviewStatus: string;
                qualityStatus: string;
              }[];
            };
          })
        : null;
      expect(
        stored?.state.workItems.find(
          ({ workId }) => workId === "WORK-SUPPLY-EXPLANATION-2026",
        ),
      ).toMatchObject({ reviewStatus: "approved", qualityStatus: "warning" });
    });
  });

  it("moves a submitted market item out of the responsible queue while preserving its domain state", async () => {
    const user = userEvent.setup();
    render(<EnterpriseBusinessApplication initialSearch="?page=work" />);

    await user.click(
      within(
        screen.getByRole("navigation", { name: "我的工作模块" }),
      ).getByRole("button", { name: "待我处理" }),
    );
    await user.click(
      within(
        screen.getByRole("row", {
          name: /齐齐哈尔市玉米市场运行周填报/,
        }),
      ).getByRole("button", { name: "继续市场填报" }),
    );

    while (
      screen.queryAllByRole("button", { name: /确认.+章节来源值/ }).length > 0
    ) {
      await user.click(
        screen.getAllByRole("button", { name: /确认.+章节来源值/ })[0],
      );
    }
    await user.click(screen.getByRole("button", { name: "执行提交前检查" }));
    await user.click(screen.getByRole("button", { name: "提交审核" }));
    expect(screen.getByLabelText("任务五状态")).toHaveTextContent("已提交");

    await user.click(
      within(screen.getByRole("navigation", { name: "业务应用" })).getByRole(
        "button",
        { name: "我的工作" },
      ),
    );
    expect(
      screen.queryByRole("row", {
        name: /齐齐哈尔市玉米市场运行周填报/,
      }),
    ).not.toBeInTheDocument();

    await user.click(
      within(screen.getByRole("navigation", { name: "业务应用" })).getByRole(
        "button",
        { name: "市场监测" },
      ),
    );
    await user.click(
      within(
        screen.getByRole("navigation", { name: "市场监测模块" }),
      ).getByRole("button", { name: "玉米市场采集" }),
    );
    const marketRow = screen.getByRole("row", {
      name: /龙江县玉米贸易监测组/,
    });
    expect(marketRow).toHaveTextContent("待审核");
    await user.click(
      within(marketRow).getByRole("button", { name: "查看记录" }),
    );
    expect(screen.getByLabelText("任务五状态")).toHaveTextContent("已提交");
    expect(screen.getByLabelText("任务五状态")).toHaveTextContent("待审核");
  });

  it("keeps production corrections and submission state across application navigation", async () => {
    const user = userEvent.setup();
    render(
      <EnterpriseBusinessApplication initialSearch="?page=production&section=tasks" />,
    );

    await user.click(screen.getByRole("button", { name: "补充产情填报" }));
    const yieldInput = screen.getByRole("textbox", { name: "预计单产" });
    await user.clear(yieldInput);
    await user.type(yieldInput, "470.0 公斤/亩");
    while (
      screen.queryAllByRole("button", { name: "确认本章节来源值" }).length > 0
    ) {
      await user.click(
        screen.getAllByRole("button", { name: "确认本章节来源值" })[0],
      );
    }
    await user.click(screen.getByRole("button", { name: "保存更正草稿" }));
    await user.click(screen.getByRole("button", { name: "执行提交前检查" }));
    await user.click(screen.getByRole("button", { name: "重新提交审核" }));
    expect(screen.getByLabelText("任务五状态")).toHaveTextContent("已提交");

    await user.click(
      within(screen.getByRole("navigation", { name: "业务应用" })).getByRole(
        "button",
        { name: "我的工作" },
      ),
    );
    await user.click(
      within(
        screen.getByRole("navigation", { name: "我的工作模块" }),
      ).getByRole("button", { name: "待我处理" }),
    );
    const productionRow = screen.getByRole("row", {
      name: /讷河市玉米长势与测产调查/,
    });
    expect(productionRow).toHaveTextContent("已提交");
    expect(productionRow).toHaveTextContent("待审核");
    expect(productionRow).toHaveTextContent("26/26 项");

    await user.click(
      within(screen.getByRole("navigation", { name: "业务应用" })).getByRole(
        "button",
        { name: "产情监测" },
      ),
    );
    await user.click(
      within(
        screen.getByRole("row", {
          name: /讷河市同义镇保国村村委会/,
        }),
      ).getByRole("button", { name: "查看记录" }),
    );
    expect(screen.getByRole("textbox", { name: "预计单产" })).toHaveValue(
      "470.0 公斤/亩",
    );
  });

  it("restores a saved production draft after a full prototype remount", async () => {
    const user = userEvent.setup();
    const firstMount = render(
      <EnterpriseBusinessApplication initialSearch="?page=production&section=tasks" />,
    );

    await user.click(screen.getByRole("button", { name: "补充产情填报" }));
    const yieldInput = screen.getByRole("textbox", { name: "预计单产" });
    await user.clear(yieldInput);
    await user.type(yieldInput, "472.5 公斤/亩");
    await user.click(screen.getByRole("button", { name: "保存更正草稿" }));
    firstMount.unmount();

    render(
      <EnterpriseBusinessApplication initialSearch="?page=production&section=tasks" />,
    );
    await user.click(
      within(
        screen.getByRole("row", {
          name: /讷河市玉米长势与测产调查/,
        }),
      ).getByRole("button", { name: "继续产情填报" }),
    );
    expect(screen.getByRole("textbox", { name: "预计单产" })).toHaveValue(
      "472.5 公斤/亩",
    );
  });

  it("loads persisted object registries instead of reconstructing them on refresh", () => {
    const initial = createDefaultFixtureOperationalState();
    const firstMarketObject = initial.marketRegistryObjects[0];
    expect(firstMarketObject).toBeDefined();
    const saved = {
      ...initial,
      marketRegistryObjects: initial.marketRegistryObjects.map((object) =>
        object.objectId === firstMarketObject?.objectId
          ? { ...object, objectName: "持久化后的市场监测对象名称" }
          : object,
      ),
    };
    expect(saveFixtureOperationalState(window.localStorage, saved)).toEqual({
      status: "saved",
    });

    render(
      <EnterpriseBusinessApplication initialSearch="?page=market&section=objects" />,
    );

    expect(screen.getByText("持久化后的市场监测对象名称")).toBeVisible();
  });

  it("preserves damaged local state and shows an explicit Chinese recovery action", () => {
    const damaged = "{not-json";
    window.localStorage.setItem(fixtureOperationalStateStorageKey, damaged);

    render(<EnterpriseBusinessApplication initialSearch="?page=work" />);

    expect(
      screen.getByRole("alert", { name: "工作状态恢复提示" }),
    ).toHaveTextContent("业务工作状态无法读取，原始数据已保留且未被覆盖。");
    expect(screen.getByRole("button", { name: "重建工作状态" })).toBeVisible();
    expect(window.localStorage.getItem(fixtureOperationalStateStorageKey)).toBe(
      damaged,
    );
  });
});
