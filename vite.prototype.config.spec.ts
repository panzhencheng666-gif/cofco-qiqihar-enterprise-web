import { describe, expect, it, vi } from "vitest";
import {
  localDevelopmentActor,
  prototypeApiProxy,
} from "./vite.prototype.config";

describe("prototype API development proxy", () => {
  it("forces the loopback development actor after removing browser input", () => {
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

    expect(prototypeApiProxy.configure).toBeTypeOf("function");
    prototypeApiProxy.configure?.(proxy as never, {});
    const request = {
      removeHeader: vi.fn(),
      setHeader: vi.fn(),
    };
    proxyRequestHandler?.(request);

    expect(prototypeApiProxy.target).toBe("http://127.0.0.1:8090");
    expect(request.removeHeader).toHaveBeenCalledWith("x-actor");
    expect(request.setHeader).toHaveBeenCalledWith(
      "X-Actor",
      localDevelopmentActor,
    );
  });
});
