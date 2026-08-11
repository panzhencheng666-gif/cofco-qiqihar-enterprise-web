import { defineConfig, type ProxyOptions, type UserConfig } from "vite";

type LiveE2eEnvironment = Readonly<Record<string, string | undefined>>;

function required(environment: LiveE2eEnvironment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required for live E2E`);
  return value;
}

function requireNumericLoopbackTarget(target: string): URL {
  const url = new URL(target);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") {
    throw new Error("LIVE_E2E_API_TARGET must use HTTP numeric loopback");
  }
  return url;
}

export function createLiveE2eProxy(
  actor: string | undefined,
  target: string,
  authMode: "fixed" | "anonymous" = "fixed",
): ProxyOptions {
  const fixedActor = actor?.trim() ?? "";
  if (authMode === "fixed" && !fixedActor)
    throw new Error("LIVE_E2E_ACTOR is required for live E2E");
  const loopbackTarget = requireNumericLoopbackTarget(target).origin;

  return {
    target: loopbackTarget,
    changeOrigin: true,
    configure(proxy) {
      proxy.on("proxyReq", (proxyRequest) => {
        proxyRequest.removeHeader("x-actor");
        if (authMode === "fixed")
          proxyRequest.setHeader("X-Actor", fixedActor);
      });
    },
  };
}

export function createLiveE2eConfig(
  environment: LiveE2eEnvironment,
): UserConfig {
  const authMode = environment["LIVE_E2E_AUTH_MODE"]?.trim() || "fixed";
  if (authMode !== "fixed" && authMode !== "anonymous")
    throw new Error("LIVE_E2E_AUTH_MODE must be fixed or anonymous");
  const actor =
    authMode === "fixed"
      ? required(environment, "LIVE_E2E_ACTOR")
      : undefined;
  const target = required(environment, "LIVE_E2E_API_TARGET");

  return {
    preview: {
      host: "127.0.0.1",
      strictPort: true,
      proxy: {
        "/api": createLiveE2eProxy(actor, target, authMode),
      },
    },
  };
}

export default defineConfig(() => createLiveE2eConfig(process.env));
