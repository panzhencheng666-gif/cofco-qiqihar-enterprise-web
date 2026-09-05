import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  EmployeeProfile,
  RealtimeBusinessRepository,
  RegionResponsibility,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";
import { SampleResponsibilityEditor } from "./SampleResponsibilityEditor";
afterEach(cleanup);
const employee: EmployeeProfile = {
  subjectId: "user",
  displayName: "张敏",
  workUnitCode: "unit",
  workUnitName: "经营部",
  accountStatus: "ACTIVE",
  employmentStatus: "ACTIVE",
  roles: [],
  positions: [],
  regionCodes: ["county"],
  responsibilityRegionCodes: ["town-a"],
  version: 0,
};
const result = (token: string): RegionResponsibility => ({
  subjectId: "user",
  regionCodes: ["town-a"],
  regions: [],
  samples: [],
  previewToken: token,
});
function setup(failInitialPreview = false) {
  const api = {
    loadRegionResponsibility: vi.fn().mockResolvedValue(result("read")),
    loadAssignmentOptions: vi.fn().mockResolvedValue({
      workUnits: [],
      roles: [],
      positions: [],
      regionCodes: ["town-a", "town-b"],
      regions: [],
    }),
    previewRegionResponsibility: vi.fn().mockResolvedValue(result("initial")),
    saveRegionResponsibility: vi.fn().mockResolvedValue(result("saved")),
  };
  if (failInitialPreview)
    api.previewRegionResponsibility.mockRejectedValueOnce(
      new Error("unavailable"),
    );
  const onSaved = vi.fn().mockResolvedValue(undefined);
  render(
    <SampleResponsibilityEditor
      employee={employee}
      repository={api as unknown as RealtimeBusinessRepository}
      regionNames={
        new Map([
          ["town-a", "县甲 / 镇甲"],
          ["town-b", "县乙 / 镇乙"],
        ])
      }
      onCancel={vi.fn()}
      onSaved={onSaved}
    />,
  );
  return { api, onSaved };
}
describe("region responsibility editor", () => {
  it("reenables region selection after initial preview failure and successful retry", async () => {
    const user = userEvent.setup();
    setup(true);
    await screen.findByRole("alert");
    const box = screen.getByRole("checkbox", { name: "县甲 / 镇甲" });
    expect(box).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "重新预览" }));
    await waitFor(() => expect(box).toBeEnabled());
  });
  it("repreviews a conflict without retrying save and permits removal of every region", async () => {
    const user = userEvent.setup();
    const { api, onSaved } = setup();
    const box = await screen.findByRole("checkbox", { name: "县甲 / 镇甲" });
    await waitFor(() => expect(box).toBeEnabled());
    await user.click(box);
    await user.type(screen.getByLabelText("调整原因"), "岗位交接");
    api.saveRegionResponsibility.mockRejectedValueOnce(
      new RealtimeApiError({
        status: 409,
        code: "REGION_RESPONSIBILITY_CONFLICT",
        message: "已变化",
      }),
    );
    api.previewRegionResponsibility.mockResolvedValue(result("renewed"));
    await user.click(screen.getByRole("button", { name: "保存负责地区" }));
    await screen.findByText(/已重新预览，请核对/u);
    expect(api.saveRegionResponsibility).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "保存负责地区" }));
    expect(api.saveRegionResponsibility).toHaveBeenLastCalledWith("user", {
      regionCodes: [],
      reason: "岗位交接",
      previewToken: "renewed",
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
  it("discards an older asynchronous preview and blocks save while pending", async () => {
    const user = userEvent.setup();
    const { api } = setup();
    const a = await screen.findByRole("checkbox", { name: "县甲 / 镇甲" });
    await waitFor(() => expect(a).toBeEnabled());
    let resolveOld!: (value: RegionResponsibility) => void;
    api.previewRegionResponsibility.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    await user.click(a);
    await user.type(screen.getByLabelText("调整原因"), "重新分工");
    expect(screen.getByRole("button", { name: "保存负责地区" })).toBeDisabled();
    api.previewRegionResponsibility.mockResolvedValue(result("latest"));
    await user.click(screen.getByRole("checkbox", { name: "县乙 / 镇乙" }));
    await act(async () => {
      resolveOld(result("stale"));
      await Promise.resolve();
    });
    await user.click(screen.getByRole("button", { name: "保存负责地区" }));
    expect(api.saveRegionResponsibility).toHaveBeenCalledWith("user", {
      regionCodes: ["town-b"],
      reason: "重新分工",
      previewToken: "latest",
    });
  });
});
