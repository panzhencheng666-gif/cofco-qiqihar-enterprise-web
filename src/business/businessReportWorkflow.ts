import type {
  BusinessReportFrequency,
  ReportableApplication,
} from "./businessReportModel";

export type BusinessReportWorkflowStatus =
  "草稿" | "待复核" | "退回修改" | "待发布" | "已发布" | "已替代";

export type BusinessReportWorkflowAction =
  "提交复核" | "复核通过" | "退回修改" | "发布报告" | "确认替代";

const businessReportWorkflowStatuses = new Set<BusinessReportWorkflowStatus>([
  "草稿",
  "待复核",
  "退回修改",
  "待发布",
  "已发布",
  "已替代",
]);

function isBusinessReportWorkflowStatus(
  value: unknown,
): value is BusinessReportWorkflowStatus {
  return (
    typeof value === "string" &&
    businessReportWorkflowStatuses.has(value as BusinessReportWorkflowStatus)
  );
}

const reportableApplications = new Set<ReportableApplication>([
  "production",
  "market",
  "supply",
]);

function isReportableApplication(
  value: unknown,
): value is ReportableApplication {
  return (
    typeof value === "string" &&
    reportableApplications.has(value as ReportableApplication)
  );
}

const businessReportFrequencies = new Set<BusinessReportFrequency>([
  "日报",
  "周报",
  "月报",
]);

function isBusinessReportFrequency(
  value: unknown,
): value is BusinessReportFrequency {
  return (
    typeof value === "string" &&
    businessReportFrequencies.has(value as BusinessReportFrequency)
  );
}

export type BusinessReportPermissionKey =
  | "report.draft.save"
  | "report.review.submit"
  | "report.review.approve"
  | "report.review.return"
  | "report.publish.confirm"
  | "report.revision.create"
  | "report.replacement.confirm"
  | "report.audit.read"
  | "report.export";

export interface BusinessReportScopeSnapshot {
  application: ReportableApplication;
  businessClassificationId: string;
  businessClassificationLabel: string;
  region: string;
  product: string;
  cultivar: string;
  reportTemplate: string;
  period: string;
  frequency: BusinessReportFrequency;
  dataCutoff: string;
  dataBatchId: string;
}

export interface BusinessReportAuditEvent {
  id: string;
  action:
    | "创建草稿"
    | "保存草稿"
    | "提交复核"
    | "复核通过"
    | "退回修改"
    | "发布报告"
    | "创建修订草稿"
    | "确认替代"
    | "建立替代关系";
  fromStatus: BusinessReportWorkflowStatus | null;
  toStatus: BusinessReportWorkflowStatus;
  actorPost: string;
  occurredAt: number;
  reason?: string;
}

const businessReportAuditActions = new Set<BusinessReportAuditEvent["action"]>([
  "创建草稿",
  "保存草稿",
  "提交复核",
  "复核通过",
  "退回修改",
  "发布报告",
  "创建修订草稿",
  "确认替代",
  "建立替代关系",
]);

function isBusinessReportAuditAction(
  value: unknown,
): value is BusinessReportAuditEvent["action"] {
  return (
    typeof value === "string" &&
    businessReportAuditActions.has(value as BusinessReportAuditEvent["action"])
  );
}

function expectedHandlerPost(
  report: Pick<
    BusinessReportRecord,
    "status" | "authorPost" | "reviewerPost" | "publisherPost"
  >,
) {
  if (report.status === "草稿" || report.status === "退回修改") {
    return report.authorPost;
  }
  if (report.status === "待复核") return report.reviewerPost;
  if (report.status === "待发布") return report.publisherPost;
  return "报告档案岗";
}

export interface BusinessReportRecord {
  id: string;
  title: string;
  summary: string;
  scope: Readonly<BusinessReportScopeSnapshot>;
  dataBatchLabel: string;
  dataSourceLabel: string;
  status: BusinessReportWorkflowStatus;
  currentHandlerPost: string;
  authorPost: string;
  reviewerPost: string;
  publisherPost: string;
  createdAt: number;
  updatedAt: number;
  revisionOfReportId?: string;
  replacesReportId?: string;
  replacedByReportId?: string;
  auditTrail: readonly BusinessReportAuditEvent[];
}

export interface BusinessReportDraftInput {
  title: string;
  summary: string;
  scope: BusinessReportScopeSnapshot;
  dataBatchLabel: string;
  dataSourceLabel: string;
  authorPost: string;
  reviewerPost: string;
  publisherPost: string;
}

export interface BusinessReportRepository {
  load(): readonly BusinessReportRecord[];
  save(reports: readonly BusinessReportRecord[]): void;
}

export interface BusinessReportStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const fixtureBusinessReportStorageKey =
  "齐齐哈尔粮食商情业务报告工作流-业务真值三";

export type BusinessReportWorkflowResult =
  { ok: true; report: BusinessReportRecord } | { ok: false; reason: string };

interface BusinessReportWorkflowDependencies {
  now?: () => number;
  createId?: () => string;
  initializationError?: string;
}

function freezeAuditEvent(
  event: BusinessReportAuditEvent,
): BusinessReportAuditEvent {
  return Object.freeze({ ...event });
}

function freezeReport(report: BusinessReportRecord): BusinessReportRecord {
  return Object.freeze({
    ...report,
    scope: Object.freeze({ ...report.scope }),
    auditTrail: Object.freeze(report.auditTrail.map(freezeAuditEvent)),
  });
}

function freezeReports(
  reports: readonly BusinessReportRecord[],
): readonly BusinessReportRecord[] {
  return Object.freeze(reports.map(freezeReport));
}

function assertStoredReports(value: unknown): readonly BusinessReportRecord[] {
  if (!Array.isArray(value)) {
    throw new Error("报告工作流存储内容无法识别，请联系系统管理员处理。");
  }
  for (const report of value) {
    if (typeof report !== "object" || report === null) {
      throw new Error("报告工作流存储内容不完整，请联系系统管理员处理。");
    }
    const candidate = report as Partial<BusinessReportRecord>;
    const scope = candidate.scope as
      Partial<BusinessReportScopeSnapshot> | undefined;
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.title !== "string" ||
      typeof candidate.summary !== "string" ||
      typeof candidate.status !== "string" ||
      typeof candidate.currentHandlerPost !== "string" ||
      typeof candidate.authorPost !== "string" ||
      typeof candidate.reviewerPost !== "string" ||
      typeof candidate.publisherPost !== "string" ||
      typeof candidate.createdAt !== "number" ||
      typeof candidate.updatedAt !== "number" ||
      typeof candidate.dataBatchLabel !== "string" ||
      typeof candidate.dataSourceLabel !== "string" ||
      typeof scope !== "object" ||
      scope === null ||
      typeof scope.application !== "string" ||
      typeof scope.businessClassificationId !== "string" ||
      typeof scope.businessClassificationLabel !== "string" ||
      typeof scope.region !== "string" ||
      typeof scope.product !== "string" ||
      typeof scope.cultivar !== "string" ||
      typeof scope.reportTemplate !== "string" ||
      typeof scope.period !== "string" ||
      typeof scope.frequency !== "string" ||
      typeof scope.dataCutoff !== "string" ||
      typeof scope.dataBatchId !== "string" ||
      !Array.isArray(candidate.auditTrail) ||
      candidate.auditTrail.some((event: unknown) => {
        if (typeof event !== "object" || event === null) return true;
        const auditEvent = event as Partial<BusinessReportAuditEvent>;
        return (
          typeof auditEvent.id !== "string" ||
          typeof auditEvent.action !== "string" ||
          typeof auditEvent.toStatus !== "string" ||
          typeof auditEvent.actorPost !== "string" ||
          typeof auditEvent.occurredAt !== "number"
        );
      })
    ) {
      throw new Error("报告工作流存储内容不完整，请联系系统管理员处理。");
    }
    if (!isBusinessReportWorkflowStatus(candidate.status)) {
      throw new Error(
        "报告工作流存储内容包含无法识别的报告状态，请联系系统管理员处理。",
      );
    }
    if (!isReportableApplication(scope.application)) {
      throw new Error(
        "报告工作流存储内容包含无法识别的业务应用，请联系系统管理员处理。",
      );
    }
    if (!isBusinessReportFrequency(scope.frequency)) {
      throw new Error(
        "报告工作流存储内容包含无法识别的报告周期，请联系系统管理员处理。",
      );
    }
    const auditTrail =
      candidate.auditTrail as readonly Partial<BusinessReportAuditEvent>[];
    if (
      auditTrail.some((event) => !isBusinessReportAuditAction(event.action))
    ) {
      throw new Error(
        "报告工作流存储内容包含无法识别的审计动作，请联系系统管理员处理。",
      );
    }
    if (
      auditTrail.some(
        (event) =>
          !isBusinessReportWorkflowStatus(event.toStatus) ||
          (event.fromStatus !== null &&
            !isBusinessReportWorkflowStatus(event.fromStatus)),
      )
    ) {
      throw new Error(
        "报告工作流存储内容包含无法识别的审计状态，请联系系统管理员处理。",
      );
    }
    if (
      candidate.currentHandlerPost !==
      expectedHandlerPost(candidate as BusinessReportRecord)
    ) {
      throw new Error(
        "报告工作流存储内容中的报告状态与当前处理岗位不一致，请联系系统管理员处理。",
      );
    }
    const finalAuditEvent = auditTrail.at(-1);
    if (
      finalAuditEvent === undefined ||
      !isBusinessReportWorkflowStatus(finalAuditEvent.toStatus) ||
      finalAuditEvent.toStatus !== candidate.status
    ) {
      throw new Error(
        "报告工作流存储内容中的报告状态与审计轨迹不一致，请联系系统管理员处理。",
      );
    }
  }
  return freezeReports(value as BusinessReportRecord[]);
}

export function createMemoryBusinessReportRepository(
  initialReports: readonly BusinessReportRecord[] = [],
): BusinessReportRepository {
  let storedReports = freezeReports(initialReports);
  return {
    load: () => storedReports,
    save: (reports) => {
      storedReports = freezeReports(reports);
    },
  };
}

function readStoredBusinessReports(
  value: string,
): readonly BusinessReportRecord[] {
  try {
    return assertStoredReports(JSON.parse(value) as unknown);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("报告工作流存储内容无法读取，请联系系统管理员处理。", {
        cause: error,
      });
    }
    throw error;
  }
}

export function createLocalStorageBusinessReportRepository(
  storage: BusinessReportStorage,
  storageKey = fixtureBusinessReportStorageKey,
): BusinessReportRepository {
  return {
    load: () => {
      const value = storage.getItem(storageKey);
      if (value === null) return Object.freeze([]);
      return readStoredBusinessReports(value);
    },
    save: (reports) => storage.setItem(storageKey, JSON.stringify(reports)),
  };
}

function defaultCreateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `报告-${String(Date.now())}-${Math.random().toString(36).slice(2)}`;
}

function missingDraftField(input: BusinessReportDraftInput) {
  const fields: readonly [label: string, value: string][] = [
    ["报告名称", input.title],
    ["地区", input.scope.region],
    ["业务分类", input.scope.businessClassificationId],
    ["产品", input.scope.product],
    ["具体品种", input.scope.cultivar],
    ["报告模板", input.scope.reportTemplate],
    ["报告期间", input.scope.period],
    ["数据截止时间", input.scope.dataCutoff],
    ["数据批次", input.scope.dataBatchId],
    ["编制岗位", input.authorPost],
    ["复核岗位", input.reviewerPost],
    ["发布岗位", input.publisherPost],
  ];
  return fields.find(([, value]) => value.trim().length === 0)?.[0];
}

function invalidStatusReason(
  report: BusinessReportRecord,
  action: BusinessReportWorkflowAction,
) {
  if (action === "发布报告" && report.status === "草稿") {
    return "当前报告仍为草稿，须先提交复核并通过后才能发布。";
  }
  return `当前报告状态为“${report.status}”，不能执行“${action}”。`;
}

export class BusinessReportWorkflow {
  private reports: readonly BusinessReportRecord[];
  private readonly listeners = new Set<() => void>();
  private readonly now: () => number;
  private readonly createId: () => string;
  private readonly initializationError: string | null;

  constructor(
    private readonly repository: BusinessReportRepository,
    dependencies: BusinessReportWorkflowDependencies = {},
  ) {
    this.now = dependencies.now ?? Date.now;
    this.createId = dependencies.createId ?? defaultCreateId;
    this.initializationError = dependencies.initializationError ?? null;
    this.reports = freezeReports(repository.load());
  }

  getSnapshot = () => this.reports;

  getInitializationError = () => this.initializationError;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private persist(reports: readonly BusinessReportRecord[]) {
    const nextReports = freezeReports(reports);
    this.repository.save(nextReports);
    this.reports = nextReports;
    this.listeners.forEach((listener) => listener());
  }

  private event(
    action: BusinessReportAuditEvent["action"],
    fromStatus: BusinessReportWorkflowStatus | null,
    toStatus: BusinessReportWorkflowStatus,
    actorPost: string,
    reason?: string,
  ): BusinessReportAuditEvent {
    return freezeAuditEvent({
      id: this.createId(),
      action,
      fromStatus,
      toStatus,
      actorPost,
      occurredAt: this.now(),
      ...(reason ? { reason } : {}),
    });
  }

  private replaceReport(nextReport: BusinessReportRecord) {
    this.persist(
      this.reports.map((report) =>
        report.id === nextReport.id ? nextReport : report,
      ),
    );
  }

  createDraft(input: BusinessReportDraftInput): BusinessReportRecord {
    const missingField = missingDraftField(input);
    if (missingField) throw new Error(`${missingField}不能为空。`);
    const createdAt = this.now();
    const record = freezeReport({
      id: this.createId(),
      title: input.title,
      summary: input.summary,
      scope: Object.freeze({ ...input.scope }),
      dataBatchLabel: input.dataBatchLabel,
      dataSourceLabel: input.dataSourceLabel,
      status: "草稿",
      currentHandlerPost: input.authorPost,
      authorPost: input.authorPost,
      reviewerPost: input.reviewerPost,
      publisherPost: input.publisherPost,
      createdAt,
      updatedAt: createdAt,
      auditTrail: [this.event("创建草稿", null, "草稿", input.authorPost)],
    });
    this.persist([...this.reports, record]);
    return record;
  }

  saveDraft(
    reportId: string,
    input: { actorPost: string; summary: string },
  ): BusinessReportWorkflowResult {
    const report = this.reports.find(({ id }) => id === reportId);
    if (!report) return { ok: false, reason: "未找到需要保存的业务报告。" };
    if (report.status !== "草稿" && report.status !== "退回修改") {
      return {
        ok: false,
        reason: `当前报告状态为“${report.status}”，不能保存为草稿。`,
      };
    }
    if (input.actorPost !== report.currentHandlerPost) {
      return {
        ok: false,
        reason: `当前应由“${report.currentHandlerPost}”处理，不能由“${input.actorPost}”保存。`,
      };
    }
    const nextStatus: BusinessReportWorkflowStatus = "草稿";
    const next = freezeReport({
      ...report,
      summary: input.summary,
      status: nextStatus,
      currentHandlerPost: report.authorPost,
      updatedAt: this.now(),
      auditTrail: [
        ...report.auditTrail,
        this.event("保存草稿", report.status, nextStatus, input.actorPost),
      ],
    });
    this.replaceReport(next);
    return { ok: true, report: next };
  }

  createRevision(
    reportId: string,
    input: { actorPost: string; reason: string },
  ): BusinessReportWorkflowResult {
    const source = this.reports.find(({ id }) => id === reportId);
    if (!source) return { ok: false, reason: "未找到需要修订的正式报告。" };
    if (source.status !== "已发布") {
      return { ok: false, reason: "只有已发布报告可以创建修订草稿。" };
    }
    if (input.actorPost !== source.authorPost) {
      return {
        ok: false,
        reason: `修订草稿应由“${source.authorPost}”创建。`,
      };
    }
    if (!input.reason.trim()) {
      return { ok: false, reason: "创建修订草稿前必须说明修订原因。" };
    }
    const createdAt = this.now();
    const revision = freezeReport({
      ...source,
      id: this.createId(),
      title: `${source.title}修订稿`,
      status: "草稿",
      currentHandlerPost: source.authorPost,
      createdAt,
      updatedAt: createdAt,
      revisionOfReportId: source.id,
      replacesReportId: undefined,
      replacedByReportId: undefined,
      auditTrail: [
        this.event(
          "创建修订草稿",
          null,
          "草稿",
          input.actorPost,
          input.reason.trim(),
        ),
      ],
    });
    this.persist([...this.reports, revision]);
    return { ok: true, report: revision };
  }

  transition(
    reportId: string,
    input: {
      action: BusinessReportWorkflowAction;
      actorPost: string;
      reason?: string;
      relatedReportId?: string;
    },
  ): BusinessReportWorkflowResult {
    const report = this.reports.find(({ id }) => id === reportId);
    if (!report) return { ok: false, reason: "未找到需要处理的业务报告。" };

    if (input.action === "确认替代") {
      return this.replacePublishedReport(report, input);
    }

    const transitionRules: Record<
      Exclude<BusinessReportWorkflowAction, "确认替代">,
      {
        from: BusinessReportWorkflowStatus;
        to: BusinessReportWorkflowStatus;
        nextPost: (report: BusinessReportRecord) => string;
      }
    > = {
      提交复核: {
        from: "草稿",
        to: "待复核",
        nextPost: ({ reviewerPost }) => reviewerPost,
      },
      复核通过: {
        from: "待复核",
        to: "待发布",
        nextPost: ({ publisherPost }) => publisherPost,
      },
      退回修改: {
        from: "待复核",
        to: "退回修改",
        nextPost: ({ authorPost }) => authorPost,
      },
      发布报告: {
        from: "待发布",
        to: "已发布",
        nextPost: () => "报告档案岗",
      },
    };
    const rule = transitionRules[input.action];
    if (report.status !== rule.from) {
      return { ok: false, reason: invalidStatusReason(report, input.action) };
    }
    if (input.actorPost !== report.currentHandlerPost) {
      return {
        ok: false,
        reason: `当前应由“${report.currentHandlerPost}”处理，不能由“${input.actorPost}”执行“${input.action}”。`,
      };
    }
    if (input.action === "退回修改" && !input.reason?.trim()) {
      return { ok: false, reason: "退回报告前必须填写具体业务原因。" };
    }

    const next = freezeReport({
      ...report,
      status: rule.to,
      currentHandlerPost: rule.nextPost(report),
      updatedAt: this.now(),
      auditTrail: [
        ...report.auditTrail,
        this.event(
          input.action,
          report.status,
          rule.to,
          input.actorPost,
          input.reason?.trim(),
        ),
      ],
    });
    this.replaceReport(next);
    return { ok: true, report: next };
  }

  private replacePublishedReport(
    report: BusinessReportRecord,
    input: {
      actorPost: string;
      reason?: string;
      relatedReportId?: string;
    },
  ): BusinessReportWorkflowResult {
    if (report.status !== "已发布") {
      return { ok: false, reason: "只有已发布报告可以确认替代关系。" };
    }
    if (input.actorPost !== report.publisherPost) {
      return {
        ok: false,
        reason: `替代关系应由“${report.publisherPost}”确认。`,
      };
    }
    if (!input.reason?.trim()) {
      return { ok: false, reason: "确认替代前必须填写替代原因。" };
    }
    const replacement = this.reports.find(
      ({ id }) => id === input.relatedReportId,
    );
    if (!replacement) {
      return { ok: false, reason: "未找到用于替代原报告的修订报告。" };
    }
    if (
      replacement.status !== "已发布" ||
      replacement.revisionOfReportId !== report.id
    ) {
      return {
        ok: false,
        reason: "修订报告尚未完成复核发布，不能建立替代关系。",
      };
    }

    const occurredAt = this.now();
    const reason = input.reason.trim();
    const replaced = freezeReport({
      ...report,
      status: "已替代",
      currentHandlerPost: "报告档案岗",
      updatedAt: occurredAt,
      replacedByReportId: replacement.id,
      auditTrail: [
        ...report.auditTrail,
        this.event(
          "确认替代",
          report.status,
          "已替代",
          input.actorPost,
          reason,
        ),
      ],
    });
    const replacementWithRelation = freezeReport({
      ...replacement,
      replacesReportId: report.id,
      updatedAt: occurredAt,
      auditTrail: [
        ...replacement.auditTrail,
        this.event(
          "建立替代关系",
          replacement.status,
          replacement.status,
          input.actorPost,
          reason,
        ),
      ],
    });
    this.persist(
      this.reports.map((current) =>
        current.id === replaced.id
          ? replaced
          : current.id === replacementWithRelation.id
            ? replacementWithRelation
            : current,
      ),
    );
    return { ok: true, report: replaced };
  }
}

function seedAuditTrail(
  reportId: string,
  status: BusinessReportWorkflowStatus,
  authorPost: string,
  reviewerPost: string,
  publisherPost: string,
  occurredAt: number,
): readonly BusinessReportAuditEvent[] {
  const events: BusinessReportAuditEvent[] = [
    {
      id: `${reportId}-创建`,
      action: "创建草稿",
      fromStatus: null,
      toStatus: "草稿",
      actorPost: authorPost,
      occurredAt,
    },
  ];
  if (status === "草稿") return events;
  events.push({
    id: `${reportId}-送审`,
    action: "提交复核",
    fromStatus: "草稿",
    toStatus: "待复核",
    actorPost: authorPost,
    occurredAt: occurredAt + 60_000,
  });
  if (status === "待复核") return events;
  events.push({
    id: `${reportId}-通过`,
    action: "复核通过",
    fromStatus: "待复核",
    toStatus: "待发布",
    actorPost: reviewerPost,
    occurredAt: occurredAt + 120_000,
  });
  if (status === "待发布") return events;
  events.push({
    id: `${reportId}-发布`,
    action: "发布报告",
    fromStatus: "待发布",
    toStatus: "已发布",
    actorPost: publisherPost,
    occurredAt: occurredAt + 180_000,
  });
  return events;
}

function fixtureReportSeed({
  id,
  title,
  summary,
  scope,
  dataBatchLabel,
  dataSourceLabel,
  status,
  authorPost,
  reviewerPost = "报告复核岗",
  publisherPost = "报告发布岗",
  createdAt,
}: Omit<
  BusinessReportRecord,
  | "currentHandlerPost"
  | "updatedAt"
  | "auditTrail"
  | "revisionOfReportId"
  | "replacesReportId"
  | "replacedByReportId"
  | "reviewerPost"
  | "publisherPost"
> & {
  reviewerPost?: string;
  publisherPost?: string;
}): BusinessReportRecord {
  const currentHandlerPost =
    status === "草稿" || status === "退回修改"
      ? authorPost
      : status === "待复核"
        ? reviewerPost
        : status === "待发布"
          ? publisherPost
          : "报告档案岗";
  const auditTrail = seedAuditTrail(
    id,
    status,
    authorPost,
    reviewerPost,
    publisherPost,
    createdAt,
  );
  return freezeReport({
    id,
    title,
    summary,
    scope,
    dataBatchLabel,
    dataSourceLabel,
    status,
    currentHandlerPost,
    authorPost,
    reviewerPost,
    publisherPost,
    createdAt,
    updatedAt: auditTrail.at(-1)?.occurredAt ?? createdAt,
    auditTrail,
  });
}

export interface BusinessReportWorkItemResolution {
  workItemId: string;
  target: "review" | "distribution";
  report: BusinessReportRecord;
}

const businessReportWorkItemMappings = Object.freeze([
  Object.freeze({
    workItemId: "WORK-REPORT-REVIEW-W31",
    reportId: "初始报告-第31周粮食商情周报",
    target: "distribution" as const,
    scope: Object.freeze({
      application: "production" as const,
      businessClassificationId: "reporting.production",
      region: "齐齐哈尔市全域",
      product: "综合粮食品种",
      cultivar: "不按具体品种拆分",
      reportTemplate: "粮食商情周报",
      period: "2026年第31周",
      frequency: "周报" as const,
      dataBatchId: "第31周粮食商情周报核定批次",
    }),
  }),
]);

export function resolveBusinessReportWorkItem(
  workItemId: string,
  reports: readonly BusinessReportRecord[],
): BusinessReportWorkItemResolution | null {
  const mapping = businessReportWorkItemMappings.find(
    (item) => item.workItemId === workItemId,
  );
  if (!mapping) return null;
  const report = reports.find(({ id }) => id === mapping.reportId);
  if (!report) return null;
  const scopeMatches = Object.entries(mapping.scope).every(
    ([key, value]) =>
      report.scope[key as keyof BusinessReportScopeSnapshot] === value,
  );
  if (!scopeMatches) return null;
  return Object.freeze({
    workItemId: mapping.workItemId,
    target: mapping.target,
    report,
  });
}

export function createFixtureBusinessReportSeeds(): readonly BusinessReportRecord[] {
  return freezeReports([
    fixtureReportSeed({
      id: "初始报告-第31周粮食商情周报",
      title: "第31周粮食商情周报",
      summary: "第31周粮食商情周报已经完成复核，等待报告发布岗确认发布。",
      scope: {
        application: "production",
        businessClassificationId: "reporting.production",
        businessClassificationLabel: "产情报告",
        region: "齐齐哈尔市全域",
        product: "综合粮食品种",
        cultivar: "不按具体品种拆分",
        reportTemplate: "粮食商情周报",
        period: "2026年第31周",
        frequency: "周报",
        dataCutoff: "2026-08-01 11:20",
        dataBatchId: "第31周粮食商情周报核定批次",
      },
      dataBatchLabel: "2026年第31周粮食商情周报核定数据",
      dataSourceLabel: "2026年第31周粮食商情周报复核通过稿",
      status: "待发布",
      authorPost: "报告编制员",
      createdAt: new Date(2026, 7, 1, 10, 30).getTime(),
    }),
    fixtureReportSeed({
      id: "初始报告-供需待复核",
      title: "齐齐哈尔玉米供需账户复核月报",
      summary: "供需账户月报已提交，等待报告复核岗处理。",
      scope: {
        application: "supply",
        businessClassificationId: "supply.results",
        businessClassificationLabel: "结果",
        region: "齐齐哈尔市全域",
        product: "玉米",
        cultivar: "不按具体品种拆分",
        reportTemplate: "供需平衡分析报告",
        period: "2026/27营销年度",
        frequency: "月报",
        dataCutoff: "2026-07-31 17:00",
        dataBatchId: "SUPPLY-2026-MY-APPROVED",
      },
      dataBatchLabel: "2026/27营销年度供需已核定数据",
      dataSourceLabel: "2026/27营销年度市级供需已核定账户",
      status: "待复核",
      authorPost: "供需分析岗",
      createdAt: new Date(2026, 6, 31, 16, 20).getTime(),
    }),
    fixtureReportSeed({
      id: "初始报告-供需草稿",
      title: "齐齐哈尔玉米供需账户编制月报",
      summary: "供需账户月报草稿已保存，等待编制岗位提交复核。",
      scope: {
        application: "supply",
        businessClassificationId: "supply.results",
        businessClassificationLabel: "结果",
        region: "齐齐哈尔市全域",
        product: "玉米",
        cultivar: "不按具体品种拆分",
        reportTemplate: "供需平衡分析报告",
        period: "2026/27营销年度",
        frequency: "月报",
        dataCutoff: "2026-07-31 17:00",
        dataBatchId: "SUPPLY-2026-MY-APPROVED",
      },
      dataBatchLabel: "2026/27营销年度供需已核定数据",
      dataSourceLabel: "2026/27营销年度市级供需已核定账户",
      status: "草稿",
      authorPost: "供需分析岗",
      createdAt: new Date(2026, 6, 31, 17, 5).getTime(),
    }),
    fixtureReportSeed({
      id: "初始报告-经营月报",
      title: "齐齐哈尔粮食商情月报",
      summary: "7月粮食商情月报已经完成复核并正式发布。",
      scope: {
        application: "market",
        businessClassificationId: "reporting.cross-business",
        businessClassificationLabel: "跨业务报告",
        region: "齐齐哈尔市全域",
        product: "综合粮食品种",
        cultivar: "不按具体品种拆分",
        reportTemplate: "粮食商情经营月报",
        period: "2026年7月",
        frequency: "月报",
        dataCutoff: "2026-07-31 17:00",
        dataBatchId: "7月经营汇总已核定数据",
      },
      dataBatchLabel: "2026年7月经营汇总已核定数据",
      dataSourceLabel: "2026年7月粮食商情经营汇总",
      status: "已发布",
      authorPost: "经营分析岗",
      createdAt: new Date(2026, 6, 30, 15, 10).getTime(),
    }),
    fixtureReportSeed({
      id: "初始报告-供需月报",
      title: "玉米供需账户分析月报",
      summary: "供需账户月报已复核通过，等待报告发布岗确认发布。",
      scope: {
        application: "supply",
        businessClassificationId: "supply.results",
        businessClassificationLabel: "结果",
        region: "齐齐哈尔市全域",
        product: "玉米",
        cultivar: "不按具体品种拆分",
        reportTemplate: "供需平衡分析报告",
        period: "2026/27营销年度",
        frequency: "月报",
        dataCutoff: "2026-07-31 17:00",
        dataBatchId: "SUPPLY-2026-MY-APPROVED",
      },
      dataBatchLabel: "2026/27营销年度供需已核定数据",
      dataSourceLabel: "2026/27营销年度市级供需已核定账户",
      status: "待发布",
      authorPost: "供需分析岗",
      createdAt: new Date(2026, 6, 31, 17, 20).getTime(),
    }),
  ]);
}

export function createFixtureBusinessReportWorkflow(
  storage?: BusinessReportStorage,
): BusinessReportWorkflow {
  if (!storage) {
    return new BusinessReportWorkflow(
      createMemoryBusinessReportRepository(createFixtureBusinessReportSeeds()),
    );
  }
  try {
    const storedValue = storage.getItem(fixtureBusinessReportStorageKey);
    const initialReports =
      storedValue === null
        ? createFixtureBusinessReportSeeds()
        : readStoredBusinessReports(storedValue);
    const repository = createLocalStorageBusinessReportRepository(storage);
    if (storedValue === null) repository.save(initialReports);
    let firstLoad = true;
    const preloadedRepository: BusinessReportRepository = {
      load: () => {
        if (!firstLoad) return repository.load();
        firstLoad = false;
        return initialReports;
      },
      save: (reports) => repository.save(reports),
    };
    return new BusinessReportWorkflow(preloadedRepository);
  } catch (error) {
    const reason =
      error instanceof Error && error.message.startsWith("报告工作流")
        ? error.message.replace("，请联系系统管理员处理。", "")
        : "报告工作流存储暂时无法访问";
    return new BusinessReportWorkflow(createMemoryBusinessReportRepository(), {
      initializationError: `${reason}。原始内容已保留，未写入预置数据；请联系系统管理员恢复。`,
    });
  }
}

export function createEmptyBusinessReportWorkflow(): BusinessReportWorkflow {
  return new BusinessReportWorkflow(createMemoryBusinessReportRepository());
}

let fallbackFixtureWorkflow: BusinessReportWorkflow | null = null;

export function getFallbackFixtureBusinessReportWorkflow() {
  if (!fallbackFixtureWorkflow) {
    const storage =
      typeof window === "undefined" ? undefined : window.localStorage;
    fallbackFixtureWorkflow = createFixtureBusinessReportWorkflow(storage);
  }
  return fallbackFixtureWorkflow;
}
