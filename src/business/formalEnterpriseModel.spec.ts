import { describe, expect, it } from "vitest";
import {
  canFillWeeklyTask,
  createFormalRoute,
  marketSectionProductCode,
  readFormalLocation,
  readFormalRoute,
  summarizeDutyMonth,
  writeFormalLocation,
  writeFormalRoute,
  type FormalLocation,
  type DutySnapshot,
  type WeeklyTaskAuthorization,
} from "./formalEnterpriseModel";
import {
  formalApplicationDefinitions,
  reportingNavigation,
  responsibilityAssignments,
  weeklyTasks,
} from "./formalEnterpriseData";
import type { FormalApplicationDefinition } from "./formalEnterpriseData";

describe("formal enterprise route model", () => {
  it("writes a complete Chinese business hash for every application view", () => {
    const routes = [
      ["work", "tasks", "#/我的工作/待我处理"],
      ["work", "submitted", "#/我的工作/待我填报"],
      ["work", "review", "#/我的工作/待我审核"],
      ["work", "exceptions", "#/我的工作/退回与异常"],
      ["work", "completed", "#/我的工作/已办事项"],
      ["work", "sample-governance", "#/我的工作/样本点管理"],
      ["work", "imports", "#/我的工作/导入任务"],
      ["overview", "operations", "#/经营总览/经营运行"],
      ["overview", "risks", "#/经营总览/风险关注"],
      ["overview", "duty", "#/经营总览/履责情况"],
      ["overview", "releases", "#/经营总览/结果发布"],
      ["production", "corn-collection", "#/产情监测/玉米产情填报"],
      ["production", "soybean-collection", "#/产情监测/大豆产情填报"],
      ["production", "rice-collection", "#/产情监测/稻谷产情填报"],
      ["production", "tasks", "#/产情监测/产情任务"],
      ["production", "objects", "#/产情监测/调查对象"],
      ["production", "review", "#/产情监测/数据审核"],
      ["production", "analysis", "#/产情监测/产情分析"],
      ["market", "corn-collection", "#/市场监测/玉米市场采集"],
      ["market", "soybean-collection", "#/市场监测/大豆市场采集"],
      ["market", "paddy-collection", "#/市场监测/稻谷市场采集"],
      ["market", "corn-logistics", "#/市场监测/玉米物流监测"],
      ["market", "soybean-logistics", "#/市场监测/大豆物流监测"],
      ["market", "paddy-logistics", "#/市场监测/稻谷物流监测"],
      ["market", "tasks", "#/市场监测/采集任务"],
      ["market", "objects", "#/市场监测/监测对象"],
      ["market", "review", "#/市场监测/数据审核"],
      ["market", "analysis", "#/市场监测/市场分析"],
      ["supply", "balance", "#/供需分析/供需平衡"],
      ["supply", "corn-balance", "#/供需分析/玉米供需平衡"],
      ["supply", "soybean-balance", "#/供需分析/大豆供需平衡"],
      ["supply", "paddy-balance", "#/供需分析/稻谷供需平衡"],
      ["supply", "records", "#/供需分析/计算记录"],
      ["supply", "calculation", "#/供需分析/供需测算"],
      ["supply", "comparison", "#/供需分析/四年对比"],
      ["supply", "versions", "#/供需分析/核定记录"],
      ["reporting", "compose", "#/报表中心/业务报告"],
      ["reporting", "review-distribution", "#/报表中心/报告审核与发布"],
      ["reporting", "ledger", "#/报表中心/报告台账"],
    ] as const;

    for (const [application, section, businessHash] of routes) {
      const route = createFormalRoute(application, section);
      expect(writeFormalRoute(route)).toBe(businessHash);
      expect(readFormalRoute(businessHash)).toEqual(route);
      expect(readFormalRoute(`https://example.test/${businessHash}`)).toEqual(
        route,
      );
    }
  });

  it("keeps the former paddy production bookmark compatible", () => {
    expect(readFormalRoute("#/产情监测/水稻产情填报")).toEqual({
      application: "production",
      section: "rice-collection",
    });
  });

  it("canonicalizes the former generic logistics bookmark to corn logistics", () => {
    const legacy = readFormalRoute("#/市场监测/物流节点监测");

    expect(legacy).toEqual({
      application: "market",
      section: "corn-logistics",
    });
    expect(writeFormalRoute(legacy)).toBe("#/市场监测/玉米物流监测");
  });

  it.each([
    ["玉米供需平衡", "corn-balance"],
    ["大豆供需平衡", "soybean-balance"],
    ["稻谷供需平衡", "paddy-balance"],
  ] as const)("keeps the former %s bookmark readable", (name, section) => {
    expect(readFormalRoute(`#/供需分析/${name}`)).toEqual({
      application: "supply",
      section,
    });
  });

  it.each([
    ["corn-collection", "CORN"],
    ["soybean-collection", "SOYBEAN"],
    ["paddy-collection", "RICE"],
    ["corn-logistics", "CORN"],
    ["soybean-logistics", "SOYBEAN"],
    ["paddy-logistics", "RICE"],
    ["analysis", null],
  ] as const)("derives locked product context for %s", (section, product) => {
    expect(marketSectionProductCode(section)).toBe(product);
  });

  it("migrates legacy English routes but never writes them back", () => {
    expect(readFormalRoute("?page=production&section=objects")).toEqual({
      application: "production",
      section: "objects",
    });
    expect(readFormalRoute("#/overview/risks")).toEqual({
      application: "overview",
      section: "risks",
    });
    expect(
      writeFormalRoute(readFormalRoute("?page=reporting&section=ledger")),
    ).toBe("#/报表中心/报告台账");
  });

  it("normalizes invalid modules and views without reflecting unknown codes", () => {
    expect(readFormalRoute("?page=unknown&section=unknown")).toEqual({
      application: "work",
      section: "tasks",
    });
    expect(readFormalRoute("#/不存在的模块/内部代码-001")).toEqual({
      application: "work",
      section: "tasks",
    });
    expect(readFormalRoute("#/市场监测/内部代码-001")).toEqual({
      application: "market",
      section: "corn-collection",
    });
    expect(writeFormalRoute(readFormalRoute("#/市场监测/内部代码-001"))).toBe(
      "#/市场监测/玉米市场采集",
    );
  });
});

describe("formal location", () => {
  const authorization = {
    authorizedRegionIds: ["qiqihar-nehe"],
    authorizedBusinessClassificationIds: ["production.planting-production"],
    authorizedProductIds: ["corn"],
    authorizedCultivarIds: ["jingke-968"],
    authorizedReleaseVersionIds: ["METRIC-2026-W31-V3"],
    permissionKeys: ["enterprise:fixtures:read"],
  } as const;

  it("constructs only valid application sections", () => {
    createFormalRoute("reporting", "compose");
    createFormalRoute("overview", "duty");
    // @ts-expect-error supply does not have an operations section
    createFormalRoute("supply", "operations");

    const invalidDefinition: Extract<
      FormalApplicationDefinition,
      { key: "production" }
    > = {
      key: "production",
      code: "03",
      label: "产情监测",
      shortLabel: "产情",
      note: "type-only negative assertion",
      navigation: [
        // @ts-expect-error a production definition cannot contain a market route
        { route: createFormalRoute("market", "tasks"), label: "错误路由" },
      ],
    };
    expect(invalidDefinition).toBeDefined();
  });

  it("serializes only the stable route and ignores injected business state", () => {
    const location: FormalLocation = {
      route: createFormalRoute("production", "tasks"),
      coordinates: {
        regionId: "qiqihar-nehe",
        regionLevel: "county",
        businessSubtypeId: "planting-production",
        productId: "corn",
        cultivarId: "jingke-968",
        periodKey: "2026-W31",
        dataCutoff: "2026-07-31T17:00:00+08:00",
        dataLayer: "official",
        releaseVersion: "METRIC-2026-W31-V3",
        riskState: "all",
        selectedMetricId: "production.total-output",
      },
      selection: { type: "work-item", id: "PROD-W31-002" },
    };

    expect(writeFormalLocation(location)).toBe("#/产情监测/产情任务");
    expect(
      readFormalLocation(
        "?page=production&region=qiqihar-nehe&product=corn&releaseVersion=METRIC-2026-W31-V3&selectionType=work-item&selectionId=PROD-W31-002",
        authorization,
      ),
    ).toEqual({
      location: {
        route: createFormalRoute("production", "corn-collection"),
        coordinates: { regionId: "authorized-all" },
      },
      issues: [],
      queryAllowed: true,
    });
  });
});

describe("weekly responsibility control", () => {
  const task: WeeklyTaskAuthorization = {
    responsibleUserId: "user-qqhr",
    status: "填写中",
  };

  it("allows only the locked responsible person to fill", () => {
    expect(canFillWeeklyTask(task, "user-qqhr")).toBe(true);
    expect(canFillWeeklyTask(task, "regional-admin")).toBe(false);
    expect(canFillWeeklyTask(task, "regional-reviewer")).toBe(false);
  });

  it("prevents editing after an obligation is approved or exempted", () => {
    expect(
      canFillWeeklyTask(
        { responsibleUserId: "user-qqhr", status: "审核通过" },
        "user-qqhr",
      ),
    ).toBe(false);
    expect(
      canFillWeeklyTask(
        { responsibleUserId: "user-qqhr", status: "免报" },
        "user-qqhr",
      ),
    ).toBe(false);
  });
});

describe("monthly duty summary", () => {
  it("aggregates immutable weekly deadline snapshots", () => {
    const snapshots: DutySnapshot[] = [
      { status: "按时完成" },
      { status: "按时完成" },
      { status: "逾期补填" },
      { status: "截止未提交" },
      { status: "免报" },
    ];

    expect(summarizeDutyMonth(snapshots)).toEqual({
      expected: 4,
      onTime: 2,
      overdue: 1,
      missing: 1,
      exempt: 1,
      onTimeRate: 50,
    });
  });
});

describe("formal enterprise sample data", () => {
  it("keeps one active responsibility for every region and business item", () => {
    const responsibilityKeys = responsibilityAssignments.map(
      (item) => `${item.region}:${item.businessItem}:${item.effectivePeriod}`,
    );

    expect(new Set(responsibilityKeys).size).toBe(
      responsibilityAssignments.length,
    );
  });

  it("provides a responsible person for every weekly obligation", () => {
    expect(weeklyTasks.every((task) => task.responsibleUserId.length > 0)).toBe(
      true,
    );
  });

  it("contains the six ordinary-user entries and only the working report entry", () => {
    expect(
      formalApplicationDefinitions.map((application) => application.key),
    ).toEqual([
      "work",
      "overview",
      "production",
      "market",
      "supply",
      "reporting",
    ]);
    expect(reportingNavigation.flatMap((group) => group.items)).toEqual([
      expect.objectContaining({ key: "compose" }),
    ]);
    const work = formalApplicationDefinitions.find(({ key }) => key === "work");
    expect(work?.navigation).toContainEqual({
      route: createFormalRoute("work", "imports"),
      label: "导入任务",
    });
  });

  it("lists three product-owned logistics menus without a generic product switcher", () => {
    const market = formalApplicationDefinitions.find(
      ({ key }) => key === "market",
    );
    const logistics = market?.navigation.filter(({ label }) =>
      label.includes("物流"),
    );

    expect(logistics?.map(({ label }) => label)).toEqual([
      "玉米物流监测",
      "大豆物流监测",
      "稻谷物流监测",
    ]);
    expect(logistics?.map(({ route }) => route)).toEqual([
      createFormalRoute("market", "corn-logistics"),
      createFormalRoute("market", "soybean-logistics"),
      createFormalRoute("market", "paddy-logistics"),
    ]);
  });
});
