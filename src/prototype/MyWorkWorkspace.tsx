import { useState } from "react";
import { createFormalRoute, type FormalRoute, type FormalSelection, type WorkSection } from "./formalEnterpriseModel";
import type { BusinessCoordinates } from "./formalEnterpriseModel";
import type { OperationalScope } from "./core/operationalScope";
import { businessClassificationFixtures } from "./formalEnterpriseData";
import {
  BusinessContextBar,
  WorkspaceHeader,
  WorkspacePagination,
  WorkspaceStatus,
  WorkspaceInlineStats,
  WorkspaceTable,
  WorkspaceTableToolbar,
  WorkspaceTabs,
  WorkspaceScopeBar,
  WorkspaceRegionSelect,
  FormalWorkspaceScopeProvider,
} from "./UnifiedWorkspacePrimitives";

interface PersonalTask {
  title: string;
  business: string;
  region: string;
  deadline: string;
  duty: string;
  document: string;
  quality: string;
  publication: string;
  destination: FormalRoute;
  action: string;
  group: "reporting" | "review" | "exception" | "completed";
}

export function FormalMyWorkWorkspace({
  section,
  scope,
  onScopeChange,
  onOpenBusiness,
}: {
  section: WorkSection;
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  onOpenBusiness: (route: FormalRoute, selection?: FormalSelection) => void;
}) {
  return <FormalWorkspaceScopeProvider scope={scope} onScopeChange={onScopeChange} classificationOptions={businessClassificationFixtures.workItems}><MyWorkWorkspace section={section} onOpenBusiness={onOpenBusiness} /></FormalWorkspaceScopeProvider>;
}

const personalTasks: readonly PersonalTask[] = [
  {
    title: "齐齐哈尔市玉米市场运行周填报",
    business: "市场监测",
    region: "齐齐哈尔指定范围",
    deadline: "今天 17:00",
    duty: "未到期",
    document: "填写中",
    quality: "2 项警告",
    publication: "未发布",
    destination: createFormalRoute("market", "tasks"),
    action: "进入市场填报",
    group: "reporting",
  },
  {
    title: "讷河市稻谷产情与质量调查",
    business: "产情监测",
    region: "讷河市",
    deadline: "今天 17:00",
    duty: "未到期",
    document: "已退回",
    quality: "1 项阻断",
    publication: "未发布",
    destination: createFormalRoute("production", "tasks"),
    action: "进入产情填报",
    group: "exception",
  },
  {
    title: "龙江县玉米收购与库存报送",
    business: "市场监测",
    region: "龙江县",
    deadline: "今天 14:00",
    duty: "按时提交",
    document: "已提交",
    quality: "通过",
    publication: "待审核",
    destination: createFormalRoute("market", "tasks"),
    action: "进入市场审核",
    group: "review",
  },
  {
    title: "第 30 周玉米产情正式结果",
    business: "产情监测",
    region: "齐齐哈尔指定范围",
    deadline: "已完成",
    duty: "按时提交",
    document: "已通过",
    quality: "通过",
    publication: "已发布",
    destination: createFormalRoute("production", "tasks"),
    action: "查看产情记录",
    group: "completed",
  },
];

function toneFor(value: string) {
  if (value.includes("阻断") || value.includes("逾期")) return "danger";
  if (
    value.includes("待") ||
    value.includes("退回") ||
    value.includes("警告")
  ) {
    return "warning";
  }
  if (
    value.includes("通过") ||
    value.includes("发布") ||
    value.includes("按时")
  ) {
    return "good";
  }
  return "normal";
}

export function MyWorkWorkspace({
  section,
  onOpenBusiness,
}: {
  section: WorkSection;
  onOpenBusiness: (route: FormalRoute, selection?: FormalSelection) => void;
}) {
  if (section === "tasks") return <MyWorkTaskViews onOpenBusiness={onOpenBusiness} />;
  return null;
}

function MyWorkList({ section, onOpenBusiness }: { section: "inbox" | PersonalTask["group"]; onOpenBusiness: (route: FormalRoute, selection?: FormalSelection) => void }) {
  const selectedGroup = section === "inbox" ? null : section;
  const visibleTasks = selectedGroup ? personalTasks.filter((task) => task.group === selectedGroup) : personalTasks.filter((task) => task.group !== "completed");
  const titles: Record<"inbox" | PersonalTask["group"], [string, string]> = {
    inbox: ["待我处理", "按截止时间和风险统一安排本人工作"],
    reporting: ["待我填报", "从任务直接进入产情或市场原始业务单据"],
    review: ["待我审核", "审核人员只能审核、退回和填写审核意见"],
    exception: ["异常与逾期", "集中处理退回、质量阻断和已固定逾期记录"],
    completed: ["已办跟踪", "查看本人已完成事项及其后续发布状态"],
  };

  return (
    <div className="unified-workspace">
      <WorkspaceHeader
        eyebrow="统一工作门户 / 我的工作"
        title={titles[section][0]}
        summary={titles[section][1]}
        actions={
          <>
            <button type="button">查看本人责任</button>
            <button className="is-primary" type="button">
              刷新任务
            </button>
          </>
        }
      />
      <BusinessContextBar
        items={[
          ["当前人员", "王洋 · 区域数据管理员"],
          ["责任范围", "齐齐哈尔指定范围"],
          ["当前期间", "2026 年第 31 周"],
          ["最近截止", "今天 17:00"],
        ]}
        state="责任岗位有效"
      />
      <WorkspaceScopeBar
        items={[["任务范围", <WorkspaceRegionSelect key="work-region" />], ["任务期间", "2026 年第 31 周"]]}
      />
      <WorkspaceInlineStats
        label="本人工作摘要"
        items={[
          {
            label: "待我填报",
            value: "3 项",
            note: "仅本人具有填写权限",
            tone: "warning",
          },
          {
            label: "待我审核",
            value: "7 项",
            note: "最早截止今天 14:00",
          },
          {
            label: "异常与逾期",
            value: "2 项",
            note: "逾期记录不可覆盖",
            tone: "danger",
          },
          {
            label: "本月按时率",
            value: "96.8%",
            note: "按固定截止快照统计",
            tone: "good",
          },
        ]}
      />
      <WorkspaceTableToolbar
        title="统一任务清单"
        note="进入任务后打开所属业务的同一份单据"
      />
      <WorkspaceTable
        columns={[
          "任务与业务",
          "责任区域",
          "截止",
          "履责状态",
          "单据状态",
          "质量状态",
          "操作",
        ]}
        label="本人责任任务"
        rows={visibleTasks.map((task) => [
          <div key={`${task.title}-title`}>
            <strong>{task.title}</strong>
            <p>{task.business}</p>
          </div>,
          task.region,
          task.deadline,
          <WorkspaceStatus key={`${task.title}-duty`} tone={toneFor(task.duty)}>
            {task.duty}
          </WorkspaceStatus>,
          <WorkspaceStatus
            key={`${task.title}-document`}
            tone={toneFor(task.document)}
          >
            {task.document}
          </WorkspaceStatus>,
          <WorkspaceStatus
            key={`${task.title}-quality`}
            tone={toneFor(task.quality)}
          >
            {task.quality}
          </WorkspaceStatus>,
          <button
            className="unified-table-action"
            key={`${task.title}-action`}
            type="button"
            onClick={() => onOpenBusiness(task.destination)}
          >
            {task.action}
          </button>,
        ])}
      />
      <WorkspacePagination
        end={visibleTasks.length}
        page={1}
        pages={1}
        start={1}
        total={visibleTasks.length}
      />
      <WorkspaceTableToolbar
        title="今日重点事项"
        note="按风险等级和剩余处理时间排序"
      />
      <WorkspaceTable
        columns={["事项", "处理要求", "状态"]}
        label="今日重点事项"
        rows={[
          [
            "讷河市稻谷质量依据待补",
            "出米率检验单缺失，责任人需在今天 16:00 前补充",
            <WorkspaceStatus key="paddy-evidence" tone="danger">
              阻断
            </WorkspaceStatus>,
          ],
          [
            "甘南县库存周报已记录逾期",
            "补填后保留原截止未提交记录和补填时间",
            <WorkspaceStatus key="inventory-overdue" tone="danger">
              逾期
            </WorkspaceStatus>,
          ],
          [
            "龙江县市场报送等待审核",
            "价格、数量和质量条件均已完成校验",
            <WorkspaceStatus key="market-review" tone="warning">
              待审核
            </WorkspaceStatus>,
          ],
        ]}
      />
    </div>
  );
}

function MyWorkTaskViews({ onOpenBusiness }: { onOpenBusiness: (route: FormalRoute, selection?: FormalSelection) => void }) {
  const [subview, setSubview] = useState<"inbox" | PersonalTask["group"]>("inbox");
  return (
    <div>
      <WorkspaceTabs label="我的工作子视图" active={subview} onChange={(key) => setSubview(key as typeof subview)} tabs={[{ key: "inbox", label: "待我处理" }, { key: "reporting", label: "待我填报" }, { key: "review", label: "待我审核" }, { key: "exception", label: "异常与逾期" }, { key: "completed", label: "已办跟踪" }]} />
      <div aria-labelledby={`我的工作子视图-${subview}-tab`} id={`我的工作子视图-${subview}-panel`} role="tabpanel">
        <MyWorkList section={subview} onOpenBusiness={onOpenBusiness} />
      </div>
    </div>
  );
}
