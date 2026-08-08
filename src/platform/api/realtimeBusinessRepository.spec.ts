import { describe, expect, it, vi } from "vitest";
import type { RealtimeApiClient } from "./realtimeApiClient";
import { createRealtimeBusinessRepository } from "./realtimeBusinessRepository";

function client() {
  const get = vi.fn((path: string) => {
    if (path.endsWith("/products"))
      return Promise.resolve([{ code: "CORN", name: "玉米" }]);
    if (path.endsWith("/business-periods")) return Promise.resolve([]);
    if (path.endsWith("/regions"))
      return Promise.resolve([
        {
          code: "230200",
          name: "齐齐哈尔市",
          parentCode: null,
          level: "PREFECTURE",
        },
      ]);
    if (path.endsWith("/work-items"))
      return Promise.resolve({
        items: [],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 0,
        totalPages: 0,
      });
    if (
      path.includes("/production-records") ||
      path.includes("/market-records")
    ) {
      return Promise.resolve(
        path.endsWith("records")
          ? {
              items: [],
              pageNumber: 0,
              pageSize: 20,
              totalElements: 0,
              totalPages: 0,
            }
          : { id: "1", version: 0 },
      );
    }
    throw new Error(`unexpected GET ${path}`);
  });
  const post = vi.fn(() => Promise.resolve({ id: "1", version: 0 }));
  const api = {
    get,
    post,
    put: vi.fn(() => Promise.resolve({ id: "1", version: 1 })),
    upload: vi.fn(() =>
      Promise.resolve({
        id: "1",
        domainCode: "PRODUCTION",
        statusCode: "COMPLETED",
        importedRows: 0,
        failedRows: 0,
      }),
    ),
  } as unknown as RealtimeApiClient;
  return { api, get, post };
}

describe("realtime business repository", () => {
  it("loads all master-data collections from the API", async () => {
    const { api, get } = client();
    const result = await createRealtimeBusinessRepository(api).loadMasterData();
    expect(result.products).toEqual([{ code: "CORN", name: "玉米" }]);
    expect(result.periods).toEqual([]);
    expect(result.regions[0]?.code).toBe("230200");
    expect(get).toHaveBeenCalledTimes(3);
  });

  it("always sends the pending scope and supports real filters", async () => {
    const { api, get } = client();
    await createRealtimeBusinessRepository(api).listWorkItems({
      productCode: "CORN",
      domain: "PRODUCTION",
    });
    expect(get).toHaveBeenCalledWith(
      "/api/v1/work-items",
      expect.objectContaining({
        scope: "PENDING",
        productCode: "CORN",
        domain: "PRODUCTION",
      }),
    );
  });

  it("uses optimistic-lock versions for workflow transitions", async () => {
    const { api, post } = client();
    const repository = createRealtimeBusinessRepository(api);
    await repository.transitionProduction("production/1", "submit", 4);
    await repository.transitionMarket("market/1", "return", 6, "缺少依据");
    expect(post).toHaveBeenNthCalledWith(
      1,
      "/api/v1/production-records/production%2F1/submit",
      { version: 4 },
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      "/api/v1/market-records/market%2F1/return",
      { version: 6, reason: "缺少依据" },
    );
  });

  it("lists and reads persisted production and market records", async () => {
    const { api, get } = client();
    const repository = createRealtimeBusinessRepository(api);

    await repository.listProduction({
      productCode: "CORN",
      page: 1,
      pageSize: 50,
    });
    await repository.getProduction("production/1");
    await repository.listMarket({
      productCode: "SOYBEAN",
      page: 2,
      pageSize: 20,
    });
    await repository.getMarket("market/1");

    expect(get).toHaveBeenNthCalledWith(1, "/api/v1/production-records", {
      productCode: "CORN",
      pageKind: "MONITORING",
      pageNumber: 1,
      pageSize: 50,
    });
    expect(get).toHaveBeenNthCalledWith(
      2,
      "/api/v1/production-records/production%2F1",
    );
    expect(get).toHaveBeenNthCalledWith(3, "/api/v1/market-records", {
      productCode: "SOYBEAN",
      pageKind: "MONITORING",
      pageNumber: 2,
      pageSize: 20,
    });
    expect(get).toHaveBeenNthCalledWith(4, "/api/v1/market-records/market%2F1");
  });
});
