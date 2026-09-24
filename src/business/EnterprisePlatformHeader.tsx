import { WORKBENCH_URL, identityNavigationUrl } from "./workbenchNavigation";
import type { ReactNode } from "react";
import type { CurrentSession } from "@/platform/api/realtimeBusinessRepository";
import { EnterpriseIcon } from "./EnterpriseIcon";

export function sessionRoleLabel(session?: CurrentSession | null): string {
  if (!session) return "";
  if (session.rootAdministrator) return "系统最高管理员";
  const names: Record<string, string> = {
    BUSINESS_OPERATOR: "普通员工",
    BUSINESS_REVIEWER: "管理员",
    UNIT_MANAGER: "单位负责人",
    REPORT_OPERATOR: "报表业务员",
    ADMIN: "管理员",
    IDENTITY_ADMIN: "账号管理员",
  };
  return (
    session.roleCodes
      .map((code) => names[code])
      .filter(Boolean)
      .join("、") || "员工"
  );
}

export function EnterprisePlatformHeader({
  platformName = "齐齐哈尔粮食商情企业平台",
  displayName,
  roleLabel,
  canManage,
  activeSection,
  accountHref = "/identity.html?view=profile",
  managementHref = "/identity.html?view=employees",
  managementLabel,
  onProfile,
  notification,
  tools,
  onModuleMenuToggle,
  moduleMenuOpen = false,
}: {
  platformName?: string;
  displayName: string;
  roleLabel: string;
  canManage: boolean;
  activeSection: "business" | "tasks" | "management" | "profile";
  accountHref?: string;
  managementHref?: string;
  managementLabel?: string;
  onProfile?: () => void;
  notification?: ReactNode;
  tools?: ReactNode;
  onModuleMenuToggle?: () => void;
  moduleMenuOpen?: boolean;
}) {
  const person = (
    <>
      <svg className="platform-avatar" viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="19" fill="#e6f0ff" />
        <circle cx="20" cy="14" r="7" fill="#9fbee7" />
        <path d="M6 34c1-9 7-12 14-12s13 3 14 12" fill="#9fbee7" />
      </svg>
      <span>
        <strong>{displayName || "个人中心"}</strong>
        <small>{roleLabel ? `${roleLabel} · ` : ""}个人中心⌄</small>
      </span>
    </>
  );
  return (
    <div className="enterprise-platform-header">
      <a className="platform-brand" href={WORKBENCH_URL}>
        <img
          className="platform-rice-mark"
          src="/brand/rice-emblem.png"
          alt="金色双稻穗与田垄徽标"
        />
        <strong>{platformName}</strong>
        <small>粮安天下 · 服务产业 · 数智赋能</small>
      </a>
      {onModuleMenuToggle && (
        <button
          className="platform-module-menu-toggle"
          type="button"
          aria-label={moduleMenuOpen ? "关闭模块菜单" : "打开模块菜单"}
          aria-controls="mobile-business-modules"
          aria-expanded={moduleMenuOpen}
          onClick={onModuleMenuToggle}
        >
          <EnterpriseIcon name="list" />
          <span>模块</span>
        </button>
      )}
      <nav aria-label="平台应用">
        <a
          href={WORKBENCH_URL}
          aria-current={activeSection === "business" ? "page" : undefined}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <path d="M8 6V4h8v2M3 7h18v14H3zM3 11l9 4 9-4M10 12h4v4h-4z" />
          </svg>
          业务工作台
        </a>
        <a
          href={`${WORKBENCH_URL}?page=work&section=my-tasks`}
          aria-current={activeSection === "tasks" ? "page" : undefined}
        >
          <EnterpriseIcon name="task" />
          我的任务
        </a>
        {canManage && (
          <a
            href={identityNavigationUrl(managementHref, window.location)}
            aria-label={managementLabel}
            aria-current={activeSection === "management" ? "page" : undefined}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <path d="m10 3-1 3-3 1-2 2 1 3-1 3 2 2 3 1 1 3h4l1-3 3-1 2-2-1-3 1-3-2-2-3-1-1-3z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            系统管理
          </a>
        )}
      </nav>
      {tools}
      {notification ?? (
        <a
          className="platform-bell"
          href={`${WORKBENCH_URL}?panel=notifications`}
          aria-label="业务通知"
        >
          <EnterpriseIcon name="bell" />
        </a>
      )}
      {onProfile ? (
        <button
          className="platform-person"
          type="button"
          aria-label={`当前用户：${displayName}，${roleLabel}`}
          onClick={onProfile}
        >
          {person}
        </button>
      ) : (
        <a
          className="platform-person"
          href={identityNavigationUrl(accountHref, window.location)}
          aria-label={`当前用户：${displayName}`}
        >
          {person}
        </a>
      )}
    </div>
  );
}
