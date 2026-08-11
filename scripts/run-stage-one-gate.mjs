#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = dirname(webRoot);
const repositoryDefinitions = [
  {
    id: "backend",
    name: "cofco-qiqihar-enterprise-backend",
    command: "mvn",
    args: ["clean", "verify"],
  },
  {
    id: "frontend",
    name: "cofco-qiqihar-enterprise-frontend",
    command: "npm",
    args: ["run", "verify"],
  },
  {
    id: "web",
    name: "cofco-qiqihar-enterprise-web",
    command: "npm",
    args: ["run", "verify"],
  },
];

function usage() {
  process.stderr.write(
    "Usage: npm run stage1:run -- --output-dir <new-evidence-directory>\n",
  );
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function git(repositoryRoot, ...args) {
  const result = spawnSync("git", ["-C", repositoryRoot, ...args], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed in ${repositoryRoot}: ${result.stderr}`,
    );
  }
  return result.stdout.trim();
}

function candidate(repository) {
  const repositoryRoot = join(runtimeRoot, repository.name);
  const branch = git(repositoryRoot, "branch", "--show-current");
  const status = git(repositoryRoot, "status", "--porcelain");
  if (!branch) throw new Error(`${repository.name} is detached`);
  if (status) throw new Error(`${repository.name} is not clean:\n${status}`);
  return {
    ...repository,
    root: repositoryRoot,
    branch,
    sha: git(repositoryRoot, "rev-parse", "HEAD"),
    upstream: git(repositoryRoot, "rev-parse", "--abbrev-ref", "@{upstream}"),
    upstreamSha: git(repositoryRoot, "rev-parse", "@{upstream}"),
  };
}

function commandEnvironment(repository) {
  const environment = { ...process.env };
  if (
    repository.id === "backend" &&
    existsSync("/opt/homebrew/opt/openjdk@21/bin/java")
  ) {
    environment.JAVA_HOME = "/opt/homebrew/opt/openjdk@21";
    environment.PATH = `${environment.JAVA_HOME}/bin:${environment.PATH ?? ""}`;
  }
  return environment;
}

async function runGate(repository, outputDirectory) {
  const logPath = join(outputDirectory, `${repository.id}.log`);
  const log = createWriteStream(logPath, { flags: "wx" });
  const startedAt = new Date().toISOString();
  const displayCommand = [repository.command, ...repository.args].join(" ");
  process.stdout.write(
    `\n[stage-one] START ${repository.name}: ${displayCommand}\n`,
  );

  const exitCode = await new Promise((resolveExitCode) => {
    const child = spawn(repository.command, repository.args, {
      cwd: repository.root,
      env: commandEnvironment(repository),
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      log.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      log.write(chunk);
    });
    child.on("error", (error) => {
      const message = `Unable to start ${displayCommand}: ${error.message}\n`;
      process.stderr.write(message);
      log.write(message);
      resolveExitCode(127);
    });
    child.on("close", (code, signal) => {
      if (signal) {
        log.write(`Stopped by signal ${signal}\n`);
        resolveExitCode(128);
        return;
      }
      resolveExitCode(code ?? 1);
    });
  });
  await new Promise((resolveClose) => log.end(resolveClose));
  const completedAt = new Date().toISOString();
  process.stdout.write(
    `[stage-one] ${exitCode === 0 ? "PASS" : "FAIL"} ${repository.name}\n`,
  );
  return {
    repository: repository.name,
    command: displayCommand,
    startedAt,
    completedAt,
    exitCode,
    log: logPath,
    status: exitCode === 0 ? "PASS" : "FAIL",
  };
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function firstJar(directory) {
  if (!existsSync(directory)) return undefined;
  return readdirSync(directory)
    .filter((name) => name.endsWith(".jar") && !name.endsWith(".jar.original"))
    .map((name) => join(directory, name))
    .find((file) => statSync(file).isFile());
}

function artifactEvidence(candidates) {
  const backend = candidates.find((item) => item.id === "backend");
  const frontend = candidates.find((item) => item.id === "frontend");
  const web = candidates.find((item) => item.id === "web");
  const backendJar = backend
    ? firstJar(join(backend.root, "target"))
    : undefined;
  const frontendIndex = frontend
    ? join(frontend.root, "dist", "index.html")
    : "";
  const webIndex = web ? join(web.root, "dist", "index.html") : "";
  const webBaseline = web
    ? join(
        web.root,
        "docs",
        "production-readiness",
        "stage-one-system-baseline.json",
      )
    : "";
  const webUiInventory = web
    ? join(
        web.root,
        "docs",
        "production-readiness",
        "stage-one-ui-inventory.json",
      )
    : "";
  const backendMigrationReplay = backend
    ? join(
        backend.root,
        "target",
        "surefire-reports",
        "com.cofco.qiqihar.graintrade.masterdata.infrastructure.FlywayMigrationReplayTest.txt",
      )
    : "";
  const webIndexSource = existsSync(webIndex)
    ? readFileSync(webIndex, "utf8")
    : "";
  const webManifest = web
    ? join(web.root, "dist", ".vite", "manifest.json")
    : "";
  const webManifestEntry = existsSync(webManifest)
    ? JSON.parse(readFileSync(webManifest, "utf8"))["index.html"]?.file
    : undefined;
  const webEntryScript =
    web && typeof webManifestEntry === "string"
      ? join(web.root, "dist", webManifestEntry)
      : "";
  const webEntryScriptSource = existsSync(webEntryScript)
    ? readFileSync(webEntryScript, "utf8")
    : "";
  const desktopLauncher =
    "/Users/federal/Desktop/启动齐齐哈尔粮食商情系统.command";
  const desktopLauncherSource = existsSync(desktopLauncher)
    ? readFileSync(desktopLauncher, "utf8")
    : "";
  const checks = [
    { id: "backend-jar", file: backendJar, satisfied: Boolean(backendJar) },
    {
      id: "backend-empty-database-migration-replay",
      file: backendMigrationReplay,
      satisfied:
        existsSync(backendMigrationReplay) &&
        /Tests run: [1-9][0-9]*, Failures: 0, Errors: 0, Skipped: 0/u.test(
          readFileSync(backendMigrationReplay, "utf8"),
        ),
    },
    {
      id: "desktop-launcher-canonical-runtime-entry",
      file: desktopLauncher,
      satisfied:
        desktopLauncherSource.includes(
          "/Users/federal/Library/Application Support/COFCO Qiqihar Enterprise/runtime/cofco-qiqihar-enterprise-backend",
        ) &&
        desktopLauncherSource.includes(
          'ENTERPRISE_BUSINESS_URL="$ENTERPRISE_BUSINESS_BASE_URL"',
        ) &&
        !/\/Users\/federal\/Desktop\/cofco-qiqihar-enterprise-|prototype\.html|64185/iu.test(
          desktopLauncherSource,
        ),
    },
    {
      id: "frontend-index",
      file: frontendIndex,
      satisfied: existsSync(frontendIndex),
    },
    {
      id: "web-index",
      file: webIndex,
      satisfied: existsSync(webIndex),
    },
    {
      id: "web-index-canonical-root",
      file: webIndex,
      satisfied:
        webIndexSource.includes('id="enterprise-root"') &&
        !/prototype|64185/iu.test(webIndexSource),
    },
    {
      id: "web-entry-no-legacy-runtime-markers",
      file: webEntryScript,
      satisfied:
        Boolean(webEntryScriptSource) &&
        !/prototype:read|\bdemo\b|\bmock\b|codex|localhost|64185|内部任务|技术栈/iu.test(
          webEntryScriptSource,
        ),
    },
    {
      id: "web-system-baseline",
      file: webBaseline,
      satisfied: existsSync(webBaseline),
    },
    {
      id: "web-ui-interaction-inventory",
      file: webUiInventory,
      satisfied: existsSync(webUiInventory),
    },
    {
      id: "web-no-alternate-entry",
      file: web ? join(web.root, "dist", "prototype.html") : "",
      satisfied: web
        ? !existsSync(join(web.root, "dist", "prototype.html"))
        : false,
    },
  ];
  return checks.map((check) => ({
    ...check,
    status: check.satisfied ? "PASS" : "FAIL",
    ...(check.file && existsSync(check.file) && statSync(check.file).isFile()
      ? { sha256: sha256(check.file), bytes: statSync(check.file).size }
      : {}),
  }));
}

function verifyCandidatesUnchanged(candidates) {
  return candidates.map((item) => {
    const finalSha = git(item.root, "rev-parse", "HEAD");
    const finalStatus = git(item.root, "status", "--porcelain");
    const unchanged = finalSha === item.sha && finalStatus === "";
    return {
      repository: item.name,
      initialSha: item.sha,
      finalSha,
      clean: finalStatus === "",
      status: unchanged ? "PASS" : "FAIL",
    };
  });
}

function markdownSummary(snapshot) {
  const lines = [
    "# 阶段一三仓门禁快照",
    "",
    `- Run ID: \`${snapshot.runId}\``,
    `- 状态: \`${snapshot.status}\``,
    `- 开始: ${snapshot.startedAt}`,
    `- 完成: ${snapshot.completedAt}`,
    "- 范围: 仅阶段一；不代表阶段二/三或最终上线通过。",
    "",
    "## 候选",
    "",
    "| 仓库 | 分支 | SHA | 上游（运行开始时） |",
    "|---|---|---|---|",
    ...snapshot.candidates.map(
      (item) =>
        `| ${item.name} | \`${item.branch}\` | \`${item.sha}\` | \`${item.upstream}\` / \`${item.upstreamSha}\` |`,
    ),
    "",
    "## 门禁",
    "",
    "| 仓库 | 命令 | 状态 | 日志 |",
    "|---|---|---|---|",
    ...snapshot.gates.map(
      (gate) =>
        `| ${gate.repository} | \`${gate.command}\` | \`${gate.status}\` | \`${gate.log}\` |`,
    ),
    "",
    "## 制品与候选不变性",
    "",
    ...snapshot.artifacts.map(
      (item) =>
        `- \`${item.id}\`: \`${item.status}\`${item.file ? ` — \`${item.file}\`` : ""}`,
    ),
    ...snapshot.candidateIntegrity.map(
      (item) => `- \`${item.repository}\` 候选不变且干净：\`${item.status}\``,
    ),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  const rawOutputDirectory = argumentValue("--output-dir");
  if (!rawOutputDirectory) {
    usage();
    process.exitCode = 2;
    return;
  }
  const outputDirectory = resolve(rawOutputDirectory);
  if (existsSync(outputDirectory)) {
    throw new Error(`Evidence directory already exists: ${outputDirectory}`);
  }
  mkdirSync(outputDirectory, { recursive: true });

  const startedAt = new Date().toISOString();
  const runId = `stage-one-${startedAt.replace(/[:.]/gu, "-")}`;
  const candidates = repositoryDefinitions.map(candidate);
  const gates = [];
  for (const repository of candidates) {
    gates.push(await runGate(repository, outputDirectory));
  }
  const artifacts = artifactEvidence(candidates);
  const candidateIntegrity = verifyCandidatesUnchanged(candidates);
  const completedAt = new Date().toISOString();
  const status = [
    ...gates.map((item) => item.status),
    ...artifacts.map((item) => item.status),
    ...candidateIntegrity.map((item) => item.status),
  ].every((item) => item === "PASS")
    ? "PASS"
    : "FAIL";
  const snapshot = {
    schemaVersion: 1,
    runId,
    scope: "阶段一：架构与唯一系统基线",
    status,
    startedAt,
    completedAt,
    candidates: candidates.map(
      ({ id, name, branch, sha, upstream, upstreamSha }) => ({
        id,
        name,
        branch,
        sha,
        upstream,
        upstreamSha,
      }),
    ),
    gates,
    artifacts,
    candidateIntegrity,
  };
  writeFileSync(
    join(outputDirectory, "snapshot.json"),
    `${JSON.stringify(snapshot, null, 2)}\n`,
    { flag: "wx" },
  );
  writeFileSync(
    join(outputDirectory, "SUMMARY.md"),
    markdownSummary(snapshot),
    {
      flag: "wx",
    },
  );
  process.stdout.write(
    `\n[stage-one] ${status} ${runId}\n[stage-one] Evidence: ${outputDirectory}\n`,
  );
  if (status !== "PASS") process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`[stage-one] ERROR ${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
