import { useNavigate, useSearchParams } from "react-router";
import {
  EnterpriseEmpty,
  EnterpriseFailure,
  EnterpriseLoading,
  EnterpriseMetricGrid,
  EnterprisePage,
  EnterpriseStatusTag,
  EnterpriseTable,
  EnterpriseTextAction,
  type EnterpriseColumn,
} from "@/shared/enterprise-ui";
import type { MyWorkItem } from "@/workflows/my-work/model";
import {
  buildMyWorkSummary,
  filterMyWork,
  isMyWorkCompleted,
  resolveMyWorkViewState,
} from "@/workflows/my-work/view-state";
import { useMyWork } from "@/workflows/my-work/useMyWork";

function tagTone(item: MyWorkItem) {
  if (item.qualityStatus === "阻断") return "danger" as const;
  if (
    item.timeliness === "仍未提交" ||
    item.timeliness === "逾期补填" ||
    item.qualityStatus === "警告"
  ) {
    return "warning" as const;
  }
  if (isMyWorkCompleted(item)) return "success" as const;
  return "default" as const;
}

export function MyWorkPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = useMyWork();
  const currentView = searchParams.get("view");
  const rows = filterMyWork(query.rows, currentView);
  const summary = buildMyWorkSummary(query.rows);
  const queueTitle =
    currentView === "reporting"
      ? "待我填报"
      : currentView === "review"
        ? "待我审核"
        : currentView === "exception"
          ? "异常与逾期"
          : currentView === "completed"
            ? "已办跟踪"
            : "任务总览";
  const viewState = resolveMyWorkViewState({
    isLoading: query.isLoading,
    isError: query.isError,
    itemCount: rows.length,
  });
  const columns: EnterpriseColumn<MyWorkItem>[] = [
    { title: "工作事项", dataIndex: "title" },
    { title: "业务模块", dataIndex: "businessModule" },
    { title: "工作类型", dataIndex: "kind" },
    { title: "责任区域", dataIndex: "regionName" },
    { title: "截止责任人", dataIndex: "deadlineOwnerName" },
    {
      title: "截止时间",
      dataIndex: "dueAt",
      render: (value) =>
        new Intl.DateTimeFormat("zh-CN", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date(String(value))),
    },
    {
      title: "报送义务",
      dataIndex: "obligationStatus",
      render: (_, row) => (
        <EnterpriseStatusTag tone={tagTone(row)}>
          {row.obligationStatus}
        </EnterpriseStatusTag>
      ),
    },
    {
      title: "时效结果",
      dataIndex: "timeliness",
      render: (_, row) => (
        <EnterpriseStatusTag tone={tagTone(row)}>
          {row.timeliness}
        </EnterpriseStatusTag>
      ),
    },
    {
      title: "单据流程",
      dataIndex: "documentStatus",
      render: (_, row) => (
        <EnterpriseStatusTag tone={tagTone(row)}>
          {row.documentStatus}
        </EnterpriseStatusTag>
      ),
    },
    {
      title: "数据质量",
      dataIndex: "qualityStatus",
      render: (_, row) => (
        <EnterpriseStatusTag tone={tagTone(row)}>
          {row.qualityStatus}
        </EnterpriseStatusTag>
      ),
    },
    {
      title: "操作",
      width: 96,
      pinned: "right",
      render: (_, row) => (
        <EnterpriseTextAction onClick={() => void navigate(row.documentPath)}>
          打开
        </EnterpriseTextAction>
      ),
    },
  ];

  return (
    <EnterprisePage
      eyebrow="个人工作"
      title="我的工作"
      description="集中处理本人负责的填报、审核、异常和发布工作；任务只作为入口，业务事实仍归规范单据所有。"
    >
      <EnterpriseMetricGrid
        metrics={[
          {
            key: "pending",
            label: "待处理工作",
            value: summary.pending,
            suffix: "项",
            note: "当前本人可处理",
          },
          {
            key: "blocking",
            label: "质量阻断",
            value: summary.qualityBlocking,
            suffix: "项",
            note: "必须先完成修正",
            tone: "danger",
          },
          {
            key: "overdue",
            label: "已经逾期",
            value: summary.overdue,
            suffix: "项",
            note: "保留原截止记录",
            tone: "warning",
          },
          {
            key: "completed",
            label: "本期已完成",
            value: summary.completed,
            suffix: "项",
            note: "按当前状态统计",
            tone: "success",
          },
        ]}
      />

      <section className="enterprise-work-panel">
        <header className="enterprise-panel-heading">
          <div>
            <h2>{queueTitle}</h2>
            <p>选择“打开”进入唯一规范单据。</p>
          </div>
        </header>

        {viewState === "loading" && (
          <EnterpriseLoading title="正在加载本人工作" />
        )}
        {viewState === "error" && (
          <EnterpriseFailure
            title="本人工作加载失败"
            description="暂时无法加载，请稍后重试"
            onRetry={query.reload}
          />
        )}
        {viewState === "empty" && (
          <EnterpriseEmpty description="当前没有需要本人处理的工作" />
        )}
        {viewState === "ready" && (
          <EnterpriseTable
            ariaLabel="本人工作队列"
            columns={columns}
            rows={rows}
            onRowOpen={(row) => void navigate(row.documentPath)}
          />
        )}
      </section>
    </EnterprisePage>
  );
}
