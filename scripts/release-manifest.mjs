import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  lstat,
  link,
  mkdir,
  open,
  readdir,
  realpath,
  rm,
} from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { promisify } from "node:util";

const ENVELOPE_KEYS = new Set(["manifest", "manifestSha256"]);
const MANIFEST_KEYS = new Set([
  "schemaVersion",
  "releaseId",
  "environment",
  "createdAt",
  "generatorVersion",
  "repositories",
  "evidence",
]);
const BUILD_KEYS = new Set(["command", "node", "npm", "jdk"]);
const FILE_DESCRIPTOR_KEYS = new Set(["path", "sha256", "size", "kind"]);
const FILE_DESCRIPTOR_REQUIRED_KEYS = new Set(["path", "sha256", "size"]);
const MIGRATION_FILE_KEYS = new Set(["path", "sha256", "size", "version"]);
const MIGRATION_KEYS = new Set([
  "directory",
  "files",
  "highestVersion",
  "collectionSha256",
]);
const ASSET_KEYS = new Set(["directory", "files", "criticalBundles"]);
const BACKEND_REPOSITORY_KEYS = new Set([
  "origin",
  "commitSha",
  "ref",
  "build",
  "artifacts",
  "migrations",
  "contracts",
  "configs",
  "sboms",
  "dependencyLocks",
  "containerImage",
]);
const ASSET_REPOSITORY_KEYS = new Set([
  "origin",
  "commitSha",
  "ref",
  "build",
  "assets",
  "contracts",
  "configs",
  "sboms",
  "dependencyLocks",
  "containerImage",
]);
const RUNTIME_VERSION_KEYS = new Set(["node", "npm", "jdk"]);
const REPOSITORY_NAMES = ["backend", "frontend", "web"];
const SHA_256_PATTERN = /^[a-f0-9]{64}$/;
const GIT_SHA_PATTERN = /^[a-f0-9]{40}$/;
const MIGRATION_VERSION_PATTERN = /^(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*))*$/u;
const MIGRATION_FILENAME_PATTERN = /^V((?:0|[1-9]\d*)(?:[._]\d+)*)__/u;
const REPOSITORY_ARRAY_KEYS = [
  "artifacts",
  "contracts",
  "configs",
  "sboms",
  "dependencyLocks",
];
const exec = promisify(execFile);
const CONTAINER_DIGEST_PATTERN = /^[^@\s]+@sha256:[a-f0-9]{64}$/u;
const PRIVATE_KEY_PATTERN = /-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----/u;
const DIRECT_TOKEN_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/u,
  /\b(?:gh[opsu]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/u,
  /\bsk-[A-Za-z0-9_-]{20,}\b/u,
  /\bAKIA[A-Z0-9]{16}\b/u,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/u,
];
const SAFE_SECRET_VALUE_PATTERN =
  /^(?:\$\{[^}]+\}|\$[A-Z_][A-Z0-9_]*|(?:acs:kms|kms|vault|secret|env|ref):\/?.+|<[^>]+>|\*+|x+|redacted|placeholder|not[-_ ]?set|null|true|false)$/iu;
const NOFOLLOW_READ_FLAGS =
  fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0);

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseMigrationPath(path) {
  const match = MIGRATION_FILENAME_PATTERN.exec(basename(path));
  if (!match) return null;
  const components = match[1].split(/[._]/u).map((part) => BigInt(part));
  return {
    path,
    version: components.map((part) => part.toString()).join("."),
    components,
  };
}

function compareMigrationVersions(left, right) {
  const length = Math.max(left.components.length, right.components.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left.components[index] ?? 0n;
    const rightPart = right.components[index] ?? 0n;
    if (leftPart < rightPart) return -1;
    if (leftPart > rightPart) return 1;
  }
  return 0;
}

async function runGit(root, ...args) {
  const result = await exec("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return result.stdout.trim();
}

function assertSafeRelativePath(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    isAbsolute(value) ||
    /^[A-Za-z]:[\\/]/u.test(value) ||
    value.includes("\\") ||
    value.includes("\0")
  ) {
    throw new Error(`${label} must be a safe relative path`);
  }
  const segments = value.split("/");
  if (
    segments.some(
      (segment) => segment.length === 0 || segment === "." || segment === "..",
    )
  ) {
    throw new Error(`${label} must be a safe relative path`);
  }
  return segments.join("/");
}

function isWithinRoot(root, candidate) {
  const difference = relative(root, candidate);
  return (
    difference === "" ||
    (!difference.startsWith(`..${sep}`) &&
      difference !== ".." &&
      !isAbsolute(difference))
  );
}

async function resolveBoundPath(root, path, label, expectedType) {
  const safePath = assertSafeRelativePath(path, label);
  let candidate = root;
  for (const segment of safePath.split("/")) {
    candidate = join(candidate, segment);
    const details = await lstat(candidate);
    if (details.isSymbolicLink()) {
      throw new Error(`${label} must not contain a symbolic link`);
    }
  }
  const resolvedPath = await realpath(candidate);
  if (!isWithinRoot(root, resolvedPath)) {
    throw new Error(
      `${label} must be a safe relative path inside the repository root`,
    );
  }
  const details = await lstat(resolvedPath);
  if (expectedType === "file" && !details.isFile())
    throw new Error(`${label} must be a regular file`);
  if (expectedType === "directory" && !details.isDirectory())
    throw new Error(`${label} must be a directory`);
  return { path: safePath, resolvedPath, details };
}

function isSafeSecretReference(value) {
  if (value === null || typeof value === "boolean") return true;
  return (
    typeof value === "string" && SAFE_SECRET_VALUE_PATTERN.test(value.trim())
  );
}

function normalizeKeyName(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/gu, "$1_$2")
    .replace(/[^A-Za-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .toLowerCase();
}

function isSecretReferenceKey(key) {
  const normalized = normalizeKeyName(key);
  return /(?:^|_)(?:secret|password|token|credential)_(?:reference|references|ref|refs)(?:_|$)/u.test(
    normalized,
  );
}

function isSecretKey(key) {
  const normalized = normalizeKeyName(key);
  return /(?:^|_)(?:password|passwd|pwd|private_key|client_secret|access_key_secret|api_key|auth_token|token|secret)(?:_|$)/u.test(
    normalized,
  );
}

function containsUnsafeSecretValue(value) {
  if (Array.isArray(value)) return value.some(containsUnsafeSecretValue);
  if (isPlainObject(value))
    return Object.values(value).some(containsUnsafeSecretValue);
  return !isSafeSecretReference(value) && String(value ?? "").trim().length > 0;
}

function containsJsonSecretMaterial(value) {
  if (Array.isArray(value)) return value.some(containsJsonSecretMaterial);
  if (!isPlainObject(value)) return false;
  return Object.entries(value).some(([key, child]) => {
    if (isSecretReferenceKey(key) || isSecretKey(key))
      return containsUnsafeSecretValue(child);
    return containsJsonSecretMaterial(child);
  });
}

function assertNoSecretMaterial(buffer, label) {
  const searchableText = buffer.toString("utf8");
  if (
    PRIVATE_KEY_PATTERN.test(searchableText) ||
    DIRECT_TOKEN_PATTERNS.some((pattern) => pattern.test(searchableText))
  ) {
    throw new Error(`${label} contains secret material`);
  }
  let structuredText;
  try {
    structuredText = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return;
  }
  try {
    if (containsJsonSecretMaterial(JSON.parse(structuredText))) {
      throw new Error(`${label} contains secret material`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("secret material"))
      throw error;
  }
  const assignmentPattern =
    /^\s*(?:export\s+)?["']?([A-Za-z0-9_.-]+)["']?\s*[:=]\s*["']?([^\s,"'#}]+)["']?/gmu;
  for (const match of structuredText.matchAll(assignmentPattern)) {
    const [, key, rawValue] = match;
    if (
      isSecretKey(key) &&
      !isSecretReferenceKey(key) &&
      rawValue.length > 0 &&
      !SAFE_SECRET_VALUE_PATTERN.test(rawValue)
    ) {
      throw new Error(`${label} contains secret material`);
    }
  }
}

function assertNoSecretString(value, label) {
  assertNoSecretMaterial(Buffer.from(value, "utf8"), label);
}

function hashBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function readBoundFile(root, path, label) {
  const resolved = await resolveBoundPath(root, path, label, "file");
  const handle = await open(resolved.resolvedPath, NOFOLLOW_READ_FLAGS);
  try {
    const opened = await handle.stat();
    if (!opened.isFile()) throw new Error(`${label} must be a regular file`);
    if (
      opened.dev !== resolved.details.dev ||
      opened.ino !== resolved.details.ino
    ) {
      throw new Error(`${label} changed while being bound`);
    }
    const contents = await handle.readFile();
    const afterRead = await handle.stat();
    const finalDetails = await lstat(resolved.resolvedPath);
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
      throw new Error(`${label} changed while being read`);
    }
    return { contents, path: resolved.path };
  } finally {
    await handle.close();
  }
}

async function hashBoundFile(root, path, label, metadata = {}) {
  const { contents, path: safePath } = await readBoundFile(root, path, label);
  assertNoSecretMaterial(contents, label);
  return {
    ...metadata,
    path: safePath,
    sha256: hashBuffer(contents),
    size: contents.byteLength,
  };
}

function descriptorEntry(entry, label) {
  if (typeof entry === "string")
    return {
      path: assertSafeRelativePath(entry, `${label}.path`),
      metadata: {},
    };
  assertPlainObject(entry, label);
  const path = assertSafeRelativePath(entry.path, `${label}.path`);
  const metadata = {};
  if (Object.hasOwn(entry, "kind")) {
    assertNonEmptyString(entry.kind, `${label}.kind`);
    metadata.kind = entry.kind;
  }
  return { path, metadata };
}

async function hashDescriptorEntries(root, entries, label) {
  assertArray(entries, label);
  const normalized = entries.map((entry, index) =>
    descriptorEntry(entry, `${label}[${index}]`),
  );
  normalized.sort((left, right) => compareText(left.path, right.path));
  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index - 1].path === normalized[index].path) {
      throw new Error(
        `${label} contains duplicate path ${normalized[index].path}`,
      );
    }
  }
  return Promise.all(
    normalized.map(({ path, metadata }, index) =>
      hashBoundFile(root, path, `${label}[${index}].path`, metadata),
    ),
  );
}

async function collectDirectoryPaths(root, directory, label) {
  const resolved = await resolveBoundPath(root, directory, label, "directory");
  const files = [];
  async function visit(absoluteDirectory, relativeDirectory) {
    const entries = await readdir(absoluteDirectory);
    entries.sort(compareText);
    for (const name of entries) {
      const relativePath = `${relativeDirectory}/${name}`;
      const bound = await resolveBoundPath(
        root,
        relativePath,
        `${label}:${relativePath}`,
      );
      if (bound.details.isDirectory()) {
        await visit(bound.resolvedPath, relativePath);
      } else if (bound.details.isFile()) {
        files.push(relativePath);
      } else {
        throw new Error(
          `${label}:${relativePath} must be a regular file or directory`,
        );
      }
    }
  }
  await visit(resolved.resolvedPath, resolved.path);
  return files;
}

async function hashDirectory(root, directory, label) {
  const paths = await collectDirectoryPaths(root, directory, label);
  return Promise.all(
    paths.map((path, index) =>
      hashBoundFile(root, path, `${label}.files[${index}]`),
    ),
  );
}

function validateContainerImage(value, label) {
  if (typeof value !== "string" || !CONTAINER_DIGEST_PATTERN.test(value)) {
    throw new Error(`${label} must use an immutable sha256 digest`);
  }
  return value;
}

function normalizeBuild(build, label) {
  assertPlainObject(build, label);
  assertNonEmptyString(build.command, `${label}.command`);
  assertNoSecretString(build.command, `${label}.command`);
  const result = { command: build.command };
  for (const key of ["node", "npm", "jdk"]) {
    if (!Object.hasOwn(build, key) || build[key] === null) {
      result[key] = null;
    } else {
      assertNonEmptyString(build[key], `${label}.${key}`);
      result[key] = build[key];
    }
  }
  return result;
}

function assertOriginHasNoCredentials(value, label) {
  if (/[\0\r\n]/u.test(value))
    throw new Error(`${label} must be a valid origin URL or path`);
  if (/^[A-Za-z][A-Za-z0-9+.-]*::/u.test(value))
    throw new Error(`${label} uses an unsupported Git protocol`);
  if (/^[A-Za-z]:[\\/]/u.test(value)) return;
  if (
    !value.includes("://") &&
    /^(?:[^/@\s]+@)?(?:\[[^\]]+\]|[^/:\\\s]+):[^:]/u.test(value)
  )
    return;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return;
  }
  if (!["https:", "ssh:", "file:"].includes(parsed.protocol))
    throw new Error(`${label} uses an unsupported Git protocol`);
  if (parsed.password || (parsed.protocol === "https:" && parsed.username)) {
    throw new Error(`${label} must not contain credentials`);
  }
}

async function isReachableFromOrigin(root, commitSha, remoteRef) {
  const refs = (
    await runGit(root, "ls-remote", "--heads", "--tags", "origin", remoteRef)
  )
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split(/\s+/u))
    .filter(([sha, ref]) => GIT_SHA_PATTERN.test(sha) && ref === remoteRef)
    .sort((left, right) => compareText(left[1], right[1]));
  for (const [remoteSha] of refs) {
    if (remoteSha === commitSha) return true;
    try {
      await runGit(root, "cat-file", "-e", `${remoteSha}^{commit}`);
    } catch {
      await runGit(
        root,
        "fetch",
        "--quiet",
        "--no-tags",
        "--no-write-fetch-head",
        "origin",
        remoteSha,
      );
    }
    try {
      await runGit(
        root,
        "merge-base",
        "--is-ancestor",
        commitSha,
        `${remoteSha}^{commit}`,
      );
      return true;
    } catch (error) {
      if (error?.code !== 1) throw error;
    }
  }
  return false;
}

async function validateRepositoryDescriptor(name, descriptor) {
  const label = `descriptor.repositories.${name}`;
  assertPlainObject(descriptor, label);
  assertNonEmptyString(descriptor.root, `${label}.root`);
  const rootDetails = await lstat(descriptor.root);
  if (rootDetails.isSymbolicLink())
    throw new Error(`${label}.root must not be a symbolic link`);
  if (!rootDetails.isDirectory())
    throw new Error(`${label}.root must be a directory`);
  const root = await realpath(descriptor.root);
  const topLevel = await realpath(
    await runGit(root, "rev-parse", "--show-toplevel"),
  );
  if (topLevel !== root)
    throw new Error(`${label}.root must be the repository root`);

  const assertClean = async () => {
    const status = await runGit(
      root,
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    );
    if (status.length > 0) throw new Error(`${name} repository is dirty`);
  };
  await assertClean();

  assertNonEmptyString(descriptor.origin, `${label}.origin`);
  assertOriginHasNoCredentials(descriptor.origin, `${label}.origin`);
  const actualOrigin = await runGit(root, "remote", "get-url", "origin");
  assertOriginHasNoCredentials(actualOrigin, `${name} repository origin`);
  if (actualOrigin !== descriptor.origin) {
    throw new Error(
      `${name} repository origin does not match descriptor origin`,
    );
  }

  assertSha(descriptor.commitSha, `${label}.commitSha`);
  const head = await runGit(root, "rev-parse", "HEAD");
  if (head !== descriptor.commitSha)
    throw new Error(
      `${name} descriptor commitSha does not match repository HEAD`,
    );
  assertNonEmptyString(descriptor.ref, `${label}.ref`);
  if (/[\0\r\n]/u.test(descriptor.ref))
    throw new Error(`${label}.ref must be a valid Git ref`);
  let refCommit;
  let fullRef;
  try {
    fullRef = await runGit(
      root,
      "rev-parse",
      "--symbolic-full-name",
      "--verify",
      "--end-of-options",
      descriptor.ref,
    );
    refCommit = await runGit(
      root,
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${descriptor.ref}^{commit}`,
    );
  } catch {
    throw new Error(`${name} descriptor ref does not resolve to a commit`);
  }
  if (!/^refs\/(?:heads|tags)\//u.test(fullRef)) {
    throw new Error(`${name} descriptor ref must resolve to a branch or tag`);
  }
  if (refCommit !== descriptor.commitSha) {
    throw new Error(`${name} descriptor ref does not match repository HEAD`);
  }
  if (!(await isReachableFromOrigin(root, descriptor.commitSha, fullRef))) {
    throw new Error(`${name} declared ref must be reachable from origin`);
  }
  const assertStable = async () => {
    const currentHead = await runGit(root, "rev-parse", "HEAD");
    if (currentHead !== descriptor.commitSha) {
      throw new Error(
        `${name} repository HEAD changed during manifest generation`,
      );
    }
    await assertClean();
  };
  return { root, label, assertStable };
}

async function buildBackendRepository(descriptor) {
  const { root, label, assertStable } = await validateRepositoryDescriptor(
    "backend",
    descriptor,
  );
  const artifacts = await hashDescriptorEntries(
    root,
    descriptor.artifacts,
    `${label}.artifacts`,
  );
  assertPlainObject(descriptor.migrations, `${label}.migrations`);
  const migrationDirectory = assertSafeRelativePath(
    descriptor.migrations.directory,
    `${label}.migrations.directory`,
  );
  const allMigrationPaths = await collectDirectoryPaths(
    root,
    migrationDirectory,
    `${label}.migrations.directory`,
  );
  const migrationPaths = allMigrationPaths.map(parseMigrationPath);
  const unsupportedMigration = migrationPaths.findIndex(
    (entry) => entry === null,
  );
  if (unsupportedMigration !== -1) {
    throw new Error(
      `${label}.migrations contains unsupported migration ${allMigrationPaths[unsupportedMigration]}`,
    );
  }
  migrationPaths.sort(
    (left, right) =>
      compareMigrationVersions(left, right) ||
      compareText(left.path, right.path),
  );
  if (migrationPaths.length === 0)
    throw new Error(`${label}.migrations contains no Flyway versioned files`);
  for (let index = 1; index < migrationPaths.length; index += 1) {
    if (
      compareMigrationVersions(
        migrationPaths[index - 1],
        migrationPaths[index],
      ) === 0
    ) {
      throw new Error(
        `${label} migration order has duplicate V${migrationPaths[index].version}`,
      );
    }
  }
  const migrationFiles = await Promise.all(
    migrationPaths.map(async ({ path, version }, index) => ({
      ...(await hashBoundFile(
        root,
        path,
        `${label}.migrations.files[${index}]`,
      )),
      version,
    })),
  );
  const migrations = {
    directory: migrationDirectory,
    files: migrationFiles,
    highestVersion: migrationPaths.at(-1).version,
    collectionSha256: sha256(canonicalJson(migrationFiles)),
  };
  const repository = {
    origin: descriptor.origin,
    commitSha: descriptor.commitSha,
    ref: descriptor.ref,
    build: normalizeBuild(descriptor.build, `${label}.build`),
    artifacts,
    migrations,
    contracts: await hashDescriptorEntries(
      root,
      descriptor.contracts,
      `${label}.contracts`,
    ),
    configs: await hashDescriptorEntries(
      root,
      descriptor.configs,
      `${label}.configs`,
    ),
    sboms: await hashDescriptorEntries(
      root,
      descriptor.sboms,
      `${label}.sboms`,
    ),
    dependencyLocks: await hashDescriptorEntries(
      root,
      descriptor.dependencyLocks,
      `${label}.dependencyLocks`,
    ),
    containerImage: validateContainerImage(
      descriptor.containerImage,
      `${label}.containerImage`,
    ),
  };
  await assertStable();
  return { repository, assertStable };
}

async function buildAssetRepository(name, descriptor) {
  const { root, label, assertStable } = await validateRepositoryDescriptor(
    name,
    descriptor,
  );
  assertPlainObject(descriptor.assets, `${label}.assets`);
  const assetDirectory = assertSafeRelativePath(
    descriptor.assets.directory,
    `${label}.assets.directory`,
  );
  const assets = {
    directory: assetDirectory,
    files: await hashDirectory(
      root,
      assetDirectory,
      `${label}.assets.directory`,
    ),
    criticalBundles: await hashDescriptorEntries(
      root,
      descriptor.assets.criticalBundles,
      `${label}.assets.criticalBundles`,
    ),
  };
  const repository = {
    origin: descriptor.origin,
    commitSha: descriptor.commitSha,
    ref: descriptor.ref,
    build: normalizeBuild(descriptor.build, `${label}.build`),
    assets,
    contracts: await hashDescriptorEntries(
      root,
      descriptor.contracts,
      `${label}.contracts`,
    ),
    configs: await hashDescriptorEntries(
      root,
      descriptor.configs,
      `${label}.configs`,
    ),
    sboms: await hashDescriptorEntries(
      root,
      descriptor.sboms,
      `${label}.sboms`,
    ),
    dependencyLocks: await hashDescriptorEntries(
      root,
      descriptor.dependencyLocks,
      `${label}.dependencyLocks`,
    ),
    containerImage: validateContainerImage(
      descriptor.containerImage,
      `${label}.containerImage`,
    ),
  };
  await assertStable();
  return { repository, assertStable };
}

function normalizeEvidence(evidence) {
  assertPlainObject(evidence, "descriptor.evidence");
  return Object.keys(evidence)
    .sort(compareText)
    .reduce((result, key) => {
      assertNonEmptyString(key, "descriptor.evidence key");
      assertArray(evidence[key], `descriptor.evidence.${key}`);
      result[key] = evidence[key].map((entry, index) => {
        assertNonEmptyString(entry, `descriptor.evidence.${key}[${index}]`);
        assertNoSecretString(entry, `descriptor.evidence.${key}[${index}]`);
        return entry;
      });
      return result;
    }, Object.create(null));
}

async function writeAtomically(outputPath, contents) {
  assertNonEmptyString(outputPath, "outputPath");
  const destination = resolve(outputPath);
  const parent = dirname(destination);
  await mkdir(parent, { recursive: true });
  const temporaryPath = join(
    parent,
    `.${basename(destination)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let handle;
  try {
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(contents, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    try {
      await link(temporaryPath, destination);
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const existingDetails = await lstat(destination);
      if (existingDetails.isSymbolicLink() || !existingDetails.isFile()) {
        throw new Error(
          `outputPath already exists and is not an immutable regular file: ${destination}`,
          { cause: error },
        );
      }
      const existingHandle = await open(destination, NOFOLLOW_READ_FLAGS);
      let existingContents;
      try {
        const openedDetails = await existingHandle.stat();
        if (!openedDetails.isFile()) {
          throw new Error(
            `outputPath already exists and is not an immutable regular file: ${destination}`,
            { cause: error },
          );
        }
        existingContents = await existingHandle.readFile("utf8");
      } finally {
        await existingHandle.close();
      }
      if (existingContents !== contents) {
        throw new Error(
          `outputPath already exists with different immutable contents: ${destination}`,
          { cause: error },
        );
      }
      return;
    }
    const parentHandle = await open(parent, fsConstants.O_RDONLY);
    try {
      await parentHandle.sync();
    } finally {
      await parentHandle.close();
    }
  } finally {
    if (handle) await handle.close().catch(() => {});
    await rm(temporaryPath, { force: true }).catch(() => {});
  }
}

export async function generateReleaseManifest({ descriptor, outputPath } = {}) {
  assertPlainObject(descriptor, "descriptor");
  assertPlainObject(descriptor.repositories, "descriptor.repositories");
  if (
    Object.keys(descriptor.repositories).sort(compareText).join(",") !==
    REPOSITORY_NAMES.join(",")
  ) {
    throw new Error(
      "descriptor repositories must contain exactly backend, frontend, web",
    );
  }
  for (const key of [
    "releaseId",
    "environment",
    "createdAt",
    "generatorVersion",
  ]) {
    assertNonEmptyString(descriptor[key], `descriptor.${key}`);
  }

  const repositoryResults = {
    backend: await buildBackendRepository(descriptor.repositories.backend),
    frontend: await buildAssetRepository(
      "frontend",
      descriptor.repositories.frontend,
    ),
    web: await buildAssetRepository("web", descriptor.repositories.web),
  };
  const repositories = Object.fromEntries(
    REPOSITORY_NAMES.map((name) => [name, repositoryResults[name].repository]),
  );
  for (const name of REPOSITORY_NAMES)
    await repositoryResults[name].assertStable();
  const manifest = {
    schemaVersion: 1,
    releaseId: descriptor.releaseId,
    environment: descriptor.environment,
    createdAt: descriptor.createdAt,
    generatorVersion: descriptor.generatorVersion,
    repositories,
    evidence: normalizeEvidence(descriptor.evidence),
  };
  assertNoSecretMaterial(
    Buffer.from(canonicalJson(manifest), "utf8"),
    "manifest",
  );
  const envelope = sealManifest(manifest);
  validateManifestEnvelope(envelope);
  await writeAtomically(outputPath, `${canonicalJson(envelope)}\n`);
  return envelope;
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPlainObject(value, label) {
  if (!isPlainObject(value)) throw new Error(`${label} must be an object`);
}

function assertNoUnknownKeys(value, allowedKeys, label) {
  const unknown = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unknown.length > 0)
    throw new Error(`${label} has unknown field(s): ${unknown.join(", ")}`);
}

function assertRequiredKeys(value, requiredKeys, label) {
  for (const key of requiredKeys) {
    if (!Object.hasOwn(value, key))
      throw new Error(`${label} is missing ${key}`);
  }
}

function assertSchemaObject(value, allowedKeys, requiredKeys, label) {
  assertPlainObject(value, label);
  assertNoUnknownKeys(value, allowedKeys, label);
  assertRequiredKeys(value, requiredKeys, label);
}

function assertArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
}

function assertSha(value, label) {
  if (typeof value !== "string" || !GIT_SHA_PATTERN.test(value)) {
    throw new Error(`${label} must be a 40-character hexadecimal SHA`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isPlainObject(value)) return value;
  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, Object.create(null));
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value) {
  const input = typeof value === "string" ? value : canonicalJson(value);
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export const canonicalSha256 = sha256;

export function sealManifest(manifest) {
  return { manifest, manifestSha256: sha256(canonicalJson(manifest)) };
}

function validateMigrationOrder(repository, label) {
  assertSchemaObject(
    repository.migrations,
    MIGRATION_KEYS,
    MIGRATION_KEYS,
    `${label}.migrations`,
  );
  assertSafeRelativePath(
    repository.migrations.directory,
    `${label}.migrations.directory`,
  );
  assertArray(repository.migrations.files, `${label}.migrations.files`);
  if (repository.migrations.files.length === 0) {
    throw new Error(`${label}.migrations.files must not be empty`);
  }

  const versions = repository.migrations.files.map((file, index) => {
    const fileLabel = `${label}.migrations.files[${index}]`;
    assertSchemaObject(
      file,
      MIGRATION_FILE_KEYS,
      MIGRATION_FILE_KEYS,
      fileLabel,
    );
    const path = assertSafeRelativePath(file.path, `${fileLabel}.path`);
    assertFileDigestAndSize(file, fileLabel);
    if (
      typeof file.version !== "string" ||
      !MIGRATION_VERSION_PATTERN.test(file.version)
    ) {
      throw new Error(
        `${fileLabel}.version must be a canonical numeric Flyway version`,
      );
    }
    const pathVersion = parseMigrationPath(path);
    if (!pathVersion)
      throw new Error(
        `${label} migration order cannot be determined for ${path}`,
      );
    if (file.version !== pathVersion.version) {
      throw new Error(
        `${label} migration version metadata does not match ${path}`,
      );
    }
    return pathVersion;
  });

  for (let index = 1; index < versions.length; index += 1) {
    if (compareMigrationVersions(versions[index], versions[index - 1]) <= 0) {
      throw new Error(
        `${label} migration order must be strictly ascending by Flyway version`,
      );
    }
  }
  const highestVersion = versions.at(-1).version;
  if (repository.migrations.highestVersion !== highestVersion) {
    throw new Error(`${label}.migrations highest version mismatch`);
  }
  if (
    typeof repository.migrations.collectionSha256 !== "string" ||
    !SHA_256_PATTERN.test(repository.migrations.collectionSha256)
  ) {
    throw new Error(
      `${label}.migrations.collectionSha256 must be a 64-character lowercase hexadecimal SHA-256`,
    );
  }
  if (
    repository.migrations.collectionSha256 !==
    sha256(canonicalJson(repository.migrations.files))
  ) {
    throw new Error(`${label}.migrations collection SHA-256 mismatch`);
  }
}

function assertFileDigestAndSize(entry, label) {
  if (typeof entry.sha256 !== "string" || !SHA_256_PATTERN.test(entry.sha256)) {
    throw new Error(
      `${label}.sha256 must be a 64-character lowercase hexadecimal SHA-256`,
    );
  }
  if (!Number.isSafeInteger(entry.size) || entry.size < 0) {
    throw new Error(`${label}.size must be a non-negative safe integer`);
  }
}

function validateFileDescriptorArray(value, label) {
  assertArray(value, label);
  let previousPath;
  value.forEach((entry, index) => {
    const entryLabel = `${label}[${index}]`;
    assertSchemaObject(
      entry,
      FILE_DESCRIPTOR_KEYS,
      FILE_DESCRIPTOR_REQUIRED_KEYS,
      entryLabel,
    );
    const path = assertSafeRelativePath(entry.path, `${entryLabel}.path`);
    assertFileDigestAndSize(entry, entryLabel);
    if (Object.hasOwn(entry, "kind"))
      assertNonEmptyString(entry.kind, `${entryLabel}.kind`);
    if (previousPath !== undefined && compareText(previousPath, path) >= 0) {
      throw new Error(`${label} paths must be unique and strictly sorted`);
    }
    previousPath = path;
  });
}

function validateBuild(build, label) {
  assertSchemaObject(build, BUILD_KEYS, BUILD_KEYS, label);
  assertNonEmptyString(build.command, `${label}.command`);
  assertNoSecretString(build.command, `${label}.command`);
  for (const key of ["node", "npm", "jdk"]) {
    if (build[key] !== null)
      assertNonEmptyString(build[key], `${label}.${key}`);
  }
}

function validateRepository(repository, name) {
  const label = `manifest.repositories.${name}`;
  const repositoryKeys =
    name === "backend" ? BACKEND_REPOSITORY_KEYS : ASSET_REPOSITORY_KEYS;
  assertSchemaObject(repository, repositoryKeys, repositoryKeys, label);
  assertNonEmptyString(repository.origin, `${label}.origin`);
  assertOriginHasNoCredentials(repository.origin, `${label}.origin`);
  assertSha(repository.commitSha, `${label}.commitSha`);
  assertNonEmptyString(repository.ref, `${label}.ref`);
  validateBuild(repository.build, `${label}.build`);
  validateContainerImage(repository.containerImage, `${label}.containerImage`);

  for (const key of REPOSITORY_ARRAY_KEYS) {
    if (Object.hasOwn(repository, key)) {
      validateFileDescriptorArray(repository[key], `${label}.${key}`);
    }
  }
  if (name !== "backend") {
    assertSchemaObject(
      repository.assets,
      ASSET_KEYS,
      ASSET_KEYS,
      `${label}.assets`,
    );
    assertSafeRelativePath(
      repository.assets.directory,
      `${label}.assets.directory`,
    );
    validateFileDescriptorArray(
      repository.assets.files,
      `${label}.assets.files`,
    );
    validateFileDescriptorArray(
      repository.assets.criticalBundles,
      `${label}.assets.criticalBundles`,
    );
  }
  if (name === "backend") validateMigrationOrder(repository, label);
}

function validateEvidence(evidence) {
  assertPlainObject(evidence, "manifest.evidence");
  for (const [key, value] of Object.entries(evidence)) {
    assertNonEmptyString(key, "manifest.evidence key");
    assertArray(value, `manifest.evidence.${key}`);
    value.forEach((entry, index) => {
      assertNonEmptyString(entry, `manifest.evidence.${key}[${index}]`);
      assertNoSecretString(entry, `manifest.evidence.${key}[${index}]`);
    });
  }
}

export function validateManifestEnvelope(envelope) {
  assertPlainObject(envelope, "envelope");
  assertNoUnknownKeys(envelope, ENVELOPE_KEYS, "envelope");
  if (
    !Object.hasOwn(envelope, "manifest") ||
    !Object.hasOwn(envelope, "manifestSha256")
  ) {
    throw new Error("envelope must contain manifest and manifestSha256");
  }
  if (
    typeof envelope.manifestSha256 !== "string" ||
    !SHA_256_PATTERN.test(envelope.manifestSha256)
  ) {
    throw new Error(
      "manifest SHA-256 must be a 64-character lowercase hexadecimal digest",
    );
  }

  assertPlainObject(envelope.manifest, "manifest");
  assertNoUnknownKeys(envelope.manifest, MANIFEST_KEYS, "manifest");
  for (const key of MANIFEST_KEYS) {
    if (!Object.hasOwn(envelope.manifest, key))
      throw new Error(`manifest is missing ${key}`);
  }
  if (envelope.manifest.schemaVersion !== 1) {
    throw new Error("manifest.schemaVersion must be exactly 1");
  }
  assertNonEmptyString(envelope.manifest.releaseId, "manifest.releaseId");
  assertNonEmptyString(envelope.manifest.environment, "manifest.environment");
  assertNonEmptyString(envelope.manifest.createdAt, "manifest.createdAt");
  assertNonEmptyString(
    envelope.manifest.generatorVersion,
    "manifest.generatorVersion",
  );

  assertPlainObject(envelope.manifest.repositories, "manifest.repositories");
  assertNoUnknownKeys(
    envelope.manifest.repositories,
    new Set(REPOSITORY_NAMES),
    "manifest.repositories",
  );
  const repositoryNames = Object.keys(envelope.manifest.repositories).sort();
  if (repositoryNames.join(",") !== [...REPOSITORY_NAMES].sort().join(",")) {
    throw new Error(
      "manifest.repositories must contain exactly backend, frontend, and web",
    );
  }
  for (const name of REPOSITORY_NAMES)
    validateRepository(envelope.manifest.repositories[name], name);
  validateEvidence(envelope.manifest.evidence);
  assertNoSecretMaterial(
    Buffer.from(canonicalJson(envelope.manifest), "utf8"),
    "manifest",
  );

  if (envelope.manifestSha256 !== sha256(canonicalJson(envelope.manifest))) {
    throw new Error("manifest SHA-256 does not match the canonical manifest");
  }
  return true;
}

export async function verifyReleaseManifest({
  manifestPath,
  runtimeRoots,
  runtimeVersions,
} = {}) {
  assertNonEmptyString(manifestPath, "manifestPath");
  let envelope;
  try {
    const manifestDetails = await lstat(manifestPath);
    if (manifestDetails.isSymbolicLink())
      throw new Error("manifestPath must not be a symbolic link");
    if (!manifestDetails.isFile())
      throw new Error("manifestPath must be a regular file");
    const manifestHandle = await open(manifestPath, NOFOLLOW_READ_FLAGS);
    try {
      const openedDetails = await manifestHandle.stat();
      if (!openedDetails.isFile())
        throw new Error("manifestPath must be a regular file");
      envelope = JSON.parse(await manifestHandle.readFile("utf8"));
    } finally {
      await manifestHandle.close();
    }
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`manifestPath is missing: ${manifestPath}`, {
        cause: error,
      });
    }
    throw error;
  }
  validateManifestEnvelope(envelope);

  assertPlainObject(runtimeRoots, "runtimeRoots");
  const runtimeRootNames = Object.keys(runtimeRoots).sort(compareText);
  if (runtimeRootNames.join(",") !== REPOSITORY_NAMES.join(",")) {
    throw new Error("runtimeRoots must contain exactly backend, frontend, web");
  }

  const resolvedRoots = {};
  for (const name of REPOSITORY_NAMES) {
    const label = `runtimeRoots.${name}`;
    assertNonEmptyString(runtimeRoots[name], label);
    let details;
    try {
      details = await lstat(runtimeRoots[name]);
    } catch (error) {
      if (error?.code === "ENOENT")
        throw new Error(`${label} is missing`, { cause: error });
      throw error;
    }
    if (details.isSymbolicLink())
      throw new Error(`${label} must not be a symbolic link`);
    if (!details.isDirectory()) throw new Error(`${label} must be a directory`);
    resolvedRoots[name] = await realpath(runtimeRoots[name]);
  }

  const readRuntimeFile = async (root, path, label) => {
    let resolved;
    try {
      resolved = await resolveBoundPath(root, path, label, "file");
    } catch (error) {
      if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
        throw new Error(`${label} is missing`, { cause: error });
      }
      if (
        error instanceof Error &&
        error.message.includes("must be a regular file")
      ) {
        throw new Error(`${label} type mismatch: expected a regular file`, {
          cause: error,
        });
      }
      throw error;
    }
    let bound;
    try {
      bound = await readBoundFile(root, resolved.path, label);
    } catch (error) {
      if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
        throw new Error(`${label} is missing`, { cause: error });
      }
      throw error;
    }
    return {
      path: resolved.path,
      sha256: hashBuffer(bound.contents),
      size: bound.contents.byteLength,
    };
  };

  const verifyExpectedFile = async (root, expected, label) => {
    if (!isPlainObject(expected)) {
      throw new Error(`${label} metadata mismatch: expected sha256 and size`);
    }
    const path = assertSafeRelativePath(expected.path, `${label}.path`);
    if (
      typeof expected.sha256 !== "string" ||
      !SHA_256_PATTERN.test(expected.sha256)
    ) {
      throw new Error(`${label}.sha256 mismatch: invalid manifest digest`);
    }
    if (!Number.isSafeInteger(expected.size) || expected.size < 0) {
      throw new Error(`${label}.size mismatch: invalid manifest size`);
    }
    const actual = await readRuntimeFile(root, path, label);
    if (actual.sha256 !== expected.sha256) {
      throw new Error(`${label} sha256 mismatch for ${path}`);
    }
    if (actual.size !== expected.size) {
      throw new Error(`${label} size mismatch for ${path}`);
    }
    return actual;
  };

  const verifyExpectedFiles = async (root, expectedFiles, label) => {
    assertArray(expectedFiles, label);
    const seenPaths = new Set();
    const verified = [];
    for (let index = 0; index < expectedFiles.length; index += 1) {
      const expected = expectedFiles[index];
      if (!isPlainObject(expected)) {
        throw new Error(
          `${label}[${index}] metadata mismatch: expected sha256 and size`,
        );
      }
      const path = assertSafeRelativePath(
        expected.path,
        `${label}[${index}].path`,
      );
      if (seenPaths.has(path)) {
        throw new Error(`${label} file list mismatch: duplicate path ${path}`);
      }
      seenPaths.add(path);
      verified.push(
        await verifyExpectedFile(root, expected, `${label}[${index}]`),
      );
    }
    return verified;
  };

  const collectRuntimeDirectoryPaths = async (root, directory, label) => {
    try {
      return await collectDirectoryPaths(root, directory, label);
    } catch (error) {
      if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
        throw new Error(`${label} is missing`, { cause: error });
      }
      if (
        error instanceof Error &&
        (error.message.includes("must be a directory") ||
          error.message.includes("must be a regular file or directory"))
      ) {
        throw new Error(`${label} type mismatch in runtime directory`, {
          cause: error,
        });
      }
      throw error;
    }
  };

  const assertSamePaths = (actualPaths, expectedFiles, label) => {
    const expectedPaths = expectedFiles.map((entry, index) => {
      if (!isPlainObject(entry)) {
        throw new Error(
          `${label}.files[${index}] metadata mismatch: expected sha256 and size`,
        );
      }
      return assertSafeRelativePath(
        entry.path,
        `${label}.files[${index}].path`,
      );
    });
    if (
      actualPaths.length !== expectedPaths.length ||
      actualPaths.some((path, index) => path !== expectedPaths[index])
    ) {
      const missingPaths = expectedPaths.filter(
        (path) => !actualPaths.includes(path),
      );
      const extraPaths = actualPaths.filter(
        (path) => !expectedPaths.includes(path),
      );
      const detail = [
        missingPaths.length > 0 ? `missing ${missingPaths.join(", ")}` : "",
        extraPaths.length > 0 ? `unexpected ${extraPaths.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("; ");
      throw new Error(
        `${label} file list mismatch${detail ? `: ${detail}` : ""}`,
      );
    }
  };

  for (const name of REPOSITORY_NAMES) {
    const repository = envelope.manifest.repositories[name];
    const root = resolvedRoots[name];
    const label = `manifest.repositories.${name}`;

    for (const key of REPOSITORY_ARRAY_KEYS) {
      if (Object.hasOwn(repository, key)) {
        await verifyExpectedFiles(root, repository[key], `${label}.${key}`);
      }
    }

    if (Object.hasOwn(repository, "assets")) {
      const directory = assertSafeRelativePath(
        repository.assets.directory,
        `${label}.assets.directory`,
      );
      const actualPaths = await collectRuntimeDirectoryPaths(
        root,
        directory,
        `${label}.assets.directory`,
      );
      assertSamePaths(actualPaths, repository.assets.files, `${label}.assets`);
      await verifyExpectedFiles(
        root,
        repository.assets.files,
        `${label}.assets.files`,
      );
      await verifyExpectedFiles(
        root,
        repository.assets.criticalBundles,
        `${label}.assets.criticalBundles`,
      );
    }

    if (Object.hasOwn(repository, "migrations")) {
      const directory = assertSafeRelativePath(
        repository.migrations.directory,
        `${label}.migrations.directory`,
      );
      const allMigrationPaths = await collectRuntimeDirectoryPaths(
        root,
        directory,
        `${label}.migrations.directory`,
      );
      const migrationPaths = allMigrationPaths.map(parseMigrationPath);
      const unsupportedMigration = migrationPaths.findIndex(
        (entry) => entry === null,
      );
      if (unsupportedMigration !== -1) {
        throw new Error(
          `${label}.migrations contains unsupported migration ${allMigrationPaths[unsupportedMigration]}`,
        );
      }
      migrationPaths.sort(
        (left, right) =>
          compareMigrationVersions(left, right) ||
          compareText(left.path, right.path),
      );
      for (let index = 1; index < migrationPaths.length; index += 1) {
        if (
          compareMigrationVersions(
            migrationPaths[index - 1],
            migrationPaths[index],
          ) === 0
        ) {
          throw new Error(
            `${label}.migrations file list mismatch: duplicate V${migrationPaths[index].version}`,
          );
        }
      }
      assertSamePaths(
        migrationPaths.map(({ path }) => path),
        repository.migrations.files,
        `${label}.migrations`,
      );
      await verifyExpectedFiles(
        root,
        repository.migrations.files,
        `${label}.migrations.files`,
      );
      const expectedCollectionSha256 = sha256(
        canonicalJson(repository.migrations.files),
      );
      if (repository.migrations.collectionSha256 !== expectedCollectionSha256) {
        throw new Error(`${label}.migrations collection SHA-256 mismatch`);
      }
      const highestVersion = migrationPaths.at(-1)?.version;
      if (repository.migrations.highestVersion !== highestVersion) {
        throw new Error(`${label}.migrations highest version mismatch`);
      }
    }
  }

  assertSchemaObject(
    runtimeVersions,
    RUNTIME_VERSION_KEYS,
    RUNTIME_VERSION_KEYS,
    "runtimeVersions",
  );
  const versionLabels = { node: "Node", npm: "npm", jdk: "JDK" };
  for (const [key, displayName] of Object.entries(versionLabels)) {
    assertNonEmptyString(runtimeVersions[key], `runtimeVersions.${key}`);
    for (const name of REPOSITORY_NAMES) {
      const expectedVersion = envelope.manifest.repositories[name].build[key];
      if (
        expectedVersion !== null &&
        runtimeVersions[key] !== expectedVersion
      ) {
        throw new Error(
          `${displayName} version mismatch for ${name}: expected ${expectedVersion}, received ${runtimeVersions[key]}`,
        );
      }
    }
  }

  return true;
}
