import { useState } from "react";
import { EnterpriseIcon } from "./EnterpriseIcon";
import type { FormalApplication } from "./formalEnterpriseModel";

export const businessLauncherApplications: readonly {
  key: FormalApplication;
  label: string;
  description: string;
}[] = [
  {
    key: "work",
    label: "我的工作",
    description: "集中处理本人待填、待审、异常和待发布事项",
  },
  {
    key: "overview",
    label: "经营总览",
    description: "查看授权范围内的经营指标、风险与履责结果",
  },
  {
    key: "production",
    label: "产情监测",
    description: "管理种植调查任务、监测对象与产情分析",
  },
  {
    key: "market",
    label: "市场监测",
    description: "管理价格、库存、加工、物流等市场调查",
  },
  {
    key: "supply",
    label: "供需与态势",
    description: "开展供需测算、四年对比与核定记录查询",
  },
  {
    key: "reporting",
    label: "报表中心",
    description: "编制、复核、分发并查询正式业务报告",
  },
];

export function EnterpriseApplicationLauncher({
  onSelect,
}: {
  onSelect?: (application: FormalApplication) => void;
}) {
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
        <section
          aria-label="应用启动器"
          className="formal-org-menu"
          role="dialog"
        >
          <header>
            <strong>业务应用</strong>
          </header>
          {businessLauncherApplications.map((application) => (
            <button
              aria-label={`打开${application.label}`}
              key={application.key}
              type="button"
              onClick={() => {
                onSelect?.(application.key);
                setOpen(false);
              }}
            >
              <strong>{application.label}</strong>
              <p>{application.description}</p>
            </button>
          ))}
        </section>
      )}
    </>
  );
}
