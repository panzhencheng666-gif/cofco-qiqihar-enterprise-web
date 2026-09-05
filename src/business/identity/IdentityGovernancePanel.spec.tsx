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
import type {
  BusinessAuditQuery,
  CurrentSession,
  EmployeeProfile,
  IdentityAssignmentOptions,
  IdentityInvitationReceipt,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";
import { IdentityGovernancePanel } from "./IdentityGovernancePanel";

afterEach(cleanup);

const session: CurrentSession = {
  subjectId: "identity-admin",
  displayName: "李主任",
  workUnitCode: "QIQIHAR_BUSINESS",
  workUnitName: "齐齐哈尔经营部",
  accountStatus: "ACTIVE",
  employmentStatus: "ACTIVE",
  roleCodes: ["BUSINESS_REVIEWER"],
  positions: [
    { code: "UNIT_MANAGER", name: "单位负责人", primaryPosition: true },
  ],
  permissions: [
    "IDENTITY_READ",
    "IDENTITY_ADMIN",
    "FORMAL_SAMPLE_MANAGE",
    "ACCESS_REVIEW",
    "AUDIT_READ",
  ],
  regionCodes: ["230200"],
};

function assignmentRegions(regionCodes: readonly string[]) {
  const fixtures = {
    "230202001": {
      code: "230202001",
      name: "测试乡镇",
      administrativeLevel: "TOWNSHIP" as const,
      parentCode: "230202",
    },
    "230208001": {
      code: "230208001",
      name: "测试乡镇二",
      administrativeLevel: "TOWNSHIP" as const,
      parentCode: "230208",
    },
    "230281101": {
      code: "230281101",
      name: "讷河责任乡镇",
      administrativeLevel: "TOWNSHIP" as const,
      parentCode: "230281",
    },
  };
  return regionCodes.map((code) => fixtures[code as keyof typeof fixtures]);
}

function invitationReceiptFor(
  employee: EmployeeProfile,
): IdentityInvitationReceipt {
  return {
    ...employee,
    accountStatus: "INVITED",
    version: 0,
    contractVersion: "2026-08-30",
    invitationId: "invite-default",
    invitationStatus: "PENDING",
    deliveryStatus: "QUEUED",
    expiresAt: "2026-08-31T00:00:00Z",
    replayed: false,
  };
}

function repository() {
  const employee: EmployeeProfile = {
    subjectId: "employee-1",
    displayName: "张敏",
    workUnitCode: "QIQIHAR_BUSINESS",
    workUnitName: "齐齐哈尔经营部",
    accountStatus: "ACTIVE",
    employmentStatus: "ACTIVE",
    roles: [{ code: "BUSINESS_OPERATOR", name: "填报员" }],
    positions: [
      {
        code: "REGIONAL_REPORTER",
        name: "区域填报专员",
        primaryPosition: true,
      },
    ],
    regionCodes: ["230202001"],
    version: 3,
  };
  const review = {
    reviewId: "review-1",
    name: "三季度权限复核",
    workUnitCode: "QIQIHAR_BUSINESS",
    statusCode: "OPEN" as const,
    dueAt: "2026-09-30T16:00:00Z",
    createdBy: "identity-admin",
    createdAt: "2026-08-10T00:00:00Z",
    items: [
      {
        subjectId: "identity-admin",
        grantType: "ROLE" as const,
        grantKey: "BUSINESS_REVIEWER",
        decisionCode: "PENDING" as const,
        decidedBy: null,
        decidedAt: null,
        reason: null,
      },
      {
        subjectId: "employee-1",
        grantType: "REGION" as const,
        grantKey: "230202001",
        decisionCode: "PENDING" as const,
        decidedBy: null,
        decidedAt: null,
        reason: null,
      },
    ],
  };
  const invitationReceipt = invitationReceiptFor(employee);
  const api = {
    loadMasterData: vi.fn(() =>
      Promise.resolve({
        products: [],
        periods: [],
        approvedSurveyYears: [2026],
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
          {
            code: "230208",
            name: "梅里斯达区",
            parentCode: "230200",
            level: "COUNTY",
          },
          {
            code: "230202001",
            name: "测试乡镇",
            parentCode: "230202",
            level: "TOWNSHIP",
          },
          {
            code: "230208001",
            name: "测试乡镇二",
            parentCode: "230208",
            level: "TOWNSHIP",
          },
        ],
      }),
    ),
    listEmployees: vi.fn(() => Promise.resolve([employee])),
    loadAssignmentOptions: vi.fn((_workUnitCode?: string) => {
      void _workUnitCode;
      return Promise.resolve<IdentityAssignmentOptions>({
        workUnits: [{ code: "QIQIHAR_BUSINESS", name: "齐齐哈尔经营部" }],
        roles: [
          { code: "BUSINESS_OPERATOR", name: "填报员" },
          { code: "BUSINESS_REVIEWER", name: "管理员" },
        ],
        positions: [{ code: "REGIONAL_REPORTER", name: "区域填报专员" }],
        regionCodes: ["230202001", "230208001"],
        regions: assignmentRegions(["230202001", "230208001"]),
      });
    }),
    inviteEmployee: vi.fn(
      (_input: Parameters<RealtimeBusinessRepository["inviteEmployee"]>[0]) => {
        void _input;
        return Promise.resolve(invitationReceipt);
      },
    ),
    loadEmployeeInvitation: vi.fn((_subjectId: string) => {
      void _subjectId;
      return Promise.resolve(invitationReceipt);
    }),
    revokeInvitation: vi.fn(() =>
      Promise.resolve({
        ...invitationReceipt,
        invitationStatus: "REVOKED" as const,
      }),
    ),
    reissueInvitation: vi.fn(
      (
        _input: Parameters<RealtimeBusinessRepository["reissueInvitation"]>[0],
      ) => {
        void _input;
        return Promise.resolve({
          ...invitationReceipt,
          invitationId: "invite-reissued",
        });
      },
    ),
    updateEmployee: vi.fn(() =>
      Promise.resolve({ ...employee, accountStatus: "SUSPENDED", version: 4 }),
    ),
    listAccessReviews: vi.fn(() => Promise.resolve([review])),
    createAccessReview: vi.fn(() => Promise.resolve(review)),
    decideAccessReview: vi.fn(() =>
      Promise.resolve({
        ...review,
        statusCode: "COMPLETED" as const,
        items: [
          {
            ...review.items[0],
            decisionCode: "RETAIN" as const,
            decidedBy: "identity-admin",
            decidedAt: "2026-08-10T00:10:00Z",
            reason: "责任区域继续有效",
          },
        ],
      }),
    ),
    listAuditEvents: vi.fn((input: BusinessAuditQuery = {}) => {
      void input;
      return Promise.resolve({
        items: [
          {
            eventId: "audit-1",
            aggregateType: "SECURITY_USER",
            aggregateId: "employee-1",
            actionCode: "SECURITY_USER_UPDATED",
            actorSubjectId: "identity-admin",
            actorDisplayName: "李主任",
            workUnitCode: "QIQIHAR_BUSINESS",
            workUnitName: "齐齐哈尔经营部",
            occurredAt: "2026-08-10T01:02:03Z",
            detailJson: "{}",
          },
          {
            eventId: "audit-local-runtime",
            aggregateType: "BUSINESS_RECORD",
            aggregateId: "LOCAL_DEV",
            actionCode: "BUSINESS_RECORD_UPDATED",
            actorSubjectId: "identity-admin",
            actorDisplayName: "李主任",
            workUnitCode: "QIQIHAR_BUSINESS",
            workUnitName: "齐齐哈尔经营部",
            occurredAt: "2026-08-10T01:03:03Z",
            detailJson: "{}",
          },
        ],
        pageNumber: 0,
        pageSize: 50,
        totalElements: 2,
        totalPages: 1,
      });
    }),
  };
  return api;
}

describe("IdentityGovernancePanel", () => {
  it("opens the authenticated work unit as a real organization responsibility view", async () => {
    const user = userEvent.setup();
    render(
      <IdentityGovernancePanel
        initialView="organization"
        onClose={vi.fn()}
        repository={repository() as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );

    expect(screen.getByRole("button", { name: "当前单位" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const unit = screen.getByRole("region", { name: "当前单位责任范围" });
    expect(
      within(unit).getByRole("heading", { name: "齐齐哈尔经营部" }),
    ).toBeVisible();
    expect(within(unit).queryByText("单位负责人")).not.toBeInTheDocument();
    expect(await within(unit).findByText("齐齐哈尔市")).toBeVisible();
    expect(within(unit).queryByText("230200")).not.toBeInTheDocument();
    expect(within(unit).getByText("李主任")).toBeVisible();

    await user.click(
      within(unit).getByRole("button", { name: "管理员工与授权" }),
    );
    expect(screen.getByRole("button", { name: "员工管理" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(await screen.findByText("张敏")).toBeVisible();
  });

  it("shows the authenticated account, organization and responsibility scope without obsolete positions", async () => {
    render(
      <IdentityGovernancePanel
        initialView="profile"
        onClose={vi.fn()}
        repository={repository() as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "账号与授权" });
    expect(
      within(dialog).getByRole("status", { name: "账号状态摘要" }),
    ).toBeVisible();
    expect(
      within(dialog).getByRole("heading", { name: "身份与任职" }),
    ).toBeVisible();
    expect(
      within(dialog).getByRole("heading", { name: "权限与责任范围" }),
    ).toBeVisible();
    expect(within(dialog).getAllByText("李主任")).toHaveLength(2);
    expect(within(dialog).getAllByText("齐齐哈尔经营部")).toHaveLength(2);
    expect(within(dialog).queryByText("单位负责人")).not.toBeInTheDocument();
    expect(await within(dialog).findByText("齐齐哈尔市")).toBeVisible();
    expect(
      within(dialog).queryByText("员工账号 identity-admin"),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByText("单位编码 QIQIHAR_BUSINESS"),
    ).not.toBeInTheDocument();
    expect(within(dialog).queryByText("230200")).not.toBeInTheDocument();
    expect(within(dialog).getAllByText("在职 · 账号正常")).toHaveLength(2);
    expect(within(dialog).getByText("管理员")).toBeVisible();
    expect(
      within(dialog).queryByText("IDENTITY_ADMIN"),
    ).not.toBeInTheDocument();
  });

  it("uses a row-based account summary and named responsibility regions", async () => {
    render(
      <IdentityGovernancePanel
        initialView="profile"
        onClose={vi.fn()}
        repository={repository() as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "账号与授权" });
    const summary = within(dialog).getByLabelText("账号资料");
    expect(summary.tagName).toBe("DL");
    expect(summary).toHaveAttribute("data-layout", "property-table");
    expect(within(dialog).getByLabelText("权限资料")).toHaveAttribute(
      "data-layout",
      "property-table",
    );
    expect(summary.querySelector("article")).toBeNull();
    expect(await screen.findByText("齐齐哈尔市")).toBeVisible();
    expect(screen.queryByText("齐齐哈尔市（230200）")).not.toBeInTheDocument();
  });

  it("links account security and posts logout with the server CSRF token", () => {
    document.cookie = "XSRF-TOKEN=csrf%20logout";
    render(
      <IdentityGovernancePanel
        identityManagementUrl="/identity/account"
        initialView="profile"
        logoutUrl="/api/v1/session/logout"
        onClose={vi.fn()}
        repository={repository() as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );

    expect(
      screen.getByRole("link", { name: "账号安全与登录设备" }),
    ).toHaveAttribute("href", "/identity/account");
    const button = screen.getByRole("button", { name: "退出登录" });
    const form = button.closest("form");
    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("action", "/api/v1/session/logout");
    expect(form?.querySelector('input[name="_csrf"]')).toHaveValue(
      "csrf logout",
    );
  });

  it("lets authorized administrators invite employees and change effective assignments", async () => {
    const user = userEvent.setup();
    const api = repository();
    render(
      <IdentityGovernancePanel
        initialView="employees"
        onClose={vi.fn()}
        repository={api as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );

    await screen.findByText("张敏");
    expect(screen.getByRole("table", { name: "员工授权清单" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "邀请员工" }));
    await user.type(screen.getByLabelText("员工账号"), "employee-88");
    await user.type(screen.getByLabelText("员工姓名"), "赵蕾");
    await user.type(
      screen.getByLabelText("邀请送达邮箱"),
      "employee-88@example.test",
    );
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(
      screen.queryByRole("group", { name: "岗位" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "填报员" }));
    await user.click(
      screen.getByRole("checkbox", { name: "责任地区 230202001" }),
    );
    await user.click(screen.getByRole("button", { name: "发送入职邀请" }));
    await waitFor(() =>
      expect(api.inviteEmployee).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectId: "employee-88",
          workUnitCode: "QIQIHAR_BUSINESS",
          positionCodes: [],
          regionCodes: ["230202001"],
        }),
      ),
    );

    await user.click(screen.getByRole("button", { name: "管理张敏的授权" }));
    await user.selectOptions(screen.getByLabelText("账号状态"), "SUSPENDED");
    await user.click(screen.getByRole("button", { name: "保存授权调整" }));
    await waitFor(() =>
      expect(api.updateEmployee).toHaveBeenCalledWith(
        "employee-1",
        expect.objectContaining({ version: 3, accountStatus: "SUSPENDED" }),
      ),
    );
  });

  it("lists authoritative units even when they have no employee", async () => {
    const api = repository();
    const units = [
      ["QIQIHAR_BUSINESS", "齐齐哈尔经营部"],
      ["NEHE_DEPOT", "讷河库"],
      ["KESHAN_DEPOT", "克山库"],
      ["KEDONG_DEPOT", "克东库"],
      ["LONGZHEN_DEPOT", "龙镇库"],
      ["CHENGJISIHAN_DEPOT", "成吉思汗库"],
    ].map(([code, name]) => ({ code, name }));
    const options = await api.loadAssignmentOptions();
    api.loadAssignmentOptions.mockResolvedValue({
      ...options,
      workUnits: units,
    });
    render(
      <IdentityGovernancePanel
        initialView="employees"
        onClose={vi.fn()}
        repository={api as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );
    await screen.findByText("张敏");
    const unitsPanel = screen.getByRole("complementary", { name: "组织单位" });
    expect(within(unitsPanel).getAllByRole("button")).toHaveLength(7);
    await userEvent.click(
      within(unitsPanel).getByRole("button", { name: "讷河库" }),
    );
    expect(screen.getByText("没有符合筛选条件的员工。")).toBeVisible();
  });

  it("filters the authoritative employee list and resets empty results", async () => {
    const user = userEvent.setup();
    const api = repository();
    render(
      <IdentityGovernancePanel
        initialView="employees"
        onClose={vi.fn()}
        repository={api as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );
    await screen.findByRole("row", { name: /张敏/u });
    await user.type(screen.getByLabelText("筛选员工姓名"), "不存在");
    expect(
      screen.queryByRole("row", { name: /张敏/u }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("没有符合筛选条件的员工。")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "重置筛选" }));
    expect(screen.getByRole("row", { name: /张敏/u })).toBeVisible();
    await user.selectOptions(
      screen.getByLabelText("筛选账号状态"),
      "SUSPENDED",
    );
    expect(
      screen.queryByRole("row", { name: /张敏/u }),
    ).not.toBeInTheDocument();
  });

  it("saves the complete region responsibility once and requeries employees", async () => {
    const user = userEvent.setup();
    const api = repository();
    const current = {
      subjectId: "employee-1",
      regionCodes: [],
      regions: [],
      samples: [],
      previewToken: "fresh-token",
    };
    const service = {
      ...api,
      loadRegionResponsibility: vi.fn().mockResolvedValue(current),
      previewRegionResponsibility: vi.fn().mockResolvedValue(current),
      saveRegionResponsibility: vi.fn().mockResolvedValue(current),
      assignFormalSampleMaintainer: vi.fn(),
    };
    render(
      <IdentityGovernancePanel
        initialView="employees"
        onClose={vi.fn()}
        repository={service as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );
    const employeeRow = await screen.findByRole("row", { name: /张敏/u });
    expect(within(employeeRow).getByText("未分配责任地区")).toBeVisible();
    await user.click(
      within(employeeRow).getByRole("button", { name: "设置负责地区" }),
    );
    const checkbox = await screen.findByRole("checkbox", {
      name: /测试乡镇$/u,
    });
    await waitFor(() =>
      expect(service.previewRegionResponsibility).toHaveBeenCalledTimes(1),
    );
    await user.click(checkbox);
    await user.type(screen.getByLabelText("调整原因"), "正式分工");
    await user.click(screen.getByRole("button", { name: "保存负责地区" }));
    await waitFor(() =>
      expect(service.saveRegionResponsibility).toHaveBeenCalledExactlyOnceWith(
        "employee-1",
        {
          regionCodes: ["230202001"],
          previewToken: "fresh-token",
          reason: "正式分工",
        },
      ),
    );
    expect(service.assignFormalSampleMaintainer).not.toHaveBeenCalled();
    await waitFor(() => expect(api.listEmployees).toHaveBeenCalledTimes(2));
  });

  it.each(["FORMAL_SAMPLE_POINT", "SECURITY_USER"])(
    "requeries employee responsibility after a %s event",
    async (aggregateType) => {
      let onEvent: Parameters<
        RealtimeBusinessRepository["subscribeBusinessEvents"]
      >[1] = () => undefined;
      const api = {
        ...repository(),
        listFormalSamplePoints: vi.fn().mockResolvedValue({
          items: [],
          pageNumber: 0,
          pageSize: 100,
          totalElements: 0,
          totalPages: 0,
        }),
        subscribeBusinessEvents: vi.fn(
          (
            _after: number,
            listener: Parameters<
              RealtimeBusinessRepository["subscribeBusinessEvents"]
            >[1],
          ) => {
            onEvent = listener;
            return vi.fn();
          },
        ),
      };

      render(
        <IdentityGovernancePanel
          initialView="employees"
          onClose={vi.fn()}
          repository={api as unknown as RealtimeBusinessRepository}
          session={session}
        />,
      );
      await waitFor(() => expect(api.listEmployees).toHaveBeenCalledTimes(1));

      act(() =>
        onEvent({
          id: "event-1",
          sequence: 1,
          aggregateType,
          aggregateId: "sample-1",
          actionCode: "FORMAL_SAMPLE_MAINTAINER_ASSIGNED",
          productCode: null,
          regionCodes: ["230202"],
          occurredAt: "2026-09-03T08:00:00Z",
          read: false,
        }),
      );

      await waitFor(() => expect(api.listEmployees).toHaveBeenCalledTimes(2));
    },
  );

  it("uses server-owned region levels and reports the real invitation delivery result", async () => {
    const user = userEvent.setup();
    const api = repository();
    api.loadMasterData.mockResolvedValue({
      products: [],
      periods: [],
      approvedSurveyYears: [2026],
      regions: [
        {
          code: "232700",
          name: "大兴安岭地区",
          parentCode: null,
          level: "PREFECTURE",
        },
        {
          code: "232761",
          name: "加格达奇区",
          parentCode: "232700",
          level: "COUNTY",
        },
      ],
    });
    api.loadAssignmentOptions.mockResolvedValue({
      workUnits: [{ code: "QIQIHAR_BUSINESS", name: "齐齐哈尔经营部" }],
      roles: [{ code: "BUSINESS_OPERATOR", name: "填报员" }],
      positions: [],
      regionCodes: ["232761"],
      regions: [
        {
          code: "232761",
          name: "加格达奇区",
          administrativeLevel: "COUNTY",
          parentCode: "232700",
        },
      ],
    });
    api.inviteEmployee.mockResolvedValue({
      subjectId: "jagdaqi-operator",
      displayName: "加格达奇填报员",
      workUnitCode: "QIQIHAR_BUSINESS",
      workUnitName: "齐齐哈尔经营部",
      accountStatus: "INVITED",
      employmentStatus: "ACTIVE",
      roles: [{ code: "BUSINESS_OPERATOR", name: "填报员" }],
      positions: [],
      regionCodes: ["232761"],
      version: 0,
      contractVersion: "2026-08-30",
      invitationId: "invite-001",
      invitationStatus: "PENDING",
      expiresAt: "2026-08-31T00:00:00Z",
      deliveryStatus: "QUEUED",
      replayed: false,
    });

    render(
      <IdentityGovernancePanel
        initialView="employees"
        onClose={vi.fn()}
        repository={api as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "邀请员工" }));
    expect(screen.getByRole("group", { name: "责任地区" })).toBeVisible();
    expect(screen.getByText("大兴安岭地区 / 加格达奇区")).toBeVisible();
    await user.type(screen.getByLabelText("员工账号"), "jagdaqi-operator");
    await user.type(screen.getByLabelText("员工姓名"), "加格达奇填报员");
    await user.type(
      screen.getByLabelText("邀请送达邮箱"),
      "operator@example.test",
    );
    await user.click(screen.getByRole("radio", { name: "填报员" }));
    await user.click(screen.getByRole("checkbox", { name: "责任地区 232761" }));
    await user.click(screen.getByRole("button", { name: "发送入职邀请" }));

    expect(await screen.findByText(/邀请已进入送达队列/)).toBeVisible();
    expect(screen.queryByText(/激活链接/)).not.toBeInTheDocument();
    expect(api.inviteEmployee).toHaveBeenCalledOnce();
    const invitationRequest = api.inviteEmployee.mock.calls[0][0];
    expect(invitationRequest.idempotencyKey).toMatch(/^identity-invite-/u);
    expect(invitationRequest).toMatchObject({
      deliveryAddress: "operator@example.test",
      regionCodes: ["232761"],
    });
  });

  it("uses assignment option names when the master-data label query fails", async () => {
    const user = userEvent.setup();
    const api = repository();
    api.loadMasterData.mockRejectedValue(
      new Error("label service unavailable"),
    );
    api.loadAssignmentOptions.mockResolvedValue({
      workUnits: [{ code: "QIQIHAR_BUSINESS", name: "齐齐哈尔经营部" }],
      roles: [{ code: "BUSINESS_OPERATOR", name: "填报员" }],
      positions: [],
      regionCodes: ["230202001", "232761"],
      regions: [
        {
          code: "230202001",
          name: "龙沙测试乡镇",
          administrativeLevel: "TOWNSHIP",
          parentCode: "230202",
        },
        {
          code: "232761",
          name: "加格达奇区",
          administrativeLevel: "COUNTY",
          parentCode: "232700",
        },
      ],
    });

    render(
      <IdentityGovernancePanel
        initialView="employees"
        onClose={vi.fn()}
        repository={api as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "邀请员工" }));
    const responsibilityRegions = screen.getByRole("group", {
      name: "责任地区",
    });

    expect(
      within(responsibilityRegions).getByText("龙沙测试乡镇"),
    ).toBeVisible();
    expect(within(responsibilityRegions).getByText("加格达奇区")).toBeVisible();
  });

  it("requeries and revokes the current invitation without exposing a secret", async () => {
    const user = userEvent.setup();
    const api = repository();
    const [employee] = await api.listEmployees();
    const pending = invitationReceiptFor(employee);
    const revoked = { ...pending, invitationStatus: "REVOKED" as const };
    api.listEmployees.mockResolvedValue([
      { ...employee, accountStatus: "INVITED" },
    ]);
    api.loadEmployeeInvitation
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(revoked);
    api.revokeInvitation.mockResolvedValue(revoked);

    render(
      <IdentityGovernancePanel
        initialView="employees"
        onClose={vi.fn()}
        repository={api as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "管理张敏的邀请" }),
    );
    expect(
      await screen.findByRole("heading", { name: "管理张敏的邀请" }),
    ).toBeVisible();
    expect(screen.getByText("等待激活 · 已进入送达队列")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "撤销当前邀请" }));

    expect(api.revokeInvitation).toHaveBeenCalledWith(pending.invitationId);
    await waitFor(() =>
      expect(api.loadEmployeeInvitation).toHaveBeenCalledTimes(2),
    );
    expect(await screen.findByText("已撤销 · 已进入送达队列")).toBeVisible();
    expect(screen.getByText("当前邀请已撤销。")).toBeVisible();
    expect(document.body).not.toHaveTextContent("activationUrl");
    expect(document.body).not.toHaveTextContent("token");
  });

  it("reissues an invitation with one idempotency key and reports the requery delivery state", async () => {
    const user = userEvent.setup();
    const api = repository();
    const [employee] = await api.listEmployees();
    const pending = invitationReceiptFor(employee);
    const revoked = { ...pending, invitationStatus: "REVOKED" as const };
    const reissued = {
      ...pending,
      invitationId: "invite-reissued",
      invitationStatus: "PENDING" as const,
      deliveryStatus: "QUEUED" as const,
    };
    api.listEmployees.mockResolvedValue([
      { ...employee, accountStatus: "INVITED" },
    ]);
    api.loadEmployeeInvitation
      .mockResolvedValueOnce(revoked)
      .mockResolvedValueOnce(reissued);
    api.reissueInvitation.mockResolvedValue(reissued);

    render(
      <IdentityGovernancePanel
        initialView="employees"
        onClose={vi.fn()}
        repository={api as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "管理张敏的邀请" }),
    );
    await user.type(
      await screen.findByLabelText("重新送达邮箱"),
      "employee-new@example.test",
    );
    await user.click(screen.getByRole("button", { name: "重新发送邀请" }));

    expect(api.reissueInvitation).toHaveBeenCalledOnce();
    const reissueRequest = api.reissueInvitation.mock.calls[0][0];
    expect(reissueRequest.idempotencyKey).toMatch(/^identity-reinvite-/u);
    expect(reissueRequest).toEqual({
      idempotencyKey: reissueRequest.idempotencyKey,
      subjectId: employee.subjectId,
      deliveryAddress: "employee-new@example.test",
    });
    await waitFor(() =>
      expect(api.loadEmployeeInvitation).toHaveBeenCalledTimes(2),
    );
    expect(await screen.findByText("等待激活 · 已进入送达队列")).toBeVisible();
    expect(screen.getByText("邀请已重新进入送达队列。")).toBeVisible();
    expect(document.body).not.toHaveTextContent("activationUrl");
    expect(document.body).not.toHaveTextContent("token");
  });

  it("rotates the idempotency key after a confirmed reissue", async () => {
    const user = userEvent.setup();
    const api = repository();
    const [employee] = await api.listEmployees();
    const revoked = {
      ...invitationReceiptFor(employee),
      invitationStatus: "REVOKED" as const,
    };
    const firstReissue = {
      ...invitationReceiptFor(employee),
      invitationId: "invite-reissued-first",
    };
    const secondReissue = {
      ...invitationReceiptFor(employee),
      invitationId: "invite-reissued-second",
    };
    api.listEmployees.mockResolvedValue([
      { ...employee, accountStatus: "INVITED" },
    ]);
    api.loadEmployeeInvitation
      .mockResolvedValueOnce(revoked)
      .mockResolvedValueOnce(firstReissue)
      .mockResolvedValueOnce(secondReissue);
    api.reissueInvitation
      .mockResolvedValueOnce(firstReissue)
      .mockResolvedValueOnce(secondReissue);

    render(
      <IdentityGovernancePanel
        initialView="employees"
        onClose={vi.fn()}
        repository={api as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "管理张敏的邀请" }),
    );
    const deliveryAddress = await screen.findByLabelText("重新送达邮箱");
    await user.type(deliveryAddress, "employee-first@example.test");
    await user.click(screen.getByRole("button", { name: "重新发送邀请" }));
    await waitFor(() => expect(api.reissueInvitation).toHaveBeenCalledOnce());

    await user.clear(deliveryAddress);
    await user.type(deliveryAddress, "employee-second@example.test");
    await user.click(screen.getByRole("button", { name: "重新发送邀请" }));
    await waitFor(() => expect(api.reissueInvitation).toHaveBeenCalledTimes(2));

    expect(api.reissueInvitation.mock.calls[0][0].idempotencyKey).not.toBe(
      api.reissueInvitation.mock.calls[1][0].idempotencyKey,
    );
  });

  it("does not apply a stale reissue result to another employee", async () => {
    const user = userEvent.setup();
    const api = repository();
    const [firstEmployee] = await api.listEmployees();
    const secondEmployee: EmployeeProfile = {
      ...firstEmployee,
      subjectId: "employee-2",
      displayName: "李强",
      accountStatus: "INVITED",
    };
    const firstPending = invitationReceiptFor({
      ...firstEmployee,
      accountStatus: "INVITED",
    });
    const firstReissued = {
      ...firstPending,
      invitationId: "invite-first-reissued",
      invitationStatus: "REVOKED" as const,
      deliveryStatus: "FAILED" as const,
    };
    const secondPending = {
      ...invitationReceiptFor(secondEmployee),
      invitationId: "invite-second",
      deliveryStatus: "DELIVERED" as const,
    };
    let resolveReissue: (receipt: IdentityInvitationReceipt) => void = () => {};
    const reissuePending = new Promise<IdentityInvitationReceipt>((resolve) => {
      resolveReissue = resolve;
    });
    let firstEmployeeLoads = 0;
    api.listEmployees.mockResolvedValue([
      { ...firstEmployee, accountStatus: "INVITED" },
      secondEmployee,
    ]);
    api.loadEmployeeInvitation.mockImplementation((subjectId) => {
      if (subjectId === firstEmployee.subjectId) {
        firstEmployeeLoads += 1;
        return Promise.resolve(
          firstEmployeeLoads === 1 ? firstPending : firstReissued,
        );
      }
      return Promise.resolve(secondPending);
    });
    api.reissueInvitation.mockReturnValue(reissuePending);

    render(
      <IdentityGovernancePanel
        initialView="employees"
        onClose={vi.fn()}
        repository={api as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "管理张敏的邀请" }),
    );
    await user.type(
      await screen.findByLabelText("重新送达邮箱"),
      "employee-first@example.test",
    );
    await user.click(screen.getByRole("button", { name: "重新发送邀请" }));
    await user.click(screen.getByRole("button", { name: "管理李强的邀请" }));
    expect(
      await screen.findByRole("heading", { name: "管理李强的邀请" }),
    ).toBeVisible();

    resolveReissue(firstReissued);
    await waitFor(() => expect(firstEmployeeLoads).toBe(2));

    expect(screen.getByText("等待激活 · 已送达")).toBeVisible();
    expect(screen.queryByText("已撤销 · 送达失败")).not.toBeInTheDocument();
  });

  it("reloads the selected work unit responsibility regions", async () => {
    const user = userEvent.setup();
    const api = repository();
    let resolveNehe: (options: IdentityAssignmentOptions) => void = () => {};
    const neheOptions = new Promise<IdentityAssignmentOptions>((resolve) => {
      resolveNehe = resolve;
    });
    api.loadAssignmentOptions.mockImplementation((workUnitCode?: string) => {
      const options = {
        workUnits: [
          { code: "QIQIHAR_BUSINESS", name: "齐齐哈尔经营部" },
          { code: "NEHE_DEPOT", name: "讷河库" },
        ],
        roles: [
          { code: "BUSINESS_OPERATOR", name: "填报员" },
          { code: "BUSINESS_REVIEWER", name: "管理员" },
        ],
        positions: [],
        regionCodes:
          workUnitCode === "NEHE_DEPOT" ? ["230281101"] : ["230202001"],
        regions: assignmentRegions(
          workUnitCode === "NEHE_DEPOT" ? ["230281101"] : ["230202001"],
        ),
      };
      return workUnitCode === "NEHE_DEPOT"
        ? neheOptions
        : Promise.resolve(options);
    });
    render(
      <IdentityGovernancePanel
        initialView="employees"
        onClose={vi.fn()}
        repository={api as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "邀请员工" }));
    await user.selectOptions(screen.getByLabelText("工作单位"), "NEHE_DEPOT");

    expect(
      screen.queryByRole("checkbox", { name: "责任地区 230202001" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("正在读取该单位的责任地区…")).toBeVisible();
    resolveNehe({
      workUnits: [
        { code: "QIQIHAR_BUSINESS", name: "齐齐哈尔经营部" },
        { code: "NEHE_DEPOT", name: "讷河库" },
      ],
      roles: [
        { code: "BUSINESS_OPERATOR", name: "填报员" },
        { code: "BUSINESS_REVIEWER", name: "管理员" },
      ],
      positions: [],
      regionCodes: ["230281101"],
      regions: assignmentRegions(["230281101"]),
    });
    expect(
      await screen.findByRole("checkbox", { name: "责任地区 230281101" }),
    ).toBeVisible();
    expect(api.loadAssignmentOptions).toHaveBeenLastCalledWith("NEHE_DEPOT");
  });

  it("loads an existing employee's own work unit before editing responsibility townships", async () => {
    const user = userEvent.setup();
    const api = repository();
    const [employee] = await api.listEmployees();
    api.listEmployees.mockResolvedValue([
      {
        ...employee,
        workUnitCode: "NEHE_DEPOT",
        workUnitName: "讷河库",
        regionCodes: ["230281101"],
      },
    ]);
    api.loadAssignmentOptions.mockImplementation((workUnitCode?: string) =>
      Promise.resolve({
        workUnits: [
          { code: "QIQIHAR_BUSINESS", name: "齐齐哈尔经营部" },
          { code: "NEHE_DEPOT", name: "讷河库" },
        ],
        roles: [
          { code: "BUSINESS_OPERATOR", name: "填报员" },
          { code: "BUSINESS_REVIEWER", name: "管理员" },
        ],
        positions: [],
        regionCodes:
          workUnitCode === "NEHE_DEPOT" ? ["230281101"] : ["230202001"],
        regions: assignmentRegions(
          workUnitCode === "NEHE_DEPOT" ? ["230281101"] : ["230202001"],
        ),
      }),
    );
    render(
      <IdentityGovernancePanel
        initialView="employees"
        onClose={vi.fn()}
        repository={api as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "管理张敏的授权" }),
    );

    expect(
      await screen.findByRole("checkbox", { name: "责任地区 230281101" }),
    ).toBeChecked();
    expect(api.loadAssignmentOptions).toHaveBeenLastCalledWith("NEHE_DEPOT");
  });

  it("does not let a slow employee-list request overwrite the selected unit townships", async () => {
    const user = userEvent.setup();
    const api = repository();
    const [employee] = await api.listEmployees();
    let resolveEmployees: (employees: EmployeeProfile[]) => void = () => {};
    api.listEmployees.mockReturnValue(
      new Promise<EmployeeProfile[]>((resolve) => {
        resolveEmployees = resolve;
      }),
    );
    api.loadAssignmentOptions.mockImplementation((workUnitCode?: string) =>
      Promise.resolve({
        workUnits: [
          { code: "QIQIHAR_BUSINESS", name: "齐齐哈尔经营部" },
          { code: "NEHE_DEPOT", name: "讷河库" },
        ],
        roles: [
          { code: "BUSINESS_OPERATOR", name: "填报员" },
          { code: "BUSINESS_REVIEWER", name: "管理员" },
        ],
        positions: [],
        regionCodes:
          workUnitCode === "NEHE_DEPOT" ? ["230281101"] : ["230202001"],
        regions: assignmentRegions(
          workUnitCode === "NEHE_DEPOT" ? ["230281101"] : ["230202001"],
        ),
      }),
    );
    render(
      <IdentityGovernancePanel
        initialView="employees"
        onClose={vi.fn()}
        repository={api as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );

    await user.click(screen.getByRole("button", { name: "邀请员工" }));
    await screen.findByRole("option", { name: "讷河库" });
    await user.selectOptions(screen.getByLabelText("工作单位"), "NEHE_DEPOT");
    expect(
      await screen.findByRole("checkbox", { name: "责任地区 230281101" }),
    ).toBeVisible();

    resolveEmployees([employee]);
    await waitFor(() => expect(api.listEmployees).toHaveBeenCalledTimes(2));
    expect(
      screen.getByRole("checkbox", { name: "责任地区 230281101" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("checkbox", { name: "责任地区 230202001" }),
    ).not.toBeInTheDocument();
  });

  it("closes an employee editor before leaving and reloading the employee view", async () => {
    const user = userEvent.setup();
    const api = repository();
    api.loadAssignmentOptions.mockImplementation((workUnitCode?: string) =>
      Promise.resolve({
        workUnits: [
          { code: "QIQIHAR_BUSINESS", name: "齐齐哈尔经营部" },
          { code: "NEHE_DEPOT", name: "讷河库" },
        ],
        roles: [
          { code: "BUSINESS_OPERATOR", name: "填报员" },
          { code: "BUSINESS_REVIEWER", name: "管理员" },
        ],
        positions: [],
        regionCodes:
          workUnitCode === "NEHE_DEPOT" ? ["230281101"] : ["230202001"],
        regions: assignmentRegions(
          workUnitCode === "NEHE_DEPOT" ? ["230281101"] : ["230202001"],
        ),
      }),
    );
    render(
      <IdentityGovernancePanel
        initialView="employees"
        onClose={vi.fn()}
        repository={api as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "邀请员工" }));
    await user.selectOptions(screen.getByLabelText("工作单位"), "NEHE_DEPOT");
    expect(
      await screen.findByRole("checkbox", { name: "责任地区 230281101" }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "我的账号" }));
    expect(
      screen.queryByRole("button", { name: "发送入职邀请" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "员工管理" }));

    expect(await screen.findByText("张敏")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "发送入职邀请" }),
    ).not.toBeInTheDocument();
    expect(api.loadAssignmentOptions).toHaveBeenLastCalledWith(
      "QIQIHAR_BUSINESS",
    );
  });

  it("runs a durable access review and submits explicit retain or revoke decisions", async () => {
    const user = userEvent.setup();
    const api = repository();
    render(
      <IdentityGovernancePanel
        initialView="reviews"
        onClose={vi.fn()}
        repository={api as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );

    await screen.findByText("三季度权限复核");
    await user.click(screen.getByRole("button", { name: "处理复核" }));
    await user.selectOptions(
      screen.getByLabelText("230202001 的复核结论"),
      "RETAIN",
    );
    await user.type(
      screen.getByLabelText("230202001 的复核说明"),
      "责任区域继续有效",
    );
    expect(screen.getByText("本人权限由其他管理员复核")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "提交复核结论" }));

    await waitFor(() =>
      expect(api.decideAccessReview).toHaveBeenCalledWith("review-1", [
        expect.objectContaining({
          decisionCode: "RETAIN",
          reason: "责任区域继续有效",
        }),
      ]),
    );
    expect(await screen.findByText("复核已完成")).toBeVisible();
  });

  it("normalizes legacy broad region grants to the assignable township anchors", async () => {
    const user = userEvent.setup();
    const api = repository();
    const [employee] = await api.listEmployees();
    api.listEmployees.mockResolvedValue([
      {
        ...employee,
        regionCodes: ["230200", "230208", "230208001", "230208001001"],
      },
    ]);
    api.loadAssignmentOptions.mockResolvedValue({
      ...(await api.loadAssignmentOptions()),
      regionCodes: ["230208001"],
    });
    render(
      <IdentityGovernancePanel
        initialView="employees"
        onClose={vi.fn()}
        repository={api as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "管理张敏的授权" }),
    );
    await user.click(screen.getByRole("button", { name: "保存授权调整" }));

    await waitFor(() =>
      expect(api.updateEmployee).toHaveBeenCalledWith(
        "employee-1",
        expect.objectContaining({ regionCodes: ["230208001"] }),
      ),
    );
  });

  it("does not offer self administration from the employee list", async () => {
    const api = repository();
    const [employee] = await api.listEmployees();
    api.listEmployees.mockResolvedValue([
      {
        ...employee,
        subjectId: session.subjectId,
        displayName: session.displayName,
      },
    ]);
    render(
      <IdentityGovernancePanel
        initialView="employees"
        onClose={vi.fn()}
        repository={api as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );

    expect(await screen.findByText("本人账号")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "管理李主任的授权" }),
    ).not.toBeInTheDocument();
  });

  it("shows the safe business error returned by the authorization service", async () => {
    const user = userEvent.setup();
    const api = repository();
    api.updateEmployee.mockRejectedValue(
      new RealtimeApiError({
        code: "IDENTITY_VERSION_CONFLICT",
        message: "该员工授权已被其他管理员更新，请刷新后重试",
        status: 409,
      }),
    );
    render(
      <IdentityGovernancePanel
        initialView="employees"
        onClose={vi.fn()}
        repository={api as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "管理张敏的授权" }),
    );
    await user.click(screen.getByRole("button", { name: "保存授权调整" }));

    expect(
      await screen.findByText("该员工授权已被其他管理员更新，请刷新后重试"),
    ).toBeVisible();
  });

  it("lets authorized administrators filter and trace immutable business audit events", async () => {
    const user = userEvent.setup();
    const api = repository();
    render(
      <IdentityGovernancePanel
        initialView="audit"
        onClose={vi.fn()}
        repository={api as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );

    expect(await screen.findByText("调整员工账号")).toBeVisible();
    expect(screen.getByText("业务编号 employee-1")).toBeVisible();
    expect(screen.queryByText(/LOCAL_DEV/)).not.toBeInTheDocument();
    expect(screen.getAllByText("齐齐哈尔经营部")).toHaveLength(2);
    expect(screen.queryByText(/QIQIHAR_BUSINESS/)).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText("审计业务对象"),
      "SECURITY_USER",
    );
    await user.type(screen.getByLabelText("审计操作员工"), "identity-admin");
    await user.type(screen.getByLabelText("审计开始日期"), "2026-08-01");
    await user.type(screen.getByLabelText("审计结束日期"), "2026-08-10");
    await user.click(screen.getByRole("button", { name: "查询审计记录" }));

    await waitFor(() =>
      expect(api.listAuditEvents).toHaveBeenLastCalledWith(
        expect.objectContaining({
          workUnitCode: "QIQIHAR_BUSINESS",
          aggregateType: "SECURITY_USER",
          actorSubjectId: "identity-admin",
          page: 0,
          pageSize: 50,
        }),
      ),
    );
  });

  it("lets administrators page through every audit record instead of stopping at the first fifty", async () => {
    const user = userEvent.setup();
    const api = repository();
    api.listAuditEvents.mockImplementation((input = {}) => {
      const pageNumber = input.page ?? 0;
      return Promise.resolve({
        items: [
          {
            eventId: `audit-${pageNumber + 1}`,
            aggregateType: "SECURITY_USER",
            aggregateId: `employee-${pageNumber + 1}`,
            actionCode: "SECURITY_USER_UPDATED",
            actorSubjectId: "identity-admin",
            actorDisplayName: "李主任",
            workUnitCode: "QIQIHAR_BUSINESS",
            workUnitName: "齐齐哈尔经营部",
            occurredAt: "2026-08-10T01:02:03Z",
            detailJson: "{}",
          },
        ],
        pageNumber,
        pageSize: 50,
        totalElements: 51,
        totalPages: 2,
      });
    });
    render(
      <IdentityGovernancePanel
        initialView="audit"
        onClose={vi.fn()}
        repository={api as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );

    expect(await screen.findByText("业务编号 employee-1")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "下一页" }));
    expect(await screen.findByText("业务编号 employee-2")).toBeVisible();
    expect(api.listAuditEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, pageSize: 50 }),
    );
  });
});
