import { useList } from "@refinedev/core";
import { Button, Tag, Typography } from "antd";
import { useNavigate } from "react-router";
import { EnterpriseTable, type EnterpriseColumn } from "@/shared/ui";
import { canonicalDocumentPath } from "@/workflows/document-workspace/routing";
import type { MonitoringDomain, WorkTask } from "@/workflows/task-inbox/model";

export function TaskInboxPage({ domain }: { domain: MonitoringDomain }) {
  const navigate = useNavigate();
  const query = useList<WorkTask>({ resource: "tasks" });
  const rows = (query.result?.data ?? []).filter(
    (task) => task.domain === domain,
  );
  const columns: EnterpriseColumn<WorkTask>[] = [
    { title: "任务", dataIndex: "title" },
    { title: "对象", dataIndex: "objectName" },
    { title: "品种", dataIndex: "commodity" },
    { title: "报告期", dataIndex: "reportingPeriod" },
    {
      title: "状态",
      dataIndex: "status",
      render: (_, row) => <Tag>{row.status}</Tag>,
    },
    {
      title: "操作",
      valueType: "option",
      render: (_, row) => [
        <Button
          key="open"
          type="link"
          onClick={() =>
            void navigate(canonicalDocumentPath(row.objectId, row.documentId))
          }
        >
          打开单据
        </Button>,
      ],
    },
  ];

  return (
    <>
      <Typography.Title level={2}>
        {domain === "production-monitoring"
          ? "产情监测 · 我的任务"
          : "市场监测 · 我的任务"}
      </Typography.Title>
      <EnterpriseTable
        ariaLabel="我的任务"
        columns={columns}
        rows={rows}
        loading={query.query.isLoading}
      />
    </>
  );
}
