import { useState } from "react";
import { useParams } from "react-router";
import {
  EnterpriseBlocked,
  EnterpriseDocumentWorkspace,
  EnterpriseFailure,
  EnterpriseLoading,
  EnterpriseNotFound,
  EnterpriseObjectDrawer,
  EnterprisePage,
  EnterpriseReviewPanel,
  EnterpriseTextAction,
} from "@/shared/enterprise-ui";
import type {
  BusinessDocument,
  DocumentMode,
} from "@/workflows/document-workspace/model";
import { fieldValueDisplay } from "@/workflows/document-workspace/model";
import { resolveDocumentViewState } from "@/workflows/document-workspace/view-state";
import { useObjectDocument } from "@/workflows/document-workspace/useObjectDocument";

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
  const query = useObjectDocument(objectId, documentId);
  const viewState = resolveDocumentViewState({
    requestedObjectId: objectId,
    requestedDocumentId: documentId,
    object: query.object,
    document: query.document,
    objectLoading: query.isLoading,
    documentLoading: query.isLoading,
    accessLoading: query.isLoading,
    objectError: query.objectError,
    documentError: query.documentError,
    accessError: query.accessError,
    accessDenied: query.accessDenied,
  });

  if (viewState.kind === "loading") {
    return <EnterpriseLoading title="正在加载规范业务单据" />;
  }
  if (viewState.kind === "query-error") {
    return (
      <EnterpriseFailure
        title="业务单据加载失败"
        description="暂时无法加载，请稍后重试"
        onRetry={query.reload}
      />
    );
  }
  if (viewState.kind === "forbidden") {
    return (
      <EnterpriseBlocked
        title="当前账号无权查看此业务单据"
        description="请联系责任管理员核对有效任职、责任范围和单据授权。"
      />
    );
  }
  if (viewState.kind === "not-found") {
    return (
      <EnterpriseNotFound
        title={
          viewState.target === "object" ? "监测对象不存在" : "业务单据不存在"
        }
        description="请从本人工作或对象档案重新进入规范业务单据。"
      />
    );
  }
  if (viewState.kind === "mismatch") {
    return (
      <EnterpriseBlocked
        title="对象与业务单据坐标不一致"
        description="系统已阻止显示，未修改任何业务数据。"
      />
    );
  }
  const { object, document } = viewState;
  const mode = documentMode(document, query.canEdit, query.canReview);
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
    <EnterprisePage
      eyebrow="业务工作"
      title={object.name}
      description="当前规范业务单据与监测对象、报告期、表单版本和责任范围唯一关联；所有填报、审核和发布动作均以该业务坐标为准。"
      actions={
        <EnterpriseTextAction onClick={() => setDrawerOpen(true)}>
          查看对象全景
        </EnterpriseTextAction>
      }
    >
      <div className="document-grid">
        <EnterpriseDocumentWorkspace document={workspaceDocument} mode={mode} />
        <EnterpriseReviewPanel quality={document.quality} />
      </div>
      <EnterpriseObjectDrawer
        object={{
          name: object.name,
          regionPath: object.regionPath,
          contextLabel: "有效业务能力",
          contextValues: object.capabilities,
        }}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </EnterprisePage>
  );
}
