import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { access } from "node:fs/promises";
import { resolve } from "node:path";

const backendDirectory =
  process.env.LIVE_E2E_BACKEND_DIR ??
  resolve(import.meta.dirname, "../../../cofco-qiqihar-enterprise-backend");
const databaseName = "qiqihar_enterprise_e2e";
const databaseUser = process.env.QIQIHAR_E2E_DB_USERNAME ?? process.env.USER;
const databasePassword = process.env.QIQIHAR_E2E_DB_PASSWORD ?? "";
const backendPort = 63183;
const readinessPort = 63189;
const javaHome = "/opt/homebrew/opt/openjdk@21";
const jarPath = resolve(
  backendDirectory,
  "target/grain-trade-enterprise-backend-0.0.1-SNAPSHOT.jar",
);
const seedPath = resolve(import.meta.dirname, "seed-identities.sql");

if (!databaseUser) throw new Error("A PostgreSQL E2E database user is required");

const processEnvironment = {
  ...process.env,
  JAVA_HOME: javaHome,
  PATH: `${javaHome}/bin:${process.env.PATH ?? ""}`,
  PGPASSWORD: databasePassword,
};

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: processEnvironment,
      stdio: options.stdio ?? "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(
        new Error(
          `${command} failed with ${signal ? `signal ${signal}` : `exit ${code}`}`,
        ),
      );
    });
  });
}

async function waitForHealth() {
  const deadline = Date.now() + 120_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(
        `http://127.0.0.1:${backendPort}/actuator/health`,
      );
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`Live E2E backend did not become healthy: ${String(lastError)}`);
}

await access(seedPath);
await run("mvn", ["-q", "-DskipTests", "package"], {
  cwd: backendDirectory,
});
await access(jarPath);
await run("dropdb", ["--if-exists", "--force", "--username", databaseUser, databaseName]);
await run("createdb", ["--username", databaseUser, databaseName]);

const backend = spawn(`${javaHome}/bin/java`, ["-jar", jarPath], {
  cwd: backendDirectory,
  env: {
    ...processEnvironment,
    SPRING_PROFILES_ACTIVE: "local",
    QIQIHAR_DB_URL: `jdbc:postgresql://127.0.0.1:5432/${databaseName}`,
    QIQIHAR_DB_USERNAME: databaseUser,
    QIQIHAR_DB_PASSWORD: databasePassword,
    QIQIHAR_SERVER_PORT: String(backendPort),
  },
  stdio: "inherit",
});

let stopping = false;
let readinessServer;

async function stop(exitCode) {
  if (stopping) return;
  stopping = true;
  if (readinessServer) {
    await new Promise((resolvePromise) => readinessServer.close(resolvePromise));
  }
  if (backend.exitCode === null && backend.signalCode === null) {
    backend.kill("SIGTERM");
    await Promise.race([
      new Promise((resolvePromise) => backend.once("exit", resolvePromise)),
      new Promise((resolvePromise) => setTimeout(resolvePromise, 10_000)),
    ]);
  }
  try {
    await run(
      "dropdb",
      ["--if-exists", "--force", "--username", databaseUser, databaseName],
      { stdio: "ignore" },
    );
  } finally {
    process.exit(exitCode);
  }
}

process.once("SIGINT", () => void stop(0));
process.once("SIGTERM", () => void stop(0));
backend.once("error", (error) => {
  process.stderr.write(`Live E2E backend failed: ${error.message}\n`);
  void stop(1);
});
backend.once("exit", (code, signal) => {
  if (!stopping) {
    process.stderr.write(
      `Live E2E backend exited unexpectedly (${signal ?? code ?? "unknown"})\n`,
    );
    void stop(1);
  }
});

try {
  await waitForHealth();
  await run(
    "psql",
    [
      "--username",
      databaseUser,
      "--dbname",
      databaseName,
      "--set",
      "ON_ERROR_STOP=1",
      "--file",
      seedPath,
    ],
  );
  readinessServer = createServer((request, response) => {
    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"status":"UP"}');
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise((resolvePromise, reject) => {
    readinessServer.once("error", reject);
    readinessServer.listen(readinessPort, "127.0.0.1", resolvePromise);
  });
  process.stdout.write("Live E2E backend and identities are ready\n");
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  await stop(1);
}

await new Promise(() => {});
