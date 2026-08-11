import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CurrentSession,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";

import { RealtimeWorkObligationReportPanel } from "./RealtimeWorkObligationReportPanel";

const session: CurrentSession = {
  subjectId: "employee-1",
  displayName: "填报员工甲",
  workUnitCode: "UNIT-1",
  workUnitName: "经营一部",
  accountStatus: "ACTIVE",
  employmentStatus: "ACTIVE",
  roleCodes: ["BUSINESS_REVIEWER"],
  positions: [],
  permissions: [
    "OBLIGATION_REPORT_READ",
    "OBLIGATION_REPORT_UNIT",
    "OBLIGATION_REPORT_EXPORT",
    "IDENTITY_READ",
  ],
  regionCodes: ["230200"],
};

function repository() {
  return {
    loadMasterData: vi.fn().mockResolvedValue({
      products: [],
      periods: [],
      regions: [
        {
          code: "230200",
          name: "齐齐哈尔市",
          parentCode: null,
          level: "PREFECTURE",
        },
      ],
    }),
    listEmployees: vi.fn().mockResolvedValue([
      {
        subjectId: "employee-2",
        displayName: "填报员工乙",
        workUnitCode: "UNIT-1",
        workUnitName: "经营一部",
        accountStatus: "ACTIVE",
        employmentStatus: "ACTIVE",
        roles: [],
        positions: [],
        regionCodes: ["230200"],
        version: 0,
      },
    ]),
    loadWorkObligationWeeklyReport: vi.fn().mockResolvedValue({
      weekStart: "2026-08-03",
      weekEnd: "2026-08-09",
      scopeLabel: "填报员工甲",
      summary: {
        total: 2,
        onTime: 1,
        lateCompleted: 0,
        overdueOutstanding: 1,
        pending: 0,
        returned: 1,
      },
      rows: [
        {
          workItemId: "work-1",
          employeeSubjectId: "employee-1",
          employeeName: "填报员工甲",
          workUnitCode: "UNIT-1",
          workUnitName: "经营一部",
          businessDomain: "PRODUCTION",
          businessDomainLabel: "产情监测",
          regionCode: "230200",
          regionName: "齐齐哈尔市",
          productName: "玉米",
          businessPeriod: "2026年第32周",
          dueAt: "2026-08-07T10:00:00Z",
          completedAt: null,
          statusCode: "TO_FILL",
          statusLabel: "待填报",
          complianceCode: "OVERDUE_OUTSTANDING",
          complianceLabel: "已逾期未完成",
          sourceType: "PRODUCTION",
          sourceId: "production-1",
        },
      ],
    }),
    createWorkObligationReportExport: vi.fn().mockResolvedValue({
      id: "export-1",
      filename: "填报履职周报-2026-08-03-填报员工甲.xlsx",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      checksum: "a".repeat(64),
      generatedAt: "2026-08-10T00:00:00Z",
    }),
    downloadWorkObligationReport: vi
      .fn()
      .mockResolvedValue(new Blob(["workbook"])),
  };
}

describe("RealtimeWorkObligationReportPanel", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:workbook"),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  it("shows governed employee obligations and exports the selected scope", async () => {
    const gateway = repository();
    render(
      <RealtimeWorkObligationReportPanel
        repository={gateway as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "填报履职周报" }),
    ).toBeVisible();
    expect(await screen.findByText("已逾期未完成")).toBeVisible();
    expect(screen.getAllByText("填报员工甲")).not.toHaveLength(0);
    expect(screen.getByText("经营一部")).toBeVisible();
    expect(
      screen.getByRole("option", { name: "本单位全部人员" }),
    ).toBeVisible();
    expect(screen.getByRole("option", { name: "填报员工乙" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "一键导出 XLSX" }));
    await waitFor(() =>
      expect(gateway.createWorkObligationReportExport).toHaveBeenCalledWith(
        expect.objectContaining({ subjectId: "employee-1" }),
      ),
    );
    expect(gateway.downloadWorkObligationReport).toHaveBeenCalledWith(
      "export-1",
    );
  });

  it("does not expose report export without the assigned export permission", async () => {
    render(
      <RealtimeWorkObligationReportPanel
        repository={repository() as unknown as RealtimeBusinessRepository}
        session={{
          ...session,
          permissions: ["OBLIGATION_REPORT_READ"],
        }}
      />,
    );

    await screen.findByText("已逾期未完成");
    expect(
      screen.queryByRole("button", { name: "一键导出 XLSX" }),
    ).not.toBeInTheDocument();
  });

  it("allows a governed supervisor to query the whole work unit", async () => {
    const gateway = repository();
    render(
      <RealtimeWorkObligationReportPanel
        repository={gateway as unknown as RealtimeBusinessRepository}
        session={session}
      />,
    );
    await screen.findByText("已逾期未完成");
    fireEvent.change(screen.getByLabelText("统计人员"), {
      target: { value: "__UNIT__" },
    });
    fireEvent.click(screen.getByRole("button", { name: "查询" }));
    await waitFor(() =>
      expect(gateway.loadWorkObligationWeeklyReport).toHaveBeenLastCalledWith(
        expect.objectContaining({ workUnitCode: "UNIT-1" }),
      ),
    );
  });
});
