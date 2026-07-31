export const authorizedScopeRegionId = "authorized-all" as const;

export type EnterpriseRegionId =
  | typeof authorizedScopeRegionId
  | "qiqihar-all"
  | "qiqihar-longsha"
  | "qiqihar-jianhua"
  | "qiqihar-tiefeng"
  | "qiqihar-angangxi"
  | "qiqihar-fularji"
  | "qiqihar-nianzishan"
  | "qiqihar-meilisi"
  | "qiqihar-nehe"
  | "qiqihar-longjiang"
  | "qiqihar-yian"
  | "qiqihar-tailai"
  | "qiqihar-gannan"
  | "qiqihar-fuyu"
  | "qiqihar-keshan"
  | "qiqihar-kedong"
  | "qiqihar-baiquan"
  | "heihe-all"
  | "heihe-aihui"
  | "heihe-beian"
  | "heihe-wudalianchi"
  | "heihe-nenjiang"
  | "heihe-sunwu"
  | "heihe-xunke"
  | "hulunbuir-designated"
  | "hulunbuir-zhalantun"
  | "hulunbuir-arun"
  | "hulunbuir-morin-dawa"
  | "hulunbuir-oroqen";

export type EnterpriseRegionSourceStatus = "已核定" | "部分核定" | "待核定";

export interface EnterpriseRegion {
  id: EnterpriseRegionId;
  label: string;
  level: "监测区域" | "区县旗市";
  parentId: "qiqihar" | "heihe" | "hulunbuir";
  townshipCount: string;
  villageCount: string;
  sourceStatus: EnterpriseRegionSourceStatus;
  sourceNote: string;
}

export interface EnterpriseRegionGroup {
  id: EnterpriseRegion["parentId"];
  label: string;
  regions: readonly EnterpriseRegion[];
}

function region(
  id: EnterpriseRegionId,
  label: string,
  parentId: EnterpriseRegion["parentId"],
  overrides: Partial<Omit<EnterpriseRegion, "id" | "label" | "parentId">> = {},
): EnterpriseRegion {
  return {
    id,
    label,
    parentId,
    level:
      id.endsWith("-all") || id.endsWith("-designated")
        ? "监测区域"
        : "区县旗市",
    townshipCount: "待核定",
    villageCount: "待核定",
    sourceStatus: "待核定",
    sourceNote: "等待2025—2026年属地官方完整底册",
    ...overrides,
  };
}

export const enterpriseRegionGroups: readonly EnterpriseRegionGroup[] = [
  {
    id: "qiqihar",
    label: "齐齐哈尔市",
    regions: [
      region("qiqihar-all", "齐齐哈尔市全域", "qiqihar"),
      region("qiqihar-longsha", "龙沙区", "qiqihar"),
      region("qiqihar-jianhua", "建华区", "qiqihar"),
      region("qiqihar-tiefeng", "铁锋区", "qiqihar"),
      region("qiqihar-angangxi", "昂昂溪区", "qiqihar"),
      region("qiqihar-fularji", "富拉尔基区", "qiqihar"),
      region("qiqihar-nianzishan", "碾子山区", "qiqihar"),
      region("qiqihar-meilisi", "梅里斯达斡尔族区", "qiqihar"),
      region("qiqihar-nehe", "讷河市", "qiqihar"),
      region("qiqihar-longjiang", "龙江县", "qiqihar"),
      region("qiqihar-yian", "依安县", "qiqihar"),
      region("qiqihar-tailai", "泰来县", "qiqihar"),
      region("qiqihar-gannan", "甘南县", "qiqihar"),
      region("qiqihar-fuyu", "富裕县", "qiqihar"),
      region("qiqihar-keshan", "克山县", "qiqihar"),
      region("qiqihar-kedong", "克东县", "qiqihar"),
      region("qiqihar-baiquan", "拜泉县", "qiqihar"),
    ],
  },
  {
    id: "heihe",
    label: "黑河市",
    regions: [
      region("heihe-all", "黑河市全域", "heihe", {
        townshipCount: "65个乡镇",
        villageCount: "567个行政村",
        sourceStatus: "已核定",
        sourceNote: "2025—2026年黑河市官方公开口径",
      }),
      region("heihe-aihui", "爱辉区", "heihe"),
      region("heihe-beian", "北安市", "heihe"),
      region("heihe-wudalianchi", "五大连池市", "heihe"),
      region("heihe-nenjiang", "嫩江市", "heihe"),
      region("heihe-sunwu", "孙吴县", "heihe"),
      region("heihe-xunke", "逊克县", "heihe"),
    ],
  },
  {
    id: "hulunbuir",
    label: "呼伦贝尔指定范围",
    regions: [
      region("hulunbuir-designated", "呼伦贝尔指定范围", "hulunbuir", {
        townshipCount: "部分核定",
        villageCount: "部分核定",
        sourceStatus: "部分核定",
        sourceNote: "四个指定旗市，完整数量等待属地官方底册",
      }),
      region("hulunbuir-zhalantun", "扎兰屯市", "hulunbuir", {
        townshipCount: "12个",
        villageCount: "130个行政村",
        sourceStatus: "部分核定",
        sourceNote: "2025—2026年属地公开口径，待统一底册复核",
      }),
      region("hulunbuir-arun", "阿荣旗", "hulunbuir"),
      region("hulunbuir-morin-dawa", "莫力达瓦达斡尔族自治旗", "hulunbuir", {
        villageCount: "220个行政村",
        sourceStatus: "部分核定",
        sourceNote: "2025—2026年属地公开口径，乡镇数待统一复核",
      }),
      region("hulunbuir-oroqen", "鄂伦春自治旗", "hulunbuir", {
        townshipCount: "10个",
        sourceStatus: "部分核定",
        sourceNote: "2025—2026年属地公开口径，行政村数待统一复核",
      }),
    ],
  },
];

export function getEnterpriseRegionOptions(): readonly EnterpriseRegion[] {
  return enterpriseRegionGroups.flatMap((group) => group.regions);
}

export function isStatisticalEnterpriseRegionId(
  id: string,
): id is Exclude<EnterpriseRegionId, typeof authorizedScopeRegionId> {
  return id !== authorizedScopeRegionId && getEnterpriseRegionOptions().some(
    (region) => region.id === id,
  );
}

export function getEnterpriseRegion(
  id: string | null | undefined,
): EnterpriseRegion {
  return (
    getEnterpriseRegionOptions().find((item) => item.id === id) ??
    enterpriseRegionGroups[0].regions[0]
  );
}
