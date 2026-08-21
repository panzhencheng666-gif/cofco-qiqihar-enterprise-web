import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  CurrentSession,
  RealtimeBusinessRepository,
  SampleIdentityMergeJob,
  SampleIdentityMergeRequest,
  SampleIdentityReviewItem,
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

const reviewItem: SampleIdentityReviewItem = {
  draftId: "draft-1",
  version: 2,
  domainCode: "PRODUCTION",
  productCode: "CORN",
  sampleName: "王振锋",
  sampleContact: "13800000001",
  regionCode: "230281",
  longitude: 122.48,
  latitude: 48.07,
  surveyPeriod: "2026-08",
  reasonCode: "SAMPLE_IDENTITY_MULTIPLE_EXACT",
  reasonMessage: "发现多个身份候选，请核验真实对象",
  createdBy: "wang-yang",
  createdAt: "2026-08-20T01:00:00Z",
  candidates: [
    {
      samplePointId: "point-1",
      canonicalName: "王振锋",
      sampleContact: "13800000001",
      regionCode: "230281",
      longitude: 122.48,
      latitude: 48.07,
      approvedRecordCount: 3,
      effectiveFrom: "2024-01-01",
    },
  ],
};

const colocationReviewItem: SampleIdentityReviewItem = {
  ...reviewItem,
  draftId: "draft-shared-coordinate",
  sampleName: "同址另一经营主体",
  sampleContact: "13900000002",
  reasonCode: "SAMPLE_COORDINATE_SHARED_REVIEW_REQUIRED",
  reasonMessage:
    "该经纬度已由其他样本点使用；如确属不同对象共用地址，需核验证据后继续",
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

const mergeRequest: SampleIdentityMergeRequest = {
  requestId: "merge-request-1",
  sourceDomain: "PRODUCTION",
  sourceRecordId: "record-2",
  currentSamplePointId: "point-2",
  targetSamplePointId: "point-1",
  regionCode: "230281",
  reviewBasis: "名称、联系方式、地区和坐标均一致",
  requestedBy: "wang-yang",
  statusCode: "PENDING_REVIEW",
  reviewedBy: null,
  reviewReason: null,
  reviewedAt: null,
  resolutionBatchId: null,
  privilegedSelfReview: false,
};

describe("sample point identity governance", () => {
  it("explains coordinate colocation review and requires an explicit evidence decision", async () => {
    const user = userEvent.setup();
    const decideSampleIdentityReview = vi.fn().mockResolvedValue({});
    const repository = {
      loadCurrentSession: vi.fn().mockResolvedValue(session),
      listSampleIdentityReviews: vi
        .fn()
        .mockResolvedValue([colocationReviewItem]),
      listSampleIdentityMergeJobs: vi.fn().mockResolvedValue([]),
      listSampleIdentityMergeRequests: vi.fn().mockResolvedValue([]),
      decideSampleIdentityReview,
      subscribeBusinessEvents: vi.fn().mockReturnValue(() => undefined),
    } as unknown as RealtimeBusinessRepository;
    vi.spyOn(window, "prompt").mockReturnValue(
      "营业主体和联系电话不同，现场门牌材料证明合法共址",
    );

    render(<SamplePointIdentityGovernancePanel repository={repository} />);

    expect(await screen.findByText("坐标共址待核验")).toBeVisible();
    expect(
      screen.getByText(
        "确认前请核对经营主体、联系方式、现场地址或其他真实材料；证据不足请退回补充。",
      ),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "确认合法共址同址另一经营主体" }),
    );
    await waitFor(() =>
      expect(decideSampleIdentityReview).toHaveBeenCalledWith(
        "draft-shared-coordinate",
        "CONFIRM_DISTINCT",
        null,
        2,
        "营业主体和联系电话不同，现场门牌材料证明合法共址",
      ),
    );
  });

  it("continues an ambiguous import and independently reviews a historical merge", async () => {
    const user = userEvent.setup();
    const decideSampleIdentityReview = vi.fn().mockResolvedValue({});
    const reviewSampleIdentityMergeRequest = vi.fn().mockResolvedValue({});
    const repository = {
      loadCurrentSession: vi.fn().mockResolvedValue(session),
      listSampleIdentityReviews: vi.fn().mockResolvedValue([reviewItem]),
      listSampleIdentityMergeJobs: vi.fn().mockResolvedValue([mergeJob]),
      listSampleIdentityMergeRequests: vi
        .fn()
        .mockResolvedValue([mergeRequest]),
      decideSampleIdentityReview,
      reviewSampleIdentityMergeRequest,
      subscribeBusinessEvents: vi.fn().mockReturnValue(() => undefined),
    } as unknown as RealtimeBusinessRepository;
    vi.spyOn(window, "prompt")
      .mockReturnValueOnce("核对历史记录后确认同一真实样本点")
      .mockReturnValueOnce("独立复核归并依据完整");

    render(<SamplePointIdentityGovernancePanel repository={repository} />);

    expect(
      await screen.findByRole("region", { name: "样本点身份治理" }),
    ).toHaveTextContent("王振锋");
    await user.selectOptions(
      screen.getByLabelText("选择王振锋的规范样本点"),
      "point-1",
    );
    await user.click(
      screen.getByRole("button", { name: "关联已有样本点王振锋" }),
    );
    await waitFor(() =>
      expect(decideSampleIdentityReview).toHaveBeenCalledWith(
        "draft-1",
        "LINK_EXISTING",
        "point-1",
        2,
        "核对历史记录后确认同一真实样本点",
      ),
    );

    await user.click(
      screen.getByRole("button", { name: "审核通过身份归并record-2" }),
    );
    await waitFor(() =>
      expect(reviewSampleIdentityMergeRequest).toHaveBeenCalledWith(
        "merge-request-1",
        "APPROVE",
        "独立复核归并依据完整",
      ),
    );
  });

  it("uploads one bound historical governance workbook with a fresh request key", async () => {
    const user = userEvent.setup();
    const uploadSampleIdentityMergeWorkbook = vi
      .fn()
      .mockResolvedValue(mergeJob);
    const repository = {
      loadCurrentSession: vi.fn().mockResolvedValue(session),
      listSampleIdentityReviews: vi.fn().mockResolvedValue([]),
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
  });
});
