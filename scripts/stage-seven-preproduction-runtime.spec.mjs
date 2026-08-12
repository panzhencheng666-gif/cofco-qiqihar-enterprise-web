import assert from "node:assert/strict";
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
    { candidates, profileSha256 },
  );
}

function scenarioResult(code, index) {
  const result = { code, status: "PASS", p95Ms: 200 };
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
      return {
        candidates,
        profileSha256,
        artifacts,
      };
    },
    async executePhase(phase, context) {
      calls.push([phase.code, context.endpoint]);
      return {
        phase: phase.code,
        candidates,
        profileSha256,
        executionReceiptSha256: String(calls.length).repeat(64),
        scenarios: (phase.expectedScenarioCodes ?? []).map(scenarioResult),
        ...(phase.code === "resource-sampling"
          ? { resourceTrend: { samples: 3, maximumCpuPercent: 20 } }
          : {}),
      };
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
            return { candidates, profileSha256, artifacts };
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
    /not bound to the admitted replay/u,
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
