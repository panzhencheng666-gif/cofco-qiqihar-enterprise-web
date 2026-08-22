import { describe, expect, it } from "vitest";
import type { OperationalScope } from "./operationalScope";
import {
  executiveDutyFixtures,
  executiveReleaseFixtures,
  executiveRiskFixtures,
} from "../data/executiveLedgerFixtures";
import { businessWorkFixtures } from "../data/businessWorkFixtures";
import type { BusinessReportRecord } from "../businessReportWorkflow";
import { fixtureOperationalIdentity } from "../formalEnterpriseData";
import {
  createDefaultExecutiveLedgerQuery,
  getExecutiveScopeCoordinateIssues,
  queryExecutiveLedger,
  resolveExecutiveAggregateMembership,
  type ExecutiveLedgerQuery,
  type ExecutiveLedgerResult,
} from "./executiveLedger";

function scope(
  coordinates: Partial<OperationalScope["coordinates"]> = {},
): OperationalScope {
  return {
    workUnit: {
      organizationId: "qiqihar-operation",
      unitId: "operation-hq",
      label: "齐齐哈尔经营部本部",
    },
    identity: { userId: "wang-yang", postId: "regional-data-admin" },
    authorization: {
      authorizedRegionIds: ["qiqihar-all", "qiqihar-nehe"],
      authorizedBusinessClassificationIds: [
        "production.planting-production",
        "market.quote-trade",
        "supply.supply",
        "operations.obligation-performance",
        "operations.data-quality",
        "reporting.production",
        "reporting.market",
        "reporting.supply",
        "reporting.cross-business",
        "reporting.duty",
      ],
      authorizedProductIds: ["corn"],
      authorizedCultivarIds: ["jingke-968"],
      authorizedReleaseVersionIds: ["METRIC-2026-W31-V3"],
      permissionKeys: ["enterprise:fixtures:read"],
    },
    coordinates: {
      regionId: "authorized-all",
      periodKey: "2026-W31",
      ...coordinates,
    },
    savedView: null,
  };
}

function query(
  currentScope: OperationalScope,
  overrides: Partial<ExecutiveLedgerQuery> = {},
): ExecutiveLedgerQuery {
  return {
    ...createDefaultExecutiveLedgerQuery(currentScope),
    ...overrides,
  };
}

function rowIds(result: ExecutiveLedgerResult): readonly string[] {
  switch (result.view) {
    case "operations":
      return result.metrics.map(({ id }) => id);
    case "risks":
      return result.risks.map(({ id }) => id);
    case "duty":
      return result.duties.map(({ id }) => id);
    case "releases":
      return result.releases.map(({ id }) => id);
  }
}

function expectStringFields<T extends object>(
  value: T | null | undefined,
  fields: readonly (keyof T)[],
): void {
  expect(value).toBeTruthy();
  if (!value) throw new Error("expected a ledger row");
  for (const field of fields) {
    expect(typeof value[field], String(field)).toBe("string");
  }
}

describe("ExecutiveLedger", () => {
  it("uses the server-scoped workflow snapshot without falling back to prototype metrics or local authorization lists", () => {
    const source = businessWorkFixtures.find(
      ({ workId }) => workId === "WORK-PRODUCTION-FILL-W31",
    );
    if (!source) throw new Error("missing production work fixture");
    const realtimeScope: OperationalScope = {
      ...scope({ periodKey: "2026-W32" }),
      authorization: {
        serverAuthoritative: true,
        authorizedRegionIds: ["authorized-all"],
        authorizedBusinessClassificationIds: [],
        authorizedProductIds: [],
        authorizedCultivarIds: [],
        authorizedReleaseVersionIds: [],
        permissionKeys: [],
      },
    };
    const workItem = {
      ...source,
      title: "第32周玉米产情审核",
      regionId: "230200",
      regionLabel: "齐齐哈尔市",
      periodKey: "2026-W32",
      effectivePeriod: "2026年第32周",
      productId: "corn",
      productLabel: "玉米",
    };

    expect(
      queryExecutiveLedger(
        realtimeScope,
        query(realtimeScope, { view: "operations" }),
        { workItems: [workItem], reportRecords: [] },
      ),
    ).toEqual({ view: "operations", metrics: [] });

    const duties = queryExecutiveLedger(
      realtimeScope,
      query(realtimeScope, { view: "duty" }),
      { workItems: [workItem], reportRecords: [] },
    );
    expect(duties.view).toBe("duty");
    if (duties.view !== "duty") throw new Error("unexpected view");
    expect(duties.duties).toHaveLength(1);
    expect(duties.duties[0]?.assignment.businessItem).toBe(
      "第32周玉米产情审核",
    );
  });

  it("resolves an authorized aggregate only from one explicit coordinate-bound member snapshot", () => {
    const currentScope = scope();
    const membership = resolveExecutiveAggregateMembership(
      currentScope,
      query(currentScope),
    );

    expect(membership).toMatchObject({
      aggregateRegionId: "authorized-all",
      periodKey: "2026-W31",
      dataLayer: "official",
      releaseVersion: "METRIC-2026-W31-V3",
      regionBoundaryVersionId: "authorized-membership-2026-v1",
      memberRegionIds: ["qiqihar-all", "qiqihar-nehe"],
    });
  });

  it("does not reuse a partial release when the identity is authorized for more regions", () => {
    const expandedScope: OperationalScope = {
      ...fixtureOperationalIdentity,
      coordinates: {
        regionId: "authorized-all",
        periodKey: "2026-W31",
      },
      savedView: null,
    };
    const expandedQuery = createDefaultExecutiveLedgerQuery(expandedScope);

    expect(
      resolveExecutiveAggregateMembership(expandedScope, expandedQuery),
    ).toBeNull();
    expect(queryExecutiveLedger(expandedScope, expandedQuery)).toEqual({
      view: "operations",
      metrics: [],
    });
  });

  it("does not use a member snapshot from another period, data state, or batch", () => {
    const currentScope = scope();
    const baseQuery = query(currentScope);

    expect(
      resolveExecutiveAggregateMembership(currentScope, {
        ...baseQuery,
        periodKey: "2025-W31",
      }),
    ).toBeNull();
    expect(
      resolveExecutiveAggregateMembership(currentScope, {
        ...baseQuery,
        dataLayer: "preliminary",
      }),
    ).toBeNull();
    expect(
      resolveExecutiveAggregateMembership(currentScope, {
        ...baseQuery,
        releaseVersion: "MARKET-2026-W31-APPROVED",
      }),
    ).toBeNull();
  });

  it("keeps a missing governed period explicit until the URL or user supplies one", () => {
    const currentScope: OperationalScope = {
      ...fixtureOperationalIdentity,
      coordinates: { regionId: "authorized-all" },
      savedView: null,
    };
    const defaultQuery = createDefaultExecutiveLedgerQuery(currentScope);
    const result = queryExecutiveLedger(currentScope, defaultQuery);

    expect(defaultQuery.periodKey).toBe("");
    expect(getExecutiveScopeCoordinateIssues(currentScope)).toEqual([
      { coordinate: "period" },
    ]);
    expect(result).toEqual({ view: "operations", metrics: [] });

    const governedScope: OperationalScope = {
      ...currentScope,
      coordinates: {
        ...currentScope.coordinates,
        periodKey: "2026-W31",
      },
    };
    const governedResult = queryExecutiveLedger(
      governedScope,
      createDefaultExecutiveLedgerQuery(governedScope),
    );
    expect(governedResult.view).toBe("operations");
    if (governedResult.view !== "operations") {
      throw new Error("unexpected view");
    }
    expect(governedResult.metrics).toEqual([]);
  });

  it("keeps an authorized aggregate honest until an exact-region release exists", () => {
    const currentScope = scope();
    const defaultQuery = createDefaultExecutiveLedgerQuery(currentScope);

    expect(defaultQuery).toMatchObject({
      view: "operations",
      regionId: "authorized-all",
      domain: "all",
      periodKey: "2026-W31",
      dataLayer: "official",
      riskState: "all",
    });

    const result = queryExecutiveLedger(currentScope, defaultQuery);
    expect(result.view).toBe("operations");
    if (result.view !== "operations") throw new Error("unexpected view");
    expect(new Set(result.metrics.map(({ domain }) => domain))).toEqual(
      new Set(["supply"]),
    );
    expect(
      result.metrics.every(
        ({ comparison }) => comparison.yearCells.length === 4,
      ),
    ).toBe(true);

    const cornResult = queryExecutiveLedger(
      currentScope,
      query(currentScope, { productId: "corn" }),
    );
    expect(cornResult.view).toBe("operations");
    if (cornResult.view !== "operations") throw new Error("unexpected view");
    expect(new Set(cornResult.metrics.map(({ domain }) => domain))).toEqual(
      new Set(["supply"]),
    );

    const exactRegionResult = queryExecutiveLedger(
      currentScope,
      query(currentScope, {
        regionId: "qiqihar-all",
        productId: "corn",
      }),
    );
    expect(exactRegionResult.view).toBe("operations");
    if (exactRegionResult.view !== "operations") {
      throw new Error("unexpected view");
    }
    expect(
      new Set(exactRegionResult.metrics.map(({ domain }) => domain)),
    ).toEqual(new Set(["production", "market", "operations"]));
    expect(
      exactRegionResult.metrics.every(
        ({ comparison }) => comparison.yearCells.length === 4,
      ),
    ).toBe(true);
    expect(
      exactRegionResult.metrics.some(
        ({ definition }) => definition.metricId === "market.purchase-price",
      ),
    ).toBe(true);
    expect(
      exactRegionResult.metrics.some(
        ({ definition }) => definition.metricId === "production.planted-area",
      ),
    ).toBe(true);
  });

  it("returns materially distinct stable row shapes for risks, duties, and releases", () => {
    const currentScope = scope();
    const risks = queryExecutiveLedger(
      currentScope,
      query(currentScope, { view: "risks" }),
    );
    const duties = queryExecutiveLedger(
      currentScope,
      query(currentScope, { view: "duty" }),
    );
    const releases = queryExecutiveLedger(
      currentScope,
      query(currentScope, { view: "releases" }),
    );

    expect(risks.view).toBe("risks");
    expect(duties.view).toBe("duty");
    expect(releases.view).toBe("releases");
    expect(rowIds(risks).length).toBeGreaterThan(0);
    expect(rowIds(duties).length).toBeGreaterThan(0);
    expect(rowIds(releases).length).toBeGreaterThan(0);
    expect(
      new Set([...rowIds(risks), ...rowIds(duties), ...rowIds(releases)]).size,
    ).toBe(
      rowIds(risks).length + rowIds(duties).length + rowIds(releases).length,
    );

    if (
      risks.view !== "risks" ||
      duties.view !== "duty" ||
      releases.view !== "releases"
    ) {
      throw new Error("unexpected views");
    }
    expectStringFields(risks.risks[0], [
      "riskItem",
      "business",
      "region",
      "impact",
      "currentState",
    ]);
    expect(duties.duties[0]).toHaveProperty("assignment.responsibleUserId");
    expect(duties.duties[0]).toHaveProperty("weekly.firstQualifiedSubmission");
    expect(duties.duties[0]).toHaveProperty("monthly.onTimeRate");
    expectStringFields(releases.releases[0], [
      "publicationId",
      "reportName",
      "frequency",
      "publicationStatus",
    ]);
  });

  it("projects risk and duty rows from the injected current work-item snapshot", () => {
    const currentScope = scope({ regionId: "qiqihar-nehe" });
    const source = businessWorkFixtures.find(
      ({ workId }) => workId === "WORK-PRODUCTION-FILL-W31",
    );
    if (!source) throw new Error("missing production work fixture");
    const riskyItem = { ...source, title: "动态产情复核任务" };
    const baseQuery = query(currentScope, {
      regionId: "qiqihar-nehe",
      domain: "production",
      productId: "corn",
    });
    const risks = queryExecutiveLedger(
      currentScope,
      { ...baseQuery, view: "risks" },
      { workItems: [riskyItem] },
    );
    const duties = queryExecutiveLedger(
      currentScope,
      { ...baseQuery, view: "duty" },
      { workItems: [riskyItem] },
    );

    expect(risks.view).toBe("risks");
    expect(duties.view).toBe("duty");
    if (risks.view !== "risks" || duties.view !== "duty") {
      throw new Error("unexpected views");
    }
    expect(risks.risks).toMatchObject([
      {
        id: "risk-work-WORK-PRODUCTION-FILL-W31",
        riskItem: "动态产情复核任务",
        currentState: "质量阻断",
        riskState: "blocking",
      },
    ]);
    expect(duties.duties).toMatchObject([
      {
        id: "duty-work-WORK-PRODUCTION-FILL-W31",
        assignment: {
          businessItem: "动态产情复核任务",
          status: "进行中",
        },
        weekly: {
          status: "进行中",
          review: "审核退回",
        },
      },
    ]);

    const completedItem = {
      ...riskyItem,
      obligationStatus: "on-time" as const,
      documentStatus: "submitted" as const,
      reviewStatus: "approved" as const,
      qualityStatus: "passed" as const,
    };
    const completedRisks = queryExecutiveLedger(
      currentScope,
      { ...baseQuery, view: "risks" },
      { workItems: [completedItem] },
    );
    const completedDuties = queryExecutiveLedger(
      currentScope,
      { ...baseQuery, view: "duty" },
      { workItems: [completedItem] },
    );
    expect(completedRisks).toEqual({ view: "risks", risks: [] });
    expect(completedDuties).toMatchObject({
      view: "duty",
      duties: [
        {
          assignment: { status: "已按时完成" },
          weekly: { status: "已按时完成", review: "审核通过" },
        },
      ],
    });
  });

  it("projects release rows from the injected current report-workflow snapshot", () => {
    const currentScope = scope({ regionId: "qiqihar-all" });
    currentScope.authorization = {
      ...currentScope.authorization,
      authorizedBusinessClassificationIds: [
        ...currentScope.authorization.authorizedBusinessClassificationIds,
        "supply.results",
      ],
    };
    const report: BusinessReportRecord = {
      id: "report-current-supply",
      title: "动态玉米供需报告",
      summary: "等待发布岗确认。",
      scope: {
        application: "supply",
        businessClassificationId: "supply.results",
        businessClassificationLabel: "结果",
        region: "齐齐哈尔市全域",
        product: "玉米",
        cultivar: "不按具体品种拆分",
        reportTemplate: "供需平衡分析报告",
        period: "2026/27营销年度",
        frequency: "月报",
        dataCutoff: "2026-07-31 17:00",
        dataBatchId: "SUPPLY-2026-MY-APPROVED",
      },
      dataBatchLabel: "2026/27营销年度供需已核定数据",
      dataSourceLabel: "市级供需已核定账户",
      status: "待发布",
      currentHandlerPost: "报告发布岗",
      authorPost: "供需分析岗",
      reviewerPost: "报告复核岗",
      publisherPost: "报告发布岗",
      createdAt: Date.parse("2026-07-31T16:20:00+08:00"),
      updatedAt: Date.parse("2026-07-31T17:20:00+08:00"),
      auditTrail: [],
    };
    const releaseQuery = query(currentScope, {
      view: "releases",
      regionId: "qiqihar-all",
      domain: "supply",
      businessSubtype: "supply.results",
      productId: "corn",
    });
    const pending = queryExecutiveLedger(currentScope, releaseQuery, {
      reportRecords: [report],
    });
    const published = queryExecutiveLedger(currentScope, releaseQuery, {
      reportRecords: [
        {
          ...report,
          status: "已发布",
          currentHandlerPost: "报告档案岗",
          updatedAt: Date.parse("2026-07-31T18:00:00+08:00"),
          auditTrail: [
            {
              id: "audit-published",
              action: "发布报告",
              fromStatus: "待发布",
              toStatus: "已发布",
              actorPost: "报告发布岗",
              occurredAt: Date.parse("2026-07-31T18:00:00+08:00"),
            },
          ],
        },
      ],
    });

    expect(pending).toMatchObject({
      view: "releases",
      releases: [
        {
          id: "release-report-report-current-supply",
          reportName: "动态玉米供需报告",
          publicationStatus: "待发布",
          owner: "报告发布岗",
          publishedAt: "尚未发布",
        },
      ],
    });
    expect(published).toMatchObject({
      view: "releases",
      releases: [
        {
          reportName: "动态玉米供需报告",
          publicationStatus: "已发布",
          owner: "报告发布岗",
          publishedAt: "2026年7月31日 18:00",
        },
      ],
    });
  });

  it("returns reporting publication and replacement rows for the reporting domain", () => {
    const currentScope = scope();
    const result = queryExecutiveLedger(
      currentScope,
      query(currentScope, { view: "releases", domain: "reporting" }),
    );

    expect(result.view).toBe("releases");
    if (result.view !== "releases") throw new Error("unexpected view");
    expect(result.releases.length).toBeGreaterThan(0);
    expect(result.releases.every(({ domain }) => domain === "reporting")).toBe(
      true,
    );
    expect(
      result.releases.some(
        ({ replacesPublicationId, replacedByPublicationId }) =>
          replacesPublicationId !== null || replacedByPublicationId !== null,
      ),
    ).toBe(true);
  });

  it("keeps source-business subtype filters meaningful in the release ledger", () => {
    const currentScope = scope();
    const production = queryExecutiveLedger(
      currentScope,
      query(currentScope, {
        view: "releases",
        domain: "production",
        businessSubtype: "production.planting-production",
      }),
    );
    const market = queryExecutiveLedger(
      currentScope,
      query(currentScope, {
        view: "releases",
        domain: "market",
        businessSubtype: "market.quote-trade",
      }),
    );

    expect(production.view).toBe("releases");
    expect(market.view).toBe("releases");
    if (production.view !== "releases" || market.view !== "releases") {
      throw new Error("unexpected views");
    }
    expect(
      production.releases.map(
        ({ sourceBusinessDomain }) => sourceBusinessDomain,
      ),
    ).toEqual(["production"]);
    expect(
      production.releases.map(
        ({ sourceBusinessSubtype }) => sourceBusinessSubtype,
      ),
    ).toEqual(["production.planting-production"]);
    expect(
      market.releases.map(({ sourceBusinessDomain }) => sourceBusinessDomain),
    ).toEqual(["market"]);
  });

  it("binds publication and replacement identity by stable report name", () => {
    const marketReport = executiveReleaseFixtures.find(
      ({ reportName }) => reportName === "齐齐哈尔玉米市场运行日报",
    );
    const supplyReport = executiveReleaseFixtures.find(
      ({ reportName }) => reportName === "玉米供需账户分析月报",
    );

    expect(marketReport).toMatchObject({
      publicationId: "PUB-MARKET-DAILY-2026-07-31-V1",
      publicationLabel: "2026年7月31日市场日报第1版",
      sourceBusinessDomain: "market",
      sourceBusinessSubtype: "market.quote-trade",
    });
    expect(supplyReport).toMatchObject({
      publicationId: "PUB-SUPPLY-2026-07-V1",
      publicationLabel: "2026年7月供需分析月报第1版",
      replacesPublicationId: "PUB-SUPPLY-2026-06-V1",
      replacesPublicationLabel: "2026年6月供需分析月报第1版",
      replacedByPublicationId: "PUB-SUPPLY-2026-07-V2",
      replacedByPublicationLabel: "2026年7月供需分析月报第2版",
      sourceBusinessSubtype: "supply.supply",
    });
    expect(
      executiveReleaseFixtures.every(
        ({
          publicationLabel,
          replacesPublicationId,
          replacesPublicationLabel,
          replacedByPublicationId,
          replacedByPublicationLabel,
        }) =>
          publicationLabel.length > 0 &&
          (replacesPublicationId === null) ===
            (replacesPublicationLabel === null) &&
          (replacedByPublicationId === null) ===
            (replacedByPublicationLabel === null) &&
          !/PUB-|METRIC-/.test(
            [
              publicationLabel,
              replacesPublicationLabel,
              replacedByPublicationLabel,
            ]
              .filter(Boolean)
              .join(" "),
          ),
      ),
    ).toBe(true);
  });

  it("binds weekly duty state to the stable assignment business item", () => {
    expect(
      executiveDutyFixtures.every(
        ({ assignment, weekly }) =>
          weekly === null || weekly.item === assignment.businessItem,
      ),
    ).toBe(true);
    expect(
      executiveDutyFixtures.find(
        ({ assignment }) => assignment.id === "resp-baiquan-production",
      ),
    ).toMatchObject({
      domain: "production",
      businessSubtype: "production.planting-production",
      weekly: { item: "玉米产情调查周填报" },
    });
  });

  it("filters operations to one requested domain and rejects an incompatible subtype", () => {
    const currentScope = scope();
    const production = queryExecutiveLedger(
      currentScope,
      query(currentScope, {
        regionId: "qiqihar-all",
        domain: "production",
        productId: "corn",
      }),
    );
    const incompatible = queryExecutiveLedger(
      currentScope,
      query(currentScope, {
        domain: "production",
        businessSubtype: "market.quote-trade",
      }),
    );

    expect(production.view).toBe("operations");
    expect(incompatible.view).toBe("operations");
    if (
      production.view !== "operations" ||
      incompatible.view !== "operations"
    ) {
      throw new Error("unexpected views");
    }
    expect(production.metrics.length).toBeGreaterThan(0);
    expect(
      production.metrics.every(({ domain }) => domain === "production"),
    ).toBe(true);
    expect(incompatible.metrics).toHaveLength(0);
  });

  it("does not expose the temporary corn supply bridge to a product-unauthorized identity", () => {
    const currentScope = scope();
    currentScope.authorization = {
      ...currentScope.authorization,
      authorizedProductIds: ["soybean"],
      authorizedCultivarIds: [],
    };
    const result = queryExecutiveLedger(
      currentScope,
      query(currentScope, { domain: "supply" }),
    );

    expect(result.view).toBe("operations");
    if (result.view !== "operations") throw new Error("unexpected view");
    expect(result.metrics).toHaveLength(0);
  });

  it("filters the risk ledger by its independent warning and blocking state", () => {
    const currentScope = scope();
    const blockingScope = scope();
    blockingScope.authorization = {
      ...blockingScope.authorization,
      authorizedBusinessClassificationIds: [
        ...blockingScope.authorization.authorizedBusinessClassificationIds,
        "production.quality-survey",
      ],
      authorizedProductIds: [
        ...blockingScope.authorization.authorizedProductIds,
        "rice",
      ],
    };
    const warnings = queryExecutiveLedger(
      currentScope,
      query(currentScope, { view: "risks", riskState: "warning" }),
    );
    const blocking = queryExecutiveLedger(
      blockingScope,
      query(blockingScope, { view: "risks", riskState: "blocking" }),
    );

    expect(warnings.view).toBe("risks");
    expect(blocking.view).toBe("risks");
    if (warnings.view !== "risks" || blocking.view !== "risks") {
      throw new Error("unexpected views");
    }
    expect(warnings.risks.length).toBeGreaterThan(0);
    expect(blocking.risks.length).toBeGreaterThan(0);
    expect(
      warnings.risks.every(({ riskState }) => riskState === "warning"),
    ).toBe(true);
    expect(
      blocking.risks.every(({ riskState }) => riskState === "blocking"),
    ).toBe(true);
  });

  it("carries lineage on every row and preserves risk, duty, monthly, and release fields", () => {
    const currentScope = scope();
    const results = (["operations", "risks", "duty", "releases"] as const).map(
      (view) =>
        queryExecutiveLedger(currentScope, query(currentScope, { view })),
    );

    for (const result of results) {
      const rows =
        result.view === "operations"
          ? result.metrics
          : result.view === "risks"
            ? result.risks
            : result.view === "duty"
              ? result.duties
              : result.releases;
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.id).not.toBe("");
        expect(row.sourceVersionId).not.toBe("");
        expect(row.cutoff).not.toBe("");
        expect(row.coverage).not.toBe("");
        expect(row.drillDownTarget.section).not.toBe("");
      }
    }

    const risks = results[1];
    const duties = results[2];
    const releases = results[3];
    if (
      risks.view !== "risks" ||
      duties.view !== "duty" ||
      releases.view !== "releases"
    ) {
      throw new Error("unexpected views");
    }
    expectStringFields(risks.risks[0], [
      "riskItem",
      "business",
      "region",
      "impact",
      "currentState",
    ]);
    expectStringFields(duties.duties[0]?.assignment, [
      "id",
      "region",
      "businessItem",
      "frequency",
      "responsibleUserId",
      "person",
      "post",
      "reviewer",
      "deadlineRule",
      "effectivePeriod",
      "status",
    ]);
    expectStringFields(duties.duties[0]?.weekly, [
      "person",
      "region",
      "item",
      "deadline",
      "firstQualifiedSubmission",
      "status",
      "overdueDuration",
      "review",
    ]);
    expectStringFields(duties.duties[0]?.monthly, [
      "person",
      "region",
      "expected",
      "onTime",
      "overdue",
      "missing",
      "returned",
      "onTimeRate",
      "trend",
    ]);
    expectStringFields(releases.releases[0], [
      "reportName",
      "frequency",
      "scope",
      "period",
      "dataVersion",
      "publicationStatus",
      "owner",
      "publishedAt",
    ]);
  });

  it("never falls back across region, subtype, product, cultivar, layer, version, or period", () => {
    const currentScope = scope();
    const emptyCases: readonly Partial<ExecutiveLedgerQuery>[] = [
      { regionId: "qiqihar-nehe" },
      { businessSubtype: "production.cost-support" },
      { productId: "soybean" },
      { cultivarId: "jingke-968" },
      { dataLayer: "preliminary" },
      { releaseVersion: "METRIC-2026-W31-V2" },
      { periodKey: "unsupported-period" },
      { periodKey: "2026-W30" },
    ];

    for (const overrides of emptyCases) {
      const result = queryExecutiveLedger(
        currentScope,
        query(currentScope, overrides),
      );
      expect(result.view).toBe("operations");
      if (result.view !== "operations") throw new Error("unexpected view");
      expect(result.metrics, JSON.stringify(overrides)).toHaveLength(0);
    }
  });

  it("rejects unsupported business-domain and risk-state coordinates instead of querying the all scope", () => {
    const invalidDomainScope = scope({ businessDomainId: "bogus-domain" });
    const invalidRiskScope = scope();
    Object.assign(invalidRiskScope.coordinates, { riskState: "bogus-risk" });

    expect(getExecutiveScopeCoordinateIssues(invalidDomainScope)).toEqual([
      { coordinate: "business-domain" },
    ]);
    expect(getExecutiveScopeCoordinateIssues(invalidRiskScope)).toEqual([
      { coordinate: "risk-state" },
    ]);

    const domainResult = queryExecutiveLedger(
      invalidDomainScope,
      createDefaultExecutiveLedgerQuery(invalidDomainScope),
    );
    const riskResult = queryExecutiveLedger(invalidRiskScope, {
      ...createDefaultExecutiveLedgerQuery(invalidRiskScope),
      view: "risks",
    });

    expect(domainResult).toEqual({ view: "operations", metrics: [] });
    expect(riskResult).toEqual({ view: "risks", risks: [] });
  });

  it("rejects runtime-invalid query enums even when the operational scope is valid", () => {
    const currentScope = scope();
    const invalidDomainQuery = {
      ...query(currentScope),
      domain: "bogus-domain",
    } as unknown as ExecutiveLedgerQuery;
    const invalidRiskQuery = {
      ...query(currentScope, { view: "releases" }),
      riskState: "bogus-risk",
    } as unknown as ExecutiveLedgerQuery;
    const missingRiskQuery = {
      ...query(currentScope, { view: "duty" }),
      riskState: undefined,
    } as unknown as ExecutiveLedgerQuery;

    expect(queryExecutiveLedger(currentScope, invalidDomainQuery)).toEqual({
      view: "operations",
      metrics: [],
    });
    expect(queryExecutiveLedger(currentScope, invalidRiskQuery)).toEqual({
      view: "releases",
      releases: [],
    });
    expect(queryExecutiveLedger(currentScope, missingRiskQuery)).toEqual({
      view: "duty",
      duties: [],
    });
  });

  it("enforces authorization before filters and never leaks typed unauthorized fixture rows", () => {
    const currentScope = scope();
    const unauthorizedScope = scope({ regionId: "qiqihar-gannan" });
    const denied = queryExecutiveLedger(
      unauthorizedScope,
      query(unauthorizedScope, { view: "duty", regionId: "qiqihar-gannan" }),
    );
    const withoutPermission = scope();
    withoutPermission.authorization = {
      ...withoutPermission.authorization,
      permissionKeys: [],
    };
    const hidden = queryExecutiveLedger(
      withoutPermission,
      query(withoutPermission, { view: "risks" }),
    );

    expect(denied.view).toBe("duty");
    expect(hidden.view).toBe("risks");
    if (denied.view !== "duty" || hidden.view !== "risks")
      throw new Error("unexpected views");
    expect(denied.duties).toHaveLength(0);
    expect(hidden.risks).toHaveLength(0);
    expect(
      queryExecutiveLedger(currentScope, query(currentScope, { view: "duty" })),
    ).not.toHaveProperty(
      "duties",
      expect.arrayContaining([
        expect.objectContaining({ regionId: "qiqihar-gannan" }),
      ]),
    );
  });

  it("preserves the paddy quality risk without falsifying it as a corn planting coordinate", () => {
    const paddyRisk = executiveRiskFixtures.find(
      ({ id }) => id === "risk-production-nehe-quality",
    );

    expect(paddyRisk).toMatchObject({
      businessSubtype: "production.quality-survey",
      productId: "rice",
      riskItem: "讷河市稻谷质量检验单缺失",
    });
  });
});
