import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import type { Plugin, ProxyOptions } from "vite";

const e2eApiTarget = process.env["E2E_API_TARGET"];
export const localAcceptanceActor = "wang-yang";
const localActorCookieName = "cofco_local_actor";
const localActorPattern = /^[A-Za-z0-9._:@-]{1,120}$/u;

function rejectRemovedEntry(
  request: { url?: string },
  response: {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(): void;
  },
  next: () => void,
) {
  const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  if (pathname !== "/prototype.html") {
    next();
    return;
  }
  response.statusCode = 404;
  response.setHeader("Cache-Control", "no-store");
  response.end();
}

export const canonicalEnterpriseEntryPlugin: Plugin = {
  name: "cofco-canonical-enterprise-entry",
  configureServer(server) {
    server.middlewares.use(rejectRemovedEntry);
  },
  configurePreviewServer(server) {
    server.middlewares.use(rejectRemovedEntry);
  },
};

function actorFromCookie(cookieHeader: string | undefined): string {
  const actor = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${localActorCookieName}=`))
    ?.slice(localActorCookieName.length + 1);
  return actor && localActorPattern.test(actor) ? actor : localAcceptanceActor;
}

export const localIdentitySwitchPlugin: Plugin = {
  name: "cofco-local-identity-switch",
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const actor = url.searchParams.get("__local_actor");
      if (actor === null) {
        next();
        return;
      }
      if (!localActorPattern.test(actor)) {
        response.statusCode = 400;
        response.end();
        return;
      }
      url.searchParams.delete("__local_actor");
      response.statusCode = 302;
      response.setHeader(
        "Set-Cookie",
        `${localActorCookieName}=${actor}; HttpOnly; SameSite=Strict; Path=/`,
      );
      response.setHeader("Location", `${url.pathname}${url.search}`);
      response.end();
    });
  },
};

export const enterpriseApiProxy: ProxyOptions = {
  target: "http://127.0.0.1:8090",
  changeOrigin: true,
  xfwd: true,
  configure(proxy) {
    proxy.on("proxyReq", (proxyRequest, request) => {
      proxyRequest.removeHeader("x-actor");
      proxyRequest.setHeader(
        "X-Actor",
        actorFromCookie(request.headers.cookie),
      );
    });
  },
};

export const overviewRendererProxy: ProxyOptions = {
  target: "http://127.0.0.1:63200",
  changeOrigin: true,
  ws: true,
};

export const overviewAssetProxy: ProxyOptions = {
  target: "http://127.0.0.1:63200",
  changeOrigin: true,
  rewrite: (path) =>
    path.replace(/^\/overview\//u, "/overview-monitoring/overview/"),
};

export default defineConfig({
  plugins: [react(), canonicalEnterpriseEntryPlugin, localIdentitySwitchPlugin],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
  build: {
    sourcemap: true,
    manifest: true,
    chunkSizeWarningLimit: 900,
  },
  server: {
    host: "127.0.0.1",
    port: 63182,
    strictPort: true,
    allowedHosts: ["all"],
    proxy: {
      "/api": enterpriseApiProxy,
      "/oauth2": enterpriseApiProxy,
      "/login/oauth2": enterpriseApiProxy,
      "/logout/connect/back-channel": enterpriseApiProxy,
      "/overview-monitoring": overviewRendererProxy,
      "^/overview/": overviewAssetProxy,
    },
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
    exclude: [
      ...configDefaults.exclude,
      "e2e/**",
      ".worktrees/**",
      "scripts/run-stage-three-idp-supplement.spec.mjs",
      "scripts/preproduction-assets.spec.mjs",
      "scripts/preproduction-config.spec.mjs",
      "scripts/preproduction-runtime.spec.mjs",
      "scripts/preproduction-transaction.spec.mjs",
      "scripts/preproduction-operations.spec.mjs",
      "scripts/preproduction-bundle.spec.mjs",
      "scripts/preproduction-nginx-tool.spec.mjs",
      "scripts/preproduction-nginx.spec.mjs",
    ],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
