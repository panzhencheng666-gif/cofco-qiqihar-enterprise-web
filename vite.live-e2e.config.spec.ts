import { describe, expect, it, vi } from "vitest";
import {
  createLiveE2eConfig,
  createLiveE2eProxy,
} from "./vite.live-e2e.config";

describe("live E2E preview identity boundary", () => {
  it("removes browser identity and injects one fixed employee", () => {
    let proxyRequestHandler:
      | ((request: {
          removeHeader(name: string): void;
          setHeader(name: string, value: string): void;
        }) => void)
      | undefined;
    const proxy = {
      on: vi.fn((event: string, handler: typeof proxyRequestHandler) => {
        if (event === "proxyReq") proxyRequestHandler = handler;
      }),
    };

    const proxyOptions = createLiveE2eProxy(
      "e2e-operator-one",
      "http://127.0.0.1:63183",
    );
    proxyOptions.configure?.(proxy as never, {});
    const request = {
      removeHeader: vi.fn(),
      setHeader: vi.fn(),
    };
    proxyRequestHandler?.(request);

    expect(request.removeHeader).toHaveBeenCalledWith("x-actor");
    expect(request.setHeader).toHaveBeenCalledWith(
      "X-Actor",
      "e2e-operator-one",
    );
  });

  it("binds preview to numeric loopback and rejects non-loopback APIs", () => {
    expect(
      createLiveE2eConfig({
        LIVE_E2E_ACTOR: "e2e-reviewer",
        LIVE_E2E_API_TARGET: "http://127.0.0.1:63183",
      }).preview,
    ).toMatchObject({ host: "127.0.0.1", strictPort: true });

    expect(() =>
      createLiveE2eConfig({
        LIVE_E2E_ACTOR: "e2e-reviewer",
        LIVE_E2E_API_TARGET: "http://0.0.0.0:63183",
      }),
    ).toThrow(/numeric loopback/u);
  });

  it("fails closed when the fixed employee is missing", () => {
    expect(() =>
      createLiveE2eConfig({
        LIVE_E2E_API_TARGET: "http://127.0.0.1:63183",
      }),
    ).toThrow(/LIVE_E2E_ACTOR/u);
  });
});
