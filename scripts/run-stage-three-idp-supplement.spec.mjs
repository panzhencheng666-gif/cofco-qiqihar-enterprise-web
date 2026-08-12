import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(
  new URL("./run-stage-three-idp-supplement.mjs", import.meta.url),
);

function approvedInputEnvironment(directory) {
  const employeeAState = join(directory, "employee-a-state.json");
  const employeeBState = join(directory, "employee-b-state.json");
  const invalidationConfirmation = join(
    directory,
    "invalidation-confirmed.json",
  );
  for (const path of [employeeAState, employeeBState]) {
    writeFileSync(path, '{"cookies":[],"origins":[]}\n', "utf8");
    chmodSync(path, 0o600);
  }
  return {
    ...process.env,
    STAGE3_IDP_BASE_URL: "https://idp-stage.example.test",
    STAGE3_IDP_TENANT_REFERENCE: "approved-tenant-reference",
    STAGE3_IDP_OIDC_ISSUER_URI:
      "https://issuer.example.test/approved-tenant/v2.0",
    STAGE3_IDP_OIDC_CLIENT_ID: "approved-client-id",
    STAGE3_IDP_LOGIN_ENTRY_URI:
      "https://issuer.example.test/approved-tenant/authorize",
    STAGE3_IDP_REDIRECT_URI:
      "https://idp-stage.example.test/login/oauth2/code/enterprise",
    STAGE3_IDP_EMPLOYEE_A_STORAGE_STATE_FILE: employeeAState,
    STAGE3_IDP_EMPLOYEE_A_SUBJECT_SHA256: "a".repeat(64),
    STAGE3_IDP_EMPLOYEE_A_EXPECTED_ROLES: "BUSINESS_OPERATOR,BUSINESS_REVIEWER",
    STAGE3_IDP_EMPLOYEE_B_STORAGE_STATE_FILE: employeeBState,
    STAGE3_IDP_EMPLOYEE_B_SUBJECT_SHA256: "b".repeat(64),
    STAGE3_IDP_EMPLOYEE_B_EXPECTED_ROLES:
      "BUSINESS_REPORTER,BUSINESS_PUBLISHER",
    STAGE3_IDP_INVALIDATION_TARGET: "B",
    STAGE3_IDP_INVALIDATION_MODE: "revocation",
    STAGE3_IDP_INVALIDATION_CONFIRMATION_FILE: invalidationConfirmation,
  };
}

test("records BLOCKED_EXTERNAL without echoing secret-bearing values when approved IdP inputs are absent", () => {
  const evidenceDirectory = mkdtempSync(join(tmpdir(), "stage3-idp-missing-"));
  const secretSentinel = "must-never-appear-in-output";
  const result = spawnSync(
    process.execPath,
    [script, "--check-inputs-only", "--evidence-dir", evidenceDirectory],
    {
      encoding: "utf8",
      env: { ...process.env, STAGE3_IDP_CLIENT_SECRET: secretSentinel },
    },
  );

  assert.equal(result.status, 2);
  const combinedOutput = `${result.stdout}${result.stderr}`;
  assert.doesNotMatch(combinedOutput, new RegExp(secretSentinel, "u"));
  const evidence = JSON.parse(
    readFileSync(join(evidenceDirectory, "idp-supplement-result.json"), "utf8"),
  );
  assert.equal(evidence.status, "BLOCKED_EXTERNAL");
  assert.ok(evidence.missingInputs.includes("STAGE3_IDP_BASE_URL"));
  assert.ok(evidence.missingInputs.includes("STAGE3_IDP_OIDC_ISSUER_URI"));
  assert.equal(JSON.stringify(evidence).includes(secretSentinel), false);
});

test("accepts only a replay-ready two-employee, four-role parameter set without reading credentials", () => {
  const evidenceDirectory = mkdtempSync(join(tmpdir(), "stage3-idp-ready-"));
  const result = spawnSync(
    process.execPath,
    [script, "--check-inputs-only", "--evidence-dir", evidenceDirectory],
    { encoding: "utf8", env: approvedInputEnvironment(evidenceDirectory) },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    existsSync(join(evidenceDirectory, "idp-supplement-result.json")),
    true,
  );
  const evidenceText = readFileSync(
    join(evidenceDirectory, "idp-supplement-result.json"),
    "utf8",
  );
  const evidence = JSON.parse(evidenceText);
  assert.equal(evidence.status, "READY_FOR_EXTERNAL_REPLAY");
  assert.equal(evidence.employeeCount, 2);
  assert.equal(evidence.distinctExpectedRoleCount, 4);
  assert.equal(evidence.storageStateFilesOwnerOnly, true);
  assert.equal(evidenceText.includes("employee-a-state.json"), false);
  assert.equal(evidenceText.includes("a".repeat(64)), false);
});

test("rejects an IdP redirect that does not use the fixed enterprise callback path", () => {
  const evidenceDirectory = mkdtempSync(join(tmpdir(), "stage3-idp-callback-"));
  const result = spawnSync(
    process.execPath,
    [script, "--check-inputs-only", "--evidence-dir", evidenceDirectory],
    {
      encoding: "utf8",
      env: {
        ...approvedInputEnvironment(evidenceDirectory),
        STAGE3_IDP_REDIRECT_URI:
          "https://idp-stage.example.test/login/oauth2/callback/enterprise",
      },
    },
  );

  assert.equal(result.status, 2);
  const evidence = JSON.parse(
    readFileSync(join(evidenceDirectory, "idp-supplement-result.json"), "utf8"),
  );
  assert.equal(evidence.status, "BLOCKED_EXTERNAL");
  assert.ok(
    evidence.invalidInputs.includes("STAGE3_IDP_REDIRECT_URI_CALLBACK_PATH"),
  );
});
