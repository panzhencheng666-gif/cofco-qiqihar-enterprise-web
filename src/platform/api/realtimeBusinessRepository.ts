import { realtimeApiClient, type RealtimeApiClient } from "./realtimeApiClient";

export interface MasterProduct {
  code: string;
  name: string;
}

export interface MasterPeriod {
  code: string;
  name: string;
  startsOn: string;
  endsOn: string;
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
  cutoffPeriodCode: string;
  unitCode: string;
  methodologyVersion: string;
  points: readonly AnnualComparisonPoint[];
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
  title: string;
  dataCutoffLabel: string;
  lines: readonly { label: string; value: string; note: string }[];
  sections: readonly { code: string; title: string; body: string }[];
  expiresAt: string;
}

export interface ReportExport {
  id: string;
  previewId: string;
  formatCode: string;
  filename: string;
  contentType: string;
  requestedAt: string;
}

export interface CurrentSession {
  subjectId: string;
  displayName: string;
  workUnitCode: string;
  permissions: readonly string[];
  regionCodes: readonly string[];
}

export interface WorkItemRow {
  id: string;
  task: string;
  domain: string;
  regionCode: string;
  region: string;
  product: string;
  businessPeriod: string;
  dueAt: string | null;
  workflowNode: string;
  statusCode: string | null;
  status: string;
  responsiblePartyCode: string;
  responsibleParty: string;
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
  surveyDate: string;
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
  coreValues: Record<string, string>;
  facts: Record<string, string>;
  evidencePhotoIds: readonly string[];
  version?: number;
}

export interface MarketRecordRow {
  id: string;
  productCode: string;
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
  roleCode: string;
  sourceFieldCode: string;
  value: string;
  unitCode: string;
  qualityState: string;
  approvedAt: string | null;
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
  marketingYear: string;
  resultVersion: number;
  decisionVersion: number;
  resultState: string;
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
    label: string;
    sourceDomain: string;
    sourceRecordId: string;
    sourceVersion: number;
    sourceFieldCode: string;
    value: string;
    unitCode: string;
  }[];
}

export interface SupplyInputSetRow {
  id: string;
  version: number;
  productCode: string;
  regionCode: string;
  marketingYear: string;
}

export interface ProductionImportJob {
  id: string;
  domainCode: string;
  statusCode: string;
  importedRows: number;
  failedRows: number;
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

export interface RealtimeBusinessRepository {
  loadCurrentSession(): Promise<CurrentSession>;
  uploadEvidencePhoto(input: EvidencePhotoUpload): Promise<EvidencePhotoRow>;
  loadMasterData(): Promise<MasterDataSnapshot>;
  loadAnnualComparison(input: {
    productCode: string;
    cultivarCode?: string;
    regionCode: string;
    periodCode: string;
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
    action: "submit" | "approve" | "return",
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
    action: "submit" | "approve" | "return",
    version: number,
    reason?: string,
  ): Promise<MarketRecordRow>;
  loadSupplyInputWorkspace(input: {
    productCode: string;
    regionCode: string;
    marketingYear: string;
  }): Promise<SupplyInputWorkspace>;
  listSupplyAccounts(input: {
    productCode: string;
    regionCode: string;
    marketingYear: string;
    resultState?: string;
  }): Promise<readonly SupplyAccountRow[]>;
  createSupplyInputSet(input: {
    productCode: string;
    regionCode: string;
    marketingYear: string;
    reason: string;
    expectedVersion: number;
    items: readonly { roleCode: string; sourceReleaseId: string }[];
  }): Promise<SupplyInputSetRow>;
  approveSupplyManualDecision(input: {
    productCode: string;
    regionCode: string;
    marketingYear: string;
    roleCode: string;
    value: string;
    reason: string;
    expectedVersion: number;
  }): Promise<SupplyReleaseRow>;
  runSupplyAccount(input: {
    productCode: string;
    regionCode: string;
    marketingYear: string;
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
    action: "submit" | "approve" | "return",
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
): RealtimeBusinessRepository {
  return {
    loadCurrentSession: () => client.get<CurrentSession>("/api/v1/session/me"),
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
    listCultivars: (productCode) =>
      client.get<MasterCultivar[]>(
        `/api/v1/master-data/products/${encodeURIComponent(productCode)}/cultivars`,
      ),
    listObjectTypes: (productCode, domain) =>
      client.get<MasterObjectType[]>("/api/v1/master-data/object-types", {
        productCode,
        domain,
      }),
    loadProductionDefinition: (productCode, objectTypeCode) =>
      client.get<ProductionDefinition>(
        "/api/v1/production-record-definitions",
        { productCode, objectTypeCode },
      ),
    loadMarketDefinition: (productCode, objectTypeCode) =>
      client.get<MarketDefinition>("/api/v1/market-record-definitions", {
        productCode,
        objectTypeCode,
      }),
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
      client.post<SupplyReleaseRow>(
        "/api/v1/supply-inputs/manual-decisions",
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
