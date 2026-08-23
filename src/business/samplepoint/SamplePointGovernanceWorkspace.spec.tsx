import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type {
  CurrentSession,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { SamplePointGovernanceWorkspace } from "./SamplePointGovernanceWorkspace";

const session: CurrentSession = {
  subjectId: "governance-user",
  displayName: "治理专员",
  workUnitCode: "QIQIHAR_BUSINESS",
  workUnitName: "齐齐哈尔经营部",
  accountStatus: "ACTIVE",
  employmentStatus: "ACTIVE",
  roleCodes: ["BUSINESS_OPERATOR"],
  positions: [],
  permissions: ["BUSINESS_READ", "BUSINESS_IMPORT", "BUSINESS_APPROVE"],
  regionCodes: ["230200"],
};

function repository(): RealtimeBusinessRepository {
  return {
    getSampleNetwork: vi.fn().mockResolvedValue({
      networkYear: 2026,
      statusCode: "PUBLISHED",
      carriedFromYear: null,
      version: 3,
      createdBy: "operator",
      createdAt: "2026-08-20T00:00:00Z",
      submittedBy: "operator",
      submittedAt: "2026-08-20T01:00:00Z",
      reviewedBy: "reviewer",
      reviewedAt: "2026-08-20T02:00:00Z",
      reviewReason: "通过",
      memberships: [],
    }),
    getSampleNetworkComparison: vi.fn().mockResolvedValue({
      networkYear: 2026,
      networkStatus: "PUBLISHED",
      designPointCount: 1,
      designCoordinateCount: 0,
      activeSamplePointCount: 0,
      approvedSubmissionSamplePointCount: 0,
      pendingVerificationDesignPointCount: 1,
      multipleActualPerDesignPointCount: 0,
      anomalyCount: 0,
      exactCoveredDesignPointCount: 0,
      representedDesignPointCount: 0,
      regionalAssociationDesignPointCount: 0,
      unrelatedDesignPointCount: 1,
      actualLevelCounts: { prefecture: 0, county: 0, township: 0, village: 0 },
      designPoints: [
        {
          villageRegionCode: "230231100201",
          villageName: "众兴村",
          townshipRegionCode: "230231100",
          townshipName: "兴农镇",
          countyRegionCode: "230231",
          countyName: "拜泉县",
          designLongitude: 126.1,
          designLatitude: 47.62,
        },
      ],
      actualPoints: [],
      relations: [],
    }),
  } as unknown as RealtimeBusinessRepository;
}

describe("SamplePointGovernanceWorkspace", () => {
  it("uses one table-led module at a time instead of stacking governance cards", async () => {
    render(
      <SamplePointGovernanceWorkspace
        currentYear={2026}
        repository={repository()}
        session={session}
      />,
    );

    expect(screen.getByRole("heading", { name: "样本点管理" })).toBeVisible();
    expect(
      screen.getByRole("tablist", { name: "样本点治理模块" }),
    ).toBeVisible();
    expect(screen.getByRole("tab", { name: "年度在网样本" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      await screen.findByRole("region", { name: "年度样本网络管理" }),
    ).toBeVisible();
    expect(screen.queryByRole("region", { name: "样本点坐标治理" })).toBeNull();
    expect(screen.queryByRole("region", { name: "样本点身份治理" })).toBeNull();

    await userEvent.click(screen.getByRole("tab", { name: "设计样本" }));

    expect(
      await screen.findByRole("table", { name: "设计样本清单" }),
    ).toBeVisible();
    expect(screen.getByText("众兴村")).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "年度样本网络管理" }),
    ).toBeNull();
  });
});
