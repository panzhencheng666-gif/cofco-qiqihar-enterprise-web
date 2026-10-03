import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const sdkIon = require.resolve("@cesium/engine/Source/Core/Ion.js");
const adapter = path.join(root, "src/disabled-ion.js");

// Resolve normally, then replace only this installed SDK module. Other Ion-named
// files and all immutable upstream files retain their normal module identities.
export function disabledIonPlugin() {
  return {
    name: "free-edition-disabled-ion",
    setup(build) {
      build.onResolve({ filter: /(?:^|\/)Ion\.js$/ }, async (args) => {
        if (args.pluginData?.resolvingIon) return;
        const resolved = await build.resolve(args.path, {
          importer: args.importer,
          namespace: args.namespace,
          resolveDir: args.resolveDir,
          kind: args.kind,
          pluginData: { resolvingIon: true },
        });
        if (resolved.errors.length) return { errors: resolved.errors };
        if (resolved.path === sdkIon) return { path: adapter };
      });
    },
  };
}
