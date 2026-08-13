import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  decodeEvidenceEnvelope,
  encodeEvidenceEnvelope,
  evaluateLifecycle,
  publishStageNineEvidence,
  putObjectVersion,
  selectObjectVersion,
  validateRecoveryRun,
  verifyObjectVersion,
  verifyStageNineEvidence,
} from "./stage-nine-core.mjs";

const objectKey = "evidence/00/00000000-0000-4000-8000-000000000009.evp";

async function temporaryDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), "cofco-stage9-core-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function passingRun() {
  return {
    schemaVersion: "cofco-stage9-recovery-v1",
    status: "LOCAL_EVIDENCE_READY",
    externalStatus: "BLOCKED_EXTERNAL(EXT-005)",
    operatorMode: true,
    sourceEditedDuringDrill: false,
    postgres: {
      version: "17.10",
      checksumsEnabled: true,
      baseBackupManifestVerified: true,
      continuousArchiveVerified: true,
      recoveryTargetReached: true,
      targetTransactionPresent: true,
      laterMutationAbsent: true,
      flywayVersion: "116",
    },
    recovery: {
      targetAt: "2026-08-13T03:00:00.000Z",
      recoveredThroughAt: "2026-08-13T02:59:48.000Z",
      rpoSeconds: 12,
      rtoSeconds: 30,
      rpoLimitSeconds: 900,
      rtoLimitSeconds: 7200,
    },
    photo: {
      objectKey,
      databaseOriginalSha256: "a".repeat(64),
      objectOriginalSha256: "a".repeat(64),
      databaseWatermarkedSha256: "b".repeat(64),
      objectWatermarkedSha256: "b".repeat(64),
      databaseByteLength: 4,
      objectOriginalByteLength: 4,
      replicaVerified: true,
      selectedVersionCreatedAt: "2026-08-13T02:59:40.000Z",
    },
    scenarios: [
      "application-failure",
      "message-backlog",
      "database-photo-recovery",
      "manual-degradation-reconciliation",
      "on-call-escalation",
      "rollback",
      "security-event",
    ].map((code) => ({ code, status: "PASS" })),
  };
}

test("encodes and verifies the application evidence envelope without losing either digest", () => {
  const original = Buffer.from("photo-original");
  const watermarked = Buffer.from("photo-watermarked");
  const envelope = encodeEvidenceEnvelope("image/png", original, watermarked);
  const decoded = decodeEvidenceEnvelope(envelope);

  assert.equal(decoded.mediaType, "image/png");
  assert.deepEqual(decoded.original, original);
  assert.deepEqual(decoded.watermarked, watermarked);
  assert.throws(
    () =>
      decodeEvidenceEnvelope(
        Buffer.concat([envelope.subarray(0, -1), Buffer.of(0)]),
      ),
    /digest/iu,
  );
});

test("keeps immutable primary and replica versions and selects only the PITR-visible version", async (t) => {
  const directory = await temporaryDirectory(t);
  const primary = join(directory, "primary");
  const replica = join(directory, "replica");
  const first = await putObjectVersion({
    primary,
    replica,
    objectKey,
    versionId: "00000000-0000-4000-8000-000000000001",
    createdAt: "2026-08-13T03:00:00.000Z",
    content: Buffer.from("first"),
    retentionUntil: "2026-09-13T03:00:00.000Z",
    legalHold: false,
  });
  await putObjectVersion({
    primary,
    replica,
    objectKey,
    versionId: "00000000-0000-4000-8000-000000000002",
    createdAt: "2026-08-13T03:10:00.000Z",
    content: Buffer.from("later"),
    retentionUntil: "2026-09-13T03:10:00.000Z",
    legalHold: false,
  });

  assert.equal(
    (await verifyObjectVersion({ primary, replica, manifest: first }))
      .replicaVerified,
    true,
  );
  assert.equal(
    (
      await selectObjectVersion({
        primary,
        objectKey,
        recoveredAt: "2026-08-13T03:05:00.000Z",
      })
    ).versionId,
    first.versionId,
  );
  await assert.rejects(
    putObjectVersion({
      primary,
      replica,
      objectKey,
      versionId: first.versionId,
      createdAt: first.createdAt,
      content: Buffer.from("overwrite"),
      retentionUntil: first.retentionUntil,
      legalHold: false,
    }),
    /already exists/iu,
  );

  await writeFile(first.replicaPath, "tampered");
  await assert.rejects(
    verifyObjectVersion({ primary, replica, manifest: first }),
    /replica digest/iu,
  );
});

test("lifecycle evaluation never disposes current, retained, or held versions", () => {
  const base = {
    versionId: "00000000-0000-4000-8000-000000000001",
    retentionUntil: "2026-08-14T00:00:00.000Z",
    legalHold: false,
  };
  assert.equal(
    evaluateLifecycle(base, "2026-08-13T00:00:00.000Z", false).eligible,
    false,
  );
  assert.equal(
    evaluateLifecycle(
      { ...base, legalHold: true },
      "2026-08-15T00:00:00.000Z",
      false,
    ).reason,
    "LEGAL_HOLD",
  );
  assert.equal(
    evaluateLifecycle(base, "2026-08-15T00:00:00.000Z", true).reason,
    "CURRENT_VERSION",
  );
  assert.deepEqual(evaluateLifecycle(base, "2026-08-15T00:00:00.000Z", false), {
    eligible: true,
    reason: "RETENTION_EXPIRED_NONCURRENT",
  });
});

test("recomputes recovery acceptance and fails closed on RPO, RTO, PITR, or photo drift", () => {
  assert.equal(
    validateRecoveryRun(passingRun()).status,
    "LOCAL_EVIDENCE_READY",
  );
  assert.throws(
    () =>
      validateRecoveryRun({
        ...passingRun(),
        recovery: { ...passingRun().recovery, rpoSeconds: 901 },
      }),
    /RPO/iu,
  );
  assert.throws(
    () =>
      validateRecoveryRun({
        ...passingRun(),
        recovery: { ...passingRun().recovery, rtoSeconds: 7201 },
      }),
    /RTO/iu,
  );
  assert.throws(
    () =>
      validateRecoveryRun({
        ...passingRun(),
        postgres: { ...passingRun().postgres, laterMutationAbsent: false },
      }),
    /later mutation/iu,
  );
  assert.throws(
    () =>
      validateRecoveryRun({
        ...passingRun(),
        photo: { ...passingRun().photo, objectOriginalSha256: "c".repeat(64) },
      }),
    /photo/iu,
  );
});

test("publishes deterministic evidence without replacing any existing target", async (t) => {
  const directory = await temporaryDirectory(t);
  const output = join(directory, "evidence");
  const run = passingRun();

  await publishStageNineEvidence(output, run);
  assert.equal(
    (await verifyStageNineEvidence(output)).status,
    "LOCAL_EVIDENCE_READY",
  );
  await assert.rejects(
    publishStageNineEvidence(output, run),
    /already exists/iu,
  );

  const runPath = join(output, "run.json");
  const parsed = JSON.parse(await readFile(runPath, "utf8"));
  parsed.recovery.rpoSeconds = 901;
  await writeFile(runPath, `${JSON.stringify(parsed, null, 2)}\n`);
  await assert.rejects(verifyStageNineEvidence(output), /RPO|drift/iu);
});
