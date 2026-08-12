import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  assertIsolatedDatabaseName,
  assertSecretFree,
  evaluateLoadConsistency,
  hostMemoryPercent,
  normalizeHostCpuPercent,
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
