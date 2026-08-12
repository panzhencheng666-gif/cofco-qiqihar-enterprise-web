import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "..");

async function read(relativePath) {
  return readFile(resolve(repositoryRoot, relativePath), "utf8");
}

test("ships every stage-five local asset through one bounded operations package", async () => {
  const requiredFiles = [
    "Dockerfile",
    "deploy/nginx.preproduction.conf",
    "ops/alicloud-preproduction/README.md",
    "ops/alicloud-preproduction/config/preproduction.env.example",
    "ops/alicloud-preproduction/compose.yaml",
    "ops/alicloud-preproduction/gateway/nginx.conf",
    "ops/alicloud-preproduction/monitoring/prometheus.yml",
    "ops/alicloud-preproduction/monitoring/blackbox.yml",
    "ops/alicloud-preproduction/monitoring/alerts.yml",
    "ops/alicloud-preproduction/monitoring/alertmanager.yml",
    "ops/alicloud-preproduction/terraform/.terraform.lock.hcl",
    "ops/alicloud-preproduction/terraform/versions.tf",
    "ops/alicloud-preproduction/terraform/variables.tf",
    "ops/alicloud-preproduction/terraform/main.tf",
    "ops/alicloud-preproduction/terraform/outputs.tf",
    "ops/alicloud-preproduction/terraform/preproduction.tfvars.example",
    "ops/alicloud-preproduction/scripts/common.sh",
    "ops/alicloud-preproduction/scripts/preflight.sh",
    "ops/alicloud-preproduction/scripts/infra.sh",
    "ops/alicloud-preproduction/scripts/rds-whitelist.sh",
    "ops/alicloud-preproduction/scripts/verify-cloud-boundaries.sh",
    "ops/alicloud-preproduction/scripts/materialize-secrets.sh",
    "ops/alicloud-preproduction/scripts/deploy.sh",
    "ops/alicloud-preproduction/scripts/remote-apply.sh",
    "ops/alicloud-preproduction/scripts/verify.sh",
    "ops/alicloud-preproduction/scripts/backup-rds.sh",
    "ops/alicloud-preproduction/scripts/rollback.sh",
  ];

  await Promise.all(requiredFiles.map((path) => read(path)));
});

test("keeps only the TLS gateway published and injects backend secrets through configtree files", async () => {
  const compose = await read("ops/alicloud-preproduction/compose.yaml");

  assert.match(compose, /gateway:[\s\S]*ports:\s*\n\s*- "443:8443"/u);
  assert.equal((compose.match(/\n\s+ports:/gu) ?? []).length, 1);
  assert.match(compose, /SPRING_PROFILES_ACTIVE: preproduction/u);
  assert.match(
    compose,
    /SPRING_CONFIG_IMPORT: "optional:configtree:\/run\/secrets\/"/u,
  );
  assert.match(compose, /target: spring\.datasource\.password/u);
  assert.match(compose, /target: qiqihar\.security\.oidc\.client-secret/u);
  assert.doesNotMatch(compose, /QIQIHAR_DB_PASSWORD:/u);
  assert.doesNotMatch(compose, /QIQIHAR_OIDC_CLIENT_SECRET:/u);
  for (const service of ["business-web", "overview-web"]) {
    assert.match(
      compose,
      new RegExp(
        `\\n  ${service}:[\\s\\S]*?user: "101:101"[\\s\\S]*?uid=101,gid=101[\\s\\S]*?(?=\\n  [a-z-]+:|\\nnetworks:)`,
        "u",
      ),
    );
  }
});

test("strips every legacy identity header at the preproduction gateway", async () => {
  const nginx = await read("ops/alicloud-preproduction/gateway/nginx.conf");

  for (const header of [
    "X-Actor",
    "X-Qiqihar-Authenticated-Subject",
    "X-Authenticated-Subject",
    "X-Remote-User",
  ]) {
    assert.match(nginx, new RegExp(`proxy_set_header ${header} "";`, "u"));
  }
  assert.match(nginx, /ssl_protocols TLSv1\.2 TLSv1\.3;/u);
  assert.match(nginx, /server_tokens off;/u);
});

test("uses the official provider, gates changes, and refuses globally open ingress", async () => {
  const terraform = [
    await read("ops/alicloud-preproduction/terraform/versions.tf"),
    await read("ops/alicloud-preproduction/terraform/variables.tf"),
    await read("ops/alicloud-preproduction/terraform/main.tf"),
  ].join("\n");

  assert.match(terraform, /source\s*=\s*"aliyun\/alicloud"/u);
  assert.match(terraform, /enable_apply/u);
  assert.match(terraform, /alicloud_instances/u);
  assert.match(terraform, /alicloud_db_instances/u);
  assert.match(terraform, /alicloud_security_group_rule/u);
  assert.doesNotMatch(terraform, /cidr_ip\s*=\s*"0\.0\.0\.0\/0"/u);
});

test("binds Terraform apply to the exact reviewed saved-plan digest", async () => {
  const infra = await read("ops/alicloud-preproduction/scripts/infra.sh");

  assert.match(infra, /COFCO_PREPROD_APPROVED_PLAN_SHA256/u);
  assert.match(infra, /sha256_file "\$plan_path"/u);
  assert.match(infra, /approved plan SHA-256 does not match/u);
});

test("provides monitoring, backup verification, and image rollback without calling production", async () => {
  const prometheus = await read(
    "ops/alicloud-preproduction/monitoring/prometheus.yml",
  );
  const backup = await read("ops/alicloud-preproduction/scripts/backup-rds.sh");
  const rollback = await read("ops/alicloud-preproduction/scripts/rollback.sh");

  assert.match(prometheus, /blackbox/u);
  assert.match(backup, /CreateBackup/u);
  assert.match(backup, /DescribeBackupTasks/u);
  assert.match(rollback, /previous/u);
  assert.doesNotMatch(`${backup}\n${rollback}`, /config\/production\.env/u);
});

test("bounds cold-start verification retries before declaring deployment failure", async () => {
  const verify = await read("ops/alicloud-preproduction/scripts/verify.sh");

  assert.match(verify, /wait_for_http_code/u);
  assert.match(verify, /wait_for_prometheus/u);
  assert.match(verify, /SECONDS \+ 120/u);
  assert.doesNotMatch(verify, /sleep (?:6[1-9]|[7-9][0-9]|[1-9][0-9]{2,})/u);
});

test("configures the named RDS whitelist and checks live isolation before pulling containers", async () => {
  const whitelist = await read(
    "ops/alicloud-preproduction/scripts/rds-whitelist.sh",
  );
  const boundaries = await read(
    "ops/alicloud-preproduction/scripts/verify-cloud-boundaries.sh",
  );
  const remoteApply = await read(
    "ops/alicloud-preproduction/scripts/remote-apply.sh",
  );

  assert.match(whitelist, /ModifySecurityIps/u);
  assert.match(whitelist, /DescribeDBInstanceIPArrayList/u);
  assert.match(whitelist, /WhitelistNetworkType[" ]+VPC/u);
  assert.match(boundaries, /DescribeInstances/u);
  assert.match(boundaries, /DescribeDBInstanceNetInfo/u);
  assert.match(boundaries, /DescribeSecurityGroupAttribute/u);
  assert.match(boundaries, /DescribeDBInstanceIPArrayList/u);
  assert.match(boundaries, /approved_https/u);
  assert.match(boundaries, /approved_ssh/u);
  assert.match(boundaries, /unapproved ingress rule/u);
  assert.match(boundaries, /unapproved whitelist CIDR/u);
  assert.ok(
    remoteApply.indexOf("verify-cloud-boundaries.sh") <
      remoteApply.indexOf("docker compose"),
  );
});

test("passes complete KMS ARN references without truncating hierarchical secret names", async () => {
  const materialize = await read(
    "ops/alicloud-preproduction/scripts/materialize-secrets.sh",
  );

  assert.match(materialize, /--SecretName "\$reference"/u);
  assert.doesNotMatch(materialize, /reference##\*\//u);
  assert.match(materialize, /jq -erj/u);
});

test("binds DNS and strict TLS verification to the approved ECS HTTPS endpoint", async () => {
  const boundaries = await read(
    "ops/alicloud-preproduction/scripts/verify-cloud-boundaries.sh",
  );
  const verify = await read("ops/alicloud-preproduction/scripts/verify.sh");

  assert.match(boundaries, /COFCO_PREPROD_HTTPS_ENDPOINT_IP/u);
  assert.match(boundaries, /PublicIpAddress/u);
  assert.match(boundaries, /EipAddress/u);
  assert.match(verify, /resolve4/u);
  assert.match(verify, /--resolve/u);
  assert.match(verify, /-verify_return_error/u);
  assert.match(verify, /-verify_hostname/u);
});

test("fails closed unless the SSH alias expands to the approved hardened connection", async () => {
  const deploy = await read("ops/alicloud-preproduction/scripts/deploy.sh");

  assert.match(deploy, /COFCO_PREPROD_SSH_EXPECTED_HOST/u);
  assert.match(deploy, /COFCO_PREPROD_SSH_USER/u);
  assert.match(deploy, /BatchMode=yes/u);
  assert.match(deploy, /StrictHostKeyChecking=yes/u);
  assert.match(deploy, /IdentitiesOnly=yes/u);
  assert.match(deploy, /ssh-keygen -F/u);
  assert.match(deploy, /identity file must exist with mode 0600 or 0400/u);
});

test("restores the previous whitelist and secrets before restarting a failed candidate", async () => {
  const remoteApply = await read(
    "ops/alicloud-preproduction/scripts/remote-apply.sh",
  );
  const rollback = await read("ops/alicloud-preproduction/scripts/rollback.sh");

  for (const script of [remoteApply, rollback]) {
    assert.match(script, /rds-whitelist\.sh.*previous/u);
    assert.match(script, /materialize-secrets\.sh.*previous/u);
  }
  assert.ok(
    remoteApply.indexOf('rds-whitelist.sh" apply "$previous_config') <
      remoteApply.indexOf('docker compose --env-file "$previous_config'),
  );
});

test("runs the complete configuration validator from every shared shell invariant gate", async () => {
  const common = await read("ops/alicloud-preproduction/scripts/common.sh");

  assert.match(
    common,
    /require_shell_invariants\(\)[\s\S]*node "\$CONFIG_VALIDATOR" --config "\$config_path"/u,
  );
});

test("keeps destructive and secret-leaking shell patterns out of the operations package", async () => {
  const scripts = await Promise.all(
    [
      "common.sh",
      "preflight.sh",
      "infra.sh",
      "rds-whitelist.sh",
      "verify-cloud-boundaries.sh",
      "materialize-secrets.sh",
      "deploy.sh",
      "remote-apply.sh",
      "verify.sh",
      "backup-rds.sh",
      "rollback.sh",
    ].map((name) => read(`ops/alicloud-preproduction/scripts/${name}`)),
  );
  const combined = scripts.join("\n");

  assert.doesNotMatch(combined, /rm\s+-rf/u);
  assert.doesNotMatch(combined, /git\s+(reset|checkout)\b/u);
  assert.doesNotMatch(combined, /terraform\s+destroy/u);
  assert.doesNotMatch(combined, /\beval\b/u);
  assert.doesNotMatch(combined, /set\s+-x/u);
});
