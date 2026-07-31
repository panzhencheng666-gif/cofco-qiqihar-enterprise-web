import { useState, type ReactNode } from "react";
import { EnterpriseApplicationLauncher } from "./EnterpriseApplicationLauncher";
import { EnterpriseIcon, type EnterpriseIconName } from "./EnterpriseIcon";
import { formalApplicationDefinitions } from "./formalEnterpriseData";
import {
  createFormalRoute,
  type FormalLocation,
  type FormalRoute,
} from "./formalEnterpriseModel";

const sectionIcons: Partial<Record<string, EnterpriseIconName>> = {
  tasks: "entry",
  operations: "overview",
  risks: "exception",
  duty: "review",
  releases: "upload",
  objects: "list",
  analysis: "report",
  calculation: "list",
  comparison: "review",
  versions: "history",
  compose: "entry",
  "review-distribution": "upload",
  ledger: "history",
};

export function EnterpriseShell({
  location,
  onNavigate,
  children,
}: {
  location: FormalLocation;
  onNavigate: (route: FormalRoute) => void;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const application = formalApplicationDefinitions.find(
    (item) => item.key === location.route.application,
  );

  return (
    <div className={`formal-enterprise${collapsed ? " is-sidebar-collapsed" : ""}`}>
      <header className="formal-header formal-global-header">
        <div className="formal-header-primary">
          <EnterpriseApplicationLauncher />
          <div className="formal-brand"><span>企</span><strong>企业经营平台</strong></div>
          <label className="formal-global-search">
            <EnterpriseIcon name="search" />
            <input aria-label="搜索应用和业务对象" placeholder="搜索应用和业务对象" />
          </label>
          <div className="formal-header-spacer" />
          <button aria-label="任务中心" className="formal-header-tool" type="button"><EnterpriseIcon name="task" /></button>
          <button aria-label="通知" className="formal-header-tool" type="button"><EnterpriseIcon name="bell" /></button>
          <button aria-label="帮助" className="formal-header-tool" type="button"><EnterpriseIcon name="help" /></button>
        </div>
        <nav aria-label="业务应用" className="formal-application-nav">
          {formalApplicationDefinitions.map((item) => (
            <button
              aria-current={item.key === location.route.application ? "page" : undefined}
              className={item.key === location.route.application ? "is-active" : ""}
              key={item.key}
              type="button"
              onClick={() => onNavigate(createFormalRoute(item.key, item.navigation[0].key as never))}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <div className="formal-enterprise-shell">
        <aside className="formal-sidebar">
          <nav aria-label={`${application?.label ?? "业务应用"}模块`} className="formal-sidebar-navigation">
            <div className="formal-nav-group">
              <span>业务工作</span>
              {application?.navigation.map((item) => (
                <button
                  className={item.key === location.route.section ? "is-active" : ""}
                  key={item.key}
                  type="button"
                  onClick={() => onNavigate(createFormalRoute(location.route.application, item.key as never))}
                >
                  <EnterpriseIcon name={sectionIcons[item.key] ?? "list"} />
                  <b>{item.label}</b>
                </button>
              ))}
            </div>
          </nav>
          <button aria-label={collapsed ? "展开左侧导航" : "收起左侧导航"} className="formal-sidebar-collapse" type="button" onClick={() => setCollapsed((value) => !value)}>
            <EnterpriseIcon name={collapsed ? "expand" : "collapse"} />
          </button>
        </aside>
        <main className="formal-main">{children}</main>
      </div>
    </div>
  );
}
