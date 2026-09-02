import type { IResourceItem } from "@refinedev/core";
import type { CapabilityCode } from "@/domains/identity-organization/model";

export interface NavigationItem {
  key: string;
  label: string;
  spaceLabel: string;
  path: string;
  icon:
    | "work"
    | "overview"
    | "production"
    | "market"
    | "supply"
    | "reports"
    | "governance"
    | "system";
  requiredCapability: CapabilityCode;
  contextItems: readonly ContextNavigationItem[];
}

export interface ContextNavigationItem {
  key: string;
  label: string;
  path: string;
}

export const implementedNavigation: readonly NavigationItem[] = [
  {
    key: "my-work",
    label: "我的工作",
    spaceLabel: "个人工作空间",
    path: "/",
    icon: "work",
    requiredCapability: "my-work:view",
    contextItems: [
      { key: "work-overview", label: "任务总览", path: "/" },
      {
        key: "work-reporting",
        label: "待我填报",
        path: "/?view=reporting",
      },
      {
        key: "work-review",
        label: "待我审核",
        path: "/?view=review",
      },
      {
        key: "work-exception",
        label: "异常与逾期",
        path: "/?view=exception",
      },
      {
        key: "work-completed",
        label: "已办跟踪",
        path: "/?view=completed",
      },
    ],
  },
  {
    key: "business-overview",
    label: "经营总览",
    spaceLabel: "经营管理空间",
    path: "/overview",
    icon: "overview",
    requiredCapability: "business-overview:view",
    contextItems: [
      { key: "overview-operation", label: "运营总览", path: "/overview" },
      {
        key: "overview-responsibility",
        label: "履责态势",
        path: "/overview/responsibility",
      },
      {
        key: "overview-risk",
        label: "风险与预警",
        path: "/overview/risk",
      },
    ],
  },
  {
    key: "production-monitoring",
    label: "产情监测",
    spaceLabel: "产情运营空间",
    path: "/production",
    icon: "production",
    requiredCapability: "production-monitoring:view",
    contextItems: [
      { key: "production-overview", label: "监测总览", path: "/production" },
      {
        key: "production-planting",
        label: "种植生产",
        path: "/production/planting",
      },
      {
        key: "production-stock",
        label: "农户余粮",
        path: "/production/stock",
      },
      {
        key: "production-sales",
        label: "农户销售",
        path: "/production/sales",
      },
      {
        key: "production-intention",
        label: "种植意愿",
        path: "/production/intention",
      },
    ],
  },
  {
    key: "market-monitoring",
    label: "市场监测",
    spaceLabel: "市场运营空间",
    path: "/market",
    icon: "market",
    requiredCapability: "market-monitoring:view",
    contextItems: [
      { key: "market-overview", label: "监测总览", path: "/market" },
      {
        key: "market-subject",
        label: "市场主体全景",
        path: "/market/subjects",
      },
      {
        key: "market-trading",
        label: "行情与交易",
        path: "/market/trading",
      },
      {
        key: "market-inventory",
        label: "库存与仓储",
        path: "/market/inventory",
      },
      {
        key: "market-processing",
        label: "加工与转化",
        path: "/market/processing",
      },
      {
        key: "market-logistics",
        label: "物流流向",
        path: "/market/logistics",
      },
      {
        key: "market-agri-inputs",
        label: "农资市场",
        path: "/market/agri-inputs",
      },
    ],
  },
  {
    key: "supply-situation",
    label: "供需与态势",
    spaceLabel: "供需决策空间",
    path: "/supply",
    icon: "supply",
    requiredCapability: "supply-situation:view",
    contextItems: [
      { key: "supply-overview", label: "供需总览", path: "/supply" },
      {
        key: "supply-account",
        label: "产品账户",
        path: "/supply/accounts",
      },
      {
        key: "supply-balance",
        label: "账户勾稽",
        path: "/supply/balance",
      },
      {
        key: "supply-realtime",
        label: "实时监控",
        path: "/supply/realtime",
      },
      {
        key: "supply-map",
        label: "区域地图",
        path: "/supply/map",
      },
      {
        key: "supply-lineage",
        label: "版本与血缘",
        path: "/supply/lineage",
      },
    ],
  },
  {
    key: "data-governance",
    label: "数据治理",
    spaceLabel: "数据治理空间",
    path: "/governance",
    icon: "governance",
    requiredCapability: "data-governance:view",
    contextItems: [
      {
        key: "governance-overview",
        label: "治理总览",
        path: "/governance",
      },
      {
        key: "governance-master",
        label: "主数据",
        path: "/governance/master-data",
      },
      {
        key: "governance-quality",
        label: "质量规则",
        path: "/governance/quality",
      },
      {
        key: "governance-metric",
        label: "指标与公式",
        path: "/governance/metrics",
      },
      {
        key: "governance-lineage",
        label: "数据血缘",
        path: "/governance/lineage",
      },
    ],
  },
  {
    key: "system-administration",
    label: "系统管理",
    spaceLabel: "系统管理空间",
    path: "/system",
    icon: "system",
    requiredCapability: "system-administration:view",
    contextItems: [
      { key: "system-overview", label: "管理总览", path: "/system" },
      {
        key: "system-organization",
        label: "组织与人员",
        path: "/system/organization",
      },
      {
        key: "system-responsibility",
        label: "岗位与责任",
        path: "/system/responsibility",
      },
      {
        key: "system-permission",
        label: "角色与权限",
        path: "/system/permissions",
      },
      {
        key: "system-security",
        label: "安全与运行",
        path: "/system/security",
      },
    ],
  },
];

export function projectNavigation(
  capabilities: readonly CapabilityCode[],
): readonly NavigationItem[] {
  const granted = new Set(capabilities);
  return implementedNavigation.filter((item) =>
    granted.has(item.requiredCapability),
  );
}

export function resolveActiveApplication(
  pathname: string,
  navigation: readonly NavigationItem[],
): NavigationItem | undefined {
  if (pathname === "/" || pathname.startsWith("/objects/")) {
    return navigation.find((item) => item.key === "my-work");
  }
  return navigation.find(
    (item) => item.path !== "/" && pathname.startsWith(item.path),
  );
}

export const refineResources: IResourceItem[] = [
  { name: "workspace", show: "/session/workspace", meta: { hide: true } },
  { name: "my-work", list: "/", meta: { label: "我的工作" } },
  {
    name: "business-overview",
    list: "/overview",
    meta: { label: "经营总览" },
  },
  {
    name: "production-monitoring",
    list: "/production",
    meta: { label: "产情监测" },
  },
  {
    name: "market-monitoring",
    list: "/market",
    meta: { label: "市场监测" },
  },
  {
    name: "supply-situation",
    list: "/supply",
    meta: { label: "供需与态势" },
  },
  {
    name: "data-governance",
    list: "/governance",
    meta: { label: "数据治理" },
  },
  {
    name: "system-administration",
    list: "/system",
    meta: { label: "系统管理" },
  },
  {
    name: "objects",
    show: "/objects/:objectId/documents/:documentId",
    meta: { hide: true },
  },
  {
    name: "documents",
    show: "/objects/:objectId/documents/:documentId",
    meta: { hide: true },
  },
];
