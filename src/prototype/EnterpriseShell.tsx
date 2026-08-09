import { useState, type ReactNode } from "react";

import { BusinessNavigationTree } from "./components/BusinessNavigationTree";
import type { BusinessWorkItem } from "./core/businessWork";
import type { MonitoringObject } from "./core/monitoringRegistry";
import type { OperationalScope } from "./core/operationalScope";
import { businessWorkFixtures } from "./data/businessWorkFixtures";
import type { ApprovedBusinessReportDataset } from "./data/businessReportDatasets";
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
    route: createFormalRoute("market", "logistics"),
  },
  {
    key: "supply",
    label: "供需分析",
    route: createFormalRoute("supply", "corn-balance"),
  },
  {
    key: "reporting",
    label: "报表中心",
    route: createFormalRoute("reporting", "compose"),
  },
  {
    key: "work",
    label: "我的工作",
    route: createFormalRoute("work", "tasks"),
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
    return createFormalRoute("reporting", "review-distribution");
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
      return createFormalRoute("market", "logistics");
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
  return createFormalRoute("production", "tasks");
}

function businessPeriod(periodKey: string): string {
  const matched = /^([0-9]{4})-W([0-9]{1,2})$/u.exec(periodKey);
  return matched ? `${matched[1]}年第${Number(matched[2])}周` : periodKey;
}

function isPrimaryApplicationActive(
  key: (typeof primaryBusinessApplications)[number]["key"],
  route: FormalRoute,
): boolean {
  if (key === "logistics")
    return route.application === "market" && route.section === "logistics";
  if (key === "market")
    return route.application === "market" && route.section !== "logistics";
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
  const pendingCount = workItems.filter(
    (item) =>
      item.obligationStatus === "in-progress" ||
      item.obligationStatus === "missed" ||
      item.reviewStatus === "pending",
  ).length;
  const notificationCount = workItems.filter(
    (item) =>
      item.qualityStatus === "blocking" || item.reviewStatus === "returned",
  ).length;
  const notificationItems = workItems.filter(
    (item) =>
      item.qualityStatus === "blocking" || item.reviewStatus === "returned",
  );

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

          <div
            aria-label={`当前工作单位：${shellIdentity.workUnit.currentUnitLabel}`}
            className="formal-work-unit"
          >
            <EnterpriseIcon name="home" />
            <span>{shellIdentity.workUnit.currentUnitLabel}</span>
          </div>

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
            onClick={() => onNavigate(createFormalRoute("work", "tasks"))}
          >
            <span>待办</span>
            <b>{pendingCount}</b>
          </button>
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
          <div
            aria-label={`当前用户：${shellIdentity.account.displayName}`}
            className="formal-user"
          >
            <span>{shellIdentity.account.displayName.slice(0, 1)}</span>
            <strong>{shellIdentity.account.displayName}</strong>
          </div>

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
                notificationItems.length > 0 ? (
                  <div className="formal-notification-list">
                    {notificationItems.map((item) => (
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
                <p>
                  {currentApplication.label} ·{" "}
                  {currentApplication.navigation.find(
                    ({ route }) => route.section === location.route.section,
                  )?.label ?? "当前业务"}
                  。先选择地区、品种和时间查询记录；需要填报时点击新建，分析和供需页面仅查看已核定结果。
                </p>
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
