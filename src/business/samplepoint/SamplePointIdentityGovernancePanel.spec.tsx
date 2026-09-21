import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  CurrentSession,
  RealtimeBusinessRepository,
  SampleIdentityMergeJob,
} from "@/platform/api/realtimeBusinessRepository";

import { SamplePointIdentityGovernancePanel } from "./SamplePointIdentityGovernancePanel";

afterEach(cleanup);

const session: CurrentSession = {
  subjectId: "wang-yang",
  displayName: "吴雨桐",
  workUnitCode: "LOCAL_DEV",
  workUnitName: "平台运营管理部",
  accountStatus: "ACTIVE",
  employmentStatus: "ACTIVE",
  roleCodes: ["ACCOUNT_OWNER"],
  positions: [],
  permissions: ["BUSINESS_IMPORT", "BUSINESS_APPROVE", "BUSINESS_SELF_APPROVE"],
  regionCodes: ["230281"],
};

const mergeJob: SampleIdentityMergeJob = {
  jobId: "merge-job-1",
  batchId: "batch-1",
  statusCode: "PENDING_REVIEW",
  acceptedRows: 1,
  pendingRequests: 1,
  skippedRows: 1,
  failedRows: 0,
  idempotencyKey: "key-1",
  createdAt: "2026-08-20T02:00:00Z",
  rowResults: [],
};

describe("sample point identity governance", () => {
  it("uploads one bound historical governance workbook with a fresh request key", async () => {
    const user = userEvent.setup();
    const uploadSampleIdentityMergeWorkbook = vi
      .fn()
      .mockResolvedValue(mergeJob);
    const listSampleIdentityReviews = vi.fn().mockResolvedValue([]);
    const repository = {
      loadCurrentSession: vi.fn().mockResolvedValue(session),
      listSampleIdentityReviews,
      listSampleIdentityMergeJobs: vi.fn().mockResolvedValue([]),
      listSampleIdentityMergeRequests: vi.fn().mockResolvedValue([]),
      uploadSampleIdentityMergeWorkbook,
      subscribeBusinessEvents: vi.fn().mockReturnValue(() => undefined),
    } as unknown as RealtimeBusinessRepository;

    render(<SamplePointIdentityGovernancePanel repository={repository} />);
    const file = new File(["xlsx"], "历史身份治理.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    await user.upload(
      await screen.findByLabelText("选择历史身份治理文件"),
      file,
    );
    await user.click(
      screen.getByRole("button", { name: "上传并校验身份治理文件" }),
    );

    await waitFor(() =>
      expect(uploadSampleIdentityMergeWorkbook).toHaveBeenCalledWith(
        file,
        expect.any(String),
      ),
    );
    expect(
      await screen.findByText("上传完成，1 条归并申请等待审核。"),
    ).toBeVisible();
    expect(listSampleIdentityReviews).not.toHaveBeenCalled();
  });
});
