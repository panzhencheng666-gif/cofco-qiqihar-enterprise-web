import {
  access,
  mkdir,
  mkdtemp,
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

export async function writeEvidenceAtomically(outputPath, rawRun) {
  const target = resolve(outputPath);
  const parent = dirname(target);
  const targetName = basename(target);
  if (targetName === "." || targetName === ".." || targetName === "") {
    throw new Error("Stage 7 evidence output directory is invalid");
  }
  const evidence = renderEvidence(structuredClone(rawRun));
  assertEvidenceBundleConsistent(evidence);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  try {
    await access(target);
    throw new Error("Stage 7 evidence output directory already exists");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const staging = await mkdtemp(
    join(parent, `.stage7-evidence-${targetName}-`),
  );
  let published = false;
  try {
    await Promise.all(
      Object.entries(evidence).map(([name, content]) =>
        writeFile(join(staging, name), content, {
          mode: 0o600,
          flag: "wx",
        }),
      ),
    );
    assertEvidenceBundleConsistent(await readEvidenceBundle(staging));
    await rename(staging, target);
    published = true;
  } finally {
    if (!published) await rm(staging, { recursive: true, force: true });
  }
  return evidence;
}
