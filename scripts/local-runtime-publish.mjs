import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";

export const RELEASE_MANIFEST = ".cofco-runtime-release.json";

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
  "evidence",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const DEPLOYABLE_TOP_LEVEL_FILES = new Set([
  "package-lock.json",
  "package.json",
  "vite.config.ts",
]);
const DEPLOYABLE_SCRIPT_FILES = new Set(["local-runtime-smoke.mjs"]);

function portablePath(path) {
  return path.split(sep).join("/");
}

async function sha256(path) {
  const contents = await readFile(path);
  return {
    bytes: contents.byteLength,
    sha256: createHash("sha256").update(contents).digest("hex"),
  };
}

function shouldDeploy(sourceRoot, sourcePath) {
  const relativePath = relative(sourceRoot, sourcePath);
  if (relativePath === "") return true;
  const [topLevel] = relativePath.split(sep);
  if (topLevel === "dist") return true;
  if (topLevel === "scripts") {
    return (
      relativePath === "scripts" ||
      DEPLOYABLE_SCRIPT_FILES.has(relativePath.split(sep)[1] ?? "")
    );
  }
  return (
    !relativePath.includes(sep) && DEPLOYABLE_TOP_LEVEL_FILES.has(relativePath)
  );
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
  return files.sort((left, right) => left.localeCompare(right, "en"));
}

async function createManifest(root, metadata) {
  const paths = await listManifestFiles(root);
  const files = [];
  for (const path of paths) {
    files.push({ path, ...(await sha256(join(root, path))) });
  }
  return {
    schemaVersion: 2,
    algorithm: "sha256",
    createdAt: metadata.createdAt,
    sourceDirectory: metadata.sourceDirectory,
    nodeVersion: process.version,
    files,
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
  createdAt = new Date().toISOString(),
}) {
  const resolved = await assertSeparatedRoots(sourceRoot, runtimeRoot);
  const [sourceLock, runtimeLock] = await Promise.all([
    sha256(join(resolved.sourceRoot, "package-lock.json")),
    sha256(join(resolved.runtimeRoot, "package-lock.json")),
  ]);
  if (sourceLock.sha256 !== runtimeLock.sha256) {
    throw new Error(
      "Runtime dependencies do not match package-lock.json; refresh dependencies before publishing.",
    );
  }

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

  const manifest = await createManifest(candidateRoot, {
    createdAt,
    sourceDirectory: basename(resolved.sourceRoot),
  });
  await writeFile(
    join(candidateRoot, RELEASE_MANIFEST),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await verifyRuntimeManifest(candidateRoot);
  return manifest;
}

export async function verifyRuntimeManifest(runtimeRoot) {
  const manifest = JSON.parse(
    await readFile(join(runtimeRoot, RELEASE_MANIFEST), "utf8"),
  );
  const actualPaths = await listManifestFiles(runtimeRoot);
  const expectedPaths = manifest.files.map(({ path }) => path);
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
    throw new Error("Runtime manifest path set does not match deployed files.");
  }
  for (const expected of manifest.files) {
    const actual = await sha256(join(runtimeRoot, expected.path));
    if (actual.sha256 !== expected.sha256 || actual.bytes !== expected.bytes) {
      throw new Error(`Runtime manifest mismatch: ${expected.path}`);
    }
  }
  return manifest.files.length;
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
  sourceRoot,
  runtimeRoot,
  candidateRoot,
  backupRoot,
  runGates,
  validate,
  recover,
}) {
  await assertSeparatedRoots(sourceRoot, runtimeRoot);
  await runGates();
  const manifest = await prepareRuntimeCandidate({
    sourceRoot,
    runtimeRoot,
    candidateRoot,
  });
  await activateRuntimeCandidate({
    runtimeRoot,
    candidateRoot,
    backupRoot,
    validate,
    recover,
  });
  return { backupRoot, fileCount: manifest.files.length };
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

export async function runQualityGates(
  sourceRoot,
  commandEnvironment,
  execute = runCommand,
) {
  await execute(
    process.execPath,
    [
      "--test",
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
  const fileCount = await verifyRuntimeManifest(runtimeRoot);
  console.log(
    `[OK] verified ${fileCount} deployed files against SHA-256 manifest`,
  );
  await runCommand(
    process.execPath,
    [join(runtimeRoot, "scripts", "local-runtime-smoke.mjs")],
    { cwd: runtimeRoot, env: commandEnvironment },
  );
}

async function runCli() {
  if (Number(process.versions.node.split(".")[0]) !== 24) {
    throw new Error(
      `Node 24 is required; current runtime is ${process.version}.`,
    );
  }
  const sourceRoot = resolve(import.meta.dirname, "..");
  const runtimeRoot = DEFAULT_RUNTIME_ROOT;
  const commandEnvironment = {
    ...process.env,
    PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ""}`,
  };
  if (process.argv[2] === "verify") {
    await validateManagedRuntime(runtimeRoot, commandEnvironment);
    return;
  }
  if (process.argv[2] !== "publish") {
    throw new Error(
      "Usage: node scripts/local-runtime-publish.mjs {publish|verify}",
    );
  }

  const runtimeWorkspace = dirname(runtimeRoot);
  const temporaryRoot = await mkdtemp(join(runtimeWorkspace, ".web-release-"));
  const candidateRoot = join(temporaryRoot, basename(runtimeRoot));
  const releaseId = new Date().toISOString().replaceAll(/[:.]/gu, "-");
  const backupRoot = `${runtimeRoot}.previous.${releaseId}.${process.pid}`;
  try {
    const result = await publishLocalRuntime({
      sourceRoot,
      runtimeRoot,
      candidateRoot,
      backupRoot,
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
