import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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
    periodCode: "2026-Q3",
    surveyYear: 2026,
    surveyQuarter: "Q3",
    periodPrecision: "QUARTER",
    marketingYear: "2026/27",
    resultVersion: 1,
    supersedesResultVersion: null,
    decisionVersion: 0,
    resultState: "PUBLISHED",
    temporalGovernanceState: "CONFIRMED",
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
        roleLabel: "期初库存",
        sourceDomain: "PRODUCTION",
        sourceRecordId: "production-1",
        sourceVersion: 1,
        sourceFieldCode: "OPENING_INVENTORY",
        sourceValue: "101.0000",
        adoptedValue: "101.0000",
        unitCode: "万吨",
        reason: "采用已确认来源",
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
          sourceFieldCode: "OPENING_INVENTORY",
          value: "101.0000",
          unitCode: "万吨",
          qualityState: "PASSED",
          approvedAt: "2026-08-08T08:00:00Z",
        },
        {
          id: "release-opening-revised",
          sourceDomain: "PRODUCTION",
          sourceRecordId: "production-2",
          sourceVersion: 2,
          sourceFieldCode: "OPENING_INVENTORY",
          value: "102.0000",
          unitCode: "万吨",
          qualityState: "PASSED",
          approvedAt: "2026-08-09T08:00:00Z",
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
            marketingYearCode: "2026/27",
            marketingYearName: "2026/27营销年度",
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
            code: "230202",
            name: "龙沙区",
            parentCode: "230200",
            level: "COUNTY",
          },
          {
            code: "230202100",
            name: "大民街道",
            parentCode: "230202",
            level: "TOWNSHIP",
          },
          {
            code: "230202100001",
            name: "大民村",
            parentCode: "230202100",
            level: "VILLAGE",
          },
        ],
      }),
    ),
    loadSupplySurveyPeriods: vi.fn(() =>
      Promise.resolve([
        {
          code: "2026-Q3",
          name: "2026 年第三季度",
          surveyYear: 2026,
          surveyQuarter: "Q3" as const,
          precision: "QUARTER" as const,
          marketingYearCode: "2026/27",
          marketingYearName: "2026/27营销年度",
        },
      ]),
    ),
    listCultivars: vi.fn(),
    listObjectTypes: vi.fn(),
    loadProductionDefinition: vi.fn(),
    loadMarketDefinition: vi.fn(),
    listWorkItems: vi.fn(),
    listProduction: vi.fn(),
    listLogistics: vi.fn(),
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
        periodCode: "2026-Q3",
        surveyYear: 2026,
        surveyQuarter: "Q3",
        periodPrecision: "QUARTER",
        marketingYear: "2026/27",
        inputSetVersion: 0,
        latestInputSetId: null,
        decisionVersion: 0,
        roles,
      }),
    ),
    listSupplyAccounts: vi.fn(() => Promise.resolve([account()])),
    createSupplyInputSet: vi.fn(() =>
      Promise.resolve({
        id: "input-set-created",
        version: 1,
        productCode: "CORN",
        regionCode: "230200",
        periodCode: "2026-Q3",
        surveyYear: 2026,
        surveyQuarter: "Q3",
        periodPrecision: "QUARTER",
        marketingYear: "2026/27",
      }),
    ),
    approveSupplyManualDecision: vi.fn(() =>
      Promise.resolve({
        id: "manual-release",
        sourceDomain: "MANUAL",
        sourceRecordId: "manual-decision-1",
        sourceVersion: 0,
        roleCode: "OPENING_INVENTORY",
        sourceFieldCode: "MANUAL_APPROVED_VALUE",
        value: "102.5000",
        unitCode: "万吨",
        qualityState: "PASSED",
        approvalState: "APPROVED",
      }),
    ),
    releaseSupplySource: vi.fn(() =>
      Promise.resolve({
        id: "released-production-1",
        sourceDomain: "PRODUCTION",
        sourceRecordId: "production-approved-1",
        sourceVersion: 2,
        roleCode: "LOCAL_PRODUCTION",
        sourceFieldCode: "PROD_ESTIMATED_OUTPUT",
        value: "5.7000",
        unitCode: "万吨",
        qualityState: "PASSED",
        approvalState: "APPROVED",
      }),
    ),
    runSupplyAccount: vi.fn(() =>
      Promise.resolve(account({ resultState: "PUBLISHED" })),
    ),
  } as unknown as RealtimeBusinessRepository;
}

describe("RealtimeSupplyBalancePanel", () => {
  it("synchronizes the product when a legacy product route changes", async () => {
    const nextRepository = repository();
    const loadSupplyInputWorkspace = vi.spyOn(
      nextRepository,
      "loadSupplyInputWorkspace",
    );
    const { rerender } = render(
      <RealtimeSupplyBalancePanel
        productCode="CORN"
        repository={nextRepository}
      />,
    );

    await waitFor(() =>
      expect(loadSupplyInputWorkspace).toHaveBeenCalledWith({
        productCode: "CORN",
        regionCode: "230200",
        periodCode: "2026-Q3",
      }),
    );

    rerender(
      <RealtimeSupplyBalancePanel
        productCode="SOYBEAN"
        repository={nextRepository}
      />,
    );

    await waitFor(() =>
      expect(loadSupplyInputWorkspace).toHaveBeenCalledWith({
        productCode: "SOYBEAN",
        regionCode: "230200",
        periodCode: "2026-Q3",
      }),
    );
  });
  it("lets an authorized employee publish approved records without entering backend identifiers", async () => {
    const user = userEvent.setup();
    const nextRepository = repository();
    vi.spyOn(nextRepository, "listProduction").mockResolvedValue({
      items: [
        {
          id: "production-approved-1",
          values: {
            PROD_REGION: "齐齐哈尔市",
            PROD_SURVEY_DATE: "2026-08-09",
            PROD_ESTIMATED_OUTPUT: "57000.0000",
          },
          allowedActions: [],
          version: 2,
        },
      ],
      pageNumber: 0,
      pageSize: 100,
      totalElements: 1,
      totalPages: 1,
    });
    const listLogistics = vi
      .spyOn(nextRepository, "listLogistics")
      .mockResolvedValue({
        items: [
          {
            id: "logistics-approved-1",
            productCode: "CORN",
            values: {
              LOG_DIRECTION: "INFLOW",
              LOG_ROUTE_VOLUME: "680.0000",
            },
            displayValues: {
              LOG_DIRECTION: "流入",
              LOG_ROUTE_VOLUME: "680.0000",
            },
            status: "APPROVED",
            returnReason: null,
            allowedActions: [],
            version: 1,
          },
        ],
        pageNumber: 0,
        pageSize: 100,
        totalElements: 1,
        totalPages: 1,
      });
    const releaseSupplySource = vi.spyOn(nextRepository, "releaseSupplySource");

    render(
      <RealtimeSupplyBalancePanel
        permissions={["BUSINESS_UPDATE"]}
        repository={nextRepository}
      />,
    );
    await screen.findByRole("heading", { name: "确认供需数据来源" });
    await user.click(
      screen.getByRole("button", { name: "读取已审核业务来源" }),
    );

    await waitFor(() => expect(listLogistics).toHaveBeenCalled());
    expect(listLogistics.mock.calls.at(-1)?.[0].filters?.periodCode).toBe(
      "2026-Q3",
    );

    const productionCandidate = await screen.findByRole("article", {
      name: "本地生产候选来源",
    });
    expect(productionCandidate).toHaveTextContent("齐齐哈尔市 · 2026-08-09");
    expect(productionCandidate).toHaveTextContent("57000.0000 公斤");
    expect(
      screen.getByRole("article", { name: "区域外流入候选来源" }),
    ).toHaveTextContent("流入680.0000 吨");
    await user.click(
      within(productionCandidate).getByRole("button", {
        name: "发布为供需来源",
      }),
    );

    await waitFor(() =>
      expect(releaseSupplySource).toHaveBeenCalledWith({
        sourceDomain: "PRODUCTION",
        sourceRecordId: "production-approved-1",
        sourceVersion: 2,
        productCode: "CORN",
        regionCode: "230200",
        periodCode: "2026-Q3",
        roleCode: "LOCAL_PRODUCTION",
        sourceFieldCode: "PROD_ESTIMATED_OUTPUT",
        qualityState: "PASSED",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "本地生产已发布为可选测算来源",
    );
  });

  it("renders filterable calculation sources, process and results without entry actions", async () => {
    render(<RealtimeSupplyBalancePanel repository={repository()} />);
    expect(
      await screen.findByRole("heading", { name: "实时供需平衡" }),
    ).toBeVisible();
    expect(
      screen.getByRole("search", { name: "供需平衡筛选条件" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("combobox", { name: "产品或作物" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "统计地区" })).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "搜索地级市" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "地级市" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "区县" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "乡镇" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "行政村" })).toBeVisible();
    expect(
      screen.queryByRole("combobox", { name: "调查期间" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "当前范围：玉米 · 2026 年第三季度 · 2026/27营销年度 · 齐齐哈尔市 · 已发布 · 第1版",
      ),
    ).toBeVisible();
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

  it("lets authorized employees govern sources, freeze an input set and publish a calculation", async () => {
    const user = userEvent.setup();
    const nextRepository = repository();
    const approveManual = vi.spyOn(
      nextRepository,
      "approveSupplyManualDecision",
    );
    const createInputSet = vi.spyOn(nextRepository, "createSupplyInputSet");
    const runSupplyAccount = vi.spyOn(nextRepository, "runSupplyAccount");

    render(
      <RealtimeSupplyBalancePanel
        permissions={["BUSINESS_CREATE", "BUSINESS_UPDATE", "BUSINESS_APPROVE"]}
        repository={nextRepository}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "确认供需数据来源" }),
    ).toBeVisible();
    const manualEntry = screen.getByText("没有合适来源？填写拟采用数值");
    expect(manualEntry.closest("details")).not.toHaveAttribute("open");
    await user.click(manualEntry);
    await user.type(
      screen.getByRole("textbox", { name: "期初库存拟采用数值（万吨）" }),
      "102.5000",
    );
    await user.type(
      screen.getByRole("textbox", { name: "期初库存调整原因与数据出处" }),
      "库存盘点复核一致",
    );
    await user.click(
      screen.getByRole("button", { name: "核定并登记期初库存" }),
    );
    await waitFor(() =>
      expect(approveManual).toHaveBeenCalledWith({
        productCode: "CORN",
        regionCode: "230200",
        periodCode: "2026-Q3",
        roleCode: "OPENING_INVENTORY",
        value: "102.5000",
        reason: "库存盘点复核一致",
        expectedVersion: 0,
      }),
    );

    await user.type(
      screen.getByRole("textbox", { name: "本次数据来源说明" }),
      "采用本期全部已核定来源",
    );
    await user.click(screen.getByRole("button", { name: "确认本次数据来源" }));
    await waitFor(() =>
      expect(createInputSet).toHaveBeenCalledWith({
        productCode: "CORN",
        regionCode: "230200",
        periodCode: "2026-Q3",
        reason: "采用本期全部已核定来源",
        expectedVersion: 0,
        items: [
          {
            roleCode: "OPENING_INVENTORY",
            sourceReleaseId: "release-opening",
          },
        ],
      }),
    );

    await user.type(
      screen.getByRole("textbox", { name: "期末库存调整量（万吨）" }),
      "0",
    );
    await user.type(
      screen.getByRole("textbox", { name: "调整原因与依据" }),
      "本期无需额外调整",
    );
    await user.click(screen.getByRole("button", { name: "运行并发布" }));
    await waitFor(() =>
      expect(runSupplyAccount).toHaveBeenCalledWith({
        productCode: "CORN",
        regionCode: "230200",
        periodCode: "2026-Q3",
        inputSetId: "input-set-created",
        adjustmentProposalValue: "0",
        adjustmentProposalReason: "本期无需额外调整",
        expectedDecisionVersion: 0,
        publish: true,
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "供需测算已运行并正式发布",
    );
  });

  it("shows provenance from the immutable result instead of the mutable input workspace", async () => {
    const nextRepository = repository();
    vi.spyOn(nextRepository, "loadSupplyInputWorkspace").mockResolvedValue({
      productCode: "CORN",
      regionCode: "230200",
      periodCode: "2026-Q3",
      surveyYear: 2026,
      surveyQuarter: "Q3",
      periodPrecision: "QUARTER",
      marketingYear: "2026/27",
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
            roleLabel: "期初库存",
            sourceDomain: "PRODUCTION",
            sourceRecordId: "frozen-account-source",
            sourceVersion: 1,
            sourceFieldCode: "OPENING_INVENTORY",
            sourceValue: "101.0000",
            adoptedValue: "101.0000",
            unitCode: "万吨",
            reason: "冻结来源",
          },
        ],
      }),
    ]);

    render(<RealtimeSupplyBalancePanel repository={nextRepository} />);

    expect(await screen.findByText("已核定业务记录")).toBeVisible();
    expect(screen.getAllByText("101.0000 万吨")).not.toHaveLength(0);
    expect(screen.getByText("第 1 次修订")).toBeVisible();
    expect(screen.queryByText("mutable-new-source")).not.toBeInTheDocument();
    expect(screen.getByText("本次数据来源已保存")).toBeVisible();
  });

  it("does not report a blocked two-hundred response as formally published", async () => {
    const user = userEvent.setup();
    const nextRepository = repository();
    vi.spyOn(nextRepository, "runSupplyAccount").mockResolvedValue(
      account({
        resultState: "DRAFT",
        publishable: false,
        validationCodes: ["MISSING_REQUIRED_SOURCE"],
      }),
    );

    render(
      <RealtimeSupplyBalancePanel
        permissions={["BUSINESS_UPDATE", "BUSINESS_APPROVE"]}
        repository={nextRepository}
      />,
    );
    await screen.findByRole("heading", { name: "确认供需数据来源" });
    await user.type(
      screen.getByRole("textbox", { name: "期末库存调整量（万吨）" }),
      "0",
    );
    await user.type(
      screen.getByRole("textbox", { name: "调整原因与依据" }),
      "等待补齐来源",
    );
    await user.click(screen.getByRole("button", { name: "运行并发布" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "校验未通过，结果未正式发布",
    );
    expect(screen.getByRole("status")).not.toHaveTextContent("已正式发布");
  });

  it("requires a new immutable input set after the employee changes a source", async () => {
    const user = userEvent.setup();
    render(
      <RealtimeSupplyBalancePanel
        permissions={["BUSINESS_CREATE", "BUSINESS_UPDATE", "BUSINESS_APPROVE"]}
        repository={repository()}
      />,
    );
    const source = await screen.findByRole("combobox", {
      name: "期初库存采用来源",
    });
    await user.type(
      screen.getByRole("textbox", { name: "期末库存调整量（万吨）" }),
      "0",
    );
    await user.type(
      screen.getByRole("textbox", { name: "调整原因与依据" }),
      "确认当前来源",
    );
    expect(screen.getByRole("button", { name: "运行并发布" })).toBeEnabled();
    await user.selectOptions(source, "release-opening-revised");
    expect(screen.getByRole("button", { name: "运行并发布" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "请重新确认本次数据来源",
    );
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
          marketingYearCode: "2026/27",
          marketingYearName: "2026/27营销年度",
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
      screen.getByRole("combobox", { name: "地级市" }),
      "231100",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "地级市" }),
      "230200",
    );
    expect(await screen.findByText("齐齐哈尔最新结论")).toBeVisible();

    resolveHeihe?.([]);
    expect(await screen.findByText("齐齐哈尔最新结论")).toBeVisible();
    expect(
      screen.queryByText("当前筛选范围暂无已形成的供需计算结果。"),
    ).not.toBeInTheDocument();
  });

  it("keeps annual and quarterly histories independent and lets employees reopen an earlier version", async () => {
    const user = userEvent.setup();
    const nextRepository = repository();
    vi.spyOn(nextRepository, "loadSupplySurveyPeriods").mockResolvedValue([
        {
          code: "2026",
          name: "2026 年度",
          surveyYear: 2026,
          surveyQuarter: null,
          precision: "YEAR",
          marketingYearCode: "2026/27",
          marketingYearName: "2026/27营销年度",
        },
        {
          code: "2026-Q3",
          name: "2026 年第三季度",
          surveyYear: 2026,
          surveyQuarter: "Q3",
          precision: "QUARTER",
          marketingYearCode: "2026/27",
          marketingYearName: "2026/27营销年度",
        },
        {
          code: "2026-Q4",
          name: "2026 年第四季度",
          surveyYear: 2026,
          surveyQuarter: "Q4",
          precision: "QUARTER",
          marketingYearCode: "2026/27",
          marketingYearName: "2026/27营销年度",
        },
      ]);
    vi.spyOn(nextRepository, "loadSupplyInputWorkspace").mockImplementation(
      ({ productCode, regionCode, periodCode }) =>
        Promise.resolve({
          productCode,
          regionCode,
          periodCode,
          surveyYear: 2026,
          surveyQuarter: periodCode === "2026" ? null : periodCode.endsWith("Q3") ? "Q3" : "Q4",
          periodPrecision: periodCode === "2026" ? "YEAR" : "QUARTER",
          marketingYear: "2026/27",
          inputSetVersion: 0,
          latestInputSetId: null,
          decisionVersion: 0,
          roles: [],
        }),
    );
    const q3v1 = account({
      id: "q3-v1",
      periodCode: "2026-Q3",
      totalSupply: "101.0000",
    });
    const q3v2 = account({
      id: "q3-v2",
      periodCode: "2026-Q3",
      resultVersion: 2,
      supersedesResultVersion: 1,
      totalSupply: "202.0000",
    });
    const q4v1 = account({
      id: "q4-v1",
      periodCode: "2026-Q4",
      surveyQuarter: "Q4",
      totalSupply: "404.0000",
    });
    const annual = account({
      id: "annual-v1",
      periodCode: "2026",
      surveyQuarter: null,
      periodPrecision: "YEAR",
      totalSupply: "606.0000",
    });
    const list = vi
      .spyOn(nextRepository, "listSupplyAccounts")
      .mockImplementation(({ periodCode }) =>
        Promise.resolve(
          periodCode === "2026"
            ? [annual, q3v2, q3v1, q4v1]
            : periodCode === "2026-Q4"
              ? [q4v1]
              : [q3v2, q3v1],
        ),
      );
    const onPeriodCodeChange = vi.fn();

    render(
      <RealtimeSupplyBalancePanel
        onPeriodCodeChange={onPeriodCodeChange}
        repository={nextRepository}
      />,
    );
    expect((await screen.findAllByText("606.0000")).length).toBeGreaterThan(0);
    expect(screen.getByText(/2026 年度 · 2026\/27营销年度/)).toBeVisible();
    await user.selectOptions(screen.getByRole("combobox", { name: "调查期间" }), "2026-Q3");
    expect((await screen.findAllByText("202.0000")).length).toBeGreaterThan(0);
    expect(screen.getByText(/齐齐哈尔市 · 已发布 · 第2版/)).toBeVisible();
    await user.selectOptions(screen.getByRole("combobox", { name: "结果版本" }), "q3-v1");
    expect((await screen.findAllByText("101.0000")).length).toBeGreaterThan(0);
    await user.selectOptions(screen.getByRole("combobox", { name: "调查期间" }), "2026-Q4");
    expect((await screen.findAllByText("404.0000")).length).toBeGreaterThan(0);
    expect(list).toHaveBeenCalledWith({
      productCode: "CORN",
      regionCode: "230200",
      periodCode: "2026-Q4",
    });
    expect(onPeriodCodeChange).toHaveBeenCalledWith("2026-Q4");
    await user.selectOptions(screen.getByRole("combobox", { name: "调查期间" }), "2026");
    expect((await screen.findAllByText("606.0000")).length).toBeGreaterThan(0);
    expect(screen.getByRole("option", { name: /Q3 · 第 2 版/ })).toBeVisible();
  });
});
