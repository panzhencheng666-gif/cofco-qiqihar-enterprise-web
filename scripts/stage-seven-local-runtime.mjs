import { lstat, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute } from "node:path";

const databasePattern = /^qiqihar_stage7_[0-9a-f]{12}$/u;
const runtimeDirectoryPattern = /^cofco-stage7-[A-Za-z0-9_-]{6,}$/u;
const sensitiveKey =
  /(password|secret|token|cookie|credential|access.?key|session.?state)/iu;

export function normalizeHostCpuPercent(rawMultiCorePercent, logicalCpuCount) {
  if (
    !Number.isFinite(rawMultiCorePercent) ||
    rawMultiCorePercent < 0 ||
    !Number.isInteger(logicalCpuCount) ||
    logicalCpuCount < 1
  ) {
    throw new Error("Invalid host CPU sample");
  }
  return rawMultiCorePercent / logicalCpuCount;
}

export function hostMemoryPercent(residentKilobytes, hostBytes) {
  if (
    !Number.isFinite(residentKilobytes) ||
    residentKilobytes < 0 ||
    !Number.isFinite(hostBytes) ||
    hostBytes <= 0
  ) {
    throw new Error("Invalid host memory sample");
  }
  return (residentKilobytes * 1024 * 100) / hostBytes;
}

export async function runCleanupSteps(steps) {
  if (
    !Array.isArray(steps) ||
    steps.some((step) => typeof step !== "function")
  ) {
    throw new Error("Invalid Stage 7 cleanup steps");
  }
  const failures = [];
  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, "Stage 7 cleanup failed");
  }
}

export async function removeExactStageSevenRuntimeDirectory(path) {
  if (
    typeof path !== "string" ||
    !isAbsolute(path) ||
    !runtimeDirectoryPattern.test(basename(path))
  ) {
    throw new Error("Expected an exact Stage 7 runtime directory");
  }
  const [parent, temporaryRoot, metadata] = await Promise.all([
    realpath(dirname(path)),
    realpath(tmpdir()),
    lstat(path),
  ]);
  if (
    parent !== temporaryRoot ||
    !metadata.isDirectory() ||
    metadata.isSymbolicLink()
  ) {
    throw new Error("Refusing to remove a non-isolated Stage 7 runtime path");
  }
  await rm(path, { recursive: true, force: true });
}

function successful(byWorkload, code) {
  const result = byWorkload[code] ?? { attempts: 0, unexpectedErrors: 0 };
  return result.attempts - result.unexpectedErrors;
}

export function evaluateLoadConsistency({
  before,
  after,
  byWorkload,
  approvedReviews,
  expectedApprovedReviews,
}) {
  const writes = successful(byWorkload, "write");
  const reviews = successful(byWorkload, "review");
  const imports = successful(byWorkload, "import");
  const photos = successful(byWorkload, "photo");
  const checks = [
    {
      code: "production-record-count",
      expected: writes + imports,
      actual: after.productionRecords - before.productionRecords,
    },
    {
      code: "evidence-photo-count",
      expected: photos + writes + imports,
      actual: after.evidencePhotos - before.evidencePhotos,
    },
    {
      code: "approved-review-count",
      expected: expectedApprovedReviews,
      actual: approvedReviews,
    },
  ].map((check) => ({ ...check, passed: check.expected === check.actual }));
  const successfulWrites = writes + reviews + imports + photos;
  return {
    successfulWrites,
    consistentWrites: checks.every(({ passed }) => passed)
      ? successfulWrites
      : 0,
    checks,
  };
}

export async function waitForWritableOpen(stream) {
  if (typeof stream?.fd === "number") return stream;
  if (!stream || typeof stream.once !== "function") {
    throw new Error("Expected a writable stream");
  }
  await new Promise((resolvePromise, reject) => {
    const opened = () => {
      stream.off("error", failed);
      resolvePromise();
    };
    const failed = (error) => {
      stream.off("open", opened);
      reject(error);
    };
    stream.once("open", opened);
    stream.once("error", failed);
  });
  if (typeof stream.fd !== "number") {
    throw new Error("Writable stream opened without a file descriptor");
  }
  return stream;
}

export function assertIsolatedDatabaseName(name) {
  if (typeof name !== "string" || !databasePattern.test(name)) {
    throw new Error("Expected an isolated Stage 7 database name");
  }
  return name;
}

export function summarizeResourceTrend(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new Error("Resource trend requires at least one sample");
  }
  for (const sample of samples) {
    if (
      [
        "elapsedSeconds",
        "cpuPercent",
        "memoryPercent",
        "databaseConnections",
      ].some((key) => !Number.isFinite(sample[key]) || sample[key] < 0)
    ) {
      throw new Error("Invalid resource trend sample");
    }
  }
  return {
    samples: samples.length,
    maximumCpuPercent: Math.max(...samples.map(({ cpuPercent }) => cpuPercent)),
    maximumMemoryPercent: Math.max(
      ...samples.map(({ memoryPercent }) => memoryPercent),
    ),
    maximumDatabaseConnections: Math.max(
      ...samples.map(({ databaseConnections }) => databaseConnections),
    ),
    endingMinusStartingMemoryPercent:
      samples.at(-1).memoryPercent - samples[0].memoryPercent,
  };
}

export function assertSecretFree(value, path = "root") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSecretFree(item, `${path}[${index}]`));
    return value;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (sensitiveKey.test(key)) {
        throw new Error(`Evidence contains a sensitive key at ${path}.${key}`);
      }
      assertSecretFree(nested, `${path}.${key}`);
    }
  }
  return value;
}
