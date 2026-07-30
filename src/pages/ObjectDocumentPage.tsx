import { useCan, useOne } from "@refinedev/core";
import { Alert, Breadcrumb, Button, Result, Space, Typography } from "antd";
import { useMemo, useState } from "react";
import { useParams } from "react-router";
import type { MonitoringObject } from "@/domains/monitoring-object/model";
import { DocumentWorkspace } from "@/shared/ui/DocumentWorkspace";
import { ObjectDrawer } from "@/shared/ui/ObjectDrawer";
import { ReviewPanel } from "@/shared/ui/ReviewPanel";
import type {
  BusinessDocument,
  DocumentMode,
} from "@/workflows/document-workspace/model";

function documentMode(
  document: BusinessDocument,
  canEdit: boolean,
  canReview: boolean,
): DocumentMode {
  if (document.state === "DRAFT" && canEdit) return "edit";
  if (
    (document.state === "PRIMARY_REVIEW" ||
      document.state === "FINAL_REVIEW") &&
    canReview
  ) {
    return "review";
  }
  return "read";
}

export function ObjectDocumentPage() {
  const { objectId = "", documentId = "" } = useParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const objectQuery = useOne<MonitoringObject>({
    resource: "objects",
    id: objectId,
  });
  const documentQuery = useOne<BusinessDocument>({
    resource: "documents",
    id: documentId,
  });
  const editAccess = useCan({
    resource: "documents",
    action: "edit",
    params: { id: documentId },
  });
  const reviewAccess = useCan({
    resource: "documents",
    action: "review",
    params: { id: documentId },
  });
  const object = objectQuery.result;
  const document = documentQuery.result;
  const loading =
    objectQuery.query.isLoading ||
    documentQuery.query.isLoading ||
    editAccess.isLoading ||
    reviewAccess.isLoading;
  const mismatch = document && document.objectId !== objectId;
  const mode = useMemo(
    () =>
      document
        ? documentMode(
            document,
            editAccess.data?.can === true,
            reviewAccess.data?.can === true,
          )
        : "read",
    [document, editAccess.data?.can, reviewAccess.data?.can],
  );

  if (loading) return <Result status="info" title="正在加载规范业务单据" />;
  if (!object || !document || mismatch) {
    return (
      <Alert
        role="alert"
        type="error"
        showIcon
        message="对象与业务单据坐标不一致"
        description="系统已阻止显示，未修改任何业务数据。"
      />
    );
  }

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Breadcrumb
        items={[
          { title: "对象档案" },
          { title: object.name },
          { title: document.id },
        ]}
      />
      <Space>
        <Typography.Title level={2} style={{ margin: 0 }}>
          {object.name}
        </Typography.Title>
        <Button onClick={() => setDrawerOpen(true)}>查看对象全景</Button>
      </Space>
      <div className="document-grid">
        <DocumentWorkspace document={document} mode={mode} />
        <ReviewPanel quality={document.quality} />
      </div>
      <ObjectDrawer
        object={object}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </Space>
  );
}
