import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig, type Plugin, type ProxyOptions } from "vite";

export const localDevelopmentActor = "wang-yang";
const localActorCookieName = "cofco_local_actor";
const localActorPattern = /^[A-Za-z0-9._:@-]{1,120}$/u;

function actorFromCookie(cookieHeader: string | undefined): string {
  const actor = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${localActorCookieName}=`))
    ?.slice(localActorCookieName.length + 1);
  return actor && localActorPattern.test(actor)
    ? actor
    : localDevelopmentActor;
}

const localIdentitySwitchPlugin: Plugin = {
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

export const prototypeApiProxy: ProxyOptions = {
  target: "http://127.0.0.1:8090",
  changeOrigin: true,
  configure(proxy) {
    proxy.on("proxyReq", (proxyRequest, request) => {
      proxyRequest.removeHeader("x-actor");
      proxyRequest.setHeader("X-Actor", actorFromCookie(request.headers.cookie));
    });
  },
};

export const prototypeOverviewProxy: ProxyOptions = {
  target: "http://127.0.0.1:63200",
  changeOrigin: true,
  ws: true,
};

export const prototypeOverviewAssetProxy: ProxyOptions = {
  target: "http://127.0.0.1:63200",
  changeOrigin: true,
  rewrite: (path) =>
    path.replace(/^\/overview\//u, "/overview-monitoring/overview/"),
};

export default defineConfig({
  plugins: [react(), localIdentitySwitchPlugin],
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
      "/overview-monitoring": prototypeOverviewProxy,
      "^/overview/": prototypeOverviewAssetProxy,
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
