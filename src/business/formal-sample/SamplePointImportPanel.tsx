import { useRef, useState } from "react";

import type {
  RealtimeBusinessRepository,
  SamplePointImportResult,
} from "@/platform/api/realtimeBusinessRepository";

type SamplePointKind = "design" | "formal";

export interface SamplePointImportPanelProps {
  kind: SamplePointKind;
  repository: RealtimeBusinessRepository;
  onImported(): Promise<void> | void;
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
}: SamplePointImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SamplePointImportResult>();
  const [error, setError] = useState<string>();
  const label = kind === "design" ? "设计样本点" : "正式样本";

  const handleTemplate = async () => {
    setError(undefined);
    try {
      const action =
        kind === "design"
          ? repository.downloadDesignSamplePointTemplate
          : repository.downloadFormalSamplePointTemplate;
      if (!action) throw new Error("template unavailable");
      downloadBlob(await action(), `${label}批量新增模板.xlsx`);
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
      const action =
        kind === "design"
          ? repository.importDesignSamplePoints
          : repository.importFormalSamplePoints;
      if (!action) throw new Error("import unavailable");
      const next = await action(file, idempotencyKey);
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
      const action =
        kind === "design"
          ? repository.downloadDesignSamplePointImportErrors
          : repository.downloadFormalSamplePointImportErrors;
      if (!action) throw new Error("errors unavailable");
      downloadBlob(await action(result.id), `${label}导入错误明细.csv`);
    } catch {
      setError("错误明细下载失败，请稍后重试。");
    }
  };

  return (
    <section className="sample-point-import" aria-label={`${label}批量导入`}>
      <div className="sample-point-import__actions">
        <button type="button" onClick={() => void handleTemplate()}>
          下载 XLSX 模板
        </button>
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
