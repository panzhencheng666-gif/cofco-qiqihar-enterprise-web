import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig, type ProxyOptions } from "vite";

export const localDevelopmentActor = "wang-yang";

export const prototypeApiProxy: ProxyOptions = {
  target: "http://127.0.0.1:8090",
  changeOrigin: true,
  configure(proxy) {
    proxy.on("proxyReq", (proxyRequest) => {
      proxyRequest.removeHeader("x-actor");
      proxyRequest.setHeader("X-Actor", localDevelopmentActor);
    });
  },
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 63182,
    strictPort: true,
    allowedHosts: ["all"],
    proxy: {
      "/api": prototypeApiProxy,
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
