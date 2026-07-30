import { useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { navigationItems, type NavigationItem } from "@/app/router/navigation";

function owningParentPath(pathname: string): string | undefined {
  return navigationItems.find((item) =>
    item.children?.some(
      (child) =>
        pathname === child.path || pathname.startsWith(`${child.path}/`),
    ),
  )?.path;
}

export function EnterpriseShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const automaticExpandedPath = owningParentPath(location.pathname);
  const [expansionOverride, setExpansionOverride] = useState<{
    locationKey: string;
    path: string | undefined;
  }>();
  const expandedPath =
    expansionOverride?.locationKey === location.key
      ? expansionOverride.path
      : automaticExpandedPath;
  const navigate = useNavigate();

  function openItem(item: NavigationItem) {
    if (item.children?.length) {
      setExpansionOverride({
        locationKey: location.key,
        path: expandedPath === item.path ? undefined : item.path,
      });
      return;
    }
    void navigate(item.path);
  }

  return (
    <div className="enterprise-shell">
      <aside
        className={`enterprise-sider${collapsed ? " enterprise-sider-collapsed" : ""}`}
      >
        <div className="enterprise-brand">
          <span aria-hidden="true" className="enterprise-brand-mark">
            ▦
          </span>
          {!collapsed && <span>粮食商情企业系统</span>}
        </div>
        <nav aria-label="主导航">
          <ul className="enterprise-navigation">
            {navigationItems.map((item) => {
              const expanded = expandedPath === item.path;
              const selected =
                location.pathname === item.path ||
                (item.path !== "/" &&
                  location.pathname.startsWith(`${item.path}/`));
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    className={`enterprise-navigation-item${selected ? " is-selected" : ""}`}
                    aria-expanded={item.children?.length ? expanded : undefined}
                    onClick={() => openItem(item)}
                  >
                    {collapsed ? item.label.slice(0, 1) : item.label}
                  </button>
                  {!collapsed && expanded && item.children && (
                    <ul className="enterprise-navigation-children">
                      {item.children.map((child) => (
                        <li key={child.key}>
                          <button
                            type="button"
                            className={`enterprise-navigation-item enterprise-navigation-child${location.pathname === child.path ? " is-selected" : ""}`}
                            onClick={() => void navigate(child.path)}
                          >
                            {child.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <section className="enterprise-frame">
        <header className="enterprise-header">
          <div className="enterprise-header-group">
            <button
              type="button"
              className="enterprise-header-button"
              onClick={() => setCollapsed((value) => !value)}
              aria-label="收起或展开菜单"
            >
              ☰
            </button>
            <strong>齐齐哈尔粮食商情企业系统</strong>
          </div>
          <div className="enterprise-header-group">
            <span className="enterprise-simulated-badge">模拟数据</span>
            <span>区域审核员</span>
          </div>
        </header>
        <main className="enterprise-content">{children}</main>
      </section>
    </div>
  );
}
