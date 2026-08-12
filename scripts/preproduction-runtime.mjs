import { promises as dns } from "node:dns";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function parseIpv4(value) {
  const parts = value.split(".");
  if (parts.length !== 4) return undefined;
  const octets = parts.map(Number);
  if (
    octets.some(
      (octet, index) =>
        !Number.isInteger(octet) ||
        octet < 0 ||
        octet > 255 ||
        String(octet) !== parts[index],
    )
  ) {
    return undefined;
  }
  return octets.reduce((result, octet) => ((result << 8) | octet) >>> 0, 0);
}

function parseCidr(value) {
  const [address, rawPrefix, ...extra] = value.split("/");
  if (extra.length > 0 || rawPrefix === undefined) return undefined;
  const ip = parseIpv4(address);
  const prefix = Number(rawPrefix);
  if (
    ip === undefined ||
    !Number.isInteger(prefix) ||
    prefix < 0 ||
    prefix > 32
  ) {
    return undefined;
  }
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  if ((ip & mask) >>> 0 !== ip) return undefined;
  return { ip, mask, prefix };
}

export function cidrWithinBoundary(candidate, boundary) {
  const parsedCandidate = parseCidr(candidate);
  const parsedBoundary = parseCidr(boundary);
  return Boolean(
    parsedCandidate &&
    parsedBoundary &&
    parsedCandidate.prefix >= parsedBoundary.prefix &&
    (parsedCandidate.ip & parsedBoundary.mask) >>> 0 === parsedBoundary.ip,
  );
}

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

export function isApprovedOidcRedirect(location, approvedEndpoint) {
  try {
    const actual = new URL(location);
    const approved = new URL(approvedEndpoint);
    return (
      actual.protocol === "https:" &&
      !actual.username &&
      !actual.password &&
      !actual.hash &&
      actual.origin === approved.origin &&
      actual.pathname === approved.pathname
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
  if (mode === "oidc-redirect" && args.length === 2) {
    process.exitCode = isApprovedOidcRedirect(args[0], args[1]) ? 0 : 1;
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
