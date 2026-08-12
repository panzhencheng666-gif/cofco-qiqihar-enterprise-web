import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  assertIsolatedDatabaseName,
  assertSecretFree,
  evaluateLoadConsistency,
  hostMemoryPercent,
  normalizeHostCpuPercent,
  removeExactStageSevenRuntimeDirectory,
  runCleanupSteps,
  summarizeResourceTrend,
  waitForWritableOpen,
} from "./stage-seven-local-runtime.mjs";

test("attempts every exact cleanup step and aggregates failures", async () => {
  const attempted = [];
  await assert.rejects(
    () =>
      runCleanupSteps([
        async () => {
          attempted.push("backend");
          throw new Error("backend stop failed");
        },
        async () => {
          attempted.push("database");
        },
      ]),
    /Stage 7 cleanup failed/u,
  );
  assert.deepEqual(attempted, ["backend", "database"]);
});

test("removes only the exact current Stage 7 runtime after earlier cleanup failures", async () => {
  const current = await mkdtemp(join(tmpdir(), "cofco-stage7-"));
  const preserved = await mkdtemp(join(tmpdir(), "cofco-stage7-"));
  await writeFile(join(current, "private-content.bin"), "current\n");
  await writeFile(join(preserved, "supervisor-audit.log"), "preserve\n");
  try {
    const attempted = [];
    await assert.rejects(
      () =>
        runCleanupSteps([
          async () => {
            attempted.push("backend");
            throw new Error("backend stop failed");
          },
          async () => {
            attempted.push("database");
            throw new Error("database cleanup failed");
          },
          async () => {
            attempted.push("runtime");
            await removeExactStageSevenRuntimeDirectory(current);
          },
        ]),
      (error) => error instanceof AggregateError && error.errors.length === 2,
    );
    assert.deepEqual(attempted, ["backend", "database", "runtime"]);
    await assert.rejects(() => readdir(current), { code: "ENOENT" });
    assert.deepEqual(await readdir(preserved), ["supervisor-audit.log"]);
  } finally {
    await rm(current, { recursive: true, force: true });
    await rm(preserved, { recursive: true, force: true });
  }
});

test("the real local runner leaves no namespace after a controlled early failure", async () => {
  const existing = (await readdir(tmpdir()))
    .filter((name) => name.startsWith("cofco-stage7-"))
    .sort();
  const output = await mkdtemp(join(tmpdir(), "stage7-failure-output-"));
  try {
    const result = spawnSync(
      process.execPath,
      [
        resolve(import.meta.dirname, "run-stage-seven-local.mjs"),
        "--output",
        output,
      ],
      {
        cwd: resolve(import.meta.dirname, ".."),
        env: {
          ...process.env,
          STAGE7_BACKEND_DIR: join(tmpdir(), "stage7-missing-backend"),
        },
        encoding: "utf8",
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ENOENT|no such file/iu);
    const after = (await readdir(tmpdir()))
      .filter((name) => name.startsWith("cofco-stage7-"))
      .sort();
    assert.deepEqual(after, existing);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test("counts successful writes as consistent only after database invariants", () => {
  const input = {
    before: { productionRecords: 10, evidencePhotos: 20 },
    after: { productionRecords: 15, evidencePhotos: 26 },
    byWorkload: {
      write: { attempts: 3, unexpectedErrors: 0 },
      review: { attempts: 2, unexpectedErrors: 0 },
      import: { attempts: 2, unexpectedErrors: 0 },
      photo: { attempts: 3, unexpectedErrors: 2 },
    },
    approvedReviews: 2,
    expectedApprovedReviews: 2,
  };
  const consistent = evaluateLoadConsistency(input);
  assert.equal(consistent.successfulWrites, 8);
  assert.equal(consistent.consistentWrites, 8);
  assert.equal(
    consistent.checks.every(({ passed }) => passed),
    true,
  );

  const inconsistent = evaluateLoadConsistency({
    ...input,
    after: { ...input.after, productionRecords: 14 },
  });
  assert.equal(inconsistent.consistentWrites, 0);
  assert.equal(
    inconsistent.checks.some(({ passed }) => !passed),
    true,
  );
});

test("waits until a child-process log stream has a real file descriptor", async () => {
  const stream = new EventEmitter();
  stream.fd = null;
  queueMicrotask(() => {
    stream.fd = 42;
    stream.emit("open", 42);
  });
  assert.equal(await waitForWritableOpen(stream), stream);
});

test("seeds isolated regions only through the reviewed master-data apply path", async () => {
  const seed = await readFile(
    resolve(import.meta.dirname, "../e2e/live/seed-identities.sql"),
    "utf8",
  );
  assert.match(seed, /SET LOCAL ROLE qiqihar_migration_owner/iu);
  assert.match(seed, /platform\.govern_master_data_change/iu);
  assert.match(seed, /e2e-seed-applicant/iu);
  assert.match(seed, /e2e-seed-reviewer/iu);
  assert.match(seed, /RESET ROLE/iu);
  assert.doesNotMatch(seed, /INSERT\s+INTO\s+platform\.region/iu);
  assert.match(seed, /isolated Stage 7 synthetic boundary fixture/iu);
  assert.match(seed, /example\.invalid\/cofco-stage7-local-boundary/iu);
  assert.match(
    seed,
    /refresh_monitoring_scope_boundary\('FORMAL_BUSINESS'\)/iu,
  );
  assert.match(
    seed,
    /refresh_monitoring_scope_boundary_render\('FORMAL_BUSINESS'\)/iu,
  );
});

test("orchestrates every correctness meaning with an independent dynamic record", async () => {
  const source = await readFile(
    resolve(import.meta.dirname, "run-stage-seven-local.mjs"),
    "utf8",
  );
  assert.doesNotMatch(source, /const concurrencyDetails/u);
  assert.match(source, /SEQUENTIAL_CLIENT_RETRY/u);
  assert.match(source, /CONCURRENT_DISTINCT_CONTENT/u);
  assert.match(source, /SEQUENTIAL_STALE_VERSION/u);
  assert.match(source, /CONCURRENT_DISTINCT_CONTENT_OWNERSHIP/u);
  assert.match(source, /e2e-operator-two/u);
  for (const marker of [
    "duplicate-click",
    "client-retry",
    "concurrent-edit",
    "optimistic-lock",
    "no-silent-overwrite",
    "single-business-effect",
  ]) {
    assert.match(source, new RegExp(`correctness-${marker}`, "u"));
  }
});

test("prepares and binds the Backend artifact before database or scenario execution", async () => {
  const source = await readFile(
    resolve(import.meta.dirname, "run-stage-seven-local.mjs"),
    "utf8",
  );
  const preparation = source.indexOf("prepareBackendArtifact({");
  const databaseCreation = source.indexOf('command("createdb"');
  const backendStart = source.indexOf("await startBackend()", preparation);
  assert.ok(preparation >= 0, "runner must prepare the Backend artifact");
  assert.ok(preparation < databaseCreation);
  assert.ok(preparation < backendStart);
  assert.match(source, /assertBackendArtifactMatches\(\{/u);
  assert.match(source, /backendArtifact:\s*backendArtifactProvenance/u);
  assert.match(
    source,
    /Object\.values\(candidateClean\)\.some\(\(clean\) => clean !== true\)/u,
  );
});

test("normalizes multi-core ps CPU against the available logical CPU quota", () => {
  assert.equal(normalizeHostCpuPercent(475.2, 12), 39.6);
  assert.throws(
    () => normalizeHostCpuPercent(100, 0),
    /Invalid host CPU sample/u,
  );
});

test("calculates host memory without a platform-specific shell command", () => {
  assert.equal(hostMemoryPercent(1024, 8 * 1024 * 1024), 12.5);
  assert.throws(
    () => hostMemoryPercent(1024, 0),
    /Invalid host memory sample/u,
  );
  assert.throws(
    () => hostMemoryPercent(-1, 8 * 1024 * 1024),
    /Invalid host memory sample/u,
  );
});

test("accepts only a unique Stage 7 database namespace", () => {
  assert.equal(
    assertIsolatedDatabaseName("qiqihar_stage7_a1b2c3d4e5f6"),
    "qiqihar_stage7_a1b2c3d4e5f6",
  );
  for (const unsafe of [
    "qiqihar_enterprise",
    "qiqihar_enterprise_e2e",
    "qiqihar_stage7_abc",
    "qiqihar_stage7_a1b2c3d4e5f6;drop database x",
  ]) {
    assert.throws(
      () => assertIsolatedDatabaseName(unsafe),
      /isolated Stage 7 database/u,
    );
  }
});

test("summarizes maximum and direction without hiding samples", () => {
  assert.deepEqual(
    summarizeResourceTrend([
      {
        elapsedSeconds: 0,
        cpuPercent: 10,
        memoryPercent: 20,
        databaseConnections: 2,
      },
      {
        elapsedSeconds: 1,
        cpuPercent: 25,
        memoryPercent: 21,
        databaseConnections: 5,
      },
      {
        elapsedSeconds: 2,
        cpuPercent: 15,
        memoryPercent: 19,
        databaseConnections: 3,
      },
    ]),
    {
      samples: 3,
      maximumCpuPercent: 25,
      maximumMemoryPercent: 21,
      maximumDatabaseConnections: 5,
      endingMinusStartingMemoryPercent: -1,
    },
  );
});

test("rejects secret-shaped keys at every nesting level", () => {
  assert.deepEqual(
    assertSecretFree({ run: "ok", nested: [{ sha256: "abc" }] }),
    {
      run: "ok",
      nested: [{ sha256: "abc" }],
    },
  );
  assert.throws(
    () => assertSecretFree({ admission: { accessToken: "must-not-appear" } }),
    /sensitive key/u,
  );
});

test("builds and revalidates an artifact from the exact clean Backend commit", async () => {
  const runtime = await import("./stage-seven-local-runtime.mjs");
  assert.equal(typeof runtime.prepareBackendArtifact, "function");
  assert.equal(typeof runtime.assertBackendArtifactMatches, "function");

  const directory = await mkdtemp(join(tmpdir(), "stage7-backend-artifact-"));
  const jarPath = join(directory, "target/backend.jar");
  const sourceCommit = "a".repeat(40);
  const buildCommand = ["mvn", "clean", "-DskipTests", "package"];
  let buildCalls = 0;
  let javaVersion = 'openjdk version "21.0.12"\n';
  const execute = async (command, args) => {
    if (command === "git" && args[0] === "rev-parse") {
      return { stdout: `${sourceCommit}\n`, stderr: "" };
    }
    if (command === "git" && args[0] === "status") {
      return { stdout: "", stderr: "" };
    }
    if (command === "mvn" && args[0] === "clean") {
      buildCalls += 1;
      await writeFile(jarPath, "fresh frozen artifact\n");
      return { stdout: "BUILD SUCCESS\n", stderr: "" };
    }
    if (command === "mvn" && args[0] === "--version") {
      return {
        stdout: "Apache Maven 3.9.11\nJava version: 21.0.12\n",
        stderr: "",
      };
    }
    if (command.endsWith("/java") && args[0] === "-version") {
      return { stdout: "", stderr: javaVersion };
    }
    if (command === "unzip") {
      return {
        stdout:
          "Manifest-Version: 1.0\nMain-Class: org.springframework.boot.loader.launch.JarLauncher\n\n",
        stderr: "",
      };
    }
    throw new Error(`unexpected command: ${command} ${args.join(" ")}`);
  };
  try {
    await mkdir(join(directory, "target"));
    const provenance = await runtime.prepareBackendArtifact({
      backendDirectory: directory,
      jarPath,
      expectedSourceCommit: sourceCommit,
      buildCommand,
      javaHome: "/approved/jdk-21",
      execute,
    });
    assert.equal(buildCalls, 1);
    assert.equal(provenance.sourceCommit, sourceCommit);
    assert.deepEqual(provenance.build.command, buildCommand);
    assert.match(provenance.build.environment.javaVersion, /21\.0\.12/u);
    assert.match(provenance.build.environment.mavenVersion, /3\.9\.11/u);
    assert.equal(
      provenance.jar.sha256,
      createHash("sha256").update("fresh frozen artifact\n").digest("hex"),
    );
    assert.equal(provenance.jar.manifest["Manifest-Version"], "1.0");
    await runtime.assertBackendArtifactMatches({
      provenance,
      backendDirectory: directory,
      jarPath,
      execute,
    });

    javaVersion = 'openjdk version "22.0.2"\n';
    await assert.rejects(
      () =>
        runtime.prepareBackendArtifact({
          backendDirectory: directory,
          jarPath,
          expectedSourceCommit: sourceCommit,
          buildCommand,
          javaHome: "/unapproved/jdk-22",
          execute,
        }),
      /build environment|JDK 21/iu,
    );

    await writeFile(jarPath, "tampered artifact\n");
    await assert.rejects(
      () =>
        runtime.assertBackendArtifactMatches({
          provenance,
          backendDirectory: directory,
          jarPath,
          execute,
        }),
      /artifact.*digest|digest.*artifact/iu,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects the wrong Backend source commit before invoking the build", async () => {
  const runtime = await import("./stage-seven-local-runtime.mjs");
  assert.equal(typeof runtime.prepareBackendArtifact, "function");
  let buildCalls = 0;
  const execute = async (command, args) => {
    if (command === "git" && args[0] === "rev-parse") {
      return { stdout: `${"a".repeat(40)}\n`, stderr: "" };
    }
    if (command === "git" && args[0] === "status") {
      return { stdout: "", stderr: "" };
    }
    buildCalls += 1;
    return { stdout: "", stderr: "" };
  };
  await assert.rejects(
    () =>
      runtime.prepareBackendArtifact({
        backendDirectory: tmpdir(),
        jarPath: join(tmpdir(), "missing.jar"),
        expectedSourceCommit: "f".repeat(40),
        buildCommand: ["mvn", "clean", "-DskipTests", "package"],
        javaHome: "/approved/jdk-21",
        execute,
      }),
    /source commit.*does not match|does not match.*source commit/iu,
  );
  assert.equal(buildCalls, 0);
});

test("rejects a symlinked Backend artifact directory without deleting outside data", async () => {
  const runtime = await import("./stage-seven-local-runtime.mjs");
  const root = await mkdtemp(join(tmpdir(), "stage7-backend-symlink-"));
  const backendDirectory = join(root, "backend");
  const outsideDirectory = join(root, "outside");
  const outsideJar = join(outsideDirectory, "backend.jar");
  const sourceCommit = "a".repeat(40);
  let buildCalls = 0;
  try {
    await Promise.all([mkdir(backendDirectory), mkdir(outsideDirectory)]);
    await writeFile(outsideJar, "outside sentinel\n");
    await symlink(outsideDirectory, join(backendDirectory, "target"));
    const execute = async (command, args) => {
      if (command === "git" && args[0] === "rev-parse") {
        return { stdout: `${sourceCommit}\n`, stderr: "" };
      }
      if (command === "git" && args[0] === "status") {
        return { stdout: "", stderr: "" };
      }
      buildCalls += 1;
      return { stdout: "", stderr: "" };
    };
    await assert.rejects(
      () =>
        runtime.prepareBackendArtifact({
          backendDirectory,
          jarPath: join(backendDirectory, "target/backend.jar"),
          expectedSourceCommit: sourceCommit,
          buildCommand: ["mvn", "clean", "-DskipTests", "package"],
          javaHome: "/approved/jdk-21",
          execute,
        }),
      /artifact.*(?:directory|path)|(?:directory|path).*artifact/iu,
    );
    assert.equal(buildCalls, 0);
    assert.equal(await readFile(outsideJar, "utf8"), "outside sentinel\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
