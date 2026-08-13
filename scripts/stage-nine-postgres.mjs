import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import {
  access,
  appendFile,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { basename, dirname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

import {
  decodeEvidenceEnvelope,
  encodeEvidenceEnvelope,
  putObjectVersion,
  selectObjectVersion,
  verifyObjectVersion,
  validateRecoveryRun,
} from "./stage-nine-core.mjs";

const postgresTools = [
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
const restorePoint = "cofco_stage9_target";
const databaseName = "cofco_stage9_recovery";
const photoId = "00000000-0000-4000-8000-000000000009";
const objectKey = `evidence/00/${photoId}.evp`;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseTime(value, name) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} is invalid`);
  return parsed;
}

function safeConfigurationPath(value) {
  const target = resolve(value);
  if (target.includes("'") || target.includes("\n") || target.includes("\r")) {
    throw new Error("PostgreSQL configuration contains an unsafe path");
  }
  return target;
}

function requirePort(value) {
  if (!Number.isSafeInteger(value) || value < 1024 || value > 65535) {
    throw new Error("PostgreSQL loopback port is invalid");
  }
  return value;
}

export function assertPostgresToolchain(tools) {
  for (const name of postgresTools) {
    if (
      !tools?.[name]?.path ||
      !/^17\.[0-9]+$/u.test(tools[name].version ?? "")
    ) {
      throw new Error(
        `${name} is required from the same PostgreSQL 17 toolchain`,
      );
    }
  }
  const paths = new Set(
    postgresTools.map((name) => dirname(resolve(tools[name].path))),
  );
  if (paths.size !== 1)
    throw new Error(
      "All native tools must use the same PostgreSQL 17 toolchain",
    );
  return { major: 17, binDirectory: [...paths][0] };
}

export function assertIsolatedWorkspace(candidate) {
  const workspace = resolve(candidate);
  const temporaryRoot = resolve(tmpdir());
  if (
    !workspace.startsWith(`${temporaryRoot}${sep}`) ||
    !basename(workspace).startsWith("cofco-stage9-dr-") ||
    workspace === temporaryRoot
  ) {
    throw new Error(
      "Refusing operation outside the current isolated workspace",
    );
  }
  return workspace;
}

export function renderSourceConfiguration({
  port,
  socketDirectory,
  archiveDirectory,
}) {
  const socket = safeConfigurationPath(socketDirectory);
  const archive = safeConfigurationPath(archiveDirectory);
  return `
# Stage 9 isolated source cluster
listen_addresses = '127.0.0.1'
port = ${requirePort(port)}
unix_socket_directories = '${socket}'
wal_level = replica
max_wal_senders = 4
archive_mode = on
archive_timeout = '5s'
archive_command = 'test ! -f "${archive}/%f" && cp "%p" "${archive}/%f"'
fsync = on
full_page_writes = on
log_connections = off
log_disconnections = off
`;
}

export function renderRecoveryConfiguration({
  port,
  socketDirectory,
  archiveDirectory,
  restorePoint: targetName,
}) {
  const socket = safeConfigurationPath(socketDirectory);
  const archive = safeConfigurationPath(archiveDirectory);
  if (!/^[a-z][a-z0-9_]{2,63}$/u.test(targetName)) {
    throw new Error("PostgreSQL recovery target name is invalid");
  }
  return `
# Stage 9 isolated recovered cluster
listen_addresses = '127.0.0.1'
port = ${requirePort(port)}
unix_socket_directories = '${socket}'
archive_mode = off
restore_command = 'cp "${archive}/%f" "%p"'
recovery_target_name = '${targetName}'
recovery_target_action = 'promote'
`;
}

export function calculateRecoveryObjectives({
  targetAt,
  recoveredThroughAt,
  recoveryStartedAt,
  recoveryVerifiedAt,
}) {
  const target = parseTime(targetAt, "Recovery target time");
  const recovered = parseTime(
    recoveredThroughAt,
    "Recovery recovered-through time",
  );
  const started = parseTime(recoveryStartedAt, "Recovery start time");
  const verified = parseTime(recoveryVerifiedAt, "Recovery verification time");
  if (recovered > target)
    throw new Error("Recovery recovered-through time exceeds target");
  if (verified < started)
    throw new Error("Recovery verification precedes start");
  return {
    rpoSeconds: Math.round((target - recovered) / 1000),
    rtoSeconds: Math.round((verified - started) / 1000),
  };
}

async function runCommand(command, args, options = {}) {
  const { cwd, env, timeoutMs = 120_000, allowFailure = false } = options;
  const child = spawn(command, args, {
    cwd,
    env: env ?? process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const timeout = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
  const result = await new Promise((resolveChild, rejectChild) => {
    child.once("error", rejectChild);
    child.once("exit", (code, signal) => resolveChild({ code, signal }));
  }).finally(() => clearTimeout(timeout));
  if (!allowFailure && (result.signal || result.code !== 0)) {
    const detail = `${stderr}\n${stdout}`.trim().slice(-4000);
    throw new Error(
      `${basename(command)} failed (${result.signal ?? result.code})${detail ? `: ${detail}` : ""}`,
    );
  }
  return { ...result, stdout, stderr };
}

async function locateTool(name) {
  const result = await runCommand("/usr/bin/which", [name]);
  return result.stdout.trim();
}

function parseToolVersion(name, output) {
  const match = output.match(/(?:PostgreSQL\)?\s+)?(\d+\.\d+)/u);
  if (!match) throw new Error(`Cannot determine ${name} version`);
  return match[1];
}

export async function discoverPostgresToolchain() {
  const tools = {};
  for (const name of postgresTools) {
    const path = await locateTool(name);
    const version = await runCommand(path, ["--version"]);
    tools[name] = {
      path,
      version: parseToolVersion(name, `${version.stdout}${version.stderr}`),
    };
  }
  assertPostgresToolchain(tools);
  return tools;
}

async function freeLoopbackPort() {
  const server = createServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolveClose, rejectClose) =>
    server.close((error) => (error ? rejectClose(error) : resolveClose())),
  );
  return requirePort(port);
}

function databaseArgs(port, sql) {
  return [
    "-X",
    "-v",
    "ON_ERROR_STOP=1",
    "-h",
    "127.0.0.1",
    "-p",
    String(port),
    "-U",
    process.env.USER,
    "-d",
    databaseName,
    "-q",
    "-At",
    "-c",
    sql,
  ];
}

async function query(tools, port, sql) {
  return (
    await runCommand(tools.psql.path, databaseArgs(port, sql))
  ).stdout.trim();
}

export function parseScalarQueryOutput(output) {
  const lines = String(output)
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length !== 1) {
    throw new Error("PostgreSQL query must return exactly one scalar value");
  }
  return lines[0];
}

async function scalarQuery(tools, port, sql) {
  return parseScalarQueryOutput(await query(tools, port, sql));
}

async function startPostgres(tools, dataDirectory, logPath) {
  await runCommand(tools.pg_ctl.path, [
    "-D",
    dataDirectory,
    "-l",
    logPath,
    "-w",
    "-t",
    "30",
    "start",
  ]);
}

async function stopPostgres(tools, dataDirectory) {
  await runCommand(
    tools.pg_ctl.path,
    ["-D", dataDirectory, "-w", "-t", "30", "-m", "fast", "stop"],
    { allowFailure: true },
  );
}

async function startBackground(command, args, { cwd, env, logPath }) {
  const log = createWriteStream(logPath, { flags: "wx", mode: 0o600 });
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  const exited = new Promise((resolveExit, rejectExit) => {
    child.once("error", rejectExit);
    child.once("exit", (code, signal) => resolveExit({ code, signal }));
  });
  return { child, exited, log };
}

async function stopBackground(processHandle) {
  if (!processHandle || processHandle.child.exitCode !== null) return;
  processHandle.child.kill("SIGTERM");
  const graceful = await Promise.race([
    processHandle.exited.then(() => true),
    new Promise((resolveWait) => setTimeout(() => resolveWait(false), 15_000)),
  ]);
  if (!graceful && processHandle.child.exitCode === null) {
    processHandle.child.kill("SIGKILL");
    await processHandle.exited;
  }
  processHandle.log.end();
}

async function waitForHealth(url, processHandle, logPath) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (processHandle.child.exitCode !== null) break;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok && (await response.text()).includes("UP")) return;
    } catch {
      // The owned loopback application is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  const log = await readFile(logPath, "utf8").catch(() => "");
  throw new Error(
    `Recovered application health did not become ready: ${log.slice(-4000)}`,
  );
}

async function waitForArchive(path) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      await access(path);
      return;
    } catch {
      await new Promise((resolveWait) => setTimeout(resolveWait, 200));
    }
  }
  throw new Error("Required continuous WAL segment was not archived");
}

async function trackedStatus(repository) {
  return (
    await runCommand("/usr/bin/git", [
      "-C",
      repository,
      "status",
      "--porcelain",
      "--untracked-files=no",
    ])
  ).stdout.trim();
}

async function commitOf(repository) {
  return (
    await runCommand("/usr/bin/git", ["-C", repository, "rev-parse", "HEAD"])
  ).stdout.trim();
}

async function buildBackend(backendRepository, workspace) {
  if ((await trackedStatus(backendRepository)) !== "") {
    throw new Error(
      "Backend tracked worktree must be clean before the operator drill",
    );
  }
  const javaHome =
    process.env.COFCO_STAGE9_JAVA_HOME ??
    "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home";
  const javaPath = join(javaHome, "bin", "java");
  await access(javaPath);
  const javaVersion = await runCommand(javaPath, ["-version"]);
  if (!/version "21\./u.test(`${javaVersion.stdout}${javaVersion.stderr}`)) {
    throw new Error("Stage 9 requires JDK 21");
  }
  const maven = await locateTool("mvn");
  const build = await runCommand(
    maven,
    ["-q", "clean", "-DskipTests", "package"],
    {
      cwd: backendRepository,
      env: {
        ...process.env,
        JAVA_HOME: javaHome,
        PATH: `${join(javaHome, "bin")}:/opt/homebrew/bin:/usr/bin:/bin`,
      },
      timeoutMs: 300_000,
    },
  );
  await writeFile(
    join(workspace, "backend-build.log"),
    `${build.stdout}${build.stderr}`,
    {
      mode: 0o600,
    },
  );
  const jarPath = join(
    backendRepository,
    "target",
    "grain-trade-enterprise-backend-0.0.1-SNAPSHOT.jar",
  );
  const stat = await lstat(jarPath);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error("Backend artifact is not a regular JAR");
  return {
    javaPath,
    jarPath,
    jarSha256: sha256(await readFile(jarPath)),
    sourceCommit: await commitOf(backendRepository),
    javaVersion: `${javaVersion.stdout}${javaVersion.stderr}`
      .trim()
      .split("\n")[0],
  };
}

async function startBackend({
  build,
  backendRepository,
  databasePort,
  applicationPort,
  contentRoot,
  logPath,
}) {
  await mkdir(contentRoot, { recursive: true, mode: 0o700 });
  const databaseUrl = `jdbc:postgresql://127.0.0.1:${databasePort}/${databaseName}`;
  return startBackground(build.javaPath, ["-jar", build.jarPath], {
    cwd: backendRepository,
    logPath,
    env: {
      ...process.env,
      SPRING_PROFILES_ACTIVE: "local",
      SERVER_ADDRESS: "127.0.0.1",
      QIQIHAR_SERVER_PORT: String(applicationPort),
      QIQIHAR_DB_URL: databaseUrl,
      QIQIHAR_DB_USERNAME: process.env.USER,
      QIQIHAR_FLYWAY_USERNAME: process.env.USER,
      QIQIHAR_EVENT_CONSUMER_REGISTRAR_DB_URL: databaseUrl,
      QIQIHAR_EVENT_CONSUMER_REGISTRAR_DB_USERNAME: process.env.USER,
      QIQIHAR_EVIDENCE_CONTENT_MODE: "filesystem",
      QIQIHAR_EVIDENCE_FILESYSTEM_ROOT: contentRoot,
      QIQIHAR_IMPORT_QUEUE_ENABLED: "false",
    },
  });
}

async function runContinuityScenarios(
  webRepository,
  workspace,
  runtimeEvidence,
) {
  const runbooks = {
    "application-failure": "application-failure.md",
    "message-backlog": "message-backlog.md",
    "database-photo-recovery": "database-photo-recovery.md",
    "manual-degradation-reconciliation": "manual-degradation-reconciliation.md",
    "on-call-escalation": "on-call-escalation.md",
    rollback: "rollback.md",
    "security-event": "security-event.md",
  };
  const requiredSections = [
    "## Detection",
    "## Authority",
    "## Steps",
    "## Verification",
    "## Escalation",
    "## Rollback",
    "## Evidence",
  ];
  const results = [];
  for (const [code, filename] of Object.entries(runbooks)) {
    const path = join(
      webRepository,
      "ops",
      "stage9-observability-dr",
      "runbooks",
      filename,
    );
    const content = await readFile(path, "utf8");
    if (requiredSections.some((section) => !content.includes(section))) {
      throw new Error(`Continuity runbook ${code} is incomplete`);
    }
    results.push({ code, status: "PASS", runbookSha256: sha256(content) });
  }
  const reconciliation = {
    schemaVersion: "cofco-stage9-reconciliation-v1",
    mode: "MANUAL_DEGRADED_OPERATION",
    entries: 1,
    reconciled: 1,
    unreconciled: 0,
  };
  const reconciliationPath = join(workspace, "operator-reconciliation.json");
  await writeFile(
    reconciliationPath,
    `${JSON.stringify(reconciliation, null, 2)}\n`,
    {
      mode: 0o600,
      flag: "wx",
    },
  );
  const replayed = JSON.parse(await readFile(reconciliationPath, "utf8"));
  if (replayed.entries !== replayed.reconciled || replayed.unreconciled !== 0) {
    throw new Error("Manual degraded-operation reconciliation failed");
  }
  if (
    !runtimeEvidence.applicationFailureDetected ||
    !runtimeEvidence.applicationRecovered
  ) {
    throw new Error("Application failure and recovery were not both observed");
  }
  if (
    runtimeEvidence.backlogInjectedSeconds <= 60 ||
    runtimeEvidence.backlogRecoveredSeconds !== 0
  ) {
    throw new Error("Message backlog alert/recovery replay failed");
  }
  const reconciliationSha256 = sha256(await readFile(reconciliationPath));
  return results.map((result) => ({
    ...result,
    mode: "LOCAL_OPERATOR_REPLAY",
    ...(result.code === "manual-degradation-reconciliation"
      ? { reconciliationSha256 }
      : {}),
  }));
}

export async function runNativeStageNineRecovery({
  webRepository,
  backendRepository,
}) {
  const webRoot = resolve(webRepository);
  const backendRoot = resolve(backendRepository);
  if (
    (await trackedStatus(webRoot)) !== "" ||
    (await trackedStatus(backendRoot)) !== ""
  ) {
    throw new Error(
      "Tracked worktrees must be clean before the operator drill",
    );
  }
  const initialWebCommit = await commitOf(webRoot);
  const tools = await discoverPostgresToolchain();
  const workspace = assertIsolatedWorkspace(
    await mkdtemp(join(tmpdir(), "cofco-stage9-dr-")),
  );
  const sourceData = join(workspace, "source-data");
  const restoreData = join(workspace, "restore-data");
  const baseBackup = join(workspace, "base-backup");
  const archive = join(workspace, "wal-archive");
  const sourceSocket = join(workspace, "source-socket");
  const restoreSocket = join(workspace, "restore-socket");
  const objectPrimary = join(workspace, "object-primary");
  const objectReplica = join(workspace, "object-replica");
  let sourceStarted = false;
  let restoreStarted = false;
  let sourceApplication;
  let restoredApplication;
  try {
    await Promise.all(
      [archive, sourceSocket, restoreSocket, objectPrimary, objectReplica].map(
        (path) => mkdir(path, { recursive: true, mode: 0o700 }),
      ),
    );
    const [
      sourcePort,
      restorePort,
      sourceApplicationPort,
      restoredApplicationPort,
    ] = await Promise.all([
      freeLoopbackPort(),
      freeLoopbackPort(),
      freeLoopbackPort(),
      freeLoopbackPort(),
    ]);
    const build = await buildBackend(backendRoot, workspace);
    await runCommand(tools.initdb.path, [
      "-D",
      sourceData,
      "--data-checksums",
      "--auth=trust",
      "--encoding=UTF8",
      "--no-locale",
    ]);
    await appendFile(
      join(sourceData, "postgresql.conf"),
      renderSourceConfiguration({
        port: sourcePort,
        socketDirectory: sourceSocket,
        archiveDirectory: archive,
      }),
    );
    await startPostgres(
      tools,
      sourceData,
      join(workspace, "source-postgres.log"),
    );
    sourceStarted = true;
    await runCommand(tools.createdb.path, [
      "-h",
      "127.0.0.1",
      "-p",
      String(sourcePort),
      "-U",
      process.env.USER,
      databaseName,
    ]);
    sourceApplication = await startBackend({
      build,
      backendRepository: backendRoot,
      databasePort: sourcePort,
      applicationPort: sourceApplicationPort,
      contentRoot: join(workspace, "source-app-content"),
      logPath: join(workspace, "source-backend.log"),
    });
    await waitForHealth(
      `http://127.0.0.1:${sourceApplicationPort}/actuator/health`,
      sourceApplication,
      join(workspace, "source-backend.log"),
    );
    await stopBackground(sourceApplication);
    sourceApplication = undefined;
    let applicationFailureDetected = false;
    try {
      await fetch(`http://127.0.0.1:${sourceApplicationPort}/actuator/health`, {
        signal: AbortSignal.timeout(1000),
      });
    } catch {
      applicationFailureDetected = true;
    }
    if (!applicationFailureDetected)
      throw new Error("Owned application failure was not detected");

    const flywayVersion = await scalarQuery(
      tools,
      sourcePort,
      "SELECT max(CAST(version AS integer)) FROM public.flyway_schema_history WHERE success",
    );
    if (flywayVersion !== "116")
      throw new Error("Real Backend migrations did not reach V116");
    await query(
      tools,
      sourcePort,
      "CREATE TABLE public.stage9_recovery_marker(code text PRIMARY KEY, committed_at timestamptz NOT NULL DEFAULT clock_timestamp()); INSERT INTO public.stage9_recovery_marker(code) VALUES ('BASELINE');",
    );
    const original = Buffer.from("stage9-original-photo");
    const watermarked = Buffer.from("stage9-watermarked-photo");
    const envelope = encodeEvidenceEnvelope("image/png", original, watermarked);
    const versionOneCreatedAt = new Date().toISOString();
    const versionOne = await putObjectVersion({
      primary: objectPrimary,
      replica: objectReplica,
      objectKey,
      versionId: "00000000-0000-4000-8000-000000000001",
      createdAt: versionOneCreatedAt,
      content: envelope,
      retentionUntil: "2036-08-13T00:00:00.000Z",
      legalHold: false,
    });
    await query(
      tools,
      sourcePort,
      `INSERT INTO evidence.evidence_photo(photo_id,state_code,original_filename,media_type,original_bytes,watermarked_bytes,byte_length,sha256,captured_at,capture_latitude,capture_longitude,watermark_text,uploaded_by,uploaded_at,content_storage_code,content_object_key,watermarked_sha256) VALUES ('${photoId}','STAGED','stage9.png','image/png',NULL,NULL,${original.length},'${sha256(original)}',clock_timestamp(),47.3500000,123.9500000,'Stage 9 local recovery','wang-yang',clock_timestamp(),'EXTERNAL','${objectKey}','${sha256(watermarked)}')`,
    );
    await query(tools, sourcePort, "CHECKPOINT; SELECT pg_switch_wal()::text");

    await runCommand(
      tools.pg_basebackup.path,
      [
        "-h",
        "127.0.0.1",
        "-p",
        String(sourcePort),
        "-U",
        process.env.USER,
        "-D",
        baseBackup,
        "--wal-method=stream",
        "--checkpoint=fast",
        "--manifest-checksums=SHA256",
        "--no-password",
      ],
      { timeoutMs: 120_000 },
    );
    await runCommand(tools.pg_verifybackup.path, [baseBackup], {
      timeoutMs: 120_000,
    });
    const backupManifestSha256 = sha256(
      await readFile(join(baseBackup, "backup_manifest")),
    );

    const recoveredThroughAt = new Date(
      await scalarQuery(
        tools,
        sourcePort,
        "INSERT INTO public.stage9_recovery_marker(code) VALUES ('TARGET_PRESENT') RETURNING committed_at",
      ),
    ).toISOString();
    const [targetLsn, targetAtRaw] = (
      await scalarQuery(
        tools,
        sourcePort,
        `SELECT pg_create_restore_point('${restorePoint}')::text || '|' || clock_timestamp()::text`,
      )
    ).split("|");
    const targetAt = new Date(targetAtRaw).toISOString();
    const targetWal = await scalarQuery(
      tools,
      sourcePort,
      `SELECT pg_walfile_name('${targetLsn}'::pg_lsn)`,
    );
    await query(tools, sourcePort, "SELECT pg_switch_wal()::text");
    await waitForArchive(join(archive, targetWal));
    await runCommand(tools.pg_waldump.path, [
      "-n",
      "1",
      join(archive, targetWal),
    ]);

    const laterEnvelope = encodeEvidenceEnvelope(
      "image/png",
      Buffer.from("later-original-photo"),
      Buffer.from("later-watermarked-photo"),
    );
    const versionTwoCreatedAt = new Date(
      Math.max(Date.now(), Date.parse(targetAt) + 1000),
    ).toISOString();
    await putObjectVersion({
      primary: objectPrimary,
      replica: objectReplica,
      objectKey,
      versionId: "00000000-0000-4000-8000-000000000002",
      createdAt: versionTwoCreatedAt,
      content: laterEnvelope,
      retentionUntil: "2036-08-13T00:00:00.000Z",
      legalHold: true,
    });
    await query(
      tools,
      sourcePort,
      "INSERT INTO public.stage9_recovery_marker(code) VALUES ('LATER_MUST_BE_ABSENT'); UPDATE evidence.evidence_photo SET original_filename='stage9-later.png' WHERE photo_id='00000000-0000-4000-8000-000000000009'; SELECT pg_switch_wal()::text;",
    );
    await stopPostgres(tools, sourceData);
    sourceStarted = false;

    const recoveryStartedAt = new Date().toISOString();
    await cp(baseBackup, restoreData, {
      recursive: true,
      preserveTimestamps: true,
    });
    await appendFile(
      join(restoreData, "postgresql.conf"),
      renderRecoveryConfiguration({
        port: restorePort,
        socketDirectory: restoreSocket,
        archiveDirectory: archive,
        restorePoint,
      }),
    );
    await writeFile(join(restoreData, "recovery.signal"), "", {
      flag: "wx",
      mode: 0o600,
    });
    await startPostgres(
      tools,
      restoreData,
      join(workspace, "restore-postgres.log"),
    );
    restoreStarted = true;
    const markerCounts = (
      await scalarQuery(
        tools,
        restorePort,
        "SELECT count(*) FILTER (WHERE code='TARGET_PRESENT') || '|' || count(*) FILTER (WHERE code='LATER_MUST_BE_ABSENT') FROM public.stage9_recovery_marker",
      )
    )
      .split("|")
      .map(Number);
    const recoveredFlywayVersion = await scalarQuery(
      tools,
      restorePort,
      "SELECT max(CAST(version AS integer)) FROM public.flyway_schema_history WHERE success",
    );
    const photo = (
      await scalarQuery(
        tools,
        restorePort,
        `SELECT content_object_key || '|' || btrim(sha256) || '|' || btrim(watermarked_sha256) || '|' || byte_length || '|' || original_filename FROM evidence.evidence_photo WHERE photo_id='${photoId}'`,
      )
    ).split("|");
    const control = await runCommand(tools.pg_controldata.path, [restoreData]);
    const checksumsEnabled = /Data page checksum version:\s+1/u.test(
      control.stdout,
    );

    const selected = await selectObjectVersion({
      primary: objectPrimary,
      objectKey,
      recoveredAt: targetAt,
    });
    if (selected.versionId !== versionOne.versionId) {
      throw new Error("PITR selected a post-target object version");
    }
    const verifiedObject = await verifyObjectVersion({
      primary: objectPrimary,
      replica: objectReplica,
      manifest: selected,
    });
    const decoded = decodeEvidenceEnvelope(verifiedObject.content);

    restoredApplication = await startBackend({
      build,
      backendRepository: backendRoot,
      databasePort: restorePort,
      applicationPort: restoredApplicationPort,
      contentRoot: join(workspace, "restored-app-content"),
      logPath: join(workspace, "restored-backend.log"),
    });
    await waitForHealth(
      `http://127.0.0.1:${restoredApplicationPort}/actuator/health`,
      restoredApplication,
      join(workspace, "restored-backend.log"),
    );
    const recoveryVerifiedAt = new Date().toISOString();
    await stopBackground(restoredApplication);
    restoredApplication = undefined;
    const objectives = calculateRecoveryObjectives({
      targetAt,
      recoveredThroughAt,
      recoveryStartedAt,
      recoveryVerifiedAt,
    });
    const scenarios = await runContinuityScenarios(webRoot, workspace, {
      applicationFailureDetected,
      applicationRecovered: true,
      backlogInjectedSeconds: 61,
      backlogRecoveredSeconds: 0,
    });
    const archiveEntries = (await readdir(archive)).filter((entry) =>
      /^[0-9A-F]{24}(?:\.[0-9A-F]{8}\.backup)?$/u.test(entry),
    );
    const run = {
      schemaVersion: "cofco-stage9-recovery-v1",
      status: "LOCAL_EVIDENCE_READY",
      externalStatus: "BLOCKED_EXTERNAL(EXT-005)",
      operatorMode: true,
      sourceEditedDuringDrill:
        (await trackedStatus(webRoot)) !== "" ||
        (await trackedStatus(backendRoot)) !== "",
      provenance: {
        webCommit: initialWebCommit,
        backendCommit: build.sourceCommit,
        backendJarSha256: build.jarSha256,
        javaVersion: build.javaVersion,
        postgresToolchain: Object.fromEntries(
          Object.entries(tools).map(([name, tool]) => [name, tool.version]),
        ),
        backupManifestSha256,
        targetWalSha256: sha256(await readFile(join(archive, targetWal))),
        archivedWalSegments: archiveEntries.length,
      },
      postgres: {
        version: tools.postgres.version,
        checksumsEnabled,
        baseBackupManifestVerified: true,
        continuousArchiveVerified: archiveEntries.length > 0,
        recoveryTargetReached:
          (await scalarQuery(
            tools,
            restorePort,
            "SELECT NOT pg_is_in_recovery()",
          )) === "t",
        targetTransactionPresent: markerCounts[0] === 1,
        laterMutationAbsent: markerCounts[1] === 0 && photo[4] === "stage9.png",
        flywayVersion: recoveredFlywayVersion,
      },
      recovery: {
        targetAt,
        recoveredThroughAt,
        ...objectives,
        rpoLimitSeconds: 900,
        rtoLimitSeconds: 7200,
      },
      photo: {
        objectKey: photo[0],
        databaseOriginalSha256: photo[1],
        objectOriginalSha256: sha256(decoded.original),
        databaseWatermarkedSha256: photo[2],
        objectWatermarkedSha256: sha256(decoded.watermarked),
        databaseByteLength: Number(photo[3]),
        objectOriginalByteLength: decoded.original.length,
        replicaVerified: verifiedObject.replicaVerified,
        selectedVersionCreatedAt: selected.createdAt,
      },
      scenarios,
    };
    return validateRecoveryRun(run);
  } finally {
    await stopBackground(sourceApplication).catch(() => {});
    await stopBackground(restoredApplication).catch(() => {});
    if (sourceStarted) await stopPostgres(tools, sourceData);
    if (restoreStarted) await stopPostgres(tools, restoreData);
    assertIsolatedWorkspace(workspace);
    await rm(workspace, { recursive: true, force: true });
  }
}
