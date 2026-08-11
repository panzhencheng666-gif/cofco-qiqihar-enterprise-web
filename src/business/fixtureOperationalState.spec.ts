import { describe, expect, it, vi } from "vitest";

import {
  createDefaultFixtureOperationalState,
  loadFixtureOperationalState,
  fixtureOperationalStateStorageKey,
  saveFixtureOperationalState,
  type FixtureOperationalStateStorage,
} from "./fixtureOperationalState";

function memoryStorage(
  initialValue: string | null = null,
): FixtureOperationalStateStorage & {
  getStoredValue: () => string | null;
  setItemMock: ReturnType<typeof vi.fn>;
} {
  let value = initialValue;
  const setItemMock = vi.fn((_key: string, next: string) => {
    value = next;
  });
  return {
    getItem: vi.fn(() => value),
    setItem: setItemMock,
    getStoredValue: () => value,
    setItemMock,
  };
}

describe("prototype operational state persistence", () => {
  it("round-trips work lifecycle, drafts and object registries as one governed snapshot", () => {
    const storage = memoryStorage();
    const initial = createDefaultFixtureOperationalState();
    const changed = {
      ...initial,
      workItems: initial.workItems.map((item) =>
        item.workId === "WORK-MARKET-FILL-W31"
          ? { ...item, documentStatus: "submitted" as const }
          : item,
      ),
      marketDocumentDrafts: {
        "WORK-MARKET-FILL-W31": {
          values: { "quote:purchase-price": "2346 元/吨" },
          confirmedFieldKeys: ["quote:purchase-price"],
        },
      },
      productionDocumentDrafts: {
        "WORK-PRODUCTION-FILL-W31": {
          values: { "yield-output:estimated-yield": "470.0 公斤/亩" },
          confirmedFieldKeys: ["yield-output:estimated-yield"],
        },
      },
    };

    expect(saveFixtureOperationalState(storage, changed)).toEqual({
      status: "saved",
    });
    const loaded = loadFixtureOperationalState(storage);

    expect(loaded.status).toBe("loaded");
    expect(
      loaded.state.workItems.find(
        ({ workId }) => workId === "WORK-MARKET-FILL-W31",
      )?.documentStatus,
    ).toBe("submitted");
    expect(loaded.state.marketDocumentDrafts).toEqual(
      changed.marketDocumentDrafts,
    );
    expect(loaded.state.productionDocumentDrafts).toEqual(
      changed.productionDocumentDrafts,
    );
    expect(loaded.state.marketRegistryObjects).toEqual(
      initial.marketRegistryObjects,
    );
    expect(loaded.state.productionRegistryObjects).toEqual(
      initial.productionRegistryObjects,
    );
  });

  it("reports malformed storage without replacing the original value", () => {
    const damaged = "{not-json";
    const storage = memoryStorage(damaged);

    const loaded = loadFixtureOperationalState(storage);

    expect(loaded.status).toBe("blocked");
    expect(loaded.message).toBe(
      "业务工作状态无法读取，原始数据已保留且未被覆盖。",
    );
    expect(storage.getStoredValue()).toBe(damaged);
    expect(storage.setItemMock).not.toHaveBeenCalled();
  });

  it("blocks structurally incomplete storage instead of silently falling back and overwriting", () => {
    const incomplete = JSON.stringify({ schemaVersion: 1, workItems: [] });
    const storage = memoryStorage(incomplete);

    const loaded = loadFixtureOperationalState(storage);

    expect(loaded.status).toBe("blocked");
    expect(storage.getStoredValue()).toBe(incomplete);
    expect(storage.setItemMock).not.toHaveBeenCalled();
  });

  it("returns a visible failure result when the browser refuses a save", () => {
    const setItem = vi.fn(() => {
      throw new Error("quota");
    });
    const storage: FixtureOperationalStateStorage = {
      getItem: () => null,
      setItem,
    };

    expect(
      saveFixtureOperationalState(
        storage,
        createDefaultFixtureOperationalState(),
      ),
    ).toEqual({
      status: "blocked",
      message: "业务工作状态保存失败，本次变更仍保留在当前页面。",
    });
    expect(setItem).toHaveBeenCalledWith(
      fixtureOperationalStateStorageKey,
      expect.any(String),
    );
  });
});
