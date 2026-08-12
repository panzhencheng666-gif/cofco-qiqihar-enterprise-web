import { promises as dns } from "node:dns";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  cidrWithinBoundary,
  parseCidr,
  parseIpv4,
} from "./preproduction-network.mjs";

export { cidrWithinBoundary };

export function liveVswitchMatches(actual, expected) {
  return (
    actual?.id === expected.id &&
    actual?.vpcId === expected.vpcId &&
    actual?.zoneId === expected.zoneId &&
    actual?.cidr === expected.cidr &&
    parseCidr(actual.cidr) !== undefined
  );
}

export function addressesBoundToCloudTarget(resolvedAddresses, cloudAddresses) {
  const approved = new Set(cloudAddresses.filter((item) => parseIpv4(item)));
  return (
    resolvedAddresses.length > 0 &&
    resolvedAddresses.every(
      (item) => parseIpv4(item) !== undefined && approved.has(item),
    )
  );
}

export function isApprovedOidcRedirect(
  location,
  approvedEndpoint,
  approvedClientId,
  approvedRedirectUri,
) {
  try {
    const actual = new URL(location);
    const approved = new URL(approvedEndpoint);
    const exactSingleValue = (name, expected) => {
      const values = actual.searchParams.getAll(name);
      return values.length === 1 && values[0] === expected;
    };
    const exactNonemptyValue = (name) => {
      const values = actual.searchParams.getAll(name);
      return values.length === 1 && values[0].trim() !== "";
    };
    const scopes = actual.searchParams.getAll("scope");
    return (
      actual.protocol === "https:" &&
      !actual.username &&
      !actual.password &&
      !actual.hash &&
      !actual.searchParams.has("error") &&
      actual.origin === approved.origin &&
      actual.pathname === approved.pathname &&
      exactSingleValue("response_type", "code") &&
      exactSingleValue("client_id", approvedClientId) &&
      exactSingleValue("redirect_uri", approvedRedirectUri) &&
      scopes.length === 1 &&
      scopes[0].split(/\s+/u).includes("openid") &&
      exactNonemptyValue("state") &&
      exactNonemptyValue("nonce")
    );
  } catch {
    return false;
  }
}

export function renderGatewayTemplate(template, domain) {
  if (!/^[a-z0-9.-]+$/u.test(domain) || !domain.includes(".")) {
    throw new Error("invalid approved TLS domain");
  }
  const marker = "__COFCO_PREPROD_TLS_DOMAIN__";
  if (!template.includes(marker)) {
    throw new Error("gateway template marker is missing");
  }
  return template.replaceAll(marker, domain);
}

async function runCli() {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === "oidc-redirect" && args.length === 4) {
    process.exitCode = isApprovedOidcRedirect(...args) ? 0 : 1;
    return;
  }
  if (mode === "cidrs-within" && args.length === 2) {
    const candidates = args[1]
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    process.exitCode =
      candidates.length > 0 &&
      candidates.every((candidate) => cidrWithinBoundary(candidate, args[0]))
        ? 0
        : 1;
    return;
  }
  if (mode === "resolve-host" && args.length === 1) {
    const literal = parseIpv4(args[0]);
    const addresses =
      literal === undefined ? await dns.resolve4(args[0]) : [args[0]];
    process.stdout.write(`${JSON.stringify([...new Set(addresses)])}\n`);
    return;
  }
  if (mode === "addresses-approved" && args.length === 2) {
    try {
      const resolvedAddresses = JSON.parse(args[0]);
      const cloudAddresses = JSON.parse(args[1]);
      process.exitCode = addressesBoundToCloudTarget(
        resolvedAddresses,
        cloudAddresses,
      )
        ? 0
        : 1;
    } catch {
      process.exitCode = 1;
    }
    return;
  }
  if (mode === "render-gateway" && args.length === 3) {
    const [templatePath, outputPath, domain] = args;
    const rendered = renderGatewayTemplate(
      await readFile(resolve(templatePath), "utf8"),
      domain,
    );
    await writeFile(resolve(outputPath), rendered, { mode: 0o644 });
    return;
  }
  process.stderr.write(
    "usage: preproduction-runtime.mjs <oidc-redirect|cidrs-within|resolve-host|addresses-approved|render-gateway> ...\n",
  );
  process.exitCode = 1;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runCli();
}
