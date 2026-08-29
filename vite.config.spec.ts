import { describe, expect, it, vi } from "vitest";
import {
  default as enterpriseConfig,
  canonicalEnterpriseEntryPlugin,
  enterpriseApiProxy,
  localAcceptanceContractGatePlugin,
  localAcceptanceActor,
  localIdentitySwitchPlugin,
  localLoopbackProxyTarget,
  verifyLocalOverviewContract,
} from "./vite.config";

describe("enterprise local acceptance API proxy", () => {
  it("allows only explicit numeric loopback origins for an isolated acceptance stack", () => {
    expect(
      localLoopbackProxyTarget(
        "http://127.0.0.1:18090",
        "http://127.0.0.1:8090",
      ),
    ).toBe("http://127.0.0.1:18090");
    expect(() =>
      localLoopbackProxyTarget(
        "http://localhost:18090",
        "http://127.0.0.1:8090",
      ),
    ).toThrow(/numeric loopback/);
    expect(() =>
      localLoopbackProxyTarget(
        "http://127.0.0.1:18090/path",
        "http://127.0.0.1:8090",
      ),
    ).toThrow(/numeric loopback/);
  });

  it("rejects the removed alternate HTML entry instead of serving an SPA fallback", () => {
    expect(canonicalEnterpriseEntryPlugin.name).toBe(
      "cofco-canonical-enterprise-entry",
    );

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
    const register = (server: {
      middlewares: { use(handler: NonNullable<typeof middleware>): void };
    }) => {
      middleware = undefined;
      server.middlewares.use = (handler) => {
        middleware = handler;
      };
    };
    const server = { middlewares: { use: vi.fn() } };
    register(server);
    const configureServer = canonicalEnterpriseEntryPlugin.configureServer as
      ((value: typeof server) => void) | undefined;
    configureServer?.(server);
    const response = {
      statusCode: 200,
      setHeader: vi.fn(),
      end: vi.fn(),
    };
    const next = vi.fn();

    middleware?.({ url: "/prototype.html" }, response, next);

    expect(response.statusCode).toBe(404);
    expect(response.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "no-store",
    );
    expect(response.end).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
  });

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

    expect(enterpriseApiProxy.configure).toBeTypeOf("function");
    enterpriseApiProxy.configure?.(proxy as never, {});
    const request = {
      removeHeader: vi.fn(),
      setHeader: vi.fn(),
    };
    proxyRequestHandler?.(request, { headers: {} });

    expect(enterpriseApiProxy.target).toBe("http://127.0.0.1:8090");
    expect(request.removeHeader).toHaveBeenCalledWith("x-actor");
    expect(request.setHeader).toHaveBeenCalledWith(
      "X-Actor",
      localAcceptanceActor,
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

    enterpriseApiProxy.configure?.(proxy as never, {});
    proxyRequestHandler?.(request, {
      headers: { cookie: "cofco_local_actor=acceptance-reviewer-20260811" },
    });

    expect(request.removeHeader).toHaveBeenCalledWith("x-actor");
    expect(request.setHeader).toHaveBeenCalledWith(
      "X-Actor",
      "acceptance-reviewer-20260811",
    );
  });

  it("forwards a logged-out browser as unauthenticated instead of as a disabled employee", () => {
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

    enterpriseApiProxy.configure?.(proxy as never, {});
    proxyRequestHandler?.(request, {
      headers: { cookie: "cofco_local_actor=logged-out" },
    });

    expect(request.removeHeader).toHaveBeenCalledWith("x-actor");
    expect(request.setHeader).not.toHaveBeenCalled();
  });

  it("issues an HttpOnly identity cookie from the loopback development entry", () => {
    expect(localIdentitySwitchPlugin.name).toBe("cofco-local-identity-switch");

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
    const configureServer = localIdentitySwitchPlugin.configureServer as
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

  it("provides local logout and login transitions in both dev and managed preview", () => {
    const configurations = [
      localIdentitySwitchPlugin.configureServer,
      localIdentitySwitchPlugin.configurePreviewServer,
    ];

    configurations.forEach((configure) => {
      let middleware:
        | ((
            request: { method?: string; url?: string },
            response: {
              statusCode: number;
              setHeader(name: string, value: string): void;
              end(): void;
            },
            next: () => void,
          ) => void)
        | undefined;
      const server = {
        middlewares: {
          use: (handler: NonNullable<typeof middleware>) => {
            middleware = handler;
          },
        },
      };
      (configure as ((value: typeof server) => void) | undefined)?.(server);

      const logoutResponse = {
        statusCode: 200,
        setHeader: vi.fn(),
        end: vi.fn(),
      };
      middleware?.(
        { method: "POST", url: "/api/v1/session/logout" },
        logoutResponse,
        vi.fn(),
      );
      expect(logoutResponse.statusCode).toBe(303);
      expect(logoutResponse.setHeader).toHaveBeenCalledWith(
        "Set-Cookie",
        "cofco_local_actor=logged-out; HttpOnly; SameSite=Strict; Path=/",
      );
      expect(logoutResponse.setHeader).toHaveBeenCalledWith("Location", "/");

      const loginResponse = {
        statusCode: 200,
        setHeader: vi.fn(),
        end: vi.fn(),
      };
      middleware?.(
        { method: "GET", url: "/api/v1/session/login" },
        loginResponse,
        vi.fn(),
      );
      expect(loginResponse.statusCode).toBe(302);
      expect(loginResponse.setHeader).toHaveBeenCalledWith(
        "Set-Cookie",
        `cofco_local_actor=${localAcceptanceActor}; HttpOnly; SameSite=Strict; Path=/`,
      );
      expect(loginResponse.setHeader).toHaveBeenCalledWith("Location", "/");
    });
  });

  it("stops local acceptance when the backend still serves the legacy overview contract", async () => {
    const fetchContract = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: [
              {
                code: "PRODUCTION_CULTIVATED_AREA",
                name: "核定播种面积",
                sourceCount: 1,
                sourceDomain: "PRODUCTION",
                sourcePath: "/api/v1/production-records",
                unitCode: "亩",
                value: "10",
              },
            ],
          }),
          { headers: { "X-Trace-Id": "trace-def-101" }, status: 200 },
        ),
      ),
    );

    await expect(verifyLocalOverviewContract(fetchContract)).rejects.toThrow(
      /CONTRACT_MISMATCH.*trace-def-101/u,
    );
    expect(enterpriseConfig.plugins).toEqual(
      expect.arrayContaining([localAcceptanceContractGatePlugin]),
    );
  });
});

describe("enterprise overview same-origin gateway", () => {
  it("routes the browser-visible overview prefix to the internal map service", () => {
    const overviewProxy =
      enterpriseConfig.server?.proxy?.["/overview-monitoring"];

    expect(overviewProxy).toMatchObject({
      target: "http://127.0.0.1:63200",
      changeOrigin: true,
      ws: true,
    });
    expect(enterpriseConfig.server?.proxy).toMatchObject({
      "/overview-monitoring": overviewProxy,
    });
  });

  it("serves root-absolute map assets through the same internal gateway", () => {
    const assetProxy = enterpriseConfig.server?.proxy?.["^/overview/"];

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

describe("native Node gate isolation", () => {
  it("keeps every Stage 5 node:test suite out of Vitest collection", () => {
    expect(enterpriseConfig.test?.exclude).toEqual(
      expect.arrayContaining([
        "scripts/preproduction-assets.spec.mjs",
        "scripts/preproduction-config.spec.mjs",
        "scripts/preproduction-runtime.spec.mjs",
        "scripts/preproduction-transaction.spec.mjs",
      ]),
    );
  });

  it("keeps the local runtime publisher node:test suites out of Vitest collection", () => {
    expect(enterpriseConfig.test?.exclude).toEqual(
      expect.arrayContaining([
        "scripts/local-runtime-publish.spec.mjs",
        "scripts/local-runtime-smoke.spec.mjs",
      ]),
    );
  });
});
