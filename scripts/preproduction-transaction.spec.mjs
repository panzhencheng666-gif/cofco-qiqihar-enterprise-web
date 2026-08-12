import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const transactionLibrary = resolve(
  import.meta.dirname,
  "../ops/alicloud-preproduction/scripts/transaction.sh",
);

const failurePoints = [
  "prepare-release",
  "capture-whitelist",
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
];

const rollbackFailurePoints = [
  "capture-whitelist",
  "stop",
  "rds-whitelist",
  "secrets",
  "gateway-config",
  "cloud-boundary",
  "compose-config",
  "pull",
  "up",
  "verify",
  "checkpoint",
  "previous-checkpoint",
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
