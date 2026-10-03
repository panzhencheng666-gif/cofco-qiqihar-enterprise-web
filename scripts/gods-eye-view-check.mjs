import assert from "node:assert/strict";
import { checkEmbeddedCredentials } from "./gods-eye-view-credentials.mjs";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../apps/gods-eye-view",
);
const read = (file) => readFile(path.join(root, file), "utf8");
const provenance = JSON.parse(await read("vendor/provenance.json"));
assert.equal(provenance.commit, "aa16b7c3b0166a89d8c7a6089e0aff53a22faaee");
for (const file of provenance.files) {
  const bytes = await readFile(path.join(root, file.vendorPath));
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    file.sha256,
    `Vendor modification: ${file.vendorPath}`,
  );
}
for (const derivative of provenance.derivatives) {
  const original = provenance.files.find(
    (file) => file.upstreamPath === derivative.upstreamPath,
  );
  assert.equal(original?.sha256, derivative.upstreamSha256);
  const bytes = await readFile(path.join(root, derivative.derivedPath));
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    derivative.derivedSha256,
    `Unrecorded derivative change: ${derivative.derivedPath}`,
  );
}
const pkg = JSON.parse(await read("package.json"));
assert.deepEqual(pkg.dependencies, { cesium: "1.138.0" });
assert.deepEqual(pkg.devDependencies, { esbuild: "0.25.12" });
const lock = JSON.parse(await read("package-lock.json"));
for (const [name, p] of Object.entries(lock.packages))
  if (name) {
    assert.ok(p.integrity, `No integrity: ${name}`);
    assert.ok(
      p.resolved?.startsWith("https://registry.npmjs.org/"),
      `Unexpected registry: ${name}`,
    );
  }
for (const file of ["public/index.html", "public/frame.html"]) {
  const html = await read(file);
  assert.ok(html.includes("Content-Security-Policy"));
  assert.ok(!html.includes("unsafe-eval"));
  assert.ok(!html.includes("<script>"));
}
const own = (await readdir(path.join(root, "src"))).filter((f) =>
  f.endsWith(".js"),
);
for (const file of own) {
  const source = await read(`src/${file}`);
  assert.ok(
    !/document\.cookie|localStorage|sessionStorage|postMessage|apiKey|accessToken|eval\(/.test(
      source,
    ),
    `Forbidden integration: ${file}`,
  );
  assert.ok(!/setInterval\(/.test(source), `Polling: ${file}`);
}
const meta = JSON.parse(await read("build-meta.json"));
const visited = new Set();
function walk(output) {
  if (visited.has(output)) return;
  visited.add(output);
  const item = meta.outputs[output];
  assert.ok(item, output);
  for (const input of Object.keys(item.inputs))
    assert.ok(
      !input.startsWith("node_modules/"),
      "Engine loaded by shell: " + input,
    );
  for (const next of item.imports)
    if (next.kind === "import-statement") walk(next.path);
}
walk("dist/host.js");
const importedVendor = Object.keys(meta.inputs).filter((i) =>
  i.startsWith("vendor/"),
);
assert.deepEqual(
  importedVendor.sort(),
  [
    "vendor/src/app/application.js",
    "vendor/src/app/atmosphereCompat.js",
    "vendor/src/layers/earthquakes/records.js",
    "vendor/src/layers/earthquakes/source.js",
    "vendor/src/search/coordinateParser.js",
    "vendor/src/ui/visualEffects.js",
    "vendor/src/ui/visualPresets.js",
    "vendor/src/bloom.js",
    "vendor/src/styles/retro.js",
    "vendor/src/styles/anime.js",
    "vendor/src/styles/noir.js",
    "vendor/src/styles/snow.js",
    "vendor/src/styles/surveillance.js",
    "vendor/src/styles/thermal.js",
  ].sort(),
);
assert.ok(
  !Object.keys(meta.inputs).some((i) => i.includes("@cesium/widgets/Source/")),
  "Full widgets imported",
);

assert.ok(
  !Object.keys(meta.inputs).some((i) =>
    i.startsWith("node_modules/meshoptimizer/"),
  ),
  "Optional model codecs eagerly initialize WASM",
);
assert.ok(
  Object.keys(meta.inputs).includes("src/disabled-meshopt.js"),
  "Optional model compression must remain disabled",
);

console.log(
  `Globe source gate passed: ${provenance.files.length} immutable upstream files; ${importedVendor.length} imported upstream modules; no engine in shell graph.`,
);

for (const [module, adapter] of [
  ["Core/Ion.js", "src/disabled-ion.js"],
  ["Scene/ArcGisMapService.js", "src/disabled-arcgis.js"],
]) {
  const original = `/Source/${module}`;
  assert.ok(
    !Object.keys(meta.inputs).some((input) => input.endsWith(original)),
    `Bundled SDK defaults must be replaced: ${module}`,
  );
  assert.ok(
    Object.hasOwn(meta.inputs, adapter),
    `Disabled adapter must be bundled: ${adapter}`,
  );
  let mappings = 0,
    emitted = 0;
  for (const [input, details] of Object.entries(meta.inputs)) {
    for (const dependency of details.imports) {
      if (dependency.original?.endsWith(`/${path.basename(module)}`)) {
        assert.equal(
          dependency.path,
          adapter,
          `SDK default import not replaced: ${input}`,
        );
        mappings++;
      }
      assert.ok(
        !dependency.path.endsWith(original),
        `SDK default dependency remains: ${input}`,
      );
    }
  }
  for (const [output, details] of Object.entries(meta.outputs)) {
    assert.ok(
      !Object.keys(details.inputs).some((input) => input.endsWith(original)),
      `SDK defaults emitted: ${output}`,
    );
    if (Object.hasOwn(details.inputs, adapter)) emitted++;
  }
  assert.ok(mappings > 0, `No SDK default import mappings: ${module}`);
  assert.ok(emitted > 0, `Adapter not emitted: ${adapter}`);
  console.log(
    `SDK defaults replaced: ${module}; ${mappings} import mappings; ${emitted} emitted adapter outputs.`,
  );
}
const counts = await checkEmbeddedCredentials(path.join(root, "dist"));
console.log(
  `Globe credential gate passed: ${counts.filesScanned} emitted JS files; ${counts.knownDefaultsChecked} pinned SDK defaults; ${counts.credentialMatches} credential matches.`,
);
