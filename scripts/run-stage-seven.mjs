#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  StageSevenAdmissionError,
  admitRun,
  renderEvidence,
  validateProfile,
} from "./stage-seven-core.mjs";

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

async function main() {
  const command = process.argv[2] ?? "validate";
  const profilePath =
    option("--profile") ??
    resolve(
      import.meta.dirname,
      "../ops/stage7-performance-resilience/profile.json",
    );
  const profile = validateProfile(await readJson(profilePath));
  if (command === "validate") {
    process.stdout.write(
      `STAGE7_PROFILE_VALID schema=${profile.schemaVersion}\n`,
    );
    return;
  }
  if (command === "admit") {
    const mode = option("--mode");
    const request = option("--config")
      ? await readJson(option("--config"))
      : { mode };
    const admission = admitRun({ ...request, mode: mode ?? request.mode });
    process.stdout.write(
      `STAGE7_ADMITTED provenance=${admission.provenance}\n`,
    );
    return;
  }
  if (command === "render") {
    const resultPath = option("--result");
    const outputPath = option("--output");
    if (!resultPath || !outputPath)
      throw new Error("render requires --result and --output");
    const evidence = renderEvidence(await readJson(resultPath));
    await mkdir(resolve(outputPath), { recursive: true, mode: 0o700 });
    await Promise.all(
      Object.entries(evidence).map(([name, content]) =>
        writeFile(resolve(outputPath, name), content, { mode: 0o600 }),
      ),
    );
    process.stdout.write(`STAGE7_EVIDENCE_WRITTEN files=5\n`);
    return;
  }
  throw new Error("Unknown Stage 7 command");
}

main().catch((error) => {
  if (error instanceof StageSevenAdmissionError) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = error.exitCode;
    return;
  }
  process.stderr.write(`STAGE7_ERROR ${error.message}\n`);
  process.exitCode = 1;
});
