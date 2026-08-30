import assert from "node:assert/strict";
import Ajv from "ajv";
import { execFile } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { runReleaseManifestCli } from "./release-manifest-cli.mjs";
import {
  generateReleaseManifest,
  sealManifest,
  validateManifestEnvelope,
  verifyReleaseManifest,
} from "./release-manifest.mjs";

const exec = promisify(execFile);
const sha = (character) => `sha256:${character.repeat(64)}`;
const runtimeVersions = { node: "24.19.0", npm: "11.17.0", jdk: "21" };

async function runGit(cwd, ...args) {
  const result = await exec("git", args, { cwd });
  return result.stdout.trim();
}

async function write(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
}

async function createRepository(root, name, files) {
  const remote = join(root, `${name}.git`);
  const repository = join(root, name);
  await runGit(root, "init", "--bare", remote);
  await runGit(root, "clone", remote, repository);
  await runGit(repository, "config", "user.name", "Release Test");
  await runGit(repository, "config", "user.email", "release@example.invalid");
  for (const [path, contents] of Object.entries(files)) {
    await write(join(repository, path), contents);
  }
  await runGit(repository, "add", ".");
  await runGit(repository, "commit", "-m", "fixture");
  await runGit(repository, "branch", "-M", "main");
  await runGit(repository, "push", "-u", "origin", "main");
  return {
    name,
    origin: remote,
    repository,
    commitSha: await runGit(repository, "rev-parse", "HEAD"),
  };
}

async function commit(repository, message, push = true) {
  await runGit(repository, "add", ".");
  await runGit(repository, "commit", "-m", message);
  if (push) await runGit(repository, "push", "origin", "main");
  return runGit(repository, "rev-parse", "HEAD");
}

function repositoryDescriptor(repo, kind) {
  const shared = {
    root: repo.repository,
    origin: repo.origin,
    commitSha: repo.commitSha,
    ref: "main",
    build: {
      command: kind === "backend" ? "./mvnw verify" : "npm run verify",
      node: kind === "backend" ? null : "24.19.0",
      npm: kind === "backend" ? null : "11.17.0",
      jdk: kind === "backend" ? "21" : null,
    },
    contracts: ["contracts/api.json"],
    configs: ["config/schema.json"],
    sboms: ["sbom.cdx.json"],
    dependencyLocks: [kind === "backend" ? "pom.xml" : "package-lock.json"],
  };
  if (kind === "backend") {
    return {
      ...shared,
      artifacts: [{ kind: "jar", path: "target/application.jar" }],
      migrations: { directory: "src/main/resources/db/migration" },
      containerImage: `registry.invalid/backend@${sha("a")}`,
    };
  }
  return {
    ...shared,
    assets: {
      directory: "dist",
      criticalBundles: ["dist/assets/application.js"],
    },
    containerImage: `registry.invalid/${kind}@${sha(kind === "web" ? "b" : "c")}`,
  };
}

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "cofco-release-manifest-"));
  const common = {
    "contracts/api.json": '{"openapi":"3.1.0"}\n',
    "config/schema.json": '{"secretReferences":["acs:kms:example"]}\n',
    "sbom.cdx.json": '{"bomFormat":"CycloneDX","specVersion":"1.6"}\n',
  };
  const backend = await createRepository(root, "backend", {
    ...common,
    "pom.xml": "<project/>\n",
    "target/application.jar": "backend artifact\n",
    "src/main/resources/db/migration/V1__baseline.sql": "select 1;\n",
    "src/main/resources/db/migration/V2__second.sql": "select 2;\n",
  });
  const web = await createRepository(root, "web", {
    ...common,
    "package-lock.json": '{"lockfileVersion":3}\n',
    "dist/index.html": "web\n",
    "dist/assets/application.js": "web bundle\n",
  });
  const frontend = await createRepository(root, "frontend", {
    ...common,
    "package-lock.json": '{"lockfileVersion":3}\n',
    "dist/index.html": "frontend\n",
    "dist/assets/application.js": "frontend bundle\n",
  });
  const descriptor = {
    releaseId: "cofco-fixture-20260830.1",
    environment: "non-release-fixture",
    createdAt: "2026-08-30T00:00:00.000Z",
    generatorVersion: "1.0.0",
    repositories: {
      backend: repositoryDescriptor(backend, "backend"),
      web: repositoryDescriptor(web, "web"),
      frontend: repositoryDescriptor(frontend, "frontend"),
    },
    evidence: {
      tests: ["local:test-fixture"],
      ci: ["ci://not-run-fixture"],
      approvals: ["approval://not-approved-fixture"],
      pullRequests: ["pr://not-created-fixture"],
    },
  };
  return { root, backend, web, frontend, descriptor };
}

async function generate(fixture, name = "release.json") {
  const outputPath = join(fixture.root, name);
  await generateReleaseManifest({ descriptor: fixture.descriptor, outputPath });
  return outputPath;
}

test("generation is deterministic and emits a valid self-hashed three-repository envelope", async () => {
  const fixture = await createFixture();
  const first = await generate(fixture, "first.json");
  const second = await generate(fixture, "second.json");
  assert.deepEqual(await readFile(first), await readFile(second));
  const envelope = JSON.parse(await readFile(first, "utf8"));
  assert.match(envelope.manifestSha256, /^[a-f0-9]{64}$/u);
  assert.deepEqual(Object.keys(envelope.manifest.repositories), [
    "backend",
    "frontend",
    "web",
  ]);
  assert.equal(validateManifestEnvelope(envelope), true);
});

test("generation rejects dirty, wrong-origin, and origin-unreachable commits", async (t) => {
  await t.test("dirty repository", async () => {
    const fixture = await createFixture();
    await write(join(fixture.web.repository, "dirty.txt"), "dirty\n");
    await assert.rejects(() => generate(fixture), /dirty/u);
  });
  await t.test(
    "dirty state is rejected before reading bound files",
    async () => {
      const fixture = await createFixture();
      await write(
        join(fixture.backend.repository, "config/schema.json"),
        '{"databasePassword":"correct-horse-battery-staple"}\n',
      );
      await assert.rejects(() => generate(fixture), /dirty/u);
    },
  );
  await t.test("wrong origin", async () => {
    const fixture = await createFixture();
    fixture.descriptor.repositories.web.origin =
      "https://example.invalid/wrong.git";
    await assert.rejects(() => generate(fixture), /origin/u);
  });
  await t.test("commit not reachable from origin", async () => {
    const fixture = await createFixture();
    await write(join(fixture.web.repository, "local-only.txt"), "local only\n");
    fixture.descriptor.repositories.web.commitSha = await commit(
      fixture.web.repository,
      "local only",
      false,
    );
    await assert.rejects(() => generate(fixture), /reachable.*origin/u);
  });
  await t.test(
    "stale local origin refs do not prove remote reachability",
    async () => {
      const fixture = await createFixture();
      await runGit(fixture.web.origin, "update-ref", "-d", "refs/heads/main");
      await assert.rejects(() => generate(fixture), /reachable.*origin/u);
    },
  );
  await t.test(
    "a different remote ref cannot satisfy the declared ref",
    async () => {
      const fixture = await createFixture();
      await runGit(
        fixture.web.origin,
        "update-ref",
        "refs/heads/release",
        fixture.web.commitSha,
      );
      await runGit(fixture.web.origin, "update-ref", "-d", "refs/heads/main");
      await assert.rejects(() => generate(fixture), /declared ref.*origin/u);
    },
  );
  await t.test("declared ref must resolve to HEAD", async () => {
    const fixture = await createFixture();
    fixture.descriptor.repositories.web.ref = "missing-release-ref";
    await assert.rejects(() => generate(fixture), /ref/u);
  });
  await t.test("origins cannot embed HTTP credentials", async () => {
    const fixture = await createFixture();
    const credentialOrigin =
      "https://release-user:release-password@example.invalid/repo.git";
    await runGit(
      fixture.web.repository,
      "remote",
      "set-url",
      "origin",
      credentialOrigin,
    );
    fixture.descriptor.repositories.web.origin = credentialOrigin;
    await assert.rejects(() => generate(fixture), /origin.*credentials/u);
  });
  await t.test(
    "origins cannot select executable Git remote helpers",
    async () => {
      const fixture = await createFixture();
      const executableOrigin = "ext::false";
      await runGit(
        fixture.web.repository,
        "remote",
        "set-url",
        "origin",
        executableOrigin,
      );
      fixture.descriptor.repositories.web.origin = executableOrigin;
      await assert.rejects(() => generate(fixture), /unsupported.*protocol/u);
    },
  );
});

test("generation rejects a missing repository, traversal, symlinks, and secret material", async (t) => {
  await t.test("missing repository", async () => {
    const fixture = await createFixture();
    delete fixture.descriptor.repositories.frontend;
    await assert.rejects(() => generate(fixture), /backend.*frontend.*web/u);
  });
  await t.test("path traversal", async () => {
    const fixture = await createFixture();
    fixture.descriptor.repositories.backend.artifacts[0].path =
      "../outside.jar";
    await assert.rejects(() => generate(fixture), /safe relative path/u);
  });
  await t.test("symbolic link", async () => {
    const fixture = await createFixture();
    await symlink(
      "application.js",
      join(fixture.web.repository, "dist/assets/alias.js"),
    );
    fixture.descriptor.repositories.web.assets.criticalBundles.push(
      "dist/assets/alias.js",
    );
    fixture.web.commitSha = await commit(
      fixture.web.repository,
      "symlink fixture",
    );
    fixture.descriptor.repositories.web.commitSha = fixture.web.commitSha;
    await assert.rejects(() => generate(fixture), /symbolic link/u);
  });
  await t.test("secret material", async () => {
    const fixture = await createFixture();
    await write(
      join(fixture.backend.repository, "config/schema.json"),
      '{"databasePassword":"correct-horse-battery-staple"}\n',
    );
    fixture.backend.commitSha = await commit(
      fixture.backend.repository,
      "secret",
    );
    fixture.descriptor.repositories.backend.commitSha =
      fixture.backend.commitSha;
    await assert.rejects(() => generate(fixture), /secret material/u);
  });
  await t.test(
    "secret-reference containers cannot hide literal secrets",
    async () => {
      const fixture = await createFixture();
      await write(
        join(fixture.backend.repository, "config/schema.json"),
        '{"secretReferences":{"databasePassword":"correct-horse-battery-staple"}}\n',
      );
      fixture.backend.commitSha = await commit(
        fixture.backend.repository,
        "hidden secret",
      );
      fixture.descriptor.repositories.backend.commitSha =
        fixture.backend.commitSha;
      await assert.rejects(() => generate(fixture), /secret material/u);
    },
  );
  await t.test(
    "non-secret keys containing token text are not false positives",
    async () => {
      const fixture = await createFixture();
      await write(
        join(fixture.backend.repository, "config/schema.json"),
        '{"tokenizer":"bert-base"}\n',
      );
      fixture.backend.commitSha = await commit(
        fixture.backend.repository,
        "safe tokenizer config",
      );
      fixture.descriptor.repositories.backend.commitSha =
        fixture.backend.commitSha;
      await generate(fixture);
    },
  );
  await t.test("manifest metadata cannot contain direct tokens", async () => {
    const fixture = await createFixture();
    fixture.descriptor.evidence.tests = ["Bearer aaaaaaaaaaaaaaaa"];
    await assert.rejects(() => generate(fixture), /secret material/u);
  });
  await t.test(
    "migration directories reject untracked migration classes",
    async () => {
      const fixture = await createFixture();
      await write(
        join(
          fixture.backend.repository,
          "src/main/resources/db/migration/R__refresh.sql",
        ),
        "select 3;\n",
      );
      fixture.backend.commitSha = await commit(
        fixture.backend.repository,
        "repeatable migration",
      );
      fixture.descriptor.repositories.backend.commitSha =
        fixture.backend.commitSha;
      await assert.rejects(() => generate(fixture), /unsupported migration/u);
    },
  );
});

test("verification rejects drift in every bound artifact class and runtime version", async (t) => {
  const targets = [
    ["backend", "target/application.jar"],
    ["backend", "src/main/resources/db/migration/V2__second.sql"],
    ["backend", "contracts/api.json"],
    ["backend", "config/schema.json"],
    ["backend", "sbom.cdx.json"],
    ["backend", "pom.xml"],
    ["web", "dist/assets/application.js"],
    ["frontend", "dist/index.html"],
  ];
  for (const [repositoryName, path] of targets) {
    await t.test(`${repositoryName}:${path}`, async () => {
      const fixture = await createFixture();
      const manifestPath = await generate(fixture);
      const runtimeRoot = join(fixture.root, "runtime");
      const runtimeRoots = {};
      for (const name of ["backend", "web", "frontend"]) {
        runtimeRoots[name] = join(runtimeRoot, name);
        await cp(fixture[name].repository, runtimeRoots[name], {
          recursive: true,
          filter: (source) => !source.includes(`${join("", ".git")}`),
        });
      }
      await write(join(runtimeRoots[repositoryName], path), "drift\n");
      await assert.rejects(
        () =>
          verifyReleaseManifest({
            manifestPath,
            runtimeRoots,
            runtimeVersions,
          }),
        /mismatch|missing/u,
      );
    });
  }
  await t.test("Node runtime version", async () => {
    const fixture = await createFixture();
    const manifestPath = await generate(fixture);
    await assert.rejects(
      () =>
        verifyReleaseManifest({
          manifestPath,
          runtimeRoots: {
            backend: fixture.backend.repository,
            web: fixture.web.repository,
            frontend: fixture.frontend.repository,
          },
          runtimeVersions: { node: "23.0.0", npm: "11.17.0", jdk: "21" },
        }),
      /Node.*mismatch/u,
    );
  });
  await t.test("runtime versions are required", async () => {
    const fixture = await createFixture();
    const manifestPath = await generate(fixture);
    await assert.rejects(
      () =>
        verifyReleaseManifest({
          manifestPath,
          runtimeRoots: {
            backend: fixture.backend.repository,
            web: fixture.web.repository,
            frontend: fixture.frontend.repository,
          },
        }),
      /runtimeVersions/u,
    );
  });
  await t.test("runtime versions reject unknown fields", async () => {
    const fixture = await createFixture();
    const manifestPath = await generate(fixture);
    await assert.rejects(
      () =>
        verifyReleaseManifest({
          manifestPath,
          runtimeRoots: {
            backend: fixture.backend.repository,
            web: fixture.web.repository,
            frontend: fixture.frontend.repository,
          },
          runtimeVersions: { ...runtimeVersions, unexpected: "1" },
        }),
      /unknown/u,
    );
  });
  await t.test("manifest paths cannot be symbolic links", async () => {
    const fixture = await createFixture();
    const manifestPath = await generate(fixture);
    const manifestLink = join(fixture.root, "manifest-link.json");
    await symlink("release.json", manifestLink);
    await assert.rejects(
      () =>
        verifyReleaseManifest({
          manifestPath: manifestLink,
          runtimeRoots: {
            backend: fixture.backend.repository,
            web: fixture.web.repository,
            frontend: fixture.frontend.repository,
          },
          runtimeVersions,
        }),
      /symbolic link/u,
    );
    assert.equal(manifestPath, join(fixture.root, "release.json"));
  });
});

test("schema and self-hash reject unknown fields, migration reordering, and tampering", async (t) => {
  const fixture = await createFixture();
  const manifestPath = await generate(fixture);
  const envelope = JSON.parse(await readFile(manifestPath, "utf8"));
  await t.test("unknown field", () => {
    const changed = structuredClone(envelope.manifest);
    changed.unexpected = true;
    assert.throws(
      () => validateManifestEnvelope(sealManifest(changed)),
      /unknown/u,
    );
  });
  await t.test("unknown nested field", () => {
    const changed = structuredClone(envelope.manifest);
    changed.repositories.web.build.unexpected = true;
    assert.throws(
      () => validateManifestEnvelope(sealManifest(changed)),
      /unknown/u,
    );
  });
  await t.test("schema version must be exactly supported", () => {
    const changed = structuredClone(envelope.manifest);
    changed.schemaVersion = "1";
    assert.throws(
      () => validateManifestEnvelope(sealManifest(changed)),
      /schemaVersion/u,
    );
  });
  await t.test("file metadata is required", () => {
    const changed = structuredClone(envelope.manifest);
    delete changed.repositories.web.assets.files[0].sha256;
    assert.throws(
      () => validateManifestEnvelope(sealManifest(changed)),
      /sha256/u,
    );
  });
  await t.test("evidence entries must be non-empty strings", () => {
    const changed = structuredClone(envelope.manifest);
    changed.evidence.tests = [42];
    assert.throws(
      () => validateManifestEnvelope(sealManifest(changed)),
      /evidence/u,
    );
  });
  await t.test("stored manifest origins cannot embed credentials", () => {
    const changed = structuredClone(envelope.manifest);
    changed.repositories.web.origin =
      "https://release-user:release-password@example.invalid/repo.git";
    assert.throws(
      () => validateManifestEnvelope(sealManifest(changed)),
      /origin.*credentials/u,
    );
  });
  await t.test("stored build commands cannot embed secret assignments", () => {
    const changed = structuredClone(envelope.manifest);
    changed.repositories.web.build.command =
      "api_key=correct-horse-battery-staple";
    assert.throws(
      () => validateManifestEnvelope(sealManifest(changed)),
      /secret material/u,
    );
  });
  await t.test("migration version metadata must match its path", () => {
    const changed = structuredClone(envelope.manifest);
    changed.repositories.backend.migrations.files[0].version = "99";
    assert.throws(
      () => validateManifestEnvelope(sealManifest(changed)),
      /migration.*version/u,
    );
  });
  await t.test("migration reordering", () => {
    const changed = structuredClone(envelope.manifest);
    changed.repositories.backend.migrations.files.reverse();
    assert.throws(
      () => validateManifestEnvelope(sealManifest(changed)),
      /migration.*order/u,
    );
  });
  await t.test("manifest tampering", () => {
    const changed = structuredClone(envelope);
    changed.manifest.releaseId = "tampered";
    assert.throws(() => validateManifestEnvelope(changed), /manifest SHA-256/u);
  });
});

test("immutable atomic generation accepts identical concurrency and rejects replacement", async () => {
  const fixture = await createFixture();
  const outputPath = join(fixture.root, "concurrent.json");
  await Promise.all([
    generateReleaseManifest({ descriptor: fixture.descriptor, outputPath }),
    generateReleaseManifest({ descriptor: fixture.descriptor, outputPath }),
  ]);
  const envelope = JSON.parse(await readFile(outputPath, "utf8"));
  assert.equal(validateManifestEnvelope(envelope), true);

  fixture.descriptor.releaseId = "cofco-fixture-20260830.2";
  await assert.rejects(
    () =>
      generateReleaseManifest({ descriptor: fixture.descriptor, outputPath }),
    /immutable|already exists/u,
  );
  const unchanged = JSON.parse(await readFile(outputPath, "utf8"));
  assert.equal(unchanged.manifest.releaseId, "cofco-fixture-20260830.1");
});

test("versioned JSON Schema and code validator agree on structural acceptance and rejection", async (t) => {
  const fixture = await createFixture();
  const manifestPath = await generate(fixture);
  const envelope = JSON.parse(await readFile(manifestPath, "utf8"));
  const schema = JSON.parse(
    await readFile(
      new URL("../docs/releases/release-manifest.schema.json", import.meta.url),
      "utf8",
    ),
  );
  const validateSchema = new Ajv({ allErrors: true }).compile(schema);
  const cases = [
    ["valid envelope", envelope, true],
    ["unknown envelope field", { ...envelope, unexpected: true }, false],
    [
      "unknown nested field",
      sealManifest({
        ...envelope.manifest,
        repositories: {
          ...envelope.manifest.repositories,
          web: {
            ...envelope.manifest.repositories.web,
            build: {
              ...envelope.manifest.repositories.web.build,
              unexpected: true,
            },
          },
        },
      }),
      false,
    ],
    [
      "unsupported schema version",
      sealManifest({ ...envelope.manifest, schemaVersion: 2 }),
      false,
    ],
    [
      "missing file digest",
      (() => {
        const changed = structuredClone(envelope.manifest);
        delete changed.repositories.web.assets.files[0].sha256;
        return sealManifest(changed);
      })(),
      false,
    ],
    [
      "invalid repository SHA",
      (() => {
        const changed = structuredClone(envelope.manifest);
        changed.repositories.frontend.commitSha = "A".repeat(40);
        return sealManifest(changed);
      })(),
      false,
    ],
    [
      "unsafe relative path",
      (() => {
        const changed = structuredClone(envelope.manifest);
        changed.repositories.backend.artifacts[0].path = "../backend.jar";
        return sealManifest(changed);
      })(),
      false,
    ],
    [
      "mutable container tag",
      (() => {
        const changed = structuredClone(envelope.manifest);
        changed.repositories.web.containerImage = "registry.invalid/web:latest";
        return sealManifest(changed);
      })(),
      false,
    ],
    [
      "non-string evidence entry",
      (() => {
        const changed = structuredClone(envelope.manifest);
        changed.evidence.tests = [42];
        return sealManifest(changed);
      })(),
      false,
    ],
  ];

  for (const [name, candidate, expected] of cases) {
    await t.test(name, () => {
      const schemaAccepted = validateSchema(candidate);
      let codeAccepted = true;
      try {
        validateManifestEnvelope(candidate);
      } catch {
        codeAccepted = false;
      }
      assert.equal(
        schemaAccepted,
        expected,
        JSON.stringify(validateSchema.errors),
      );
      assert.equal(codeAccepted, expected);
    });
  }
});

test("stable CLI generates only a marked fixture on non-integrated refs and validates manifest/runtime", async () => {
  const fixture = await createFixture();
  const descriptorPath = join(fixture.root, "descriptor.json");
  const manifestPath = join(fixture.root, "cli-release.json");
  await writeFile(descriptorPath, `${JSON.stringify(fixture.descriptor)}\n`);

  const generated = [];
  await runReleaseManifestCli(
    ["generate", "--descriptor", descriptorPath, "--output", manifestPath],
    { write: (value) => generated.push(value) },
  );
  assert.match(generated.join(""), /non-release-fixture/u);

  const validated = [];
  await runReleaseManifestCli(["validate", "--manifest", manifestPath], {
    write: (value) => validated.push(value),
  });
  assert.match(validated.join(""), /manifest-valid/u);

  const verified = [];
  await runReleaseManifestCli(
    [
      "verify",
      "--manifest",
      manifestPath,
      "--backend-root",
      fixture.backend.repository,
      "--frontend-root",
      fixture.frontend.repository,
      "--web-root",
      fixture.web.repository,
      "--node-version",
      runtimeVersions.node,
      "--npm-version",
      runtimeVersions.npm,
      "--jdk-version",
      runtimeVersions.jdk,
    ],
    { write: (value) => verified.push(value) },
  );
  assert.match(verified.join(""), /runtime-valid/u);

  fixture.descriptor.environment = "preproduction-candidate";
  await writeFile(descriptorPath, `${JSON.stringify(fixture.descriptor)}\n`);
  await assert.rejects(
    () =>
      runReleaseManifestCli([
        "generate",
        "--descriptor",
        descriptorPath,
        "--output",
        join(fixture.root, "candidate.json"),
      ]),
    /official origin|main/u,
  );
});

test("CLI rejects shell-like, unknown, duplicate, and incomplete argv", async () => {
  await assert.rejects(
    () =>
      runReleaseManifestCli([
        "validate",
        "--manifest",
        "release.json; touch unexpected",
      ]),
    /missing|regular file|ENOENT/u,
  );
  await assert.rejects(
    () => runReleaseManifestCli(["validate", "--unknown", "value"]),
    /unknown option/u,
  );
  await assert.rejects(
    () =>
      runReleaseManifestCli([
        "validate",
        "--manifest",
        "one.json",
        "--manifest",
        "two.json",
      ]),
    /duplicate option/u,
  );
  await assert.rejects(
    () => runReleaseManifestCli(["verify", "--manifest", "release.json"]),
    /missing option/u,
  );
});

test("candidate CLI rejects a non-official configured origin before remote access", async () => {
  const fixture = await createFixture();
  fixture.descriptor.environment = "preproduction-candidate";
  fixture.descriptor.repositories.backend.origin =
    "https://github.com/panzhencheng666-gif/cofco-qiqihar-enterprise-backend.git";
  fixture.descriptor.repositories.frontend.origin =
    "https://github.com/panzhencheng666-gif/cofco-qiqihar-enterprise-frontend.git";
  fixture.descriptor.repositories.web.origin =
    "https://github.com/panzhencheng666-gif/cofco-qiqihar-enterprise-web.git";
  await runGit(fixture.backend.origin, "update-ref", "-d", "refs/heads/main");
  const descriptorPath = join(fixture.root, "candidate-descriptor.json");
  await writeFile(descriptorPath, `${JSON.stringify(fixture.descriptor)}\n`);

  await assert.rejects(
    () =>
      runReleaseManifestCli([
        "generate",
        "--descriptor",
        descriptorPath,
        "--output",
        join(fixture.root, "candidate.json"),
      ]),
    /backend.*configured origin.*official/u,
  );
});
