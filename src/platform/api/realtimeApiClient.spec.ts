import { describe, expect, it, vi } from "vitest";
import { RealtimeApiError, createRealtimeApiClient } from "./realtimeApiClient";

describe("realtime API client", () => {
  it("unwraps the backend data envelope and serializes query parameters", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: { items: [1] } }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "X-Trace-Id": "trace-1",
        },
      }),
    );
    const client = createRealtimeApiClient({
      baseUrl: "http://api.example.test/",
      fetcher,
    });

    await expect(
      client.get("/api/v1/work-items", {
        scope: "PENDING",
        page: 0,
        empty: "",
      }),
    ).resolves.toEqual({ items: [1] });
    expect(fetcher).toHaveBeenCalledWith(
      "http://api.example.test/api/v1/work-items?scope=PENDING&page=0",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
  });

  it("never sends a browser-asserted actor identity", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }),
      );
    const client = createRealtimeApiClient({
      baseUrl: "",
      fetcher,
    });

    await client.post("/api/v1/production-records", { sample: true });

    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("/api/v1/production-records");
    expect(new Headers(init?.headers).has("X-Actor")).toBe(false);
  });

  it("strips an actor identity from upload extension headers", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }),
      );
    const client = createRealtimeApiClient({ baseUrl: "", fetcher });

    await client.upload("/api/v1/imports/production", new FormData(), {
      "X-Actor": "browser-asserted-user",
      "Idempotency-Key": "request-1",
    });

    const [, init] = fetcher.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(headers.has("X-Actor")).toBe(false);
    expect(headers.get("Idempotency-Key")).toBe("request-1");
  });

  it("downloads a binary XLSX response with credentialed access", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([80, 75, 3, 4]), {
        status: 200,
        headers: {
          "content-type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      }),
    );
    const client = createRealtimeApiClient({ baseUrl: "", fetcher });

    const result = await client.download(
      "/api/v1/imports/production/template",
      {
        format: "xlsx",
        productCode: "CORN",
        objectTypeCode: "FARMER",
      },
    );
    expect(result.size).toBe(4);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "/api/v1/imports/production/template?format=xlsx&productCode=CORN&objectTypeCode=FARMER",
    );
  });

  it("normalizes backend validation errors and retains trace ids", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "INVALID_PRODUCTION_RECORD",
          message: "缺少地区",
        }),
        {
          status: 400,
          headers: { "X-Trace-Id": "trace-2" },
        },
      ),
    );
    const client = createRealtimeApiClient({ baseUrl: "", fetcher });

    await expect(
      client.post("/api/v1/production-records", {}),
    ).rejects.toMatchObject({
      code: "INVALID_PRODUCTION_RECORD",
      status: 400,
      traceId: "trace-2",
      message: "缺少地区",
    });
  });

  it("fails closed when the response has no data envelope", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const client = createRealtimeApiClient({ baseUrl: "", fetcher });

    const result = client.get("/api/v1/overview/dashboard");
    await expect(result).rejects.toBeInstanceOf(RealtimeApiError);
    await expect(result).rejects.toMatchObject({
      code: "INVALID_API_RESPONSE",
      status: 200,
    });
  });
});
