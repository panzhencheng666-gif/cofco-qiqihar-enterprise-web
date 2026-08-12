#!/usr/bin/env node
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import {
  StageSevenAdmissionError,
  admitRun,
  buildPreproductionReplayPlan,
  renderEvidence,
  validateProfile,
} from "./stage-seven-core.mjs";
import {
  createHttpsPreproductionDriver,
  executePreproductionReplay,
} from "./stage-seven-preproduction-runtime.mjs";

const execFileAsync = promisify(execFile);
const webDirectory = resolve(import.meta.dirname, "..");
const repositoryDirectories = {
  backend:
    process.env.STAGE7_BACKEND_DIR ??
    resolve(webDirectory, "../cofco-qiqihar-enterprise-backend"),
  frontend:
    process.env.STAGE7_FRONTEND_DIR ??
    resolve(webDirectory, "../cofco-qiqihar-enterprise-frontend"),
  web: process.env.STAGE7_WEB_DIR ?? webDirectory,
};

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

async function admissionBinding(profilePath) {
  const profileSource = await readFile(profilePath, "utf8");
  const commits = await Promise.all(
    Object.entries(repositoryDirectories).map(
      async ([repository, directory]) => {
        const [{ stdout }, { stdout: status }] = await Promise.all([
          execFileAsync("git", ["rev-parse", "HEAD"], {
            cwd: directory,
            encoding: "utf8",
          }),
          execFileAsync("git", ["status", "--porcelain"], {
            cwd: directory,
            encoding: "utf8",
          }),
        ]);
        if (status.trim() !== "") {
          throw new StageSevenAdmissionError(
            `${repository} candidate repository is not clean`,
          );
        }
        return [repository, stdout.trim()];
      },
    ),
  );
  return {
    candidates: Object.fromEntries(commits),
    profileSha256: createHash("sha256").update(profileSource).digest("hex"),
  };
}

async function writeEvidence(outputPath, rawRun) {
  const evidence = renderEvidence(rawRun);
  await mkdir(resolve(outputPath), { recursive: true, mode: 0o700 });
  await Promise.all(
    Object.entries(evidence).map(([name, content]) =>
      writeFile(resolve(outputPath, name), content, {
        mode: 0o600,
        flag: "wx",
      }),
    ),
  );
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
  if (["admit", "replay-plan", "replay"].includes(command)) {
    const mode = option("--mode");
    const request = option("--config")
      ? await readJson(option("--config"))
      : { mode };
    const admittedRequest = {
      ...request,
      mode: mode ?? request.mode ?? "preproduction",
    };
    if (
      typeof admittedRequest.baseUrl !== "string" ||
      admittedRequest.baseUrl.trim() === ""
    ) {
      admitRun(admittedRequest);
    }
    const binding = await admissionBinding(profilePath);
    const admission = admitRun(admittedRequest, binding);
    if (command === "replay-plan") {
      const replay = buildPreproductionReplayPlan(admission, profile);
      process.stdout.write(`${JSON.stringify(replay, null, 2)}\n`);
      return;
    }
    if (command === "replay") {
      const outputPath = option("--output") ?? request.outputDirectory;
      if (!outputPath) {
        throw new StageSevenAdmissionError(
          "approved preproduction evidence output directory is missing",
        );
      }
      const rawRun = await executePreproductionReplay({
        admission,
        rawProfile: profile,
        driver: createHttpsPreproductionDriver(),
      });
      await writeEvidence(outputPath, rawRun);
      process.stdout.write("STAGE7_PREPRODUCTION_EVIDENCE_WRITTEN files=5\n");
      return;
    }
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
    await writeEvidence(outputPath, await readJson(resultPath));
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
