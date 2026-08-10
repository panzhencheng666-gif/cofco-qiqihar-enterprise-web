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
  roleCodes: ["IDENTITY_ADMIN", "ACCESS_REVIEWER"],
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
    roles: [{ code: "BUSINESS_OPERATOR", name: "业务填报员" }],
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
    listEmployees: vi.fn(() => Promise.resolve([employee])),
    loadAssignmentOptions: vi.fn(() =>
      Promise.resolve({
        workUnits: [{ code: "QIQIHAR_BUSINESS", name: "齐齐哈尔经营部" }],
        roles: [{ code: "BUSINESS_OPERATOR", name: "业务填报员" }],
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
    listAuditEvents: vi.fn(() =>
      Promise.resolve({
        items: [
          {
            eventId: "audit-1",
            aggregateType: "SECURITY_USER",
            aggregateId: "employee-1",
            actionCode: "SECURITY_USER_UPDATED",
            actorSubjectId: "identity-admin",
            actorDisplayName: "李主任",
            workUnitCode: "QIQIHAR_BUSINESS",
            occurredAt: "2026-08-10T01:02:03Z",
            detailJson: "{}",
          },
        ],
        pageNumber: 0,
        pageSize: 50,
        totalElements: 1,
        totalPages: 1,
      }),
    ),
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
    expect(within(dialog).getByText("齐齐哈尔经营部")).toBeVisible();
    expect(within(dialog).getAllByText("单位负责人")).toHaveLength(2);
    expect(within(dialog).getByText("230200")).toBeVisible();
    expect(within(dialog).getByText("在职 · 账号正常")).toBeVisible();
    expect(
      within(dialog).getByText("身份与权限管理员、权限复核负责人"),
    ).toBeVisible();
    expect(
      within(dialog).queryByText("IDENTITY_ADMIN"),
    ).not.toBeInTheDocument();
  });

  it("links account security, login devices and logout to the enterprise identity provider", () => {
    render(
      <IdentityGovernancePanel
        identityManagementUrl="/identity/account"
        initialView="profile"
        logoutUrl="/identity/logout"
        onClose={vi.fn()}
        repository={repository() as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );

    expect(
      screen.getByRole("link", { name: "账号安全与登录设备" }),
    ).toHaveAttribute("href", "/identity/account");
    expect(screen.getByRole("link", { name: "退出登录" })).toHaveAttribute(
      "href",
      "/identity/logout",
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
    await user.click(screen.getByRole("button", { name: "邀请员工" }));
    await user.type(screen.getByLabelText("员工账号"), "employee-88");
    await user.type(screen.getByLabelText("员工姓名"), "赵蕾");
    await user.click(screen.getByRole("checkbox", { name: "业务填报员" }));
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
});
