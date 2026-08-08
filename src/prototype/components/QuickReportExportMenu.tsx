import {
  createQuickReportArtifact,
  type BusinessReportArtifact,
  type BusinessReportRequest,
  type QuickReportExportKind,
} from "../businessReportModel";

const quickKinds = [
  ["business-daily", "导出业务日报"],
  ["business-weekly", "导出业务周报"],
  ["business-monthly", "导出业务月报"],
  ["submission-weekly", "导出填报记录周报"],
  ["submission-monthly", "导出填报记录月报"],
] as const satisfies readonly (readonly [QuickReportExportKind, string])[];

export function QuickReportExportMenu({
  request,
  exportAllowed,
  onExport,
}: {
  request: BusinessReportRequest | null;
  exportAllowed: boolean;
  onExport?: (
    kind: QuickReportExportKind,
    artifact: BusinessReportArtifact,
  ) => void;
}) {
  const artifactFor = (kind: QuickReportExportKind) => {
    if (!request || !exportAllowed) return null;
    try {
      return createQuickReportArtifact(request, kind);
    } catch {
      return null;
    }
  };

  const exportArtifact = (kind: QuickReportExportKind) => {
    const artifact = artifactFor(kind);
    if (!artifact) return;
    if (onExport) {
      onExport(kind, artifact);
      return;
    }
    const link = document.createElement("a");
    link.download = artifact.filename;
    link.href = `data:${artifact.mimeType},${encodeURIComponent(artifact.content)}`;
    link.click();
  };

  return (
    <details aria-label="生成与导出报告" className="quick-report-export-menu">
      <summary>生成与导出</summary>
      <div>
        {quickKinds.map(([kind, label]) => (
          <button
            disabled={!artifactFor(kind)}
            key={kind}
            type="button"
            onClick={() => exportArtifact(kind)}
          >
            {label}
          </button>
        ))}
        <small>没有同范围、同期间、同频率的已核定数据时不可导出。</small>
      </div>
    </details>
  );
}
