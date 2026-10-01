export const applicationCatalog = Object.freeze([
  Object.freeze({
    id: "grain-workbench",
    name: "业务工作台",
    summary: "粮情采集 · 业务监测 · 经营分析",
    category: "粮食业务",
    href: "/workbench/",
    featured: true,
    published: true,
  }),
  Object.freeze({
    id: "risk-warning",
    name: "风险研判预警",
    summary: "风险发现 · 证据研判 · 预警处置",
    category: "风险治理",
    href: "/risk/",
    featured: true,
    published: true,
  }),
  Object.freeze({
    id: "market-intelligence",
    name: "粮食商情与新闻",
    summary: "国内外新闻 · 数据动态 · 视频资讯",
    category: "商情监测",
    href: "/overview-monitoring/#/market-intelligence",
    featured: true,
    published: true,
  }),
]);

export function availableApps() {
  return applicationCatalog.filter(
    (app) => app.published && /^\/(?!\/)/u.test(app.href),
  );
}
