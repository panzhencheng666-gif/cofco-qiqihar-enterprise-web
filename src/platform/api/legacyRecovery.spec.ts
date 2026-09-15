import { expect, it, vi } from "vitest";
import { createRealtimeBusinessRepository } from "./realtimeBusinessRepository";
import type { RealtimeApiClient } from "./realtimeApiClient";
it.each(["market", "production", "logistics"] as const)(
  "preserves recovery and task scope for %s",
  async (domain) => {
    const get = vi.fn().mockResolvedValue({ items: [] });
    const api = createRealtimeBusinessRepository({
      get,
    } as unknown as RealtimeApiClient);
    const input = {
      productCode: "CORN",
      recovery: true,
      scope: "MY_TASKS" as const,
      filters: { status: "PENDING_REVIEW" },
    };
    await (domain === "market"
      ? api.listMarket(input)
      : domain === "production"
        ? api.listProduction(input)
        : api.listLogistics(input));
    expect(get).toHaveBeenCalledWith(
      `/api/v1/${domain}-records`,
      expect.objectContaining({
        recovery: "true",
        scope: "MY_TASKS",
        "filter.status": "PENDING_REVIEW",
      }),
    );
    await api.getValidationPreview!(domain, "old/id");
    expect(get).toHaveBeenLastCalledWith(
      `/api/v1/${domain}-records/old%2Fid/validation-preview`,
    );
  },
);
