import { z } from "zod";

import {
  RealtimeApiError,
  realtimeApiClient,
  type RealtimeApiClient,
} from "./realtimeApiClient";
import { enterpriseSessionPath } from "./browserSession";
import {
  PRODUCTION_PUBLIC_FIELD_CODES,
  PRODUCTION_SURVEY_CONTRACT_DIGEST,
  PRODUCTION_SURVEY_CONTRACT_VERSION,
} from "./productionSurveyContract";
import {
  parseObservableAnalysisSnapshot,
  type ObservableAnalysisQuery,
  type ObservableAnalysisSnapshot,
} from "./observableAnalysisContract";

export interface MasterProduct {
  code: string;
  name: string;
}

export interface MasterPeriod {
  code: string;
  name: string;
  startsOn: string;
  endsOn: string;
  marketingYearCode: string;
  marketingYearName: string;
}

export interface SupplySurveyPeriod {
  code: string;
  name: string;
  surveyYear: number;
  surveyQuarter: "Q1" | "Q2" | "Q3" | "Q4" | null;
  precision: "YEAR" | "QUARTER";
  marketingYearCode: string;
  marketingYearName: string;
}

export interface MasterRegion {
  code: string;
  name: string;
  parentCode: string | null;
  level: string;
}

export interface MasterObjectType {
  code: string;
  name: string;
  domain: string;
}

export interface MasterCultivar {
  code: string;
  name: string;
  productCode: string;
}

export interface MasterDataSnapshot {
  products: readonly MasterProduct[];
  periods: readonly MasterPeriod[];
  regions: readonly MasterRegion[];
  approvedSurveyYears?: readonly number[];
}

export function productionDefinitionCacheKey(
  productCode: string,
  objectTypeCode: string | null | undefined,
  contractDigest: string,
): string {
  return [
    "production-definition",
    productCode,
    objectTypeCode ?? "*",
    contractDigest,
  ].join("|");
}

export interface AnnualComparisonPoint {
  businessYear: string;
  value: string | number | null;
  sourcePublicationVersion: string | null;
  dataCutoff: string | null;
  missingReason: string | null;
}

export interface AnnualComparisonView {
  indicatorCode: string;
  indicatorName: string;
  sourceDomain: string;
  productCode: string;
  cultivarCode: string | null;
  regionCode: string;
  surveyYear: number;
  cutoffPeriodCode: string | null;
  unitCode: string;
  methodologyVersion: string;
  points: readonly AnnualComparisonPoint[];
}

export interface AnnualComparisonDefinition {
  code: string;
  name: string;
  unitCode: string;
  sourceDomain: "PRODUCTION" | "MARKET";
  aggregationCode: "SUM" | "AVERAGE";
}

export type SampleNetworkStatus =
  "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "RETIRED";
export type SampleNetworkMembershipStatus =
  "CANDIDATE" | "ACTIVE" | "PAUSED" | "REMOVED";

export interface AnnualSampleNetworkMembership {
  samplePointId: string;
  samplePointName: string;
  samplePointKindCode: string;
  locatedRegionCode: string;
  locatedRegionName: string;
  locatedRegionLevel: "PREFECTURE" | "COUNTY" | "TOWNSHIP" | "VILLAGE";
  statusCode: SampleNetworkMembershipStatus;
  sourceCode: "CARRIED_FORWARD" | "NEW" | "MANUAL";
  decisionReason: string | null;
  version: number;
  longitude: number | null;
  latitude: number | null;
  locationState: string;
}

export interface AnnualSampleNetwork {
  networkYear: number;
  statusCode: SampleNetworkStatus;
  carriedFromYear: number | null;
  version: number;
  createdBy: string;
  createdAt: string;
  submittedBy: string | null;
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
  memberships: readonly AnnualSampleNetworkMembership[];
}

export interface SampleNetworkDesignPoint {
  villageRegionCode: string;
  villageName: string;
  townshipRegionCode: string;
  townshipName: string;
  countyRegionCode: string;
  countyName: string;
  designLongitude: number;
  designLatitude: number;
  coordinateReviewStatus?: string | null;
  coordinateSourceName?: string | null;
  coordinateSourceRevision?: string | null;
  coordinateMatchConfidence?: string | null;
}

export interface SampleNetworkActualPoint {
  samplePointId: string;
  samplePointName: string;
  samplePointKindCode: string;
  membershipStatusCode: SampleNetworkMembershipStatus;
  locatedRegionCode: string;
  locatedRegionName: string;
  locatedRegionLevel: "PREFECTURE" | "COUNTY" | "TOWNSHIP" | "VILLAGE";
  actualLongitude: number | null;
  actualLatitude: number | null;
  locationState: string;
}

export type SampleNetworkRelationType =
  "EXACT_VILLAGE" | "EXPLICIT_REPRESENTATION" | "REGIONAL_ASSOCIATION";

export interface SampleNetworkRelation {
  samplePointId: string;
  designVillageRegionCode: string;
  relationType: SampleNetworkRelationType;
  evidenceReference: string | null;
  reviewStatus: string | null;
  createdBy: string | null;
  createdAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface SampleNetworkComparison {
  networkYear: number;
  networkStatus: SampleNetworkStatus | "NOT_CREATED";
  designPointCount: number;
  designCoordinateCount: number;
  activeSamplePointCount: number;
  approvedSubmissionSamplePointCount: number;
  pendingVerificationDesignPointCount: number;
  multipleActualPerDesignPointCount: number;
  anomalyCount: number;
  exactCoveredDesignPointCount: number;
  representedDesignPointCount: number;
  regionalAssociationDesignPointCount: number;
  unrelatedDesignPointCount: number;
  actualLevelCounts: {
    prefecture: number;
    county: number;
    township: number;
    village: number;
  };
  designPoints: readonly SampleNetworkDesignPoint[];
  actualPoints: readonly SampleNetworkActualPoint[];
  relations: readonly SampleNetworkRelation[];
}

export interface SampleNetworkMemberDecision {
  designVillageRegionCode?: string;
  relationType?: "EXACT_VILLAGE" | "EXPLICIT_REPRESENTATION";
  evidenceReference?: string;
  statusCode: SampleNetworkMembershipStatus;
  sourceCode: "CARRIED_FORWARD" | "NEW" | "MANUAL";
  reason: string;
  version: number;
}

export interface ReportDefinition {
  code: string;
  name: string;
  businessDomain:
    "COMPREHENSIVE" | "PRODUCTION" | "MARKET" | "LOGISTICS" | "SUPPLY";
  businessSubtype: string;
  frequencyCode: string;
  sections: readonly { code: string; title: string; sortOrder: number }[];
}

export interface ReportParameterOptions {
  definitions: readonly ReportDefinition[];
  products: readonly { code: string; label: string }[];
  cultivars: readonly { code: string; label: string }[];
  regionLevels: readonly { code: string; label: string }[];
  regions: readonly { code: string; label: string }[];
  periods: readonly { code: string; label: string }[];
  formats: readonly { code: string; label: string }[];
}

export interface ReportPreview {
  id: string;
  definitionCode: string;
  datasetId: string;
  title: string;
  dataCutoffLabel: string;
  lines: readonly { label: string; value: string; note: string }[];
  sections: readonly { code: string; title: string; body: string }[];
  products: readonly {
    code: string;
    label: string;
    domains: readonly {
      code: string;
      label: string;
      approvedRecordCount: number;
      dataCutoff: string;
      metrics: readonly { label: string; value: string; note: string }[];
    }[];
  }[];
  expiresAt: string;
  version: number;
  legacyReadOnly: boolean;
}

export interface ReportExport {
  id: string;
  previewId: string;
  formatCode: string;
  filename: string;
  contentType: string;
  requestedAt: string;
}

export interface ReportPublication {
  id: string;
  previewId: string;
  exportTaskId: string;
  publishedAt: string;
  version: number;
}

export interface CurrentSession {
  subjectId: string;
  displayName: string;
  workUnitCode: string;
  workUnitName: string;
  accountStatus: string;
  employmentStatus: string;
  roleCodes: readonly string[];
  positions: readonly {
    code: string;
    name: string;
    primaryPosition: boolean;
  }[];
  permissions: readonly string[];
  regionCodes: readonly string[];
}

export interface EmployeeProfile {
  subjectId: string;
  displayName: string;
  workUnitCode: string;
  workUnitName: string;
  accountStatus: string;
  employmentStatus: string;
  roles: readonly { code: string; name: string }[];
  positions: readonly {
    code: string;
    name: string;
    primaryPosition: boolean;
  }[];
  regionCodes: readonly string[];
  version: number;
}

export interface IdentityAssignmentOptions {
  workUnits: readonly { code: string; name: string }[];
  roles: readonly { code: string; name: string }[];
  positions: readonly { code: string; name: string }[];
  regionCodes: readonly string[];
}

export interface EmployeeInvitation {
  subjectId: string;
  displayName: string;
  workUnitCode: string;
  positionCodes: readonly string[];
  roleCodes: readonly string[];
  regionCodes: readonly string[];
}

export interface EmployeeAssignmentUpdate extends Omit<
  EmployeeInvitation,
  "subjectId"
> {
  version: number;
  accountStatus: string;
  employmentStatus: string;
}

export interface AccessReviewDecision {
  subjectId: string;
  grantType: "ROLE" | "REGION" | "POSITION";
  grantKey: string;
  decisionCode: "RETAIN" | "REVOKE";
  reason: string;
}

export interface AccessReviewCampaign {
  reviewId: string;
  name: string;
  workUnitCode: string;
  statusCode: "OPEN" | "COMPLETED";
  dueAt: string;
  createdBy: string;
  createdAt: string;
  items: readonly {
    subjectId: string;
    grantType: "ROLE" | "REGION" | "POSITION";
    grantKey: string;
    decisionCode: "PENDING" | "RETAIN" | "REVOKE";
    decidedBy: string | null;
    decidedAt: string | null;
    reason: string | null;
  }[];
}

export interface BusinessAuditRow {
  eventId: string;
  aggregateType: string;
  aggregateId: string;
  actionCode: string;
  actorSubjectId: string;
  actorDisplayName: string;
  workUnitCode: string;
  workUnitName: string;
  occurredAt: string;
  detailJson: string;
}

export interface BusinessAuditQuery {
  workUnitCode?: string;
  aggregateType?: string;
  actorSubjectId?: string;
  occurredFrom?: string;
  occurredTo?: string;
  page?: number;
  pageSize?: number;
}

export interface BusinessNotificationRow {
  id: string;
  sequence: number;
  aggregateType: string;
  aggregateId: string;
  actionCode: string;
  productCode: string | null;
  surveyYear?: number | null;
  regionCodes: readonly string[];
  occurredAt: string;
  read: boolean;
}

export interface BusinessNotificationPage {
  items: readonly BusinessNotificationRow[];
  unreadCount: number;
}

export interface WorkObligationReportInput {
  weekStart: string;
  subjectId?: string;
  workUnitCode?: string;
  businessDomain?: "PRODUCTION" | "MARKET" | "LOGISTICS";
  regionCode?: string;
}

export interface WorkObligationWeeklyReport {
  weekStart: string;
  weekEnd: string;
  scopeLabel: string;
  summary: {
    total: number;
    onTime: number;
    lateCompleted: number;
    overdueOutstanding: number;
    pending: number;
    returned: number;
  };
  rows: readonly {
    workItemId: string;
    employeeSubjectId: string;
    employeeName: string;
    workUnitCode: string;
    workUnitName: string;
    businessDomain: string;
    businessDomainLabel: string;
    regionCode: string;
    regionName: string;
    productName: string;
    businessPeriod: string;
    dueAt: string;
    completedAt: string | null;
    statusCode: string | null;
    statusLabel: string;
    complianceCode: string;
    complianceLabel: string;
    sourceType: string;
    sourceId: string;
  }[];
}

export interface WorkObligationReportExport {
  id: string;
  filename: string;
  contentType: string;
  checksum: string;
  generatedAt: string;
}

export interface BusinessEventSource {
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void;
  close(): void;
}

export interface RealtimeBusinessRepositoryOptions {
  eventSourceFactory?: (url: string) => BusinessEventSource;
  eventStreamBaseUrl?: string;
}

export interface WorkItemRow {
  id: string;
  task: string;
  domain: string;
  regionCode: string;
  region: string;
  product: string;
  businessPeriodCode?: string;
  businessPeriod: string;
  dueAt: string | null;
  workflowNode: string;
  statusCode: string | null;
  status: string | null;
  responsiblePartyCode: string;
  responsibleParty: string;
  sourceType: string | null;
  sourceId: string | null;
}

export interface BatchReviewWorkItemsInput {
  domain?: "PRODUCTION" | "MARKET" | "LOGISTICS";
  regionId?: string;
  productCode?: string;
}

export interface BatchReviewFailure {
  sourceType: string;
  sourceId: string;
  reason: string;
}

export interface BatchReviewWorkItemsResult {
  requestedCount: number;
  approvedCount: number;
  failedCount: number;
  failures: readonly BatchReviewFailure[];
}

export interface Page<T> {
  items: readonly T[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
}

export interface ProductionDraftPayload {
  productCode: string;
  objectTypeCode: string;
  regionCode: string;
  cultivarCode?: string | null;
  surveyYear: string;
  surveyMonth?: string | null;
  cultivatedAreaMu: string;
  yieldPerMuKilograms: string;
  quality: Record<string, string>;
  costs: Record<string, string>;
  insurance: Record<string, string>;
  subsidies: Record<string, string>;
  submissionMetadata: Record<string, string>;
  evidencePhotoIds: readonly string[];
  version?: number;
}

export type FormalSampleObservationDomain =
  "PRODUCTION" | "MARKET" | "LOGISTICS";

export interface EligibleFormalSample {
  samplePointId: string;
  sampleName: string;
  objectTypeCode: string | null;
  objectTypeName: string | null;
  domain: FormalSampleObservationDomain;
  productCode: string;
  regionCode: string;
  regionName: string;
  latitude: string;
  longitude: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  latestObservationId: string;
  latestObservedAt: string;
  latestValues: Record<string, string>;
}

export interface FormalSampleObservationResult {
  observationId: string;
  samplePointId: string;
  domain: FormalSampleObservationDomain;
  productCode: string;
  observedAt: string;
  officialSavedAt: string;
  projectionVersion: string;
  synchronizedModules: readonly string[];
  values: Record<string, string>;
}

export interface FormalSampleObservationHistoryItem {
  observationId: string | null;
  observedAt: string;
  officialSavedAt: string;
  actorDisplayName: string;
  projectionVersion: string | null;
  synchronizedModules: readonly string[];
  values: Record<string, string>;
  latest: boolean;
}

export interface FormalSampleObservationHistoryPage {
  items: readonly FormalSampleObservationHistoryItem[];
  totalElements: number;
  pageNumber: number;
  pageSize: number;
}

export interface EvidencePhotoRow {
  id: string;
  state: string;
  originalFilename: string;
  mediaType: string;
  byteLength: number;
  sha256: string;
  capturedAt: string;
  latitude: string;
  longitude: string;
  watermarkText: string;
}

export interface EvidencePhotoUpload {
  file: File;
  capturedAt: string;
  latitude: string;
  longitude: string;
  watermarkText: string;
}

export interface ProductionRecordRow extends Omit<
  ProductionDraftPayload,
  "evidencePhotoIds"
> {
  id: string;
  surveyDate?: string;
  fillingDate?: string;
  reportedAt: string;
  estimatedOutputKilograms: string;
  status: string;
  returnReason: string | null;
  allowedActions: readonly string[];
  evidencePhotos?: readonly EvidencePhotoRow[];
  version: number;
}

export interface MarketDraftPayload {
  productCode: string;
  surveyYear: string;
  surveyMonth?: string | null;
  coreValues: Record<string, string>;
  facts: Record<string, string>;
  evidencePhotoIds: readonly string[];
  version?: number;
}

export interface MarketRecordRow {
  id: string;
  productCode: string;
  surveyYear?: string;
  surveyMonth?: string | null;
  coreValues: Record<string, string>;
  status: string;
  returnReason: string | null;
  facts: Record<string, string>;
  evidencePhotos?: readonly EvidencePhotoRow[];
  allowedActions: readonly string[];
  version: number;
}

export interface SupplyReleaseRow {
  id: string;
  sourceDomain: string;
  sourceRecordId: string;
  sourceVersion: number;
  sourceFieldCode: string;
  value: string;
  unitCode: string;
  qualityState: string;
  approvedAt: string;
}

export interface SupplyReleaseMutationResult extends Omit<
  SupplyReleaseRow,
  "approvedAt"
> {
  roleCode: string;
  approvalState: string;
}

export interface SupplySourceReleaseInput {
  sourceDomain: "PRODUCTION" | "LOGISTICS";
  sourceRecordId: string;
  sourceVersion: number;
  productCode: string;
  regionCode: string;
  periodCode: string;
  roleCode: "LOCAL_PRODUCTION" | "EXTERNAL_INFLOW" | "EXTERNAL_OUTFLOW";
  sourceFieldCode: "PROD_ESTIMATED_OUTPUT" | "ROUTE_VOLUME";
  qualityState: "PASSED";
}

export interface SupplyInputRole {
  code: string;
  label: string;
  groupCode: string;
  required: boolean;
  sortOrder: number;
  manualAllowed: boolean;
  manualDecisionVersion: number;
  selectedReleaseId: string | null;
  releases: readonly SupplyReleaseRow[];
}

export interface SupplyInputWorkspace {
  productCode: string;
  regionCode: string;
  periodCode: string;
  surveyYear: number;
  surveyQuarter: "Q1" | "Q2" | "Q3" | "Q4" | null;
  periodPrecision: "YEAR" | "QUARTER";
  marketingYear: string;
  inputSetVersion: number;
  latestInputSetId: string | null;
  decisionVersion: number;
  roles: readonly SupplyInputRole[];
}

export interface SupplyFormulaView {
  code: string;
  version: number;
  name: string;
  precision: number;
  scale: number;
  roundingMode: string;
  tolerance: string;
}

export interface SupplyAccountRow {
  id: string;
  productCode: string;
  regionCode: string;
  periodCode: string;
  surveyYear: number;
  surveyQuarter: "Q1" | "Q2" | "Q3" | "Q4" | null;
  periodPrecision: "YEAR" | "QUARTER";
  marketingYear: string;
  resultVersion: number;
  supersedesResultVersion: number | null;
  decisionVersion: number;
  resultState: string;
  temporalGovernanceState: string;
  validationCodes: readonly string[];
  balanced: boolean;
  publishable: boolean;
  balanceReason: string;
  totalSupply: string | null;
  totalUse: string | null;
  calculatedEndingInventory: string | null;
  approvedAdjustment: string | null;
  adoptedEndingInventory: string | null;
  surveyedEndingInventory: string | null;
  inventoryReconciliationDifference: string | null;
  inputSetId: string | null;
  calculationChecksum?: string | null;
  legacyReadOnly: boolean;
  adjustmentProposal: {
    value: string;
    reason: string;
    requestedBy: string;
    requestedAt: string | null;
  } | null;
  formula: SupplyFormulaView;
  sources: readonly {
    roleCode: string;
    roleLabel: string;
    sourceDomain: string;
    sourceRecordId: string;
    sourceVersion: number;
    sourceFieldCode: string;
    sourceValue: string;
    adoptedValue: string;
    unitCode: string;
    reason: string;
  }[];
}

export interface SupplyInputSetRow {
  id: string;
  version: number;
  productCode: string;
  regionCode: string;
  periodCode: string;
  surveyYear: number;
  surveyQuarter: "Q1" | "Q2" | "Q3" | "Q4" | null;
  periodPrecision: "YEAR" | "QUARTER";
  marketingYear: string;
}

export interface ProductionImportJob {
  id: string;
  actionJobId?: string;
  domainCode: string;
  statusCode:
    "QUEUED" | "PROCESSING" | "COMPLETED" | "COMPLETED_WITH_ERRORS" | "FAILED";
  importedRows: number;
  failedRows: number;
  productCodes?: readonly string[];
  surveyPeriods?: readonly string[];
  retryOf?: string | null;
  createdAt?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  attemptCount?: number;
  failureCode?: string | null;
  failureMessage?: string | null;
}

export interface ProductionImportPhotoManifest {
  totalFileCount: number;
  eligibleFileCount: number;
  deferredFileCount: number;
  totalTargetAttachments: number;
  attachedTargetAttachments: number;
  files: readonly {
    filename: string;
    referencedRows: readonly number[];
    targetRecords: readonly string[];
    failedRows: readonly number[];
    attachedRecords: readonly string[];
  }[];
}

export interface ProductionImportPhotoSupplementResult {
  filename: string;
  statusCode: "ATTACHED" | "ALREADY_ATTACHED" | "DEFERRED_NO_RECORD";
  referencedRows: number;
  targetRecords: number;
  failedRows: number;
  newAttachments: number;
  alreadyAttached: number;
}

export interface SamplePointCoordinateCorrectionRowResult {
  rowNumber: number;
  samplePointId: string;
  outcomeCode: "NO_CHANGE" | "PENDING_REVIEW" | "ERROR";
  errorCode: string | null;
  message: string;
  requestId: string | null;
}

export interface SamplePointCoordinateCorrectionJob {
  jobId: string;
  batchId: string;
  requestedBy: string;
  workUnitCode: string;
  statusCode: "PENDING_REVIEW" | "COMPLETED" | "COMPLETED_WITH_ERRORS";
  totalRows: number;
  pendingReviewRows: number;
  failedRows: number;
  retryOf: string | null;
  createdAt: string;
  completedAt: string;
  rowResults: readonly SamplePointCoordinateCorrectionRowResult[];
}

export interface SamplePointCoordinateCorrectionRequest {
  requestId: string;
  samplePointId: string;
  canonicalName: string;
  regionCode: string;
  originalLongitude: number;
  originalLatitude: number;
  correctedLongitude: number;
  correctedLatitude: number;
  coordinateSource: string;
  correctionNote: string;
  requestedBy: string;
  createdAt: string;
  statusCode: "PENDING_REVIEW" | "APPLIED" | "REJECTED";
  reviewedBy: string | null;
  reviewReason: string | null;
  reviewedAt: string | null;
}

export interface SampleIdentityCandidate {
  samplePointId: string;
  canonicalName: string;
  sampleContact: string;
  regionCode: string;
  longitude: number;
  latitude: number;
  approvedRecordCount: number;
  effectiveFrom: string;
}

export interface SampleIdentityReviewItem {
  draftId: string;
  version: number;
  domainCode: "PRODUCTION" | "MARKET";
  productCode: string;
  sampleName: string;
  sampleContact: string;
  regionCode: string;
  longitude: number;
  latitude: number;
  surveyPeriod: string;
  reasonCode: string;
  reasonMessage: string;
  createdBy: string;
  createdAt: string;
  candidates: readonly SampleIdentityCandidate[];
}

export interface SampleIdentityDecision {
  draftId: string;
  decision: "LINK_EXISTING" | "CONFIRM_DISTINCT" | "RETURN_FOR_CORRECTION";
  targetSamplePointId: string | null;
  reason: string;
  decidedBy: string;
  decidedAt: string;
  stateCode: string;
  canonicalRecordId: string | null;
  version: number;
  privilegedSelfReview: boolean;
}

export interface SampleIdentityMergeRowResult {
  rowNumber: number;
  sourceRecordId: string;
  outcomeCode: "NO_CHANGE" | "PENDING_REVIEW" | "ERROR";
  message: string;
}

export interface SampleIdentityMergeJob {
  jobId: string;
  batchId: string;
  statusCode: "PENDING_REVIEW" | "COMPLETED" | "COMPLETED_WITH_ERRORS";
  acceptedRows: number;
  pendingRequests: number;
  skippedRows: number;
  failedRows: number;
  idempotencyKey: string;
  createdAt: string;
  rowResults: readonly SampleIdentityMergeRowResult[];
}

export interface SampleIdentityMergeRequest {
  requestId: string;
  sourceDomain: "PRODUCTION" | "MARKET";
  sourceRecordId: string;
  currentSamplePointId: string;
  targetSamplePointId: string;
  regionCode: string;
  reviewBasis: string;
  requestedBy: string;
  statusCode: "PENDING_REVIEW" | "APPLIED" | "REJECTED";
  reviewedBy: string | null;
  reviewReason: string | null;
  reviewedAt: string | null;
  resolutionBatchId: string | null;
  privilegedSelfReview: boolean;
}

export type BusinessImportDomain = "production" | "market" | "logistics";
export type OperationalReturnedCorrectionDomain = "production" | "logistics";

export interface BusinessImportDraft {
  id: string;
  importJobId?: string;
  domainCode: "PRODUCTION" | "MARKET" | "LOGISTICS";
  productCode: string;
  sampleName: string;
  regionCode: string;
  surveyPeriod: string | null;
  missingFields: readonly string[];
  completenessPercent: number;
  stateCode: "DRAFT" | "PROMOTED";
  canonicalRecordId: string | null;
  sourceRowNumber: number;
  version: number;
}

export interface LogisticsDefinition {
  productCode: string;
  fields: readonly {
    code: string;
    label: string;
    controlType: string;
    unit: string | null;
    precision: number | null;
    scale: number | null;
    required: boolean;
    readOnly: boolean;
    sortOrder: number;
    options: readonly { value: string; label: string; sortOrder: number }[];
  }[];
  actions: readonly {
    code: string;
    label: string;
    scope: string;
    sortOrder: number;
  }[];
}

export interface LogisticsRecordRow {
  id: string;
  productCode: string;
  values: Record<string, string>;
  displayValues: Record<string, string>;
  status: string;
  returnReason: string | null;
  allowedActions: readonly string[];
  version: number;
}

export interface BusinessRecordListItem {
  id: string;
  values: Record<string, string>;
  allowedActions: readonly string[];
  version: number;
}

export interface BusinessRecordListInput {
  productCode: string;
  page?: number;
  pageSize?: number;
  filters?: Readonly<Record<string, string | undefined>>;
}

export interface ProductionDefinition {
  productCode: string;
  objectTypeCode: string | null;
  contractVersion: typeof PRODUCTION_SURVEY_CONTRACT_VERSION;
  contractDigest: string;
  fields: readonly ProductionSurveyField[];
  groups: readonly {
    category: string;
    label: string;
    sortOrder: number;
    fields: readonly {
      code: string;
      label: string;
      valueType: string;
      unit: string | null;
      description: string | null;
      precision: number;
      scale: number;
      sortOrder: number;
    }[];
  }[];
}

export interface ProductionSurveyField {
  code: string;
  label: string;
  groupCode: string;
  groupLabel: string;
  groupOrder: number;
  sortOrder: number;
  valueType: string;
  controlType: string;
  unit: string | null;
  required: boolean;
  options: readonly string[];
  readOnly: boolean;
  calculated: boolean;
  importable: boolean;
  displayed: boolean;
  description: string | null;
  precision: number;
  scale: number;
}

const productionSurveyFieldSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  groupCode: z.string().min(1),
  groupLabel: z.string().min(1),
  groupOrder: z.number().int(),
  sortOrder: z.number().int(),
  valueType: z.string().min(1),
  controlType: z.string().min(1),
  unit: z.string().nullable(),
  required: z.boolean(),
  options: z.array(z.string()),
  readOnly: z.boolean(),
  calculated: z.boolean(),
  importable: z.boolean(),
  displayed: z.boolean(),
  description: z.string().nullable(),
  precision: z.number().int().nonnegative(),
  scale: z.number().int().nonnegative(),
});

const productionFactFieldSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  valueType: z.string().min(1),
  unit: z.string().nullable(),
  description: z.string().nullable(),
  precision: z.number().int(),
  scale: z.number().int(),
  sortOrder: z.number().int(),
});

const productionDefinitionSchema = z.object({
  productCode: z.string().min(1),
  objectTypeCode: z.string().nullable(),
  contractVersion: z.literal(PRODUCTION_SURVEY_CONTRACT_VERSION),
  contractDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  fields: z.array(productionSurveyFieldSchema).min(1),
  groups: z.array(
    z.object({
      category: z.string().min(1),
      label: z.string().min(1),
      sortOrder: z.number().int(),
      fields: z.array(productionFactFieldSchema),
    }),
  ),
});

function contractMismatch(details: unknown): RealtimeApiError {
  return new RealtimeApiError({
    code: "CONTRACT_MISMATCH",
    message: "产情字段契约与当前页面版本不一致，请刷新页面或联系管理员",
    status: 200,
    details,
  });
}

export function parseProductionDefinition(
  value: unknown,
  expectedContext?: {
    productCode: string;
    objectTypeCode?: string;
  },
): ProductionDefinition {
  const result = productionDefinitionSchema.safeParse(value);
  if (!result.success) throw contractMismatch(result.error.issues);
  const definition = result.data;
  if (definition.contractDigest !== PRODUCTION_SURVEY_CONTRACT_DIGEST) {
    throw contractMismatch({
      reason: "CONTRACT_DIGEST_MISMATCH",
      expected: PRODUCTION_SURVEY_CONTRACT_DIGEST,
      actual: definition.contractDigest,
    });
  }
  if (
    expectedContext &&
    (definition.productCode !== expectedContext.productCode ||
      definition.objectTypeCode !== (expectedContext.objectTypeCode ?? null))
  ) {
    throw contractMismatch({
      reason: "PRODUCTION_CONTEXT_MISMATCH",
      expectedProductCode: expectedContext.productCode,
      actualProductCode: definition.productCode,
      expectedObjectTypeCode: expectedContext.objectTypeCode ?? null,
      actualObjectTypeCode: definition.objectTypeCode,
    });
  }
  const codes = definition.fields.map(({ code }) => code);
  const byCode = new Map(definition.fields.map((field) => [field.code, field]));
  const requiredPublicBoundaries = [
    ["objectTypeCode", { controlType: "SELECT", required: true }],
    ["regionCode", { controlType: "REGION", required: true }],
    ["surveyYear", { controlType: "SELECT", required: true }],
    ["surveyMonth", { controlType: "SELECT", required: false }],
    ["PROD_SAMPLE_NAME", { readOnly: false }],
    [
      "PROD_REPORTER_NAME",
      {
        controlType: "READONLY_TEXT",
        required: true,
        readOnly: true,
        importable: false,
      },
    ],
    ["PROD_SURVEYOR_NAME", { required: false, readOnly: false }],
    ["PROD_SURVEYOR_PHONE", { required: false, readOnly: false }],
    ["PROD_SAMPLE_CONTACT", { required: true, readOnly: false }],
    ["PROD_SAMPLE_LATITUDE", { controlType: "DECIMAL", required: true }],
    ["PROD_SAMPLE_LONGITUDE", { controlType: "DECIMAL", required: true }],
    ["cultivatedAreaMu", { controlType: "DECIMAL", required: true }],
    ["yieldPerMuKilograms", { controlType: "DECIMAL", required: true }],
    [
      "estimatedOutputKilograms",
      { readOnly: true, calculated: true, importable: false },
    ],
    ["yearOnYear", { readOnly: true, calculated: true, importable: false }],
  ] as const;
  const missingRequiredCodes = requiredPublicBoundaries
    .filter(([code]) => !byCode.has(code))
    .map(([code]) => code);
  const invalidRequiredCodes = requiredPublicBoundaries.flatMap(
    ([code, expected]) => {
      const field = byCode.get(code);
      if (!field) return [];
      const invalid = Object.entries(expected).some(
        ([property, expectedValue]) =>
          field[property as keyof typeof field] !== expectedValue,
      );
      return invalid ? [code] : [];
    },
  );
  const privateCodes = new Set([
    "PROD_SAMPLE_SUBJECT_CODE",
    "PROD_SURPLUS_SUBJECT_CODE",
    "PROD_SURPLUS_CUTOFF_DATE",
    "sample_point_id",
    "evidencePhotoId",
    "surveyDate",
  ]);
  const exposedPrivateCodes = codes.filter((code) => privateCodes.has(code));
  const unapprovedPublicCodes = codes.filter(
    (code) => !PRODUCTION_PUBLIC_FIELD_CODES.has(code),
  );
  const orphanGroupCodes = definition.groups
    .flatMap(({ fields }) => fields)
    .map(({ code }) => code)
    .filter((code) => !byCode.has(code));
  const ordered = definition.fields.every((field, index, fields) => {
    const previous = fields[index - 1];
    return (
      !previous ||
      field.groupOrder > previous.groupOrder ||
      (field.groupOrder === previous.groupOrder &&
        field.sortOrder >= previous.sortOrder)
    );
  });
  if (
    new Set(codes).size !== codes.length ||
    missingRequiredCodes.length > 0 ||
    invalidRequiredCodes.length > 0 ||
    exposedPrivateCodes.length > 0 ||
    unapprovedPublicCodes.length > 0 ||
    orphanGroupCodes.length > 0 ||
    definition.fields.some(({ displayed }) => !displayed) ||
    !ordered
  ) {
    throw contractMismatch({
      reason: "INVALID_PRODUCTION_FIELD_BOUNDARY",
      missingRequiredCodes,
      invalidRequiredCodes,
      exposedPrivateCodes,
      unapprovedPublicCodes,
      orphanGroupCodes,
      duplicateCodes: codes.filter(
        (code, index) => codes.indexOf(code) !== index,
      ),
      ordered,
    });
  }
  return definition;
}

export interface MarketDefinition {
  productCode: string;
  objectTypeCode: string | null;
  coreFields: readonly {
    code: string;
    label: string;
    controlType: string;
    unit: string | null;
    description: string | null;
    capability: string | null;
    required: boolean;
    precision: number | null;
    scale: number | null;
    sortOrder: number;
    options: readonly { value: string; label: string; sortOrder: number }[];
  }[];
  groups: readonly ProductionDefinition["groups"][number][];
}

export interface MarketObjectRole {
  roleId: string;
  label: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  capabilityTemplateVersionId: string;
}

export interface MarketObjectRow {
  objectId: string;
  objectName: string;
  objectTypeId: string;
  objectTypeLabel: string;
  regionCode: string;
  regionName: string;
  productIds: readonly string[];
  productLabels: readonly string[];
  cultivarIds: readonly string[];
  cultivarLabels: readonly string[];
  sourceChannelId: string;
  sourceChannelLabel: string;
  responsibleUserId: string;
  responsiblePerson: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  validityStatus: "active" | "inactive";
  roles: readonly MarketObjectRole[];
  version: number;
}

export interface MarketObjectMutation {
  objectName: string;
  objectTypeId: string;
  regionCode: string;
  productIds: readonly string[];
  cultivarIds: readonly string[];
  sourceChannelId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  validityStatus: "active" | "inactive";
  roles: readonly MarketObjectRole[];
}

export interface RealtimeBusinessRepository {
  loadObservableAnalysisSnapshot(
    input: ObservableAnalysisQuery,
  ): Promise<ObservableAnalysisSnapshot>;
  loadCurrentSession(): Promise<CurrentSession>;
  listEmployees(): Promise<readonly EmployeeProfile[]>;
  loadAssignmentOptions(
    workUnitCode: string,
  ): Promise<IdentityAssignmentOptions>;
  inviteEmployee(input: EmployeeInvitation): Promise<EmployeeProfile>;
  updateEmployee(
    subjectId: string,
    input: EmployeeAssignmentUpdate,
  ): Promise<EmployeeProfile>;
  listAccessReviews(
    workUnitCode: string,
  ): Promise<readonly AccessReviewCampaign[]>;
  createAccessReview(input: {
    name: string;
    workUnitCode: string;
    dueAt: string;
  }): Promise<AccessReviewCampaign>;
  decideAccessReview(
    reviewId: string,
    decisions: readonly AccessReviewDecision[],
  ): Promise<AccessReviewCampaign>;
  listAuditEvents(input?: BusinessAuditQuery): Promise<Page<BusinessAuditRow>>;
  loadWorkObligationWeeklyReport(
    input: WorkObligationReportInput,
  ): Promise<WorkObligationWeeklyReport>;
  createWorkObligationReportExport(
    input: WorkObligationReportInput,
  ): Promise<WorkObligationReportExport>;
  downloadWorkObligationReport(exportId: string): Promise<Blob>;
  listNotifications(): Promise<BusinessNotificationPage>;
  markNotificationRead(id: string): Promise<BusinessNotificationRow>;
  subscribeBusinessEvents(
    afterSequence: number,
    onChange: (event: BusinessNotificationRow) => void,
    onError?: () => void,
  ): () => void;
  uploadEvidencePhoto(input: EvidencePhotoUpload): Promise<EvidencePhotoRow>;
  loadMasterData(): Promise<MasterDataSnapshot>;
  listProducts?(
    domain: "PRODUCTION" | "MARKET" | "LOGISTICS",
    pageKind: string,
  ): Promise<readonly MasterProduct[]>;
  loadSupplySurveyPeriods(): Promise<readonly SupplySurveyPeriod[]>;
  listAnnualComparisonDefinitions(
    sourceDomain: "PRODUCTION" | "MARKET",
    productCode: string,
  ): Promise<readonly AnnualComparisonDefinition[]>;
  loadAnnualComparison(input: {
    productCode: string;
    cultivarCode?: string;
    regionCode: string;
    surveyYear: number;
    indicatorCode: string;
  }): Promise<AnnualComparisonView>;
  getSampleNetwork?(year: number): Promise<AnnualSampleNetwork>;
  getSampleNetworkComparison?(
    year: number,
    regionCode?: string,
    productCode?: string,
  ): Promise<SampleNetworkComparison>;
  generateSampleNetworkCandidates?(
    year: number,
    carriedFromYear?: number,
  ): Promise<AnnualSampleNetwork>;
  updateSampleNetworkMember?(
    year: number,
    samplePointId: string,
    decision: SampleNetworkMemberDecision,
  ): Promise<AnnualSampleNetwork>;
  submitSampleNetwork?(
    year: number,
    version: number,
  ): Promise<AnnualSampleNetwork>;
  reviewSampleNetwork?(
    year: number,
    version: number,
    decision: "APPROVE" | "RETURN",
    reason: string,
  ): Promise<AnnualSampleNetwork>;
  loadReportParameterOptions(): Promise<ReportParameterOptions>;
  createReportPreview(input: {
    definitionCode: string;
    productCode?: string;
    cultivarCode?: string;
    regionLevel: string;
    regionCode: string;
    periodCode: string;
  }): Promise<ReportPreview>;
  createReportExport(
    previewId: string,
    formatCode: string,
  ): Promise<ReportExport>;
  downloadReportExport(exportId: string): Promise<Blob>;
  createReportPublication(
    previewId: string,
    exportTaskId: string,
    expectedVersion: number,
  ): Promise<ReportPublication>;
  listCultivars(productCode: string): Promise<readonly MasterCultivar[]>;
  listObjectTypes(
    productCode: string,
    domain: string,
  ): Promise<readonly MasterObjectType[]>;
  loadProductionDefinition(
    productCode: string,
    objectTypeCode?: string,
  ): Promise<ProductionDefinition>;
  listEligibleFormalSamples?(input: {
    domain: FormalSampleObservationDomain;
    productCode: string;
    regionCode?: string;
    objectTypeCode?: string;
    keyword?: string;
    year: number;
    observedAt: string;
  }): Promise<readonly EligibleFormalSample[]>;
  listFormalSampleObservationHistory?(input: {
    domain: FormalSampleObservationDomain;
    samplePointId: string;
    productCode: string;
    year: number;
    pageNumber?: number;
    pageSize?: number;
  }): Promise<FormalSampleObservationHistoryPage>;
  saveFormalSampleObservation?(
    input: {
      domain: FormalSampleObservationDomain;
      samplePointId: string;
      productCode: string;
      observedAt: string;
      payload: unknown;
    },
    idempotencyKey: string,
  ): Promise<FormalSampleObservationResult>;
  loadMarketDefinition(
    productCode: string,
    objectTypeCode?: string,
  ): Promise<MarketDefinition>;
  listMarketObjects?(): Promise<readonly MarketObjectRow[]>;
  createMarketObject?(input: MarketObjectMutation): Promise<MarketObjectRow>;
  updateMarketObject?(
    id: string,
    input: MarketObjectMutation & { version: number },
  ): Promise<MarketObjectRow>;
  listWorkItems(input?: {
    scope?: "PENDING" | "COMPLETED";
    page?: number;
    pageSize?: number;
    status?: string;
    domain?: string;
    regionId?: string;
    productCode?: string;
  }): Promise<Page<WorkItemRow>>;
  batchApproveWorkItems?(
    input: BatchReviewWorkItemsInput,
  ): Promise<BatchReviewWorkItemsResult>;
  listProduction(
    input: BusinessRecordListInput,
  ): Promise<Page<BusinessRecordListItem>>;
  getProduction(id: string): Promise<ProductionRecordRow>;
  createProduction(draft: ProductionDraftPayload): Promise<ProductionRecordRow>;
  createAndSubmitProduction(
    draft: ProductionDraftPayload,
  ): Promise<ProductionRecordRow>;
  updateProduction(
    id: string,
    draft: ProductionDraftPayload & { version: number },
  ): Promise<ProductionRecordRow>;
  updateAndSubmitProduction(
    id: string,
    draft: ProductionDraftPayload & { version: number },
  ): Promise<ProductionRecordRow>;
  transitionProduction(
    id: string,
    action: "submit" | "approve" | "return" | "void",
    version: number,
    reason?: string,
  ): Promise<ProductionRecordRow>;
  listMarket(
    input: BusinessRecordListInput,
  ): Promise<Page<BusinessRecordListItem>>;
  getMarket(id: string): Promise<MarketRecordRow>;
  createMarket(draft: MarketDraftPayload): Promise<MarketRecordRow>;
  createAndSubmitMarket(draft: MarketDraftPayload): Promise<MarketRecordRow>;
  updateMarket(
    id: string,
    draft: MarketDraftPayload & { version: number },
  ): Promise<MarketRecordRow>;
  updateAndSubmitMarket(
    id: string,
    draft: MarketDraftPayload & { version: number },
  ): Promise<MarketRecordRow>;
  transitionMarket(
    id: string,
    action: "submit" | "approve" | "return" | "void",
    version: number,
    reason?: string,
  ): Promise<MarketRecordRow>;
  loadSupplyInputWorkspace(input: {
    productCode: string;
    regionCode: string;
    periodCode: string;
  }): Promise<SupplyInputWorkspace>;
  listSupplyAccounts(input: {
    productCode: string;
    regionCode: string;
    periodCode: string;
    resultState?: string;
  }): Promise<readonly SupplyAccountRow[]>;
  createSupplyInputSet(input: {
    productCode: string;
    regionCode: string;
    periodCode: string;
    reason: string;
    expectedVersion: number;
    items: readonly { roleCode: string; sourceReleaseId: string }[];
  }): Promise<SupplyInputSetRow>;
  approveSupplyManualDecision(input: {
    productCode: string;
    regionCode: string;
    periodCode: string;
    roleCode: string;
    value: string;
    reason: string;
    expectedVersion: number;
  }): Promise<SupplyReleaseMutationResult>;
  releaseSupplySource(
    input: SupplySourceReleaseInput,
  ): Promise<SupplyReleaseMutationResult>;
  runSupplyAccount(input: {
    productCode: string;
    regionCode: string;
    periodCode: string;
    inputSetId: string;
    adjustmentProposalValue: string;
    adjustmentProposalReason: string;
    expectedDecisionVersion: number;
    publish: boolean;
  }): Promise<SupplyAccountRow>;
  downloadSamplePointCoordinateCorrectionWorkbook?(): Promise<Blob>;
  uploadSamplePointCoordinateCorrectionWorkbook?(
    file: File,
    idempotencyKey: string,
  ): Promise<SamplePointCoordinateCorrectionJob>;
  listSamplePointCoordinateCorrectionJobs?(): Promise<
    readonly SamplePointCoordinateCorrectionJob[]
  >;
  getSamplePointCoordinateCorrectionJob?(
    jobId: string,
  ): Promise<SamplePointCoordinateCorrectionJob>;
  downloadSamplePointCoordinateCorrectionErrors?(jobId: string): Promise<Blob>;
  retrySamplePointCoordinateCorrectionJob?(
    jobId: string,
    idempotencyKey: string,
  ): Promise<SamplePointCoordinateCorrectionJob>;
  listSamplePointCoordinateCorrectionRequests?(): Promise<
    readonly SamplePointCoordinateCorrectionRequest[]
  >;
  reviewSamplePointCoordinateCorrection?(
    requestId: string,
    decision: "APPROVE" | "REJECT",
    reason: string,
  ): Promise<SamplePointCoordinateCorrectionRequest>;
  listSampleIdentityReviews?(): Promise<readonly SampleIdentityReviewItem[]>;
  decideSampleIdentityReview?(
    draftId: string,
    decision: "LINK_EXISTING" | "CONFIRM_DISTINCT" | "RETURN_FOR_CORRECTION",
    targetSamplePointId: string | null,
    expectedVersion: number,
    reason: string,
  ): Promise<SampleIdentityDecision>;
  downloadSampleIdentityMergeWorkbook?(): Promise<Blob>;
  uploadSampleIdentityMergeWorkbook?(
    file: File,
    idempotencyKey: string,
  ): Promise<SampleIdentityMergeJob>;
  listSampleIdentityMergeJobs?(): Promise<readonly SampleIdentityMergeJob[]>;
  getSampleIdentityMergeJob?(jobId: string): Promise<SampleIdentityMergeJob>;
  listSampleIdentityMergeRequests?(): Promise<
    readonly SampleIdentityMergeRequest[]
  >;
  reviewSampleIdentityMergeRequest?(
    requestId: string,
    decision: "APPROVE" | "REJECT",
    reason: string,
  ): Promise<SampleIdentityMergeRequest>;
  importProductionCsv(
    file: File,
    productCode: string,
    objectTypeCode: string,
    photos?: readonly File[],
  ): Promise<ProductionImportJob>;
  downloadProductionXlsxTemplate?(
    productCode: string,
    objectTypeCode: string,
  ): Promise<Blob>;
  importMarketWorkbook?(
    file: File,
    productCode: string,
    objectTypeCode: string,
    photos?: readonly File[],
  ): Promise<ProductionImportJob>;
  downloadMarketXlsxTemplate?(
    productCode: string,
    objectTypeCode: string,
  ): Promise<Blob>;
  downloadMarketReturnedCorrectionWorkbook?(productCode: string): Promise<Blob>;
  importMarketReturnedCorrectionWorkbook?(
    file: File,
    productCode: string,
  ): Promise<ProductionImportJob>;
  getMarketReturnedCorrectionJob?(
    importJobId: string,
  ): Promise<ProductionImportJob>;
  downloadMarketReturnedCorrectionErrors?(importJobId: string): Promise<Blob>;
  downloadReturnedCorrectionWorkbook?(
    domain: OperationalReturnedCorrectionDomain,
    productCode: string,
  ): Promise<Blob>;
  importReturnedCorrectionWorkbook?(
    domain: OperationalReturnedCorrectionDomain,
    file: File,
    productCode: string,
  ): Promise<ProductionImportJob>;
  getReturnedCorrectionJob?(
    domain: OperationalReturnedCorrectionDomain,
    importJobId: string,
  ): Promise<ProductionImportJob>;
  downloadReturnedCorrectionErrors?(
    domain: OperationalReturnedCorrectionDomain,
    importJobId: string,
  ): Promise<Blob>;
  importLogisticsWorkbook?(
    file: File,
    productCode: string,
    photos?: readonly File[],
  ): Promise<ProductionImportJob>;
  downloadLogisticsXlsxTemplate?(productCode: string): Promise<Blob>;
  getImportJob?(
    domain: BusinessImportDomain,
    importJobId: string,
  ): Promise<ProductionImportJob>;
  listImportJobs?(
    domain: BusinessImportDomain,
    pageNumber?: number,
    pageSize?: number,
  ): Promise<Page<ProductionImportJob>>;
  retryImportJob?(
    domain: BusinessImportDomain,
    importJobId: string,
  ): Promise<ProductionImportJob>;
  downloadImportErrors?(
    domain: BusinessImportDomain,
    importJobId: string,
  ): Promise<Blob>;
  getProductionImportPhotoManifest?(
    importJobId: string,
  ): Promise<ProductionImportPhotoManifest>;
  supplementProductionImportPhoto?(
    importJobId: string,
    file: File,
  ): Promise<ProductionImportPhotoSupplementResult>;
  listImportDrafts?(
    importJobId: string,
  ): Promise<readonly BusinessImportDraft[]>;
  submitImportDraft?(draftId: string): Promise<BusinessImportDraft>;
  listPendingImportDrafts?(
    domainCode: "PRODUCTION" | "MARKET" | "LOGISTICS",
    productCode: string,
  ): Promise<readonly BusinessImportDraft[]>;
  submitImportDraftJob?(importJobId: string): Promise<{
    importJobId: string;
    submittedRows: number;
    remainingDraftRows: number;
  }>;
  loadLogisticsDefinition(productCode: string): Promise<LogisticsDefinition>;
  listLogistics(
    input: BusinessRecordListInput,
  ): Promise<Page<LogisticsRecordRow>>;
  getLogistics(id: string): Promise<LogisticsRecordRow>;
  createLogistics(input: {
    productCode: string;
    values: Record<string, string>;
  }): Promise<LogisticsRecordRow>;
  updateLogistics(
    id: string,
    input: {
      productCode: string;
      values: Record<string, string>;
      version: number;
    },
  ): Promise<LogisticsRecordRow>;
  transitionLogistics(
    id: string,
    action: "submit" | "approve" | "return" | "void",
    version: number,
    reason?: string,
  ): Promise<LogisticsRecordRow>;
}

function transitionBody(
  version: number,
  reason?: string,
): { version: number; reason?: string } {
  return reason === undefined ? { version } : { version, reason };
}

function recordQuery(
  input: BusinessRecordListInput,
): Record<string, string | number | undefined> {
  return {
    productCode: input.productCode,
    pageKind: "MONITORING",
    pageNumber: input.page ?? 0,
    pageSize: input.pageSize ?? 100,
    ...Object.fromEntries(
      Object.entries(input.filters ?? {}).map(([code, value]) => [
        `filter.${code}`,
        value,
      ]),
    ),
  };
}

export function createRealtimeBusinessRepository(
  client: RealtimeApiClient = realtimeApiClient,
  options: RealtimeBusinessRepositoryOptions = {},
): RealtimeBusinessRepository {
  const streamBaseUrl = (options.eventStreamBaseUrl ?? "").replace(/\/$/u, "");
  const eventSourceFactory =
    options.eventSourceFactory ??
    ((url: string) => new EventSource(url, { withCredentials: true }));
  const productionDefinitionCache = new Map<string, ProductionDefinition>();
  const productionDefinitionRequests = new Map<
    string,
    Promise<ProductionDefinition>
  >();
  const marketDefinitionCache = new Map<string, MarketDefinition>();
  const marketDefinitionRequests = new Map<string, Promise<MarketDefinition>>();
  const logisticsDefinitionCache = new Map<string, LogisticsDefinition>();
  const logisticsDefinitionRequests = new Map<
    string,
    Promise<LogisticsDefinition>
  >();
  const observableSnapshotRequests = new Map<
    string,
    Promise<ObservableAnalysisSnapshot>
  >();
  function cachedDefinitionRead<T>(
    cache: Map<string, T>,
    requests: Map<string, Promise<T>>,
    key: string,
    read: () => Promise<T>,
  ): Promise<T> {
    const cached = cache.get(key);
    if (cached) return Promise.resolve(cached);
    const active = requests.get(key);
    if (active) return active;
    const request = read()
      .then((value) => {
        cache.set(key, value);
        return value;
      })
      .finally(() => {
        requests.delete(key);
      });
    requests.set(key, request);
    return request;
  }
  return {
    listEligibleFormalSamples: (input) =>
      client.get<readonly EligibleFormalSample[]>(
        "/api/v1/formal-sample-observations/eligible-samples",
        input,
      ),
    listFormalSampleObservationHistory: (input) =>
      client.get<FormalSampleObservationHistoryPage>(
        "/api/v1/formal-sample-observations/observations",
        input,
      ),
    saveFormalSampleObservation: (input, idempotencyKey) =>
      client.post<FormalSampleObservationResult>(
        "/api/v1/formal-sample-observations/observations",
        input,
        { headers: { "Idempotency-Key": idempotencyKey } },
      ),
    loadObservableAnalysisSnapshot: (input) => {
      const query = {
        productCode: input.productCode,
        regionCode: input.regionCode,
        surveyYear: input.surveyYear,
        surveyMonth: input.surveyMonth,
        cultivarCode: input.cultivarCode,
        subjectTypeCode: input.subjectTypeCode,
      };
      const key = JSON.stringify(query);
      const existing = observableSnapshotRequests.get(key);
      if (existing) return existing;
      const request = client
        .get<unknown>("/api/v1/observable-analysis/snapshots", query)
        .then(parseObservableAnalysisSnapshot);
      observableSnapshotRequests.set(key, request);
      const clear = () => {
        if (observableSnapshotRequests.get(key) === request) {
          observableSnapshotRequests.delete(key);
        }
      };
      void request.then(clear, clear);
      return request;
    },
    getSampleNetwork: (year) =>
      client.get<AnnualSampleNetwork>(`/api/v1/sample-networks/${year}`),
    getSampleNetworkComparison: (year, regionCode, productCode) =>
      client.get<SampleNetworkComparison>(
        `/api/v1/sample-networks/${year}/comparison`,
        productCode || regionCode
          ? {
              ...(productCode ? { productCode } : {}),
              ...(regionCode ? { regionCode } : {}),
            }
          : undefined,
      ),
    generateSampleNetworkCandidates: (year, carriedFromYear) =>
      client.post<AnnualSampleNetwork>(`/api/v1/sample-networks/${year}`, {
        carriedFromYear: carriedFromYear ?? null,
      }),
    updateSampleNetworkMember: (year, samplePointId, decision) =>
      client.put<AnnualSampleNetwork>(
        `/api/v1/sample-networks/${year}/members/${encodeURIComponent(samplePointId)}`,
        decision,
      ),
    submitSampleNetwork: (year, version) =>
      client.post<AnnualSampleNetwork>(
        `/api/v1/sample-networks/${year}/submit`,
        { version },
      ),
    reviewSampleNetwork: (year, version, decision, reason) =>
      client.post<AnnualSampleNetwork>(
        `/api/v1/sample-networks/${year}/review`,
        { version, decision, reason },
      ),
    loadCurrentSession: () => client.get<CurrentSession>(enterpriseSessionPath),
    listEmployees: () =>
      client.get<readonly EmployeeProfile[]>("/api/v1/identity/employees"),
    loadAssignmentOptions: (workUnitCode) =>
      client.get<IdentityAssignmentOptions>(
        "/api/v1/identity/employees/assignment-options",
        { workUnitCode },
      ),
    inviteEmployee: (input) =>
      client.post<EmployeeProfile>("/api/v1/identity/employees", input),
    updateEmployee: (subjectId, input) =>
      client.put<EmployeeProfile>(
        `/api/v1/identity/employees/${encodeURIComponent(subjectId)}`,
        input,
      ),
    listAccessReviews: (workUnitCode) =>
      client.get<readonly AccessReviewCampaign[]>(
        "/api/v1/identity/access-reviews",
        { workUnitCode },
      ),
    createAccessReview: (input) =>
      client.post<AccessReviewCampaign>(
        "/api/v1/identity/access-reviews",
        input,
      ),
    decideAccessReview: (reviewId, decisions) =>
      client.post<AccessReviewCampaign>(
        `/api/v1/identity/access-reviews/${encodeURIComponent(reviewId)}/decisions`,
        { decisions },
      ),
    listAuditEvents: (input = {}) =>
      client.get<Page<BusinessAuditRow>>("/api/v1/audit-events", {
        workUnitCode: input.workUnitCode,
        aggregateType: input.aggregateType,
        actorSubjectId: input.actorSubjectId,
        occurredFrom: input.occurredFrom,
        occurredTo: input.occurredTo,
        page: input.page ?? 0,
        pageSize: input.pageSize ?? 50,
      }),
    loadWorkObligationWeeklyReport: (input) =>
      client.get<WorkObligationWeeklyReport>(
        "/api/v1/work-obligation-reports/weekly",
        {
          weekStart: input.weekStart,
          subjectId: input.subjectId,
          workUnitCode: input.workUnitCode,
          businessDomain: input.businessDomain,
          regionCode: input.regionCode,
        },
      ),
    createWorkObligationReportExport: (input) =>
      client.post<WorkObligationReportExport>(
        "/api/v1/work-obligation-reports/weekly/exports",
        input,
      ),
    downloadWorkObligationReport: (exportId) =>
      client.download(
        `/api/v1/work-obligation-reports/exports/${encodeURIComponent(exportId)}/content`,
      ),
    listNotifications: () =>
      client.get<BusinessNotificationPage>("/api/v1/notifications"),
    markNotificationRead: (id) =>
      client.post<BusinessNotificationRow>(
        `/api/v1/notifications/${encodeURIComponent(id)}/read`,
      ),
    subscribeBusinessEvents: (afterSequence, onChange, onError) => {
      const cursor = Number.isSafeInteger(afterSequence)
        ? Math.max(0, afterSequence)
        : 0;
      const source = eventSourceFactory(
        `${streamBaseUrl}/api/v1/business-events/stream?after=${cursor}`,
      );
      source.addEventListener("business-change", (rawEvent) => {
        const data = (rawEvent as MessageEvent<unknown>).data;
        if (typeof data !== "string") return;
        try {
          onChange(JSON.parse(data) as BusinessNotificationRow);
        } catch {
          onError?.();
        }
      });
      source.addEventListener("error", () => onError?.());
      return () => source.close();
    },
    uploadEvidencePhoto: (input) => {
      const form = new FormData();
      form.append("file", input.file, input.file.name);
      form.append("capturedAt", input.capturedAt);
      form.append("latitude", input.latitude);
      form.append("longitude", input.longitude);
      form.append("watermarkText", input.watermarkText);
      return client.upload<EvidencePhotoRow>("/api/v1/evidence-photos", form);
    },
    async loadMasterData() {
      const [products, periods, regions, overviewOptions] = await Promise.all([
        client.get<MasterProduct[]>("/api/v1/master-data/products"),
        client.get<MasterPeriod[]>("/api/v1/master-data/business-periods"),
        client.get<MasterRegion[]>("/api/v1/master-data/regions"),
        client.get<{ years: readonly number[] }>("/api/v1/overview/options"),
      ]);
      return {
        products,
        periods,
        regions,
        approvedSurveyYears: overviewOptions.years,
      };
    },
    listProducts: (domain, pageKind) =>
      client.get<readonly MasterProduct[]>("/api/v1/master-data/products", {
        domain,
        pageKind,
      }),
    loadSupplySurveyPeriods: () =>
      client.get<SupplySurveyPeriod[]>(
        "/api/v1/master-data/supply-survey-periods",
      ),
    listAnnualComparisonDefinitions: (sourceDomain, productCode) =>
      client.get<AnnualComparisonDefinition[]>(
        "/api/v1/overview/annual-comparison-definitions",
        { sourceDomain, productCode },
      ),
    loadAnnualComparison: (input) =>
      client.get<AnnualComparisonView>(
        "/api/v1/overview/annual-comparisons",
        input,
      ),
    loadReportParameterOptions: () =>
      client.get<ReportParameterOptions>("/api/v1/reports/parameter-options"),
    createReportPreview: (input) =>
      client.post<ReportPreview>("/api/v1/reports/previews", input),
    createReportExport: (previewId, formatCode) =>
      client.post<ReportExport>(
        `/api/v1/reports/previews/${encodeURIComponent(previewId)}/exports`,
        { formatCode },
      ),
    downloadReportExport: (exportId) =>
      client.download(
        `/api/v1/reports/exports/${encodeURIComponent(exportId)}/content`,
      ),
    createReportPublication: (previewId, exportTaskId, expectedVersion) =>
      client.post<ReportPublication>(
        `/api/v1/reports/previews/${encodeURIComponent(previewId)}/publications`,
        { exportTaskId, expectedVersion },
      ),
    listCultivars: (productCode) =>
      client.get<MasterCultivar[]>(
        `/api/v1/master-data/products/${encodeURIComponent(productCode)}/cultivars`,
      ),
    listObjectTypes: (productCode, domain) =>
      client.get<MasterObjectType[]>("/api/v1/master-data/object-types", {
        productCode,
        domain,
      }),
    loadProductionDefinition: async (productCode, objectTypeCode) => {
      const expectedCacheKey = productionDefinitionCacheKey(
        productCode,
        objectTypeCode,
        PRODUCTION_SURVEY_CONTRACT_DIGEST,
      );
      return cachedDefinitionRead(
        productionDefinitionCache,
        productionDefinitionRequests,
        expectedCacheKey,
        async () =>
          parseProductionDefinition(
            await client.get<unknown>("/api/v1/production-record-definitions", {
              productCode,
              objectTypeCode,
              contractVersion: PRODUCTION_SURVEY_CONTRACT_VERSION,
              contractDigest: PRODUCTION_SURVEY_CONTRACT_DIGEST,
            }),
            { productCode, objectTypeCode },
          ),
      );
    },
    loadMarketDefinition: (productCode, objectTypeCode) => {
      const key = `${productCode}:${objectTypeCode ?? "ALL"}`;
      return cachedDefinitionRead(
        marketDefinitionCache,
        marketDefinitionRequests,
        key,
        () =>
          client.get<MarketDefinition>("/api/v1/market-record-definitions", {
            productCode,
            objectTypeCode,
          }),
      );
    },
    listMarketObjects: () =>
      client.get<readonly MarketObjectRow[]>("/api/v1/market-objects"),
    createMarketObject: (input) =>
      client.post<MarketObjectRow>("/api/v1/market-objects", input),
    updateMarketObject: (id, input) =>
      client.put<MarketObjectRow>(
        `/api/v1/market-objects/${encodeURIComponent(id)}`,
        input,
      ),
    listWorkItems: (input = {}) =>
      client.get<Page<WorkItemRow>>("/api/v1/work-items", {
        scope: input.scope ?? "PENDING",
        page: input.page ?? 0,
        pageSize: input.pageSize ?? 20,
        status: input.status,
        domain: input.domain,
        regionId: input.regionId,
        productCode: input.productCode,
      }),
    batchApproveWorkItems: (input) =>
      client.post<BatchReviewWorkItemsResult>(
        "/api/v1/work-items/batch-approve",
        input,
        { timeoutMs: 300_000 },
      ),
    listProduction: (input) =>
      client.get<Page<BusinessRecordListItem>>(
        "/api/v1/production-records",
        recordQuery(input),
      ),
    getProduction: (id) =>
      client.get<ProductionRecordRow>(
        `/api/v1/production-records/${encodeURIComponent(id)}`,
      ),
    createProduction: (draft) =>
      client.post<ProductionRecordRow>("/api/v1/production-records", draft),
    createAndSubmitProduction: (draft) =>
      client.post<ProductionRecordRow>(
        "/api/v1/production-records/submit",
        draft,
      ),
    updateProduction: (id, draft) =>
      client.put<ProductionRecordRow>(
        `/api/v1/production-records/${encodeURIComponent(id)}`,
        draft,
      ),
    updateAndSubmitProduction: (id, draft) =>
      client.put<ProductionRecordRow>(
        `/api/v1/production-records/${encodeURIComponent(id)}/submit`,
        draft,
      ),
    transitionProduction: (id, action, version, reason) =>
      client.post<ProductionRecordRow>(
        `/api/v1/production-records/${encodeURIComponent(id)}/${action}`,
        transitionBody(version, reason),
      ),
    listMarket: (input) =>
      client.get<Page<BusinessRecordListItem>>(
        "/api/v1/market-records",
        recordQuery(input),
      ),
    getMarket: (id) =>
      client.get<MarketRecordRow>(
        `/api/v1/market-records/${encodeURIComponent(id)}`,
      ),
    createMarket: (draft) =>
      client.post<MarketRecordRow>("/api/v1/market-records", draft),
    createAndSubmitMarket: (draft) =>
      client.post<MarketRecordRow>("/api/v1/market-records/submit", draft),
    updateMarket: (id, draft) =>
      client.put<MarketRecordRow>(
        `/api/v1/market-records/${encodeURIComponent(id)}`,
        draft,
      ),
    updateAndSubmitMarket: (id, draft) =>
      client.put<MarketRecordRow>(
        `/api/v1/market-records/${encodeURIComponent(id)}/submit`,
        draft,
      ),
    transitionMarket: (id, action, version, reason) =>
      client.post<MarketRecordRow>(
        `/api/v1/market-records/${encodeURIComponent(id)}/${action}`,
        transitionBody(version, reason),
      ),
    loadSupplyInputWorkspace: (input) =>
      client.get<SupplyInputWorkspace>(
        "/api/v1/supply-input-workspaces",
        input,
      ),
    listSupplyAccounts: (input) =>
      client.get<SupplyAccountRow[]>("/api/v1/supply-accounts", input),
    createSupplyInputSet: (input) =>
      client.post<SupplyInputSetRow>("/api/v1/supply-input-sets", input),
    approveSupplyManualDecision: (input) =>
      client.post<SupplyReleaseMutationResult>(
        "/api/v1/supply-inputs/manual-decisions",
        input,
      ),
    releaseSupplySource: (input) =>
      client.post<SupplyReleaseMutationResult>(
        "/api/v1/supply-sources/releases",
        input,
      ),
    runSupplyAccount: (input) =>
      client.post<SupplyAccountRow>("/api/v1/supply-accounts/runs", input),
    downloadSamplePointCoordinateCorrectionWorkbook: () =>
      client.download("/api/v1/sample-point-coordinate-corrections/export"),
    uploadSamplePointCoordinateCorrectionWorkbook: (file, idempotencyKey) => {
      const form = new FormData();
      form.append("file", file, file.name);
      return client.upload<SamplePointCoordinateCorrectionJob>(
        "/api/v1/sample-point-coordinate-corrections",
        form,
        { "Idempotency-Key": idempotencyKey },
      );
    },
    listSamplePointCoordinateCorrectionJobs: () =>
      client.get<readonly SamplePointCoordinateCorrectionJob[]>(
        "/api/v1/sample-point-coordinate-corrections/history",
      ),
    getSamplePointCoordinateCorrectionJob: (jobId) =>
      client.get<SamplePointCoordinateCorrectionJob>(
        `/api/v1/sample-point-coordinate-corrections/jobs/${encodeURIComponent(jobId)}`,
      ),
    downloadSamplePointCoordinateCorrectionErrors: (jobId) =>
      client.download(
        `/api/v1/sample-point-coordinate-corrections/jobs/${encodeURIComponent(jobId)}/errors`,
      ),
    retrySamplePointCoordinateCorrectionJob: (jobId, idempotencyKey) =>
      client.post<SamplePointCoordinateCorrectionJob>(
        `/api/v1/sample-point-coordinate-corrections/jobs/${encodeURIComponent(jobId)}/retry`,
        undefined,
        {
          headers: { "Idempotency-Key": idempotencyKey },
          timeoutMs: 300_000,
        },
      ),
    listSamplePointCoordinateCorrectionRequests: () =>
      client.get<readonly SamplePointCoordinateCorrectionRequest[]>(
        "/api/v1/sample-point-coordinate-corrections/requests",
      ),
    reviewSamplePointCoordinateCorrection: (requestId, decision, reason) =>
      client.post<SamplePointCoordinateCorrectionRequest>(
        `/api/v1/sample-point-coordinate-corrections/requests/${encodeURIComponent(requestId)}/review`,
        { decision, reason },
      ),
    listSampleIdentityReviews: () =>
      client.get<readonly SampleIdentityReviewItem[]>(
        "/api/v1/sample-point-identities/reviews",
      ),
    decideSampleIdentityReview: (
      draftId,
      decision,
      targetSamplePointId,
      expectedVersion,
      reason,
    ) =>
      client.post<SampleIdentityDecision>(
        `/api/v1/sample-point-identities/reviews/${encodeURIComponent(draftId)}/decisions`,
        { decision, targetSamplePointId, expectedVersion, reason },
      ),
    downloadSampleIdentityMergeWorkbook: () =>
      client.download("/api/v1/sample-point-identities/merge-export"),
    uploadSampleIdentityMergeWorkbook: (file, idempotencyKey) => {
      const form = new FormData();
      form.append("file", file, file.name);
      return client.upload<SampleIdentityMergeJob>(
        "/api/v1/sample-point-identities/merge-jobs",
        form,
        { "Idempotency-Key": idempotencyKey },
      );
    },
    listSampleIdentityMergeJobs: () =>
      client.get<readonly SampleIdentityMergeJob[]>(
        "/api/v1/sample-point-identities/merge-jobs",
      ),
    getSampleIdentityMergeJob: (jobId) =>
      client.get<SampleIdentityMergeJob>(
        `/api/v1/sample-point-identities/merge-jobs/${encodeURIComponent(jobId)}`,
      ),
    listSampleIdentityMergeRequests: () =>
      client.get<readonly SampleIdentityMergeRequest[]>(
        "/api/v1/sample-point-identities/merge-requests",
      ),
    reviewSampleIdentityMergeRequest: (requestId, decision, reason) =>
      client.post<SampleIdentityMergeRequest>(
        `/api/v1/sample-point-identities/merge-requests/${encodeURIComponent(requestId)}/review`,
        { decision, reason },
      ),
    importProductionCsv: (file, productCode, _objectTypeCode, photos = []) => {
      const form = new FormData();
      form.append("file", file, file.name);
      photos.forEach((photo) => form.append("photos", photo, photo.name));
      return client.upload<ProductionImportJob>(
        `/api/v1/imports/production?productCode=${encodeURIComponent(productCode)}`,
        form,
        {
          "Idempotency-Key": crypto.randomUUID(),
        },
      );
    },
    downloadProductionXlsxTemplate: (productCode) =>
      client.download("/api/v1/imports/production/template", {
        format: "xlsx",
        productCode,
      }),
    importMarketWorkbook: (file, productCode, _objectTypeCode, photos = []) => {
      const form = new FormData();
      form.append("file", file, file.name);
      photos.forEach((photo) => form.append("photos", photo, photo.name));
      return client.upload<ProductionImportJob>(
        `/api/v1/imports/market?productCode=${encodeURIComponent(productCode)}`,
        form,
        {
          "Idempotency-Key": crypto.randomUUID(),
        },
      );
    },
    downloadMarketXlsxTemplate: (productCode) =>
      client.download("/api/v1/imports/market/template", {
        format: "xlsx",
        productCode,
      }),
    downloadMarketReturnedCorrectionWorkbook: (productCode) =>
      client.download("/api/v1/imports/market/returned-corrections/template", {
        productCode,
      }),
    importMarketReturnedCorrectionWorkbook: (file, productCode) => {
      const form = new FormData();
      form.append("file", file, file.name);
      return client.upload<ProductionImportJob>(
        `/api/v1/imports/market/returned-corrections?productCode=${encodeURIComponent(productCode)}`,
        form,
        { "Idempotency-Key": crypto.randomUUID() },
      );
    },
    getMarketReturnedCorrectionJob: (importJobId) =>
      client.get<ProductionImportJob>(
        `/api/v1/imports/market/returned-corrections/${encodeURIComponent(importJobId)}`,
      ),
    downloadMarketReturnedCorrectionErrors: (importJobId) =>
      client.download(
        `/api/v1/imports/market/returned-corrections/${encodeURIComponent(importJobId)}/errors`,
      ),
    downloadReturnedCorrectionWorkbook: (domain, productCode) =>
      client.download(
        `/api/v1/imports/${domain}/returned-corrections/template`,
        { productCode },
      ),
    importReturnedCorrectionWorkbook: (domain, file, productCode) => {
      const form = new FormData();
      form.append("file", file, file.name);
      return client.upload<ProductionImportJob>(
        `/api/v1/imports/${domain}/returned-corrections?productCode=${encodeURIComponent(productCode)}`,
        form,
        { "Idempotency-Key": crypto.randomUUID() },
      );
    },
    getReturnedCorrectionJob: (domain, importJobId) =>
      client.get<ProductionImportJob>(
        `/api/v1/imports/${domain}/returned-corrections/${encodeURIComponent(importJobId)}`,
      ),
    downloadReturnedCorrectionErrors: (domain, importJobId) =>
      client.download(
        `/api/v1/imports/${domain}/returned-corrections/${encodeURIComponent(importJobId)}/errors`,
      ),
    importLogisticsWorkbook: (file, productCode, photos = []) => {
      const form = new FormData();
      form.append("file", file, file.name);
      photos.forEach((photo) => form.append("photos", photo, photo.name));
      return client.upload<ProductionImportJob>(
        `/api/v1/imports/logistics?productCode=${encodeURIComponent(productCode)}`,
        form,
        { "Idempotency-Key": crypto.randomUUID() },
      );
    },
    downloadLogisticsXlsxTemplate: (productCode) =>
      client.download("/api/v1/imports/logistics/template", { productCode }),
    getImportJob: (domain, importJobId) =>
      client.get<ProductionImportJob>(
        `/api/v1/imports/${domain}/${encodeURIComponent(importJobId)}`,
      ),
    listImportJobs: (domain, pageNumber = 0, pageSize = 10) =>
      client.get<Page<ProductionImportJob>>(`/api/v1/imports/${domain}`, {
        pageNumber,
        pageSize,
      }),
    retryImportJob: (domain, importJobId) =>
      client.post<ProductionImportJob>(
        `/api/v1/imports/${domain}/${encodeURIComponent(importJobId)}/retries`,
      ),
    downloadImportErrors: (domain, importJobId) =>
      client.download(
        `/api/v1/imports/${domain}/${encodeURIComponent(importJobId)}/errors`,
      ),
    getProductionImportPhotoManifest: (importJobId) =>
      client.get<ProductionImportPhotoManifest>(
        `/api/v1/imports/production/${encodeURIComponent(importJobId)}/photo-manifest`,
      ),
    supplementProductionImportPhoto: (importJobId, file) => {
      const form = new FormData();
      form.append("file", file, file.name);
      return client.upload<ProductionImportPhotoSupplementResult>(
        `/api/v1/imports/production/${encodeURIComponent(importJobId)}/photos`,
        form,
      );
    },
    listImportDrafts: (importJobId) =>
      client.get<BusinessImportDraft[]>("/api/v1/import-drafts", {
        importJobId,
      }),
    submitImportDraft: (draftId) =>
      client.post<BusinessImportDraft>(
        `/api/v1/import-drafts/${encodeURIComponent(draftId)}/submit`,
      ),
    listPendingImportDrafts: (domainCode, productCode) =>
      client.get<BusinessImportDraft[]>("/api/v1/import-drafts", {
        domainCode,
        productCode,
        stateCode: "DRAFT",
      }),
    submitImportDraftJob: (importJobId) =>
      client.post<{
        importJobId: string;
        submittedRows: number;
        remainingDraftRows: number;
      }>(
        `/api/v1/import-drafts/jobs/${encodeURIComponent(importJobId)}/submit`,
      ),
    loadLogisticsDefinition: (productCode) =>
      cachedDefinitionRead(
        logisticsDefinitionCache,
        logisticsDefinitionRequests,
        productCode,
        () =>
          client.get<LogisticsDefinition>(
            "/api/v1/logistics-record-definitions",
            { productCode },
          ),
      ),
    listLogistics: (input) =>
      client.get<Page<LogisticsRecordRow>>("/api/v1/logistics-records", {
        productCode: input.productCode,
        pageNumber: input.page ?? 0,
        pageSize: input.pageSize ?? 100,
        ...Object.fromEntries(
          Object.entries(input.filters ?? {}).map(([code, value]) => [
            `filter.${code}`,
            value,
          ]),
        ),
      }),
    getLogistics: (id) =>
      client.get<LogisticsRecordRow>(
        `/api/v1/logistics-records/${encodeURIComponent(id)}`,
      ),
    createLogistics: (input) =>
      client.post<LogisticsRecordRow>("/api/v1/logistics-records", input),
    updateLogistics: (id, input) =>
      client.put<LogisticsRecordRow>(
        `/api/v1/logistics-records/${encodeURIComponent(id)}`,
        input,
      ),
    transitionLogistics: (id, action, version, reason) =>
      client.post<LogisticsRecordRow>(
        `/api/v1/logistics-records/${encodeURIComponent(id)}/${action}`,
        transitionBody(version, reason),
      ),
  };
}

export const realtimeBusinessRepository = createRealtimeBusinessRepository();
