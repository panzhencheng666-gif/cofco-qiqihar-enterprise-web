import { EnterprisePage } from "@/shared/enterprise-ui";
import { useCurrentWorkspace } from "@/workflows/current-workspace/useCurrentWorkspace";

export function AccountSecurityPage() {
  const { workspace, isLoading, isError } = useCurrentWorkspace();

  return (
    <EnterprisePage
      eyebrow="个人工作"
      title="账号与安全"
      description="查看当前身份、责任岗位和会话状态；账号修改暂不在此页面提供。"
    >
      <section className="enterprise-work-panel">
        <header className="enterprise-panel-heading">
          <div>
            <h2>当前会话</h2>
            <p>身份与责任岗位来自当前工作空间。</p>
          </div>
        </header>
        {isLoading && <p>正在读取账号安全信息</p>}
        {isError && <p role="alert">账号安全信息读取失败</p>}
        {workspace && (
          <dl className="enterprise-detail-list">
            <div>
              <dt>登录人员</dt>
              <dd>{workspace.actor.displayName}</dd>
            </div>
            <div>
              <dt>责任岗位</dt>
              <dd>{workspace.actor.responsibilityPosition}</dd>
            </div>
            <div>
              <dt>所属组织</dt>
              <dd>{workspace.organization.name}</dd>
            </div>
            <div>
              <dt>责任区域</dt>
              <dd>{workspace.regionName}</dd>
            </div>
            <div>
              <dt>数据模式</dt>
              <dd>{workspace.dataMode}</dd>
            </div>
            <div>
              <dt>会话状态</dt>
              <dd>{workspace.session.status}</dd>
            </div>
          </dl>
        )}
      </section>
    </EnterprisePage>
  );
}
