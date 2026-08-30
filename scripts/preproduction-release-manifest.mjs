import { constants as fsConstants } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  readlink,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { parseConfigText } from "./preproduction-config.mjs";
import {
  canonicalJson,
  sha256,
  validateManifestEnvelope,
} from "./release-manifest.mjs";

export const PREPRODUCTION_MANIFEST = ".cofco-release-manifest.json";
export const PREPRODUCTION_METADATA = ".cofco-release-metadata.json";
const ALLOWED_ENVIRONMENTS = new Set([
  "candidate",
  "preproduction",
  "preproduction-candidate",
  "release-candidate",
]);
const NOFOLLOW_READ_FLAGS =
  fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0);
const REPOSITORY_CONFIG = {
  backend: {
    image: "COFCO_PREPROD_BACKEND_IMAGE",
    commit: "COFCO_PREPROD_BACKEND_COMMIT_SHA",
    origin: "COFCO_PREPROD_BACKEND_ORIGIN",
  },
  frontend: {
    image: "COFCO_PREPROD_OVERVIEW_IMAGE",
    commit: "COFCO_PREPROD_FRONTEND_COMMIT_SHA",
    origin: "COFCO_PREPROD_FRONTEND_ORIGIN",
  },
  web: {
    image: "COFCO_PREPROD_BUSINESS_IMAGE",
    commit: "COFCO_PREPROD_WEB_COMMIT_SHA",
    origin: "COFCO_PREPROD_WEB_ORIGIN",
  },
};

function assertPathText(path, label) {
  if (
    typeof path !== "string" ||
    path.trim().length === 0 ||
    path.includes("\0")
  ) {
    throw new Error(`${label} is required`);
  }
  const segments = path.split(/[\\/]/u);
  if (segments.includes(".."))
    throw new Error(`${label} must not contain path traversal`);
}

async function assertNoSymlinkComponents(
  path,
  label,
  allowMissingLeaf = false,
) {
  assertPathText(path, label);
  const absolute = resolve(path);
  try {
    const details = await lstat(absolute);
    if (details.isSymbolicLink())
      throw new Error(`${label} must not contain a symbolic link`);
  } catch (error) {
    if (allowMissingLeaf && error?.code === "ENOENT") return absolute;
    throw error;
  }
  return absolute;
}

async function readBoundRegularFile(path, label) {
  let absolute;
  try {
    absolute = await assertNoSymlinkComponents(path, label);
  } catch (error) {
    if (error?.code === "ENOENT")
      throw new Error(`${label} is missing: ${path}`, { cause: error });
    throw error;
  }
  const before = await lstat(absolute);
  if (!before.isFile()) throw new Error(`${label} must be a regular file`);
  const handle = await open(absolute, NOFOLLOW_READ_FLAGS);
  try {
    const opened = await handle.stat();
    if (!opened.isFile()) throw new Error(`${label} must be a regular file`);
    const contents = await handle.readFile("utf8");
    const after = await handle.stat();
    const finalDetails = await lstat(absolute);
    if (
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== opened.size ||
      after.mtimeMs !== opened.mtimeMs ||
      after.ctimeMs !== opened.ctimeMs ||
      finalDetails.isSymbolicLink() ||
      finalDetails.dev !== opened.dev ||
      finalDetails.ino !== opened.ino
    ) {
      throw new Error(`${label} changed while being read`);
    }
    return contents;
  } finally {
    await handle.close();
  }
}

function assertConfigMatchesManifest(config, envelope) {
  const manifest = envelope.manifest;
  if (config.COFCO_DEPLOYMENT_ENV !== "preproduction") {
    throw new Error("deployment environment must be preproduction");
  }
  if (config.COFCO_PREPROD_RELEASE_ID !== manifest.releaseId) {
    throw new Error("release ID does not match the release manifest");
  }
  for (const [name, keys] of Object.entries(REPOSITORY_CONFIG)) {
    const repository = manifest.repositories[name];
    if (config[keys.image] !== repository.containerImage) {
      throw new Error(
        `${name} image digest does not match the release manifest`,
      );
    }
    if (config[keys.commit] !== repository.commitSha) {
      throw new Error(`${name} commit does not match the release manifest`);
    }
    if (config[keys.origin] !== repository.origin) {
      throw new Error(`${name} origin does not match the release manifest`);
    }
  }
}

function releaseMetadata(envelope) {
  const unsigned = {
    schemaVersion: 1,
    releaseId: envelope.manifest.releaseId,
    manifestSha256: envelope.manifestSha256,
    repositories: Object.fromEntries(
      ["backend", "frontend", "web"].map((name) => [
        name,
        {
          commitSha: envelope.manifest.repositories[name].commitSha,
          containerImage: envelope.manifest.repositories[name].containerImage,
          origin: envelope.manifest.repositories[name].origin,
        },
      ]),
    ),
  };
  return { ...unsigned, metadataSha256: sha256(canonicalJson(unsigned)) };
}

function validateMetadata(metadata, envelope) {
  const keys = Object.keys(metadata).sort().join(",");
  if (
    keys !==
    "manifestSha256,metadataSha256,releaseId,repositories,schemaVersion"
  ) {
    throw new Error("release metadata has an unsupported schema");
  }
  const { metadataSha256, ...unsigned } = metadata;
  if (metadataSha256 !== sha256(canonicalJson(unsigned))) {
    throw new Error("release metadata self-hash mismatch");
  }
  if (canonicalJson(metadata) !== canonicalJson(releaseMetadata(envelope))) {
    throw new Error("release metadata does not match the release manifest");
  }
}

async function writeImmutable(path, contents, mode) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = join(
    dirname(path),
    `.${basename(path)}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    await writeFile(temporary, contents, { mode, flag: "wx" });
    await chmod(temporary, mode);
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}

export async function loadPreproductionCandidate({
  manifestPath,
  configPath,
} = {}) {
  const rawManifest = await readBoundRegularFile(
    manifestPath,
    "release manifest",
  );
  let envelope;
  try {
    envelope = JSON.parse(rawManifest);
  } catch (error) {
    throw new Error("release manifest must be valid JSON", { cause: error });
  }
  validateManifestEnvelope(envelope);
  const canonicalContents = `${canonicalJson(envelope)}\n`;
  if (rawManifest !== canonicalContents)
    throw new Error("release manifest must be canonical");
  if (!ALLOWED_ENVIRONMENTS.has(envelope.manifest.environment)) {
    throw new Error(
      `release manifest environment is not allowed: ${envelope.manifest.environment}`,
    );
  }
  const configContents = await readBoundRegularFile(
    configPath,
    "release config",
  );
  const config = parseConfigText(configContents);
  assertConfigMatchesManifest(config, envelope);
  return { envelope, canonicalContents, config, configContents };
}

export async function persistPreproductionRelease({
  envelope,
  canonicalContents,
  configContents,
  configPath,
  releaseDirectory,
} = {}) {
  const expectedDirectoryName = envelope?.manifest?.releaseId;
  if (basename(normalize(releaseDirectory)) !== expectedDirectoryName) {
    throw new Error("release directory does not match the manifest release ID");
  }
  const absoluteDirectory = await assertNoSymlinkComponents(
    releaseDirectory,
    "release directory",
    true,
  );
  await mkdir(absoluteDirectory, { recursive: true, mode: 0o700 });
  await assertNoSymlinkComponents(absoluteDirectory, "release directory");
  const manifestPath = join(absoluteDirectory, PREPRODUCTION_MANIFEST);
  const metadataPath = join(absoluteDirectory, PREPRODUCTION_METADATA);
  const existing = await readFile(manifestPath, "utf8").catch((error) =>
    error?.code === "ENOENT" ? undefined : Promise.reject(error),
  );
  if (existing !== undefined && existing !== canonicalContents) {
    throw new Error(
      "different manifest already exists for the same release ID",
    );
  }
  const config =
    configContents ??
    (await readBoundRegularFile(configPath, "release config"));
  const metadataContents = `${canonicalJson(releaseMetadata(envelope))}\n`;
  if (existing === undefined)
    await writeImmutable(manifestPath, canonicalContents, 0o400);
  await writeImmutable(metadataPath, metadataContents, 0o400);
  await writeImmutable(join(absoluteDirectory, "release.env"), config, 0o600);
  return { manifestPath, metadataPath };
}

export async function verifyPreproductionRelease({
  releaseDirectory,
  currentPointerPath,
  requireCurrent = false,
} = {}) {
  const absoluteDirectory = await assertNoSymlinkComponents(
    releaseDirectory,
    "release directory",
  );
  const manifestPath = join(absoluteDirectory, PREPRODUCTION_MANIFEST);
  const metadataPath = join(absoluteDirectory, PREPRODUCTION_METADATA);
  const candidate = await loadPreproductionCandidate({
    manifestPath,
    configPath: join(absoluteDirectory, "release.env"),
  });
  const metadata = JSON.parse(
    await readBoundRegularFile(metadataPath, "release metadata"),
  );
  validateMetadata(metadata, candidate.envelope);
  for (const path of [manifestPath, metadataPath]) {
    const details = await stat(path);
    if ((details.mode & 0o222) !== 0)
      throw new Error("release identity files must be read-only");
  }
  if (requireCurrent) {
    const target = await readlink(currentPointerPath);
    if (target !== candidate.envelope.manifest.releaseId) {
      throw new Error("current pointer does not match the manifest release");
    }
    const currentDirectory = resolve(dirname(currentPointerPath), target);
    if (currentDirectory !== absoluteDirectory) {
      throw new Error(
        "current pointer does not resolve to the verified release directory",
      );
    }
  }
  return candidate;
}

async function main(argv) {
  const [command, ...args] = argv;
  const options = Object.fromEntries(
    args.reduce((pairs, value, index) => {
      if (value.startsWith("--")) pairs.push([value.slice(2), args[index + 1]]);
      return pairs;
    }, []),
  );
  if (command === "validate-candidate") {
    await loadPreproductionCandidate({
      manifestPath: options.manifest,
      configPath: options.config,
    });
    return;
  }
  if (command === "persist") {
    const candidate = await loadPreproductionCandidate({
      manifestPath: options.manifest,
      configPath: options.config,
    });
    await persistPreproductionRelease({
      ...candidate,
      releaseDirectory: options.release,
    });
    return;
  }
  if (command === "verify-release") {
    await verifyPreproductionRelease({
      releaseDirectory: options.release,
      currentPointerPath: options.current,
      requireCurrent: options.requireCurrent === "true",
    });
    return;
  }
  throw new Error(
    "usage: preproduction-release-manifest.mjs {validate-candidate|persist|verify-release}",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`ERROR: ${error.message}\n`);
    process.exitCode = 1;
  });
}
