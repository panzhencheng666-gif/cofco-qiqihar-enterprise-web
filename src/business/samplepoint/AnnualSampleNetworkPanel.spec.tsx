import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  CurrentSession,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { AnnualSampleNetworkPanel } from "./AnnualSampleNetworkPanel";

afterEach(cleanup);

const session = {
  subjectId: "reviewer-1",
  displayName: "审核员",
  workUnitCode: "QIQIHAR_BUSINESS",
  workUnitName: "齐齐哈尔经营部",
  accountStatus: "ACTIVE",
  employmentStatus: "ACTIVE",
  roleCodes: ["BUSINESS_REVIEWER"],
  positions: [
    {
      code: "BUSINESS_REVIEWER",
      name: "业务审核员",
      primaryPosition: true,
    },
  ],
  permissions: [
    "BUSINESS_CREATE",
    "BUSINESS_UPDATE",
    "BUSINESS_SUBMIT",
    "BUSINESS_APPROVE",
    "BUSINESS_RETURN",
  ],
  regionCodes: ["230200"],
} satisfies CurrentSession;

describe("AnnualSampleNetworkPanel", () => {
  it("activates a carried candidate and submits the draft by optimistic version", async () => {
    const updateSampleNetworkMember = vi
      .fn()
      .mockResolvedValue(network("DRAFT"));
    const submitSampleNetwork = vi.fn().mockResolvedValue(network("IN_REVIEW"));
    const repository = {
      getSampleNetwork: vi.fn().mockResolvedValue(network("DRAFT")),
      updateSampleNetworkMember,
      submitSampleNetwork,
    } as unknown as RealtimeBusinessRepository;

    render(
      <AnnualSampleNetworkPanel
        currentYear={2027}
        repository={repository}
        session={session}
      />,
    );

    expect(await screen.findByText("契约测试村现有样本点")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "启用" }));
    expect(updateSampleNetworkMember).toHaveBeenCalledWith(
      2027,
      "94000000-0000-0000-0000-000000000001",
      {
        villageRegionCode: "230202997001",
        statusCode: "ACTIVE",
        sourceCode: "CARRIED_FORWARD",
        reason: "确认纳入2027年度现有样本网络",
        version: 0,
      },
    );

    await userEvent.click(screen.getByRole("button", { name: "提交独立审核" }));
    await waitFor(() =>
      expect(submitSampleNetwork).toHaveBeenCalledWith(2027, 3),
    );
  });

  it("creates the current-year network without copying prior business facts", async () => {
    const generateSampleNetworkCandidates = vi
      .fn()
      .mockResolvedValue(network("DRAFT"));
    const repository = {
      getSampleNetwork: vi.fn().mockRejectedValue({ status: 404 }),
      generateSampleNetworkCandidates,
    } as unknown as RealtimeBusinessRepository;

    render(
      <AnnualSampleNetworkPanel
        currentYear={2026}
        repository={repository}
        session={session}
      />,
    );

    expect(await screen.findByText("2026年度样本网络尚未创建")).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: "创建2026年度空白网络" }),
    );

    expect(generateSampleNetworkCandidates).toHaveBeenCalledWith(
      2026,
      undefined,
    );
    expect(
      screen.getByText("仅创建年度名单，不复制产量、价格、库存等业务数据。"),
    ).toBeVisible();
  });
});

function network(statusCode: "DRAFT" | "IN_REVIEW") {
  return {
    networkYear: 2027,
    statusCode,
    carriedFromYear: 2026,
    version: 3,
    createdBy: "creator-1",
    createdAt: "2026-12-20T08:00:00Z",
    submittedBy: statusCode === "IN_REVIEW" ? "creator-1" : null,
    submittedAt: statusCode === "IN_REVIEW" ? "2026-12-21T08:00:00Z" : null,
    reviewedBy: null,
    reviewedAt: null,
    reviewReason: null,
    memberships: [
      {
        samplePointId: "94000000-0000-0000-0000-000000000001",
        samplePointName: "契约测试村现有样本点",
        samplePointKindCode: "SURVEY_SITE",
        villageRegionCode: "230202997001",
        villageName: "契约测试村",
        statusCode: "CANDIDATE",
        sourceCode: "CARRIED_FORWARD",
        decisionReason: null,
        version: 0,
        longitude: 123.8,
        latitude: 47.2,
      },
    ],
  };
}
