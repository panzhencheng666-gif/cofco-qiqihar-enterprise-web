import { verifyReplayReceiptBundle } from "./stage-seven-receipts.mjs";

const authority = Object.freeze({
  registeredEmployees: 1000,
  peakConcurrentEmployees: 300,
  annualBusinessRows: 5000000,
  monthlyPhotoGrowthGb: 100,
  synchronousImportRows: 5000,
  asynchronousImportRows: 5001,
  concurrentImportJobs: 2,
});

const workloadCodes = new Set([
  "read",
  "write",
  "review",
  "import",
  "photo",
  "map",
  "analysis",
  "supply",
  "report",
]);

const requiredScenarios = [
  "page-main-content",
  "sync-import-5000",
  "async-import-5001-concurrent",
  "duplicate-click-idempotency",
  "client-retry-idempotency",
  "concurrent-edit",
  "optimistic-lock",
  "session-expiry-draft-recovery",
  "no-silent-overwrite",
  "no-duplicate-business-effect",
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
];

const canonicalLocalScenarioOrder = Object.freeze([
  "baseline",
  "peak",
  "burst",
  "stress",
  "capacity-300",
  "capacity-375",
  "capacity-450",
  "capacity-525",
  "page-main-content",
  "sync-import-5000",
  "async-import-5001-concurrent",
  "duplicate-click-idempotency",
  "client-retry-idempotency",
  "concurrent-edit",
  "optimistic-lock",
  "no-silent-overwrite",
  "no-duplicate-business-effect",
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
]);

const canonicalLocalScaledProfiles = Object.freeze([
  { code: "baseline", concurrency: 2, durationSeconds: 3 },
  { code: "peak", concurrency: 6, durationSeconds: 6 },
  { code: "burst", concurrency: 9, durationSeconds: 2 },
  { code: "stress", concurrency: 11, durationSeconds: 4 },
  { code: "capacity-300", concurrency: 6, durationSeconds: 2 },
  { code: "capacity-375", concurrency: 8, durationSeconds: 2 },
  { code: "capacity-450", concurrency: 9, durationSeconds: 2 },
  { code: "capacity-525", concurrency: 11, durationSeconds: 2 },
]);

const canonicalProfileScenarioGroups = Object.freeze({
  performanceScenarios: ["page-main-content"],
  correctnessScenarios: canonicalLocalScenarioOrder.slice(9, 18),
  databaseScenarios: canonicalLocalScenarioOrder.slice(18, 24),
  faultScenarios: canonicalLocalScenarioOrder.slice(24),
});

const independentCorrectnessScenarios = [
  "duplicate-click-idempotency",
  "client-retry-idempotency",
  "concurrent-edit",
  "optimistic-lock",
  "no-silent-overwrite",
  "no-duplicate-business-effect",
];

const cloudInputKeys = [
  "backendCommit",
  "frontendCommit",
  "webCommit",
  "profileSha256",
  "topologyEvidenceSha256",
  "capacityApprovalSha256",
  "faultControlApprovalSha256",
  "receiptAuthorityPublicKeySha256",
  "environmentName",
  "cloudProvider",
  "regionId",
  "ecsInstanceId",
  "vpcId",
  "vswitchId",
  "rdsResourceId",
  "ossBucket",
  "ossEndpoint",
  "workloadControlEndpoint",
  "monitoringEndpoint",
  "faultControlEndpoint",
  "candidateManifestPath",
  "backendImage",
  "businessImage",
  "overviewImage",
  "gatewayImage",
  "prometheusImage",
  "blackboxImage",
  "alertmanagerImage",
];

const commitPattern = /^[a-f0-9]{40}$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const regionPattern = /^cn-[a-z]+(?:-[a-z]+)*$/u;
const immutableImagePattern = /^[a-z0-9][a-z0-9._:/-]*@sha256:[a-f0-9]{64}$/u;
const uuidPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;

const sensitiveKey =
  /(password|secret|token|cookie|credential|access.?key|session.?state)/iu;

export class StageSevenAdmissionError extends Error {
  constructor(message) {
    super(`BLOCKED_EXTERNAL(EXT-005): ${message}`);
    this.name = "StageSevenAdmissionError";
    this.exitCode = 2;
    this.code = "BLOCKED_EXTERNAL(EXT-005)";
  }
}

function blockAdmission(message) {
  throw new StageSevenAdmissionError(message);
}

function requirePattern(inputs, key, pattern, message = key) {
  if (!pattern.test(inputs[key])) {
    blockAdmission(`${message} is invalid`);
  }
}

function approvedHttpsOrigin(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    blockAdmission(`${label} is invalid`);
  }
  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    (url.port !== "" && url.port !== "443") ||
    !["", "/"].includes(url.pathname) ||
    url.search !== "" ||
    url.hash !== "" ||
    !hostname.includes(".") ||
    ["localhost", "127.0.0.1", "::1"].includes(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".invalid") ||
    hostname.endsWith(".test") ||
    hostname.endsWith(".example")
  ) {
    blockAdmission(`${label} must be an approved public HTTPS origin`);
  }
  return url.origin;
}

export function validateProfile(input) {
  if (!input || input.schemaVersion !== "cofco-stage7-v1") {
    throw new Error("Unsupported Stage 7 profile schema");
  }
  for (const [key, value] of Object.entries(authority)) {
    if (input.authority?.[key] !== value) {
      throw new Error(`Stage 7 authoritative ${key} must equal ${value}`);
    }
  }
  if (
    !commitPattern.test(input.backendArtifact?.sourceCommit ?? "") ||
    JSON.stringify(input.backendArtifact?.buildCommand) !==
      JSON.stringify(["mvn", "clean", "-DskipTests", "package"]) ||
    input.backendArtifact?.jarRelativePath !==
      "target/grain-trade-enterprise-backend-0.0.1-SNAPSHOT.jar"
  ) {
    throw new Error("Stage 7 Backend artifact build provenance is invalid");
  }
  if (
    input.receiptAuthorityPublicKeySha256 !== null &&
    !sha256Pattern.test(input.receiptAuthorityPublicKeySha256 ?? "")
  ) {
    throw new Error("Stage 7 trusted receipt authority pin is invalid");
  }
  if (
    input.slo?.coreApiP95Ms !== 800 ||
    input.slo?.pageMainContentMs !== 3000 ||
    input.slo?.unexpectedErrorRate !== 0.001 ||
    input.slo?.writeConsistencyRate !== 1 ||
    input.slo?.shortRecoverySeconds !== 120
  ) {
    throw new Error("Stage 7 SLO thresholds are incomplete or diluted");
  }
  if (
    input.resourceExpansion?.cpuPercent !== 70 ||
    input.resourceExpansion?.memoryPercent !== 75 ||
    input.resourceExpansion?.databaseConnectionPercent !== 70 ||
    input.resourceExpansion?.oldestBacklogSecondsAfterRecovery !== 60
  ) {
    throw new Error(
      "Stage 7 resource expansion thresholds are incomplete or diluted",
    );
  }
  const actualWorkloads = new Set(
    Array.isArray(input.workloads)
      ? input.workloads.map(({ code }) => code)
      : [],
  );
  if (
    actualWorkloads.size !== workloadCodes.size ||
    [...workloadCodes].some((code) => !actualWorkloads.has(code))
  ) {
    throw new Error("Stage 7 workload coverage is incomplete");
  }
  if (
    input.workloads.reduce((total, item) => total + item.weight, 0) !== 100 ||
    input.workloads.some(
      ({ method, path, weight }) =>
        !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method) ||
        typeof path !== "string" ||
        !path.startsWith("/api/") ||
        !Number.isInteger(weight) ||
        weight < 1,
    )
  ) {
    throw new Error("Stage 7 workload definitions are invalid");
  }
  for (const [key, expected] of Object.entries(
    canonicalProfileScenarioGroups,
  )) {
    if (JSON.stringify(input[key]) !== JSON.stringify(expected)) {
      throw new Error(`Stage 7 ${key} must use the canonical scenario order`);
    }
  }
  if (
    JSON.stringify(input.excludedGates) !==
    JSON.stringify([
      "final-24-hour-stability",
      "stage-8-security-privacy-compliance",
    ])
  ) {
    throw new Error("Stage 7 excluded gates are invalid");
  }
  return structuredClone(input);
}

export function percentile(samples, quantile) {
  if (
    !Array.isArray(samples) ||
    samples.length === 0 ||
    samples.some((value) => !Number.isFinite(value) || value < 0) ||
    !Number.isFinite(quantile) ||
    quantile <= 0 ||
    quantile > 1
  ) {
    throw new Error("Invalid percentile samples");
  }
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * quantile) - 1];
}

export function evaluateScenario(metrics, rawProfile) {
  const profile = validateProfile(rawProfile);
  if (
    !Number.isInteger(metrics.attempts) ||
    metrics.attempts < 1 ||
    !Number.isInteger(metrics.unexpectedErrors) ||
    metrics.unexpectedErrors < 0 ||
    metrics.unexpectedErrors > metrics.attempts
  ) {
    throw new Error("Invalid Stage 7 scenario metrics");
  }
  const errorRate = metrics.unexpectedErrors / metrics.attempts;
  const p95Ms = percentile(metrics.latenciesMs, 0.95);
  const successfulWrites = metrics.successfulWrites ?? 0;
  const consistentWrites = metrics.consistentWrites ?? 0;
  const consistencyRate =
    successfulWrites === 0 ? 1 : consistentWrites / successfulWrites;
  const failedGates = [];
  if (p95Ms > profile.slo.coreApiP95Ms) failedGates.push("p95");
  if (errorRate > profile.slo.unexpectedErrorRate)
    failedGates.push("error-rate");
  if (consistencyRate < profile.slo.writeConsistencyRate)
    failedGates.push("consistency");
  if ((metrics.recoverySeconds ?? 0) > profile.slo.shortRecoverySeconds)
    failedGates.push("recovery");
  if ((metrics.maximumCpuPercent ?? 0) > profile.resourceExpansion.cpuPercent)
    failedGates.push("cpu");
  if (
    (metrics.maximumMemoryPercent ?? 0) >
    profile.resourceExpansion.memoryPercent
  )
    failedGates.push("memory");
  if (
    (metrics.maximumDatabaseConnectionPercent ?? 0) >
    profile.resourceExpansion.databaseConnectionPercent
  )
    failedGates.push("database-connections");
  if (
    (metrics.oldestBacklogSecondsAfterRecovery ?? 0) >
    profile.resourceExpansion.oldestBacklogSecondsAfterRecovery
  )
    failedGates.push("backlog");
  return {
    status: failedGates.length === 0 ? "PASS" : "FAIL",
    p95Ms,
    errorRate,
    consistencyRate,
    failedGates,
  };
}

export function admitRun(request, expected = {}) {
  if (request?.mode === "local") {
    return {
      mode: "local",
      provenance: "LOCAL_PROPORTIONAL_ONLY",
      productionEquivalent: false,
    };
  }
  if (request?.mode !== "preproduction") {
    throw new Error("Stage 7 mode must be local or preproduction");
  }
  if (typeof request.baseUrl !== "string" || request.baseUrl.trim() === "") {
    throw new StageSevenAdmissionError("approved HTTPS base URL is missing");
  }
  const baseUrl = approvedHttpsOrigin(request.baseUrl, "base URL");
  if (request.productionEquivalent !== true) {
    blockAdmission("production-equivalent approval is missing");
  }
  const missing = cloudInputKeys.filter(
    (key) =>
      typeof request.inputs?.[key] !== "string" ||
      request.inputs[key].trim() === "",
  );
  if (missing.length > 0) {
    throw new StageSevenAdmissionError(
      `required production-equivalent inputs are missing: ${missing.join(",")}`,
    );
  }
  const inputs = request.inputs;
  for (const key of ["backendCommit", "frontendCommit", "webCommit"]) {
    requirePattern(inputs, key, commitPattern, `${key} candidate commit`);
  }
  for (const key of [
    "profileSha256",
    "topologyEvidenceSha256",
    "capacityApprovalSha256",
    "faultControlApprovalSha256",
    "receiptAuthorityPublicKeySha256",
  ]) {
    requirePattern(inputs, key, sha256Pattern, `${key} digest`);
  }
  if (
    !expected.candidates ||
    !["backend", "frontend", "web"].every((repository) =>
      commitPattern.test(expected.candidates[repository]),
    ) ||
    !sha256Pattern.test(expected.profileSha256 ?? "") ||
    !sha256Pattern.test(expected.receiptAuthorityPublicKeySha256 ?? "")
  ) {
    blockAdmission(
      "candidate commit, profile digest, and trusted receipt authority binding is missing",
    );
  }
  if (
    inputs.backendCommit !== expected.candidates.backend ||
    inputs.frontendCommit !== expected.candidates.frontend ||
    inputs.webCommit !== expected.candidates.web ||
    inputs.profileSha256 !== expected.profileSha256 ||
    inputs.receiptAuthorityPublicKeySha256 !==
      expected.receiptAuthorityPublicKeySha256
  ) {
    blockAdmission(
      "candidate commit, profile digest, or trusted receipt authority does not match",
    );
  }
  if (
    inputs.environmentName !== "preproduction" ||
    inputs.cloudProvider !== "ALIBABA_CLOUD"
  ) {
    blockAdmission("approved preproduction topology is invalid");
  }
  requirePattern(inputs, "regionId", regionPattern, "Alibaba Cloud region");
  requirePattern(inputs, "ecsInstanceId", /^i-[A-Za-z0-9]{8,64}$/u);
  requirePattern(inputs, "vpcId", /^vpc-[A-Za-z0-9]{8,64}$/u);
  requirePattern(inputs, "vswitchId", /^vsw-[A-Za-z0-9]{8,64}$/u);
  requirePattern(inputs, "rdsResourceId", /^rm-[A-Za-z0-9]{8,64}$/u);
  requirePattern(inputs, "ossBucket", /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/u);
  const expectedOssEndpoint = `https://oss-${inputs.regionId}-internal.aliyuncs.com`;
  if (inputs.ossEndpoint !== expectedOssEndpoint) {
    blockAdmission("private OSS endpoint is not bound to the approved region");
  }
  const monitoringEndpoint = approvedHttpsOrigin(
    inputs.monitoringEndpoint,
    "monitoring endpoint",
  );
  const workloadControlEndpoint = approvedHttpsOrigin(
    inputs.workloadControlEndpoint,
    "workload-control endpoint",
  );
  const faultControlEndpoint = approvedHttpsOrigin(
    inputs.faultControlEndpoint,
    "fault-control endpoint",
  );
  if (
    !/^\/api\/[A-Za-z0-9/_-]+$/u.test(inputs.candidateManifestPath) ||
    inputs.candidateManifestPath.includes("//") ||
    inputs.candidateManifestPath.includes("..")
  ) {
    blockAdmission("candidate manifest path is invalid");
  }
  const artifactKeys = [
    "backendImage",
    "businessImage",
    "overviewImage",
    "gatewayImage",
    "prometheusImage",
    "blackboxImage",
    "alertmanagerImage",
  ];
  for (const key of artifactKeys) {
    requirePattern(inputs, key, immutableImagePattern, `${key} digest`);
    if (!inputs[key].startsWith(`registry.${inputs.regionId}.aliyuncs.com/`)) {
      blockAdmission(`${key} is not bound to the approved regional ACR`);
    }
  }
  return {
    mode: "preproduction",
    provenance: "PREPRODUCTION_EQUIVALENT",
    productionEquivalent: true,
    baseUrl,
    candidate: {
      backend: request.inputs.backendCommit,
      frontend: request.inputs.frontendCommit,
      web: request.inputs.webCommit,
    },
    profileSha256: inputs.profileSha256,
    approvalEvidence: {
      topology: inputs.topologyEvidenceSha256,
      capacity: inputs.capacityApprovalSha256,
      faultControl: inputs.faultControlApprovalSha256,
    },
    receiptAuthorityPublicKeySha256: inputs.receiptAuthorityPublicKeySha256,
    topology: {
      environmentName: inputs.environmentName,
      cloudProvider: inputs.cloudProvider,
      regionId: inputs.regionId,
      ecsInstanceId: inputs.ecsInstanceId,
      vpcId: inputs.vpcId,
      vswitchId: inputs.vswitchId,
      rdsResourceId: inputs.rdsResourceId,
      ossBucket: inputs.ossBucket,
      ossEndpoint: inputs.ossEndpoint,
      workloadControlEndpoint,
      monitoringEndpoint,
      faultControlEndpoint,
      candidateManifestPath: inputs.candidateManifestPath,
    },
    artifacts: Object.fromEntries(
      artifactKeys.map((key) => [key.replace(/Image$/u, ""), inputs[key]]),
    ),
  };
}

export function buildPreproductionReplayPlan(admission, rawProfile) {
  const profile = validateProfile(rawProfile);
  if (
    admission?.provenance !== "PREPRODUCTION_EQUIVALENT" ||
    admission.productionEquivalent !== true ||
    !commitPattern.test(admission.candidate?.backend ?? "") ||
    !commitPattern.test(admission.candidate?.frontend ?? "") ||
    !commitPattern.test(admission.candidate?.web ?? "") ||
    !sha256Pattern.test(admission.profileSha256 ?? "") ||
    !sha256Pattern.test(admission.receiptAuthorityPublicKeySha256 ?? "") ||
    !admission.topology ||
    !admission.artifacts
  ) {
    throw new Error("Invalid admitted Stage 7 preproduction replay");
  }
  return {
    schemaVersion: "cofco-stage7-preproduction-replay-v2",
    mode: "preproduction",
    provenance: admission.provenance,
    productionEquivalent: true,
    candidate: structuredClone(admission.candidate),
    profileSha256: admission.profileSha256,
    receiptAuthorityPublicKeySha256: admission.receiptAuthorityPublicKeySha256,
    target: {
      baseUrl: admission.baseUrl,
      candidateManifestUrl: new URL(
        admission.topology.candidateManifestPath,
        admission.baseUrl,
      ).href,
      rdsResourceId: admission.topology.rdsResourceId,
      ossBucket: admission.topology.ossBucket,
      ossEndpoint: admission.topology.ossEndpoint,
      workloadControlEndpoint: admission.topology.workloadControlEndpoint,
      monitoringEndpoint: admission.topology.monitoringEndpoint,
      faultControlEndpoint: admission.topology.faultControlEndpoint,
    },
    phases: [
      {
        code: "candidate-binding",
        candidates: structuredClone(admission.candidate),
        artifacts: structuredClone(admission.artifacts),
      },
      {
        code: "load",
        endpoint: admission.topology.workloadControlEndpoint,
        expectedScenarioCodes: [
          ...profile.profiles.map(({ code }) => code),
          ...profile.performanceScenarios,
        ],
        profiles: structuredClone(profile.profiles),
        workloads: structuredClone(profile.workloads),
      },
      {
        code: "correctness",
        endpoint: admission.topology.workloadControlEndpoint,
        expectedScenarioCodes: structuredClone(profile.correctnessScenarios),
        scenarios: structuredClone(profile.correctnessScenarios),
      },
      {
        code: "database",
        endpoint: admission.topology.workloadControlEndpoint,
        expectedScenarioCodes: structuredClone(profile.databaseScenarios),
        scenarios: structuredClone(profile.databaseScenarios),
      },
      {
        code: "faults",
        endpoint: admission.topology.faultControlEndpoint,
        expectedScenarioCodes: structuredClone(profile.faultScenarios),
        scenarios: structuredClone(profile.faultScenarios),
      },
      {
        code: "resource-sampling",
        endpoint: admission.topology.monitoringEndpoint,
        expectedScenarioCodes: [],
      },
      { code: "evidence", files: 5 },
    ],
    exclusions: structuredClone(profile.excludedGates),
  };
}

function sanitized(value) {
  if (Array.isArray(value)) return value.map(sanitized);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !sensitiveKey.test(key))
        .map(([key, nested]) => [key, sanitized(nested)]),
    );
  }
  return value;
}

function immutable(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(immutable);
  return Object.freeze(value);
}

function assertLocalBackendArtifactProvenance(run) {
  const provenance = run.backendArtifact;
  if (
    provenance?.schemaVersion !== "cofco-stage7-backend-artifact-v1" ||
    provenance.sourceCommit !== run.candidates?.backend ||
    provenance.sourceClean !== true ||
    JSON.stringify(provenance.build?.command) !==
      JSON.stringify(["mvn", "clean", "-DskipTests", "package"]) ||
    !sha256Pattern.test(provenance.build?.outputSha256 ?? "") ||
    typeof provenance.build?.environment?.javaHome !== "string" ||
    provenance.build.environment.javaHome.trim() === "" ||
    typeof provenance.build.environment.javaVersion !== "string" ||
    !/\b21(?:\.|\b)/u.test(provenance.build.environment.javaVersion) ||
    typeof provenance.build.environment.mavenVersion !== "string" ||
    provenance.build.environment.mavenVersion.trim() === "" ||
    typeof provenance.build.environment.platform !== "string" ||
    provenance.build.environment.platform.trim() === "" ||
    typeof provenance.build.environment.architecture !== "string" ||
    provenance.build.environment.architecture.trim() === "" ||
    provenance.jar?.relativePath !==
      "target/grain-trade-enterprise-backend-0.0.1-SNAPSHOT.jar" ||
    !sha256Pattern.test(provenance.jar?.sha256 ?? "") ||
    !Number.isSafeInteger(provenance.jar?.sizeBytes) ||
    provenance.jar.sizeBytes <= 0 ||
    !sha256Pattern.test(provenance.jar?.manifestSha256 ?? "") ||
    !provenance.jar?.manifest ||
    typeof provenance.jar.manifest !== "object" ||
    Array.isArray(provenance.jar.manifest) ||
    Object.keys(provenance.jar.manifest).length === 0 ||
    !/^21(?:\.|$)/u.test(provenance.jar.manifest["Java-Version"] ?? "") ||
    !/^21(?:\.|$)/u.test(provenance.jar.manifest["Build-Jdk-Spec"] ?? "")
  ) {
    throw new Error(
      "Stage 7 local evidence requires exact Backend artifact build provenance",
    );
  }
}

function assertOperationalReport(run) {
  const finiteNonNegative = (value) => Number.isFinite(value) && value >= 0;
  const backlogScenario = run.scenarios.find(
    ({ code }) => code === "queue-backlog-recovery",
  );
  const recoveries = run.scenarios
    .map(({ recoverySeconds }) => recoverySeconds)
    .filter(Number.isFinite);
  const maximumRecoverySeconds =
    recoveries.length > 0 ? Math.max(...recoveries) : undefined;
  if (
    JSON.stringify(run.authority) !== JSON.stringify(authority) ||
    run.slo?.coreApiP95Ms !== 800 ||
    run.slo?.pageMainContentMs !== 3000 ||
    run.slo?.unexpectedErrorRate !== 0.001 ||
    run.slo?.writeConsistencyRate !== 1 ||
    run.slo?.shortRecoverySeconds !== 120 ||
    run.resourceExpansion?.cpuPercent !== 70 ||
    run.resourceExpansion?.memoryPercent !== 75 ||
    run.resourceExpansion?.databaseConnectionPercent !== 70 ||
    run.resourceExpansion?.oldestBacklogSecondsAfterRecovery !== 60 ||
    run.importBoundary?.syncRows !== authority.synchronousImportRows ||
    run.importBoundary?.asyncRowsPerJob !== authority.asynchronousImportRows ||
    run.importBoundary?.concurrentAsyncJobs !==
      authority.concurrentImportJobs ||
    !finiteNonNegative(run.importBoundary?.pendingAfterRecovery) ||
    !finiteNonNegative(run.importBoundary?.oldestBacklogSecondsAfterRecovery) ||
    backlogScenario?.pendingAfterRecovery !==
      run.importBoundary.pendingAfterRecovery ||
    backlogScenario?.oldestBacklogSecondsAfterRecovery !==
      run.importBoundary.oldestBacklogSecondsAfterRecovery ||
    !Number.isSafeInteger(run.resourceTrend?.samples) ||
    run.resourceTrend.samples <= 0 ||
    !finiteNonNegative(run.resourceTrend?.maximumCpuPercent) ||
    !finiteNonNegative(run.resourceTrend?.maximumMemoryPercent) ||
    !finiteNonNegative(run.resourceTrend?.maximumDatabaseConnections) ||
    !finiteNonNegative(run.resourceTrend?.maximumDatabaseConnectionPercent) ||
    !finiteNonNegative(run.maximumRecoverySeconds) ||
    run.maximumRecoverySeconds !== maximumRecoverySeconds
  ) {
    throw new Error(
      "Stage 7 operational report is incomplete or differs from authoritative fields",
    );
  }
}

function round3(value) {
  return Number(value.toFixed(3));
}

function sameNumber(actual, expected) {
  return Number.isFinite(actual) && actual === expected;
}

function assertLocalDerivedFacts(run) {
  const actualOrder = run.scenarios.map(({ code }) => code);
  if (
    JSON.stringify(actualOrder) !== JSON.stringify(canonicalLocalScenarioOrder)
  ) {
    throw new Error(
      "Stage 7 local scenarios must use the canonical 28-scenario order",
    );
  }
  const resources = run.resourceTrend;
  if (
    JSON.stringify(run.scaledProfiles) !==
      JSON.stringify(canonicalLocalScaledProfiles) ||
    !Array.isArray(resources?.rawSamples) ||
    resources.rawSamples.length === 0 ||
    resources.rawSamples.some((sample) =>
      [
        sample?.cpuPercent,
        sample?.memoryPercent,
        sample?.databaseConnections,
        sample?.elapsedSeconds,
      ].some((value) => !Number.isFinite(value) || value < 0),
    ) ||
    !Number.isFinite(resources.maximumDatabaseConnectionsConfigured) ||
    resources.maximumDatabaseConnectionsConfigured <= 0
  ) {
    throw new Error("Stage 7 resource raw samples are incomplete");
  }
  const derivedResources = {
    samples: resources.rawSamples.length,
    maximumCpuPercent: Math.max(
      ...resources.rawSamples.map(({ cpuPercent }) => cpuPercent),
    ),
    maximumMemoryPercent: Math.max(
      ...resources.rawSamples.map(({ memoryPercent }) => memoryPercent),
    ),
    maximumDatabaseConnections: Math.max(
      ...resources.rawSamples.map(
        ({ databaseConnections }) => databaseConnections,
      ),
    ),
    endingMinusStartingMemoryPercent:
      resources.rawSamples.at(-1).memoryPercent -
      resources.rawSamples[0].memoryPercent,
  };
  derivedResources.maximumDatabaseConnectionPercent = round3(
    (derivedResources.maximumDatabaseConnections /
      resources.maximumDatabaseConnectionsConfigured) *
      100,
  );
  if (
    Object.entries(derivedResources).some(
      ([key, expected]) => !sameNumber(resources[key], expected),
    )
  ) {
    throw new Error(
      "Stage 7 resource summary differs from raw resource samples",
    );
  }

  for (const [index, scenario] of run.scenarios.slice(0, 8).entries()) {
    const expectedProfile = canonicalLocalScaledProfiles[index];
    const workloadCounts = Object.values(scenario.byWorkload ?? {});
    if (
      !Array.isArray(scenario.latencySamplesMs) ||
      scenario.latencySamplesMs.length !== scenario.attempts ||
      !Number.isInteger(scenario.attempts) ||
      scenario.attempts < 1 ||
      !scenario.byWorkload ||
      typeof scenario.byWorkload !== "object" ||
      scenario.concurrency !== expectedProfile.concurrency ||
      scenario.durationSeconds !== expectedProfile.durationSeconds ||
      workloadCounts.length === 0 ||
      workloadCounts.some(
        ({ attempts, unexpectedErrors }) =>
          !Number.isInteger(attempts) ||
          attempts < 0 ||
          !Number.isInteger(unexpectedErrors) ||
          unexpectedErrors < 0 ||
          unexpectedErrors > attempts,
      )
    ) {
      throw new Error(
        `${scenario.code} raw latency samples or request counts are incomplete`,
      );
    }
    const attempts = workloadCounts.reduce(
      (total, item) => total + item.attempts,
      0,
    );
    const unexpectedErrors = workloadCounts.reduce(
      (total, item) => total + item.unexpectedErrors,
      0,
    );
    const successfulWrites = ["write", "review", "import", "photo"].reduce(
      (total, code) => {
        const item = scenario.byWorkload[code];
        return total + (item ? item.attempts - item.unexpectedErrors : 0);
      },
      0,
    );
    const validChecks =
      Array.isArray(scenario.consistencyChecks) &&
      scenario.consistencyChecks.length > 0 &&
      scenario.consistencyChecks.every(
        ({ expected, actual, passed }) =>
          Number.isInteger(expected) &&
          expected >= 0 &&
          Number.isInteger(actual) &&
          actual >= 0 &&
          passed === (expected === actual),
      );
    if (!validChecks) {
      throw new Error(
        `${scenario.code} consistency checks differ from raw counts`,
      );
    }
    const checksPass = scenario.consistencyChecks.every(({ passed }) => passed);
    const consistentWrites = checksPass ? successfulWrites : 0;
    const consistencyRate =
      successfulWrites === 0 ? 1 : consistentWrites / successfulWrites;
    const p95Ms = round3(percentile(scenario.latencySamplesMs, 0.95));
    const p50Ms = round3(percentile(scenario.latencySamplesMs, 0.5));
    const p99Ms = round3(percentile(scenario.latencySamplesMs, 0.99));
    const throughputPerSecond = round3(attempts / scenario.durationSeconds);
    const errorRate = unexpectedErrors / attempts;
    const failedGates = [];
    if (p95Ms > run.slo.coreApiP95Ms) failedGates.push("p95");
    if (errorRate > run.slo.unexpectedErrorRate) failedGates.push("error-rate");
    if (consistencyRate < run.slo.writeConsistencyRate)
      failedGates.push("consistency");
    if (resources.maximumCpuPercent > run.resourceExpansion.cpuPercent)
      failedGates.push("cpu");
    if (resources.maximumMemoryPercent > run.resourceExpansion.memoryPercent)
      failedGates.push("memory");
    if (
      resources.maximumDatabaseConnectionPercent >
      run.resourceExpansion.databaseConnectionPercent
    )
      failedGates.push("database-connections");
    if (
      attempts !== scenario.attempts ||
      unexpectedErrors !== scenario.unexpectedErrors ||
      successfulWrites !== scenario.successfulWrites ||
      consistentWrites !== scenario.consistentWrites ||
      !sameNumber(scenario.p95Ms, p95Ms) ||
      !sameNumber(scenario.p50Ms, p50Ms) ||
      !sameNumber(scenario.p99Ms, p99Ms) ||
      !sameNumber(scenario.throughputPerSecond, throughputPerSecond) ||
      !sameNumber(scenario.errorRate, errorRate) ||
      !sameNumber(scenario.consistencyRate, consistencyRate) ||
      JSON.stringify(scenario.failedGates) !== JSON.stringify(failedGates) ||
      scenario.status !== (failedGates.length === 0 ? "PASS" : "FAIL")
    ) {
      throw new Error(
        `${scenario.code} derived decision fields differ from raw samples or request counts`,
      );
    }
  }
  const page = run.scenarios[8];
  const pageP95 = round3(percentile(page.samplesMs, 0.95));
  if (
    page.p95Ms !== pageP95 ||
    page.thresholdMs !== run.slo.pageMainContentMs ||
    page.status !== (pageP95 <= page.thresholdMs ? "PASS" : "FAIL")
  ) {
    throw new Error(
      "page-main-content derived fields differ from raw latency samples",
    );
  }

  for (const scenario of run.scenarios.slice(9, 11)) {
    const pass =
      scenario.syncRows === authority.synchronousImportRows &&
      scenario.asyncRowsPerJob === authority.asynchronousImportRows &&
      scenario.concurrentAsyncJobs === authority.concurrentImportJobs &&
      Number.isFinite(scenario.syncSeconds) &&
      scenario.syncSeconds >= 0 &&
      Number.isFinite(scenario.asyncSeconds) &&
      scenario.asyncSeconds >= 0 &&
      scenario.pendingAfterRecovery === 0 &&
      scenario.oldestBacklogSecondsAfterRecovery <=
        run.resourceExpansion.oldestBacklogSecondsAfterRecovery;
    if (scenario.status !== (pass ? "PASS" : "FAIL")) {
      throw new Error(
        `${scenario.code} decision differs from raw import counts`,
      );
    }
  }

  const correctnessPass = (scenario) => {
    if (scenario.code === "session-expiry-draft-recovery") {
      return scenario.expiredStatus === 401 && scenario.recoveredRecords === 1;
    }
    const common =
      uuidPattern.test(scenario.recordId ?? "") &&
      JSON.stringify(scenario.observedStatuses) ===
        JSON.stringify([200, 409]) &&
      scenario.conflictCode === "PRODUCTION_RECORD_VERSION_CONFLICT" &&
      scenario.auditEffects === 1 &&
      scenario.eventEffects === 1;
    if (!common) return false;
    if (scenario.code === "duplicate-click-idempotency") {
      return scenario.execution === "CONCURRENT_DUPLICATE_CLICK";
    }
    if (scenario.code === "client-retry-idempotency") {
      return scenario.execution === "SEQUENTIAL_CLIENT_RETRY";
    }
    if (scenario.code === "concurrent-edit") {
      return (
        scenario.execution === "CONCURRENT_DISTINCT_CONTENT" &&
        new Set(scenario.actors ?? []).size === 2 &&
        new Set(scenario.proposedContents ?? []).size === 2 &&
        scenario.proposedContents.includes(scenario.persistedContent)
      );
    }
    if (scenario.code === "optimistic-lock") {
      return (
        scenario.execution === "SEQUENTIAL_STALE_VERSION" &&
        scenario.expectedVersion === 0 &&
        scenario.persistedVersion === 1
      );
    }
    if (scenario.code === "no-silent-overwrite") {
      return (
        scenario.execution === "CONCURRENT_DISTINCT_CONTENT_OWNERSHIP" &&
        scenario.persistedContent === scenario.winningContent &&
        scenario.persistedContent !== scenario.losingContent
      );
    }
    return scenario.execution === "CONCURRENT_SINGLE_EFFECT";
  };
  for (const scenario of run.scenarios.slice(11, 18)) {
    if (scenario.status !== (correctnessPass(scenario) ? "PASS" : "FAIL")) {
      throw new Error(
        `${scenario.code} decision differs from raw correctness checks`,
      );
    }
  }

  const databaseDecisions = [
    Number.isFinite(run.scenarios[18].durationSeconds) &&
      run.scenarios[18].durationSeconds >= 0,
    Number.isFinite(run.scenarios[19].observedConnections) &&
      run.scenarios[19].observedConnections >= 0 &&
      run.scenarios[19].observedConnections <=
        resources.maximumDatabaseConnectionsConfigured,
    Number.isFinite(run.scenarios[20].durationSeconds) &&
      run.scenarios[20].durationSeconds >= 0,
    run.scenarios[21].victims === 1,
    Number.isFinite(run.scenarios[22].durationSeconds) &&
      run.scenarios[22].durationSeconds >= 0,
    run.scenarios[23].pendingAfterRecovery === 0 &&
      run.scenarios[23].oldestBacklogSecondsAfterRecovery <=
        run.resourceExpansion.oldestBacklogSecondsAfterRecovery,
  ];
  for (const [index, pass] of databaseDecisions.entries()) {
    const scenario = run.scenarios[index + 18];
    if (scenario.status !== (pass ? "PASS" : "FAIL")) {
      throw new Error(
        `${scenario.code} decision differs from raw database observations`,
      );
    }
  }

  for (const scenario of run.scenarios.slice(24)) {
    const pass =
      Number.isFinite(scenario.recoverySeconds) &&
      scenario.recoverySeconds <= run.slo.shortRecoverySeconds &&
      (scenario.code !== "event-publisher-reconnect-cursor" ||
        scenario.cursorObserved === true) &&
      (scenario.code !== "private-content-store-interruption" ||
        scenario.failureStatus === 503);
    if (scenario.status !== (pass ? "PASS" : "FAIL")) {
      throw new Error(
        `${scenario.code} decision differs from raw recovery observations`,
      );
    }
  }
  const expectedRunStatus = run.scenarios.every(
    ({ status }) => status === "PASS",
  )
    ? "PASS"
    : "FAIL";
  if (run.status !== expectedRunStatus) {
    throw new Error("Stage 7 run status differs from scenario decisions");
  }
}

export function renderEvidence(rawRun) {
  const run = immutable(sanitized(rawRun));
  if (
    !run.runId ||
    !["LOCAL_PROPORTIONAL_ONLY", "PREPRODUCTION_EQUIVALENT"].includes(
      run.provenance,
    ) ||
    !Array.isArray(run.scenarios) ||
    !Array.isArray(run.exclusions)
  ) {
    throw new Error("Invalid Stage 7 evidence input");
  }
  const local = run.provenance === "LOCAL_PROPORTIONAL_ONLY";
  if (
    run.productionEquivalent !== !local ||
    (local && run.externalBlocker !== "EXT-005")
  ) {
    throw new Error(
      "Stage 7 productionEquivalent flag contradicts evidence provenance",
    );
  }
  if (local) {
    assertLocalBackendArtifactProvenance(run);
  }
  assertOperationalReport(run);
  if (
    !local &&
    (run.admission?.provenance !== "PREPRODUCTION_EQUIVALENT" ||
      run.admission?.productionEquivalent !== true ||
      JSON.stringify(run.admission?.candidate) !==
        JSON.stringify(run.candidates) ||
      run.admission?.profileSha256 !== run.profileSha256)
  ) {
    throw new Error("Stage 7 preproduction evidence is not admission-bound");
  }
  if (
    !local &&
    run.admission?.receiptAuthorityPublicKeySha256 !==
      run.receiptAuthorityPublicKeySha256
  ) {
    throw new Error(
      "Stage 7 preproduction evidence is not receipt-authority-bound",
    );
  }
  if (!local) verifyReplayReceiptBundle(run);
  const scenarioCodeList = run.scenarios.map(({ code }) => code);
  if (new Set(scenarioCodeList).size !== scenarioCodeList.length) {
    throw new Error("Stage 7 evidence contains a duplicate scenario result");
  }
  const scenarioCodes = new Set(
    run.scenarios.map(({ code, status }) => {
      if (
        typeof code !== "string" ||
        !["PASS", "FAIL"].includes(status) ||
        code.trim() === ""
      ) {
        throw new Error("Invalid Stage 7 dynamic scenario result");
      }
      return code;
    }),
  );
  const missingScenarios = requiredScenarios.filter((code) => {
    if (scenarioCodes.has(code)) return false;
    if (run.smoke === true && code === "sync-import-5000") {
      return !scenarioCodes.has("sync-import-smoke");
    }
    if (run.smoke === true && code === "async-import-5001-concurrent") {
      return !scenarioCodes.has("async-import-smoke");
    }
    return true;
  });
  if (missingScenarios.length > 0) {
    throw new Error(
      `Stage 7 dynamic scenario evidence is incomplete: ${missingScenarios.join(",")}`,
    );
  }
  if (local) assertLocalDerivedFacts(run);
  const correctnessResults = independentCorrectnessScenarios.map((code) =>
    run.scenarios.find((scenario) => scenario.code === code),
  );
  const correctnessRecordIds = correctnessResults.map(
    ({ recordId }) => recordId,
  );
  if (
    correctnessRecordIds.some(
      (recordId) => !uuidPattern.test(recordId ?? ""),
    ) ||
    new Set(correctnessRecordIds).size !== correctnessRecordIds.length
  ) {
    throw new Error(
      "Stage 7 correctness scenarios require distinct dynamic records",
    );
  }
  const passingCorrectnessResults = correctnessResults.filter(
    ({ status }) => status === "PASS",
  );
  if (
    passingCorrectnessResults.some(
      ({ auditEffects, eventEffects, conflictCode }) =>
        auditEffects !== 1 ||
        eventEffects !== 1 ||
        conflictCode !== "PRODUCTION_RECORD_VERSION_CONFLICT",
    )
  ) {
    throw new Error(
      "Stage 7 correctness scenarios require distinct records and independent effects",
    );
  }
  const correctnessByCode = Object.fromEntries(
    correctnessResults.map((result) => [result.code, result]),
  );
  const sequentialRetry = correctnessByCode["client-retry-idempotency"];
  const concurrentEdit = correctnessByCode["concurrent-edit"];
  const optimisticLock = correctnessByCode["optimistic-lock"];
  const silentOverwrite = correctnessByCode["no-silent-overwrite"];
  if (
    correctnessResults.every(({ status }) => status === "PASS") &&
    (sequentialRetry.execution !== "SEQUENTIAL_CLIENT_RETRY" ||
      JSON.stringify(sequentialRetry.observedStatuses) !==
        JSON.stringify([200, 409]) ||
      concurrentEdit.execution !== "CONCURRENT_DISTINCT_CONTENT" ||
      new Set(concurrentEdit.actors ?? []).size !== 2 ||
      new Set(concurrentEdit.proposedContents ?? []).size !== 2 ||
      !concurrentEdit.proposedContents.includes(
        concurrentEdit.persistedContent,
      ) ||
      optimisticLock.execution !== "SEQUENTIAL_STALE_VERSION" ||
      optimisticLock.expectedVersion !== 0 ||
      optimisticLock.persistedVersion !== 1 ||
      silentOverwrite.execution !== "CONCURRENT_DISTINCT_CONTENT_OWNERSHIP" ||
      JSON.stringify(silentOverwrite.observedStatuses) !==
        JSON.stringify([200, 409]) ||
      silentOverwrite.persistedContent !== silentOverwrite.winningContent ||
      silentOverwrite.persistedContent === silentOverwrite.losingContent)
  ) {
    throw new Error("Stage 7 correctness scenario semantics are incomplete");
  }
  const overallStatus = local
    ? run.scenarios.some(({ status }) => status !== "PASS")
      ? "LOCAL_FAIL"
      : "LOCAL_EVIDENCE_READY"
    : run.scenarios.every(({ status }) => status === "PASS")
      ? "PASS"
      : "FAIL";
  const boundary = local
    ? "This local proportional run does not establish production-equivalent performance. EXT-005 remains blocked."
    : "This run was admitted as production-equivalent preproduction evidence.";
  const display = (value) =>
    value === undefined || value === null ? "n/a" : String(value);
  const rows = run.scenarios
    .map((scenario) => {
      const errorRate =
        scenario.errorRate ??
        (Number.isFinite(scenario.unexpectedErrors) &&
        Number.isFinite(scenario.attempts) &&
        scenario.attempts > 0
          ? scenario.unexpectedErrors / scenario.attempts
          : undefined);
      return `| ${scenario.code} | ${scenario.status} | ${display(scenario.p95Ms)} | ${display(errorRate)} | ${display(scenario.throughputPerSecond)} | ${display(scenario.consistencyRate)} | ${(scenario.failedGates ?? []).join(",") || "none"} |`;
    })
    .join("\n");
  const exclusions = run.exclusions.map((item) => `- ${item}`).join("\n");
  const candidateLines = Object.entries(run.candidates ?? {})
    .map(([repository, commit]) => `- ${repository}: \`${commit}\``)
    .join("\n");
  const backendArtifactSection = local
    ? `## Backend artifact provenance\n\n- Source commit: \`${run.backendArtifact.sourceCommit}\` (clean: \`${run.backendArtifact.sourceClean}\`)\n- Build command: \`${run.backendArtifact.build.command.join(" ")}\`\n- Build environment: \`${run.backendArtifact.build.environment.javaVersion}\`; \`${run.backendArtifact.build.environment.mavenVersion}\`; \`${run.backendArtifact.build.environment.platform}/${run.backendArtifact.build.environment.architecture}\`\n- JAR: \`${run.backendArtifact.jar.relativePath}\`\n- JAR SHA-256: \`${run.backendArtifact.jar.sha256}\` (${run.backendArtifact.jar.sizeBytes} bytes)\n- JAR manifest SHA-256: \`${run.backendArtifact.jar.manifestSha256}\`\n\n`
    : "";
  const supervisorDispositionEntries = Object.entries(
    run.supervisorDisposition?.defects ?? {},
  );
  const supervisorDispositionSection =
    supervisorDispositionEntries.length === 0
      ? ""
      : `## Supervisor disposition\n\n${supervisorDispositionEntries.map(([defect, status]) => `- ${defect}: \`${status}\``).join("\n")}\n- Independent review required: \`${run.supervisorDisposition.independentReviewRequired === true}\`\n\n`;
  const operationalReportSection = `## Operational report\n\n### SLO and scaling thresholds\n\n- Core API p95: \`${display(run.slo?.coreApiP95Ms)} ms\`\n- Page main content: \`${display(run.slo?.pageMainContentMs)} ms\`\n- Unexpected error rate: \`${display(run.slo?.unexpectedErrorRate)}\`\n- Write consistency rate: \`${display(run.slo?.writeConsistencyRate)}\`\n- Short recovery: \`${display(run.slo?.shortRecoverySeconds)} seconds\`\n- Expansion thresholds: CPU \`${display(run.resourceExpansion?.cpuPercent)}%\`, memory \`${display(run.resourceExpansion?.memoryPercent)}%\`, database connections \`${display(run.resourceExpansion?.databaseConnectionPercent)}%\`, oldest backlog \`${display(run.resourceExpansion?.oldestBacklogSecondsAfterRecovery)} seconds\`\n\n### Import and backlog boundary\n\n- Synchronous rows: \`${display(run.importBoundary?.syncRows)}\`\n- Asynchronous rows per job: \`${display(run.importBoundary?.asyncRowsPerJob)}\`\n- Concurrent asynchronous jobs: \`${display(run.importBoundary?.concurrentAsyncJobs)}\`\n- Pending after recovery: \`${display(run.importBoundary?.pendingAfterRecovery)}\`\n- Oldest backlog after recovery: \`${display(run.importBoundary?.oldestBacklogSecondsAfterRecovery)} seconds\`\n\n### Resource and recovery observations\n\n- Resource samples: \`${display(run.resourceTrend?.samples)}\`\n- Maximum CPU: \`${display(run.resourceTrend?.maximumCpuPercent)}%\`\n- Maximum memory: \`${display(run.resourceTrend?.maximumMemoryPercent)}%\`\n- Maximum database connections: \`${display(run.resourceTrend?.maximumDatabaseConnections)}\` (\`${display(run.resourceTrend?.maximumDatabaseConnectionPercent)}%\`)\n- Maximum recovery: \`${display(run.maximumRecoverySeconds)} seconds\`\n\n`;
  const safeRun = { ...run, overallStatus };
  return {
    "run.json": `${JSON.stringify(safeRun, null, 2)}\n`,
    "SUMMARY.md": `# Stage 7A Summary\n\n- Run: \`${run.runId}\`\n- Provenance: \`${run.provenance}\`\n- Status: \`${overallStatus}\`\n\n${boundary}\n\n## Candidate\n\n${candidateLines}\n\n${operationalReportSection}${backendArtifactSection}${supervisorDispositionSection}## Excluded gates\n\n${exclusions}\n`,
    "MATRIX.md": `# Stage 7A Matrix\n\n${boundary}\n\n| Scenario | Status | P95 ms | Error rate | Throughput / second | Consistency rate | Failed gates |\n| --- | --- | ---: | ---: | ---: | ---: | --- |\n${rows}\n\n${operationalReportSection}${backendArtifactSection}${supervisorDispositionSection}## Excluded gates\n\n${exclusions}\n`,
    "VERIFICATION.md": `# Stage 7A Verification\n\n${boundary}\n\nThe machine-readable source is \`run.json\`. Short SLO, resource, recovery, backlog, and consistency decisions use profile \`cofco-stage7-v1\`. The standard evidence verifier regenerates every human document from that immutable machine source and rejects any byte-level drift.\n\n${operationalReportSection}${backendArtifactSection}${supervisorDispositionSection}## Excluded gates\n\n${exclusions}\n`,
    "HANDOFF.md": `# Stage 7A Handoff\n\n- Status: \`${overallStatus}\`\n- Provenance: \`${run.provenance}\`\n\n${boundary}\n\nIndependent supervision must verify the candidate, standard gates, evidence, clean repositories, and upstream alignment. No 24-hour or Stage 8 claim is made.\n\n${operationalReportSection}${backendArtifactSection}${supervisorDispositionSection}## Excluded gates\n\n${exclusions}\n`,
  };
}
