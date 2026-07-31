import { useState } from "react";
import { BusinessReportComposer } from "./BusinessReportComposer";
import type { BusinessReportContext } from "./businessReportModel";
import { EnterpriseIcon, type EnterpriseIconName } from "./EnterpriseIcon";
import { EnterpriseRegionProvider } from "./EnterpriseRegionContext";
import type { EnterpriseRegionId } from "./enterpriseRegions";
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
  statement: "list",
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
  const [currentUnit, setCurrentUnit] = useState("经营部本部");
  const [organizationMenuOpen, setOrganizationMenuOpen] = useState(false);
  const [personalMenuOpen, setPersonalMenuOpen] = useState(false);
  const businessUnits = [
    "经营部本部",
    "讷河库",
    "克山库",
    "克东库",
    "龙镇库",
    "成吉思汗库",
  ] as const;

  return (
    <header className="formal-header formal-global-header">
      <div className="formal-header-primary">
        <button aria-label="应用菜单" className="formal-launcher" type="button">
          <EnterpriseIcon name="apps" />
        </button>
        <div className="formal-brand">
          <span>齐</span>
          <strong>齐齐哈尔粮食商情企业平台</strong>
        </div>
        <div className="formal-org-switcher">
          <button
            aria-expanded={organizationMenuOpen}
            aria-label={`当前工作单位：齐齐哈尔经营部，${currentUnit}`}
            className="formal-org-selector"
            type="button"
            onClick={() => {
              setOrganizationMenuOpen((value) => !value);
              setPersonalMenuOpen(false);
            }}
          >
            <EnterpriseIcon name="home" />
            <span>
              <small>齐齐哈尔经营部</small>
              <strong>{currentUnit}</strong>
            </span>
            <span aria-hidden="true">⌄</span>
          </button>
          {organizationMenuOpen && (
            <div
              aria-label="工作单位选择"
              className="formal-org-menu"
              role="menu"
            >
              <header>
                <strong>齐齐哈尔经营部</strong>
                <small>经营部本部统一管理五家粮库</small>
              </header>
              {businessUnits.map((unit, index) => (
                <button
                  aria-current={unit === currentUnit ? "true" : undefined}
                  aria-label={unit}
                  className={unit === currentUnit ? "is-active" : undefined}
                  key={unit}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setCurrentUnit(unit);
                    setOrganizationMenuOpen(false);
                  }}
                >
                  <span>{index === 0 ? "本部" : "粮库"}</span>
                  <strong>{unit}</strong>
                  {unit === currentUnit && <small>当前</small>}
                </button>
              ))}
            </div>
          )}
        </div>
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
        <button
          aria-expanded={personalMenuOpen}
          aria-label="个人账户：王洋"
          className="formal-user"
          type="button"
          onClick={() => {
            setPersonalMenuOpen((value) => !value);
            setOrganizationMenuOpen(false);
          }}
        >
          <span>王</span>
          <strong>王洋</strong>
        </button>
        {personalMenuOpen && (
          <div
            aria-label="个人账户菜单"
            className="formal-personal-menu"
            role="menu"
          >
            <header>
              <span>王</span>
              <div>
                <strong>王洋</strong>
                <small>所属单位：{currentUnit}</small>
              </div>
            </header>
            {[
              "个人资料",
              "岗位与数据权限",
              "账号安全",
              "操作与登录记录",
              "退出登录",
            ].map((label) => (
              <button key={label} role="menuitem" type="button">
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
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
      window.matchMedia("(max-width: 1120px)").matches,
  );
  const [regionId, setRegionId] = useState<EnterpriseRegionId>("qiqihar-all");
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
    <EnterpriseRegionProvider regionId={regionId} onRegionChange={setRegionId}>
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
    </EnterpriseRegionProvider>
  );
}
