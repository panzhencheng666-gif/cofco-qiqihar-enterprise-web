import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
let temporary, sdk;
before(async () => {
  temporary = await mkdtemp(path.join(tmpdir(), "globe-ion-test-"));
  const plugin = await import("../build/disabled-ion-plugin.mjs");
  const arcgisPlugin = await import("../build/disabled-arcgis-plugin.mjs");
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
        '\nexport { default as IonImageryProvider } from "@cesium/engine/Source/Scene/IonImageryProvider.js";' +
        [
          "ArcGisMapService",
          "ArcGisMapServerImageryProvider",
          "ArcGisBaseMapType",
        ]
          .map(
            (name) =>
              `\nexport { default as ${name} } from "@cesium/engine/Source/Scene/${name}.js";`,
          )
          .join(""),
      resolveDir: root,
    },
    plugins: [plugin.disabledIonPlugin(), arcgisPlugin.disabledArcGisPlugin()],
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

test("finished application replaces both SDK default modules and passes credential gate", async () => {
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
  const gate = await import("../../../scripts/gods-eye-view-credentials.mjs");
  assert.equal(typeof gate.checkEmbeddedCredentials, "function");
  assert.ok(
    Object.hasOwn(meta.inputs, "src/disabled-arcgis.js"),
    "disabled ArcGIS adapter must be bundled",
  );
  assert.ok(
    !Object.keys(meta.inputs).some((name) =>
      name.endsWith("/Source/Scene/ArcGisMapService.js"),
    ),
    "SDK ArcGIS defaults must be absent",
  );
  for (const details of Object.values(meta.inputs)) {
    for (const dependency of details.imports) {
      if (dependency.original?.endsWith("/ArcGisMapService.js"))
        assert.equal(dependency.path, "src/disabled-arcgis.js");
      if (dependency.original?.endsWith("/Ion.js"))
        assert.equal(dependency.path, "src/disabled-ion.js");
    }
  }
  const counts = await gate.checkEmbeddedCredentials(path.join(root, "dist"));
  assert.equal(counts.knownDefaultsChecked, 2);
  assert.ok(counts.filesScanned > 100);
});

test("credential gate checks nested worker and chunk JS and reports only filename/count", async () => {
  const gate = await import("../../../scripts/gods-eye-view-credentials.mjs");
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

test("bundled installed ArcGIS has frozen undefined defaults", () => {
  for (const key of [
    "defaultAccessToken",
    "defaultWorldImageryServer",
    "defaultWorldHillshadeServer",
    "defaultWorldOceanServer",
  ]) {
    assert.equal(
      typeof sdk.ArcGisMapService[key],
      "undefined",
      `${key} must be absent`,
    );
  }
  assert.ok(Object.isFrozen(sdk.ArcGisMapService));
  assert.equal(
    sdk.ArcGisMapService.getDefaultTokenCredit(undefined),
    undefined,
  );
});

test("all installed ArcGIS basemap variants fail before implicit requests", async () => {
  let requests = 0;
  const original = sdk.Resource.prototype.fetchJson;
  sdk.Resource.prototype.fetchJson = () => {
    requests++;
    return Promise.reject(new Error("network attempted"));
  };
  try {
    for (const style of Object.values(sdk.ArcGisBaseMapType)) {
      await assert.rejects(() =>
        sdk.ArcGisMapServerImageryProvider.fromBasemapType(style),
      );
      assert.equal(requests, 0, `basemap ${style} must stop before fetchJson`);
    }
  } finally {
    sdk.Resource.prototype.fetchJson = original;
  }
});

test("credential gate rejects actual SDK defaults in nested chunks and workers without exposing values", async () => {
  const { checkEmbeddedCredentials } =
    await import("../../../scripts/gods-eye-view-credentials.mjs");
  const directory = path.join(temporary, "sdk-defaults");
  await mkdir(path.join(directory, "chunks"), { recursive: true });
  await mkdir(path.join(directory, "cesium/Workers"), { recursive: true });
  for (const module of ["Core/Ion.js", "Scene/ArcGisMapService.js"]) {
    const source = await readFile(
      require.resolve(`@cesium/engine/Source/${module}`),
      "utf8",
    );
    const matches = [
      ...source.matchAll(
        /const defaultAccessToken\s*=\s*["']([^"'\r\n]+)["']\s*;/g,
      ),
    ];
    assert.equal(
      matches.length,
      1,
      "installed default contract must match once",
    );
    const literal = matches[0][1];
    for (const filename of ["chunks/probe.mjs", "cesium/Workers/probe.cjs"]) {
      const file = path.join(directory, filename);
      await writeFile(
        file,
        `const first = "${literal}", second = "${literal}";`,
      );
      await assert.rejects(
        () => checkEmbeddedCredentials(directory),
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
  }
  await writeFile(
    path.join(directory, "chunks/legitimate.js"),
    `const asset = "${"a".repeat(300)}";`,
  );
  await checkEmbeddedCredentials(directory);
});

test("SDK default credential contract gate fails closed on missing, malformed, or drifted public modules", async () => {
  const { checkSdkDefaultCredentialContracts } =
    await import("../../../scripts/gods-eye-view-credentials.mjs");
  assert.equal(typeof checkSdkDefaultCredentialContracts, "function");
  const sources = new Map();
  for (const module of ["Core/Ion.js", "Scene/ArcGisMapService.js"]) {
    sources.set(
      module,
      await readFile(
        require.resolve(`@cesium/engine/Source/${module}`),
        "utf8",
      ),
    );
  }
  for (const module of sources.keys()) {
    for (const replacement of [
      undefined,
      "export default {};",
      sources.get(module) + "\n] malformed module",
      sources
        .get(module)
        .replace(
          /const defaultAccessToken\s*=\s*["'][^"'\r\n]+["']\s*;/,
          'const defaultAccessToken = "drifted-public-default";',
        ),
    ]) {
      await assert.rejects(
        () =>
          checkSdkDefaultCredentialContracts(async (name) => {
            if (name === module) {
              if (replacement === undefined) throw new Error("missing module");
              return replacement;
            }
            return sources.get(name);
          }),
        (error) => {
          assert.equal(
            error.message,
            `SDK default credential contract mismatch: ${module}`,
          );
          assert.ok(!error.message.includes("drifted-public-default"));
          return true;
        },
      );
    }
  }
});

test("ArcGIS resolver replaces only the exact installed SDK identity", async () => {
  const { disabledArcGisPlugin } =
    await import("../build/disabled-arcgis-plugin.mjs");
  const directory = path.join(temporary, "identity");
  await mkdir(directory);
  await writeFile(
    path.join(directory, "ArcGisMapService.js"),
    "export default Object.freeze({ unrelated: true });",
  );
  const result = await build({
    absWorkingDir: root,
    stdin: {
      contents: `export { default as unrelated } from "./ArcGisMapService.js"; export { default as disabled } from "@cesium/engine/Source/Scene/ArcGisMapService.js";`,
      resolveDir: directory,
    },
    plugins: [disabledArcGisPlugin()],
    outfile: path.join(directory, "probe.mjs"),
    bundle: true,
    format: "esm",
    metafile: true,
    nodePaths: [path.join(root, "node_modules")],
  });
  const probe = await import(pathToFileURL(path.join(directory, "probe.mjs")));
  assert.equal(probe.unrelated.unrelated, true);
  assert.equal(typeof probe.disabled.defaultAccessToken, "undefined");
  assert.ok(
    Object.keys(result.metafile.inputs).some((name) =>
      name.endsWith("identity/ArcGisMapService.js"),
    ),
  );
  assert.ok(
    !Object.keys(result.metafile.inputs).some((name) =>
      name.endsWith("/Source/Scene/ArcGisMapService.js"),
    ),
  );
});

test("other public SDK credential defaults contain no long credential literals", async () => {
  for (const module of [
    "Core/GoogleMaps.js",
    "Core/ITwinPlatform.js",
    "Scene/Google2DImageryProvider.js",
    "Scene/createGooglePhotorealistic3DTileset.js",
  ]) {
    const source = await readFile(
      require.resolve(`@cesium/engine/Source/${module}`),
      "utf8",
    );
    const longLiterals = [
      ...source.matchAll(/(["'])([A-Za-z0-9_.=-]{100,})\1/g),
    ];
    assert.equal(
      longLiterals.length,
      0,
      `unexpected long credential contract in ${module}`,
    );
  }
});
