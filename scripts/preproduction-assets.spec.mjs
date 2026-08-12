import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
    "ops/alicloud-preproduction/scripts/transaction.sh",
    "ops/alicloud-preproduction/scripts/invocation-state.sh",
    "ops/alicloud-preproduction/scripts/activate-bundle.sh",
    "ops/alicloud-preproduction/scripts/preflight.sh",
    "ops/alicloud-preproduction/scripts/infra.sh",
    "ops/alicloud-preproduction/scripts/verify-terraform-backend.sh",
    "ops/alicloud-preproduction/scripts/render-gateway.sh",
    "ops/alicloud-preproduction/scripts/rds-whitelist.sh",
    "ops/alicloud-preproduction/scripts/verify-cloud-boundaries.sh",
    "ops/alicloud-preproduction/scripts/materialize-secrets.sh",
    "ops/alicloud-preproduction/scripts/deploy.sh",
    "ops/alicloud-preproduction/scripts/remote-apply.sh",
    "ops/alicloud-preproduction/scripts/verify.sh",
    "ops/alicloud-preproduction/scripts/backup-rds.sh",
    "ops/alicloud-preproduction/scripts/rollback.sh",
    "scripts/preproduction-network.mjs",
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

test("fails unknown TLS hosts and forwards only the single approved domain", async () => {
  const nginx = await read("ops/alicloud-preproduction/gateway/nginx.conf");
  const render = await read(
    "ops/alicloud-preproduction/scripts/render-gateway.sh",
  );
  const verify = await read("ops/alicloud-preproduction/scripts/verify.sh");

  assert.match(nginx, /__COFCO_PREPROD_TLS_DOMAIN__/u);
  assert.match(nginx, /return 421/u);
  assert.doesNotMatch(nginx, /server_name\s+_;/u);
  assert.doesNotMatch(nginx, /proxy_set_header Host \$host/u);
  assert.match(render, /COFCO_PREPROD_TLS_DOMAIN/u);
  assert.match(verify, /COFCO_PREPROD_OIDC_AUTHORIZATION_ENDPOINT/u);
  assert.match(verify, /expected 302/u);
  assert.match(verify, /OIDC authorization endpoint/u);
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

test("binds the declared vSwitch to live VPC zone and CIDR properties", async () => {
  const terraform = await read("ops/alicloud-preproduction/terraform/main.tf");
  const boundaries = await read(
    "ops/alicloud-preproduction/scripts/verify-cloud-boundaries.sh",
  );

  assert.match(terraform, /data "alicloud_vswitches" "target"/u);
  assert.match(terraform, /cidr_block\s*=\s*var\.vswitch_cidr/u);
  assert.match(terraform, /zone_id\s*=\s*var\.zone_id/u);
  assert.match(terraform, /alicloud_vswitches\.target\[0\]\.vswitches/u);
  assert.doesNotMatch(terraform, /alicloud_vswitches\.target\[0\]\.switches/u);
  assert.match(boundaries, /DescribeVSwitchAttributes/u);
  assert.match(boundaries, /live_vswitch_cidr/u);
  assert.match(boundaries, /declared vSwitch.*live Alibaba Cloud state/iu);
});

test("binds Terraform apply to the exact reviewed saved-plan digest", async () => {
  const infra = await read("ops/alicloud-preproduction/scripts/infra.sh");

  assert.match(infra, /COFCO_PREPROD_APPROVED_PLAN_SHA256/u);
  assert.match(infra, /sha256_file "\$plan_path"/u);
  assert.match(infra, /approved plan SHA-256 does not match/u);
});

test("requires encrypted versioned remote OSS state with TableStore locking", async () => {
  const versions = await read(
    "ops/alicloud-preproduction/terraform/versions.tf",
  );
  const infra = await read("ops/alicloud-preproduction/scripts/infra.sh");
  const backend = await read(
    "ops/alicloud-preproduction/scripts/verify-terraform-backend.sh",
  );

  assert.match(versions, /backend "oss"/u);
  assert.doesNotMatch(infra, /-backend=false/u);
  assert.match(infra, /-backend-config=/u);
  assert.match(infra, /-reconfigure/u);
  assert.match(infra, /-lock=true/u);
  assert.match(infra, /-lock-timeout=0s/u);
  assert.match(infra, /terraform[^\n]*state pull/u);
  assert.match(infra, /backend fingerprint/u);
  assert.match(backend, /GetBucketVersioning/u);
  assert.match(backend, /DescribeTable/u);
  assert.match(backend, /LockID/u);
  assert.match(backend, /AES256|encrypt/u);
  assert.match(backend, /minimum permissions/u);
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
  assert.match(verify, /all\(\.data\.result\[\]; \.value\[1\] == "1"\)/u);
  assert.doesNotMatch(verify, /all\(\.\[\]; \.value\[1\]/u);
  assert.doesNotMatch(verify, /sleep (?:6[1-9]|[7-9][0-9]|[1-9][0-9]{2,})/u);
});

test("fails the production Prometheus predicate when any real probe is unhealthy", async () => {
  const verify = await read("ops/alicloud-preproduction/scripts/verify.sh");
  const expression = verify.match(
    /\| jq -e '(\.status == "success"[^']*all\([^']*)'/u,
  )?.[1];
  assert.ok(expression, "verify.sh must expose the production probe predicate");

  const response = (values) =>
    JSON.stringify({
      status: "success",
      data: {
        result: values.map((value) => ({ value: [1710000000, value] })),
      },
    });
  const healthy = spawnSync("jq", ["-e", expression], {
    input: response(["1", "1", "1"]),
  });
  const unhealthy = spawnSync("jq", ["-e", expression], {
    input: response(["1", "0", "1"]),
  });

  assert.equal(healthy.status, 0, healthy.stderr?.toString());
  assert.notEqual(unhealthy.status, 0);
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
      remoteApply.indexOf("stage5_transaction_step pull"),
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
  assert.match(deploy, /DescribeInstances/u);
  assert.match(deploy, /COFCO_PREPROD_SSH_PORT/u);
  assert.match(deploy, /proxyjump/u);
  assert.match(deploy, /proxycommand/u);
  assert.match(deploy, /resolved SSH target is not the cloud-confirmed ECS/u);
});

test("arms transaction recovery before every deploy or rollback side effect", async () => {
  const remoteApply = await read(
    "ops/alicloud-preproduction/scripts/remote-apply.sh",
  );
  const rollback = await read("ops/alicloud-preproduction/scripts/rollback.sh");

  for (const script of [remoteApply, rollback]) {
    assert.match(script, /stage5_transaction_begin/u);
    assert.match(script, /stage5_transaction_step/u);
    assert.match(script, /stage5_transaction_commit/u);
  }
  assert.ok(
    remoteApply.indexOf("stage5_transaction_begin") <
      remoteApply.indexOf("stage5_transaction_step prepare-release"),
  );
  assert.ok(
    rollback.indexOf("stage5_transaction_begin") <
      rollback.indexOf("stage5_transaction_step rds-whitelist"),
  );
});

test("refuses to overwrite an existing immutable release before copying config", async () => {
  const remoteApply = await read(
    "ops/alicloud-preproduction/scripts/remote-apply.sh",
  );

  assert.match(remoteApply, /candidate release ID already exists/u);
  assert.ok(
    remoteApply.indexOf('test ! -e "$release_dir"') <
      remoteApply.indexOf('install -m 0600 "$config_path"'),
  );
  assert.match(remoteApply, /stage5_transaction_step snapshot-invocation/u);
  assert.match(remoteApply, /whitelist_mutated=false/u);
  assert.match(remoteApply, /stage5_invocation_state_mark_secrets_mutated/u);
  assert.match(remoteApply, /stage5_invocation_state_mark_services_mutated/u);
  assert.match(remoteApply, /case "\$release_dir" in/u);
  assert.match(remoteApply, /rm -r -- "\$release_dir"/u);
});

test("drops all Linux capabilities through the shared Compose security anchor", async () => {
  const compose = await read("ops/alicloud-preproduction/compose.yaml");
  const anchor = compose.slice(0, compose.indexOf("\nservices:"));

  assert.match(anchor, /cap_drop:\s*\n\s*- ALL/u);
  assert.doesNotMatch(compose, /cap_add:/u);
});

test("ships validators in the preserved remote Web layout", async () => {
  const deploy = await read("ops/alicloud-preproduction/scripts/deploy.sh");
  const common = await read("ops/alicloud-preproduction/scripts/common.sh");

  assert.match(deploy, /tar -C "\$WEB_ROOT"/u);
  assert.match(deploy, /scripts\/preproduction-config\.mjs/u);
  assert.match(deploy, /scripts\/preproduction-network\.mjs/u);
  assert.match(deploy, /sha256_file/u);
  assert.match(deploy, /config\/preproduction\.env'/u);
  assert.match(deploy, /terraform\/\.terraform'/u);
  assert.match(deploy, /terraform\/\*\.tfstate\.\*'/u);
  assert.match(deploy, /terraform\/\*\.tfplan'/u);
  assert.match(common, /CONFIG_VALIDATOR/u);
});

test("atomically replaces the fixed remote bundle with a freshly verified directory", async () => {
  const deploy = await read("ops/alicloud-preproduction/scripts/deploy.sh");
  const activate = await read(
    "ops/alicloud-preproduction/scripts/activate-bundle.sh",
  );
  const combined = `${deploy}\n${activate}`;

  assert.match(deploy, /bundle-staging/u);
  assert.match(deploy, /bundles\/\$release_id/u);
  assert.match(activate, /renameSync/u);
  assert.match(activate, /forbidden bundle runtime asset/u);
  assert.match(
    deploy,
    /activate-bundle\.sh[\s\S]*-- env COFCO_PREPROD_APPLY=APPLY_PREPRODUCTION[\s\S]*\.\/scripts\/remote-apply\.sh/u,
  );
  assert.doesNotMatch(combined, /-exec rm -r/u);
});

test("uses one shared IPv4 and CIDR implementation across both validators", async () => {
  const config = await read("scripts/preproduction-config.mjs");
  const runtime = await read("scripts/preproduction-runtime.mjs");
  const network = await read("scripts/preproduction-network.mjs");
  const combined = `${config}\n${runtime}\n${network}`;

  assert.match(config, /from "\.\/preproduction-network\.mjs"/u);
  assert.match(runtime, /from "\.\/preproduction-network\.mjs"/u);
  assert.equal((combined.match(/function parseIpv4\b/gu) ?? []).length, 1);
  assert.equal((combined.match(/function parseCidr\b/gu) ?? []).length, 1);
});

test("keeps operation runtime and scoped evidence outside the immutable bundle", async () => {
  const common = await read("ops/alicloud-preproduction/scripts/common.sh");
  const verify = await read("ops/alicloud-preproduction/scripts/verify.sh");
  const scripts = await Promise.all(
    [
      "backup-rds.sh",
      "infra.sh",
      "rds-whitelist.sh",
      "render-gateway.sh",
      "verify-cloud-boundaries.sh",
      "verify-terraform-backend.sh",
      "verify.sh",
    ].map((name) => read(`ops/alicloud-preproduction/scripts/${name}`)),
  );

  assert.match(common, /OPERATION_RUNTIME_ROOT/u);
  assert.doesNotMatch(scripts.join("\n"), /PACKAGE_ROOT\/\.runtime/u);
  assert.match(verify, /verification-\$verification_scope-/u);
  assert.match(verify, /PREPRODUCTION_RUNTIME_RESTORED/u);
});

test("snapshots and best-effort restores the exact invocation state after failure", async () => {
  const remoteApply = await read(
    "ops/alicloud-preproduction/scripts/remote-apply.sh",
  );
  const rollback = await read("ops/alicloud-preproduction/scripts/rollback.sh");
  const invocationState = await read(
    "ops/alicloud-preproduction/scripts/invocation-state.sh",
  );

  assert.match(
    remoteApply,
    /rds-whitelist\.sh" restore[^\n]*whitelist_snapshot/u,
  );
  for (const script of [remoteApply, rollback]) {
    assert.match(script, /source "\$SCRIPT_DIR\/invocation-state\.sh"/u);
    assert.match(script, /stage5_compensation_begin/u);
    assert.match(script, /stage5_compensate rds-whitelist/u);
    assert.match(script, /stage5_invocation_state_compensate/u);
    assert.match(script, /stage5_compensation_finish/u);
  }
  assert.match(invocationState, /runtime-secrets\.tar/u);
  assert.match(invocationState, /running-services/u);
  assert.match(invocationState, /stage5_compensate runtime-secrets/u);
  assert.match(invocationState, /stage5_compensate running-services/u);
  assert.match(
    invocationState,
    /stage5_invocation_state_restore_services\(\)[\s\S]*verify\.sh/u,
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
      "transaction.sh",
      "preflight.sh",
      "infra.sh",
      "verify-terraform-backend.sh",
      "render-gateway.sh",
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
