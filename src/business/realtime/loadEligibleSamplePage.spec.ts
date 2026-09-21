import { describe, expect, it, vi } from "vitest";
import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";
import { loadEligibleSamplePage } from "./loadEligibleSamplePage";
import { taskRepository } from "../taskRepository";

describe("on-demand formal sample pages", () => {
  it("requests exactly the displayed page without fetching the full list or future pages", async () => {
    const page = {
      items: [],
      pageNumber: 0,
      pageSize: 20,
      totalElements: 200,
      totalPages: 10,
    };
    const listEligibleFormalSamplesPage = vi.fn().mockResolvedValue(page);
    const listEligibleFormalSamples = vi.fn();
    const repository = {
      listEligibleFormalSamplesPage,
      listEligibleFormalSamples,
    } as unknown as RealtimeBusinessRepository;
    const input = {
      domain: "PRODUCTION" as const,
      productCode: "CORN",
      year: 2026,
      observedAt: "2026-09-01T00:00:00Z",
    };
    expect(await loadEligibleSamplePage(repository, input, 0, 20)).toBe(page);
    expect(listEligibleFormalSamplesPage).toHaveBeenCalledExactlyOnceWith({
      ...input,
      pageNumber: 0,
      pageSize: 20,
    });
    expect(listEligibleFormalSamples).not.toHaveBeenCalled();
    await loadEligibleSamplePage(taskRepository(repository), input, 1, 20);
    expect(listEligibleFormalSamplesPage).toHaveBeenLastCalledWith({
      ...input,
      pageNumber: 1,
      pageSize: 20,
      scope: "MY_TASKS",
    });
  });
});
