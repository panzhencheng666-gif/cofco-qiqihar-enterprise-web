import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  CurrentSession,
  RealtimeBusinessRepository,
  SamplePointCoordinateCorrectionJob,
  SamplePointCoordinateCorrectionRequest,
} from "@/platform/api/realtimeBusinessRepository";

import { SamplePointCoordinateGovernancePanel } from "./SamplePointCoordinateGovernancePanel";

afterEach(cleanup);

const session: CurrentSession = {
  subjectId: "reviewer-1",
  displayName: "审核员",
  workUnitCode: "TEST",
  workUnitName: "测试单位",
  accountStatus: "ACTIVE",
  employmentStatus: "ACTIVE",
  roleCodes: ["BUSINESS_REVIEWER"],
  positions: [],
  permissions: ["BUSINESS_IMPORT", "BUSINESS_APPROVE"],
  regionCodes: ["230202"],
};

const job: SamplePointCoordinateCorrectionJob = {
  jobId: "job-1",
  batchId: "batch-1",
  requestedBy: "operator-1",
  workUnitCode: "TEST",
  statusCode: "COMPLETED_WITH_ERRORS",
  totalRows: 2,
  pendingReviewRows: 0,
  failedRows: 2,
  retryOf: null,
  createdAt: "2026-08-20T01:00:00Z",
  completedAt: "2026-08-20T01:00:00Z",
  rowResults: [],
};

const request: SamplePointCoordinateCorrectionRequest = {
  requestId: "request-1",
  samplePointId: "point-1",
  expectedVersion: 2,
  canonicalName: "富裕县第一样本点",
  regionCode: "230227",
  regionName: "富裕县",
  originalLongitude: 123.51,
  originalLatitude: 47.92,
  correctedLongitude: 123.5101,
  correctedLatitude: 47.9201,
  coordinateSource: "现场重新定位",
  correctionNote: "已核对经营地址",
  coordinateCollectedAt: "2026-08-19T01:00:00Z",
  verifiedAddress: "富裕县测试村",
  changeReason: "现场复核定位偏移",
  evidenceReference: "现场核验记录 01",
  requestedBy: "operator-1",
  createdAt: "2026-08-20T01:00:00Z",
  statusCode: "PENDING_REVIEW",
  reviewedBy: null,
  reviewReason: null,
  reviewedAt: null,
};

describe("sample point coordinate governance", () => {
  it("uses durable backend history and exposes the independent review workflow", async () => {
    const user = userEvent.setup();
    const reviewSamplePointCoordinateCorrection = vi
      .fn()
      .mockResolvedValue({ ...request, statusCode: "APPLIED" });
    const repository = {
      loadCurrentSession: vi.fn().mockResolvedValue(session),
      listSamplePointCoordinateCorrectionJobs: vi.fn().mockResolvedValue([job]),
      listSamplePointCoordinateCorrectionRequests: vi
        .fn()
        .mockResolvedValue([request]),
      reviewSamplePointCoordinateCorrection,
      subscribeBusinessEvents: vi.fn().mockReturnValue(() => undefined),
    } as unknown as RealtimeBusinessRepository;
    vi.spyOn(window, "prompt").mockReturnValue("现场依据完整");

    render(<SamplePointCoordinateGovernancePanel repository={repository} />);

    expect(
      await screen.findByRole("region", { name: "样本点坐标治理" }),
    ).toHaveTextContent("失败 2 行");
    expect(
      screen.getByRole("region", { name: "样本点坐标治理" }),
    ).not.toHaveTextContent(/job-1|batch-1|point-1/u);
    expect(
      screen.getByRole("region", { name: "样本点坐标治理" }),
    ).toHaveTextContent("平台唯一所有者可按特权规则自审并全程留痕");
    expect(screen.getByText("富裕县第一样本点")).toBeVisible();
    expect(screen.getByText("富裕县测试村")).toBeVisible();
    expect(screen.getByText("现场复核定位偏移")).toBeVisible();
    expect(screen.getByText("现场核验记录 01")).toBeVisible();
    expect(screen.getByText("2026/08/19 09:00:00")).toBeVisible();
    expect(screen.queryByText("230227")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "审核通过富裕县第一样本点" }),
    );
    await waitFor(() =>
      expect(reviewSamplePointCoordinateCorrection).toHaveBeenCalledWith(
        "request-1",
        "APPROVE",
        "现场依据完整",
      ),
    );
  });

  it("uploads one real workbook and retains backend results", async () => {
    const user = userEvent.setup();
    const uploaded = { ...job, statusCode: "PENDING_REVIEW", failedRows: 0 };
    const uploadSamplePointCoordinateCorrectionWorkbook = vi
      .fn()
      .mockResolvedValue(uploaded);
    const repository = {
      loadCurrentSession: vi.fn().mockResolvedValue(session),
      listSamplePointCoordinateCorrectionJobs: vi.fn().mockResolvedValue([]),
      listSamplePointCoordinateCorrectionRequests: vi
        .fn()
        .mockResolvedValue([]),
      uploadSamplePointCoordinateCorrectionWorkbook,
      subscribeBusinessEvents: vi.fn().mockReturnValue(() => undefined),
    } as unknown as RealtimeBusinessRepository;

    render(<SamplePointCoordinateGovernancePanel repository={repository} />);
    const file = new File(["xlsx"], "坐标修正.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    await user.upload(await screen.findByLabelText("选择坐标修正文件"), file);
    await user.click(
      screen.getByRole("button", { name: "上传并校验坐标修正文件" }),
    );

    await waitFor(() =>
      expect(
        uploadSamplePointCoordinateCorrectionWorkbook,
      ).toHaveBeenCalledWith(file, expect.any(String)),
    );
    expect(
      await screen.findByText("上传完成，1 行已进入独立审核。"),
    ).toBeVisible();
  });

  it("retries only failed rows with a stable request key", async () => {
    const user = userEvent.setup();
    const retrySamplePointCoordinateCorrectionJob = vi
      .fn()
      .mockResolvedValue({ ...job, jobId: "job-2", retryOf: "job-1" });
    const repository = {
      loadCurrentSession: vi.fn().mockResolvedValue(session),
      listSamplePointCoordinateCorrectionJobs: vi.fn().mockResolvedValue([job]),
      listSamplePointCoordinateCorrectionRequests: vi
        .fn()
        .mockResolvedValue([]),
      retrySamplePointCoordinateCorrectionJob,
      subscribeBusinessEvents: vi.fn().mockReturnValue(() => undefined),
    } as unknown as RealtimeBusinessRepository;

    render(<SamplePointCoordinateGovernancePanel repository={repository} />);
    await user.click(
      await screen.findByRole("button", { name: "重试该任务的失败行" }),
    );

    await waitFor(() =>
      expect(retrySamplePointCoordinateCorrectionJob).toHaveBeenCalledWith(
        "job-1",
        expect.any(String),
      ),
    );
  });

  it("requeries durable history and review queue after an applied SSE event", async () => {
    let onChange: ((event: unknown) => void) | undefined;
    const listJobs = vi.fn().mockResolvedValue([job]);
    const listRequests = vi.fn().mockResolvedValue([request]);
    const subscribeBusinessEvents = vi.fn(
      (_afterSequence: number, listener: (event: unknown) => void) => {
        onChange = listener;
        return () => undefined;
      },
    );
    const repository = {
      loadCurrentSession: vi.fn().mockResolvedValue(session),
      listSamplePointCoordinateCorrectionJobs: listJobs,
      listSamplePointCoordinateCorrectionRequests: listRequests,
      subscribeBusinessEvents,
    } as unknown as RealtimeBusinessRepository;

    render(<SamplePointCoordinateGovernancePanel repository={repository} />);
    await waitFor(() => expect(listRequests).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(subscribeBusinessEvents).toHaveBeenCalledTimes(1),
    );

    act(() => {
      onChange?.({
        actionCode: "SAMPLE_POINT_COORDINATE_CORRECTION_APPLIED",
        sequence: 42,
      });
    });

    await waitFor(() => expect(listJobs).toHaveBeenCalledTimes(2));
    expect(listRequests).toHaveBeenCalledTimes(2);
  });

  it("does not expose review actions to an operator without approval permission", async () => {
    const listRequests = vi.fn();
    const repository = {
      loadCurrentSession: vi.fn().mockResolvedValue({
        ...session,
        subjectId: "operator-1",
        permissions: ["BUSINESS_IMPORT"],
      }),
      listSamplePointCoordinateCorrectionJobs: vi.fn().mockResolvedValue([job]),
      listSamplePointCoordinateCorrectionRequests: listRequests,
      subscribeBusinessEvents: vi.fn().mockReturnValue(() => undefined),
    } as unknown as RealtimeBusinessRepository;

    render(<SamplePointCoordinateGovernancePanel repository={repository} />);

    expect(
      await screen.findByRole("region", { name: "样本点坐标治理" }),
    ).toHaveTextContent("失败 2 行");
    expect(screen.queryByText("独立审核队列")).not.toBeInTheDocument();
    expect(listRequests).not.toHaveBeenCalled();
  });
});
