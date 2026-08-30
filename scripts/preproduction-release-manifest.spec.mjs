import assert from "node:assert/strict";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { canonicalJson, sealManifest, sha256 } from "./release-manifest.mjs";
import {
  loadPreproductionCandidate,
  persistPreproductionRelease,
  verifyPreproductionRelease,
} from "./preproduction-release-manifest.mjs";

const file = (path, contents) => ({
  path,
  sha256: sha256(contents),
  size: Buffer.byteLength(contents),
});
const build = { command: "fixture-build", node: null, npm: null, jdk: null };

function manifestFixture(environment = "preproduction-candidate") {
  const migrationFiles = [
    { ...file("migrations/V1__baseline.sql", "select 1;\n"), version: "1" },
  ];
  return sealManifest({
    schemaVersion: 1,
    releaseId: "stage5-candidate-001",
    environment,
    createdAt: "2026-08-30T00:00:00.000Z",
    generatorVersion: "fixture-v1",
    repositories: {
      backend: {
        origin: "https://example.invalid/backend.git",
        commitSha: "a".repeat(40),
        ref: "refs/heads/main",
        build,
        artifacts: [file("target/backend.jar", "backend\n")],
        migrations: {
          directory: "migrations",
          files: migrationFiles,
          highestVersion: "1",
          collectionSha256: sha256(canonicalJson(migrationFiles)),
        },
        contracts: [],
        configs: [],
        sboms: [],
        dependencyLocks: [],
        containerImage: `registry.invalid/backend@sha256:${"b".repeat(64)}`,
      },
      frontend: {
        origin: "https://example.invalid/frontend.git",
        commitSha: "c".repeat(40),
        ref: "refs/heads/main",
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
        containerImage: `registry.invalid/frontend@sha256:${"d".repeat(64)}`,
      },
      web: {
        origin: "https://example.invalid/web.git",
        commitSha: "e".repeat(40),
        ref: "refs/heads/main",
        build,
        assets: {
          directory: "dist",
          files: [file("dist/index.html", "web\n")],
          criticalBundles: [file("dist/index.html", "web\n")],
        },
        contracts: [],
        configs: [],
        sboms: [],
        dependencyLocks: [],
        containerImage: `registry.invalid/web@sha256:${"f".repeat(64)}`,
      },
    },
    evidence: {},
  });
}

function configFixture(envelope) {
  const repositories = envelope.manifest.repositories;
  return {
    COFCO_DEPLOYMENT_ENV: "preproduction",
    COFCO_PREPROD_RELEASE_ID: envelope.manifest.releaseId,
    COFCO_PREPROD_BACKEND_IMAGE: repositories.backend.containerImage,
    COFCO_PREPROD_BUSINESS_IMAGE: repositories.web.containerImage,
    COFCO_PREPROD_OVERVIEW_IMAGE: repositories.frontend.containerImage,
    COFCO_PREPROD_BACKEND_COMMIT_SHA: repositories.backend.commitSha,
    COFCO_PREPROD_WEB_COMMIT_SHA: repositories.web.commitSha,
    COFCO_PREPROD_FRONTEND_COMMIT_SHA: repositories.frontend.commitSha,
    COFCO_PREPROD_BACKEND_ORIGIN: repositories.backend.origin,
    COFCO_PREPROD_WEB_ORIGIN: repositories.web.origin,
    COFCO_PREPROD_FRONTEND_ORIGIN: repositories.frontend.origin,
  };
}

async function writeConfig(path, config) {
  await writeFile(
    path,
    `${Object.entries(config)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")}\n`,
  );
  await chmod(path, 0o600);
}

async function createFixture(environment) {
  const root = await mkdtemp(join(tmpdir(), "cofco-preprod-manifest-"));
  const envelope = manifestFixture(environment);
  const manifestPath = join(root, "candidate.json");
  const configPath = join(root, "candidate.env");
  await writeFile(manifestPath, `${canonicalJson(envelope)}\n`, {
    mode: 0o600,
  });
  await writeConfig(configPath, configFixture(envelope));
  return { root, envelope, manifestPath, configPath };
}

test("loads only canonical allowed preproduction candidates and binds all three repository identities", async () => {
  const fixture = await createFixture();
  const candidate = await loadPreproductionCandidate(fixture);
  assert.equal(
    candidate.envelope.manifestSha256,
    fixture.envelope.manifestSha256,
  );

  for (const environment of [
    "production",
    "prod",
    "local",
    "non-release-fixture",
  ]) {
    const rejected = await createFixture(environment);
    await assert.rejects(
      () => loadPreproductionCandidate(rejected),
      /environment.*not allowed/iu,
    );
  }
  const mismatched = await createFixture();
  const config = configFixture(mismatched.envelope);
  config.COFCO_PREPROD_WEB_COMMIT_SHA = "9".repeat(40);
  await writeConfig(mismatched.configPath, config);
  await assert.rejects(
    () => loadPreproductionCandidate(mismatched),
    /web commit.*manifest/iu,
  );
});

test("rejects missing, tampered, noncanonical, symlinked, and secret-bearing manifest inputs", async (t) => {
  const fixture = await createFixture();
  await t.test("missing", async () => {
    await assert.rejects(
      () =>
        loadPreproductionCandidate({
          manifestPath: join(fixture.root, "missing"),
          configPath: fixture.configPath,
        }),
      /manifest.*missing/iu,
    );
  });
  await t.test("tampered", async () => {
    const tampered = await createFixture();
    const envelope = JSON.parse(await readFile(tampered.manifestPath, "utf8"));
    envelope.manifest.releaseId = "stage5-candidate-999";
    await writeFile(tampered.manifestPath, `${canonicalJson(envelope)}\n`);
    await assert.rejects(
      () => loadPreproductionCandidate(tampered),
      /SHA-256/iu,
    );
  });
  await t.test("noncanonical", async () => {
    const noncanonical = await createFixture();
    await writeFile(
      noncanonical.manifestPath,
      `${JSON.stringify(noncanonical.envelope, null, 2)}\n`,
    );
    await assert.rejects(
      () => loadPreproductionCandidate(noncanonical),
      /canonical/iu,
    );
  });
  await t.test("symlink", async () => {
    const linked = await createFixture();
    const linkPath = join(linked.root, "manifest-link.json");
    await symlink(linked.manifestPath, linkPath);
    await assert.rejects(
      () => loadPreproductionCandidate({ ...linked, manifestPath: linkPath }),
      /symbolic link/iu,
    );
  });
  await t.test("secret", async () => {
    const secret = await createFixture();
    const envelope = manifestFixture();
    envelope.manifest.evidence = { token: [`Bearer ${"a".repeat(16)}`] };
    const resealed = sealManifest(envelope.manifest);
    await writeFile(secret.manifestPath, `${canonicalJson(resealed)}\n`);
    await assert.rejects(
      () => loadPreproductionCandidate(secret),
      /secret material/iu,
    );
  });
});

test("atomically persists a read-only manifest and self-hashed three-repository metadata", async () => {
  const fixture = await createFixture();
  const releaseDirectory = join(
    fixture.root,
    "releases",
    fixture.envelope.manifest.releaseId,
  );
  const candidate = await loadPreproductionCandidate(fixture);
  await persistPreproductionRelease({
    ...candidate,
    releaseDirectory,
    configPath: fixture.configPath,
  });

  const storedManifest = join(releaseDirectory, ".cofco-release-manifest.json");
  const metadataPath = join(releaseDirectory, ".cofco-release-metadata.json");
  assert.equal(
    await readFile(storedManifest, "utf8"),
    candidate.canonicalContents,
  );
  assert.equal((await stat(storedManifest)).mode & 0o777, 0o400);
  assert.equal((await stat(metadataPath)).mode & 0o777, 0o400);
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  assert.equal(metadata.manifestSha256, fixture.envelope.manifestSha256);
  assert.deepEqual(Object.keys(metadata.repositories).sort(), [
    "backend",
    "frontend",
    "web",
  ]);
  await verifyPreproductionRelease({ releaseDirectory, requireCurrent: false });
});

test("rejects legacy releases, manifest or metadata drift, pointer drift, and a different manifest for the same release ID", async () => {
  const fixture = await createFixture();
  const releaseRoot = join(fixture.root, "releases");
  const releaseDirectory = join(
    releaseRoot,
    fixture.envelope.manifest.releaseId,
  );
  await mkdir(releaseDirectory, { recursive: true });
  await writeConfig(
    join(releaseDirectory, "release.env"),
    configFixture(fixture.envelope),
  );
  await assert.rejects(
    () => verifyPreproductionRelease({ releaseDirectory }),
    /manifest.*missing/iu,
  );

  const candidate = await loadPreproductionCandidate(fixture);
  await persistPreproductionRelease({
    ...candidate,
    releaseDirectory,
    configPath: fixture.configPath,
  });
  await symlink("wrong-release", join(releaseRoot, "current"));
  await assert.rejects(
    () =>
      verifyPreproductionRelease({
        releaseDirectory,
        currentPointerPath: join(releaseRoot, "current"),
        requireCurrent: true,
      }),
    /current.*manifest release/iu,
  );

  const collision = await createFixture();
  collision.envelope.manifest.repositories.web.commitSha = "7".repeat(40);
  collision.envelope = sealManifest(collision.envelope.manifest);
  await writeFile(
    collision.manifestPath,
    `${canonicalJson(collision.envelope)}\n`,
  );
  await writeConfig(collision.configPath, configFixture(collision.envelope));
  const different = await loadPreproductionCandidate(collision);
  await assert.rejects(
    () =>
      persistPreproductionRelease({
        ...different,
        releaseDirectory,
        configPath: collision.configPath,
      }),
    /different manifest.*release ID/iu,
  );
});

test("detects stored manifest, metadata, and derived release.env drift", async (t) => {
  for (const target of ["manifest", "metadata", "release.env"]) {
    await t.test(target, async () => {
      const fixture = await createFixture();
      const releaseDirectory = join(
        fixture.root,
        "releases",
        fixture.envelope.manifest.releaseId,
      );
      const candidate = await loadPreproductionCandidate(fixture);
      await persistPreproductionRelease({ ...candidate, releaseDirectory });
      const targetPath =
        target === "manifest"
          ? join(releaseDirectory, ".cofco-release-manifest.json")
          : target === "metadata"
            ? join(releaseDirectory, ".cofco-release-metadata.json")
            : join(releaseDirectory, "release.env");
      await chmod(targetPath, 0o600);
      await writeFile(targetPath, `${await readFile(targetPath, "utf8")}DRIFT`);
      await assert.rejects(
        () => verifyPreproductionRelease({ releaseDirectory }),
        /JSON|canonical|metadata|config|manifest|syntax/iu,
      );
    });
  }
});
