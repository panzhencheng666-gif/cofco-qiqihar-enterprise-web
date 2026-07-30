import { resolveQueueViewState } from "./view-state";
import { describe, expect, it } from "vitest";

describe("resolveQueueViewState", () => {
  it("keeps loading, service failure, empty, and ready states distinct", () => {
    expect(
      resolveQueueViewState({ isLoading: true, isError: false, itemCount: 0 }),
    ).toBe("loading");
    expect(
      resolveQueueViewState({ isLoading: false, isError: true, itemCount: 0 }),
    ).toBe("error");
    expect(
      resolveQueueViewState({ isLoading: false, isError: false, itemCount: 0 }),
    ).toBe("empty");
    expect(
      resolveQueueViewState({ isLoading: false, isError: false, itemCount: 2 }),
    ).toBe("ready");
  });
});
