import {
  marketRegistryLegacyProfiles,
  marketMonitoringObjects,
} from "./data/monitoringRegistryFixtures";
import type { MarketRegionCoverage, MarketTask } from "./marketMonitoringModel";

export const marketRegionCoverage: readonly MarketRegionCoverage[] = [
  {
    label: "齐齐哈尔指定范围",
    detail: "梅里斯区、8县、讷河市",
    townshipCount: "待核定",
    villageCount: "待核定",
    sourceNote: "等待2025—2026年属地官方完整底册",
    sourceState: "待核定",
  },
  {
    label: "黑河市全域",
    detail: "覆盖全市县区与乡镇样本网络",
    townshipCount: "65个乡镇 · 乡镇与街道合计76个",
    villageCount: "567个行政村",
    sourceNote: "2025—2026年黑河市官方公开口径",
    sourceState: "已核定",
  },
  {
    label: "呼伦贝尔指定范围",
    detail: "扎兰屯、阿荣旗、莫旗、鄂伦春旗",
    townshipCount: "扎兰屯12个 · 鄂伦春10个",
    villageCount: "扎兰屯130个 · 莫旗220个",
    sourceNote: "其余字段等待2025—2026年属地官方底册",
    sourceState: "部分核定",
  },
];

export const marketTasks: readonly MarketTask[] = [
  {
    id: "MK-2026-31017",
    workId: "WORK-MARKET-FILL-W31",
    target: "subject",
    targetName: "龙江县玉米贸易监测组",
    role: "trader",
    grain: "corn",
    region: "齐齐哈尔市",
    owner: "王洋",
    deadline: "今天 17:00",
    status: "填写中",
    completedFields: 18,
    applicableFields: 26,
  },
  {
    id: "MK-2026-31018",
    workId: "WORK-MARKET-RICE-W31",
    target: "subject",
    targetName: "讷河恒泰米业",
    role: "rice-mill",
    grain: "paddy",
    region: "讷河市",
    owner: "王洋",
    deadline: "今天 17:00",
    status: "填写中",
    completedFields: 18,
    applicableFields: 24,
  },
  {
    id: "MK-2026-31021",
    workId: "WORK-MARKET-TRADER-W31",
    target: "subject",
    targetName: "龙江北方粮贸有限公司",
    role: "trader",
    grain: "corn",
    region: "龙江县",
    owner: "赵晨",
    deadline: "今天 17:00",
    status: "待审核",
    completedFields: 18,
    applicableFields: 18,
  },
  {
    id: "MK-2026-31023",
    workId: "WORK-MARKET-SOY-W31",
    target: "subject",
    targetName: "北安大豆蛋白有限公司",
    role: "soy-protein",
    grain: "soybean",
    region: "黑河市北安市",
    owner: "孙悦",
    deadline: "明天 12:00",
    status: "已退回",
    completedFields: 13,
    applicableFields: 16,
  },
  {
    id: "MK-2026-31025",
    workId: "WORK-MARKET-AGRI-W31",
    target: "subject",
    targetName: "梅里斯惠农农资服务部",
    role: "agri-dealer",
    grain: "agri-input",
    region: "梅里斯达斡尔族区",
    owner: "周楠",
    deadline: "明天 12:00",
    status: "填写中",
    completedFields: 7,
    applicableFields: 9,
  },
  {
    id: "MK-2026-31027",
    workId: "WORK-MARKET-RAIL-W31",
    target: "logistics",
    targetName: "齐齐哈尔铁路货运站",
    role: "rail-node",
    grain: "corn",
    region: "齐齐哈尔市",
    owner: "王洋",
    deadline: "今天 17:00",
    status: "填写中",
    completedFields: 9,
    applicableFields: 12,
  },
  {
    id: "MK-2026-31031",
    workId: "WORK-MARKET-ROAD-W31",
    target: "logistics",
    targetName: "扎兰屯公路物流监测点",
    role: "road-node",
    grain: "corn",
    region: "扎兰屯市",
    owner: "陈佳",
    deadline: "明天 12:00",
    status: "填写中",
    completedFields: 6,
    applicableFields: 9,
  },
];

export const marketSubjectRows = marketMonitoringObjects.flatMap((object) => {
  const profile = marketRegistryLegacyProfiles.find(
    ({ objectId }) => objectId === object.objectId,
  )?.profile;
  if (!profile || profile.target !== "subject") return [];
  return [
    {
      name: object.objectName,
      roles: profile.roles,
      grain: profile.grain,
      varieties: profile.varieties,
      qualityScope: profile.qualityScope,
      region: object.regionLabel,
      owner: object.responsiblePerson,
      status: profile.status,
    },
  ];
});

export const marketLogisticsRows = marketMonitoringObjects.flatMap((object) => {
  const profile = marketRegistryLegacyProfiles.find(
    ({ objectId }) => objectId === object.objectId,
  )?.profile;
  if (!profile || profile.target !== "logistics") return [];
  return [
    {
      name: object.objectName,
      type: profile.type,
      coverage: profile.coverage,
      monitoring: profile.monitoring,
      owner: object.responsiblePerson,
      status: profile.status,
    },
  ];
});

export const marketTaskPeriods = [
  { id: "2026-W31", label: "2026 年第 31 周" },
] as const;

export const marketAnalysisCoordinateOptions = {
  periods: [{ id: "2026-W31", label: "2026 年第 31 周（与前三年同期）" }],
  dataLayers: [{ id: "official", label: "正式发布数据" }],
  releaseVersions: [
    { id: "METRIC-2026-W31-V3", label: "2026年第31周已核定数据（当前采用）" },
  ],
} as const;
