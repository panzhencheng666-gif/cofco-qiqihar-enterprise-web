import type {
  CapabilityTemplate,
  EffectiveBusinessRole,
  MonitoringObject,
  MonitoringObjectTypeId,
  MonitoringSourceChannelId,
} from "../core/monitoringRegistry";
import type { MarketRole } from "../marketMonitoringModel";

export const productionRegistryAsOf = "2026-08-01";

export const productionObjectTypeMasterData: readonly {
  id: MonitoringObjectTypeId;
  label: string;
}[] = [
  { id: "farmer", label: "农户" },
  { id: "village-committee", label: "村委会" },
  { id: "agri-station", label: "农技站" },
];

export const productionSourceChannelMasterData: readonly {
  id: MonitoringSourceChannelId;
  label: string;
}[] = [
  { id: "administrative-village-ledger", label: "行政村台账" },
  { id: "farmer-sample", label: "农户样本" },
  { id: "family-farm-sample", label: "家庭农场样本" },
  { id: "agricultural-station-observation", label: "农技站观察" },
  { id: "field-yield-survey", label: "田间测产" },
];

export const productionResponsiblePeopleMasterData = [
  { id: "wang-yang", label: "王洋" },
  { id: "zhao-chen", label: "赵晨" },
  { id: "sun-yue", label: "孙悦" },
] as const;

export const productionBusinessRoleMasterData: readonly EffectiveBusinessRole[] =
  [
    {
      roleId: "production-survey",
      label: "产情调查对象",
      effectiveFrom: "",
      effectiveTo: null,
      capabilityTemplateVersionId: "CAPABILITY-PRODUCTION-FULL-2",
    },
    {
      roleId: "quality-sample",
      label: "质量调查对象",
      effectiveFrom: "",
      effectiveTo: null,
      capabilityTemplateVersionId: "CAPABILITY-QUALITY-1",
    },
    {
      roleId: "field-observation",
      label: "专业产情观察",
      effectiveFrom: "",
      effectiveTo: null,
      capabilityTemplateVersionId: "CAPABILITY-FIELD-1",
    },
  ];

export const productionCapabilityTemplates = [
  {
    capabilityTemplateVersionId: "CAPABILITY-PRODUCTION-FULL-2",
    label: "综合产情调查",
    capabilityLabels: [
      "种植面积调查",
      "长势与灾情调查",
      "测产与产量调查",
      "余粮与销售调查",
    ],
  },
  {
    capabilityTemplateVersionId: "CAPABILITY-QUALITY-1",
    label: "粮食品质调查",
    capabilityLabels: ["质量指标采集", "检验依据上传"],
  },
  {
    capabilityTemplateVersionId: "CAPABILITY-FIELD-1",
    label: "田间样方调查",
    capabilityLabels: ["田间长势观察", "样方测产"],
  },
] as const satisfies readonly CapabilityTemplate[];

export const productionMonitoringObjects: readonly MonitoringObject[] = [
  {
    objectId: "OBJ-PRODUCTION-SURVEY-01",
    objectName: "讷河市同义镇保国村村委会",
    objectTypeId: "village-committee",
    objectTypeLabel: "村委会",
    regionId: "qiqihar-nehe",
    regionLabel: "讷河市同义镇",
    productIds: ["corn", "soybean"],
    productLabels: ["玉米", "大豆"],
    cultivarIds: ["demeiya-3", "heinong-84", "jingke-968"],
    cultivarLabels: ["德美亚3号", "黑农84", "京科968"],
    sourceChannelId: "administrative-village-ledger",
    sourceChannelLabel: "行政村台账",
    responsibleUserId: "wang-yang",
    responsiblePerson: "王洋",
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    validityStatus: "active",
    roles: [
      {
        roleId: "production-survey",
        label: "产情调查对象",
        effectiveFrom: "2025-01-01",
        effectiveTo: null,
        capabilityTemplateVersionId: "CAPABILITY-PRODUCTION-FULL-2",
      },
      {
        roleId: "quality-sample",
        label: "质量调查对象",
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        capabilityTemplateVersionId: "CAPABILITY-QUALITY-1",
      },
    ],
  },
  {
    objectId: "OBJ-PRODUCTION-FARMER-02",
    objectName: "龙江县杏山镇农户调查点",
    objectTypeId: "farmer",
    objectTypeLabel: "农户",
    regionId: "qiqihar-all",
    regionLabel: "龙江县杏山镇",
    productIds: ["corn"],
    productLabels: ["玉米"],
    cultivarIds: ["jingke-968", "xianyu-335"],
    cultivarLabels: ["京科968", "先玉335"],
    sourceChannelId: "farmer-sample",
    sourceChannelLabel: "农户样本",
    responsibleUserId: "zhao-chen",
    responsiblePerson: "赵晨",
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    validityStatus: "active",
    roles: [
      {
        roleId: "production-survey",
        label: "产情调查对象",
        effectiveFrom: "2025-01-01",
        effectiveTo: null,
        capabilityTemplateVersionId: "CAPABILITY-PRODUCTION-FULL-2",
      },
    ],
  },
  {
    objectId: "OBJ-PRODUCTION-FIELD-03",
    objectName: "泰来县和平镇农技站监测点",
    objectTypeId: "agri-station",
    objectTypeLabel: "农技站",
    regionId: "qiqihar-all",
    regionLabel: "泰来县和平镇",
    productIds: ["paddy"],
    productLabels: ["稻谷"],
    cultivarIds: ["longjing-31", "suijing-18"],
    cultivarLabels: ["龙粳31", "绥粳18"],
    sourceChannelId: "field-yield-survey",
    sourceChannelLabel: "田间测产",
    responsibleUserId: "wang-yang",
    responsiblePerson: "王洋",
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    validityStatus: "active",
    roles: [
      {
        roleId: "field-observation",
        label: "田间观测样方",
        effectiveFrom: "2025-01-01",
        effectiveTo: null,
        capabilityTemplateVersionId: "CAPABILITY-FIELD-1",
      },
    ],
  },
  {
    objectId: "OBJ-PRODUCTION-STATION-04",
    objectName: "拜泉县农业技术推广中心",
    objectTypeId: "agri-station",
    objectTypeLabel: "农技站",
    regionId: "qiqihar-all",
    regionLabel: "拜泉县",
    productIds: ["corn", "soybean"],
    productLabels: ["玉米", "大豆"],
    cultivarIds: [],
    cultivarLabels: [],
    sourceChannelId: "agricultural-station-observation",
    sourceChannelLabel: "农技站观察",
    responsibleUserId: "sun-yue",
    responsiblePerson: "孙悦",
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    validityStatus: "active",
    roles: [
      {
        roleId: "field-observation",
        label: "专业产情观察",
        effectiveFrom: "2025-01-01",
        effectiveTo: null,
        capabilityTemplateVersionId: "CAPABILITY-FIELD-1",
      },
    ],
  },
];

export type MarketRegistryLegacyProfile =
  | {
      target: "subject";
      roles: string;
      grain: string;
      varieties: string;
      qualityScope: string;
      status: string;
    }
  | {
      target: "logistics";
      type: string;
      coverage: string;
      monitoring: string;
      status: string;
    };

const marketCapabilitySeeds = [
  [
    "trader",
    "贸易监测",
    ["玉米收购价格采集", "实际成交与数量采集", "库存与销售采集"],
  ],
  [
    "corn-processor",
    "玉米加工监测",
    [
      "玉米收购价格采集",
      "质量条件采集",
      "加工投入、产出与损耗采集",
      "库存采集",
    ],
  ],
  [
    "soy-crusher",
    "大豆压榨监测",
    ["大豆收购与质量采集", "压榨投入、豆粕豆油产出与损耗采集", "库存采集"],
  ],
  [
    "soy-protein",
    "大豆蛋白监测",
    ["大豆收购与质量采集", "蛋白加工投入、产出与损耗采集", "库存采集"],
  ],
  [
    "food-condiment",
    "食品调味监测",
    ["原料收购与质量采集", "加工投入与产出采集", "库存采集"],
  ],
  [
    "rice-mill",
    "米厂监测",
    [
      "稻谷收购价格采集",
      "稻谷质量采集",
      "加工与大米产出采集",
      "库存与销售采集",
    ],
  ],
  [
    "feed",
    "饲料加工监测",
    ["玉米采购与质量采集", "饲料加工投入与产出采集", "库存采集"],
  ],
  ["livestock", "养殖使用监测", ["玉米采购与质量采集", "直接饲用与库存采集"]],
  [
    "reserve",
    "承储监测",
    ["实物库存与货权采集", "库点、批次、保管责任与粮权性质采集"],
  ],
  [
    "wholesale-market",
    "批发市场监测",
    ["销售报价与实际成交价采集", "质量与成交数量采集"],
  ],
  ["agri-dealer", "农资监测", ["商品品种与规格采集", "价格、库存与销售量采集"]],
  [
    "rail-node",
    "铁路物流监测",
    ["包粮与散粮到达发运采集", "即期报价与成交采集", "铁路运单依据采集"],
  ],
  [
    "road-node",
    "公路物流监测",
    ["公路流入流出采集", "包装形态采集", "公路运单与过磅依据采集"],
  ],
] as const satisfies readonly (readonly [
  MarketRole,
  string,
  readonly string[],
])[];

export type MarketCapabilityTemplate = CapabilityTemplate & {
  roleId: MarketRole;
};

export const marketCapabilityTemplates: readonly MarketCapabilityTemplate[] =
  marketCapabilitySeeds.map(([roleId, label, capabilityLabels]) => ({
    roleId,
    capabilityTemplateVersionId: `CAPABILITY-MARKET-${roleId}`,
    label,
    capabilityLabels,
  }));

function marketRole(roleId: MarketRole, label: string) {
  return {
    roleId,
    label,
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    capabilityTemplateVersionId: `CAPABILITY-MARKET-${roleId}`,
  } as const;
}

export const marketRegistryAsOf = "2026-08-01";

export const marketMonitoringObjects: readonly MonitoringObject[] = [
  {
    objectId: "OBJ-MARKET-RICE-01",
    objectName: "讷河恒泰米业",
    objectTypeId: "grain-processing-enterprise",
    objectTypeLabel: "粮食加工企业",
    regionId: "qiqihar-nehe",
    regionLabel: "讷河市",
    productIds: ["paddy", "corn"],
    productLabels: ["稻谷", "玉米"],
    cultivarIds: ["longjing-31", "suijing-18"],
    cultivarLabels: ["龙粳31", "绥粳18"],
    sourceChannelId: "enterprise-report",
    sourceChannelLabel: "企业直报",
    responsibleUserId: "wang-yang",
    responsiblePerson: "王洋",
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    validityStatus: "active",
    roles: [
      marketRole("rice-mill", "米厂"),
      marketRole("trader", "贸易商"),
      marketRole("reserve", "承储企业"),
    ],
  },
  {
    objectId: "OBJ-MARKET-TRADER-01",
    objectName: "龙江县玉米贸易监测组",
    objectTypeId: "market-monitoring-group",
    objectTypeLabel: "市场贸易监测组",
    regionId: "qiqihar-all",
    regionLabel: "齐齐哈尔市",
    productIds: ["corn"],
    productLabels: ["玉米"],
    cultivarIds: [],
    cultivarLabels: [],
    sourceChannelId: "enterprise-report",
    sourceChannelLabel: "企业直报",
    responsibleUserId: "wang-yang",
    responsiblePerson: "王洋",
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    validityStatus: "active",
    roles: [marketRole("trader", "贸易监测组")],
  },
  {
    objectId: "OBJ-MARKET-TRADER-COMPANY-01",
    objectName: "龙江北方粮贸有限公司",
    objectTypeId: "grain-trading-enterprise",
    objectTypeLabel: "粮食贸易企业",
    regionId: "qiqihar-longjiang",
    regionLabel: "龙江县",
    productIds: ["corn", "soybean"],
    productLabels: ["玉米", "大豆"],
    cultivarIds: ["demeiya-3", "heinong-84"],
    cultivarLabels: ["德美亚3号", "黑农84"],
    sourceChannelId: "enterprise-report",
    sourceChannelLabel: "企业直报",
    responsibleUserId: "zhao-chen",
    responsiblePerson: "赵晨",
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    validityStatus: "active",
    roles: [marketRole("trader", "贸易商")],
  },
  {
    objectId: "OBJ-MARKET-SOY-01",
    objectName: "北安大豆蛋白有限公司",
    objectTypeId: "grain-processing-enterprise",
    objectTypeLabel: "粮食加工企业",
    regionId: "heihe-beian",
    regionLabel: "黑河市北安市",
    productIds: ["soybean"],
    productLabels: ["大豆"],
    cultivarIds: ["heinong-84", "dongsheng-22"],
    cultivarLabels: ["黑农84", "东生22"],
    sourceChannelId: "enterprise-report",
    sourceChannelLabel: "企业直报",
    responsibleUserId: "sun-yue",
    responsiblePerson: "孙悦",
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    validityStatus: "active",
    roles: [marketRole("soy-protein", "大豆蛋白加工企业")],
  },
  {
    objectId: "OBJ-MARKET-RESERVE-01",
    objectName: "莫旗国家粮食储备库",
    objectTypeId: "grain-storage-enterprise",
    objectTypeLabel: "粮食承储企业",
    regionId: "hulunbuir-morin-dawa",
    regionLabel: "莫力达瓦旗",
    productIds: ["corn", "soybean"],
    productLabels: ["玉米", "大豆"],
    cultivarIds: [],
    cultivarLabels: [],
    sourceChannelId: "enterprise-report",
    sourceChannelLabel: "企业直报",
    responsibleUserId: "liu-yu",
    responsiblePerson: "刘宇",
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    validityStatus: "active",
    roles: [marketRole("reserve", "承储企业 / 储备库")],
  },
  {
    objectId: "OBJ-MARKET-AGRI-01",
    objectName: "梅里斯惠农农资服务部",
    objectTypeId: "agri-input-operator",
    objectTypeLabel: "农资经营单位",
    regionId: "qiqihar-meilisi",
    regionLabel: "梅里斯达斡尔族区",
    productIds: ["agri-input"],
    productLabels: ["农资"],
    cultivarIds: [],
    cultivarLabels: [],
    sourceChannelId: "enterprise-report",
    sourceChannelLabel: "经营主体直报",
    responsibleUserId: "zhou-nan",
    responsiblePerson: "周楠",
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    validityStatus: "active",
    roles: [marketRole("agri-dealer", "农资经销商")],
  },
  {
    objectId: "OBJ-MARKET-RAIL-01",
    objectName: "齐齐哈尔铁路货运站",
    objectTypeId: "rail-node",
    objectTypeLabel: "铁路站点",
    regionId: "qiqihar-all",
    regionLabel: "齐齐哈尔市",
    productIds: ["corn", "soybean", "paddy"],
    productLabels: ["玉米", "大豆", "稻谷"],
    cultivarIds: ["demeiya-3"],
    cultivarLabels: ["德美亚3号"],
    sourceChannelId: "rail-waybill-ledger",
    sourceChannelLabel: "铁路运单与站点台账",
    responsibleUserId: "wang-yang",
    responsiblePerson: "王洋",
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    validityStatus: "active",
    roles: [marketRole("rail-node", "铁路站点")],
  },
  {
    objectId: "OBJ-MARKET-ROAD-01",
    objectName: "扎兰屯公路物流监测点",
    objectTypeId: "road-node",
    objectTypeLabel: "公路物流节点",
    regionId: "hulunbuir-zhalantun",
    regionLabel: "扎兰屯市",
    productIds: ["corn"],
    productLabels: ["玉米"],
    cultivarIds: ["demeiya-3"],
    cultivarLabels: ["德美亚3号"],
    sourceChannelId: "road-waybill-weighing",
    sourceChannelLabel: "公路运单与过磅记录",
    responsibleUserId: "chen-jia",
    responsiblePerson: "陈佳",
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    validityStatus: "active",
    roles: [marketRole("road-node", "公路物流节点")],
  },
];

export const marketRegistryLegacyProfiles: readonly {
  objectId: string;
  profile: MarketRegistryLegacyProfile;
}[] = [
  {
    objectId: "OBJ-MARKET-RICE-01",
    profile: {
      target: "subject",
      roles: "米厂 · 贸易 · 仓储",
      grain: "稻谷",
      varieties: "龙粳31 · 绥粳18",
      qualityScope: "水分、杂质、不完善粒、出糙率、出米率",
      status: "正常监测",
    },
  },
  {
    objectId: "OBJ-MARKET-TRADER-01",
    profile: {
      target: "subject",
      roles: "贸易监测组",
      grain: "玉米",
      varieties: "不限定具体品种",
      qualityScope: "报价、成交、质量与来源依据",
      status: "正常监测",
    },
  },
  {
    objectId: "OBJ-MARKET-TRADER-COMPANY-01",
    profile: {
      target: "subject",
      roles: "贸易商",
      grain: "玉米 · 大豆",
      varieties: "德美亚3号 · 黑农84",
      qualityScope: "按玉米与大豆业务口径采集",
      status: "正常监测",
    },
  },
  {
    objectId: "OBJ-MARKET-SOY-01",
    profile: {
      target: "subject",
      roles: "大豆蛋白加工",
      grain: "大豆",
      varieties: "黑农84 · 东生22",
      qualityScope: "蛋白、水分、杂质、不完善粒",
      status: "资料待补",
    },
  },
  {
    objectId: "OBJ-MARKET-RESERVE-01",
    profile: {
      target: "subject",
      roles: "承储 · 储备库",
      grain: "玉米 · 大豆",
      varieties: "样本填报后形成清单",
      qualityScope: "按品类与库存批次采集",
      status: "正常监测",
    },
  },
  {
    objectId: "OBJ-MARKET-AGRI-01",
    profile: {
      target: "subject",
      roles: "农资经销商",
      grain: "种子 · 农药 · 化肥",
      varieties: "种子品种与农资商品名称由样本填报",
      qualityScope: "规格、有效成分、养分含量与计量单位",
      status: "正常监测",
    },
  },
  {
    objectId: "OBJ-MARKET-RAIL-01",
    profile: {
      target: "logistics",
      type: "铁路站点",
      coverage: "齐齐哈尔及周边县区",
      monitoring: "包粮 / 散粮、到达 / 发运、即期报价 / 成交价",
      status: "正常监测",
    },
  },
  {
    objectId: "OBJ-MARKET-ROAD-01",
    profile: {
      target: "logistics",
      type: "公路物流节点",
      coverage: "扎兰屯南部通道",
      monitoring: "包粮 / 散粮、流入 / 流出、运单 / 过磅",
      status: "正常监测",
    },
  },
];
