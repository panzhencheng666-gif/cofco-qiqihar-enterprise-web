import { useCan, useOne } from "@refinedev/core";
import { Alert, Breadcrumb, Button, Result, Space, Typography } from "antd";
import { useState } from "react";
import { useParams } from "react-router";
import type { MonitoringObject } from "@/domains/monitoring-object/model";
import { DocumentWorkspace } from "@/shared/ui/DocumentWorkspace";
import { ObjectDrawer } from "@/shared/ui/ObjectDrawer";
import { ReviewPanel } from "@/shared/ui/ReviewPanel";
import type {
  BusinessDocument,
  DocumentMode,
} from "@/workflows/document-workspace/model";
import { fieldValueDisplay } from "@/workflows/document-workspace/model";
import { resolveDocumentViewState } from "@/workflows/document-workspace/view-state";
import type { EnterpriseQueryError } from "@/workflows/enterprise-gateway/errors";

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
  const objectQuery = useOne<MonitoringObject, EnterpriseQueryError>({
    resource: "objects",
    id: objectId,
  });
  const documentQuery = useOne<BusinessDocument, EnterpriseQueryError>({
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
  const viewState = resolveDocumentViewState({
    requestedObjectId: objectId,
    requestedDocumentId: documentId,
    object: objectQuery.result,
    document: documentQuery.result,
    objectLoading: objectQuery.query.isLoading,
    documentLoading: documentQuery.query.isLoading,
    accessLoading: editAccess.isLoading || reviewAccess.isLoading,
    objectError: objectQuery.query.error,
    documentError: documentQuery.query.error,
    accessError: editAccess.error ?? reviewAccess.error,
  });

  if (viewState.kind === "loading") {
    return <Result status="info" title="正在加载规范业务单据" />;
  }
  if (viewState.kind === "query-error") {
    return (
      <Alert
        role="alert"
        type="error"
        showIcon
        message="业务单据加载失败"
        description="服务暂时不可用，已保留当前对象和单据地址，未修改任何业务数据。"
        action={
          <Button
            onClick={() => {
              void Promise.allSettled([
                objectQuery.query.refetch(),
                documentQuery.query.refetch(),
                editAccess.refetch(),
                reviewAccess.refetch(),
              ]);
            }}
          >
            重新加载
          </Button>
        }
      />
    );
  }
  if (viewState.kind === "not-found") {
    return (
      <Result
        status="404"
        title={
          viewState.target === "object" ? "监测对象不存在" : "业务单据不存在"
        }
        subTitle="请从任务、对象档案或审核队列重新进入规范业务单据。"
      />
    );
  }
  if (viewState.kind === "mismatch") {
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
  const { object, document } = viewState;
  const mode = documentMode(
    document,
    editAccess.data?.can === true,
    reviewAccess.data?.can === true,
  );
  const workspaceDocument = {
    commodity: document.commodity,
    reportingPeriod: document.reportingPeriod,
    formVersion: document.formVersion,
    sections: document.sections.map((section) => ({
      id: section.id,
      title: section.title,
      fields: section.fields.map((field) => {
        const display = fieldValueDisplay(field.value);
        return {
          code: field.code,
          label: field.label,
          displayValue: display.text,
          valueStatus: display.statusLabel,
          hasAmount: display.hasAmount,
          unit: field.unit,
        };
      }),
    })),
  };

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
        <DocumentWorkspace document={workspaceDocument} mode={mode} />
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
