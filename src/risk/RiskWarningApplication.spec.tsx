import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as RealtimeApiClientModule from "@/platform/api/realtimeApiClient";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";
import * as automaticLogin from "@/business/automaticLogin";
import { RiskWarningApplication } from "./RiskWarningApplication";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/platform/api/realtimeApiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof RealtimeApiClientModule>();
  return {
    ...actual,
    createRealtimeApiClient: () => ({
      get,
      post: vi.fn(),
    }),
  };
});

afterEach(() => {
  cleanup();
  get.mockReset();
  vi.restoreAllMocks();
});

describe("RiskWarningApplication navigation", () => {
  const currentSession = {
    subjectId: "test-reporter",
    displayName: "测试填报员",
    workUnitCode: "unit",
    workUnitName: "测试单位",
    accountStatus: "ACTIVE",
    employmentStatus: "ACTIVE",
    roleCodes: ["BUSINESS_OPERATOR"],
    positions: [],
    permissions: ["BUSINESS_READ"],
    regionCodes: [],
    rootAdministrator: false,
    unassignedReporter: true,
  };

  it("preserves authenticated identity and explains a forbidden risk query", async () => {
    get.mockImplementation((path: string) =>
      path === "/api/v1/session/me"
        ? Promise.resolve(currentSession)
        : Promise.reject(
            new RealtimeApiError({
              code: "ACCESS_DENIED",
              message: "请求失败（HTTP 403）",
              status: 403,
            }),
          ),
    );
    const redirect = vi.spyOn(automaticLogin, "redirectToEnterpriseLogin");
    render(<RiskWarningApplication />);
    expect(
      await screen.findByText("当前账号无权读取风险研判数据"),
    ).toBeInTheDocument();
    expect(screen.getByText("测试填报员")).toBeInTheDocument();
    expect(screen.queryByText("未认证")).not.toBeInTheDocument();
    expect(screen.queryByText("服务异常")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "请联系管理员核对风险系统操作权限和可访问地区，授权后重新检查。",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "专家训练管理" }),
    ).not.toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
    get.mockImplementation((path: string) =>
      Promise.resolve(path === "/api/v1/session/me" ? currentSession : []),
    );
    fireEvent.click(screen.getByRole("button", { name: /重新检查权限/ }));
    await waitFor(() =>
      expect(
        screen.queryByText("当前账号无权读取风险研判数据"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText("数据链路已连接")).toBeInTheDocument();
  });

  it("exposes expert training management only to a root administrator", async () => {
    const rootSession = { ...currentSession, rootAdministrator: true };
    get.mockImplementation((path: string) => {
      if (path === "/api/v1/session/me") return Promise.resolve(rootSession);
      if (path === "/api/v1/risk/expert-training/overview") {
        return Promise.resolve({ datasets: [], tasks: [], auditEvents: [] });
      }
      return Promise.resolve([]);
    });

    render(<RiskWarningApplication />);
    const entry = await screen.findByRole("button", { name: "专家训练管理" });
    fireEvent.click(entry);

    expect(
      await screen.findByRole("heading", { name: "齐粮专家训练管理" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("当前尚未登记专家数据集"),
    ).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/api/v1/risk/expert-training/overview");
  });

  it("keeps upstream failure distinct from missing authorization", async () => {
    get.mockImplementation((path: string) =>
      path === "/api/v1/session/me"
        ? Promise.resolve(currentSession)
        : Promise.reject(
            new RealtimeApiError({
              code: "UNAVAILABLE",
              message: "校验服务不可用",
              status: 503,
            }),
          ),
    );
    render(<RiskWarningApplication />);
    expect(await screen.findByText("服务异常")).toBeInTheDocument();
    expect(screen.getByText("测试填报员")).toBeInTheDocument();
    expect(
      screen.queryByText("当前账号无权读取风险研判数据"),
    ).not.toBeInTheDocument();
  });
  it("returns to the platform application center instead of the workbench", () => {
    get.mockRejectedValue(new Error("offline"));
    render(<RiskWarningApplication />);

    expect(
      screen.getByRole("link", { name: "返回平台应用中心" }),
    ).toHaveAttribute("href", "/#/applications");
    expect(screen.getByRole("link", { name: "返回应用中心" })).toHaveAttribute(
      "href",
      "/#/applications",
    );
  });

  it("starts unified login and returns to the risk application when no session exists", async () => {
    get.mockRejectedValue(
      new RealtimeApiError({
        code: "AUTHENTICATION_REQUIRED",
        message: "请先登录",
        status: 401,
      }),
    );
    const redirect = vi
      .spyOn(automaticLogin, "redirectToEnterpriseLogin")
      .mockReturnValue(true);

    render(<RiskWarningApplication />);

    await waitFor(() =>
      expect(redirect).toHaveBeenCalledWith(
        "/api/v1/session/login?returnTo=%2Frisk%2F",
      ),
    );
    expect(screen.getByRole("status")).toHaveTextContent("正在进入登录界面");
  });
});
