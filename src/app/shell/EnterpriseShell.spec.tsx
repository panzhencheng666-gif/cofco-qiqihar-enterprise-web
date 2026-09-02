import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { EnterpriseShell } from "./EnterpriseShell";
import { mockEnterpriseGateway } from "@/platform/api/mock/mockEnterpriseGateway";
import { renderWithApp } from "@/testing/renderWithApp";

afterEach(cleanup);

describe("EnterpriseShell", () => {
  it("projects the current workspace and only implemented navigation", async () => {
    const user = userEvent.setup();
    renderWithApp(
      <EnterpriseShell>
        <div>页面内容</div>
      </EnterpriseShell>,
    );

    expect(screen.getByText("齐齐哈尔粮食商情企业系统")).toBeVisible();
    await waitFor(() => {
      expect(screen.getAllByText("东北区域经营中心").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("齐齐哈尔市")).toBeVisible();
    expect(screen.getByText("2026/27 年度")).toBeVisible();
    expect(screen.getByText("王洋")).toBeVisible();
    expect(screen.getByText("演示环境 · 非生产数据")).toBeVisible();
    expect(screen.getByRole("button", { name: "账号与安全" })).toBeVisible();
    expect(screen.getByRole("button", { name: "本人待办 3 项" })).toBeVisible();
    expect(screen.queryByText("技术兼容门禁")).not.toBeInTheDocument();
    expect(screen.getByRole("complementary")).toHaveAttribute(
      "data-kind",
      "contextual",
    );
    expect(screen.getByLabelText("业务上下文")).toHaveTextContent(
      "任务总览待我填报待我审核异常与逾期已办跟踪",
    );

    await user.click(screen.getByRole("button", { name: "打开应用切换" }));
    expect(screen.getByText("仅展示当前账号可访问的业务应用")).toBeVisible();
    expect(
      screen.queryByText("仅展示当前账号已授权且已接入的应用"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("主导航")).toHaveTextContent(
      "我的工作经营总览产情监测市场监测供需与态势数据治理系统管理",
    );
    expect(screen.getByLabelText("主导航")).not.toHaveTextContent("报表中心");
    expect(screen.getByLabelText("主导航")).not.toHaveTextContent("账号与安全");
  });

  it("searches authorized applications and opens their context workspace", async () => {
    const user = userEvent.setup();
    renderWithApp(
      <EnterpriseShell>
        <div>页面内容</div>
      </EnterpriseShell>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("searchbox", { name: "搜索应用和工作区" }),
      ).toBeVisible();
    });
    await user.type(
      screen.getByRole("searchbox", { name: "搜索应用和工作区" }),
      "供需",
    );
    await user.click(screen.getByRole("option", { name: "供需与态势" }));

    expect(screen.getByLabelText("业务上下文")).toHaveTextContent(
      "供需总览产品账户账户勾稽实时监控区域地图版本与血缘",
    );
  });

  it("keeps global context above the page with a contextual business rail", async () => {
    renderWithApp(
      <EnterpriseShell>
        <div>本人工作页面</div>
      </EnterpriseShell>,
    );

    await waitFor(() => {
      expect(screen.getAllByText("东北区域经营中心").length).toBeGreaterThan(0);
    });

    expect(screen.getByText("本人工作页面")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "收起或展开主导航" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("当前组织").length).toBeGreaterThan(0);
    expect(screen.getByText("齐齐哈尔市")).toBeVisible();
    expect(screen.getByText("2026/27 年度")).toBeVisible();
    expect(screen.getByText("本区域全部样本")).toBeVisible();
  });

  it("separates the operating space, business application and current workspace", async () => {
    renderWithApp(
      <EnterpriseShell>
        <div>种植生产页面</div>
      </EnterpriseShell>,
      { initialEntries: ["/production/planting"] },
    );

    await waitFor(() => {
      expect(screen.getByText("产情运营空间")).toBeVisible();
    });

    expect(
      screen.getByRole("complementary", {
        name: "产情监测上下文导航",
      }),
    ).toHaveTextContent("当前业务应用产情监测");
    expect(screen.getByLabelText("当前工作空间")).toHaveTextContent(
      "当前业务上下文种植生产",
    );
  });

  it("fails closed when the workspace cannot establish identity and scope", async () => {
    renderWithApp(
      <EnterpriseShell>
        <div>不得泄露的业务内容</div>
      </EnterpriseShell>,
      {
        gateway: {
          ...mockEnterpriseGateway,
          getCurrentWorkspace: () =>
            Promise.reject(new Error("workspace unavailable")),
        },
      },
    );

    await waitFor(() => {
      expect(
        screen.getByRole("alert", { name: "工作空间无法建立" }),
      ).toBeVisible();
    });
    expect(screen.queryByText("不得泄露的业务内容")).not.toBeInTheDocument();
  });
});
