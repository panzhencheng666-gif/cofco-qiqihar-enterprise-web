import assert from "node:assert/strict";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  assertIsolatedWorkspace,
  assertPostgresToolchain,
  calculateRecoveryObjectives,
  parseScalarQueryOutput,
  renderRecoveryConfiguration,
  renderSourceConfiguration,
} from "./stage-nine-postgres.mjs";

const toolNames = [
  "initdb",
  "postgres",
  "pg_ctl",
  "psql",
  "createdb",
  "pg_basebackup",
  "pg_verifybackup",
  "pg_controldata",
  "pg_waldump",
];

test("requires one complete PostgreSQL 17 native toolchain", () => {
  const tools = Object.fromEntries(
    toolNames.map((name) => [
      name,
      { path: `/approved/${name}`, version: "17.10" },
    ]),
  );
  assert.equal(assertPostgresToolchain(tools).major, 17);
  assert.throws(
    () =>
      assertPostgresToolchain({
        ...tools,
        psql: { path: "/approved/psql", version: "16.4" },
      }),
    /same PostgreSQL 17/iu,
  );
  const missing = { ...tools };
  delete missing.pg_verifybackup;
  assert.throws(() => assertPostgresToolchain(missing), /pg_verifybackup/iu);
});

test("accepts cleanup only for the current mktemp Stage 9 workspace", () => {
  const owned = join(tmpdir(), "cofco-stage9-dr-ABC123");
  assert.equal(assertIsolatedWorkspace(owned), owned);
  assert.throws(
    () => assertIsolatedWorkspace(tmpdir()),
    /isolated workspace/iu,
  );
  assert.throws(
    () => assertIsolatedWorkspace("/Users/federal"),
    /isolated workspace/iu,
  );
  assert.throws(
    () => assertIsolatedWorkspace(join(tmpdir(), "cofco-stage7-existing")),
    /isolated workspace/iu,
  );
});

test("renders continuous archive and named-target restore without unsafe path interpolation", () => {
  const workspace = join(tmpdir(), "cofco-stage9-dr-safe");
  const source = renderSourceConfiguration({
    port: 55439,
    socketDirectory: join(workspace, "source-socket"),
    archiveDirectory: join(workspace, "archive"),
  });
  const recovery = renderRecoveryConfiguration({
    port: 55440,
    socketDirectory: join(workspace, "restore-socket"),
    archiveDirectory: join(workspace, "archive"),
    restorePoint: "cofco_stage9_target",
  });

  assert.match(source, /archive_mode = on/u);
  assert.match(source, /test ! -f .*%f.*cp .*%p.*%f/u);
  assert.match(source, /archive_timeout = '5s'/u);
  assert.match(recovery, /restore_command = 'cp .*%f.*%p.*'/u);
  assert.match(recovery, /recovery_target_name = 'cofco_stage9_target'/u);
  assert.match(recovery, /recovery_target_action = 'promote'/u);
  assert.throws(
    () =>
      renderSourceConfiguration({
        port: 55439,
        socketDirectory: join(workspace, "bad'path"),
        archiveDirectory: join(workspace, "archive"),
      }),
    /unsafe path/iu,
  );
});

test("recomputes bounded RPO and RTO from machine timestamps", () => {
  assert.deepEqual(
    calculateRecoveryObjectives({
      targetAt: "2026-08-13T03:00:12.000Z",
      recoveredThroughAt: "2026-08-13T03:00:00.000Z",
      recoveryStartedAt: "2026-08-13T03:01:00.000Z",
      recoveryVerifiedAt: "2026-08-13T03:01:30.000Z",
    }),
    { rpoSeconds: 12, rtoSeconds: 30 },
  );
  assert.throws(
    () =>
      calculateRecoveryObjectives({
        targetAt: "2026-08-13T03:00:00.000Z",
        recoveredThroughAt: "2026-08-13T03:00:01.000Z",
        recoveryStartedAt: "2026-08-13T03:01:00.000Z",
        recoveryVerifiedAt: "2026-08-13T03:01:30.000Z",
      }),
    /recovered-through/iu,
  );
});

test("accepts exactly one quiet psql scalar and rejects command-status pollution", () => {
  assert.equal(
    parseScalarQueryOutput("2026-08-13 03:40:00.123456+00\n"),
    "2026-08-13 03:40:00.123456+00",
  );
  assert.throws(
    () => parseScalarQueryOutput("2026-08-13 03:40:00.123456+00\nINSERT 0 1\n"),
    /exactly one scalar/iu,
  );
  assert.throws(() => parseScalarQueryOutput("\n"), /exactly one scalar/iu);
});
