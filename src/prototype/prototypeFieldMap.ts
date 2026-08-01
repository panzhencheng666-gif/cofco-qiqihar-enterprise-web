export interface PrototypeFieldMapping {
  legacySource: string;
  legacyField: string;
  targetModel: string;
  targetPage: string;
}

function mapFields(
  legacySource: string,
  targetModel: string,
  targetPage: string,
  legacyFields: readonly string[],
): PrototypeFieldMapping[] {
  return legacyFields.map((legacyField) => ({
    legacySource,
    legacyField,
    targetModel: `${targetModel}.${legacyField}`,
    targetPage,
  }));
}

export const prototypeFieldMap: readonly PrototypeFieldMapping[] = [
  ...mapFields("FormalEnterprisePrototype.tsx/formalEnterpriseData.ts:shell-scope", "OperationalScope", "全局壳与业务坐标", ["platformName", "workUnit.organizationLabel", "workUnit.currentUnitLabel", "workUnit.units", "account.displayName", "account.menuItems", "workUnit.organizationId", "workUnit.unitId", "workUnit.label", "identity.userId", "identity.postId", "authorization.authorizedRegionIds", "authorization.authorizedBusinessClassificationIds", "authorization.authorizedProductIds", "authorization.authorizedCultivarIds", "authorization.authorizedReleaseVersionIds", "authorization.permissionKeys", "coordinates.application", "coordinates.section", "coordinates.regionId", "coordinates.businessSubtypeId", "coordinates.productId", "coordinates.periodKey", "coordinates.dataCutoff", "coordinates.dataLayer", "coordinates.releaseVersion"]),
  ...mapFields("MyWorkWorkspace.tsx:personalTasks", "BusinessWork.PersonalTask", "我的工作", ["title", "business", "region", "deadline", "duty", "document", "quality", "publication", "destination.route.application", "destination.route.section", "destination.selection.type", "destination.selection.id", "action", "group"]),
  ...mapFields("formalEnterpriseData.ts:responsibilityAssignments", "BusinessWork.ResponsibilityAssignment", "履责监督台账", ["id", "region", "businessItem", "frequency", "responsibleUserId", "responsiblePerson", "responsiblePost", "reviewer", "deadlineRule", "effectivePeriod", "status"]),
  ...mapFields("formalEnterpriseData.ts:weeklyTasks", "BusinessWork.WeeklyTask", "我的工作与履责监督", ["id", "region", "businessItem", "responsibleUserId", "responsiblePerson", "deadline", "submittedAt", "status", "reviewer", "snapshot"]),
  ...mapFields("formalEnterpriseData.ts:dutyWeeklyRows", "ExecutiveLedger.DutyWeekly", "履责监督台账", ["person", "region", "item", "deadline", "firstQualifiedSubmission", "status", "overdueDuration", "review"]),
  ...mapFields("formalEnterpriseData.ts:dutyMonthlyRows", "ExecutiveLedger.DutyMonthly", "履责监督台账", ["person", "region", "expected", "onTime", "overdue", "missing", "returned", "onTimeRate", "trend"]),
  ...mapFields("formalEnterpriseData.ts:businessReportRows", "ReportRun.Ledger", "报告台账", ["name", "frequency", "scope", "period", "dataVersion", "status", "owner", "publishedAt"]),
  ...mapFields("productionMonitoringData.ts:productionCropProfiles", "ProductionCropProfile", "产情分析", ["key", "label", "area", "expectedYield", "sampleResult", "regionalEstimate", "varieties.name", "varieties.status", "quality.moisture", "quality.testWeight", "quality.toxin", "quality.impurity", "quality.imperfectGrain", "quality.mildew", "quality.protein", "quality.brownRiceRate", "quality.milledRiceRate"]),
  ...mapFields("productionMonitoringData.ts:productionObjectRows", "MonitoringRegistry.ProductionObject", "产情对象名录", ["name", "type", "region", "crops", "varieties", "source", "owner", "state"]),
  ...mapFields("productionMonitoringData.ts:productionReviewRows", "QualityReviewRelease.ProductionReview", "产情任务与单据", ["document", "region", "owner", "duty", "documentState", "quality", "publication"]),
  ...mapFields("productionMonitoringModel.ts:fieldGroups", "CanonicalDocument.ProductionApplicability", "产情任务单据", ["variety", "area", "growth", "yield", "quality", "stock-sale", "intention", "cost-support", "evidence", "objectFields.farmer", "objectFields.family-farm", "objectFields.cooperative", "objectFields.agri-station", "objectFields.village-ledger", "objectFields.field-plot"]),
  ...mapFields("marketMonitoringData.ts:marketRegionCoverage", "OperationalScope.RegionLedgerCoverage", "市场对象覆盖", ["label", "detail", "townshipCount", "villageCount", "sourceNote", "sourceState"]),
  ...mapFields("marketMonitoringData.ts:marketTasks", "BusinessWork.MarketTask", "市场任务台账", ["id", "target", "targetName", "role", "grain", "region", "owner", "deadline", "status", "completedFields", "applicableFields"]),
  ...mapFields("marketMonitoringData.ts:marketSubjectRows", "MonitoringRegistry.MarketSubject", "市场对象名录", ["name", "roles", "grain", "varieties", "qualityScope", "region", "owner", "status"]),
  ...mapFields("marketMonitoringData.ts:marketLogisticsRows", "MonitoringRegistry.LogisticsNode", "物流节点名录", ["name", "type", "coverage", "monitoring", "owner", "status"]),
  ...mapFields("marketMonitoringModel.ts:roles-modes-fields", "CapabilityTemplate.Market", "市场对象详情与任务单据", ["roles.trader", "roles.corn-processor", "roles.soy-crusher", "roles.soy-protein", "roles.food-condiment", "roles.rice-mill", "roles.feed", "roles.livestock", "roles.reserve", "roles.wholesale-market", "roles.agri-dealer", "roles.rail-node", "roles.road-node", "collectionModes.online", "collectionModes.excel", "collectionModes.system", "fieldGroups.purchase", "fieldGroups.quality", "fieldGroups.processing", "fieldGroups.inventory", "fieldGroups.sales", "fieldGroups.movement", "fieldGroups.evidence", "roleFieldApplicability"]),
  ...mapFields("SupplyDemandWorkspace.tsx:accounts-balance-versions", "SupplyAccount", "供需账户与版本台账", ["products.corn", "products.soybean", "products.soymeal", "products.soyoil", "products.soy-protein", "products.paddy", "products.rice", "region", "marketingYear", "unit", "accountStatus", "cutoff", "balance.group", "balance.item", "balance.current", "balance.previous", "balance.sourceBusiness", "balance.sourceVersion", "balance.status", "balance.tone", "balance.total", "versionLedger.version", "versionLedger.region", "versionLedger.productAccount", "versionLedger.state", "versionLedger.author", "versionLedger.reviewer", "versionLedger.publishedAt", "versionLedger.action"]),
  ...mapFields("supplyBalanceScope.ts:scope-equations", "SupplyAccount.ScopeEquation", "供需区域比较与公式结论", ["key", "label", "level", "coverage", "internalFlowElimination", "version", "status", "metrics.label", "metrics.value", "metrics.unit", "metrics.note", "metrics.tone", "totalSupply", "totalUse", "bookEnding", "approvedAdjustment", "adoptedEnding", "surveyEnding", "inventoryDifference"]),
  ...mapFields("businessReportModel.ts:report-contract", "ReportRun", "报告参数与预览", ["application", "applicationLabel", "product", "region", "regionLevel", "period", "dataCutoff", "dataVersion", "author", "reviewer", "frequency", "title", "reportNumber", "summary", "chapters.title", "chapters.body", "indicators.label", "indicators.value", "indicators.note", "artifacts.filename", "artifacts.mimeType", "artifacts.content", "artifacts.action", "artifacts.formats.PDF", "artifacts.formats.Word", "artifacts.formats.Excel", "artifacts.actions.download", "artifacts.actions.print"]),
  ...mapFields("ReportCenterWorkspace.tsx:parameters-ledger", "ReportRun.WorkflowLedger", "报告审核分发与台账", ["parameters.application", "parameters.product", "parameters.region", "parameters.period", "parameters.dataVersion", "ledger.name", "ledger.frequency", "ledger.scope", "ledger.period", "ledger.dataVersion", "ledger.status", "ledger.owner", "ledger.publishedAt", "review", "publication", "distribution", "outputFormat.PDF", "outputFormat.Word", "outputFormat.Excel"]),
  ...mapFields("ExecutiveOverviewWorkspace.tsx:summary-business-risk", "ExecutiveLedger", "经营总览", ["summary.label", "summary.value", "summary.note", "summary.tone", "business.name", "business.result", "business.regionPeriod", "business.dataStatus", "business.riskGap", "business.action", "risk.item", "risk.business", "risk.region", "risk.impact", "risk.status"]),
].map((row) => {
  const semanticOverrides: Record<string, string> = {
    "productionMonitoringData.ts:productionCropProfiles:expectedYield": "MetricCatalog.production.expected-yield",
    "productionMonitoringData.ts:productionCropProfiles:sampleResult": "MetricCatalog.production.sample-average-yield",
    "productionMonitoringData.ts:productionCropProfiles:regionalEstimate": "MetricCatalog.production.regional-yield",
    "productionMonitoringData.ts:productionCropProfiles:varieties.name": "CultivarGovernance.cultivarName",
    "productionMonitoringData.ts:productionCropProfiles:varieties.status": "CultivarGovernance.mappingState",
    "formalEnterpriseData.ts:weeklyTasks:submittedAt": "BusinessWork.actualSubmissionAt",
    "formalEnterpriseData.ts:dutyWeeklyRows:firstQualifiedSubmission": "ExecutiveLedger.firstQualifiedSubmissionAt",
    "ReportCenterWorkspace.tsx:parameters-ledger:parameters.dataVersion": "ReportRun.inputReleaseVersionIds",
    "ReportCenterWorkspace.tsx:parameters-ledger:ledger.publishedAt": "ReportRun.publishedAt",
    "ReportCenterWorkspace.tsx:parameters-ledger:review": "ReportRun.reviewState",
    "ReportCenterWorkspace.tsx:parameters-ledger:publication": "ReportRun.publicationState",
    "ReportCenterWorkspace.tsx:parameters-ledger:distribution": "ReportRun.distributionState",
  };
  return { ...row, targetModel: semanticOverrides[`${row.legacySource}:${row.legacyField}`] ?? row.targetModel };
});
