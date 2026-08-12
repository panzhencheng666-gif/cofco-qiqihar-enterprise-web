import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolve } from "node:path";
import test from "node:test";

import {
  StageSevenAdmissionError,
  admitRun,
  buildPreproductionReplayPlan,
  evaluateScenario,
  percentile,
  renderEvidence,
  validateProfile,
} from "./stage-seven-core.mjs";
import {
  verifyEvidenceDirectory,
  writeEvidenceAtomically,
} from "./stage-seven-evidence.mjs";

const profilePath = resolve(
  import.meta.dirname,
  "../ops/stage7-performance-resilience/profile.json",
);
const profile = JSON.parse(await readFile(profilePath, "utf8"));
const profileSha256 = createHash("sha256")
  .update(await readFile(profilePath, "utf8"))
  .digest("hex");
const candidates = {
  backend: "1".repeat(40),
  frontend: "2".repeat(40),
  web: "3".repeat(40),
};
const receiptAuthorityPublicKeySha256 = "e".repeat(64);
const preproductionBinding = {
  candidates,
  profileSha256,
  receiptAuthorityPublicKeySha256,
};

function backendArtifactProvenance() {
  return {
    schemaVersion: "cofco-stage7-backend-artifact-v1",
    sourceCommit: candidates.backend,
    sourceClean: true,
    build: {
      command: ["mvn", "clean", "-DskipTests", "package"],
      outputSha256: "a".repeat(64),
      environment: {
        javaHome: "/opt/homebrew/opt/openjdk@21",
        javaVersion: "openjdk version 21.0.12",
        mavenVersion: "Apache Maven 3.9.11",
        platform: "darwin",
        architecture: "arm64",
      },
    },
    jar: {
      relativePath: "target/grain-trade-enterprise-backend-0.0.1-SNAPSHOT.jar",
      sha256: "b".repeat(64),
      sizeBytes: 1,
      manifestSha256: "c".repeat(64),
      manifest: { "Manifest-Version": "1.0" },
    },
  };
}

function validPreproductionRequest() {
  const regionId = "cn-hangzhou";
  const immutableImage = (name, digestCharacter) =>
    `registry.${regionId}.aliyuncs.com/cofco/${name}@sha256:${digestCharacter.repeat(64)}`;
  return {
    mode: "preproduction",
    baseUrl: "https://stage7-preproduction.example.cn",
    productionEquivalent: true,
    inputs: {
      backendCommit: candidates.backend,
      frontendCommit: candidates.frontend,
      webCommit: candidates.web,
      profileSha256,
      topologyEvidenceSha256: "a".repeat(64),
      capacityApprovalSha256: "b".repeat(64),
      faultControlApprovalSha256: "c".repeat(64),
      receiptAuthorityPublicKeySha256,
      environmentName: "preproduction",
      cloudProvider: "ALIBABA_CLOUD",
      regionId,
      ecsInstanceId: "i-stage7preproduction001",
      vpcId: "vpc-stage7preproduction001",
      vswitchId: "vsw-stage7preproduction001",
      rdsResourceId: "rm-stage7preproduction001",
      ossBucket: "cofco-stage7-private-evidence",
      ossEndpoint: `https://oss-${regionId}-internal.aliyuncs.com`,
      workloadControlEndpoint:
        "https://workload.stage7-preproduction.example.cn",
      monitoringEndpoint: "https://monitoring.stage7-preproduction.example.cn",
      faultControlEndpoint:
        "https://fault-control.stage7-preproduction.example.cn",
      candidateManifestPath: "/api/v1/stage7/candidate-manifest",
      backendImage: immutableImage("backend", "4"),
      businessImage: immutableImage("business", "5"),
      overviewImage: immutableImage("overview", "6"),
      gatewayImage: immutableImage("gateway", "7"),
      prometheusImage: immutableImage("prometheus", "8"),
      blackboxImage: immutableImage("blackbox", "9"),
      alertmanagerImage: immutableImage("alertmanager", "d"),
    },
  };
}

function correctnessDetails(code, index) {
  const recordId = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
  const shared = {
    recordId,
    auditEffects: 1,
    eventEffects: 1,
  };
  if (code === "duplicate-click-idempotency") {
    return {
      ...shared,
      actor: "operator-one",
      execution: "CONCURRENT_DUPLICATE_CLICK",
      observedStatuses: [200, 409],
      conflictCode: "PRODUCTION_RECORD_VERSION_CONFLICT",
    };
  }
  if (code === "client-retry-idempotency") {
    return {
      ...shared,
      actor: "operator-one",
      execution: "SEQUENTIAL_CLIENT_RETRY",
      observedStatuses: [200, 409],
      conflictCode: "PRODUCTION_RECORD_VERSION_CONFLICT",
    };
  }
  if (code === "concurrent-edit") {
    return {
      ...shared,
      actors: ["operator-one", "operator-two"],
      execution: "CONCURRENT_DISTINCT_CONTENT",
      proposedContents: ["proposal-one", "proposal-two"],
      persistedContent: "proposal-one",
      winningActor: "operator-one",
      observedStatuses: [200, 409],
      conflictCode: "PRODUCTION_RECORD_VERSION_CONFLICT",
    };
  }
  if (code === "optimistic-lock") {
    return {
      ...shared,
      actors: ["operator-one", "operator-two"],
      execution: "SEQUENTIAL_STALE_VERSION",
      expectedVersion: 0,
      persistedVersion: 1,
      observedStatuses: [200, 409],
      conflictCode: "PRODUCTION_RECORD_VERSION_CONFLICT",
    };
  }
  if (code === "no-silent-overwrite") {
    return {
      ...shared,
      actors: ["operator-one", "operator-two"],
      execution: "CONCURRENT_DISTINCT_CONTENT_OWNERSHIP",
      winningContent: "winner",
      losingContent: "loser",
      persistedContent: "winner",
      winningActor: "operator-one",
      observedStatuses: [200, 409],
      conflictCode: "PRODUCTION_RECORD_VERSION_CONFLICT",
    };
  }
  if (code === "no-duplicate-business-effect") {
    return {
      ...shared,
      actor: "operator-one",
      execution: "CONCURRENT_SINGLE_EFFECT",
      actionCode: "PRODUCTION_RECORD_SUBMITTED",
      observedStatuses: [200, 409],
      conflictCode: "PRODUCTION_RECORD_VERSION_CONFLICT",
    };
  }
  return {};
}

function requiredScenarioResults() {
  return [
    ...profile.performanceScenarios,
    ...profile.correctnessScenarios,
    ...profile.databaseScenarios,
    ...profile.faultScenarios,
  ].map((code, index) => ({
    code,
    status: "PASS",
    p95Ms: 200,
    ...(code === "queue-backlog-recovery"
      ? {
          pendingAfterRecovery: 0,
          oldestBacklogSecondsAfterRecovery: 0,
        }
      : {}),
    ...(profile.faultScenarios.includes(code)
      ? { recoverySeconds: code === "application-restart" ? 2.297 : 1 }
      : {}),
    ...correctnessDetails(code, index),
  }));
}

function reportedRunFields() {
  return {
    authority: profile.authority,
    slo: profile.slo,
    resourceExpansion: profile.resourceExpansion,
    importBoundary: {
      syncRows: 5000,
      asyncRowsPerJob: 5001,
      concurrentAsyncJobs: 2,
      pendingAfterRecovery: 0,
      oldestBacklogSecondsAfterRecovery: 0,
    },
    resourceTrend: {
      samples: 37,
      maximumCpuPercent: 30.36,
      maximumMemoryPercent: 0.8494,
      maximumDatabaseConnections: 20,
      maximumDatabaseConnectionPercent: 20,
    },
    maximumRecoverySeconds: 2.297,
  };
}

test("locks the authoritative scale, SLO, resource and scenario coverage", () => {
  const validated = validateProfile(profile);

  assert.deepEqual(validated.backendArtifact, {
    sourceCommit: "03904068ca1a43633d494b5c1848c38ade73e8b3",
    buildCommand: ["mvn", "clean", "-DskipTests", "package"],
    jarRelativePath: "target/grain-trade-enterprise-backend-0.0.1-SNAPSHOT.jar",
  });

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

test("rejects fake cloud values and binds admission to exact candidates and profile", () => {
  const fakeInputs = Object.fromEntries(
    Object.keys(validPreproductionRequest().inputs).map((key) => [key, "x"]),
  );
  assert.throws(
    () =>
      admitRun(
        {
          mode: "preproduction",
          baseUrl: "https://stage7-preproduction.example.cn",
          productionEquivalent: true,
          inputs: fakeInputs,
        },
        preproductionBinding,
      ),
    (error) =>
      error instanceof StageSevenAdmissionError &&
      error.exitCode === 2 &&
      /backendCommit candidate commit is invalid/u.test(error.message),
  );

  const mismatched = validPreproductionRequest();
  mismatched.inputs.webCommit = "e".repeat(40);
  assert.throws(
    () => admitRun(mismatched, preproductionBinding),
    /BLOCKED_EXTERNAL\(EXT-005\).*candidate commit/iu,
  );

  const foreignRegistry = validPreproductionRequest();
  foreignRegistry.inputs.backendImage = `registry.cn-shanghai.aliyuncs.com/cofco/backend@sha256:${"4".repeat(64)}`;
  assert.throws(
    () => admitRun(foreignRegistry, preproductionBinding),
    /backendImage.*approved regional ACR/iu,
  );

  const selfPinned = validPreproductionRequest();
  selfPinned.inputs.receiptAuthorityPublicKeySha256 = "f".repeat(64);
  assert.throws(
    () => admitRun(selfPinned, preproductionBinding),
    /receipt authority.*(?:trusted|match)|(?:trusted|match).*receipt authority/iu,
  );

  const admission = admitRun(validPreproductionRequest(), preproductionBinding);
  assert.equal(admission.provenance, "PREPRODUCTION_EQUIVALENT");
  assert.deepEqual(admission.candidate, candidates);
  assert.equal(admission.profileSha256, profileSha256);
  assert.equal(admission.topology.environmentName, "preproduction");
  assert.match(admission.artifacts.backend, /@sha256:[a-f0-9]{64}$/u);

  const replay = buildPreproductionReplayPlan(admission, profile);
  assert.equal(replay.provenance, "PREPRODUCTION_EQUIVALENT");
  assert.deepEqual(replay.candidate, candidates);
  assert.equal(replay.profileSha256, profileSha256);
  assert.deepEqual(
    replay.phases.map(({ code }) => code),
    [
      "candidate-binding",
      "load",
      "correctness",
      "database",
      "faults",
      "resource-sampling",
      "evidence",
    ],
  );
  assert.deepEqual(
    replay.phases.find(({ code }) => code === "load").profiles,
    profile.profiles,
  );
  assert.deepEqual(
    replay.phases.find(({ code }) => code === "correctness").scenarios,
    profile.correctnessScenarios,
  );
  assert.deepEqual(
    replay.phases.find(({ code }) => code === "database").scenarios,
    profile.databaseScenarios,
  );
  assert.deepEqual(
    replay.phases.find(({ code }) => code === "faults").scenarios,
    profile.faultScenarios,
  );
  assert.equal(
    replay.phases.find(({ code }) => code === "resource-sampling").endpoint,
    admission.topology.monitoringEndpoint,
  );
  assert.equal(
    replay.phases.find(({ code }) => code === "load").endpoint,
    admission.topology.workloadControlEndpoint,
  );
  assert.equal(replay.phases.find(({ code }) => code === "evidence").files, 5);
});

test("the standard preproduction entries report only EXT-005", () => {
  for (const command of ["admit", "replay-plan", "replay"]) {
    const result = spawnSync(
      process.execPath,
      [
        resolve(import.meta.dirname, "run-stage-seven.mjs"),
        command,
        ...(command === "admit" ? ["--mode", "preproduction"] : []),
        "--config",
        resolve(
          import.meta.dirname,
          "../ops/stage7-performance-resilience/preproduction-admission.json",
        ),
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 2, command);
    assert.equal(result.stdout, "", command);
    assert.equal(
      result.stderr,
      "BLOCKED_EXTERNAL(EXT-005): approved HTTPS base URL is missing\n",
      command,
    );
  }
});

test("the standard replay entry rejects a caller-supplied trust profile without network access", async () => {
  const directory = await mkdtemp(join(tmpdir(), "stage7-replay-test-"));
  const configPath = join(directory, "admission.json");
  const pinnedProfilePath = join(directory, "profile.json");
  try {
    const request = validPreproductionRequest();
    const pinnedProfileSource = `${JSON.stringify(
      {
        ...profile,
        receiptAuthorityPublicKeySha256,
      },
      null,
      2,
    )}\n`;
    request.inputs.profileSha256 = createHash("sha256")
      .update(pinnedProfileSource)
      .digest("hex");
    await writeFile(pinnedProfilePath, pinnedProfileSource, { mode: 0o600 });
    await writeFile(configPath, `${JSON.stringify(request, null, 2)}\n`, {
      mode: 0o600,
    });
    const result = spawnSync(
      process.execPath,
      [
        resolve(import.meta.dirname, "run-stage-seven.mjs"),
        "replay-plan",
        "--config",
        configPath,
        "--profile",
        pinnedProfilePath,
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.equal(
      result.stderr,
      "BLOCKED_EXTERNAL(EXT-005): Stage 7 standard entries forbid profile overrides\n",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("admits exact cloud inputs and renders secret-free four-document evidence", () => {
  const admission = admitRun(validPreproductionRequest(), preproductionBinding);
  assert.equal(admission.provenance, "PREPRODUCTION_EQUIVALENT");

  const evidence = renderEvidence({
    runId: "stage7-test",
    provenance: "LOCAL_PROPORTIONAL_ONLY",
    productionEquivalent: false,
    status: "PASS",
    candidates,
    backendArtifact: backendArtifactProvenance(),
    profileSha256,
    ...reportedRunFields(),
    supervisorDisposition: {
      independentReviewRequired: true,
      defects: {
        "DEF-125": "REGRESSION_PENDING",
        "DEF-126": "REGRESSION_PENDING",
        "DEF-127": "REGRESSION_PENDING",
      },
    },
    scenarios: requiredScenarioResults(),
    exclusions: profile.excludedGates,
    externalBlocker: "EXT-005",
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
  for (const document of [
    evidence["SUMMARY.md"],
    evidence["MATRIX.md"],
    evidence["VERIFICATION.md"],
    evidence["HANDOFF.md"],
  ]) {
    assert.match(document, new RegExp(candidates.backend, "u"));
    assert.match(document, /mvn clean -DskipTests package/u);
    assert.match(document, new RegExp("b".repeat(64), "u"));
    assert.match(document, /DEF-125: `REGRESSION_PENDING`/u);
    assert.match(document, /5000/u);
    assert.match(document, /5001/u);
    assert.match(document, /30\.36/u);
    assert.match(document, /2\.297/u);
    assert.match(document, /70/u);
  }
  assert.match(
    evidence["MATRIX.md"],
    /Error rate.*Throughput.*Consistency rate/iu,
  );

  const incompleteReport = reportedRunFields();
  delete incompleteReport.importBoundary;
  assert.throws(
    () =>
      renderEvidence({
        runId: "stage7-missing-operational-field",
        provenance: "LOCAL_PROPORTIONAL_ONLY",
        productionEquivalent: false,
        candidates,
        backendArtifact: backendArtifactProvenance(),
        profileSha256,
        ...incompleteReport,
        scenarios: requiredScenarioResults(),
        exclusions: profile.excludedGates,
        externalBlocker: "EXT-005",
      }),
    /operational report.*(?:incomplete|authoritative)/iu,
  );

  assert.throws(
    () =>
      renderEvidence({
        runId: "stage7-drifted-derived-operational-field",
        provenance: "LOCAL_PROPORTIONAL_ONLY",
        productionEquivalent: false,
        candidates,
        backendArtifact: backendArtifactProvenance(),
        profileSha256,
        ...reportedRunFields(),
        maximumRecoverySeconds: 1,
        scenarios: requiredScenarioResults(),
        exclusions: profile.excludedGates,
        externalBlocker: "EXT-005",
      }),
    /operational report.*(?:incomplete|authoritative)/iu,
  );

  assert.throws(
    () =>
      renderEvidence({
        runId: "stage7-incomplete",
        provenance: "LOCAL_PROPORTIONAL_ONLY",
        productionEquivalent: false,
        candidates,
        backendArtifact: backendArtifactProvenance(),
        ...reportedRunFields(),
        scenarios: requiredScenarioResults().filter(
          ({ code }) =>
            code === "baseline" ||
            code === "queue-backlog-recovery" ||
            profile.faultScenarios.includes(code),
        ),
        exclusions: profile.excludedGates,
        externalBlocker: "EXT-005",
      }),
    /dynamic scenario evidence is incomplete/u,
  );
});

test("rejects local evidence without Backend build provenance", () => {
  assert.throws(
    () =>
      renderEvidence({
        runId: "stage7-missing-backend-artifact",
        provenance: "LOCAL_PROPORTIONAL_ONLY",
        productionEquivalent: false,
        candidates,
        ...reportedRunFields(),
        scenarios: requiredScenarioResults(),
        exclusions: profile.excludedGates,
        externalBlocker: "EXT-005",
      }),
    /Backend artifact.*provenance|provenance.*Backend artifact/iu,
  );
});

test("publishes the five-file evidence bundle atomically", async () => {
  const directory = await mkdtemp(join(tmpdir(), "stage7-evidence-atomic-"));
  const resultPath = join(directory, "result.json");
  const outputPath = join(directory, "evidence");
  try {
    await writeFile(
      resultPath,
      `${JSON.stringify({
        runId: "stage7-atomic-test",
        provenance: "LOCAL_PROPORTIONAL_ONLY",
        productionEquivalent: false,
        candidates,
        backendArtifact: backendArtifactProvenance(),
        profileSha256,
        ...reportedRunFields(),
        scenarios: requiredScenarioResults(),
        exclusions: profile.excludedGates,
        externalBlocker: "EXT-005",
      })}\n`,
    );
    await mkdir(outputPath);
    await writeFile(join(outputPath, "MATRIX.md"), "preserved\n");
    const rawRun = JSON.parse(await readFile(resultPath, "utf8"));
    await assert.rejects(
      () => writeEvidenceAtomically(outputPath, rawRun),
      /already exists/u,
    );
    assert.deepEqual(await readdir(outputPath), ["MATRIX.md"]);
    assert.equal(
      await readFile(join(outputPath, "MATRIX.md"), "utf8"),
      "preserved\n",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("standard CLI exposes no caller-supplied evidence render command", () => {
  const result = spawnSync(
    process.execPath,
    [resolve(import.meta.dirname, "run-stage-seven.mjs"), "render"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "STAGE7_ERROR Unknown Stage 7 command\n");
});

test("rejects any human evidence field that drifts from run.json", async () => {
  const directory = await mkdtemp(join(tmpdir(), "stage7-evidence-drift-"));
  try {
    const evidence = renderEvidence({
      runId: "stage7-drift-test",
      provenance: "LOCAL_PROPORTIONAL_ONLY",
      productionEquivalent: false,
      candidates,
      backendArtifact: backendArtifactProvenance(),
      profileSha256,
      ...reportedRunFields(),
      scenarios: requiredScenarioResults(),
      exclusions: profile.excludedGates,
      externalBlocker: "EXT-005",
    });
    await Promise.all(
      Object.entries(evidence).map(([name, content]) =>
        writeFile(join(directory, name), content),
      ),
    );
    await writeFile(
      join(directory, "MATRIX.md"),
      evidence["MATRIX.md"].replace(
        "| page-main-content | PASS | 200 |",
        "| page-main-content | PASS | 201 |",
      ),
    );
    await assert.rejects(
      () => verifyEvidenceDirectory(directory),
      /evidence.*(?:drift|inconsistent)/iu,
    );

    await writeFile(join(directory, "MATRIX.md"), evidence["MATRIX.md"]);
    await writeFile(join(directory, "EXTRA.md"), "not part of the bundle\n");
    await assert.rejects(
      () => verifyEvidenceDirectory(directory),
      /exactly five files/iu,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects contradictory or semantically reused production evidence", () => {
  assert.throws(
    () =>
      renderEvidence({
        runId: "stage7-contradiction",
        provenance: "PREPRODUCTION_EQUIVALENT",
        productionEquivalent: false,
        candidates,
        backendArtifact: backendArtifactProvenance(),
        profileSha256,
        admission: admitRun(validPreproductionRequest(), preproductionBinding),
        scenarios: requiredScenarioResults(),
        exclusions: profile.excludedGates,
      }),
    /productionEquivalent.*provenance|provenance.*productionEquivalent/iu,
  );

  assert.throws(
    () =>
      renderEvidence({
        runId: "stage7-unexecuted-preproduction",
        provenance: "PREPRODUCTION_EQUIVALENT",
        productionEquivalent: true,
        candidates,
        profileSha256,
        ...reportedRunFields(),
        admission: admitRun(validPreproductionRequest(), preproductionBinding),
        receiptAuthorityPublicKeySha256,
        scenarios: requiredScenarioResults(),
        exclusions: profile.excludedGates,
      }),
    /verified replay bundle/u,
  );

  assert.throws(
    () =>
      renderEvidence({
        runId: "stage7-forged-receipts",
        provenance: "PREPRODUCTION_EQUIVALENT",
        productionEquivalent: true,
        candidates,
        profileSha256,
        ...reportedRunFields(),
        admission: admitRun(validPreproductionRequest(), preproductionBinding),
        receiptAuthorityPublicKeySha256,
        replay: {
          schemaVersion: "cofco-stage7-preproduction-replay-v1",
          phaseReceipts: [
            "candidate-binding",
            "load",
            "correctness",
            "database",
            "faults",
            "resource-sampling",
          ].map((code) => ({
            code,
            candidateBound: true,
            profileBound: true,
          })),
        },
        scenarios: requiredScenarioResults(),
        exclusions: profile.excludedGates,
      }),
    /verified replay bundle/u,
  );

  const duplicateCodes = requiredScenarioResults();
  duplicateCodes.push({ ...duplicateCodes[0] });
  assert.throws(
    () =>
      renderEvidence({
        runId: "stage7-duplicate-code",
        provenance: "LOCAL_PROPORTIONAL_ONLY",
        productionEquivalent: false,
        candidates,
        backendArtifact: backendArtifactProvenance(),
        profileSha256,
        ...reportedRunFields(),
        scenarios: duplicateCodes,
        exclusions: profile.excludedGates,
        externalBlocker: "EXT-005",
      }),
    /duplicate.*scenario/iu,
  );

  const reusedCorrectness = requiredScenarioResults().map((item) =>
    [
      "duplicate-click-idempotency",
      "client-retry-idempotency",
      "concurrent-edit",
      "optimistic-lock",
      "no-silent-overwrite",
      "no-duplicate-business-effect",
    ].includes(item.code)
      ? {
          ...item,
          recordId: "00000000-0000-4000-8000-999999999999",
          observedStatuses: [200, 409],
        }
      : item,
  );
  assert.throws(
    () =>
      renderEvidence({
        runId: "stage7-reused-correctness",
        provenance: "LOCAL_PROPORTIONAL_ONLY",
        productionEquivalent: false,
        candidates,
        backendArtifact: backendArtifactProvenance(),
        profileSha256,
        ...reportedRunFields(),
        scenarios: reusedCorrectness,
        exclusions: profile.excludedGates,
        externalBlocker: "EXT-005",
      }),
    /distinct.*correctness|correctness.*distinct/iu,
  );
});
