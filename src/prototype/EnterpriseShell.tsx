import { useState, type ReactNode } from "react";
import { EnterpriseApplicationLauncher } from "./EnterpriseApplicationLauncher";
import { EnterpriseIcon, type EnterpriseIconName } from "./EnterpriseIcon";
import {
  formalApplicationDefinitions,
  type FormalShellIdentity,
} from "./formalEnterpriseData";
import { type FormalLocation, type FormalRoute } from "./formalEnterpriseModel";

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
  shellIdentity,
  children,
}: {
  location: FormalLocation;
  onNavigate: (route: FormalRoute) => void;
  shellIdentity: FormalShellIdentity;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [currentUnit, setCurrentUnit] = useState(shellIdentity.workUnit.currentUnitLabel);
  const [workUnitOpen, setWorkUnitOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const application = formalApplicationDefinitions.find(
    (item) => item.key === location.route.application,
  );

  return (
    <div className={`formal-enterprise${collapsed ? " is-sidebar-collapsed" : ""}`}>
      <header className="formal-header formal-global-header">
        <div className="formal-header-primary">
          <EnterpriseApplicationLauncher />
          <div className="formal-brand"><span>企</span><strong>{shellIdentity.platformName}</strong></div>
          <div className="formal-org-switcher">
            <button aria-expanded={workUnitOpen} aria-label={`当前工作单位：${shellIdentity.workUnit.organizationLabel}，${currentUnit}`} className="formal-org-selector" type="button" onClick={() => { setWorkUnitOpen((value) => !value); setAccountOpen(false); }}>
              <EnterpriseIcon name="home" />
              <span><small>{shellIdentity.workUnit.organizationLabel}</small><strong>{currentUnit}</strong></span>
            </button>
            {workUnitOpen && <div aria-label="工作单位选择" className="formal-org-menu" role="menu">
              {shellIdentity.workUnit.units.map((unit) => <button aria-current={unit === currentUnit ? "true" : undefined} key={unit} role="menuitem" type="button" onClick={() => { setCurrentUnit(unit); setWorkUnitOpen(false); }}>{unit}</button>)}
            </div>}
          </div>
          <label className="formal-global-search">
            <EnterpriseIcon name="search" />
            <input aria-label="搜索应用和业务对象" placeholder="搜索应用和业务对象" />
          </label>
          <div className="formal-header-spacer" />
          <button aria-label="任务中心" className="formal-header-tool" type="button"><EnterpriseIcon name="task" /></button>
          <button aria-label="通知" className="formal-header-tool" type="button"><EnterpriseIcon name="bell" /></button>
          <button aria-label="帮助" className="formal-header-tool" type="button"><EnterpriseIcon name="help" /></button>
          <button aria-expanded={accountOpen} aria-label={`个人账户：${shellIdentity.account.displayName}`} className="formal-user" type="button" onClick={() => { setAccountOpen((value) => !value); setWorkUnitOpen(false); }}>
            <span>{shellIdentity.account.displayName.slice(0, 1)}</span><strong>{shellIdentity.account.displayName}</strong>
          </button>
          {accountOpen && <div aria-label="个人账户菜单" className="formal-personal-menu" role="menu">{shellIdentity.account.menuItems.map((item) => <button key={item} role="menuitem" type="button">{item}</button>)}</div>}
        </div>
        <nav aria-label="业务应用" className="formal-application-nav">
          {formalApplicationDefinitions.map((item) => (
            <button
              aria-current={item.key === location.route.application ? "page" : undefined}
              className={item.key === location.route.application ? "is-active" : ""}
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.navigation[0].route)}
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
                  className={item.route.section === location.route.section ? "is-active" : ""}
                  key={`${item.route.application}:${item.route.section}`}
                  type="button"
                  onClick={() => onNavigate(item.route)}
                >
                  <EnterpriseIcon name={sectionIcons[item.route.section] ?? "list"} />
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
