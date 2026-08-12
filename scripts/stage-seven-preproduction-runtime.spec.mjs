import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { admitRun, renderEvidence } from "./stage-seven-core.mjs";
import { executePreproductionReplay } from "./stage-seven-preproduction-runtime.mjs";

const profilePath = resolve(
  import.meta.dirname,
  "../ops/stage7-performance-resilience/profile.json",
);
const profile = JSON.parse(await readFile(profilePath, "utf8"));
const candidates = {
  backend: "1".repeat(40),
  frontend: "2".repeat(40),
  web: "3".repeat(40),
};
const profileSha256 = "a".repeat(64);
const receiptAuthority = generateKeyPairSync("ed25519");
const receiptPublicKeyDer = receiptAuthority.publicKey.export({
  type: "spki",
  format: "der",
});
const receiptPublicKeySha256 = createHash("sha256")
  .update(receiptPublicKeyDer)
  .digest("hex");
const artifacts = Object.fromEntries(
  [
    "backend",
    "business",
    "overview",
    "gateway",
    "prometheus",
    "blackbox",
    "alertmanager",
  ].map((name, index) => [
    name,
    `registry.cn-hangzhou.aliyuncs.com/cofco/${name}@sha256:${String(index + 1).repeat(64)}`,
  ]),
);

function admission() {
  return admitRun(
    {
      mode: "preproduction",
      baseUrl: "https://stage7-preproduction.example.cn",
      productionEquivalent: true,
      inputs: {
        backendCommit: candidates.backend,
        frontendCommit: candidates.frontend,
        webCommit: candidates.web,
        profileSha256,
        topologyEvidenceSha256: "b".repeat(64),
        capacityApprovalSha256: "c".repeat(64),
        faultControlApprovalSha256: "d".repeat(64),
        receiptAuthorityPublicKeySha256: receiptPublicKeySha256,
        environmentName: "preproduction",
        cloudProvider: "ALIBABA_CLOUD",
        regionId: "cn-hangzhou",
        ecsInstanceId: "i-stage7preproduction001",
        vpcId: "vpc-stage7preproduction001",
        vswitchId: "vsw-stage7preproduction001",
        rdsResourceId: "rm-stage7preproduction001",
        ossBucket: "cofco-stage7-private-evidence",
        ossEndpoint: "https://oss-cn-hangzhou-internal.aliyuncs.com",
        workloadControlEndpoint:
          "https://workload.stage7-preproduction.example.cn",
        monitoringEndpoint:
          "https://monitoring.stage7-preproduction.example.cn",
        faultControlEndpoint:
          "https://fault-control.stage7-preproduction.example.cn",
        candidateManifestPath: "/api/v1/stage7/candidate-manifest",
        ...Object.fromEntries(
          Object.entries(artifacts).map(([name, value]) => [
            `${name}Image`,
            value,
          ]),
        ),
      },
    },
    {
      candidates,
      profileSha256,
      receiptAuthorityPublicKeySha256: receiptPublicKeySha256,
    },
  );
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function candidateManifest() {
  return {
    candidates,
    profileSha256,
    artifacts,
    receiptAuthority: {
      algorithm: "ED25519",
      keyId: "stage7-local-trusted-stub",
      publicKeySpkiDerBase64: receiptPublicKeyDer.toString("base64"),
    },
  };
}

function signedPhaseResult(phase, context, calls) {
  assert.ok(
    context.receiptRequest,
    "trusted receipt challenge is missing from the phase request",
  );
  const result = {
    phase: phase.code,
    candidates,
    profileSha256,
    scenarios: (phase.expectedScenarioCodes ?? []).map(scenarioResult),
    ...(phase.code === "resource-sampling"
      ? {
          resourceTrend: {
            samples: 3,
            maximumCpuPercent: 20,
            maximumMemoryPercent: 30,
            maximumDatabaseConnections: 4,
            maximumDatabaseConnectionPercent: 40,
          },
        }
      : {}),
  };
  const payload = {
    schemaVersion: "cofco-stage7-phase-receipt-v1",
    receiptId: randomUUID(),
    phaseCode: phase.code,
    requestNonce: context.receiptRequest.nonce,
    requestSha256: sha256(context.receiptRequest),
    resultSha256: sha256(result),
    candidates,
    profileSha256,
    manifestSha256: sha256(candidateManifest()),
    artifactSetSha256: sha256(artifacts),
  };
  calls.push([phase.code, context.endpoint]);
  return {
    ...result,
    executionReceipt: {
      payload,
      signatureBase64: sign(
        null,
        Buffer.from(canonicalJson(payload)),
        receiptAuthority.privateKey,
      ).toString("base64"),
    },
  };
}

function scenarioResult(code, index) {
  const result = { code, status: "PASS", p95Ms: 200 };
  if (code === "queue-backlog-recovery") {
    return {
      ...result,
      pendingAfterRecovery: 0,
      oldestBacklogSecondsAfterRecovery: 0,
    };
  }
  if (profile.faultScenarios.includes(code)) {
    return { ...result, recoverySeconds: 1 };
  }
  const recordId = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
  const common = {
    recordId,
    conflictCode: "PRODUCTION_RECORD_VERSION_CONFLICT",
    auditEffects: 1,
    eventEffects: 1,
  };
  if (code === "duplicate-click-idempotency") {
    return {
      ...result,
      ...common,
      execution: "CONCURRENT_DUPLICATE_CLICK",
      actor: "operator-one",
      observedStatuses: [200, 409],
    };
  }
  if (code === "client-retry-idempotency") {
    return {
      ...result,
      ...common,
      execution: "SEQUENTIAL_CLIENT_RETRY",
      actor: "operator-one",
      observedStatuses: [200, 409],
    };
  }
  if (code === "concurrent-edit") {
    return {
      ...result,
      ...common,
      execution: "CONCURRENT_DISTINCT_CONTENT",
      actors: ["operator-one", "operator-two"],
      proposedContents: ["proposal-one", "proposal-two"],
      persistedContent: "proposal-one",
      winningActor: "operator-one",
      observedStatuses: [200, 409],
    };
  }
  if (code === "optimistic-lock") {
    return {
      ...result,
      ...common,
      execution: "SEQUENTIAL_STALE_VERSION",
      actors: ["operator-one", "operator-two"],
      expectedVersion: 0,
      persistedVersion: 1,
      observedStatuses: [200, 409],
    };
  }
  if (code === "no-silent-overwrite") {
    return {
      ...result,
      ...common,
      execution: "CONCURRENT_DISTINCT_CONTENT_OWNERSHIP",
      actors: ["operator-one", "operator-two"],
      winningContent: "winner",
      losingContent: "loser",
      persistedContent: "winner",
      winningActor: "operator-one",
      observedStatuses: [200, 409],
    };
  }
  if (code === "no-duplicate-business-effect") {
    return {
      ...result,
      ...common,
      execution: "CONCURRENT_SINGLE_EFFECT",
      actor: "operator-one",
      actionCode: "PRODUCTION_RECORD_SUBMITTED",
      observedStatuses: [200, 409],
    };
  }
  return result;
}

test("executes the admitted replay phases against bound driver operations", async () => {
  const admitted = admission();
  const calls = [];
  const driver = {
    async readCandidateManifest(url) {
      calls.push(["candidate-binding", url]);
      return candidateManifest();
    },
    async executePhase(phase, context) {
      return signedPhaseResult(phase, context, calls);
    },
  };

  const run = await executePreproductionReplay({
    admission: admitted,
    rawProfile: profile,
    driver,
    runId: "stage7-preproduction-runtime-test",
    now: () => "2026-08-13T00:00:00.000Z",
  });

  assert.deepEqual(
    calls.map(([code]) => code),
    [
      "candidate-binding",
      "load",
      "correctness",
      "database",
      "faults",
      "resource-sampling",
    ],
  );
  assert.equal(calls[1][1], admitted.topology.workloadControlEndpoint);
  assert.equal(calls[4][1], admitted.topology.faultControlEndpoint);
  assert.equal(calls[5][1], admitted.topology.monitoringEndpoint);
  assert.equal(run.provenance, "PREPRODUCTION_EQUIVALENT");
  assert.equal(run.productionEquivalent, true);
  assert.deepEqual(run.candidates, candidates);
  assert.equal(run.profileSha256, profileSha256);
  assert.equal(
    JSON.parse(renderEvidence(run)["run.json"]).overallStatus,
    "PASS",
  );
  const changedRunIdentity = structuredClone(run);
  changedRunIdentity.runId = "stage7-preproduction-reused-as-another-run";
  assert.throws(
    () => renderEvidence(changedRunIdentity),
    /trusted and verifiable execution receipt/u,
  );
  const changedApproval = structuredClone(run);
  changedApproval.admission.approvalEvidence.capacity = "f".repeat(64);
  assert.throws(
    () => renderEvidence(changedApproval),
    /trusted and verifiable execution receipt/u,
  );
});

test("rejects arbitrary receipt digests even when they are reused by every phase", async () => {
  const admitted = admission();
  await assert.rejects(
    () =>
      executePreproductionReplay({
        admission: admitted,
        rawProfile: profile,
        driver: {
          async readCandidateManifest() {
            return candidateManifest();
          },
          async executePhase(phase) {
            return {
              phase: phase.code,
              candidates,
              profileSha256,
              executionReceiptSha256: "f".repeat(64),
              scenarios: (phase.expectedScenarioCodes ?? []).map(
                scenarioResult,
              ),
              ...(phase.code === "resource-sampling"
                ? { resourceTrend: { samples: 1 } }
                : {}),
            };
          },
        },
      }),
    /trusted|verifiable|signed|receipt/iu,
  );
});

test("rejects a phase result changed after the trusted receipt was signed", async () => {
  const admitted = admission();
  await assert.rejects(
    () =>
      executePreproductionReplay({
        admission: admitted,
        rawProfile: profile,
        driver: {
          async readCandidateManifest() {
            return candidateManifest();
          },
          async executePhase(phase, context) {
            const signed = signedPhaseResult(phase, context, []);
            signed.scenarios = signed.scenarios.map((scenario, index) =>
              index === 0 ? { ...scenario, p95Ms: 999 } : scenario,
            );
            return signed;
          },
        },
      }),
    /trusted and verifiable execution receipt/u,
  );
});

test("rejects a signed receipt reused by a different replay phase", async () => {
  const admitted = admission();
  let reusedReceipt;
  await assert.rejects(
    () =>
      executePreproductionReplay({
        admission: admitted,
        rawProfile: profile,
        driver: {
          async readCandidateManifest() {
            return candidateManifest();
          },
          async executePhase(phase, context) {
            const signed = signedPhaseResult(phase, context, []);
            if (!reusedReceipt) reusedReceipt = signed.executionReceipt;
            else signed.executionReceipt = reusedReceipt;
            return signed;
          },
        },
      }),
    /trusted and verifiable execution receipt|unique across phases/u,
  );
});

test("rejects a request challenge changed by the phase driver", async () => {
  const admitted = admission();
  await assert.rejects(
    () =>
      executePreproductionReplay({
        admission: admitted,
        rawProfile: profile,
        driver: {
          async readCandidateManifest() {
            return candidateManifest();
          },
          async executePhase(phase, context) {
            context.receiptRequest = {
              ...context.receiptRequest,
              candidates: { ...candidates, backend: "f".repeat(40) },
            };
            return signedPhaseResult(phase, context, []);
          },
        },
      }),
    /trusted and verifiable execution receipt/u,
  );
});

test("rejects a phase response without an auditable execution receipt", async () => {
  const admitted = admission();
  await assert.rejects(
    () =>
      executePreproductionReplay({
        admission: admitted,
        rawProfile: profile,
        driver: {
          async readCandidateManifest() {
            return candidateManifest();
          },
          async executePhase(phase) {
            return {
              phase: phase.code,
              candidates,
              profileSha256,
              scenarios: (phase.expectedScenarioCodes ?? []).map(
                scenarioResult,
              ),
            };
          },
        },
      }),
    /trusted and verifiable execution receipt/u,
  );
});

test("fails closed before workload execution when the candidate manifest drifts", async () => {
  const admitted = admission();
  let phases = 0;
  await assert.rejects(
    () =>
      executePreproductionReplay({
        admission: admitted,
        rawProfile: profile,
        driver: {
          async readCandidateManifest() {
            return {
              candidates: { ...candidates, web: "f".repeat(40) },
              profileSha256,
              artifacts,
              receiptAuthority: candidateManifest().receiptAuthority,
            };
          },
          async executePhase() {
            phases += 1;
          },
        },
      }),
    /candidate manifest does not match admitted replay/u,
  );
  assert.equal(phases, 0);
});

test("fails closed before workload execution when a manifest image digest drifts", async () => {
  const admitted = admission();
  let phases = 0;
  await assert.rejects(
    () =>
      executePreproductionReplay({
        admission: admitted,
        rawProfile: profile,
        driver: {
          async readCandidateManifest() {
            const manifest = candidateManifest();
            manifest.artifacts = {
              ...manifest.artifacts,
              backend: manifest.artifacts.backend.replace(
                /sha256:[a-f0-9]{64}$/u,
                `sha256:${"f".repeat(64)}`,
              ),
            };
            return manifest;
          },
          async executePhase() {
            phases += 1;
          },
        },
      }),
    /candidate manifest does not match admitted replay/u,
  );
  assert.equal(phases, 0);
});
