import { useState } from "react";

import type { BusinessWorkItem } from "../core/businessWork";
import type { MarketDocumentFixture } from "../data/marketDocumentFixtures";
import {
  formatMarketDateTime,
  marketLifecycleLabels,
  type MarketFieldGroupKey,
} from "../marketMonitoringModel";

const submissionLabels = {
  initial: "首次提交",
  corrected: "更正提交",
} as const;

const reviewActionLabels = {
  claimed: "领取审核",
  approved: "审核通过",
  returned: "审核退回",
} as const;

const releaseActionLabels = {
  requested: "申请发布",
  published: "正式发布",
  replaced: "替代发布",
} as const;

type PrecheckState = "idle" | "passed" | "failed";
type SpreadsheetStage =
  "template" | "selected" | "prechecked" | "ready" | "imported";

function marketDocumentSections(item: BusinessWorkItem): readonly {
  sectionId: string;
  label: string;
  groupIds: readonly MarketFieldGroupKey[];
}[] {
  const isAgriculturalInput = item.productId === "agri-input";
  return [
    { sectionId: "quote-trade", label: "报价与成交", groupIds: ["purchase"] },
    { sectionId: "quality", label: "质量", groupIds: ["quality"] },
    {
      sectionId: "inventory-storage",
      label: "库存与仓储",
      groupIds: isAgriculturalInput ? [] : ["inventory"],
    },
    {
      sectionId: "processing",
      label: "加工与转化",
      groupIds: ["processing"],
    },
    { sectionId: "direct-use", label: "直接使用", groupIds: [] },
    {
      sectionId: "sales",
      label: "销售",
      groupIds: isAgriculturalInput ? [] : ["sales"],
    },
    {
      sectionId: "logistics",
      label: "物流与流向",
      groupIds: ["movement"],
    },
    {
      sectionId: "agricultural-input",
      label: "农资",
      groupIds: isAgriculturalInput ? ["inventory", "sales"] : [],
    },
    {
      sectionId: "source-validation",
      label: "来源与校验",
      groupIds: ["evidence"],
    },
  ];
}

export interface MarketDocumentDraft {
  values: Record<string, string>;
  confirmedFieldKeys: readonly string[];
}

function fieldKey(groupId: string, fieldId: string): string {
  return `${groupId}:${fieldId}`;
}

function businessDisplayValue(value: string): string {
  const batch = /^(\d{4})-[A-Z]+-(\d{2})(\d{2})-(\d+)$/.exec(value);
  if (!batch) return value;
  const [, year, month, day, order] = batch;
  return `${year}年${Number(month)}月${Number(day)}日第${Number(order)}批`;
}

function initialFieldValues(
  document: MarketDocumentFixture,
): Record<string, string> {
  return Object.fromEntries(
    document.fieldGroups.flatMap((group) =>
      group.fields.map((field) => [
        fieldKey(group.groupId, field.fieldId),
        businessDisplayValue(field.value),
      ]),
    ),
  );
}

function requiredFieldKeys(document: MarketDocumentFixture): readonly string[] {
  return document.fieldGroups.flatMap((group) =>
    group.fields
      .filter(({ countsTowardCompletion }) => countsTowardCompletion)
      .map((field) => fieldKey(group.groupId, field.fieldId)),
  );
}

function currentChannel(
  document: MarketDocumentFixture,
  mode: MarketDocumentFixture["collectionChannels"][number]["mode"],
) {
  return document.collectionChannels.find(
    (candidate) => candidate.mode === mode,
  );
}

function releaseBlockingReason(item: BusinessWorkItem): string | null {
  if (item.reviewStatus !== "approved") return "业务审核尚未通过";
  if (
    item.documentStatus !== "submitted" &&
    item.documentStatus !== "corrected"
  ) {
    return "当前单据尚未形成可发布结果";
  }
  if (item.inputVersionState === "stale") return "上游业务数据已经失效";
  if (item.qualityStatus === "passed") return null;
  if (
    item.qualityStatus === "warning" &&
    item.qualityGovernance.warningPublicationPolicy ===
      "allow-approved-explanation" &&
    item.qualityGovernance.approvedExplanationVersionIds.length > 0
  ) {
    return null;
  }
  if (item.qualityStatus === "warning") return "质量警告尚未完成说明复核";
  if (item.qualityStatus === "blocking") return "质量阻断尚未解除";
  return "质量说明仍在复核中";
}

function eventTime(): string {
  return new Date().toISOString();
}

export function MarketDocumentWorkbench({
  document,
  item,
  actor,
  draft,
  onDraftChange,
  onItemChange,
}: {
  document: MarketDocumentFixture;
  item: BusinessWorkItem;
  actor: { userId: string; displayName: string; canRelease: boolean };
  draft?: MarketDocumentDraft;
  onDraftChange?: (draft: MarketDocumentDraft) => void;
  onItemChange?: (item: BusinessWorkItem) => void;
}) {
  return (
    <MarketDocumentSession
      document={document}
      item={item}
      actor={actor}
      draft={draft}
      onDraftChange={onDraftChange}
      onItemChange={onItemChange}
      key={`${document.workId}:${item.workId}`}
    />
  );
}

function MarketDocumentSession({
  document,
  item,
  actor,
  draft,
  onDraftChange,
  onItemChange,
}: {
  document: MarketDocumentFixture;
  item: BusinessWorkItem;
  actor: { userId: string; displayName: string; canRelease: boolean };
  draft?: MarketDocumentDraft;
  onDraftChange?: (draft: MarketDocumentDraft) => void;
  onItemChange?: (item: BusinessWorkItem) => void;
}) {
  const initialMode =
    document.collectionChannels.find(({ mode }) => mode === "online")?.mode ??
    document.collectionChannels[0]?.mode ??
    "online";
  const [mode, setMode] =
    useState<MarketDocumentFixture["collectionChannels"][number]["mode"]>(
      initialMode,
    );
  const [work, setWork] = useState(item);
  const [values, setValues] = useState(() => ({
    ...initialFieldValues(document),
    ...draft?.values,
  }));
  const requiredKeys = requiredFieldKeys(document);
  const [confirmedFieldKeys, setConfirmedFieldKeys] = useState<
    readonly string[]
  >(
    () =>
      draft?.confirmedFieldKeys ?? requiredKeys.slice(0, item.completedFields),
  );
  const [precheck, setPrecheck] = useState<PrecheckState>("idle");
  const [feedback, setFeedback] = useState(
    currentChannel(document, initialMode)?.instruction ?? "采集方式配置未提供",
  );
  const [lastSavedLabel, setLastSavedLabel] = useState(document.lastSavedLabel);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [spreadsheetStage, setSpreadsheetStage] =
    useState<SpreadsheetStage>("template");
  const [spreadsheetErrors, setSpreadsheetErrors] = useState(
    currentChannel(document, "excel")?.importSummary?.errors ?? 0,
  );
  const [reviewReason, setReviewReason] = useState("");

  const channel = currentChannel(document, mode);
  if (!channel) return <div role="alert">采集方式配置未提供</div>;

  const latestSubmission = work.submissionHistory.at(-1);
  const latestReview = work.reviewHistory.at(-1);
  const latestRelease = work.releaseHistory.at(-1);
  const isResponsible = actor.userId === work.responsibleUserId;
  const isReviewer = actor.userId === work.reviewerUserId;
  const canEdit =
    isResponsible &&
    ["draft", "returned", "corrected"].includes(work.documentStatus);
  const hasMissingRequiredFields = requiredKeys.some(
    (key) => (values[key] ?? "").trim().length === 0,
  );
  const completedFieldCount = requiredKeys.filter(
    (key) =>
      confirmedFieldKeys.includes(key) && (values[key] ?? "").trim().length > 0,
  ).length;

  function updateWork(next: BusinessWorkItem) {
    setWork(next);
    onItemChange?.(next);
  }

  function saveDraftState(
    nextValues: Record<string, string>,
    nextConfirmedFieldKeys: readonly string[],
  ) {
    onDraftChange?.({
      values: nextValues,
      confirmedFieldKeys: nextConfirmedFieldKeys,
    });
  }

  function completionCount(
    nextValues: Record<string, string>,
    nextConfirmedFieldKeys: readonly string[],
  ): number {
    return requiredKeys.filter(
      (key) =>
        nextConfirmedFieldKeys.includes(key) &&
        (nextValues[key] ?? "").trim().length > 0,
    ).length;
  }

  function selectMode(
    nextMode: MarketDocumentFixture["collectionChannels"][number]["mode"],
  ) {
    setMode(nextMode);
    setFeedback(
      currentChannel(document, nextMode)?.instruction ?? "采集方式配置未提供",
    );
  }

  function editField(key: string, value: string) {
    const next = { ...values, [key]: value };
    const isRequired = requiredKeys.includes(key);
    const nextConfirmedFieldKeys = isRequired
      ? value.trim().length > 0
        ? [...new Set([...confirmedFieldKeys, key])]
        : confirmedFieldKeys.filter((candidate) => candidate !== key)
      : confirmedFieldKeys;
    setValues(next);
    setConfirmedFieldKeys(nextConfirmedFieldKeys);
    saveDraftState(next, nextConfirmedFieldKeys);
    const nextCompletedFields = completionCount(next, nextConfirmedFieldKeys);
    if (nextCompletedFields !== work.completedFields) {
      updateWork({ ...work, completedFields: nextCompletedFields });
    }
    setPrecheck("idle");
    setFeedback("字段已修改，请重新执行提交前检查");
  }

  function confirmSection(
    groupIds: readonly MarketFieldGroupKey[],
    sectionLabel: string,
  ) {
    const sectionFields = document.fieldGroups
      .filter(({ groupId }) => groupIds.includes(groupId))
      .flatMap((group) =>
        group.fields
          .filter(({ value }) => value !== "本单据不适用")
          .map((field) => ({
            key: fieldKey(group.groupId, field.fieldId),
            label: field.label,
          })),
      )
      .filter(({ key }) => requiredKeys.includes(key));
    const emptyField = sectionFields.find(
      ({ key }) => (values[key] ?? "").trim().length === 0,
    );
    if (emptyField) {
      setFeedback(`不能确认${sectionLabel}：${emptyField.label}尚未填写`);
      return;
    }
    const nextConfirmedFieldKeys = [
      ...new Set([
        ...confirmedFieldKeys,
        ...sectionFields.map(({ key }) => key),
      ]),
    ];
    setConfirmedFieldKeys(nextConfirmedFieldKeys);
    saveDraftState(values, nextConfirmedFieldKeys);
    const nextCompletedFields = completionCount(values, nextConfirmedFieldKeys);
    if (nextCompletedFields !== work.completedFields) {
      updateWork({ ...work, completedFields: nextCompletedFields });
    }
    setPrecheck("idle");
    setFeedback(`${sectionLabel}已由${actor.displayName}确认`);
  }

  function saveDraft() {
    if (!isResponsible) {
      setFeedback("当前人员不是本单据填报责任人，不能保存草稿");
      return;
    }
    if (!canEdit) {
      setFeedback("当前单据已提交，不能覆盖已提交内容");
      return;
    }
    setLastSavedLabel(`刚刚 · ${work.responsiblePerson || "填报责任人"}`);
    setPrecheck("idle");
    if (work.documentStatus === "returned") {
      updateWork({ ...work, documentStatus: "corrected" });
      setFeedback("更正草稿已保存在当前页面，尚未重新提交");
      return;
    }
    setFeedback("草稿已保存在当前页面，尚未提交审核");
  }

  function runPrecheck() {
    if (!isResponsible) {
      setPrecheck("failed");
      setFeedback("当前人员不是本单据填报责任人，不能执行提交前检查");
      return;
    }
    if (hasMissingRequiredFields) {
      setPrecheck("failed");
      setFeedback("提交前检查未通过：当前页面仍有必填字段为空");
      return;
    }
    if (completedFieldCount !== work.applicableFields) {
      setPrecheck("failed");
      setFeedback(
        `提交前检查未通过：还有 ${work.applicableFields - completedFieldCount} 项来源值待责任人确认`,
      );
      return;
    }
    setPrecheck("passed");
    setFeedback(
      `提交前检查已通过，已核验 ${work.applicableFields} 项适用字段；${document.validation.pendingEvidence}，提交后仍需按审核意见处理`,
    );
  }

  function submitForReview() {
    if (!isResponsible) {
      setFeedback("当前人员不是本单据填报责任人，不能提交审核");
      return;
    }
    if (precheck !== "passed") {
      setFeedback("请先执行并通过提交前检查");
      return;
    }
    if (
      work.documentStatus !== "draft" &&
      work.documentStatus !== "corrected"
    ) {
      setFeedback("当前单据状态不能提交审核");
      return;
    }
    const submittedAt = eventTime();
    const submission = {
      submissionVersionId: `${work.workId}-submission-${work.submissionHistory.length + 1}`,
      submittedBy: actor.displayName,
      submittedAt,
      kind:
        work.documentStatus === "corrected"
          ? ("corrected" as const)
          : ("initial" as const),
      replacesSubmissionVersionId:
        work.documentStatus === "corrected"
          ? (work.submissionHistory.at(-1)?.submissionVersionId ?? null)
          : null,
    };
    updateWork({
      ...work,
      obligationStatus:
        work.obligationStatus === "missed"
          ? "overdue-completed"
          : work.obligationStatus === "in-progress"
            ? Date.parse(submittedAt) > Date.parse(work.deadline)
              ? "overdue-completed"
              : "on-time"
            : work.obligationStatus,
      documentStatus: "submitted",
      reviewStatus: "pending",
      submissionHistory: [...work.submissionHistory, submission],
    });
    setPrecheck("idle");
    setFeedback(
      `已由${work.responsiblePerson || "填报责任人"}提交审核，等待${work.reviewer || "指派审核人"}领取`,
    );
  }

  function claimReview() {
    if (!isReviewer) {
      setFeedback("当前人员不是本单据指派审核人，不能领取审核");
      return;
    }
    const submission = work.submissionHistory.at(-1);
    if (
      work.documentStatus !== "submitted" ||
      work.reviewStatus !== "pending" ||
      !submission
    ) {
      setFeedback("当前单据不能领取审核");
      return;
    }
    const at = eventTime();
    updateWork({
      ...work,
      reviewStatus: "reviewing",
      reviewHistory: [
        ...work.reviewHistory,
        {
          reviewEventId: `${work.workId}-review-${work.reviewHistory.length + 1}`,
          submissionVersionId: submission.submissionVersionId,
          action: "claimed",
          reviewer: actor.displayName,
          at,
          reason: null,
        },
      ],
    });
    setFeedback(`已由${work.reviewer || "指派审核人"}领取审核`);
  }

  function approveReview() {
    if (!isReviewer) {
      setFeedback("当前人员不是本单据指派审核人，不能形成审核结论");
      return;
    }
    const submission = work.submissionHistory.at(-1);
    if (work.reviewStatus !== "reviewing" || !submission) {
      setFeedback("仅审核中的单据可以形成审核结论");
      return;
    }
    if (work.qualityStatus === "blocking") {
      setFeedback("质量阻断尚未解除，不能审核通过");
      return;
    }
    const at = eventTime();
    updateWork({
      ...work,
      reviewStatus: "approved",
      reviewHistory: [
        ...work.reviewHistory,
        {
          reviewEventId: `${work.workId}-review-${work.reviewHistory.length + 1}`,
          submissionVersionId: submission.submissionVersionId,
          action: "approved",
          reviewer: actor.displayName,
          at,
          reason: reviewReason.trim() || null,
        },
      ],
    });
    setReviewReason("");
    setFeedback("审核通过，当前结果仍未发布");
  }

  function returnForCorrection() {
    if (!isReviewer) {
      setFeedback("当前人员不是本单据指派审核人，不能退回修改");
      return;
    }
    const reason = reviewReason.trim();
    const submission = work.submissionHistory.at(-1);
    if (!reason) {
      setFeedback("退回修改必须填写审核意见");
      return;
    }
    if (work.reviewStatus !== "reviewing" || !submission) {
      setFeedback("仅审核中的单据可以退回修改");
      return;
    }
    const at = eventTime();
    updateWork({
      ...work,
      documentStatus: "returned",
      reviewStatus: "returned",
      reviewHistory: [
        ...work.reviewHistory,
        {
          reviewEventId: `${work.workId}-review-${work.reviewHistory.length + 1}`,
          submissionVersionId: submission.submissionVersionId,
          action: "returned",
          reviewer: actor.displayName,
          at,
          reason,
        },
      ],
    });
    setPrecheck("idle");
    setReviewReason("");
    setFeedback("单据已退回责任人修改，原提交记录继续保留");
  }

  function requestRelease() {
    if (!actor.canRelease) {
      setFeedback("当前岗位没有发布权限，不能申请发布");
      return;
    }
    if (work.releaseStatus !== "unreleased") {
      setFeedback("当前发布状态不能重复申请");
      return;
    }
    const reason = releaseBlockingReason(work);
    if (reason) {
      setFeedback(`不能申请发布：${reason}`);
      return;
    }
    const at = eventTime();
    updateWork({
      ...work,
      releaseStatus: "pending",
      releaseHistory: [
        ...work.releaseHistory,
        {
          releaseEventId: `${work.workId}-release-${work.releaseHistory.length + 1}`,
          action: "requested",
          releaseVersionId: `${work.workId}-release-request`,
          actor: actor.displayName,
          at,
          replacesReleaseVersionId: null,
        },
      ],
    });
    setFeedback("发布申请已登记，等待发布岗确认");
  }

  function confirmPublish() {
    if (!actor.canRelease) {
      setFeedback("当前岗位没有发布权限，不能确认正式发布");
      return;
    }
    const request = work.releaseHistory.at(-1);
    if (work.releaseStatus !== "pending" || request?.action !== "requested") {
      setFeedback("仅已申请且待确认的结果可以正式发布");
      return;
    }
    const reason = releaseBlockingReason(work);
    if (reason) {
      setFeedback(`不能正式发布：${reason}`);
      return;
    }
    updateWork({
      ...work,
      releaseStatus: "published",
      releaseHistory: [
        ...work.releaseHistory,
        {
          releaseEventId: `${work.workId}-release-${work.releaseHistory.length + 1}`,
          action: "published",
          releaseVersionId: request.releaseVersionId,
          actor: actor.displayName,
          at: eventTime(),
          replacesReleaseVersionId: null,
        },
      ],
    });
    setFeedback("发布岗已确认正式发布，发布记录已与审核记录分开保存");
  }

  function selectSpreadsheet(file: File | null) {
    setSelectedFile(file);
    setSpreadsheetStage(file ? "selected" : "template");
    setFeedback(
      file ? `已选择${file.name}，文件尚未上传` : "尚未选择待校验文件",
    );
  }

  function validateSpreadsheet() {
    if (!selectedFile) {
      setFeedback("请先选择待校验的电子表格");
      return;
    }
    const extensionAllowed = /\.(xlsx|xls|csv)$/i.test(selectedFile.name);
    if (!extensionAllowed) {
      setFeedback("文件类型校验未通过，请选择电子表格文件；文件尚未上传");
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setFeedback("文件大小超过十兆，未执行预检；文件尚未上传");
      return;
    }
    const importRowLimit =
      currentChannel(document, mode)?.importRowLimit ?? 5000;
    const initialErrors =
      currentChannel(document, mode)?.importSummary?.errors ?? 0;
    const isCorrectedFile = /修正|corrected/i.test(selectedFile.name);
    const nextErrors = isCorrectedFile ? 0 : initialErrors;
    setSpreadsheetErrors(nextErrors);
    setSpreadsheetStage(nextErrors > 0 ? "prechecked" : "ready");
    setFeedback(
      `文件类型和大小校验通过；单次不超过${importRowLimit.toLocaleString("zh-CN")}行；${nextErrors > 0 ? `发现 ${nextErrors} 行错误，请按明细修正后重新选择文件预检` : "错误已清零，可以确认导入"}；当前尚未导入`,
    );
  }

  function confirmSpreadsheetImport() {
    if (spreadsheetStage !== "ready" || spreadsheetErrors > 0) {
      setFeedback("当前预检仍有错误，不能确认导入");
      return;
    }
    setSpreadsheetStage("imported");
    setLastSavedLabel(`刚刚 · ${actor.displayName}`);
    setFeedback(
      "电子表格数据已合并到当前任务草稿，仍需由责任人执行提交前检查并提交审核",
    );
  }

  function validateSystemSync() {
    const sourceRows = currentChannel(document, mode)?.sourceRows ?? [];
    if (sourceRows.length === 0) {
      setFeedback("同步前校验未完成：当前未配置可校验的接入来源");
      return;
    }
    const pending = sourceRows.filter(
      ({ state }) => state.includes("待") || state.includes("异常"),
    ).length;
    setFeedback(
      `同步前校验已完成：已核对 ${sourceRows.length} 个接入来源${pending > 0 ? `，${pending} 项需要处理` : ""}；尚未写入当前单据`,
    );
  }

  return (
    <section
      aria-label={`${item.title}单据工作台`}
      className="market-task6-document"
    >
      <header className="market-task6-document__header">
        <div>
          <span>同一任务单据</span>
          <h2>{document.documentLabel}</h2>
          <p>
            {document.objectName} · {document.businessPeriodLabel}
          </p>
        </div>
        <div aria-label="市场采集方式" className="market-task6-mode-switch">
          {document.collectionChannels.map((candidate) => (
            <button
              aria-pressed={candidate.mode === mode}
              className={candidate.mode === mode ? "is-active" : undefined}
              key={candidate.mode}
              type="button"
              onClick={() => selectMode(candidate.mode)}
            >
              {candidate.label}
            </button>
          ))}
        </div>
      </header>
      <section
        aria-label="采集与审核生命周期"
        className="market-task6-lifecycle"
      >
        <header>
          <div>
            <span>同一业务单据</span>
            <h3>采集、校验、审核与发布</h3>
          </div>
          <p>审核通过不等于正式发布</p>
        </header>
        <dl className="market-task6-responsibility">
          <div>
            <dt>责任人</dt>
            <dd>
              {work.responsiblePerson || "责任人未提供"} ·{" "}
              {work.responsiblePost || "岗位未提供"}
            </dd>
          </div>
          <div>
            <dt>审核人</dt>
            <dd>{work.reviewer || "审核人未提供"}</dd>
          </div>
          <div>
            <dt>业务截止</dt>
            <dd>{formatMarketDateTime(work.deadline)}</dd>
          </div>
          <div>
            <dt>字段完成</dt>
            <dd>
              {work.completedFields}/{work.applicableFields} 项
            </dd>
          </div>
        </dl>
        <div aria-label="任务五状态" className="market-task6-lifecycle-states">
          <span>
            <small>义务状态</small>
            <strong>
              {marketLifecycleLabels.obligation[work.obligationStatus]}
            </strong>
          </span>
          <span>
            <small>单据状态</small>
            <strong>
              {marketLifecycleLabels.document[work.documentStatus]}
            </strong>
          </span>
          <span>
            <small>审核状态</small>
            <strong>{marketLifecycleLabels.review[work.reviewStatus]}</strong>
          </span>
          <span>
            <small>质量状态</small>
            <strong>{marketLifecycleLabels.quality[work.qualityStatus]}</strong>
          </span>
          <span>
            <small>发布状态</small>
            <strong>{marketLifecycleLabels.release[work.releaseStatus]}</strong>
          </span>
        </div>
        <div className="market-task6-audit-grid">
          <section>
            <h4>最近提交</h4>
            <p>
              {latestSubmission
                ? `${submissionLabels[latestSubmission.kind]} · ${latestSubmission.submittedBy || "提交人未提供"} · ${formatMarketDateTime(latestSubmission.submittedAt)}`
                : "尚未形成提交记录"}
            </p>
          </section>
          <section>
            <h4>最近审核</h4>
            <p>
              {latestReview
                ? `${reviewActionLabels[latestReview.action]} · ${latestReview.reviewer || "审核人未提供"} · ${formatMarketDateTime(latestReview.at)}`
                : "尚未形成审核记录"}
            </p>
            {latestReview?.reason && <p>审核意见：{latestReview.reason}</p>}
          </section>
          <section>
            <h4>最近发布</h4>
            <p>
              {latestRelease
                ? `${releaseActionLabels[latestRelease.action]} · ${latestRelease.actor || "发布责任人未提供"} · ${formatMarketDateTime(latestRelease.at)}`
                : "尚未申请发布"}
            </p>
          </section>
          <section>
            <h4>提交前检查</h4>
            <strong>{document.validation.title}</strong>
            <p>{document.validation.detail}</p>
            <p>{document.validation.pendingEvidence}</p>
          </section>
        </div>
        <section
          aria-label="当前可执行操作"
          className="market-task6-lifecycle-actions"
        >
          <h3>当前处理</h3>
          {canEdit && (
            <div>
              <p>填报责任人：{work.responsiblePerson || "责任人未提供"}</p>
              <button type="button" onClick={saveDraft}>
                {work.documentStatus === "returned"
                  ? "保存更正草稿"
                  : "保存草稿"}
              </button>
              {work.documentStatus !== "returned" && (
                <>
                  <button type="button" onClick={runPrecheck}>
                    执行提交前检查
                  </button>
                  <button type="button" onClick={submitForReview}>
                    提交审核
                  </button>
                </>
              )}
            </div>
          )}
          {work.documentStatus === "submitted" &&
            work.reviewStatus === "pending" &&
            isReviewer && (
              <div>
                <p>指派审核人：{work.reviewer || "审核人未提供"}</p>
                <button type="button" onClick={claimReview}>
                  领取审核
                </button>
              </div>
            )}
          {work.reviewStatus === "reviewing" && isReviewer && (
            <div>
              <label>
                <span>审核意见</span>
                <textarea
                  aria-label="审核意见"
                  value={reviewReason}
                  onChange={(event) => setReviewReason(event.target.value)}
                />
              </label>
              <button type="button" onClick={returnForCorrection}>
                退回修改
              </button>
              <button type="button" onClick={approveReview}>
                审核通过
              </button>
            </div>
          )}
          {work.reviewStatus === "approved" &&
            work.releaseStatus === "unreleased" &&
            actor.canRelease && (
              <div>
                <p>发布操作与业务审核分开办理</p>
                <button type="button" onClick={requestRelease}>
                  申请发布
                </button>
              </div>
            )}
          {work.releaseStatus === "pending" && actor.canRelease && (
            <div>
              <p>发布岗复核业务范围、质量结论与审核记录</p>
              <button type="button" onClick={confirmPublish}>
                确认正式发布
              </button>
            </div>
          )}
          {work.releaseStatus === "published" && <p>当前结果已经正式发布</p>}
          {!canEdit &&
            !(
              work.documentStatus === "submitted" &&
              work.reviewStatus === "pending" &&
              isReviewer
            ) &&
            !(work.reviewStatus === "reviewing" && isReviewer) &&
            !(
              work.reviewStatus === "approved" &&
              work.releaseStatus === "unreleased" &&
              actor.canRelease
            ) &&
            !(work.releaseStatus === "pending" && actor.canRelease) &&
            work.releaseStatus !== "published" && (
              <p>当前登录岗位可查看本单据，但没有此处理节点的操作权限。</p>
            )}
          <p aria-live="polite" role="status">
            {feedback}
          </p>
        </section>
      </section>
      <section
        aria-label={`${channel.label}说明`}
        className="market-task6-channel"
      >
        <strong>{channel.label}</strong>
        <span>{channel.sourceDetail}</span>
        <span>{channel.validationResult}</span>
        <p>{channel.instruction}</p>
      </section>
      {mode === "online" ? (
        <div className="market-task6-field-groups">
          {marketDocumentSections(work).map((section) => {
            const groups = document.fieldGroups.filter(({ groupId }) =>
              section.groupIds.includes(groupId),
            );
            const fields = groups.flatMap((group) =>
              group.fields
                .filter(({ value }) => value !== "本单据不适用")
                .map((field) => ({ groupId: group.groupId, field })),
            );
            if (fields.length === 0) return null;
            const sectionRequiredKeys = fields
              .map(({ groupId, field }) => fieldKey(groupId, field.fieldId))
              .filter((key) => requiredKeys.includes(key));
            const sectionConfirmed = sectionRequiredKeys.every((key) =>
              confirmedFieldKeys.includes(key),
            );
            return (
              <section
                className="market-task6-field-group"
                key={section.sectionId}
              >
                <div className="market-task6-field-group__header">
                  <h3>{section.label}</h3>
                  {sectionRequiredKeys.length > 0 &&
                    (sectionConfirmed ? (
                      <small>本章节数据已由责任人确认</small>
                    ) : canEdit ? (
                      <button
                        aria-label={`确认${section.label}章节来源值`}
                        type="button"
                        onClick={() =>
                          confirmSection(section.groupIds, section.label)
                        }
                      >
                        确认本章节来源值
                      </button>
                    ) : (
                      <small>本章节仍有来源值待确认</small>
                    ))}
                </div>
                <dl>
                  {fields.map(({ groupId, field }) => {
                    const key = fieldKey(groupId, field.fieldId);
                    const isRequired = requiredKeys.includes(key);
                    return (
                      <div key={key}>
                        <dt>
                          {field.label}
                          {isRequired ? "（必填）" : ""}
                        </dt>
                        <dd>
                          <input
                            aria-label={field.label}
                            disabled={!canEdit}
                            type="text"
                            value={values[key] ?? ""}
                            onChange={(event) =>
                              editField(key, event.target.value)
                            }
                          />
                          {field.unit && <span> {field.unit}</span>}
                        </dd>
                        {field.note && <small>{field.note}</small>}
                      </div>
                    );
                  })}
                </dl>
              </section>
            );
          })}
        </div>
      ) : mode === "excel" ? (
        <div className="market-task6-channel-workflow">
          <ol
            aria-label="电子表格批量导入步骤"
            className="market-task6-import-steps"
          >
            <li className="is-complete">1. 下载任务模板</li>
            <li
              className={
                spreadsheetStage === "selected" ||
                spreadsheetStage === "prechecked" ||
                spreadsheetStage === "ready" ||
                spreadsheetStage === "imported"
                  ? "is-complete"
                  : undefined
              }
            >
              2. 上传并预检
            </li>
            <li
              className={
                spreadsheetStage === "ready" || spreadsheetStage === "imported"
                  ? "is-complete"
                  : undefined
              }
            >
              3. 修正错误
            </li>
            <li
              className={
                spreadsheetStage === "imported" ? "is-complete" : undefined
              }
            >
              4. 确认导入
            </li>
          </ol>
          <a
            download="市场监测任务导入模板.csv"
            href={`data:text/csv;charset=utf-8,${encodeURIComponent("对象名称,业务地区,产品,监测期间,报价,成交量,质量情况,来源凭证")}`}
          >
            下载当前任务模板
          </a>
          <label>
            <span>选择待校验文件</span>
            <input
              accept=".xlsx,.xls,.csv"
              aria-label="选择待校验文件"
              type="file"
              onChange={(event) =>
                selectSpreadsheet(event.target.files?.[0] ?? null)
              }
            />
          </label>
          <button type="button" onClick={validateSpreadsheet}>
            {spreadsheetStage === "prechecked"
              ? "重新预检修正文件"
              : "预检电子表格"}
          </button>
          {channel.importSummary && (
            <dl
              aria-label="电子表格最近预检结果"
              className="market-task6-import-summary"
            >
              <div>
                <dt>总行数</dt>
                <dd>{channel.importSummary.total} 行</dd>
              </div>
              <div>
                <dt>通过</dt>
                <dd>{channel.importSummary.accepted} 行</dd>
              </div>
              <div>
                <dt>警告</dt>
                <dd>{channel.importSummary.warnings} 行</dd>
              </div>
              <div>
                <dt>错误</dt>
                <dd>{spreadsheetErrors} 行</dd>
              </div>
            </dl>
          )}
          {(spreadsheetStage === "ready" ||
            spreadsheetStage === "imported") && (
            <button
              disabled={spreadsheetStage === "imported"}
              type="button"
              onClick={confirmSpreadsheetImport}
            >
              {spreadsheetStage === "imported" ? "已确认导入" : "确认导入草稿"}
            </button>
          )}
          <p>
            支持电子表格文件，单次不超过
            {(channel.importRowLimit ?? 5000).toLocaleString("zh-CN")}
            行；预检错误必须清零，确认后只合并到当前任务草稿，不直接提交审核。
          </p>
        </div>
      ) : channel.sourceRows.length > 0 ? (
        <div className="market-task6-source-list">
          {channel.systemSummary && (
            <dl
              aria-label="授权系统接入汇总"
              className="market-task6-system-summary"
            >
              <div>
                <dt>今日接收</dt>
                <dd>{channel.systemSummary.received} 条</dd>
                <small>最近接收 {channel.systemSummary.latestLabel}</small>
              </div>
              <div>
                <dt>自动通过</dt>
                <dd>{channel.systemSummary.accepted} 条</dd>
              </div>
              <div>
                <dt>需要确认</dt>
                <dd>{channel.systemSummary.pending} 条</dd>
              </div>
              <div>
                <dt>接入失败</dt>
                <dd>{channel.systemSummary.failed} 条</dd>
              </div>
            </dl>
          )}
          {channel.sourceRows.map((row) => (
            <div key={row.name}>
              <strong>{row.name}</strong>
              <span>{row.detail}</span>
              <span>{row.state}</span>
            </div>
          ))}
          <button type="button" onClick={validateSystemSync}>
            执行同步前校验
          </button>
          <p>校验接入来源和待处理记录，不自动写入当前单据。</p>
        </div>
      ) : (
        <div className="market-task6-channel-workflow">
          <p>{channel.instruction}</p>
          <button type="button" onClick={validateSystemSync}>
            执行同步前校验
          </button>
        </div>
      )}
      <footer>最近保存：{lastSavedLabel}</footer>
    </section>
  );
}
