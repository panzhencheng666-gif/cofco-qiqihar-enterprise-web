module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "shared-has-no-upward-dependencies",
      severity: "error",
      from: { path: "^src/shared" },
      to: { path: "^src/(app|pages|workflows|domains|platform)" },
    },
    {
      name: "domains-are-framework-independent",
      severity: "error",
      from: { path: "^src/domains" },
      to: { path: "^src/(app|pages|workflows|platform)" },
    },
    {
      name: "workflows-do-not-depend-on-adapters-or-pages",
      severity: "error",
      from: { path: "^src/workflows" },
      to: { path: "^src/(app|pages|platform)" },
    },
    {
      name: "platform-adapters-do-not-depend-on-composition-or-pages",
      severity: "error",
      from: { path: "^src/platform" },
      to: { path: "^src/(app|pages)" },
    },
    {
      name: "procomponents-only-through-shared-ui",
      severity: "error",
      from: { path: "^src/(?!shared/ui(?:/|$)).*" },
      to: {
        path: "^node_modules/@ant-design/(?:pro-components|pro-[^/]+)",
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.app.json" },
    enhancedResolveOptions: { exportsFields: ["exports"] },
  },
};
