import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  readdir,
  rename,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "..");
const scriptsRoot = resolve(
  repositoryRoot,
  "ops/alicloud-preproduction/scripts",
);
const activateBundle = resolve(scriptsRoot, "activate-bundle.sh");
const validators = [
  "preproduction-config.mjs",
  "preproduction-runtime.mjs",
  "preproduction-network.mjs",
];

async function sha256(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

async function createStaging(directory, releaseId) {
  const staging = join(directory, "remote", `bundle-staging-${releaseId}`);
  const packageScripts = join(staging, "ops/alicloud-preproduction/scripts");
  await mkdir(packageScripts, { recursive: true, mode: 0o700 });
  await mkdir(join(staging, "ops/alicloud-preproduction/config"), {
    recursive: true,
    mode: 0o700,
  });
  await mkdir(join(staging, "scripts"), { recursive: true, mode: 0o700 });
  await writeFile(
    join(staging, "ops/alicloud-preproduction/config/preproduction.env"),
    "COFCO_DEPLOYMENT_ENV=preproduction\n",
    { mode: 0o600 },
  );
  await writeFile(
    join(packageScripts, "common.sh"),
    await readFile(join(scriptsRoot, "common.sh")),
    { mode: 0o755 },
  );
  for (const validator of validators) {
    await writeFile(
      join(staging, "scripts", validator),
      await readFile(join(repositoryRoot, "scripts", validator)),
      { mode: 0o644 },
    );
  }
  return staging;
}

async function activationArgs(directory, staging, releaseId, command) {
  return [
    activateBundle,
    join(directory, "remote"),
    staging,
    releaseId,
    ...(await Promise.all(
      validators.map((name) => sha256(join(repositoryRoot, "scripts", name))),
    )),
    "--",
    ...command,
  ];
}

async function waitFor(path) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await access(path);
      return;
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 10));
    }
  }
  throw new Error(`timed out waiting for ${path}`);
}

async function findForbidden(path) {
  const found = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const child = join(directory, entry.name);
      if (
        entry.name === ".runtime" ||
        entry.name === ".terraform" ||
        /\.tf(?:state(?:\..*)?|plan)$/u.test(entry.name)
      ) {
        found.push(child);
      }
      if (entry.isDirectory()) await visit(child);
    }
  }
  await visit(path);
  return found;
}

test("runs the bounded command from the exact immutable release and retains older immutable bundles", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cofco-stage5-bundle-"));
  const remote = join(directory, "remote");
  const oldBundle = join(remote, "bundles/old-release");
  await mkdir(oldBundle, { recursive: true, mode: 0o700 });
  await writeFile(join(oldBundle, "marker"), "old\n");
  await symlink("bundles/old-release", join(remote, "bundle"));
  const staging = await createStaging(directory, "new-release");
  const commandOutput = join(directory, "command-output");
  const args = await activationArgs(directory, staging, "new-release", [
    "bash",
    "-c",
    'pwd >"$COMMAND_OUTPUT"',
  ]);
  const result = spawnSync("bash", args, {
    env: { ...process.env, COMMAND_OUTPUT: commandOutput },
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readlink(join(remote, "bundle")), "bundles/new-release");
  assert.match(
    await readFile(commandOutput, "utf8"),
    /bundles\/new-release\/ops\/alicloud-preproduction/u,
  );
  assert.equal(await readFile(join(oldBundle, "marker"), "utf8"), "old\n");
});

test("resolves the same home-relative paths passed by production deploy", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cofco-stage5-bundle-"));
  const releaseId = "relative-release";
  const staging = await createStaging(directory, releaseId);
  const relativeBase = ".local/share/cofco-preproduction";
  const relativeStaging = `${relativeBase}/bundle-staging-${releaseId}`;
  const productionHome = join(directory, "production-home");
  await mkdir(join(productionHome, ".local/share"), {
    recursive: true,
    mode: 0o700,
  });
  await mkdir(join(productionHome, relativeBase), {
    recursive: true,
    mode: 0o700,
  });
  await rename(staging, join(productionHome, relativeStaging));
  const hashes = await Promise.all(
    validators.map((name) => sha256(join(repositoryRoot, "scripts", name))),
  );
  const result = spawnSync(
    "bash",
    [
      activateBundle,
      relativeBase,
      relativeStaging,
      releaseId,
      ...hashes,
      "--",
      "true",
    ],
    { cwd: productionHome, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    await readlink(join(productionHome, relativeBase, "bundle")),
    `bundles/${releaseId}`,
  );
});

test("holds one bundle lock through the bounded command and rejects a concurrent activation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cofco-stage5-bundle-"));
  const firstStaging = await createStaging(directory, "first-release");
  const secondStaging = await createStaging(directory, "second-release");
  const started = join(directory, "started");
  const release = join(directory, "release");
  const firstArgs = await activationArgs(
    directory,
    firstStaging,
    "first-release",
    [
      "bash",
      "-c",
      'touch "$STARTED"; while test ! -f "$RELEASE"; do sleep 0.02; done',
    ],
  );
  const first = spawn("bash", firstArgs, {
    env: { ...process.env, STARTED: started, RELEASE: release },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitFor(started);

  const secondArgs = await activationArgs(
    directory,
    secondStaging,
    "second-release",
    ["true"],
  );
  const second = spawnSync("bash", secondArgs, { encoding: "utf8" });
  assert.notEqual(second.status, 0);
  assert.match(second.stderr, /bundle replacement lock is already held/iu);
  assert.equal(
    await readlink(join(directory, "remote/bundle")),
    "bundles/first-release",
  );

  await writeFile(release, "go\n");
  const firstStatus = await new Promise((resolveExit) => {
    first.once("exit", (code) => resolveExit(code));
  });
  assert.equal(firstStatus, 0);
});

test("restores the previous fixed bundle when the bounded command fails", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cofco-stage5-bundle-"));
  const remote = join(directory, "remote");
  await mkdir(join(remote, "bundles/old-release"), {
    recursive: true,
    mode: 0o700,
  });
  await symlink("bundles/old-release", join(remote, "bundle"));
  const staging = await createStaging(directory, "failed-release");
  const args = await activationArgs(directory, staging, "failed-release", [
    "false",
  ]);
  const result = spawnSync("bash", args, { encoding: "utf8" });

  assert.notEqual(result.status, 0);
  assert.equal(await readlink(join(remote, "bundle")), "bundles/old-release");
  await assert.rejects(
    access(join(remote, "bundles/failed-release")),
    /ENOENT/u,
  );
});

test("replaces a legacy physical fixed bundle without retaining forbidden runtime assets", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cofco-stage5-bundle-"));
  const remote = join(directory, "remote");
  await mkdir(join(remote, "bundle/.terraform"), {
    recursive: true,
    mode: 0o700,
  });
  await writeFile(join(remote, "bundle/.terraform/legacy.tfstate"), "old\n");
  const staging = await createStaging(directory, "clean-release");
  const args = await activationArgs(directory, staging, "clean-release", [
    "true",
  ]);
  const result = spawnSync("bash", args, { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readlink(join(remote, "bundle")), "bundles/clean-release");
  assert.deepEqual(await findForbidden(remote), []);
});
