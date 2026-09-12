import { describe, expect, it, vi } from "vitest";
import type { RealtimeApiClient } from "./realtimeApiClient";
import { createRealtimeBusinessRepository } from "./realtimeBusinessRepository";
describe("historical sample API", () => {
  it("sends the exact dedicated history query without manufacturing data", async () => {
    const data = {
      items: [],
      pageNumber: 2,
      pageSize: 20,
      totalElements: 0,
      totalPages: 0,
    };
    const get = vi.fn().mockResolvedValue(data);
    const repository = createRealtimeBusinessRepository({
      get,
    } as unknown as RealtimeApiClient);
    const input = {
      domain: "LOGISTICS" as const,
      productCode: "RICE",
      year: 2025,
      regionCode: "230221100",
      keyword: "粮食",
      pageNumber: 2,
      pageSize: 20,
    };
    expect(await repository.listHistoricalFormalSamples!(input)).toBe(data);
    expect(get).toHaveBeenCalledWith(
      "/api/v1/formal-sample-points/history",
      input,
    );
  });
});
