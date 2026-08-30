import assert from "node:assert/strict";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const transactionLibrary = resolve(
  import.meta.dirname,
  "../ops/alicloud-preproduction/scripts/transaction.sh",
);
const commonLibrary = resolve(
  import.meta.dirname,
  "../ops/alicloud-preproduction/scripts/common.sh",
);

async function createLockReleaseFailureBin(directory) {
  const fakeBin = join(directory, "bin");
  await mkdir(fakeBin, { recursive: true, mode: 0o700 });
  await writeFile(
    join(fakeBin, "rm"),
    `#!/usr/bin/env bash
set -euo pipefail
case "\${!#}" in
  */.mutation.lock/owner) exit 98 ;;
esac
exec /bin/rm "$@"
`,
    { mode: 0o700 },
  );
  return fakeBin;
}

const failurePoints = [
  "snapshot-invocation",
  "prepare-release",
  "rds-whitelist",
  "cloud-boundary",
  "secrets",
  "gateway-config",
  "compose-config",
  "backup",
  "pull",
  "up",
  "verify",
  "checkpoint",
  "post-activation-verify",
];

const rollbackFailurePoints = [
  "snapshot-invocation",
  "stop",
  "rds-whitelist",
  "secrets",
  "gateway-config",
  "cloud-boundary",
  "compose-config",
  "pull",
  "up",
  "verify",
  "current-checkpoint",
  "previous-checkpoint",
  "post-rollback-verify",
];

test("maps every injected failure point to the real remote deploy transaction", async () => {
  const remoteApply = await readFile(
    resolve(
      import.meta.dirname,
      "../ops/alicloud-preproduction/scripts/remote-apply.sh",
    ),
    "utf8",
  );

  for (const failurePoint of failurePoints) {
    assert.match(
      remoteApply,
      new RegExp(`stage5_transaction_step ${failurePoint}\\b`, "u"),
    );
  }
});

test("restores exactly once for every injected deploy failure point", async (t) => {
  for (const failurePoint of failurePoints) {
    await t.test(failurePoint, async () => {
      const directory = await mkdtemp(
        join(tmpdir(), "cofco-stage5-transaction-"),
      );
      const trace = join(directory, "trace");
      const script = [
        "set -euo pipefail",
        `source "${transactionLibrary}"`,
        `trace="${trace}"`,
        `fail_at="${failurePoint}"`,
        'restore_original() { printf "restore:%s\\n" "$STAGE5_TRANSACTION_LAST_STEP" >>"$trace"; }',
        'step() { printf "step:%s\\n" "$1" >>"$trace"; test "$1" != "$fail_at"; }',
        "stage5_transaction_begin restore_original",
        ...failurePoints.map(
          (point) => `stage5_transaction_step "${point}" step "${point}"`,
        ),
        "stage5_transaction_commit",
      ].join("\n");

      const result = spawnSync("bash", ["-c", script], {
        encoding: "utf8",
      });
      const lines = (await readFile(trace, "utf8")).trim().split("\n");

      assert.notEqual(result.status, 0);
      assert.equal(
        lines.filter((line) => line.startsWith("restore:")).length,
        1,
      );
      assert.equal(lines.at(-1), `restore:${failurePoint}`);
    });
  }
});

test("maps every injected failure point to the real rollback transaction", async () => {
  const rollback = await readFile(
    resolve(
      import.meta.dirname,
      "../ops/alicloud-preproduction/scripts/rollback.sh",
    ),
    "utf8",
  );

  for (const failurePoint of rollbackFailurePoints) {
    assert.match(
      rollback,
      new RegExp(`stage5_transaction_step ${failurePoint}\\b`, "u"),
    );
  }
});

test("restores exactly once for every injected rollback failure point", async (t) => {
  for (const failurePoint of rollbackFailurePoints) {
    await t.test(failurePoint, async () => {
      const directory = await mkdtemp(
        join(tmpdir(), "cofco-stage5-rollback-transaction-"),
      );
      const trace = join(directory, "trace");
      const script = [
        "set -euo pipefail",
        `source "${transactionLibrary}"`,
        `trace="${trace}"`,
        `fail_at="${failurePoint}"`,
        'restore_current() { printf "restore:%s\\n" "$STAGE5_TRANSACTION_LAST_STEP" >>"$trace"; }',
        'step() { printf "step:%s\\n" "$1" >>"$trace"; test "$1" != "$fail_at"; }',
        "stage5_transaction_begin restore_current",
        ...rollbackFailurePoints.map(
          (point) => `stage5_transaction_step "${point}" step "${point}"`,
        ),
        "stage5_transaction_commit",
      ].join("\n");

      const result = spawnSync("bash", ["-c", script], {
        encoding: "utf8",
      });
      const lines = (await readFile(trace, "utf8")).trim().split("\n");

      assert.notEqual(result.status, 0);
      assert.equal(
        lines.filter((line) => line.startsWith("restore:")).length,
        1,
      );
      assert.equal(lines.at(-1), `restore:${failurePoint}`);
    });
  }
});

test("does not compensate a committed transaction", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cofco-stage5-commit-"));
  const trace = join(directory, "trace");
  await writeFile(trace, "", "utf8");
  const script = [
    "set -euo pipefail",
    `source "${transactionLibrary}"`,
    `trace="${trace}"`,
    'restore_original() { printf "restore\\n" >>"$trace"; }',
    "stage5_transaction_begin restore_original",
    "stage5_transaction_step verify true",
    "stage5_transaction_commit",
  ].join("\n");

  const result = spawnSync("bash", ["-c", script], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(trace, "utf8"), "");
});

test("records the exact injected failure point in controlled runtime evidence", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "cofco-stage5-injected-failure-"),
  );
  const operationRuntimeRoot = join(directory, "operations");
  const markerRoot = join(operationRuntimeRoot, "test-markers");
  const marker = join(markerRoot, "failure-step");
  await mkdir(markerRoot, { recursive: true, mode: 0o700 });
  const script = [
    "set -euo pipefail",
    `OPERATION_RUNTIME_ROOT="${operationRuntimeRoot}"`,
    'COFCO_PREPROD_TEST_MODE="true"',
    'COFCO_PREPROD_TEST_FAIL_AT="secrets"',
    `source "${transactionLibrary}"`,
    "restore_original() { :; }",
    "stage5_transaction_begin restore_original",
    "stage5_transaction_step secrets true",
  ].join("\n");

  const result = spawnSync("bash", ["-c", script], { encoding: "utf8" });

  assert.equal(result.status, 97, result.stderr);
  assert.match(result.stderr, /TEST_INJECTED_FAILURE step=secrets/u);
  assert.equal(await readFile(marker, "utf8"), "secrets\n");
});

test("ignores a traversal marker override and writes only the fixed controlled marker", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "cofco-stage5-marker-traversal-"),
  );
  const operationRuntimeRoot = join(directory, "operations");
  const markerRoot = join(operationRuntimeRoot, "test-markers");
  const controlledMarker = join(markerRoot, "failure-step");
  const escapedMarker = join(directory, "escaped-marker");
  await mkdir(markerRoot, { recursive: true, mode: 0o700 });
  const script = [
    "set -euo pipefail",
    `OPERATION_RUNTIME_ROOT="${operationRuntimeRoot}"`,
    'COFCO_PREPROD_TEST_MODE="true"',
    'COFCO_PREPROD_TEST_FAIL_AT="verify"',
    `COFCO_PREPROD_TEST_FAILURE_MARKER="${markerRoot}/../../escaped-marker"`,
    `source "${transactionLibrary}"`,
    "restore_original() { :; }",
    "stage5_transaction_begin restore_original",
    "stage5_transaction_step verify true",
  ].join("\n");

  const result = spawnSync("bash", ["-c", script], { encoding: "utf8" });

  assert.equal(result.status, 97, result.stderr);
  assert.equal(await readFile(controlledMarker, "utf8"), "verify\n");
  await assert.rejects(access(escapedMarker), /ENOENT/u);
});

test("rejects a symlinked controlled marker directory", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cofco-stage5-marker-link-"));
  const operationRuntimeRoot = join(directory, "operations");
  const outsideRoot = join(directory, "outside");
  const markerRoot = join(operationRuntimeRoot, "test-markers");
  const escapedMarker = join(outsideRoot, "failure-step");
  await mkdir(operationRuntimeRoot, { recursive: true, mode: 0o700 });
  await mkdir(outsideRoot, { mode: 0o700 });
  await symlink(outsideRoot, markerRoot);
  const script = [
    "set -euo pipefail",
    `OPERATION_RUNTIME_ROOT="${operationRuntimeRoot}"`,
    'COFCO_PREPROD_TEST_MODE="true"',
    'COFCO_PREPROD_TEST_FAIL_AT="verify"',
    `source "${transactionLibrary}"`,
    "restore_original() { :; }",
    "stage5_transaction_begin restore_original",
    "stage5_transaction_step verify true",
  ].join("\n");

  const result = spawnSync("bash", ["-c", script], { encoding: "utf8" });

  assert.equal(result.status, 64, result.stderr);
  assert.match(result.stderr, /unsafe stage-five test marker directory/iu);
  await assert.rejects(access(escapedMarker), /ENOENT/u);
});

test("mutation lock release preserves and reports a lock it cannot remove", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cofco-stage5-lock-release-"));
  const fakeBin = await createLockReleaseFailureBin(directory);
  const releaseRoot = join(directory, "releases");
  const operationRuntimeRoot = join(directory, "operations");
  const script = [
    "set -euo pipefail",
    `export PATH="${fakeBin}:$PATH"`,
    `source "${commonLibrary}"`,
    `OPERATION_RUNTIME_ROOT="${operationRuntimeRoot}"`,
    `stage5_mutation_lock_acquire "${releaseRoot}"`,
    `expected_lock="${releaseRoot}/.mutation.lock"`,
    "set +e",
    "stage5_mutation_lock_release",
    "release_status=$?",
    "set -e",
    "trap - EXIT",
    'test -d "$expected_lock" && lock_exists=yes || lock_exists=no',
    `printf 'status=%s\\ntracked=%s\\nexists=%s\\n' "$release_status" "$STAGE5_MUTATION_LOCK_DIR" "$lock_exists"`,
  ].join("\n");

  const result = spawnSync("bash", ["-c", script], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /status=98/u);
  assert.match(
    result.stdout,
    new RegExp(`tracked=${releaseRoot}/[.]mutation[.]lock`, "u"),
  );
  assert.match(result.stdout, /exists=yes/u);
});

test("a committed transaction fails loudly when its mutation lock cannot be released", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cofco-stage5-lock-commit-"));
  const fakeBin = await createLockReleaseFailureBin(directory);
  const releaseRoot = join(directory, "releases");
  const operationRuntimeRoot = join(directory, "operations");
  const script = [
    "set -euo pipefail",
    `export PATH="${fakeBin}:$PATH"`,
    `source "${commonLibrary}"`,
    `source "${transactionLibrary}"`,
    `OPERATION_RUNTIME_ROOT="${operationRuntimeRoot}"`,
    'stage5_invocation_runtime_create "committed-lock-failure"',
    `stage5_mutation_lock_acquire "${releaseRoot}"`,
    "restore_original() { :; }",
    "stage5_transaction_begin restore_original",
    "stage5_transaction_commit",
  ].join("\n");

  const result = spawnSync("bash", ["-c", script], { encoding: "utf8" });

  assert.equal(result.status, 70, result.stderr);
  assert.match(result.stderr, /mutation lock cleanup failed/iu);
});

test("a failed compensation fails loudly with a distinct status", () => {
  const script = [
    "set -euo pipefail",
    `source "${transactionLibrary}"`,
    "restore_original() { return 1; }",
    "stage5_transaction_begin restore_original",
    "stage5_transaction_step backup false",
  ].join("\n");

  const result = spawnSync("bash", ["-c", script], { encoding: "utf8" });

  assert.equal(result.status, 70);
  assert.match(result.stderr, /compensation failed/u);
});
