import { useState } from "react";

import type { BusinessWorkItem } from "../core/businessWork";
import type {
  ProductionDocumentFieldGroupId,
  ProductionDocumentFixture,
} from "../data/productionDocumentFixtures";
import { formatProductionDateTime } from "../productionMonitoringModel";

const obligationLabels: Readonly<
  Record<BusinessWorkItem["obligationStatus"], string>
> = {
  "not-due": "未到期",
  "in-progress": "进行中",
  "on-time": "按时完成",
  "overdue-completed": "逾期补填",
  missed: "截止未提交",
  exempt: "免报",
};
const documentLabels: Readonly<
  Record<BusinessWorkItem["documentStatus"], string>
> = {
  draft: "草稿",
  submitted: "已提交",
  returned: "已退回",
  corrected: "更正中",
};
const reviewLabels: Readonly<Record<BusinessWorkItem["reviewStatus"], string>> =
  {
    pending: "待审核",
    reviewing: "审核中",
    approved: "审核通过",
    returned: "审核退回",
  };
const qualityLabels: Readonly<
  Record<BusinessWorkItem["qualityStatus"], string>
> = {
  passed: "质量通过",
  warning: "质量警告",
  blocking: "质量阻断",
  "awaiting-explanation": "等待说明",
};
const releaseLabels: Readonly<
  Record<BusinessWorkItem["releaseStatus"], string>
> = {
  unreleased: "未发布",
  pending: "待发布",
  published: "已发布",
  superseded: "已由后续发布结果替代",
};

const reviewActionLabels = {
  claimed: "领取审核",
  approved: "审核通过",
  returned: "审核退回",
} as const;

const submissionKindLabels = {
  initial: "首次提交",
  corrected: "更正提交",
} as const;

type PrecheckState = "idle" | "passed" | "failed";

const productionDocumentSections = [
  {
    sectionId: "planting-area",
    label: "种植与面积",
    groupIds: ["specific-variety", "area-location"],
  },
  {
    sectionId: "growth-disaster",
    label: "长势与灾情",
    groupIds: ["growth-stage-disaster"],
  },
  {
    sectionId: "yield-output",
    label: "单产与总产",
    groupIds: ["yield-output"],
  },
  {
    sectionId: "quality",
    label: "质量调查",
    groupIds: ["quality-evidence"],
  },
  {
    sectionId: "stock-sales",
    label: "余粮与销售",
    groupIds: ["stock-sale-use-loss"],
  },
  {
    sectionId: "intention",
    label: "种植意愿",
    groupIds: ["planting-intention"],
  },
  {
    sectionId: "cost-support",
    label: "成本与保障",
    groupIds: ["cost-support-insurance"],
  },
  {
    sectionId: "source-validation",
    label: "来源与校验",
    groupIds: ["source-validation"],
  },
] as const satisfies readonly {
  sectionId: string;
  label: string;
  groupIds: readonly ProductionDocumentFieldGroupId[];
}[];

export interface ProductionDocumentDraft {
  values: Record<string, string>;
  confirmedFieldKeys: readonly string[];
}

function fieldKey(groupId: string, fieldId: string): string {
  return `${groupId}:${fieldId}`;
}

function initialFieldValues(
  document: ProductionDocumentFixture,
): Record<string, string> {
  return Object.fromEntries(
    document.fieldGroups.flatMap((group) =>
      group.fields.map((field) => [
        fieldKey(group.groupId, field.fieldId),
        field.value,
      ]),
    ),
  );
}

function applicableFieldKeys(
  document: ProductionDocumentFixture,
  count: number,
): readonly string[] {
  return document.fieldGroups
    .flatMap((group) =>
      group.fields
        .filter(({ value }) => value !== "本单据不适用")
        .map((field) => fieldKey(group.groupId, field.fieldId)),
    )
    .slice(0, count);
}

function currentChannel(
  document: ProductionDocumentFixture,
  mode: ProductionDocumentFixture["collectionChannels"][number]["mode"],
) {
  return document.collectionChannels.find(
    (candidate) => candidate.mode === mode,
  );
}

function eventTime(): string {
  return new Date().toISOString();
}

export function ProductionDocumentWorkbench({
  document,
  item,
  actor,
  draft,
  onDraftChange,
  onItemChange,
}: {
  document: ProductionDocumentFixture;
  item: BusinessWorkItem;
  actor: { userId: string; displayName: string };
  draft?: ProductionDocumentDraft;
  onDraftChange?: (draft: ProductionDocumentDraft) => void;
  onItemChange?: (item: BusinessWorkItem) => void;
}) {
  return (
    <ProductionDocumentSession
      actor={actor}
      document={document}
      draft={draft}
      item={item}
      key={`${document.workId}:${item.workId}`}
      onDraftChange={onDraftChange}
      onItemChange={onItemChange}
    />
  );
}

function ProductionDocumentSession({
  document,
  item,
  actor,
  draft,
  onDraftChange,
  onItemChange,
}: {
  document: ProductionDocumentFixture;
  item: BusinessWorkItem;
  actor: { userId: string; displayName: string };
  draft?: ProductionDocumentDraft;
  onDraftChange?: (draft: ProductionDocumentDraft) => void;
  onItemChange?: (item: BusinessWorkItem) => void;
}) {
  const initialMode =
    document.collectionChannels.find(({ mode }) => mode === "online")?.mode ??
    document.collectionChannels[0]?.mode ??
    "online";
  const requiredKeys = applicableFieldKeys(document, item.applicableFields);
  const [mode, setMode] =
    useState<ProductionDocumentFixture["collectionChannels"][number]["mode"]>(
      initialMode,
    );
  const [work, setWork] = useState(item);
  const [values, setValues] = useState(() => ({
    ...initialFieldValues(document),
    ...draft?.values,
  }));
  const [confirmedFieldKeys, setConfirmedFieldKeys] = useState<
    readonly string[]
  >(
    () =>
      draft?.confirmedFieldKeys ?? requiredKeys.slice(0, item.completedFields),
  );
  const [precheck, setPrecheck] = useState<PrecheckState>("idle");
  const [feedback, setFeedback] = useState(
    currentChannel(document, initialMode)?.instruction ?? "采集方式配置待维护",
  );
  const [lastSavedLabel, setLastSavedLabel] = useState(document.lastSavedLabel);

  const channel = currentChannel(document, mode);
  if (!channel) return <div role="alert">采集方式配置待维护</div>;

  const latestSubmission = work.submissionHistory.at(-1);
  const latestReview = work.reviewHistory.at(-1);
  const latestQuality = work.qualityHistory.at(-1);
  const latestRelease = work.releaseHistory.at(-1);
  const isResponsible = actor.userId === work.responsibleUserId;
  const canEdit =
    isResponsible &&
    ["draft", "returned", "corrected"].includes(work.documentStatus);
  const completedFieldCount = requiredKeys.filter(
    (key) =>
      confirmedFieldKeys.includes(key) && (values[key] ?? "").trim().length > 0,
  ).length;
  const missingRequiredCount = requiredKeys.filter(
    (key) => (values[key] ?? "").trim().length === 0,
  ).length;

  function updateWork(next: BusinessWorkItem) {
    setWork(next);
    onItemChange?.(next);
  }

  function persistDraft(
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
    nextMode: ProductionDocumentFixture["collectionChannels"][number]["mode"],
  ) {
    setMode(nextMode);
    setFeedback(
      currentChannel(document, nextMode)?.instruction ?? "采集方式配置待维护",
    );
  }

  function editField(key: string, value: string) {
    const nextValues = { ...values, [key]: value };
    const isRequired = requiredKeys.includes(key);
    const nextConfirmedFieldKeys = isRequired
      ? value.trim().length > 0
        ? [...new Set([...confirmedFieldKeys, key])]
        : confirmedFieldKeys.filter((candidate) => candidate !== key)
      : confirmedFieldKeys;
    setValues(nextValues);
    setConfirmedFieldKeys(nextConfirmedFieldKeys);
    persistDraft(nextValues, nextConfirmedFieldKeys);
    const nextCompletedFields = completionCount(
      nextValues,
      nextConfirmedFieldKeys,
    );
    if (nextCompletedFields !== work.completedFields) {
      updateWork({ ...work, completedFields: nextCompletedFields });
    }
    setPrecheck("idle");
    setFeedback("字段已修改，请重新执行提交前检查");
  }

  function confirmSection(
    groupIds: readonly ProductionDocumentFieldGroupId[],
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
    persistDraft(values, nextConfirmedFieldKeys);
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
    const nextWork =
      work.documentStatus === "returned"
        ? { ...work, documentStatus: "corrected" as const }
        : work;
    if (nextWork !== work) updateWork(nextWork);
    persistDraft(values, confirmedFieldKeys);
    setLastSavedLabel(`刚刚 · ${actor.displayName}`);
    setPrecheck("idle");
    setFeedback(
      work.documentStatus === "returned"
        ? "更正草稿已保存，原提交与退回记录继续保留"
        : "草稿已保存，尚未提交审核",
    );
  }

  function runPrecheck() {
    if (!isResponsible) {
      setPrecheck("failed");
      setFeedback("当前人员不是本单据填报责任人，不能执行提交前检查");
      return;
    }
    if (work.documentStatus === "returned") {
      setPrecheck("failed");
      setFeedback("请先保存更正草稿，再执行提交前检查");
      return;
    }
    if (missingRequiredCount > 0) {
      setPrecheck("failed");
      setFeedback(
        `提交前检查未通过：仍有 ${missingRequiredCount} 项必填字段为空`,
      );
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
      `提交前检查已通过，已核验 ${work.applicableFields} 项适用字段；质量规则将在审核链路中继续处理`,
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
        work.obligationStatus === "missed" ||
        (work.obligationStatus === "in-progress" &&
          Date.parse(submittedAt) > Date.parse(work.deadline))
          ? "overdue-completed"
          : work.obligationStatus === "in-progress"
            ? "on-time"
            : work.obligationStatus,
      documentStatus: "submitted",
      reviewStatus: "pending",
      completedFields: completedFieldCount,
      submissionHistory: [...work.submissionHistory, submission],
    });
    setPrecheck("idle");
    setFeedback(
      `已由${actor.displayName}提交审核，等待${work.reviewer || "指派审核人"}领取；原退回记录继续保留`,
    );
  }

  return (
    <section
      aria-label={`${item.title}单据工作台`}
      className="production-task5-document"
    >
      <header className="production-task5-document__header">
        <div>
          <span>同一任务单据</span>
          <h2>{document.documentLabel}</h2>
          <p>
            {document.objectName} · {document.businessPeriodLabel}
          </p>
        </div>
        <div aria-label="产情采集方式" className="production-task5-mode-switch">
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
        aria-label={`${channel.label}说明`}
        className="production-task5-channel"
      >
        <strong>{channel.label}</strong>
        <span>{channel.sourceDetail}</span>
        <span>{channel.validationResult}</span>
        <p role="status">{feedback}</p>
      </section>
      <section
        aria-label="单据与审核流程"
        className="production-task5-lifecycle"
      >
        <header>
          <div>
            <span>业务处理进度</span>
            <h3>单据与审核流程</h3>
          </div>
          <p>保存、提交、审核和发布分别留痕；审核通过不等于正式发布。</p>
        </header>
        <dl className="production-task5-responsibility">
          <div>
            <dt>责任人</dt>
            <dd>
              {work.responsiblePerson || "责任人待维护"} ·{" "}
              {work.responsiblePost || "岗位待维护"}
            </dd>
          </div>
          <div>
            <dt>审核人</dt>
            <dd>{work.reviewer || "审核人待维护"}</dd>
          </div>
          <div>
            <dt>业务截止</dt>
            <dd>{formatProductionDateTime(work.deadline)}</dd>
          </div>
          <div>
            <dt>字段完成</dt>
            <dd>
              {work.completedFields}/{work.applicableFields} 项
            </dd>
          </div>
        </dl>
        <div
          aria-label="任务五状态"
          className="production-task5-lifecycle-states"
        >
          <span>
            <small>义务状态</small>
            <strong>{obligationLabels[work.obligationStatus]}</strong>
          </span>
          <span>
            <small>单据状态</small>
            <strong>{documentLabels[work.documentStatus]}</strong>
          </span>
          <span>
            <small>审核状态</small>
            <strong>{reviewLabels[work.reviewStatus]}</strong>
          </span>
          <span>
            <small>质量状态</small>
            <strong>{qualityLabels[work.qualityStatus]}</strong>
          </span>
          <span>
            <small>发布状态</small>
            <strong>{releaseLabels[work.releaseStatus]}</strong>
          </span>
        </div>
        <div className="production-task5-audit-grid">
          <section>
            <h4>最近提交</h4>
            <p>
              {latestSubmission
                ? `${submissionKindLabels[latestSubmission.kind]} · ${latestSubmission.submittedBy || "提交人待维护"} · ${formatProductionDateTime(latestSubmission.submittedAt)}`
                : "尚未形成提交记录"}
            </p>
          </section>
          <section>
            <h4>最近审核</h4>
            <p>
              {latestReview
                ? `${reviewActionLabels[latestReview.action]} · ${latestReview.reviewer || "审核人待维护"} · ${formatProductionDateTime(latestReview.at)}`
                : "尚未形成审核记录"}
            </p>
            {latestReview?.reason && <p>审核意见：{latestReview.reason}</p>}
          </section>
          <section>
            <h4>最近质量处理</h4>
            <p>
              {latestQuality
                ? `${qualityLabels[latestQuality.result]} · ${latestQuality.actor || "处理人待维护"} · ${formatProductionDateTime(latestQuality.at)}`
                : "尚未形成质量处理记录"}
            </p>
          </section>
          <section>
            <h4>最近发布处理</h4>
            <p>
              {latestRelease
                ? `${releaseLabels[work.releaseStatus]} · ${latestRelease.actor || "发布人待维护"} · ${formatProductionDateTime(latestRelease.at)}`
                : "尚未申请发布"}
            </p>
          </section>
        </div>
        <section
          aria-label="产情当前可执行操作"
          className="production-task5-lifecycle-actions"
        >
          <h3>当前处理</h3>
          {canEdit ? (
            <div>
              <p>填报责任人：{work.responsiblePerson || "责任人待维护"}</p>
              <button type="button" onClick={saveDraft}>
                {work.documentStatus === "returned"
                  ? "保存更正草稿"
                  : "保存草稿"}
              </button>
              <button type="button" onClick={runPrecheck}>
                执行提交前检查
              </button>
              <button type="button" onClick={submitForReview}>
                {work.documentStatus === "corrected"
                  ? "重新提交审核"
                  : "提交审核"}
              </button>
            </div>
          ) : (
            <p>
              {work.documentStatus === "submitted"
                ? `单据已提交，等待${work.reviewer || "指派审核人"}处理`
                : "当前人员无可执行的填报操作"}
            </p>
          )}
          <p className={`production-task5-precheck is-${precheck}`}>
            提交前检查：
            {precheck === "passed"
              ? "已通过"
              : precheck === "failed"
                ? "未通过"
                : "尚未执行"}
          </p>
        </section>
      </section>
      {mode === "online" ? (
        <div className="production-task5-field-groups">
          {productionDocumentSections.map((section) => {
            const groups = document.fieldGroups.filter(({ groupId }) =>
              (
                section.groupIds as readonly ProductionDocumentFieldGroupId[]
              ).includes(groupId),
            );
            const fields = groups.flatMap((group) =>
              group.fields
                .filter(({ value }) => value !== "本单据不适用")
                .map((field) => ({ groupId: group.groupId, field })),
            );
            const sectionRequiredKeys = fields
              .map(({ groupId, field }) => fieldKey(groupId, field.fieldId))
              .filter((key) => requiredKeys.includes(key));
            const sectionConfirmed = sectionRequiredKeys.every((key) =>
              confirmedFieldKeys.includes(key),
            );
            return (
              <section
                className="production-task5-field-group"
                key={section.sectionId}
              >
                <div className="production-task5-field-group__header">
                  <h3>{section.label}</h3>
                  {sectionRequiredKeys.length > 0 &&
                    (sectionConfirmed ? (
                      <small>本章节数据已由责任人确认</small>
                    ) : canEdit ? (
                      <button
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
                <div className="production-task5-edit-fields">
                  {fields.map(({ groupId, field }) => {
                    const key = fieldKey(groupId, field.fieldId);
                    const isRequired = requiredKeys.includes(key);
                    return (
                      <label key={key}>
                        <span>
                          {field.label}
                          {isRequired ? "（必填）" : ""}
                        </span>
                        <input
                          aria-label={field.label}
                          disabled={!canEdit}
                          value={values[key] ?? ""}
                          onChange={(event) =>
                            editField(key, event.target.value)
                          }
                        />
                      </label>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="production-task5-channel-workflow" role="status">
          <strong>{channel.instruction}</strong>
          <span>{channel.validationResult}</span>
          <p>
            {mode === "excel"
              ? "电子表格由统一采集服务校验后写入本任务草稿；本页不伪造导入成功结果。"
              : "授权系统接入记录只读展示，责任人须回到在线填报确认后再提交审核。"}
          </p>
        </div>
      )}
      <footer>
        <span>最近保存：{lastSavedLabel}</span>
      </footer>
    </section>
  );
}
