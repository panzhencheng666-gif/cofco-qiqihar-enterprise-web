import { describe, expect, it } from "vitest";

import { prototypeFieldMap } from "./prototypeFieldMap";
import { enterpriseMetricDefinitions } from "./data/enterpriseMetricFixtures";

const unifiedBusinessWorkFields = [
  "workId",
  "title",
  "domain",
  "businessSubtypeId",
  "businessLabel",
  "subject.kind",
  "subject.objectId",
  "subject.objectName",
  "subject.objectTypeId",
  "subject.productAccountId",
  "subject.accountVersionId",
  "subject.accountLabel",
  "subject.runId",
  "subject.reportTypeId",
  "subject.reportLabel",
  "regionId",
  "regionLabel",
  "productId",
  "cultivarIds",
  "periodKey",
  "deadline",
  "responsibleUserId",
  "responsiblePerson",
  "responsiblePost",
  "dutyLabel",
  "reviewerUserId",
  "reviewer",
  "responsibilityId",
  "frequency",
  "deadlineRule",
  "effectivePeriod",
  "obligationStatus",
  "documentStatus",
  "reviewStatus",
  "qualityStatus",
  "releaseStatus",
  "completedFields",
  "applicableFields",
  "collectionModes",
  "fieldGroupIds",
  "inputVersionState",
  "qualityGovernance.ruleVersionId",
  "qualityGovernance.warningPublicationPolicy",
  "qualityGovernance.approvedExplanationVersionIds",
  "obligationHistory.obligationEventId",
  "obligationHistory.action",
  "obligationHistory.actor",
  "obligationHistory.at",
  "obligationHistory.reason",
  "submissionHistory.submissionVersionId",
  "submissionHistory.submittedBy",
  "submissionHistory.submittedAt",
  "submissionHistory.kind",
  "submissionHistory.replacesSubmissionVersionId",
  "reviewHistory.reviewEventId",
  "reviewHistory.submissionVersionId",
  "reviewHistory.action",
  "reviewHistory.reviewer",
  "reviewHistory.at",
  "reviewHistory.reason",
  "qualityHistory.qualityEventId",
  "qualityHistory.action",
  "qualityHistory.ruleVersionId",
  "qualityHistory.result",
  "qualityHistory.actor",
  "qualityHistory.actorRoleId",
  "qualityHistory.at",
  "qualityHistory.explanationVersionId",
  "releaseHistory.releaseEventId",
  "releaseHistory.action",
  "releaseHistory.releaseVersionId",
  "releaseHistory.actor",
  "releaseHistory.at",
  "releaseHistory.replacesReleaseVersionId",
] as const;

const requiredFields: Record<string, readonly string[]> = {
  "FormalEnterprisePrototype.tsx/formalEnterpriseData.ts:shell-scope": [
    "platformName",
    "workUnit.organizationLabel",
    "workUnit.currentUnitLabel",
    "workUnit.units",
    "account.displayName",
    "account.menuItems",
    "workUnit.organizationId",
    "workUnit.unitId",
    "workUnit.label",
    "identity.userId",
    "identity.postId",
    "authorization.authorizedRegionIds",
    "authorization.authorizedBusinessClassificationIds",
    "authorization.authorizedProductIds",
    "authorization.authorizedCultivarIds",
    "authorization.authorizedReleaseVersionIds",
    "authorization.permissionKeys",
    "coordinates.application",
    "coordinates.section",
    "coordinates.regionId",
    "coordinates.businessSubtypeId",
    "coordinates.productId",
    "coordinates.periodKey",
    "coordinates.dataCutoff",
    "coordinates.dataLayer",
    "coordinates.releaseVersion",
  ],
  "MyWorkWorkspace.tsx:personalTasks": [
    "title",
    "business",
    "region",
    "deadline",
    "duty",
    "document",
    "quality",
    "publication",
    "destination.route.application",
    "destination.route.section",
    "destination.selection.type",
    "destination.selection.id",
    "action",
    "group",
  ],
  "data/businessWorkFixtures.ts:businessWorkItems": unifiedBusinessWorkFields,
  "formalEnterpriseData.ts:responsibilityAssignments": [
    "id",
    "region",
    "businessItem",
    "frequency",
    "responsibleUserId",
    "responsiblePerson",
    "responsiblePost",
    "reviewer",
    "deadlineRule",
    "effectivePeriod",
    "status",
  ],
  "formalEnterpriseData.ts:weeklyTasks": [
    "id",
    "region",
    "businessItem",
    "responsibleUserId",
    "responsiblePerson",
    "deadline",
    "submittedAt",
    "status",
    "reviewer",
    "snapshot",
  ],
  "formalEnterpriseData.ts:dutyWeeklyRows": [
    "person",
    "region",
    "item",
    "deadline",
    "firstQualifiedSubmission",
    "status",
    "overdueDuration",
    "review",
  ],
  "formalEnterpriseData.ts:dutyMonthlyRows": [
    "person",
    "region",
    "expected",
    "onTime",
    "overdue",
    "missing",
    "returned",
    "onTimeRate",
    "trend",
  ],
  "formalEnterpriseData.ts:businessReportRows": [
    "name",
    "frequency",
    "scope",
    "period",
    "dataVersion",
    "status",
    "owner",
    "publishedAt",
  ],
  "productionMonitoringData.ts:productionCropProfiles": [
    "key",
    "label",
    "area",
    "expectedYield",
    "sampleResult",
    "regionalEstimate",
    "varieties.name",
    "varieties.status",
    "quality.moisture",
    "quality.testWeight",
    "quality.toxin",
    "quality.impurity",
    "quality.imperfectGrain",
    "quality.mildew",
    "quality.protein",
    "quality.brownRiceRate",
    "quality.milledRiceRate",
  ],
  "productionMonitoringData.ts:productionObjectRows": [
    "name",
    "type",
    "region",
    "crops",
    "varieties",
    "source",
    "owner",
    "state",
  ],
  "productionMonitoringData.ts:productionReviewRows": [
    "document",
    "region",
    "owner",
    "duty",
    "documentState",
    "quality",
    "publication",
  ],
  "productionMonitoringModel.ts:fieldGroups": [
    "variety",
    "area",
    "growth",
    "yield",
    "quality",
    "stock-sale",
    "intention",
    "cost-support",
    "evidence",
    "objectFields.farmer",
    "objectFields.family-farm",
    "objectFields.cooperative",
    "objectFields.agri-station",
    "objectFields.village-ledger",
    "objectFields.field-plot",
  ],
  "marketMonitoringData.ts:marketRegionCoverage": [
    "label",
    "detail",
    "townshipCount",
    "villageCount",
    "sourceNote",
    "sourceState",
  ],
  "marketMonitoringData.ts:marketTasks": [
    "id",
    "target",
    "targetName",
    "role",
    "grain",
    "region",
    "owner",
    "deadline",
    "status",
    "completedFields",
    "applicableFields",
  ],
  "marketMonitoringData.ts:marketSubjectRows": [
    "name",
    "roles",
    "grain",
    "varieties",
    "qualityScope",
    "region",
    "owner",
    "status",
  ],
  "marketMonitoringData.ts:marketLogisticsRows": [
    "name",
    "type",
    "coverage",
    "monitoring",
    "owner",
    "status",
  ],
  "marketMonitoringModel.ts:roles-modes-fields": [
    "roles.trader",
    "roles.corn-processor",
    "roles.soy-crusher",
    "roles.soy-protein",
    "roles.food-condiment",
    "roles.rice-mill",
    "roles.feed",
    "roles.livestock",
    "roles.reserve",
    "roles.wholesale-market",
    "roles.agri-dealer",
    "roles.rail-node",
    "roles.road-node",
    "collectionModes.online",
    "collectionModes.excel",
    "collectionModes.system",
    "fieldGroups.purchase",
    "fieldGroups.quality",
    "fieldGroups.processing",
    "fieldGroups.inventory",
    "fieldGroups.sales",
    "fieldGroups.movement",
    "fieldGroups.evidence",
    "roleFieldApplicability",
  ],
  "SupplyDemandWorkspace.tsx:accounts-balance-versions": [
    "products.corn",
    "products.soybean",
    "products.soymeal",
    "products.soyoil",
    "products.soy-protein",
    "products.paddy",
    "products.rice",
    "region",
    "marketingYear",
    "unit",
    "accountStatus",
    "cutoff",
    "balance.group",
    "balance.item",
    "balance.current",
    "balance.previous",
    "balance.sourceBusiness",
    "balance.sourceVersion",
    "balance.status",
    "balance.tone",
    "balance.total",
    "versionLedger.version",
    "versionLedger.region",
    "versionLedger.productAccount",
    "versionLedger.state",
    "versionLedger.author",
    "versionLedger.reviewer",
    "versionLedger.publishedAt",
    "versionLedger.action",
  ],
  "supplyBalanceScope.ts:scope-equations": [
    "key",
    "label",
    "level",
    "coverage",
    "internalFlowElimination",
    "version",
    "status",
    "metrics.label",
    "metrics.value",
    "metrics.unit",
    "metrics.note",
    "metrics.tone",
    "totalSupply",
    "totalUse",
    "bookEnding",
    "approvedAdjustment",
    "adoptedEnding",
    "surveyEnding",
    "inventoryDifference",
  ],
  "businessReportModel.ts:report-contract": [
    "application",
    "applicationLabel",
    "product",
    "region",
    "regionLevel",
    "period",
    "dataCutoff",
    "dataVersion",
    "author",
    "reviewer",
    "frequency",
    "title",
    "reportNumber",
    "summary",
    "chapters.title",
    "chapters.body",
    "indicators.label",
    "indicators.value",
    "indicators.note",
    "artifacts.filename",
    "artifacts.mimeType",
    "artifacts.content",
    "artifacts.action",
    "artifacts.formats.PDF",
    "artifacts.formats.Word",
    "artifacts.formats.Excel",
    "artifacts.actions.download",
    "artifacts.actions.print",
  ],
  "ReportCenterWorkspace.tsx:parameters-ledger": [
    "parameters.application",
    "parameters.product",
    "parameters.region",
    "parameters.period",
    "parameters.dataVersion",
    "ledger.name",
    "ledger.frequency",
    "ledger.scope",
    "ledger.period",
    "ledger.dataVersion",
    "ledger.status",
    "ledger.owner",
    "ledger.publishedAt",
    "review",
    "publication",
    "distribution",
    "outputFormat.PDF",
    "outputFormat.Word",
    "outputFormat.Excel",
  ],
  "ExecutiveOverviewWorkspace.tsx:summary-business-risk": [
    "summary.label",
    "summary.value",
    "summary.note",
    "summary.tone",
    "business.name",
    "business.result",
    "business.regionPeriod",
    "business.dataStatus",
    "business.riskGap",
    "business.action",
    "risk.item",
    "risk.business",
    "risk.region",
    "risk.impact",
    "risk.status",
  ],
};

describe("prototype field preservation map", () => {
  it("mechanically maps every audited legacy field", () => {
    const keys = new Set(
      prototypeFieldMap.map(
        ({ legacySource, legacyField }) => `${legacySource}:${legacyField}`,
      ),
    );
    for (const [legacySource, fields] of Object.entries(requiredFields)) {
      for (const field of fields)
        expect(
          keys.has(`${legacySource}:${field}`),
          `${legacySource}:${field}`,
        ).toBe(true);
    }
  });

  it("does not collapse independently governed legacy semantics", () => {
    const targets = (source: string, fields: readonly string[]) =>
      fields.map(
        (legacyField) =>
          prototypeFieldMap.find(
            (row) =>
              row.legacySource === source && row.legacyField === legacyField,
          )?.targetModel,
      );
    expect(
      new Set(
        targets("productionMonitoringData.ts:productionCropProfiles", [
          "expectedYield",
          "sampleResult",
          "regionalEstimate",
        ]),
      ).size,
    ).toBe(3);
    expect(
      new Set(
        targets("productionMonitoringData.ts:productionCropProfiles", [
          "varieties.name",
          "varieties.status",
        ]),
      ).size,
    ).toBe(2);
    expect(
      new Set(
        targets("marketMonitoringData.ts:marketTasks", [
          "id",
          "completedFields",
          "applicableFields",
        ]),
      ).size,
    ).toBe(3);
    expect(
      new Set(
        targets("formalEnterpriseData.ts:weeklyTasks", ["submittedAt"]).concat(
          targets("formalEnterpriseData.ts:dutyWeeklyRows", [
            "firstQualifiedSubmission",
          ]),
        ),
      ).size,
    ).toBe(2);
    expect(
      new Set(
        targets("ReportCenterWorkspace.tsx:parameters-ledger", [
          "parameters.dataVersion",
          "ledger.publishedAt",
          "review",
          "publication",
          "distribution",
        ]),
      ).size,
    ).toBe(5);
    const catalogIds = new Set(
      enterpriseMetricDefinitions.map(
        ({ metricId }) => `MetricCatalog.${metricId}`,
      ),
    );
    for (const field of ["expectedYield", "sampleResult", "regionalEstimate"]) {
      const target = prototypeFieldMap.find(
        ({ legacySource, legacyField }) =>
          legacySource ===
            "productionMonitoringData.ts:productionCropProfiles" &&
          legacyField === field,
      )?.targetModel;
      expect(catalogIds.has(target ?? ""), target).toBe(true);
    }
  });

  it("keeps pending coverage counts, logistics content, and all seven supply equations visible in the migration contract", () => {
    const expected = [
      ["marketMonitoringData.ts:marketRegionCoverage", "townshipCount"],
      ["marketMonitoringData.ts:marketRegionCoverage", "villageCount"],
      ["marketMonitoringData.ts:marketLogisticsRows", "coverage"],
      ["marketMonitoringData.ts:marketLogisticsRows", "monitoring"],
      ...[
        "totalSupply",
        "totalUse",
        "bookEnding",
        "approvedAdjustment",
        "adoptedEnding",
        "surveyEnding",
        "inventoryDifference",
      ].map((field) => ["supplyBalanceScope.ts:scope-equations", field]),
    ] as const;
    for (const [legacySource, legacyField] of expected) {
      expect(
        prototypeFieldMap.some(
          (row) =>
            row.legacySource === legacySource &&
            row.legacyField === legacyField,
        ),
      ).toBe(true);
    }
  });

  it("preserves the unified My Work source and keeps all five lifecycle states independent", () => {
    const source = "data/businessWorkFixtures.ts:businessWorkItems";
    const lifecycleFields = [
      "obligationStatus",
      "documentStatus",
      "reviewStatus",
      "qualityStatus",
      "releaseStatus",
    ];
    const targets = lifecycleFields.map(
      (legacyField) =>
        prototypeFieldMap.find(
          (row) =>
            row.legacySource === source && row.legacyField === legacyField,
        )?.targetModel,
    );

    expect(new Set(targets).size).toBe(5);
    expect(targets.every(Boolean)).toBe(true);
    expect(prototypeFieldMap).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          legacySource: source,
          legacyField: "obligationHistory.reason",
        }),
        expect.objectContaining({
          legacySource: source,
          legacyField: "submissionHistory.replacesSubmissionVersionId",
        }),
        expect.objectContaining({
          legacySource: source,
          legacyField: "reviewHistory.submissionVersionId",
        }),
        expect.objectContaining({
          legacySource: source,
          legacyField: "qualityHistory.explanationVersionId",
        }),
        expect.objectContaining({
          legacySource: source,
          legacyField: "releaseHistory.replacesReleaseVersionId",
        }),
      ]),
    );
  });
});
