import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { EmployeeProfile } from "@/platform/api/realtimeBusinessRepository";
import { RegionResponsibilityDirectory } from "./RegionResponsibilityDirectory";
afterEach(cleanup);
const employee: EmployeeProfile = {
  subjectId: "one",
  displayName: "员工甲",
  workUnitCode: "UNIT",
  workUnitName: "经营部",
  accountStatus: "ACTIVE",
  employmentStatus: "ACTIVE",
  roles: [],
  positions: [],
  regionCodes: [],
  responsibilityRegionCodes: ["a", "a", "b"],
  version: 1,
};
it("groups recorded responsibilities by region, deduplicates repeats and searches owners", async () => {
  const user = userEvent.setup();
  const onManage = vi.fn();
  render(
    <RegionResponsibilityDirectory
      employees={[employee]}
      regionNames={
        new Map([
          ["a", "甲镇"],
          ["b", "乙镇"],
        ])
      }
      selectedRegion=""
      canManage={() => true}
      onManage={onManage}
      onInspect={vi.fn()}
    />,
  );
  const table = screen.getByRole("table", { name: "地区责任清单" });
  expect(within(table).getAllByRole("row")).toHaveLength(3);
  await user.type(
    screen.getByRole("textbox", { name: "查找地区或负责人" }),
    "甲镇",
  );
  expect(within(table).getAllByRole("row")).toHaveLength(2);
  await user.click(
    screen.getByRole("button", { name: "调整员工甲的负责地区" }),
  );
  expect(onManage).toHaveBeenCalledWith(employee);
});
it("keeps read-only sample inspection available without exposing a write action", async () => {
  const onInspect = vi.fn();
  render(
    <RegionResponsibilityDirectory
      employees={[employee]}
      regionNames={new Map([["a", "甲镇"]])}
      selectedRegion="a"
      canManage={() => false}
      onManage={vi.fn()}
      onInspect={onInspect}
    />,
  );
  expect(
    screen.queryByRole("button", { name: /调整/ }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "查看员工甲的样本责任" }),
  );
  expect(onInspect).toHaveBeenCalledWith(employee);
});
