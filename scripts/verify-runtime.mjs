import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

function parseVersion(value, label, allowPartial = false) {
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/u.exec(value);
  if (
    match === null ||
    (!allowPartial && (match[2] === undefined || match[3] === undefined))
  ) {
    throw new Error(`invalid ${label} version`);
  }
  return [
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2] ?? "0", 10),
    Number.parseInt(match[3] ?? "0", 10),
  ];
}

function compare(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function satisfies(version, constraint, label) {
  const actual = parseVersion(version, label);
  const tokens = constraint.trim().split(/\s+/u);
  if (
    tokens.length === 0 ||
    tokens.some((token) => !/^(?:>=|>|<=|<)\d+(?:\.\d+){0,2}$/u.test(token))
  ) {
    throw new Error(`unsupported ${label} constraint`);
  }
  return tokens.every((token) => {
    const operator = /^(>=|>|<=|<)/u.exec(token)?.[1];
    const expected = parseVersion(token.slice(operator.length), label, true);
    const result = compare(actual, expected);
    if (operator === ">=") return result >= 0;
    if (operator === ">") return result > 0;
    if (operator === "<=") return result <= 0;
    return result < 0;
  });
}

export function validateRuntime({ nodeVersion, npmVersion, engines }) {
  const failures = [];
  if (!satisfies(nodeVersion, engines.node, "Node")) {
    failures.push(`Node ${nodeVersion} does not satisfy ${engines.node}`);
  }
  if (!satisfies(npmVersion, engines.npm, "npm")) {
    failures.push(`npm ${npmVersion} does not satisfy ${engines.npm}`);
  }
  return failures;
}

function npmVersionFromEnvironment() {
  const match = /(?:^|\s)npm\/(\d+\.\d+\.\d+)(?:\s|$)/u.exec(
    process.env["npm_config_user_agent"] ?? "",
  );
  if (match === null) throw new Error("invalid npm version");
  return match[1];
}

async function main() {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  const failures = validateRuntime({
    nodeVersion: process.versions.node,
    npmVersion: npmVersionFromEnvironment(),
    engines: packageJson.engines,
  });
  if (failures.length > 0) {
    process.stderr.write(
      `Unsupported verification runtime: ${failures.join("; ")}\n`,
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `Verification runtime accepted: Node ${process.versions.node}, npm ${npmVersionFromEnvironment()}\n`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
