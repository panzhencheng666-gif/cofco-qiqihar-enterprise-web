/**
 * Throwaway UI prototype: three enterprise architecture variants, switchable
 * with ?variant=A|B|C, across four representative pages selected by ?page=.
 */
import { useEffect, useMemo, useState } from "react";
import { FormalEnterprisePrototype } from "./FormalEnterprisePrototype";

const variants = ["A", "B", "C"] as const;
const pageKeys = ["work", "production", "market", "supply"] as const;

type PrototypeVariant = (typeof variants)[number];
type PrototypePage = (typeof pageKeys)[number];
type Tone = "normal" | "good" | "warning" | "danger";

interface PageDefinition {
  key: PrototypePage;
  label: string;
  eyebrow: string;
  title: string;
  summary: string;
  code: string;
}

interface Metric {
  label: string;
  value: string;
  unit?: string;
  note: string;
  tone?: Tone;
}

interface AttentionItem {
  level: string;
  title: string;
  detail: string;
  tone: Exclude<Tone, "normal">;
}

interface PageContent {
  period: string;
  cutoff: string;
  metrics: readonly Metric[];
  columns: readonly string[];
  rows: readonly (readonly string[])[];
  attention: readonly AttentionItem[];
  sources: readonly {
    name: string;
    detail: string;
    state: string;
    tone: Tone;
  }[];
}

const pages: readonly PageDefinition[] = [
  {
    key: "work",
    label: "我的工作",
    eyebrow: "今日履责",
    title: "经营监测工作台",
    summary: "先处理影响质量资格和发布进度的任务与异常。",
    code: "01",
  },
  {
    key: "production",
    label: "产情监测",
    eyebrow: "业务运营",
    title: "玉米产情监测",
    summary: "分来源治理种植生产、农户库存销售与种植意愿。",
    code: "02",
  },
  {
    key: "market",
    label: "市场监测",
    eyebrow: "业务运营",
    title: "粮食市场监测",
    summary: "从报价与交易追踪到库存、加工消费和区域流向。",
    code: "03",
  },
  {
    key: "supply",
    label: "供需平衡",
    eyebrow: "决策分析",
    title: "玉米供需账户",
    summary: "只使用已发布事实与指标生成可追溯的产品账户。",
    code: "04",
  },
];

const contentByPage: Record<PrototypePage, PageContent> = {
  work: {
    period: "2026/27 年度 · 第 31 周",
    cutoff: "今日 10:46",
    metrics: [
      {
        label: "待我处理",
        value: "12",
        unit: "项",
        note: "其中 4 项影响本周发布",
        tone: "warning",
      },
      {
        label: "待审核",
        value: "7",
        unit: "项",
        note: "最早截止 14:00",
      },
      {
        label: "质量阻断",
        value: "3",
        unit: "项",
        note: "较昨日减少 2 项",
        tone: "danger",
      },
      {
        label: "本周按期率",
        value: "96.8",
        unit: "%",
        note: "责任范围内 186 项",
        tone: "good",
      },
    ],
    columns: ["事项", "业务域", "当前状态", "责任岗位", "完成时限"],
    rows: [
      [
        "讷河市秋粮产量复核",
        "产情监测",
        "退回后待修正",
        "区域数据管理员",
        "今日 14:00",
      ],
      [
        "重点企业库存月报",
        "市场监测",
        "待业务审核",
        "市场审核岗",
        "今日 16:00",
      ],
      [
        "玉米账户第 4 版",
        "供需平衡",
        "勾稽差额待解释",
        "供需分析岗",
        "明日 10:00",
      ],
      [
        "农户售粮进度抽样",
        "产情监测",
        "质量规则通过",
        "调查管理岗",
        "8 月 2 日",
      ],
    ],
    attention: [
      {
        level: "01",
        title: "富裕县 2 个样本点逾期",
        detail: "影响农户库存区域估计资格",
        tone: "danger",
      },
      {
        level: "02",
        title: "3 家企业库存环比异常",
        detail: "需在今日发布前完成解释",
        tone: "warning",
      },
      {
        level: "03",
        title: "玉米账户差额 1.7 万吨",
        detail: "超过账户勾稽阈值 0.5 万吨",
        tone: "warning",
      },
    ],
    sources: [
      {
        name: "我的责任范围",
        detail: "齐齐哈尔全域 · 产情、市场、供需",
        state: "有效",
        tone: "good",
      },
      {
        name: "当前岗位",
        detail: "区域数据管理员",
        state: "在岗",
        tone: "normal",
      },
      {
        name: "最近发布",
        detail: "市场周报 2026 年第 30 周",
        state: "已发布",
        tone: "good",
      },
    ],
  },
  production: {
    period: "2026/27 年度 · 灌浆期",
    cutoff: "7 月 31 日 10:30",
    metrics: [
      {
        label: "玉米监测面积",
        value: "1,284.6",
        unit: "万亩",
        note: "正式口径第 3 版",
      },
      {
        label: "预计单产",
        value: "468.2",
        unit: "公斤/亩",
        note: "较上期上调 3.1",
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
        note: "2 项影响区域发布",
        tone: "danger",
      },
    ],
    columns: ["监测对象", "来源类型", "覆盖/进度", "质量资格", "发布状态"],
    rows: [
      ["村级种植面积台账", "行政村报送", "428 / 428", "通过", "第 3 版已发布"],
      ["作物长势与灾情", "农技站观测", "63 / 67", "4 点待复核", "区域汇总中"],
      ["农户库存与售粮", "农户抽样", "554 户", "2 户权重异常", "本周待发布"],
      ["下季种植意愿", "专题调查", "尚未启动", "方案待审批", "未形成版本"],
    ],
    attention: [
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
        title: "农户样本替换即将超限",
        detail: "本期已替换 7.4%，阈值为 8%",
        tone: "warning",
      },
    ],
    sources: [
      {
        name: "行政村台账",
        detail: "428 个村 · 责任报送",
        state: "已齐套",
        tone: "good",
      },
      {
        name: "农技站观测",
        detail: "67 个站点 · 专业判断",
        state: "4 点缺报",
        tone: "danger",
      },
      {
        name: "农户抽样",
        detail: "554 户 · 区域估计",
        state: "可用",
        tone: "good",
      },
    ],
  },
  market: {
    period: "2026 年第 31 周",
    cutoff: "7 月 31 日 10:42",
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
        note: "同口径周环比 -2.4%",
      },
      {
        label: "异常待解释",
        value: "7",
        unit: "项",
        note: "3 项影响周报发布",
        tone: "danger",
      },
    ],
    columns: ["业务对象", "事实类型", "本期状态", "来源时间", "发布资格"],
    rows: [
      [
        "重点粮贸企业",
        "报价与成交",
        "79 / 86 已报",
        "今日 10:35",
        "7 家待补报",
      ],
      ["仓储设施", "分品种库存", "103.9 万吨", "昨日 24:00", "3 项待解释"],
      ["加工企业", "开工与原料消耗", "开工率 71.6%", "本周三", "通过"],
      [
        "区域流向",
        "跨区到货与发运",
        "净流入 4.8 万吨",
        "第 30 周",
        "待业务审核",
      ],
    ],
    attention: [
      {
        level: "价格",
        title: "北部县区玉米价差扩大",
        detail: "最大价差 96 元/吨，超过预警线",
        tone: "warning",
      },
      {
        level: "库存",
        title: "3 家企业库存变化异常",
        detail: "环比降幅超过 20%，待补充业务解释",
        tone: "danger",
      },
      {
        level: "物流",
        title: "铁路外运量连续两周回落",
        detail: "本周较四周均值低 12.3%",
        tone: "warning",
      },
    ],
    sources: [
      {
        name: "企业报送",
        detail: "86 家主体 · 报价、库存、加工",
        state: "92% 齐套",
        tone: "warning",
      },
      {
        name: "市场采集",
        detail: "31 个监测点 · 每日采集",
        state: "已更新",
        tone: "good",
      },
      {
        name: "物流协同",
        detail: "铁路、公路 · 周度归集",
        state: "待审核",
        tone: "warning",
      },
    ],
  },
  supply: {
    period: "2026/27 年度 · 第 4 版",
    cutoff: "数据截至 7 月 30 日",
    metrics: [
      {
        label: "总供给",
        value: "763.1",
        unit: "万吨",
        note: "期初库存 + 产量 + 净调入",
      },
      {
        label: "总使用",
        value: "659.2",
        unit: "万吨",
        note: "消费 + 加工 + 损耗 + 净调出",
      },
      {
        label: "期末库存",
        value: "103.9",
        unit: "万吨",
        note: "账户计算结果",
        tone: "good",
      },
      {
        label: "勾稽差额",
        value: "1.7",
        unit: "万吨",
        note: "超过 0.5 万吨阈值",
        tone: "danger",
      },
    ],
    columns: ["账户项", "事实/指标来源", "采用版本", "数量", "资格"],
    rows: [
      [
        "期初库存",
        "上年度正式期末库存",
        "2025/26 年度第 6 版",
        "91.4 万吨",
        "通过",
      ],
      [
        "本地粮食产量",
        "产情正式指标",
        "产情 2026 年第 3 版",
        "604.8 万吨",
        "通过",
      ],
      [
        "净区域流入",
        "市场区域流向指标",
        "流向 2026 年第 30 周",
        "66.9 万吨",
        "待审核",
      ],
      [
        "饲用与加工消费",
        "加工消费正式指标",
        "加工消费 2026 年 7 月版",
        "431.7 万吨",
        "通过",
      ],
      [
        "种用、损耗及其他",
        "账户规则计算",
        "玉米账户规则第 4 版",
        "227.5 万吨",
        "通过",
      ],
    ],
    attention: [
      {
        level: "勾稽",
        title: "账户差额 1.7 万吨",
        detail: "主要来自区域流向周报尚未审核",
        tone: "danger",
      },
      {
        level: "血缘",
        title: "1 个采用指标不是正式版",
        detail: "区域流向第 30 周版当前为待审核状态",
        tone: "warning",
      },
      {
        level: "版本",
        title: "第 3 版仍有两份报告引用",
        detail: "第 4 版发布前需完成影响确认",
        tone: "warning",
      },
    ],
    sources: [
      {
        name: "产情指标发布",
        detail: "产量、面积、单产",
        state: "采用第 3 版",
        tone: "good",
      },
      {
        name: "市场指标发布",
        detail: "库存、加工、区域流向",
        state: "1 项待审核",
        tone: "warning",
      },
      {
        name: "账户规则",
        detail: "玉米产品账户规范",
        state: "第 4 版",
        tone: "good",
      },
    ],
  },
};

const variantLabels: Record<PrototypeVariant, string> = {
  A: "正式融合型",
  B: "对象台账型",
  C: "指挥调度型",
};

const secondaryNavigation: Record<PrototypePage, readonly string[]> = {
  work: ["待我处理", "待我审核", "异常与逾期", "待发布", "已办跟踪"],
  production: [
    "产情总览",
    "种植生产",
    "农户库存与销售",
    "种植意愿",
    "质量与发布",
  ],
  market: [
    "市场总览",
    "主体与设施",
    "行情与交易",
    "库存与仓储",
    "加工与消费",
    "物流与流向",
  ],
  supply: ["供需总览", "产品账户", "账户勾稽", "版本与血缘"],
};

interface FusionPageMeta {
  application: string;
  applicationNote: string;
  breadcrumb: readonly string[];
  workspaceTitle: string;
  workspaceSummary: string;
  actions: readonly string[];
  tabs: readonly string[];
  lifecycle: readonly {
    label: string;
    detail: string;
    state: "done" | "current" | "warning" | "open";
  }[];
  context: readonly { label: string; value: string }[];
  filters: readonly string[];
}

const fusionMetaByPage: Record<PrototypePage, FusionPageMeta> = {
  work: {
    application: "我的工作",
    applicationNote: "统一处理跨业务责任、审核、异常和发布事项",
    breadcrumb: ["经营工作", "我的工作"],
    workspaceTitle: "我的经营工作台",
    workspaceSummary: "聚合当前岗位必须处理、审核、解释和跟踪的经营事项。",
    actions: ["批量领取", "转交规则"],
    tabs: ["待我处理", "待我审核", "异常与逾期", "待发布", "已办跟踪"],
    lifecycle: [
      { label: "责任到岗", detail: "12 项", state: "done" },
      { label: "任务受理", detail: "9 项处理中", state: "current" },
      { label: "质量复核", detail: "3 项阻断", state: "warning" },
      { label: "业务审核", detail: "7 项待办", state: "open" },
      { label: "正式发布", detail: "4 项受影响", state: "open" },
    ],
    context: [],
    filters: ["全部业务域", "全部状态", "今日及逾期"],
  },
  production: {
    application: "产情监测",
    applicationNote: "管理生产事实、调查采集、质量审核和正式发布",
    breadcrumb: ["产情运营", "产情监测", "种植生产"],
    workspaceTitle: "种植生产运营工作区",
    workspaceSummary:
      "从样本对象、调查采集到分级审核与正式发布的统一作业入口。",
    actions: ["导入调查结果", "导出当前视图", "更多", "新建调查任务"],
    tabs: [
      "运营总览",
      "样本对象",
      "采集任务",
      "审核与发布",
      "数据质量",
      "来源与版本",
    ],
    lifecycle: [
      { label: "任务下达", detail: "428 份", state: "done" },
      { label: "调查采集", detail: "395 已提交", state: "done" },
      { label: "规则校验", detail: "5 项阻断", state: "warning" },
      { label: "分级审核", detail: "37 项待办", state: "current" },
      { label: "正式发布", detail: "生成事实版本", state: "open" },
    ],
    context: [],
    filters: ["齐齐哈尔全域", "全部来源类型", "全部状态"],
  },
  market: {
    application: "市场监测",
    applicationNote: "治理主体报送、市场事实、质量审核和指标发布",
    breadcrumb: ["市场运营", "市场监测", "市场总览"],
    workspaceTitle: "市场运行监测工作区",
    workspaceSummary: "统一组织报价、交易、库存、加工和物流事实的采集与审核。",
    actions: ["导入主体报送", "导出当前视图", "更多", "新建采集任务"],
    tabs: [
      "运营总览",
      "市场主体",
      "采集任务",
      "审核与发布",
      "数据质量",
      "来源与版本",
    ],
    lifecycle: [
      { label: "任务下达", detail: "86 家", state: "done" },
      { label: "主体报送", detail: "79 家已报", state: "done" },
      { label: "事实匹配", detail: "3 项待解释", state: "warning" },
      { label: "业务审核", detail: "7 项待办", state: "current" },
      { label: "指标发布", detail: "本周未发布", state: "open" },
    ],
    context: [],
    filters: ["全部县区", "全部事实类型", "全部状态"],
  },
  supply: {
    application: "供需平衡",
    applicationNote: "管理产品账户、采用指标、账户勾稽和版本发布",
    breadcrumb: ["决策分析", "供需平衡", "玉米产品账户"],
    workspaceTitle: "玉米供需账户工作区",
    workspaceSummary: "使用已发布事实与指标完成账户计算、差额解释和版本审核。",
    actions: ["比较版本", "查看口径", "更多", "新建测算草案"],
    tabs: ["供需总览", "产品账户", "账户勾稽", "采用指标", "版本与血缘"],
    lifecycle: [
      { label: "版本创建", detail: "第 4 版", state: "done" },
      { label: "指标采用", detail: "1 项待审核", state: "warning" },
      { label: "账户计算", detail: "计算完成", state: "done" },
      { label: "差额解释", detail: "差额 1.7 万吨", state: "current" },
      { label: "审核发布", detail: "尚未发布", state: "open" },
    ],
    context: [],
    filters: ["玉米", "2026/27 年度", "第 4 版"],
  },
};

function isVariant(value: string | null): value is PrototypeVariant {
  return variants.some((variant) => variant === value);
}

function isPage(value: string | null): value is PrototypePage {
  return pageKeys.some((page) => page === value);
}

function readInitialVariant(): PrototypeVariant {
  const value = new URLSearchParams(window.location.search).get("variant");
  return isVariant(value) ? value : "A";
}

function readInitialPage(): PrototypePage {
  const value = new URLSearchParams(window.location.search).get("page");
  return isPage(value) ? value : "work";
}

function updateUrl(variant: PrototypeVariant, page: PrototypePage) {
  const url = new URL(window.location.href);
  url.searchParams.set("variant", variant);
  url.searchParams.set("page", page);
  window.history.replaceState({}, "", url);
}

function ToneMark({
  tone = "normal",
  children,
}: {
  tone?: Tone;
  children: string;
}) {
  return (
    <span className={`prototype-tone prototype-tone--${tone}`}>{children}</span>
  );
}

function PageNavigation({
  page,
  onSelect,
  mode = "vertical",
}: {
  page: PrototypePage;
  onSelect: (page: PrototypePage) => void;
  mode?: "vertical" | "horizontal";
}) {
  return (
    <nav
      className={`prototype-page-nav prototype-page-nav--${mode}`}
      aria-label="界面样板页面"
    >
      {pages.map((item) => (
        <button
          className={item.key === page ? "is-active" : undefined}
          key={item.key}
          type="button"
          onClick={() => onSelect(item.key)}
        >
          <span className="prototype-page-nav__code">{item.code}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

type FusionIconName =
  | "apps"
  | "home"
  | "search"
  | "task"
  | "bell"
  | "help"
  | "chevron"
  | "download"
  | "plus";

function FusionIcon({ name }: { name: FusionIconName }) {
  if (name === "apps") {
    return (
      <svg
        aria-hidden="true"
        className="prototype-fusion-icon"
        viewBox="0 0 24 24"
      >
        {[5, 12, 19].flatMap((x) =>
          [5, 12, 19].map((y) => (
            <rect
              height="3"
              key={`${String(x)}-${String(y)}`}
              rx="0.8"
              width="3"
              x={x - 1.5}
              y={y - 1.5}
            />
          )),
        )}
      </svg>
    );
  }

  if (name === "home") {
    return (
      <svg
        aria-hidden="true"
        className="prototype-fusion-icon"
        viewBox="0 0 24 24"
      >
        <path d="m3.5 10.5 8.5-7 8.5 7v9.5h-6v-6h-5v6h-5z" />
      </svg>
    );
  }

  if (name === "search") {
    return (
      <svg
        aria-hidden="true"
        className="prototype-fusion-icon"
        viewBox="0 0 24 24"
      >
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 5 5" />
      </svg>
    );
  }

  if (name === "task") {
    return (
      <svg
        aria-hidden="true"
        className="prototype-fusion-icon"
        viewBox="0 0 24 24"
      >
        <rect height="17" rx="2" width="14" x="5" y="4" />
        <path d="M8.5 9h7M8.5 13h7M8.5 17h4" />
      </svg>
    );
  }

  if (name === "bell") {
    return (
      <svg
        aria-hidden="true"
        className="prototype-fusion-icon"
        viewBox="0 0 24 24"
      >
        <path d="M5 17h14l-1.5-2.5V10a5.5 5.5 0 0 0-11 0v4.5z" />
        <path d="M10 20h4" />
      </svg>
    );
  }

  if (name === "help") {
    return (
      <svg
        aria-hidden="true"
        className="prototype-fusion-icon"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M9.7 9.2a2.5 2.5 0 1 1 3.7 2.2c-1 .6-1.4 1.2-1.4 2.3M12 17.5h.01" />
      </svg>
    );
  }

  if (name === "chevron") {
    return (
      <svg
        aria-hidden="true"
        className="prototype-fusion-icon"
        viewBox="0 0 24 24"
      >
        <path d="m8 10 4 4 4-4" />
      </svg>
    );
  }

  if (name === "download") {
    return (
      <svg
        aria-hidden="true"
        className="prototype-fusion-icon"
        viewBox="0 0 24 24"
      >
        <path d="M12 4v10m-4-4 4 4 4-4M5 19h14" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className="prototype-fusion-icon"
      viewBox="0 0 24 24"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function FusionGlobalHeader({
  page,
  onSelectPage,
}: {
  page: PrototypePage;
  onSelectPage: (page: PrototypePage) => void;
}) {
  const [applicationMenuOpen, setApplicationMenuOpen] = useState(false);
  const meta = fusionMetaByPage[page];

  return (
    <header className="prototype-fusion-header">
      <button
        aria-label="打开应用列表"
        className="prototype-fusion-launcher"
        type="button"
      >
        <FusionIcon name="apps" />
      </button>
      <div className="prototype-fusion-brand">
        <span>齐</span>
        <div>
          <strong>齐齐哈尔粮食商情企业平台</strong>
          <small>统一业务与数据运营平台</small>
        </div>
      </div>
      <button className="prototype-fusion-selector" type="button">
        <FusionIcon name="home" />
        <span>
          <small>当前组织</small>
          <strong>东北区域经营中心</strong>
        </span>
        <FusionIcon name="chevron" />
      </button>
      <div className="prototype-fusion-app-switcher">
        <button
          aria-expanded={applicationMenuOpen}
          className="prototype-fusion-selector"
          type="button"
          onClick={() => setApplicationMenuOpen((open) => !open)}
        >
          <FusionIcon name="task" />
          <span>
            <small>当前业务应用</small>
            <strong>{meta.application}</strong>
          </span>
          <FusionIcon name="chevron" />
        </button>
        {applicationMenuOpen && (
          <div
            className="prototype-fusion-app-menu"
            role="menu"
            aria-label="切换业务应用"
          >
            {pages.map((item) => (
              <button
                className={item.key === page ? "is-active" : undefined}
                key={item.key}
                role="menuitem"
                type="button"
                onClick={() => {
                  onSelectPage(item.key);
                  setApplicationMenuOpen(false);
                }}
              >
                <span>{item.code}</span>
                <strong>{item.label}</strong>
                <small>{fusionMetaByPage[item.key].applicationNote}</small>
              </button>
            ))}
          </div>
        )}
      </div>
      <label className="prototype-fusion-search">
        <FusionIcon name="search" />
        <input
          aria-label="搜索应用和业务对象"
          placeholder="搜索应用、对象、任务、单据和指标"
        />
      </label>
      <div className="prototype-fusion-header-spacer" />
      <span className="prototype-fusion-environment">
        界面样板 · 非正式数据
      </span>
      <button
        aria-label="任务中心，3 项待处理"
        className="prototype-fusion-header-tool"
        type="button"
      >
        <FusionIcon name="task" />
        <b>3</b>
      </button>
      <button
        aria-label="通知，8 条未读"
        className="prototype-fusion-header-tool"
        type="button"
      >
        <FusionIcon name="bell" />
        <b>8</b>
      </button>
      <button
        aria-label="帮助"
        className="prototype-fusion-header-tool"
        type="button"
      >
        <FusionIcon name="help" />
      </button>
      <div className="prototype-fusion-user">
        <span>王</span>
        <div>
          <strong>王洋</strong>
          <small>区域数据管理员</small>
        </div>
        <FusionIcon name="chevron" />
      </div>
    </header>
  );
}

function FusionSidebar({
  page,
  onSelectPage,
}: {
  page: PrototypePage;
  onSelectPage: (page: PrototypePage) => void;
}) {
  const meta = fusionMetaByPage[page];

  return (
    <aside className="prototype-fusion-sidebar">
      <div className="prototype-fusion-current-app">
        <span className="prototype-fusion-current-app__mark">
          {page === "production"
            ? "产"
            : page === "market"
              ? "市"
              : page === "supply"
                ? "供"
                : "工"}
        </span>
        <div>
          <small>当前业务应用</small>
          <strong>{meta.application}</strong>
        </div>
      </div>
      <div className="prototype-fusion-sidebar-copy">
        {meta.applicationNote}
      </div>
      <nav
        aria-label={`${meta.application}工作区`}
        className="prototype-fusion-workareas"
      >
        <span>业务工作区</span>
        {secondaryNavigation[page].map((item, index) => (
          <button
            className={index === 0 ? "is-active" : undefined}
            key={item}
            type="button"
          >
            <i aria-hidden="true" />
            {item}
            {index === 0 && <b>{contentByPage[page].rows.length}</b>}
          </button>
        ))}
      </nav>
      <div className="prototype-fusion-related-apps">
        <span>快速切换应用</span>
        {pages
          .filter((item) => item.key !== page)
          .map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelectPage(item.key)}
            >
              <span>{item.code}</span>
              {item.label}
            </button>
          ))}
      </div>
      <div className="prototype-fusion-sidebar-status">
        <span className="prototype-live-dot" />
        <div>
          <strong>核心服务全部正常</strong>
          <small>最近同步 10:46 · 会话安全</small>
        </div>
      </div>
    </aside>
  );
}

function FusionPageHeader({ meta }: { meta: FusionPageMeta }) {
  return (
    <div className="prototype-fusion-page-header">
      <div className="prototype-fusion-heading">
        <div className="prototype-fusion-breadcrumb">
          {meta.breadcrumb.map((item, index) => (
            <span key={item}>
              {item}
              {index < meta.breadcrumb.length - 1 && <i>/</i>}
            </span>
          ))}
        </div>
        <h1>{meta.workspaceTitle}</h1>
        <p>{meta.workspaceSummary}</p>
      </div>
      <div className="prototype-fusion-page-actions">
        {meta.actions.map((action, index) => (
          <button
            className={
              index === meta.actions.length - 1 && meta.actions.length > 2
                ? "is-primary"
                : undefined
            }
            key={action}
            type="button"
          >
            {action.includes("导出") && <FusionIcon name="download" />}
            {index === meta.actions.length - 1 && meta.actions.length > 2 && (
              <FusionIcon name="plus" />
            )}
            {action}
            {action === "更多" && <FusionIcon name="chevron" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function FusionContextBand({
  page,
  content,
}: {
  page: PrototypePage;
  content: PageContent;
}) {
  const objectLabel =
    page === "production"
      ? "玉米"
      : page === "market"
        ? "粮食市场"
        : page === "supply"
          ? "玉米产品账户"
          : "全部责任事项";
  const releaseLabel =
    page === "supply"
      ? "第 4 版草案"
      : page === "work"
        ? "按任务跟踪"
        : "本期未发布";
  const contextItems = [
    ["组织", "东北区域经营中心"],
    ["责任区域", "齐齐哈尔 · 全域"],
    ["业务期间", content.period],
    ["业务对象", objectLabel],
    ["数据范围与截止", `本区域全部样本 · ${content.cutoff}`],
    ["质量 / 审核 / 版本", `有条件通过 · 审核中 · ${releaseLabel}`],
  ] as const;

  return (
    <div className="prototype-fusion-context" aria-label="责任与版本轨道">
      <div className="prototype-fusion-context__lead">
        <span className="prototype-live-dot" />
        <small>当前责任上下文</small>
        <strong>岗位责任有效</strong>
      </div>
      {contextItems.map(([label, value], index) => (
        <div
          className={
            index === contextItems.length - 1
              ? "prototype-fusion-context__warning"
              : undefined
          }
          key={label}
        >
          <small>{label}</small>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function FusionTabs({ meta }: { meta: FusionPageMeta }) {
  return (
    <div className="prototype-fusion-tabs" aria-label="页面工作区">
      {meta.tabs.map((tab, index) => (
        <button
          className={index === 0 ? "is-active" : undefined}
          key={tab}
          type="button"
        >
          {tab}
        </button>
      ))}
      <span>一个业务 · 一套对象 · 一条生命周期</span>
    </div>
  );
}

function FusionLifecyclePanel({
  page,
  meta,
  content,
}: {
  page: PrototypePage;
  meta: FusionPageMeta;
  content: PageContent;
}) {
  const versionLabel =
    page === "supply"
      ? "第 4 版草案"
      : page === "work"
        ? "多版本跟踪"
        : "2026 年第 3 版";

  return (
    <section className="prototype-fusion-panel prototype-fusion-lifecycle">
      <div className="prototype-fusion-panel-heading">
        <div>
          <span>本期作业控制</span>
          <h2>本期业务生命周期</h2>
        </div>
        <small>{content.period} · 系统自动汇总</small>
      </div>
      <div className="prototype-fusion-lifecycle-steps">
        {meta.lifecycle.map((stage, index) => (
          <div className={`is-${stage.state}`} key={stage.label}>
            <span>{stage.state === "done" ? "✓" : String(index + 1)}</span>
            <p>
              <strong>{stage.label}</strong>
              <small>{stage.detail}</small>
            </p>
          </div>
        ))}
      </div>
      {page !== "work" && <DomainStory page={page} />}
      <div className="prototype-fusion-lifecycle-facts">
        <div>
          <small>当前责任组织</small>
          <strong>东北区域经营中心</strong>
        </div>
        <div>
          <small>工作版本</small>
          <strong>{versionLabel}</strong>
        </div>
        <div>
          <small>质量规则</small>
          <strong>
            {page === "supply" ? "账户勾稽规则第 4 版" : "经营监测规则第 4 版"}
          </strong>
        </div>
        <div>
          <small>发布窗口</small>
          <strong>今日 16:00</strong>
        </div>
      </div>
    </section>
  );
}

function FusionAttentionPanel({ content }: { content: PageContent }) {
  return (
    <aside className="prototype-fusion-panel prototype-fusion-attention">
      <div className="prototype-fusion-panel-heading">
        <div>
          <span>风险与例外</span>
          <h2>需要立即处理</h2>
        </div>
        <button type="button">进入任务中心 →</button>
      </div>
      <AttentionList content={content} />
    </aside>
  );
}

function FusionFilterBar({
  page,
  meta,
}: {
  page: PrototypePage;
  meta: FusionPageMeta;
}) {
  const sectionTitle =
    page === "supply"
      ? "账户项与采用版本"
      : page === "work"
        ? "责任事项与处理任务"
        : page === "production"
          ? "样本对象与调查任务"
          : "市场对象与采集任务";
  const sectionNote =
    page === "supply"
      ? "账户项只采用具备资格的正式事实与指标版本"
      : "对象与任务关联呈现，从同一对象进入采集、审核、质量和历史";

  return (
    <div className="prototype-fusion-filterbar">
      <div>
        <h2>{sectionTitle}</h2>
        <p>{sectionNote}</p>
      </div>
      <div className="prototype-fusion-filters">
        {meta.filters.map((filter) => (
          <button key={filter} type="button">
            {filter}
            <FusionIcon name="chevron" />
          </button>
        ))}
        <button type="button">列设置</button>
        <button aria-label="刷新当前清单" type="button">
          ↻
        </button>
      </div>
    </div>
  );
}

function MetricStrip({ metrics }: { metrics: readonly Metric[] }) {
  return (
    <div className="prototype-metric-strip">
      {metrics.map((metric) => (
        <article className="prototype-metric" key={metric.label}>
          <div className="prototype-metric__label">
            {metric.label}
            {metric.tone && (
              <span
                className={`prototype-metric__signal is-${metric.tone}`}
                aria-hidden="true"
              />
            )}
          </div>
          <div className="prototype-metric__value">
            {metric.value}
            {metric.unit && <span>{metric.unit}</span>}
          </div>
          <div className="prototype-metric__note">{metric.note}</div>
        </article>
      ))}
    </div>
  );
}

function BusinessTable({
  content,
  compact = false,
}: {
  content: PageContent;
  compact?: boolean;
}) {
  return (
    <div className={`prototype-table-wrap${compact ? " is-compact" : ""}`}>
      <table className="prototype-table">
        <thead>
          <tr>
            {content.columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {content.rows.map((row, rowIndex) => (
            <tr key={row.join("-")}>
              {row.map((cell, cellIndex) => (
                <td key={`${cell}-${String(cellIndex)}`}>
                  {cellIndex === 0 ? (
                    <span className="prototype-table__object">
                      <small>{String(rowIndex + 1).padStart(2, "0")}</small>
                      {cell}
                    </span>
                  ) : cellIndex === row.length - 1 ? (
                    <ToneMark
                      tone={
                        cell.includes("通过") || cell.includes("发布")
                          ? "good"
                          : cell.includes("待") || cell.includes("未")
                            ? "warning"
                            : "normal"
                      }
                    >
                      {cell}
                    </ToneMark>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SourceQualification({ content }: { content: PageContent }) {
  return (
    <div className="prototype-source-list">
      {content.sources.map((source) => (
        <div className="prototype-source-item" key={source.name}>
          <span
            className={`prototype-source-item__bar is-${source.tone}`}
            aria-hidden="true"
          />
          <span>
            <strong>{source.name}</strong>
            <small>{source.detail}</small>
          </span>
          <ToneMark tone={source.tone}>{source.state}</ToneMark>
        </div>
      ))}
    </div>
  );
}

function AttentionList({
  content,
  showAction = true,
}: {
  content: PageContent;
  showAction?: boolean;
}) {
  return (
    <div className="prototype-attention-list">
      {content.attention.map((item) => (
        <article className="prototype-attention-item" key={item.title}>
          <span className={`is-${item.tone}`}>{item.level}</span>
          <div>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
            {showAction && <button type="button">查看处置依据</button>}
          </div>
        </article>
      ))}
    </div>
  );
}

function DomainStory({ page }: { page: PrototypePage }) {
  if (page === "production") {
    return (
      <div className="prototype-domain-story">
        <div>
          <small>来源 01</small>
          <strong>行政村台账</strong>
          <span>面积与生产事实</span>
        </div>
        <i aria-hidden="true">+</i>
        <div>
          <small>来源 02</small>
          <strong>农技站观测</strong>
          <span>长势与灾情判断</span>
        </div>
        <i aria-hidden="true">+</i>
        <div>
          <small>来源 03</small>
          <strong>农户抽样</strong>
          <span>库存、销售与意愿</span>
        </div>
        <i aria-hidden="true">→</i>
        <div className="is-result">
          <small>正式产情指标</small>
          <strong>区域估计与发布</strong>
          <span>保留来源与采用依据</span>
        </div>
      </div>
    );
  }

  if (page === "market") {
    return (
      <div className="prototype-domain-story">
        {["报价", "交易", "库存", "加工", "物流"].map((item, index) => (
          <div key={item}>
            <small>事实 {String(index + 1).padStart(2, "0")}</small>
            <strong>{item}</strong>
            <span>{index < 2 ? "主体行为" : "市场运行"}</span>
          </div>
        ))}
        <i aria-hidden="true">→</i>
        <div className="is-result">
          <small>正式市场指标</small>
          <strong>同口径发布</strong>
          <span>事实不互相替代</span>
        </div>
      </div>
    );
  }

  if (page === "supply") {
    return (
      <div className="prototype-account-equation">
        <div>
          <small>总供给</small>
          <strong>763.1</strong>
          <span>万吨</span>
        </div>
        <b aria-hidden="true">−</b>
        <div>
          <small>总使用</small>
          <strong>659.2</strong>
          <span>万吨</span>
        </div>
        <b aria-hidden="true">=</b>
        <div className="is-result">
          <small>计算期末库存</small>
          <strong>103.9</strong>
          <span>万吨</span>
        </div>
        <b aria-hidden="true">≠</b>
        <div className="is-warning">
          <small>采用库存事实</small>
          <strong>102.2</strong>
          <span>差额 1.7 万吨</span>
        </div>
      </div>
    );
  }

  return (
    <div className="prototype-workflow-story">
      {["责任到岗", "任务受理", "质量校验", "业务审核", "正式发布"].map(
        (item, index) => (
          <div className={index < 2 ? "is-done" : undefined} key={item}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{item}</strong>
          </div>
        ),
      )}
    </div>
  );
}

function PrototypeHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header
      className={`prototype-global-header${compact ? " is-compact" : ""}`}
    >
      <div className="prototype-brand">
        <span className="prototype-brand__mark">齐</span>
        <span>
          <strong>齐齐哈尔粮情企业平台</strong>
          <small>经营监测与区域研判</small>
        </span>
      </div>
      {!compact && (
        <div className="prototype-global-context">
          <span>
            <small>当前组织</small>
            <strong>东北区域经营中心</strong>
          </span>
          <span>
            <small>当前责任区</small>
            <strong>齐齐哈尔全域</strong>
          </span>
        </div>
      )}
      <div className="prototype-global-spacer" />
      {!compact && (
        <label className="prototype-search">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="搜索业务对象"
            placeholder="搜索对象、任务、报告或指标"
          />
        </label>
      )}
      <span className="prototype-sample-badge">界面样板｜非正式数据</span>
      <div className="prototype-user">
        <span>王</span>
        <strong>王洋</strong>
        <small>区域数据管理员</small>
      </div>
    </header>
  );
}

function VariantA({
  page,
  onSelectPage,
}: {
  page: PrototypePage;
  onSelectPage: (page: PrototypePage) => void;
}) {
  const showLegacyFusion =
    new URLSearchParams(window.location.search).get("legacy") === "1";
  if (showLegacyFusion) {
    const content = contentByPage[page];
    const meta = fusionMetaByPage[page];

    return (
      <div className="prototype-a prototype-fusion">
        <FusionGlobalHeader page={page} onSelectPage={onSelectPage} />
        <div className="prototype-fusion-shell">
          <FusionSidebar page={page} onSelectPage={onSelectPage} />
          <main className="prototype-fusion-main">
            <FusionPageHeader meta={meta} />
            <FusionContextBand content={content} page={page} />
            <FusionTabs meta={meta} />
            <MetricStrip metrics={content.metrics} />
            <div className="prototype-fusion-focus-grid">
              <FusionLifecyclePanel content={content} meta={meta} page={page} />
              <FusionAttentionPanel content={content} />
            </div>
            <section className="prototype-fusion-panel prototype-fusion-table-panel">
              <FusionFilterBar meta={meta} page={page} />
              <BusinessTable content={content} />
            </section>
          </main>
        </div>
      </div>
    );
  }
  return <FormalEnterprisePrototype />;
}

function VariantB({
  page,
  onSelectPage,
}: {
  page: PrototypePage;
  onSelectPage: (page: PrototypePage) => void;
}) {
  const definition = pages.find((item) => item.key === page) ?? pages[0];
  const content = contentByPage[page];

  return (
    <div className="prototype-b">
      <PrototypeHeader compact />
      <div className="prototype-b__layout">
        <aside className="prototype-b__index">
          <span className="prototype-index-caption">业务对象索引</span>
          <PageNavigation page={page} onSelect={onSelectPage} />
          <div className="prototype-index-tree">
            <small>{definition.label} / 工作区</small>
            {secondaryNavigation[page].map((item, index) => (
              <button
                className={index === 0 ? "is-active" : undefined}
                key={item}
                type="button"
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                {item}
              </button>
            ))}
          </div>
          <div className="prototype-index-period">
            <small>当前业务期间</small>
            <strong>{content.period}</strong>
            <span>{content.cutoff}</span>
          </div>
        </aside>
        <main className="prototype-b__document">
          <div className="prototype-document-masthead">
            <div>
              <span>
                {definition.eyebrow} / {definition.code}
              </span>
              <h1>{definition.title}</h1>
              <p>{definition.summary}</p>
            </div>
            <div>
              <small>工作版本</small>
              <strong>
                {page === "supply" ? "第 4 版草案" : "2026 年第 3 版"}
              </strong>
              <ToneMark tone="warning">审核中</ToneMark>
            </div>
          </div>
          <div className="prototype-document-rule">
            <span>责任组织：东北区域经营中心</span>
            <span>责任岗位：区域数据管理员</span>
            <span>数据截止：{content.cutoff}</span>
          </div>
          <section className="prototype-ledger-section">
            <div className="prototype-ledger-title">
              <span>Ⅰ</span>
              <div>
                <h2>本期经营判断</h2>
                <p>数字先说明资格和出处，再进入研判与发布。</p>
              </div>
            </div>
            <MetricStrip metrics={content.metrics} />
          </section>
          <section className="prototype-ledger-section">
            <div className="prototype-ledger-title">
              <span>Ⅱ</span>
              <div>
                <h2>{page === "supply" ? "账户采用台账" : "规范事实台账"}</h2>
                <p>同一事实只保留一个权威所有者，调整生成新版本。</p>
              </div>
            </div>
            <DomainStory page={page} />
            <BusinessTable content={content} compact />
          </section>
          <section className="prototype-ledger-section">
            <div className="prototype-ledger-title">
              <span>Ⅲ</span>
              <div>
                <h2>来源资格</h2>
                <p>不同责任链独立治理，只在正式指标层组合。</p>
              </div>
            </div>
            <SourceQualification content={content} />
          </section>
        </main>
        <aside className="prototype-b__inspector">
          <div className="prototype-inspector-heading">
            <span>审查与血缘</span>
            <strong>当前文档检查器</strong>
          </div>
          <div className="prototype-vertical-rail">
            {[
              ["责任已确认", "东北区域经营中心", "done"],
              ["数据已截止", content.cutoff, "done"],
              ["质量有条件通过", "3 项待解释", "warning"],
              ["业务审核中", "审核人：赵晨", "current"],
              ["尚未发布", "无正式版本", "open"],
            ].map(([label, detail, state], index) => (
              <div className={`is-${state}`} key={label}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>
                  <strong>{label}</strong>
                  <small>{detail}</small>
                </p>
              </div>
            ))}
          </div>
          <div className="prototype-inspector-block">
            <span>影响发布的事项</span>
            <AttentionList content={content} showAction={false} />
          </div>
          <div className="prototype-inspector-block">
            <span>引用关系</span>
            <dl>
              <div>
                <dt>上游事实版本</dt>
                <dd>3 个</dd>
              </div>
              <div>
                <dt>正式指标版本</dt>
                <dd>2 个</dd>
              </div>
              <div>
                <dt>下游报告引用</dt>
                <dd>{page === "supply" ? "2 份" : "1 份"}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

function VariantC({
  page,
  onSelectPage,
}: {
  page: PrototypePage;
  onSelectPage: (page: PrototypePage) => void;
}) {
  const definition = pages.find((item) => item.key === page) ?? pages[0];
  const content = contentByPage[page];

  return (
    <div className="prototype-c">
      <header className="prototype-command-header">
        <div className="prototype-brand">
          <span className="prototype-brand__mark">齐</span>
          <span>
            <strong>粮情经营指挥台</strong>
            <small>东北区域经营中心</small>
          </span>
        </div>
        <PageNavigation mode="horizontal" page={page} onSelect={onSelectPage} />
        <div className="prototype-global-spacer" />
        <span className="prototype-sample-badge">界面样板｜非正式数据</span>
        <div className="prototype-command-clock">
          <small>业务时点</small>
          <strong>07.31 / 10:46</strong>
        </div>
      </header>
      <main className="prototype-c__main">
        <div className="prototype-command-title">
          <div>
            <span>
              {definition.eyebrow} · {content.period}
            </span>
            <h1>{definition.title}</h1>
          </div>
          <p>{definition.summary}</p>
          <div>
            <button type="button">查看责任口径</button>
            <button className="is-primary" type="button">
              打开业务队列
            </button>
          </div>
        </div>
        <div className="prototype-situation-strip">
          <div>
            <small>责任状态</small>
            <strong>岗位有效</strong>
            <span>齐齐哈尔全域</span>
          </div>
          <div>
            <small>数据齐套</small>
            <strong>{page === "work" ? "94.2%" : "92.4%"}</strong>
            <span>较昨日 +1.8%</span>
          </div>
          <div className="is-warning">
            <small>质量资格</small>
            <strong>有条件通过</strong>
            <span>{content.attention.length} 项待解释</span>
          </div>
          <div>
            <small>审核状态</small>
            <strong>业务审核中</strong>
            <span>预计今日 16:00</span>
          </div>
          <div className="is-open">
            <small>发布状态</small>
            <strong>尚未发布</strong>
            <span>当前为工作版本</span>
          </div>
        </div>
        <div className="prototype-c__board">
          <section className="prototype-command-panel prototype-c__situation">
            <div className="prototype-command-panel__head">
              <span>01 / 经营态势</span>
              <h2>本期判断与账户关系</h2>
              <small>截止 {content.cutoff}</small>
            </div>
            <MetricStrip metrics={content.metrics} />
            <DomainStory page={page} />
          </section>
          <aside className="prototype-command-panel prototype-c__actions">
            <div className="prototype-command-panel__head">
              <span>02 / 处置队列</span>
              <h2>影响发布</h2>
              <b>{content.attention.length}</b>
            </div>
            <AttentionList content={content} />
          </aside>
          <section className="prototype-command-panel prototype-c__ledger">
            <div className="prototype-command-panel__head">
              <span>03 / 作业明细</span>
              <h2>
                {page === "supply" ? "账户项与采用版本" : "业务对象与事实状态"}
              </h2>
              <div>
                <button type="button">仅看异常</button>
                <button type="button">列设置</button>
              </div>
            </div>
            <BusinessTable content={content} compact />
          </section>
          <section className="prototype-command-panel prototype-c__lineage">
            <div className="prototype-command-panel__head">
              <span>04 / 采用链</span>
              <h2>来源 → 资格 → 版本</h2>
            </div>
            <SourceQualification content={content} />
          </section>
        </div>
      </main>
    </div>
  );
}

function PrototypeSwitcher({
  variant,
  page,
  onChange,
}: {
  variant: PrototypeVariant;
  page: PrototypePage;
  onChange: (variant: PrototypeVariant, page: PrototypePage) => void;
}) {
  const pageLabel =
    pages.find((item) => item.key === page)?.label ?? "我的工作";

  function cycle(direction: -1 | 1) {
    const currentIndex = variants.indexOf(variant);
    const nextIndex =
      (currentIndex + direction + variants.length) % variants.length;
    onChange(variants[nextIndex], page);
  }

  return (
    <div className="prototype-switcher" aria-label="界面方案切换">
      <button aria-label="上一个方案" type="button" onClick={() => cycle(-1)}>
        ←
      </button>
      <div>
        <small>方案比较 · {pageLabel}</small>
        <strong>
          {variant} — {variantLabels[variant]}
        </strong>
      </div>
      <button aria-label="下一个方案" type="button" onClick={() => cycle(1)}>
        →
      </button>
    </div>
  );
}

export function EnterpriseArchitecturePrototype() {
  const [variant, setVariant] = useState<PrototypeVariant>(readInitialVariant);
  const [page, setPage] = useState<PrototypePage>(readInitialPage);
  const showPrototypeSwitcher =
    window.location.pathname.endsWith("/prototype.html") &&
    (window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "localhost");
  const captureMode =
    new URLSearchParams(window.location.search).get("capture") === "1";

  const activeVariant = useMemo(() => {
    if (variant === "B") return VariantB;
    if (variant === "C") return VariantC;
    return VariantA;
  }, [variant]);

  function changeLocation(
    nextVariant: PrototypeVariant,
    nextPage: PrototypePage,
  ) {
    setVariant(nextVariant);
    setPage(nextPage);
    updateUrl(nextVariant, nextPage);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.matches("input, textarea") || target.isContentEditable)
      ) {
        return;
      }
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      const currentIndex = variants.indexOf(variant);
      const nextIndex =
        (currentIndex + direction + variants.length) % variants.length;
      changeLocation(variants[nextIndex], page);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [page, variant]);

  const PrototypeView = activeVariant;

  return (
    <div className={`prototype-root${captureMode ? " is-capture" : ""}`}>
      <PrototypeView
        page={page}
        onSelectPage={(nextPage) => changeLocation(variant, nextPage)}
      />
      {showPrototypeSwitcher && variant !== "A" && (
        <PrototypeSwitcher
          page={page}
          variant={variant}
          onChange={changeLocation}
        />
      )}
    </div>
  );
}
