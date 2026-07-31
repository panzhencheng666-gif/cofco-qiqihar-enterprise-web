import { useState } from "react";
import { BusinessReportComposer } from "./BusinessReportComposer";
import type { BusinessReportContext } from "./businessReportModel";
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

type FormalIconName =
  | "apps"
  | "home"
  | "search"
  | "task"
  | "bell"
  | "help"
  | "chevron";

function FormalIcon({ name }: { name: FormalIconName }) {
  if (name === "apps") {
    return (
      <svg aria-hidden="true" className="formal-icon" viewBox="0 0 24 24">
        {[5, 12, 19].flatMap((x) =>
          [5, 12, 19].map((y) => (
            <rect
              height="3"
              key={`${String(x)}-${String(y)}`}
              rx="0.7"
              width="3"
              x={x - 1.5}
              y={y - 1.5}
            />
          )),
        )}
      </svg>
    );
  }

  const paths: Record<Exclude<FormalIconName, "apps">, string> = {
    home: "M3.5 10.5 12 3.5l8.5 7V20h-6v-6h-5v6h-6z",
    search: "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm5 11.5 5 5",
    task: "M6 4h12v17H6zM9 9h6M9 13h6M9 17h4",
    bell: "M5 17h14l-1.5-2.5V10a5.5 5.5 0 0 0-11 0v4.5zM10 20h4",
    help: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-2.3 6.2a2.5 2.5 0 1 1 3.7 2.2c-1 .6-1.4 1.2-1.4 2.3M12 17.5h.01",
    chevron: "m8 10 4 4 4-4",
  };

  return (
    <svg aria-hidden="true" className="formal-icon" viewBox="0 0 24 24">
      <path d={paths[name]} />
    </svg>
  );
}

function FormalGlobalHeader({
  route,
  onApplicationChange,
}: {
  route: FormalRoute;
  onApplicationChange: (application: FormalApplication) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const application =
    formalApplicationDefinitions.find(
      (item) => item.key === route.application,
    ) ?? formalApplicationDefinitions[0];

  return (
    <header className="formal-header formal-global-header">
      <button
        aria-label="打开应用列表"
        className="formal-launcher"
        type="button"
      >
        <FormalIcon name="apps" />
      </button>
      <div className="formal-brand">
        <span>齐</span>
        <div>
          <strong>齐齐哈尔粮食商情企业平台</strong>
          <small>统一业务与数据运营平台</small>
        </div>
      </div>
      <button className="formal-org-selector" type="button">
        <FormalIcon name="home" />
        <span>
          <small>当前组织</small>
          <strong>东北区域经营中心</strong>
        </span>
        <FormalIcon name="chevron" />
      </button>
      <div className="formal-app-selector">
        <button
          aria-expanded={menuOpen}
          className="formal-selector-button"
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span>
            <small>当前业务应用</small>
            <strong>{application.label}</strong>
          </span>
          <FormalIcon name="chevron" />
        </button>
        {menuOpen && (
          <div
            aria-label="切换业务应用"
            className="formal-app-menu"
            role="menu"
          >
            {formalApplicationDefinitions.map((item) => (
              <button
                className={item.key === route.application ? "is-active" : ""}
                key={item.key}
                role="menuitem"
                type="button"
                onClick={() => {
                  onApplicationChange(item.key);
                  setMenuOpen(false);
                }}
              >
                <span>{item.code}</span>
                <strong>{item.label}</strong>
                <small>{item.note}</small>
              </button>
            ))}
          </div>
        )}
      </div>
      <label className="formal-global-search">
        <FormalIcon name="search" />
        <input
          aria-label="搜索应用和业务对象"
          placeholder="搜索应用、区域、责任人、任务、报告和指标"
        />
      </label>
      <span className="formal-environment">演示环境 · 非生产数据</span>
      <div className="formal-header-spacer" />
      <button
        aria-label="任务中心，9 项待处理"
        className="formal-header-tool"
        type="button"
      >
        <FormalIcon name="task" />
        <b>9</b>
      </button>
      <button
        aria-label="通知，3 条未读"
        className="formal-header-tool"
        type="button"
      >
        <FormalIcon name="bell" />
        <b>3</b>
      </button>
      <button aria-label="帮助" className="formal-header-tool" type="button">
        <FormalIcon name="help" />
      </button>
      <div className="formal-user">
        <span>王</span>
        <div>
          <strong>王洋</strong>
          <small>区域数据管理员</small>
        </div>
        <FormalIcon name="chevron" />
      </div>
    </header>
  );
}

function FormalSidebar({
  route,
  onSectionChange,
}: {
  route: FormalRoute;
  onSectionChange: (section: FormalSection) => void;
}) {
  const application =
    formalApplicationDefinitions.find(
      (item) => item.key === route.application,
    ) ?? formalApplicationDefinitions[0];

  return (
    <aside className="formal-sidebar">
      <div className="formal-sidebar-app">
        <span>{application.shortLabel.slice(0, 1)}</span>
        <div>
          <small>当前业务应用</small>
          <strong>{application.label}</strong>
        </div>
      </div>
      <p className="formal-sidebar-description">{application.note}</p>
      <nav
        aria-label={`${application.label}模块`}
        className="formal-sidebar-navigation"
      >
        <div className="formal-nav-group">
          <span>业务工作区</span>
          {application.navigation.map((item) => (
            <button
              className={item.key === route.section ? "is-active" : ""}
              key={item.key}
              type="button"
              onClick={() => onSectionChange(item.key as FormalSection)}
            >
              <i aria-hidden="true" />
              <b>{item.label}</b>
            </button>
          ))}
        </div>
      </nav>
      <div className="formal-sidebar-status">
        <span />
        <div>
          <strong>核心服务全部正常</strong>
          <small>最近同步 10:46 · 会话安全</small>
        </div>
      </div>
    </aside>
  );
}

export function FormalEnterprisePrototype({
  initialSearch,
}: FormalEnterprisePrototypeProps) {
  const [route, setRoute] = useState<FormalRoute>(() =>
    readFormalRoute(initialSearch ?? window.location.search),
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
    <div className="formal-enterprise">
      <FormalGlobalHeader
        route={route}
        onApplicationChange={(application) =>
          changeRoute({
            application,
            section: getDefaultFormalSection(application),
          })
        }
      />
      <div className="formal-shell">
        <FormalSidebar
          route={route}
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
