import { readFileSync } from "node:fs";
import { createElement } from "react";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProductionDocumentWorkbench } from "../production/ProductionDocumentWorkbench";
import { businessWorkFixtures } from "./businessWorkFixtures";
import { productionDocumentFixtures } from "./productionDocumentFixtures";

afterEach(cleanup);

describe("production document fixtures", () => {
  it("preserves the approved production field groups and omits retired fields", () => {
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
      "总产量",
      "期初库存",
      "销售数量",
      "自用数量",
      "期末余粮",
      "下年度意向面积",
      "补贴",
      "保险",
      "来源详情",
      "校验结果",
    ]) {
      expect(labels).toContain(label);
    }
    expect(labels).not.toEqual(
      expect.arrayContaining([
        "病虫害与灾情",
        "现场证据",
        "样本平均结果",
        "区域加权估计",
        "测产轮次",
        "入库数量",
        "损耗数量",
      ]),
    );
  });

  it("keeps only the approved area and expected yield fields", () => {
    const fields = productionDocumentFixtures[0].fieldGroups.flatMap(
      ({ fields }) => fields,
    );
    expect(
      fields
        .filter(({ fieldId }) => ["area", "expectedYield"].includes(fieldId))
        .map(({ fieldId, label }) => [fieldId, label]),
    ).toEqual([
      ["area", "监测面积"],
      ["expectedYield", "预计单产"],
    ]);
  });

  it("keeps the object total output and harvest area without retired yield fields", () => {
    const fields = productionDocumentFixtures[0].fieldGroups.flatMap(
      ({ fields }) => fields,
    );
    expect(fields.find(({ fieldId }) => fieldId === "harvestArea")?.value).toBe(
      "4,590 亩",
    );
    expect(
      fields.find(({ fieldId }) => fieldId === "regionalEstimate"),
    ).toBeUndefined();
    expect(fields.find(({ fieldId }) => fieldId === "output")?.value).toBe(
      "2,149.0 吨",
    );
  });

  it("keeps each product's quality fields exact while preserving costs and collection governance", () => {
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
    expect(labels).not.toEqual(
      expect.arrayContaining(["蛋白", "出油率", "出糙率", "出米率"]),
    );
    expect(
      productionDocumentFixtures[1].fieldGroups
        .find(({ groupId }) => groupId === "quality-evidence")
        ?.fields.map(({ label }) => label),
    ).toEqual(["蛋白", "出油率", "不完善粒", "水分", "杂质"]);
    expect(
      productionDocumentFixtures[2].fieldGroups
        .find(({ groupId }) => groupId === "quality-evidence")
        ?.fields.map(({ label }) => label),
    ).toEqual(["水分", "出米率", "出糙率", "杂质"]);
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
        actor: {
          userId: businessWorkFixtures[0].responsibleUserId,
          displayName: businessWorkFixtures[0].responsiblePerson,
        },
      }),
    );
    for (const action of ["在线填报", "电子表格批量导入", "授权系统接入"]) {
      expect(screen.getByRole("button", { name: action })).toBeVisible();
    }
    for (const heading of [
      "种植与面积",
      "长势与灾情",
      "单产与总产",
      "质量调查",
      "余粮与销售",
      "种植意愿",
      "成本与保障",
      "来源与校验",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeVisible();
    }
    expect(document.body).not.toHaveTextContent("本单据不适用");
    expect(document.body).not.toHaveTextContent("责任人已确认");
    expect(
      screen.getByRole("heading", { name: "单据与审核流程" }),
    ).toBeVisible();
    expect(screen.getByText(/质量检验依据需要补充/)).toBeVisible();
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

  it("describes a superseded production release as a later published result", () => {
    render(
      createElement(ProductionDocumentWorkbench, {
        document: productionDocumentFixtures[0],
        item: {
          ...businessWorkFixtures[0],
          releaseStatus: "superseded",
        },
        actor: {
          userId: businessWorkFixtures[0].responsibleUserId,
          displayName: businessWorkFixtures[0].responsiblePerson,
        },
      }),
    );

    expect(screen.getByText("已由后续发布结果替代")).toBeVisible();
    expect(document.body).not.toHaveTextContent("已被新版本替代");
  });
});
