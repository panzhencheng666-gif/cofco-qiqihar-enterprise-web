import { useState } from "react";

import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";

import type { BusinessReportContext } from "./businessReportModel";
import type { BusinessWorkItem } from "./core/businessWork";
import type { OperationalScope } from "./core/operationalScope";
import type { MonitoringObject } from "./core/monitoringRegistry";
import {
  businessClassificationFixtures,
  fixtureOperationalIdentity,
} from "./formalEnterpriseData";
import {
  type BusinessCoordinates,
  type FormalSelection,
  type ProductionSection,
} from "./formalEnterpriseModel";
import { ProductionAnalysisWorkspace } from "./production/ProductionAnalysisWorkspace";
import { ProductionObjectRegistry } from "./production/ProductionObjectRegistry";
import { ProductProductionCollectionWorkspace } from "./production/ProductProductionCollectionWorkspace";
import { ProductionTaskWorkspace } from "./production/ProductionTaskWorkspace";
import { ProductionAnalysisPanel } from "./analysis/ProductionAnalysisPanel";
import type { ProductionDocumentDraft } from "./production/ProductionDocumentWorkbench";
import { FormalWorkspaceScopeProvider } from "./UnifiedWorkspacePrimitives";

export interface ProductionMonitoringWorkspaceProps {
  section: ProductionSection;
  selection?: FormalSelection;
  scope?: OperationalScope;
  onScopeChange?: (coordinates: Partial<BusinessCoordinates>) => void;
  onSelectionChange?: (selection: FormalSelection) => void;
  onSelectionClear?: () => void;
  queryAllowed?: boolean;
  registryObjects?: readonly MonitoringObject[];
  onRegistryObjectsChange?: (objects: readonly MonitoringObject[]) => void;
  workItems?: readonly BusinessWorkItem[];
  documentDrafts?: Readonly<Record<string, ProductionDocumentDraft>>;
  onDocumentDraftChange?: (
    workId: string,
    draft: ProductionDocumentDraft,
  ) => void;
  onWorkItemChange?: (item: BusinessWorkItem) => void;
  onComposeReport: (context: BusinessReportContext) => void;
  onCreateRecord?: (productCode: "CORN" | "SOYBEAN" | "RICE") => void;
  onEditRecord?: (
    productCode: "CORN" | "SOYBEAN" | "RICE",
    recordId: string,
  ) => void;
  realtimeRepository?: RealtimeBusinessRepository;
  realtimeRefreshToken?: number;
}

const defaultProductionScope: OperationalScope = {
  ...fixtureOperationalIdentity,
  coordinates: { regionId: "authorized-all" },
  savedView: null,
};

export function ProductionMonitoringWorkspace({
  section,
  selection,
  scope = defaultProductionScope,
  onScopeChange = () => undefined,
  onSelectionChange,
  onSelectionClear,
  queryAllowed = true,
  registryObjects,
  onRegistryObjectsChange,
  workItems,
  documentDrafts,
  onDocumentDraftChange,
  onWorkItemChange,
  onComposeReport,
  onCreateRecord,
  onEditRecord,
  realtimeRepository,
  realtimeRefreshToken,
}: ProductionMonitoringWorkspaceProps) {
  const [localSelection, setLocalSelection] = useState(selection);
  const selectionIsControlled = onSelectionChange !== undefined;
  const activeSelection = selectionIsControlled ? selection : localSelection;
  const select = (next: FormalSelection) => {
    if (!selectionIsControlled) setLocalSelection(next);
    onSelectionChange?.(next);
  };
  const clearSelection = () => {
    if (!selectionIsControlled) setLocalSelection(undefined);
    onSelectionClear?.();
  };
  const isProductCollection =
    section === "corn-collection" ||
    section === "soybean-collection" ||
    section === "rice-collection";
  if (isProductCollection) {
    return (
      <ProductProductionCollectionWorkspace
        documentDrafts={documentDrafts}
        onDocumentDraftChange={onDocumentDraftChange}
        onScopeChange={onScopeChange}
        onSelectionChange={select}
        onWorkItemChange={onWorkItemChange}
        onCreateRecord={onCreateRecord}
        onEditRecord={onEditRecord}
        queryAllowed={queryAllowed}
        scope={scope}
        section={section}
        selection={activeSelection}
        workItems={workItems}
        realtimeRepository={realtimeRepository}
        realtimeRefreshToken={realtimeRefreshToken}
      />
    );
  }
  if (section === "tasks" || section === "review") {
    return (
      <ProductionTaskWorkspace
        onScopeChange={onScopeChange}
        onSelectionChange={select}
        scope={scope}
        selection={activeSelection}
        queryAllowed={queryAllowed}
        documentDrafts={documentDrafts}
        onDocumentDraftChange={onDocumentDraftChange}
        onWorkItemChange={onWorkItemChange}
        workItems={workItems}
      />
    );
  }
  if (section === "objects") {
    return (
      <ProductionObjectRegistry
        onScopeChange={onScopeChange}
        onSelectionChange={select}
        onSelectionClear={clearSelection}
        scope={scope}
        selection={activeSelection}
        queryAllowed={queryAllowed}
        registryObjects={registryObjects}
        onRegistryObjectsChange={onRegistryObjectsChange}
      />
    );
  }
  if (section === "analysis" && realtimeRepository) {
    return (
      <ProductionAnalysisPanel repository={realtimeRepository} />
    );
  }
  return (
    <ProductionAnalysisWorkspace
      onComposeReport={onComposeReport}
      onScopeChange={onScopeChange}
      queryAllowed={queryAllowed}
      scope={scope}
    />
  );
}

export function FormalProductionMonitoringWorkspace({
  section,
  selection,
  scope,
  onScopeChange,
  onComposeReport,
  onSelectionChange,
  onSelectionClear,
  queryAllowed,
  registryObjects,
  onRegistryObjectsChange,
  workItems,
  documentDrafts,
  onDocumentDraftChange,
  onWorkItemChange,
  onCreateRecord,
  onEditRecord,
  realtimeRepository,
  realtimeRefreshToken,
}: {
  section: ProductionSection;
  selection?: FormalSelection;
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  onComposeReport: (context: BusinessReportContext) => void;
  onSelectionChange: (selection: FormalSelection) => void;
  onSelectionClear: () => void;
  queryAllowed: boolean;
  registryObjects?: readonly MonitoringObject[];
  onRegistryObjectsChange?: (objects: readonly MonitoringObject[]) => void;
  workItems?: readonly BusinessWorkItem[];
  documentDrafts?: Readonly<Record<string, ProductionDocumentDraft>>;
  onDocumentDraftChange?: (
    workId: string,
    draft: ProductionDocumentDraft,
  ) => void;
  onWorkItemChange?: (item: BusinessWorkItem) => void;
  onCreateRecord?: (productCode: "CORN" | "SOYBEAN" | "RICE") => void;
  onEditRecord?: (
    productCode: "CORN" | "SOYBEAN" | "RICE",
    recordId: string,
  ) => void;
  realtimeRepository?: RealtimeBusinessRepository;
  realtimeRefreshToken?: number;
}) {
  return (
    <FormalWorkspaceScopeProvider
      classificationOptions={businessClassificationFixtures.productionAnalysis}
      onScopeChange={onScopeChange}
      scope={scope}
    >
      <ProductionMonitoringWorkspace
        onComposeReport={onComposeReport}
        onScopeChange={onScopeChange}
        onSelectionChange={onSelectionChange}
        onSelectionClear={onSelectionClear}
        queryAllowed={queryAllowed}
        registryObjects={registryObjects}
        onRegistryObjectsChange={onRegistryObjectsChange}
        documentDrafts={documentDrafts}
        onDocumentDraftChange={onDocumentDraftChange}
        onWorkItemChange={onWorkItemChange}
        onCreateRecord={onCreateRecord}
        onEditRecord={onEditRecord}
        realtimeRepository={realtimeRepository}
        realtimeRefreshToken={realtimeRefreshToken}
        workItems={workItems}
        scope={scope}
        section={section}
        selection={selection}
      />
    </FormalWorkspaceScopeProvider>
  );
}
