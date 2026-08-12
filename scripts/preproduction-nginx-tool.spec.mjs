import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "..");
const runnerPath = resolve(
  repositoryRoot,
  "scripts/run-stage-five-preproduction-tests.mjs",
);
const expectedSourceSha256 =
  "4261dc90e9e47c1c4041276e9aaa3d48ebe2e664f728e14fa95ae6c67d57a08b";

test("standard stage-five entry uses the verified nginx tool runner", async () => {
  const packageJson = JSON.parse(
    await readFile(resolve(repositoryRoot, "package.json"), "utf8"),
  );
  assert.equal(
    packageJson.scripts["stage5:preproduction:test"],
    "node scripts/run-stage-five-preproduction-tests.mjs",
  );
});

test("standard runner resolves a verified nginx without a manual environment override", () => {
  const environment = { ...process.env };
  delete environment.COFCO_TEST_NGINX_BIN;
  const result = spawnSync(process.execPath, [runnerPath, "--resolve-nginx"], {
    encoding: "utf8",
    env: environment,
    timeout: 120_000,
  });

  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(
    result.stdout,
    new RegExp(
      `^NGINX_TEST_TOOL_READY version=nginx/1\\.30\\.4 source_sha256=${expectedSourceSha256} binary=.+$`,
      "mu",
    ),
  );
});

test("nginx lifecycle coverage does not recursively launch the node test file", async () => {
  const source = await readFile(
    resolve(repositoryRoot, "scripts/preproduction-nginx.spec.mjs"),
    "utf8",
  );
  assert.doesNotMatch(source, /\["--test", import\.meta\.filename\]/u);
  assert.doesNotMatch(source, /COFCO_TEST_NGINX_LIFECYCLE_SCENARIO/u);
});
