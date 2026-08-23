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
  BusinessAuditQuery,
  CurrentSession,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
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
    "ACCESS_REVIEW",
    "AUDIT_READ",
  ],
  regionCodes: ["230200"],
};

function repository() {
  const employee = {
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
    regionCodes: ["230202"],
    version: 3,
  } as const;
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
        subjectId: "employee-1",
        grantType: "REGION" as const,
        grantKey: "230202",
        decisionCode: "PENDING" as const,
        decidedBy: null,
        decidedAt: null,
        reason: null,
      },
    ],
  };
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
        ],
      }),
    ),
    listEmployees: vi.fn(() => Promise.resolve([employee])),
    loadAssignmentOptions: vi.fn(() =>
      Promise.resolve({
        workUnits: [{ code: "QIQIHAR_BUSINESS", name: "齐齐哈尔经营部" }],
        roles: [
          { code: "BUSINESS_OPERATOR", name: "填报员" },
          { code: "BUSINESS_REVIEWER", name: "管理员" },
        ],
        positions: [{ code: "REGIONAL_REPORTER", name: "区域填报专员" }],
        regionCodes: ["230202", "230208"],
      }),
    ),
    inviteEmployee: vi.fn(() => Promise.resolve(employee)),
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
        ],
        pageNumber: 0,
        pageSize: 50,
        totalElements: 1,
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
    expect(within(unit).getByText("单位负责人")).toBeVisible();
    expect(within(unit).getByText("230200")).toBeVisible();
    expect(within(unit).getByText("李主任")).toBeVisible();

    await user.click(
      within(unit).getByRole("button", { name: "管理员工与授权" }),
    );
    expect(screen.getByRole("button", { name: "员工与授权" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(await screen.findByText("张敏")).toBeVisible();
  });

  it("shows the authenticated account, position, organization and responsibility scope", () => {
    render(
      <IdentityGovernancePanel
        initialView="profile"
        onClose={vi.fn()}
        repository={repository() as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "账号与权限" });
    expect(within(dialog).getByText("李主任")).toBeVisible();
    expect(within(dialog).getByText("员工账号 identity-admin")).toBeVisible();
    expect(within(dialog).getByText("齐齐哈尔经营部")).toBeVisible();
    expect(within(dialog).getByText("单位编码 QIQIHAR_BUSINESS")).toBeVisible();
    expect(within(dialog).getAllByText("单位负责人")).toHaveLength(2);
    expect(within(dialog).getByText("230200")).toBeVisible();
    expect(within(dialog).getByText("在职 · 账号正常")).toBeVisible();
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

    const summary = screen.getByLabelText("账号资料");
    expect(summary.tagName).toBe("DL");
    expect(summary.querySelector("article")).toBeNull();
    expect(await screen.findByText("齐齐哈尔市（230200）")).toBeVisible();
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
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    await user.click(screen.getByRole("radio", { name: "填报员" }));
    await user.click(screen.getByRole("checkbox", { name: "区域填报专员" }));
    await user.click(screen.getByRole("checkbox", { name: "责任地区 230202" }));
    await user.click(screen.getByRole("button", { name: "发送入职邀请" }));
    await waitFor(() =>
      expect(api.inviteEmployee).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectId: "employee-88",
          workUnitCode: "QIQIHAR_BUSINESS",
          regionCodes: ["230202"],
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
      screen.getByLabelText("230202 的复核结论"),
      "RETAIN",
    );
    await user.type(
      screen.getByLabelText("230202 的复核说明"),
      "责任区域继续有效",
    );
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
    expect(
      screen.getByText("齐齐哈尔经营部（QIQIHAR_BUSINESS）"),
    ).toBeVisible();
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
