import path from "node:path";
export function analystRegionsPlugin(root) {
  return {
    name: "analyst-regions-only",
    setup(build) {
      build.onResolve({ filter: /naturalEarthRegions\.js$/ }, (args) => {
        if (
          args.importer !== path.join(root, "vendor/src/data/analystEngine.js")
        )
          throw new Error("Unapproved region import");
        return { path: path.join(root, "src/analyst-regions.js") };
      });
    },
  };
}
