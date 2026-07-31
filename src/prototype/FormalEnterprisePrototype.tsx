import { useMemo, useState } from "react";
import { BusinessReportComposer } from "./BusinessReportComposer";
import type { BusinessReportContext } from "./businessReportModel";
import {
  businessReportRows,
  dutyMonthlyRows,
  dutyWeeklyRows,
  formalApplicationDefinitions,
  formalWorkspaceByApplication,
  reportingNavigation,
  responsibilityAssignments,
  weeklyTasks,
  type FormalBusinessScope,
  type FormalMetric,
  type FormalRisk,
  type FormalStage,
} from "./formalEnterpriseData";
import {
  canFillWeeklyTask,
  readFormalRoute,
  writeFormalRoute,
  type FormalApplication,
  type FormalRoute,
  type ReportingSection,
} from "./formalEnterpriseModel";
import {
  getSupplyBalanceMetrics,
  getSupplyBalanceScope,
  supplyBalanceScopes,
  type SupplyBalanceScopeKey,
} from "./supplyBalanceScope";

interface FormalEnterprisePrototypeProps {
  initialSearch?: string;
}

type FormalIconName =
  | "apps"
  | "home"
  | "search"
  | "task"
  | "bell"
  | "help"
  | "chevron"
  | "download"
  | "plus"
  | "shield"
  | "clock"
  | "report";

const currentUserId = "user-wang-yang";

const reportPageMeta: Record<
  ReportingSection,
  {
    eyebrow: string;
    title: string;
    summary: string;
    primaryAction?: string;
    secondaryAction?: string;
  }
> = {
  overview: {
    eyebrow: "报送运营 / 报送总览",
    title: "报送与报告运营工作区",
    summary: "集中管理每周填报责任、截止履责、监督报告和业务报告版本。",
    primaryAction: "进入本周填报",
    secondaryAction: "导出当前态势",
  },
  responsibility: {
    eyebrow: "责任管理 / 填报责任",
    title: "填报责任与区域负责人",
    summary: "一个区域、一个事项、一个有效期间只允许一名可写责任人。",
    primaryAction: "新建责任配置",
    secondaryAction: "导出责任清单",
  },
  weekly: {
    eyebrow: "报送工作 / 本周填报",
    title: "第 31 周填报工作区",
    summary: "本人完成本人负责区域的周填报，审核人和管理员均无权代填。",
    secondaryAction: "查看填报说明",
  },
  records: {
    eyebrow: "报送工作 / 填报记录",
    title: "填报记录与截止快照",
    summary: "提交、退回、补填和审核记录按时间追加，历史记录不可覆盖。",
    secondaryAction: "导出填报记录",
  },
  overdue: {
    eyebrow: "报送工作 / 逾期记录",
    title: "逾期记录监督台",
    summary: "截止未提交自动记录逾期，责任人后续补填仍保留原逾期事实。",
    secondaryAction: "导出逾期清单",
  },
  "duty-weekly": {
    eyebrow: "责任管理 / 责任周报",
    title: "第 31 周填报责任周报",
    summary: "监督本周所有区域责任人是否按规定时间完成填报工作。",
    secondaryAction: "查看生成规则",
  },
  "duty-monthly": {
    eyebrow: "责任管理 / 责任月报",
    title: "2026 年 7 月填报责任月报",
    summary: "按固定周截止快照汇总个人与区域履责，不重新判断历史状态。",
    secondaryAction: "查看汇总口径",
  },
  "business-reports": {
    eyebrow: "报告管理 / 业务报告",
    title: "业务日报、周报与月报",
    summary: "报告只引用正式业务版本，生成过程不重新计算指标。",
    primaryAction: "新建报告运行",
    secondaryAction: "管理报告定义",
  },
  versions: {
    eyebrow: "报告管理 / 报告版本",
    title: "报告版本与替代关系",
    summary: "正式报告不可覆盖，修订生成新版本并保留原报告和替代原因。",
    secondaryAction: "导出版本清单",
  },
};

function FormalIcon({ name }: { name: FormalIconName }) {
  if (name === "apps") {
    return (
      <svg aria-hidden="true" className="formal-icon" viewBox="0 0 24 24">
        {[5, 12, 19].flatMap((x) =>
          [5, 12, 19].map((y) => (
            <rect
              height="3"
              key={`${String(x)}-${String(y)}`}
              rx="0.7"
              width="3"
              x={x - 1.5}
              y={y - 1.5}
            />
          )),
        )}
      </svg>
    );
  }

  const paths: Record<Exclude<FormalIconName, "apps">, string> = {
    home: "M3.5 10.5 12 3.5l8.5 7V20h-6v-6h-5v6h-6z",
    search: "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm5 11.5 5 5",
    task: "M6 4h12v17H6zM9 9h6M9 13h6M9 17h4",
    bell: "M5 17h14l-1.5-2.5V10a5.5 5.5 0 0 0-11 0v4.5zM10 20h4",
    help: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-2.3 6.2a2.5 2.5 0 1 1 3.7 2.2c-1 .6-1.4 1.2-1.4 2.3M12 17.5h.01",
    chevron: "m8 10 4 4 4-4",
    download: "M12 3v11m-4-4 4 4 4-4M5 18v3h14v-3",
    plus: "M12 5v14M5 12h14",
    shield: "M12 3 5 6v5c0 4.7 2.8 8.1 7 10 4.2-1.9 7-5.3 7-10V6zM9 12l2 2 4-5",
    clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3.5 2",
    report: "M6 3h9l3 3v15H6zM9 10h6M9 14h6M9 18h4",
  };

  return (
    <svg aria-hidden="true" className="formal-icon" viewBox="0 0 24 24">
      <path d={paths[name]} />
    </svg>
  );
}

function FormalGlobalHeader({
  route,
  onApplicationChange,
}: {
  route: FormalRoute;
  onApplicationChange: (application: FormalApplication) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const application =
    formalApplicationDefinitions.find(
      (item) => item.key === route.application,
    ) ?? formalApplicationDefinitions[0];

  return (
    <header className="formal-header">
      <button
        aria-label="打开应用列表"
        className="formal-launcher"
        type="button"
      >
        <FormalIcon name="apps" />
      </button>
      <div className="formal-brand">
        <span>齐</span>
        <div>
          <strong>齐齐哈尔粮食商情企业平台</strong>
          <small>统一业务与数据运营平台</small>
        </div>
      </div>
      <button className="formal-org-selector" type="button">
        <FormalIcon name="home" />
        <span>
          <small>当前组织</small>
          <strong>东北区域经营中心</strong>
        </span>
        <FormalIcon name="chevron" />
      </button>
      <div className="formal-app-selector">
        <button
          aria-expanded={menuOpen}
          className="formal-selector-button"
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span>
            <small>当前业务应用</small>
            <strong>{application.label}</strong>
          </span>
          <FormalIcon name="chevron" />
        </button>
        {menuOpen && (
          <div
            aria-label="切换业务应用"
            className="formal-app-menu"
            role="menu"
          >
            {formalApplicationDefinitions.map((item) => (
              <button
                className={item.key === route.application ? "is-active" : ""}
                key={item.key}
                role="menuitem"
                type="button"
                onClick={() => {
                  onApplicationChange(item.key);
                  setMenuOpen(false);
                }}
              >
                <span>{item.code}</span>
                <strong>{item.label}</strong>
                <small>{item.note}</small>
              </button>
            ))}
          </div>
        )}
      </div>
      <label className="formal-global-search">
        <FormalIcon name="search" />
        <input
          aria-label="搜索应用和业务对象"
          placeholder="搜索应用、区域、责任人、任务、报告和指标"
        />
      </label>
      <div className="formal-header-spacer" />
      <button
        aria-label="任务中心，9 项待处理"
        className="formal-header-tool"
        type="button"
      >
        <FormalIcon name="task" />
        <b>9</b>
      </button>
      <button
        aria-label="通知，3 条未读"
        className="formal-header-tool"
        type="button"
      >
        <FormalIcon name="bell" />
        <b>3</b>
      </button>
      <button aria-label="帮助" className="formal-header-tool" type="button">
        <FormalIcon name="help" />
      </button>
      <div className="formal-user">
        <span>王</span>
        <div>
          <strong>王洋</strong>
          <small>区域数据管理员</small>
        </div>
        <FormalIcon name="chevron" />
      </div>
    </header>
  );
}

function FormalSidebar({
  route,
  onReportingSectionChange,
}: {
  route: FormalRoute;
  onReportingSectionChange: (section: ReportingSection) => void;
}) {
  const application =
    formalApplicationDefinitions.find(
      (item) => item.key === route.application,
    ) ?? formalApplicationDefinitions[0];

  return (
    <aside className="formal-sidebar">
      <div className="formal-sidebar-app">
        <span>{application.shortLabel.slice(0, 1)}</span>
        <div>
          <small>当前业务应用</small>
          <strong>{application.label}</strong>
        </div>
      </div>
      <p className="formal-sidebar-description">{application.note}</p>
      {route.application === "reporting" ? (
        <nav aria-label="报送与报告模块" className="formal-sidebar-navigation">
          {reportingNavigation.map((group) => (
            <div className="formal-nav-group" key={group.label}>
              <span>{group.label}</span>
              {group.items.map((item) => (
                <button
                  className={
                    item.key === route.reportingSection ? "is-active" : ""
                  }
                  key={item.key}
                  type="button"
                  onClick={() => onReportingSectionChange(item.key)}
                >
                  <i aria-hidden="true" />
                  <b>{item.label}</b>
                  {item.badge && <em>{item.badge}</em>}
                </button>
              ))}
            </div>
          ))}
        </nav>
      ) : (
        <nav
          aria-label={`${application.label}模块`}
          className="formal-sidebar-navigation"
        >
          <div className="formal-nav-group">
            <span>业务工作区</span>
            {application.navigation.map((item, index) => (
              <button
                className={index === 0 ? "is-active" : ""}
                key={item.key}
                type="button"
              >
                <i aria-hidden="true" />
                <b>{item.label}</b>
              </button>
            ))}
          </div>
        </nav>
      )}
      <div className="formal-sidebar-status">
        <span />
        <div>
          <strong>核心服务全部正常</strong>
          <small>最近同步 10:46 · 会话安全</small>
        </div>
      </div>
    </aside>
  );
}

function PageHeader({
  eyebrow,
  title,
  summary,
  primaryAction,
  secondaryActions,
  onAction,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  primaryAction?: string;
  secondaryActions?: readonly string[];
  onAction?: (action: string) => void;
}) {
  return (
    <div className="formal-page-header">
      <div>
        <span className="formal-breadcrumb">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{summary}</p>
      </div>
      <div className="formal-page-actions">
        {secondaryActions?.map((action) => (
          <button key={action} type="button" onClick={() => onAction?.(action)}>
            {action.includes("导出") && <FormalIcon name="download" />}
            {action}
          </button>
        ))}
        {primaryAction && (
          <button
            className="is-primary"
            type="button"
            onClick={() => onAction?.(primaryAction)}
          >
            {primaryAction.includes("新建") && <FormalIcon name="plus" />}
            {primaryAction}
          </button>
        )}
      </div>
    </div>
  );
}

function ContextBand({
  period,
  deadline,
  objectLabel,
  reporting = false,
}: {
  period: string;
  deadline: string;
  objectLabel: string;
  reporting?: boolean;
}) {
  return (
    <section aria-label="当前业务上下文" className="formal-context-band">
      <div className="is-leading">
        <span className="formal-live-dot" />
        <small>当前责任状态</small>
        <strong>{reporting ? "一人一区 · 责任有效" : "岗位责任有效"}</strong>
      </div>
      <div>
        <small>组织与责任区域</small>
        <strong>东北区域经营中心 · 齐齐哈尔全域</strong>
      </div>
      <div>
        <small>业务对象</small>
        <strong>{objectLabel}</strong>
      </div>
      <div>
        <small>当前期间</small>
        <strong>{period}</strong>
      </div>
      <div className="is-deadline">
        <small>截止与控制</small>
        <strong>{deadline}</strong>
      </div>
    </section>
  );
}

function MetricGrid({ metrics }: { metrics: readonly FormalMetric[] }) {
  return (
    <section aria-label="核心指标" className="formal-metric-grid">
      {metrics.map((metric) => (
        <article className={`is-${metric.tone ?? "normal"}`} key={metric.label}>
          <span>{metric.label}</span>
          <strong>
            {metric.value}
            {metric.unit && <small>{metric.unit}</small>}
          </strong>
          <p>{metric.note}</p>
        </article>
      ))}
    </section>
  );
}

function BusinessScopeBand({ scope }: { scope: FormalBusinessScope }) {
  return (
    <section aria-label="业务对象与品种范围" className="formal-business-scope">
      <div className="formal-business-scope__heading">
        <small>统一业务对象</small>
        <strong>{scope.title}</strong>
        <span>{scope.note}</span>
      </div>
      <div className="formal-product-switch" aria-label="监测品种">
        {scope.products.map((product) => (
          <button
            aria-pressed={product.active ?? false}
            className={product.active ? "is-active" : undefined}
            key={product.name}
            type="button"
          >
            <strong>{product.name}</strong>
            <small>{product.detail}</small>
          </button>
        ))}
      </div>
      <div className="formal-actor-summary" aria-label="关联企业与农户">
        {scope.actors.map((actor) => (
          <div key={actor.label}>
            <small>{actor.label}</small>
            <strong>{actor.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function SupplyBalanceScopeBand({
  selectedKey,
  onSelect,
}: {
  selectedKey: SupplyBalanceScopeKey;
  onSelect: (key: SupplyBalanceScopeKey) => void;
}) {
  const selected = getSupplyBalanceScope(selectedKey);
  return (
    <section
      aria-label="供需平衡地区范围"
      className={`formal-balance-scope is-${selected.status === "已核定" ? "approved" : "pending"}`}
    >
      <div className="formal-balance-scope__heading">
        <small>当前平衡范围</small>
        <strong>{selected.label}</strong>
        <span>{selected.level}</span>
      </div>
      <div className="formal-balance-scope__switch">
        {supplyBalanceScopes.map((scope) => (
          <button
            aria-pressed={scope.key === selected.key}
            className={scope.key === selected.key ? "is-active" : undefined}
            key={scope.key}
            type="button"
            onClick={() => onSelect(scope.key)}
          >
            {scope.label}
          </button>
        ))}
      </div>
      <div className="formal-balance-scope__details">
        <div>
          <small>数据覆盖</small>
          <strong>{selected.coverage}</strong>
        </div>
        <div>
          <small>合并处理</small>
          <strong>
            {selected.level === "市级合并"
              ? `内部流转抵销 ${selected.internalFlowElimination}`
              : "县区流入流出分别列示"}
          </strong>
        </div>
        <div>
          <small>账户版本</small>
          <strong>{selected.version}</strong>
        </div>
        <span>{selected.status}</span>
      </div>
    </section>
  );
}

function LifecyclePanel({ stages }: { stages: readonly FormalStage[] }) {
  return (
    <section className="formal-panel formal-lifecycle-panel">
      <div className="formal-panel-heading">
        <div>
          <span>本期作业控制</span>
          <h2>业务生命周期</h2>
        </div>
        <small>责任、质量、审核和发布同链路留痕</small>
      </div>
      <div className="formal-lifecycle">
        {stages.map((stage, index) => (
          <div className={`is-${stage.state}`} key={stage.label}>
            <span>{stage.state === "done" ? "✓" : String(index + 1)}</span>
            <p>
              <strong>{stage.label}</strong>
              <small>{stage.detail}</small>
            </p>
          </div>
        ))}
      </div>
      <div className="formal-control-strip">
        <div>
          <small>数据来源</small>
          <strong>统一业务记录</strong>
        </div>
        <div>
          <small>计算原则</small>
          <strong>正式结果只生成一次</strong>
        </div>
        <div>
          <small>历史版本</small>
          <strong>追加发布 · 不覆盖</strong>
        </div>
      </div>
    </section>
  );
}

function RiskPanel({ risks }: { risks: readonly FormalRisk[] }) {
  return (
    <aside className="formal-panel formal-risk-panel">
      <div className="formal-panel-heading">
        <div>
          <span>风险与例外</span>
          <h2>需要立即处理</h2>
        </div>
        <button type="button">进入任务中心 →</button>
      </div>
      <div className="formal-risk-list">
        {risks.map((risk) => (
          <article className={`is-${risk.tone}`} key={risk.title}>
            <span>{risk.level}</span>
            <div>
              <strong>{risk.title}</strong>
              <p>{risk.detail}</p>
              <button type="button">查看处置依据</button>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}

function StatusText({ children }: { children: string }) {
  const danger =
    children.includes("逾期") ||
    children.includes("未提交") ||
    children.includes("阻断");
  const warning =
    children.includes("待") ||
    children.includes("退回") ||
    children.includes("解释");
  const good =
    children.includes("按时") ||
    children.includes("通过") ||
    children.includes("完成") ||
    children.includes("已发布");
  const tone = danger
    ? "danger"
    : warning
      ? "warning"
      : good
        ? "good"
        : "normal";
  return <span className={`formal-status is-${tone}`}>{children}</span>;
}

function FormalTable({
  title,
  note,
  columns,
  rows,
  actions,
}: {
  title: string;
  note: string;
  columns: readonly string[];
  rows: readonly (readonly string[])[];
  actions?: React.ReactNode;
}) {
  return (
    <section className="formal-panel formal-table-panel">
      <div className="formal-table-header">
        <div>
          <h2>{title}</h2>
          <p>{note}</p>
        </div>
        <div className="formal-table-actions">{actions}</div>
      </div>
      <div className="formal-table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${row[0]}-${String(rowIndex)}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${cell}-${String(cellIndex)}`}>
                    {cellIndex >= row.length - 2 ? (
                      <StatusText>{cell}</StatusText>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GeneralWorkspace({
  application,
  onComposeReport,
}: {
  application: Exclude<FormalApplication, "reporting">;
  onComposeReport: (context: BusinessReportContext) => void;
}) {
  const workspace = formalWorkspaceByApplication[application];
  const [supplyScopeKey, setSupplyScopeKey] =
    useState<SupplyBalanceScopeKey>("qiqihar");
  const supplyScope = getSupplyBalanceScope(supplyScopeKey);
  const isSupply = application === "supply";
  const reportable = application !== "work";
  const product =
    workspace.businessScope?.products.find((item) => item.active)?.name ??
    "玉米";
  const objectLabel = isSupply
    ? `${product} · ${supplyScope.label}`
    : workspace.objectLabel;
  const metrics = isSupply
    ? getSupplyBalanceMetrics(supplyScopeKey)
    : workspace.metrics;

  function handlePageAction(action: string) {
    if (action !== "编制业务报告" || !reportable) return;
    const dataVersion = isSupply
      ? supplyScope.version
      : application === "production"
        ? "产情监测第 31 周审核版"
        : "市场监测第 31 周审核版";
    onComposeReport({
      application,
      applicationLabel:
        formalApplicationDefinitions.find(
          (definition) => definition.key === application,
        )?.label ?? workspace.title,
      product,
      region: isSupply ? supplyScope.label : "齐齐哈尔市全域",
      regionLevel: isSupply ? supplyScope.level : "市级监测",
      period: workspace.period,
      dataCutoff: workspace.deadline,
      dataVersion,
      author: "王洋",
      reviewer: "赵晨",
    });
  }

  return (
    <>
      <PageHeader
        eyebrow={workspace.eyebrow}
        primaryAction={workspace.primaryAction}
        secondaryActions={workspace.secondaryActions}
        summary={workspace.summary}
        title={workspace.title}
        onAction={handlePageAction}
      />
      <ContextBand
        deadline={workspace.deadline}
        objectLabel={objectLabel}
        period={workspace.period}
      />
      {isSupply && (
        <SupplyBalanceScopeBand
          selectedKey={supplyScopeKey}
          onSelect={setSupplyScopeKey}
        />
      )}
      {workspace.businessScope && (
        <BusinessScopeBand scope={workspace.businessScope} />
      )}
      <MetricGrid metrics={metrics} />
      <div className="formal-focus-grid">
        <LifecyclePanel stages={workspace.stages} />
        <RiskPanel risks={workspace.risks} />
      </div>
      <FormalTable
        columns={workspace.columns}
        note={workspace.tableNote}
        rows={workspace.rows}
        title={workspace.tableTitle}
        actions={
          <>
            <button type="button">全部状态</button>
            <button type="button">列设置</button>
          </>
        }
      />
    </>
  );
}

function ReportingOverview() {
  const metrics: readonly FormalMetric[] = [
    {
      label: "本周应填",
      value: "428",
      unit: "项",
      note: "按责任和业务日历生成",
    },
    {
      label: "按时完成率",
      value: "92.4",
      unit: "%",
      note: "395 项首次合格提交",
      tone: "good",
    },
    {
      label: "截止未提交",
      value: "8",
      unit: "项",
      note: "逾期记录已经固定",
      tone: "danger",
    },
    {
      label: "待复核报告",
      value: "4",
      unit: "份",
      note: "数字与引用版本已锁定",
      tone: "warning",
    },
  ];
  const stages: readonly FormalStage[] = [
    { label: "责任锁定", detail: "一人一区", state: "done" },
    { label: "周任务生成", detail: "428 项", state: "done" },
    { label: "责任人填报", detail: "395 已提交", state: "current" },
    { label: "审核与归档", detail: "37 项待办", state: "warning" },
    { label: "报告生成", detail: "周五 18:00", state: "open" },
  ];
  const risks: readonly FormalRisk[] = [
    {
      level: "逾期",
      title: "8 个区域任务截止未提交",
      detail: "系统已按截止时间记录责任人与逾期事实",
      tone: "danger",
    },
    {
      level: "退回",
      title: "5 项填报等待原责任人修改",
      detail: "审核人和管理员均无权代为填写",
      tone: "warning",
    },
    {
      level: "报告",
      title: "第 31 周责任周报等待生成",
      detail: "将读取固定截止快照，不重新判断履责状态",
      tone: "good",
    },
  ];

  return (
    <>
      <ContextBand
        reporting
        deadline="本周五 17:00 · 截止快照自动固定"
        objectLabel="全部授权区域 · 每周填报责任"
        period="2026 年第 31 周"
      />
      <MetricGrid metrics={metrics} />
      <div className="formal-focus-grid">
        <LifecyclePanel stages={stages} />
        <RiskPanel risks={risks} />
      </div>
      <FormalTable
        columns={["区域", "责任人", "填报事项", "当前状态", "截止与快照"]}
        note="从责任进入任务、提交、审核和报告，不生成第二份填报记录。"
        rows={weeklyTasks
          .slice(0, 4)
          .map((task) => [
            task.region,
            task.responsiblePerson,
            task.businessItem,
            task.status,
            task.snapshot,
          ])}
        title="本周区域履责态势"
        actions={
          <>
            <button type="button">全部区域</button>
            <button type="button">全部状态</button>
          </>
        }
      />
    </>
  );
}

function ResponsibilityWorkspace() {
  return (
    <>
      <ContextBand
        reporting
        deadline="责任变更从下一周生效"
        objectLabel="区域 × 填报事项 × 有效期间"
        period="2026 年度有效责任"
      />
      <section className="formal-policy-banner">
        <FormalIcon name="shield" />
        <div>
          <strong>一人一区 · 每周责任唯一</strong>
          <p>
            同一区域、事项和有效期间只允许一名可写责任人；管理员可配置责任，但无权代填。
          </p>
        </div>
        <span>强制控制</span>
      </section>
      <MetricGrid
        metrics={[
          {
            label: "有效责任配置",
            value: "16",
            unit: "项",
            note: "覆盖全部授权县区",
            tone: "good",
          },
          {
            label: "唯一责任人",
            value: "16",
            unit: "人",
            note: "无重叠、无多人可写",
          },
          {
            label: "下周责任变更",
            value: "1",
            unit: "项",
            note: "不影响本周已生成任务",
            tone: "warning",
          },
          {
            label: "责任冲突",
            value: "0",
            unit: "项",
            note: "提交前强制校验",
            tone: "good",
          },
        ]}
      />
      <FormalTable
        columns={[
          "责任区域",
          "填报事项",
          "责任人 / 岗位",
          "审核人",
          "截止规则",
          "有效期",
          "状态",
        ]}
        note="责任变更不覆盖历史；已生成的本周任务仍属于原责任人。"
        rows={responsibilityAssignments.map((item) => [
          item.region,
          item.businessItem,
          `${item.responsiblePerson} · ${item.responsiblePost}`,
          item.reviewer,
          item.deadlineRule,
          item.effectivePeriod,
          item.status,
        ])}
        title="区域填报责任清单"
        actions={
          <>
            <button type="button">责任变更记录</button>
            <button type="button">导出责任清单</button>
          </>
        }
      />
    </>
  );
}

function WeeklyWorkspace() {
  const ownerTask = weeklyTasks.find(
    (task) => task.responsibleUserId === currentUserId,
  );
  const ownerCanFill = ownerTask
    ? canFillWeeklyTask(ownerTask, currentUserId)
    : false;
  return (
    <>
      <ContextBand
        reporting
        deadline="本周五 17:00"
        objectLabel="王洋 · 齐齐哈尔市本级"
        period="2026 年第 31 周"
      />
      <section className="formal-policy-banner is-dark">
        <FormalIcon name="shield" />
        <div>
          <strong>任何人无权代填</strong>
          <p>
            当前任务已锁定责任人王洋。审核人、管理员和其他区域填报人只能查看，不能编辑或提交。
          </p>
        </div>
        <span>责任人锁定</span>
      </section>
      <div className="formal-weekly-layout">
        <section className="formal-panel formal-weekly-primary">
          <div className="formal-panel-heading">
            <div>
              <span>本人本周任务</span>
              <h2>{ownerTask?.businessItem}</h2>
            </div>
            <StatusText>{ownerTask?.status ?? "待填写"}</StatusText>
          </div>
          <div className="formal-weekly-details">
            <div>
              <small>责任区域</small>
              <strong>{ownerTask?.region}</strong>
            </div>
            <div>
              <small>责任人</small>
              <strong>{ownerTask?.responsiblePerson}（本人）</strong>
            </div>
            <div>
              <small>审核人</small>
              <strong>{ownerTask?.reviewer}</strong>
            </div>
            <div>
              <small>截止时间</small>
              <strong>{ownerTask?.deadline}</strong>
            </div>
          </div>
          <div className="formal-form-preview">
            <label>
              <span>本周玉米主流收购价格</span>
              <input defaultValue="2,346 元/吨" readOnly />
            </label>
            <label>
              <span>重点企业库存变化</span>
              <input defaultValue="环比下降 2.4%" readOnly />
            </label>
            <label className="is-wide">
              <span>本周情况说明</span>
              <textarea
                defaultValue="北部县区玉米价差扩大，重点企业库存总体回落。"
                readOnly
              />
            </label>
          </div>
          <div className="formal-form-actions">
            <small>保存、提交和修改动作均记录本人账号与时间。</small>
            <button type="button">保存草稿</button>
            <button
              className="is-primary"
              disabled={!ownerCanFill}
              type="button"
            >
              填写本人本周报送
            </button>
          </div>
        </section>
        <aside className="formal-panel formal-permission-panel">
          <div className="formal-panel-heading">
            <div>
              <span>责任与权限</span>
              <h2>填写权限校验</h2>
            </div>
          </div>
          <div className="formal-permission-list">
            <div>
              <FormalIcon name="shield" />
              <p>
                <strong>责任人本人</strong>
                <small>可以保存、提交和修改退回内容</small>
              </p>
              <span className="is-allowed">允许</span>
            </div>
            <div>
              <FormalIcon name="task" />
              <p>
                <strong>区域审核人</strong>
                <small>只能审核、退回和填写审核意见</small>
              </p>
              <span>禁止填写</span>
            </div>
            <div>
              <FormalIcon name="home" />
              <p>
                <strong>系统管理员</strong>
                <small>可以管理责任配置，不能代替提交</small>
              </p>
              <span>禁止填写</span>
            </div>
          </div>
          <button
            aria-label="填写甘南县本周任务"
            className="formal-blocked-button"
            disabled
            type="button"
          >
            填写甘南县任务
          </button>
        </aside>
      </div>
    </>
  );
}

function RecordsWorkspace({ overdueOnly = false }: { overdueOnly?: boolean }) {
  const records = overdueOnly
    ? weeklyTasks.filter((task) =>
        ["截止未提交", "逾期补填"].includes(task.status),
      )
    : weeklyTasks;
  return (
    <>
      <ContextBand
        reporting
        deadline="每周截止快照不可变"
        objectLabel={overdueOnly ? "全部逾期责任记录" : "全部填报和审核记录"}
        period="2026 年第 31 周"
      />
      <section className="formal-policy-banner">
        <FormalIcon name="clock" />
        <div>
          <strong>
            {overdueOnly ? "逾期事实永久保留" : "全过程按时间追加记录"}
          </strong>
          <p>
            {overdueOnly
              ? "截止后补填只改变当前完成状态，不删除原截止未提交记录。"
              : "提交、退回、修改和审核均生成新记录，不覆盖历史内容。"}
          </p>
        </div>
        <span>{overdueOnly ? "监督依据" : "审计可追溯"}</span>
      </section>
      <FormalTable
        columns={[
          "责任区域",
          "填报事项",
          "责任人",
          "截止时间",
          "首次提交",
          "当前状态",
          "截止快照",
        ]}
        note="管理人员可以查看和导出，但不能修改责任人的填报内容。"
        rows={records.map((task) => [
          task.region,
          task.businessItem,
          task.responsiblePerson,
          task.deadline,
          task.submittedAt,
          task.status,
          task.snapshot,
        ])}
        title={overdueOnly ? "逾期责任记录" : "本周填报记录"}
        actions={
          <button type="button">
            <FormalIcon name="download" />
            {overdueOnly ? "导出逾期清单" : "导出填报记录"}
          </button>
        }
      />
    </>
  );
}

function DutyWeeklyWorkspace() {
  return (
    <>
      <ContextBand
        reporting
        deadline="报告截止 7 月 31 日 17:00"
        objectLabel="全部填报责任人"
        period="2026 年第 31 周"
      />
      <MetricGrid
        metrics={[
          {
            label: "本周应填",
            value: "428",
            unit: "项",
            note: "责任任务总数",
          },
          {
            label: "按时完成",
            value: "395",
            unit: "项",
            note: "按时率 92.4%",
            tone: "good",
          },
          {
            label: "逾期补填",
            value: "5",
            unit: "项",
            note: "仍计入逾期",
            tone: "warning",
          },
          {
            label: "截止未提交",
            value: "8",
            unit: "项",
            note: "需要责任追踪",
            tone: "danger",
          },
        ]}
      />
      <FormalTable
        columns={[
          "责任人",
          "责任区域",
          "填报事项",
          "截止时间",
          "首次合格提交",
          "履责状态",
          "逾期时长",
          "审核状态",
        ]}
        note="责任周报读取本周固定截止快照，用于监督每名责任人是否按规定完成工作。"
        rows={dutyWeeklyRows.map((row) => [
          row.person,
          row.region,
          row.item,
          row.deadline,
          row.firstQualifiedSubmission,
          row.status,
          row.overdueDuration,
          row.review,
        ])}
        title="全部填报人履责明细"
        actions={
          <>
            <button type="button">查看报告版本</button>
            <button className="is-primary" type="button">
              <FormalIcon name="download" />
              导出责任周报
            </button>
          </>
        }
      />
    </>
  );
}

function DutyMonthlyWorkspace() {
  return (
    <>
      <ContextBand
        reporting
        deadline="由第 27–31 周截止快照汇总"
        objectLabel="全部责任人 · 区域履责监督"
        period="2026 年 7 月"
      />
      <section className="formal-policy-banner is-warning">
        <FormalIcon name="clock" />
        <div>
          <strong>逾期后补填不消除逾期记录</strong>
          <p>
            月报只聚合每周已经固定的截止状态，不能根据当前完成状态重新判断历史是否按时。
          </p>
        </div>
        <span>固定口径</span>
      </section>
      <MetricGrid
        metrics={[
          {
            label: "本月应填",
            value: "1,712",
            unit: "项",
            note: "4 个周报告期",
          },
          {
            label: "按时完成率",
            value: "94.1",
            unit: "%",
            note: "较上月提高 1.3%",
            tone: "good",
          },
          {
            label: "发生逾期人员",
            value: "7",
            unit: "人",
            note: "2 人连续两周异常",
            tone: "danger",
          },
          {
            label: "责任变更",
            value: "2",
            unit: "项",
            note: "均从下一周生效",
            tone: "warning",
          },
        ]}
      />
      <FormalTable
        columns={[
          "责任人",
          "责任区域",
          "应填",
          "按时",
          "逾期",
          "未填",
          "退回",
          "按时率",
          "履责趋势",
        ]}
        note="按个人和区域监督履责质量，历史周快照不可修改。"
        rows={dutyMonthlyRows.map((row) => [
          row.person,
          row.region,
          row.expected,
          row.onTime,
          row.overdue,
          row.missing,
          row.returned,
          row.onTimeRate,
          row.trend,
        ])}
        title="本月填报人履责汇总"
        actions={
          <>
            <button type="button">查看周明细</button>
            <button className="is-primary" type="button">
              <FormalIcon name="download" />
              导出责任月报
            </button>
          </>
        }
      />
    </>
  );
}

function BusinessReportsWorkspace({
  versions = false,
}: {
  versions?: boolean;
}) {
  return (
    <>
      <ContextBand
        reporting
        deadline={versions ? "正式版本不可覆盖" : "报告运行时锁定截止时点"}
        objectLabel={
          versions ? "日报、周报和月报正式版本" : "业务报告定义与生成运行"
        }
        period="2026 年 7 月"
      />
      <section className="formal-policy-banner">
        <FormalIcon name="report" />
        <div>
          <strong>
            {versions ? "修订生成替代版本" : "报告不重新计算业务指标"}
          </strong>
          <p>
            {versions
              ? "原报告、替代原因、引用版本和文件记录全部保留。"
              : "日报、周报和月报只读取已经发布的事实、指标和供需结果版本。"}
          </p>
        </div>
        <span>{versions ? "不可变版本" : "统一结果引用"}</span>
      </section>
      <MetricGrid
        metrics={[
          {
            label: versions ? "正式报告版本" : "本期待生成",
            value: versions ? "26" : "12",
            unit: "份",
            note: versions ? "均保留文件与引用" : "日报、周报和月报",
          },
          {
            label: "等待复核",
            value: "4",
            unit: "份",
            note: "数字和版本已经锁定",
            tone: "warning",
          },
          {
            label: "已发布",
            value: "18",
            unit: "份",
            note: "不可变文件可追溯",
            tone: "good",
          },
          {
            label: "待替代确认",
            value: "1",
            unit: "份",
            note: "保留原报告和原因",
            tone: "danger",
          },
        ]}
      />
      <FormalTable
        columns={[
          "报告名称",
          "频率",
          "报告范围",
          "报告期间",
          "引用正式版本",
          "报告状态",
          "责任岗位",
          "发布计划",
        ]}
        note={
          versions
            ? "报告版本固定数据截止、引用版本集合、模板和正式文件。"
            : "报告内容可以多频率生成，但数字只能来自同一正式结果。"
        }
        rows={businessReportRows.map((row) => [
          row.name,
          row.frequency,
          row.scope,
          row.period,
          row.dataVersion,
          row.status,
          row.owner,
          row.publishedAt,
        ])}
        title={versions ? "正式报告版本清单" : "业务报告运行"}
        actions={
          <>
            <button type="button">全部频率</button>
            <button className="is-primary" type="button">
              {versions ? "导出版本清单" : "新建报告运行"}
            </button>
          </>
        }
      />
    </>
  );
}

function ReportingWorkspace({ section }: { section: ReportingSection }) {
  if (section === "responsibility") return <ResponsibilityWorkspace />;
  if (section === "weekly") return <WeeklyWorkspace />;
  if (section === "records") return <RecordsWorkspace />;
  if (section === "overdue") return <RecordsWorkspace overdueOnly />;
  if (section === "duty-weekly") return <DutyWeeklyWorkspace />;
  if (section === "duty-monthly") return <DutyMonthlyWorkspace />;
  if (section === "business-reports") return <BusinessReportsWorkspace />;
  if (section === "versions") return <BusinessReportsWorkspace versions />;
  return <ReportingOverview />;
}

export function FormalEnterprisePrototype({
  initialSearch,
}: FormalEnterprisePrototypeProps) {
  const [route, setRoute] = useState<FormalRoute>(() =>
    readFormalRoute(initialSearch ?? window.location.search),
  );
  const [reportContext, setReportContext] =
    useState<BusinessReportContext | null>(null);
  const reportMeta = reportPageMeta[route.reportingSection];

  function changeRoute(nextRoute: FormalRoute) {
    setReportContext(null);
    setRoute(nextRoute);
    if (initialSearch === undefined) {
      const url = new URL(window.location.href);
      const routeParameters = new URLSearchParams(writeFormalRoute(nextRoute));
      url.searchParams.set("variant", "A");
      url.searchParams.set("page", routeParameters.get("page") ?? "work");
      const section = routeParameters.get("section");
      if (section) url.searchParams.set("section", section);
      else url.searchParams.delete("section");
      window.history.replaceState({}, "", url);
    }
  }

  const pageHeader = useMemo(() => {
    if (route.application === "reporting") {
      return (
        <PageHeader
          eyebrow={reportMeta.eyebrow}
          primaryAction={reportMeta.primaryAction}
          secondaryActions={
            reportMeta.secondaryAction
              ? [reportMeta.secondaryAction]
              : undefined
          }
          summary={reportMeta.summary}
          title={reportMeta.title}
        />
      );
    }
    return null;
  }, [reportMeta, route.application]);

  return (
    <div className="formal-enterprise">
      <FormalGlobalHeader
        route={route}
        onApplicationChange={(application) =>
          changeRoute({ application, reportingSection: "overview" })
        }
      />
      <div className="formal-shell">
        <FormalSidebar
          route={route}
          onReportingSectionChange={(reportingSection) =>
            changeRoute({ application: "reporting", reportingSection })
          }
        />
        <main className="formal-main">
          {route.application === "reporting" ? (
            <>
              {pageHeader}
              <ReportingWorkspace section={route.reportingSection} />
            </>
          ) : (
            <GeneralWorkspace
              application={route.application}
              onComposeReport={setReportContext}
            />
          )}
        </main>
      </div>
      {reportContext && (
        <BusinessReportComposer
          context={reportContext}
          onClose={() => setReportContext(null)}
        />
      )}
    </div>
  );
}
