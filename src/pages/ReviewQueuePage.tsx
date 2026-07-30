import { useList } from "@refinedev/core";
import { Alert, Button, Empty, Result, Typography } from "antd";
import { useNavigate } from "react-router";
import {
  EnterpriseTable,
  type EnterpriseColumn,
} from "@/shared/ui/EnterpriseTable";
import { canonicalDocumentPath } from "@/workflows/document-workspace/routing";
import type { WorkTask } from "@/workflows/task-inbox/model";
import { resolveQueueViewState } from "@/workflows/task-inbox/view-state";

export function ReviewQueuePage() {
  const navigate = useNavigate();
  const query = useList<WorkTask>({ resource: "reviews" });
  const rows = query.result?.data ?? [];
  const viewState = resolveQueueViewState({
    isLoading: query.query.isLoading,
    isError: query.query.isError,
    itemCount: rows.length,
  });
  const columns: EnterpriseColumn<WorkTask>[] = [
    { title: "审核任务", dataIndex: "title" },
    { title: "对象", dataIndex: "objectName" },
    { title: "品种", dataIndex: "commodity" },
    { title: "报告期", dataIndex: "reportingPeriod" },
    {
      title: "操作",
      render: (_, row) => [
        <Button
          key="review"
          type="link"
          onClick={() =>
            void navigate(canonicalDocumentPath(row.objectId, row.documentId))
          }
        >
          进入审核
        </Button>,
      ],
    },
  ];

  return (
    <>
      <Typography.Title level={2}>审核中心 · 待办</Typography.Title>
      {viewState === "loading" && (
        <Result status="info" title="正在加载审核队列" />
      )}
      {viewState === "error" && (
        <Alert
          role="alert"
          type="error"
          showIcon
          message="审核队列加载失败"
          description="服务暂时不可用，未将失败请求误判为空队列。"
          action={
            <Button onClick={() => void query.query.refetch()}>重新加载</Button>
          }
        />
      )}
      {viewState === "empty" && (
        <Empty description="当前业务范围没有待审核任务" />
      )}
      {viewState === "ready" && (
        <EnterpriseTable ariaLabel="审核待办" columns={columns} rows={rows} />
      )}
    </>
  );
}
