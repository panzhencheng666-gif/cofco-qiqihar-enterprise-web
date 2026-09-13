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
          className="platform-wheat"
          viewBox="0 0 54 64"
          role="img"
          aria-label="金色稻穗"
        >
          <defs>
            <linearGradient id="rice-gold" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#fff0b9" />
              <stop offset=".55" stopColor="#e4c778" />
              <stop offset="1" stopColor="#b99543" />
            </linearGradient>
          </defs>
          <g
            fill="none"
            stroke="#d9bc71"
            strokeWidth="1.25"
            strokeLinecap="round"
          >
            <path d="M8 61C16 42 25 15 39 8c9-4 13 2 11 11" />
            <path d="M14 48C3 38 4 28 7 22c1 12 8 15 10 19M19 38c7-6 16-7 22-4-9 0-15 5-22 9" />
            <path d="M26 23c-7-2-11 0-14 6M30 17c-7-4-12-3-15 0M35 12c-3-7-7-8-12-7M39 9c1-6 5-7 8-7M42 9c8 1 10 6 8 12M36 12c8 3 10 7 8 14M31 17c7 3 9 7 7 13M27 23c5 3 6 7 4 12" />
          </g>
          <g fill="url(#rice-gold)" stroke="#f2dea0" strokeWidth=".35">
            {[
              [12, 30, -30],
              [15, 19, -35],
              [23, 6, -55],
              [47, 3, 45],
              [50, 22, 12],
              [45, 28, 10],
              [39, 31, 18],
              [32, 36, 16],
              [19, 25, -35],
              [24, 18, -35],
              [30, 11, -35],
              [45, 15, 8],
              [38, 22, 15],
              [33, 28, 15],
            ].map(([x, y, angle], i) => (
              <ellipse
                key={i}
                cx={x}
                cy={y}
                rx="2.1"
                ry="4.1"
                transform={`rotate(${angle} ${x} ${y})`}
              />
            ))}
          </g>
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
