import { useEffect, useState } from "react";

import type {
  BusinessImportDomain,
  ProductionImportPhotoManifest,
  ProductionImportJob,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";

import { BusinessImportHistory } from "./BusinessImportHistory";
import { BusinessImportStatus } from "./BusinessImportStatus";
import {
  awaitBusinessImport,
  saveImportErrorFile,
} from "./businessImportWorkflow";

import "./BusinessImportTaskWorkspace.css";

const domainOptions: readonly {
  domain: BusinessImportDomain;
  label: string;
}[] = [
  { domain: "production", label: "产情导入" },
  { domain: "market", label: "市场导入" },
  { domain: "logistics", label: "物流导入" },
];

export function BusinessImportTaskWorkspace({
  repository,
}: {
  repository: RealtimeBusinessRepository;
}) {
  const [domain, setDomain] = useState<BusinessImportDomain>("production");
  const [selectedJob, setSelectedJob] = useState<ProductionImportJob | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [photoManifest, setPhotoManifest] =
    useState<ProductionImportPhotoManifest | null>(null);
  const [photoManifestLoading, setPhotoManifestLoading] = useState(false);
  const [photoManifestFailed, setPhotoManifestFailed] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<readonly File[]>([]);
  const [unmatchedPhotoCount, setUnmatchedPhotoCount] = useState(0);
  const [unsupportedPhotoCount, setUnsupportedPhotoCount] = useState(0);
  const [duplicatePhotoCount, setDuplicatePhotoCount] = useState(0);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMessage, setPhotoMessage] = useState("");

  const refreshBatch = async (
    batchId: string,
    fallback: ProductionImportJob,
  ) => {
    if (!repository.listImportJobs) return fallback;
    const refreshed = await repository.listImportJobs(domain, 0, 50);
    return refreshed.items.find((job) => job.id === batchId) ?? fallback;
  };
  useEffect(() => {
    if (
      domain !== "production" ||
      !selectedJob ||
      selectedJob.importedRows === 0 ||
      !["COMPLETED", "COMPLETED_WITH_ERRORS"].includes(
        selectedJob.statusCode,
      ) ||
      !repository.getProductionImportPhotoManifest
    ) {
      return;
    }
    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (cancelled) return null;
        setPhotoManifestLoading(true);
        setPhotoManifestFailed(false);
        return repository.getProductionImportPhotoManifest?.(selectedJob.id);
      })
      .then((manifest) => {
        if (!cancelled && manifest) setPhotoManifest(manifest);
      })
      .catch(() => {
        if (!cancelled) setPhotoManifestFailed(true);
      })
      .finally(() => {
        if (!cancelled) setPhotoManifestLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [domain, repository, selectedJob]);

  const watchJob = async (job: ProductionImportJob) => {
    setSelectedJob(job);
    setMessage("");
    setPhotoManifest(null);
    setPhotoManifestFailed(false);
    setSelectedPhotos([]);
    setUnmatchedPhotoCount(0);
    setUnsupportedPhotoCount(0);
    setDuplicatePhotoCount(0);
    setPhotoMessage("");
    setBusy(true);
    try {
      const actionJobId = job.actionJobId ?? job.id;
      const watchedJob =
        actionJobId === job.id ? job : { ...job, id: actionJobId };
      const terminal = await awaitBusinessImport({
        repository,
        domain,
        initial: watchedJob,
        onUpdate: (updated) =>
          setSelectedJob({ ...updated, id: job.id, actionJobId: updated.id }),
      });
      setSelectedJob(
        await refreshBatch(job.id, {
          ...terminal,
          id: job.id,
          actionJobId: terminal.id,
        }),
      );
    } catch {
      setMessage("导入任务状态暂时无法继续同步，请刷新任务列表后重试。");
    } finally {
      setBusy(false);
    }
  };

  const retrySelected = async () => {
    if (!selectedJob || !repository.retryImportJob) return;
    setMessage("");
    setBusy(true);
    try {
      const batchId = selectedJob.id;
      const retried = await repository.retryImportJob(
        domain,
        selectedJob.actionJobId ?? selectedJob.id,
      );
      const terminal = await awaitBusinessImport({
        repository,
        domain,
        initial: retried,
        onUpdate: (updated) =>
          setSelectedJob({ ...updated, id: batchId, actionJobId: updated.id }),
      });
      setSelectedJob(
        await refreshBatch(batchId, {
          ...terminal,
          id: batchId,
          actionJobId: terminal.id,
        }),
      );
      setRefreshToken((value) => value + 1);
    } catch {
      setMessage("失败行重试未完成，请保留当前任务并稍后重试。");
    } finally {
      setBusy(false);
    }
  };

  const downloadErrors = async () => {
    if (!selectedJob || !repository.downloadImportErrors) return;
    setMessage("");
    try {
      saveImportErrorFile(
        await repository.downloadImportErrors(
          domain,
          selectedJob.actionJobId ?? selectedJob.id,
        ),
        domain,
        selectedJob.id,
      );
    } catch {
      setMessage("错误清单暂时无法下载，请稍后重试。");
    }
  };

  const chooseHistoricalPhotos = (files: FileList | null) => {
    if (!photoManifest) return;
    const eligible = new Set(
      photoManifest.files
        .filter(
          (entry) => entry.targetRecords.length > entry.attachedRecords.length,
        )
        .map((entry) => entry.filename.normalize("NFC")),
    );
    const supplied = Array.from(files ?? []);
    const matched = new Map<string, File>();
    let unmatched = 0;
    let unsupported = 0;
    let duplicate = 0;
    supplied.forEach((file) => {
      const normalized = file.name.normalize("NFC");
      if (file.type !== "image/jpeg" && file.type !== "image/png") {
        unsupported += 1;
      } else if (!eligible.has(normalized)) {
        unmatched += 1;
      } else if (matched.has(normalized)) {
        duplicate += 1;
      } else {
        matched.set(normalized, file);
      }
    });
    setSelectedPhotos(Array.from(matched.values()));
    setUnmatchedPhotoCount(unmatched);
    setUnsupportedPhotoCount(unsupported);
    setDuplicatePhotoCount(duplicate);
    setPhotoMessage("");
  };

  const uploadHistoricalPhotos = async () => {
    if (
      !selectedJob ||
      selectedPhotos.length === 0 ||
      !repository.supplementProductionImportPhoto
    )
      return;
    setPhotoBusy(true);
    setPhotoMessage("");
    let newAttachments = 0;
    try {
      for (const photo of selectedPhotos) {
        const result = await repository.supplementProductionImportPhoto(
          selectedJob.id,
          photo,
        );
        newAttachments += result.newAttachments;
      }
      setPhotoMessage(`照片补传完成：新增挂接 ${newAttachments} 张`);
      setSelectedPhotos([]);
      setUnmatchedPhotoCount(0);
      setUnsupportedPhotoCount(0);
      setDuplicatePhotoCount(0);
      if (repository.getProductionImportPhotoManifest) {
        const refreshed = await repository.getProductionImportPhotoManifest(
          selectedJob.id,
        );
        setPhotoManifest(refreshed);
      }
    } catch {
      setPhotoMessage(
        `照片补传中断，已完成的文件不会重复挂接；请保留当前选择后重新查看任务。`,
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const selectedDetail = selectedJob ? (
    <section
      aria-label="导入任务详情"
      className="business-import-task-workspace__detail"
    >
      <header className="business-import-task-workspace__detail-header">
        <div>
          <small>当前导入批次</small>
          <h3>处理结果与后续操作</h3>
          <p>错误清单、失败行重试和照片补传均作用于当前所选真实批次。</p>
        </div>
        <button
          aria-label="关闭导入任务详情"
          className="business-import-task-workspace__detail-close"
          disabled={busy || photoBusy}
          type="button"
          onClick={() => {
            setSelectedJob(null);
            setMessage("");
            setPhotoManifest(null);
            setSelectedPhotos([]);
            setUnmatchedPhotoCount(0);
            setUnsupportedPhotoCount(0);
            setDuplicatePhotoCount(0);
            setPhotoMessage("");
          }}
        >
          关闭
        </button>
      </header>
      {message && (
        <div className="business-import-task-workspace__message" role="alert">
          {message}
        </div>
      )}

      <BusinessImportStatus
        busy={busy || photoBusy}
        className="business-import-task-workspace__result"
        compact
        job={selectedJob}
        onDownloadErrors={() => void downloadErrors()}
        onRetry={() => void retrySelected()}
        showSummary={false}
      />

      {domain === "production" &&
        selectedJob.importedRows > 0 &&
        repository.getProductionImportPhotoManifest && (
          <section
            aria-label="照片补传"
            className="business-import-task-workspace__photos"
          >
            {photoManifestLoading && <p role="status">正在核对照片</p>}
            {photoManifestFailed && <p role="alert">照片信息暂时无法读取。</p>}
            {photoManifest && (
              <>
                <p className="business-import-task-workspace__photo-summary">
                  待补传 {photoManifest.eligibleFileCount} 个文件 ·{" "}
                  {photoManifest.totalTargetAttachments} 个记录
                </p>
                {photoManifest.eligibleFileCount > 0 && (
                  <>
                    <label className="business-import-task-workspace__photo-picker">
                      选择照片
                      <input
                        accept="image/jpeg,image/png"
                        aria-label="选择历史导入照片"
                        disabled={photoBusy}
                        multiple
                        type="file"
                        onChange={(event) =>
                          chooseHistoricalPhotos(event.target.files)
                        }
                      />
                    </label>
                    {(selectedPhotos.length > 0 ||
                      unmatchedPhotoCount > 0 ||
                      unsupportedPhotoCount > 0 ||
                      duplicatePhotoCount > 0) && (
                      <p role="status">
                        已匹配 {selectedPhotos.length} 个；文件名不匹配{" "}
                        {unmatchedPhotoCount} 个；格式不支持{" "}
                        {unsupportedPhotoCount} 个
                        {duplicatePhotoCount > 0
                          ? `；重复选择 ${duplicatePhotoCount} 个`
                          : ""}
                      </p>
                    )}
                    <button
                      disabled={photoBusy || selectedPhotos.length === 0}
                      type="button"
                      onClick={() => void uploadHistoricalPhotos()}
                    >
                      {photoBusy ? "正在补传" : "补传照片"}
                    </button>
                  </>
                )}
                {photoMessage && (
                  <p
                    className="business-import-task-workspace__photo-message"
                    role="status"
                  >
                    {photoMessage}
                  </p>
                )}
              </>
            )}
          </section>
        )}
    </section>
  ) : null;

  return (
    <section
      aria-label="我的导入任务"
      className="business-import-task-workspace"
    >
      <nav
        aria-label="导入业务分类"
        className="business-import-task-workspace__domains"
      >
        {domainOptions.map((option) => (
          <button
            aria-pressed={domain === option.domain}
            key={option.domain}
            type="button"
            onClick={() => {
              setDomain(option.domain);
              setSelectedJob(null);
              setMessage("");
              setPhotoManifest(null);
              setSelectedPhotos([]);
              setUnmatchedPhotoCount(0);
              setUnsupportedPhotoCount(0);
              setDuplicatePhotoCount(0);
              setPhotoMessage("");
            }}
          >
            {option.label}
          </button>
        ))}
      </nav>

      <BusinessImportHistory
        busy={busy || photoBusy}
        domain={domain}
        key={domain}
        onRestore={(job) => void watchJob(job)}
        refreshToken={refreshToken}
        repository={repository}
        selectedDetail={selectedDetail}
        selectedJobId={selectedJob?.id}
      />
    </section>
  );
}
