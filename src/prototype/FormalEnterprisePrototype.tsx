import { useState } from "react";
import { BusinessReportComposer } from "./BusinessReportComposer";
import type { BusinessReportContext } from "./businessReportModel";
import { EnterpriseIcon, type EnterpriseIconName } from "./EnterpriseIcon";
import { ExecutiveOverviewWorkspace } from "./ExecutiveOverviewWorkspace";
import { formalApplicationDefinitions } from "./formalEnterpriseData";
import {
  getDefaultFormalSection,
  readFormalRoute,
  writeFormalRoute,
  type FormalApplication,
  type FormalRoute,
  type FormalSection,
  type MarketSection,
  type ProductionSection,
  type ReportingSection,
  type SupplySection,
  type WorkSection,
} from "./formalEnterpriseModel";
import { MarketMonitoringWorkspace } from "./MarketMonitoringWorkspace";
import { MyWorkWorkspace } from "./MyWorkWorkspace";
import { ProductionMonitoringWorkspace } from "./ProductionMonitoringWorkspace";
import { ReportCenterWorkspace } from "./ReportCenterWorkspace";
import { SupplyDemandWorkspace } from "./SupplyDemandWorkspace";

interface FormalEnterprisePrototypeProps {
  initialSearch?: string;
}

const sectionIcons: Partial<Record<FormalSection, EnterpriseIconName>> = {
  inbox: "list",
  reporting: "entry",
  review: "review",
  exception: "exception",
  completed: "history",
  overview: "overview",
  objects: "list",
  collection: "entry",
  reports: "report",
  accounts: "list",
  regional: "overview",
  lineage: "history",
  situation: "overview",
  "business-reports": "report",
  "duty-reports": "list",
  distribution: "upload",
  versions: "history",
};

function FormalGlobalHeader({
  route,
  onApplicationChange,
}: {
  route: FormalRoute;
  onApplicationChange: (application: FormalApplication) => void;
}) {
  return (
    <header className="formal-header formal-global-header">
      <button aria-label="应用菜单" className="formal-launcher" type="button">
        <EnterpriseIcon name="apps" />
      </button>
      <div className="formal-brand">
        <span>齐</span>
        <strong>齐齐哈尔粮食商情企业平台</strong>
      </div>
      <button
        aria-label="切换组织，当前为东北区域经营中心"
        className="formal-org-selector"
        type="button"
      >
        <EnterpriseIcon name="home" />
        <strong>东北区域经营中心</strong>
        <span aria-hidden="true">⌄</span>
      </button>
      <nav aria-label="业务应用" className="formal-application-nav">
        {formalApplicationDefinitions.map((item) => (
          <button
            aria-current={item.key === route.application ? "page" : undefined}
            className={item.key === route.application ? "is-active" : ""}
            key={item.key}
            type="button"
            onClick={() => onApplicationChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <label className="formal-global-search">
        <EnterpriseIcon name="search" />
        <input
          aria-label="搜索应用和业务对象"
          placeholder="搜索区域、对象、任务和报告"
        />
      </label>
      <div className="formal-header-spacer" />
      <button
        aria-label="任务中心，9 项待处理"
        className="formal-header-tool"
        type="button"
      >
        <EnterpriseIcon name="task" />
        <b>9</b>
      </button>
      <button
        aria-label="通知，3 条未读"
        className="formal-header-tool"
        type="button"
      >
        <EnterpriseIcon name="bell" />
        <b>3</b>
      </button>
      <button aria-label="帮助" className="formal-header-tool" type="button">
        <EnterpriseIcon name="help" />
      </button>
      <div className="formal-user">
        <span>王</span>
        <strong>王洋</strong>
      </div>
    </header>
  );
}

function FormalSidebar({
  route,
  collapsed,
  onCollapse,
  onSectionChange,
}: {
  route: FormalRoute;
  collapsed: boolean;
  onCollapse: () => void;
  onSectionChange: (section: FormalSection) => void;
}) {
  const application =
    formalApplicationDefinitions.find(
      (item) => item.key === route.application,
    ) ?? formalApplicationDefinitions[0];

  return (
    <aside className="formal-sidebar">
      <nav
        aria-label={`${application.label}模块`}
        className="formal-sidebar-navigation"
      >
        <div className="formal-nav-group">
          <span>业务工作</span>
          {application.navigation.map((item) => (
            <button
              className={item.key === route.section ? "is-active" : ""}
              key={item.key}
              title={collapsed ? item.label : undefined}
              type="button"
              onClick={() => onSectionChange(item.key as FormalSection)}
            >
              <EnterpriseIcon
                name={sectionIcons[item.key as FormalSection] ?? "list"}
              />
              <b>{item.label}</b>
            </button>
          ))}
        </div>
      </nav>
      <button
        aria-label={collapsed ? "展开左侧导航" : "收起左侧导航"}
        className="formal-sidebar-collapse"
        title={collapsed ? "展开左侧导航" : "收起左侧导航"}
        type="button"
        onClick={onCollapse}
      >
        <EnterpriseIcon name={collapsed ? "expand" : "collapse"} />
        <span>{collapsed ? "展开" : "收起"}</span>
      </button>
    </aside>
  );
}

export function FormalEnterprisePrototype({
  initialSearch,
}: FormalEnterprisePrototypeProps) {
  const [route, setRoute] = useState<FormalRoute>(() =>
    readFormalRoute(initialSearch ?? window.location.search),
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 1280px)").matches,
  );
  const [reportContext, setReportContext] =
    useState<BusinessReportContext | null>(null);

  function changeRoute(nextRoute: FormalRoute) {
    setReportContext(null);
    setRoute(nextRoute);
    if (initialSearch === undefined) {
      const url = new URL(window.location.href);
      const routeParameters = new URLSearchParams(writeFormalRoute(nextRoute));
      url.searchParams.set("variant", "A");
      url.searchParams.set("page", routeParameters.get("page") ?? "work");
      const section = routeParameters.get("section");
      if (section) url.searchParams.set("section", section);
      else url.searchParams.delete("section");
      window.history.replaceState({}, "", url);
    }
  }

  function openApplication(
    application: FormalApplication,
    section: FormalSection,
  ) {
    changeRoute({ application, section });
  }

  function renderWorkspace() {
    if (route.application === "overview") {
      return <ExecutiveOverviewWorkspace onOpenApplication={openApplication} />;
    }
    if (route.application === "production") {
      return (
        <ProductionMonitoringWorkspace
          onComposeReport={setReportContext}
          section={route.section as ProductionSection}
          onSectionChange={(section) =>
            changeRoute({ application: "production", section })
          }
        />
      );
    }
    if (route.application === "market") {
      return (
        <MarketMonitoringWorkspace
          onComposeReport={setReportContext}
          section={route.section as MarketSection}
          onSectionChange={(section) =>
            changeRoute({ application: "market", section })
          }
        />
      );
    }
    if (route.application === "supply") {
      return (
        <SupplyDemandWorkspace
          onComposeReport={setReportContext}
          section={route.section as SupplySection}
        />
      );
    }
    if (route.application === "reporting") {
      return (
        <ReportCenterWorkspace
          onComposeReport={setReportContext}
          section={route.section as ReportingSection}
        />
      );
    }
    return (
      <MyWorkWorkspace
        section={route.section as WorkSection}
        onOpenBusiness={(application, section) =>
          changeRoute({ application, section })
        }
      />
    );
  }

  return (
    <div
      className={`formal-enterprise${
        sidebarCollapsed ? " is-sidebar-collapsed" : ""
      }`}
    >
      <FormalGlobalHeader
        route={route}
        onApplicationChange={(application) =>
          changeRoute({
            application,
            section: getDefaultFormalSection(application),
          })
        }
      />
      <div className="formal-enterprise-shell">
        <FormalSidebar
          collapsed={sidebarCollapsed}
          route={route}
          onCollapse={() => setSidebarCollapsed((value) => !value)}
          onSectionChange={(section) =>
            changeRoute({ application: route.application, section })
          }
        />
        <main className="formal-main">{renderWorkspace()}</main>
      </div>
      {reportContext && (
        <BusinessReportComposer
          context={reportContext}
          onClose={() => setReportContext(null)}
        />
      )}
    </div>
  );
}
