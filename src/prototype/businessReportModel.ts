export type ReportableApplication = "production" | "market" | "supply";
export type BusinessReportFrequency = "日报" | "周报" | "月报";
export type BusinessReportFormat = "PDF" | "Word" | "Excel";

export interface BusinessReportContext {
  application: ReportableApplication;
  applicationLabel: string;
  product: string;
  region: string;
  regionLevel: string;
  period: string;
  dataCutoff: string;
  dataVersion: string;
  author: string;
  reviewer: string;
}

export interface BusinessReportChapter {
  title: string;
  body: string;
}

export interface BusinessReportIndicator {
  label: string;
  value: string;
  note: string;
}

export interface BusinessReportDraft extends BusinessReportContext {
  frequency: BusinessReportFrequency;
  title: string;
  reportNumber: string;
  summary: string;
  chapters: readonly BusinessReportChapter[];
  indicators: readonly BusinessReportIndicator[];
}

export interface BusinessReportArtifact {
  filename: string;
  mimeType: string;
  content: string;
  action: "download" | "print";
}

interface BusinessReportCopy {
  summary: Record<BusinessReportFrequency, string>;
  chapters: readonly BusinessReportChapter[];
  indicators: readonly BusinessReportIndicator[];
}

const reportCopy: Record<ReportableApplication, BusinessReportCopy> = {
  production: {
    summary: {
      日报: "截至 7 月 31 日，齐齐哈尔市玉米长势总体处于正常区间。讷河市 4 个农技站的观测资料尚未补齐，拜泉县单产预测较上期上调 8.6%，两项内容在审核完成前不纳入正式发布。",
      周报: "本周齐齐哈尔市玉米监测面积为 1,284.6 万亩，预计单产 468.2 公斤/亩。有效样本 554 个，覆盖 16 个县区；讷河市长势观测缺报和拜泉县单产调整依据仍需复核。",
      月报: "7 月玉米生产监测覆盖齐齐哈尔市 16 个县区，监测面积 1,284.6 万亩。月内长势总体正常，北部县区降水差异对单产预期形成影响，当前预计单产为 468.2 公斤/亩。",
    },
    chapters: [
      {
        title: "种植生产",
        body: "说明面积、长势、生育期、灾情和单产变化。",
      },
      {
        title: "区域差异",
        body: "列明主要县区变化及调查依据。",
      },
      {
        title: "需要关注",
        body: "列明缺报、复核和可能影响产量判断的事项。",
      },
    ],
    indicators: [
      { label: "监测面积", value: "1,284.6 万亩", note: "覆盖 16 个县区" },
      { label: "预计单产", value: "468.2 公斤/亩", note: "本期审核值" },
      { label: "有效样本", value: "554 个", note: "农户与田间样本" },
      { label: "待复核事项", value: "5 项", note: "完成后方可发布" },
    ],
  },
  market: {
    summary: {
      日报: "7 月 31 日齐齐哈尔市玉米主流收购价为 2,346 元/吨，较前一监测日上涨 8 元/吨。北部县区报价差异仍然较大，讷河、克山两地需要继续核实企业到货量和运输成本变化。",
      周报: "本周齐齐哈尔市玉米主流收购价为 2,346 元/吨，较上周上涨 0.8%。北部县区最高与最低报价相差 96 元/吨，价差已超过本月预警线，主要涉及讷河、克山两地。",
      月报: "7 月齐齐哈尔市玉米收购价格先稳后升，月末主流价格为 2,346 元/吨。重点企业库存为 103.9 万吨，较月初下降 2.4%；北部县区价差扩大和铁路外运回落是下月需要持续跟踪的事项。",
    },
    chapters: [
      {
        title: "价格与交易",
        body: "说明主流价格、成交变化和县区价差。",
      },
      {
        title: "库存与加工",
        body: "说明重点企业库存、加工量和异常变化。",
      },
      {
        title: "物流与风险",
        body: "说明公路、铁路流向变化和需要核实的事项。",
      },
    ],
    indicators: [
      { label: "主流收购价", value: "2,346 元/吨", note: "周环比上涨 0.8%" },
      { label: "有效报价主体", value: "86 家", note: "覆盖 12 个县区" },
      { label: "重点企业库存", value: "103.9 万吨", note: "同口径下降 2.4%" },
      { label: "区域最大价差", value: "96 元/吨", note: "超过本月预警线" },
    ],
  },
  supply: {
    summary: {
      日报: "当前账户采用已核定的产情、库存和流向数据。总供给为 763.1 万吨，总使用与外流为 659.2 万吨，采用后期末库存为 103.9 万吨，平衡差额 1.7 万吨仍待解释。",
      周报: "本周供需账户总供给为 763.1 万吨，总使用与外流为 659.2 万吨，采用后期末库存为 103.9 万吨。平衡差额为 1.7 万吨，主要受区域流向资料尚未完成审核影响。",
      月报: "本月供需账户采用已核定的产量、库存、加工和流向数据。总供给 763.1 万吨，总使用与外流 659.2 万吨，期末库存 103.9 万吨；平衡差额 1.7 万吨，需在下次发布前完成说明。",
    },
    chapters: [
      {
        title: "供给构成",
        body: "说明期初库存、产量、调入和进口采用情况。",
      },
      {
        title: "使用与流出",
        body: "说明口粮、饲用、加工、损耗和调出情况。",
      },
      {
        title: "平衡说明",
        body: "说明期末库存、平衡差额和采用数据来源。",
      },
    ],
    indicators: [
      { label: "总供给", value: "763.1 万吨", note: "期初库存、产量和净调入" },
      {
        label: "总使用与外流",
        value: "659.2 万吨",
        note: "消费、加工和净调出",
      },
      { label: "期末库存", value: "103.9 万吨", note: "下一期初库存来源" },
      { label: "平衡差额", value: "1.7 万吨", note: "发布前需要完成说明" },
    ],
  },
};

const frequencyCode: Record<BusinessReportFrequency, string> = {
  日报: "D",
  周报: "W",
  月报: "M",
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function reportHtml(draft: BusinessReportDraft) {
  const indicators = draft.indicators
    .map(
      (indicator) =>
        `<tr><td>${escapeHtml(indicator.label)}</td><td>${escapeHtml(indicator.value)}</td><td>${escapeHtml(indicator.note)}</td></tr>`,
    )
    .join("");
  const chapters = draft.chapters
    .map(
      (chapter) =>
        `<section><h2>${escapeHtml(chapter.title)}</h2><p>${escapeHtml(chapter.body)}</p></section>`,
    )
    .join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(draft.title)}</title><style>body{max-width:900px;margin:40px auto;color:#183746;font:16px/1.8 "Microsoft YaHei",sans-serif}h1{text-align:center;font-size:28px}h2{margin-top:28px;font-size:20px}table{width:100%;border-collapse:collapse}th,td{padding:10px;border:1px solid #ccd7dc;text-align:left}.meta{color:#526d7a;font-size:13px}.summary{padding:18px;border-left:4px solid #17847d;background:#f1f7f6}@media print{body{margin:18mm}.no-print{display:none}}</style></head><body><h1>${escapeHtml(draft.title)}</h1><p class="meta">报告编号：${escapeHtml(draft.reportNumber)} · 数据截止：${escapeHtml(draft.dataCutoff)} · 采用数据：${escapeHtml(draft.dataVersion)}</p><p class="summary">${escapeHtml(draft.summary)}</p><table><thead><tr><th>指标</th><th>本期值</th><th>说明</th></tr></thead><tbody>${indicators}</tbody></table>${chapters}<p class="meta">编制：${escapeHtml(draft.author)} · 审核：${escapeHtml(draft.reviewer)}</p></body></html>`;
}

function reportCsv(draft: BusinessReportDraft) {
  const rows = [
    ["报告名称", draft.title, ""],
    ["报告编号", draft.reportNumber, ""],
    ["地区范围", draft.region, draft.regionLevel],
    ["数据截止", draft.dataCutoff, ""],
    ["采用数据", draft.dataVersion, ""],
    ["指标", "本期值", "说明"],
    ...draft.indicators.map((indicator) => [
      indicator.label,
      indicator.value,
      indicator.note,
    ]),
  ];
  const encode = (value: string) =>
    /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  return `\uFEFF${rows.map((row) => row.map(encode).join(",")).join("\r\n")}`;
}

export function createBusinessReportDraft(
  context: BusinessReportContext,
  frequency: BusinessReportFrequency,
): BusinessReportDraft {
  const copy = reportCopy[context.application];
  const scopeStatement =
    context.application === "supply"
      ? `${context.region}按${context.regionLevel}编制。`
      : "";
  return {
    ...context,
    frequency,
    title: `${context.region}${context.product}${context.applicationLabel}${frequency}`,
    reportNumber: `QQHE-${context.application.toUpperCase()}-${frequencyCode[frequency]}-20260731`,
    summary: `${scopeStatement}${copy.summary[frequency]}`,
    chapters: copy.chapters,
    indicators: copy.indicators,
  };
}

export function createBusinessReportArtifact(
  draft: BusinessReportDraft,
  format: BusinessReportFormat,
): BusinessReportArtifact {
  const period = draft.period.replaceAll(/\s+/g, "");
  const baseName = `齐齐哈尔经营部-${draft.applicationLabel}-${draft.product}-${draft.frequency}-${period}-V1.0`;
  if (format === "PDF") {
    return {
      filename: `${baseName}.pdf`,
      mimeType: "text/html;charset=utf-8",
      content: reportHtml(draft),
      action: "print",
    };
  }
  if (format === "Word") {
    return {
      filename: `${baseName}.doc`,
      mimeType: "application/msword;charset=utf-8",
      content: reportHtml(draft),
      action: "download",
    };
  }
  return {
    filename: `${baseName}-数据附件.csv`,
    mimeType: "text/csv;charset=utf-8",
    content: reportCsv(draft),
    action: "download",
  };
}
