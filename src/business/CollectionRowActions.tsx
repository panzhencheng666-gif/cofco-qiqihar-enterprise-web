import { Children, type ReactNode } from "react";
import { Dropdown } from "antd";

/** Keep common actions visible; render secondary actions outside the scroll table. */
export function CollectionRowActions({ children }: { children: ReactNode }) {
  const actions = Children.toArray(children);
  return (
    <div className="collection-row-actions">
      {actions.slice(0, 2)}
      {actions.length > 2 && (
        <Dropdown
          trigger={["click"]}
          placement="bottomRight"
          menu={{
            items: actions.slice(2).map((action, index) => ({
              key: String(index),
              label: action,
            })),
          }}
          overlayClassName="collection-row-actions-menu"
        >
          <button
            type="button"
            className="enterprise-ledger-row-action"
            aria-label="更多操作"
          >
            更多操作 <span aria-hidden="true">⌄</span>
          </button>
        </Dropdown>
      )}
    </div>
  );
}
