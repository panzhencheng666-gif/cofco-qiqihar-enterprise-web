import { useState } from "react";
import type { BusinessReportContext } from "./businessReportModel";
import {
  businessReportRows,
  dutyMonthlyRows,
  dutyWeeklyRows,
  responsibilityAssignments,
} from "./formalEnterpriseData";
import type { ReportingSection } from "./formalEnterpriseModel";
import {
  BusinessContextBar,
  CompactMetricStrip,
  WorkspaceHeader,
  WorkspacePanel,
  WorkspaceStatus,
  WorkspaceTable,
  type WorkspaceTone,
} from "./UnifiedWorkspacePrimitives";

const reportContext: BusinessReportContext = {
  application: "market",
  applicationLabel: "市场监测",
  product: "玉米",
  region: "齐齐哈尔市全域",
  regionLevel: "地市级",
  period: "2026 年第 31 周",
  dataCutoff: "2026-07-31 17:00",
  dataVersion: "第 31 周已核定数据",
  author: "市场分析岗",
  reviewer: "报告复核岗",
};

function toneFor(value: string): WorkspaceTone {
  if (
    value.includes("未提交") ||
    value.includes("逾期") ||
    value.includes("替代")
  ) {
    return "danger";
  }
  if (
    value.includes("等待") ||
    value.includes("生成") ||
    value.includes("复核")
  ) {
    return "warning";
  }
  if (
    value.includes("按时") ||
    value.includes("发布") ||
    value.includes("通过")
  ) {
    return "good";
  }
  return "normal";
}

function ReportContext({
  state,
}: {
  state: string;
}) {
  return (
    <BusinessContextBar
      items={[
        ["所选业务", reportContext.applicationLabel],
        ["地区与产品", `${reportContext.region} · ${reportContext.product}`],
        ["报告期间", reportContext.period],
        ["采用版本", reportContext.dataVersion],
      ]}
      state={state}
    />
  );
}

function BusinessReports({
  onComposeReport,
}: {
  onComposeReport: (context: BusinessReportContext) => void;
}) {
  return (
    <div className="unified-workspace">
      <WorkspaceHeader
        actions={
          <>
            <button type="button">报告口径说明</button>
            <button className="is-primary" type="button">
              新建报告
            </button>
          </>
        }
        eyebrow="报表中心 / 业务报告"
        summary="按业务、地区、产品、期间和已核定数据版本生成报告，不复制原始业务数据。"
        title="业务报告"
      />
      <ReportContext state="报告上下文已锁定" />
      <section
        aria-label="业务报告生成条件"
        className="report-context-composer"
      >
        <div>
          <small>业务</small>
          <strong>市场监测</strong>
        </div>
        <div>
          <small>地区</small>
          <strong>齐齐哈尔市全域</strong>
        </div>
        <div>
          <small>产品</small>
          <strong>玉米</strong>
        </div>
        <div>
          <small>期间</small>
          <strong>2026 年第 31 周</strong>
        </div>
        <div>
          <small>数据版本</small>
          <strong>第 31 周已核定数据</strong>
        </div>
        <div className="report-frequency-actions">
          {(["日报", "周报", "月报"] as const).map((frequency) => (
            <button
              key={frequency}
              type="button"
              onClick={() => onComposeReport(reportContext)}
            >
              生成{frequency}
            </button>
          ))}
        </div>
      </section>
      <CompactMetricStrip
        metrics={[
          {
            label: "本期报告",
            value: "24",
            unit: "份",
            note: "业务报告统一登记",
          },
          {
            label: "等待复核",
            value: "4",
            unit: "份",
            note: "复核通过后方可发布",
            tone: "warning",
          },
          {
            label: "已发布",
            value: "18",
            unit: "份",
            note: "正式版本可追溯",
            tone: "good",
          },
          {
            label: "等待替代",
            value: "2",
            unit: "份",
            note: "修订版发布后替代旧版",
            tone: "danger",
          },
        ]}
      />
      <WorkspacePanel
        actions={
          <>
            <button type="button">导出目录</button>
            <button type="button">筛选</button>
          </>
        }
        kicker="报告台账"
        note="报告只引用已核定数据版本；发布后形成不可覆盖的正式版本。"
        title="业务报告清单"
      >
        <WorkspaceTable
          columns={[
            "报告名称",
            "周期",
            "范围",
            "报告期间",
            "采用数据",
            "状态",
            "责任岗位",
            "发布时间",
            "操作",
          ]}
          label="业务报告清单"
          rows={businessReportRows.map((row) => [
            <strong key={`${row.name}-name`}>{row.name}</strong>,
            row.frequency,
            row.scope,
            row.period,
            row.dataVersion,
            <WorkspaceStatus key={`${row.name}-state`} tone={toneFor(row.status)}>
              {row.status}
            </WorkspaceStatus>,
            row.owner,
            row.publishedAt,
            <button className="unified-row-action" key={`${row.name}-action`}>
              查看
            </button>,
          ])}
        />
        <footer className="unified-table-footer">
          <span>共 24 份报告 · 当前显示 1–4</span>
          <div>
            <button type="button">上一页</button>
            <strong>1</strong>
            <button type="button">下一页</button>
          </div>
        </footer>
      </WorkspacePanel>
    </div>
  );
}

function DutyReports() {
  const [view, setView] = useState<"weekly" | "monthly">("weekly");
  return (
    <div className="unified-workspace">
      <WorkspaceHeader
        actions={
          <>
            <button type="button">导出责任周报</button>
            <button type="button">导出责任月报</button>
            <button className="is-primary" type="button">
              维护责任配置
            </button>
          </>
        }
        eyebrow="报表中心 / 履责报告"
        summary="监督责任人是否按时完成所属区域任务；不在这里重复填写产情或市场业务值。"
        title="填报履责监督"
      />
      <ReportContext state="第 31 周责任快照已固定" />
      <section aria-label="填报责任规则" className="duty-rule-strip">
        <article>
          <small>责任归属</small>
          <strong>一人一责区</strong>
          <p>责任配置按人员、区域、业务和有效期生效</p>
        </article>
        <article>
          <small>填写权限</small>
          <strong>他人无权代填</strong>
          <p>管理员可以催办和重派未来任务，不能代替责任人填写</p>
        </article>
        <article>
          <small>任务频率</small>
          <strong>每周填报一次</strong>
          <p>按周生成任务并固定截止时间</p>
        </article>
        <article className="is-warning">
          <small>逾期规则</small>
          <strong>逾期补填保留原逾期记录</strong>
          <p>补报不覆盖截止快照，周报和月报均可追溯</p>
        </article>
      </section>
      <CompactMetricStrip
        label="本周履责指标"
        metrics={[
          {
            label: "本周应报",
            value: "428",
            unit: "项",
            note: "免报任务不计入应报",
          },
          {
            label: "按时完成",
            value: "395",
            unit: "项",
            note: "首次合格提交在截止前",
            tone: "good",
          },
          {
            label: "截止未提交",
            value: "26",
            unit: "项",
            note: "逾期状态已经固定",
            tone: "danger",
          },
          {
            label: "逾期后补填",
            value: "7",
            unit: "项",
            note: "原逾期记录继续保留",
            tone: "warning",
          },
        ]}
      />
      <WorkspacePanel
        actions={
          <div className="unified-mode-switch" aria-label="履责统计周期">
            <button
              aria-pressed={view === "weekly"}
              className={view === "weekly" ? "is-active" : undefined}
              type="button"
              onClick={() => setView("weekly")}
            >
              周度履责
            </button>
            <button
              aria-pressed={view === "monthly"}
              className={view === "monthly" ? "is-active" : undefined}
              type="button"
              onClick={() => setView("monthly")}
            >
              月度履责
            </button>
          </div>
        }
        kicker="责任监督"
        note={
          view === "weekly"
            ? "以任务截止快照为准，显示首次合格提交和补填情况。"
            : "按责任人汇总应报、按时、逾期、缺报和退回次数。"
        }
        title={view === "weekly" ? "第 31 周履责明细" : "2026 年 7 月履责汇总"}
      >
        {view === "weekly" ? (
          <WorkspaceTable
            columns={[
              "责任人",
              "责任区域",
              "业务事项",
              "规定截止",
              "首次合格提交",
              "履责状态",
              "逾期时长",
              "审核结果",
            ]}
            label="填报履责记录"
            rows={dutyWeeklyRows.map((row) => [
              <strong key={`${row.person}-${row.region}`}>{row.person}</strong>,
              row.region,
              row.item,
              row.deadline,
              row.firstQualifiedSubmission,
              <WorkspaceStatus
                key={`${row.person}-${row.status}`}
                tone={toneFor(row.status)}
              >
                {row.status}
              </WorkspaceStatus>,
              row.overdueDuration,
              row.review,
            ])}
          />
        ) : (
          <WorkspaceTable
            columns={[
              "责任人",
              "责任区域",
              "应报",
              "按时",
              "逾期",
              "缺报",
              "退回",
              "按时率",
              "趋势",
            ]}
            label="月度履责记录"
            rows={dutyMonthlyRows.map((row) => [
              <strong key={`${row.person}-${row.region}`}>{row.person}</strong>,
              row.region,
              row.expected,
              row.onTime,
              row.overdue,
              row.missing,
              row.returned,
              row.onTimeRate,
              row.trend,
            ])}
          />
        )}
      </WorkspacePanel>
      <WorkspacePanel
        actions={<button type="button">导出责任配置</button>}
        kicker="责任配置"
        note="责任配置决定任务归属和填写权限；历史配置按有效期保留。"
        title="有效责任关系"
      >
        <WorkspaceTable
          columns={[
            "区域",
            "业务事项",
            "频率",
            "责任人",
            "责任岗位",
            "审核人",
            "截止规则",
            "有效期",
            "状态",
          ]}
          label="填报责任配置"
          rows={responsibilityAssignments.map((row) => [
            row.region,
            row.businessItem,
            row.frequency,
            <strong key={`${row.id}-person`}>{row.responsiblePerson}</strong>,
            row.responsiblePost,
            row.reviewer,
            row.deadlineRule,
            row.effectivePeriod,
            <WorkspaceStatus key={`${row.id}-state`} tone={toneFor(row.status)}>
              {row.status}
            </WorkspaceStatus>,
          ])}
        />
      </WorkspacePanel>
    </div>
  );
}

function ReviewWorkspace() {
  return (
    <div className="unified-workspace">
      <WorkspaceHeader
        actions={<button className="is-primary">批量复核</button>}
        eyebrow="报表中心 / 报告复核"
        summary="复核报告结论、引用数据版本、地区产品口径和敏感信息。"
        title="报告复核"
      />
      <ReportContext state="4 份报告等待复核" />
      <WorkspacePanel
        kicker="复核队列"
        note="复核不修改原始业务值；数据问题退回所属业务重新审核。"
        title="待复核报告"
      >
        <WorkspaceTable
          columns={[
            "报告",
            "业务",
            "数据版本",
            "结论校核",
            "口径校核",
            "责任岗位",
            "操作",
          ]}
          label="待复核报告"
          rows={[
            [
              "齐齐哈尔玉米市场运行日报",
              "市场监测",
              "7 月 31 日已核定数据",
              <WorkspaceStatus tone="warning">待复核</WorkspaceStatus>,
              "通过",
              "市场分析岗",
              <button className="unified-row-action">开始复核</button>,
            ],
            [
              "齐齐哈尔玉米产情监测周报",
              "产情监测",
              "第 31 周已核定数据",
              "通过",
              <WorkspaceStatus tone="warning">1 项待说明</WorkspaceStatus>,
              "产情分析岗",
              <button className="unified-row-action">开始复核</button>,
            ],
          ]}
        />
      </WorkspacePanel>
    </div>
  );
}

function DistributionWorkspace() {
  return (
    <div className="unified-workspace">
      <WorkspaceHeader
        actions={<button className="is-primary">新建发布任务</button>}
        eyebrow="报表中心 / 发布与分发"
        summary="统一控制报告发布范围、接收对象、发布时间和替代关系。"
        title="发布与分发"
      />
      <ReportContext state="发布渠道正常" />
      <WorkspacePanel
        kicker="发布计划"
        note="仅已复核的正式报告可以进入发布计划。"
        title="报告分发任务"
      >
        <WorkspaceTable
          columns={[
            "报告",
            "发布范围",
            "接收对象",
            "发布时间",
            "替代版本",
            "状态",
            "操作",
          ]}
          label="报告分发任务"
          rows={[
            [
              "齐齐哈尔粮食商情月报",
              "东北区域经营中心",
              "经营管理层、区域业务岗",
              "7 月 30 日 17:20",
              "2026 年 6 月版",
              <WorkspaceStatus tone="good">已发布</WorkspaceStatus>,
              <button className="unified-row-action">查看回执</button>,
            ],
            [
              "齐齐哈尔玉米市场运行日报",
              "齐齐哈尔授权范围",
              "经营管理层、市场业务岗",
              "计划今日 18:30",
              "—",
              <WorkspaceStatus tone="warning">等待复核</WorkspaceStatus>,
              <button className="unified-row-action">查看计划</button>,
            ],
          ]}
        />
      </WorkspacePanel>
    </div>
  );
}

function VersionWorkspace() {
  return (
    <div className="unified-workspace">
      <WorkspaceHeader
        actions={<button type="button">导出版本目录</button>}
        eyebrow="报表中心 / 历史版本"
        summary="查询报告生成、复核、发布和替代全过程，正式版本不可覆盖。"
        title="报告历史版本"
      />
      <ReportContext state="版本链完整" />
      <WorkspacePanel
        kicker="版本台账"
        note="同一报告的修订版通过替代关系关联，原发布版继续留痕。"
        title="正式报告版本"
      >
        <WorkspaceTable
          columns={[
            "报告",
            "版本",
            "生成时间",
            "复核时间",
            "发布时间",
            "当前效力",
            "操作",
          ]}
          label="报告历史版本"
          rows={[
            [
              "齐齐哈尔粮食商情月报",
              "2026-07 · 正式版",
              "7 月 30 日 15:10",
              "7 月 30 日 16:48",
              "7 月 30 日 17:20",
              <WorkspaceStatus tone="good">当前有效</WorkspaceStatus>,
              <button className="unified-row-action">查看版本</button>,
            ],
            [
              "齐齐哈尔粮食商情月报",
              "2026-06 · 正式版",
              "6 月 30 日 15:04",
              "6 月 30 日 16:30",
              "6 月 30 日 17:00",
              <WorkspaceStatus>已被替代</WorkspaceStatus>,
              <button className="unified-row-action">查看版本</button>,
            ],
          ]}
        />
      </WorkspacePanel>
    </div>
  );
}

export function ReportCenterWorkspace({
  section,
  onComposeReport,
}: {
  section: ReportingSection;
  onComposeReport: (context: BusinessReportContext) => void;
}) {
  if (section === "duty-reports") return <DutyReports />;
  if (section === "review") return <ReviewWorkspace />;
  if (section === "distribution") return <DistributionWorkspace />;
  if (section === "versions") return <VersionWorkspace />;
  return <BusinessReports onComposeReport={onComposeReport} />;
}
