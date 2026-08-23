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
      getSampleNetworkComparison: vi.fn().mockResolvedValue({
        relations: [
          {
            samplePointId: "94000000-0000-0000-0000-000000000001",
            designVillageRegionCode: "230202997001",
            relationType: "REGIONAL_ASSOCIATION",
            evidenceReference: null,
            reviewStatus: null,
            createdBy: null,
            createdAt: null,
            reviewedBy: null,
            reviewedAt: null,
          },
        ],
      }),
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
        designVillageRegionCode: undefined,
        relationType: undefined,
        evidenceReference: undefined,
        statusCode: "ACTIVE",
        sourceCode: "CARRIED_FORWARD",
        reason: "确认纳入2027年度现有样本网络",
        version: 0,
      },
    );

    const memberTable = screen.getByRole("region", { name: "年度样本成员" });
    expect(memberTable).toHaveTextContent("所在地层级/区域");
    expect(memberTable).toHaveTextContent("村级 / 契约测试村");
    expect(memberTable).toHaveTextContent("设计关系");
    await waitFor(() =>
      expect(memberTable).toHaveTextContent("区域关联（系统推导）"),
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

  it("uses the nearest loaded published earlier year when creating the next annual network", async () => {
    const generateSampleNetworkCandidates = vi
      .fn()
      .mockResolvedValue(network("DRAFT", 2029));
    const repository = {
      getSampleNetwork: vi.fn((year: number) => {
        if (year === 2028) return Promise.resolve(network("DRAFT", 2028, 2026));
        if (year === 2026) return Promise.resolve(network("PUBLISHED", 2026));
        return Promise.reject(
          Object.assign(new Error("not found"), { status: 404 }),
        );
      }),
      generateSampleNetworkCandidates,
    } as unknown as RealtimeBusinessRepository;

    render(
      <AnnualSampleNetworkPanel
        currentYear={2028}
        repository={repository}
        session={session}
      />,
    );

    await screen.findByText("2028年度");
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "年度" }),
      "2026",
    );
    await screen.findByText("2026年度");
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "年度" }),
      "2029",
    );
    expect(await screen.findByText("2029年度样本网络尚未创建")).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: "生成2029年度候选名单" }),
    );

    expect(generateSampleNetworkCandidates).toHaveBeenCalledWith(2029, 2026);
  });

  it("discovers the nearest earlier published network before creating a candidate", async () => {
    const generateSampleNetworkCandidates = vi
      .fn()
      .mockResolvedValue(network("DRAFT", 2029));
    const getSampleNetwork = vi.fn((year: number) => {
      if (year === 2028) return Promise.resolve(network("DRAFT", 2028));
      if (year === 2027) return Promise.resolve(network("PUBLISHED", 2027));
      return Promise.reject(
        Object.assign(new Error("not found"), { status: 404 }),
      );
    });
    const repository = {
      getSampleNetwork,
      generateSampleNetworkCandidates,
    } as unknown as RealtimeBusinessRepository;

    render(
      <AnnualSampleNetworkPanel
        currentYear={2029}
        repository={repository}
        session={session}
      />,
    );

    expect(await screen.findByText("2029年度样本网络尚未创建")).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: "创建2029年度空白网络" }),
    );

    await waitFor(() =>
      expect(generateSampleNetworkCandidates).toHaveBeenCalledWith(2029, 2027),
    );
    expect(getSampleNetwork).toHaveBeenCalledWith(2028);
    expect(getSampleNetwork).toHaveBeenCalledWith(2027);
  });

  it("shows relationship loading and failure instead of treating them as no relationship", async () => {
    let rejectComparison: ((reason?: unknown) => void) | undefined;
    const repository = {
      getSampleNetwork: vi.fn().mockResolvedValue(network("DRAFT")),
      getSampleNetworkComparison: vi.fn(
        () =>
          new Promise((_, reject) => {
            rejectComparison = reject;
          }),
      ),
    } as unknown as RealtimeBusinessRepository;

    render(
      <AnnualSampleNetworkPanel
        currentYear={2027}
        repository={repository}
        session={session}
      />,
    );

    const memberTable = await screen.findByRole("region", {
      name: "年度样本成员",
    });
    expect(memberTable).toHaveTextContent("正在读取设计关系…");
    rejectComparison?.(new Error("comparison unavailable"));
    await waitFor(() =>
      expect(memberTable).toHaveTextContent("设计关系暂不可用"),
    );
  });

  it("refreshes the comparison relation after adding an exact member", async () => {
    const updateSampleNetworkMember = vi
      .fn()
      .mockResolvedValue(network("DRAFT"));
    const getSampleNetworkComparison = vi
      .fn()
      .mockResolvedValueOnce({ relations: [] })
      .mockResolvedValueOnce({
        relations: [
          relation({
            samplePointId: "94000000-0000-0000-0000-000000000099",
            relationType: "EXACT_VILLAGE",
            reviewStatus: "PENDING_REVIEW",
          }),
        ],
      });
    const repository = {
      getSampleNetwork: vi.fn().mockResolvedValue(network("DRAFT")),
      getSampleNetworkComparison,
      updateSampleNetworkMember,
    } as unknown as RealtimeBusinessRepository;

    render(
      <AnnualSampleNetworkPanel
        currentYear={2027}
        repository={repository}
        session={session}
      />,
    );

    await screen.findByText("契约测试村现有样本点");
    await userEvent.type(
      screen.getByRole("textbox", { name: "稳定样本点ID" }),
      "94000000-0000-0000-0000-000000000099",
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "设计关系" }),
      "EXACT_VILLAGE",
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "设计行政村代码" }),
      "230202997001",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "新增现有样本点" }),
    );

    await waitFor(() =>
      expect(getSampleNetworkComparison).toHaveBeenCalledTimes(2),
    );
  });

  it("does not replay a returned relationship during an ordinary member status update", async () => {
    const updateSampleNetworkMember = vi
      .fn()
      .mockResolvedValue(network("DRAFT"));
    const repository = {
      getSampleNetwork: vi.fn().mockResolvedValue(network("DRAFT")),
      getSampleNetworkComparison: vi.fn().mockResolvedValue({
        relations: [
          relation({
            relationType: "EXACT_VILLAGE",
            reviewStatus: "RETURNED",
          }),
        ],
      }),
      updateSampleNetworkMember,
    } as unknown as RealtimeBusinessRepository;

    render(
      <AnnualSampleNetworkPanel
        currentYear={2027}
        repository={repository}
        session={session}
      />,
    );

    await screen.findByText("契约测试村现有样本点");
    await waitFor(() =>
      expect(screen.getByText("精确对应（230202997001）")).toBeVisible(),
    );
    await userEvent.click(screen.getByRole("button", { name: "启用" }));

    expect(updateSampleNetworkMember).toHaveBeenCalledWith(
      2027,
      "94000000-0000-0000-0000-000000000001",
      expect.objectContaining({
        designVillageRegionCode: undefined,
        relationType: undefined,
        evidenceReference: undefined,
      }),
    );
  });

  it("allows a new actual sample at any administrative level without a design village", async () => {
    const updateSampleNetworkMember = vi
      .fn()
      .mockResolvedValue(network("DRAFT"));
    const repository = {
      getSampleNetwork: vi.fn().mockResolvedValue(network("DRAFT")),
      updateSampleNetworkMember,
    } as unknown as RealtimeBusinessRepository;

    render(
      <AnnualSampleNetworkPanel
        currentYear={2027}
        repository={repository}
        session={session}
      />,
    );

    await screen.findByText("契约测试村现有样本点");
    await userEvent.type(
      screen.getByRole("textbox", { name: "稳定样本点ID" }),
      "94000000-0000-0000-0000-000000000099",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "新增现有样本点" }),
    );

    await waitFor(() =>
      expect(updateSampleNetworkMember).toHaveBeenCalledWith(
        2027,
        "94000000-0000-0000-0000-000000000099",
        {
          designVillageRegionCode: undefined,
          relationType: undefined,
          evidenceReference: undefined,
          statusCode: "ACTIVE",
          sourceCode: "NEW",
          reason: "新增2027年度现有样本点",
          version: 0,
        },
      ),
    );
  });

  it("requires a design village only for selected relations and evidence for explicit representation", async () => {
    const updateSampleNetworkMember = vi
      .fn()
      .mockResolvedValue(network("DRAFT"));
    const repository = {
      getSampleNetwork: vi.fn().mockResolvedValue(network("DRAFT")),
      updateSampleNetworkMember,
    } as unknown as RealtimeBusinessRepository;

    render(
      <AnnualSampleNetworkPanel
        currentYear={2027}
        repository={repository}
        session={session}
      />,
    );

    await screen.findByText("契约测试村现有样本点");
    await userEvent.type(
      screen.getByRole("textbox", { name: "稳定样本点ID" }),
      "94000000-0000-0000-0000-000000000099",
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "设计关系" }),
      "EXPLICIT_REPRESENTATION",
    );
    expect(
      screen.getByRole("button", { name: "新增现有样本点" }),
    ).toBeDisabled();

    await userEvent.type(
      screen.getByRole("textbox", { name: "设计行政村代码" }),
      "230202997001",
    );
    expect(
      screen.getByRole("button", { name: "新增现有样本点" }),
    ).toBeDisabled();

    await userEvent.type(
      screen.getByRole("textbox", { name: "明确代表依据" }),
      "现场踏勘确认代表关系",
    );
    expect(
      screen.getByRole("button", { name: "新增现有样本点" }),
    ).toBeEnabled();
    await userEvent.click(
      screen.getByRole("button", { name: "新增现有样本点" }),
    );
    await waitFor(() =>
      expect(updateSampleNetworkMember).toHaveBeenCalledWith(
        2027,
        "94000000-0000-0000-0000-000000000099",
        {
          designVillageRegionCode: "230202997001",
          relationType: "EXPLICIT_REPRESENTATION",
          evidenceReference: "现场踏勘确认代表关系",
          statusCode: "ACTIVE",
          sourceCode: "NEW",
          reason: "新增2027年度现有样本点",
          version: 0,
        },
      ),
    );
  });
});

function relation({
  samplePointId = "94000000-0000-0000-0000-000000000001",
  relationType,
  reviewStatus,
}: {
  samplePointId?: string;
  relationType: "EXACT_VILLAGE" | "EXPLICIT_REPRESENTATION";
  reviewStatus: "PENDING_REVIEW" | "RETURNED";
}) {
  return {
    samplePointId,
    designVillageRegionCode: "230202997001",
    relationType,
    evidenceReference:
      relationType === "EXPLICIT_REPRESENTATION"
        ? "现场踏勘确认代表关系"
        : null,
    reviewStatus,
    createdBy: "operator-1",
    createdAt: "2026-12-20T08:00:00Z",
    reviewedBy: null,
    reviewedAt: null,
  };
}

function network(
  statusCode: "DRAFT" | "IN_REVIEW" | "PUBLISHED",
  networkYear = 2027,
  carriedFromYear = 2026,
) {
  return {
    networkYear,
    statusCode,
    carriedFromYear,
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
        locatedRegionCode: "230202997001",
        locatedRegionName: "契约测试村",
        locatedRegionLevel: "VILLAGE",
        statusCode: "CANDIDATE",
        sourceCode: "CARRIED_FORWARD",
        decisionReason: null,
        version: 0,
        longitude: 123.8,
        latitude: 47.2,
        locationState: "CONFIRMED",
      },
    ],
  };
}
