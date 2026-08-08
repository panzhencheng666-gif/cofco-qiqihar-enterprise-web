import type { CurrentWorkspace } from "@/workflows/current-workspace/model";

interface EnterpriseContextBarProps {
  workspace?: CurrentWorkspace;
  contextName: string;
  isLoading: boolean;
  isError: boolean;
}

export function EnterpriseContextBar({
  workspace,
  contextName,
  isLoading,
  isError,
}: EnterpriseContextBarProps) {
  return (
    <section className="enterprise-context-bar" aria-label="当前工作空间">
      {workspace && (
        <>
          <div className="enterprise-context-primary">
            <span>当前业务上下文</span>
            <strong>{contextName}</strong>
          </div>
          <div className="enterprise-context-divider" aria-hidden="true" />
          <dl className="enterprise-context-list">
            <div>
              <dt>组织</dt>
              <dd>{workspace.organization.name}</dd>
            </div>
            <div>
              <dt>责任区域</dt>
              <dd>{workspace.regionName}</dd>
            </div>
            <div>
              <dt>业务年度</dt>
              <dd>{workspace.marketingYear}</dd>
            </div>
            <div>
              <dt>数据范围</dt>
              <dd>{workspace.dataScopeName}</dd>
            </div>
          </dl>
        </>
      )}
      {isLoading && <span role="status">正在读取工作空间</span>}
      {isError && <span role="alert">工作空间读取失败</span>}
    </section>
  );
}
