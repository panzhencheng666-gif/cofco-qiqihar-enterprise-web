export function parseIpv4(value) {
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

export function parseCidr(value) {
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

export function ipWithinCidr(address, cidr) {
  const ip = parseIpv4(address);
  const parsed = parseCidr(cidr);
  return ip !== undefined && parsed !== undefined
    ? (ip & parsed.mask) >>> 0 === parsed.ip
    : false;
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
