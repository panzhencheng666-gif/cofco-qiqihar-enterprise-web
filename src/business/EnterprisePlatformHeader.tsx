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
      <a className="platform-brand" href="/">
        <svg
          className="platform-rice-mark"
          viewBox="0 0 64 64"
          role="img"
          aria-label="金色稻穗"
        >
          <g fill="none" stroke="currentColor" strokeLinecap="round">
            <path d="M14 57C23 44 25 25 37 14c9-8 18-3 18 6" strokeWidth="2" />
            <path
              d="M23 42C14 39 10 31 11 24c6 4 11 9 12 18ZM26 35c7-7 13-9 20-8-5 6-11 10-21 11"
              strokeWidth="1.5"
            />
            <path
              d="M32 20c-7-2-11 1-13 7M37 15c-7-5-13-2-15 1M43 12c-5-7-10-6-13-3M48 13c6 3 8 8 6 12M41 16c6 3 8 8 6 13M35 22c5 3 7 6 5 12"
              strokeWidth="1.3"
            />
          </g>
          <g fill="currentColor">
            <path d="M20 23c3 4 2 9-2 12-3-4-3-9 2-12ZM23 12c4 2 5 7 2 11-4-2-5-7-2-11ZM30 5c5 0 8 4 7 8-5 0-8-3-7-8ZM53 20c4 3 4 8 0 12-4-3-4-8 0-12ZM47 25c4 3 4 8 0 12-4-3-4-8 0-12ZM40 30c4 3 3 8-1 11-3-4-3-8 1-11Z" />
          </g>
          <path
            d="M8 53a29 29 0 0 1 0-38M57 40a29 29 0 0 1-27 19"
            fill="none"
            stroke="currentColor"
            strokeWidth=".8"
            opacity=".45"
          />
        </svg>
        <strong>{platformName}</strong>
        <small>粮安天下 · 服务产业 · 数智赋能</small>
      </a>
      <nav aria-label="平台应用">
        <a
          href="/"
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
          href="/?page=work&section=my-tasks"
          aria-current={activeSection === "tasks" ? "page" : undefined}
        >
          <EnterpriseIcon name="task" />
          我的任务
        </a>
        {canManage && (
          <a
            href={managementHref}
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
          href="/?panel=notifications"
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
          href={accountHref}
          aria-label={`当前用户：${displayName}`}
        >
          {person}
        </a>
      )}
    </div>
  );
}
