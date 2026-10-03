import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const sdkArcGis =
  require.resolve("@cesium/engine/Source/Scene/ArcGisMapService.js");
const adapter = path.join(root, "src/disabled-arcgis.js");

// Resolve normally, then replace only this installed SDK module. Other ArcGIS-named
// files and all immutable upstream files retain their normal module identities.
export function disabledArcGisPlugin() {
  return {
    name: "free-edition-disabled-arcgis",
    setup(build) {
      build.onResolve(
        { filter: /(?:^|\/)ArcGisMapService\.js$/ },
        async (args) => {
          if (args.pluginData?.resolvingArcGis) return;
          const resolved = await build.resolve(args.path, {
            importer: args.importer,
            namespace: args.namespace,
            resolveDir: args.resolveDir,
            kind: args.kind,
            pluginData: { resolvingArcGis: true },
          });
          if (resolved.errors.length) return { errors: resolved.errors };
          if (resolved.path === sdkArcGis) return { path: adapter };
        },
      );
    },
  };
}
