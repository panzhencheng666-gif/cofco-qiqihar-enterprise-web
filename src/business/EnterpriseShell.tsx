import { useState, type ReactNode } from "react";

import { BusinessNavigationTree } from "./components/BusinessNavigationTree";
import type { BusinessWorkItem } from "./core/businessWork";
import type { MonitoringObject } from "./core/monitoringRegistry";
import type { OperationalScope } from "./core/operationalScope";
import { businessWorkFixtures } from "./data/businessWorkFixtures";
import type { ApprovedBusinessReportDataset } from "./data/businessReportDatasets";
import type { BusinessNotificationRow } from "@/platform/api/realtimeBusinessRepository";
import {
  marketMonitoringObjects,
  productionMonitoringObjects,
} from "./data/monitoringRegistryFixtures";
import {
  formalApplicationDefinitions,
  type FormalShellIdentity,
} from "./formalEnterpriseData";
import { EnterpriseIcon } from "./EnterpriseIcon";
import {
  createFormalRoute,
  marketSectionProductCode,
  type FormalLocation,
  type FormalRoute,
  type FormalSelection,
} from "./formalEnterpriseModel";

const primaryBusinessApplications = [
  {
    key: "production",
    label: "产情监测",
    route: createFormalRoute("production", "corn-collection"),
  },
  {
    key: "market",
    label: "市场监测",
    route: createFormalRoute("market", "corn-collection"),
  },
  {
    key: "logistics",
    label: "物流监测",
    route: createFormalRoute("market", "corn-logistics"),
  },
  {
    key: "supply",
    label: "供需分析",
    route: createFormalRoute("supply", "balance"),
  },
  {
    key: "reporting",
    label: "报表中心",
    route: createFormalRoute("reporting", "compose"),
  },
] as const;

type SearchResult = {
  id: string;
  label: string;
  detail: string;
  kind: "业务页面" | "监测对象" | "业务任务" | "风险异常" | "报告数据";
  route: FormalRoute;
  selection?: FormalSelection;
};

function productWorkRoute(item: BusinessWorkItem): FormalRoute {
  if (item.domain === "reporting") {
    return createFormalRoute("reporting", "compose");
  }
  if (item.domain === "supply") {
    return createFormalRoute(
      "supply",
      item.productId === "soybean"
        ? "soybean-balance"
        : item.productId === "paddy"
          ? "paddy-balance"
          : "corn-balance",
    );
  }
  if (item.domain === "market") {
    if (item.businessSubtypeId === "market.logistics") {
      return createFormalRoute(
        "market",
        item.productId === "soybean"
          ? "soybean-logistics"
          : item.productId === "paddy"
            ? "paddy-logistics"
            : "corn-logistics",
      );
    }
    return createFormalRoute(
      "market",
      item.productId === "soybean"
        ? "soybean-collection"
        : item.productId === "paddy"
          ? "paddy-collection"
          : "corn-collection",
    );
  }
  return createFormalRoute(
    "production",
    item.productId === "soybean"
      ? "soybean-collection"
      : item.productId === "paddy"
        ? "rice-collection"
        : "corn-collection",
  );
}

function notificationProductName(productCode: string | null): string {
  return (
    (
      {
        CORN: "玉米",
        SOYBEAN: "大豆",
        RICE: "稻谷",
      } as Readonly<Record<string, string>>
    )[productCode ?? ""] ?? "粮食"
  );
}

function notificationActionLabel(actionCode: string): string {
  if (actionCode.endsWith("_CREATED")) return "已新建";
  if (actionCode.endsWith("_UPDATED")) return "已更新";
  if (actionCode.endsWith("_SUBMITTED")) return "已提交审核";
  if (actionCode.endsWith("_APPROVED")) return "已审核通过";
  if (actionCode.endsWith("_RETURNED")) return "已退回补充";
  if (actionCode.endsWith("_VOIDED")) return "已作废";
  return "发生变更";
}

function notificationDomainLabel(aggregateType: string): string {
  if (aggregateType.includes("LOGISTICS")) return "物流记录";
  if (aggregateType.includes("MARKET")) return "市场记录";
  if (aggregateType.includes("SUPPLY")) return "供需结果";
  return "产情记录";
}

function notificationRoute(notification: BusinessNotificationRow): FormalRoute {
  const product =
    notification.productCode === "SOYBEAN"
      ? "soybean"
      : notification.productCode === "RICE"
        ? "paddy"
        : "corn";
  if (notification.aggregateType.includes("LOGISTICS")) {
    return createFormalRoute("market", `${product}-logistics`);
  }
  if (notification.aggregateType.includes("MARKET")) {
    return createFormalRoute("market", `${product}-collection`);
  }
  if (notification.aggregateType.includes("SUPPLY")) {
    return createFormalRoute("supply", `${product}-balance`);
  }
  return createFormalRoute(
    "production",
    product === "paddy" ? "rice-collection" : `${product}-collection`,
  );
}

function notificationTitle(notification: BusinessNotificationRow): string {
  return `${notificationProductName(notification.productCode)}${notificationDomainLabel(notification.aggregateType)}${notificationActionLabel(notification.actionCode)}`;
}

function businessPeriod(periodKey: string): string {
  const matched = /^([0-9]{4})-W([0-9]{1,2})$/u.exec(periodKey);
  return matched ? `${matched[1]}年第${Number(matched[2])}周` : periodKey;
}

type PageHelpContent = {
  purpose: string;
  steps: readonly string[];
  rules: string;
  exception: string;
};

function pageHelpContent(route: FormalRoute): PageHelpContent {
  if (route.application === "work") {
    return {
      purpose: "处理当前账号和岗位责任范围内的待办、审核、退回与异常事项。",
      steps: [
        "按状态、地区、品种或期限定位事项。",
        "点击处理进入原业务单据，核对来源数据和当前流程节点。",
        "完成保存、提交或审核后返回列表确认状态与时间记录。",
      ],
      rules:
        "只能处理分配给本人或本人岗位的事项；查看权限不等于填报或审核权限。",
      exception:
        "若事项无法打开或内容不符，请保留事项名称和发生时间并联系本单位管理员核查责任分配。",
    };
  }
  if (route.application === "supply") {
    return {
      purpose: "按地区、年度和品种填报并查看地区供需平衡。",
      steps: [
        "选择县区、数据年度和品种。",
        "核对由地区年度产情自动带入的播种面积、单产和总产。",
        "填写其余地区供需项目，保存后重新查询并核对派生总量。",
      ],
      rules:
        "播种面积、单产和总产来自地区年度产情且不可在本页修改；其余项目按地区人工填报，汇总与比率由系统计算并保留历史。",
      exception:
        "自动项缺失时先补齐地区产情；人工项缺失时本页明确显示待填报，系统不得以样本点数据替代。",
    };
  }
  if (route.application === "reporting") {
    return {
      purpose: "按授权范围生成产情、市场、物流或供需业务报告。",
      steps: [
        "选择报告类型、地区层级和时间范围。",
        "生成预览并核对数据范围、来源和统计口径。",
        "确认无误后导出允许的报告格式。",
      ],
      rules:
        "报告范围不得超过当前账号授权地区和业务范围，系统不会默认导出无边界的大范围数据。",
      exception:
        "预览为空时先检查筛选条件及上游记录是否已审核，不得使用未核定数据替代。",
    };
  }
  if (route.section === "analysis") {
    return {
      purpose: "比较当前年度与前三年同地区、同品种、同口径的已核定指标。",
      steps: [
        "选择统计地区、统计时间和可用分析指标。",
        "通过柱状图、折线图和占比图查看趋势与结构变化。",
        "悬停数据点核对年度值、同比和数据状态。",
      ],
      rules: "分析指标来自当前业务表和业务字段定义，不使用固定的预置指标。",
      exception:
        "不可比较表示对应年度缺少同口径核定数据，应先核查筛选条件和历史业务记录。",
    };
  }
  if (route.section.endsWith("-logistics")) {
    return {
      purpose: "查询并维护当前菜单品种的物流节点、路线和运价监测记录。",
      steps: [
        "通过地区、时间和物流条件筛选现有记录。",
        "需要填报时点击新建，在弹窗中完成必填信息和现场材料。",
        "保存并提交后返回列表确认状态，批量数据使用对应 XLSX 模板。",
      ],
      rules:
        "只有获分配的地区责任人可填报；其他授权员工可按权限查看，自动计算字段不可手工修改。",
      exception: "导入失败时下载错误回执，修正对应行后使用同一幂等键重试。",
    };
  }
  return {
    purpose:
      route.application === "production"
        ? "查询并维护当前菜单品种的产情调查记录。"
        : "查询并维护当前菜单品种的市场采集记录。",
    steps: [
      "通过地区、调查时间和状态筛选现有业务记录。",
      "需要填报时点击新建，在弹窗中完成必填字段和现场材料。",
      "保存并提交后返回列表确认状态；批量数据使用当前业务 XLSX 模板。",
    ],
    rules:
      "只有获分配的地区责任人可填报；填报人由登录账号锁定，自动计算字段只读。",
    exception:
      "记录被退回时按退回原因修正原单据，不应另建重复记录；导入错误应依据回执逐行修正。",
  };
}

function isPrimaryApplicationActive(
  key: (typeof primaryBusinessApplications)[number]["key"],
  route: FormalRoute,
): boolean {
  if (key === "logistics")
    return (
      route.application === "market" && route.section.endsWith("-logistics")
    );
  if (key === "market")
    return (
      route.application === "market" &&
      marketSectionProductCode(route.section) !== null &&
      !route.section.endsWith("-logistics")
    );
  return route.application === key;
}

export function EnterpriseShell({
  location,
  onNavigate,
  shellIdentity,
  workItems = businessWorkFixtures,
  productionObjects = productionMonitoringObjects,
  marketObjects = marketMonitoringObjects,
  reportDatasets = [],
  businessNotifications,
  businessNotificationUnreadCount,
  onBusinessNotificationRead,
  onIdentityOpen,
  scope,
  queryAllowed = true,
  children,
}: {
  location: FormalLocation;
  onNavigate: (route: FormalRoute, selection?: FormalSelection) => void;
  shellIdentity: FormalShellIdentity;
  workItems?: readonly BusinessWorkItem[];
  productionObjects?: readonly MonitoringObject[];
  marketObjects?: readonly MonitoringObject[];
  reportDatasets?: readonly ApprovedBusinessReportDataset[];
  businessNotifications?: readonly BusinessNotificationRow[];
  businessNotificationUnreadCount?: number;
  onBusinessNotificationRead?: (id: string) => void | Promise<void>;
  onIdentityOpen?: (view: "profile" | "organization") => void;
  scope?: OperationalScope;
  queryAllowed?: boolean;
  children: ReactNode;
}) {
  const [utilityPanel, setUtilityPanel] = useState<
    "notifications" | "help" | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");
  const currentApplication =
    formalApplicationDefinitions.find(
      ({ key }) => key === location.route.application,
    ) ?? formalApplicationDefinitions.find(({ key }) => key === "market")!;
  const currentPageLabel =
    currentApplication.navigation.find(
      ({ route }) => route.section === location.route.section,
    )?.label ??
    (location.route.application === "supply" &&
    ["corn-balance", "soybean-balance", "paddy-balance"].includes(
      location.route.section,
    )
      ? "供需平衡"
      : "当前业务");
  const currentHelp = pageHelpContent(location.route);
  const searchablePages: SearchResult[] = formalApplicationDefinitions
    .filter(
      ({ key }) =>
        key === "production" ||
        key === "market" ||
        key === "supply" ||
        key === "reporting",
    )
    .flatMap((application) =>
      application.navigation.map((item) => ({
        id: `page:${item.route.application}:${item.route.section}`,
        label: `${application.label} · ${item.label}`,
        detail: "进入业务页面",
        kind: "业务页面" as const,
        route: item.route,
      })),
    );
  const allowedRegionIds = scope?.authorization.authorizedRegionIds;
  const regionAllowed = (regionId: string) =>
    !allowedRegionIds ||
    allowedRegionIds.includes("authorized-all") ||
    allowedRegionIds.some(
      (authorizedRegionId) => authorizedRegionId === regionId,
    );
  const searchableObjects: SearchResult[] = queryAllowed
    ? [...productionObjects, ...marketObjects]
        .filter(({ regionId }) => regionAllowed(regionId))
        .map((object) => ({
          id: `object:${object.objectId}`,
          label: object.objectName,
          detail: `${object.regionLabel} · ${object.productLabels.join("、")}`,
          kind: "监测对象" as const,
          route: object.objectId.includes("PRODUCTION")
            ? createFormalRoute("production", "objects")
            : createFormalRoute("market", "objects"),
          selection: { type: "object" as const, id: object.objectId },
        }))
    : [];
  const searchableTasks: SearchResult[] = queryAllowed
    ? workItems
        .filter(({ regionId }) => regionAllowed(regionId))
        .flatMap((item) => {
          const base: SearchResult = {
            id: `task:${item.workId}`,
            label: item.title,
            detail: `${businessPeriod(item.periodKey)} · ${item.regionLabel}`,
            kind: "业务任务",
            route: productWorkRoute(item),
            selection: { type: "work-item", id: item.workId },
          };
          const risk =
            item.qualityStatus === "blocking" ||
            item.reviewStatus === "returned"
              ? ({
                  ...base,
                  id: `risk:${item.workId}`,
                  label: `质量阻断 · ${item.title}`,
                  detail: `${item.regionLabel} · 需要补充或复核`,
                  kind: "风险异常" as const,
                } satisfies SearchResult)
              : null;
          return risk ? [base, risk] : [base];
        })
    : [];
  const searchableReports: SearchResult[] = queryAllowed
    ? reportDatasets
        .filter(({ region }) =>
          region.includes("齐齐哈尔") ? regionAllowed("qiqihar-all") : true,
        )
        .map((report) => ({
          id: `report:${report.application}:${report.product}:${report.dataBatchId}`,
          label: `${report.region}${report.product}${report.reportTemplate}`,
          detail: `${report.period} · ${report.frequency}`,
          kind: "报告数据" as const,
          route: createFormalRoute("reporting", "compose"),
          selection: {
            type: "report" as const,
            id: `${report.dataBatchId}::${report.application}::${report.product}`,
          },
        }))
    : [];
  const normalizedQuery = searchQuery.trim();
  const searchResults = normalizedQuery
    ? [
        ...searchablePages,
        ...searchableObjects,
        ...searchableTasks,
        ...searchableReports,
      ]
        .filter(({ label, detail, kind }) =>
          `${label}${detail}${kind}`.includes(normalizedQuery),
        )
        .slice(0, 12)
    : [];
  const workItemNotificationCount = workItems.filter(
    (item) =>
      item.qualityStatus === "blocking" || item.reviewStatus === "returned",
  ).length;
  const workItemNotificationItems = workItems.filter(
    (item) =>
      item.qualityStatus === "blocking" || item.reviewStatus === "returned",
  );
  const notificationCount =
    businessNotifications === undefined
      ? workItemNotificationCount
      : (businessNotificationUnreadCount ??
        businessNotifications.filter(({ read }) => !read).length);

  if (
    location.route.application === "overview" &&
    location.route.section === "map"
  ) {
    return <div className="overview-monitoring-fullscreen">{children}</div>;
  }

  const closePanels = () => {
    setUtilityPanel(null);
    setSearchQuery("");
  };
  const openSearchResult = (result: SearchResult) => {
    if (result.selection) onNavigate(result.route, result.selection);
    else onNavigate(result.route);
    closePanels();
  };

  return (
    <div
      className="formal-enterprise reference-enterprise-shell"
      onKeyDown={(event) => {
        if (event.key === "Escape") closePanels();
      }}
    >
      <header className="formal-header formal-global-header">
        <div className="formal-header-primary">
          <button
            aria-label="返回市场采集首页"
            className="formal-brand"
            type="button"
            onClick={() =>
              onNavigate(createFormalRoute("market", "corn-collection"))
            }
          >
            <span>齐</span>
            <strong>{shellIdentity.platformName}</strong>
          </button>

          <nav aria-label="业务应用" className="formal-application-nav">
            {primaryBusinessApplications.map((item) => (
              <button
                aria-current={
                  isPrimaryApplicationActive(item.key, location.route)
                    ? "page"
                    : undefined
                }
                className={
                  isPrimaryApplicationActive(item.key, location.route)
                    ? "is-active"
                    : ""
                }
                key={item.key}
                type="button"
                onClick={() => {
                  onNavigate(item.route);
                  closePanels();
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <button
            aria-label={`当前工作单位：${shellIdentity.workUnit.currentUnitLabel}`}
            className="formal-work-unit"
            disabled={!onIdentityOpen}
            type="button"
            onClick={() => onIdentityOpen?.("organization")}
          >
            <EnterpriseIcon name="home" />
            <span>{shellIdentity.workUnit.currentUnitLabel}</span>
          </button>

          <form
            className="formal-global-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              const first = searchResults[0];
              if (!first) return;
              openSearchResult(first);
            }}
          >
            <EnterpriseIcon name="search" />
            <input
              aria-label="全局搜索"
              placeholder="搜索地区、企业、任务和报告"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            {searchQuery && (
              <div className="formal-search-results" role="listbox">
                {searchResults.length > 0 ? (
                  searchResults.map((result) => (
                    <button
                      key={result.id}
                      role="option"
                      type="button"
                      onClick={() => {
                        openSearchResult(result);
                      }}
                    >
                      <strong>{result.label}</strong>
                      <span>{result.detail}</span>
                      <small>{result.kind}</small>
                    </button>
                  ))
                ) : (
                  <p>未找到匹配的业务页面</p>
                )}
              </div>
            )}
          </form>

          <button
            className="formal-header-tool"
            type="button"
            onClick={() =>
              setUtilityPanel(
                utilityPanel === "notifications" ? null : "notifications",
              )
            }
          >
            <span>通知</span>
            <b>{notificationCount}</b>
          </button>
          <button
            className="formal-header-tool"
            type="button"
            onClick={() =>
              setUtilityPanel(utilityPanel === "help" ? null : "help")
            }
          >
            <span>帮助</span>
          </button>
          <button
            aria-label={`当前用户：${shellIdentity.account.displayName}`}
            className="formal-user"
            disabled={!onIdentityOpen}
            type="button"
            onClick={() => onIdentityOpen?.("profile")}
          >
            <span>{shellIdentity.account.displayName.slice(0, 1)}</span>
            <strong>{shellIdentity.account.displayName}</strong>
          </button>

          {utilityPanel && (
            <section
              aria-label={
                utilityPanel === "notifications" ? "业务通知" : "当前页面帮助"
              }
              className="formal-header-information-panel"
              role="dialog"
            >
              <header>
                <strong>
                  {utilityPanel === "notifications"
                    ? "业务通知"
                    : "当前页面帮助"}
                </strong>
                <button type="button" onClick={() => setUtilityPanel(null)}>
                  ×
                </button>
              </header>
              {utilityPanel === "notifications" ? (
                businessNotifications !== undefined ? (
                  businessNotifications.length > 0 ? (
                    <div className="formal-notification-list">
                      {businessNotifications.map((notification) => (
                        <button
                          className={
                            notification.read ? "is-read" : "is-unread"
                          }
                          key={notification.id}
                          onClick={() => {
                            void onBusinessNotificationRead?.(notification.id);
                            onNavigate(notificationRoute(notification), {
                              type: "document",
                              id: notification.aggregateId,
                            });
                            closePanels();
                          }}
                          type="button"
                        >
                          <strong>{notificationTitle(notification)}</strong>
                          <span>
                            {new Date(notification.occurredAt).toLocaleString(
                              "zh-CN",
                            )}
                            {notification.read ? " · 已读" : " · 未读"}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p>暂无业务通知</p>
                  )
                ) : workItemNotificationItems.length > 0 ? (
                  <div className="formal-notification-list">
                    {workItemNotificationItems.map((item) => (
                      <button
                        key={item.workId}
                        onClick={() =>
                          openSearchResult({
                            id: `notification:${item.workId}`,
                            label: item.title,
                            detail: `${item.regionLabel} · 需要补充或复核`,
                            kind: "风险异常",
                            route: productWorkRoute(item),
                            selection: { type: "work-item", id: item.workId },
                          })
                        }
                        type="button"
                      >
                        <strong>{item.title}</strong>
                        <span>{item.regionLabel} · 进入事项处理</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p>暂无未读业务通知</p>
                )
              ) : (
                <div className="formal-page-help">
                  <strong>
                    {currentApplication.label} · {currentPageLabel}
                  </strong>
                  <p>{currentHelp.purpose}</p>
                  <h3>操作步骤</h3>
                  <ol>
                    {currentHelp.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <h3>权限与数据规则</h3>
                  <p>{currentHelp.rules}</p>
                  <h3>异常处理</h3>
                  <p>{currentHelp.exception}</p>
                </div>
              )}
            </section>
          )}
        </div>
      </header>

      <div className="formal-enterprise-shell">
        <aside className="formal-sidebar">
          <BusinessNavigationTree
            application={currentApplication}
            currentRoute={location.route}
            onNavigate={(route) => {
              onNavigate(route);
              closePanels();
            }}
          />
        </aside>
        <main className="formal-main">{children}</main>
      </div>
    </div>
  );
}
