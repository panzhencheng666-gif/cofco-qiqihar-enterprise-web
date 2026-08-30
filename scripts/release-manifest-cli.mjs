import { execFile } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  generateReleaseManifest,
  validateManifestEnvelope,
  verifyReleaseManifest,
} from "./release-manifest.mjs";

const exec = promisify(execFile);
const OFFICIAL_ORIGINS = Object.freeze({
  backend:
    "https://github.com/panzhencheng666-gif/cofco-qiqihar-enterprise-backend.git",
  frontend:
    "https://github.com/panzhencheng666-gif/cofco-qiqihar-enterprise-frontend.git",
  web: "https://github.com/panzhencheng666-gif/cofco-qiqihar-enterprise-web.git",
});
const RELEASE_ENVIRONMENTS = new Set(["candidate", "preproduction-candidate"]);
const COMMAND_OPTIONS = Object.freeze({
  generate: ["descriptor", "output"],
  validate: ["manifest"],
  verify: [
    "manifest",
    "backend-root",
    "frontend-root",
    "web-root",
    "node-version",
    "npm-version",
    "jdk-version",
  ],
});
const NOFOLLOW_READ_FLAGS =
  fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0);

function parseOptions(command, argv) {
  const expected = COMMAND_OPTIONS[command];
  if (!expected) throw new Error(`unknown command: ${command ?? "<missing>"}`);
  const allowed = new Set(expected);
  const options = Object.create(null);
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (typeof option !== "string" || !option.startsWith("--")) {
      throw new Error(`expected an option, received: ${option ?? "<missing>"}`);
    }
    const name = option.slice(2);
    if (!allowed.has(name)) throw new Error(`unknown option: --${name}`);
    if (Object.hasOwn(options, name))
      throw new Error(`duplicate option: --${name}`);
    if (
      typeof value !== "string" ||
      value.length === 0 ||
      value.startsWith("--")
    ) {
      throw new Error(`missing value for option: --${name}`);
    }
    options[name] = value;
  }
  for (const name of expected) {
    if (!Object.hasOwn(options, name))
      throw new Error(`missing option: --${name}`);
  }
  return options;
}

async function readJsonRegularFile(path, label) {
  const absolutePath = resolve(path);
  let details;
  try {
    details = await lstat(absolutePath);
  } catch (error) {
    if (error?.code === "ENOENT")
      throw new Error(`${label} is missing: ${absolutePath}`, { cause: error });
    throw error;
  }
  if (details.isSymbolicLink())
    throw new Error(`${label} must not be a symbolic link`);
  if (!details.isFile()) throw new Error(`${label} must be a regular file`);
  const handle = await open(absolutePath, NOFOLLOW_READ_FLAGS);
  try {
    return JSON.parse(await handle.readFile("utf8"));
  } finally {
    await handle.close();
  }
}

async function remoteMainSha(root) {
  const { stdout } = await exec(
    "git",
    ["ls-remote", "--heads", "origin", "refs/heads/main"],
    { cwd: root, encoding: "utf8", maxBuffer: 1024 * 1024 },
  );
  const match = /^([a-f0-9]{40})\s+refs\/heads\/main$/u.exec(stdout.trim());
  if (!match) throw new Error(`origin/main is unavailable for ${root}`);
  return match[1];
}

async function configuredOrigin(root) {
  const { stdout } = await exec("git", ["remote", "get-url", "origin"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

async function assertGenerationPolicy(descriptor) {
  if (descriptor?.environment === "non-release-fixture") {
    if (!/fixture/iu.test(descriptor.releaseId ?? "")) {
      throw new Error(
        "non-release fixture releaseId must be visibly marked fixture",
      );
    }
    return;
  }
  if (!RELEASE_ENVIRONMENTS.has(descriptor?.environment)) {
    throw new Error(
      "generation environment must be non-release-fixture, candidate, or preproduction-candidate",
    );
  }
  for (const name of ["backend", "frontend", "web"]) {
    const repository = descriptor?.repositories?.[name];
    if (repository?.origin !== OFFICIAL_ORIGINS[name]) {
      throw new Error(`${name} candidate must use the official origin`);
    }
    if (!["main", "refs/heads/main"].includes(repository?.ref)) {
      throw new Error(`${name} candidate must bind refs/heads/main`);
    }
    if ((await configuredOrigin(repository.root)) !== OFFICIAL_ORIGINS[name]) {
      throw new Error(
        `${name} configured origin must equal the official origin before remote access`,
      );
    }
    const originMainSha = await remoteMainSha(repository.root);
    if (repository.commitSha !== originMainSha) {
      throw new Error(
        `${name} candidate commit must equal the exact origin/main SHA`,
      );
    }
  }
}

function writeResult(output, result) {
  output.write(`${JSON.stringify(result)}\n`);
}

export async function runReleaseManifestCli(argv, output = process.stdout) {
  const [command, ...rawOptions] = argv;
  const options = parseOptions(command, rawOptions);
  if (command === "generate") {
    const descriptor = await readJsonRegularFile(
      options.descriptor,
      "descriptor",
    );
    await assertGenerationPolicy(descriptor);
    const envelope = await generateReleaseManifest({
      descriptor,
      outputPath: options.output,
    });
    writeResult(output, {
      status: "manifest-generated",
      releaseId: envelope.manifest.releaseId,
      environment: envelope.manifest.environment,
      manifestSha256: envelope.manifestSha256,
    });
    return;
  }
  if (command === "validate") {
    const envelope = await readJsonRegularFile(options.manifest, "manifest");
    validateManifestEnvelope(envelope);
    writeResult(output, {
      status: "manifest-valid",
      releaseId: envelope.manifest.releaseId,
      environment: envelope.manifest.environment,
      manifestSha256: envelope.manifestSha256,
    });
    return;
  }
  await verifyReleaseManifest({
    manifestPath: resolve(options.manifest),
    runtimeRoots: {
      backend: resolve(options["backend-root"]),
      frontend: resolve(options["frontend-root"]),
      web: resolve(options["web-root"]),
    },
    runtimeVersions: {
      node: options["node-version"],
      npm: options["npm-version"],
      jdk: options["jdk-version"],
    },
  });
  writeResult(output, { status: "runtime-valid" });
}

const isEntrypoint =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isEntrypoint) {
  runReleaseManifestCli(process.argv.slice(2)).catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
