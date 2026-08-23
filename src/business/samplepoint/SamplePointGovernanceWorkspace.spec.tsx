import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  CurrentSession,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { SamplePointGovernanceWorkspace } from "./SamplePointGovernanceWorkspace";

afterEach(cleanup);

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
    expect(screen.getByRole("tab", { name: "年度现有样本" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      await screen.findByRole("region", { name: "年度样本网络管理" }),
    ).toBeVisible();
    expect(screen.queryByRole("region", { name: "样本点坐标治理" })).toBeNull();
    expect(screen.queryByRole("region", { name: "样本点身份治理" })).toBeNull();

    await userEvent.click(screen.getByRole("tab", { name: "设计参考点" }));

    expect(
      await screen.findByRole("table", { name: "设计参考点清单" }),
    ).toBeVisible();
    expect(screen.getByText("众兴村")).toBeVisible();
    expect(
      screen.queryByRole("columnheader", { name: "行政区代码" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("230231100201")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "年度样本网络管理" }),
    ).toBeNull();
  });

  it("keeps the selected module and reloads only for realtime changes to its year", async () => {
    const initialRepository = repository();
    const getComparison = vi.fn(
      (year: number, regionCode?: string, productCode?: string) =>
        initialRepository.getSampleNetworkComparison!(
          year,
          regionCode,
          productCode,
        ),
    );
    const data = {
      ...initialRepository,
      getSampleNetworkComparison: getComparison,
    } as RealtimeBusinessRepository;
    const { rerender } = render(
      <SamplePointGovernanceWorkspace
        currentYear={2026}
        refreshSequenceByYear={{}}
        repository={data}
        session={session}
      />,
    );

    await screen.findByRole("region", { name: "年度样本网络管理" });
    await userEvent.click(screen.getByRole("tab", { name: "设计参考点" }));
    await screen.findByRole("table", { name: "设计参考点清单" });
    expect(getComparison).toHaveBeenCalledTimes(2);

    rerender(
      <SamplePointGovernanceWorkspace
        currentYear={2026}
        refreshSequenceByYear={{ 2025: 1 }}
        repository={data}
        session={session}
      />,
    );
    expect(screen.getByRole("tab", { name: "设计参考点" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(getComparison).toHaveBeenCalledTimes(2);

    rerender(
      <SamplePointGovernanceWorkspace
        currentYear={2026}
        refreshSequenceByYear={{ 2025: 1, 2026: 1 }}
        repository={data}
        session={session}
      />,
    );
    await vi.waitFor(() => expect(getComparison).toHaveBeenCalledTimes(3));
    expect(screen.getByRole("tab", { name: "设计参考点" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
