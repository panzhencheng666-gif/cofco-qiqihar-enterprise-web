import assert from "node:assert/strict";
import {
  chmod,
  access,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  readdir,
  rm,
  stat,
  symlink,
  unlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "..");
const packageRoot = resolve(repositoryRoot, "ops/alicloud-preproduction");
const remoteApply = resolve(packageRoot, "scripts/remote-apply.sh");
const rollback = resolve(packageRoot, "scripts/rollback.sh");
const verifyTerraformBackend = resolve(
  packageRoot,
  "scripts/verify-terraform-backend.sh",
);
const digest = `sha256:${"a".repeat(64)}`;
const realDeployFailurePoints = [
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
];
const realPreviousRollbackFailurePoints = [
  "snapshot-invocation",
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
];

function completeConfig(releaseId, rollbackReleaseId, whitelistCidr) {
  return {
    COFCO_DEPLOYMENT_ENV: "preproduction",
    COFCO_PREPROD_FIRST_DEPLOYMENT: "true",
    COFCO_PREPROD_PRODUCTION_ISOLATION_APPROVED: "true",
    COFCO_PREPROD_REGION: "cn-beijing",
    COFCO_PREPROD_ZONE_ID: "cn-beijing-h",
    COFCO_PREPROD_VPC_ID: "vpc-preproduction001",
    COFCO_PREPROD_VSWITCH_ID: "vsw-preproduction001",
    COFCO_PREPROD_VSWITCH_CIDR: "10.40.10.0/24",
    COFCO_PREPROD_SECURITY_GROUP_ID: "sg-preproduction001",
    COFCO_PREPROD_ECS_INSTANCE_ID: "i-preproduction001",
    COFCO_PREPROD_ECS_PRIVATE_IP: "10.40.10.10",
    COFCO_PREPROD_HTTPS_ENDPOINT_IP: "198.51.100.20",
    COFCO_PREPROD_SSH_HOST_ALIAS: "cofco-preproduction",
    COFCO_PREPROD_SSH_EXPECTED_HOST: "ecs.preprod.example.internal",
    COFCO_PREPROD_SSH_USER: "cofco-deployer",
    COFCO_PREPROD_SSH_MODE: "direct",
    COFCO_PREPROD_SSH_PORT: "22",
    COFCO_PREPROD_SSH_HOST_KEY_SHA256: `SHA256:${"A".repeat(43)}`,
    COFCO_PREPROD_SSH_SOURCE_CIDR: "203.0.113.10/32",
    COFCO_PREPROD_HTTPS_SOURCE_CIDRS: "203.0.113.0/24",
    COFCO_PREPROD_RDS_INSTANCE_ID: "rm-preproduction001",
    COFCO_PREPROD_RDS_PRIVATE_ENDPOINT: "pgm-preproduction.pg.rds.aliyuncs.com",
    COFCO_PREPROD_RDS_PORT: "5432",
    COFCO_PREPROD_RDS_DATABASE: "cofco_preproduction",
    COFCO_PREPROD_RDS_USERNAME: "cofco_preproduction_app",
    COFCO_PREPROD_RDS_WHITELIST_NAME: "cofco_preproduction",
    COFCO_PREPROD_RDS_WHITELIST_CIDRS: whitelistCidr,
    COFCO_PREPROD_RDS_NETWORK_TYPE: "VPC",
    COFCO_PREPROD_RDS_PUBLIC_ENDPOINT_ENABLED: "false",
    COFCO_PREPROD_RDS_SSLMODE: "verify-full",
    COFCO_PREPROD_RDS_CA_SECRET_REF: `acs:kms:cn-beijing:123456789012:secret/${releaseId}-rds-ca`,
    COFCO_PREPROD_DB_SECRET_REF: `acs:kms:cn-beijing:123456789012:secret/${releaseId}-db`,
    COFCO_PREPROD_OIDC_CLIENT_SECRET_REF: `acs:kms:cn-beijing:123456789012:secret/${releaseId}-oidc`,
    COFCO_PREPROD_TLS_CERT_SECRET_REF: `acs:kms:cn-beijing:123456789012:secret/${releaseId}-tls-cert`,
    COFCO_PREPROD_TLS_KEY_SECRET_REF: `acs:kms:cn-beijing:123456789012:secret/${releaseId}-tls-key`,
    COFCO_PREPROD_ALERT_TARGET_SECRET_REF: `acs:kms:cn-beijing:123456789012:secret/${releaseId}-alert`,
    COFCO_PREPROD_KMS_ENDPOINT: "kms-vpc.cn-beijing.aliyuncs.com",
    COFCO_PREPROD_TLS_DOMAIN: "preprod.example.internal",
    COFCO_PREPROD_OIDC_ISSUER_URI: "https://idp.example.test/issuer",
    COFCO_PREPROD_OIDC_AUTHORIZATION_ENDPOINT:
      "https://idp.example.test/oauth2/authorize",
    COFCO_PREPROD_OIDC_CLIENT_ID: "cofco-preproduction",
    COFCO_PREPROD_OIDC_REDIRECT_URI:
      "https://preprod.example.internal/login/oauth2/code/enterprise",
    COFCO_PREPROD_OIDC_POST_LOGOUT_REDIRECT_URI:
      "https://preprod.example.internal/",
    COFCO_PREPROD_OIDC_MFA_AMR_VALUES: "mfa",
    COFCO_PREPROD_RELEASE_ID: releaseId,
    COFCO_PREPROD_BACKEND_IMAGE: `registry.example.test/cofco/backend@${digest}`,
    COFCO_PREPROD_BUSINESS_IMAGE: `registry.example.test/cofco/business@${digest}`,
    COFCO_PREPROD_OVERVIEW_IMAGE: `registry.example.test/cofco/overview@${digest}`,
    COFCO_PREPROD_GATEWAY_IMAGE: `registry.example.test/cofco/gateway@${digest}`,
    COFCO_PREPROD_PROMETHEUS_IMAGE: `registry.example.test/ops/prometheus@${digest}`,
    COFCO_PREPROD_BLACKBOX_IMAGE: `registry.example.test/ops/blackbox@${digest}`,
    COFCO_PREPROD_ALERTMANAGER_IMAGE: `registry.example.test/ops/alertmanager@${digest}`,
    COFCO_PREPROD_MIGRATION_COMPATIBILITY: "expand-only",
    COFCO_PREPROD_BACKUP_METHOD: "Physical",
    COFCO_PREPROD_RPO_MINUTES: "15",
    COFCO_PREPROD_RTO_MINUTES: "120",
    COFCO_PREPROD_MONITORING_RETENTION: "15d",
    COFCO_PREPROD_ROLLBACK_RELEASE_ID: rollbackReleaseId,
    COFCO_PREPROD_TF_STATE_BUCKET: "cofco-preproduction-terraform-state",
    COFCO_PREPROD_TF_STATE_PREFIX: "cofco-qiqihar/preproduction",
    COFCO_PREPROD_TF_STATE_KEY: "network.tfstate",
    COFCO_PREPROD_TF_STATE_OSS_ENDPOINT: "oss-cn-beijing-internal.aliyuncs.com",
    COFCO_PREPROD_TF_STATE_TABLESTORE_ENDPOINT:
      "https://cofco-preprod.cn-beijing.vpc.tablestore.aliyuncs.com",
    COFCO_PREPROD_TF_STATE_TABLESTORE_INSTANCE: "cofco-preprod",
    COFCO_PREPROD_TF_STATE_TABLESTORE_TABLE: "terraform_state_locks",
    COFCO_PREPROD_TF_STATE_VERSIONING_APPROVED: "true",
    COFCO_PREPROD_TF_STATE_MINIMUM_PERMISSIONS_APPROVED: "true",
  };
}

async function writeConfig(path, config) {
  await writeFile(
    path,
    `${Object.entries(config)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")}\n`,
    { mode: 0o600 },
  );
  await chmod(path, 0o600);
}

async function writeExecutable(path, content) {
  await writeFile(path, content, { mode: 0o700 });
  await chmod(path, 0o700);
}

async function createFakeCommands(directory) {
  const fakeBin = join(directory, "bin");
  await mkdir(fakeBin, { recursive: true, mode: 0o700 });
  await writeExecutable(
    join(fakeBin, "aliyun"),
    `#!/usr/bin/env bash
set -euo pipefail
printf 'aliyun:%s\n' "$*" >>"$FAKE_TRACE"
case "$*" in
  *"GetBucketAcl"*)
    jq -cn --arg grant "\${FAKE_TF_STATE_ACL:-private}" '{AccessControlList:{Grant:$grant}}'
    ;;
  *"GetBucketVersioning"*)
    printf '%s\n' '{"VersioningConfiguration":{"Status":"Enabled"}}'
    ;;
  *"GetBucketEncryption"*)
    jq -cn --arg algorithm "\${FAKE_TF_STATE_ENCRYPTION:-AES256}" '{ServerSideEncryptionRule:{ApplyServerSideEncryptionByDefault:{SSEAlgorithm:$algorithm}}}'
    ;;
  *"DescribeTable"*)
    printf '%s\n' '{"TableMeta":{"PrimaryKeySchema":[{"Name":"LockID","Type":"STRING"}]}}'
    ;;
  *"ModifySecurityIps"*)
    count=0
    test ! -f "$FAKE_RDS_MODIFY_COUNT" || count="$(cat "$FAKE_RDS_MODIFY_COUNT")"
    count=$((count + 1))
    printf '%s' "$count" >"$FAKE_RDS_MODIFY_COUNT"
    if test "\${FAKE_FAIL_RDS_RESTORE:-}" = "true" && test "$count" -gt 1; then exit 91; fi
    while test "$#" -gt 0; do
      if test "$1" = "--SecurityIps"; then printf '%s' "$2" >"$FAKE_RDS_STATE"; break; fi
      shift
    done
    ;;
  *"DescribeDBInstanceIPArrayList"*)
    if test "\${FAKE_RDS_ABSENT:-}" = "true"; then
      printf '%s\n' '{"Items":{"DBInstanceIPArray":[]}}'
      exit 0
    fi
    cidr="$(cat "$FAKE_RDS_STATE")"
    printf '{"Items":{"DBInstanceIPArray":[{"DBInstanceIPArrayName":"cofco_preproduction","SecurityIPList":"%s"}]}}\n' "$cidr"
    ;;
  *"GetSecretValue"*)
    reference=""
    while test "$#" -gt 0; do
      if test "$1" = "--SecretName"; then reference="$2"; break; fi
      shift
    done
    case "$reference" in
      *-db) data="{\\"AccountPassword\\":\\"kms-\${reference##*/}\\"}" ;;
      *-alert) data="https://alerts.example.test/\${reference##*/}" ;;
      *) data="kms-\${reference##*/}" ;;
    esac
    jq -cn --arg data "$data" '{SecretDataType:"text",SecretData:$data}'
    ;;
  *"DescribeVSwitchAttributes"*)
    printf '%s\n' '{"VSwitchId":"vsw-preproduction001","VpcId":"vpc-preproduction001","ZoneId":"cn-beijing-h","CidrBlock":"10.40.10.0/24"}'
    ;;
  *"DescribeInstances"*)
    printf '%s\n' '{"Instances":{"Instance":[{"InstanceId":"i-preproduction001","Status":"Running","VpcAttributes":{"VpcId":"vpc-preproduction001","VSwitchId":"vsw-preproduction001","PrivateIpAddress":{"IpAddress":["10.40.10.10"]}},"PublicIpAddress":{"IpAddress":["198.51.100.20"]},"EipAddress":{"IpAddress":""},"SecurityGroupIds":{"SecurityGroupId":["sg-preproduction001"]}}]}}'
    ;;
  *"DescribeDBInstanceAttribute"*)
    printf '%s\n' '{"Items":{"DBInstanceAttribute":[{"DBInstanceId":"rm-preproduction001","Engine":"PostgreSQL","DBInstanceStatus":"Running","VpcId":"vpc-preproduction001","VSwitchId":"vsw-preproduction001"}]}}'
    ;;
  *"DescribeDBInstanceNetInfo"*)
    printf '%s\n' '{"DBInstanceNetInfos":{"DBInstanceNetInfo":[{"ConnectionString":"pgm-preproduction.pg.rds.aliyuncs.com","IPType":"Private"}]}}'
    ;;
  *"DescribeSecurityGroupAttribute"*)
    printf '%s\n' '{"Permissions":{"Permission":[{"Policy":"Accept","IpProtocol":"TCP","PortRange":"443/443","SourceCidrIp":"203.0.113.0/24"},{"Policy":"Accept","IpProtocol":"TCP","PortRange":"22/22","SourceCidrIp":"203.0.113.10/32"}]}}'
    ;;
  *"CreateBackup"*) printf '%s\n' '{"BackupJobId":"backup-1"}' ;;
  *"DescribeBackupTasks"*) printf '%s\n' '{"Items":{"BackupJob":[{"BackupJobId":"backup-1","BackupStatus":"Finished","BackupId":"backup-file-1"}]}}' ;;
  *) printf '%s\n' '{}' ;;
esac
`,
  );
  await writeExecutable(
    join(fakeBin, "docker"),
    `#!/usr/bin/env bash
set -euo pipefail
printf 'docker:%s\n' "$*" >>"$FAKE_TRACE"
if test "\${1:-}" = "inspect"; then printf '172.18.0.9\n'; exit 0; fi
test -n "\${COFCO_PREPROD_GATEWAY_CONFIG:-}" || exit 93
shift
env_file=""
while test "$#" -gt 0; do
  case "$1" in
    --env-file) env_file="$2"; shift 2 ;;
    -f) shift 2 ;;
    *) break ;;
  esac
done
command_name="\${1:-}"
shift || true
case "$command_name" in
  config|pull) exit 0 ;;
  ps)
    if [[ " $* " == *" -q prometheus "* ]]; then printf 'prometheus-id\n'; else cat "$FAKE_SERVICE_STATE"; fi
    ;;
  stop) : >"$FAKE_SERVICE_STATE" ;;
  up)
    release=""
    while IFS='=' read -r key value; do
      if test "$key" = "COFCO_PREPROD_RELEASE_ID"; then
        release="$value"
        break
      fi
    done <"$env_file"
    if test "\${FAKE_FAIL_UP_RELEASE:-}" = "$release"; then
      marker="$FAKE_STATE/fail-up-$release"
      if test ! -f "$marker"; then touch "$marker"; exit 92; fi
    fi
    if test "\${FAKE_FAIL_RESTORE_UP_RELEASE:-}" = "$release"; then exit 93; fi
    services=""
    while test "$#" -gt 0; do
      case "$1" in
        -d|--remove-orphans|--wait) shift ;;
        --wait-timeout) shift 2 ;;
        *) services="$services $1"; shift ;;
      esac
    done
    if test -z "\${services// }"; then
      printf '%s\n' gateway business-web overview-web backend prometheus blackbox alertmanager >"$FAKE_SERVICE_STATE"
    elif test "\${FAKE_MISMATCH_RESTORE_RELEASE:-}" = "$release"; then
      printf '%s\n' backend >"$FAKE_SERVICE_STATE"
    else
      for service in $services; do printf '%s\n' "$service"; done >"$FAKE_SERVICE_STATE"
    fi
    ;;
  *) exit 0 ;;
esac
`,
  );
  await writeExecutable(
    join(fakeBin, "openssl"),
    `#!/usr/bin/env bash
set -euo pipefail
case "$*" in
  *" dgst "*|dgst*) printf '%s\n' 'SHA2-256(stdin)= fixture-digest' ;;
  *" -pubkey "*|*" -pubout "*) printf '%s\n' 'fixture-public-key' ;;
  s_client*) printf '%s\n' 'fixture-certificate' ;;
  *) : ;;
esac
`,
  );
  await writeExecutable(
    join(fakeBin, "curl"),
    `#!/usr/bin/env bash
set -euo pipefail
printf 'curl:%s\n' "$*" >>"$FAKE_TRACE"
url=""
for argument in "$@"; do url="$argument"; done
headers=""
previous=""
for argument in "$@"; do
  if test "$previous" = "--dump-header"; then headers="$argument"; fi
  previous="$argument"
done
case "$url" in
  *"/api/v1/session/login")
    test -z "$headers" || printf '%s\r\n%s\r\n\r\n' 'HTTP/1.1 302 Found' 'Location: https://idp.example.test/oauth2/authorize?response_type=code&client_id=cofco-preproduction&redirect_uri=https%3A%2F%2Fpreprod.example.internal%2Flogin%2Foauth2%2Fcode%2Fenterprise&scope=openid&state=fixture-state&nonce=fixture-nonce' >"$headers"
    printf '302'
    ;;
  *"/prototype.html") printf '404' ;;
  *"/api/v1/session/me") printf '401' ;;
  *"/healthz")
    if [[ "$*" == *"unapproved.invalid"* ]]; then printf '421'; else printf '200'; fi
    ;;
  *"/api/v1/query") printf '%s\n' '{"status":"success","data":{"result":[{"value":[0,"1"]},{"value":[0,"1"]},{"value":[0,"1"]}]}}' ;;
  *) : ;;
esac
`,
  );
  await writeExecutable(
    join(fakeBin, "node"),
    `#!/usr/bin/env bash
set -euo pipefail
if test "\${1:-}" = "-e"; then printf '%s\n' '["198.51.100.20"]'; exit 0; fi
exec "$REAL_NODE" "$@"
`,
  );
  await writeExecutable(
    join(fakeBin, "sleep"),
    "#!/usr/bin/env bash\nexit 0\n",
  );
  await writeExecutable(
    join(fakeBin, "rm"),
    `#!/usr/bin/env bash
set -euo pipefail
if test "\${FAKE_FAIL_INVOCATION_CLEANUP:-}" = "true" && [[ "$*" =~ invocations/|[.]transaction ]]; then
  exit 98
fi
exec /bin/rm "$@"
`,
  );
  return fakeBin;
}

async function createFixture({ current = true, previous = true } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "cofco-stage5-operations-"));
  const releaseRoot = join(directory, "releases");
  const runtimeRoot = join(directory, "runtime");
  const secretsDir = join(runtimeRoot, "cofco-preproduction/secrets");
  const state = join(directory, "state");
  await mkdir(releaseRoot, { recursive: true, mode: 0o700 });
  await mkdir(secretsDir, { recursive: true, mode: 0o700 });
  await mkdir(state, { recursive: true, mode: 0o700 });
  const failureMarkerRoot = join(
    runtimeRoot,
    "cofco-preproduction/operations/test-markers",
  );
  const failureMarker = join(failureMarkerRoot, "failure-step");
  await mkdir(failureMarkerRoot, { recursive: true, mode: 0o700 });

  const ids = {
    candidate: "stage5-candidate-001",
    current: "stage5-current-001",
    previous: "stage5-previous-001",
  };
  const paths = {
    candidate: join(directory, "candidate.env"),
    current: join(releaseRoot, ids.current, "release.env"),
    previous: join(releaseRoot, ids.previous, "release.env"),
  };
  await writeConfig(
    paths.candidate,
    completeConfig(
      ids.candidate,
      previous ? ids.previous : "undeployed",
      "10.40.10.10/32",
    ),
  );
  for (const [kind, cidr, rollbackTarget] of [
    ["current", "10.40.10.20/32", previous ? ids.previous : "undeployed"],
    ["previous", "10.40.10.30/32", "stage5-older-001"],
  ]) {
    if ((kind === "current" && !current) || (kind === "previous" && !previous))
      continue;
    const releaseDirectory = join(releaseRoot, ids[kind]);
    await mkdir(join(releaseDirectory, "runtime/gateway"), {
      recursive: true,
      mode: 0o700,
    });
    await mkdir(join(releaseDirectory, "evidence"), {
      recursive: true,
      mode: 0o700,
    });
    await writeConfig(
      paths[kind],
      completeConfig(ids[kind], rollbackTarget, cidr),
    );
    await writeFile(
      join(releaseDirectory, "runtime/gateway/nginx.conf"),
      `gateway-${kind}\n`,
      { mode: 0o600 },
    );
  }
  if (current) await symlink(ids.current, join(releaseRoot, "current"));
  if (previous) await symlink(ids.previous, join(releaseRoot, "previous"));

  const initialSecrets = {};
  for (const name of [
    "rds-ca.pem",
    "spring.datasource.password",
    "qiqihar.security.oidc.client-secret",
    "tls.crt",
    "tls.key",
    "alert-target",
    "operator-note",
  ]) {
    initialSecrets[name] = `precall-${name}`;
    await writeFile(join(secretsDir, name), initialSecrets[name], {
      mode: 0o600,
    });
  }
  const initialServices = ["gateway"];
  await writeFile(join(state, "services"), `${initialServices.join("\n")}\n`);
  const initialWhitelist = "10.40.10.77/32";
  await writeFile(join(state, "rds-whitelist"), initialWhitelist);
  await writeFile(join(state, "rds-modify-count"), "0");
  await writeFile(join(state, "trace"), "");
  const fakeBin = await createFakeCommands(directory);

  return {
    directory,
    releaseRoot,
    runtimeRoot,
    secretsDir,
    state,
    ids,
    paths,
    initialSecrets,
    initialServices,
    initialWhitelist,
    failureMarker,
    env: {
      ...process.env,
      PATH: `${fakeBin}:${process.env.PATH}`,
      REAL_NODE: process.execPath,
      COFCO_PREPROD_RELEASE_ROOT: releaseRoot,
      XDG_RUNTIME_DIR: runtimeRoot,
      COFCO_PREPROD_TEST_MODE: "true",
      FAKE_STATE: state,
      FAKE_TRACE: join(state, "trace"),
      FAKE_RDS_STATE: join(state, "rds-whitelist"),
      FAKE_RDS_MODIFY_COUNT: join(state, "rds-modify-count"),
      FAKE_SERVICE_STATE: join(state, "services"),
      REAL_RM: "/bin/rm",
    },
  };
}

function runScript(script, config, env) {
  const result = spawnSync("bash", [script, config], {
    env,
    encoding: "utf8",
  });
  assert.equal(
    result.error,
    undefined,
    `failed to execute ${basename(script)}: ${result.error?.message}`,
  );
  assert.equal(
    result.signal,
    null,
    `${basename(script)} terminated by signal ${result.signal}`,
  );
  return result;
}

async function assertInjectedFailure(result, failurePoint, fixture) {
  const trace = await readFile(join(fixture.state, "trace"), "utf8");
  assert.equal(
    result.status,
    97,
    `expected injected failure ${failurePoint}; stdout=${JSON.stringify(result.stdout)} stderr=${JSON.stringify(result.stderr)} trace=${JSON.stringify(trace)}`,
  );
  assert.equal(
    await readFile(fixture.failureMarker, "utf8"),
    `${failurePoint}\n`,
  );
  if (result.stderr) {
    assert.match(result.stderr, new RegExp(`step=${failurePoint}`, "u"));
  }
}

async function readSecrets(directory) {
  const result = {};
  for (const name of (await readdir(directory)).sort()) {
    if (!name.startsWith("."))
      result[name] = await readFile(join(directory, name), "utf8");
  }
  return result;
}

async function checkpointTarget(path) {
  try {
    return await readlink(path);
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

async function assertInvocationStateRestored(fixture) {
  assert.equal(
    await readFile(join(fixture.state, "rds-whitelist"), "utf8"),
    fixture.initialWhitelist,
  );
  assert.deepEqual(
    await readSecrets(fixture.secretsDir),
    fixture.initialSecrets,
  );
  assert.deepEqual(
    (await readFile(join(fixture.state, "services"), "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean),
    fixture.initialServices,
  );
  assert.equal(
    await checkpointTarget(join(fixture.releaseRoot, "current")),
    fixture.ids.current,
  );
  assert.equal(
    await checkpointTarget(join(fixture.releaseRoot, "previous")),
    fixture.ids.previous,
  );
}

test("real remote apply restores the exact pre-call whitelist, secrets, services, and checkpoints", async () => {
  const fixture = await createFixture();
  const result = runScript(remoteApply, fixture.paths.candidate, {
    ...fixture.env,
    COFCO_PREPROD_APPLY: "APPLY_PREPRODUCTION",
    FAKE_FAIL_UP_RELEASE: fixture.ids.candidate,
  });

  assert.notEqual(result.status, 0, result.stdout);
  await assertInvocationStateRestored(fixture);
  assert.match(
    await readFile(join(fixture.state, "trace"), "utf8"),
    /curl:[^\n]*\/healthz/u,
  );
  await assert.rejects(
    readFile(join(fixture.releaseRoot, fixture.ids.candidate, "release.env")),
    /ENOENT/u,
  );
});

test("rollback rejects a previous release targeting a different RDS before mutation", async () => {
  const fixture = await createFixture();
  const previousConfig = await readFile(fixture.paths.previous, "utf8");
  await writeFile(
    fixture.paths.previous,
    previousConfig.replace(
      "COFCO_PREPROD_RDS_INSTANCE_ID=rm-preproduction001",
      "COFCO_PREPROD_RDS_INSTANCE_ID=rm-different001",
    ),
  );
  const result = runScript(rollback, fixture.paths.candidate, {
    ...fixture.env,
    COFCO_PREPROD_ROLLBACK: "ROLLBACK_PREPRODUCTION",
  });
  const trace = await readFile(join(fixture.state, "trace"), "utf8");

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /RDS target differs/iu);
  assert.doesNotMatch(trace, /ModifySecurityIps/u);
});

test("remote apply refuses an absent named RDS whitelist before mutation", async () => {
  const fixture = await createFixture();
  const result = runScript(remoteApply, fixture.paths.candidate, {
    ...fixture.env,
    COFCO_PREPROD_APPLY: "APPLY_PREPRODUCTION",
    FAKE_RDS_ABSENT: "true",
  });
  const trace = await readFile(join(fixture.state, "trace"), "utf8");

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /snapshot could not be captured uniquely/iu);
  assert.doesNotMatch(trace, /ModifySecurityIps/u);
});

test("real remote apply fault-injects and restores all 12 production steps", async (t) => {
  for (const failurePoint of realDeployFailurePoints) {
    await t.test(failurePoint, async () => {
      const fixture = await createFixture();
      const result = runScript(remoteApply, fixture.paths.candidate, {
        ...fixture.env,
        COFCO_PREPROD_APPLY: "APPLY_PREPRODUCTION",
        COFCO_PREPROD_TEST_FAIL_AT: failurePoint,
      });

      await assertInjectedFailure(result, failurePoint, fixture);
      await assertInvocationStateRestored(fixture);
      await assert.rejects(
        readFile(
          join(fixture.releaseRoot, fixture.ids.candidate, "release.env"),
        ),
        /ENOENT/u,
      );
      if (failurePoint === "secrets") {
        assert.match(
          await readFile(join(fixture.state, "trace"), "utf8"),
          /curl:[^\n]*\/healthz/u,
        );
      }
    });
  }
});

test("real remote apply continues every compensation after the first recovery failure", async () => {
  const fixture = await createFixture();
  const result = runScript(remoteApply, fixture.paths.candidate, {
    ...fixture.env,
    COFCO_PREPROD_APPLY: "APPLY_PREPRODUCTION",
    FAKE_FAIL_UP_RELEASE: fixture.ids.candidate,
    FAKE_FAIL_RDS_RESTORE: "true",
  });
  const trace = await readFile(join(fixture.state, "trace"), "utf8");

  assert.equal(result.status, 70, result.stderr);
  assert.match(trace, /docker:compose[\s\S]*up/u);
  assert.deepEqual(
    await readSecrets(fixture.secretsDir),
    fixture.initialSecrets,
  );
  assert.equal(
    await checkpointTarget(join(fixture.releaseRoot, "current")),
    fixture.ids.current,
  );
  await assert.rejects(
    readFile(join(fixture.releaseRoot, fixture.ids.candidate, "release.env")),
    /ENOENT/u,
  );
  await assert.rejects(
    access(join(fixture.releaseRoot, ".mutation.lock")),
    /ENOENT/u,
  );
  assert.deepEqual(
    await readdir(
      join(fixture.runtimeRoot, "cofco-preproduction/operations/invocations"),
    ),
    [],
  );

  const retry = runScript(remoteApply, fixture.paths.candidate, {
    ...fixture.env,
    COFCO_PREPROD_APPLY: "APPLY_PREPRODUCTION",
  });
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(
    await checkpointTarget(join(fixture.releaseRoot, "current")),
    fixture.ids.candidate,
  );
});

test("real remote apply reports service restoration command and comparison failures after continuing compensation", async (t) => {
  for (const [label, injectedEnvironment] of [
    ["docker-up", { FAKE_FAIL_RESTORE_UP_RELEASE: "stage5-current-001" }],
    [
      "service-compare",
      { FAKE_MISMATCH_RESTORE_RELEASE: "stage5-current-001" },
    ],
  ]) {
    await t.test(label, async () => {
      const fixture = await createFixture();
      const result = runScript(remoteApply, fixture.paths.candidate, {
        ...fixture.env,
        COFCO_PREPROD_APPLY: "APPLY_PREPRODUCTION",
        FAKE_FAIL_UP_RELEASE: fixture.ids.candidate,
        ...injectedEnvironment,
      });

      assert.equal(result.status, 70, result.stderr);
      assert.equal(
        await checkpointTarget(join(fixture.releaseRoot, "current")),
        fixture.ids.current,
      );
      await assert.rejects(
        access(join(fixture.releaseRoot, fixture.ids.candidate)),
        /ENOENT/u,
      );
    });
  }
});

test("failed first deployment leaves no candidate secret or service behind", async () => {
  const fixture = await createFixture({ current: false, previous: false });
  await rm(fixture.secretsDir, { recursive: true });
  await writeFile(join(fixture.state, "services"), "");
  fixture.initialServices = [];
  fixture.initialSecrets = {};
  const result = runScript(remoteApply, fixture.paths.candidate, {
    ...fixture.env,
    COFCO_PREPROD_APPLY: "APPLY_PREPRODUCTION",
    FAKE_FAIL_UP_RELEASE: fixture.ids.candidate,
  });

  assert.notEqual(result.status, 0, result.stdout);
  await assert.rejects(access(fixture.secretsDir), /ENOENT/u);
  assert.equal(await readFile(join(fixture.state, "services"), "utf8"), "");
  assert.equal(
    await checkpointTarget(join(fixture.releaseRoot, "current")),
    undefined,
  );
  assert.equal(
    await checkpointTarget(join(fixture.releaseRoot, "previous")),
    undefined,
  );
});

test("real previous rollback restores the exact pre-call state after failure", async () => {
  const fixture = await createFixture();
  const result = runScript(rollback, fixture.paths.candidate, {
    ...fixture.env,
    COFCO_PREPROD_ROLLBACK: "ROLLBACK_PREPRODUCTION",
    FAKE_FAIL_UP_RELEASE: fixture.ids.previous,
  });

  assert.notEqual(result.status, 0, result.stdout);
  await assertInvocationStateRestored(fixture);
});

test("real previous rollback fault-injects and restores every production step", async (t) => {
  for (const failurePoint of realPreviousRollbackFailurePoints) {
    await t.test(failurePoint, async () => {
      const fixture = await createFixture();
      const result = runScript(rollback, fixture.paths.candidate, {
        ...fixture.env,
        COFCO_PREPROD_ROLLBACK: "ROLLBACK_PREPRODUCTION",
        COFCO_PREPROD_TEST_FAIL_AT: failurePoint,
      });

      await assertInjectedFailure(result, failurePoint, fixture);
      await assertInvocationStateRestored(fixture);
      if (failurePoint === "clear-secrets") {
        assert.match(
          await readFile(join(fixture.state, "trace"), "utf8"),
          /curl:[^\n]*\/healthz/u,
        );
      }
    });
  }
});

test("real undeployed rollback restores the exact pre-call state after checkpoint failure", async () => {
  const fixture = await createFixture({ previous: false });
  const result = runScript(rollback, fixture.paths.candidate, {
    ...fixture.env,
    COFCO_PREPROD_ROLLBACK: "ROLLBACK_PREPRODUCTION",
    COFCO_PREPROD_TEST_FAIL_AT: "current-checkpoint",
  });

  assert.notEqual(result.status, 0, result.stdout);
  fixture.ids.previous = undefined;
  await assertInvocationStateRestored(fixture);
});

test("successful undeployed rollback denies RDS, removes secrets, and stops every service", async () => {
  const fixture = await createFixture({ previous: false });
  const result = runScript(rollback, fixture.paths.candidate, {
    ...fixture.env,
    COFCO_PREPROD_ROLLBACK: "ROLLBACK_PREPRODUCTION",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    await readFile(join(fixture.state, "rds-whitelist"), "utf8"),
    "127.0.0.1",
  );
  await assert.rejects(access(fixture.secretsDir), /ENOENT/u);
  assert.equal(await readFile(join(fixture.state, "services"), "utf8"), "");
  assert.equal(
    await checkpointTarget(join(fixture.releaseRoot, "current")),
    undefined,
  );
  assert.equal(
    await checkpointTarget(join(fixture.releaseRoot, "previous")),
    undefined,
  );
});

test("real undeployed rollback fault-injects every mutation and checkpoint step", async (t) => {
  for (const failurePoint of [
    "deny-whitelist",
    "clear-secrets",
    "stop",
    "current-checkpoint",
    "previous-checkpoint",
  ]) {
    await t.test(failurePoint, async () => {
      const fixture = await createFixture({ previous: false });
      fixture.ids.previous = undefined;
      const result = runScript(rollback, fixture.paths.candidate, {
        ...fixture.env,
        COFCO_PREPROD_ROLLBACK: "ROLLBACK_PREPRODUCTION",
        COFCO_PREPROD_TEST_FAIL_AT: failurePoint,
      });

      await assertInjectedFailure(result, failurePoint, fixture);
      await assertInvocationStateRestored(fixture);
      if (failurePoint === "clear-secrets") {
        assert.match(
          await readFile(join(fixture.state, "trace"), "utf8"),
          /curl:[^\n]*\/healthz/u,
        );
      }
    });
  }
});

test("committed deploy keeps success and matching checkpoints when invocation cleanup fails", async () => {
  const fixture = await createFixture();
  const result = runScript(remoteApply, fixture.paths.candidate, {
    ...fixture.env,
    COFCO_PREPROD_APPLY: "APPLY_PREPRODUCTION",
    FAKE_FAIL_INVOCATION_CLEANUP: "true",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    await checkpointTarget(join(fixture.releaseRoot, "current")),
    fixture.ids.candidate,
  );
  assert.equal(
    await checkpointTarget(join(fixture.releaseRoot, "previous")),
    fixture.ids.current,
  );
});

test("invocation snapshots use a controlled runtime directory and never the release root", async () => {
  const fixture = await createFixture();
  const result = runScript(remoteApply, fixture.paths.candidate, {
    ...fixture.env,
    COFCO_PREPROD_APPLY: "APPLY_PREPRODUCTION",
    FAKE_FAIL_UP_RELEASE: fixture.ids.candidate,
    FAKE_FAIL_INVOCATION_CLEANUP: "true",
  });

  assert.equal(result.status, 70, result.stderr);
  assert.deepEqual(
    (await readdir(fixture.releaseRoot)).filter((name) =>
      name.startsWith(".transaction"),
    ),
    [],
  );
  const invocationRoot = join(
    fixture.runtimeRoot,
    "cofco-preproduction/operations/invocations",
  );
  const invocationDirectories = await readdir(invocationRoot);
  assert.equal(invocationDirectories.length, 1);
  const invocationDirectory = join(invocationRoot, invocationDirectories[0]);
  assert.equal((await stat(invocationDirectory)).mode & 0o777, 0o700);
  assert.equal(
    (await stat(join(invocationDirectory, "runtime-secrets.tar"))).mode & 0o777,
    0o600,
  );
});

test("operation startup removes stale controlled invocation snapshots", async () => {
  const fixture = await createFixture();
  const invocationRoot = join(
    fixture.runtimeRoot,
    "cofco-preproduction/operations/invocations",
  );
  const staleInvocation = join(invocationRoot, "invocation-stale");
  await mkdir(staleInvocation, { recursive: true, mode: 0o700 });
  await writeFile(join(staleInvocation, "runtime-secrets.tar"), "stale", {
    mode: 0o600,
  });
  const staleTimestamp = new Date(Date.now() - 3 * 24 * 60 * 60 * 1_000);
  await utimes(staleInvocation, staleTimestamp, staleTimestamp);

  const result = runScript(remoteApply, fixture.paths.candidate, {
    ...fixture.env,
    COFCO_PREPROD_APPLY: "APPLY_PREPRODUCTION",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await readdir(invocationRoot), []);
  await assert.rejects(access(staleInvocation), /ENOENT/u);
});

test("Terraform backend rejects non-private ACL and non-AES256 encryption", async (t) => {
  for (const [label, injectedEnvironment, expectedError] of [
    ["public ACL", { FAKE_TF_STATE_ACL: "public-read" }, /private ACL/iu],
    ["KMS encryption", { FAKE_TF_STATE_ENCRYPTION: "KMS" }, /AES256/iu],
  ]) {
    await t.test(label, async () => {
      const fixture = await createFixture();
      const evidence = join(
        fixture.directory,
        `backend-${label.replaceAll(" ", "-")}`,
      );
      const result = runScript(
        verifyTerraformBackend,
        fixture.paths.candidate,
        {
          ...fixture.env,
          ...injectedEnvironment,
        },
      );

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, expectedError);
      await assert.rejects(access(evidence), /ENOENT/u);
    });
  }
});

for (const [label, script] of [
  ["deploy", remoteApply],
  ["rollback", rollback],
]) {
  test(`${label} takes the shared mutation lock before reading checkpoints`, async () => {
    const fixture = await createFixture();
    const invocationRoot = join(
      fixture.runtimeRoot,
      "cofco-preproduction/operations/invocations",
    );
    const activeInvocation = join(invocationRoot, "invocation-active");
    await mkdir(activeInvocation, { recursive: true, mode: 0o700 });
    await writeFile(join(activeInvocation, "runtime-secrets.tar"), "active", {
      mode: 0o600,
    });
    const oldTimestamp = new Date(Date.now() - 3 * 24 * 60 * 60 * 1_000);
    await utimes(activeInvocation, oldTimestamp, oldTimestamp);
    await mkdir(join(fixture.releaseRoot, ".mutation.lock"), { mode: 0o700 });
    await unlink(join(fixture.releaseRoot, "current"));
    await symlink("../unsafe", join(fixture.releaseRoot, "current"));
    const result = runScript(script, fixture.paths.candidate, {
      ...fixture.env,
      COFCO_PREPROD_APPLY: "APPLY_PREPRODUCTION",
      COFCO_PREPROD_ROLLBACK: "ROLLBACK_PREPRODUCTION",
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /mutation lock is already held/iu);
    assert.doesNotMatch(result.stderr, /unsafe target/iu);
    assert.equal(
      await readFile(join(activeInvocation, "runtime-secrets.tar"), "utf8"),
      "active",
    );
  });
}

test("operations tests invoke the production scripts rather than a synthetic transaction", () => {
  assert.equal(basename(remoteApply), "remote-apply.sh");
  assert.equal(basename(rollback), "rollback.sh");
});
