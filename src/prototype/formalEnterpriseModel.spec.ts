import { describe, expect, it } from "vitest";
import {
  canFillWeeklyTask,
  createFormalRoute,
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

describe("formal enterprise route model", () => {
  it("reads typed application sections and falls back to the work task list", () => {
    expect(readFormalRoute("?page=production&section=objects")).toEqual({
      application: "production",
      section: "objects",
    });
    expect(readFormalRoute("?page=supply&section=analysis")).toEqual({
      application: "supply",
      section: "calculation",
    });
    expect(readFormalRoute("?page=reporting&section=compose")).toEqual({
      application: "reporting",
      section: "compose",
    });

    expect(readFormalRoute("?page=unknown&section=unknown")).toEqual({
      application: "work",
      section: "tasks",
    });

    expect(readFormalRoute("?page=market&section=unknown")).toEqual({
      application: "market",
      section: "tasks",
    });
  });

  it("writes stable application and section query parameters", () => {
    expect(
      writeFormalRoute({
        application: "reporting",
        section: "compose",
      }),
    ).toBe("page=reporting");

    expect(
      writeFormalRoute({
        application: "market",
        section: "tasks",
      }),
    ).toBe("page=market");

    expect(
      writeFormalRoute({
        application: "production",
        section: "objects",
      }),
    ).toBe("page=production&section=objects");

    expect(
      writeFormalRoute({
        application: "work",
        section: "tasks",
      }),
    ).toBe("page=work");
  });
});

describe("formal location", () => {
  const authorization = {
    authorizedRegionIds: ["qiqihar-nehe"],
    authorizedBusinessClassificationIds: ["production.planting-production"],
    authorizedProductIds: ["corn"],
    authorizedCultivarIds: ["jingke-968"],
    authorizedReleaseVersionIds: ["METRIC-2026-W31-V3"],
    permissionKeys: ["prototype:read"],
  } as const;

  it("constructs only valid application sections", () => {
    createFormalRoute("reporting", "compose");
    createFormalRoute("overview", "duty");
    // @ts-expect-error supply does not have an operations section
    createFormalRoute("supply", "operations");
  });

  it("round-trips a full formal location", () => {
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

    expect(readFormalLocation(writeFormalLocation(location), authorization)).toEqual({
      location,
      issues: [],
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

  it("contains the six ordinary-user entries and typed reporting navigation", () => {
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
    expect(reportingNavigation.flatMap((group) => group.items)).toContainEqual(
      expect.objectContaining({ key: "review-distribution" }),
    );
  });
});
