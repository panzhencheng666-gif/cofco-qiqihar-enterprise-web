import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { canonicalJson, sealManifest, sha256 } from "./release-manifest.mjs";

const moduleUrl = pathToFileURL(
  join(import.meta.dirname, "local-runtime-publish.mjs"),
).href;
const exec = promisify(execFile);

const digest = (value) => sha256(value);

function localReleaseEnvelope(environment = "local") {
  const file = (path, contents) => ({
    path,
    sha256: digest(contents),
    size: Buffer.byteLength(contents),
  });
  const build = { command: "fixture-build", node: null, npm: null, jdk: null };
  return sealManifest({
    schemaVersion: 1,
    releaseId: "cofco-local-fixture-1",
    environment,
    createdAt: "2026-08-30T00:00:00.000Z",
    generatorVersion: "fixture-v1",
    repositories: {
      backend: {
        origin: "https://example.invalid/backend.git",
        commitSha: "a".repeat(40),
        ref: "refs/heads/fixture",
        build,
        artifacts: [file("target/backend.jar", "backend\n")],
        migrations: {
          directory: "migrations",
          files: [
            {
              ...file("migrations/V1__baseline.sql", "select 1;\n"),
              version: "1",
            },
          ],
          highestVersion: "1",
          collectionSha256: "placeholder",
        },
        contracts: [],
        configs: [],
        sboms: [],
        dependencyLocks: [],
        containerImage: `backend@sha256:${"b".repeat(64)}`,
      },
      frontend: {
        origin: "https://example.invalid/frontend.git",
        commitSha: "c".repeat(40),
        ref: "refs/heads/fixture",
        build,
        assets: {
          directory: "dist",
          files: [file("dist/index.html", "frontend\n")],
          criticalBundles: [file("dist/index.html", "frontend\n")],
        },
        contracts: [],
        configs: [],
        sboms: [],
        dependencyLocks: [],
        containerImage: `frontend@sha256:${"d".repeat(64)}`,
      },
      web: {
        origin: "https://example.invalid/web.git",
        commitSha: "e".repeat(40),
        ref: "refs/heads/fixture",
        build,
        assets: {
          directory: "dist",
          files: [file("dist/index.html", "web\n")],
          criticalBundles: [file("dist/index.html", "web\n")],
        },
        contracts: [],
        configs: [],
        sboms: [],
        dependencyLocks: [file("package-lock.json", "lock\n")],
        containerImage: `web@sha256:${"f".repeat(64)}`,
      },
    },
    evidence: {},
  });
}

function finalizeEnvelope(envelope) {
  const migrations = envelope.manifest.repositories.backend.migrations;
  migrations.collectionSha256 = sha256(canonicalJson(migrations.files));
  return sealManifest(envelope.manifest);
}

async function createWebSourceFixture(root) {
  const sourceRoot = join(root, "web-source");
  await Promise.all([
    mkdir(join(sourceRoot, "dist"), { recursive: true }),
    mkdir(join(sourceRoot, "contracts"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(sourceRoot, "dist", "index.html"), "web\n"),
    writeFile(join(sourceRoot, "package-lock.json"), "lock\n"),
    writeFile(join(sourceRoot, "contracts", "api.json"), "{}\n"),
  ]);
  await exec("git", ["init", "-q", "-b", "fixture"], { cwd: sourceRoot });
  await exec("git", ["config", "user.name", "Fixture"], { cwd: sourceRoot });
  await exec("git", ["config", "user.email", "fixture@example.invalid"], {
    cwd: sourceRoot,
  });
  await exec(
    "git",
    ["remote", "add", "origin", "https://example.invalid/web.git"],
    { cwd: sourceRoot },
  );
  await exec("git", ["add", "."], { cwd: sourceRoot });
  await exec("git", ["commit", "-q", "-m", "fixture"], { cwd: sourceRoot });
  const { stdout } = await exec("git", ["rev-parse", "HEAD"], {
    cwd: sourceRoot,
  });
  const envelope = localReleaseEnvelope();
  envelope.manifest.repositories.web.commitSha = stdout.trim();
  envelope.manifest.repositories.web.contracts = [
    {
      path: "contracts/api.json",
      sha256: digest("{}\n"),
      size: Buffer.byteLength("{}\n"),
    },
  ];
  return { sourceRoot, envelope: finalizeEnvelope(envelope) };
}

async function createPreparedCandidateFixture(root, releaseModule) {
  const { sourceRoot, envelope } = await createWebSourceFixture(root);
  const runtimeRoot = join(root, "runtime");
  const candidateRoot = join(root, "candidate");
  await mkdir(join(runtimeRoot, "node_modules", "example"), {
    recursive: true,
  });
  await Promise.all([
    writeFile(join(runtimeRoot, "package-lock.json"), "lock\n"),
    writeFile(
      join(runtimeRoot, "node_modules", "example", "index.js"),
      "module.exports = true;\n",
    ),
  ]);
  const canonicalContents = `${canonicalJson(envelope)}\n`;
  const runtimeMetadata = await releaseModule.prepareRuntimeCandidate({
    sourceRoot,
    runtimeRoot,
    candidateRoot,
    releaseManifest: { envelope, canonicalContents },
    createdAt: "2026-08-30T01:00:00.000Z",
  });
  return {
    candidateRoot,
    envelope,
    runtimeMetadata,
    canonicalContents,
    sourceRoot,
  };
}

test("loads an existing canonical local release manifest", async () => {
  const releaseModule = await import(moduleUrl);
  const root = await mkdtemp(join(tmpdir(), "cofco-local-manifest-load-"));
  const manifestPath = join(root, "release.json");
  const envelope = finalizeEnvelope(localReleaseEnvelope());
  await writeFile(manifestPath, `${canonicalJson(envelope)}\n`);

  const loaded = await releaseModule.loadLocalReleaseManifest({ manifestPath });

  assert.deepEqual(loaded.envelope, envelope);
  assert.equal(loaded.canonicalContents, `${canonicalJson(envelope)}\n`);
});

test("rejects missing, tampered, production, and symbolic-link manifest inputs", async (t) => {
  const releaseModule = await import(moduleUrl);
  const root = await mkdtemp(join(tmpdir(), "cofco-local-manifest-reject-"));

  await t.test("missing", async () => {
    await assert.rejects(
      releaseModule.loadLocalReleaseManifest({
        manifestPath: join(root, "missing.json"),
      }),
      /release manifest is missing/iu,
    );
  });
  await t.test("tampered", async () => {
    const path = join(root, "tampered.json");
    const envelope = finalizeEnvelope(localReleaseEnvelope());
    envelope.manifest.releaseId = "tampered";
    await writeFile(path, `${canonicalJson(envelope)}\n`);
    await assert.rejects(
      releaseModule.loadLocalReleaseManifest({ manifestPath: path }),
      /manifest SHA-256/iu,
    );
  });
  await t.test("production", async () => {
    const path = join(root, "production.json");
    const envelope = finalizeEnvelope(localReleaseEnvelope("production"));
    await writeFile(path, `${canonicalJson(envelope)}\n`);
    await assert.rejects(
      releaseModule.loadLocalReleaseManifest({ manifestPath: path }),
      /environment is not allowed/iu,
    );
  });
  await t.test("symbolic link", async () => {
    const target = join(root, "target.json");
    const path = join(root, "manifest-link.json");
    const envelope = finalizeEnvelope(localReleaseEnvelope());
    await writeFile(target, `${canonicalJson(envelope)}\n`);
    await symlink("target.json", path);
    await assert.rejects(
      releaseModule.loadLocalReleaseManifest({ manifestPath: path }),
      /must not be a symbolic link/iu,
    );
  });
});

test("binds the Web source identity and release-critical files to the manifest", async () => {
  const releaseModule = await import(moduleUrl);
  const root = await mkdtemp(join(tmpdir(), "cofco-web-source-binding-"));
  const { sourceRoot, envelope } = await createWebSourceFixture(root);

  const binding = await releaseModule.verifyWebSourceBinding({
    envelope,
    sourceRoot,
  });

  assert.deepEqual(binding, {
    commitSha: envelope.manifest.repositories.web.commitSha,
    origin: envelope.manifest.repositories.web.origin,
    verifiedFileCount: 4,
  });
});

test("requires the Web dependency lock to be bound by the release manifest", async () => {
  const releaseModule = await import(moduleUrl);
  const root = await mkdtemp(join(tmpdir(), "cofco-web-lock-binding-"));
  const { sourceRoot, envelope } = await createWebSourceFixture(root);
  envelope.manifest.repositories.web.dependencyLocks = [];
  const unboundEnvelope = finalizeEnvelope(envelope);

  await assert.rejects(
    releaseModule.verifyWebSourceBinding({
      envelope: unboundEnvelope,
      sourceRoot,
    }),
    /package-lock\.json.+release manifest/iu,
  );
});

test("rejects Web source identity and dirty-state drift", async (t) => {
  const releaseModule = await import(moduleUrl);

  await t.test("origin drift", async () => {
    const root = await mkdtemp(join(tmpdir(), "cofco-web-origin-drift-"));
    const { sourceRoot, envelope } = await createWebSourceFixture(root);
    await exec(
      "git",
      ["remote", "set-url", "origin", "https://example.invalid/other.git"],
      {
        cwd: sourceRoot,
      },
    );
    await assert.rejects(
      releaseModule.verifyWebSourceBinding({ envelope, sourceRoot }),
      /origin does not match/iu,
    );
  });

  await t.test("commit drift", async () => {
    const root = await mkdtemp(join(tmpdir(), "cofco-web-commit-drift-"));
    const { sourceRoot, envelope } = await createWebSourceFixture(root);
    await writeFile(join(sourceRoot, "new.txt"), "new commit\n");
    await exec("git", ["add", "new.txt"], { cwd: sourceRoot });
    await exec("git", ["commit", "-q", "-m", "drift"], { cwd: sourceRoot });
    await assert.rejects(
      releaseModule.verifyWebSourceBinding({ envelope, sourceRoot }),
      /commit does not match/iu,
    );
  });

  await t.test("dirty state", async () => {
    const root = await mkdtemp(join(tmpdir(), "cofco-web-dirty-drift-"));
    const { sourceRoot, envelope } = await createWebSourceFixture(root);
    await writeFile(join(sourceRoot, "untracked.txt"), "dirty\n");
    await assert.rejects(
      releaseModule.verifyWebSourceBinding({ envelope, sourceRoot }),
      /repository is dirty/iu,
    );
  });
});

test("fails closed when candidate preparation has no three-repository release manifest", async () => {
  const releaseModule = await import(moduleUrl);
  const root = await mkdtemp(join(tmpdir(), "cofco-candidate-no-manifest-"));
  const sourceRoot = join(root, "source");
  const runtimeRoot = join(root, "runtime");
  await Promise.all([
    mkdir(sourceRoot, { recursive: true }),
    mkdir(join(runtimeRoot, "node_modules"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(sourceRoot, "package-lock.json"), "lock\n"),
    writeFile(join(runtimeRoot, "package-lock.json"), "lock\n"),
  ]);

  await assert.rejects(
    releaseModule.prepareRuntimeCandidate({
      sourceRoot,
      runtimeRoot,
      candidateRoot: join(root, "candidate"),
    }),
    /release manifest.+required/iu,
  );
});

test("copies the canonical manifest read-only and binds runtime metadata to all repository commits", async () => {
  const releaseModule = await import(moduleUrl);
  const root = await mkdtemp(join(tmpdir(), "cofco-candidate-manifest-copy-"));
  const { candidateRoot, envelope, runtimeMetadata, canonicalContents } =
    await createPreparedCandidateFixture(root, releaseModule);

  assert.equal(
    await readFile(
      join(candidateRoot, releaseModule.CANONICAL_RELEASE_MANIFEST),
      "utf8",
    ),
    canonicalContents,
  );
  assert.equal(
    (await stat(join(candidateRoot, releaseModule.CANONICAL_RELEASE_MANIFEST)))
      .mode & 0o222,
    0,
  );
  assert.equal(runtimeMetadata.releaseManifestSha256, envelope.manifestSha256);
  assert.equal(runtimeMetadata.releaseId, envelope.manifest.releaseId);
  assert.equal(runtimeMetadata.activationScope, "local-web-only");
  assert.deepEqual(runtimeMetadata.repositories, {
    backend: envelope.manifest.repositories.backend.commitSha,
    frontend: envelope.manifest.repositories.frontend.commitSha,
    web: envelope.manifest.repositories.web.commitSha,
  });
});

test("rejects a tampered canonical release manifest in the runtime", async () => {
  const releaseModule = await import(moduleUrl);
  const root = await mkdtemp(join(tmpdir(), "cofco-runtime-manifest-tamper-"));
  const { candidateRoot, envelope } = await createPreparedCandidateFixture(
    root,
    releaseModule,
  );

  const canonicalManifestPath = join(
    candidateRoot,
    releaseModule.CANONICAL_RELEASE_MANIFEST,
  );
  const tampered = structuredClone(envelope);
  tampered.manifest.releaseId = "tampered";
  await chmod(canonicalManifestPath, 0o644);
  await writeFile(canonicalManifestPath, `${canonicalJson(tampered)}\n`);

  await assert.rejects(
    releaseModule.verifyRuntimeManifest(candidateRoot),
    /release manifest|SHA-256/iu,
  );
});

test("rejects drift in manifest-bound runtime metadata", async () => {
  const releaseModule = await import(moduleUrl);
  const root = await mkdtemp(join(tmpdir(), "cofco-runtime-metadata-drift-"));
  const { candidateRoot } = await createPreparedCandidateFixture(
    root,
    releaseModule,
  );
  const metadataPath = join(candidateRoot, releaseModule.RELEASE_MANIFEST);
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  metadata.createdAt = "2026-08-30T09:09:09.000Z";
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

  await assert.rejects(
    releaseModule.verifyRuntimeManifest(candidateRoot),
    /runtime metadata.+SHA-256|runtime metadata.+drift/iu,
  );
});

test("rejects legacy single-repository runtime metadata", async () => {
  const releaseModule = await import(moduleUrl);
  const root = await mkdtemp(join(tmpdir(), "cofco-runtime-legacy-metadata-"));
  const { candidateRoot } = await createPreparedCandidateFixture(
    root,
    releaseModule,
  );
  const metadataPath = join(candidateRoot, releaseModule.RELEASE_MANIFEST);
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  const legacyMetadata = {
    schemaVersion: 2,
    algorithm: metadata.algorithm,
    createdAt: metadata.createdAt,
    sourceDirectory: metadata.sourceDirectory,
    nodeVersion: metadata.nodeVersion,
    files: metadata.files,
  };
  await writeFile(metadataPath, `${JSON.stringify(legacyMetadata, null, 2)}\n`);

  await assert.rejects(
    releaseModule.verifyRuntimeManifest(candidateRoot),
    /unsupported or incomplete manifest-bound schema/iu,
  );
});

test("labels Web-only verification as non-activation evidence", async () => {
  const releaseModule = await import(moduleUrl);
  const root = await mkdtemp(join(tmpdir(), "cofco-runtime-web-only-"));
  const { candidateRoot } = await createPreparedCandidateFixture(
    root,
    releaseModule,
  );

  const result = await releaseModule.verifyLocalRuntimeRelease({
    runtimeRoots: { web: candidateRoot },
  });

  assert.deepEqual(result, {
    activationEvidence: false,
    scope: "local-web-only",
  });
});

test("revalidates all three runtime roots without claiming activation", async () => {
  const releaseModule = await import(moduleUrl);
  const root = await mkdtemp(join(tmpdir(), "cofco-runtime-three-roots-"));
  const { candidateRoot } = await createPreparedCandidateFixture(
    root,
    releaseModule,
  );
  const backendRoot = join(root, "backend-runtime");
  const frontendRoot = join(root, "frontend-runtime");
  await Promise.all([
    mkdir(join(backendRoot, "target"), { recursive: true }),
    mkdir(join(backendRoot, "migrations"), { recursive: true }),
    mkdir(join(frontendRoot, "dist"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(backendRoot, "target", "backend.jar"), "backend\n"),
    writeFile(
      join(backendRoot, "migrations", "V1__baseline.sql"),
      "select 1;\n",
    ),
    writeFile(join(frontendRoot, "dist", "index.html"), "frontend\n"),
  ]);

  const result = await releaseModule.verifyLocalRuntimeRelease({
    runtimeRoots: {
      backend: backendRoot,
      frontend: frontendRoot,
      web: candidateRoot,
    },
    runtimeVersions: { node: "fixture", npm: "fixture", jdk: "fixture" },
  });

  assert.deepEqual(result, {
    activationEvidence: false,
    scope: "local-three-repository-runtime-bound",
  });
});

test("refuses to publish when source and runtime resolve to the same directory", async () => {
  const releaseModule = await import(moduleUrl).catch(() => null);
  assert.notEqual(
    releaseModule,
    null,
    "the local runtime publishing module must exist",
  );

  const directory = await realpath(
    await mkdtemp(join(tmpdir(), "cofco-runtime-publish-same-root-")),
  );

  await assert.rejects(
    releaseModule.assertSeparatedRoots(directory, directory),
    /must be separate directories/u,
  );
});

test("refuses nested source and runtime roots", async () => {
  const releaseModule = await import(moduleUrl);
  const root = await mkdtemp(
    join(tmpdir(), "cofco-runtime-publish-nested-root-"),
  );
  const sourceRoot = join(root, "source");
  const nestedRuntime = join(sourceRoot, "runtime");
  const outerRuntime = join(root, "runtime");
  const nestedSource = join(outerRuntime, "source");
  await Promise.all([
    mkdir(nestedRuntime, { recursive: true }),
    mkdir(nestedSource, { recursive: true }),
  ]);

  await assert.rejects(
    releaseModule.assertSeparatedRoots(sourceRoot, nestedRuntime),
    /non-nested directories/u,
  );
  await assert.rejects(
    releaseModule.assertSeparatedRoots(nestedSource, outerRuntime),
    /non-nested directories/u,
  );
});

test("prepares a standalone candidate with an auditable SHA-256 manifest", async () => {
  const releaseModule = await import(moduleUrl);
  const root = await mkdtemp(
    join(tmpdir(), "cofco-runtime-publish-candidate-"),
  );
  const sourceRoot = join(root, "source");
  const runtimeRoot = join(root, "runtime");
  const candidateRoot = join(root, "candidate");

  await Promise.all([
    mkdir(join(sourceRoot, "src"), { recursive: true }),
    mkdir(join(sourceRoot, "dist"), { recursive: true }),
    mkdir(join(sourceRoot, "scripts"), { recursive: true }),
    mkdir(join(sourceRoot, "coverage"), { recursive: true }),
    mkdir(join(sourceRoot, "evidence"), { recursive: true }),
    mkdir(join(runtimeRoot, "node_modules", "example"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(sourceRoot, "package.json"), '{"name":"source"}\n'),
    writeFile(join(sourceRoot, "package-lock.json"), '{"lockfileVersion":3}\n'),
    writeFile(join(sourceRoot, "vite.config.ts"), "export default {};\n"),
    writeFile(join(sourceRoot, ".env.local"), "SECRET=must-not-deploy\n"),
    writeFile(join(sourceRoot, "coverage", "report.json"), "must not deploy\n"),
    writeFile(
      join(runtimeRoot, "package-lock.json"),
      '{"lockfileVersion":3}\n',
    ),
    writeFile(
      join(sourceRoot, "src", "main.js"),
      "export const live = true;\n",
    ),
    writeFile(join(sourceRoot, "dist", "index.html"), "<main>built</main>\n"),
    writeFile(
      join(sourceRoot, "scripts", "local-runtime-smoke.mjs"),
      "export const smoke = true;\n",
    ),
    writeFile(join(sourceRoot, "evidence", "old.txt"), "must not deploy\n"),
    writeFile(
      join(runtimeRoot, "node_modules", "example", "index.js"),
      "module.exports = true;\n",
    ),
  ]);
  await exec("git", ["init", "-q", "-b", "fixture"], { cwd: sourceRoot });
  await exec("git", ["config", "user.name", "Fixture"], { cwd: sourceRoot });
  await exec("git", ["config", "user.email", "fixture@example.invalid"], {
    cwd: sourceRoot,
  });
  await exec(
    "git",
    ["remote", "add", "origin", "https://example.invalid/web.git"],
    { cwd: sourceRoot },
  );
  await exec("git", ["add", "."], { cwd: sourceRoot });
  await exec("git", ["commit", "-q", "-m", "fixture"], { cwd: sourceRoot });
  const { stdout } = await exec("git", ["rev-parse", "HEAD"], {
    cwd: sourceRoot,
  });
  const envelope = localReleaseEnvelope();
  envelope.manifest.repositories.web.commitSha = stdout.trim();
  envelope.manifest.repositories.web.assets = {
    directory: "dist",
    files: [
      {
        path: "dist/index.html",
        sha256: digest("<main>built</main>\n"),
        size: Buffer.byteLength("<main>built</main>\n"),
      },
    ],
    criticalBundles: [
      {
        path: "dist/index.html",
        sha256: digest("<main>built</main>\n"),
        size: Buffer.byteLength("<main>built</main>\n"),
      },
    ],
  };
  envelope.manifest.repositories.web.configs = [
    {
      path: "vite.config.ts",
      sha256: digest("export default {};\n"),
      size: Buffer.byteLength("export default {};\n"),
    },
  ];
  envelope.manifest.repositories.web.dependencyLocks = [
    {
      path: "package-lock.json",
      sha256: digest('{"lockfileVersion":3}\n'),
      size: Buffer.byteLength('{"lockfileVersion":3}\n'),
    },
  ];
  const sealedEnvelope = finalizeEnvelope(envelope);

  const manifest = await releaseModule.prepareRuntimeCandidate({
    sourceRoot,
    runtimeRoot,
    candidateRoot,
    releaseManifest: {
      envelope: sealedEnvelope,
      canonicalContents: `${canonicalJson(sealedEnvelope)}\n`,
    },
    createdAt: "2026-08-21T12:00:00.000Z",
  });

  assert.equal(
    await readFile(join(candidateRoot, "dist", "index.html"), "utf8"),
    "<main>built</main>\n",
  );
  assert.equal(
    await readFile(
      join(candidateRoot, "node_modules", "example", "index.js"),
      "utf8",
    ),
    "module.exports = true;\n",
  );
  await assert.rejects(access(join(candidateRoot, ".git")));
  await assert.rejects(access(join(candidateRoot, "evidence")));
  await assert.rejects(access(join(candidateRoot, ".env.local")));
  await assert.rejects(access(join(candidateRoot, "coverage")));
  assert.equal(
    await readFile(join(candidateRoot, "src", "main.js"), "utf8"),
    "export const live = true;\n",
  );
  assert.equal(manifest.algorithm, "sha256");
  assert.equal(manifest.sourceDirectory, "source");
  assert.equal(Object.hasOwn(manifest, "sourceRoot"), false);
  assert.deepEqual(
    manifest.files.map(({ path }) => path),
    [
      "dist/index.html",
      "package-lock.json",
      "package.json",
      "scripts/local-runtime-smoke.mjs",
      "src/main.js",
      "vite.config.ts",
    ],
  );
  assert.equal(
    await releaseModule.verifyRuntimeManifest(candidateRoot),
    manifest.files.length,
  );
});

test("quality gates enforce the bundle budget immediately after the build", async () => {
  const releaseModule = await import(moduleUrl);
  const commands = [];

  await releaseModule.runQualityGates("/source", {}, async (command, args) => {
    commands.push([command, ...args]);
  });

  assert.equal(commands[0].includes("scripts/release-manifest.spec.mjs"), true);
  const buildIndex = commands.findIndex(
    ([command, first, second]) =>
      command === "npm" && first === "run" && second === "build",
  );
  const budgetIndex = commands.findIndex(
    ([command, first, second]) =>
      command === "npm" && first === "run" && second === "budget",
  );
  assert.equal(buildIndex >= 0, true);
  assert.equal(budgetIndex, buildIndex + 1);
});

test("requires an explicit manifest path for the publish CLI migration", async () => {
  const releaseModule = await import(moduleUrl);

  assert.throws(
    () => releaseModule.parseLocalRuntimeCli(["publish"], {}),
    /--manifest|COFCO_RELEASE_MANIFEST_PATH/u,
  );
  assert.deepEqual(
    releaseModule.parseLocalRuntimeCli(
      ["publish", "--manifest", "/release/candidate.json"],
      {},
    ),
    { command: "publish", manifestPath: "/release/candidate.json" },
  );
  assert.deepEqual(
    releaseModule.parseLocalRuntimeCli(["publish"], {
      COFCO_RELEASE_MANIFEST_PATH: "/release/from-env.json",
    }),
    { command: "publish", manifestPath: "/release/from-env.json" },
  );
});

test("managed command environment keeps Node first and includes macOS service tools", async () => {
  const releaseModule = await import(moduleUrl);
  const commandEnvironment = releaseModule.createCommandEnvironment(
    { PATH: "/usr/bin:/bin", MARKER: "preserved" },
    "/opt/node24/bin/node",
  );

  assert.equal(
    commandEnvironment.PATH,
    "/opt/node24/bin:/usr/bin:/bin:/usr/sbin:/sbin",
  );
  assert.equal(commandEnvironment.MARKER, "preserved");
});

test("restores the usable runtime when candidate validation fails", async () => {
  const releaseModule = await import(moduleUrl);
  const root = await mkdtemp(join(tmpdir(), "cofco-runtime-publish-rollback-"));
  const runtimeRoot = join(root, "runtime");
  const candidateRoot = join(root, "candidate");
  const backupRoot = join(root, "runtime.previous");
  await Promise.all([
    mkdir(runtimeRoot, { recursive: true }),
    mkdir(candidateRoot, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(runtimeRoot, "version.txt"), "usable runtime\n"),
    writeFile(join(candidateRoot, "version.txt"), "candidate runtime\n"),
  ]);
  let recoveryCalls = 0;

  await assert.rejects(
    releaseModule.activateRuntimeCandidate({
      runtimeRoot,
      candidateRoot,
      backupRoot,
      validate: async () => {
        throw new Error("candidate health check failed");
      },
      recover: async () => {
        recoveryCalls += 1;
      },
    }),
    /candidate health check failed/u,
  );

  assert.equal(
    await readFile(join(runtimeRoot, "version.txt"), "utf8"),
    "usable runtime\n",
  );
  assert.equal(
    await readFile(join(candidateRoot, "version.txt"), "utf8"),
    "candidate runtime\n",
  );
  await assert.rejects(access(backupRoot));
  assert.equal(recoveryCalls, 1);
});

test("runs quality gates before activating and validating a prepared runtime", async () => {
  const releaseModule = await import(moduleUrl);
  const root = await mkdtemp(join(tmpdir(), "cofco-runtime-publish-order-"));
  const sourceRoot = join(root, "source");
  const runtimeRoot = join(root, "runtime");
  const candidateRoot = join(root, "candidate");
  const backupRoot = join(root, "runtime.previous");
  await Promise.all([
    mkdir(join(sourceRoot, "src"), { recursive: true }),
    mkdir(join(runtimeRoot, "node_modules", "example"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(sourceRoot, ".gitignore"), "dist/\n"),
    writeFile(join(sourceRoot, "package.json"), '{"name":"source"}\n'),
    writeFile(join(sourceRoot, "package-lock.json"), '{"lockfileVersion":3}\n'),
    writeFile(
      join(runtimeRoot, "package-lock.json"),
      '{"lockfileVersion":3}\n',
    ),
    writeFile(
      join(sourceRoot, "src", "main.js"),
      "export const built = true;\n",
    ),
    writeFile(join(runtimeRoot, "old.txt"), "previous release\n"),
    writeFile(
      join(runtimeRoot, "node_modules", "example", "index.js"),
      "module.exports = true;\n",
    ),
  ]);
  await exec("git", ["init", "-q", "-b", "fixture"], { cwd: sourceRoot });
  await exec("git", ["config", "user.name", "Fixture"], { cwd: sourceRoot });
  await exec("git", ["config", "user.email", "fixture@example.invalid"], {
    cwd: sourceRoot,
  });
  await exec(
    "git",
    ["remote", "add", "origin", "https://example.invalid/web.git"],
    { cwd: sourceRoot },
  );
  await exec("git", ["add", "."], { cwd: sourceRoot });
  await exec("git", ["commit", "-q", "-m", "fixture"], { cwd: sourceRoot });
  const { stdout } = await exec("git", ["rev-parse", "HEAD"], {
    cwd: sourceRoot,
  });
  const envelope = localReleaseEnvelope();
  envelope.manifest.repositories.web.commitSha = stdout.trim();
  envelope.manifest.repositories.web.assets = {
    directory: "dist",
    files: [
      {
        path: "dist/index.html",
        sha256: digest("built\n"),
        size: Buffer.byteLength("built\n"),
      },
    ],
    criticalBundles: [
      {
        path: "dist/index.html",
        sha256: digest("built\n"),
        size: Buffer.byteLength("built\n"),
      },
    ],
  };
  envelope.manifest.repositories.web.dependencyLocks = [
    {
      path: "package-lock.json",
      sha256: digest('{"lockfileVersion":3}\n'),
      size: Buffer.byteLength('{"lockfileVersion":3}\n'),
    },
  ];
  const sealedEnvelope = finalizeEnvelope(envelope);
  const events = [];

  const result = await releaseModule.publishLocalRuntime({
    sourceRoots: { web: sourceRoot },
    runtimeRoots: { web: runtimeRoot },
    candidateRoot,
    backupRoot,
    releaseManifest: {
      envelope: sealedEnvelope,
      canonicalContents: `${canonicalJson(sealedEnvelope)}\n`,
    },
    runGates: async () => {
      events.push("gates");
      await mkdir(join(sourceRoot, "dist"));
      await writeFile(join(sourceRoot, "dist", "index.html"), "built\n");
    },
    validate: async () => {
      events.push("validate");
    },
    recover: async () => {
      events.push("recover");
    },
  });

  assert.deepEqual(events, ["gates", "validate"]);
  assert.equal(
    await readFile(join(runtimeRoot, "dist", "index.html"), "utf8"),
    "built\n",
  );
  assert.equal(
    await readFile(join(backupRoot, "old.txt"), "utf8"),
    "previous release\n",
  );
  assert.equal(result.backupRoot, backupRoot);
  assert.equal(
    result.fileCount,
    await releaseModule.verifyRuntimeManifest(runtimeRoot),
  );

  const failedCandidateRoot = join(root, "failed-candidate");
  const failedBackupRoot = join(root, "runtime.failed.previous");
  await assert.rejects(
    releaseModule.publishLocalRuntime({
      sourceRoots: { web: sourceRoot },
      runtimeRoots: { web: runtimeRoot },
      candidateRoot: failedCandidateRoot,
      backupRoot: failedBackupRoot,
      releaseManifest: {
        envelope: sealedEnvelope,
        canonicalContents: `${canonicalJson(sealedEnvelope)}\n`,
      },
      runGates: async () => {},
      validate: async () => {
        throw new Error("candidate validation failed");
      },
      recover: async () => {},
    }),
    /candidate validation failed/u,
  );
  assert.equal(
    await readFile(join(runtimeRoot, "dist", "index.html"), "utf8"),
    "built\n",
  );
  await assert.rejects(access(failedCandidateRoot));
  await assert.rejects(access(failedBackupRoot));
  await assert.rejects(access(`${runtimeRoot}.publish.lock`));
});

test("rejects a concurrent publication before running gates", async () => {
  const releaseModule = await import(moduleUrl);
  const root = await mkdtemp(join(tmpdir(), "cofco-runtime-publish-lock-"));
  const sourceRoot = join(root, "source");
  const runtimeRoot = join(root, "runtime");
  const lockRoot = join(root, "publish.lock");
  await Promise.all([mkdir(sourceRoot), mkdir(runtimeRoot), mkdir(lockRoot)]);
  let gateCalls = 0;

  await assert.rejects(
    releaseModule.publishLocalRuntime({
      sourceRoots: { web: sourceRoot },
      runtimeRoots: { web: runtimeRoot },
      candidateRoot: join(root, "candidate"),
      backupRoot: join(root, "backup"),
      lockRoot,
      releaseManifest: {},
      runGates: async () => {
        gateCalls += 1;
      },
      validate: async () => {},
      recover: async () => {},
    }),
    /publication is already in progress/iu,
  );
  assert.equal(gateCalls, 0);
});

test("accepts a control timeout only after the managed health gate succeeds", async () => {
  const releaseModule = await import(moduleUrl);
  const commands = [];

  await releaseModule.restartManagedRuntime(
    "/runtime/web",
    {},
    {
      execute: async (command, args) => {
        commands.push([command, ...args]);
        if (args.at(-1) === "restart") throw new Error("control timeout");
      },
      pause: async () => {},
      healthAttempts: 2,
    },
  );

  assert.equal(commands.length, 2);
  assert.match(commands[1].at(-1), /healthcheck-local\.sh$/u);
});

test("rejects a control timeout when bounded managed health never succeeds", async () => {
  const releaseModule = await import(moduleUrl);
  let calls = 0;

  await assert.rejects(
    releaseModule.restartManagedRuntime(
      "/runtime/web",
      {},
      {
        execute: async () => {
          calls += 1;
          throw new Error(calls === 1 ? "control timeout" : "still unhealthy");
        },
        pause: async () => {},
        healthAttempts: 2,
      },
    ),
    /restart failed and managed health did not recover/u,
  );
  assert.equal(calls, 3);
});
