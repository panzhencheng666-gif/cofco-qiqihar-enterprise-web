import { describe, expect, it } from "vitest";

import {
  getGrainQualityFields,
  getMarketCapabilityGroups,
  getMarketObjectSubtypeOptions,
  getMarketObjectTypeOptions,
  getProductionObjectTypeOptions,
  normalizeMarketObjectType,
  normalizeProductionObjectType,
} from "./businessApplicability";

describe("grain business applicability", () => {
  it("uses the three governed production object types", () => {
    expect(getProductionObjectTypeOptions()).toEqual([
      { id: "farmer", label: "农户" },
      { id: "village-committee", label: "村委会" },
      { id: "agri-station", label: "农技站" },
    ]);
    expect(normalizeProductionObjectType("survey-area")).toBe(
      "village-committee",
    );
    expect(normalizeProductionObjectType("field-plot")).toBe("agri-station");
  });

  it("limits market object types to those applicable to the selected grain", () => {
    expect(
      getMarketObjectTypeOptions("corn").map(({ label }) => label),
    ).toEqual([
      "贸易商",
      "深加工企业",
      "养殖场",
      "饲料厂",
      "批发市场",
      "承储企业",
    ]);
    expect(
      getMarketObjectTypeOptions("soybean").map(({ label }) => label),
    ).toEqual(["贸易商", "深加工企业", "批发市场", "承储企业"]);
    expect(
      getMarketObjectTypeOptions("paddy").map(({ label }) => label),
    ).toEqual(["贸易商", "深加工企业", "批发市场", "承储企业"]);
  });

  it("keeps processing subtypes specific to each grain", () => {
    expect(getMarketObjectSubtypeOptions("corn", "deep-processing")).toEqual([
      { id: "corn-processing", label: "玉米深加工" },
    ]);
    expect(getMarketObjectSubtypeOptions("soybean", "deep-processing")).toEqual(
      [
        { id: "soybean-crushing", label: "大豆压榨" },
        { id: "soybean-protein", label: "大豆蛋白加工" },
        { id: "soybean-food", label: "大豆食品加工" },
      ],
    );
    expect(getMarketObjectSubtypeOptions("paddy", "deep-processing")).toEqual([
      { id: "rice-mill", label: "米厂" },
    ]);
  });

  it("uses grain-specific quality fields instead of the corn template", () => {
    expect(getGrainQualityFields("corn").map(({ label }) => label)).toEqual([
      "水分",
      "容重",
      "毒素",
      "杂质",
      "不完善粒",
      "霉变粒",
    ]);
    expect(getGrainQualityFields("soybean").map(({ label }) => label)).toEqual([
      "蛋白",
      "出油率",
      "不完善粒",
      "水分",
      "杂质",
    ]);
    expect(getGrainQualityFields("paddy").map(({ label }) => label)).toEqual([
      "水分",
      "出米率",
      "出糙率",
      "杂质",
    ]);
  });

  it.each(["deep-processing", "breeding-farm", "feed-mill"] as const)(
    "%s keeps procurement price, quantity and grain quality before specialist fields",
    (objectType) => {
      const groups = getMarketCapabilityGroups("corn", objectType);
      expect(groups.map(({ id }) => id)).toEqual(
        expect.arrayContaining(["procurement", "quality"]),
      );
      const fields = groups.flatMap(({ fields }) => fields);
      expect(fields.map(({ id }) => id)).toEqual(
        expect.arrayContaining([
          "purchasePrice",
          "purchaseVolume",
          "transactionPrice",
          "wagonPrice",
          "freight",
          "packaging",
        ]),
      );
      expect(fields.map(({ id }) => id)).toEqual(
        expect.arrayContaining(
          getGrainQualityFields("corn").map(({ id }) => id),
        ),
      );
    },
  );

  it("makes the transaction-price composition explicit for every procurement object", () => {
    for (const objectType of [
      "trader",
      "deep-processing",
      "breeding-farm",
      "feed-mill",
    ] as const) {
      const procurement = getMarketCapabilityGroups("corn", objectType).find(
        ({ id }) => id === "procurement",
      );
      expect(procurement?.fields.map(({ label }) => label)).toEqual([
        "采购价",
        "采购量",
        "实际成交价",
        "车板价",
        "运费",
        "包装形态",
      ]);
    }
  });

  it("keeps base sales price separate from the all-in transaction price", () => {
    const traderFields = getMarketCapabilityGroups("corn", "trader").flatMap(
      ({ fields }) => fields,
    );
    const wholesaleFields = getMarketCapabilityGroups(
      "corn",
      "wholesale-market",
    ).flatMap(({ fields }) => fields);

    for (const fields of [traderFields, wholesaleFields]) {
      expect(fields.map(({ id }) => id)).toEqual(
        expect.arrayContaining([
          "salesPrice",
          "transactionPrice",
          "wagonPrice",
          "freight",
          "packaging",
        ]),
      );
    }
  });

  it("adds specialist capability groups without removing common procurement", () => {
    expect(
      getMarketCapabilityGroups("soybean", "deep-processing").map(
        ({ id }) => id,
      ),
    ).toEqual(["procurement", "quality", "processing", "inventory"]);
    expect(
      getMarketCapabilityGroups("corn", "breeding-farm").map(({ id }) => id),
    ).toEqual(["procurement", "quality", "direct-use", "inventory"]);
    expect(
      getMarketCapabilityGroups("corn", "feed-mill").map(({ id }) => id),
    ).toEqual(["procurement", "quality", "processing", "inventory"]);
  });

  it("normalizes legacy object codes to governed business labels", () => {
    expect(
      normalizeMarketObjectType("grain-trading-enterprise", "trader"),
    ).toBe("trader");
    expect(
      normalizeMarketObjectType("grain-processing-enterprise", "rice-mill"),
    ).toBe("deep-processing");
    expect(
      normalizeMarketObjectType("grain-storage-enterprise", "reserve"),
    ).toBe("reserve-storage");
  });
});
