import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const requiredInputs = [
  "STAGE3_IDP_BASE_URL",
  "STAGE3_IDP_TENANT_REFERENCE",
  "STAGE3_IDP_OIDC_ISSUER_URI",
  "STAGE3_IDP_OIDC_CLIENT_ID",
  "STAGE3_IDP_LOGIN_ENTRY_URI",
  "STAGE3_IDP_REDIRECT_URI",
  "STAGE3_IDP_EMPLOYEE_A_STORAGE_STATE_FILE",
  "STAGE3_IDP_EMPLOYEE_A_SUBJECT_SHA256",
  "STAGE3_IDP_EMPLOYEE_A_EXPECTED_ROLES",
  "STAGE3_IDP_EMPLOYEE_B_STORAGE_STATE_FILE",
  "STAGE3_IDP_EMPLOYEE_B_SUBJECT_SHA256",
  "STAGE3_IDP_EMPLOYEE_B_EXPECTED_ROLES",
  "STAGE3_IDP_INVALIDATION_TARGET",
  "STAGE3_IDP_INVALIDATION_MODE",
  "STAGE3_IDP_INVALIDATION_CONFIRMATION_FILE",
];

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const evidenceDirectory = resolve(
  argumentValue("--evidence-dir") ?? "test-results/stage-three-idp-supplement",
);
mkdirSync(evidenceDirectory, { recursive: true });

function writeEvidence(evidence) {
  writeFileSync(
    resolve(evidenceDirectory, "idp-supplement-result.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );
}

const missingInputs = requiredInputs.filter(
  (name) => !process.env[name]?.trim(),
);
if (missingInputs.length > 0) {
  const evidence = {
    schemaVersion: 1,
    stage: "3C",
    scope: "ENTERPRISE_IDP_SUPPLEMENT",
    status: "BLOCKED_EXTERNAL",
    missingInputs,
    secretValuesRecorded: false,
  };
  writeEvidence(evidence);
  process.stderr.write(
    `BLOCKED_EXTERNAL: missing approved inputs: ${missingInputs.join(", ")}\n`,
  );
  process.exit(2);
}

const invalidInputs = [];
let baseUrl;
try {
  baseUrl = new URL(process.env.STAGE3_IDP_BASE_URL);
  if (
    baseUrl.protocol !== "https:" ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash
  ) {
    invalidInputs.push("STAGE3_IDP_BASE_URL");
  }
} catch {
  invalidInputs.push("STAGE3_IDP_BASE_URL");
}

function approvedHttpsUri(name, { allowQuery = false } = {}) {
  try {
    const url = new URL(process.env[name]);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash ||
      (!allowQuery && url.search)
    ) {
      invalidInputs.push(name);
    }
    return url;
  } catch {
    invalidInputs.push(name);
    return null;
  }
}

approvedHttpsUri("STAGE3_IDP_OIDC_ISSUER_URI");
approvedHttpsUri("STAGE3_IDP_LOGIN_ENTRY_URI", { allowQuery: true });
const redirectUri = approvedHttpsUri("STAGE3_IDP_REDIRECT_URI");
if (baseUrl && redirectUri && baseUrl.origin !== redirectUri.origin) {
  invalidInputs.push("STAGE3_IDP_REDIRECT_URI_SAME_ORIGIN");
}

const storageStateFiles = [
  resolve(process.env.STAGE3_IDP_EMPLOYEE_A_STORAGE_STATE_FILE),
  resolve(process.env.STAGE3_IDP_EMPLOYEE_B_STORAGE_STATE_FILE),
];
let storageStateFilesOwnerOnly = true;
if (storageStateFiles[0] === storageStateFiles[1]) {
  invalidInputs.push("STAGE3_IDP_EMPLOYEE_STORAGE_STATE_FILES_DISTINCT");
}
for (const [index, path] of storageStateFiles.entries()) {
  const inputName = `STAGE3_IDP_EMPLOYEE_${index === 0 ? "A" : "B"}_STORAGE_STATE_FILE`;
  try {
    const stat = statSync(path);
    if (!stat.isFile()) invalidInputs.push(inputName);
    if ((stat.mode & 0o077) !== 0) {
      storageStateFilesOwnerOnly = false;
      invalidInputs.push(`${inputName}_OWNER_ONLY`);
    }
  } catch {
    invalidInputs.push(inputName);
  }
}

const subjectDigests = [
  process.env.STAGE3_IDP_EMPLOYEE_A_SUBJECT_SHA256.toLowerCase(),
  process.env.STAGE3_IDP_EMPLOYEE_B_SUBJECT_SHA256.toLowerCase(),
];
for (const [index, digest] of subjectDigests.entries()) {
  if (!/^[a-f0-9]{64}$/u.test(digest)) {
    invalidInputs.push(
      `STAGE3_IDP_EMPLOYEE_${index === 0 ? "A" : "B"}_SUBJECT_SHA256`,
    );
  }
}
if (subjectDigests[0] === subjectDigests[1]) {
  invalidInputs.push("STAGE3_IDP_EMPLOYEE_SUBJECTS_DISTINCT");
}

function roleSet(name) {
  const roles = new Set(
    process.env[name]
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean),
  );
  if (
    roles.size === 0 ||
    [...roles].some((role) => !/^[A-Z][A-Z0-9_]*$/u.test(role))
  ) {
    invalidInputs.push(name);
  }
  return roles;
}

const employeeARoles = roleSet("STAGE3_IDP_EMPLOYEE_A_EXPECTED_ROLES");
const employeeBRoles = roleSet("STAGE3_IDP_EMPLOYEE_B_EXPECTED_ROLES");
const distinctExpectedRoles = new Set([...employeeARoles, ...employeeBRoles]);
if (distinctExpectedRoles.size < 4) {
  invalidInputs.push("STAGE3_IDP_EXPECTED_ROLE_UNION_MINIMUM_FOUR");
}
if (!/^[AB]$/u.test(process.env.STAGE3_IDP_INVALIDATION_TARGET)) {
  invalidInputs.push("STAGE3_IDP_INVALIDATION_TARGET");
}
if (!/^(expiry|revocation)$/u.test(process.env.STAGE3_IDP_INVALIDATION_MODE)) {
  invalidInputs.push("STAGE3_IDP_INVALIDATION_MODE");
}
const invalidationExpectedStatus = Number(
  process.env.STAGE3_IDP_INVALIDATION_EXPECTED_STATUS ?? "401",
);
if (![401, 403].includes(invalidationExpectedStatus)) {
  invalidInputs.push("STAGE3_IDP_INVALIDATION_EXPECTED_STATUS");
}

if (invalidInputs.length > 0) {
  const uniqueInvalidInputs = [...new Set(invalidInputs)];
  writeEvidence({
    schemaVersion: 1,
    stage: "3C",
    scope: "ENTERPRISE_IDP_SUPPLEMENT",
    status: "BLOCKED_EXTERNAL",
    invalidInputs: uniqueInvalidInputs,
    secretValuesRecorded: false,
  });
  process.stderr.write(
    `BLOCKED_EXTERNAL: invalid approved inputs: ${uniqueInvalidInputs.join(", ")}\n`,
  );
  process.exit(2);
}

if (process.argv.includes("--check-inputs-only")) {
  writeEvidence({
    schemaVersion: 1,
    stage: "3C",
    scope: "ENTERPRISE_IDP_SUPPLEMENT",
    status: "READY_FOR_EXTERNAL_REPLAY",
    employeeCount: 2,
    distinctEmployeeSubjects: true,
    distinctExpectedRoleCount: distinctExpectedRoles.size,
    storageStateFilesOwnerOnly,
    invalidationMode: process.env.STAGE3_IDP_INVALIDATION_MODE,
    invalidationTargetAlias: process.env.STAGE3_IDP_INVALIDATION_TARGET,
    approvedOidcParametersPresent: true,
    secretValuesRecorded: false,
  });
  process.exit(0);
}

const employees = [
  {
    alias: "A",
    storageStateFile: storageStateFiles[0],
    subjectDigest: subjectDigests[0],
    expectedRoles: employeeARoles,
  },
  {
    alias: "B",
    storageStateFile: storageStateFiles[1],
    subjectDigest: subjectDigests[1],
    expectedRoles: employeeBRoles,
  },
];
const protectedRoute =
  process.env.STAGE3_IDP_PROTECTED_ROUTE ?? "/#/我的工作/待我处理";
const authenticatedText =
  process.env.STAGE3_IDP_AUTHENTICATED_TEXT ?? "我的工作";
const invalidatedBoundaryHeading =
  process.env.STAGE3_IDP_INVALIDATED_BOUNDARY_HEADING ??
  (invalidationExpectedStatus === 401 ? "登录企业账号" : "账号暂不可用");

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sanitizeBrowserUrl(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "UNPARSEABLE_URL";
  }
}

function trackDiagnostics(page) {
  const errors = [];
  const failingResponses = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    errors.push({
      kind: "console",
      type: message.type(),
      text: message.text(),
      url: sanitizeBrowserUrl(message.location().url),
    });
  });
  page.on("pageerror", (error) => {
    errors.push({ kind: "pageerror", text: error.message });
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    failingResponses.push({
      status: response.status(),
      url: sanitizeBrowserUrl(response.url()),
    });
  });
  return { errors, failingResponses };
}

function sessionData(payload) {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("data" in payload) ||
    typeof payload.data !== "object" ||
    payload.data === null
  ) {
    throw new Error("SESSION_RESPONSE_DATA_MISSING");
  }
  const session = payload.data;
  if (typeof session.subjectId !== "string") {
    throw new Error("SESSION_SUBJECT_MISSING");
  }
  if (
    !Array.isArray(session.roleCodes) ||
    session.roleCodes.some((role) => typeof role !== "string")
  ) {
    throw new Error("SESSION_ROLES_MISSING");
  }
  return session;
}

async function verifyAuthenticatedEmployee(browser, employee) {
  const context = await browser.newContext({
    storageState: employee.storageStateFile,
  });
  try {
    const response = await context.request.get(
      new URL("/api/v1/session/me", baseUrl).href,
      { failOnStatusCode: false },
    );
    if (response.status() !== 200) {
      throw new Error(
        `EMPLOYEE_${employee.alias}_SESSION_HTTP_${response.status()}`,
      );
    }
    const session = sessionData(await response.json());
    if (sha256(session.subjectId) !== employee.subjectDigest) {
      throw new Error(`EMPLOYEE_${employee.alias}_SUBJECT_MISMATCH`);
    }
    const actualRoles = new Set(session.roleCodes);
    if ([...employee.expectedRoles].some((role) => !actualRoles.has(role))) {
      throw new Error(`EMPLOYEE_${employee.alias}_ROLE_MISMATCH`);
    }

    const page = await context.newPage();
    const diagnostics = trackDiagnostics(page);
    await page.goto(new URL(protectedRoute, baseUrl).href, {
      waitUntil: "domcontentloaded",
    });
    await page.getByText(authenticatedText, { exact: true }).first().waitFor({
      state: "visible",
      timeout: 30_000,
    });
    return {
      alias: employee.alias,
      sessionHttpStatus: response.status(),
      expectedRoleCount: employee.expectedRoles.size,
      observedRoleCount: actualRoles.size,
      observedRoleCodes: [...actualRoles].sort(),
      subjectMatchedBySha256: true,
      browserErrors: diagnostics.errors,
      failingHttpResponses: diagnostics.failingResponses,
    };
  } finally {
    await context.close();
  }
}

async function waitForInvalidationConfirmation(runNonce) {
  const confirmationPath = resolve(
    process.env.STAGE3_IDP_INVALIDATION_CONFIRMATION_FILE,
  );
  const timeoutMs = Number(
    process.env.STAGE3_IDP_INVALIDATION_TIMEOUT_MS ?? "600000",
  );
  if (
    !Number.isFinite(timeoutMs) ||
    timeoutMs < 1_000 ||
    timeoutMs > 3_600_000
  ) {
    throw new Error("STAGE3_IDP_INVALIDATION_TIMEOUT_MS_INVALID");
  }
  const deadline = Date.now() + timeoutMs;
  let nextProgressAt = Date.now();
  while (Date.now() < deadline) {
    if (existsSync(confirmationPath)) {
      let confirmation;
      try {
        confirmation = JSON.parse(readFileSync(confirmationPath, "utf8"));
      } catch {
        confirmation = null;
      }
      if (
        confirmation?.runNonce === runNonce &&
        typeof confirmation.approvalReference === "string" &&
        confirmation.approvalReference.trim() &&
        typeof confirmation.confirmedAt === "string" &&
        !Number.isNaN(Date.parse(confirmation.confirmedAt))
      ) {
        return {
          approvalReferenceSha256: sha256(confirmation.approvalReference),
          confirmedAt: confirmation.confirmedAt,
        };
      }
    }
    if (Date.now() >= nextProgressAt) {
      process.stdout.write(
        "Waiting for the approved out-of-band IdP invalidation confirmation marker.\n",
      );
      nextProgressAt = Date.now() + 30_000;
    }
    await delay(1_000);
  }
  throw new Error("IDP_INVALIDATION_CONFIRMATION_TIMEOUT");
}

async function verifyInvalidatedEmployee(browser, employee) {
  const context = await browser.newContext({
    storageState: employee.storageStateFile,
  });
  try {
    const response = await context.request.get(
      new URL("/api/v1/session/me", baseUrl).href,
      { failOnStatusCode: false },
    );
    if (response.status() !== invalidationExpectedStatus) {
      throw new Error(
        `INVALIDATED_EMPLOYEE_${employee.alias}_HTTP_${response.status()}`,
      );
    }
    const page = await context.newPage();
    const diagnostics = trackDiagnostics(page);
    await page.goto(new URL(protectedRoute, baseUrl).href, {
      waitUntil: "domcontentloaded",
    });
    await page
      .getByRole("heading", { name: invalidatedBoundaryHeading })
      .waitFor({ state: "visible", timeout: 30_000 });
    if (await page.getByText(authenticatedText, { exact: true }).count()) {
      throw new Error("INVALIDATED_EMPLOYEE_BUSINESS_SHELL_VISIBLE");
    }
    return {
      alias: employee.alias,
      sessionHttpStatus: response.status(),
      failClosedBoundaryVisible: true,
      businessShellVisible: false,
      browserErrors: diagnostics.errors,
      failingHttpResponses: diagnostics.failingResponses,
    };
  } finally {
    await context.close();
  }
}

async function runReplay() {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const initialEmployees = [];
    for (const employee of employees) {
      initialEmployees.push(
        await verifyAuthenticatedEmployee(browser, employee),
      );
    }
    const runNonce = randomUUID();
    const invalidationRequest = {
      schemaVersion: 1,
      runNonce,
      requestedAt: new Date().toISOString(),
      targetEmployeeAlias: process.env.STAGE3_IDP_INVALIDATION_TARGET,
      mode: process.env.STAGE3_IDP_INVALIDATION_MODE,
      instruction:
        "Enterprise identity owner performs the approved expiry/revocation out of band, then writes the confirmation marker with this runNonce, approvalReference, and confirmedAt. Do not place credentials or tokens in the marker.",
    };
    writeFileSync(
      resolve(evidenceDirectory, "idp-invalidation-request.json"),
      `${JSON.stringify(invalidationRequest, null, 2)}\n`,
      "utf8",
    );
    process.stdout.write(
      `IdP invalidation request prepared for employee alias ${invalidationRequest.targetEmployeeAlias}; runNonce ${runNonce}.\n`,
    );
    const invalidationConfirmation =
      await waitForInvalidationConfirmation(runNonce);
    const targetEmployee = employees.find(
      ({ alias }) => alias === process.env.STAGE3_IDP_INVALIDATION_TARGET,
    );
    const controlEmployee = employees.find(
      ({ alias }) => alias !== process.env.STAGE3_IDP_INVALIDATION_TARGET,
    );
    if (!targetEmployee || !controlEmployee) {
      throw new Error("IDP_INVALIDATION_EMPLOYEE_SELECTION_INVALID");
    }
    const invalidatedEmployee = await verifyInvalidatedEmployee(
      browser,
      targetEmployee,
    );
    const unaffectedEmployee = await verifyAuthenticatedEmployee(
      browser,
      controlEmployee,
    );
    const allBrowserErrors = [
      ...initialEmployees.flatMap(({ browserErrors }) => browserErrors),
      ...invalidatedEmployee.browserErrors,
      ...unaffectedEmployee.browserErrors,
    ];
    const allFailingHttpResponses = [
      ...initialEmployees.flatMap(
        ({ failingHttpResponses }) => failingHttpResponses,
      ),
      ...invalidatedEmployee.failingHttpResponses,
      ...unaffectedEmployee.failingHttpResponses,
    ];
    const strictBrowserConsoleZero = allBrowserErrors.length === 0;
    const evidence = {
      schemaVersion: 1,
      stage: "3C",
      scope: "ENTERPRISE_IDP_SUPPLEMENT",
      status: strictBrowserConsoleZero ? "PASS" : "FAIL",
      enterpriseIdentityMatrix: "PASS",
      controlledInvalidation: "PASS",
      strictBrowserConsoleZero: strictBrowserConsoleZero ? "PASS" : "FAIL",
      employeeCount: 2,
      distinctEmployeeSubjects: true,
      distinctObservedRoleCount: new Set(
        initialEmployees.flatMap((employee) => employee.observedRoleCodes),
      ).size,
      initialEmployees,
      invalidation: {
        mode: process.env.STAGE3_IDP_INVALIDATION_MODE,
        targetEmployeeAlias: process.env.STAGE3_IDP_INVALIDATION_TARGET,
        expectedHttpStatus: invalidationExpectedStatus,
        approvalReferenceSha256:
          invalidationConfirmation.approvalReferenceSha256,
        confirmedAt: invalidationConfirmation.confirmedAt,
        invalidatedEmployee,
        unaffectedEmployee,
      },
      browserErrors: allBrowserErrors,
      failingHttpResponses: allFailingHttpResponses,
      storageStateFilesOwnerOnly: true,
      secretValuesRecorded: false,
    };
    writeEvidence(evidence);
    process.exitCode = strictBrowserConsoleZero ? 0 : 1;
  } finally {
    await browser.close();
  }
}

try {
  await runReplay();
} catch (error) {
  const failureCode =
    error instanceof Error ? error.message : "UNKNOWN_IDP_REPLAY_FAILURE";
  writeEvidence({
    schemaVersion: 1,
    stage: "3C",
    scope: "ENTERPRISE_IDP_SUPPLEMENT",
    status: "FAIL",
    failureCode,
    secretValuesRecorded: false,
  });
  process.stderr.write(`FAIL: ${failureCode}\n`);
  process.exitCode = 1;
}
