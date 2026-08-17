import type {
  BusinessImportDomain,
  ProductionImportJob,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";

type Wait = (milliseconds: number, signal?: AbortSignal) => Promise<void>;

const pendingStatuses = new Set<ProductionImportJob["statusCode"]>([
  "QUEUED",
  "PROCESSING",
]);

function defaultWait(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = globalThis.setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        globalThis.clearTimeout(timer);
        reject(new DOMException("Import monitoring cancelled", "AbortError"));
      },
      { once: true },
    );
  });
}

export function isPendingBusinessImport(job: ProductionImportJob) {
  return pendingStatuses.has(job.statusCode);
}

export async function awaitBusinessImport(input: {
  repository: RealtimeBusinessRepository;
  domain: BusinessImportDomain;
  initial: ProductionImportJob;
  onUpdate: (job: ProductionImportJob) => void;
  signal?: AbortSignal;
  wait?: Wait;
  pollIntervalMs?: number;
  maximumPolls?: number;
}) {
  const wait = input.wait ?? defaultWait;
  const maximumPolls = input.maximumPolls ?? 900;
  let current = input.initial;
  input.onUpdate(current);
  if (isPendingBusinessImport(current) && !input.repository.getImportJob) {
    throw new Error("IMPORT_STATUS_NOT_CONFIGURED");
  }
  for (let poll = 0; isPendingBusinessImport(current); poll += 1) {
    if (poll >= maximumPolls) {
      throw new Error("IMPORT_STATUS_TIMEOUT");
    }
    await wait(input.pollIntervalMs ?? 1_000, input.signal);
    current = await input.repository.getImportJob!(input.domain, current.id);
    input.onUpdate(current);
  }
  return current;
}

export function businessImportMessage(job: ProductionImportJob) {
  switch (job.statusCode) {
    case "QUEUED":
      return "批量导入已提交，正在排队处理。";
    case "PROCESSING":
      return "批量数据正在导入，请稍候。";
    case "COMPLETED":
      return `导入完成：${job.importedRows} 行已保存到填报草稿，失败 ${job.failedRows} 行。`;
    case "COMPLETED_WITH_ERRORS":
      return `导入完成：${job.importedRows} 行已保存到填报草稿，失败 ${job.failedRows} 行。请下载错误清单核对。`;
    case "FAILED":
      return `导入未完成：${job.failureMessage || "请核对文件内容后重试。"}`;
  }
}

export function saveImportErrorFile(
  blob: Blob,
  domain: BusinessImportDomain,
  importJobId: string,
) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `${domain}-${importJobId}-导入错误清单.csv`;
  anchor.click();
  URL.revokeObjectURL(href);
}
