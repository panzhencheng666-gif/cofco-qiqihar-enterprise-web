import { describe, expect, it } from "vitest";
import { resolveModuleWorkspace } from "./catalog";
import { buildObjectPanorama } from "./panorama";

function requiredView(pathname: string) {
  const view = resolveModuleWorkspace(pathname);
  if (!view) throw new Error(`缺少工作区：${pathname}`);
  return view;
}

function requiredRecord(pathname: string, businessObjectId: string) {
  const view = requiredView(pathname);
  const record = view?.records.find(
    (candidate) => candidate.businessObjectId === businessObjectId,
  );
  if (!record) {
    throw new Error(`缺少对象投影：${pathname} / ${businessObjectId}`);
  }
  return record;
}

describe("module object panorama", () => {
  it("projects one farmer across planting, inventory, sales and intention workspaces", () => {
    const record = requiredRecord("/production/stock", "farmer-017");
    const panorama = buildObjectPanorama(record, [
      {
        label: "种植生产",
        records: requiredView("/production/planting").records,
      },
      { label: "农户余粮", records: requiredView("/production/stock").records },
      { label: "农户销售", records: requiredView("/production/sales").records },
      {
        label: "种植意愿",
        records: requiredView("/production/intention").records,
      },
    ]);

    expect(panorama.businessObjectId).toBe("farmer-017");
    expect(panorama.relatedWorkspaces.map((item) => item.label)).toEqual([
      "种植生产",
      "农户余粮",
      "农户销售",
      "种植意愿",
    ]);
    expect(
      new Set(panorama.relatedWorkspaces.map((item) => item.recordId)).size,
    ).toBe(4);
  });

  it("projects one market subject without merging its independent business facts", () => {
    const record = requiredRecord(
      "/market/trading",
      "market-subject-corn-processor",
    );
    const panorama = buildObjectPanorama(record, [
      {
        label: "市场主体全景",
        records: requiredView("/market/subjects").records,
      },
      { label: "行情与交易", records: requiredView("/market/trading").records },
      {
        label: "库存与仓储",
        records: requiredView("/market/inventory").records,
      },
      {
        label: "加工与转化",
        records: requiredView("/market/processing").records,
      },
    ]);

    expect(panorama.relatedWorkspaces.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        "市场主体全景",
        "行情与交易",
        "库存与仓储",
        "加工与转化",
      ]),
    );
    expect(
      new Set(panorama.relatedWorkspaces.map((item) => item.recordId)).size,
    ).toBe(panorama.relatedWorkspaces.length);
  });
});
