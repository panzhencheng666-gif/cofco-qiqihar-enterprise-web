import { describe, expect, it, vi } from "vitest";
import prototypeConfig from "./vite.prototype.config";
import {
  localDevelopmentActor,
  prototypeApiProxy,
} from "./vite.prototype.config";

describe("prototype API development proxy", () => {
  it("forces the loopback development actor after removing browser input", () => {
    let proxyRequestHandler:
      | ((
          request: {
            removeHeader(name: string): void;
            setHeader(name: string, value: string): void;
          },
          incoming?: { headers: { cookie?: string } },
        ) => void)
      | undefined;
    const proxy = {
      on: vi.fn((event: string, handler: typeof proxyRequestHandler) => {
        if (event === "proxyReq") proxyRequestHandler = handler;
      }),
    };

    expect(prototypeApiProxy.configure).toBeTypeOf("function");
    prototypeApiProxy.configure?.(proxy as never, {});
    const request = {
      removeHeader: vi.fn(),
      setHeader: vi.fn(),
    };
    proxyRequestHandler?.(request, { headers: {} });

    expect(prototypeApiProxy.target).toBe("http://127.0.0.1:8090");
    expect(request.removeHeader).toHaveBeenCalledWith("x-actor");
    expect(request.setHeader).toHaveBeenCalledWith(
      "X-Actor",
      localDevelopmentActor,
    );
  });

  it("uses the server-issued local identity cookie without trusting X-Actor", () => {
    let proxyRequestHandler:
      | ((
          request: {
            removeHeader(name: string): void;
            setHeader(name: string, value: string): void;
          },
          incoming?: { headers: { cookie?: string } },
        ) => void)
      | undefined;
    const proxy = {
      on: vi.fn((event: string, handler: typeof proxyRequestHandler) => {
        if (event === "proxyReq") proxyRequestHandler = handler;
      }),
    };
    const request = {
      removeHeader: vi.fn(),
      setHeader: vi.fn(),
    };

    prototypeApiProxy.configure?.(proxy as never, {});
    proxyRequestHandler?.(request, {
      headers: { cookie: "cofco_local_actor=acceptance-reviewer-20260811" },
    });

    expect(request.removeHeader).toHaveBeenCalledWith("x-actor");
    expect(request.setHeader).toHaveBeenCalledWith(
      "X-Actor",
      "acceptance-reviewer-20260811",
    );
  });

  it("issues an HttpOnly identity cookie from the loopback development entry", () => {
    const plugins = Array.isArray(prototypeConfig.plugins)
      ? prototypeConfig.plugins.flat()
      : [];
    const identityPlugin = plugins.find(
      (plugin) => plugin && plugin.name === "cofco-local-identity-switch",
    );
    expect(identityPlugin).toBeDefined();
    if (!identityPlugin) return;

    let middleware:
      | ((
          request: { url?: string },
          response: {
            statusCode: number;
            setHeader(name: string, value: string): void;
            end(): void;
          },
          next: () => void,
        ) => void)
      | undefined;
    const configureServer = identityPlugin.configureServer as
      | ((server: {
          middlewares: {
            use(handler: NonNullable<typeof middleware>): void;
          };
        }) => void)
      | undefined;
    configureServer?.({
      middlewares: {
        use: (handler) => {
          middleware = handler;
        },
      },
    });
    const response = {
      statusCode: 200,
      setHeader: vi.fn(),
      end: vi.fn(),
    };

    middleware?.(
      { url: "/?__local_actor=acceptance-reviewer-20260811" },
      response,
      vi.fn(),
    );

    expect(response.statusCode).toBe(302);
    expect(response.setHeader).toHaveBeenCalledWith(
      "Set-Cookie",
      "cofco_local_actor=acceptance-reviewer-20260811; HttpOnly; SameSite=Strict; Path=/",
    );
    expect(response.setHeader).toHaveBeenCalledWith("Location", "/");
    expect(response.end).toHaveBeenCalledOnce();
  });
});

describe("prototype overview same-origin gateway", () => {
  it("routes the browser-visible overview prefix to the internal map service", () => {
    const overviewProxy =
      prototypeConfig.server?.proxy?.["/overview-monitoring"];

    expect(overviewProxy).toMatchObject({
      target: "http://127.0.0.1:63200",
      changeOrigin: true,
      ws: true,
    });
    expect(prototypeConfig.server?.proxy).toMatchObject({
      "/overview-monitoring": overviewProxy,
    });
  });

  it("serves root-absolute map assets through the same internal gateway", () => {
    const assetProxy = prototypeConfig.server?.proxy?.["^/overview/"];

    expect(assetProxy).toMatchObject({
      target: "http://127.0.0.1:63200",
      changeOrigin: true,
    });
    expect(
      typeof assetProxy === "object"
        ? assetProxy.rewrite?.("/overview/command-terrain-v2.webp")
        : undefined,
    ).toBe("/overview-monitoring/overview/command-terrain-v2.webp");
  });
});
