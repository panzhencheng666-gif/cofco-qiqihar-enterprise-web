import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { businessWorkFixtures } from "./data/businessWorkFixtures";
import { approvedBusinessReportDatasets } from "./data/businessReportDatasets";
import { productionMonitoringObjects } from "./data/monitoringRegistryFixtures";
import { fixtureOperationalIdentity } from "./formalEnterpriseData";
import { createFormalRoute } from "./formalEnterpriseModel";
import { EnterpriseShell } from "./EnterpriseShell";

afterEach(cleanup);

describe("EnterpriseShell", () => {
  it("opens real organization and account governance from the header", async () => {
    const user = userEvent.setup();
    const onIdentityOpen = vi.fn();
    render(
      <EnterpriseShell
        location={{
          route: createFormalRoute("work", "sample-governance"),
          coordinates: { regionId: "authorized-all" },
        }}
        onIdentityOpen={onIdentityOpen}
        onNavigate={vi.fn()}
        shellIdentity={{
          platformName: "平台名称",
          workUnit: {
            organizationLabel: "组织",
            currentUnitLabel: "单位一",
            units: ["单位一"],
          },
          account: { displayName: "王洋", menuItems: [] },
        }}
      >
        <h1>workspace</h1>
      </EnterpriseShell>,
    );

    await user.click(
      screen.getByRole("button", { name: "当前工作单位：单位一" }),
    );
    expect(onIdentityOpen).toHaveBeenLastCalledWith("organization");
    await user.click(screen.getByRole("button", { name: "当前用户：王洋" }));
    expect(onIdentityOpen).toHaveBeenLastCalledWith("profile");
  });

  it("renders only header utilities backed by business behavior", () => {
    const administrativeScope = {
      ...fixtureOperationalIdentity,
      authorization: {
        ...fixtureOperationalIdentity.authorization,
        permissionKeys: [
          ...fixtureOperationalIdentity.authorization.permissionKeys,
          "system:settings",
        ],
      },
      coordinates: { regionId: "authorized-all" as const },
      savedView: null,
    };
    const props = {
      location: {
        route: createFormalRoute("work", "sample-governance"),
        coordinates: { regionId: "authorized-all" },
      },
      onNavigate: vi.fn(),
      shellIdentity: {
        platformName: "平台名称",
        workUnit: {
          organizationLabel: "组织",
          currentUnitLabel: "单位一",
          units: ["单位一"],
        },
        account: {
          displayName: "王洋",
          menuItems: [
            "个人中心",
            "岗位与责任范围",
            "工作交接",
            "个人偏好",
            "账号安全",
            "操作与登录记录",
            "退出登录",
          ],
        },
      },
    } as const;

    const { rerender } = render(
      <EnterpriseShell {...props} scope={administrativeScope}>
        <h1>workspace</h1>
      </EnterpriseShell>,
    );

    expect(screen.getByRole("searchbox", { name: "全局搜索" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /待办/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /通知/ })).toHaveTextContent(
      /\d+/,
    );
    expect(screen.getByRole("button", { name: "帮助" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "系统设置" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("当前用户：王洋")).toBeVisible();
    expect(
      screen.queryByRole("menu", { name: "个人账户菜单" }),
    ).not.toBeInTheDocument();

    rerender(
      <EnterpriseShell
        {...props}
        scope={{
          ...administrativeScope,
          authorization: {
            ...administrativeScope.authorization,
            permissionKeys: ["enterprise:fixtures:read"],
          },
        }}
      >
        <h1>workspace</h1>
      </EnterpriseShell>,
    );
    expect(
      screen.queryByRole("button", { name: "系统设置" }),
    ).not.toBeInTheDocument();
  });

  it("does not index unauthorized objects tasks risks or report data", async () => {
    const user = userEvent.setup();
    const restrictedScope = {
      ...fixtureOperationalIdentity,
      authorization: {
        ...fixtureOperationalIdentity.authorization,
        authorizedRegionIds: ["heihe-all" as const],
      },
      coordinates: { regionId: "authorized-all" as const },
      savedView: null,
    };

    render(
      <EnterpriseShell
        location={{
          route: createFormalRoute("work", "sample-governance"),
          coordinates: { regionId: "authorized-all" },
        }}
        onNavigate={vi.fn()}
        queryAllowed
        reportDatasets={approvedBusinessReportDatasets}
        scope={restrictedScope}
        shellIdentity={{
          platformName: "平台名称",
          workUnit: {
            organizationLabel: "组织",
            currentUnitLabel: "单位一",
            units: ["单位一"],
          },
          account: { displayName: "用户", menuItems: [] },
        }}
      >
        <h1>workspace</h1>
      </EnterpriseShell>,
    );

    const search = screen.getByRole("searchbox", { name: "全局搜索" });
    for (const forbiddenName of [
      "讷河市同义镇保国村村委会",
      "讷河市玉米长势与测产调查",
      "质量阻断",
      "齐齐哈尔市全域玉米供需平衡分析报告",
    ]) {
      await user.clear(search);
      await user.type(search, forbiddenName);
      expect(screen.queryByRole("option")).not.toBeInTheDocument();
      expect(document.body).not.toHaveTextContent(forbiddenName);
    }
  });

  it("renders frame and typed navigation without owning business facts", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <EnterpriseShell
        shellIdentity={{
          platformName: "平台名称",
          workUnit: {
            organizationLabel: "组织",
            currentUnitLabel: "单位一",
            units: ["单位一", "单位二"],
          },
          account: { displayName: "用户", menuItems: ["账号安全"] },
        }}
        location={{
          route: createFormalRoute("market", "objects"),
          coordinates: { regionId: "authorized-all" },
        }}
        onNavigate={onNavigate}
      >
        <h1>workspace</h1>
      </EnterpriseShell>,
    );

    expect(screen.getByRole("heading", { name: "workspace" })).toBeVisible();
    expect(screen.getByText("平台名称")).toBeVisible();
    const applications = screen.getByRole("navigation", { name: "业务应用" });
    expect(within(applications).getAllByRole("button")).toHaveLength(6);
    await user.click(
      within(applications).getByRole("button", { name: "产情监测" }),
    );
    expect(onNavigate).toHaveBeenCalledWith(
      createFormalRoute("production", "corn-collection"),
    );
  });

  it("renders work-unit and account identity without hollow menus", () => {
    render(
      <EnterpriseShell
        location={{
          route: createFormalRoute("work", "sample-governance"),
          coordinates: { regionId: "authorized-all" },
        }}
        onNavigate={vi.fn()}
        shellIdentity={{
          platformName: "平台名称",
          workUnit: {
            organizationLabel: "组织",
            currentUnitLabel: "单位一",
            units: ["单位一", "单位二"],
          },
          account: { displayName: "用户", menuItems: ["账号安全", "退出登录"] },
        }}
      >
        <h1>workspace</h1>
      </EnterpriseShell>,
    );

    expect(screen.getByLabelText("当前工作单位：单位一")).toBeVisible();
    expect(screen.getByLabelText("当前用户：用户")).toBeVisible();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("turns global search and header tools into real navigation and information flows", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <EnterpriseShell
        location={{
          route: createFormalRoute("market", "objects"),
          coordinates: { regionId: "authorized-all" },
        }}
        onNavigate={onNavigate}
        reportDatasets={approvedBusinessReportDatasets}
        shellIdentity={{
          platformName: "平台名称",
          workUnit: {
            organizationLabel: "组织",
            currentUnitLabel: "单位一",
            units: ["单位一"],
          },
          account: { displayName: "用户", menuItems: ["岗位与数据权限"] },
        }}
      >
        <h1>workspace</h1>
      </EnterpriseShell>,
    );

    await user.type(
      screen.getByRole("searchbox", { name: "全局搜索" }),
      "供需平衡",
    );
    await user.click(
      screen.getByRole("option", {
        name: /供需分析 · 供需平衡.*业务页面/,
      }),
    );
    expect(onNavigate).toHaveBeenCalledWith(
      createFormalRoute("supply", "balance"),
    );

    await user.type(
      screen.getByRole("searchbox", { name: "全局搜索" }),
      "讷河市同义镇保国村村委会",
    );
    const objectResult = screen.getByRole("option", {
      name: /讷河市同义镇保国村村委会.*监测对象/,
    });
    expect(objectResult).toHaveTextContent("讷河市同义镇 · 玉米、大豆");
    await user.keyboard("{Enter}");
    expect(onNavigate).toHaveBeenCalledWith(
      createFormalRoute("production", "objects"),
      { type: "object", id: "OBJ-PRODUCTION-SURVEY-01" },
    );

    await user.type(
      screen.getByRole("searchbox", { name: "全局搜索" }),
      "讷河市玉米长势与测产调查",
    );
    const taskResult = screen.getByRole("option", {
      name: /讷河市玉米长势与测产调查.*业务任务/,
    });
    expect(taskResult).toHaveTextContent("2026年第31周");
    expect(taskResult).not.toHaveTextContent("2026-W31");
    await user.click(taskResult);
    expect(onNavigate).toHaveBeenCalledWith(
      createFormalRoute("production", "tasks"),
      { type: "work-item", id: "WORK-PRODUCTION-FILL-W31" },
    );

    await user.type(
      screen.getByRole("searchbox", { name: "全局搜索" }),
      "齐齐哈尔市全域玉米供需平衡分析报告",
    );
    const reportResult = screen.getByRole("option", {
      name: /齐齐哈尔市全域玉米供需平衡分析报告.*报告数据/,
    });
    expect(reportResult).toHaveTextContent("2026/27营销年度");
    expect(reportResult).not.toHaveTextContent("SUPPLY");
    await user.click(reportResult);
    expect(onNavigate).toHaveBeenCalledWith(
      createFormalRoute("reporting", "compose"),
      {
        type: "report",
        id: "SUPPLY-2026-MY-APPROVED::supply::玉米",
      },
    );

    expect(
      screen.queryByRole("button", { name: /待办/ }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^通知/ }));
    expect(screen.getByRole("dialog", { name: "业务通知" })).toHaveTextContent(
      /进入事项处理|暂无未读业务通知/,
    );

    await user.click(screen.getByRole("button", { name: "帮助" }));
    expect(
      screen.getByRole("dialog", { name: "当前页面帮助" }),
    ).toHaveTextContent("市场监测 · 监测对象");
    expect(
      screen.getByRole("dialog", { name: "当前页面帮助" }),
    ).toHaveTextContent("操作步骤");
    expect(
      screen.getByRole("dialog", { name: "当前页面帮助" }),
    ).toHaveTextContent("权限与数据规则");
    expect(
      screen.getByRole("dialog", { name: "当前页面帮助" }),
    ).toHaveTextContent("异常处理");
  });

  it("renders durable API notifications without falling back to work-item fixtures", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const onBusinessNotificationRead = vi.fn(() => Promise.resolve());
    render(
      <EnterpriseShell
        businessNotifications={[
          {
            id: "event-1",
            sequence: 9,
            aggregateType: "MARKET_RECORD",
            aggregateId: "market-1",
            actionCode: "MARKET_RECORD_CREATED",
            productCode: "SOYBEAN",
            regionCodes: ["230200"],
            occurredAt: "2026-08-09T10:00:00Z",
            read: false,
          },
        ]}
        location={{
          route: createFormalRoute("work", "sample-governance"),
          coordinates: { regionId: "authorized-all" },
        }}
        onBusinessNotificationRead={onBusinessNotificationRead}
        onNavigate={onNavigate}
        shellIdentity={{
          platformName: "平台名称",
          workUnit: {
            organizationLabel: "组织",
            currentUnitLabel: "单位一",
            units: ["单位一"],
          },
          account: { displayName: "用户", menuItems: [] },
        }}
        workItems={[]}
      >
        <h1>workspace</h1>
      </EnterpriseShell>,
    );

    expect(screen.getByRole("button", { name: /^通知/ })).toHaveTextContent(
      "1",
    );
    await user.click(screen.getByRole("button", { name: /^通知/ }));
    expect(screen.getByRole("dialog", { name: "业务通知" })).toHaveTextContent(
      "大豆市场记录已新建",
    );
    await user.click(
      screen.getByRole("button", { name: /大豆市场记录已新建/ }),
    );
    expect(onBusinessNotificationRead).toHaveBeenCalledWith("event-1");
    expect(onNavigate).toHaveBeenCalledWith(
      createFormalRoute("market", "soybean-collection"),
      { type: "document", id: "market-1" },
    );
  });

  it("rebuilds task and risk search results from the current work-item snapshot", async () => {
    const user = userEvent.setup();
    const source = businessWorkFixtures.find(
      ({ workId }) => workId === "WORK-PRODUCTION-FILL-W31",
    );
    if (!source) throw new Error("missing production work fixture");
    const currentItem = {
      ...source,
      title: "动态产情复核任务",
    };
    const reportingItem = businessWorkFixtures.find(
      ({ workId }) => workId === "WORK-REPORT-REVIEW-W31",
    );
    const sourceObject = productionMonitoringObjects[0];
    if (!reportingItem || !sourceObject) {
      throw new Error("missing workflow search fixture");
    }
    const currentObject = {
      ...sourceObject,
      objectName: "动态维护的产情监测对象",
    };
    const props = {
      location: {
        route: createFormalRoute("work", "sample-governance"),
        coordinates: { regionId: "authorized-all" },
      },
      onNavigate: vi.fn(),
      shellIdentity: {
        platformName: "平台名称",
        workUnit: {
          organizationLabel: "组织",
          currentUnitLabel: "单位一",
          units: ["单位一"],
        },
        account: { displayName: "用户", menuItems: ["岗位与数据权限"] },
      },
    } as const;
    const { rerender } = render(
      <EnterpriseShell
        {...props}
        marketObjects={[]}
        productionObjects={[currentObject]}
        workItems={[currentItem, reportingItem]}
      >
        <h1>workspace</h1>
      </EnterpriseShell>,
    );
    const searchbox = screen.getByRole("searchbox", { name: "全局搜索" });

    await user.type(searchbox, "动态产情复核任务");
    expect(
      screen.getByRole("option", { name: /动态产情复核任务.*业务任务/ }),
    ).toBeVisible();
    expect(
      screen.getByRole("option", { name: /质量阻断.*风险异常/ }),
    ).toBeVisible();

    await user.clear(searchbox);
    await user.type(searchbox, "讷河市玉米长势与测产调查");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();

    await user.clear(searchbox);
    await user.type(searchbox, "质量阻断");
    expect(
      screen.getByRole("option", { name: /动态产情复核任务/ }),
    ).toBeVisible();

    await user.clear(searchbox);
    await user.type(searchbox, "动态维护的产情监测对象");
    expect(
      screen.getByRole("option", { name: /动态维护的产情监测对象.*监测对象/ }),
    ).toBeVisible();

    await user.clear(searchbox);
    await user.type(searchbox, sourceObject.objectName);
    expect(screen.queryByRole("option")).not.toBeInTheDocument();

    await user.clear(searchbox);
    await user.type(searchbox, reportingItem.title);
    const reportingTaskResult = screen.getByRole("option", {
      name: new RegExp(`${reportingItem.title}.*业务任务`),
    });
    await user.click(reportingTaskResult);
    expect(props.onNavigate).toHaveBeenLastCalledWith(
      createFormalRoute("reporting", "review-distribution"),
      { type: "work-item", id: reportingItem.workId },
    );

    await user.type(searchbox, "质量阻断");

    rerender(
      <EnterpriseShell
        {...props}
        marketObjects={[]}
        productionObjects={[currentObject]}
        workItems={[
          {
            ...currentItem,
            documentStatus: "submitted",
            reviewStatus: "approved",
            qualityStatus: "passed",
            obligationStatus: "on-time",
          },
          reportingItem,
        ]}
      >
        <h1>workspace</h1>
      </EnterpriseShell>,
    );
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("does not surface unsupported personal menu actions", () => {
    render(
      <EnterpriseShell
        location={{
          route: createFormalRoute("work", "sample-governance"),
          coordinates: { regionId: "authorized-all" },
        }}
        onNavigate={vi.fn()}
        shellIdentity={{
          platformName: "平台名称",
          workUnit: {
            organizationLabel: "组织",
            currentUnitLabel: "单位一",
            units: ["单位一"],
          },
          account: { displayName: "用户", menuItems: ["岗位与数据权限"] },
        }}
      >
        <h1>workspace</h1>
      </EnterpriseShell>,
    );

    expect(screen.getByLabelText("当前用户：用户")).toBeVisible();
    expect(
      screen.queryByRole("menuitem", { name: "岗位与数据权限" }),
    ).not.toBeInTheDocument();
  });
});
