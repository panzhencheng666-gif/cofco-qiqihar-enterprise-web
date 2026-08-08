export interface EnterpriseWorkspaceTab {
  key: string;
  label: string;
  target: string;
}

export function EnterpriseWorkspaceTabs({
  items,
  activeKey,
}: {
  items: readonly EnterpriseWorkspaceTab[];
  activeKey: string;
}) {
  return (
    <nav className="enterprise-workspace-tabs" aria-label="业务工作区导航">
      <ul>
        {items.map((item) => {
          const isActive = item.key === activeKey;
          return (
            <li key={item.key}>
              <a
                href={item.target}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
