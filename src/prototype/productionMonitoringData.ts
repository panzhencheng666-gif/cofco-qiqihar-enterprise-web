import type {
  ProductionCrop,
  ProductionObjectType,
} from "./productionMonitoringModel";

export interface ProductionCropProfile {
  key: ProductionCrop;
  label: string;
  area: string;
  expectedYield: string;
  sampleResult: string;
  regionalEstimate: string;
  varieties: readonly {
    name: string;
    status: "已确认" | "待映射";
  }[];
  quality: readonly string[];
}

export const productionCropProfiles: readonly ProductionCropProfile[] = [
  {
    key: "corn",
    label: "玉米",
    area: "1,284.6 万亩",
    expectedYield: "468.2 公斤/亩",
    sampleResult: "样本平均 471.6 公斤/亩",
    regionalEstimate: "加权估计 468.2 公斤/亩",
    varieties: [
      { name: "德美亚3号", status: "已确认" },
      { name: "京科968", status: "已确认" },
      { name: "先玉335", status: "已确认" },
      { name: "农户自填：丰垦009", status: "待映射" },
    ],
    quality: ["水分", "容重", "毒素", "杂质", "不完善粒", "霉变"],
  },
  {
    key: "soybean",
    label: "大豆",
    area: "480.2 万亩",
    expectedYield: "164.8 公斤/亩",
    sampleResult: "样本平均 166.1 公斤/亩",
    regionalEstimate: "加权估计 164.8 公斤/亩",
    varieties: [
      { name: "黑农84", status: "已确认" },
      { name: "东生22", status: "已确认" },
      { name: "绥农52", status: "已确认" },
    ],
    quality: ["蛋白", "水分", "杂质", "不完善粒"],
  },
  {
    key: "paddy",
    label: "稻谷",
    area: "274.8 万亩",
    expectedYield: "612.4 公斤/亩",
    sampleResult: "样本平均 618.3 公斤/亩",
    regionalEstimate: "加权估计 612.4 公斤/亩",
    varieties: [
      { name: "龙粳31", status: "已确认" },
      { name: "绥粳18", status: "已确认" },
      { name: "龙稻18", status: "已确认" },
    ],
    quality: ["出糙率", "出米率", "水分", "杂质", "不完善粒"],
  },
];

export interface ProductionObjectRow {
  name: string;
  type: ProductionObjectType;
  region: string;
  crops: string;
  varieties: string;
  source: string;
  owner: string;
  state: string;
}

export const productionObjectRows: readonly ProductionObjectRow[] = [
  {
    name: "讷河市同义镇调查片区",
    type: "village-ledger",
    region: "讷河市同义镇",
    crops: "玉米 · 大豆",
    varieties: "德美亚3号 · 黑农84",
    source: "行政村台账",
    owner: "刘敏",
    state: "正常监测",
  },
  {
    name: "龙江县杏山镇样本户组",
    type: "farmer",
    region: "龙江县杏山镇",
    crops: "玉米",
    varieties: "京科968 · 先玉335",
    source: "农户样本",
    owner: "赵晨",
    state: "正常监测",
  },
  {
    name: "泰来县和平镇田间样方",
    type: "field-plot",
    region: "泰来县和平镇",
    crops: "稻谷",
    varieties: "龙粳31 · 绥粳18",
    source: "田间测产",
    owner: "王洋",
    state: "待补依据",
  },
  {
    name: "拜泉县农业技术推广中心",
    type: "agri-station",
    region: "拜泉县",
    crops: "玉米 · 大豆",
    varieties: "县域主要品种",
    source: "农技站观察",
    owner: "孙悦",
    state: "复核中",
  },
  {
    name: "梅里斯达斡尔族区丰源家庭农场",
    type: "family-farm",
    region: "梅里斯达斡尔族区",
    crops: "玉米 · 稻谷",
    varieties: "德美亚3号 · 龙稻18",
    source: "家庭农场样本",
    owner: "周楠",
    state: "正常监测",
  },
];

export const productionReviewRows = [
  {
    document: "讷河市玉米长势与测产调查",
    region: "讷河市",
    owner: "刘敏",
    duty: "按时提交",
    documentState: "已提交",
    quality: "通过",
    publication: "待审核",
  },
  {
    document: "泰来县稻谷质量与测产调查",
    region: "泰来县",
    owner: "王洋",
    duty: "未到期",
    documentState: "已退回",
    quality: "检验单缺失",
    publication: "未发布",
  },
  {
    document: "龙江县农户余粮与销售调查",
    region: "龙江县",
    owner: "赵晨",
    duty: "逾期补填",
    documentState: "已提交",
    quality: "2 项警告",
    publication: "待审核",
  },
] as const;
