import { useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  projectNavigation,
  resolveActiveApplication,
  type ContextNavigationItem,
} from "@/app/router/navigation";
import { EnterpriseContextBar } from "@/app/shell/EnterpriseContextBar";
import { EnterpriseGlobalSearch } from "@/app/shell/EnterpriseGlobalSearch";
import {
  EnterpriseFailure,
  EnterpriseIcon,
  EnterpriseLoading,
} from "@/shared/enterprise-ui";
import { useCurrentWorkspace } from "@/workflows/current-workspace/useCurrentWorkspace";
import { useMyWork } from "@/workflows/my-work/useMyWork";
import { isMyWorkCompleted } from "@/workflows/my-work/view-state";

const accountContext: readonly ContextNavigationItem[] = [
  {
    key: "account-session",
    label: "账号与会话",
    path: "/account/security",
  },
];

export function EnterpriseShell({ children }: { children: ReactNode }) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { workspace, isLoading, isError, reload } = useCurrentWorkspace();
  const myWork = useMyWork();
  const navigation = projectNavigation(workspace?.capabilities ?? []);
  const isAccountSecurity = location.pathname === "/account/security";
  const activeApplication =
    resolveActiveApplication(location.pathname, navigation) ?? navigation[0];
  const applicationName = isAccountSecurity
    ? "账号与安全"
    : (activeApplication?.label ?? "业务页面");
  const operatingSpaceName = isAccountSecurity
    ? "个人中心"
    : (activeApplication?.spaceLabel ?? "业务空间");
  const applicationIcon = isAccountSecurity
    ? "security"
    : (activeApplication?.icon ?? "work");
  const contextItems = isAccountSecurity
    ? accountContext
    : (activeApplication?.contextItems ?? []);
  const currentUrl = `${location.pathname}${location.search}`;
  const activeContext = contextItems.find(
    (item) =>
      item.path === currentUrl ||
      (item.path !== "/" &&
        !item.path.includes("?") &&
        location.pathname === item.path),
  );
  const contextName = activeContext?.label ?? applicationName;
  const canOpenAccountSecurity =
    workspace?.capabilities.includes("account-security:view") === true;
  const pendingWorkCount = myWork.rows.filter(
    (item) => !isMyWorkCompleted(item),
  ).length;

  function openApplication(path: string) {
    setSwitcherOpen(false);
    void navigate(path);
  }

  return (
    <div className="enterprise-shell">
      <a className="enterprise-skip-link" href="#main-content">
        跳至主内容
      </a>

      <header className="enterprise-global-header">
        <button
          type="button"
          className="enterprise-app-launcher"
          aria-label="打开应用切换"
          aria-expanded={switcherOpen}
          onClick={() => setSwitcherOpen((value) => !value)}
        >
          <span aria-hidden="true" className="enterprise-app-grid">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        </button>

        <div className="enterprise-brand">
          <span aria-hidden="true" className="enterprise-brand-mark">
            齐
          </span>
          <span className="enterprise-brand-copy">
            <strong>齐齐哈尔粮食商情企业系统</strong>
            <small>统一业务与数据运营平台</small>
          </span>
        </div>

        {workspace && (
          <div
            className="enterprise-header-workspace"
            aria-label="全局工作空间"
          >
            <div>
              <span>当前组织</span>
              <strong>{workspace.organization.name}</strong>
            </div>
            <div>
              <span>当前应用</span>
              <strong>{operatingSpaceName}</strong>
            </div>
          </div>
        )}

        {workspace && (
          <EnterpriseGlobalSearch
            navigation={navigation}
            onNavigate={(path) => openApplication(path)}
          />
        )}

        <div className="enterprise-header-spacer" />

        {workspace && (
          <>
            {!myWork.isLoading && !myWork.isError && (
              <button
                type="button"
                className="enterprise-header-task"
                aria-label={`本人待办 ${pendingWorkCount} 项`}
                onClick={() => void navigate("/")}
              >
                <EnterpriseIcon name="work" />
                <span>{pendingWorkCount}</span>
              </button>
            )}
            <span className="enterprise-simulated-badge">
              {workspace.dataMode}
            </span>
            <button
              type="button"
              className="enterprise-header-account"
              aria-label="账号与安全"
              disabled={!canOpenAccountSecurity}
              onClick={() => void navigate("/account/security")}
            >
              <span className="enterprise-avatar" aria-hidden="true">
                {workspace.actor.displayName.slice(0, 1)}
              </span>
              <span className="enterprise-account-copy">
                <strong>{workspace.actor.displayName}</strong>
                <small>{workspace.actor.responsibilityPosition}</small>
              </span>
            </button>
          </>
        )}
      </header>

      {switcherOpen && (
        <section className="enterprise-app-switcher" aria-label="应用切换面板">
          <header>
            <strong>业务应用</strong>
            <span>仅展示当前账号可访问的业务应用</span>
          </header>
          <nav aria-label="主导航">
            <ul>
              {navigation.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    aria-current={
                      activeApplication?.key === item.key ? "page" : undefined
                    }
                    onClick={() => openApplication(item.path)}
                  >
                    <EnterpriseIcon name={item.icon} />
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </section>
      )}

      <div className="enterprise-workspace-frame">
        <aside
          className="enterprise-context-rail"
          data-kind="contextual"
          aria-label={`${applicationName}上下文导航`}
        >
          <div className="enterprise-current-application">
            <EnterpriseIcon name={applicationIcon} />
            <div>
              <span>当前业务应用</span>
              <strong>{applicationName}</strong>
            </div>
          </div>

          <div className="enterprise-context-rail-label">业务工作区</div>
          <nav aria-label="业务上下文">
            <ul>
              {contextItems.map((item) => {
                const selected =
                  item.path === currentUrl ||
                  (item.path !== "/" &&
                    !item.path.includes("?") &&
                    location.pathname === item.path);
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      className={selected ? "is-selected" : undefined}
                      aria-current={selected ? "page" : undefined}
                      onClick={() => void navigate(item.path)}
                    >
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {workspace && (
            <div className="enterprise-context-rail-footer">
              <span className="enterprise-security-dot" aria-hidden="true" />
              <span>会话{workspace.session.status}</span>
            </div>
          )}
        </aside>

        <section className="enterprise-main-frame">
          <EnterpriseContextBar
            workspace={workspace}
            contextName={contextName}
            isLoading={isLoading}
            isError={isError}
          />

          <main className="enterprise-content" id="main-content">
            {isLoading && <EnterpriseLoading title="正在建立工作空间" />}
            {isError && (
              <div aria-label="工作空间无法建立" role="alert">
                <EnterpriseFailure
                  title="工作空间无法建立"
                  description="系统尚未确认当前身份、组织和责任范围，已阻止显示业务内容。"
                  onRetry={reload}
                />
              </div>
            )}
            {workspace && !isLoading && !isError ? children : null}
          </main>
        </section>
      </div>
    </div>
  );
}
