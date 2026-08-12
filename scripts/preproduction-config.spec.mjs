import assert from "node:assert/strict";
import test from "node:test";

import {
  assessPreproductionConfig,
  canApplyPreproduction,
  parseConfigText,
  sanitizeAssessment,
} from "./preproduction-config.mjs";

const digest = `sha256:${"a".repeat(64)}`;

function completeConfig() {
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
    COFCO_PREPROD_SSH_HOST_ALIAS: "cofco-preproduction",
    COFCO_PREPROD_SSH_EXPECTED_HOST: "bastion.preprod.example.internal",
    COFCO_PREPROD_SSH_USER: "cofco-deployer",
    COFCO_PREPROD_SSH_SOURCE_CIDR: "203.0.113.10/32",
    COFCO_PREPROD_HTTPS_SOURCE_CIDRS: "203.0.113.0/24",
    COFCO_PREPROD_RDS_INSTANCE_ID: "rm-preproduction001",
    COFCO_PREPROD_RDS_PRIVATE_ENDPOINT: "pgm-preproduction.pg.rds.aliyuncs.com",
    COFCO_PREPROD_RDS_PORT: "5432",
    COFCO_PREPROD_RDS_DATABASE: "cofco_preproduction",
    COFCO_PREPROD_RDS_USERNAME: "cofco_preproduction_app",
    COFCO_PREPROD_RDS_WHITELIST_NAME: "cofco_preproduction",
    COFCO_PREPROD_RDS_WHITELIST_CIDRS: "10.40.10.10/32",
    COFCO_PREPROD_RDS_NETWORK_TYPE: "VPC",
    COFCO_PREPROD_RDS_PUBLIC_ENDPOINT_ENABLED: "false",
    COFCO_PREPROD_RDS_SSLMODE: "verify-full",
    COFCO_PREPROD_RDS_CA_SECRET_REF:
      "acs:kms:cn-beijing:123456789012:secret/cofco-preprod-rds-ca",
    COFCO_PREPROD_DB_SECRET_REF:
      "acs:kms:cn-beijing:123456789012:secret/cofco-preprod-db",
    COFCO_PREPROD_OIDC_CLIENT_SECRET_REF:
      "acs:kms:cn-beijing:123456789012:secret/cofco-preprod-oidc",
    COFCO_PREPROD_TLS_CERT_SECRET_REF:
      "acs:kms:cn-beijing:123456789012:secret/cofco-preprod-tls-cert",
    COFCO_PREPROD_TLS_KEY_SECRET_REF:
      "acs:kms:cn-beijing:123456789012:secret/cofco-preprod-tls-key",
    COFCO_PREPROD_ALERT_TARGET_SECRET_REF:
      "acs:kms:cn-beijing:123456789012:secret/cofco-preprod-alert-target",
    COFCO_PREPROD_KMS_ENDPOINT: "kms-vpc.cn-beijing.aliyuncs.com",
    COFCO_PREPROD_TLS_DOMAIN: "preprod.example.internal",
    COFCO_PREPROD_HTTPS_ENDPOINT_IP: "198.51.100.20",
    COFCO_PREPROD_OIDC_ISSUER_URI: "https://idp.example.test/issuer",
    COFCO_PREPROD_OIDC_CLIENT_ID: "cofco-preproduction",
    COFCO_PREPROD_OIDC_REDIRECT_URI:
      "https://preprod.example.internal/login/oauth2/code/enterprise",
    COFCO_PREPROD_OIDC_POST_LOGOUT_REDIRECT_URI:
      "https://preprod.example.internal/",
    COFCO_PREPROD_OIDC_MFA_AMR_VALUES: "mfa",
    COFCO_PREPROD_RELEASE_ID: "stage5-20260812-001",
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
    COFCO_PREPROD_ROLLBACK_RELEASE_ID: "stage5-20260811-001",
  };
}

test("reports missing external inputs without pretending the environment is ready", () => {
  const result = assessPreproductionConfig({
    COFCO_DEPLOYMENT_ENV: "preproduction",
  });

  assert.equal(result.status, "BLOCKED_EXTERNAL");
  assert.ok(result.missing.includes("COFCO_PREPROD_REGION"));
  assert.ok(result.missing.includes("COFCO_PREPROD_DB_SECRET_REF"));
  assert.equal(result.errors.length, 0);
});

test("accepts complete reference-only preproduction inputs for validation", () => {
  const result = assessPreproductionConfig(completeConfig());

  assert.equal(result.status, "READY_FOR_VALIDATION");
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.errors, []);
});

test("rejects plaintext secret fields while allowing KMS references", () => {
  assert.throws(
    () =>
      parseConfigText(
        "COFCO_DEPLOYMENT_ENV=preproduction\nQIQIHAR_DB_PASSWORD=do-not-store-this\n",
      ),
    /plaintext secret key/i,
  );

  assert.doesNotThrow(() =>
    parseConfigText(
      "COFCO_PREPROD_DB_SECRET_REF=acs:kms:cn-beijing:123456789012:secret/db\n",
    ),
  );
});

test("fails closed for production labels, public network access, weak TLS, and mutable images", () => {
  const config = completeConfig();
  config.COFCO_DEPLOYMENT_ENV = "production";
  config.COFCO_PREPROD_RDS_PUBLIC_ENDPOINT_ENABLED = "true";
  config.COFCO_PREPROD_RDS_SSLMODE = "require";
  config.COFCO_PREPROD_HTTPS_SOURCE_CIDRS = "0.0.0.0/0";
  config.COFCO_PREPROD_BACKEND_IMAGE =
    "registry.example.test/cofco/backend:latest";

  const result = assessPreproductionConfig(config);

  assert.equal(result.status, "INVALID");
  assert.match(result.errors.join("\n"), /exactly preproduction/i);
  assert.match(result.errors.join("\n"), /public RDS endpoint/i);
  assert.match(result.errors.join("\n"), /verify-full/i);
  assert.match(result.errors.join("\n"), /0\.0\.0\.0\/0/i);
  assert.match(result.errors.join("\n"), /immutable image/i);
});

test("requires an SSH alias and keeps the ECS address inside the approved vSwitch", () => {
  const config = completeConfig();
  config.COFCO_PREPROD_SSH_HOST_ALIAS = "root@198.51.100.7";
  config.COFCO_PREPROD_ECS_PRIVATE_IP = "10.41.1.8";

  const result = assessPreproductionConfig(config);

  assert.equal(result.status, "INVALID");
  assert.match(result.errors.join("\n"), /SSH host alias/i);
  assert.match(result.errors.join("\n"), /vSwitch CIDR/i);
});

test("requires a non-root SSH user and a distinct approved HostName", () => {
  const config = completeConfig();
  config.COFCO_PREPROD_SSH_EXPECTED_HOST = config.COFCO_PREPROD_SSH_HOST_ALIAS;
  config.COFCO_PREPROD_SSH_USER = "root";

  const result = assessPreproductionConfig(config);

  assert.equal(result.status, "INVALID");
  assert.match(result.errors.join("\n"), /SSH_EXPECTED_HOST/i);
  assert.match(result.errors.join("\n"), /SSH_USER/i);
});

test("rejects empty CIDR lists and non-exact enterprise callback paths", () => {
  const config = completeConfig();
  config.COFCO_PREPROD_SSH_SOURCE_CIDR = ",";
  config.COFCO_PREPROD_HTTPS_SOURCE_CIDRS = " , ";
  config.COFCO_PREPROD_OIDC_REDIRECT_URI =
    "https://preprod.example.internal/unregistered/login/oauth2/code/enterprise";

  const result = assessPreproductionConfig(config);

  assert.equal(result.status, "INVALID");
  assert.match(
    result.errors.join("\n"),
    /SSH_SOURCE_CIDR must contain at least one/i,
  );
  assert.match(
    result.errors.join("\n"),
    /HTTPS_SOURCE_CIDRS must contain at least one/i,
  );
  assert.match(result.errors.join("\n"), /enterprise callback path/i);
});

test("keeps every approved RDS whitelist CIDR inside the preproduction vSwitch", () => {
  const config = completeConfig();
  config.COFCO_PREPROD_RDS_WHITELIST_CIDRS = "10.40.10.10/32,10.41.0.0/24";

  const result = assessPreproductionConfig(config);

  assert.equal(result.status, "INVALID");
  assert.match(result.errors.join("\n"), /RDS whitelist.*vSwitch/i);
});

test("requires a bounded RFC1918 vSwitch instead of a syntactically valid public boundary", () => {
  const config = completeConfig();
  config.COFCO_PREPROD_VSWITCH_CIDR = "0.0.0.0/0";

  const result = assessPreproductionConfig(config);

  assert.equal(result.status, "INVALID");
  assert.match(result.errors.join("\n"), /RFC1918.*\/16/i);
});

test("rejects an invalid HTTPS endpoint binding", () => {
  const config = completeConfig();
  config.COFCO_PREPROD_HTTPS_ENDPOINT_IP = "0.0.0.0";

  const result = assessPreproductionConfig(config);

  assert.equal(result.status, "INVALID");
  assert.match(result.errors.join("\n"), /HTTPS_ENDPOINT_IP/i);
});

test("refuses an image rollback when database migration compatibility is not expand-only", () => {
  const config = completeConfig();
  config.COFCO_PREPROD_MIGRATION_COMPATIBILITY = "unknown";

  const result = assessPreproductionConfig(config);

  assert.equal(result.status, "INVALID");
  assert.match(result.errors.join("\n"), /expand-only/i);
});

test("permits apply only with complete inputs, installed tools, and the exact preproduction phrase", () => {
  const assessment = assessPreproductionConfig(completeConfig());
  const tools = {
    aliyun: true,
    docker: true,
    jq: true,
    ssh: true,
    terraform: true,
  };

  assert.equal(canApplyPreproduction(assessment, "not-approved", tools), false);
  assert.equal(
    canApplyPreproduction(assessment, "APPLY_PREPRODUCTION", tools),
    true,
  );
  assert.equal(
    canApplyPreproduction(assessment, "APPLY_PREPRODUCTION", {
      ...tools,
      terraform: false,
    }),
    false,
  );
});

test("sanitized output exposes only state and secret-reference presence", () => {
  const assessment = assessPreproductionConfig(completeConfig());
  const summary = sanitizeAssessment(assessment, completeConfig());
  const serialized = JSON.stringify(summary);

  assert.equal(summary.status, "READY_FOR_VALIDATION");
  assert.equal(summary.secretReferencesConfigured, 6);
  assert.doesNotMatch(serialized, /123456789012/);
  assert.doesNotMatch(serialized, /cofco-preprod-db/);
});
