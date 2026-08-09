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
  actor: string,
  target: string,
): ProxyOptions {
  const fixedActor = actor.trim();
  if (!fixedActor) throw new Error("LIVE_E2E_ACTOR is required for live E2E");
  const loopbackTarget = requireNumericLoopbackTarget(target).origin;

  return {
    target: loopbackTarget,
    changeOrigin: true,
    configure(proxy) {
      proxy.on("proxyReq", (proxyRequest) => {
        proxyRequest.removeHeader("x-actor");
        proxyRequest.setHeader("X-Actor", fixedActor);
      });
    },
  };
}

export function createLiveE2eConfig(
  environment: LiveE2eEnvironment,
): UserConfig {
  const actor = required(environment, "LIVE_E2E_ACTOR");
  const target = required(environment, "LIVE_E2E_API_TARGET");

  return {
    preview: {
      host: "127.0.0.1",
      strictPort: true,
      proxy: {
        "/api": createLiveE2eProxy(actor, target),
      },
    },
  };
}

export default defineConfig(() => createLiveE2eConfig(process.env));
