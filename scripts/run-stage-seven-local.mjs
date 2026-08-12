import { execFile, spawn } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { availableParallelism, tmpdir, totalmem } from "node:os";
import { basename, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";

import {
  evaluateScenario,
  percentile,
  renderEvidence,
  validateProfile,
} from "./stage-seven-core.mjs";
import {
  buildWeightedSchedule,
  runHttpLoad,
  scaleProfiles,
} from "./stage-seven-load.mjs";
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

const execFileAsync = promisify(execFile);
const webDirectory = resolve(import.meta.dirname, "..");
const backendDirectory =
  process.env.STAGE7_BACKEND_DIR ??
  resolve(webDirectory, "../cofco-qiqihar-enterprise-backend");
const frontendDirectory =
  process.env.STAGE7_FRONTEND_DIR ??
  resolve(webDirectory, "../cofco-qiqihar-enterprise-frontend");
const jarPath = resolve(
  backendDirectory,
  "target/grain-trade-enterprise-backend-0.0.1-SNAPSHOT.jar",
);
const seedPath = resolve(webDirectory, "e2e/live/seed-identities.sql");
const builtIndexPath = resolve(webDirectory, "dist/index.html");
const profilePath = resolve(
  webDirectory,
  "ops/stage7-performance-resilience/profile.json",
);
const javaHome = process.env.JAVA_HOME ?? "/opt/homebrew/opt/openjdk@21";
const databaseUser = process.env.QIQIHAR_STAGE7_DB_USERNAME ?? process.env.USER;
const databasePassword = process.env.QIQIHAR_STAGE7_DB_PASSWORD ?? "";
const databaseName = assertIsolatedDatabaseName(
  `qiqihar_stage7_${randomBytes(6).toString("hex")}`,
);
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const pngHex = png.toString("hex");
const pngSha256 = createHash("sha256").update(png).digest("hex");
const csvHeader =
  "productCode,objectTypeCode,regionCode,cultivarCode,surveyDate,cultivatedAreaMu," +
  "yieldPerMuKilograms,PROD_REPORTER_NAME,PROD_REPORTER_PHONE,PROD_SAMPLE_CONTACT," +
  "PROD_SAMPLE_LATITUDE,PROD_SAMPLE_LONGITUDE,evidencePhotoId\n";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

const outputDirectory = argument("--output");
const smoke = process.argv.includes("--smoke");
if (!outputDirectory) throw new Error("--output is required");
if (!databaseUser)
  throw new Error("A Stage 7 PostgreSQL database user is required");

const runtimeDirectory = await mkdtemp(join(tmpdir(), "cofco-stage7-"));
const contentRoot = join(runtimeDirectory, "private-content");
const displacedContentRoot = join(
  runtimeDirectory,
  "private-content-displaced",
);
const backendLogPath = join(runtimeDirectory, "backend.log");
const previewLogPath = join(runtimeDirectory, "preview.log");
const port =
  64000 + (Number.parseInt(randomBytes(2).toString("hex"), 16) % 1000);
const previewPort =
  62000 + (Number.parseInt(randomBytes(2).toString("hex"), 16) % 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const previewUrl = `http://127.0.0.1:${previewPort}`;
const processEnvironment = {
  ...process.env,
  JAVA_HOME: javaHome,
  PATH: `${javaHome}/bin:${process.env.PATH ?? ""}`,
  PGPASSWORD: databasePassword,
};

let backend;
let backendLog;
let preview;
let previewLog;
let databaseCreated = false;
let sampling = false;
let samplePromise;
const resourceSamples = [];
let maximumDatabaseConnections = 1;
let runStartedAt = performance.now();
let runStartedWallClock;

function progress(message) {
  process.stdout.write(`[stage7-local] ${message}\n`);
}

async function command(commandName, args, options = {}) {
  try {
    return await execFileAsync(commandName, args, {
      cwd: options.cwd,
      env: processEnvironment,
      maxBuffer: 100 * 1024 * 1024,
    });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? error.code
        : "unknown";
    throw new Error(`${basename(commandName)} failed with exit ${code}`, {
      cause: error,
    });
  }
}

async function psql(sql, database = databaseName) {
  const result = await command("psql", [
    "--username",
    databaseUser,
    "--dbname",
    database,
    "--tuples-only",
    "--no-align",
    "--set",
    "ON_ERROR_STOP=1",
    "--command",
    sql,
  ]);
  return result.stdout.trim();
}

async function gitCommit(directory) {
  return (
    await command("git", ["rev-parse", "HEAD"], { cwd: directory })
  ).stdout.trim();
}

async function gitClean(directory) {
  return (
    (
      await command("git", ["status", "--short"], { cwd: directory })
    ).stdout.trim() === ""
  );
}

async function waitForHealth(timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = 0;
  while (Date.now() < deadline) {
    if (backend && backend.exitCode !== null) {
      throw new Error(
        `Backend exited before health readiness (${backend.exitCode})`,
      );
    }
    try {
      const response = await fetch(`${baseUrl}/actuator/health`);
      lastStatus = response.status;
      if (response.ok) return;
    } catch {
      lastStatus = 0;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`Backend health did not recover; last status ${lastStatus}`);
}

async function startBackend() {
  backendLog = createWriteStream(backendLogPath, { flags: "a" });
  await waitForWritableOpen(backendLog);
  backend = spawn(`${javaHome}/bin/java`, ["-jar", jarPath], {
    cwd: backendDirectory,
    env: {
      ...processEnvironment,
      SPRING_PROFILES_ACTIVE: "local",
      QIQIHAR_DB_URL: `jdbc:postgresql://127.0.0.1:5432/${databaseName}`,
      QIQIHAR_DB_USERNAME: databaseUser,
      QIQIHAR_DB_PASSWORD: databasePassword,
      QIQIHAR_FLYWAY_USERNAME: databaseUser,
      QIQIHAR_FLYWAY_PASSWORD: databasePassword,
      QIQIHAR_EVENT_CONSUMER_REGISTRAR_DB_URL: `jdbc:postgresql://127.0.0.1:5432/${databaseName}`,
      QIQIHAR_EVENT_CONSUMER_REGISTRAR_DB_USERNAME: databaseUser,
      QIQIHAR_EVENT_CONSUMER_REGISTRAR_DB_PASSWORD: databasePassword,
      QIQIHAR_SERVER_PORT: String(port),
      QIQIHAR_SESSION_COOKIE_SECURE: "false",
      QIQIHAR_EVIDENCE_CONTENT_MODE: "filesystem",
      QIQIHAR_EVIDENCE_FILESYSTEM_ROOT: contentRoot,
      QIQIHAR_IMPORT_QUEUE_CONCURRENCY: "2",
      QIQIHAR_IMPORT_QUEUE_POLL_DELAY: "50ms",
    },
    stdio: ["ignore", backendLog, backendLog],
  });
  await waitForHealth();
}

async function stopBackend() {
  try {
    if (backend && backend.exitCode === null && backend.signalCode === null) {
      const exited = new Promise((resolvePromise) =>
        backend.once("exit", resolvePromise),
      );
      backend.kill("SIGTERM");
      const result = await Promise.race([
        exited.then(() => true),
        new Promise((resolvePromise) =>
          setTimeout(() => resolvePromise(false), 30_000),
        ),
      ]);
      if (!result) throw new Error("Backend did not stop within 30 seconds");
    }
  } finally {
    if (backendLog && !backendLog.closed) {
      await new Promise((resolvePromise, reject) => {
        backendLog.once("error", reject);
        backendLog.end(resolvePromise);
      });
    }
  }
}

async function waitForPreview(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (preview && preview.exitCode !== null) {
      throw new Error(
        `Web preview exited before readiness (${preview.exitCode})`,
      );
    }
    try {
      const response = await fetch(previewUrl);
      if (response.ok) {
        await response.arrayBuffer();
        return;
      }
    } catch {
      // Preview readiness is retried within the bounded deadline.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error("Web preview did not become ready within 30 seconds");
}

async function startPreview() {
  previewLog = createWriteStream(previewLogPath, { flags: "a" });
  await waitForWritableOpen(previewLog);
  preview = spawn(
    resolve(webDirectory, "node_modules/.bin/vite"),
    [
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      String(previewPort),
      "--strictPort",
    ],
    {
      cwd: webDirectory,
      env: { ...processEnvironment, E2E_API_TARGET: baseUrl },
      stdio: ["ignore", previewLog, previewLog],
    },
  );
  await waitForPreview();
}

async function stopPreview() {
  try {
    if (preview && preview.exitCode === null && preview.signalCode === null) {
      const exited = new Promise((resolvePromise) =>
        preview.once("exit", resolvePromise),
      );
      preview.kill("SIGTERM");
      const result = await Promise.race([
        exited.then(() => true),
        new Promise((resolvePromise) =>
          setTimeout(() => resolvePromise(false), 10_000),
        ),
      ]);
      if (!result)
        throw new Error("Web preview did not stop within 10 seconds");
    }
  } finally {
    if (previewLog && !previewLog.closed) {
      await new Promise((resolvePromise, reject) => {
        previewLog.once("error", reject);
        previewLog.end(resolvePromise);
      });
    }
  }
}

async function api(actor, path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("X-Actor", actor);
  if (options.json !== undefined)
    headers.set("content-type", "application/json");
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    body:
      options.json === undefined ? options.body : JSON.stringify(options.json),
  });
}

async function jsonData(response, expectedStatuses) {
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`Unexpected HTTP status ${response.status}`);
  }
  return (await response.json()).data;
}

async function uploadPhoto(marker, actor = "e2e-operator-one") {
  const form = new FormData();
  form.append("file", new Blob([png], { type: "image/png" }), `${marker}.png`);
  form.append("capturedAt", "2026-08-09T12:00:00Z");
  form.append("latitude", "47.3543");
  form.append("longitude", "123.9182");
  form.append("watermarkText", `Stage 7 local ${marker}`);
  return jsonData(
    await api(actor, "/api/v1/evidence-photos", { method: "POST", body: form }),
    [201],
  );
}

function productionDraft(marker, photoId) {
  return {
    productCode: "CORN",
    objectTypeCode: "FARMER",
    regionCode: "230208101001",
    cultivarCode: null,
    surveyDate: "2026-08-09",
    cultivatedAreaMu: "10",
    yieldPerMuKilograms: "500",
    quality: { MOISTURE: "14.2" },
    costs: {},
    insurance: {},
    subsidies: {},
    submissionMetadata: {
      PROD_REPORTER_PHONE: "13800000001",
      PROD_CULTIVAR_NAME: marker,
      PROD_SAMPLE_SUBJECT_CODE: `${marker}-SUBJECT`,
      PROD_SAMPLE_NAME: marker,
      PROD_SAMPLE_CONTACT: "13900000001",
      PROD_SAMPLE_LATITUDE: "47.3543",
      PROD_SAMPLE_LONGITUDE: "123.9182",
      PROD_OPENING_INVENTORY: "2",
      PROD_SALES_VOLUME: "1",
      PROD_SELF_USE: "0",
      PROD_ENDING_INVENTORY: "1",
      PROD_SURPLUS_SUBJECT_CODE: `${marker}-SURPLUS`,
      PROD_SURPLUS_CUTOFF_DATE: "2026-08-09",
    },
    evidencePhotoIds: [photoId],
  };
}

async function createRecord(marker) {
  const photo = await uploadPhoto(`${marker}-photo`);
  return jsonData(
    await api("e2e-operator-one", "/api/v1/production-records", {
      method: "POST",
      json: productionDraft(marker, photo.id),
    }),
    [201],
  );
}

async function loadConsistencySnapshot() {
  return JSON.parse(
    await psql(`
      SELECT json_build_object(
        'productionRecords',(SELECT count(*) FROM production.production_record),
        'evidencePhotos',(SELECT count(*) FROM evidence.evidence_photo)
      )::text
    `),
  );
}

async function approvedReviewCount(recordIds) {
  if (recordIds.length === 0) return 0;
  const identifiers = recordIds.map((id) => `'${id}'`).join(",");
  return Number(
    await psql(`
      SELECT count(*) FROM production.production_record
      WHERE record_id IN (${identifiers}) AND status_code='APPROVED'
    `),
  );
}

async function responseOutcome(response) {
  const body = await response.json();
  return {
    status: response.status,
    code: body?.error?.code ?? null,
    data: body?.data ?? null,
  };
}

async function correctnessState(recordId, actionCode) {
  return JSON.parse(
    await psql(`
      SELECT json_build_object(
        'statusCode',record.status_code,
        'version',record.version,
        'lastModifiedBy',record.last_modified_by,
        'persistedContent',(SELECT metadata.value
          FROM production.production_record_submission_metadata metadata
          WHERE metadata.record_id=record.record_id
            AND metadata.field_code='PROD_CULTIVAR_NAME'),
        'auditEffects',(SELECT count(*) FROM platform.business_audit_event
          WHERE aggregate_type='PRODUCTION_RECORD' AND aggregate_id=record.record_id
            AND action_code='${actionCode}'),
        'eventEffects',(SELECT count(*) FROM platform.business_event_outbox
          WHERE aggregate_type='PRODUCTION_RECORD' AND aggregate_id=record.record_id
            AND action_code='${actionCode}')
      )::text
      FROM production.production_record record
      WHERE record.record_id='${recordId}'
    `),
  );
}

function editRequest(record, marker, actor) {
  return api(actor, `/api/v1/production-records/${record.id}`, {
    method: "PUT",
    json: {
      ...productionDraft(marker, record.evidencePhotos[0].id),
      version: 0,
    },
  });
}

function photoId(sequence) {
  return `70000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

function importCsv(start, rows) {
  let body = csvHeader;
  for (let offset = 0; offset < rows; offset += 1) {
    const sequence = start + offset;
    body += `CORN,FARMER,230208101001,,2026-08-09,10,500,,13800000001,13900000001,47.3543,123.9182,${photoId(sequence)}\n`;
  }
  return body;
}

async function importFile(start, rows, idempotencyKey) {
  const form = new FormData();
  form.append("productCode", "CORN");
  form.append("objectTypeCode", "FARMER");
  form.append(
    "file",
    new Blob([importCsv(start, rows)], { type: "text/csv" }),
    `${idempotencyKey}.csv`,
  );
  return jsonData(
    await api("e2e-operator-one", "/api/v1/imports/production", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: form,
    }),
    [201, 202],
  );
}

async function awaitImport(jobId, timeoutMs = 600_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = await jsonData(
      await api("e2e-operator-one", `/api/v1/imports/production/${jobId}`),
      [200],
    );
    if (["COMPLETED", "FAILED"].includes(job.statusCode)) return job;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`Import ${jobId} did not finish within the local bound`);
}

async function seedImportPhotos(total) {
  await psql(`
    INSERT INTO evidence.evidence_photo(
      photo_id,state_code,original_filename,media_type,original_bytes,watermarked_bytes,
      byte_length,sha256,captured_at,capture_latitude,capture_longitude,watermark_text,
      uploaded_by,uploaded_at,content_storage_code,watermarked_sha256)
    SELECT ('70000000-0000-4000-8000-' || lpad(series::text,12,'0'))::uuid,
      'STAGED','stage7-' || series || '.png','image/png',decode('${pngHex}','hex'),
      decode('${pngHex}','hex'),${png.length},'${pngSha256}',TIMESTAMPTZ '2026-08-09 12:00:00+00',
      47.3543,123.9182,'Stage 7 local import','e2e-operator-one',now(),'DATABASE','${pngSha256}'
    FROM generate_series(1,${total}) series
  `);
}

async function sampleResources() {
  while (sampling) {
    const pid = backend?.pid;
    if (pid) {
      try {
        const [{ stdout: processLine }, connections] = await Promise.all([
          command("ps", ["-o", "%cpu=,rss=", "-p", String(pid)]),
          psql(
            `SELECT count(*) FROM pg_stat_activity WHERE datname='${databaseName}'`,
          ),
        ]);
        const [cpu, rssKb] = processLine.trim().split(/\s+/u).map(Number);
        const logicalCpuCount = availableParallelism();
        const hostBytes = totalmem();
        resourceSamples.push({
          elapsedSeconds: Number(
            ((performance.now() - runStartedAt) / 1000).toFixed(3),
          ),
          rawMultiCoreCpuPercent: Number(cpu.toFixed(2)),
          logicalCpuCount,
          cpuPercent: Number(
            normalizeHostCpuPercent(cpu, logicalCpuCount).toFixed(2),
          ),
          memoryPercent: Number(hostMemoryPercent(rssKb, hostBytes).toFixed(4)),
          databaseConnections: Number(connections),
        });
      } catch {
        // A process restart can race one sample. The next sample remains authoritative.
      }
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000));
  }
}

async function waitForInitialResourceSample(timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (resourceSamples.length > 0) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error("Resource sampling preflight produced no sample");
}

async function executePageMainContent(profile) {
  progress("page SLO: real Chromium main content during peak API load");
  const samplesMs = [];
  const browser = await chromium.launch({ headless: true });
  try {
    for (let index = 0; index < 5; index += 1) {
      const context = await browser.newContext({
        extraHTTPHeaders: { "X-Actor": "e2e-operator-one" },
      });
      try {
        const page = await context.newPage();
        const started = performance.now();
        await page.goto(`${previewUrl}/#/我的工作/待我处理`, {
          waitUntil: "domcontentloaded",
          timeout: profile.slo.pageMainContentMs * 4,
        });
        await page.getByRole("navigation", { name: "业务应用" }).waitFor({
          state: "visible",
          timeout: profile.slo.pageMainContentMs * 4,
        });
        await page.getByRole("table", { name: "本人工作台账" }).waitFor({
          state: "visible",
          timeout: profile.slo.pageMainContentMs * 4,
        });
        samplesMs.push(performance.now() - started);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  const p95Ms = percentile(samplesMs, 0.95);
  return scenario(
    "page-main-content",
    p95Ms <= profile.slo.pageMainContentMs ? "PASS" : "FAIL",
    {
      samplesMs: samplesMs.map((sample) => Number(sample.toFixed(3))),
      p95Ms: Number(p95Ms.toFixed(3)),
      thresholdMs: profile.slo.pageMainContentMs,
      concurrentProfile: "peak",
    },
  );
}

async function executeLoadProfiles(profile, runMarker) {
  const scaled = scaleProfiles(profile);
  const reviewRecords = [];
  for (let index = 0; index < 24; index += 1) {
    const record = await createRecord(`${runMarker}-review-${index}`);
    await jsonData(
      await api(
        "e2e-operator-one",
        `/api/v1/production-records/${record.id}/submit`,
        {
          method: "POST",
          json: { version: 0 },
        },
      ),
      [200],
    );
    reviewRecords.push(record.id);
  }
  let reviewIndex = 0;
  let requestIndex = 0;
  const results = [];
  let pageScenario;
  for (const scenario of scaled) {
    const before = await loadConsistencySnapshot();
    const iterations = scenario.concurrency * scenario.durationSeconds;
    const schedule = buildWeightedSchedule(profile.workloads, iterations);
    progress(
      `load ${scenario.code}: concurrency=${scenario.concurrency}, duration=${scenario.durationSeconds}s, requests=${iterations}`,
    );
    const loadPromise = runHttpLoad({
      baseUrl,
      concurrency: scenario.concurrency,
      iterations,
      schedule,
      requestFor: async (code) => {
        const index = requestIndex++;
        if (code === "read")
          return {
            path: "/api/v1/overview/indicators?productCode=CORN&regionCode=230200&year=2026",
            options: { headers: { "X-Actor": "e2e-operator-one" } },
          };
        if (code === "map")
          return {
            path: "/api/v1/overview/map-scope",
            options: { headers: { "X-Actor": "e2e-operator-one" } },
          };
        if (code === "analysis")
          return {
            path: "/api/v1/overview/dashboard?productCode=CORN&year=2026&regionCode=230200",
            options: { headers: { "X-Actor": "e2e-reporter" } },
          };
        if (code === "supply")
          return {
            path: "/api/v1/supply-accounts?productCode=CORN&regionCode=230200&periodCode=2026-Q3",
            options: { headers: { "X-Actor": "e2e-operator-one" } },
          };
        if (code === "report")
          return {
            path: "/api/v1/reports/parameter-options",
            options: { headers: { "X-Actor": "e2e-reporter" } },
          };
        if (code === "photo") {
          const form = new FormData();
          form.append(
            "file",
            new Blob([png], { type: "image/png" }),
            `${runMarker}-load-photo-${index}.png`,
          );
          form.append("capturedAt", "2026-08-09T12:00:00Z");
          form.append("latitude", "47.3543");
          form.append("longitude", "123.9182");
          form.append("watermarkText", `${runMarker}-load-photo-${index}`);
          return {
            path: "/api/v1/evidence-photos",
            options: {
              method: "POST",
              headers: { "X-Actor": "e2e-operator-one" },
              body: form,
            },
          };
        }
        if (code === "write") {
          const marker = `${runMarker}-load-write-${index}`;
          const photo = await uploadPhoto(`${marker}-photo`);
          return {
            path: "/api/v1/production-records",
            options: {
              method: "POST",
              headers: {
                "X-Actor": "e2e-operator-one",
                "content-type": "application/json",
              },
              body: JSON.stringify(productionDraft(marker, photo.id)),
            },
          };
        }
        if (code === "review") {
          const recordId = reviewRecords[reviewIndex++];
          if (!recordId) throw new Error("Prepared review workload exhausted");
          return {
            path: `/api/v1/production-records/${recordId}/approve`,
            options: {
              method: "POST",
              headers: {
                "X-Actor": "e2e-reviewer",
                "content-type": "application/json",
              },
              body: '{"version":1}',
            },
          };
        }
        if (code === "import") {
          const photo = await uploadPhoto(`${runMarker}-load-import-${index}`);
          const csv =
            csvHeader +
            `CORN,FARMER,230208101001,,2026-08-09,10,500,,13800000001,13900000001,47.3543,123.9182,${photo.id}\n`;
          const form = new FormData();
          form.append("productCode", "CORN");
          form.append("objectTypeCode", "FARMER");
          form.append(
            "file",
            new Blob([csv], { type: "text/csv" }),
            `${runMarker}-${index}.csv`,
          );
          return {
            path: "/api/v1/imports/production",
            options: {
              method: "POST",
              headers: {
                "X-Actor": "e2e-operator-one",
                "Idempotency-Key": `${runMarker}-${index}`,
              },
              body: form,
            },
          };
        }
        throw new Error(`Unsupported workload ${code}`);
      },
    });
    const [result, measuredPageScenario] =
      scenario.code === "peak"
        ? await Promise.all([loadPromise, executePageMainContent(profile)])
        : [await loadPromise, undefined];
    if (measuredPageScenario) pageScenario = measuredPageScenario;
    const after = await loadConsistencySnapshot();
    const consistency = evaluateLoadConsistency({
      before,
      after,
      byWorkload: result.byWorkload,
      approvedReviews: await approvedReviewCount(
        reviewRecords.slice(0, reviewIndex),
      ),
      expectedApprovedReviews: reviewIndex,
    });
    results.push({ ...scenario, ...result, consistency });
  }
  if (!pageScenario)
    throw new Error("Peak page main-content probe did not run");
  return { results, pageScenario };
}

async function executeCorrectnessScenarios(runMarker) {
  progress(
    "correctness: independent duplicate click, retry, concurrent edit, optimistic lock, ownership, single effect, session recovery",
  );

  const conflictCode = "PRODUCTION_RECORD_VERSION_CONFLICT";
  const duplicateRecord = await createRecord(
    `${runMarker}-correctness-duplicate-click`,
  );
  const duplicateOutcomes = await Promise.all(
    [
      api(
        "e2e-operator-one",
        `/api/v1/production-records/${duplicateRecord.id}/submit`,
        { method: "POST", json: { version: 0 } },
      ),
      api(
        "e2e-operator-one",
        `/api/v1/production-records/${duplicateRecord.id}/submit`,
        { method: "POST", json: { version: 0 } },
      ),
    ].map(async (response) => responseOutcome(await response)),
  );
  const duplicateState = await correctnessState(
    duplicateRecord.id,
    "PRODUCTION_RECORD_SUBMITTED",
  );
  const duplicateStatuses = duplicateOutcomes
    .map(({ status }) => status)
    .sort((left, right) => left - right);
  const duplicateConflictCode = duplicateOutcomes.find(
    ({ status }) => status === 409,
  )?.code;
  const duplicatePassed =
    JSON.stringify(duplicateStatuses) === JSON.stringify([200, 409]) &&
    duplicateConflictCode === conflictCode &&
    duplicateState.statusCode === "PENDING_REVIEW" &&
    duplicateState.version === 1 &&
    duplicateState.auditEffects === 1 &&
    duplicateState.eventEffects === 1;

  const retryRecord = await createRecord(
    `${runMarker}-correctness-client-retry`,
  );
  const retryFirst = await responseOutcome(
    await api(
      "e2e-operator-one",
      `/api/v1/production-records/${retryRecord.id}/submit`,
      { method: "POST", json: { version: 0 } },
    ),
  );
  const retrySecond = await responseOutcome(
    await api(
      "e2e-operator-one",
      `/api/v1/production-records/${retryRecord.id}/submit`,
      { method: "POST", json: { version: 0 } },
    ),
  );
  const retryState = await correctnessState(
    retryRecord.id,
    "PRODUCTION_RECORD_SUBMITTED",
  );
  const retryPassed =
    retryFirst.status === 200 &&
    retrySecond.status === 409 &&
    retrySecond.code === conflictCode &&
    retryState.statusCode === "PENDING_REVIEW" &&
    retryState.version === 1 &&
    retryState.auditEffects === 1 &&
    retryState.eventEffects === 1;

  const concurrentEditRecord = await createRecord(
    `${runMarker}-correctness-concurrent-edit`,
  );
  const concurrentProposals = [
    `${runMarker}-concurrent-edit-proposal-one`,
    `${runMarker}-concurrent-edit-proposal-two`,
  ];
  const concurrentActors = ["e2e-operator-one", "e2e-operator-two"];
  const concurrentEditOutcomes = await Promise.all(
    concurrentActors.map(async (actor, index) =>
      responseOutcome(
        await editRequest(
          concurrentEditRecord,
          concurrentProposals[index],
          actor,
        ),
      ),
    ),
  );
  const concurrentEditState = await correctnessState(
    concurrentEditRecord.id,
    "PRODUCTION_RECORD_UPDATED",
  );
  const concurrentWinnerIndex = concurrentProposals.indexOf(
    concurrentEditState.persistedContent,
  );
  const concurrentEditStatuses = concurrentEditOutcomes
    .map(({ status }) => status)
    .sort((left, right) => left - right);
  const concurrentEditConflictCode = concurrentEditOutcomes.find(
    ({ status }) => status === 409,
  )?.code;
  const concurrentEditPassed =
    JSON.stringify(concurrentEditStatuses) === JSON.stringify([200, 409]) &&
    concurrentEditConflictCode === conflictCode &&
    concurrentWinnerIndex >= 0 &&
    concurrentEditState.lastModifiedBy ===
      concurrentActors[concurrentWinnerIndex] &&
    concurrentEditState.version === 1 &&
    concurrentEditState.auditEffects === 1 &&
    concurrentEditState.eventEffects === 1;

  const optimisticRecord = await createRecord(
    `${runMarker}-correctness-optimistic-lock`,
  );
  const optimisticWinner = `${runMarker}-optimistic-lock-winner`;
  const optimisticLoser = `${runMarker}-optimistic-lock-stale`;
  const optimisticFirst = await responseOutcome(
    await editRequest(optimisticRecord, optimisticWinner, "e2e-operator-one"),
  );
  const optimisticSecond = await responseOutcome(
    await editRequest(optimisticRecord, optimisticLoser, "e2e-operator-two"),
  );
  const optimisticState = await correctnessState(
    optimisticRecord.id,
    "PRODUCTION_RECORD_UPDATED",
  );
  const optimisticPassed =
    optimisticFirst.status === 200 &&
    optimisticSecond.status === 409 &&
    optimisticSecond.code === conflictCode &&
    optimisticState.version === 1 &&
    optimisticState.persistedContent === optimisticWinner &&
    optimisticState.lastModifiedBy === "e2e-operator-one" &&
    optimisticState.auditEffects === 1 &&
    optimisticState.eventEffects === 1;

  const ownershipRecord = await createRecord(
    `${runMarker}-correctness-no-silent-overwrite`,
  );
  const ownershipProposals = [
    `${runMarker}-ownership-proposal-one`,
    `${runMarker}-ownership-proposal-two`,
  ];
  const ownershipActors = ["e2e-operator-one", "e2e-operator-two"];
  const ownershipOutcomes = await Promise.all(
    ownershipActors.map(async (actor, index) =>
      responseOutcome(
        await editRequest(ownershipRecord, ownershipProposals[index], actor),
      ),
    ),
  );
  const ownershipState = await correctnessState(
    ownershipRecord.id,
    "PRODUCTION_RECORD_UPDATED",
  );
  const ownershipWinnerIndex = ownershipProposals.indexOf(
    ownershipState.persistedContent,
  );
  const ownershipLoserIndex = ownershipWinnerIndex === 0 ? 1 : 0;
  const ownershipStatuses = ownershipOutcomes
    .map(({ status }) => status)
    .sort((left, right) => left - right);
  const ownershipConflictCode = ownershipOutcomes.find(
    ({ status }) => status === 409,
  )?.code;
  const ownershipPassed =
    JSON.stringify(ownershipStatuses) === JSON.stringify([200, 409]) &&
    ownershipConflictCode === conflictCode &&
    ownershipWinnerIndex >= 0 &&
    ownershipState.lastModifiedBy === ownershipActors[ownershipWinnerIndex] &&
    ownershipState.persistedContent !==
      ownershipProposals[ownershipLoserIndex] &&
    ownershipState.auditEffects === 1 &&
    ownershipState.eventEffects === 1;

  const singleEffectRecord = await createRecord(
    `${runMarker}-correctness-single-business-effect`,
  );
  const singleEffectOutcomes = await Promise.all(
    [
      api(
        "e2e-operator-one",
        `/api/v1/production-records/${singleEffectRecord.id}/submit`,
        { method: "POST", json: { version: 0 } },
      ),
      api(
        "e2e-operator-one",
        `/api/v1/production-records/${singleEffectRecord.id}/submit`,
        { method: "POST", json: { version: 0 } },
      ),
    ].map(async (response) => responseOutcome(await response)),
  );
  const singleEffectState = await correctnessState(
    singleEffectRecord.id,
    "PRODUCTION_RECORD_SUBMITTED",
  );
  const singleEffectStatuses = singleEffectOutcomes
    .map(({ status }) => status)
    .sort((left, right) => left - right);
  const singleEffectConflictCode = singleEffectOutcomes.find(
    ({ status }) => status === 409,
  )?.code;
  const singleEffectPassed =
    JSON.stringify(singleEffectStatuses) === JSON.stringify([200, 409]) &&
    singleEffectConflictCode === conflictCode &&
    singleEffectState.auditEffects === 1 &&
    singleEffectState.eventEffects === 1;

  const recoveryPhoto = await uploadPhoto(
    `${runMarker}-session-recovery-photo`,
  );
  const recoveryDraft = productionDraft(
    `${runMarker}-session-recovery`,
    recoveryPhoto.id,
  );
  const expired = await fetch(`${baseUrl}/api/v1/production-records`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(recoveryDraft),
  });
  await expired.arrayBuffer();
  const recovered = await jsonData(
    await api("e2e-operator-one", "/api/v1/production-records", {
      method: "POST",
      json: recoveryDraft,
    }),
    [201],
  );
  const recoveredCount = Number(
    await psql(
      `SELECT count(*) FROM production.production_record WHERE record_id='${recovered.id}'`,
    ),
  );
  const sessionPassed = expired.status === 401 && recoveredCount === 1;
  return [
    scenario("duplicate-click-idempotency", duplicatePassed ? "PASS" : "FAIL", {
      recordId: duplicateRecord.id,
      actor: "e2e-operator-one",
      execution: "CONCURRENT_DUPLICATE_CLICK",
      observedStatuses: duplicateStatuses,
      conflictCode: duplicateConflictCode,
      ...duplicateState,
    }),
    scenario("client-retry-idempotency", retryPassed ? "PASS" : "FAIL", {
      recordId: retryRecord.id,
      actor: "e2e-operator-one",
      execution: "SEQUENTIAL_CLIENT_RETRY",
      observedStatuses: [retryFirst.status, retrySecond.status],
      conflictCode: retrySecond.code,
      ...retryState,
    }),
    scenario("concurrent-edit", concurrentEditPassed ? "PASS" : "FAIL", {
      recordId: concurrentEditRecord.id,
      actors: concurrentActors,
      execution: "CONCURRENT_DISTINCT_CONTENT",
      proposedContents: concurrentProposals,
      persistedContent: concurrentEditState.persistedContent,
      winningActor: concurrentEditState.lastModifiedBy,
      observedStatuses: concurrentEditStatuses,
      conflictCode: concurrentEditConflictCode,
      version: concurrentEditState.version,
      auditEffects: concurrentEditState.auditEffects,
      eventEffects: concurrentEditState.eventEffects,
    }),
    scenario("optimistic-lock", optimisticPassed ? "PASS" : "FAIL", {
      recordId: optimisticRecord.id,
      actors: ["e2e-operator-one", "e2e-operator-two"],
      execution: "SEQUENTIAL_STALE_VERSION",
      expectedVersion: 0,
      persistedVersion: optimisticState.version,
      persistedContent: optimisticState.persistedContent,
      winningActor: optimisticState.lastModifiedBy,
      observedStatuses: [optimisticFirst.status, optimisticSecond.status],
      conflictCode: optimisticSecond.code,
      auditEffects: optimisticState.auditEffects,
      eventEffects: optimisticState.eventEffects,
    }),
    scenario("no-silent-overwrite", ownershipPassed ? "PASS" : "FAIL", {
      recordId: ownershipRecord.id,
      actors: ownershipActors,
      execution: "CONCURRENT_DISTINCT_CONTENT_OWNERSHIP",
      winningContent: ownershipProposals[ownershipWinnerIndex],
      losingContent: ownershipProposals[ownershipLoserIndex],
      persistedContent: ownershipState.persistedContent,
      winningActor: ownershipState.lastModifiedBy,
      observedStatuses: ownershipStatuses,
      conflictCode: ownershipConflictCode,
      auditEffects: ownershipState.auditEffects,
      eventEffects: ownershipState.eventEffects,
    }),
    scenario(
      "no-duplicate-business-effect",
      singleEffectPassed ? "PASS" : "FAIL",
      {
        recordId: singleEffectRecord.id,
        actor: "e2e-operator-one",
        execution: "CONCURRENT_SINGLE_EFFECT",
        actionCode: "PRODUCTION_RECORD_SUBMITTED",
        observedStatuses: singleEffectStatuses,
        conflictCode: singleEffectConflictCode,
        auditEffects: singleEffectState.auditEffects,
        eventEffects: singleEffectState.eventEffects,
      },
    ),
    scenario("session-expiry-draft-recovery", sessionPassed ? "PASS" : "FAIL", {
      expiredStatus: expired.status,
      recoveredRecords: recoveredCount,
    }),
  ];
}

async function executeImportBoundary(runMarker) {
  const syncRows = smoke ? 20 : 5000;
  const asyncRows = smoke ? 21 : 5001;
  const total = syncRows + asyncRows * 2;
  progress(`seeding ${total} isolated import evidence rows`);
  await seedImportPhotos(total);
  progress(`sync import boundary: ${syncRows} rows`);
  const syncStarted = performance.now();
  const sync = await importFile(1, syncRows, `${runMarker}-sync-${syncRows}`);
  const syncSeconds = (performance.now() - syncStarted) / 1000;
  if (
    sync.statusCode !== "COMPLETED" ||
    sync.importedRows !== syncRows ||
    sync.failedRows !== 0
  ) {
    throw new Error(
      "Synchronous import boundary did not complete consistently",
    );
  }
  progress(`concurrent async import boundary: 2 x ${asyncRows} rows`);
  const asyncStarted = performance.now();
  const firstStart = syncRows + 1;
  const [queuedOne, queuedTwo] = await Promise.all([
    importFile(firstStart, asyncRows, `${runMarker}-async-one-${asyncRows}`),
    importFile(
      firstStart + asyncRows,
      asyncRows,
      `${runMarker}-async-two-${asyncRows}`,
    ),
  ]);
  if (
    !smoke &&
    [queuedOne.statusCode, queuedTwo.statusCode].some(
      (status) => status !== "QUEUED",
    )
  ) {
    throw new Error(
      "The 5001-row boundary was not routed to the durable queue",
    );
  }
  const [asyncOne, asyncTwo] = await Promise.all([
    awaitImport(queuedOne.id),
    awaitImport(queuedTwo.id),
  ]);
  const asyncSeconds = (performance.now() - asyncStarted) / 1000;
  for (const job of [asyncOne, asyncTwo]) {
    if (
      job.statusCode !== "COMPLETED" ||
      job.importedRows !== asyncRows ||
      job.failedRows !== 0
    ) {
      throw new Error(
        "Concurrent asynchronous import did not complete consistently",
      );
    }
  }
  const queueBacklog = JSON.parse(
    await psql(`
      SELECT json_build_object(
        'pendingCount',count(*),
        'oldestBacklogSeconds',COALESCE(
          EXTRACT(EPOCH FROM now()-min(created_at)),0)
      )::text
      FROM platform.import_job
      WHERE status_code IN ('QUEUED','PROCESSING')
    `),
  );
  return {
    syncRows,
    asyncRowsPerJob: asyncRows,
    concurrentAsyncJobs: 2,
    syncSeconds: Number(syncSeconds.toFixed(3)),
    asyncSeconds: Number(asyncSeconds.toFixed(3)),
    pendingAfterRecovery: queueBacklog.pendingCount,
    oldestBacklogSecondsAfterRecovery: Number(
      Number(queueBacklog.oldestBacklogSeconds).toFixed(3),
    ),
  };
}

async function executeDatabaseFaults() {
  progress(
    "database faults: slow query, lock wait, deadlock victim, long transaction, connection pressure",
  );
  await psql(
    "CREATE TABLE platform.stage7_fault_probe(id integer PRIMARY KEY,value integer NOT NULL); INSERT INTO platform.stage7_fault_probe VALUES(1,0),(2,0)",
  );
  const slowStarted = performance.now();
  await psql("SELECT pg_sleep(0.25)");
  const slowQuerySeconds = (performance.now() - slowStarted) / 1000;

  const holder = psql(
    "BEGIN; UPDATE platform.stage7_fault_probe SET value=value+1 WHERE id=1; SELECT pg_sleep(0.7); COMMIT",
  );
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  const lockStarted = performance.now();
  await psql("UPDATE platform.stage7_fault_probe SET value=value+1 WHERE id=1");
  const lockWaitSeconds = (performance.now() - lockStarted) / 1000;
  await holder;

  const deadlock = await Promise.allSettled([
    psql(
      "BEGIN; UPDATE platform.stage7_fault_probe SET value=value+1 WHERE id=1; SELECT pg_sleep(0.25); UPDATE platform.stage7_fault_probe SET value=value+1 WHERE id=2; COMMIT",
    ),
    psql(
      "BEGIN; UPDATE platform.stage7_fault_probe SET value=value+1 WHERE id=2; SELECT pg_sleep(0.25); UPDATE platform.stage7_fault_probe SET value=value+1 WHERE id=1; COMMIT",
    ),
  ]);
  const deadlockVictims = deadlock.filter(
    ({ status }) => status === "rejected",
  ).length;
  if (deadlockVictims !== 1)
    throw new Error(
      `Expected one deadlock victim, observed ${deadlockVictims}`,
    );

  const longStarted = performance.now();
  await psql("BEGIN; SELECT pg_sleep(0.5); COMMIT");
  const longTransactionSeconds = (performance.now() - longStarted) / 1000;

  const pressure = Array.from({ length: 8 }, () =>
    psql("SELECT pg_sleep(0.8)"),
  );
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 150));
  const pressuredConnections = Number(
    await psql(
      `SELECT count(*) FROM pg_stat_activity WHERE datname='${databaseName}'`,
    ),
  );
  maximumDatabaseConnections = Number(
    await psql("SELECT current_setting('max_connections')"),
  );
  const pressureRead = await api(
    "e2e-operator-one",
    "/api/v1/overview/indicators?productCode=CORN&regionCode=230200&year=2026",
  );
  if (!pressureRead.ok)
    throw new Error(`Connection pressure read returned ${pressureRead.status}`);
  await pressureRead.arrayBuffer();
  await Promise.all(pressure);
  await waitForHealth();
  return {
    slowQuerySeconds: Number(slowQuerySeconds.toFixed(3)),
    lockWaitSeconds: Number(lockWaitSeconds.toFixed(3)),
    deadlockVictims,
    longTransactionSeconds: Number(longTransactionSeconds.toFixed(3)),
    pressuredConnections,
  };
}

async function executeApplicationRestart() {
  progress("fault: application restart");
  const started = performance.now();
  await stopBackend();
  await startBackend();
  return Number(((performance.now() - started) / 1000).toFixed(3));
}

async function executeDatabaseInterruption() {
  progress("fault: isolated database connection interruption");
  await psql(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${databaseName}' AND pid<>pg_backend_pid()`,
  );
  const started = performance.now();
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await api(
        "e2e-operator-one",
        "/api/v1/overview/indicators?productCode=CORN&regionCode=230200&year=2026",
      );
      if (response.ok) {
        await response.arrayBuffer();
        return Number(((performance.now() - started) / 1000).toFixed(3));
      }
    } catch {
      // Recovery is measured until a database-backed request succeeds.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error("Database-backed request did not recover within 120 seconds");
}

async function executeEventReconnect() {
  progress("fault: event publisher reconnect with cursor");
  const firstController = new AbortController();
  const first = await api(
    "e2e-operator-one",
    "/api/v1/business-events/stream?after=0",
    {
      signal: firstController.signal,
    },
  );
  if (!first.ok || !first.body)
    throw new Error(`Initial event stream returned ${first.status}`);
  const reader = first.body.getReader();
  let text = "";
  const deadline = Date.now() + 30_000;
  while (!/^id:\s*(\d+)/mu.test(text) && Date.now() < deadline) {
    const chunk = await Promise.race([
      reader.read(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Event stream cursor timed out")),
          30_000,
        ),
      ),
    ]);
    if (chunk.done) break;
    text += new TextDecoder().decode(chunk.value);
  }
  const cursor = text.match(/^id:\s*(\d+)/mu)?.[1];
  firstController.abort();
  if (!cursor)
    throw new Error("Event stream did not expose a resumable cursor");
  const started = performance.now();
  const secondController = new AbortController();
  const second = await api(
    "e2e-operator-one",
    "/api/v1/business-events/stream",
    {
      headers: { "Last-Event-ID": cursor },
      signal: secondController.signal,
    },
  );
  if (!second.ok)
    throw new Error(`Resumed event stream returned ${second.status}`);
  secondController.abort();
  return {
    recoverySeconds: Number(((performance.now() - started) / 1000).toFixed(3)),
    cursorObserved: true,
  };
}

async function executeContentStoreFault(photoIdValue) {
  progress("fault: private content store interruption");
  const before = await api(
    "e2e-operator-one",
    `/api/v1/evidence-photos/${photoIdValue}/content`,
  );
  if (!before.ok)
    throw new Error(`Private content precondition returned ${before.status}`);
  await before.arrayBuffer();
  await rename(contentRoot, displacedContentRoot);
  let failureStatus;
  const started = performance.now();
  try {
    await writeFile(contentRoot, "stage7-local-controlled-fault\n", {
      flag: "wx",
    });
    const unavailable = await api(
      "e2e-operator-one",
      `/api/v1/evidence-photos/${photoIdValue}/content`,
    );
    failureStatus = unavailable.status;
    await unavailable.arrayBuffer();
    if (failureStatus !== 503)
      throw new Error(`Private content fault returned ${failureStatus}`);
  } finally {
    await runCleanupSteps([
      async () => {
        try {
          await unlink(contentRoot);
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
        }
      },
      async () => rename(displacedContentRoot, contentRoot),
    ]);
  }
  const recovered = await api(
    "e2e-operator-one",
    `/api/v1/evidence-photos/${photoIdValue}/content`,
  );
  if (!recovered.ok)
    throw new Error(`Private content recovery returned ${recovered.status}`);
  await recovered.arrayBuffer();
  return {
    failureStatus,
    recoverySeconds: Number(((performance.now() - started) / 1000).toFixed(3)),
  };
}

function scenario(code, status, details = {}) {
  return { code, status, ...details };
}

async function main() {
  await Promise.all([
    access(jarPath),
    access(seedPath),
    access(builtIndexPath),
    mkdir(contentRoot),
  ]);
  const profileSource = await readFile(profilePath, "utf8");
  const profile = validateProfile(JSON.parse(profileSource));
  const profileSha256 = createHash("sha256")
    .update(profileSource)
    .digest("hex");
  const runMarker = `stage7-${randomBytes(4).toString("hex")}`;
  progress(
    `provenance=LOCAL_PROPORTIONAL_ONLY database=${databaseName} port=${port}`,
  );
  await command("createdb", ["--username", databaseUser, databaseName]);
  databaseCreated = true;
  await startBackend();
  await startPreview();
  await command("psql", [
    "--username",
    databaseUser,
    "--dbname",
    databaseName,
    "--set",
    "ON_ERROR_STOP=1",
    "--file",
    seedPath,
  ]);
  const contentFaultPhoto = await uploadPhoto(`${runMarker}-content-fault`);
  runStartedAt = performance.now();
  runStartedWallClock = new Date().toISOString();
  sampling = true;
  samplePromise = sampleResources();
  await waitForInitialResourceSample();

  const loadExecution = await executeLoadProfiles(profile, runMarker);
  const rawLoad = loadExecution.results;
  const correctnessScenarios = await executeCorrectnessScenarios(runMarker);
  const importBoundary = await executeImportBoundary(runMarker);
  const databaseFaults = await executeDatabaseFaults();
  const applicationRecoverySeconds = await executeApplicationRestart();
  const databaseRecoverySeconds = await executeDatabaseInterruption();
  const eventReconnect = await executeEventReconnect();
  const contentStore = await executeContentStoreFault(contentFaultPhoto.id);

  sampling = false;
  await samplePromise;
  const resourceTrend = summarizeResourceTrend(resourceSamples);
  const connectionPercent =
    (resourceTrend.maximumDatabaseConnections / maximumDatabaseConnections) *
    100;
  const scenarios = rawLoad.map((item) => {
    const evaluated = evaluateScenario(
      {
        attempts: item.attempts,
        unexpectedErrors: item.unexpectedErrors,
        latenciesMs: item.latenciesMs,
        successfulWrites: item.consistency.successfulWrites,
        consistentWrites: item.consistency.consistentWrites,
        maximumCpuPercent: resourceTrend.maximumCpuPercent,
        maximumMemoryPercent: resourceTrend.maximumMemoryPercent,
        maximumDatabaseConnectionPercent: connectionPercent,
      },
      profile,
    );
    return scenario(item.code, evaluated.status, {
      concurrency: item.concurrency,
      durationSeconds: item.durationSeconds,
      attempts: item.attempts,
      unexpectedErrors: item.unexpectedErrors,
      p95Ms: Number(evaluated.p95Ms.toFixed(3)),
      p50Ms: Number(percentile(item.latenciesMs, 0.5).toFixed(3)),
      p99Ms: Number(percentile(item.latenciesMs, 0.99).toFixed(3)),
      throughputPerSecond: Number(
        (item.attempts / item.durationSeconds).toFixed(3),
      ),
      consistencyRate: evaluated.consistencyRate,
      consistencyChecks: item.consistency.checks,
      failedGates: evaluated.failedGates,
      byWorkload: item.byWorkload,
    });
  });
  const allRecoveries = [
    applicationRecoverySeconds,
    databaseRecoverySeconds,
    eventReconnect.recoverySeconds,
    contentStore.recoverySeconds,
  ];
  scenarios.push(
    loadExecution.pageScenario,
    scenario(
      smoke ? "sync-import-smoke" : "sync-import-5000",
      "PASS",
      importBoundary,
    ),
    scenario(
      smoke ? "async-import-smoke" : "async-import-5001-concurrent",
      "PASS",
      importBoundary,
    ),
    ...correctnessScenarios,
    scenario("slow-query", "PASS", {
      durationSeconds: databaseFaults.slowQuerySeconds,
    }),
    scenario("connection-pool-pressure", "PASS", {
      observedConnections: databaseFaults.pressuredConnections,
    }),
    scenario("lock-wait", "PASS", {
      durationSeconds: databaseFaults.lockWaitSeconds,
    }),
    scenario("deadlock-victim-recovery", "PASS", {
      victims: databaseFaults.deadlockVictims,
    }),
    scenario("long-transaction", "PASS", {
      durationSeconds: databaseFaults.longTransactionSeconds,
    }),
    scenario(
      "queue-backlog-recovery",
      importBoundary.pendingAfterRecovery === 0 &&
        importBoundary.oldestBacklogSecondsAfterRecovery <=
          profile.resourceExpansion.oldestBacklogSecondsAfterRecovery
        ? "PASS"
        : "FAIL",
      {
        pendingAfterRecovery: importBoundary.pendingAfterRecovery,
        oldestBacklogSecondsAfterRecovery:
          importBoundary.oldestBacklogSecondsAfterRecovery,
      },
    ),
    scenario(
      "application-restart",
      applicationRecoverySeconds <= 120 ? "PASS" : "FAIL",
      {
        recoverySeconds: applicationRecoverySeconds,
      },
    ),
    scenario(
      "database-interruption",
      databaseRecoverySeconds <= 120 ? "PASS" : "FAIL",
      {
        recoverySeconds: databaseRecoverySeconds,
      },
    ),
    scenario(
      "event-publisher-reconnect-cursor",
      eventReconnect.recoverySeconds <= 120 ? "PASS" : "FAIL",
      eventReconnect,
    ),
    scenario(
      "private-content-store-interruption",
      contentStore.recoverySeconds <= 120 ? "PASS" : "FAIL",
      contentStore,
    ),
  );
  const candidates = {
    backend: await gitCommit(backendDirectory),
    frontend: await gitCommit(frontendDirectory),
    web: await gitCommit(webDirectory),
  };
  const candidateClean = {
    backend: await gitClean(backendDirectory),
    frontend: await gitClean(frontendDirectory),
    web: await gitClean(webDirectory),
  };
  const rawRun = assertSecretFree({
    runId: runMarker,
    profileSha256,
    startedAt: runStartedWallClock,
    completedAt: new Date().toISOString(),
    durationSeconds: Number(
      ((performance.now() - runStartedAt) / 1000).toFixed(3),
    ),
    provenance: "LOCAL_PROPORTIONAL_ONLY",
    productionEquivalent: false,
    smoke,
    candidates,
    candidateClean,
    status: scenarios.every(({ status }) => status === "PASS")
      ? "PASS"
      : "FAIL",
    authority: profile.authority,
    slo: profile.slo,
    scaledProfiles: scaleProfiles(profile),
    scenarios,
    importBoundary,
    resourceTrend: {
      ...resourceTrend,
      maximumDatabaseConnectionPercent: Number(connectionPercent.toFixed(3)),
      rawSamples: resourceSamples,
    },
    maximumRecoverySeconds: Math.max(...allRecoveries),
    exclusions: profile.excludedGates,
    externalBlocker: "EXT-005",
  });
  const evidence = renderEvidence(rawRun);
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all(
    Object.entries(evidence).map(([name, body]) =>
      writeFile(resolve(outputDirectory, name), body, { flag: "wx" }),
    ),
  );
  progress(`evidence written: ${resolve(outputDirectory)}`);
  if (scenarios.some(({ status }) => status !== "PASS")) {
    throw new Error("One or more local proportional scenarios failed");
  }
}

let executionFailure;
try {
  await main();
} catch (error) {
  executionFailure = error;
} finally {
  sampling = false;
  if (samplePromise) await samplePromise.catch(() => undefined);
  try {
    await runCleanupSteps([
      async () => stopPreview(),
      async () => stopBackend(),
      async () => {
        if (!databaseCreated) return;
        await command("dropdb", ["--username", databaseUser, databaseName]);
        databaseCreated = false;
        progress(`isolated database removed: ${databaseName}`);
      },
      async () => {
        await removeExactStageSevenRuntimeDirectory(runtimeDirectory);
        progress(`runtime namespace removed: ${runtimeDirectory}`);
      },
    ]);
  } catch (cleanupFailure) {
    executionFailure = executionFailure
      ? new AggregateError(
          [executionFailure, cleanupFailure],
          "Stage 7 execution and cleanup failed",
        )
      : cleanupFailure;
  }
}
if (executionFailure) throw executionFailure;
