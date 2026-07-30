import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "pro-components",
              test: /node_modules[\\/]@ant-design[\\/]pro-/,
              priority: 30,
              maxSize: 1800 * 1024,
              entriesAware: true,
              entriesAwareMergeThreshold: 50 * 1024,
              includeDependenciesRecursively: false,
            },
            {
              name: "ant-design",
              test: /node_modules[\\/](?:antd|rc-|@rc-component|@ant-design[\\/](?:icons|icons-svg|cssinjs|colors|fast-color|cssinjs-utils))/,
              priority: 20,
              maxSize: 1800 * 1024,
              entriesAware: true,
              entriesAwareMergeThreshold: 50 * 1024,
              includeDependenciesRecursively: false,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/vitest.setup.ts"],
    exclude: [...configDefaults.exclude, "e2e/**"],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
