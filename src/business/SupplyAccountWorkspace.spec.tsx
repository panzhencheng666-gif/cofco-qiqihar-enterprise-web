import { readFileSync } from "node:fs";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  RealtimeApiError,
  type RealtimeApiClient,
} from "@/platform/api/realtimeApiClient";
import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";
import { SupplyAccountWorkspace } from "./SupplyAccountWorkspace";

afterEach(cleanup);

function historyPage(
  items: readonly unknown[] = [],
  pageNumber = 0,
  totalPages = 0,
) {
  return {
    items,
    pageNumber,
    pageSize: 10,
    totalElements: totalPages === 0 ? 0 : items.length,
    totalPages,
  };
}

function repository(): RealtimeBusinessRepository {
  return {
    loadMasterData: vi.fn().mockResolvedValue({
      products: [{ code: "CORN", name: "玉米" }],
      periods: [],
      approvedSurveyYears: [2026],
      regions: [
        {
          code: "230221",
          name: "龙江县",
          parentCode: "230200",
          level: "COUNTY",
        },
      ],
    }),
    loadSupplySurveyPeriods: vi.fn().mockResolvedValue([
      {
        code: "2026",
        name: "2026年度",
        surveyYear: 2026,
        surveyQuarter: null,
        precision: "YEAR",
        marketingYearCode: "2026/27",
        marketingYearName: "2026/27营销年度",
      },
    ]),
    listNotifications: vi.fn().mockResolvedValue({ items: [], unreadCount: 0 }),
    subscribeBusinessEvents: vi.fn(() => vi.fn()),
  } as unknown as RealtimeBusinessRepository;
}

describe("SupplyAccountWorkspace", () => {
  it("lets the formal supply-account shell shrink at the 390px mobile viewport", () => {
    const css = readFileSync(
      `${process.cwd()}/src/business/formal-enterprise.css`,
      "utf8",
    );

    expect(css).toMatch(
      /@media \(max-width:\s*1180px\)[\s\S]*?\.formal-enterprise:has\([^)]*\.supply-account-workspace[^)]*\)\s*\{[^}]*min-width:\s*0/u,
    );
  });

  it("shows zero as real data and names every missing required calculation condition", async () => {
    const workspace = {
      productCode: "CORN",
      regionCode: "230221",
      periodCode: "2026",
      surveyYear: 2026,
      surveyQuarter: null,
      periodPrecision: "YEAR",
      marketingYear: "2026/27",
      inputSetVersion: 0,
      latestInputSetId: null,
      decisionVersion: 0,
      roles: [
        {
          code: "OPENING_INVENTORY",
          label: "期初库存",
          groupCode: "SUPPLY",
          required: true,
          sortOrder: 10,
          manualAllowed: true,
          manualDecisionVersion: 0,
          selectedReleaseId: "release-opening",
          releases: [
            {
              id: "release-opening",
              sourceDomain: "MANUAL",
              sourceRecordId: "internal-opening",
              sourceVersion: 0,
              sourceFieldCode: "MANUAL_APPROVED_VALUE",
              value: "0.0000",
              unitCode: "万吨",
              qualityState: "PASSED",
              approvedAt: "2026-08-30T02:00:00Z",
            },
          ],
        },
        {
          code: "LOCAL_PRODUCTION",
          label: "本地生产",
          groupCode: "SUPPLY",
          required: true,
          sortOrder: 20,
          manualAllowed: true,
          manualDecisionVersion: 0,
          selectedReleaseId: null,
          releases: [],
        },
      ],
    };
    const get = vi.fn((path: string) =>
      Promise.resolve(
        path.endsWith("supply-input-workspaces") ? workspace : historyPage(),
      ),
    );

    render(
      <SupplyAccountWorkspace
        api={{ get, post: vi.fn() } as unknown as RealtimeApiClient}
        authorizedRegionCodes={["*"]}
        permissions={["BUSINESS_READ"]}
        repository={repository()}
        section="balance"
      />,
    );

    expect(await screen.findByText("0.0000 万吨")).toBeVisible();
    expect(screen.getByText("计算条件未完整：缺少本地生产")).toBeVisible();
    expect(screen.queryByText("internal-opening")).not.toBeInTheDocument();
    expect(screen.getByText(/市场台账当前不自动纳入供需账户/)).toBeVisible();
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith("/api/v1/supply-input-workspaces", {
        productCode: "CORN",
        regionCode: "230221",
        periodCode: "2026",
      }),
    );
  });

  it("uses the calculation history API and renders immutable input and formula snapshots", async () => {
    const history = [
      {
        id: "internal-run-id",
        productCode: "CORN",
        regionCode: "230221",
        periodCode: "2026",
        surveyYear: 2026,
        surveyQuarter: null,
        periodPrecision: "YEAR",
        marketingYear: "2026/27",
        resultVersion: 3,
        supersedesResultVersion: 2,
        calculationChecksum: "internal-checksum",
        decisionVersion: 1,
        resultState: "PUBLISHED",
        temporalGovernanceState: "CONFIRMED",
        validationCodes: [],
        balanced: true,
        publishable: true,
        balanceReason: "WITHIN_TOLERANCE",
        totalSupply: "15.000",
        totalUse: "8.000",
        calculatedEndingInventory: "7.000",
        approvedAdjustment: "1.000",
        adoptedEndingInventory: "8.000",
        surveyedEndingInventory: "7.750",
        inventoryReconciliationDifference: "-0.250",
        inputSetId: "internal-input-set",
        legacyReadOnly: false,
        calculatedByName: "供需测试员",
        calculatedAt: "2026-08-30T02:00:00Z",
        adjustmentProposal: null,
        adjustmentAudit: null,
        formula: {
          code: "GRAIN_BALANCE",
          version: 1,
          name: "粮食供需平衡公式",
          precision: 18,
          scale: 3,
          roundingMode: "HALF_UP",
          tolerance: "0.500",
          differenceCode: "INVENTORY_RECONCILIATION_DIFFERENCE",
          differenceLabel: "库存核对差额",
          differenceExpression:
            "SURVEYED_ENDING_INVENTORY - ADOPTED_ENDING_INVENTORY",
          expressions: [],
        },
        sources: [
          {
            roleCode: "LOCAL_PRODUCTION",
            roleLabel: "本地生产",
            groupCode: "SUPPLY",
            sourceDomain: "PRODUCTION",
            sourceRecordId: "internal-production-id",
            sourceVersion: 4,
            sourceFieldCode: "PROD_ESTIMATED_OUTPUT",
            unitCode: "万吨",
            approvalState: "APPROVED",
            approvedAt: "2026-08-30T01:00:00Z",
            qualityState: "PASSED",
            sourceValue: "3.0000",
            adoptedValue: "3.0000",
            reason: "采用已审核产情",
            drillDownRoute: "/api/v1/production-records/internal-production-id",
          },
        ],
      },
    ];
    const get = vi.fn((path: string) =>
      Promise.resolve(
        path.endsWith("supply-accounts")
          ? historyPage(history, 0, 1)
          : historyPage(),
      ),
    );

    render(
      <SupplyAccountWorkspace
        api={{ get, post: vi.fn() } as unknown as RealtimeApiClient}
        authorizedRegionCodes={["*"]}
        permissions={["BUSINESS_READ"]}
        repository={repository()}
        section="records"
      />,
    );

    const record = await screen.findByRole("article", {
      name: "第3版 已发布",
    });
    expect(record).toHaveTextContent("供需测试员");
    expect(record).toHaveTextContent("粮食供需平衡公式 V1");
    expect(record).toHaveTextContent("本地生产");
    expect(record).toHaveTextContent("已审核产情");
    expect(record).toHaveTextContent("3.0000 万吨");
    expect(record).not.toHaveTextContent(/internal-|GRAIN_BALANCE|PUBLISHED/);
    expect(get).toHaveBeenCalledWith("/api/v1/supply-accounts", {
      productCode: "CORN",
      regionCode: "230221",
      periodCode: "2026",
      pageNumber: 0,
      pageSize: 10,
    });
  });

  it("persists manual zero, immutable inputs, and a server calculation before showing success", async () => {
    const user = userEvent.setup();
    let stage = 0;
    const role = {
      code: "OPENING_INVENTORY",
      label: "期初库存",
      groupCode: "SUPPLY",
      required: true,
      sortOrder: 10,
      manualAllowed: true,
      manualDecisionVersion: 0,
      selectedReleaseId: null as string | null,
      releases: [] as readonly {
        id: string;
        sourceDomain: string;
        sourceRecordId: string;
        sourceVersion: number;
        sourceFieldCode: string;
        value: string;
        unitCode: string;
        qualityState: string;
        approvedAt: string;
      }[],
    };
    const workspace = () => ({
      productCode: "CORN",
      regionCode: "230221",
      periodCode: "2026",
      surveyYear: 2026,
      surveyQuarter: null,
      periodPrecision: "YEAR",
      marketingYear: "2026/27",
      inputSetVersion: stage >= 2 ? 1 : 0,
      latestInputSetId: stage >= 2 ? "internal-input-set" : null,
      decisionVersion: 0,
      roles: [
        stage >= 1
          ? {
              ...role,
              manualDecisionVersion: 1,
              selectedReleaseId: "internal-release",
              releases: [
                {
                  id: "internal-release",
                  sourceDomain: "MANUAL",
                  sourceRecordId: "internal-decision",
                  sourceVersion: 1,
                  sourceFieldCode: "MANUAL_APPROVED_VALUE",
                  value: "0.0000",
                  unitCode: "万吨",
                  qualityState: "PASSED",
                  approvedAt: "2026-08-30T02:00:00Z",
                },
              ],
            }
          : role,
      ],
    });
    const calculated = {
      id: "internal-run",
      resultVersion: 1,
      resultState: "CONFIRMED",
      validationCodes: [],
      balanced: true,
      publishable: true,
      totalSupply: "0.000",
      totalUse: "0.000",
      calculatedEndingInventory: "0.000",
      approvedAdjustment: "0.000",
      adoptedEndingInventory: "0.000",
      surveyedEndingInventory: null,
      inventoryReconciliationDifference: null,
      calculatedByName: "供需填报员",
      calculatedAt: "2026-08-30T03:00:00Z",
      formula: { name: "粮食供需平衡公式", version: 1, tolerance: "0.500" },
      sources: [],
    };
    const get = vi.fn((path: string) =>
      Promise.resolve(
        path.endsWith("supply-input-workspaces")
          ? workspace()
          : historyPage(stage >= 3 ? [calculated] : [], 0, stage >= 3 ? 1 : 0),
      ),
    );
    const post = vi.fn((path: string) => {
      if (path.endsWith("manual-decisions")) stage = 1;
      if (path.endsWith("supply-input-sets")) stage = 2;
      if (path.endsWith("supply-accounts/runs")) stage = 3;
      return Promise.resolve({});
    });

    render(
      <SupplyAccountWorkspace
        api={{ get, post } as unknown as RealtimeApiClient}
        authorizedRegionCodes={["*"]}
        permissions={[
          "BUSINESS_READ",
          "BUSINESS_APPROVE",
          "BUSINESS_CREATE",
          "BUSINESS_UPDATE",
        ]}
        repository={repository()}
        section="balance"
      />,
    );

    await screen.findByText("计算条件未完整：缺少期初库存");
    await user.type(screen.getByLabelText("期初库存人工核定值"), "0");
    await user.type(screen.getByLabelText("期初库存核定依据"), "盘点确认真零");
    await user.click(screen.getByRole("button", { name: "核定" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/api/v1/supply-inputs/manual-decisions",
        expect.objectContaining({
          value: "0",
          reason: "盘点确认真零",
          expectedVersion: 0,
        }),
      ),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "建立计算输入" }),
      ).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "建立计算输入" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/api/v1/supply-input-sets",
        expect.objectContaining({
          expectedVersion: 0,
          items: [
            {
              roleCode: "OPENING_INVENTORY",
              sourceReleaseId: "internal-release",
            },
          ],
        }),
      ),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "生成计算记录" }),
      ).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "生成计算记录" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/api/v1/supply-accounts/runs",
        expect.objectContaining({
          inputSetId: "internal-input-set",
          adjustmentProposalValue: "0",
          expectedDecisionVersion: 0,
          publish: false,
        }),
      ),
    );
    expect((await screen.findAllByText("0.000 万吨")).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText(/internal-/)).not.toBeInTheDocument();
  });

  it("shows a server conflict and never fabricates a successful calculation", async () => {
    const user = userEvent.setup();
    const workspace = {
      productCode: "CORN",
      regionCode: "230221",
      periodCode: "2026",
      surveyYear: 2026,
      surveyQuarter: null,
      periodPrecision: "YEAR",
      marketingYear: "2026/27",
      inputSetVersion: 1,
      latestInputSetId: "internal-input-set",
      decisionVersion: 2,
      roles: [],
    };
    const get = vi.fn((path: string) =>
      Promise.resolve(
        path.endsWith("supply-input-workspaces") ? workspace : historyPage(),
      ),
    );
    const post = vi.fn().mockRejectedValue(
      new RealtimeApiError({
        code: "SUPPLY_DECISION_VERSION_CONFLICT",
        message: "计算版本已变化，请刷新后重试。",
        status: 409,
      }),
    );

    render(
      <SupplyAccountWorkspace
        api={{ get, post } as unknown as RealtimeApiClient}
        authorizedRegionCodes={["*"]}
        permissions={["BUSINESS_READ", "BUSINESS_UPDATE"]}
        repository={repository()}
        section="balance"
      />,
    );

    const calculate = await screen.findByRole("button", {
      name: "生成计算记录",
    });
    await waitFor(() => expect(calculate).toBeEnabled());
    await user.click(calculate);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "计算版本已变化，请刷新后重试。",
    );
    expect(
      screen.getByText("尚无计算记录；缺少条件时不会伪造数值。"),
    ).toBeVisible();
  });

  it("keeps Jagdaqi in an authorized parent scope and refreshes only matching SSE scope", async () => {
    let onChange: ((event: unknown) => void) | undefined;
    let historyReads = 0;
    const calculated = {
      id: "internal-run",
      resultVersion: 1,
      resultState: "CONFIRMED",
      validationCodes: [],
      balanced: true,
      publishable: true,
      totalSupply: "2.000",
      totalUse: "1.000",
      calculatedEndingInventory: "1.000",
      approvedAdjustment: "0.000",
      adoptedEndingInventory: "1.000",
      surveyedEndingInventory: null,
      inventoryReconciliationDifference: null,
      calculatedByName: "加格达奇填报员",
      calculatedAt: "2026-08-30T03:00:00Z",
      formula: { name: "粮食供需平衡公式", version: 1, tolerance: "0.500" },
      sources: [],
    };
    const scopedRepository = {
      ...repository(),
      loadMasterData: vi.fn().mockResolvedValue({
        products: [{ code: "CORN", name: "玉米" }],
        periods: [],
        approvedSurveyYears: [2026],
        regions: [
          {
            code: "232761",
            name: "加格达奇区",
            parentCode: "232700",
            level: "COUNTY",
          },
        ],
      }),
      subscribeBusinessEvents: vi.fn((_after, callback) => {
        onChange = callback as (event: unknown) => void;
        return vi.fn();
      }),
    } as unknown as RealtimeBusinessRepository;
    const get = vi.fn(() => {
      historyReads += 1;
      return Promise.resolve(
        historyPage(
          historyReads > 1 ? [calculated] : [],
          0,
          historyReads > 1 ? 1 : 0,
        ),
      );
    });

    render(
      <SupplyAccountWorkspace
        api={{ get, post: vi.fn() } as unknown as RealtimeApiClient}
        authorizedRegionCodes={["232700"]}
        permissions={["BUSINESS_READ"]}
        repository={scopedRepository}
        section="records"
      />,
    );

    expect(
      await screen.findByRole("option", { name: "加格达奇区" }),
    ).toBeVisible();
    await waitFor(() => expect(onChange).toBeDefined());
    onChange?.({
      id: "wrong-year",
      sequence: 1,
      aggregateType: "PRODUCTION_RECORD",
      aggregateId: "record-1",
      actionCode: "APPROVE",
      productCode: "CORN",
      surveyYear: 2025,
      regionCodes: ["232761"],
      occurredAt: "2026-08-30T03:00:00Z",
      read: false,
    });
    await Promise.resolve();
    expect(historyReads).toBe(1);

    onChange?.({
      id: "matching-scope",
      sequence: 2,
      aggregateType: "LOGISTICS_RECORD",
      aggregateId: "record-2",
      actionCode: "APPROVE",
      productCode: "CORN",
      surveyYear: 2026,
      regionCodes: ["232761"],
      occurredAt: "2026-08-30T03:00:01Z",
      read: false,
    });
    expect(
      await screen.findByRole("article", { name: "第1版 已核算" }),
    ).toBeVisible();
    expect(get).toHaveBeenLastCalledWith("/api/v1/supply-accounts", {
      productCode: "CORN",
      regionCode: "232761",
      periodCode: "2026",
      pageNumber: 0,
      pageSize: 10,
    });
  });
});
