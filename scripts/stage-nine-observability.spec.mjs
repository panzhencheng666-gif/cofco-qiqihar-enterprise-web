import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "..");

async function read(relativePath) {
  return readFile(resolve(repositoryRoot, relativePath), "utf8");
}

test("propagates one gateway-generated trace identifier without logging query values", async () => {
  const nginx = await read("ops/alicloud-preproduction/gateway/nginx.conf");

  assert.match(nginx, /"request_id":"\$request_id","trace_id":"\$request_id"/u);
  assert.equal(
    (nginx.match(/proxy_set_header X-Trace-Id \$request_id;/gu) ?? []).length,
    8,
  );
  assert.doesNotMatch(nginx, /\$request_uri|\$args|\$query_string/u);
});

test("scrapes backend Prometheus metrics only across the private monitoring network", async () => {
  const compose = await read("ops/alicloud-preproduction/compose.yaml");
  const prometheus = await read(
    "ops/alicloud-preproduction/monitoring/prometheus.yml",
  );

  assert.match(
    compose,
    /backend:[\s\S]*?networks:[\s\S]*?- monitoring[\s\S]*?prometheus:/u,
  );
  assert.match(prometheus, /job_name: backend/u);
  assert.match(prometheus, /metrics_path: \/actuator\/prometheus/u);
  assert.match(prometheus, /targets: \["backend:8090"\]/u);
  assert.doesNotMatch(compose, /8090:8090|9090:9090/u);
});

test("defines bounded synthetic probes for health, login, and TLS certificate state", async () => {
  const prometheus = await read(
    "ops/alicloud-preproduction/monitoring/prometheus.yml",
  );
  const blackbox = await read(
    "ops/alicloud-preproduction/monitoring/blackbox.yml",
  );

  for (const module of ["http_2xx", "http_oidc_redirect", "https_2xx"]) {
    assert.match(blackbox, new RegExp(`^  ${module}:`, "mu"));
  }
  assert.match(prometheus, /\/api\/v1\/session\/login/u);
  assert.match(prometheus, /probe_ssl_earliest_cert_expiry/u);
});

test("covers every Stage 9 signal with SLO-bound alerts and runbooks", async () => {
  const alerts = await read("ops/alicloud-preproduction/monitoring/alerts.yml");
  const expectedAlerts = [
    "Stage9EndpointUnavailable",
    "Stage9ApiErrorRateHigh",
    "Stage9ApiLatencyHigh",
    "Stage9TrafficAbsent",
    "Stage9CpuHigh",
    "Stage9MemoryHigh",
    "Stage9DatabasePoolSaturated",
    "Stage9DiskLow",
    "Stage9ImportQueueStalled",
    "Stage9ImportFailures",
    "Stage9ReportGenerationSlow",
    "Stage9EventBacklogStale",
    "Stage9CertificateExpiring",
    "Stage9SecretOrKeyNotReady",
    "Stage9BackupStale",
    "Stage9CapacityHeadroomLow",
    "Stage9RequiredMetricMissing",
  ];

  for (const alert of expectedAlerts) {
    assert.match(alerts, new RegExp(`alert: ${alert}\\b`, "u"));
  }
  assert.match(alerts, /> 0\.001/u, "error-rate SLO must be 0.1%");
  assert.match(alerts, /> 0\.8/u, "API p95 SLO must be 800ms");
  assert.match(alerts, /> 0\.7/u, "CPU SLO must be 70%");
  assert.match(alerts, /> 0\.75/u, "memory SLO must be 75%");
  assert.match(alerts, /> 60/u, "event backlog SLO must be 60 seconds");
  assert.match(alerts, /> 900/u, "backup RPO must be 15 minutes");
  assert.ok(
    (alerts.match(/runbook_url:/gu) ?? []).length >= expectedAlerts.length,
    "every alert must identify its operator runbook",
  );
});

test("routes critical incidents to immediate escalation and reports external delivery honestly", async () => {
  const alertmanager = await read(
    "ops/alicloud-preproduction/monitoring/alertmanager.yml",
  );
  const readme = await read("ops/alicloud-preproduction/README.md");

  assert.match(alertmanager, /severity="critical"/u);
  assert.match(alertmanager, /receiver: preproduction-escalation/u);
  assert.match(alertmanager, /group_wait: 0s/u);
  assert.match(alertmanager, /send_resolved: true/u);
  assert.match(readme, /BLOCKED_EXTERNAL\(EXT-005\)/u);
  assert.match(readme, /online alert delivery/iu);
});

test("wires Stage 9 tests and local operator boundaries into standard package commands", async () => {
  const packageJson = JSON.parse(await read("package.json"));

  assert.equal(
    packageJson.scripts["stage9:observability:test"],
    "node --test scripts/stage-nine-observability.spec.mjs scripts/stage-nine-core.spec.mjs scripts/stage-nine-postgres.spec.mjs",
  );
  assert.equal(
    packageJson.scripts["stage9:continuity:local"],
    "node scripts/run-stage-nine.mjs local",
  );
  assert.equal(
    packageJson.scripts["stage9:evidence:verify"],
    "node scripts/run-stage-nine.mjs verify-evidence",
  );
  assert.match(packageJson.scripts.test, /stage9:observability:test/u);
});
