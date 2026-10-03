import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
let temporary, sdk;
before(async () => {
  temporary = await mkdtemp(path.join(tmpdir(), "globe-ion-test-"));
  const plugin = await import("../build/disabled-ion-plugin.mjs").catch(
    () => null,
  );
  await build({
    absWorkingDir: root,
    stdin: {
      contents:
        ["Ion", "IonResource", "Resource", "IonGeocoderService"]
          .map(
            (name) =>
              `export { default as ${name} } from "@cesium/engine/Source/Core/${name}.js";`,
          )
          .join("\n") +
        '\nexport { default as IonImageryProvider } from "@cesium/engine/Source/Scene/IonImageryProvider.js";',
      resolveDir: root,
    },
    plugins: plugin ? [plugin.disabledIonPlugin()] : [],
    outfile: path.join(temporary, "sdk.mjs"),
    bundle: true,
    format: "esm",
    platform: "browser",
  });
  sdk = await import(pathToFileURL(path.join(temporary, "sdk.mjs")));
});
after(async () => {
  if (temporary) await rm(temporary, { recursive: true, force: true });
});

test("bundled installed Ion has no default credential or server", () => {
  assert.equal(
    typeof sdk.Ion.defaultAccessToken,
    "undefined",
    "default credential must be absent",
  );
  assert.equal(
    typeof sdk.Ion.defaultServer,
    "undefined",
    "default server must be absent",
  );
  assert.equal(sdk.Ion.getDefaultTokenCredit(undefined), undefined);
  assert.ok(Object.isFrozen(sdk.Ion));
});

test("installed optional Ion providers fail before any implicit request", async () => {
  let requests = 0;
  const original = sdk.Resource.prototype.fetchJson;
  sdk.Resource.prototype.fetchJson = () => {
    requests++;
    return Promise.reject(new Error("network attempted"));
  };
  try {
    await assert.rejects(async () => sdk.IonResource.fromAssetId(1));
    await assert.rejects(() => sdk.IonImageryProvider.fromAssetId(1));
    assert.throws(() => new sdk.IonGeocoderService({ scene: {} }));
    assert.equal(
      requests,
      0,
      "implicit Ion requests must stop before fetchJson",
    );
  } finally {
    sdk.Resource.prototype.fetchJson = original;
  }
});

test("finished application replaces SDK Ion in its metadata and passes credential gate", async () => {
  const built = spawnSync(process.execPath, ["build.mjs"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(built.status, 0, "isolated application build must succeed");
  const meta = JSON.parse(
    await readFile(path.join(root, "build-meta.json"), "utf8"),
  );
  assert.ok(
    Object.hasOwn(meta.inputs, "src/disabled-ion.js"),
    "original disabled Ion adapter must be bundled",
  );
  assert.ok(
    !Object.keys(meta.inputs).some((name) =>
      name.endsWith("/Source/Core/Ion.js"),
    ),
    "SDK Ion module must be absent",
  );
  const gate =
    await import("../../../scripts/gods-eye-view-credentials.mjs").catch(
      () => ({}),
    );
  assert.equal(typeof gate.checkEmbeddedCredentials, "function");
  await gate.checkEmbeddedCredentials(path.join(root, "dist"));
});

test("credential gate checks nested worker and chunk JS and reports only filename/count", async () => {
  const gate =
    await import("../../../scripts/gods-eye-view-credentials.mjs").catch(
      () => ({}),
    );
  assert.equal(typeof gate.checkEmbeddedCredentials, "function");
  const directory = path.join(temporary, "gate");
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: "test-only" })).toString(
    "base64url",
  );
  const literal = [header, payload, "synthetic_signature_only"].join(".");
  await mkdir(path.join(directory, "cesium/Workers"), { recursive: true });
  await mkdir(path.join(directory, "chunks"));
  await writeFile(path.join(directory, "host.js"), "export const ok = true;");
  for (const filename of ["chunks/probe.js", "cesium/Workers/probe.js"]) {
    const file = path.join(directory, filename);
    await writeFile(file, `const first = "${literal}", second = "${literal}";`);
    await assert.rejects(
      () => gate.checkEmbeddedCredentials(directory),
      (error) => {
        assert.equal(
          error.message,
          `Embedded credential literals: ${filename} (count: 2)`,
        );
        assert.ok(!error.message.includes(literal));
        return true;
      },
    );
    await rm(file);
  }
  await gate.checkEmbeddedCredentials(directory);
});
