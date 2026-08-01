import { readFileSync } from "node:fs";
import { createElement } from "react";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProductionDocumentWorkbench } from "../production/ProductionDocumentWorkbench";
import { businessWorkFixtures } from "./businessWorkFixtures";
import { productionDocumentFixtures } from "./productionDocumentFixtures";

afterEach(cleanup);

describe("production document fixtures", () => {
  it("preserves every production field group in typed fixture data", () => {
    const document = productionDocumentFixtures[0];
    expect(document.fieldGroups.map(({ groupId }) => groupId)).toEqual([
      "specific-variety",
      "area-location",
      "growth-stage-disaster",
      "yield-output",
      "quality-evidence",
      "stock-sale-use-loss",
      "planting-intention",
      "cost-support-insurance",
      "source-validation",
    ]);
    const labels = document.fieldGroups.flatMap(({ fields }) =>
      fields.map(({ label }) => label),
    );
    for (const label of [
      "具体品种",
      "地块位置",
      "生育阶段",
      "病虫害与灾情",
      "总产量",
      "现场证据",
      "期初库存",
      "入库数量",
      "销售数量",
      "自用数量",
      "损耗数量",
      "期末余粮",
      "下年度意向面积",
      "补贴",
      "保险",
      "来源详情",
      "校验结果",
    ]) {
      expect(labels).toContain(label);
    }
  });

  it("keeps area, expected yield, sample result and regional estimate as four independent fields", () => {
    const fields = productionDocumentFixtures[0].fieldGroups.flatMap(
      ({ fields }) => fields,
    );
    expect(
      fields
        .filter(({ fieldId }) =>
          [
            "area",
            "expectedYield",
            "sampleResult",
            "regionalEstimate",
          ].includes(fieldId),
        )
        .map(({ fieldId, label }) => [fieldId, label]),
    ).toEqual([
      ["area", "监测面积"],
      ["expectedYield", "预计单产"],
      ["sampleResult", "样本平均结果"],
      ["regionalEstimate", "区域加权估计"],
    ]);
  });

  it("preserves quality, cost, policy support, insurance, collection channels and validation details", () => {
    const document = productionDocumentFixtures[0];
    const labels = document.fieldGroups.flatMap(({ fields }) =>
      fields.map(({ label }) => label),
    );
    for (const label of [
      "水分",
      "容重",
      "毒素",
      "杂质",
      "不完善粒",
      "霉变",
      "大豆蛋白",
      "稻谷出糙率",
      "稻谷出米率",
      "地租",
      "种子费用",
      "农药费用",
      "化肥费用",
      "灌溉费用",
      "人工费用",
      "机耕费用",
      "其他成本",
      "补贴",
      "保险",
    ]) {
      expect(labels).toContain(label);
    }
    expect(document.collectionChannels.map(({ mode }) => mode)).toEqual([
      "online",
      "excel",
      "system",
    ]);
    expect(
      document.collectionChannels.every(
        ({ sourceDetail, validationResult }) =>
          sourceDetail.length > 0 && validationResult.length > 0,
      ),
    ).toBe(true);
  });

  it("keeps business values out of the thin React workbench", () => {
    const component = readFileSync(
      "src/prototype/production/ProductionDocumentWorkbench.tsx",
      "utf8",
    );
    for (const businessValue of [
      "4,680 亩",
      "472.8 公斤/亩",
      "轻度玉米螟",
      "187,200 元",
      "3 张田间照片",
    ]) {
      expect(component).not.toContain(businessValue);
    }
  });

  it("renders fixture-driven field groups and all three collection actions", () => {
    render(
      createElement(ProductionDocumentWorkbench, {
        document: productionDocumentFixtures[0],
        item: businessWorkFixtures[0],
        itemTitle: "讷河市玉米长势与测产调查",
      }),
    );
    for (const action of ["在线填报", "Excel批量导入", "授权系统接入"]) {
      expect(screen.getByRole("button", { name: action })).toBeVisible();
    }
    for (const heading of [
      "具体品种",
      "面积与地块位置",
      "长势、生育阶段与灾情",
      "测产、单产与产量",
      "质量与证据",
      "库存、销售、自用与损耗",
      "种植意愿",
      "成本、支持、补贴与保险",
      "采集来源与校验",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeVisible();
    }
    expect(
      screen.getByRole("heading", { name: "单据与审核流程" }),
    ).toBeVisible();
    expect(screen.getByText("质量检验依据需要补充")).toBeVisible();
    for (const state of [
      "进行中",
      "已退回",
      "审核退回",
      "质量阻断",
      "未发布",
    ]) {
      expect(screen.getByText(state)).toBeVisible();
    }
  });
});
