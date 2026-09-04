import { useRef, useState } from "react";

import type {
  RealtimeBusinessRepository,
  SamplePointImportResult,
} from "@/platform/api/realtimeBusinessRepository";

type SamplePointKind = "design" | "formal";

export interface SamplePointImportPanelProps {
  kind: SamplePointKind;
  repository: RealtimeBusinessRepository;
  onImported: () => Promise<void> | void;
  variant?: "standalone" | "ledger-toolbar";
}

function downloadBlob(blob: Blob, filename: string) {
  if (typeof URL.createObjectURL !== "function") return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SamplePointImportPanel({
  kind,
  repository,
  onImported,
  variant = "standalone",
}: SamplePointImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [busy, setBusy] = useState(false);
  const [designDomain, setDesignDomain] = useState<"PRODUCTION" | "MARKET">(
    "PRODUCTION",
  );
  const [result, setResult] = useState<SamplePointImportResult>();
  const [error, setError] = useState<string>();
  const label = kind === "design" ? "设计样本点" : "正式样本";

  const handleTemplate = async (domain = designDomain) => {
    setError(undefined);
    try {
      const blob =
        kind === "design"
          ? await repository.downloadDesignSamplePointTemplate?.(domain)
          : await repository.downloadFormalSamplePointTemplate?.();
      if (!blob) throw new Error("template unavailable");
      const templateLabel = kind === "design" ? "设计样本点" : label;
      downloadBlob(blob, `${templateLabel}批量新增模板.xlsx`);
    } catch {
      setError("模板下载失败，请稍后重试。");
    }
  };

  const handleImport = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(undefined);
    setResult(undefined);
    try {
      const next =
        kind === "design"
          ? await repository.importDesignSamplePoints?.(
              file,
              designDomain,
              idempotencyKey,
            )
          : await repository.importFormalSamplePoints?.(file, idempotencyKey);
      if (!next) throw new Error("import unavailable");
      setResult(next);
      if (next.importedRows > 0) await onImported();
      setIdempotencyKey(crypto.randomUUID());
      setFile(undefined);
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      setError("导入失败，请核对文件内容后重试。");
    } finally {
      setBusy(false);
    }
  };

  const handleErrors = async () => {
    if (!result || result.failedRows === 0) return;
    setError(undefined);
    try {
      const blob =
        kind === "design"
          ? await repository.downloadDesignSamplePointImportErrors?.(result.id)
          : await repository.downloadFormalSamplePointImportErrors?.(result.id);
      if (!blob) throw new Error("errors unavailable");
      downloadBlob(blob, `${label}导入错误明细.csv`);
    } catch {
      setError("错误明细下载失败，请稍后重试。");
    }
  };

  const templateActions =
    kind === "design" ? (
      <>
        <label>
          <span>导入分类</span>
          <select
            aria-label="设计参考点导入分类"
            value={designDomain}
            onChange={(event) =>
              setDesignDomain(event.target.value as "PRODUCTION" | "MARKET")
            }
          >
            <option value="PRODUCTION">产情类设计参考点</option>
            <option value="MARKET">市场类设计参考点</option>
          </select>
        </label>
        <button type="button" onClick={() => void handleTemplate()}>
          下载 XLSX 模板
        </button>
      </>
    ) : (
      <button type="button" onClick={() => void handleTemplate()}>
        下载 XLSX 模板
      </button>
    );

  if (variant === "standalone") {
    return (
      <section className="sample-point-import" aria-label={`${label}批量导入`}>
        <div className="sample-point-import__actions">
          {templateActions}
          <label>
            <span>选择 XLSX 文件</span>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-label="选择 XLSX 文件"
              onChange={(event) => setFile(event.target.files?.[0])}
            />
          </label>
          <button
            type="button"
            disabled={!file || busy}
            onClick={() => void handleImport()}
          >
            {busy ? "正在校验并导入" : "校验并导入"}
          </button>
        </div>
        {result ? (
          <div role="status">
            {result.failedRows > 0
              ? `本次零条入库，${result.failedRows} 行需要修正。`
              : `导入完成，已新增 ${result.importedRows} 条。`}
            {result.failedRows > 0 ? (
              <button type="button" onClick={() => void handleErrors()}>
                下载错误明细
              </button>
            ) : null}
          </div>
        ) : null}
        {error ? <div role="alert">{error}</div> : null}
      </section>
    );
  }

  const actions = (
    <>
      {templateActions}
      <label className="realtime-business-file-action">
        <span>{file?.name ?? "选择 XLSX 文件"}</span>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-label="选择 XLSX 文件"
          onChange={(event) => setFile(event.target.files?.[0])}
        />
      </label>
      <button
        type="button"
        disabled={!file || busy}
        onClick={() => void handleImport()}
      >
        {busy ? "正在校验并导入" : "校验并导入"}
      </button>
    </>
  );
  const feedback = (
    <>
      {result ? (
        <div className="sample-point-import__status" role="status">
          {result.failedRows > 0
            ? `本次零条入库，${result.failedRows} 行需要修正。`
            : `导入完成，已新增 ${result.importedRows} 条。`}
          {result.failedRows > 0 ? (
            <button type="button" onClick={() => void handleErrors()}>
              下载错误明细
            </button>
          ) : null}
        </div>
      ) : null}
      {error ? <div role="alert">{error}</div> : null}
    </>
  );

  return (
    <section
      aria-label={`${label}批量导入`}
      className="sample-point-import sample-point-import--ledger-toolbar enterprise-ledger-action-group"
      role="group"
    >
      <span className="enterprise-ledger-action-group__label">批量导入</span>
      {actions}
      {feedback}
    </section>
  );
}
