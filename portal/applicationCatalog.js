export const applicationCatalog = Object.freeze([
  Object.freeze({
    id: "grain-workbench",
    name: "业务工作台",
    summary: "粮情采集 · 业务监测 · 经营分析",
    category: "粮食业务",
    href: "https://localhost:29444/",
    featured: true,
    published: true,
  }),
  Object.freeze({
    id: "risk-warning",
    name: "风险研判预警",
    summary: "风险发现 · 证据研判 · 预警处置",
    category: "风险治理",
    href: "https://localhost:29444/risk/",
    featured: true,
    published: true,
  }),
]);

export function availableApps() {
  return applicationCatalog.filter(
    (app) => app.published && /^https:\/\//u.test(app.href),
  );
}
