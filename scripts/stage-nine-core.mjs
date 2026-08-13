import { createHash, timingSafeEqual } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const envelopeMagic = 0x45565031;
const envelopeVersion = 1;
const digestBytes = 32;
const maximumPartBytes = 20 * 1024 * 1024;
const mediaTypes = new Set(["image/jpeg", "image/png"]);
const objectKeyPattern =
  /^evidence\/[0-9a-f]{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.evp$/u;
const versionPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const sha256Pattern = /^[0-9a-f]{64}$/u;
const evidenceFiles = [
  "run.json",
  "SUMMARY.md",
  "VERIFICATION.md",
  "HANDOFF.md",
];
const requiredScenarios = [
  "application-failure",
  "message-backlog",
  "database-photo-recovery",
  "manual-degradation-reconciliation",
  "on-call-escalation",
  "rollback",
  "security-event",
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function validDate(value, name) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${name} is invalid`);
  }
  return new Date(value).toISOString();
}

function requirePart(value) {
  const bytes = Buffer.from(value ?? []);
  if (bytes.length < 1 || bytes.length > maximumPartBytes) {
    throw new Error("Evidence envelope part is invalid");
  }
  return bytes;
}

export function encodeEvidenceEnvelope(
  mediaType,
  originalValue,
  watermarkedValue,
) {
  if (!mediaTypes.has(mediaType))
    throw new Error("Evidence envelope media type is invalid");
  const original = requirePart(originalValue);
  const watermarked = requirePart(watermarkedValue);
  const mediaTypeBytes = Buffer.from(mediaType, "utf8");
  if (mediaTypeBytes.length > 0xffff)
    throw new Error("Evidence envelope media type is invalid");
  const body = Buffer.allocUnsafe(
    4 +
      4 +
      2 +
      mediaTypeBytes.length +
      4 +
      original.length +
      4 +
      watermarked.length,
  );
  let offset = 0;
  body.writeInt32BE(envelopeMagic, offset);
  offset += 4;
  body.writeInt32BE(envelopeVersion, offset);
  offset += 4;
  body.writeUInt16BE(mediaTypeBytes.length, offset);
  offset += 2;
  mediaTypeBytes.copy(body, offset);
  offset += mediaTypeBytes.length;
  body.writeInt32BE(original.length, offset);
  offset += 4;
  original.copy(body, offset);
  offset += original.length;
  body.writeInt32BE(watermarked.length, offset);
  offset += 4;
  watermarked.copy(body, offset);
  const digest = createHash("sha256").update(body).digest();
  return Buffer.concat([body, digest]);
}

export function decodeEvidenceEnvelope(value) {
  const envelope = Buffer.from(value ?? []);
  if (envelope.length <= digestBytes + 18)
    throw new Error("Evidence envelope is invalid");
  const body = envelope.subarray(0, -digestBytes);
  const expected = envelope.subarray(-digestBytes);
  const actual = createHash("sha256").update(body).digest();
  if (!timingSafeEqual(expected, actual))
    throw new Error("Evidence envelope digest is invalid");
  let offset = 0;
  const readInt = () => {
    if (offset + 4 > body.length)
      throw new Error("Evidence envelope is truncated");
    const result = body.readInt32BE(offset);
    offset += 4;
    return result;
  };
  if (readInt() !== envelopeMagic || readInt() !== envelopeVersion) {
    throw new Error("Evidence envelope header is invalid");
  }
  if (offset + 2 > body.length)
    throw new Error("Evidence envelope is truncated");
  const mediaTypeLength = body.readUInt16BE(offset);
  offset += 2;
  if (offset + mediaTypeLength > body.length)
    throw new Error("Evidence envelope is truncated");
  const mediaType = body
    .subarray(offset, offset + mediaTypeLength)
    .toString("utf8");
  offset += mediaTypeLength;
  if (!mediaTypes.has(mediaType))
    throw new Error("Evidence envelope media type is invalid");
  const readPart = () => {
    const length = readInt();
    if (
      length < 1 ||
      length > maximumPartBytes ||
      offset + length > body.length
    ) {
      throw new Error("Evidence envelope part is invalid");
    }
    const part = Buffer.from(body.subarray(offset, offset + length));
    offset += length;
    return part;
  };
  const original = readPart();
  const watermarked = readPart();
  if (offset !== body.length)
    throw new Error("Evidence envelope has trailing content");
  return { mediaType, original, watermarked };
}

function requireObjectIdentity(objectKey, versionId) {
  if (!objectKeyPattern.test(objectKey))
    throw new Error("Object key is invalid");
  if (!versionPattern.test(versionId))
    throw new Error("Object version is invalid");
}

function contentPath(root, versionId, objectKey) {
  return join(resolve(root), "versions", versionId, objectKey);
}

function manifestPath(root, versionId) {
  return join(resolve(root), "manifests", `${versionId}.json`);
}

export async function putObjectVersion({
  primary,
  replica,
  objectKey,
  versionId,
  createdAt,
  content,
  retentionUntil,
  legalHold,
}) {
  requireObjectIdentity(objectKey, versionId);
  const versionCreatedAt = validDate(createdAt, "Object version creation time");
  const versionRetentionUntil = validDate(
    retentionUntil,
    "Object retention time",
  );
  if (Date.parse(versionRetentionUntil) < Date.parse(versionCreatedAt)) {
    throw new Error("Object retention time precedes its version");
  }
  const bytes = Buffer.from(content ?? []);
  if (bytes.length < 1 || bytes.length > 40 * 1024 * 1024) {
    throw new Error("Object version content is invalid");
  }
  const primaryPath = contentPath(primary, versionId, objectKey);
  const replicaPath = contentPath(replica, versionId, objectKey);
  const primaryManifestPath = manifestPath(primary, versionId);
  const replicaManifestPath = manifestPath(replica, versionId);
  const manifest = {
    schemaVersion: "cofco-stage9-object-version-v1",
    operation: "PUT",
    objectKey,
    versionId,
    createdAt: versionCreatedAt,
    retentionUntil: versionRetentionUntil,
    legalHold: legalHold === true,
    sizeBytes: bytes.length,
    sha256: sha256(bytes),
  };
  let primaryCreated = false;
  let replicaCreated = false;
  let primaryManifestCreated = false;
  let replicaManifestCreated = false;
  try {
    await Promise.all([
      mkdir(dirname(primaryPath), { recursive: true, mode: 0o700 }),
      mkdir(dirname(replicaPath), { recursive: true, mode: 0o700 }),
      mkdir(dirname(primaryManifestPath), { recursive: true, mode: 0o700 }),
      mkdir(dirname(replicaManifestPath), { recursive: true, mode: 0o700 }),
    ]);
    await writeFile(primaryPath, bytes, { flag: "wx", mode: 0o600 });
    primaryCreated = true;
    await writeFile(replicaPath, bytes, { flag: "wx", mode: 0o600 });
    replicaCreated = true;
    const json = `${JSON.stringify(manifest, null, 2)}\n`;
    await writeFile(primaryManifestPath, json, { flag: "wx", mode: 0o600 });
    primaryManifestCreated = true;
    await writeFile(replicaManifestPath, json, { flag: "wx", mode: 0o600 });
    replicaManifestCreated = true;
  } catch (error) {
    await Promise.allSettled([
      ...(primaryCreated ? [unlink(primaryPath)] : []),
      ...(replicaCreated ? [unlink(replicaPath)] : []),
      ...(primaryManifestCreated ? [unlink(primaryManifestPath)] : []),
      ...(replicaManifestCreated ? [unlink(replicaManifestPath)] : []),
    ]);
    if (error?.code === "EEXIST")
      throw new Error("Object version already exists", { cause: error });
    throw error;
  }
  return {
    ...manifest,
    primaryPath,
    replicaPath,
    primaryManifestPath,
    replicaManifestPath,
  };
}

export async function verifyObjectVersion({ primary, replica, manifest }) {
  requireObjectIdentity(manifest.objectKey, manifest.versionId);
  const primaryPath = contentPath(
    primary,
    manifest.versionId,
    manifest.objectKey,
  );
  const replicaPath = contentPath(
    replica,
    manifest.versionId,
    manifest.objectKey,
  );
  const [primaryBytes, replicaBytes] = await Promise.all([
    readFile(primaryPath),
    readFile(replicaPath),
  ]);
  if (
    primaryBytes.length !== manifest.sizeBytes ||
    sha256(primaryBytes) !== manifest.sha256
  ) {
    throw new Error("Primary object digest is invalid");
  }
  if (
    replicaBytes.length !== manifest.sizeBytes ||
    sha256(replicaBytes) !== manifest.sha256
  ) {
    throw new Error("Replica digest is invalid");
  }
  return {
    ...manifest,
    primaryPath,
    replicaPath,
    replicaVerified: true,
    content: primaryBytes,
  };
}

export async function selectObjectVersion({ primary, objectKey, recoveredAt }) {
  if (!objectKeyPattern.test(objectKey))
    throw new Error("Object key is invalid");
  const cutoff = Date.parse(validDate(recoveredAt, "Recovery cutoff"));
  const directory = join(resolve(primary), "manifests");
  const entries = await readdir(directory);
  const candidates = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const manifest = JSON.parse(await readFile(join(directory, entry), "utf8"));
    if (
      manifest.schemaVersion === "cofco-stage9-object-version-v1" &&
      manifest.operation === "PUT" &&
      manifest.objectKey === objectKey &&
      Date.parse(manifest.createdAt) <= cutoff
    ) {
      requireObjectIdentity(manifest.objectKey, manifest.versionId);
      candidates.push(manifest);
    }
  }
  candidates.sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
  if (candidates.length === 0)
    throw new Error("No object version is visible at the recovery cutoff");
  return candidates[0];
}

export function evaluateLifecycle(manifest, nowValue, currentVersion) {
  const now = Date.parse(validDate(nowValue, "Lifecycle evaluation time"));
  const retentionUntil = Date.parse(
    validDate(manifest.retentionUntil, "Object retention time"),
  );
  if (manifest.legalHold === true)
    return { eligible: false, reason: "LEGAL_HOLD" };
  if (currentVersion === true)
    return { eligible: false, reason: "CURRENT_VERSION" };
  if (now < retentionUntil)
    return { eligible: false, reason: "RETENTION_ACTIVE" };
  return { eligible: true, reason: "RETENTION_EXPIRED_NONCURRENT" };
}

function assertRecovery(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateRecoveryRun(rawRun) {
  const run = structuredClone(rawRun);
  assertRecovery(
    run?.schemaVersion === "cofco-stage9-recovery-v1",
    "Recovery schema is invalid",
  );
  assertRecovery(
    run.status === "LOCAL_EVIDENCE_READY",
    "Recovery status is not local evidence ready",
  );
  assertRecovery(
    run.externalStatus === "BLOCKED_EXTERNAL(EXT-005)",
    "External recovery boundary is invalid",
  );
  assertRecovery(run.operatorMode === true, "Operator mode was not used");
  assertRecovery(
    run.sourceEditedDuringDrill === false,
    "Source was edited during the drill",
  );
  const postgres = run.postgres ?? {};
  assertRecovery(
    /^17\./u.test(postgres.version),
    "PostgreSQL 17 evidence is required",
  );
  assertRecovery(
    postgres.checksumsEnabled === true,
    "Database checksums were not enabled",
  );
  assertRecovery(
    postgres.baseBackupManifestVerified === true,
    "Base backup manifest was not verified",
  );
  assertRecovery(
    postgres.continuousArchiveVerified === true,
    "Continuous WAL archive was not verified",
  );
  assertRecovery(
    postgres.recoveryTargetReached === true,
    "PITR target was not reached",
  );
  assertRecovery(
    postgres.targetTransactionPresent === true,
    "PITR target transaction is absent",
  );
  assertRecovery(
    postgres.laterMutationAbsent === true,
    "PITR later mutation is present",
  );
  assertRecovery(
    postgres.flywayVersion === "116",
    "Recovered Flyway version is not 116",
  );
  const recovery = run.recovery ?? {};
  const targetAt = Date.parse(validDate(recovery.targetAt, "Recovery target"));
  const recoveredThroughAt = Date.parse(
    validDate(recovery.recoveredThroughAt, "Recovered-through time"),
  );
  assertRecovery(
    recoveredThroughAt <= targetAt,
    "Recovered-through time exceeds target",
  );
  const recomputedRpo = Math.round((targetAt - recoveredThroughAt) / 1000);
  assertRecovery(
    recovery.rpoSeconds === recomputedRpo,
    "RPO does not match recovery timestamps",
  );
  assertRecovery(
    recovery.rpoLimitSeconds === 900 && recovery.rpoSeconds <= 900,
    "RPO exceeds 15 minutes",
  );
  assertRecovery(
    recovery.rtoLimitSeconds === 7200 &&
      recovery.rtoSeconds >= 0 &&
      recovery.rtoSeconds <= 7200,
    "RTO exceeds 120 minutes",
  );
  const photo = run.photo ?? {};
  assertRecovery(
    objectKeyPattern.test(photo.objectKey),
    "Recovered photo object key is invalid",
  );
  assertRecovery(
    sha256Pattern.test(photo.databaseOriginalSha256) &&
      photo.databaseOriginalSha256 === photo.objectOriginalSha256,
    "Recovered photo original digest is inconsistent",
  );
  assertRecovery(
    sha256Pattern.test(photo.databaseWatermarkedSha256) &&
      photo.databaseWatermarkedSha256 === photo.objectWatermarkedSha256,
    "Recovered photo watermarked digest is inconsistent",
  );
  assertRecovery(
    Number.isSafeInteger(photo.databaseByteLength) &&
      photo.databaseByteLength > 0 &&
      photo.databaseByteLength === photo.objectOriginalByteLength,
    "Recovered photo byte length is inconsistent",
  );
  assertRecovery(
    photo.replicaVerified === true,
    "Recovered photo replica was not verified",
  );
  assertRecovery(
    Date.parse(
      validDate(photo.selectedVersionCreatedAt, "Selected object version"),
    ) <= targetAt,
    "Recovered photo object version is later than the PITR target",
  );
  const scenarios = new Map(
    (run.scenarios ?? []).map((scenario) => [scenario.code, scenario.status]),
  );
  for (const code of requiredScenarios) {
    assertRecovery(
      scenarios.get(code) === "PASS",
      `Continuity scenario ${code} did not pass`,
    );
  }
  assertRecovery(
    scenarios.size === requiredScenarios.length,
    "Continuity scenario set is invalid",
  );
  return run;
}

function renderStageNineEvidence(rawRun) {
  const run = validateRecoveryRun(rawRun);
  return {
    "run.json": `${JSON.stringify(run, null, 2)}\n`,
    "SUMMARY.md": `# Stage 9 Local Recovery Summary\n\n- Status: \`${run.status}\`\n- External: \`${run.externalStatus}\`\n- RPO: ${run.recovery.rpoSeconds}s / 900s\n- RTO: ${run.recovery.rtoSeconds}s / 7200s\n- PostgreSQL: ${run.postgres.version}; Flyway V${run.postgres.flywayVersion}\n- Photo/object replica consistency: PASS\n`,
    "VERIFICATION.md": `# Verification\n\n- Base backup manifest: PASS\n- Continuous WAL archive: PASS\n- PITR target transaction present: PASS\n- Later mutation absent: PASS\n- Database/photo SHA-256 and byte length: PASS\n- Immutable object replica: PASS\n- Operator-only scenario matrix: ${run.scenarios.length}/${requiredScenarios.length} PASS\n`,
    "HANDOFF.md": `# LOCAL_EVIDENCE_READY\n\nThe local PostgreSQL and object recovery boundary passed with RPO ${run.recovery.rpoSeconds}s and RTO ${run.recovery.rtoSeconds}s. Online alert delivery, real RDS/OSS recovery, and regional failover remain \`${run.externalStatus}\`. Independent supervision must verify this bundle before any later stage.\n`,
  };
}

export async function publishStageNineEvidence(outputPath, rawRun) {
  const target = resolve(outputPath);
  const parent = dirname(target);
  const evidence = renderStageNineEvidence(rawRun);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  try {
    await mkdir(target, { mode: 0o700 });
  } catch (error) {
    if (error?.code === "EEXIST")
      throw new Error("Stage 9 evidence target already exists", {
        cause: error,
      });
    throw error;
  }
  const sentinel = join(target, ".publishing");
  try {
    await writeFile(sentinel, "in-progress\n", { flag: "wx", mode: 0o600 });
    for (const name of evidenceFiles) {
      await writeFile(join(target, name), evidence[name], {
        flag: "wx",
        mode: 0o600,
      });
    }
    await verifyStageNineEvidence(target, { allowPublishingSentinel: true });
    await unlink(sentinel);
  } catch (error) {
    await rm(target, { recursive: true, force: true });
    throw error;
  }
  return evidence;
}

export async function verifyStageNineEvidence(
  directory,
  { allowPublishingSentinel = false } = {},
) {
  const target = resolve(directory);
  const actual = (await readdir(target)).sort();
  const expected = [
    ...evidenceFiles,
    ...(allowPublishingSentinel ? [".publishing"] : []),
  ].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("Stage 9 evidence is incomplete or still publishing");
  }
  const entries = Object.fromEntries(
    await Promise.all(
      evidenceFiles.map(async (name) => [
        name,
        await readFile(join(target, name), "utf8"),
      ]),
    ),
  );
  const run = validateRecoveryRun(JSON.parse(entries["run.json"]));
  const rendered = renderStageNineEvidence(run);
  for (const name of evidenceFiles) {
    if (entries[name] !== rendered[name])
      throw new Error(`Stage 9 evidence drift in ${name}`);
  }
  return run;
}
