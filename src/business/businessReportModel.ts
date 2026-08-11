import {
  approvedBusinessReportDatasets,
  findApprovedBusinessReportDataset,
} from "./data/businessReportDatasets";
import { getEnterpriseScopeRegion } from "./enterpriseRegions";
import { dutyMonthlyRows, dutyWeeklyRows } from "./formalEnterpriseData";
import { platformCultivars, platformProducts } from "./core/platformMasterData";

export type ReportableApplication = "production" | "market" | "supply";
export type BusinessReportFrequency = "日报" | "周报" | "月报";
export type BusinessReportFormat = "PDF" | "Word" | "Excel";
export type BusinessReportDocumentStatus = "内部工作稿" | "正式报告";

export interface BusinessReportRequest {
  reportType:
    | "产情报告"
    | "市场报告"
    | "物流报告"
    | "供需报告"
    | "综合经营报告"
    | "履责报告";
  regionId: string;
  productId: string;
  cultivarId: string | null;
  periodKey: string;
  frequency: "日" | "周" | "月" | "年度" | "专题";
  cutoff: string;
  approvedDatasetId: string;
  sectionKeys: readonly string[];
}

export type QuickReportExportKind =
  | "business-daily"
  | "business-weekly"
  | "business-monthly"
  | "submission-weekly"
  | "submission-monthly";

export interface BusinessReportContext {
  application: ReportableApplication;
  applicationLabel: string;
  businessClassificationId?: string;
  businessClassificationLabel?: string;
  product: string;
  cultivar?: string;
  reportTemplate?: string;
  region: string;
  regionLevel: string;
  period: string;
  frequency?: BusinessReportFrequency;
  dataCutoff: string;
  dataVersion: string;
  dataBatchLabel?: string;
  author: string;
  authorPost: string;
  reviewer: string;
  reviewerPost: string;
  sectionKeys?: readonly string[];
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
  dataCutoffLabel: string;
  adoptedDataLabel: string;
  dataSourceLabel: string;
  hasApprovedIndicators: boolean;
  summary: string;
  chapters: readonly BusinessReportChapter[];
  indicators: readonly BusinessReportIndicator[];
}

export interface BusinessReportArtifact {
  filename: string;
  mimeType: string;
  content: string;
  action: "download" | "print";
  documentStatus: BusinessReportDocumentStatus;
}

interface BusinessReportTemplate {
  chapterTitles: readonly string[];
}

const reportableApplicationLabel: Record<ReportableApplication, string> = {
  production: "产情监测",
  market: "市场监测",
  supply: "供需与态势",
};

const reportTemplates: Record<ReportableApplication, BusinessReportTemplate> = {
  production: {
    chapterTitles: ["种植生产", "区域差异", "需要关注"],
  },
  market: {
    chapterTitles: ["价格与交易", "库存与加工", "物流与风险"],
  },
  supply: {
    chapterTitles: ["供给构成", "使用与流出", "平衡说明"],
  },
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function compactBusinessPeriod(value: string) {
  const trimmed = value.trim();
  const dateMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    return `${year}年${Number(month)}月${Number(day)}日`;
  }
  if (/[年月日周季]/.test(trimmed)) {
    return trimmed.replaceAll(/\s+/g, "");
  }
  return "本期";
}

function formatBusinessDateTime(value: string) {
  const trimmed = value.trim();
  const dateTimeMatch =
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(
      trimmed,
    );
  if (dateTimeMatch) {
    const [, year, month, day, hour, minute] = dateTimeMatch;
    const date = `${year}年${Number(month)}月${Number(day)}日`;
    return hour && minute ? `${date} ${hour.padStart(2, "0")}:${minute}` : date;
  }
  if (/[年月日周]/.test(trimmed)) return trimmed;
  return "截止时间待确认";
}

function safeFilenamePart(value: string, fallback: string) {
  const safeValue = value
    .trim()
    .replaceAll(/\s+/g, "")
    .replaceAll(/[\\/:*?"<>|]/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^[-.]+|[-.]+$/g, "");
  return safeValue || fallback;
}

function reportHtml(
  draft: BusinessReportDraft,
  documentStatus: BusinessReportDocumentStatus,
) {
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
  const indicatorSection = draft.hasApprovedIndicators
    ? `<table><thead><tr><th>指标</th><th>本期值</th><th>说明</th></tr></thead><tbody>${indicators}</tbody></table>`
    : `<p class="empty">当前筛选范围尚无已核定指标</p>`;
  const governanceNotice =
    documentStatus === "正式报告"
      ? "文档性质：正式报告"
      : "文档性质：内部工作稿。未经复核发布，不得作为正式报告使用。";
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(draft.title)}</title><style>body{max-width:900px;margin:40px auto;color:#183746;font:16px/1.8 "Microsoft YaHei",sans-serif}h1{text-align:center;font-size:28px}h2{margin-top:28px;font-size:20px}table{width:100%;border-collapse:collapse}th,td{padding:10px;border:1px solid #ccd7dc;text-align:left}.governance{padding:12px 16px;border:1px solid #b8892d;background:#fff8e7;color:#765716;font-weight:700}.meta{color:#526d7a;font-size:13px}.summary{padding:18px;border-left:4px solid #17847d;background:#f1f7f6}.empty{padding:18px;background:#f6f8f9;color:#526d7a}@media print{body{margin:18mm}.no-print{display:none}}</style></head><body><p class="governance">${escapeHtml(governanceNotice)}</p><h1>${escapeHtml(draft.title)}</h1><p class="meta">业务分类：${escapeHtml(draft.businessClassificationLabel ?? "未选择")} · 具体品种：${escapeHtml(draft.cultivar ?? "未选择")} · 报告模板：${escapeHtml(draft.reportTemplate ?? "未选择")}</p><p class="meta">报告编号：${escapeHtml(draft.reportNumber)} · 数据截止：${escapeHtml(draft.dataCutoffLabel)} · 采用数据：${escapeHtml(draft.adoptedDataLabel)} · 数据来源：${escapeHtml(draft.dataSourceLabel)}</p><p class="summary">${escapeHtml(draft.summary)}</p>${indicatorSection}${chapters}<p class="meta">编制：${escapeHtml(draft.author)} · 审核：${escapeHtml(draft.reviewer)}</p></body></html>`;
}

function reportCsv(
  draft: BusinessReportDraft,
  documentStatus: BusinessReportDocumentStatus,
) {
  const rows = [
    ["文档性质", documentStatus, ""],
    ...(documentStatus === "内部工作稿"
      ? [["使用限制", "未经复核发布，不得作为正式报告使用", ""]]
      : []),
    ["报告名称", draft.title, ""],
    ["报告编号", draft.reportNumber, ""],
    ["业务分类", draft.businessClassificationLabel ?? "未选择", ""],
    ["具体品种", draft.cultivar ?? "未选择", ""],
    ["报告模板", draft.reportTemplate ?? "未选择", ""],
    ["地区范围", draft.region, draft.regionLevel],
    ["数据截止", draft.dataCutoffLabel, ""],
    ["采用数据", draft.adoptedDataLabel, ""],
    ["数据来源", draft.dataSourceLabel, ""],
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
  const template = reportTemplates[context.application];
  const applicationLabel = reportableApplicationLabel[context.application];
  const dataset = findApprovedBusinessReportDataset({
    application: context.application,
    businessClassificationId: context.businessClassificationId ?? "",
    region: context.region,
    product: context.product,
    cultivar: context.cultivar ?? "",
    reportTemplate: context.reportTemplate ?? "",
    period: context.period,
    frequency,
    dataBatchId: context.dataVersion,
  });
  const hasApprovedIndicators = dataset !== null;
  const summary = dataset
    ? context.application === "supply"
      ? `${context.region}按${context.regionLevel}编制。${dataset.summary}`
      : dataset.summary
    : context.application === "supply"
      ? `${context.region}按${context.regionLevel}编制，${context.product}当前筛选范围尚无已核定指标。`
      : `${context.region}${context.product}当前筛选范围尚无已核定指标。`;
  return {
    ...context,
    applicationLabel,
    frequency,
    title: `${context.region}${context.product}${
      context.cultivar && context.cultivar !== "不按具体品种拆分"
        ? context.cultivar
        : ""
    }${applicationLabel}${frequency}`,
    reportNumber: "报告编号待分配",
    dataCutoffLabel: formatBusinessDateTime(context.dataCutoff),
    adoptedDataLabel: dataset?.dataBatchLabel ?? "未采用核定数据",
    dataSourceLabel: dataset?.sourceLabel ?? "当前生成条件未匹配已核定报告数据",
    hasApprovedIndicators,
    summary,
    chapters: template.chapterTitles
      .filter(
        (title) => !context.sectionKeys || context.sectionKeys.includes(title),
      )
      .map((title) => ({
        title,
        body:
          dataset?.chapters.find((chapter) => chapter.title === title)?.body ??
          `${context.region}${context.product}：当前生成条件尚无可用于本章节的已核定数据。`,
      })),
    indicators: dataset?.indicators ?? [],
  };
}

export function createBusinessReportArtifact(
  draft: BusinessReportDraft,
  format: BusinessReportFormat,
  documentStatus: BusinessReportDocumentStatus = "内部工作稿",
): BusinessReportArtifact {
  const region = safeFilenamePart(draft.region, "业务范围待确认");
  const application = safeFilenamePart(
    reportableApplicationLabel[draft.application],
    "业务类型待确认",
  );
  const product = safeFilenamePart(draft.product, "产品待确认");
  const period = safeFilenamePart(
    compactBusinessPeriod(draft.period),
    "期间待确认",
  );
  const baseName = `${region}-${application}-${product}-${draft.frequency}-${period}-${documentStatus}`;
  if (format === "PDF") {
    return {
      filename: `${baseName}.pdf`,
      mimeType: "text/html;charset=utf-8",
      content: reportHtml(draft, documentStatus),
      action: "print",
      documentStatus,
    };
  }
  if (format === "Word") {
    return {
      filename: `${baseName}.doc`,
      mimeType: "application/msword;charset=utf-8",
      content: reportHtml(draft, documentStatus),
      action: "download",
      documentStatus,
    };
  }
  return {
    filename: `${baseName}-数据附件.csv`,
    mimeType: "text/csv;charset=utf-8",
    content: reportCsv(draft, documentStatus),
    action: "download",
    documentStatus,
  };
}

const quickBusinessFrequency: Readonly<
  Record<
    Extract<
      QuickReportExportKind,
      "business-daily" | "business-weekly" | "business-monthly"
    >,
    BusinessReportFrequency
  >
> = {
  "business-daily": "日报",
  "business-weekly": "周报",
  "business-monthly": "月报",
};

const quickBusinessLabel: Readonly<
  Record<BusinessReportRequest["reportType"], string>
> = {
  产情报告: "产情监测",
  市场报告: "市场监测",
  物流报告: "物流监测",
  供需报告: "供需核算",
  综合经营报告: "综合经营",
  履责报告: "履责监督",
};

function encodeCsvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function quickCsv(rows: readonly (readonly string[])[]): string {
  return `\uFEFF${rows
    .map((row) => row.map(encodeCsvCell).join(","))
    .join("\r\n")}`;
}

function requireQuickRequest(request: BusinessReportRequest) {
  if (
    !request.reportType ||
    !request.regionId ||
    !request.productId ||
    !request.periodKey ||
    !request.cutoff ||
    !request.approvedDatasetId ||
    request.sectionKeys.length === 0
  ) {
    throw new Error("一键导出必须明确选择业务、地区、产品、期间和采用数据");
  }
  const region = getEnterpriseScopeRegion(request.regionId);
  const product = platformProducts.find(({ id }) => id === request.productId);
  const cultivar = request.cultivarId
    ? platformCultivars.find(({ id }) => id === request.cultivarId)
    : null;
  if (!region || !product || (request.cultivarId && !cultivar)) {
    throw new Error("一键导出范围不在当前业务主数据中");
  }
  return { region, product, cultivar };
}

export function createQuickReportArtifact(
  request: BusinessReportRequest,
  kind: QuickReportExportKind,
): BusinessReportArtifact {
  const { region, product, cultivar } = requireQuickRequest(request);
  const businessLabel = quickBusinessLabel[request.reportType];
  if (kind.startsWith("business-")) {
    const frequency =
      quickBusinessFrequency[kind as keyof typeof quickBusinessFrequency];
    const requestFrequency = `${request.frequency}报`;
    const dataset = approvedBusinessReportDatasets.find(
      (candidate) =>
        candidate.dataBatchId === request.approvedDatasetId &&
        candidate.region === region.label &&
        candidate.product === product.label &&
        candidate.cultivar === (cultivar?.label ?? "不按具体品种拆分") &&
        candidate.period === request.periodKey &&
        candidate.frequency === frequency &&
        candidate.frequency === requestFrequency,
    );
    if (!dataset) {
      throw new Error(`当前范围没有可用于业务${frequency}的已核定数据`);
    }
    const expectedApplication =
      request.reportType === "产情报告"
        ? "production"
        : request.reportType === "市场报告"
          ? "market"
          : request.reportType === "供需报告"
            ? "supply"
            : null;
    if (!expectedApplication || dataset.application !== expectedApplication) {
      throw new Error(`当前范围没有可用于业务${frequency}的已核定数据`);
    }
    const draft = createBusinessReportDraft(
      {
        application: dataset.application,
        applicationLabel: businessLabel,
        businessClassificationId: dataset.businessClassificationId,
        product: product.label,
        cultivar: cultivar?.label ?? "不按具体品种拆分",
        reportTemplate: dataset.reportTemplate,
        region: region.label,
        regionLevel: region.level,
        period: dataset.period,
        frequency,
        dataCutoff: request.cutoff,
        dataVersion: dataset.dataBatchId,
        dataBatchLabel: dataset.dataBatchLabel,
        author: "当前登录人员",
        authorPost: "业务责任岗位",
        reviewer: "复核人员待指派",
        reviewerPost: "报告复核岗",
      },
      frequency,
    );
    const selectedDraft: BusinessReportDraft = {
      ...draft,
      chapters: draft.chapters.filter(({ title }) =>
        request.sectionKeys.includes(title),
      ),
    };
    return createBusinessReportArtifact(selectedDraft, "Word", "内部工作稿");
  }

  const includeAllQiqihar = request.regionId === "qiqihar-all";
  const weeklyRows = dutyWeeklyRows.filter(
    (row) =>
      (includeAllQiqihar || row.region === region.label) &&
      row.item.includes(product.label) &&
      (request.reportType === "产情报告"
        ? row.item.includes("产情")
        : request.reportType === "市场报告"
          ? row.item.includes("市场")
          : false),
  );
  if (weeklyRows.length === 0) {
    throw new Error("当前业务和地区没有可导出的填报记录");
  }
  if (kind === "submission-weekly") {
    return {
      filename: `${region.label}-${businessLabel}-填报记录周报.csv`,
      mimeType: "text/csv;charset=utf-8",
      content: quickCsv([
        [
          "责任人",
          "责任区域",
          "业务事项",
          "规定截止",
          "首次合格提交",
          "履责状态",
          "逾期时长",
          "审核结果",
        ],
        ...weeklyRows.map((row) => [
          row.person,
          row.region,
          row.item,
          row.deadline,
          row.firstQualifiedSubmission,
          row.status,
          row.overdueDuration,
          row.review,
        ]),
      ]),
      action: "download",
      documentStatus: "内部工作稿",
    };
  }
  const people = new Set(weeklyRows.map(({ person }) => person));
  const monthlyRows = dutyMonthlyRows.filter(({ person }) =>
    people.has(person),
  );
  return {
    filename: `${region.label}-${businessLabel}-填报记录月报.csv`,
    mimeType: "text/csv;charset=utf-8",
    content: quickCsv([
      [
        "责任人",
        "责任区域",
        "应报",
        "按时",
        "逾期",
        "缺报",
        "退回",
        "按时率",
        "趋势",
      ],
      ...monthlyRows.map((row) => [
        row.person,
        row.region,
        row.expected,
        row.onTime,
        row.overdue,
        row.missing,
        row.returned,
        row.onTimeRate,
        row.trend,
      ]),
    ]),
    action: "download",
    documentStatus: "内部工作稿",
  };
}
