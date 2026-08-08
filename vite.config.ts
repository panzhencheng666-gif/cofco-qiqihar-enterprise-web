import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const e2eApiTarget = process.env["E2E_API_TARGET"];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    sourcemap: true,
    manifest: true,
    chunkSizeWarningLimit: 900,
  },
  ...(e2eApiTarget
    ? {
        preview: {
          proxy: {
            "/api": {
              target: e2eApiTarget,
              changeOrigin: true,
            },
          },
        },
      }
    : {}),
  test: {
    environment: "jsdom",
    setupFiles: ["./src/vitest.setup.ts"],
    exclude: [...configDefaults.exclude, "e2e/**", ".worktrees/**"],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
