import type {
  FormalApplication,
  FormalRoute,
  ReportingSection,
  WeeklyTaskStatus,
} from "./formalEnterpriseModel";
import { createFormalRoute } from "./formalEnterpriseModel";
import type { OperationalScopeIdentity } from "./core/operationalScope";
import { businessClassificationOptionSources } from "./core/businessClassification";

export const businessClassificationFixtures = businessClassificationOptionSources;

export interface FormalShellIdentity {
  platformName: string;
  workUnit: {
    organizationLabel: string;
    currentUnitLabel: string;
    units: readonly string[];
  };
  account: { displayName: string; menuItems: readonly string[] };
}

export const prototypeShellIdentity: FormalShellIdentity = {
  platformName: "齐齐哈尔粮食商情企业平台",
  workUnit: {
    organizationLabel: "齐齐哈尔经营部",
    currentUnitLabel: "经营部本部",
    units: ["经营部本部", "讷河库", "克山库", "克东库", "龙镇库", "成吉思汗库"],
  },
  account: { displayName: "王洋", menuItems: ["个人资料", "岗位与数据权限", "账号安全", "操作与登录记录", "退出登录"] },
};

export const prototypeOperationalIdentity: OperationalScopeIdentity = {
  workUnit: { organizationId: "qiqihar-operation", unitId: "operation-hq", label: "齐齐哈尔经营部本部" },
  identity: { userId: "wang-yang", postId: "regional-data-admin" },
  authorization: {
    authorizedRegionIds: ["qiqihar-all", "qiqihar-nehe"],
    authorizedBusinessClassificationIds: ["production.planting-production", "market.quote-trade", "supply.supply"],
    authorizedProductIds: ["corn"],
    authorizedCultivarIds: ["jingke-968"],
    authorizedReleaseVersionIds: ["METRIC-2026-W31-V3"],
    permissionKeys: ["prototype:read"],
  },
};

export interface FormalNavigationItem {
  route: FormalRoute;
  label: string;
}

export interface FormalApplicationDefinition {
  key: FormalApplication;
  code: string;
  label: string;
  shortLabel: string;
  note: string;
  navigation: readonly FormalNavigationItem[];
}

export interface ReportingNavigationGroup {
  label: string;
  items: readonly {
    key: ReportingSection;
    label: string;
    badge?: string;
  }[];
}

export type FormalTone = "normal" | "good" | "warning" | "danger";

export interface FormalMetric {
  label: string;
  value: string;
  unit?: string;
  note: string;
  tone?: FormalTone;
}

export interface FormalStage {
  label: string;
  detail: string;
  state: "done" | "current" | "warning" | "open";
}

export interface FormalRisk {
  level: string;
  title: string;
  detail: string;
  tone: Exclude<FormalTone, "normal">;
}

export interface FormalBusinessScope {
  title: string;
  note: string;
  products: readonly {
    name: string;
    detail: string;
    active?: boolean;
  }[];
  actors: readonly {
    label: string;
    value: string;
  }[];
}

export interface FormalWorkspace {
  eyebrow: string;
  title: string;
  summary: string;
  primaryAction: string;
  secondaryActions: readonly string[];
  period: string;
  deadline: string;
  objectLabel: string;
  businessScope?: FormalBusinessScope;
  metrics: readonly FormalMetric[];
  stages: readonly FormalStage[];
  risks: readonly FormalRisk[];
  tableTitle: string;
  tableNote: string;
  columns: readonly string[];
  rows: readonly (readonly string[])[];
}

export interface ResponsibilityAssignment {
  id: string;
  region: string;
  businessItem: string;
  frequency: "每周一次";
  responsibleUserId: string;
  responsiblePerson: string;
  responsiblePost: string;
  reviewer: string;
  deadlineRule: string;
  effectivePeriod: string;
  status: "已生效" | "下周生效";
}

export interface WeeklyTask {
  id: string;
  region: string;
  businessItem: string;
  responsibleUserId: string;
  responsiblePerson: string;
  deadline: string;
  submittedAt: string;
  status: WeeklyTaskStatus;
  reviewer: string;
  snapshot: string;
}

export interface DutyWeeklyRow {
  person: string;
  region: string;
  item: string;
  deadline: string;
  firstQualifiedSubmission: string;
  status: string;
  overdueDuration: string;
  review: string;
}

export interface DutyMonthlyRow {
  person: string;
  region: string;
  expected: string;
  onTime: string;
  overdue: string;
  missing: string;
  returned: string;
  onTimeRate: string;
  trend: string;
}

export interface BusinessReportRow {
  name: string;
  frequency: "日报" | "周报" | "月报";
  scope: string;
  period: string;
  dataVersion: string;
  status: string;
  owner: string;
  publishedAt: string;
}

export const formalApplicationDefinitions: readonly FormalApplicationDefinition[] =
  [
    {
      key: "work",
      code: "01",
      label: "我的工作",
      shortLabel: "工作",
      note: "统一处理本人待填报、待审核、逾期和发布事项",
      navigation: [{ route: createFormalRoute("work", "tasks"), label: "我的任务" }],
    },
    {
      key: "overview",
      code: "02",
      label: "经营总览",
      shortLabel: "总览",
      note: "查看已授权正式指标、业务风险和最新发布结果",
      navigation: [
        { route: createFormalRoute("overview", "operations"), label: "经营运行" },
        { route: createFormalRoute("overview", "risks"), label: "风险关注" },
        { route: createFormalRoute("overview", "duty"), label: "履责情况" },
        { route: createFormalRoute("overview", "releases"), label: "结果发布" },
      ],
    },
    {
      key: "production",
      code: "03",
      label: "产情监测",
      shortLabel: "产情",
      note: "管理调查对象、产情采集、质量审核和结果发布",
      navigation: [
        { route: createFormalRoute("production", "tasks"), label: "业务任务" },
        { route: createFormalRoute("production", "objects"), label: "监测对象" },
        { route: createFormalRoute("production", "analysis"), label: "监测分析" },
      ],
    },
    {
      key: "market",
      code: "04",
      label: "市场监测",
      shortLabel: "市场",
      note: "管理市场主体、行情、库存、加工和物流信息",
      navigation: [
        { route: createFormalRoute("market", "tasks"), label: "业务任务" },
        { route: createFormalRoute("market", "objects"), label: "监测对象" },
        { route: createFormalRoute("market", "analysis"), label: "监测分析" },
      ],
    },
    {
      key: "supply",
      code: "05",
      label: "供需与态势",
      shortLabel: "供需",
      note: "按地区、产品和年度核对供给、使用与期末库存",
      navigation: [
        { route: createFormalRoute("supply", "calculation"), label: "供需测算" },
        { route: createFormalRoute("supply", "comparison"), label: "差异比对" },
        { route: createFormalRoute("supply", "versions"), label: "版本记录" },
      ],
    },
    {
      key: "reporting",
      code: "06",
      label: "报表中心",
      shortLabel: "报表",
      note: "统一管理业务报告、履责报告、复核发布和历史版本",
      navigation: [
        { route: createFormalRoute("reporting", "compose"), label: "报告编制" },
        { route: createFormalRoute("reporting", "review-distribution"), label: "复核与分发" },
        { route: createFormalRoute("reporting", "ledger"), label: "报告台账" },
      ],
    },
  ];

export const reportingNavigation: readonly ReportingNavigationGroup[] = [
  {
    label: "报告工作",
    items: [
      { key: "compose", label: "报告编制" },
    ],
  },
  {
    label: "发布管理",
    items: [
      { key: "review-distribution", label: "复核与分发" },
      { key: "ledger", label: "报告台账" },
    ],
  },
];

export const formalWorkspaceByApplication: Record<
  Exclude<FormalApplication, "reporting" | "overview">,
  FormalWorkspace
> = {
  work: {
    eyebrow: "经营门户 / 我的工作",
    title: "我的经营工作台",
    summary: "聚合本人必须完成的填报、审核、异常解释和发布事项。",
    primaryAction: "进入本周填报",
    secondaryActions: ["批量领取", "查看责任"],
    period: "2026 年第 31 周",
    deadline: "本周五 17:00",
    objectLabel: "王洋 · 齐齐哈尔区域责任",
    metrics: [
      {
        label: "待我填报",
        value: "3",
        unit: "项",
        note: "仅本人具有填写权限",
        tone: "warning",
      },
      {
        label: "待我审核",
        value: "7",
        unit: "项",
        note: "最早截止今日 14:00",
      },
      {
        label: "逾期事项",
        value: "1",
        unit: "项",
        note: "补填不消除逾期",
        tone: "danger",
      },
      {
        label: "本月按时率",
        value: "96.8",
        unit: "%",
        note: "固定周截止快照",
        tone: "good",
      },
    ],
    stages: [
      { label: "责任锁定", detail: "本人 3 项", state: "done" },
      { label: "本周填写", detail: "2 项进行中", state: "current" },
      { label: "规则校验", detail: "1 项待修改", state: "warning" },
      { label: "业务审核", detail: "7 项待办", state: "open" },
      { label: "正式归档", detail: "周五 18:00", state: "open" },
    ],
    risks: [
      {
        level: "逾期",
        title: "甘南县市场库存周报尚未提交",
        detail: "截止快照已记录，责任人补填后仍保留逾期",
        tone: "danger",
      },
      {
        level: "退回",
        title: "讷河市玉米单产依据待补充",
        detail: "仅原填报责任人可以修改并再次提交",
        tone: "warning",
      },
      {
        level: "提醒",
        title: "本周责任周报将在周五生成",
        detail: "所有区域责任状态将按截止快照汇总",
        tone: "good",
      },
    ],
    tableTitle: "本人责任事项",
    tableNote: "任务只作为统一业务入口，不复制填报记录。",
    columns: ["责任事项", "所属业务", "责任区域", "当前状态", "截止时间"],
    rows: [
      ["玉米市场库存周填报", "市场监测", "齐齐哈尔市", "填写中", "周五 17:00"],
      [
        "玉米产情长势周填报",
        "产情监测",
        "齐齐哈尔市",
        "退回后待修改",
        "今日 16:00",
      ],
      ["玉米供需账户解释", "供需与态势", "齐齐哈尔市", "待审核", "明日 10:00"],
      ["第 30 周责任周报复核", "报送与报告", "东北区域", "审核通过", "已完成"],
    ],
  },
  production: {
    eyebrow: "产情运营 / 监测总览",
    title: "种植生产运营工作区",
    summary: "围绕农户和调查样本完成每周监测、审核和结果发布。",
    primaryAction: "新建调查任务",
    secondaryActions: ["导入调查结果", "编制业务报告"],
    period: "2026 年第 31 周 · 灌浆期",
    deadline: "7 月 31 日 17:00",
    objectLabel: "玉米 · 齐齐哈尔全域",
    businessScope: {
      title: "品种与调查对象",
      note: "农户、家庭农场和合作社填报原始品种名称，按作物归集面积、长势和产量",
      products: [
        {
          name: "玉米",
          detail: "德美亚3号、京科968 · 1,284.6 万亩",
          active: true,
        },
        { name: "大豆", detail: "黑农84、东生22 · 480.2 万亩" },
        { name: "稻谷", detail: "龙粳31、绥粳18 · 274.8 万亩" },
      ],
      actors: [
        { label: "农户样本", value: "386 户" },
        { label: "家庭农场", value: "96 家" },
        { label: "合作社", value: "42 家" },
        { label: "农技站", value: "30 个" },
      ],
    },
    metrics: [
      {
        label: "玉米监测面积",
        value: "1,284.6",
        unit: "万亩",
        note: "本期数据已核定",
      },
      {
        label: "预计单产",
        value: "468.2",
        unit: "公斤/亩",
        note: "7 月 31 日审核",
        tone: "good",
      },
      {
        label: "有效样本",
        value: "554",
        unit: "个",
        note: "覆盖 16 个县区",
      },
      {
        label: "质量阻断",
        value: "5",
        unit: "项",
        note: "未关闭不得发布",
        tone: "danger",
      },
    ],
    stages: [
      { label: "任务下达", detail: "428 份", state: "done" },
      { label: "调查采集", detail: "395 已提交", state: "done" },
      { label: "规则校验", detail: "5 项阻断", state: "warning" },
      { label: "分级审核", detail: "37 项待办", state: "current" },
      { label: "结果发布", detail: "尚未发布", state: "open" },
    ],
    risks: [
      {
        level: "阻断",
        title: "讷河市长势观测缺报",
        detail: "4 个农技站超过规定截止时间",
        tone: "danger",
      },
      {
        level: "复核",
        title: "拜泉县单产上调幅度较大",
        detail: "环比变化 8.6%，需补充田间依据",
        tone: "warning",
      },
      {
        level: "提醒",
        title: "农户样本替换接近阈值",
        detail: "本期已替换 7.4%，阈值为 8%",
        tone: "good",
      },
    ],
    tableTitle: "样本对象与调查任务",
    tableNote: "调查、审核和历史记录使用同一对象档案。",
    columns: ["监测对象", "对象类型", "行政区划", "本周任务", "质量状态"],
    rows: [
      [
        "讷河市同义镇样本片区",
        "村级样本点",
        "讷河市",
        "秋粮测产调查",
        "待补充依据",
      ],
      [
        "拜泉县长春镇调查片",
        "农技站样本",
        "拜泉县",
        "长势与灾情调查",
        "复核中",
      ],
      [
        "龙江县杏山镇样本户",
        "农户样本",
        "龙江县",
        "余粮与售粮调查",
        "校验通过",
      ],
      ["泰来县和平镇监测点", "田间样方", "泰来县", "单产预测调查", "审核通过"],
    ],
  },
  market: {
    eyebrow: "市场运营 / 监测总览",
    title: "市场运行监测工作区",
    summary: "统一管理主体报送、价格交易、库存加工和物流信息。",
    primaryAction: "新建采集任务",
    secondaryActions: ["导入主体报送", "编制业务报告"],
    period: "2026 年第 31 周",
    deadline: "7 月 31 日 17:00",
    objectLabel: "玉米市场 · 齐齐哈尔全域",
    businessScope: {
      title: "品种与市场主体",
      note: "按品种查看主体报价、库存、交易和物流",
      products: [
        { name: "玉米", detail: "86 家主体", active: true },
        { name: "大豆", detail: "42 家主体" },
        { name: "稻谷", detail: "35 家主体" },
      ],
      actors: [
        { label: "收储企业", value: "86 家" },
        { label: "加工企业", value: "32 家" },
        { label: "贸易企业", value: "51 家" },
        { label: "价格监测点", value: "64 个" },
      ],
    },
    metrics: [
      {
        label: "玉米主流价",
        value: "2,346",
        unit: "元/吨",
        note: "周环比 +0.8%",
        tone: "good",
      },
      {
        label: "有效报价主体",
        value: "86",
        unit: "家",
        note: "覆盖 12 个县区",
      },
      {
        label: "企业库存",
        value: "103.9",
        unit: "万吨",
        note: "同口径环比 -2.4%",
      },
      {
        label: "异常待解释",
        value: "7",
        unit: "项",
        note: "3 项影响周报发布",
        tone: "danger",
      },
    ],
    stages: [
      { label: "任务下达", detail: "86 家", state: "done" },
      { label: "主体报送", detail: "79 家已报", state: "done" },
      { label: "数据核对", detail: "3 项待解释", state: "warning" },
      { label: "业务审核", detail: "7 项待办", state: "current" },
      { label: "指标发布", detail: "本周未发布", state: "open" },
    ],
    risks: [
      {
        level: "价格",
        title: "北部县区玉米价差扩大",
        detail: "最大价差 96 元/吨，超过预警线",
        tone: "danger",
      },
      {
        level: "库存",
        title: "3 家企业库存变化异常",
        detail: "环比降幅超过 20%，等待补充解释",
        tone: "warning",
      },
      {
        level: "物流",
        title: "铁路外运量连续两周回落",
        detail: "本周较四周均值低 12.3%",
        tone: "good",
      },
    ],
    tableTitle: "市场主体与本周报送",
    tableNote: "市场主体、设施和报送数据使用同一份主体档案。",
    columns: ["市场主体", "主体类型", "责任区域", "本周报送", "数据状态"],
    rows: [
      [
        "齐齐哈尔北方粮贸有限公司",
        "贸易企业",
        "建华区",
        "已按时提交",
        "审核通过",
      ],
      ["龙江丰源仓储有限公司", "仓储企业", "龙江县", "填写中", "待校验"],
      ["讷河市恒泰加工厂", "加工企业", "讷河市", "逾期补填", "保留逾期"],
      [
        "泰来县区域价格采集点",
        "价格监测点",
        "泰来县",
        "已按时提交",
        "指标可用",
      ],
    ],
  },
  supply: {
    eyebrow: "决策分析 / 产品账户",
    title: "玉米供需账户工作区",
    summary: "采用已核定的产情、库存和流向数据编制区域供需账户。",
    primaryAction: "新建账户草案",
    secondaryActions: ["查看历史记录", "编制业务报告"],
    period: "2026/27 年度",
    deadline: "报告周五 18:00",
    objectLabel: "玉米原粮账户",
    businessScope: {
      title: "产品账户与来源对象",
      note: "账户采用已核定的产情和市场数据",
      products: [
        { name: "玉米", detail: "2026/27 年度", active: true },
        { name: "大豆", detail: "2026/27 年度" },
        { name: "稻谷", detail: "2026/27 年度" },
      ],
      actors: [
        { label: "农户产量样本", value: "554 个" },
        { label: "涉粮企业", value: "169 家" },
        { label: "仓储设施", value: "128 座" },
        { label: "正式指标", value: "36 项" },
      ],
    },
    metrics: [
      {
        label: "总供给",
        value: "763.1",
        unit: "万吨",
        note: "期初库存＋产量＋净调入",
      },
      {
        label: "总使用与外流",
        value: "659.2",
        unit: "万吨",
        note: "使用＋加工＋损耗＋净调出",
      },
      {
        label: "期末库存",
        value: "103.9",
        unit: "万吨",
        note: "作为下一年度期初库存",
        tone: "good",
      },
      {
        label: "平衡差额",
        value: "1.7",
        unit: "万吨",
        note: "超过 0.5 万吨阈值",
        tone: "danger",
      },
    ],
    stages: [
      { label: "账户建立", detail: "本期草案", state: "done" },
      { label: "数据确认", detail: "1 项待审核", state: "warning" },
      { label: "账户编制", detail: "本期数据已汇总", state: "done" },
      { label: "差额解释", detail: "差额 1.7 万吨", state: "current" },
      { label: "审核发布", detail: "尚未发布", state: "open" },
    ],
    risks: [
      {
        level: "差额",
        title: "账户差额 1.7 万吨",
        detail: "主要来自区域流向周报尚未审核",
        tone: "danger",
      },
      {
        level: "来源",
        title: "1 项采用数据尚未核定",
        detail: "第 30 周区域流向资料等待审核",
        tone: "warning",
      },
      {
        level: "报告",
        title: "上期报告仍有两份在用",
        detail: "本期发布前需确认替代范围",
        tone: "good",
      },
    ],
    tableTitle: "账户项目与采用数据",
    tableNote: "集中显示采用值、数据来源和审核情况。",
    columns: ["账户项目", "采用值", "数据来源", "核对状态", "责任岗位"],
    rows: [
      ["期初库存", "91.6 万吨", "7 月库存月报", "通过", "供需分析岗"],
      ["本期产量", "621.8 万吨", "7 月 31 日产情结果", "通过", "产情发布岗"],
      ["区域净调入", "49.7 万吨", "第 30 周区域流向", "待解释", "市场审核岗"],
      ["期末库存", "103.9 万吨", "本期账户草案", "待审核", "供需发布岗"],
    ],
  },
};

export const responsibilityAssignments: readonly ResponsibilityAssignment[] = [
  {
    id: "resp-qqhr-market",
    region: "齐齐哈尔市本级",
    businessItem: "玉米市场运行周填报",
    frequency: "每周一次",
    responsibleUserId: "user-wang-yang",
    responsiblePerson: "王洋",
    responsiblePost: "市级市场填报岗",
    reviewer: "赵晨",
    deadlineRule: "每周五 17:00",
    effectivePeriod: "2026-01-01 至 2026-12-31",
    status: "已生效",
  },
  {
    id: "resp-nehe-market",
    region: "讷河市",
    businessItem: "玉米市场运行周填报",
    frequency: "每周一次",
    responsibleUserId: "user-liu-min",
    responsiblePerson: "刘敏",
    responsiblePost: "县域市场填报岗",
    reviewer: "王洋",
    deadlineRule: "每周五 17:00",
    effectivePeriod: "2026-01-01 至 2026-12-31",
    status: "已生效",
  },
  {
    id: "resp-gannan-market",
    region: "甘南县",
    businessItem: "玉米市场运行周填报",
    frequency: "每周一次",
    responsibleUserId: "user-sun-mei",
    responsiblePerson: "孙梅",
    responsiblePost: "县域市场填报岗",
    reviewer: "王洋",
    deadlineRule: "每周五 17:00",
    effectivePeriod: "2026-01-01 至 2026-12-31",
    status: "已生效",
  },
  {
    id: "resp-baiquan-production",
    region: "拜泉县",
    businessItem: "玉米产情调查周填报",
    frequency: "每周一次",
    responsibleUserId: "user-zhou-li",
    responsiblePerson: "周立",
    responsiblePost: "县域产情填报岗",
    reviewer: "赵晨",
    deadlineRule: "每周五 16:00",
    effectivePeriod: "2026-01-01 至 2026-12-31",
    status: "已生效",
  },
  {
    id: "resp-longjiang-production",
    region: "龙江县",
    businessItem: "玉米产情调查周填报",
    frequency: "每周一次",
    responsibleUserId: "user-chen-xue",
    responsiblePerson: "陈雪",
    responsiblePost: "县域产情填报岗",
    reviewer: "赵晨",
    deadlineRule: "每周五 16:00",
    effectivePeriod: "2026-08-03 至 2026-12-31",
    status: "下周生效",
  },
];

export const weeklyTasks: readonly WeeklyTask[] = [
  {
    id: "task-31-qqhr",
    region: "齐齐哈尔市本级",
    businessItem: "玉米市场运行周填报",
    responsibleUserId: "user-wang-yang",
    responsiblePerson: "王洋",
    deadline: "7 月 31 日 17:00",
    submittedAt: "尚未提交",
    status: "填写中",
    reviewer: "赵晨",
    snapshot: "截止前可由本人填写",
  },
  {
    id: "task-31-nehe",
    region: "讷河市",
    businessItem: "玉米市场运行周填报",
    responsibleUserId: "user-liu-min",
    responsiblePerson: "刘敏",
    deadline: "7 月 31 日 17:00",
    submittedAt: "7 月 31 日 15:42",
    status: "已按时提交",
    reviewer: "王洋",
    snapshot: "首次合格提交已固定",
  },
  {
    id: "task-31-gannan",
    region: "甘南县",
    businessItem: "玉米市场运行周填报",
    responsibleUserId: "user-sun-mei",
    responsiblePerson: "孙梅",
    deadline: "7 月 31 日 17:00",
    submittedAt: "尚未提交",
    status: "截止未提交",
    reviewer: "王洋",
    snapshot: "逾期记录已固定",
  },
  {
    id: "task-31-baiquan",
    region: "拜泉县",
    businessItem: "玉米产情调查周填报",
    responsibleUserId: "user-zhou-li",
    responsiblePerson: "周立",
    deadline: "7 月 31 日 16:00",
    submittedAt: "7 月 31 日 16:36",
    status: "逾期补填",
    reviewer: "赵晨",
    snapshot: "补填不消除逾期",
  },
  {
    id: "task-31-tailai",
    region: "泰来县",
    businessItem: "玉米产情调查周填报",
    responsibleUserId: "user-gao-ning",
    responsiblePerson: "高宁",
    deadline: "7 月 31 日 16:00",
    submittedAt: "7 月 31 日 14:18",
    status: "审核通过",
    reviewer: "赵晨",
    snapshot: "正式记录已归档",
  },
];

export const dutyWeeklyRows: readonly DutyWeeklyRow[] = [
  {
    person: "王洋",
    region: "齐齐哈尔市本级",
    item: "玉米市场运行周填报",
    deadline: "周五 17:00",
    firstQualifiedSubmission: "填写中",
    status: "截止前",
    overdueDuration: "—",
    review: "尚未提交",
  },
  {
    person: "刘敏",
    region: "讷河市",
    item: "玉米市场运行周填报",
    deadline: "周五 17:00",
    firstQualifiedSubmission: "周五 15:42",
    status: "按时完成",
    overdueDuration: "—",
    review: "待审核",
  },
  {
    person: "孙梅",
    region: "甘南县",
    item: "玉米市场运行周填报",
    deadline: "周五 17:00",
    firstQualifiedSubmission: "未提交",
    status: "截止未提交",
    overdueDuration: "2 小时 18 分",
    review: "逾期已记录",
  },
  {
    person: "周立",
    region: "拜泉县",
    item: "玉米产情调查周填报",
    deadline: "周五 16:00",
    firstQualifiedSubmission: "周五 16:36",
    status: "逾期补填",
    overdueDuration: "36 分钟",
    review: "复核中",
  },
  {
    person: "高宁",
    region: "泰来县",
    item: "玉米产情调查周填报",
    deadline: "周五 16:00",
    firstQualifiedSubmission: "周五 14:18",
    status: "按时完成",
    overdueDuration: "—",
    review: "审核通过",
  },
];

export const dutyMonthlyRows: readonly DutyMonthlyRow[] = [
  {
    person: "王洋",
    region: "齐齐哈尔市本级",
    expected: "4",
    onTime: "4",
    overdue: "0",
    missing: "0",
    returned: "1",
    onTimeRate: "100%",
    trend: "连续 4 周按时",
  },
  {
    person: "刘敏",
    region: "讷河市",
    expected: "4",
    onTime: "3",
    overdue: "1",
    missing: "0",
    returned: "0",
    onTimeRate: "75%",
    trend: "较上月下降 25%",
  },
  {
    person: "孙梅",
    region: "甘南县",
    expected: "4",
    onTime: "2",
    overdue: "1",
    missing: "1",
    returned: "1",
    onTimeRate: "50%",
    trend: "连续 2 周异常",
  },
  {
    person: "周立",
    region: "拜泉县",
    expected: "4",
    onTime: "3",
    overdue: "1",
    missing: "0",
    returned: "2",
    onTimeRate: "75%",
    trend: "本周逾期补填",
  },
  {
    person: "高宁",
    region: "泰来县",
    expected: "4",
    onTime: "4",
    overdue: "0",
    missing: "0",
    returned: "0",
    onTimeRate: "100%",
    trend: "履责稳定",
  },
];

export const businessReportRows: readonly BusinessReportRow[] = [
  {
    name: "齐齐哈尔玉米市场运行日报",
    frequency: "日报",
    scope: "齐齐哈尔市全域",
    period: "2026-07-31",
    dataVersion: "7 月 31 日已核定数据",
    status: "等待复核",
    owner: "市场分析岗",
    publishedAt: "计划今日 18:30",
  },
  {
    name: "齐齐哈尔玉米产情监测周报",
    frequency: "周报",
    scope: "16 个县区",
    period: "2026 年第 31 周",
    dataVersion: "第 31 周已核定数据",
    status: "生成中",
    owner: "产情分析岗",
    publishedAt: "计划今日 19:00",
  },
  {
    name: "齐齐哈尔粮食商情月报",
    frequency: "月报",
    scope: "齐齐哈尔经营部",
    period: "2026 年 7 月",
    dataVersion: "2026 年 7 月已核定数据",
    status: "已发布",
    owner: "报告发布岗",
    publishedAt: "7 月 30 日 17:20",
  },
  {
    name: "玉米供需账户分析月报",
    frequency: "月报",
    scope: "玉米原粮账户",
    period: "2026/27 年度 · 7 月",
    dataVersion: "2026/27 年度已核定账户",
    status: "等待替代确认",
    owner: "供需分析岗",
    publishedAt: "修订报告确认后替代",
  },
];
