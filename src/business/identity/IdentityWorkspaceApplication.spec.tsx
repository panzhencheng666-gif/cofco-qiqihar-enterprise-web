import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CurrentSession,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import {
  allowedIdentityView,
  IdentityWorkspaceApplication,
} from "./IdentityWorkspaceApplication";

afterEach(cleanup);
const employee: CurrentSession = {
  subjectId: "employee-1",
  displayName: "王梅",
  workUnitCode: "QIQIHAR_BUSINESS",
  workUnitName: "齐齐哈尔经营部",
  accountStatus: "ACTIVE",
  employmentStatus: "ACTIVE",
  roleCodes: ["BUSINESS_OPERATOR"],
  positions: [],
  permissions: ["BUSINESS_READ"],
  regionCodes: [],
};
describe("standalone identity workspace", () => {
  it("does not expose management when an employee opens a management URL", async () => {
    window.history.replaceState(null, "", "/identity.html?view=employees");
    const listEmployees = vi.fn();
    const repository = {
      loadCurrentSession: vi.fn().mockResolvedValue(employee),
      loadMasterData: vi.fn().mockResolvedValue({ regions: [] }),
      listEmployees,
    } as unknown as RealtimeBusinessRepository;
    render(<IdentityWorkspaceApplication repository={repository} />);
    expect(
      await screen.findByRole("button", { name: /王梅.*普通员工/ }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "员工管理" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "人员与权限" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(listEmployees).not.toHaveBeenCalled();
  });
  it("chooses only views granted by the real session, independent of the display name", () => {
    expect(
      allowedIdentityView("audit", { ...employee, displayName: "管理员" }),
    ).toBe("profile");
    expect(
      allowedIdentityView("employees", {
        ...employee,
        permissions: ["AUDIT_READ"],
      }),
    ).toBe("audit");
    expect(
      allowedIdentityView(null, {
        ...employee,
        permissions: ["IDENTITY_READ", "IDENTITY_ADMIN"],
      }),
    ).toBe("employees");
  });
});
