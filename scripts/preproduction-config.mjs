import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  cidrWithinBoundary,
  ipWithinCidr,
  parseCidr,
  parseIpv4,
} from "./preproduction-network.mjs";

const secretReferenceKeys = [
  "COFCO_PREPROD_RDS_CA_SECRET_REF",
  "COFCO_PREPROD_DB_SECRET_REF",
  "COFCO_PREPROD_OIDC_CLIENT_SECRET_REF",
  "COFCO_PREPROD_TLS_CERT_SECRET_REF",
  "COFCO_PREPROD_TLS_KEY_SECRET_REF",
  "COFCO_PREPROD_ALERT_TARGET_SECRET_REF",
];

const imageKeys = [
  "COFCO_PREPROD_BACKEND_IMAGE",
  "COFCO_PREPROD_BUSINESS_IMAGE",
  "COFCO_PREPROD_OVERVIEW_IMAGE",
  "COFCO_PREPROD_GATEWAY_IMAGE",
  "COFCO_PREPROD_PROMETHEUS_IMAGE",
  "COFCO_PREPROD_BLACKBOX_IMAGE",
  "COFCO_PREPROD_ALERTMANAGER_IMAGE",
];

export const requiredPreproductionKeys = [
  "COFCO_DEPLOYMENT_ENV",
  "COFCO_PREPROD_FIRST_DEPLOYMENT",
  "COFCO_PREPROD_PRODUCTION_ISOLATION_APPROVED",
  "COFCO_PREPROD_REGION",
  "COFCO_PREPROD_ZONE_ID",
  "COFCO_PREPROD_VPC_ID",
  "COFCO_PREPROD_VSWITCH_ID",
  "COFCO_PREPROD_VSWITCH_CIDR",
  "COFCO_PREPROD_SECURITY_GROUP_ID",
  "COFCO_PREPROD_ECS_INSTANCE_ID",
  "COFCO_PREPROD_ECS_PRIVATE_IP",
  "COFCO_PREPROD_HTTPS_ENDPOINT_IP",
  "COFCO_PREPROD_SSH_HOST_ALIAS",
  "COFCO_PREPROD_SSH_EXPECTED_HOST",
  "COFCO_PREPROD_SSH_USER",
  "COFCO_PREPROD_SSH_MODE",
  "COFCO_PREPROD_SSH_PORT",
  "COFCO_PREPROD_SSH_HOST_KEY_SHA256",
  "COFCO_PREPROD_SSH_SOURCE_CIDR",
  "COFCO_PREPROD_HTTPS_SOURCE_CIDRS",
  "COFCO_PREPROD_RDS_INSTANCE_ID",
  "COFCO_PREPROD_RDS_PRIVATE_ENDPOINT",
  "COFCO_PREPROD_RDS_PORT",
  "COFCO_PREPROD_RDS_DATABASE",
  "COFCO_PREPROD_RDS_USERNAME",
  "COFCO_PREPROD_RDS_WHITELIST_NAME",
  "COFCO_PREPROD_RDS_WHITELIST_CIDRS",
  "COFCO_PREPROD_RDS_NETWORK_TYPE",
  "COFCO_PREPROD_RDS_PUBLIC_ENDPOINT_ENABLED",
  "COFCO_PREPROD_RDS_SSLMODE",
  "COFCO_PREPROD_OSS_ENDPOINT",
  "COFCO_PREPROD_OSS_BUCKET",
  "COFCO_PREPROD_OSS_PREFIX",
  "COFCO_PREPROD_OSS_KMS_KEY_REF",
  "COFCO_PREPROD_ECS_RAM_ROLE",
  ...secretReferenceKeys,
  "COFCO_PREPROD_KMS_ENDPOINT",
  "COFCO_PREPROD_TLS_DOMAIN",
  "COFCO_PREPROD_OIDC_ISSUER_URI",
  "COFCO_PREPROD_OIDC_AUTHORIZATION_ENDPOINT",
  "COFCO_PREPROD_OIDC_CLIENT_ID",
  "COFCO_PREPROD_OIDC_REDIRECT_URI",
  "COFCO_PREPROD_OIDC_POST_LOGOUT_REDIRECT_URI",
  "COFCO_PREPROD_OIDC_MFA_AMR_VALUES",
  "COFCO_PREPROD_RELEASE_ID",
  ...imageKeys,
  "COFCO_PREPROD_MIGRATION_COMPATIBILITY",
  "COFCO_PREPROD_BACKUP_METHOD",
  "COFCO_PREPROD_RPO_MINUTES",
  "COFCO_PREPROD_RTO_MINUTES",
  "COFCO_PREPROD_MONITORING_RETENTION",
  "COFCO_PREPROD_ROLLBACK_RELEASE_ID",
  "COFCO_PREPROD_TF_STATE_BUCKET",
  "COFCO_PREPROD_TF_STATE_PREFIX",
  "COFCO_PREPROD_TF_STATE_KEY",
  "COFCO_PREPROD_TF_STATE_OSS_ENDPOINT",
  "COFCO_PREPROD_TF_STATE_TABLESTORE_ENDPOINT",
  "COFCO_PREPROD_TF_STATE_TABLESTORE_INSTANCE",
  "COFCO_PREPROD_TF_STATE_TABLESTORE_TABLE",
  "COFCO_PREPROD_TF_STATE_VERSIONING_APPROVED",
  "COFCO_PREPROD_TF_STATE_MINIMUM_PERMISSIONS_APPROVED",
];

const plaintextSecretKeyPattern =
  /(PASSWORD|PRIVATE_KEY|ACCESS_KEY_SECRET|CLIENT_SECRET|TOKEN|COOKIE)/iu;
const forbiddenValuePattern =
  /(-----BEGIN [A-Z ]*PRIVATE KEY-----|password\s*=|access[_-]?key[_-]?secret\s*=|client[_-]?secret\s*=)/iu;
const immutableImagePattern = /^[a-z0-9][a-z0-9._:/-]*@sha256:[a-f0-9]{64}$/u;
const kmsReferencePattern =
  /^acs:kms:([a-z]{2}-[a-z0-9-]+):[0-9]{12,}:secret\/[A-Za-z0-9._/-]+$/u;

function cleanValue(value) {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseConfigText(text) {
  const config = {};
  const lines = text.split(/\r?\n/u);

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) return;
    const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
    const separator = normalized.indexOf("=");
    if (separator < 1) {
      throw new Error(`Invalid config syntax on line ${index + 1}`);
    }
    const key = normalized.slice(0, separator).trim();
    const value = cleanValue(normalized.slice(separator + 1));
    if (!/^[A-Z][A-Z0-9_]*$/u.test(key)) {
      throw new Error(`Invalid config key on line ${index + 1}`);
    }
    if (Object.hasOwn(config, key)) {
      throw new Error(`Duplicate config key ${key}`);
    }
    if (plaintextSecretKeyPattern.test(key) && !key.endsWith("_SECRET_REF")) {
      throw new Error(`Plaintext secret key ${key} is forbidden`);
    }
    if (forbiddenValuePattern.test(value)) {
      throw new Error(
        `Plaintext secret material is forbidden on line ${index + 1}`,
      );
    }
    config[key] = value;
  });

  return config;
}

function validateCidrList(value, label, minimumPrefix, errors) {
  const cidrs = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (cidrs.length === 0) {
    errors.push(`${label} must contain at least one IPv4 CIDR`);
    return [];
  }
  for (const cidr of cidrs) {
    const parsed = parseCidr(cidr);
    if (!parsed) {
      errors.push(`${label} contains an invalid IPv4 CIDR`);
    } else if (parsed.prefix < minimumPrefix) {
      errors.push(
        `${label} must be at least /${minimumPrefix}; ${cidr} is too broad`,
      );
    }
  }
  return cidrs;
}

function validateUrl(value, label, errors) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") errors.push(`${label} must use HTTPS`);
    return url;
  } catch {
    errors.push(`${label} must be an absolute HTTPS URL`);
    return undefined;
  }
}

export function assessPreproductionConfig(config) {
  const missing = requiredPreproductionKeys.filter(
    (key) => !Object.hasOwn(config, key) || config[key].trim() === "",
  );
  const errors = [];
  const value = (key) => config[key]?.trim() ?? "";

  if (
    value("COFCO_DEPLOYMENT_ENV") &&
    value("COFCO_DEPLOYMENT_ENV") !== "preproduction"
  ) {
    errors.push("COFCO_DEPLOYMENT_ENV must be exactly preproduction");
  }
  if (
    value("COFCO_PREPROD_FIRST_DEPLOYMENT") &&
    value("COFCO_PREPROD_FIRST_DEPLOYMENT") !== "true"
  ) {
    errors.push(
      "The first cloud deployment must remain marked as preproduction",
    );
  }
  if (
    value("COFCO_PREPROD_PRODUCTION_ISOLATION_APPROVED") &&
    value("COFCO_PREPROD_PRODUCTION_ISOLATION_APPROVED") !== "true"
  ) {
    errors.push(
      "The preproduction/production isolation boundary is not approved",
    );
  }

  const region = value("COFCO_PREPROD_REGION");
  if (region && !/^[a-z]{2}-[a-z0-9-]+$/u.test(region)) {
    errors.push("COFCO_PREPROD_REGION is invalid");
  }
  const zone = value("COFCO_PREPROD_ZONE_ID");
  if (zone && region && !zone.startsWith(`${region}-`)) {
    errors.push("COFCO_PREPROD_ZONE_ID must belong to the approved region");
  }

  const resourcePatterns = new Map([
    ["COFCO_PREPROD_VPC_ID", /^vpc-[A-Za-z0-9]+$/u],
    ["COFCO_PREPROD_VSWITCH_ID", /^vsw-[A-Za-z0-9]+$/u],
    ["COFCO_PREPROD_SECURITY_GROUP_ID", /^sg-[A-Za-z0-9]+$/u],
    ["COFCO_PREPROD_ECS_INSTANCE_ID", /^i-[A-Za-z0-9]+$/u],
    ["COFCO_PREPROD_RDS_INSTANCE_ID", /^rm-[A-Za-z0-9]+$/u],
  ]);
  for (const [key, pattern] of resourcePatterns) {
    if (value(key) && !pattern.test(value(key)))
      errors.push(`${key} is invalid`);
  }

  const vswitchCidr = value("COFCO_PREPROD_VSWITCH_CIDR");
  if (vswitchCidr) {
    const parsedVswitch = parseCidr(vswitchCidr);
    if (!parsedVswitch) {
      errors.push("COFCO_PREPROD_VSWITCH_CIDR must be a canonical IPv4 CIDR");
    } else if (
      parsedVswitch.prefix < 16 ||
      !["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"].some(
        (privateBoundary) => cidrWithinBoundary(vswitchCidr, privateBoundary),
      )
    ) {
      errors.push(
        "COFCO_PREPROD_VSWITCH_CIDR must be an RFC1918 private network of /16 or narrower",
      );
    }
  }
  const ecsPrivateIp = value("COFCO_PREPROD_ECS_PRIVATE_IP");
  if (ecsPrivateIp && vswitchCidr && !ipWithinCidr(ecsPrivateIp, vswitchCidr)) {
    errors.push("The ECS private IP must be inside the approved vSwitch CIDR");
  }
  const httpsEndpointIp = value("COFCO_PREPROD_HTTPS_ENDPOINT_IP");
  if (
    httpsEndpointIp &&
    (parseIpv4(httpsEndpointIp) === undefined ||
      httpsEndpointIp === "0.0.0.0" ||
      httpsEndpointIp === "255.255.255.255")
  ) {
    errors.push(
      "COFCO_PREPROD_HTTPS_ENDPOINT_IP must be a specific approved IPv4 address",
    );
  }

  const sshAlias = value("COFCO_PREPROD_SSH_HOST_ALIAS");
  if (
    sshAlias &&
    (!/^[A-Za-z][A-Za-z0-9._-]*$/u.test(sshAlias) ||
      sshAlias.includes("@") ||
      parseIpv4(sshAlias) !== undefined)
  ) {
    errors.push(
      "COFCO_PREPROD_SSH_HOST_ALIAS must be an SSH host alias, not user@host or an IP",
    );
  }
  const sshExpectedHost = value("COFCO_PREPROD_SSH_EXPECTED_HOST");
  if (
    sshExpectedHost &&
    (!/^[A-Za-z0-9.-]+$/u.test(sshExpectedHost) || sshExpectedHost === sshAlias)
  ) {
    errors.push(
      "COFCO_PREPROD_SSH_EXPECTED_HOST must be the distinct approved SSH HostName",
    );
  }
  const sshUser = value("COFCO_PREPROD_SSH_USER");
  if (
    sshUser &&
    (!/^[a-z_][a-z0-9_-]{1,30}$/u.test(sshUser) || sshUser === "root")
  ) {
    errors.push("COFCO_PREPROD_SSH_USER must be a bounded non-root account");
  }
  const sshMode = value("COFCO_PREPROD_SSH_MODE");
  if (sshMode && sshMode !== "direct") {
    errors.push(
      "COFCO_PREPROD_SSH_MODE must be direct; proxy and jump topologies require a separately approved package revision",
    );
  }
  if (
    value("COFCO_PREPROD_SSH_PORT") &&
    value("COFCO_PREPROD_SSH_PORT") !== "22"
  ) {
    errors.push("COFCO_PREPROD_SSH_PORT must be the approved direct port 22");
  }
  if (
    value("COFCO_PREPROD_SSH_HOST_KEY_SHA256") &&
    !/^SHA256:[A-Za-z0-9+/]{43}$/u.test(
      value("COFCO_PREPROD_SSH_HOST_KEY_SHA256"),
    )
  ) {
    errors.push(
      "COFCO_PREPROD_SSH_HOST_KEY_SHA256 must be an approved SHA256 host-key fingerprint",
    );
  }
  if (
    sshMode === "direct" &&
    (value("COFCO_PREPROD_SSH_PROXY_JUMP_ALIAS") ||
      value("COFCO_PREPROD_SSH_PROXY_COMMAND"))
  ) {
    errors.push("Direct SSH mode forbids proxy and jump configuration");
  }
  if (value("COFCO_PREPROD_SSH_SOURCE_CIDR")) {
    validateCidrList(
      value("COFCO_PREPROD_SSH_SOURCE_CIDR"),
      "COFCO_PREPROD_SSH_SOURCE_CIDR",
      24,
      errors,
    );
  }
  if (value("COFCO_PREPROD_HTTPS_SOURCE_CIDRS")) {
    validateCidrList(
      value("COFCO_PREPROD_HTTPS_SOURCE_CIDRS"),
      "COFCO_PREPROD_HTTPS_SOURCE_CIDRS",
      8,
      errors,
    );
  }

  const rdsEndpoint = value("COFCO_PREPROD_RDS_PRIVATE_ENDPOINT");
  if (
    rdsEndpoint &&
    (!/^[A-Za-z0-9.-]+\.rds\.aliyuncs\.com$/u.test(rdsEndpoint) ||
      rdsEndpoint.includes("://"))
  ) {
    errors.push(
      "The RDS private endpoint must be an Alibaba Cloud RDS DNS name without a scheme",
    );
  }
  if (
    value("COFCO_PREPROD_RDS_NETWORK_TYPE") &&
    value("COFCO_PREPROD_RDS_NETWORK_TYPE") !== "VPC"
  ) {
    errors.push("COFCO_PREPROD_RDS_NETWORK_TYPE must be VPC");
  }
  if (
    value("COFCO_PREPROD_RDS_PUBLIC_ENDPOINT_ENABLED") &&
    value("COFCO_PREPROD_RDS_PUBLIC_ENDPOINT_ENABLED") !== "false"
  ) {
    errors.push("A public RDS endpoint is forbidden in preproduction");
  }
  if (
    value("COFCO_PREPROD_RDS_SSLMODE") &&
    value("COFCO_PREPROD_RDS_SSLMODE") !== "verify-full"
  ) {
    errors.push("COFCO_PREPROD_RDS_SSLMODE must be verify-full");
  }
  if (
    value("COFCO_PREPROD_RDS_PORT") &&
    value("COFCO_PREPROD_RDS_PORT") !== "5432"
  ) {
    errors.push(
      "COFCO_PREPROD_RDS_PORT must be 5432 for the approved PostgreSQL topology",
    );
  }
  for (const key of [
    "COFCO_PREPROD_RDS_DATABASE",
    "COFCO_PREPROD_RDS_USERNAME",
  ]) {
    if (value(key) && !/^[a-z][a-z0-9_]{2,62}$/u.test(value(key))) {
      errors.push(`${key} must be a bounded PostgreSQL identifier`);
    }
  }
  const whitelistName = value("COFCO_PREPROD_RDS_WHITELIST_NAME");
  if (whitelistName && !/^[A-Za-z][A-Za-z0-9_]{2,63}$/u.test(whitelistName)) {
    errors.push("COFCO_PREPROD_RDS_WHITELIST_NAME is invalid");
  }
  if (value("COFCO_PREPROD_RDS_WHITELIST_CIDRS")) {
    const whitelistCidrs = validateCidrList(
      value("COFCO_PREPROD_RDS_WHITELIST_CIDRS"),
      "COFCO_PREPROD_RDS_WHITELIST_CIDRS",
      24,
      errors,
    );
    for (const cidr of whitelistCidrs) {
      if (
        vswitchCidr &&
        parseCidr(cidr) &&
        !cidrWithinBoundary(cidr, vswitchCidr)
      ) {
        errors.push(
          "Every RDS whitelist CIDR must be inside the approved vSwitch CIDR",
        );
      }
    }
  }

  for (const key of secretReferenceKeys) {
    if (!value(key)) continue;
    const match = kmsReferencePattern.exec(value(key));
    if (!match) {
      errors.push(`${key} must be an Alibaba Cloud KMS secret ARN reference`);
    } else if (region && match[1] !== region) {
      errors.push(`${key} must be in the approved region`);
    }
  }
  const kmsEndpoint = value("COFCO_PREPROD_KMS_ENDPOINT");
  if (
    kmsEndpoint &&
    region &&
    kmsEndpoint !== `kms-vpc.${region}.aliyuncs.com` &&
    !/^[A-Za-z0-9-]+\.cryptoservice\.kms\.aliyuncs\.com$/u.test(kmsEndpoint)
  ) {
    errors.push(
      "COFCO_PREPROD_KMS_ENDPOINT must be the regional VPC or approved dedicated KMS endpoint",
    );
  }

  const privateOssEndpoint = value("COFCO_PREPROD_OSS_ENDPOINT");
  if (privateOssEndpoint) {
    const parsed = validateUrl(
      privateOssEndpoint,
      "private OSS endpoint",
      errors,
    );
    if (
      parsed &&
      !/^oss-[a-z0-9-]+(?:-internal)?\.aliyuncs\.com$/u.test(parsed.hostname)
    ) {
      errors.push(
        "COFCO_PREPROD_OSS_ENDPOINT must be an approved regional Alibaba OSS endpoint",
      );
    }
  }
  if (
    value("COFCO_PREPROD_OSS_BUCKET") &&
    !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/u.test(
      value("COFCO_PREPROD_OSS_BUCKET"),
    )
  ) {
    errors.push("COFCO_PREPROD_OSS_BUCKET is invalid");
  }
  if (
    value("COFCO_PREPROD_OSS_PREFIX") &&
    !/^[a-z0-9][a-z0-9/_-]{0,119}$/u.test(value("COFCO_PREPROD_OSS_PREFIX"))
  ) {
    errors.push("COFCO_PREPROD_OSS_PREFIX is invalid");
  }
  if (
    value("COFCO_PREPROD_OSS_KMS_KEY_REF") &&
    !/^acs:kms:[a-z]{2}-[a-z0-9-]+:[0-9]{12,}:key\/[A-Za-z0-9._/-]+$/u.test(
      value("COFCO_PREPROD_OSS_KMS_KEY_REF"),
    )
  ) {
    errors.push("COFCO_PREPROD_OSS_KMS_KEY_REF is invalid");
  }
  if (
    value("COFCO_PREPROD_ECS_RAM_ROLE") &&
    !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/u.test(
      value("COFCO_PREPROD_ECS_RAM_ROLE"),
    )
  ) {
    errors.push("COFCO_PREPROD_ECS_RAM_ROLE is invalid");
  }

  const tlsDomain = value("COFCO_PREPROD_TLS_DOMAIN");
  if (
    tlsDomain &&
    (!/^[a-z0-9.-]+$/u.test(tlsDomain) || !tlsDomain.includes("."))
  ) {
    errors.push("COFCO_PREPROD_TLS_DOMAIN is invalid");
  }
  const issuer = value("COFCO_PREPROD_OIDC_ISSUER_URI")
    ? validateUrl(value("COFCO_PREPROD_OIDC_ISSUER_URI"), "OIDC issuer", errors)
    : undefined;
  const authorizationEndpoint = value(
    "COFCO_PREPROD_OIDC_AUTHORIZATION_ENDPOINT",
  )
    ? validateUrl(
        value("COFCO_PREPROD_OIDC_AUTHORIZATION_ENDPOINT"),
        "OIDC authorization endpoint",
        errors,
      )
    : undefined;
  if (
    issuer &&
    authorizationEndpoint &&
    authorizationEndpoint.origin !== issuer.origin
  ) {
    errors.push(
      "OIDC authorization endpoint must use the approved issuer origin",
    );
  }
  if (
    authorizationEndpoint &&
    (authorizationEndpoint.username ||
      authorizationEndpoint.password ||
      authorizationEndpoint.search ||
      authorizationEndpoint.hash)
  ) {
    errors.push(
      "OIDC authorization endpoint must not contain credentials, query, or fragment",
    );
  }
  const redirect = value("COFCO_PREPROD_OIDC_REDIRECT_URI")
    ? validateUrl(
        value("COFCO_PREPROD_OIDC_REDIRECT_URI"),
        "OIDC redirect URI",
        errors,
      )
    : undefined;
  const logoutRedirect = value("COFCO_PREPROD_OIDC_POST_LOGOUT_REDIRECT_URI")
    ? validateUrl(
        value("COFCO_PREPROD_OIDC_POST_LOGOUT_REDIRECT_URI"),
        "OIDC post-logout redirect URI",
        errors,
      )
    : undefined;
  if (
    redirect &&
    (redirect.pathname !== "/login/oauth2/code/enterprise" ||
      redirect.search !== "" ||
      redirect.hash !== "" ||
      (tlsDomain && redirect.hostname !== tlsDomain))
  ) {
    errors.push(
      "OIDC redirect URI must use the approved TLS domain and enterprise callback path",
    );
  }
  if (logoutRedirect && tlsDomain && logoutRedirect.hostname !== tlsDomain) {
    errors.push(
      "OIDC post-logout redirect URI must use the approved TLS domain",
    );
  }

  for (const key of imageKeys) {
    if (value(key) && !immutableImagePattern.test(value(key))) {
      errors.push(
        `${key} must be an immutable image reference with a sha256 digest`,
      );
    }
  }
  if (
    value("COFCO_PREPROD_MIGRATION_COMPATIBILITY") &&
    value("COFCO_PREPROD_MIGRATION_COMPATIBILITY") !== "expand-only"
  ) {
    errors.push(
      "COFCO_PREPROD_MIGRATION_COMPATIBILITY must be expand-only before image rollback is enabled",
    );
  }
  const releaseId = value("COFCO_PREPROD_RELEASE_ID");
  const rollbackId = value("COFCO_PREPROD_ROLLBACK_RELEASE_ID");
  for (const [label, release] of [
    ["release", releaseId],
    ["rollback release", rollbackId],
  ]) {
    if (
      release &&
      (!/^[A-Za-z0-9._-]{6,80}$/u.test(release) ||
        /(^|[-_.])prod(uction)?($|[-_.])/iu.test(release))
    ) {
      errors.push(`The ${label} ID is invalid or production-labelled`);
    }
  }
  if (releaseId && rollbackId && releaseId === rollbackId) {
    errors.push("The rollback release must differ from the candidate release");
  }

  if (
    value("COFCO_PREPROD_BACKUP_METHOD") &&
    !["Physical", "Snapshot"].includes(value("COFCO_PREPROD_BACKUP_METHOD"))
  ) {
    errors.push(
      "COFCO_PREPROD_BACKUP_METHOD must be Physical or Snapshot for PostgreSQL",
    );
  }
  const rpo = Number(value("COFCO_PREPROD_RPO_MINUTES"));
  if (
    value("COFCO_PREPROD_RPO_MINUTES") &&
    (!Number.isInteger(rpo) || rpo < 1 || rpo > 15)
  ) {
    errors.push("COFCO_PREPROD_RPO_MINUTES must be between 1 and 15");
  }
  const rto = Number(value("COFCO_PREPROD_RTO_MINUTES"));
  if (
    value("COFCO_PREPROD_RTO_MINUTES") &&
    (!Number.isInteger(rto) || rto < 1 || rto > 120)
  ) {
    errors.push("COFCO_PREPROD_RTO_MINUTES must be between 1 and 120");
  }
  if (
    value("COFCO_PREPROD_MONITORING_RETENTION") &&
    !/^[1-9][0-9]*d$/u.test(value("COFCO_PREPROD_MONITORING_RETENTION"))
  ) {
    errors.push(
      "COFCO_PREPROD_MONITORING_RETENTION must be expressed as whole days",
    );
  }

  const stateBucket = value("COFCO_PREPROD_TF_STATE_BUCKET");
  if (
    stateBucket &&
    (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/u.test(stateBucket) ||
      !stateBucket.includes("preprod"))
  ) {
    errors.push(
      "COFCO_PREPROD_TF_STATE_BUCKET must be a bounded preproduction OSS bucket name",
    );
  }
  for (const key of [
    "COFCO_PREPROD_TF_STATE_PREFIX",
    "COFCO_PREPROD_TF_STATE_KEY",
  ]) {
    if (
      value(key) &&
      (!/^[A-Za-z0-9._/-]{3,180}$/u.test(value(key)) ||
        value(key).startsWith("/") ||
        value(key).includes(".."))
    ) {
      errors.push(`${key} must be a bounded relative state object path`);
    }
  }
  const ossEndpoint = value("COFCO_PREPROD_TF_STATE_OSS_ENDPOINT");
  if (
    ossEndpoint &&
    region &&
    ossEndpoint !== `oss-${region}-internal.aliyuncs.com`
  ) {
    errors.push(
      "COFCO_PREPROD_TF_STATE_OSS_ENDPOINT must be the approved regional internal OSS endpoint",
    );
  }
  const tableStoreEndpoint = value(
    "COFCO_PREPROD_TF_STATE_TABLESTORE_ENDPOINT",
  );
  if (
    tableStoreEndpoint &&
    (!/^https:\/\/[A-Za-z0-9-]+\.[a-z]{2}-[a-z0-9-]+\.vpc\.tablestore\.aliyuncs\.com$/u.test(
      tableStoreEndpoint,
    ) ||
      (region && !tableStoreEndpoint.includes(`.${region}.`)))
  ) {
    errors.push(
      "COFCO_PREPROD_TF_STATE_TABLESTORE_ENDPOINT must be the approved regional VPC endpoint",
    );
  }
  for (const key of [
    "COFCO_PREPROD_TF_STATE_TABLESTORE_INSTANCE",
    "COFCO_PREPROD_TF_STATE_TABLESTORE_TABLE",
  ]) {
    if (value(key) && !/^[A-Za-z][A-Za-z0-9_-]{2,62}$/u.test(value(key))) {
      errors.push(`${key} is invalid`);
    }
  }
  if (
    value("COFCO_PREPROD_TF_STATE_VERSIONING_APPROVED") &&
    value("COFCO_PREPROD_TF_STATE_VERSIONING_APPROVED") !== "true"
  ) {
    errors.push("Terraform state OSS versioning must be approved");
  }
  if (
    value("COFCO_PREPROD_TF_STATE_MINIMUM_PERMISSIONS_APPROVED") &&
    value("COFCO_PREPROD_TF_STATE_MINIMUM_PERMISSIONS_APPROVED") !== "true"
  ) {
    errors.push("Terraform state minimum permissions must be approved");
  }

  return {
    status:
      errors.length > 0
        ? "INVALID"
        : missing.length > 0
          ? "BLOCKED_EXTERNAL"
          : "READY_FOR_VALIDATION",
    missing,
    errors,
  };
}

export function canApplyPreproduction(assessment, approvalPhrase, tools) {
  const requiredTools = ["aliyun", "docker", "jq", "ssh", "terraform"];
  return (
    assessment.status === "READY_FOR_VALIDATION" &&
    approvalPhrase === "APPLY_PREPRODUCTION" &&
    requiredTools.every((tool) => tools[tool] === true)
  );
}

export function sanitizeAssessment(assessment, config) {
  return {
    status: assessment.status,
    missing: assessment.missing,
    errors: assessment.errors,
    environment: config.COFCO_DEPLOYMENT_ENV ?? null,
    regionConfigured: Boolean(config.COFCO_PREPROD_REGION),
    resourceBindingsConfigured: [
      "COFCO_PREPROD_VPC_ID",
      "COFCO_PREPROD_VSWITCH_ID",
      "COFCO_PREPROD_SECURITY_GROUP_ID",
      "COFCO_PREPROD_ECS_INSTANCE_ID",
      "COFCO_PREPROD_RDS_INSTANCE_ID",
    ].filter((key) => Boolean(config[key])).length,
    secretReferencesConfigured: secretReferenceKeys.filter((key) =>
      Boolean(config[key]),
    ).length,
    immutableImagesConfigured: imageKeys.filter((key) =>
      immutableImagePattern.test(config[key] ?? ""),
    ).length,
  };
}

async function runCli() {
  const args = process.argv.slice(2);
  const configIndex = args.indexOf("--config");
  if (configIndex < 0 || !args[configIndex + 1]) {
    process.stderr.write(
      "Usage: node scripts/preproduction-config.mjs --config <path>\n",
    );
    process.exitCode = 1;
    return;
  }
  const configPath = resolve(args[configIndex + 1]);
  try {
    const metadata = await stat(configPath);
    if ((metadata.mode & 0o077) !== 0) {
      process.stderr.write(
        "INVALID: the preproduction config file must have mode 0600\n",
      );
      process.exitCode = 1;
      return;
    }
    const config = parseConfigText(await readFile(configPath, "utf8"));
    const assessment = assessPreproductionConfig(config);
    process.stdout.write(
      `${JSON.stringify(sanitizeAssessment(assessment, config), null, 2)}\n`,
    );
    process.exitCode =
      assessment.status === "READY_FOR_VALIDATION"
        ? 0
        : assessment.status === "BLOCKED_EXTERNAL"
          ? 2
          : 1;
  } catch (error) {
    process.stderr.write(
      `INVALID: ${error instanceof Error ? error.message : "configuration error"}\n`,
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runCli();
}
