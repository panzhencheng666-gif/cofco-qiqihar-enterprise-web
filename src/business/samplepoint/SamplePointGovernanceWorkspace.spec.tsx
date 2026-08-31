import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  BusinessNotificationRow,
  CurrentSession,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { SamplePointGovernanceWorkspace } from "./SamplePointGovernanceWorkspace";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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
      screen.getByRole("main", { name: "样本点管理工作台" }),
    ).toHaveAttribute("data-layout", "ledger-workbench");
    expect(
      screen.queryByRole("status", { name: "样本网络概况" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("tablist", { name: "样本点治理模块" }),
    ).toBeVisible();
    expect(screen.getByRole("tab", { name: "样本点名册" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "年度样本" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "变更与审核" })).toBeVisible();
    expect(
      await screen.findByRole("region", { name: "样本点身份治理" }),
    ).toBeVisible();
    expect(screen.queryByRole("region", { name: "样本点坐标治理" })).toBeNull();
    expect(
      screen.queryByRole("region", { name: "年度样本网络管理" }),
    ).toBeNull();

    await userEvent.click(screen.getByRole("tab", { name: "设计参考点" }));

    expect(
      await screen.findByRole("table", { name: "设计参考点清单" }),
    ).toBeVisible();
    expect(
      screen.getByRole("toolbar", { name: "设计参考点台账工具栏" }),
    ).toBeVisible();
    expect(
      screen.getByRole("region", { name: "设计参考点滚动清单" }),
    ).toHaveAttribute("tabindex", "0");
    expect(
      screen.getByRole("status", { name: "设计参考点概况" }),
    ).toBeVisible();
    expect(screen.getByText("众兴村")).toBeVisible();
    expect(
      screen.getByRole("main", { name: "样本点管理工作台" }),
    ).not.toHaveTextContent(/2[,]?332/u);
    expect(
      within(screen.getByRole("status", { name: "设计参考点概况" }))
        .getByText("设计参考点")
        .closest("div"),
    ).toHaveTextContent("1 个");
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

    await screen.findByRole("region", { name: "样本点身份治理" });
    await userEvent.click(screen.getByRole("tab", { name: "设计参考点" }));
    await screen.findByRole("table", { name: "设计参考点清单" });
    expect(getComparison).toHaveBeenCalledTimes(1);

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
    expect(getComparison).toHaveBeenCalledTimes(1);

    rerender(
      <SamplePointGovernanceWorkspace
        currentYear={2026}
        refreshSequenceByYear={{ 2025: 1, 2026: 1 }}
        repository={data}
        session={session}
      />,
    );
    await vi.waitFor(() => expect(getComparison).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("tab", { name: "设计参考点" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("debounces the V158 design dataset event into one authoritative comparison requery", async () => {
    vi.useFakeTimers();
    const initialRepository = repository();
    const initialComparison =
      await initialRepository.getSampleNetworkComparison!(2026);
    const getSampleNetworkComparison = vi
      .fn()
      .mockResolvedValueOnce(initialComparison)
      .mockResolvedValueOnce({
        ...initialComparison,
        designPointCount: 0,
        pendingVerificationDesignPointCount: 0,
        unrelatedDesignPointCount: 0,
        designPoints: [],
      });
    let onChange: ((event: BusinessNotificationRow) => void) | undefined;
    const unsubscribe = vi.fn();
    const subscribeBusinessEvents = vi.fn(
      (
        _afterSequence: number,
        listener: (event: BusinessNotificationRow) => void,
      ) => {
        onChange = listener;
        return unsubscribe;
      },
    );
    const data = {
      ...initialRepository,
      getSampleNetworkComparison,
      subscribeBusinessEvents,
    } as RealtimeBusinessRepository;
    const event: BusinessNotificationRow = {
      id: "event-v158",
      sequence: 42,
      aggregateType: "DESIGN_COORDINATE_DATASET",
      aggregateId: "legacy-village-design-coordinate-cleanup-v1",
      actionCode: "LEGACY_VILLAGE_DESIGN_COORDINATES_DELETED",
      productCode: null,
      surveyYear: null,
      regionCodes: ["230200"],
      occurredAt: "2026-08-31T04:00:00Z",
      read: false,
    };

    const view = render(
      <SamplePointGovernanceWorkspace
        currentYear={2026}
        repository={data}
        session={session}
      />,
    );
    await act(() => Promise.resolve());
    fireEvent.click(screen.getByRole("tab", { name: "设计参考点" }));
    expect(getSampleNetworkComparison).toHaveBeenCalledTimes(1);
    expect(subscribeBusinessEvents).toHaveBeenCalledWith(
      0,
      expect.any(Function),
    );

    act(() => {
      onChange?.({
        ...event,
        id: "unrelated-event",
        aggregateType: "SAMPLE_NETWORK_YEAR",
        actionCode: "SAMPLE_NETWORK_PUBLISHED",
        surveyYear: 2026,
      });
      vi.advanceTimersByTime(500);
    });
    expect(getSampleNetworkComparison).toHaveBeenCalledTimes(1);

    act(() => {
      onChange?.(event);
      vi.advanceTimersByTime(250);
      onChange?.({ ...event, id: "event-v158-replayed", sequence: 43 });
      vi.advanceTimersByTime(499);
    });
    expect(getSampleNetworkComparison).toHaveBeenCalledTimes(1);

    await act(() => {
      vi.advanceTimersByTime(1);
      return Promise.resolve();
    });
    expect(getSampleNetworkComparison).toHaveBeenCalledTimes(2);
    expect(
      within(screen.getByRole("status", { name: "设计参考点概况" }))
        .getByText("设计参考点")
        .closest("div"),
    ).toHaveTextContent("0 个");

    view.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("filters design references progressively and keeps the long list paged", async () => {
    const getSampleNetworkComparison = vi.fn().mockResolvedValue({
      networkYear: 2026,
      networkStatus: "PUBLISHED",
      designPointCount: 55,
      designCoordinateCount: 28,
      activeSamplePointCount: 0,
      approvedSubmissionSamplePointCount: 0,
      pendingVerificationDesignPointCount: 27,
      multipleActualPerDesignPointCount: 0,
      anomalyCount: 0,
      exactCoveredDesignPointCount: 0,
      representedDesignPointCount: 0,
      regionalAssociationDesignPointCount: 0,
      unrelatedDesignPointCount: 55,
      actualLevelCounts: { prefecture: 0, county: 0, township: 0, village: 0 },
      designPoints: Array.from({ length: 55 }, (_, index) => ({
        villageRegionCode: `230231100${String(index + 1).padStart(3, "0")}`,
        villageName: `参考村${index + 1}`,
        townshipRegionCode: index < 52 ? "230231100" : "230232100",
        townshipName: index < 52 ? "兴农镇" : "目标乡",
        countyRegionCode: index < 52 ? "230231" : "230232",
        countyName: index < 52 ? "拜泉县" : "目标县",
        designLongitude: 126.1,
        designLatitude: 47.62,
        coordinateReviewStatus:
          index % 2 === 0 ? "AUTHORITY_APPROVED" : undefined,
      })),
      actualPoints: [],
      relations: [],
    });
    const data = {
      ...repository(),
      getSampleNetworkComparison,
    } as RealtimeBusinessRepository;

    render(
      <SamplePointGovernanceWorkspace
        currentYear={2026}
        repository={data}
        session={session}
      />,
    );
    await userEvent.click(screen.getByRole("tab", { name: "设计参考点" }));

    const filters = await screen.findByRole("search", {
      name: "设计参考点筛选",
    });
    const table = screen.getByRole("table", { name: "设计参考点清单" });
    expect(within(table).getAllByRole("row")).toHaveLength(51);
    expect(screen.getByText("共 55 条 · 第 1 / 2 页")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "下一页" }));
    expect(screen.getByText("参考村55")).toBeVisible();

    await userEvent.selectOptions(
      within(filters).getByRole("combobox", { name: "所属区县" }),
      "目标县",
    );
    expect(
      within(filters).getByRole("combobox", { name: "所属乡镇" }),
    ).toBeVisible();
    await userEvent.type(
      within(filters).getByRole("searchbox", {
        name: "搜索行政村、乡镇或区县",
      }),
      "参考村55",
    );
    expect(screen.getByText("共 1 条 · 第 1 / 1 页")).toBeVisible();
    expect(screen.getByText("参考村55")).toBeVisible();
  });
});
