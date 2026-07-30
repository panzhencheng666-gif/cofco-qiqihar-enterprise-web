/**
 * Throwaway UI prototype: three enterprise architecture variants, switchable
 * with ?variant=A|B|C, across four representative pages selected by ?page=.
 */
import { useEffect, useMemo, useState } from "react";

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
  A: "责任轨道型",
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

function ResponsibilityRail({ page }: { page: PrototypePage }) {
  const reviewState =
    page === "supply"
      ? "勾稽待解释"
      : page === "work"
        ? "按任务区分"
        : "业务审核中";
  const releaseState =
    page === "supply"
      ? "第 4 版草案"
      : page === "work"
        ? "多版本跟踪"
        : "本期未发布";
  const steps = [
    ["责任组织", "东北区域经营中心", "done"],
    ["当前岗位", "区域数据管理员", "done"],
    ["业务期间", contentByPage[page].period, "done"],
    ["数据截止", contentByPage[page].cutoff, "current"],
    ["质量资格", page === "work" ? "3 项阻断" : "有条件通过", "warning"],
    ["审核状态", reviewState, "warning"],
    ["发布版本", releaseState, "open"],
  ] as const;

  return (
    <div className="prototype-responsibility-rail" aria-label="责任与版本轨道">
      {steps.map(([label, value, state], index) => (
        <div
          className={`prototype-responsibility-step is-${state}`}
          key={label}
        >
          <span className="prototype-responsibility-step__number">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="prototype-responsibility-step__copy">
            <small>{label}</small>
            <strong>{value}</strong>
          </span>
        </div>
      ))}
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
  const definition = pages.find((item) => item.key === page) ?? pages[0];
  const content = contentByPage[page];

  return (
    <div className="prototype-a">
      <PrototypeHeader />
      <div className="prototype-a__body">
        <aside className="prototype-a__sidebar">
          <div className="prototype-sidebar-heading">
            <span>经营工作空间</span>
            <strong>粮情研判</strong>
          </div>
          <PageNavigation page={page} onSelect={onSelectPage} />
          <div className="prototype-sidebar-section">
            <small>当前页工作区</small>
            {secondaryNavigation[page].map((item, index) => (
              <button
                className={index === 0 ? "is-active" : undefined}
                key={item}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
          <div className="prototype-sidebar-foot">
            <span className="prototype-live-dot" />
            <span>
              <strong>数据服务正常</strong>
              <small>最近同步 10:46</small>
            </span>
          </div>
        </aside>
        <main className="prototype-a__main">
          <div className="prototype-title-row">
            <div>
              <span className="prototype-eyebrow">{definition.eyebrow}</span>
              <h1>{definition.title}</h1>
              <p>{definition.summary}</p>
            </div>
            <div className="prototype-title-actions">
              <button type="button">查看口径</button>
              <button className="is-primary" type="button">
                进入业务清单
              </button>
            </div>
          </div>
          <ResponsibilityRail page={page} />
          <div className="prototype-section-tabs" aria-label="页面内导航">
            {secondaryNavigation[page].map((item, index) => (
              <button
                className={index === 0 ? "is-active" : undefined}
                key={item}
                type="button"
              >
                {item}
              </button>
            ))}
            <span>{content.period}</span>
          </div>
          <MetricStrip metrics={content.metrics} />
          <div className="prototype-a__workspace">
            <section className="prototype-paper prototype-a__primary">
              <div className="prototype-section-heading">
                <div>
                  <span>01 / 核心作业</span>
                  <h2>
                    {page === "supply" ? "账户勾稽与采用明细" : "本期业务状态"}
                  </h2>
                </div>
                <button type="button">筛选与列设置</button>
              </div>
              <DomainStory page={page} />
              <BusinessTable content={content} />
            </section>
            <aside className="prototype-paper prototype-a__attention">
              <div className="prototype-section-heading">
                <div>
                  <span>02 / 风险处置</span>
                  <h2>需立即处理</h2>
                </div>
                <b>{content.attention.length}</b>
              </div>
              <AttentionList content={content} />
              <div className="prototype-attention-foot">
                <span>只显示影响质量资格和发布的事项</span>
                <button type="button">查看全部</button>
              </div>
            </aside>
          </div>
          <section className="prototype-paper prototype-a__sources">
            <div className="prototype-section-heading">
              <div>
                <span>03 / 采用依据</span>
                <h2>来源、资格与版本</h2>
              </div>
              <small>所有结果保留至规范事实和正式指标版本</small>
            </div>
            <SourceQualification content={content} />
          </section>
        </main>
      </div>
    </div>
  );
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
      {showPrototypeSwitcher && (
        <PrototypeSwitcher
          page={page}
          variant={variant}
          onChange={changeLocation}
        />
      )}
    </div>
  );
}
