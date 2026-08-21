import assert from "node:assert/strict";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const moduleUrl = pathToFileURL(
  join(import.meta.dirname, "local-runtime-publish.mjs"),
).href;

test("refuses to publish when source and runtime resolve to the same directory", async () => {
  const releaseModule = await import(moduleUrl).catch(() => null);
  assert.notEqual(
    releaseModule,
    null,
    "the local runtime publishing module must exist",
  );

  const directory = await realpath(
    await mkdtemp(join(tmpdir(), "cofco-runtime-publish-same-root-")),
  );

  await assert.rejects(
    releaseModule.assertSeparatedRoots(directory, directory),
    /must be separate directories/u,
  );
});

test("refuses nested source and runtime roots", async () => {
  const releaseModule = await import(moduleUrl);
  const root = await mkdtemp(
    join(tmpdir(), "cofco-runtime-publish-nested-root-"),
  );
  const sourceRoot = join(root, "source");
  const nestedRuntime = join(sourceRoot, "runtime");
  const outerRuntime = join(root, "runtime");
  const nestedSource = join(outerRuntime, "source");
  await Promise.all([
    mkdir(nestedRuntime, { recursive: true }),
    mkdir(nestedSource, { recursive: true }),
  ]);

  await assert.rejects(
    releaseModule.assertSeparatedRoots(sourceRoot, nestedRuntime),
    /non-nested directories/u,
  );
  await assert.rejects(
    releaseModule.assertSeparatedRoots(nestedSource, outerRuntime),
    /non-nested directories/u,
  );
});

test("prepares a standalone candidate with an auditable SHA-256 manifest", async () => {
  const releaseModule = await import(moduleUrl);
  const root = await mkdtemp(
    join(tmpdir(), "cofco-runtime-publish-candidate-"),
  );
  const sourceRoot = join(root, "source");
  const runtimeRoot = join(root, "runtime");
  const candidateRoot = join(root, "candidate");

  await Promise.all([
    mkdir(join(sourceRoot, "src"), { recursive: true }),
    mkdir(join(sourceRoot, "dist"), { recursive: true }),
    mkdir(join(sourceRoot, "scripts"), { recursive: true }),
    mkdir(join(sourceRoot, "coverage"), { recursive: true }),
    mkdir(join(sourceRoot, ".git"), { recursive: true }),
    mkdir(join(sourceRoot, "evidence"), { recursive: true }),
    mkdir(join(runtimeRoot, "node_modules", "example"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(sourceRoot, "package.json"), '{"name":"source"}\n'),
    writeFile(join(sourceRoot, "package-lock.json"), '{"lockfileVersion":3}\n'),
    writeFile(join(sourceRoot, "vite.config.ts"), "export default {};\n"),
    writeFile(join(sourceRoot, ".env.local"), "SECRET=must-not-deploy\n"),
    writeFile(join(sourceRoot, "coverage", "report.json"), "must not deploy\n"),
    writeFile(
      join(runtimeRoot, "package-lock.json"),
      '{"lockfileVersion":3}\n',
    ),
    writeFile(
      join(sourceRoot, "src", "main.js"),
      "export const live = true;\n",
    ),
    writeFile(join(sourceRoot, "dist", "index.html"), "<main>built</main>\n"),
    writeFile(
      join(sourceRoot, "scripts", "local-runtime-smoke.mjs"),
      "export const smoke = true;\n",
    ),
    writeFile(join(sourceRoot, ".git", "config"), "must not deploy\n"),
    writeFile(join(sourceRoot, "evidence", "old.txt"), "must not deploy\n"),
    writeFile(
      join(runtimeRoot, "node_modules", "example", "index.js"),
      "module.exports = true;\n",
    ),
  ]);

  const manifest = await releaseModule.prepareRuntimeCandidate({
    sourceRoot,
    runtimeRoot,
    candidateRoot,
    createdAt: "2026-08-21T12:00:00.000Z",
  });

  assert.equal(
    await readFile(join(candidateRoot, "dist", "index.html"), "utf8"),
    "<main>built</main>\n",
  );
  assert.equal(
    await readFile(
      join(candidateRoot, "node_modules", "example", "index.js"),
      "utf8",
    ),
    "module.exports = true;\n",
  );
  await assert.rejects(access(join(candidateRoot, ".git")));
  await assert.rejects(access(join(candidateRoot, "evidence")));
  await assert.rejects(access(join(candidateRoot, ".env.local")));
  await assert.rejects(access(join(candidateRoot, "coverage")));
  assert.equal(
    await readFile(join(candidateRoot, "src", "main.js"), "utf8"),
    "export const live = true;\n",
  );
  assert.equal(manifest.algorithm, "sha256");
  assert.equal(manifest.sourceDirectory, "source");
  assert.equal(Object.hasOwn(manifest, "sourceRoot"), false);
  assert.deepEqual(
    manifest.files.map(({ path }) => path),
    [
      "dist/index.html",
      "package-lock.json",
      "package.json",
      "scripts/local-runtime-smoke.mjs",
      "src/main.js",
      "vite.config.ts",
    ],
  );
  assert.equal(
    await releaseModule.verifyRuntimeManifest(candidateRoot),
    manifest.files.length,
  );
});

test("quality gates enforce the bundle budget immediately after the build", async () => {
  const releaseModule = await import(moduleUrl);
  const commands = [];

  await releaseModule.runQualityGates("/source", {}, async (command, args) => {
    commands.push([command, ...args]);
  });

  const buildIndex = commands.findIndex(
    ([command, first, second]) =>
      command === "npm" && first === "run" && second === "build",
  );
  const budgetIndex = commands.findIndex(
    ([command, first, second]) =>
      command === "npm" && first === "run" && second === "budget",
  );
  assert.equal(buildIndex >= 0, true);
  assert.equal(budgetIndex, buildIndex + 1);
});

test("managed command environment keeps Node first and includes macOS service tools", async () => {
  const releaseModule = await import(moduleUrl);
  const commandEnvironment = releaseModule.createCommandEnvironment(
    { PATH: "/usr/bin:/bin", MARKER: "preserved" },
    "/opt/node24/bin/node",
  );

  assert.equal(
    commandEnvironment.PATH,
    "/opt/node24/bin:/usr/bin:/bin:/usr/sbin:/sbin",
  );
  assert.equal(commandEnvironment.MARKER, "preserved");
});

test("restores the usable runtime when candidate validation fails", async () => {
  const releaseModule = await import(moduleUrl);
  const root = await mkdtemp(join(tmpdir(), "cofco-runtime-publish-rollback-"));
  const runtimeRoot = join(root, "runtime");
  const candidateRoot = join(root, "candidate");
  const backupRoot = join(root, "runtime.previous");
  await Promise.all([
    mkdir(runtimeRoot, { recursive: true }),
    mkdir(candidateRoot, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(runtimeRoot, "version.txt"), "usable runtime\n"),
    writeFile(join(candidateRoot, "version.txt"), "candidate runtime\n"),
  ]);
  let recoveryCalls = 0;

  await assert.rejects(
    releaseModule.activateRuntimeCandidate({
      runtimeRoot,
      candidateRoot,
      backupRoot,
      validate: async () => {
        throw new Error("candidate health check failed");
      },
      recover: async () => {
        recoveryCalls += 1;
      },
    }),
    /candidate health check failed/u,
  );

  assert.equal(
    await readFile(join(runtimeRoot, "version.txt"), "utf8"),
    "usable runtime\n",
  );
  assert.equal(
    await readFile(join(candidateRoot, "version.txt"), "utf8"),
    "candidate runtime\n",
  );
  await assert.rejects(access(backupRoot));
  assert.equal(recoveryCalls, 1);
});

test("runs quality gates before activating and validating a prepared runtime", async () => {
  const releaseModule = await import(moduleUrl);
  const root = await mkdtemp(join(tmpdir(), "cofco-runtime-publish-order-"));
  const sourceRoot = join(root, "source");
  const runtimeRoot = join(root, "runtime");
  const candidateRoot = join(root, "candidate");
  const backupRoot = join(root, "runtime.previous");
  await Promise.all([
    mkdir(join(sourceRoot, "src"), { recursive: true }),
    mkdir(join(runtimeRoot, "node_modules", "example"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(sourceRoot, "package.json"), '{"name":"source"}\n'),
    writeFile(join(sourceRoot, "package-lock.json"), '{"lockfileVersion":3}\n'),
    writeFile(
      join(runtimeRoot, "package-lock.json"),
      '{"lockfileVersion":3}\n',
    ),
    writeFile(
      join(sourceRoot, "src", "main.js"),
      "export const built = true;\n",
    ),
    writeFile(join(runtimeRoot, "old.txt"), "previous release\n"),
    writeFile(
      join(runtimeRoot, "node_modules", "example", "index.js"),
      "module.exports = true;\n",
    ),
  ]);
  const events = [];

  const result = await releaseModule.publishLocalRuntime({
    sourceRoot,
    runtimeRoot,
    candidateRoot,
    backupRoot,
    runGates: async () => {
      events.push("gates");
      await mkdir(join(sourceRoot, "dist"));
      await writeFile(join(sourceRoot, "dist", "index.html"), "built\n");
    },
    validate: async () => {
      events.push("validate");
    },
    recover: async () => {
      events.push("recover");
    },
  });

  assert.deepEqual(events, ["gates", "validate"]);
  assert.equal(
    await readFile(join(runtimeRoot, "dist", "index.html"), "utf8"),
    "built\n",
  );
  assert.equal(
    await readFile(join(backupRoot, "old.txt"), "utf8"),
    "previous release\n",
  );
  assert.equal(result.backupRoot, backupRoot);
  assert.equal(
    result.fileCount,
    await releaseModule.verifyRuntimeManifest(runtimeRoot),
  );
});

test("accepts a control timeout only after the managed health gate succeeds", async () => {
  const releaseModule = await import(moduleUrl);
  const commands = [];

  await releaseModule.restartManagedRuntime(
    "/runtime/web",
    {},
    {
      execute: async (command, args) => {
        commands.push([command, ...args]);
        if (args.at(-1) === "restart") throw new Error("control timeout");
      },
      pause: async () => {},
      healthAttempts: 2,
    },
  );

  assert.equal(commands.length, 2);
  assert.match(commands[1].at(-1), /healthcheck-local\.sh$/u);
});

test("rejects a control timeout when bounded managed health never succeeds", async () => {
  const releaseModule = await import(moduleUrl);
  let calls = 0;

  await assert.rejects(
    releaseModule.restartManagedRuntime(
      "/runtime/web",
      {},
      {
        execute: async () => {
          calls += 1;
          throw new Error(calls === 1 ? "control timeout" : "still unhealthy");
        },
        pause: async () => {},
        healthAttempts: 2,
      },
    ),
    /restart failed and managed health did not recover/u,
  );
  assert.equal(calls, 3);
});
