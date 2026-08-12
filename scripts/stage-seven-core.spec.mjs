import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  StageSevenAdmissionError,
  admitRun,
  evaluateScenario,
  percentile,
  renderEvidence,
  validateProfile,
} from "./stage-seven-core.mjs";

const profilePath = resolve(
  import.meta.dirname,
  "../ops/stage7-performance-resilience/profile.json",
);
const profile = JSON.parse(await readFile(profilePath, "utf8"));

test("locks the authoritative scale, SLO, resource and scenario coverage", () => {
  const validated = validateProfile(profile);

  assert.deepEqual(validated.authority, {
    registeredEmployees: 1000,
    peakConcurrentEmployees: 300,
    annualBusinessRows: 5000000,
    monthlyPhotoGrowthGb: 100,
    synchronousImportRows: 5000,
    asynchronousImportRows: 5001,
    concurrentImportJobs: 2,
  });
  assert.equal(validated.slo.coreApiP95Ms, 800);
  assert.equal(validated.slo.pageMainContentMs, 3000);
  assert.equal(validated.slo.unexpectedErrorRate, 0.001);
  assert.equal(validated.resourceExpansion.cpuPercent, 70);
  assert.equal(validated.resourceExpansion.memoryPercent, 75);
  assert.equal(validated.resourceExpansion.databaseConnectionPercent, 70);
  assert.deepEqual(validated.workloads.map(({ code }) => code).sort(), [
    "analysis",
    "import",
    "map",
    "photo",
    "read",
    "report",
    "review",
    "supply",
    "write",
  ]);
  assert.deepEqual(
    Object.fromEntries(
      validated.workloads.map(({ code, method, path }) => [
        code,
        `${method} ${path}`,
      ]),
    ),
    {
      read: "GET /api/v1/overview/indicators",
      write: "POST /api/v1/production-records",
      review: "POST /api/v1/production-records/{id}/approve",
      import: "POST /api/v1/imports/production",
      photo: "POST /api/v1/evidence-photos",
      map: "GET /api/v1/overview/map-scope",
      analysis: "GET /api/v1/overview/dashboard",
      supply: "GET /api/v1/supply-accounts",
      report: "GET /api/v1/reports/parameter-options",
    },
  );
  for (const code of [
    "page-main-content",
    "duplicate-click-idempotency",
    "optimistic-lock",
    "session-expiry-draft-recovery",
    "slow-query",
    "connection-pool-pressure",
    "lock-wait",
    "deadlock-victim-recovery",
    "long-transaction",
    "queue-backlog-recovery",
    "application-restart",
    "database-interruption",
    "event-publisher-reconnect-cursor",
    "private-content-store-interruption",
  ]) {
    assert.ok(JSON.stringify(validated).includes(code), code);
  }
  assert.deepEqual(validated.excludedGates, [
    "final-24-hour-stability",
    "stage-8-security-privacy-compliance",
  ]);
});

test("rejects profiles that dilute authoritative thresholds or omit a workload", () => {
  assert.throws(
    () =>
      validateProfile({
        ...profile,
        authority: { ...profile.authority, peakConcurrentEmployees: 299 },
      }),
    /authoritative peakConcurrentEmployees/u,
  );
  assert.throws(
    () =>
      validateProfile({ ...profile, workloads: profile.workloads.slice(1) }),
    /workload coverage/u,
  );
});

test("calculates nearest-rank percentiles and applies every short gate", () => {
  assert.equal(percentile([1, 2, 3, 4, 100], 0.95), 100);
  assert.equal(percentile([8, 2, 4, 6], 0.5), 4);

  const pass = evaluateScenario(
    {
      attempts: 1000,
      unexpectedErrors: 1,
      latenciesMs: Array.from({ length: 100 }, (_, index) => 200 + index),
      successfulWrites: 20,
      consistentWrites: 20,
      recoverySeconds: 30,
      maximumCpuPercent: 60,
      maximumMemoryPercent: 65,
      maximumDatabaseConnectionPercent: 50,
      oldestBacklogSecondsAfterRecovery: 20,
    },
    profile,
  );
  assert.equal(pass.status, "PASS");
  assert.equal(pass.p95Ms, 294);

  const fail = evaluateScenario(
    {
      attempts: 100,
      unexpectedErrors: 1,
      latenciesMs: [801],
      successfulWrites: 2,
      consistentWrites: 1,
      recoverySeconds: 121,
      maximumCpuPercent: 71,
      maximumMemoryPercent: 76,
      maximumDatabaseConnectionPercent: 71,
      oldestBacklogSecondsAfterRecovery: 61,
    },
    profile,
  );
  assert.equal(fail.status, "FAIL");
  assert.deepEqual(fail.failedGates.sort(), [
    "backlog",
    "consistency",
    "cpu",
    "database-connections",
    "error-rate",
    "memory",
    "p95",
    "recovery",
  ]);
});

test("admits local evidence only as proportional and blocks incomplete cloud admission", () => {
  assert.deepEqual(admitRun({ mode: "local" }), {
    mode: "local",
    provenance: "LOCAL_PROPORTIONAL_ONLY",
    productionEquivalent: false,
  });

  assert.throws(
    () => admitRun({ mode: "preproduction", baseUrl: "https://127.0.0.1" }),
    (error) =>
      error instanceof StageSevenAdmissionError &&
      error.exitCode === 2 &&
      error.code === "BLOCKED_EXTERNAL(EXT-005)",
  );
  assert.throws(
    () =>
      admitRun({
        mode: "preproduction",
        baseUrl: "https://preprod.example.test",
        productionEquivalent: true,
        inputs: {},
      }),
    /EXT-005/u,
  );
});

test("the standard preproduction admission entry reports only EXT-005", () => {
  const result = spawnSync(
    process.execPath,
    [
      resolve(import.meta.dirname, "run-stage-seven.mjs"),
      "admit",
      "--mode",
      "preproduction",
      "--config",
      resolve(
        import.meta.dirname,
        "../ops/stage7-performance-resilience/preproduction-admission.json",
      ),
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    "BLOCKED_EXTERNAL(EXT-005): approved HTTPS base URL is missing\n",
  );
});

test("admits exact cloud inputs and renders secret-free four-document evidence", () => {
  const inputs = Object.fromEntries(
    [
      "backendCommit",
      "frontendCommit",
      "webCommit",
      "topologyEvidenceSha256",
      "capacityApprovalSha256",
      "rdsResourceId",
      "ossBucket",
      "ossEndpoint",
      "monitoringEndpoint",
      "faultControlApprovalSha256",
    ].map((key) => [key, "a".repeat(64)]),
  );
  const admission = admitRun({
    mode: "preproduction",
    baseUrl: "https://preprod.example.test",
    productionEquivalent: true,
    inputs,
  });
  assert.equal(admission.provenance, "PREPRODUCTION_EQUIVALENT");

  const requiredScenarioResults = [
    ...profile.performanceScenarios,
    ...profile.correctnessScenarios,
    ...profile.databaseScenarios,
    ...profile.faultScenarios,
  ].map((code) => ({ code, status: "PASS", p95Ms: 200 }));
  const evidence = renderEvidence({
    runId: "stage7-test",
    provenance: "LOCAL_PROPORTIONAL_ONLY",
    status: "PASS",
    candidates: { backend: "abc", frontend: "def", web: "ghi" },
    scenarios: requiredScenarioResults,
    exclusions: profile.excludedGates,
    password: "must-not-appear",
  });
  assert.deepEqual(Object.keys(evidence).sort(), [
    "HANDOFF.md",
    "MATRIX.md",
    "SUMMARY.md",
    "VERIFICATION.md",
    "run.json",
  ]);
  const serialized = Object.values(evidence).join("\n");
  assert.match(serialized, /LOCAL_PROPORTIONAL_ONLY/u);
  assert.match(
    serialized,
    /does not establish production-equivalent performance/iu,
  );
  assert.doesNotMatch(serialized, /must-not-appear|password/iu);
  assert.match(serialized, /final-24-hour-stability/u);

  assert.throws(
    () =>
      renderEvidence({
        runId: "stage7-incomplete",
        provenance: "LOCAL_PROPORTIONAL_ONLY",
        scenarios: [{ code: "baseline", status: "PASS" }],
        exclusions: profile.excludedGates,
      }),
    /dynamic scenario evidence is incomplete/u,
  );
});
