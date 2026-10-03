import { analystRegionsPlugin } from "./build/analyst-regions-plugin.mjs";
import { build } from "esbuild";
import { disabledArcGisPlugin } from "./build/disabled-arcgis-plugin.mjs";
import { disabledIonPlugin } from "./build/disabled-ion-plugin.mjs";
import { checkEmbeddedCredentials } from "../../scripts/gods-eye-view-credentials.mjs";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(root, "dist");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(path.join(root, "public"), out, { recursive: true });
const result = await build({
  absWorkingDir: root,
  plugins: [
    disabledIonPlugin(),
    disabledArcGisPlugin(),
    analystRegionsPlugin(root),
  ],
  alias: {
    meshoptimizer: path.join(root, "src/disabled-meshopt.js"),
    cesium: "@cesium/engine",
  },
  entryPoints: {
    host: "src/host.js",
    "frame-bootstrap": "src/frame-bootstrap.js",
  },
  outdir: out,
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  metafile: true,
  chunkNames: "chunks/[name]-[hash]",
  define: { CESIUM_BASE_URL: JSON.stringify("./cesium/") },
});
for (const name of ["Workers", "Assets", "ThirdParty", "Widgets"])
  await cp(
    path.join(root, "node_modules/cesium/Build/Cesium", name),
    path.join(out, "cesium", name),
    { recursive: true },
  );
await cp(path.join(root, "vendor"), path.join(out, "provenance"), {
  recursive: true,
});
await cp(
  path.join(root, "node_modules/cesium/LICENSE.md"),
  path.join(out, "CESIUM-LICENSE.md"),
);
await cp(
  path.join(root, "node_modules/cesium/ThirdParty.json"),
  path.join(out, "CESIUM-THIRD-PARTY.json"),
);
await cp(
  path.join(root, "node_modules/cesium/ThirdParty.extra.json"),
  path.join(out, "CESIUM-THIRD-PARTY-EXTRA.json"),
);
await writeFile(
  path.join(root, "build-meta.json"),
  JSON.stringify(result.metafile, null, 2) + "\n",
);
await checkEmbeddedCredentials(out);
console.log(`Isolated globe build: ${out}`);
