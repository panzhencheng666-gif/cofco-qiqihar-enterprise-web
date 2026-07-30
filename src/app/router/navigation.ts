import type { IResourceItem } from "@refinedev/core";

export interface NavigationItem {
  key: string;
  label: string;
  path: string;
  children?: readonly NavigationItem[];
}

export const navigationItems: readonly NavigationItem[] = [
  { key: "overview", label: "经营总览", path: "/" },
  {
    key: "production",
    label: "产情监测",
    path: "/production",
    children: [
      { key: "production-tasks", label: "我的任务", path: "/production/tasks" },
      {
        key: "production-objects",
        label: "样本主体",
        path: "/production/objects",
      },
      {
        key: "production-analysis",
        label: "产情分析",
        path: "/production/analysis",
      },
    ],
  },
  {
    key: "market",
    label: "市场监测",
    path: "/market",
    children: [
      { key: "market-tasks", label: "我的任务", path: "/market/tasks" },
      { key: "market-objects", label: "企业与站点", path: "/market/objects" },
      { key: "market-ledger", label: "权威台账", path: "/market/ledger" },
      { key: "market-analysis", label: "市场分析", path: "/market/analysis" },
    ],
  },
  {
    key: "supply-demand",
    label: "供需平衡",
    path: "/supply-demand",
    children: [
      { key: "balance", label: "供需平衡表", path: "/supply-demand/balance" },
      {
        key: "reconciliation",
        label: "账户勾稽",
        path: "/supply-demand/reconciliation",
      },
      {
        key: "change-analysis",
        label: "变化分析",
        path: "/supply-demand/changes",
      },
      { key: "lineage", label: "数据来源", path: "/supply-demand/lineage" },
    ],
  },
  {
    key: "situation",
    label: "态势监控",
    path: "/situation",
    children: [
      { key: "realtime", label: "实时监控平台", path: "/situation/realtime" },
      { key: "regional-map", label: "区域地图", path: "/situation/map" },
    ],
  },
  { key: "review", label: "审核中心", path: "/review" },
  { key: "governance", label: "数据治理", path: "/governance" },
  {
    key: "system",
    label: "系统管理",
    path: "/system",
    children: [
      {
        key: "compatibility",
        label: "技术兼容门禁",
        path: "/system/compatibility",
      },
    ],
  },
];

export const refineResources: IResourceItem[] = [
  { name: "overview", list: "/", meta: { label: "经营总览" } },
  { name: "tasks", list: "/production/tasks", meta: { label: "我的任务" } },
  { name: "reviews", list: "/review", meta: { label: "审核中心" } },
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
