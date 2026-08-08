import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
  server: {
    // Bind to all local interfaces so the local deployment can be opened by
    // other computers on the same LAN. The browser still uses relative `/api`
    // requests, which Vite proxies to the backend on this host.
    host: "0.0.0.0",
    port: 63182,
    strictPort: true,
    allowedHosts: ["all"],
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8090",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist-prototype",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(import.meta.dirname, "prototype.html"),
    },
  },
});
