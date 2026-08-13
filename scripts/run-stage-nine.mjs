import { resolve } from "node:path";

import {
  publishStageNineEvidence,
  verifyStageNineEvidence,
} from "./stage-nine-core.mjs";
import { runNativeStageNineRecovery } from "./stage-nine-postgres.mjs";

const webRepository = resolve(import.meta.dirname, "..");
const backendRepository = resolve(
  webRepository,
  "../cofco-qiqihar-enterprise-backend",
);

function usage() {
  return [
    "Usage:",
    "  node scripts/run-stage-nine.mjs local [--output <new-directory>]",
    "  node scripts/run-stage-nine.mjs verify-evidence <directory>",
  ].join("\n");
}

function defaultOutput() {
  const timestamp = new Date().toISOString().replaceAll(/[-:.]/gu, "");
  return resolve(webRepository, "evidence", `stage9-local-${timestamp}`);
}

function parseLocalArguments(args) {
  if (args.length === 0) return defaultOutput();
  if (args.length === 2 && args[0] === "--output") return resolve(args[1]);
  throw new Error(usage());
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "local") {
    const output = parseLocalArguments(args);
    const run = await runNativeStageNineRecovery({
      webRepository,
      backendRepository,
    });
    await publishStageNineEvidence(output, run);
    const verified = await verifyStageNineEvidence(output);
    process.stdout.write(
      `${JSON.stringify({
        status: verified.status,
        externalStatus: verified.externalStatus,
        rpoSeconds: verified.recovery.rpoSeconds,
        rtoSeconds: verified.recovery.rtoSeconds,
        evidence: output,
      })}\n`,
    );
    return;
  }
  if (command === "verify-evidence" && args.length === 1) {
    const verified = await verifyStageNineEvidence(resolve(args[0]));
    process.stdout.write(
      `${JSON.stringify({
        status: verified.status,
        externalStatus: verified.externalStatus,
        rpoSeconds: verified.recovery.rpoSeconds,
        rtoSeconds: verified.recovery.rtoSeconds,
      })}\n`,
    );
    return;
  }
  throw new Error(usage());
}

main().catch((error) => {
  process.stderr.write(`Stage 9 operator command failed: ${error.message}\n`);
  process.exitCode = 1;
});
