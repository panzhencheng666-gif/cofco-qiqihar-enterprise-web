import { EnterpriseIcon, type EnterpriseIconName } from "../EnterpriseIcon";
import {
  formalApplicationDefinitions,
  type FormalApplicationDefinition,
} from "../formalEnterpriseData";
import { createFormalRoute, type FormalRoute } from "../formalEnterpriseModel";

const browseLabels: Readonly<Record<string, string>> = {
  "production:corn-collection": "玉米产情监测",
  "production:soybean-collection": "大豆产情监测",
  "production:rice-collection": "稻谷产情监测",
  "production:regional-annual": "地区产情信息",
  "market:corn-collection": "玉米市场监测",
  "market:soybean-collection": "大豆市场监测",
  "market:paddy-collection": "稻谷市场监测",
};

const sectionIcons: Partial<Record<string, EnterpriseIconName>> = {
  tasks: "entry",
  submitted: "list",
  review: "review",
  exceptions: "exception",
  completed: "history",
  imports: "upload",
  operations: "overview",
  risks: "exception",
  duty: "review",
  releases: "upload",
  objects: "list",
  analysis: "report",
  logistics: "list",
  records: "history",
  compose: "entry",
  comprehensive: "report",
  "review-distribution": "upload",
  ledger: "history",
};

const visibleSectionsByApplication: Readonly<
  Record<string, readonly string[]>
> = {
  production: [
    "corn-collection",
    "soybean-collection",
    "rice-collection",
    "regional-annual",
    "tasks",
    "review",
    "analysis",
  ],
  market: [
    "corn-collection",
    "soybean-collection",
    "paddy-collection",
    "corn-logistics",
    "soybean-logistics",
    "paddy-logistics",
    "analysis",
  ],
  supply: ["balance"],
  work: ["sample-governance", "sample-history"],
  overview: ["map"],
};

export function BusinessNavigationTree({
  administrator = false,
  application,
  currentRoute,
  onNavigate,
  ariaLabel = `${application.label}模块`,
}: {
  administrator?: boolean;
  application: FormalApplicationDefinition;
  currentRoute: FormalRoute;
  onNavigate: (route: FormalRoute) => void;
  ariaLabel?: string;
}) {
  const businessApplications = formalApplicationDefinitions.filter(
    ({ key }) =>
      key === "production" ||
      key === "market" ||
      key === "supply" ||
      key === "overview" ||
      key === "work",
  );

  return (
    <nav aria-label={ariaLabel} className="formal-sidebar-navigation">
      <strong className="formal-sidebar-navigation__title">业务目录</strong>
      <details open className="formal-nav-section">
        <summary>总揽信息</summary>
        {businessApplications.map((businessApplication) => (
          <details
            open
            className="formal-nav-group"
            key={businessApplication.key}
          >
            <summary>
              {businessApplication.key === "work"
                ? "样本点信息"
                : businessApplication.label}
            </summary>
            {businessApplication.navigation
              .filter((item) =>
                visibleSectionsByApplication[businessApplication.key]?.includes(
                  item.route.section,
                ),
              )
              .map((item) => {
                const legacySupplyBalanceActive =
                  item.route.application === "supply" &&
                  item.route.section === "balance" &&
                  currentRoute.application === "supply" &&
                  ["corn-balance", "soybean-balance", "paddy-balance"].includes(
                    currentRoute.section,
                  );
                const active =
                  (item.route.application === currentRoute.application &&
                    item.route.section === currentRoute.section) ||
                  legacySupplyBalanceActive;
                return (
                  <button
                    aria-current={active ? "page" : undefined}
                    className={active ? "is-active" : ""}
                    key={`${item.route.application}:${item.route.section}`}
                    type="button"
                    onClick={() => onNavigate(item.route)}
                  >
                    <EnterpriseIcon
                      name={sectionIcons[item.route.section] ?? "list"}
                    />
                    <b>
                      {browseLabels[
                        `${item.route.application}:${item.route.section}`
                      ] ?? item.label}
                    </b>
                  </button>
                );
              })}
          </details>
        ))}
      </details>
      <details open className="formal-nav-section">
        <summary>我的任务</summary>
        <div className="formal-nav-group">
          {(
            [
              ["task-market", "市场"],
              ["task-production", "产情"],
              ["task-logistics", "物流"],
              ...(administrator
                ? ([
                    ["task-design", "设计样本点维护"],
                    ["task-regional", "地区年度产情填报"],
                  ] as const)
                : []),
            ] as const
          ).map(([section, label]) => (
            <button
              type="button"
              key={section}
              aria-current={
                currentRoute.application === "work" &&
                currentRoute.section === section
                  ? "page"
                  : undefined
              }
              onClick={() => onNavigate(createFormalRoute("work", section))}
            >
              <EnterpriseIcon name="entry" />
              <b>{label}</b>
            </button>
          ))}
        </div>
      </details>
    </nav>
  );
}
