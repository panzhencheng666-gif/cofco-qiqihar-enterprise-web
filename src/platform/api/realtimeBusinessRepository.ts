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

export interface ReportDefinition {
  code: string;
  name: string;
  businessDomain: "PRODUCTION" | "MARKET" | "LOGISTICS" | "SUPPLY";
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
  domainCode: string;
  statusCode:
    "QUEUED" | "PROCESSING" | "COMPLETED" | "COMPLETED_WITH_ERRORS" | "FAILED";
  importedRows: number;
  failedRows: number;
  retryOf?: string | null;
  createdAt?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  attemptCount?: number;
  failureCode?: string | null;
  failureMessage?: string | null;
}

export type BusinessImportDomain = "production" | "market" | "logistics";

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
    ["PROD_CULTIVAR_NAME", {}],
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
    ["PROD_REPORTER_PHONE", { required: true, readOnly: false }],
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
  loadReportParameterOptions(): Promise<ReportParameterOptions>;
  createReportPreview(input: {
    definitionCode: string;
    productCode: string;
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
  listProduction(
    input: BusinessRecordListInput,
  ): Promise<Page<BusinessRecordListItem>>;
  getProduction(id: string): Promise<ProductionRecordRow>;
  createProduction(draft: ProductionDraftPayload): Promise<ProductionRecordRow>;
  updateProduction(
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
  updateMarket(
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
  importProductionCsv(
    file: File,
    productCode: string,
    objectTypeCode: string,
  ): Promise<ProductionImportJob>;
  downloadProductionXlsxTemplate?(
    productCode: string,
    objectTypeCode: string,
  ): Promise<Blob>;
  importMarketWorkbook?(
    file: File,
    productCode: string,
    objectTypeCode: string,
  ): Promise<ProductionImportJob>;
  downloadMarketXlsxTemplate?(
    productCode: string,
    objectTypeCode: string,
  ): Promise<Blob>;
  importLogisticsWorkbook?(
    file: File,
    productCode: string,
  ): Promise<ProductionImportJob>;
  downloadLogisticsXlsxTemplate?(productCode: string): Promise<Blob>;
  getImportJob?(
    domain: BusinessImportDomain,
    importJobId: string,
  ): Promise<ProductionImportJob>;
  retryImportJob?(
    domain: BusinessImportDomain,
    importJobId: string,
  ): Promise<ProductionImportJob>;
  downloadImportErrors?(
    domain: BusinessImportDomain,
    importJobId: string,
  ): Promise<Blob>;
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
  return {
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
      const [products, periods, regions] = await Promise.all([
        client.get<MasterProduct[]>("/api/v1/master-data/products"),
        client.get<MasterPeriod[]>("/api/v1/master-data/business-periods"),
        client.get<MasterRegion[]>("/api/v1/master-data/regions"),
      ]);
      return { products, periods, regions };
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
      const cached = productionDefinitionCache.get(expectedCacheKey);
      if (cached) return cached;
      const definition = parseProductionDefinition(
        await client.get<unknown>("/api/v1/production-record-definitions", {
          productCode,
          objectTypeCode,
          contractVersion: PRODUCTION_SURVEY_CONTRACT_VERSION,
          contractDigest: PRODUCTION_SURVEY_CONTRACT_DIGEST,
        }),
        { productCode, objectTypeCode },
      );
      const cacheKey = productionDefinitionCacheKey(
        definition.productCode,
        definition.objectTypeCode,
        definition.contractDigest,
      );
      productionDefinitionCache.set(cacheKey, definition);
      return definition;
    },
    loadMarketDefinition: (productCode, objectTypeCode) =>
      client.get<MarketDefinition>("/api/v1/market-record-definitions", {
        productCode,
        objectTypeCode,
      }),
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
    updateProduction: (id, draft) =>
      client.put<ProductionRecordRow>(
        `/api/v1/production-records/${encodeURIComponent(id)}`,
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
    updateMarket: (id, draft) =>
      client.put<MarketRecordRow>(
        `/api/v1/market-records/${encodeURIComponent(id)}`,
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
    importProductionCsv: (file, productCode, objectTypeCode) => {
      const form = new FormData();
      form.append("file", file, file.name);
      return client.upload<ProductionImportJob>(
        `/api/v1/imports/production?productCode=${encodeURIComponent(productCode)}&objectTypeCode=${encodeURIComponent(objectTypeCode)}`,
        form,
        {
          "Idempotency-Key": crypto.randomUUID(),
        },
      );
    },
    downloadProductionXlsxTemplate: (productCode, objectTypeCode) =>
      client.download("/api/v1/imports/production/template", {
        format: "xlsx",
        productCode,
        objectTypeCode,
      }),
    importMarketWorkbook: (file, productCode, objectTypeCode) => {
      const form = new FormData();
      form.append("file", file, file.name);
      return client.upload<ProductionImportJob>(
        `/api/v1/imports/market?productCode=${encodeURIComponent(productCode)}&objectTypeCode=${encodeURIComponent(objectTypeCode)}`,
        form,
        {
          "Idempotency-Key": crypto.randomUUID(),
        },
      );
    },
    downloadMarketXlsxTemplate: (productCode, objectTypeCode) =>
      client.download("/api/v1/imports/market/template", {
        format: "xlsx",
        productCode,
        objectTypeCode,
      }),
    importLogisticsWorkbook: (file, productCode) => {
      const form = new FormData();
      form.append("file", file, file.name);
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
    retryImportJob: (domain, importJobId) =>
      client.post<ProductionImportJob>(
        `/api/v1/imports/${domain}/${encodeURIComponent(importJobId)}/retries`,
      ),
    downloadImportErrors: (domain, importJobId) =>
      client.download(
        `/api/v1/imports/${domain}/${encodeURIComponent(importJobId)}/errors`,
      ),
    loadLogisticsDefinition: (productCode) =>
      client.get<LogisticsDefinition>("/api/v1/logistics-record-definitions", {
        productCode,
      }),
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
