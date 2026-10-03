import assert from "node:assert/strict";
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
  ].sort(),
);
assert.ok(
  !Object.keys(meta.inputs).some((i) => i.includes("@cesium/widgets/Source/")),
  "Full widgets imported",
);
console.log(
  `Globe source gate passed: ${provenance.files.length} immutable upstream files; ${importedVendor.length} imported upstream modules; no engine in shell graph.`,
);
