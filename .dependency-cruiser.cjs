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
      name: "pages-do-not-depend-on-platform-adapters",
      severity: "error",
      from: { path: "^src/pages" },
      to: { path: "^src/platform" },
    },
    {
      name: "pages-do-not-use-legacy-shared-ui",
      severity: "error",
      from: { path: "^src/pages" },
      to: { path: "^src/shared/ui" },
    },
    {
      name: "third-party-enterprise-ui-only-through-adapter-or-composition",
      severity: "error",
      from: {
        path: "^src/(?!shared/enterprise-ui(?:/|$)|app/(?:providers|theme|error)(?:/|$)).*",
      },
      to: {
        path: "^node_modules/(?:antd|@ant-design/(?:icons|pro-components|pro-[^/]+))",
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.app.json" },
    enhancedResolveOptions: { exportsFields: ["exports"] },
  },
};
