import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";

const MAX_INITIAL_JAVASCRIPT_BYTES = 900 * 1024;
const MAX_PRODUCTION_CHUNK_BYTES = 900 * 1024;
const root = process.cwd();
const distDirectory = resolve(root, "dist");
const indexPath = resolve(distDirectory, "index.html");
const manifestPath = resolve(distDirectory, ".vite", "manifest.json");

function fail(message) {
  process.stderr.write(`JavaScript bundle budget failed: ${message}\n`);
  process.exitCode = 1;
}

function normalizeAssetPath(value) {
  const relative = value.replace(/^\/+/, "");
  const absolute = resolve(distDirectory, relative);
  if (
    absolute !== distDirectory &&
    !absolute.startsWith(`${distDirectory}${sep}`)
  ) {
    throw new Error(`asset path escapes dist: ${value}`);
  }
  return { relative, absolute };
}

function collectManifestImports(manifest, key, assets, visited) {
  if (visited.has(key)) return;
  visited.add(key);
  const record = manifest[key];
  if (!record) throw new Error(`manifest dependency is missing: ${key}`);
  if (record.file?.endsWith(".js")) assets.add(record.file);
  for (const dependency of record.imports ?? []) {
    collectManifestImports(manifest, dependency, assets, visited);
  }
}

const [indexHtml, manifestJson] = await Promise.all([
  readFile(indexPath, "utf8"),
  readFile(manifestPath, "utf8"),
]);
const manifest = JSON.parse(manifestJson);
const initialAssets = new Set();
const productionAssets = new Set(
  Object.values(manifest)
    .map((record) => record.file)
    .filter((file) => file?.endsWith(".js")),
);

for (const match of indexHtml.matchAll(
  /<(?:script|link)\b[^>]*(?:src|href)="([^"]+\.js)"[^>]*>/g,
)) {
  initialAssets.add(match[1].replace(/^\/+/, ""));
}

const entry = Object.entries(manifest).find(([, record]) => record.isEntry);
if (!entry) {
  throw new Error("build manifest does not contain an entry module");
}
collectManifestImports(manifest, entry[0], initialAssets, new Set());

async function measureAssets(assets) {
  const rows = [];
  for (const asset of [...assets].sort()) {
    const { relative, absolute } = normalizeAssetPath(asset);
    const [metadata, content] = await Promise.all([
      stat(absolute),
      readFile(absolute),
    ]);
    rows.push({
      file: relative,
      bytes: metadata.size,
      gzipBytes: gzipSync(content).byteLength,
    });
  }
  return rows;
}

const [initialRows, productionRows] = await Promise.all([
  measureAssets(initialAssets),
  measureAssets(productionAssets),
]);
let totalBytes = 0;
let totalGzipBytes = 0;
let largestBytes = 0;
for (const row of initialRows) {
  totalBytes += row.bytes;
  totalGzipBytes += row.gzipBytes;
  largestBytes = Math.max(largestBytes, row.bytes);
}
const largestProductionRow = productionRows.reduce(
  (largest, row) => (row.bytes > largest.bytes ? row : largest),
  { file: "none", bytes: 0, gzipBytes: 0 },
);

for (const row of initialRows) {
  process.stdout.write(
    `${(row.bytes / 1024).toFixed(2)} KiB (${(row.gzipBytes / 1024).toFixed(2)} KiB gzip) ${row.file}\n`,
  );
}
process.stdout.write(
  `Initial preloaded JavaScript: ${(totalBytes / 1024).toFixed(2)} KiB minified, ${(totalGzipBytes / 1024).toFixed(2)} KiB gzip; largest chunk ${(largestBytes / 1024).toFixed(2)} KiB; limit ${(MAX_INITIAL_JAVASCRIPT_BYTES / 1024).toFixed(0)} KiB.\n`,
);
process.stdout.write(
  `Largest production JavaScript chunk: ${(largestProductionRow.bytes / 1024).toFixed(2)} KiB minified, ${(largestProductionRow.gzipBytes / 1024).toFixed(2)} KiB gzip; ${largestProductionRow.file}; limit ${(MAX_PRODUCTION_CHUNK_BYTES / 1024).toFixed(0)} KiB.\n`,
);

if (initialAssets.size === 0) {
  fail("no initial JavaScript assets were discovered");
}
if (productionAssets.size === 0) {
  fail("no production JavaScript chunks were discovered");
}
if (totalBytes > MAX_INITIAL_JAVASCRIPT_BYTES) {
  fail(
    `initial preloaded JavaScript ${(totalBytes / 1024).toFixed(2)} KiB exceeds 900 KiB`,
  );
}
if (largestBytes > MAX_INITIAL_JAVASCRIPT_BYTES) {
  fail(
    `largest emitted initial chunk ${(largestBytes / 1024).toFixed(2)} KiB exceeds 900 KiB`,
  );
}
if (largestProductionRow.bytes > MAX_PRODUCTION_CHUNK_BYTES) {
  fail(
    `largest production chunk ${largestProductionRow.file} is ${(largestProductionRow.bytes / 1024).toFixed(2)} KiB and exceeds 900 KiB`,
  );
}
