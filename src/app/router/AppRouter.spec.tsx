import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppRouter } from "./AppRouter";
import { mockEnterpriseGateway } from "@/platform/api/mock/mockEnterpriseGateway";
import { renderWithApp } from "@/testing/renderWithApp";

afterEach(cleanup);

describe("AppRouter", () => {
  it("opens the unified work surface at the system entry", async () => {
    renderWithApp(<AppRouter />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "我的工作", level: 1 }),
      ).toBeVisible();
    });
  });

  it("does not expose the technical compatibility experiment as a business page", async () => {
    renderWithApp(<AppRouter />, {
      initialEntries: ["/system/compatibility"],
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "页面不存在", level: 1 }),
      ).toBeVisible();
    });
    expect(screen.queryByText("技术兼容门禁")).not.toBeInTheDocument();
    expect(
      screen.getByText("当前地址没有匹配的可访问业务页面，请从主导航进入。"),
    ).toBeVisible();
  });

  it("describes account information without unverified environment claims", async () => {
    renderWithApp(<AppRouter />, {
      initialEntries: ["/account/security"],
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          "查看当前身份、责任岗位和会话状态；账号修改暂不在此页面提供。",
        ),
      ).toBeVisible();
    });
  });

  it("opens an implemented governed business workspace", async () => {
    renderWithApp(<AppRouter />, {
      initialEntries: ["/production/planting"],
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: "种植生产运营工作区",
          level: 1,
        }),
      ).toBeVisible();
    });
  });

  it("keeps technical identifiers out of the visible business document", async () => {
    renderWithApp(<AppRouter />, {
      initialEntries: [
        "/objects/site-qqhr-001/documents/doc-market-20260730-001",
      ],
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: "龙江丰禾粮贸第一经营场所",
          level: 1,
        }),
      ).toBeVisible();
    });
    expect(screen.getByText("市场玉米日报表第 1 版")).toBeVisible();
    expect(
      screen.queryByText(/doc-market|MARKET-CORN/),
    ).not.toBeInTheDocument();
    expect(screen.getByText("审核模式")).toBeVisible();
  });

  it("denies an exact business document coordinate when the server workspace projects no grant", async () => {
    renderWithApp(<AppRouter />, {
      initialEntries: [
        "/objects/site-qqhr-001/documents/doc-market-20260730-001",
      ],
      gateway: {
        ...mockEnterpriseGateway,
        async getCurrentWorkspace() {
          const workspace = await mockEnterpriseGateway.getCurrentWorkspace();
          return { ...workspace, documentAccess: [] };
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByText("当前账号无权查看此业务单据")).toBeVisible();
    });
    expect(screen.queryByText("实际收购价格")).not.toBeInTheDocument();
  });

  it("enters reporting mode only for an exact responsibility-scoped edit grant", async () => {
    renderWithApp(<AppRouter />, {
      initialEntries: ["/objects/farmer-017/documents/doc-production-2026-017"],
    });

    await waitFor(() => {
      expect(screen.getByText("填报模式")).toBeVisible();
    });
    expect(screen.queryByText("审核模式")).not.toBeInTheDocument();
  });

  it("uses a plain-language message when a business document cannot be loaded", async () => {
    renderWithApp(<AppRouter />, {
      initialEntries: [
        "/objects/site-qqhr-001/documents/doc-market-20260730-001",
      ],
      gateway: {
        ...mockEnterpriseGateway,
        getDocument: () => Promise.reject(new Error("unavailable")),
      },
    });

    await waitFor(() => {
      expect(screen.getByText("暂时无法加载，请稍后重试")).toBeVisible();
    });
    expect(screen.queryByText("服务暂时不可用")).not.toBeInTheDocument();
  });

  it("rejects a direct business URL outside the projected capability set", async () => {
    renderWithApp(<AppRouter />, {
      initialEntries: ["/market"],
      gateway: {
        ...mockEnterpriseGateway,
        async getCurrentWorkspace() {
          const workspace = await mockEnterpriseGateway.getCurrentWorkspace();
          return {
            ...workspace,
            capabilities: workspace.capabilities.filter(
              (capability) => capability !== "market-monitoring:view",
            ),
          };
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByText("当前账号无权访问")).toBeVisible();
    });
    expect(
      screen.queryByRole("heading", {
        name: "市场监测运营总览",
        level: 1,
      }),
    ).not.toBeInTheDocument();
  });
});
