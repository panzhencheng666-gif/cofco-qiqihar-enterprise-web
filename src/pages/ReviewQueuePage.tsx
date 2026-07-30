import { useList } from "@refinedev/core";
import { Button, Typography } from "antd";
import { useNavigate } from "react-router";
import {
  EnterpriseTable,
  type EnterpriseColumn,
} from "@/shared/ui/EnterpriseTable";
import { canonicalDocumentPath } from "@/workflows/document-workspace/routing";
import type { WorkTask } from "@/workflows/task-inbox/model";

export function ReviewQueuePage() {
  const navigate = useNavigate();
  const query = useList<WorkTask>({ resource: "reviews" });
  const rows = query.result?.data ?? [];
  const columns: EnterpriseColumn<WorkTask>[] = [
    { title: "审核任务", dataIndex: "title" },
    { title: "对象", dataIndex: "objectName" },
    { title: "品种", dataIndex: "commodity" },
    { title: "报告期", dataIndex: "reportingPeriod" },
    {
      title: "操作",
      valueType: "option",
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
      <EnterpriseTable
        ariaLabel="审核待办"
        columns={columns}
        rows={rows}
        loading={query.query.isLoading}
      />
    </>
  );
}
