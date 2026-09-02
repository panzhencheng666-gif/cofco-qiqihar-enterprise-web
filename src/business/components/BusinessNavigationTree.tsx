import { EnterpriseIcon, type EnterpriseIconName } from "../EnterpriseIcon";
import {
  formalApplicationDefinitions,
  type FormalApplicationDefinition,
} from "../formalEnterpriseData";
import type { FormalRoute } from "../formalEnterpriseModel";

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
    "tasks",
    "review",
    "analysis",
  ],
  supply: ["balance"],
  reporting: ["compose", "review-distribution", "ledger", "comprehensive"],
  work: ["sample-governance"],
  overview: ["map"],
};

export function BusinessNavigationTree({
  application,
  currentRoute,
  onNavigate,
  ariaLabel = `${application.label}模块`,
}: {
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
      key === "reporting" ||
      key === "overview" ||
      key === "work",
  );

  return (
    <nav aria-label={ariaLabel} className="formal-sidebar-navigation">
      <strong className="formal-sidebar-navigation__title">业务目录</strong>
      {businessApplications.map((businessApplication) => (
        <div className="formal-nav-group" key={businessApplication.key}>
          <span>▾ {businessApplication.label}</span>
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
                  <b>{item.label}</b>
                </button>
              );
            })}
        </div>
      ))}
    </nav>
  );
}
