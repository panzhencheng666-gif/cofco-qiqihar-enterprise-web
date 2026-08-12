import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import type { Plugin, ProxyOptions } from "vite";

const e2eApiTarget = process.env["E2E_API_TARGET"];
export const localAcceptanceActor = "wang-yang";
const localActorCookieName = "cofco_local_actor";
const localActorPattern = /^[A-Za-z0-9._:@-]{1,120}$/u;
const overviewAuditContractVersion = "overview-audit-v2";
const overviewAuditFields = [
  "formula",
  "sourceRelation",
  "dataCutoff",
  "coverageScope",
  "coverageStatus",
  "calculationVersion",
] as const;

export function localLoopbackProxyTarget(
  value: string | undefined,
  fallback: string,
) {
  if (value === undefined || value.trim() === "") return fallback;
  const target = new URL(value);
  if (
    target.protocol !== "http:" ||
    target.hostname !== "127.0.0.1" ||
    target.port === "" ||
    target.username !== "" ||
    target.password !== "" ||
    target.pathname !== "/" ||
    target.search !== "" ||
    target.hash !== ""
  ) {
    throw new Error(
      "Local acceptance proxy target must be an explicit numeric loopback HTTP origin",
    );
  }
  return target.origin;
}

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
  target: localLoopbackProxyTarget(
    process.env["COFCO_ENTERPRISE_API_PROXY_TARGET"],
    "http://127.0.0.1:8090",
  ),
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

export async function verifyLocalOverviewContract(
  fetchContract: typeof fetch = fetch,
): Promise<void> {
  if (typeof enterpriseApiProxy.target !== "string") {
    throw new Error(
      "CONTRACT_GATE_CONFIG: local enterprise API target is unavailable",
    );
  }
  const endpoint = new URL(
    "/api/v1/overview/indicators?productCode=CORN&regionCode=230200&year=2026",
    enterpriseApiProxy.target,
  );
  const response = await fetchContract(endpoint, {
    headers: { "X-Actor": localAcceptanceActor },
  });
  const traceId = response.headers.get("X-Trace-Id") ?? "missing";
  if (!response.ok) {
    throw new Error(
      `CONTRACT_GATE_UNAVAILABLE endpoint=${endpoint.pathname} status=${response.status} trace=${traceId}`,
    );
  }
  const payload: unknown = await response.json();
  const record =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : undefined;
  if (record === undefined) {
    throw new Error(
      `CONTRACT_MISMATCH endpoint=${endpoint.pathname} expected=object received=${typeof payload} trace=${traceId}`,
    );
  }
  const received = record["contractVersion"];
  if (received !== overviewAuditContractVersion) {
    throw new Error(
      `CONTRACT_MISMATCH endpoint=${endpoint.pathname} expected=${overviewAuditContractVersion} received=${diagnosticValue(received)} trace=${traceId}`,
    );
  }
  const data = record["data"];
  if (!Array.isArray(data)) {
    throw new Error(
      `CONTRACT_MISMATCH endpoint=${endpoint.pathname} expected=data[] received=${typeof data} trace=${traceId}`,
    );
  }
  data.forEach((indicator, index) => {
    const missing = overviewAuditFields.filter(
      (field) =>
        typeof indicator !== "object" ||
        indicator === null ||
        !Object.prototype.hasOwnProperty.call(indicator, field),
    );
    if (missing.length > 0) {
      throw new Error(
        `CONTRACT_MISMATCH endpoint=${endpoint.pathname} indicator=${index} missing=${missing.join(",")} trace=${traceId}`,
      );
    }
  });
}

function diagnosticValue(value: unknown): string {
  if (value === undefined || value === null) return "missing";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (typeof value === "bigint") return value.toString();
  try {
    return JSON.stringify(value) ?? typeof value;
  } catch {
    return typeof value;
  }
}

export const localAcceptanceContractGatePlugin: Plugin = {
  name: "cofco-local-overview-contract-gate",
  async configureServer() {
    if (process.env["VITEST"] === "true") return;
    await verifyLocalOverviewContract();
  },
};

export const overviewRendererProxy: ProxyOptions = {
  target: localLoopbackProxyTarget(
    process.env["COFCO_OVERVIEW_RENDERER_PROXY_TARGET"],
    "http://127.0.0.1:63200",
  ),
  changeOrigin: true,
  ws: true,
};

export const overviewAssetProxy: ProxyOptions = {
  target: localLoopbackProxyTarget(
    process.env["COFCO_OVERVIEW_RENDERER_PROXY_TARGET"],
    "http://127.0.0.1:63200",
  ),
  changeOrigin: true,
  rewrite: (path) =>
    path.replace(/^\/overview\//u, "/overview-monitoring/overview/"),
};

export default defineConfig({
  plugins: [
    localAcceptanceContractGatePlugin,
    react(),
    canonicalEnterpriseEntryPlugin,
    localIdentitySwitchPlugin,
  ],
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
      "scripts/stage-seven-core.spec.mjs",
      "scripts/stage-seven-load.spec.mjs",
      "scripts/stage-seven-local-runtime.spec.mjs",
      "scripts/stage-seven-preproduction-runtime.spec.mjs",
      "scripts/verify-runtime.spec.mjs",
    ],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
