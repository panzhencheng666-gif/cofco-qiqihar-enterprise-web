import { describe, expect, it } from "vitest";
import { resolveModuleWorkspace } from "./catalog";

function required(pathname: string) {
  const view = resolveModuleWorkspace(pathname);
  if (!view) throw new Error(`缺少工作区：${pathname}`);
  return view;
}

describe("module workspace catalog", () => {
  it("keeps farmer inventory, sales and intention attached to stable farmer objects without reusing task rows", () => {
    const planting = required("/production/planting");
    const stock = required("/production/stock");
    const sales = required("/production/sales");
    const intention = required("/production/intention");

    const farmerObjectIds = stock.records.map(
      (record) => record.businessObjectId,
    );
    expect(sales.records.map((record) => record.businessObjectId)).toEqual(
      farmerObjectIds,
    );
    expect(intention.records.map((record) => record.businessObjectId)).toEqual(
      farmerObjectIds,
    );
    expect(planting.records.map((record) => record.businessObjectId)).toEqual(
      expect.arrayContaining(farmerObjectIds),
    );
    expect(stock.records.map((record) => record.id)).not.toEqual(
      sales.records.map((record) => record.id),
    );
    expect(
      new Set(
        [...stock.records, ...sales.records, ...intention.records].map(
          (record) => record.id,
        ),
      ).size,
    ).toBe(
      stock.records.length + sales.records.length + intention.records.length,
    );
    expect(planting.tableDescription).toContain("同一对象档案");
  });

  it("gives each production workspace its own lifecycle and task denominator", () => {
    const planting = required("/production/planting");
    const stock = required("/production/stock");
    const sales = required("/production/sales");
    const intention = required("/production/intention");

    expect(planting.lifecycle.map((step) => step.detail)).toContain("428 份");
    expect(stock.lifecycle.map((step) => step.detail)).toContain("312 户");
    expect(sales.lifecycle.map((step) => step.detail)).toContain("1,486 笔");
    expect(intention.lifecycle.map((step) => step.detail)).toContain("312 户");
    expect(planting.lifecycle).not.toEqual(stock.lifecycle);
    expect(stock.lifecycle).not.toEqual(sales.lifecycle);
    expect(sales.lifecycle).not.toEqual(intention.lifecycle);
    expect(stock.description).toContain("只读用于勾稽");
    expect(stock.description).toContain("唯一录入入口在农户销售工作区");
  });

  it("splits market quotation and trade-delivery tasks for the same subject", () => {
    const trading = required("/market/trading");

    const grainTraderTasks = trading.records.filter(
      (record) => record.businessObjectId === "site-qqhr-001",
    );

    expect(grainTraderTasks.map((record) => record.category)).toEqual([
      "报价任务",
      "成交与交付任务",
    ]);
    expect(new Set(grainTraderTasks.map((record) => record.id)).size).toBe(2);
    expect(trading.lifecycleNote).toContain("报价任务与成交、交付任务分别处理");
  });

  it("does not keep removed market aliases available", () => {
    expect(
      resolveModuleWorkspace("/market/inventory-processing"),
    ).toBeUndefined();
    expect(resolveModuleWorkspace("/market/quality-price")).toBeUndefined();
  });

  it("uses employee-facing source language in the supply workflow", () => {
    const supply = required("/supply/lineage");
    const lineageDetails = supply.lifecycle.map(({ detail }) => detail);

    expect(lineageDetails).toContain("数据来源已确认");
    expect(lineageDetails.join(" ")).not.toContain("输入集合");
  });

  it.each([
    "/production/not-a-workspace",
    "/market/not-a-workspace",
    "/supply/not-a-workspace",
    "/overview/not-a-workspace",
    "/reports/not-a-workspace",
    "/governance/not-a-workspace",
    "/system/not-a-workspace",
  ])(
    "rejects unknown workspace paths instead of falling back to a business overview: %s",
    (pathname) => {
      expect(resolveModuleWorkspace(pathname)).toBeUndefined();
    },
  );

  it("limits logistics duplicate risks to duplicate segments or boundary crossings", () => {
    const logistics = required("/market/logistics");

    expect(
      logistics.metrics.find((metric) => metric.key === "duplicates")?.note,
    ).toContain("同一运输分段或同一次边界穿越");
    expect(logistics.notices[0]).toMatchObject({
      title: "同一分段或边界穿越重复申报",
    });
    expect(logistics.notices[0]?.detail).toContain("不将合法多式联运判为重复");
  });

  it("uses per-fact-type counts instead of a cross-fact aggregate", () => {
    const market = required("/market");

    expect(market.metrics.map((metric) => metric.label)).toContain(
      "今日有效报价",
    );
    expect(market.metrics.map((metric) => metric.label)).not.toContain(
      "今日有效业务事实",
    );
    expect(market.metrics.map((metric) => metric.label)).not.toContain(
      "待审核与退回",
    );
    expect(market.metrics.map((metric) => metric.label)).not.toContain(
      "阻断性质量异常",
    );
    expect(market.lifecycle.map((step) => step.label)).toContain("报价事实");
    expect(market.lifecycle.map((step) => step.label)).not.toContain(
      "业务事实",
    );
  });

  it("does not show planting exceptions inside farmer inventory and sales workspaces", () => {
    const planting = required("/production/planting");
    const stock = required("/production/stock");
    const sales = required("/production/sales");

    expect(planting.notices.map((notice) => notice.title).join("")).toContain(
      "面积与产量",
    );
    expect(stock.notices.map((notice) => notice.title).join("")).not.toMatch(
      /面积与产量|种植成本/,
    );
    expect(sales.notices.map((notice) => notice.title).join("")).not.toMatch(
      /面积与产量|种植成本/,
    );
  });

  it("uses fixed demonstration metric versions and a governed release chain for supply accounts", () => {
    const balance = required("/supply/balance");

    expect(balance.description).toContain("预置演示指标版本");
    expect(balance.lifecycle.map((step) => step.label)).toEqual([
      "事实发布",
      "指标发布",
      "账户校验",
      "供需计算",
      "结果发布",
    ]);
  });

  it("gives account definition, realtime observation, map and lineage their own business projections", () => {
    const accounts = required("/supply/accounts");
    const realtime = required("/supply/realtime");
    const map = required("/supply/map");
    const lineage = required("/supply/lineage");

    expect(accounts.metrics.map((metric) => metric.label)).toContain(
      "已定义产品账户",
    );
    expect(realtime.metrics.map((metric) => metric.label)).toContain(
      "当前演示信号",
    );
    expect(map.records.map((record) => record.name)).toEqual([
      "齐齐哈尔监测区域",
      "黑河监测区域",
      "呼伦贝尔监测区域",
    ]);
    expect(lineage.records.map((record) => record.category)).toContain(
      "供需血缘链",
    );
    expect(accounts.records).not.toEqual(realtime.records);
    expect(realtime.lifecycle).not.toEqual(map.lifecycle);
    expect(map.notices).not.toEqual(lineage.notices);
  });

  it.each([
    ["/reports/duty", "履责报告"],
    ["/governance/quality", "质量规则"],
    ["/system/responsibility", "责任岗位"],
  ])(
    "keeps supporting workspace records inside their own domain for %s",
    (pathname, expectedCategory) => {
      const view = required(pathname);

      expect(view.records.map((record) => record.category)).toContain(
        expectedCategory,
      );
      expect(view.records.map((record) => record.category)).not.toContain(
        "村级样本点",
      );
    },
  );
});
