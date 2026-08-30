import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import {
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import {
  basename,
  delimiter,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  canonicalJson,
  validateManifestEnvelope,
  verifyReleaseManifest,
} from "./release-manifest.mjs";

export const RELEASE_MANIFEST = ".cofco-runtime-release.json";
export const CANONICAL_RELEASE_MANIFEST = ".cofco-release-manifest.json";

const ALLOWED_LOCAL_ENVIRONMENTS = new Set([
  "candidate",
  "local",
  "non-production",
]);
const NOFOLLOW_READ_FLAGS =
  fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0);
const exec = promisify(execFile);

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

const DEFAULT_RUNTIME_ROOT =
  process.env["COFCO_ENTERPRISE_WEB_ROOT"]?.trim() ||
  join(
    homedir(),
    "Library",
    "Application Support",
    "COFCO Qiqihar Enterprise",
    "runtime",
    "cofco-qiqihar-enterprise-web",
  );
const FOCUSED_ANALYSIS_SPECS = [
  "src/business/analysis/useObservableAnalysisSeries.spec.tsx",
  "src/business/analysis/ObservableAnalysisReport.spec.tsx",
  "src/business/analysis/ProductionAnalysisPanel.spec.tsx",
  "src/business/analysis/MarketAnalysisPanel.spec.tsx",
  "src/business/realtime/RealtimeSupplyBalancePanel.spec.tsx",
  "src/business/analysis/ObservableAnalysisIntegration.spec.tsx",
];

const EXCLUDED_TOP_LEVEL_PATHS = new Set([
  ".git",
  ".worktrees",
  "coverage",
  "evidence",
  "node_modules",
  "playwright-report",
  "test-results",
]);

export async function loadLocalReleaseManifest({
  manifestPath,
  requireCanonical = false,
} = {}) {
  if (typeof manifestPath !== "string" || manifestPath.trim().length === 0) {
    throw new Error("A release manifest path is required.");
  }
  let details;
  try {
    details = await lstat(manifestPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`Release manifest is missing: ${manifestPath}`, {
        cause: error,
      });
    }
    throw error;
  }
  if (details.isSymbolicLink()) {
    throw new Error("Release manifest path must not be a symbolic link.");
  }
  if (!details.isFile()) {
    throw new Error("Release manifest path must be a regular file.");
  }
  const handle = await open(manifestPath, NOFOLLOW_READ_FLAGS);
  let envelope;
  let rawContents;
  try {
    const opened = await handle.stat();
    if (!opened.isFile()) {
      throw new Error("Release manifest path must be a regular file.");
    }
    rawContents = await handle.readFile("utf8");
    envelope = JSON.parse(rawContents);
    const afterRead = await handle.stat();
    const finalDetails = await lstat(manifestPath);
    if (
      afterRead.dev !== opened.dev ||
      afterRead.ino !== opened.ino ||
      afterRead.size !== opened.size ||
      afterRead.mtimeMs !== opened.mtimeMs ||
      afterRead.ctimeMs !== opened.ctimeMs ||
      finalDetails.isSymbolicLink() ||
      finalDetails.dev !== opened.dev ||
      finalDetails.ino !== opened.ino
    ) {
      throw new Error("Release manifest changed while being read.");
    }
  } finally {
    await handle.close();
  }
  validateManifestEnvelope(envelope);
  if (!ALLOWED_LOCAL_ENVIRONMENTS.has(envelope.manifest.environment)) {
    throw new Error(
      `Release manifest environment is not allowed for local publication: ${envelope.manifest.environment}`,
    );
  }
  const canonicalContents = `${canonicalJson(envelope)}\n`;
  if (requireCanonical && rawContents !== canonicalContents) {
    throw new Error("Runtime release manifest is not canonical.");
  }
  return {
    envelope,
    canonicalContents,
  };
}

function safeRelativePath(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    isAbsolute(value) ||
    /^[A-Za-z]:[\\/]/u.test(value) ||
    value.includes("\\") ||
    value.includes("\0") ||
    value
      .split("/")
      .some(
        (segment) =>
          segment.length === 0 || segment === "." || segment === "..",
      )
  ) {
    throw new Error(`${label} must be a safe relative path.`);
  }
  return value;
}

async function readBoundFile(root, path, label) {
  const safePath = safeRelativePath(path, label);
  let current = root;
  for (const segment of safePath.split("/")) {
    current = join(current, segment);
    const details = await lstat(current);
    if (details.isSymbolicLink()) {
      throw new Error(`${label} must not contain a symbolic link.`);
    }
  }
  const handle = await open(current, NOFOLLOW_READ_FLAGS);
  try {
    const before = await handle.stat();
    if (!before.isFile()) throw new Error(`${label} must be a regular file.`);
    const contents = await handle.readFile();
    const after = await handle.stat();
    const finalDetails = await lstat(current);
    if (
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs ||
      after.ctimeMs !== before.ctimeMs ||
      finalDetails.isSymbolicLink() ||
      finalDetails.dev !== before.dev ||
      finalDetails.ino !== before.ino
    ) {
      throw new Error(`${label} changed while being read.`);
    }
    return contents;
  } finally {
    await handle.close();
  }
}

async function listBoundDirectoryFiles(root, directory, label) {
  const safeDirectory = safeRelativePath(directory, label);
  const files = [];
  async function visit(relativeDirectory) {
    const absoluteDirectory = join(root, relativeDirectory);
    const details = await lstat(absoluteDirectory);
    if (details.isSymbolicLink()) {
      throw new Error(`${label} must not contain a symbolic link.`);
    }
    if (!details.isDirectory()) {
      throw new Error(`${label} must be a directory.`);
    }
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    entries.sort((left, right) => compareText(left.name, right.name));
    for (const entry of entries) {
      const path = `${relativeDirectory}/${entry.name}`;
      if (entry.isSymbolicLink()) {
        throw new Error(`${label} must not contain a symbolic link.`);
      }
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(path);
      else throw new Error(`${label} may contain only files and directories.`);
    }
  }
  await visit(safeDirectory);
  return files;
}

async function verifyDescriptorFiles(root, descriptors, label) {
  let count = 0;
  for (let index = 0; index < descriptors.length; index += 1) {
    const expected = descriptors[index];
    const contents = await readBoundFile(
      root,
      expected.path,
      `${label}[${index}]`,
    );
    const actualDigest = createHash("sha256").update(contents).digest("hex");
    if (
      actualDigest !== expected.sha256 ||
      contents.byteLength !== expected.size
    ) {
      throw new Error(
        `${label}[${index}] does not match the release manifest.`,
      );
    }
    count += 1;
  }
  return count;
}

async function gitOutput(root, args) {
  const result = await exec("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return result.stdout.trim();
}

function assertWebCoreBindings(repository) {
  if (
    repository.assets.files.length === 0 ||
    repository.assets.criticalBundles.length === 0
  ) {
    throw new Error(
      "Web build assets and critical bundles must be bound by the release manifest.",
    );
  }
  if (
    !repository.dependencyLocks.some(({ path }) => path === "package-lock.json")
  ) {
    throw new Error("package-lock.json must be bound by the release manifest.");
  }
}

export async function verifyWebSourceBinding({ envelope, sourceRoot } = {}) {
  validateManifestEnvelope(envelope);
  const rootDetails = await lstat(sourceRoot);
  if (rootDetails.isSymbolicLink()) {
    throw new Error("Web sourceRoot must not be a symbolic link.");
  }
  if (!rootDetails.isDirectory()) {
    throw new Error("Web sourceRoot must be a directory.");
  }
  const root = await realpath(sourceRoot);
  const repositoryRoot = await realpath(
    await gitOutput(root, ["rev-parse", "--show-toplevel"]),
  );
  if (repositoryRoot !== root) {
    throw new Error("Web sourceRoot must be the Git repository root.");
  }
  const expected = envelope.manifest.repositories.web;
  assertWebCoreBindings(expected);
  const assertIdentity = async () => {
    const [origin, commitSha, status] = await Promise.all([
      gitOutput(root, ["remote", "get-url", "origin"]),
      gitOutput(root, ["rev-parse", "HEAD"]),
      gitOutput(root, ["status", "--porcelain=v1", "--untracked-files=all"]),
    ]);
    if (origin !== expected.origin) {
      throw new Error("Web source origin does not match the release manifest.");
    }
    if (commitSha !== expected.commitSha) {
      throw new Error("Web source commit does not match the release manifest.");
    }
    if (status.length > 0) {
      throw new Error("Web source repository is dirty.");
    }
    return { origin, commitSha };
  };
  const identity = await assertIdentity();
  const assetPaths = await listBoundDirectoryFiles(
    root,
    expected.assets.directory,
    "manifest.repositories.web.assets.directory",
  );
  const expectedAssetPaths = expected.assets.files.map(({ path }) => path);
  if (JSON.stringify(assetPaths) !== JSON.stringify(expectedAssetPaths)) {
    throw new Error(
      "Web source asset path set does not match the release manifest.",
    );
  }
  let verifiedFileCount = 0;
  for (const [key, descriptors] of Object.entries({
    assets: expected.assets.files,
    criticalBundles: expected.assets.criticalBundles,
    contracts: expected.contracts,
    configs: expected.configs,
    sboms: expected.sboms,
    dependencyLocks: expected.dependencyLocks,
  })) {
    verifiedFileCount += await verifyDescriptorFiles(
      root,
      descriptors,
      `manifest.repositories.web.${key}`,
    );
  }
  await assertIdentity();
  return { ...identity, verifiedFileCount };
}

async function verifyWebRuntimeBinding({ envelope, runtimeRoot }) {
  validateManifestEnvelope(envelope);
  const rootDetails = await lstat(runtimeRoot);
  if (rootDetails.isSymbolicLink()) {
    throw new Error("Web runtimeRoot must not be a symbolic link.");
  }
  if (!rootDetails.isDirectory()) {
    throw new Error("Web runtimeRoot must be a directory.");
  }
  const root = await realpath(runtimeRoot);
  const expected = envelope.manifest.repositories.web;
  assertWebCoreBindings(expected);
  const assetPaths = await listBoundDirectoryFiles(
    root,
    expected.assets.directory,
    "manifest.repositories.web.assets.directory",
  );
  const expectedAssetPaths = expected.assets.files.map(({ path }) => path);
  if (JSON.stringify(assetPaths) !== JSON.stringify(expectedAssetPaths)) {
    throw new Error(
      "Web runtime asset path set does not match the release manifest.",
    );
  }
  let verifiedFileCount = 0;
  for (const [key, descriptors] of Object.entries({
    assets: expected.assets.files,
    criticalBundles: expected.assets.criticalBundles,
    contracts: expected.contracts,
    configs: expected.configs,
    sboms: expected.sboms,
    dependencyLocks: expected.dependencyLocks,
  })) {
    verifiedFileCount += await verifyDescriptorFiles(
      root,
      descriptors,
      `manifest.repositories.web.${key}`,
    );
  }
  return verifiedFileCount;
}

function portablePath(path) {
  return path.split(sep).join("/");
}

async function sha256(path) {
  const initial = await lstat(path);
  if (initial.isSymbolicLink() || !initial.isFile()) {
    throw new Error(`Hashed runtime path must be a regular file: ${path}`);
  }
  const handle = await open(path, NOFOLLOW_READ_FLAGS);
  try {
    const before = await handle.stat();
    if (
      !before.isFile() ||
      before.dev !== initial.dev ||
      before.ino !== initial.ino
    ) {
      throw new Error(`Hashed runtime path changed before reading: ${path}`);
    }
    const contents = await handle.readFile();
    const after = await handle.stat();
    const final = await lstat(path);
    if (
      final.isSymbolicLink() ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs ||
      after.ctimeMs !== before.ctimeMs ||
      final.dev !== before.dev ||
      final.ino !== before.ino
    ) {
      throw new Error(`Hashed runtime path changed while being read: ${path}`);
    }
    return {
      bytes: contents.byteLength,
      sha256: createHash("sha256").update(contents).digest("hex"),
    };
  } finally {
    await handle.close();
  }
}

function shouldDeploy(sourceRoot, sourcePath) {
  const relativePath = relative(sourceRoot, sourcePath);
  if (relativePath === "") return true;
  const [topLevel] = relativePath.split(sep);
  if (
    topLevel === RELEASE_MANIFEST ||
    topLevel === CANONICAL_RELEASE_MANIFEST
  ) {
    return false;
  }
  if (EXCLUDED_TOP_LEVEL_PATHS.has(topLevel)) return false;
  if (topLevel === ".env" || topLevel.startsWith(".env.")) {
    return topLevel === ".env.example";
  }
  return true;
}

async function listManifestFiles(root, directory = root) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);
    const relativePath = relative(root, absolutePath);
    const [topLevel] = relativePath.split(sep);
    if (
      EXCLUDED_TOP_LEVEL_PATHS.has(topLevel) ||
      entry.name === RELEASE_MANIFEST ||
      entry.name === CANONICAL_RELEASE_MANIFEST ||
      entry.name.endsWith(".tsbuildinfo")
    ) {
      continue;
    }
    if (entry.isSymbolicLink()) {
      throw new Error(
        `Release candidates cannot contain symbolic links: ${relativePath}`,
      );
    }
    if (entry.isDirectory()) {
      files.push(...(await listManifestFiles(root, absolutePath)));
    } else if (entry.isFile()) {
      files.push(portablePath(relativePath));
    }
  }
  return files.sort(compareText);
}

async function createManifest(root, metadata) {
  const paths = await listManifestFiles(root);
  const files = [];
  for (const path of paths) {
    files.push({ path, ...(await sha256(join(root, path))) });
  }
  const runtimeMetadata = {
    schemaVersion: 3,
    algorithm: "sha256",
    activationScope: "local-web-only",
    createdAt: metadata.createdAt,
    environment: metadata.envelope.manifest.environment,
    releaseId: metadata.envelope.manifest.releaseId,
    releaseManifestSha256: metadata.envelope.manifestSha256,
    repositories: Object.fromEntries(
      ["backend", "frontend", "web"].map((name) => [
        name,
        metadata.envelope.manifest.repositories[name].commitSha,
      ]),
    ),
    sourceDirectory: metadata.sourceDirectory,
    nodeVersion: process.version,
    files,
  };
  return {
    ...runtimeMetadata,
    metadataSha256: createHash("sha256")
      .update(canonicalJson(runtimeMetadata), "utf8")
      .digest("hex"),
  };
}

export async function assertSeparatedRoots(sourceRoot, runtimeRoot) {
  const [resolvedSource, resolvedRuntime] = await Promise.all([
    realpath(sourceRoot),
    realpath(runtimeRoot),
  ]);
  const runtimeFromSource = relative(resolvedSource, resolvedRuntime);
  const sourceFromRuntime = relative(resolvedRuntime, resolvedSource);
  const isNested = (path) =>
    path !== "" && path !== ".." && !path.startsWith(`..${sep}`);
  if (
    resolvedSource === resolvedRuntime ||
    isNested(runtimeFromSource) ||
    isNested(sourceFromRuntime)
  ) {
    throw new Error(
      "Source and runtime must be separate directories and non-nested directories.",
    );
  }
  return { sourceRoot: resolvedSource, runtimeRoot: resolvedRuntime };
}

export async function prepareRuntimeCandidate({
  sourceRoot,
  runtimeRoot,
  candidateRoot,
  releaseManifest,
  createdAt = new Date().toISOString(),
}) {
  if (
    !releaseManifest ||
    typeof releaseManifest !== "object" ||
    typeof releaseManifest.canonicalContents !== "string" ||
    !releaseManifest.envelope
  ) {
    throw new Error(
      "A validated three-repository release manifest is required for candidate preparation.",
    );
  }
  validateManifestEnvelope(releaseManifest.envelope);
  if (
    releaseManifest.canonicalContents !==
    `${canonicalJson(releaseManifest.envelope)}\n`
  ) {
    throw new Error(
      "Release manifest canonical contents do not match its envelope.",
    );
  }
  const resolved = await assertSeparatedRoots(sourceRoot, runtimeRoot);
  await verifyWebSourceBinding({
    envelope: releaseManifest.envelope,
    sourceRoot: resolved.sourceRoot,
  });
  const [sourceLock, runtimeLock] = await Promise.all([
    sha256(join(resolved.sourceRoot, "package-lock.json")),
    sha256(join(resolved.runtimeRoot, "package-lock.json")),
  ]);
  if (sourceLock.sha256 !== runtimeLock.sha256) {
    throw new Error(
      "Runtime dependencies do not match package-lock.json; refresh dependencies before publishing.",
    );
  }
  try {
    await lstat(candidateRoot);
    throw new Error("Candidate root already exists.");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  try {
    await mkdir(dirname(candidateRoot), { recursive: true });
    await cp(resolved.sourceRoot, candidateRoot, {
      recursive: true,
      force: false,
      errorOnExist: true,
      verbatimSymlinks: true,
      filter: (sourcePath) => shouldDeploy(resolved.sourceRoot, sourcePath),
    });
    await cp(
      join(resolved.runtimeRoot, "node_modules"),
      join(candidateRoot, "node_modules"),
      {
        recursive: true,
        force: false,
        errorOnExist: true,
        verbatimSymlinks: true,
      },
    );

    const canonicalManifestPath = join(
      candidateRoot,
      CANONICAL_RELEASE_MANIFEST,
    );
    await writeFile(canonicalManifestPath, releaseManifest.canonicalContents, {
      flag: "wx",
      mode: 0o444,
    });
    await chmod(canonicalManifestPath, 0o444);

    const manifest = await createManifest(candidateRoot, {
      createdAt,
      envelope: releaseManifest.envelope,
      sourceDirectory: basename(resolved.sourceRoot),
    });
    await writeFile(
      join(candidateRoot, RELEASE_MANIFEST),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    await verifyRuntimeManifest(candidateRoot);
    await verifyWebSourceBinding({
      envelope: releaseManifest.envelope,
      sourceRoot: resolved.sourceRoot,
    });
    return manifest;
  } catch (error) {
    await rm(candidateRoot, { recursive: true, force: true });
    throw error;
  }
}

export async function verifyRuntimeManifest(runtimeRoot) {
  const manifest = JSON.parse(
    (
      await readBoundFile(
        await realpath(runtimeRoot),
        RELEASE_MANIFEST,
        "Runtime metadata",
      )
    ).toString("utf8"),
  );
  const metadataKeys = [
    "activationScope",
    "algorithm",
    "createdAt",
    "environment",
    "files",
    "metadataSha256",
    "nodeVersion",
    "releaseId",
    "releaseManifestSha256",
    "repositories",
    "schemaVersion",
    "sourceDirectory",
  ];
  if (
    JSON.stringify(Object.keys(manifest).sort()) !==
    JSON.stringify(metadataKeys)
  ) {
    throw new Error(
      "Runtime metadata uses an unsupported or incomplete manifest-bound schema.",
    );
  }
  const { metadataSha256, ...unsignedMetadata } = manifest;
  const expectedMetadataSha256 = createHash("sha256")
    .update(canonicalJson(unsignedMetadata), "utf8")
    .digest("hex");
  if (
    typeof metadataSha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(metadataSha256) ||
    metadataSha256 !== expectedMetadataSha256
  ) {
    throw new Error("Runtime metadata SHA-256 indicates metadata drift.");
  }
  if (
    manifest.schemaVersion !== 3 ||
    manifest.algorithm !== "sha256" ||
    manifest.activationScope !== "local-web-only" ||
    !Array.isArray(manifest.files)
  ) {
    throw new Error(
      "Runtime metadata uses an unsupported or incomplete manifest-bound schema.",
    );
  }
  const canonicalManifestPath = join(runtimeRoot, CANONICAL_RELEASE_MANIFEST);
  const canonicalDetails = await lstat(canonicalManifestPath);
  if (
    canonicalDetails.isSymbolicLink() ||
    !canonicalDetails.isFile() ||
    (canonicalDetails.mode & 0o222) !== 0
  ) {
    throw new Error(
      "Runtime release manifest must be a read-only regular file and not a symbolic link.",
    );
  }
  const releaseManifest = await loadLocalReleaseManifest({
    manifestPath: canonicalManifestPath,
    requireCanonical: true,
  });
  const envelope = releaseManifest.envelope;
  const expectedRepositories = Object.fromEntries(
    ["backend", "frontend", "web"].map((name) => [
      name,
      envelope.manifest.repositories[name].commitSha,
    ]),
  );
  if (
    manifest.releaseManifestSha256 !== envelope.manifestSha256 ||
    manifest.releaseId !== envelope.manifest.releaseId ||
    manifest.environment !== envelope.manifest.environment ||
    JSON.stringify(manifest.repositories) !==
      JSON.stringify(expectedRepositories)
  ) {
    throw new Error("Runtime metadata does not match the release manifest.");
  }
  const actualPaths = await listManifestFiles(runtimeRoot);
  const expectedPaths = manifest.files.map(({ path }) => path);
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
    throw new Error("Runtime manifest path set does not match deployed files.");
  }
  for (const expected of manifest.files) {
    if (
      !expected ||
      typeof expected !== "object" ||
      Array.isArray(expected) ||
      JSON.stringify(Object.keys(expected).sort()) !==
        JSON.stringify(["bytes", "path", "sha256"])
    ) {
      throw new Error("Runtime metadata contains an invalid file descriptor.");
    }
    const actual = await sha256(join(runtimeRoot, expected.path));
    if (actual.sha256 !== expected.sha256 || actual.bytes !== expected.bytes) {
      throw new Error(`Runtime manifest mismatch: ${expected.path}`);
    }
  }
  await verifyWebRuntimeBinding({ envelope, runtimeRoot });
  return manifest.files.length;
}

export async function verifyLocalRuntimeRelease({
  runtimeRoots,
  runtimeVersions,
} = {}) {
  if (
    !runtimeRoots ||
    typeof runtimeRoots !== "object" ||
    Array.isArray(runtimeRoots)
  ) {
    throw new Error(
      "runtimeRoots must explicitly contain the Web runtime root.",
    );
  }
  const names = Object.keys(runtimeRoots).sort();
  const webOnly = names.join(",") === "web";
  const allRepositories = names.join(",") === "backend,frontend,web";
  if (!webOnly && !allRepositories) {
    throw new Error(
      "runtimeRoots must contain either web only or exactly backend, frontend, and web.",
    );
  }
  await verifyRuntimeManifest(runtimeRoots.web);
  if (webOnly) {
    return { activationEvidence: false, scope: "local-web-only" };
  }
  await verifyReleaseManifest({
    manifestPath: join(runtimeRoots.web, CANONICAL_RELEASE_MANIFEST),
    runtimeRoots,
    runtimeVersions,
  });
  return {
    activationEvidence: false,
    scope: "local-three-repository-runtime-bound",
  };
}

export async function activateRuntimeCandidate({
  runtimeRoot,
  candidateRoot,
  backupRoot,
  validate,
  recover,
}) {
  await rename(runtimeRoot, backupRoot);
  try {
    await rename(candidateRoot, runtimeRoot);
  } catch (error) {
    await rename(backupRoot, runtimeRoot);
    throw error;
  }

  try {
    await validate();
    return backupRoot;
  } catch (validationError) {
    await rename(runtimeRoot, candidateRoot);
    await rename(backupRoot, runtimeRoot);
    try {
      await recover();
    } catch (recoveryError) {
      throw new AggregateError(
        [validationError, recoveryError],
        "Candidate validation failed and the restored runtime did not recover.",
        { cause: recoveryError },
      );
    }
    throw validationError;
  }
}

export async function publishLocalRuntime({
  sourceRoots,
  runtimeRoots,
  candidateRoot,
  backupRoot,
  lockRoot,
  releaseManifest,
  runGates,
  validate,
  recover,
}) {
  if (
    !sourceRoots ||
    typeof sourceRoots !== "object" ||
    Array.isArray(sourceRoots) ||
    Object.keys(sourceRoots).join(",") !== "web" ||
    typeof sourceRoots.web !== "string"
  ) {
    throw new Error("sourceRoots must contain exactly the Web source root.");
  }
  if (
    !runtimeRoots ||
    typeof runtimeRoots !== "object" ||
    Array.isArray(runtimeRoots) ||
    Object.keys(runtimeRoots).join(",") !== "web" ||
    typeof runtimeRoots.web !== "string"
  ) {
    throw new Error("runtimeRoots must contain exactly the Web runtime root.");
  }
  const sourceRoot = sourceRoots.web;
  const runtimeRoot = runtimeRoots.web;
  const publicationLockRoot = lockRoot ?? `${runtimeRoot}.publish.lock`;
  let lockAcquired = false;
  let candidatePrepared = false;
  try {
    try {
      await mkdir(publicationLockRoot);
      lockAcquired = true;
    } catch (error) {
      if (error?.code === "EEXIST") {
        throw new Error(
          `Local runtime publication is already in progress: ${publicationLockRoot}`,
          { cause: error },
        );
      }
      throw error;
    }
    await assertSeparatedRoots(sourceRoot, runtimeRoot);
    await runGates();
    const manifest = await prepareRuntimeCandidate({
      sourceRoot,
      runtimeRoot,
      candidateRoot,
      releaseManifest,
    });
    candidatePrepared = true;
    await activateRuntimeCandidate({
      runtimeRoot,
      candidateRoot,
      backupRoot,
      validate,
      recover,
    });
    candidatePrepared = false;
    return { backupRoot, fileCount: manifest.files.length };
  } finally {
    if (candidatePrepared) {
      await rm(candidateRoot, { recursive: true, force: true });
    }
    if (lockAcquired) {
      await rm(publicationLockRoot, { recursive: true, force: true });
    }
  }
}

function runCommand(command, args, { cwd, env = process.env } = {}) {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, { cwd, env, stdio: "inherit" });
    child.once("error", rejectCommand);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolveCommand();
        return;
      }
      rejectCommand(
        new Error(
          `${command} ${args.join(" ")} failed (${signal ?? `exit ${code}`}).`,
        ),
      );
    });
  });
}

export function createCommandEnvironment(
  environment = process.env,
  nodeExecutable = process.execPath,
) {
  const pathEntries = [
    dirname(nodeExecutable),
    ...(environment.PATH ?? "").split(delimiter),
    "/usr/sbin",
    "/sbin",
  ].filter(Boolean);
  return {
    ...environment,
    PATH: [...new Set(pathEntries)].join(delimiter),
  };
}

export async function runQualityGates(
  sourceRoot,
  commandEnvironment,
  execute = runCommand,
) {
  await execute(
    process.execPath,
    [
      "--test",
      "scripts/release-manifest.spec.mjs",
      "scripts/local-runtime-publish.spec.mjs",
      "scripts/local-runtime-smoke.spec.mjs",
    ],
    { cwd: sourceRoot, env: commandEnvironment },
  );
  await execute(
    "npm",
    ["exec", "--", "vitest", "run", ...FOCUSED_ANALYSIS_SPECS],
    { cwd: sourceRoot, env: commandEnvironment },
  );
  await execute("npm", ["run", "build"], {
    cwd: sourceRoot,
    env: commandEnvironment,
  });
  await execute("npm", ["run", "budget"], {
    cwd: sourceRoot,
    env: commandEnvironment,
  });
  await execute(
    "npm",
    [
      "exec",
      "--",
      "prettier",
      "--check",
      "package.json",
      "scripts/local-runtime-publish.mjs",
      "scripts/local-runtime-publish.spec.mjs",
      "scripts/local-runtime-smoke.mjs",
      "scripts/local-runtime-smoke.spec.mjs",
      "docs/production-readiness/local-runtime-publish.md",
    ],
    { cwd: sourceRoot, env: commandEnvironment },
  );
  await execute(
    "npm",
    [
      "exec",
      "--",
      "eslint",
      "scripts/local-runtime-publish.mjs",
      "scripts/local-runtime-publish.spec.mjs",
      "scripts/local-runtime-smoke.mjs",
      "scripts/local-runtime-smoke.spec.mjs",
    ],
    { cwd: sourceRoot, env: commandEnvironment },
  );
  await execute(
    "git",
    [
      "diff",
      "--check",
      "--",
      "package.json",
      "scripts/local-runtime-publish.mjs",
      "scripts/local-runtime-publish.spec.mjs",
      "scripts/local-runtime-smoke.mjs",
      "scripts/local-runtime-smoke.spec.mjs",
      "docs/production-readiness/local-runtime-publish.md",
      ...FOCUSED_ANALYSIS_SPECS,
    ],
    { cwd: sourceRoot, env: commandEnvironment },
  );
}

const pause = (milliseconds) =>
  new Promise((resolvePause) => setTimeout(resolvePause, milliseconds));

export async function restartManagedRuntime(
  runtimeRoot,
  commandEnvironment,
  { execute = runCommand, pause: wait = pause, healthAttempts = 15 } = {},
) {
  const runtimeWorkspace = dirname(runtimeRoot);
  const backendControl = join(
    runtimeWorkspace,
    "cofco-qiqihar-enterprise-backend",
    "scripts",
    "local-runtime.sh",
  );
  const backendHealth = join(
    runtimeWorkspace,
    "cofco-qiqihar-enterprise-backend",
    "scripts",
    "healthcheck-local.sh",
  );
  let restartFailure;
  try {
    await execute("/bin/bash", [backendControl, "restart"], {
      cwd: runtimeWorkspace,
      env: commandEnvironment,
    });
  } catch (error) {
    restartFailure = error;
  }

  let healthFailure;
  for (let attempt = 1; attempt <= healthAttempts; attempt += 1) {
    try {
      await execute("/bin/bash", [backendHealth], {
        cwd: runtimeWorkspace,
        env: commandEnvironment,
      });
      if (restartFailure) {
        console.warn(
          "[WARN] managed restart control timed out, but the bounded ownership and health gate succeeded",
        );
      }
      return;
    } catch (error) {
      healthFailure = error;
      if (attempt < healthAttempts) await wait(1_000);
    }
  }
  if (restartFailure) {
    throw new AggregateError(
      [restartFailure, healthFailure],
      "Managed restart failed and managed health did not recover.",
      { cause: healthFailure },
    );
  }
  throw healthFailure;
}

async function validateManagedRuntime(runtimeRoot, commandEnvironment) {
  await restartManagedRuntime(runtimeRoot, commandEnvironment);
  const backendRoot = commandEnvironment.COFCO_ENTERPRISE_BACKEND_ROOT?.trim();
  const frontendRoot =
    commandEnvironment.COFCO_ENTERPRISE_FRONTEND_ROOT?.trim();
  if (Boolean(backendRoot) !== Boolean(frontendRoot)) {
    throw new Error(
      "Backend and Frontend runtime roots must be provided together for three-repository verification.",
    );
  }
  const runtimeRoots = backendRoot
    ? { backend: backendRoot, frontend: frontendRoot, web: runtimeRoot }
    : { web: runtimeRoot };
  let runtimeVersions;
  if (backendRoot) {
    runtimeVersions = {
      node: commandEnvironment.COFCO_RUNTIME_NODE_VERSION?.trim(),
      npm: commandEnvironment.COFCO_RUNTIME_NPM_VERSION?.trim(),
      jdk: commandEnvironment.COFCO_RUNTIME_JDK_VERSION?.trim(),
    };
    if (Object.values(runtimeVersions).some((value) => !value)) {
      throw new Error(
        "Three-repository verification requires COFCO_RUNTIME_NODE_VERSION, COFCO_RUNTIME_NPM_VERSION, and COFCO_RUNTIME_JDK_VERSION.",
      );
    }
  }
  const verification = await verifyLocalRuntimeRelease({
    runtimeRoots,
    runtimeVersions,
  });
  console.log(
    `[OK] release manifest and runtime assets verified (${verification.scope}); this is not three-repository activation evidence`,
  );
  await runCommand(
    process.execPath,
    [join(runtimeRoot, "scripts", "local-runtime-smoke.mjs")],
    { cwd: runtimeRoot, env: commandEnvironment },
  );
}

export function parseLocalRuntimeCli(argv, environment = process.env) {
  const [command, ...options] = argv;
  if (command !== "publish" && command !== "verify") {
    throw new Error(
      "Usage: node scripts/local-runtime-publish.mjs {publish --manifest <path>|verify}",
    );
  }
  let manifestPath;
  for (let index = 0; index < options.length; index += 1) {
    if (options[index] !== "--manifest" || manifestPath !== undefined) {
      throw new Error(`Unknown or duplicate option: ${options[index]}`);
    }
    manifestPath = options[index + 1];
    if (!manifestPath || manifestPath.startsWith("--")) {
      throw new Error("--manifest requires a path.");
    }
    index += 1;
  }
  if (command === "verify") {
    if (manifestPath !== undefined) {
      throw new Error(
        "verify reads the canonical manifest inside the runtime and does not accept --manifest.",
      );
    }
    return { command };
  }
  manifestPath ??= environment.COFCO_RELEASE_MANIFEST_PATH?.trim();
  if (!manifestPath) {
    throw new Error(
      "publish requires --manifest <path> or COFCO_RELEASE_MANIFEST_PATH.",
    );
  }
  return { command, manifestPath };
}

async function runCli() {
  if (Number(process.versions.node.split(".")[0]) !== 24) {
    throw new Error(
      `Node 24 is required; current runtime is ${process.version}.`,
    );
  }
  const cli = parseLocalRuntimeCli(process.argv.slice(2));
  const sourceRoot = resolve(import.meta.dirname, "..");
  const runtimeRoot = DEFAULT_RUNTIME_ROOT;
  const commandEnvironment = createCommandEnvironment();
  if (cli.command === "verify") {
    await validateManagedRuntime(runtimeRoot, commandEnvironment);
    return;
  }
  const releaseManifest = await loadLocalReleaseManifest({
    manifestPath: resolve(cli.manifestPath),
  });

  const runtimeWorkspace = dirname(runtimeRoot);
  const temporaryRoot = await mkdtemp(join(runtimeWorkspace, ".web-release-"));
  const candidateRoot = join(temporaryRoot, basename(runtimeRoot));
  const releaseId = new Date().toISOString().replaceAll(/[:.]/gu, "-");
  const backupRoot = `${runtimeRoot}.previous.${releaseId}.${process.pid}`;
  try {
    const result = await publishLocalRuntime({
      sourceRoots: { web: sourceRoot },
      runtimeRoots: { web: runtimeRoot },
      candidateRoot,
      backupRoot,
      releaseManifest,
      runGates: () => runQualityGates(sourceRoot, commandEnvironment),
      validate: () => validateManagedRuntime(runtimeRoot, commandEnvironment),
      recover: () => restartManagedRuntime(runtimeRoot, commandEnvironment),
    });
    console.log(
      `[OK] local runtime published: ${result.fileCount} files; rollback copy: ${result.backupRoot}`,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

const isDirectExecution =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectExecution) {
  await runCli();
}
