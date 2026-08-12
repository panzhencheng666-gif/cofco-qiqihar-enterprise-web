import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import { renderEvidence } from "./stage-seven-core.mjs";

const evidenceFiles = Object.freeze([
  "run.json",
  "SUMMARY.md",
  "MATRIX.md",
  "VERIFICATION.md",
  "HANDOFF.md",
]);

export function assertEvidenceBundleConsistent(evidence) {
  if (
    !evidence ||
    typeof evidence !== "object" ||
    Object.keys(evidence).length !== evidenceFiles.length ||
    evidenceFiles.some((name) => typeof evidence[name] !== "string")
  ) {
    throw new Error("Stage 7 evidence bundle is incomplete");
  }
  let run;
  try {
    run = JSON.parse(evidence["run.json"]);
  } catch {
    throw new Error("Stage 7 run.json is invalid");
  }
  const expected = renderEvidence(run);
  for (const name of evidenceFiles) {
    if (evidence[name] !== expected[name]) {
      throw new Error(`Stage 7 evidence drift detected in ${name}`);
    }
  }
  return run;
}

export async function readEvidenceBundle(directory) {
  const target = resolve(directory);
  const lock = join(
    dirname(target),
    `.stage7-evidence-${basename(target)}.publish-lock`,
  );
  try {
    await readdir(lock);
    throw new Error("Stage 7 evidence publication is still in progress");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return readEvidenceBundleUnchecked(target);
}

async function readEvidenceBundleUnchecked(directory) {
  const actualFiles = (await readdir(resolve(directory))).sort();
  const expectedFiles = [...evidenceFiles].sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error(
      "Stage 7 evidence directory must contain exactly five files",
    );
  }
  const entries = await Promise.all(
    evidenceFiles.map(async (name) => [
      name,
      await readFile(resolve(directory, name), "utf8"),
    ]),
  );
  return Object.fromEntries(entries);
}

export async function verifyEvidenceDirectory(directory) {
  return assertEvidenceBundleConsistent(await readEvidenceBundle(directory));
}

export async function publishEvidenceBundleAtomically(
  outputPath,
  evidence,
  { writeEntry = writeFile } = {},
) {
  const target = resolve(outputPath);
  const parent = dirname(target);
  const targetName = basename(target);
  if (targetName === "." || targetName === ".." || targetName === "") {
    throw new Error("Stage 7 evidence output directory is invalid");
  }
  assertEvidenceBundleConsistent(evidence);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const lock = join(parent, `.stage7-evidence-${targetName}.publish-lock`);
  try {
    await mkdir(lock, { mode: 0o700 });
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error("Stage 7 evidence publication is already in progress", {
        cause: error,
      });
    }
    throw error;
  }
  const staging = join(lock, "complete-bundle");
  let reservedTarget = false;
  let published = false;
  try {
    await mkdir(staging, { mode: 0o700 });
    for (const [name, content] of Object.entries(evidence)) {
      await writeEntry(join(staging, name), content, {
        mode: 0o600,
        flag: "wx",
      });
    }
    assertEvidenceBundleConsistent(await readEvidenceBundleUnchecked(staging));
    try {
      await mkdir(target, { mode: 0o700 });
      reservedTarget = true;
    } catch (error) {
      if (error?.code === "EEXIST") {
        throw new Error("Stage 7 evidence output directory already exists", {
          cause: error,
        });
      }
      throw error;
    }
    for (const name of evidenceFiles) {
      await rename(join(staging, name), join(target, name));
    }
    assertEvidenceBundleConsistent(await readEvidenceBundleUnchecked(target));
    published = true;
  } finally {
    if (reservedTarget && !published) {
      await rm(target, { recursive: true, force: true });
    }
    await rm(lock, { recursive: true, force: true });
  }
  return evidence;
}

export async function writeEvidenceAtomically(outputPath, rawRun) {
  const evidence = renderEvidence(structuredClone(rawRun));
  return publishEvidenceBundleAtomically(outputPath, evidence);
}
