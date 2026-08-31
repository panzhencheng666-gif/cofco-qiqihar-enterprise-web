import { describe, expect, it, vi } from "vitest";
import { RealtimeApiError, createRealtimeApiClient } from "./realtimeApiClient";

describe("realtime API client", () => {
  it("returns an unwrapped direct contract through getRaw", async () => {
    const payload = {
      contractVersion: "design-sample-fields-v1",
      contractDigest: `sha256:${"a".repeat(64)}`,
    };
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createRealtimeApiClient({ baseUrl: "", fetcher });

    await expect(
      client.getRaw("/api/v1/design-sample-field-definitions", {
        domainCode: "MARKET",
      }),
    ).resolves.toEqual(payload);
  });
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
      cookieSource: () => "XSRF-TOKEN=csrf-token-1",
    });

    await client.post("/api/v1/production-records", { sample: true });

    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("/api/v1/production-records");
    expect(new Headers(init?.headers).has("X-Actor")).toBe(false);
    expect(new Headers(init?.headers).get("X-XSRF-TOKEN")).toBe("csrf-token-1");
  });

  it("sends governed command headers without trusting browser identity headers", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: { jobId: "job-2" } }), {
        status: 200,
      }),
    );
    const client = createRealtimeApiClient({
      baseUrl: "",
      fetcher,
      cookieSource: () => "XSRF-TOKEN=csrf-token-2",
    });

    await client.post(
      "/api/v1/sample-point-coordinate-corrections/jobs/job-1/retry",
      undefined,
      {
        timeoutMs: 300_000,
        headers: {
          "Idempotency-Key": "retry-key-1",
          "X-Actor": "browser-asserted-user",
          Authorization: "Bearer browser-asserted-token",
        },
      },
    );

    const [, init] = fetcher.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(headers.get("Idempotency-Key")).toBe("retry-key-1");
    expect(headers.has("X-Actor")).toBe(false);
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.get("X-XSRF-TOKEN")).toBe("csrf-token-2");
  });

  it("sends version-guarded deletes and accepts an empty success response", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    const client = createRealtimeApiClient({
      baseUrl: "",
      fetcher,
      cookieSource: () => "XSRF-TOKEN=delete-token",
    });

    await expect(
      client.delete("/api/v1/design-sample-points/point-1", {
        expectedVersion: 3,
      }),
    ).resolves.toBeUndefined();

    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("/api/v1/design-sample-points/point-1?expectedVersion=3");
    expect(init?.method).toBe("DELETE");
    expect(new Headers(init?.headers).get("X-XSRF-TOKEN")).toBe("delete-token");
  });

  it("lets a governed long-running command override the ordinary request timeout", async () => {
    const fetcher = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise((resolve, reject) => {
          const responseTimer = setTimeout(
            () =>
              resolve(
                new Response(JSON.stringify({ data: { approvedCount: 401 } }), {
                  status: 200,
                }),
              ),
            40,
          );
          init?.signal?.addEventListener("abort", () => {
            clearTimeout(responseTimer);
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );
    const client = createRealtimeApiClient({
      baseUrl: "",
      fetcher,
      timeoutMs: 10,
    });

    await expect(
      client.post(
        "/api/v1/work-items/batch-approve",
        { domain: "PRODUCTION" },
        { timeoutMs: 200 },
      ),
    ).resolves.toEqual({ approvedCount: 401 });
  });

  it("strips browser identity headers and adds CSRF to uploads", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }),
      );
    const client = createRealtimeApiClient({
      baseUrl: "",
      fetcher,
      cookieSource: () => "other=value; XSRF-TOKEN=csrf%20token",
    });

    await client.upload("/api/v1/imports/production", new FormData(), {
      "X-Actor": "browser-asserted-user",
      Authorization: "Bearer browser-asserted-token",
      "Idempotency-Key": "request-1",
    });

    const [, init] = fetcher.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(headers.has("X-Actor")).toBe(false);
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.get("X-XSRF-TOKEN")).toBe("csrf token");
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
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("Accept")).toBe(
      "*/*",
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
      clientMessage: "缺少地区",
    });
  });

  it("does not expose technical backend messages as client-facing copy", () => {
    const error = new RealtimeApiError({
      code: "IMPORT_WRITE_FAILED",
      message:
        "duplicate key violates PostgreSQL constraint market_record_pkey",
      status: 500,
    });

    expect(error.clientMessage).toBeUndefined();
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
