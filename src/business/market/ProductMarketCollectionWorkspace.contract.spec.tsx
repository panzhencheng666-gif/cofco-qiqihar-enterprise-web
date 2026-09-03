import { describe, expect, it } from "vitest";

import type { MarketDefinition } from "@/platform/api/realtimeBusinessRepository";
import { definitionFields } from "@/business/realtime/realtimeRecordFormModel";

import { marketDefinitionListGroups } from "./ProductMarketCollectionWorkspace";

describe("市场列表字段契约", () => {
  it("逐项采用后端有效定义并只去除已由固定列展示的字段", () => {
    const definition: MarketDefinition = {
      productCode: "CORN",
      objectTypeCode: "RESERVE_ENTERPRISE",
      coreFields: [
        core("MKT_OBJECT_TYPE", "对象类型"),
        core("MKT_REGION", "地区"),
        core("MKT_TRADE_DATE", "交易日期"),
        core("MKT_SAMPLE_NAME", "填报对象/客户名称"),
        core("MKT_REPORTER_NAME", "填报人"),
        core("MKT_REPORTER_PHONE", "填报人联系方式"),
        core("MKT_PURCHASE_BASE_PRICE", "对象采购价格", "元/吨"),
        core("MKT_SALE_BASE_PRICE", "对象销售价格", "元/吨"),
      ],
      groups: [
        {
          category: "INVENTORY",
          label: "库存",
          sortOrder: 10,
          fields: [
            fact("OPENING_INVENTORY", "期初库存", "吨"),
            fact("STOCK_OUTFLOW", "出库量", "吨"),
            fact("ENDING_INVENTORY", "期末库存", "吨"),
          ],
        },
      ],
    };

    const groups = marketDefinitionListGroups(definition);
    expect(groups.flatMap(({ fields }) => fields.map(({ id }) => id))).toEqual([
      "MKT_REPORTER_NAME",
      "MKT_REPORTER_PHONE",
      "MKT_PURCHASE_BASE_PRICE",
      "MKT_SALE_BASE_PRICE",
      "OPENING_INVENTORY",
      "STOCK_OUTFLOW",
      "ENDING_INVENTORY",
    ]);
    expect(groups.at(1)?.fields).toEqual([
      { id: "OPENING_INVENTORY", label: "期初库存", unit: "吨" },
      { id: "STOCK_OUTFLOW", label: "出库量", unit: "吨" },
      { id: "ENDING_INVENTORY", label: "期末库存", unit: "吨" },
    ]);
    expect(definitionFields(definition).map(({ code }) => code)).toEqual([
      "OPENING_INVENTORY",
      "STOCK_OUTFLOW",
      "ENDING_INVENTORY",
    ]);
  });

  it("keeps trader sale fields out of the deep-processor contract", () => {
    const trader = marketDefinitionListGroups({
      productCode: "CORN",
      objectTypeCode: "TRADER",
      coreFields: [
        core("MKT_PURCHASE_BASE_PRICE", "对象采购价格", "元/吨"),
        core("MKT_SALE_BASE_PRICE", "对象销售价格", "元/吨"),
      ],
      groups: [],
    });
    const processor = marketDefinitionListGroups({
      productCode: "CORN",
      objectTypeCode: "DEEP_PROCESSOR",
      coreFields: [core("MKT_PURCHASE_BASE_PRICE", "对象采购价格", "元/吨")],
      groups: [
        {
          category: "PROCESSING",
          label: "加工",
          sortOrder: 10,
          fields: [fact("PROCESSING_INPUT", "加工投入", "吨")],
        },
      ],
    });

    expect(trader.flatMap(({ fields }) => fields.map(({ id }) => id))).toEqual([
      "MKT_PURCHASE_BASE_PRICE",
      "MKT_SALE_BASE_PRICE",
    ]);
    expect(
      processor.flatMap(({ fields }) => fields.map(({ id }) => id)),
    ).toEqual(["MKT_PURCHASE_BASE_PRICE", "PROCESSING_INPUT"]);
  });
});

function core(code: string, label: string, unit: string | null = null) {
  return {
    code,
    label,
    controlType:
      code === "MKT_PURCHASE_BASE_PRICE" || code === "MKT_SALE_BASE_PRICE"
        ? "DECIMAL"
        : "TEXT",
    unit,
    description: null,
    capability: null,
    required: true,
    precision: null,
    scale: null,
    sortOrder: 1,
    options: [],
  };
}

function fact(code: string, label: string, unit: string | null) {
  return {
    code,
    label,
    valueType: "DECIMAL",
    unit,
    description: null,
    precision: 18,
    scale: 4,
    sortOrder: 1,
  };
}
