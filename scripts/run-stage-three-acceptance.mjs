import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const acceptanceDatabase = "qiqihar_enterprise_e2e";
const evidenceDirectory = resolve(
  process.env.STAGE3_EVIDENCE_DIR ?? "test-results/stage-three",
);
const backendDirectory = resolve(
  process.env.LIVE_E2E_BACKEND_DIR ?? "../cofco-qiqihar-enterprise-backend",
);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: process.env,
    stdio: options.stdio ?? "pipe",
  });
  if (result.error) throw result.error;
  if (options.allowFailure !== true && result.status !== 0) {
    throw new Error(
      `${command} failed with exit ${String(result.status)}\n${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
  }
  return result;
}

function databaseCatalog() {
  const result = run("psql", [
    "--dbname=postgres",
    "--tuples-only",
    "--no-align",
    "--set=ON_ERROR_STOP=1",
    "--command",
    "SELECT datname FROM pg_database WHERE datistemplate=false ORDER BY datname",
  ]);
  return result.stdout
    .split("\n")
    .map((name) => name.trim())
    .filter(Boolean);
}

function gitHead(directory) {
  return run("git", ["-C", directory, "rev-parse", "HEAD"]).stdout.trim();
}

mkdirSync(evidenceDirectory, { recursive: true });
const startedAt = new Date().toISOString();
const before = databaseCatalog();
if (before.includes(acceptanceDatabase)) {
  throw new Error(
    `${acceptanceDatabase} already exists; inspect the stale acceptance run before continuing`,
  );
}

const playwright = run(
  "npx",
  ["playwright", "test", "--config", "playwright.live.config.ts"],
  { allowFailure: true, stdio: "inherit" },
);
const after = databaseCatalog();
const catalogUnchanged = JSON.stringify(before) === JSON.stringify(after);
const acceptanceDatabaseRemoved = !after.includes(acceptanceDatabase);
const summary = {
  schemaVersion: 1,
  stage: "3C",
  namespace: "S3C-20260812-",
  startedAt,
  finishedAt: new Date().toISOString(),
  candidates: {
    backend: gitHead(backendDirectory),
    web: gitHead(process.cwd()),
  },
  databaseBoundary: {
    acceptanceDatabase,
    before,
    after,
    catalogUnchanged,
    acceptanceDatabaseRemoved,
  },
  playwrightExitCode: playwright.status,
  status:
    playwright.status === 0 && catalogUnchanged && acceptanceDatabaseRemoved
      ? "PASS"
      : "FAIL",
};
writeFileSync(
  resolve(evidenceDirectory, "run-summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
);

if (summary.status !== "PASS") process.exitCode = 1;
