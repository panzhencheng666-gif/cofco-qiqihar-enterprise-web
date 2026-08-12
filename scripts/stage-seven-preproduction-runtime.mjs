import { randomUUID } from "node:crypto";

import { buildPreproductionReplayPlan } from "./stage-seven-core.mjs";
import {
  canonicalSha256,
  createPhaseReceiptRequest,
  receiptAuthorityFromManifest,
  verifyPhaseExecutionReceipt,
} from "./stage-seven-receipts.mjs";

const sensitiveKey =
  /(password|secret|token|cookie|credential|access.?key|session.?state)/iu;

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertSecretFree(value, path = "replay") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSecretFree(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (sensitiveKey.test(key)) {
      throw new Error(
        `Sensitive key is forbidden in Stage 7 replay output: ${path}.${key}`,
      );
    }
    assertSecretFree(nested, `${path}.${key}`);
  }
}

function assertExactCodes(actual, expected, label) {
  if (
    actual.some((code) => typeof code !== "string" || code.trim() === "") ||
    new Set(actual).size !== actual.length ||
    !sameJson([...actual].sort(), [...expected].sort())
  ) {
    throw new Error(
      `${label} returned incomplete or unexpected scenario evidence`,
    );
  }
}

function assertBoundResult(result, phase, admission) {
  if (
    !result ||
    result.phase !== phase.code ||
    !sameJson(result.candidates, admission.candidate) ||
    result.profileSha256 !== admission.profileSha256
  ) {
    throw new Error(`${phase.code} result is not bound to the admitted replay`);
  }
  const scenarios = result.scenarios ?? [];
  if (!Array.isArray(scenarios)) {
    throw new Error(`${phase.code} returned invalid scenario evidence`);
  }
  assertExactCodes(
    scenarios.map(({ code }) => code),
    phase.expectedScenarioCodes,
    phase.code,
  );
  for (const scenario of scenarios) {
    if (!scenario || !["PASS", "FAIL"].includes(scenario.status)) {
      throw new Error(`${phase.code} returned invalid scenario evidence`);
    }
  }
  if (
    phase.code === "resource-sampling" &&
    (!Number.isInteger(result.resourceTrend?.samples) ||
      result.resourceTrend.samples < 1)
  ) {
    throw new Error("resource-sampling returned no resource samples");
  }
  assertSecretFree(result);
  return result;
}

function assertCandidateManifest(manifest, admission) {
  if (
    !manifest ||
    !sameJson(manifest.candidates, admission.candidate) ||
    manifest.profileSha256 !== admission.profileSha256 ||
    !sameJson(manifest.artifacts, admission.artifacts)
  ) {
    throw new Error("candidate manifest does not match admitted replay");
  }
  assertSecretFree(manifest, "candidateManifest");
  const { publicKey } = receiptAuthorityFromManifest(
    manifest,
    admission.receiptAuthorityPublicKeySha256,
  );
  return {
    artifactSetSha256: canonicalSha256(admission.artifacts),
    manifestSha256: canonicalSha256(manifest),
    publicKey,
  };
}

export async function executePreproductionReplay({
  admission,
  rawProfile,
  driver,
  runId = `stage7-preproduction-${randomUUID()}`,
  now = () => new Date().toISOString(),
}) {
  if (
    typeof driver?.readCandidateManifest !== "function" ||
    typeof driver?.executePhase !== "function"
  ) {
    throw new Error("Stage 7 preproduction replay driver is incomplete");
  }
  const plan = buildPreproductionReplayPlan(admission, rawProfile);
  const startedAt = now();
  const manifest = await driver.readCandidateManifest(
    plan.target.candidateManifestUrl,
  );
  const manifestBinding = assertCandidateManifest(manifest, admission);
  const phaseReceipts = [];
  const seenReceiptIds = new Set();
  const seenRequestNonces = new Set();
  const scenarios = [];
  let resourceTrend;
  for (const phase of plan.phases.filter(
    ({ code }) => !["candidate-binding", "evidence"].includes(code),
  )) {
    const receiptRequest = createPhaseReceiptRequest({
      runId,
      phase,
      nonce: randomUUID(),
      candidates: admission.candidate,
      profileSha256: admission.profileSha256,
      manifestSha256: manifestBinding.manifestSha256,
      artifactSetSha256: manifestBinding.artifactSetSha256,
      approvalEvidence: admission.approvalEvidence,
      target: plan.target,
    });
    const untrustedResult = await driver.executePhase(phase, {
      candidates: structuredClone(admission.candidate),
      profileSha256: admission.profileSha256,
      approvalEvidence: structuredClone(admission.approvalEvidence),
      target: structuredClone(plan.target),
      endpoint: phase.endpoint,
      receiptRequest: structuredClone(receiptRequest),
    });
    const { executionReceipt, ...resultBody } = untrustedResult ?? {};
    const result = assertBoundResult(resultBody, phase, admission);
    const verifiedReceipt = verifyPhaseExecutionReceipt({
      code: phase.code,
      runId,
      request: receiptRequest,
      result,
      executionReceipt,
      candidates: admission.candidate,
      profileSha256: admission.profileSha256,
      manifestSha256: manifestBinding.manifestSha256,
      artifactSetSha256: manifestBinding.artifactSetSha256,
      approvalEvidence: admission.approvalEvidence,
      target: plan.target,
      publicKey: manifestBinding.publicKey,
      seenReceiptIds,
      seenRequestNonces,
    });
    scenarios.push(...result.scenarios);
    if (phase.code === "resource-sampling") {
      resourceTrend = structuredClone(result.resourceTrend);
    }
    phaseReceipts.push(verifiedReceipt);
  }
  const backlog = scenarios.find(
    ({ code }) => code === "queue-backlog-recovery",
  );
  const recoveries = scenarios
    .map(({ recoverySeconds }) => recoverySeconds)
    .filter(Number.isFinite);
  const run = {
    runId,
    startedAt,
    completedAt: now(),
    provenance: "PREPRODUCTION_EQUIVALENT",
    productionEquivalent: true,
    candidates: structuredClone(admission.candidate),
    profileSha256: admission.profileSha256,
    admission: structuredClone(admission),
    receiptAuthorityPublicKeySha256: admission.receiptAuthorityPublicKeySha256,
    authority: structuredClone(rawProfile.authority),
    slo: structuredClone(rawProfile.slo),
    resourceExpansion: structuredClone(rawProfile.resourceExpansion),
    importBoundary: {
      syncRows: rawProfile.authority.synchronousImportRows,
      asyncRowsPerJob: rawProfile.authority.asynchronousImportRows,
      concurrentAsyncJobs: rawProfile.authority.concurrentImportJobs,
      pendingAfterRecovery: backlog?.pendingAfterRecovery,
      oldestBacklogSecondsAfterRecovery:
        backlog?.oldestBacklogSecondsAfterRecovery,
    },
    replay: {
      schemaVersion: plan.schemaVersion,
      candidateManifest: structuredClone(manifest),
      manifestSha256: manifestBinding.manifestSha256,
      artifactSetSha256: manifestBinding.artifactSetSha256,
      target: structuredClone(plan.target),
      phaseReceipts,
    },
    scenarios,
    resourceTrend,
    maximumRecoverySeconds:
      recoveries.length > 0 ? Math.max(...recoveries) : undefined,
    exclusions: structuredClone(plan.exclusions),
  };
  assertSecretFree(run);
  return run;
}

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
    redirect: "error",
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    await response.arrayBuffer();
    throw new Error(
      `Stage 7 replay control request failed with HTTP ${response.status}`,
    );
  }
  return response.json();
}

export function createHttpsPreproductionDriver() {
  return {
    readCandidateManifest(url) {
      return jsonRequest(url);
    },
    executePhase(phase, context) {
      const path =
        phase.code === "resource-sampling"
          ? "/api/v1/stage7/replay/resource-samples"
          : `/api/v1/stage7/replay/${phase.code}`;
      return jsonRequest(new URL(path, context.endpoint), {
        method: "POST",
        body: JSON.stringify({
          phase,
          candidates: context.candidates,
          profileSha256: context.profileSha256,
          approvalEvidence: context.approvalEvidence,
          target: context.target,
          receiptRequest: context.receiptRequest,
        }),
      });
    },
  };
}
