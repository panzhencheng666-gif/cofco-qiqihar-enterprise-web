import { createHash } from "node:crypto";
import { lstat, readFile, realpath, rm } from "node:fs/promises";
import { arch, platform, tmpdir } from "node:os";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";

const databasePattern = /^qiqihar_stage7_[0-9a-f]{12}$/u;
const runtimeDirectoryPattern = /^cofco-stage7-[A-Za-z0-9_-]{6,}$/u;
const sensitiveKey =
  /(password|secret|token|cookie|credential|access.?key|session.?state)/iu;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function firstLine(value) {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line !== "");
}

function parseManifest(source) {
  const unfolded = source.replace(/\r?\n /gu, "");
  return Object.fromEntries(
    unfolded
      .split(/\r?\n/u)
      .filter((line) => line.includes(":"))
      .map((line) => {
        const separator = line.indexOf(":");
        return [line.slice(0, separator), line.slice(separator + 1).trim()];
      }),
  );
}

async function backendGitState(backendDirectory, execute) {
  const [{ stdout: commit }, { stdout: status }] = await Promise.all([
    execute("git", ["rev-parse", "HEAD"], { cwd: backendDirectory }),
    execute("git", ["status", "--porcelain"], { cwd: backendDirectory }),
  ]);
  return { commit: commit.trim(), clean: status.trim() === "" };
}

async function exactJar(jarPath, backendDirectory) {
  const { metadata, relativePath } = await assertConfinedArtifactPath(
    backendDirectory,
    jarPath,
  );
  const bytes = await readFile(jarPath);
  if (bytes.length === 0) throw new Error("Backend artifact is empty");
  const after = await assertConfinedArtifactPath(backendDirectory, jarPath);
  if (
    metadata.dev !== after.metadata.dev ||
    metadata.ino !== after.metadata.ino ||
    metadata.size !== after.metadata.size
  ) {
    throw new Error("Backend artifact changed while it was being inspected");
  }
  return { bytes, metadata, relativePath };
}

async function assertConfinedArtifactPath(backendDirectory, jarPath) {
  const repositoryPath = resolve(backendDirectory);
  const artifactPath = resolve(jarPath);
  const relativePath = relative(repositoryPath, artifactPath);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error("Backend artifact path escapes the repository");
  }
  const repositoryMetadata = await lstat(repositoryPath);
  if (
    !repositoryMetadata.isDirectory() ||
    repositoryMetadata.isSymbolicLink()
  ) {
    throw new Error("Backend repository root must be a real directory");
  }
  let current = repositoryPath;
  const segments = relativePath.split(/[\\/]/u);
  for (const [index, segment] of segments.entries()) {
    current = resolve(current, segment);
    const metadata = await lstat(current);
    const final = index === segments.length - 1;
    if (
      metadata.isSymbolicLink() ||
      (final ? !metadata.isFile() : !metadata.isDirectory())
    ) {
      throw new Error(
        "Backend artifact path and every parent must be real repository entries",
      );
    }
  }
  const [repositoryRoot, artifactRealPath] = await Promise.all([
    realpath(repositoryPath),
    realpath(artifactPath),
  ]);
  const realRelativePath = relative(repositoryRoot, artifactRealPath);
  if (realRelativePath.startsWith("..") || isAbsolute(realRelativePath)) {
    throw new Error("Backend artifact real path escapes the repository");
  }
  return { metadata: await lstat(artifactPath), relativePath };
}

async function assertArtifactDirectory(backendDirectory, jarPath) {
  const repositoryPath = resolve(backendDirectory);
  const artifactDirectory = dirname(resolve(jarPath));
  const relativePath = relative(repositoryPath, artifactDirectory);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error("Backend artifact directory escapes the repository");
  }
  const repositoryMetadata = await lstat(repositoryPath);
  if (
    !repositoryMetadata.isDirectory() ||
    repositoryMetadata.isSymbolicLink()
  ) {
    throw new Error("Backend repository root must be a real directory");
  }
  let current = repositoryPath;
  for (const segment of relativePath.split(/[\\/]/u)) {
    current = resolve(current, segment);
    try {
      const metadata = await lstat(current);
      if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        throw new Error("Backend artifact directory must not be a symlink");
      }
      const [rootReal, currentReal] = await Promise.all([
        realpath(repositoryPath),
        realpath(current),
      ]);
      const currentRelative = relative(rootReal, currentReal);
      if (currentRelative.startsWith("..") || isAbsolute(currentRelative)) {
        throw new Error("Backend artifact directory escapes the repository");
      }
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
  }
}

function assertJdk21Manifest(manifest) {
  if (
    !/^21(?:\.|$)/u.test(manifest["Java-Version"] ?? "") ||
    !/^21(?:\.|$)/u.test(manifest["Build-Jdk-Spec"] ?? "")
  ) {
    throw new Error("Backend JAR manifest must record JDK 21");
  }
}

export async function prepareBackendArtifact({
  backendDirectory,
  jarPath,
  expectedSourceCommit,
  buildCommand,
  javaHome,
  execute,
}) {
  const configuredJarRelativePath = relative(
    resolve(backendDirectory),
    resolve(jarPath),
  );
  if (
    typeof execute !== "function" ||
    !/^[a-f0-9]{40}$/u.test(expectedSourceCommit ?? "") ||
    JSON.stringify(buildCommand) !==
      JSON.stringify(["mvn", "clean", "-DskipTests", "package"]) ||
    configuredJarRelativePath.startsWith("..") ||
    isAbsolute(configuredJarRelativePath)
  ) {
    throw new Error("Invalid Backend artifact preparation contract");
  }
  await assertArtifactDirectory(backendDirectory, jarPath);
  const before = await backendGitState(backendDirectory, execute);
  if (before.commit !== expectedSourceCommit) {
    throw new Error(
      `Backend source commit ${before.commit} does not match expected ${expectedSourceCommit}`,
    );
  }
  if (!before.clean) {
    throw new Error("Backend source repository must be clean before build");
  }
  const build = await execute(buildCommand[0], buildCommand.slice(1), {
    cwd: backendDirectory,
  });
  const after = await backendGitState(backendDirectory, execute);
  if (after.commit !== expectedSourceCommit || !after.clean) {
    throw new Error(
      "Backend source commit or cleanliness changed during build",
    );
  }
  const artifact = await exactJar(jarPath, backendDirectory);
  const [manifestResult, javaResult, mavenResult] = await Promise.all([
    execute("unzip", ["-p", jarPath, "META-INF/MANIFEST.MF"], {
      cwd: backendDirectory,
    }),
    execute(`${javaHome}/bin/java`, ["-version"], {
      cwd: backendDirectory,
    }),
    execute(buildCommand[0], ["--version"], { cwd: backendDirectory }),
  ]);
  const manifestSource = manifestResult.stdout;
  const confirmedArtifact = await exactJar(jarPath, backendDirectory);
  if (
    sha256(confirmedArtifact.bytes) !== sha256(artifact.bytes) ||
    confirmedArtifact.relativePath !== artifact.relativePath
  ) {
    throw new Error(
      "Backend artifact changed while its manifest was extracted",
    );
  }
  const manifest = parseManifest(manifestSource);
  const javaVersion = firstLine(`${javaResult.stdout}\n${javaResult.stderr}`);
  const mavenVersion = firstLine(
    `${mavenResult.stdout}\n${mavenResult.stderr}`,
  );
  if (
    !javaVersion ||
    !/\bversion\s+"?21(?:\.|\b)/iu.test(javaVersion) ||
    !mavenVersion ||
    !manifestSource.trim()
  ) {
    throw new Error("Backend build environment or JAR manifest is incomplete");
  }
  assertJdk21Manifest(manifest);
  return {
    schemaVersion: "cofco-stage7-backend-artifact-v1",
    sourceCommit: expectedSourceCommit,
    sourceClean: true,
    build: {
      command: structuredClone(buildCommand),
      outputSha256: sha256(`${build.stdout ?? ""}${build.stderr ?? ""}`),
      environment: {
        javaHome,
        javaVersion,
        mavenVersion,
        platform: platform(),
        architecture: arch(),
      },
    },
    jar: {
      relativePath: artifact.relativePath,
      sha256: sha256(confirmedArtifact.bytes),
      sizeBytes: confirmedArtifact.bytes.length,
      manifestSha256: sha256(manifestSource),
      manifest,
    },
  };
}

export async function assertBackendArtifactMatches({
  provenance,
  backendDirectory,
  jarPath,
  execute,
}) {
  if (
    provenance?.schemaVersion !== "cofco-stage7-backend-artifact-v1" ||
    typeof execute !== "function"
  ) {
    throw new Error("Backend artifact provenance is invalid");
  }
  const source = await backendGitState(backendDirectory, execute);
  if (source.commit !== provenance.sourceCommit || !source.clean) {
    throw new Error(
      "Backend source commit no longer matches artifact provenance",
    );
  }
  const artifact = await exactJar(jarPath, backendDirectory);
  const manifestResult = await execute(
    "unzip",
    ["-p", jarPath, "META-INF/MANIFEST.MF"],
    { cwd: backendDirectory },
  );
  const manifestSource = manifestResult.stdout;
  const manifest = parseManifest(manifestSource);
  assertJdk21Manifest(manifest);
  const confirmedArtifact = await exactJar(jarPath, backendDirectory);
  if (
    confirmedArtifact.relativePath !== provenance.jar.relativePath ||
    confirmedArtifact.bytes.length !== provenance.jar.sizeBytes ||
    sha256(confirmedArtifact.bytes) !== provenance.jar.sha256 ||
    sha256(confirmedArtifact.bytes) !== sha256(artifact.bytes) ||
    sha256(manifestSource) !== provenance.jar.manifestSha256 ||
    JSON.stringify(manifest) !== JSON.stringify(provenance.jar.manifest)
  ) {
    throw new Error(
      "Backend artifact digest or manifest does not match build provenance",
    );
  }
  return true;
}

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
