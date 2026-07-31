import { useState } from "react";
import { EnterpriseIcon } from "./EnterpriseIcon";

export const managementApplications = [
  {
    key: "governance",
    label: "数据治理",
    description: "主数据、指标、公式、可比规则、质量与血缘",
    permission: "治理管理员",
  },
  {
    key: "system",
    label: "系统管理",
    description: "组织、岗位、权限、接入、运行配置与审计",
    permission: "系统管理员",
  },
] as const;

export function EnterpriseApplicationLauncher() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        aria-expanded={open}
        aria-label="应用菜单"
        className="formal-launcher"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <EnterpriseIcon name="apps" />
      </button>
      {open && (
        <section aria-label="应用启动器" className="formal-org-menu" role="dialog">
          <header>
            <strong>管理应用</strong>
            <small>当前原型仅展示架构入口</small>
          </header>
          {managementApplications.map((application) => (
            <div key={application.key}>
              <strong>{application.label}</strong>
              <p>{application.description}</p>
              <small>{application.permission}</small>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
