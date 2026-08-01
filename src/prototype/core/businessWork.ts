import type { BusinessClassification } from "./businessClassification";

export interface SubmissionVersion {
  submissionVersionId: string;
  submittedBy: string;
  submittedAt: string;
  kind: "initial" | "corrected";
  replacesSubmissionVersionId: string | null;
}

export interface WorkObligationEvent {
  obligationEventId: string;
  action: "started" | "deadline-missed" | "completed" | "exempted";
  actor: string;
  at: string;
  reason: string | null;
}

export interface WorkReviewEvent {
  reviewEventId: string;
  submissionVersionId: string;
  action: "claimed" | "approved" | "returned";
  reviewer: string;
  at: string;
  reason: string | null;
}

export interface WorkQualityEvent {
  qualityEventId: string;
  action:
    | "rules-executed"
    | "explanation-submitted"
    | "explanation-approved"
    | "explanation-returned";
  ruleVersionId: string;
  result: BusinessWorkItem["qualityStatus"];
  actor: string;
  actorRoleId: string;
  at: string;
  explanationVersionId: string | null;
}

export interface WorkReleaseEvent {
  releaseEventId: string;
  action: "requested" | "published" | "replaced";
  releaseVersionId: string;
  actor: string;
  at: string;
  replacesReleaseVersionId: string | null;
}

export interface BusinessWorkItem {
  workId: string;
  title: string;
  domain: "production" | "market" | "supply" | "reporting";
  businessSubtypeId: BusinessClassification["id"];
  businessLabel: string;
  subject:
    | {
        kind: "monitoring-object";
        objectId: string;
        objectName: string;
        objectTypeId: string;
      }
    | {
        kind: "supply-account";
        productAccountId: string;
        accountVersionId: string;
        accountLabel: string;
      }
    | {
        kind: "report-run";
        runId: string;
        reportTypeId: string;
        reportLabel: string;
      };
  regionId: string;
  regionLabel: string;
  productId: string | null;
  cultivarIds: readonly string[];
  periodKey: string;
  deadline: string;
  responsibleUserId: string;
  responsiblePerson: string;
  responsiblePost: string;
  dutyLabel: string;
  reviewerUserId: string;
  reviewer: string;
  responsibilityId: string;
  frequency: string;
  deadlineRule: string;
  effectivePeriod: string;
  obligationStatus:
    | "not-due"
    | "in-progress"
    | "on-time"
    | "overdue-completed"
    | "missed"
    | "exempt";
  documentStatus: "draft" | "submitted" | "returned" | "corrected";
  reviewStatus: "pending" | "reviewing" | "approved" | "returned";
  qualityStatus: "passed" | "warning" | "blocking" | "awaiting-explanation";
  releaseStatus: "unreleased" | "pending" | "published" | "superseded";
  completedFields: number;
  applicableFields: number;
  collectionModes: readonly ("online" | "excel" | "system")[];
  fieldGroupIds: readonly string[];
  inputVersionState: "current" | "stale";
  qualityGovernance: {
    ruleVersionId: string;
    warningPublicationPolicy: "block" | "allow-approved-explanation";
    approvedExplanationVersionIds: readonly string[];
  };
  obligationHistory: readonly WorkObligationEvent[];
  submissionHistory: readonly SubmissionVersion[];
  reviewHistory: readonly WorkReviewEvent[];
  qualityHistory: readonly WorkQualityEvent[];
  releaseHistory: readonly WorkReleaseEvent[];
}

export type BusinessWorkActorRoleId =
  | "responsible"
  | "authorized-admin"
  | "reviewer"
  | "quality-reviewer"
  | "publisher"
  | "system";

export interface BusinessWorkTransitionContext {
  actorUserId: string;
  actor: string;
  roleIds: readonly BusinessWorkActorRoleId[];
  permissionKeys: readonly string[];
  now: string;
}

export type BusinessWorkCommand =
  | { type: "start-obligation"; event: WorkObligationEvent }
  | { type: "mark-deadline-missed"; event: WorkObligationEvent }
  | { type: "complete-obligation"; event: WorkObligationEvent }
  | { type: "exempt-obligation"; event: WorkObligationEvent }
  | { type: "submit-document"; version: SubmissionVersion }
  | { type: "correct-document"; version: SubmissionVersion }
  | { type: "claim-review"; event: WorkReviewEvent }
  | { type: "approve-review"; event: WorkReviewEvent }
  | { type: "return-review"; event: WorkReviewEvent }
  | { type: "run-quality-rules"; event: WorkQualityEvent }
  | { type: "submit-quality-explanation"; event: WorkQualityEvent }
  | { type: "review-quality-explanation"; event: WorkQualityEvent }
  | { type: "request-release"; event: WorkReleaseEvent }
  | { type: "publish"; event: WorkReleaseEvent }
  | { type: "replace-release"; event: WorkReleaseEvent }
  | { type: "mark-input-stale"; at: string };

export type BusinessWorkTransitionResult =
  | { status: "applied"; item: BusinessWorkItem }
  | { status: "rejected"; item: BusinessWorkItem; reason: string };

function rejected(
  item: BusinessWorkItem,
  reason: string,
): BusinessWorkTransitionResult {
  return { status: "rejected", item, reason };
}

function applied(
  item: BusinessWorkItem,
  patch: Partial<BusinessWorkItem>,
): BusinessWorkTransitionResult {
  return { status: "applied", item: { ...item, ...patch } };
}

function authorized(
  context: BusinessWorkTransitionContext,
  roleId: BusinessWorkActorRoleId,
  permissionKey: string,
): boolean {
  return (
    context.roleIds.includes(roleId) &&
    context.permissionKeys.includes(permissionKey)
  );
}

function eventMatchesContext(
  actor: string,
  at: string,
  context: BusinessWorkTransitionContext,
): boolean {
  return actor === context.actor && at === context.now;
}

function isNonEmptyReason(reason: string | null): boolean {
  return reason !== null && reason.trim().length > 0;
}

function latestSubmission(item: BusinessWorkItem): SubmissionVersion | null {
  return item.submissionHistory.at(-1) ?? null;
}

function qualityAllowsRelease(item: BusinessWorkItem): boolean {
  if (item.qualityStatus === "passed") return true;
  if (
    item.qualityStatus !== "warning" ||
    item.qualityGovernance.warningPublicationPolicy !==
      "allow-approved-explanation"
  ) {
    return false;
  }
  let currentRulesIndex = -1;
  item.qualityHistory.forEach((event, index) => {
    if (
      event.action === "rules-executed" &&
      event.ruleVersionId === item.qualityGovernance.ruleVersionId
    ) {
      currentRulesIndex = index;
    }
  });
  if (currentRulesIndex < 0) return false;
  return item.qualityHistory.some((event, approvalIndex) => {
    if (
      approvalIndex <= currentRulesIndex ||
      event.action !== "explanation-approved" ||
      event.ruleVersionId !== item.qualityGovernance.ruleVersionId ||
      event.explanationVersionId === null ||
      !item.qualityGovernance.approvedExplanationVersionIds.includes(
        event.explanationVersionId,
      )
    ) {
      return false;
    }
    return item.qualityHistory.some(
      (candidate, submissionIndex) =>
        submissionIndex > currentRulesIndex &&
        submissionIndex < approvalIndex &&
        candidate.action === "explanation-submitted" &&
        candidate.ruleVersionId === event.ruleVersionId &&
        candidate.explanationVersionId === event.explanationVersionId,
    );
  });
}

function releasePrecondition(item: BusinessWorkItem): string | null {
  if (item.reviewStatus !== "approved") return "业务审核尚未通过";
  if (
    item.documentStatus !== "submitted" &&
    item.documentStatus !== "corrected"
  ) {
    return "单据尚未形成可发布版本";
  }
  if (item.inputVersionState === "stale") return "上游输入版本已经过期";
  if (!qualityAllowsRelease(item)) return "质量状态不允许发布";
  return null;
}

export function transitionBusinessWork(
  item: BusinessWorkItem,
  command: BusinessWorkCommand,
  context: BusinessWorkTransitionContext,
): BusinessWorkTransitionResult {
  switch (command.type) {
    case "start-obligation": {
      if (!authorized(context, "responsible", "business-work:collect"))
        return rejected(item, "当前身份无权开始该义务");
      if (context.actorUserId !== item.responsibleUserId)
        return rejected(item, "当前身份不是该义务的指派责任人");
      if (
        command.event.action !== "started" ||
        !eventMatchesContext(command.event.actor, command.event.at, context)
      )
        return rejected(item, "义务开始审计信息无效");
      if (item.obligationStatus !== "not-due")
        return rejected(item, "仅未到期义务可以开始");
      return applied(item, {
        obligationStatus: "in-progress",
        obligationHistory: [...item.obligationHistory, command.event],
      });
    }
    case "mark-deadline-missed": {
      if (!authorized(context, "system", "business-work:system"))
        return rejected(item, "仅系统可确认截止未提交");
      if (
        command.event.action !== "deadline-missed" ||
        !eventMatchesContext(command.event.actor, command.event.at, context)
      )
        return rejected(item, "截止审计信息无效");
      if (
        item.obligationStatus !== "not-due" &&
        item.obligationStatus !== "in-progress"
      )
        return rejected(item, "当前义务状态不能记录截止未提交");
      if (Date.parse(context.now) <= Date.parse(item.deadline))
        return rejected(item, "业务截止时间尚未到达");
      return applied(item, {
        obligationStatus: "missed",
        obligationHistory: [...item.obligationHistory, command.event],
      });
    }
    case "complete-obligation": {
      if (!authorized(context, "responsible", "business-work:collect"))
        return rejected(item, "当前身份无权完成该义务");
      if (context.actorUserId !== item.responsibleUserId)
        return rejected(item, "当前身份不是该义务的指派责任人");
      if (
        command.event.action !== "completed" ||
        !eventMatchesContext(command.event.actor, command.event.at, context)
      )
        return rejected(item, "义务完成审计信息无效");
      if (
        item.obligationStatus !== "in-progress" &&
        item.obligationStatus !== "missed"
      )
        return rejected(item, "当前义务状态不能完成");
      return applied(item, {
        obligationStatus:
          item.obligationStatus === "missed" ||
          Date.parse(context.now) > Date.parse(item.deadline)
            ? "overdue-completed"
            : "on-time",
        obligationHistory: [...item.obligationHistory, command.event],
      });
    }
    case "exempt-obligation": {
      if (!authorized(context, "authorized-admin", "business-work:admin"))
        return rejected(item, "当前身份无权确认免报");
      if (
        command.event.action !== "exempted" ||
        !eventMatchesContext(command.event.actor, command.event.at, context) ||
        !isNonEmptyReason(command.event.reason)
      )
        return rejected(item, "免报审计信息或依据无效");
      if (item.obligationStatus !== "not-due")
        return rejected(item, "仅未到期义务可以免报");
      return applied(item, {
        obligationStatus: "exempt",
        obligationHistory: [...item.obligationHistory, command.event],
      });
    }
    case "submit-document": {
      if (!authorized(context, "responsible", "business-work:collect"))
        return rejected(item, "当前身份无权提交单据");
      if (context.actorUserId !== item.responsibleUserId)
        return rejected(item, "当前身份不是该单据的指派责任人");
      if (item.completedFields !== item.applicableFields)
        return rejected(item, "适用字段尚未完整填写");
      if (item.documentStatus === "corrected") {
        const correctedVersion = latestSubmission(item);
        if (
          correctedVersion === null ||
          correctedVersion.kind !== "corrected" ||
          command.version.submissionVersionId !==
            correctedVersion.submissionVersionId ||
          command.version.submittedBy !== correctedVersion.submittedBy ||
          command.version.submittedAt !== correctedVersion.submittedAt ||
          command.version.kind !== correctedVersion.kind ||
          command.version.replacesSubmissionVersionId !==
            correctedVersion.replacesSubmissionVersionId ||
          correctedVersion.submittedBy !== context.actor
        )
          return rejected(item, "重新提交必须引用最新更正版本");
        return applied(item, {
          documentStatus: "submitted",
          reviewStatus: "pending",
        });
      }
      if (
        command.version.kind !== "initial" ||
        command.version.replacesSubmissionVersionId !== null ||
        !eventMatchesContext(
          command.version.submittedBy,
          command.version.submittedAt,
          context,
        )
      )
        return rejected(item, "首次提交版本信息无效");
      if (item.documentStatus !== "draft")
        return rejected(item, "仅草稿可以首次提交");
      return applied(item, {
        documentStatus: "submitted",
        reviewStatus: "pending",
        submissionHistory: [...item.submissionHistory, command.version],
      });
    }
    case "correct-document": {
      if (!authorized(context, "responsible", "business-work:collect"))
        return rejected(item, "当前身份无权更正单据");
      if (context.actorUserId !== item.responsibleUserId)
        return rejected(item, "当前身份不是该单据的指派责任人");
      const previous = latestSubmission(item);
      if (
        item.documentStatus !== "returned" ||
        command.version.kind !== "corrected" ||
        previous === null ||
        item.submissionHistory.some(
          ({ submissionVersionId }) =>
            submissionVersionId === command.version.submissionVersionId,
        ) ||
        command.version.replacesSubmissionVersionId !==
          previous.submissionVersionId ||
        !eventMatchesContext(
          command.version.submittedBy,
          command.version.submittedAt,
          context,
        )
      )
        return rejected(item, "更正版本未正确关联退回提交");
      return applied(item, {
        documentStatus: "corrected",
        submissionHistory: [...item.submissionHistory, command.version],
      });
    }
    case "claim-review":
    case "approve-review":
    case "return-review": {
      if (!authorized(context, "reviewer", "business-work:review"))
        return rejected(item, "当前身份无权执行业务审核");
      if (context.actorUserId !== item.reviewerUserId)
        return rejected(item, "当前身份不是该任务的指派审核人");
      if (
        !eventMatchesContext(command.event.reviewer, command.event.at, context)
      )
        return rejected(item, "审核审计信息无效");
      const currentSubmission = latestSubmission(item);
      if (
        currentSubmission === null ||
        command.event.submissionVersionId !==
          currentSubmission.submissionVersionId
      )
        return rejected(item, "审核未关联最新提交版本");
      if (command.type === "claim-review") {
        if (
          command.event.action !== "claimed" ||
          item.reviewStatus !== "pending" ||
          item.documentStatus !== "submitted"
        )
          return rejected(item, "当前单据不能领取审核");
        return applied(item, {
          reviewStatus: "reviewing",
          reviewHistory: [...item.reviewHistory, command.event],
        });
      }
      if (item.reviewStatus !== "reviewing")
        return rejected(item, "仅审核中的单据可以形成审核结论");
      if (command.type === "approve-review") {
        if (command.event.action !== "approved")
          return rejected(item, "审核通过动作不匹配");
        if (item.qualityStatus === "blocking")
          return rejected(item, "质量阻断时不能审核通过");
        return applied(item, {
          reviewStatus: "approved",
          reviewHistory: [...item.reviewHistory, command.event],
        });
      }
      if (
        command.event.action !== "returned" ||
        !isNonEmptyReason(command.event.reason)
      )
        return rejected(item, "审核退回必须说明原因");
      return applied(item, {
        documentStatus: "returned",
        reviewStatus: "returned",
        reviewHistory: [...item.reviewHistory, command.event],
      });
    }
    case "run-quality-rules": {
      if (!authorized(context, "system", "business-work:quality-rules"))
        return rejected(item, "仅规则引擎可以执行质量规则");
      if (
        item.qualityStatus === "awaiting-explanation" ||
        command.event.action !== "rules-executed" ||
        command.event.actorRoleId !== "system" ||
        command.event.ruleVersionId !== item.qualityGovernance.ruleVersionId ||
        !eventMatchesContext(command.event.actor, command.event.at, context) ||
        !["passed", "warning", "blocking"].includes(command.event.result)
      )
        return rejected(item, "质量规则审计信息无效");
      return applied(item, {
        qualityStatus: command.event.result,
        qualityHistory: [...item.qualityHistory, command.event],
      });
    }
    case "submit-quality-explanation": {
      if (!authorized(context, "responsible", "business-work:quality-explain"))
        return rejected(item, "当前身份无权提交质量说明");
      if (context.actorUserId !== item.responsibleUserId)
        return rejected(item, "当前身份不是该任务的指派责任人");
      if (
        command.event.action !== "explanation-submitted" ||
        command.event.actorRoleId !== "responsible" ||
        command.event.ruleVersionId !== item.qualityGovernance.ruleVersionId ||
        command.event.result !== "awaiting-explanation" ||
        command.event.explanationVersionId === null ||
        !eventMatchesContext(command.event.actor, command.event.at, context) ||
        (item.qualityStatus !== "warning" && item.qualityStatus !== "blocking")
      )
        return rejected(item, "质量说明审计信息无效");
      return applied(item, {
        qualityStatus: "awaiting-explanation",
        qualityHistory: [...item.qualityHistory, command.event],
      });
    }
    case "review-quality-explanation": {
      if (
        !authorized(context, "quality-reviewer", "business-work:quality-review")
      )
        return rejected(item, "当前身份无权复核质量说明");
      let latestRulesIndex = -1;
      item.qualityHistory.forEach((event, index) => {
        if (
          event.action === "rules-executed" &&
          event.ruleVersionId === item.qualityGovernance.ruleVersionId
        ) {
          latestRulesIndex = index;
        }
      });
      const submitted = item.qualityHistory.find(
        (event, index) =>
          index > latestRulesIndex &&
          event.action === "explanation-submitted" &&
          event.explanationVersionId === command.event.explanationVersionId &&
          event.ruleVersionId === command.event.ruleVersionId,
      );
      const latestRulesResult = item.qualityHistory[latestRulesIndex]?.result;
      const approved = command.event.action === "explanation-approved";
      const resultIsValid = approved
        ? ["passed", "warning", "blocking"].includes(command.event.result)
        : (latestRulesResult === "warning" ||
            latestRulesResult === "blocking") &&
          command.event.result === latestRulesResult;
      if (
        item.qualityStatus !== "awaiting-explanation" ||
        command.event.actorRoleId !== "quality-reviewer" ||
        (command.event.action !== "explanation-approved" &&
          command.event.action !== "explanation-returned") ||
        command.event.ruleVersionId !== item.qualityGovernance.ruleVersionId ||
        command.event.explanationVersionId === null ||
        submitted === undefined ||
        latestRulesResult === undefined ||
        !resultIsValid ||
        !eventMatchesContext(command.event.actor, command.event.at, context)
      )
        return rejected(item, "质量说明复核信息无效");
      return applied(item, {
        qualityStatus: command.event.result,
        qualityGovernance: approved
          ? {
              ...item.qualityGovernance,
              approvedExplanationVersionIds: [
                ...item.qualityGovernance.approvedExplanationVersionIds,
                command.event.explanationVersionId,
              ],
            }
          : item.qualityGovernance,
        qualityHistory: [...item.qualityHistory, command.event],
      });
    }
    case "request-release":
    case "publish":
    case "replace-release": {
      if (!authorized(context, "publisher", "business-work:release"))
        return rejected(item, "当前身份无权执行发布动作");
      if (!eventMatchesContext(command.event.actor, command.event.at, context))
        return rejected(item, "发布审计信息无效");
      if (command.type === "request-release") {
        if (
          command.event.action !== "requested" ||
          item.releaseStatus !== "unreleased" ||
          command.event.replacesReleaseVersionId !== null
        )
          return rejected(item, "当前结果不能申请发布");
        const reason = releasePrecondition(item);
        if (reason) return rejected(item, reason);
        return applied(item, {
          releaseStatus: "pending",
          releaseHistory: [...item.releaseHistory, command.event],
        });
      }
      if (command.type === "publish") {
        if (
          command.event.action !== "published" ||
          item.releaseStatus !== "pending"
        )
          return rejected(item, "仅待发布版本可以发布");
        const request = item.releaseHistory.at(-1);
        if (
          request?.action !== "requested" ||
          request.releaseVersionId !== command.event.releaseVersionId
        )
          return rejected(item, "发布版本未关联发布申请");
        const reason = releasePrecondition(item);
        if (reason) return rejected(item, reason);
        return applied(item, {
          releaseStatus: "published",
          releaseHistory: [...item.releaseHistory, command.event],
        });
      }
      const latestPublished = [...item.releaseHistory]
        .reverse()
        .find((event) => event.action === "published");
      if (
        command.event.action !== "replaced" ||
        item.releaseStatus !== "published" ||
        latestPublished === undefined ||
        item.releaseHistory.some(
          ({ releaseVersionId }) =>
            releaseVersionId === command.event.releaseVersionId,
        ) ||
        command.event.replacesReleaseVersionId !==
          latestPublished.releaseVersionId
      )
        return rejected(item, "替代版本未正确关联已发布历史");
      const reason = releasePrecondition(item);
      if (reason) return rejected(item, reason);
      return applied(item, {
        releaseStatus: "superseded",
        releaseHistory: [...item.releaseHistory, command.event],
      });
    }
    case "mark-input-stale": {
      if (!authorized(context, "system", "business-work:system"))
        return rejected(item, "仅系统可以标记输入版本过期");
      if (command.at !== context.now)
        return rejected(item, "输入版本审计时间无效");
      if (
        item.releaseStatus === "published" ||
        item.releaseStatus === "superseded"
      )
        return rejected(item, "已发布历史不可回写输入状态");
      return applied(item, { inputVersionState: "stale" });
    }
  }
}
