import { describe, expect, it } from "vitest";

import {
  transitionBusinessWork,
  type BusinessWorkCommand,
  type BusinessWorkItem,
  type BusinessWorkTransitionContext,
} from "./businessWork";

function workItem(overrides: Partial<BusinessWorkItem> = {}): BusinessWorkItem {
  return {
    workId: "WORK-PRODUCTION-W31-01",
    title: "讷河市玉米长势与测产调查",
    domain: "production",
    businessSubtypeId: "production.planting-production",
    businessLabel: "种植生产",
    subject: {
      kind: "monitoring-object",
      objectId: "OBJ-SURVEY-01",
      objectName: "讷河市同义镇调查片区",
      objectTypeId: "survey-area",
    },
    regionId: "qiqihar-nehe",
    regionLabel: "讷河市",
    productId: "corn",
    cultivarIds: ["jingke-968"],
    periodKey: "2026-W31",
    deadline: "2026-07-31T17:00:00+08:00",
    responsibleUserId: "liu-min",
    responsiblePerson: "刘敏",
    responsiblePost: "产情调查员",
    dutyLabel: "每周产情调查",
    reviewerUserId: "zhao-chen",
    reviewer: "赵晨",
    responsibilityId: "RESP-PRODUCTION-01",
    frequency: "每周一次",
    deadlineRule: "每周五 17:00 前",
    effectivePeriod: "2026 年度",
    obligationStatus: "not-due",
    documentStatus: "draft",
    reviewStatus: "pending",
    qualityStatus: "passed",
    releaseStatus: "unreleased",
    completedFields: 26,
    applicableFields: 26,
    collectionModes: ["online", "excel", "system"],
    fieldGroupIds: ["variety", "area", "growth", "yield"],
    inputVersionState: "current",
    qualityGovernance: {
      ruleVersionId: "RULE-PRODUCTION-1",
      warningPublicationPolicy: "allow-approved-explanation",
      approvedExplanationVersionIds: [],
    },
    obligationHistory: [],
    submissionHistory: [],
    reviewHistory: [],
    qualityHistory: [],
    releaseHistory: [],
    ...overrides,
  };
}

function context(
  roleIds: BusinessWorkTransitionContext["roleIds"],
  permissionKeys: readonly string[],
  actor = "刘敏",
  now = "2026-07-31T15:00:00+08:00",
): BusinessWorkTransitionContext {
  const actorUserId =
    actor === "刘敏" ? "liu-min" : actor === "赵晨" ? "zhao-chen" : actor;
  return { actorUserId, actor, roleIds, permissionKeys, now };
}

const started = {
  obligationEventId: "OBLIGATION-EVENT-1",
  action: "started" as const,
  actor: "刘敏",
  at: "2026-07-31T15:00:00+08:00",
  reason: null,
};
const initialSubmission = {
  submissionVersionId: "SUBMISSION-1",
  submittedBy: "刘敏",
  submittedAt: "2026-07-31T15:00:00+08:00",
  kind: "initial" as const,
  replacesSubmissionVersionId: null,
};

describe("transitionBusinessWork", () => {
  const legalCases: readonly {
    name: string;
    item: BusinessWorkItem;
    command: BusinessWorkCommand;
    transitionContext: BusinessWorkTransitionContext;
    assert: (next: BusinessWorkItem) => void;
  }[] = [
    {
      name: "责任人开始义务",
      item: workItem(),
      command: { type: "start-obligation", event: started },
      transitionContext: context(["responsible"], ["business-work:collect"]),
      assert: (next) => expect(next.obligationStatus).toBe("in-progress"),
    },
    {
      name: "系统在截止后记录未提交",
      item: workItem({ obligationStatus: "in-progress" }),
      command: {
        type: "mark-deadline-missed",
        event: {
          obligationEventId: "OBLIGATION-EVENT-2",
          action: "deadline-missed",
          actor: "系统",
          at: "2026-07-31T17:01:00+08:00",
          reason: "超过业务截止时间",
        },
      },
      transitionContext: context(
        ["system"],
        ["business-work:system"],
        "系统",
        "2026-07-31T17:01:00+08:00",
      ),
      assert: (next) => expect(next.obligationStatus).toBe("missed"),
    },
    {
      name: "责任人在截止前完成义务",
      item: workItem({ obligationStatus: "in-progress" }),
      command: {
        type: "complete-obligation",
        event: {
          obligationEventId: "OBLIGATION-EVENT-3",
          action: "completed",
          actor: "刘敏",
          at: "2026-07-31T15:00:00+08:00",
          reason: null,
        },
      },
      transitionContext: context(["responsible"], ["business-work:collect"]),
      assert: (next) => expect(next.obligationStatus).toBe("on-time"),
    },
    {
      name: "责任人在错过截止后补填",
      item: workItem({ obligationStatus: "missed" }),
      command: {
        type: "complete-obligation",
        event: {
          obligationEventId: "OBLIGATION-EVENT-4",
          action: "completed",
          actor: "刘敏",
          at: "2026-07-31T18:00:00+08:00",
          reason: "补齐调查依据",
        },
      },
      transitionContext: context(
        ["responsible"],
        ["business-work:collect"],
        "刘敏",
        "2026-07-31T18:00:00+08:00",
      ),
      assert: (next) => expect(next.obligationStatus).toBe("overdue-completed"),
    },
    {
      name: "授权管理员免报",
      item: workItem(),
      command: {
        type: "exempt-obligation",
        event: {
          obligationEventId: "OBLIGATION-EVENT-5",
          action: "exempted",
          actor: "孙悦",
          at: "2026-07-31T15:00:00+08:00",
          reason: "对象本期不适用",
        },
      },
      transitionContext: context(
        ["authorized-admin"],
        ["business-work:admin"],
        "孙悦",
      ),
      assert: (next) => expect(next.obligationStatus).toBe("exempt"),
    },
    {
      name: "责任人提交完整单据",
      item: workItem({ obligationStatus: "in-progress" }),
      command: { type: "submit-document", version: initialSubmission },
      transitionContext: context(["responsible"], ["business-work:collect"]),
      assert: (next) => expect(next.documentStatus).toBe("submitted"),
    },
    {
      name: "责任人更正退回单据并保留旧版本",
      item: workItem({
        documentStatus: "returned",
        reviewStatus: "returned",
        submissionHistory: [initialSubmission],
        reviewHistory: [
          {
            reviewEventId: "REVIEW-RETURN-1",
            submissionVersionId: "SUBMISSION-1",
            action: "returned",
            reviewer: "赵晨",
            at: "2026-07-31T15:30:00+08:00",
            reason: "检验依据缺失",
          },
        ],
      }),
      command: {
        type: "correct-document",
        version: {
          submissionVersionId: "SUBMISSION-2",
          submittedBy: "刘敏",
          submittedAt: "2026-07-31T16:00:00+08:00",
          kind: "corrected",
          replacesSubmissionVersionId: "SUBMISSION-1",
        },
      },
      transitionContext: context(
        ["responsible"],
        ["business-work:collect"],
        "刘敏",
        "2026-07-31T16:00:00+08:00",
      ),
      assert: (next) => {
        expect(next.documentStatus).toBe("corrected");
        expect(next.reviewStatus).toBe("returned");
        expect(next.submissionHistory).toHaveLength(2);
        expect(next.reviewHistory).toHaveLength(1);
      },
    },
    {
      name: "审核人领取最新提交",
      item: workItem({
        documentStatus: "submitted",
        submissionHistory: [initialSubmission],
      }),
      command: {
        type: "claim-review",
        event: {
          reviewEventId: "REVIEW-CLAIM-1",
          submissionVersionId: "SUBMISSION-1",
          action: "claimed",
          reviewer: "赵晨",
          at: "2026-07-31T15:00:00+08:00",
          reason: null,
        },
      },
      transitionContext: context(
        ["reviewer"],
        ["business-work:review"],
        "赵晨",
      ),
      assert: (next) => expect(next.reviewStatus).toBe("reviewing"),
    },
    {
      name: "审核人通过单据但不发布",
      item: workItem({
        documentStatus: "submitted",
        reviewStatus: "reviewing",
        submissionHistory: [initialSubmission],
      }),
      command: {
        type: "approve-review",
        event: {
          reviewEventId: "REVIEW-APPROVE-1",
          submissionVersionId: "SUBMISSION-1",
          action: "approved",
          reviewer: "赵晨",
          at: "2026-07-31T15:00:00+08:00",
          reason: null,
        },
      },
      transitionContext: context(
        ["reviewer"],
        ["business-work:review"],
        "赵晨",
      ),
      assert: (next) => {
        expect(next.reviewStatus).toBe("approved");
        expect(next.releaseStatus).toBe("unreleased");
      },
    },
    {
      name: "审核人退回并保留提交历史",
      item: workItem({
        documentStatus: "submitted",
        reviewStatus: "reviewing",
        submissionHistory: [initialSubmission],
      }),
      command: {
        type: "return-review",
        event: {
          reviewEventId: "REVIEW-RETURN-2",
          submissionVersionId: "SUBMISSION-1",
          action: "returned",
          reviewer: "赵晨",
          at: "2026-07-31T15:00:00+08:00",
          reason: "质量依据需要补充",
        },
      },
      transitionContext: context(
        ["reviewer"],
        ["business-work:review"],
        "赵晨",
      ),
      assert: (next) => {
        expect(next.documentStatus).toBe("returned");
        expect(next.reviewStatus).toBe("returned");
        expect(next.submissionHistory).toEqual([initialSubmission]);
      },
    },
    {
      name: "系统运行质量规则",
      item: workItem(),
      command: {
        type: "run-quality-rules",
        event: {
          qualityEventId: "QUALITY-RUN-1",
          action: "rules-executed",
          ruleVersionId: "RULE-PRODUCTION-1",
          result: "warning",
          actor: "系统",
          actorRoleId: "system",
          at: "2026-07-31T15:00:00+08:00",
          explanationVersionId: null,
        },
      },
      transitionContext: context(
        ["system"],
        ["business-work:quality-rules"],
        "系统",
      ),
      assert: (next) => expect(next.qualityStatus).toBe("warning"),
    },
    {
      name: "责任人提交独立质量说明",
      item: workItem({ qualityStatus: "warning" }),
      command: {
        type: "submit-quality-explanation",
        event: {
          qualityEventId: "QUALITY-EXPLAIN-1",
          action: "explanation-submitted",
          ruleVersionId: "RULE-PRODUCTION-1",
          result: "awaiting-explanation",
          actor: "刘敏",
          actorRoleId: "responsible",
          at: "2026-07-31T15:00:00+08:00",
          explanationVersionId: "EXPLANATION-1",
        },
      },
      transitionContext: context(
        ["responsible"],
        ["business-work:quality-explain"],
      ),
      assert: (next) => expect(next.qualityStatus).toBe("awaiting-explanation"),
    },
    {
      name: "质量复核人批准说明",
      item: workItem({
        qualityStatus: "awaiting-explanation",
        qualityHistory: [
          {
            qualityEventId: "QUALITY-RULES-APPROVE-1",
            action: "rules-executed",
            ruleVersionId: "RULE-PRODUCTION-1",
            result: "blocking",
            actor: "规则引擎",
            actorRoleId: "system",
            at: "2026-07-31T13:50:00+08:00",
            explanationVersionId: null,
          },
          {
            qualityEventId: "QUALITY-EXPLAIN-1",
            action: "explanation-submitted",
            ruleVersionId: "RULE-PRODUCTION-1",
            result: "awaiting-explanation",
            actor: "刘敏",
            actorRoleId: "responsible",
            at: "2026-07-31T14:00:00+08:00",
            explanationVersionId: "EXPLANATION-1",
          },
        ],
      }),
      command: {
        type: "review-quality-explanation",
        event: {
          qualityEventId: "QUALITY-APPROVE-1",
          action: "explanation-approved",
          ruleVersionId: "RULE-PRODUCTION-1",
          result: "warning",
          actor: "孙悦",
          actorRoleId: "quality-reviewer",
          at: "2026-07-31T15:00:00+08:00",
          explanationVersionId: "EXPLANATION-1",
        },
      },
      transitionContext: context(
        ["quality-reviewer"],
        ["business-work:quality-review"],
        "孙悦",
      ),
      assert: (next) => {
        expect(next.qualityStatus).toBe("warning");
        expect(next.qualityGovernance.approvedExplanationVersionIds).toEqual([
          "EXPLANATION-1",
        ]);
      },
    },
    {
      name: "质量复核人退回说明并保留说明审计",
      item: workItem({
        qualityStatus: "awaiting-explanation",
        qualityHistory: [
          {
            qualityEventId: "QUALITY-RULES-RETURN-1",
            action: "rules-executed",
            ruleVersionId: "RULE-PRODUCTION-1",
            result: "blocking",
            actor: "规则引擎",
            actorRoleId: "system",
            at: "2026-07-31T13:50:00+08:00",
            explanationVersionId: null,
          },
          {
            qualityEventId: "QUALITY-EXPLAIN-2",
            action: "explanation-submitted",
            ruleVersionId: "RULE-PRODUCTION-1",
            result: "awaiting-explanation",
            actor: "刘敏",
            actorRoleId: "responsible",
            at: "2026-07-31T14:00:00+08:00",
            explanationVersionId: "EXPLANATION-2",
          },
        ],
      }),
      command: {
        type: "review-quality-explanation",
        event: {
          qualityEventId: "QUALITY-RETURN-1",
          action: "explanation-returned",
          ruleVersionId: "RULE-PRODUCTION-1",
          result: "blocking",
          actor: "孙悦",
          actorRoleId: "quality-reviewer",
          at: "2026-07-31T15:00:00+08:00",
          explanationVersionId: "EXPLANATION-2",
        },
      },
      transitionContext: context(
        ["quality-reviewer"],
        ["business-work:quality-review"],
        "孙悦",
      ),
      assert: (next) => {
        expect(next.qualityStatus).toBe("blocking");
        expect(next.qualityHistory.map(({ action }) => action)).toEqual([
          "rules-executed",
          "explanation-submitted",
          "explanation-returned",
        ]);
        expect(next.qualityGovernance.approvedExplanationVersionIds).toEqual(
          [],
        );
      },
    },
    {
      name: "当前规则已有批准说明且政策允许时申请发布",
      item: workItem({
        documentStatus: "submitted",
        reviewStatus: "approved",
        qualityStatus: "warning",
        submissionHistory: [initialSubmission],
        qualityGovernance: {
          ruleVersionId: "RULE-PRODUCTION-1",
          warningPublicationPolicy: "allow-approved-explanation",
          approvedExplanationVersionIds: ["EXPLANATION-3"],
        },
        qualityHistory: [
          {
            qualityEventId: "QUALITY-RULES-3",
            action: "rules-executed",
            ruleVersionId: "RULE-PRODUCTION-1",
            result: "warning",
            actor: "规则引擎",
            actorRoleId: "system",
            at: "2026-07-31T13:40:00+08:00",
            explanationVersionId: null,
          },
          {
            qualityEventId: "QUALITY-SUBMIT-3",
            action: "explanation-submitted",
            ruleVersionId: "RULE-PRODUCTION-1",
            result: "awaiting-explanation",
            actor: "刘敏",
            actorRoleId: "responsible",
            at: "2026-07-31T13:50:00+08:00",
            explanationVersionId: "EXPLANATION-3",
          },
          {
            qualityEventId: "QUALITY-APPROVE-3",
            action: "explanation-approved",
            ruleVersionId: "RULE-PRODUCTION-1",
            result: "warning",
            actor: "孙悦",
            actorRoleId: "quality-reviewer",
            at: "2026-07-31T14:00:00+08:00",
            explanationVersionId: "EXPLANATION-3",
          },
        ],
      }),
      command: {
        type: "request-release",
        event: {
          releaseEventId: "RELEASE-REQUEST-WARNING-1",
          action: "requested",
          releaseVersionId: "PUB-PRODUCTION-WARNING-1",
          actor: "周楠",
          at: "2026-07-31T15:00:00+08:00",
          replacesReleaseVersionId: null,
        },
      },
      transitionContext: context(
        ["publisher"],
        ["business-work:release"],
        "周楠",
      ),
      assert: (next) => expect(next.releaseStatus).toBe("pending"),
    },
    {
      name: "发布人申请发布",
      item: workItem({
        documentStatus: "submitted",
        reviewStatus: "approved",
        submissionHistory: [initialSubmission],
      }),
      command: {
        type: "request-release",
        event: {
          releaseEventId: "RELEASE-REQUEST-1",
          action: "requested",
          releaseVersionId: "PUB-PRODUCTION-1",
          actor: "周楠",
          at: "2026-07-31T15:00:00+08:00",
          replacesReleaseVersionId: null,
        },
      },
      transitionContext: context(
        ["publisher"],
        ["business-work:release"],
        "周楠",
      ),
      assert: (next) => expect(next.releaseStatus).toBe("pending"),
    },
    {
      name: "发布人单独发布待发布版本",
      item: workItem({
        documentStatus: "submitted",
        reviewStatus: "approved",
        releaseStatus: "pending",
        submissionHistory: [initialSubmission],
        releaseHistory: [
          {
            releaseEventId: "RELEASE-REQUEST-1",
            action: "requested",
            releaseVersionId: "PUB-PRODUCTION-1",
            actor: "周楠",
            at: "2026-07-31T14:00:00+08:00",
            replacesReleaseVersionId: null,
          },
        ],
      }),
      command: {
        type: "publish",
        event: {
          releaseEventId: "RELEASE-PUBLISH-1",
          action: "published",
          releaseVersionId: "PUB-PRODUCTION-1",
          actor: "周楠",
          at: "2026-07-31T15:00:00+08:00",
          replacesReleaseVersionId: null,
        },
      },
      transitionContext: context(
        ["publisher"],
        ["business-work:release"],
        "周楠",
      ),
      assert: (next) => expect(next.releaseStatus).toBe("published"),
    },
    {
      name: "发布人用新发布版本替代已发布历史",
      item: workItem({
        documentStatus: "submitted",
        reviewStatus: "approved",
        releaseStatus: "published",
        releaseHistory: [
          {
            releaseEventId: "RELEASE-PUBLISH-1",
            action: "published",
            releaseVersionId: "PUB-PRODUCTION-1",
            actor: "周楠",
            at: "2026-07-31T14:00:00+08:00",
            replacesReleaseVersionId: null,
          },
        ],
      }),
      command: {
        type: "replace-release",
        event: {
          releaseEventId: "RELEASE-REPLACE-1",
          action: "replaced",
          releaseVersionId: "PUB-PRODUCTION-2",
          actor: "周楠",
          at: "2026-07-31T15:00:00+08:00",
          replacesReleaseVersionId: "PUB-PRODUCTION-1",
        },
      },
      transitionContext: context(
        ["publisher"],
        ["business-work:release"],
        "周楠",
      ),
      assert: (next) => {
        expect(next.releaseStatus).toBe("superseded");
        expect(next.releaseHistory).toHaveLength(2);
      },
    },
    {
      name: "系统把未发布输入标记为过期",
      item: workItem(),
      command: {
        type: "mark-input-stale",
        at: "2026-07-31T15:00:00+08:00",
      },
      transitionContext: context(["system"], ["business-work:system"], "系统"),
      assert: (next) => expect(next.inputVersionState).toBe("stale"),
    },
  ];

  it.each(legalCases)(
    "应用合法迁移：$name",
    ({ item, command, transitionContext, assert }) => {
      const before = structuredClone(item);
      const result = transitionBusinessWork(item, command, transitionContext);
      expect(result.status).toBe("applied");
      if (result.status !== "applied") return;
      assert(result.item);
      expect(item).toEqual(before);
    },
  );

  it("lets a corrected submission re-enter review while retaining old submission and review history", () => {
    const returned = workItem({
      documentStatus: "returned",
      reviewStatus: "returned",
      submissionHistory: [initialSubmission],
      reviewHistory: [
        {
          reviewEventId: "REVIEW-RETURN-CHAIN",
          submissionVersionId: "SUBMISSION-1",
          action: "returned",
          reviewer: "赵晨",
          at: "2026-07-31T15:30:00+08:00",
          reason: "检验依据缺失",
        },
      ],
    });
    const corrected = transitionBusinessWork(
      returned,
      {
        type: "correct-document",
        version: {
          submissionVersionId: "SUBMISSION-2",
          submittedBy: "刘敏",
          submittedAt: "2026-07-31T16:00:00+08:00",
          kind: "corrected",
          replacesSubmissionVersionId: "SUBMISSION-1",
        },
      },
      context(
        ["responsible"],
        ["business-work:collect"],
        "刘敏",
        "2026-07-31T16:00:00+08:00",
      ),
    );
    expect(corrected.status).toBe("applied");
    if (corrected.status !== "applied") return;
    expect(corrected.item.reviewStatus).toBe("returned");
    const resubmitted = transitionBusinessWork(
      corrected.item,
      {
        type: "submit-document",
        version: corrected.item.submissionHistory[1],
      },
      context(
        ["responsible"],
        ["business-work:collect"],
        "刘敏",
        "2026-07-31T16:05:00+08:00",
      ),
    );
    expect(resubmitted.status).toBe("applied");
    if (resubmitted.status !== "applied") return;
    expect(resubmitted.item.documentStatus).toBe("submitted");
    expect(resubmitted.item.reviewStatus).toBe("pending");
    expect(resubmitted.item.submissionHistory).toHaveLength(2);

    const claimed = transitionBusinessWork(
      resubmitted.item,
      {
        type: "claim-review",
        event: {
          reviewEventId: "REVIEW-CLAIM-CORRECTION",
          submissionVersionId: "SUBMISSION-2",
          action: "claimed",
          reviewer: "赵晨",
          at: "2026-07-31T16:10:00+08:00",
          reason: null,
        },
      },
      context(
        ["reviewer"],
        ["business-work:review"],
        "赵晨",
        "2026-07-31T16:10:00+08:00",
      ),
    );
    expect(claimed.status).toBe("applied");
    if (claimed.status !== "applied") return;
    expect(claimed.item.reviewStatus).toBe("reviewing");
    expect(claimed.item.submissionHistory).toHaveLength(2);
    expect(claimed.item.reviewHistory.map(({ action }) => action)).toEqual([
      "returned",
      "claimed",
    ]);
  });

  it("rejects same-name actors whose governed user identity is not assigned", () => {
    const responsibleResult = transitionBusinessWork(
      workItem(),
      { type: "start-obligation", event: started },
      {
        ...context(["responsible"], ["business-work:collect"]),
        actorUserId: "same-name-responsible-impostor",
      },
    );
    expect(responsibleResult.status).toBe("rejected");

    const reviewResult = transitionBusinessWork(
      workItem({
        documentStatus: "submitted",
        reviewStatus: "pending",
        submissionHistory: [initialSubmission],
      }),
      {
        type: "claim-review",
        event: {
          reviewEventId: "REVIEW-CLAIM-SAME-NAME",
          submissionVersionId: "SUBMISSION-1",
          action: "claimed",
          reviewer: "赵晨",
          at: "2026-07-31T15:00:00+08:00",
          reason: null,
        },
      },
      {
        ...context(["reviewer"], ["business-work:review"], "赵晨"),
        actorUserId: "same-name-reviewer-impostor",
      },
    );
    expect(reviewResult.status).toBe("rejected");
  });

  it("keeps governed assignments valid after a person's display name changes", () => {
    const renamedResponsible = "刘敏（更新姓名）";
    const responsibleResult = transitionBusinessWork(
      workItem(),
      {
        type: "start-obligation",
        event: { ...started, actor: renamedResponsible },
      },
      {
        ...context(
          ["responsible"],
          ["business-work:collect"],
          renamedResponsible,
        ),
        actorUserId: "liu-min",
      },
    );
    expect(responsibleResult.status).toBe("applied");

    const renamedReviewer = "赵晨（更新姓名）";
    const reviewResult = transitionBusinessWork(
      workItem({
        documentStatus: "submitted",
        reviewStatus: "pending",
        submissionHistory: [initialSubmission],
      }),
      {
        type: "claim-review",
        event: {
          reviewEventId: "REVIEW-CLAIM-RENAMED",
          submissionVersionId: "SUBMISSION-1",
          action: "claimed",
          reviewer: renamedReviewer,
          at: "2026-07-31T15:00:00+08:00",
          reason: null,
        },
      },
      {
        ...context(["reviewer"], ["business-work:review"], renamedReviewer),
        actorUserId: "zhao-chen",
      },
    );
    expect(reviewResult.status).toBe("applied");
  });

  it.each([
    [
      "仅在命令中伪造责任角色",
      workItem(),
      { type: "start-obligation", event: started },
      context([], ["business-work:collect"]),
    ],
    [
      "有采集角色权限但不是任务指派人",
      workItem(),
      { type: "start-obligation", event: { ...started, actor: "其他填报人" } },
      context(["responsible"], ["business-work:collect"], "其他填报人"),
    ],
    [
      "有审核角色权限但不是任务指派审核人",
      workItem({
        documentStatus: "submitted",
        reviewStatus: "pending",
        submissionHistory: [initialSubmission],
      }),
      {
        type: "claim-review",
        event: {
          reviewEventId: "REVIEW-CLAIM-OTHER",
          submissionVersionId: "SUBMISSION-1",
          action: "claimed",
          reviewer: "其他审核人",
          at: "2026-07-31T15:00:00+08:00",
          reason: null,
        },
      },
      context(["reviewer"], ["business-work:review"], "其他审核人"),
    ],
    [
      "有说明角色权限但不是任务指派人",
      workItem({ qualityStatus: "warning" }),
      {
        type: "submit-quality-explanation",
        event: {
          qualityEventId: "QUALITY-EXPLAIN-OTHER",
          action: "explanation-submitted",
          ruleVersionId: "RULE-PRODUCTION-1",
          result: "awaiting-explanation",
          actor: "其他填报人",
          actorRoleId: "responsible",
          at: "2026-07-31T15:00:00+08:00",
          explanationVersionId: "EXPLANATION-OTHER",
        },
      },
      context(["responsible"], ["business-work:quality-explain"], "其他填报人"),
    ],
    [
      "质量说明提交事件不得伪造结果",
      workItem({ qualityStatus: "warning" }),
      {
        type: "submit-quality-explanation",
        event: {
          qualityEventId: "QUALITY-EXPLAIN-WRONG-RESULT",
          action: "explanation-submitted",
          ruleVersionId: "RULE-PRODUCTION-1",
          result: "passed",
          actor: "刘敏",
          actorRoleId: "responsible",
          at: "2026-07-31T15:00:00+08:00",
          explanationVersionId: "EXPLANATION-WRONG-RESULT",
        },
      },
      context(["responsible"], ["business-work:quality-explain"], "刘敏"),
    ],
    [
      "等待说明复核时不得重跑规则覆盖状态",
      workItem({ qualityStatus: "awaiting-explanation" }),
      {
        type: "run-quality-rules",
        event: {
          qualityEventId: "QUALITY-RERUN-WAITING",
          action: "rules-executed",
          ruleVersionId: "RULE-PRODUCTION-1",
          result: "passed",
          actor: "规则引擎",
          actorRoleId: "system",
          at: "2026-07-31T15:00:00+08:00",
          explanationVersionId: null,
        },
      },
      context(["system"], ["business-work:quality-rules"], "规则引擎"),
    ],
    [
      "退回质量说明不得伪造通过结果",
      workItem({
        qualityStatus: "awaiting-explanation",
        qualityHistory: [
          {
            qualityEventId: "QUALITY-RULES-RETURN-PASSED",
            action: "rules-executed",
            ruleVersionId: "RULE-PRODUCTION-1",
            result: "blocking",
            actor: "规则引擎",
            actorRoleId: "system",
            at: "2026-07-31T13:00:00+08:00",
            explanationVersionId: null,
          },
          {
            qualityEventId: "QUALITY-SUBMIT-RETURN-PASSED",
            action: "explanation-submitted",
            ruleVersionId: "RULE-PRODUCTION-1",
            result: "awaiting-explanation",
            actor: "刘敏",
            actorRoleId: "responsible",
            at: "2026-07-31T14:00:00+08:00",
            explanationVersionId: "EXPLANATION-RETURN-PASSED",
          },
        ],
      }),
      {
        type: "review-quality-explanation",
        event: {
          qualityEventId: "QUALITY-RETURN-PASSED",
          action: "explanation-returned",
          ruleVersionId: "RULE-PRODUCTION-1",
          result: "passed",
          actor: "孙悦",
          actorRoleId: "quality-reviewer",
          at: "2026-07-31T15:00:00+08:00",
          explanationVersionId: "EXPLANATION-RETURN-PASSED",
        },
      },
      context(["quality-reviewer"], ["business-work:quality-review"], "孙悦"),
    ],
    [
      "质量阻断时审核通过",
      workItem({
        documentStatus: "submitted",
        reviewStatus: "reviewing",
        qualityStatus: "blocking",
        submissionHistory: [initialSubmission],
      }),
      {
        type: "approve-review",
        event: {
          reviewEventId: "REVIEW-APPROVE-2",
          submissionVersionId: "SUBMISSION-1",
          action: "approved",
          reviewer: "赵晨",
          at: "2026-07-31T15:00:00+08:00",
          reason: null,
        },
      },
      context(["reviewer"], ["business-work:review"], "赵晨"),
    ],
    [
      "质量阻断时申请发布",
      workItem({
        documentStatus: "submitted",
        reviewStatus: "approved",
        qualityStatus: "blocking",
      }),
      {
        type: "request-release",
        event: {
          releaseEventId: "RELEASE-REQUEST-2",
          action: "requested",
          releaseVersionId: "PUB-PRODUCTION-2",
          actor: "周楠",
          at: "2026-07-31T15:00:00+08:00",
          replacesReleaseVersionId: null,
        },
      },
      context(["publisher"], ["business-work:release"], "周楠"),
    ],
    [
      "警告尚无本规则批准说明时申请发布",
      workItem({
        documentStatus: "submitted",
        reviewStatus: "approved",
        qualityStatus: "warning",
      }),
      {
        type: "request-release",
        event: {
          releaseEventId: "RELEASE-REQUEST-3",
          action: "requested",
          releaseVersionId: "PUB-PRODUCTION-3",
          actor: "周楠",
          at: "2026-07-31T15:00:00+08:00",
          replacesReleaseVersionId: null,
        },
      },
      context(["publisher"], ["business-work:release"], "周楠"),
    ],
    [
      "上游输入过期时申请发布",
      workItem({
        documentStatus: "submitted",
        reviewStatus: "approved",
        inputVersionState: "stale",
      }),
      {
        type: "request-release",
        event: {
          releaseEventId: "RELEASE-REQUEST-4",
          action: "requested",
          releaseVersionId: "PUB-PRODUCTION-4",
          actor: "周楠",
          at: "2026-07-31T15:00:00+08:00",
          replacesReleaseVersionId: null,
        },
      },
      context(["publisher"], ["business-work:release"], "周楠"),
    ],
    [
      "直接覆盖已发布结果",
      workItem({ releaseStatus: "published" }),
      {
        type: "publish",
        event: {
          releaseEventId: "RELEASE-PUBLISH-2",
          action: "published",
          releaseVersionId: "PUB-PRODUCTION-1",
          actor: "周楠",
          at: "2026-07-31T15:00:00+08:00",
          replacesReleaseVersionId: null,
        },
      },
      context(["publisher"], ["business-work:release"], "周楠"),
    ],
    [
      "已发布项回写上游过期",
      workItem({ releaseStatus: "published" }),
      { type: "mark-input-stale", at: "2026-07-31T15:00:00+08:00" },
      context(["system"], ["business-work:system"], "系统"),
    ],
    [
      "审核退回缺少原因",
      workItem({
        documentStatus: "submitted",
        reviewStatus: "reviewing",
        submissionHistory: [initialSubmission],
      }),
      {
        type: "return-review",
        event: {
          reviewEventId: "REVIEW-RETURN-NO-REASON",
          submissionVersionId: "SUBMISSION-1",
          action: "returned",
          reviewer: "赵晨",
          at: "2026-07-31T15:00:00+08:00",
          reason: null,
        },
      },
      context(["reviewer"], ["business-work:review"], "赵晨"),
    ],
    [
      "审核事件身份与上下文不一致",
      workItem({
        documentStatus: "submitted",
        reviewStatus: "reviewing",
        submissionHistory: [initialSubmission],
      }),
      {
        type: "return-review",
        event: {
          reviewEventId: "REVIEW-RETURN-ACTOR",
          submissionVersionId: "SUBMISSION-1",
          action: "returned",
          reviewer: "伪造审核人",
          at: "2026-07-31T15:00:00+08:00",
          reason: "退回",
        },
      },
      context(["reviewer"], ["business-work:review"], "赵晨"),
    ],
    [
      "审核事件未引用最新提交",
      workItem({
        documentStatus: "corrected",
        reviewStatus: "pending",
        submissionHistory: [
          initialSubmission,
          {
            submissionVersionId: "SUBMISSION-2",
            submittedBy: "刘敏",
            submittedAt: "2026-07-31T14:30:00+08:00",
            kind: "corrected",
            replacesSubmissionVersionId: "SUBMISSION-1",
          },
        ],
      }),
      {
        type: "claim-review",
        event: {
          reviewEventId: "REVIEW-CLAIM-OLD",
          submissionVersionId: "SUBMISSION-1",
          action: "claimed",
          reviewer: "赵晨",
          at: "2026-07-31T15:00:00+08:00",
          reason: null,
        },
      },
      context(["reviewer"], ["business-work:review"], "赵晨"),
    ],
    [
      "更正版本重复使用任一历史提交版本号",
      workItem({
        documentStatus: "returned",
        reviewStatus: "returned",
        submissionHistory: [
          initialSubmission,
          {
            submissionVersionId: "SUBMISSION-2",
            submittedBy: "刘敏",
            submittedAt: "2026-07-31T14:30:00+08:00",
            kind: "corrected",
            replacesSubmissionVersionId: "SUBMISSION-1",
          },
        ],
      }),
      {
        type: "correct-document",
        version: {
          submissionVersionId: "SUBMISSION-1",
          submittedBy: "刘敏",
          submittedAt: "2026-07-31T15:00:00+08:00",
          kind: "corrected",
          replacesSubmissionVersionId: "SUBMISSION-2",
        },
      },
      context(["responsible"], ["business-work:collect"], "刘敏"),
    ],
    [
      "旧批准说明不得放行新一轮质量警告",
      workItem({
        documentStatus: "submitted",
        reviewStatus: "approved",
        qualityStatus: "warning",
        qualityGovernance: {
          ruleVersionId: "RULE-PRODUCTION-1",
          warningPublicationPolicy: "allow-approved-explanation",
          approvedExplanationVersionIds: ["EXPLANATION-OLD"],
        },
        qualityHistory: [
          {
            qualityEventId: "QUALITY-APPROVED-OLD",
            action: "explanation-approved",
            ruleVersionId: "RULE-PRODUCTION-1",
            result: "warning",
            actor: "孙悦",
            actorRoleId: "quality-reviewer",
            at: "2026-07-31T13:00:00+08:00",
            explanationVersionId: "EXPLANATION-OLD",
          },
          {
            qualityEventId: "QUALITY-RULES-NEW",
            action: "rules-executed",
            ruleVersionId: "RULE-PRODUCTION-1",
            result: "warning",
            actor: "规则引擎",
            actorRoleId: "system",
            at: "2026-07-31T14:00:00+08:00",
            explanationVersionId: null,
          },
        ],
      }),
      {
        type: "request-release",
        event: {
          releaseEventId: "RELEASE-REQUEST-OLD-EXPLANATION",
          action: "requested",
          releaseVersionId: "PUB-PRODUCTION-OLD-EXPLANATION",
          actor: "周楠",
          at: "2026-07-31T15:00:00+08:00",
          replacesReleaseVersionId: null,
        },
      },
      context(["publisher"], ["business-work:release"], "周楠"),
    ],
    [
      "替代版本重复使用已发布版本号",
      workItem({
        releaseStatus: "published",
        releaseHistory: [
          {
            releaseEventId: "RELEASE-PUBLISHED-OLD",
            action: "published",
            releaseVersionId: "PUB-PRODUCTION-OLD",
            actor: "周楠",
            at: "2026-07-31T14:00:00+08:00",
            replacesReleaseVersionId: null,
          },
        ],
      }),
      {
        type: "replace-release",
        event: {
          releaseEventId: "RELEASE-REPLACE-SAME",
          action: "replaced",
          releaseVersionId: "PUB-PRODUCTION-OLD",
          actor: "周楠",
          at: "2026-07-31T15:00:00+08:00",
          replacesReleaseVersionId: "PUB-PRODUCTION-OLD",
        },
      },
      context(["publisher"], ["business-work:release"], "周楠"),
    ],
    [
      "替代版本重复使用更早历史版本号",
      workItem({
        releaseStatus: "published",
        releaseHistory: [
          {
            releaseEventId: "RELEASE-PUBLISHED-OLD",
            action: "published",
            releaseVersionId: "PUB-PRODUCTION-OLD",
            actor: "周楠",
            at: "2026-07-31T13:00:00+08:00",
            replacesReleaseVersionId: null,
          },
          {
            releaseEventId: "RELEASE-PUBLISHED-CURRENT",
            action: "published",
            releaseVersionId: "PUB-PRODUCTION-CURRENT",
            actor: "周楠",
            at: "2026-07-31T14:00:00+08:00",
            replacesReleaseVersionId: "PUB-PRODUCTION-OLD",
          },
        ],
      }),
      {
        type: "replace-release",
        event: {
          releaseEventId: "RELEASE-REPLACE-HISTORICAL",
          action: "replaced",
          releaseVersionId: "PUB-PRODUCTION-OLD",
          actor: "周楠",
          at: "2026-07-31T15:00:00+08:00",
          replacesReleaseVersionId: "PUB-PRODUCTION-CURRENT",
        },
      },
      context(["publisher"], ["business-work:release"], "周楠"),
    ],
    [
      "替代版本未精确引用当前已发布版本",
      workItem({
        releaseStatus: "published",
        releaseHistory: [
          {
            releaseEventId: "RELEASE-PUBLISHED-CURRENT",
            action: "published",
            releaseVersionId: "PUB-PRODUCTION-CURRENT",
            actor: "周楠",
            at: "2026-07-31T14:00:00+08:00",
            replacesReleaseVersionId: null,
          },
        ],
      }),
      {
        type: "replace-release",
        event: {
          releaseEventId: "RELEASE-REPLACE-WRONG",
          action: "replaced",
          releaseVersionId: "PUB-PRODUCTION-NEW",
          actor: "周楠",
          at: "2026-07-31T15:00:00+08:00",
          replacesReleaseVersionId: "PUB-PRODUCTION-OTHER",
        },
      },
      context(["publisher"], ["business-work:release"], "周楠"),
    ],
    [
      "质量阻断时不得替代已发布版本",
      workItem({
        documentStatus: "submitted",
        reviewStatus: "approved",
        qualityStatus: "blocking",
        releaseStatus: "published",
        releaseHistory: [
          {
            releaseEventId: "RELEASE-PUBLISHED-BLOCKING",
            action: "published",
            releaseVersionId: "PUB-PRODUCTION-BLOCKING",
            actor: "周楠",
            at: "2026-07-31T14:00:00+08:00",
            replacesReleaseVersionId: null,
          },
        ],
      }),
      {
        type: "replace-release",
        event: {
          releaseEventId: "RELEASE-REPLACE-BLOCKING",
          action: "replaced",
          releaseVersionId: "PUB-PRODUCTION-BLOCKING-NEW",
          actor: "周楠",
          at: "2026-07-31T15:00:00+08:00",
          replacesReleaseVersionId: "PUB-PRODUCTION-BLOCKING",
        },
      },
      context(["publisher"], ["business-work:release"], "周楠"),
    ],
    [
      "输入过期时不得替代已发布版本",
      workItem({
        documentStatus: "submitted",
        reviewStatus: "approved",
        inputVersionState: "stale",
        releaseStatus: "published",
        releaseHistory: [
          {
            releaseEventId: "RELEASE-PUBLISHED-STALE",
            action: "published",
            releaseVersionId: "PUB-PRODUCTION-STALE",
            actor: "周楠",
            at: "2026-07-31T14:00:00+08:00",
            replacesReleaseVersionId: null,
          },
        ],
      }),
      {
        type: "replace-release",
        event: {
          releaseEventId: "RELEASE-REPLACE-STALE",
          action: "replaced",
          releaseVersionId: "PUB-PRODUCTION-STALE-NEW",
          actor: "周楠",
          at: "2026-07-31T15:00:00+08:00",
          replacesReleaseVersionId: "PUB-PRODUCTION-STALE",
        },
      },
      context(["publisher"], ["business-work:release"], "周楠"),
    ],
    [
      "未审核通过时不得替代已发布版本",
      workItem({
        documentStatus: "submitted",
        reviewStatus: "reviewing",
        releaseStatus: "published",
        releaseHistory: [
          {
            releaseEventId: "RELEASE-PUBLISHED-REVIEWING",
            action: "published",
            releaseVersionId: "PUB-PRODUCTION-REVIEWING",
            actor: "周楠",
            at: "2026-07-31T14:00:00+08:00",
            replacesReleaseVersionId: null,
          },
        ],
      }),
      {
        type: "replace-release",
        event: {
          releaseEventId: "RELEASE-REPLACE-REVIEWING",
          action: "replaced",
          releaseVersionId: "PUB-PRODUCTION-REVIEWING-NEW",
          actor: "周楠",
          at: "2026-07-31T15:00:00+08:00",
          replacesReleaseVersionId: "PUB-PRODUCTION-REVIEWING",
        },
      },
      context(["publisher"], ["business-work:release"], "周楠"),
    ],
  ] as const)("拒绝非法迁移：%s", (_name, item, command, transitionContext) => {
    const result = transitionBusinessWork(item, command, transitionContext);
    expect(result.status).toBe("rejected");
    if (result.status === "rejected") expect(result.reason).not.toHaveLength(0);
    expect(result.item).toBe(item);
  });
});
