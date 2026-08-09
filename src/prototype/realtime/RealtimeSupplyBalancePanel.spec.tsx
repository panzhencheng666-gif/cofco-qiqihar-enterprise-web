import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  RealtimeBusinessRepository,
  SupplyAccountRow,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeSupplyBalancePanel } from "./RealtimeSupplyBalancePanel";

afterEach(cleanup);

function account(overrides: Partial<SupplyAccountRow> = {}): SupplyAccountRow {
  return {
    id: "account-1",
    productCode: "CORN",
    regionCode: "230200",
    marketingYear: "2026-W32",
    resultVersion: 1,
    decisionVersion: 0,
    resultState: "PUBLISHED",
    validationCodes: [],
    balanced: true,
    publishable: true,
    balanceReason: "来源完整",
    totalSupply: "201.0000",
    totalUse: "150.0000",
    calculatedEndingInventory: "51.0000",
    approvedAdjustment: "0.0000",
    adoptedEndingInventory: "51.0000",
    surveyedEndingInventory: "51.0000",
    inventoryReconciliationDifference: "0.0000",
    inputSetId: "input-set-1",
    legacyReadOnly: false,
    adjustmentProposal: null,
    formula: {
      code: "GRAIN_BALANCE",
      version: 1,
      name: "粮食供需平衡公式",
      precision: 18,
      scale: 4,
      roundingMode: "HALF_UP",
      tolerance: "0.0001",
    },
    sources: [
      {
        roleCode: "OPENING_INVENTORY",
        label: "期初库存",
        sourceDomain: "PRODUCTION",
        sourceRecordId: "production-1",
        sourceVersion: 1,
        sourceFieldCode: "OPENING_INVENTORY",
        value: "101.0000",
        unitCode: "万吨",
      },
    ],
    ...overrides,
  };
}

function repository(): RealtimeBusinessRepository {
  const roles = [
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
          sourceDomain: "PRODUCTION",
          sourceRecordId: "production-1",
          sourceVersion: 1,
          roleCode: "OPENING_INVENTORY",
          sourceFieldCode: "OPENING_INVENTORY",
          value: "101.0000",
          unitCode: "万吨",
          qualityState: "PASSED",
          approvedAt: "2026-08-08T08:00:00Z",
        },
      ],
    },
  ];
  return {
    loadMasterData: vi.fn(() =>
      Promise.resolve({
        products: [{ code: "CORN", name: "玉米" }],
        periods: [
          {
            code: "2026-W32",
            name: "2026 年第 32 周",
            startsOn: "2026-08-03",
            endsOn: "2026-08-09",
          },
        ],
        regions: [
          {
            code: "230200",
            name: "齐齐哈尔市",
            parentCode: null,
            level: "PREFECTURE",
          },
        ],
      }),
    ),
    listCultivars: vi.fn(),
    listObjectTypes: vi.fn(),
    loadProductionDefinition: vi.fn(),
    loadMarketDefinition: vi.fn(),
    listWorkItems: vi.fn(),
    listProduction: vi.fn(),
    getProduction: vi.fn(),
    createProduction: vi.fn(),
    updateProduction: vi.fn(),
    transitionProduction: vi.fn(),
    listMarket: vi.fn(),
    getMarket: vi.fn(),
    createMarket: vi.fn(),
    updateMarket: vi.fn(),
    transitionMarket: vi.fn(),
    loadSupplyInputWorkspace: vi.fn(() =>
      Promise.resolve({
        productCode: "CORN",
        regionCode: "230200",
        marketingYear: "2026-W32",
        inputSetVersion: 0,
        latestInputSetId: null,
        decisionVersion: 0,
        roles,
      }),
    ),
    listSupplyAccounts: vi.fn(() => Promise.resolve([account()])),
    createSupplyInputSet: vi.fn(),
    approveSupplyManualDecision: vi.fn(),
    runSupplyAccount: vi.fn(),
  } as unknown as RealtimeBusinessRepository;
}

describe("RealtimeSupplyBalancePanel", () => {
  it("renders filterable calculation sources, process and results without entry actions", async () => {
    render(<RealtimeSupplyBalancePanel repository={repository()} />);
    expect(
      await screen.findByRole("heading", { name: "实时供需平衡" }),
    ).toBeVisible();
    expect(
      screen.getByRole("search", { name: "供需平衡筛选条件" }),
    ).toBeVisible();
    expect(screen.getByRole("combobox", { name: "产品品种" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "统计地区" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "统计时间" })).toBeVisible();
    expect(screen.getAllByText("期初库存").length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "平衡结论" })).toBeVisible();
    expect(screen.getByRole("figure", { name: "供需平衡桥" })).toBeVisible();
    expect(screen.getByRole("region", { name: "计算明细" })).toBeVisible();
    expect(screen.getByRole("region", { name: "来源追溯" })).toBeVisible();
    expect(screen.getAllByText("201.0000").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", {
        name: /批准手工来源|创建不可变输入集|试算|运行并发布/,
      }),
    ).not.toBeInTheDocument();
  });

  it("shows provenance from the immutable result instead of the mutable input workspace", async () => {
    const nextRepository = repository();
    vi.spyOn(nextRepository, "loadSupplyInputWorkspace").mockResolvedValue({
      productCode: "CORN",
      regionCode: "230200",
      marketingYear: "2026-W32",
      inputSetVersion: 2,
      latestInputSetId: "input-set-new",
      decisionVersion: 2,
      roles: [
        {
          code: "OPENING_INVENTORY",
          label: "期初库存",
          groupCode: "SUPPLY",
          required: true,
          sortOrder: 10,
          manualAllowed: false,
          manualDecisionVersion: 0,
          selectedReleaseId: "release-new",
          releases: [
            {
              id: "release-new",
              sourceDomain: "PRODUCTION",
              sourceRecordId: "mutable-new-source",
              sourceVersion: 2,
              roleCode: "OPENING_INVENTORY",
              sourceFieldCode: "OPENING_INVENTORY",
              value: "999.0000",
              unitCode: "万吨",
              qualityState: "PASSED",
              approvedAt: "2026-08-08T09:00:00Z",
            },
          ],
        },
      ],
    });
    vi.spyOn(nextRepository, "listSupplyAccounts").mockResolvedValue([
      account({
        id: "account-frozen",
        decisionVersion: 1,
        inputSetId: "input-set-frozen",
        sources: [
          {
            roleCode: "OPENING_INVENTORY",
            label: "期初库存",
            sourceDomain: "PRODUCTION",
            sourceRecordId: "frozen-account-source",
            sourceVersion: 1,
            sourceFieldCode: "OPENING_INVENTORY",
            value: "101.0000",
            unitCode: "万吨",
          },
        ],
      }),
    ]);

    render(<RealtimeSupplyBalancePanel repository={nextRepository} />);

    expect(await screen.findByText("已核定业务记录")).toBeVisible();
    expect(screen.getAllByText("101.0000 万吨")).not.toHaveLength(0);
    expect(screen.getByText("第 1 次修订")).toBeVisible();
    expect(screen.queryByText("mutable-new-source")).not.toBeInTheDocument();
    expect(screen.getByText("测算来源已固化")).toBeVisible();
  });

  it("keeps the newest filter result when an older request finishes last", async () => {
    const user = userEvent.setup();
    const nextRepository = repository();
    let resolveHeihe:
      ((value: readonly SupplyAccountRow[]) => void) | undefined;
    const delayedHeihe = new Promise<readonly SupplyAccountRow[]>((resolve) => {
      resolveHeihe = resolve;
    });
    vi.spyOn(nextRepository, "loadMasterData").mockResolvedValue({
      products: [{ code: "CORN", name: "玉米" }],
      periods: [
        {
          code: "2026-W32",
          name: "2026 年第 32 周",
          startsOn: "2026-08-03",
          endsOn: "2026-08-09",
        },
      ],
      regions: [
        {
          code: "230200",
          name: "齐齐哈尔市",
          parentCode: null,
          level: "PREFECTURE",
        },
        {
          code: "231100",
          name: "黑河市",
          parentCode: null,
          level: "PREFECTURE",
        },
      ],
    });
    vi.spyOn(nextRepository, "listSupplyAccounts").mockImplementation(
      ({ regionCode }) => {
        if (regionCode === "231100") {
          return delayedHeihe;
        }
        return Promise.resolve([
          account({
            id: "qiqihar-account",
            resultVersion: 7,
            decisionVersion: 3,
            balanceReason: "齐齐哈尔最新结论",
            totalSupply: "777.0000",
            totalUse: "700.0000",
            calculatedEndingInventory: "77.0000",
            adoptedEndingInventory: "77.0000",
            surveyedEndingInventory: "77.0000",
            inputSetId: "qiqihar-input",
            sources: [],
          }),
        ]);
      },
    );

    render(<RealtimeSupplyBalancePanel repository={nextRepository} />);
    expect((await screen.findAllByText("777.0000")).length).toBeGreaterThan(0);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "统计地区" }),
      "231100",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "统计地区" }),
      "230200",
    );
    expect(await screen.findByText("齐齐哈尔最新结论")).toBeVisible();

    resolveHeihe?.([]);
    expect(await screen.findByText("齐齐哈尔最新结论")).toBeVisible();
    expect(
      screen.queryByText("当前筛选范围暂无已形成的供需计算结果。"),
    ).not.toBeInTheDocument();
  });
});
