import { useState } from "react";

import type { BusinessWorkItem } from "../core/businessWork";
import type { ProductionDocumentFixture } from "../data/productionDocumentFixtures";
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
  corrected: "已更正",
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
  superseded: "已被新版本替代",
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

export function ProductionDocumentWorkbench({
  document,
  item,
  itemTitle,
}: {
  document: ProductionDocumentFixture;
  item: BusinessWorkItem;
  itemTitle: string;
}) {
  const [mode, setMode] =
    useState<ProductionDocumentFixture["collectionChannels"][number]["mode"]>(
      "online",
    );
  const channel = document.collectionChannels.find(
    (item) => item.mode === mode,
  );
  if (!channel) {
    return <div role="alert">采集方式配置待维护</div>;
  }
  const latestSubmission = item.submissionHistory.at(-1);
  const latestReview = item.reviewHistory.at(-1);
  const latestQuality = item.qualityHistory.at(-1);
  const latestRelease = item.releaseHistory.at(-1);
  return (
    <section
      aria-label={`${itemTitle}单据工作台`}
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
          {document.collectionChannels.map((item) => (
            <button
              aria-pressed={item.mode === mode}
              className={item.mode === mode ? "is-active" : undefined}
              key={item.mode}
              type="button"
              onClick={() => setMode(item.mode)}
            >
              {item.label}
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
        <p role="status">{channel.instruction}</p>
      </section>
      <section
        aria-label="单据与审核流程"
        className="production-task5-lifecycle"
      >
        <header>
          <div>
            <span>同一工作项生命周期</span>
            <h3>单据与审核流程</h3>
          </div>
          <p>审核通过不等于发布，五个状态维度分别保存。</p>
        </header>
        <dl className="production-task5-responsibility">
          <div>
            <dt>责任人</dt>
            <dd>
              {item.responsiblePerson || "责任人待维护"} ·{" "}
              {item.responsiblePost || "岗位待维护"}
            </dd>
          </div>
          <div>
            <dt>责任事项</dt>
            <dd>{item.dutyLabel || "责任事项待维护"}</dd>
          </div>
          <div>
            <dt>业务截止</dt>
            <dd>{formatProductionDateTime(item.deadline)}</dd>
          </div>
          <div>
            <dt>字段完成</dt>
            <dd>
              {item.completedFields}/{item.applicableFields} 项
            </dd>
          </div>
        </dl>
        <div
          aria-label="任务五状态"
          className="production-task5-lifecycle-states"
        >
          <span>
            <small>义务状态</small>
            <strong>{obligationLabels[item.obligationStatus]}</strong>
          </span>
          <span>
            <small>单据状态</small>
            <strong>{documentLabels[item.documentStatus]}</strong>
          </span>
          <span>
            <small>审核状态</small>
            <strong>{reviewLabels[item.reviewStatus]}</strong>
          </span>
          <span>
            <small>质量状态</small>
            <strong>{qualityLabels[item.qualityStatus]}</strong>
          </span>
          <span>
            <small>发布状态</small>
            <strong>{releaseLabels[item.releaseStatus]}</strong>
          </span>
        </div>
        <div className="production-task5-audit-grid">
          <section>
            <h4>最近提交</h4>
            {latestSubmission ? (
              <p>
                {submissionKindLabels[latestSubmission.kind]} ·{" "}
                {latestSubmission.submittedBy || "提交人待维护"} ·{" "}
                {formatProductionDateTime(latestSubmission.submittedAt)}
              </p>
            ) : (
              <p>尚未形成提交记录</p>
            )}
          </section>
          <section>
            <h4>最近审核</h4>
            {latestReview ? (
              <p>
                {reviewActionLabels[latestReview.action]} ·{" "}
                {latestReview.reviewer || "审核人待维护"} ·{" "}
                {formatProductionDateTime(latestReview.at)}
              </p>
            ) : (
              <p>尚未形成审核记录</p>
            )}
            {latestReview?.reason && (
              <p>
                <strong>审核意见：</strong>
                {latestReview.reason}
              </p>
            )}
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
                ? `${releaseLabels[item.releaseStatus]} · ${latestRelease.actor || "发布人待维护"} · ${formatProductionDateTime(latestRelease.at)}`
                : "尚未申请发布"}
            </p>
          </section>
        </div>
      </section>
      {mode === "online" ? (
        <div className="production-task5-field-groups">
          {document.fieldGroups.map((group) => (
            <section
              className="production-task5-field-group"
              key={group.groupId}
            >
              <h3>{group.label}</h3>
              <dl>
                {group.fields.map((field) => (
                  <div key={field.fieldId}>
                    <dt>{field.label}</dt>
                    <dd>{field.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      ) : (
        <div className="production-task5-channel-workflow" role="status">
          <strong>{channel.instruction}</strong>
          <span>{channel.validationResult}</span>
        </div>
      )}
      <footer>
        <span>最近保存：{document.lastSavedLabel}</span>
      </footer>
    </section>
  );
}
