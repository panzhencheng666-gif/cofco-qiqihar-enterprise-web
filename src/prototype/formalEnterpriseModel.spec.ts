import { describe, expect, it } from "vitest";
import {
  canFillWeeklyTask,
  readFormalRoute,
  summarizeDutyMonth,
  writeFormalRoute,
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
  it("reads every application section and falls back to the work inbox", () => {
    expect(readFormalRoute("?page=reporting&section=duty-reports")).toEqual({
      application: "reporting",
      section: "duty-reports",
    });

    expect(readFormalRoute("?page=unknown&section=unknown")).toEqual({
      application: "work",
      section: "inbox",
    });

    expect(readFormalRoute("?page=market&section=collection")).toEqual({
      application: "market",
      section: "collection",
    });

    expect(readFormalRoute("?page=market&section=unknown")).toEqual({
      application: "market",
      section: "overview",
    });

    expect(readFormalRoute("?page=production&section=collection")).toEqual({
      application: "production",
      section: "collection",
    });

    expect(readFormalRoute("?page=supply&section=versions")).toEqual({
      application: "supply",
      section: "versions",
    });

    expect(readFormalRoute("?page=supply&section=regional")).toEqual({
      application: "supply",
      section: "statement",
    });
  });

  it("writes stable application and section query parameters", () => {
    expect(
      writeFormalRoute({
        application: "reporting",
        section: "duty-reports",
      }),
    ).toBe("page=reporting&section=duty-reports");

    expect(
      writeFormalRoute({
        application: "market",
        section: "overview",
      }),
    ).toBe("page=market");

    expect(
      writeFormalRoute({
        application: "production",
        section: "collection",
      }),
    ).toBe("page=production&section=collection");

    expect(
      writeFormalRoute({
        application: "work",
        section: "inbox",
      }),
    ).toBe("page=work");
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

  it("contains the six ordinary-user entries and a consolidated duty report", () => {
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
      expect.objectContaining({ key: "duty-reports" }),
    );
  });
});
