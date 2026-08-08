import {
  enterpriseRegionGroups,
  type EnterpriseRegionId,
} from "../enterpriseRegions";

export type EnterpriseAdministrativeLevel =
  "province" | "prefecture" | "county" | "township" | "village";

export interface EnterpriseRegionNode {
  id: string;
  label: string;
  level: EnterpriseAdministrativeLevel;
  parentId: string | null;
  sourceStatus: "已核定" | "待核定";
}

const provinceNodes: readonly EnterpriseRegionNode[] = [
  {
    id: "heilongjiang",
    label: "黑龙江省",
    level: "province",
    parentId: null,
    sourceStatus: "已核定",
  },
  {
    id: "inner-mongolia",
    label: "内蒙古自治区",
    level: "province",
    parentId: null,
    sourceStatus: "已核定",
  },
];

const prefectureNodes: readonly EnterpriseRegionNode[] = [
  {
    id: "qiqihar",
    label: "齐齐哈尔市",
    level: "prefecture",
    parentId: "heilongjiang",
    sourceStatus: "已核定",
  },
  {
    id: "heihe",
    label: "黑河市",
    level: "prefecture",
    parentId: "heilongjiang",
    sourceStatus: "已核定",
  },
  {
    id: "hulunbuir",
    label: "呼伦贝尔市",
    level: "prefecture",
    parentId: "inner-mongolia",
    sourceStatus: "已核定",
  },
];

const aggregateRegionAliases = {
  "qiqihar-all": "qiqihar",
  "heihe-all": "heihe",
  "hulunbuir-designated": "hulunbuir",
} as const satisfies Partial<Record<EnterpriseRegionId, string>>;

const countyNodes: readonly EnterpriseRegionNode[] = enterpriseRegionGroups
  .flatMap(({ regions }) => regions)
  .filter(({ id }) => !(id in aggregateRegionAliases))
  .map((region) => ({
    id: region.id,
    label: region.label,
    level: "county" as const,
    parentId: region.parentId,
    sourceStatus:
      region.sourceStatus === "已核定"
        ? ("已核定" as const)
        : ("待核定" as const),
  }));

// Operational prototype paths only include lower-level names corroborated by
// public administrative records. The complete production catalogue remains a
// governed master-data import, rather than a hand-maintained UI list.
// Source for the Tongyi Town sample villages:
// https://haerbin.pbc.gov.cn/haerbin/112693/112776/112781/3911309/4370026/2021102518032675852.pdf
const verifiedLowerLevelNodes: readonly EnterpriseRegionNode[] = [
  {
    id: "qiqihar-nehe-tongyi",
    label: "同义镇",
    level: "township",
    parentId: "qiqihar-nehe",
    sourceStatus: "已核定",
  },
  {
    id: "qiqihar-nehe-tongyi-baoguo",
    label: "保国村",
    level: "village",
    parentId: "qiqihar-nehe-tongyi",
    sourceStatus: "已核定",
  },
  {
    id: "qiqihar-nehe-tongyi-qingbao",
    label: "庆宝村",
    level: "village",
    parentId: "qiqihar-nehe-tongyi",
    sourceStatus: "已核定",
  },
];

export const enterpriseRegionHierarchy: readonly EnterpriseRegionNode[] = [
  ...provinceNodes,
  ...prefectureNodes,
  ...countyNodes,
  ...verifiedLowerLevelNodes,
];

function normalizeAuthorizedRegionId(id: string): string {
  return (
    aggregateRegionAliases[id as keyof typeof aggregateRegionAliases] ?? id
  );
}

function getRegionNode(id: string): EnterpriseRegionNode | undefined {
  return enterpriseRegionHierarchy.find((node) => node.id === id);
}

function isAncestorOf(ancestorId: string, descendantId: string): boolean {
  let current = getRegionNode(descendantId);
  while (current) {
    if (current.id === ancestorId) return true;
    current = current.parentId ? getRegionNode(current.parentId) : undefined;
  }
  return false;
}

function isCoveredByAuthorization(
  node: EnterpriseRegionNode,
  authorizedRegionIds: readonly string[],
): boolean {
  if (authorizedRegionIds.includes("authorized-all")) return true;
  return authorizedRegionIds.some((authorizedRegionId) => {
    const normalizedId = normalizeAuthorizedRegionId(authorizedRegionId);
    if (!getRegionNode(normalizedId)) return false;
    return (
      isAncestorOf(normalizedId, node.id) || isAncestorOf(node.id, normalizedId)
    );
  });
}

export function getEnterpriseRegionPath(
  id: string,
): readonly EnterpriseRegionNode[] {
  const path: EnterpriseRegionNode[] = [];
  let current = getRegionNode(normalizeAuthorizedRegionId(id));
  while (current) {
    path.unshift(current);
    current = current.parentId ? getRegionNode(current.parentId) : undefined;
  }
  return path;
}

export function getAuthorizedRegionChildren(
  parentId: string | null,
  authorizedRegionIds: readonly string[],
): readonly EnterpriseRegionNode[] {
  return enterpriseRegionHierarchy.filter(
    (node) =>
      node.parentId === parentId &&
      isCoveredByAuthorization(node, authorizedRegionIds),
  );
}

export function getAuthorizedRegionsByLevel(
  level: EnterpriseAdministrativeLevel,
  authorizedRegionIds: readonly string[],
): readonly EnterpriseRegionNode[] {
  return enterpriseRegionHierarchy.filter(
    (node) =>
      node.level === level &&
      isCoveredByAuthorization(node, authorizedRegionIds),
  );
}
