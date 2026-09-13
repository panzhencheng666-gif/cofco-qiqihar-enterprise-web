import { useEffect, useState } from "react";
import {
  realtimeBusinessRepository,
  type CurrentSession,
  type RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";
import {
  IdentityGovernancePanel,
  type GovernanceView,
} from "./IdentityGovernancePanel";
import {
  EnterprisePlatformHeader,
  sessionRoleLabel,
} from "../EnterprisePlatformHeader";
import { EnterpriseIcon } from "../EnterpriseIcon";

export function allowedIdentityView(
  requested: string | null,
  session: CurrentSession,
): GovernanceView {
  const permissions = session.permissions;
  if (requested === "profile") return "profile";
  if (requested === "regions" && permissions.includes("IDENTITY_READ"))
    return "regions";
  if (requested === "reviews" && permissions.includes("ACCESS_REVIEW"))
    return "reviews";
  if (requested === "audit" && permissions.includes("AUDIT_READ"))
    return "audit";
  if (permissions.includes("IDENTITY_READ")) return "employees";
  if (permissions.includes("ACCESS_REVIEW")) return "reviews";
  if (permissions.includes("AUDIT_READ")) return "audit";
  return "profile";
}

export function IdentityWorkspaceApplication({
  repository = realtimeBusinessRepository,
}: {
  repository?: RealtimeBusinessRepository;
}) {
  const environment = (
    import.meta as { readonly env?: Readonly<Record<string, unknown>> }
  ).env;
  const managementUrl = environment?.["VITE_IDENTITY_MANAGEMENT_URL"];
  const [session, setSession] = useState<CurrentSession | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<GovernanceView>("profile");
  useEffect(() => {
    let active = true;
    void repository
      .loadCurrentSession()
      .then((value) => {
        if (!active) return;
        setSession(value);
        setView(
          allowedIdentityView(
            new URLSearchParams(window.location.search).get("view"),
            value,
          ),
        );
        setError("");
      })
      .catch((caught: unknown) => {
        if (active)
          setError(
            caught instanceof RealtimeApiError && caught.status === 401
              ? "请先登录企业账号，系统将按你的实际权限展示页面。"
              : "账号信息读取失败，请重新读取。",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repository, attempt]);
  const openView = (next: GovernanceView) => {
    if (!session) return;
    const allowed = allowedIdentityView(next, session);
    const url = new URL(window.location.href);
    url.searchParams.set("view", allowed);
    window.history.replaceState(null, "", url);
    setView(allowed);
  };
  const canManage =
    session?.permissions.some((permission) =>
      ["IDENTITY_READ", "ACCESS_REVIEW", "AUDIT_READ"].includes(permission),
    ) ?? false;
  return (
    <div className="identity-application enterprise-branded">
      <header className="identity-application-header">
        <EnterprisePlatformHeader
          displayName={session?.displayName ?? ""}
          roleLabel={sessionRoleLabel(session)}
          canManage={canManage}
          activeSection={canManage ? "management" : "profile"}
          onProfile={() => openView("profile")}
        />
      </header>
      <aside className="identity-application-sidebar">
        <nav aria-label="账号管理导航">
          <p>
            <EnterpriseIcon name="apps" />
            {canManage ? "组织与权限" : "我的账号"}
          </p>
          {canManage && (
            <button
              type="button"
              aria-current={view !== "profile" ? "page" : undefined}
              onClick={() => openView("employees")}
            >
              <EnterpriseIcon name="settings" />
              人员与权限
            </button>
          )}
          {session && (
            <button
              type="button"
              aria-current={view === "profile" ? "page" : undefined}
              onClick={() => openView("profile")}
            >
              <EnterpriseIcon name="home" />
              个人中心
            </button>
          )}
        </nav>
        <p className="enterprise-sidebar-motto">
          立足粮食
          <br />
          <span>服务发展</span>
        </p>
      </aside>
      <main className="identity-application-main">
        {session ? (
          <IdentityGovernancePanel
            key={view}
            identityManagementUrl={
              typeof managementUrl === "string" ? managementUrl : undefined
            }
            standalone
            initialView={view}
            onViewChange={openView}
            onClose={() => {
              window.location.assign("/");
            }}
            session={session}
            repository={repository}
            logoutUrl="/api/v1/session/logout"
          />
        ) : (
          <section className="identity-login-state">
            <h1>{loading ? "正在读取账号信息…" : "登录企业账号"}</h1>
            {error && <p role="alert">{error}</p>}
            {!loading && (
              <>
                <a
                  href="/api/v1/session/login"
                  target="_blank"
                  rel="noreferrer"
                >
                  打开统一登录
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    setAttempt(attempt + 1);
                  }}
                >
                  我已登录，重新读取
                </button>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
