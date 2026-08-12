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

const cloudInputKeys = [
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
];

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
  const serialized = JSON.stringify(input);
  if (requiredScenarios.some((code) => !serialized.includes(`"${code}"`))) {
    throw new Error(
      "Stage 7 correctness or fault scenario coverage is incomplete",
    );
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

export function admitRun(request) {
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
  let url;
  try {
    url = new URL(request.baseUrl);
  } catch {
    throw new StageSevenAdmissionError("approved HTTPS base URL is missing");
  }
  if (
    url.protocol !== "https:" ||
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname) ||
    request.productionEquivalent !== true
  ) {
    throw new StageSevenAdmissionError(
      "loopback, non-HTTPS, or unapproved production-equivalent target",
    );
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
  return {
    mode: "preproduction",
    provenance: "PREPRODUCTION_EQUIVALENT",
    productionEquivalent: true,
    baseUrl: url.origin,
    candidate: {
      backend: request.inputs.backendCommit,
      frontend: request.inputs.frontendCommit,
      web: request.inputs.webCommit,
    },
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

export function renderEvidence(rawRun) {
  const run = sanitized(rawRun);
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
  const local = run.provenance === "LOCAL_PROPORTIONAL_ONLY";
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
  const rows = run.scenarios
    .map(
      (scenario) =>
        `| ${scenario.code} | ${scenario.status} | ${scenario.p95Ms ?? "n/a"} | ${(scenario.failedGates ?? []).join(",") || "none"} |`,
    )
    .join("\n");
  const exclusions = run.exclusions.map((item) => `- ${item}`).join("\n");
  const candidateLines = Object.entries(run.candidates ?? {})
    .map(([repository, commit]) => `- ${repository}: \`${commit}\``)
    .join("\n");
  const safeRun = { ...run, overallStatus };
  return {
    "run.json": `${JSON.stringify(safeRun, null, 2)}\n`,
    "SUMMARY.md": `# Stage 7A Summary\n\n- Run: \`${run.runId}\`\n- Provenance: \`${run.provenance}\`\n- Status: \`${overallStatus}\`\n\n${boundary}\n\n## Candidate\n\n${candidateLines}\n\n## Excluded gates\n\n${exclusions}\n`,
    "MATRIX.md": `# Stage 7A Matrix\n\n${boundary}\n\n| Scenario | Status | P95 ms | Failed gates |\n| --- | --- | ---: | --- |\n${rows}\n\n## Excluded gates\n\n${exclusions}\n`,
    "VERIFICATION.md": `# Stage 7A Verification\n\n${boundary}\n\nThe machine-readable source is \`run.json\`. Short SLO, resource, recovery, backlog, and consistency decisions use profile \`cofco-stage7-v1\`.\n\n## Excluded gates\n\n${exclusions}\n`,
    "HANDOFF.md": `# Stage 7A Handoff\n\n- Status: \`${overallStatus}\`\n- Provenance: \`${run.provenance}\`\n\n${boundary}\n\nIndependent supervision must verify the candidate, standard gates, evidence, clean repositories, and upstream alignment. No 24-hour or Stage 8 claim is made.\n\n## Excluded gates\n\n${exclusions}\n`,
  };
}
