import { useState } from "react";

import type { BusinessReportContext } from "./businessReportModel";
import type { BusinessWorkItem } from "./core/businessWork";
import type { MonitoringObject } from "./core/monitoringRegistry";
import { businessClassifications } from "./core/businessClassification";
import type { OperationalScope } from "./core/operationalScope";
import { prototypeOperationalIdentity } from "./formalEnterpriseData";
import {
  type BusinessCoordinates,
  type FormalSelection,
  type MarketSection,
} from "./formalEnterpriseModel";
import { MarketAnalysisWorkspace } from "./market/MarketAnalysisWorkspace";
import { LogisticsMonitoringWorkspace } from "./market/LogisticsMonitoringWorkspace";
import { MarketObjectRegistry } from "./market/MarketObjectRegistry";
import { ProductMarketCollectionWorkspace } from "./market/ProductMarketCollectionWorkspace";
import { MarketTaskWorkspace } from "./market/MarketTaskWorkspace";
import type { MarketDocumentDraft } from "./market/MarketDocumentWorkbench";
import { FormalWorkspaceScopeProvider } from "./UnifiedWorkspacePrimitives";

export interface MarketMonitoringWorkspaceProps {
  section: MarketSection;
  selection?: FormalSelection;
  scope?: OperationalScope;
  onScopeChange?: (coordinates: Partial<BusinessCoordinates>) => void;
  onSelectionChange?: (selection: FormalSelection) => void;
  onSelectionClear?: () => void;
  queryAllowed?: boolean;
  onComposeReport: (context: BusinessReportContext) => void;
  workItems?: readonly BusinessWorkItem[];
  documentDrafts?: Readonly<Record<string, MarketDocumentDraft>>;
  onDocumentDraftChange?: (workId: string, draft: MarketDocumentDraft) => void;
  onWorkItemChange?: (item: BusinessWorkItem) => void;
  registryObjects?: readonly MonitoringObject[];
  onRegistryObjectsChange?: (objects: readonly MonitoringObject[]) => void;
}

const defaultMarketScope: OperationalScope = {
  ...prototypeOperationalIdentity,
  coordinates: { regionId: "authorized-all" },
  savedView: null,
};

export function MarketMonitoringWorkspace({
  section,
  selection,
  scope = defaultMarketScope,
  onScopeChange = () => undefined,
  onSelectionChange,
  onSelectionClear,
  queryAllowed = true,
  onComposeReport,
  workItems,
  documentDrafts,
  onDocumentDraftChange,
  onWorkItemChange,
  registryObjects,
  onRegistryObjectsChange,
}: MarketMonitoringWorkspaceProps) {
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
    section === "paddy-collection";
  if (isProductCollection) {
    return (
      <ProductMarketCollectionWorkspace
        documentDrafts={documentDrafts}
        onDocumentDraftChange={onDocumentDraftChange}
        onScopeChange={onScopeChange}
        onSelectionChange={select}
        onWorkItemChange={onWorkItemChange}
        queryAllowed={queryAllowed}
        scope={scope}
        section={section}
        selection={activeSelection}
        workItems={workItems}
      />
    );
  }
  if (section === "logistics") {
    return (
      <LogisticsMonitoringWorkspace
        documentDrafts={documentDrafts}
        onDocumentDraftChange={onDocumentDraftChange}
        onScopeChange={onScopeChange}
        onSelectionChange={select}
        onWorkItemChange={onWorkItemChange}
        queryAllowed={queryAllowed}
        scope={scope}
        selection={activeSelection}
        workItems={workItems}
      />
    );
  }
  if (section === "tasks" || section === "review") {
    return (
      <MarketTaskWorkspace
        onScopeChange={onScopeChange}
        onSelectionChange={select}
        queryAllowed={queryAllowed}
        scope={scope}
        selection={activeSelection}
        workItems={workItems}
        documentDrafts={documentDrafts}
        onDocumentDraftChange={onDocumentDraftChange}
        onWorkItemChange={onWorkItemChange}
      />
    );
  }
  if (section === "objects") {
    return (
      <MarketObjectRegistry
        onScopeChange={onScopeChange}
        onSelectionChange={select}
        onSelectionClear={clearSelection}
        queryAllowed={queryAllowed}
        scope={scope}
        selection={activeSelection}
        registryObjects={registryObjects}
        onRegistryObjectsChange={onRegistryObjectsChange}
      />
    );
  }
  return (
    <MarketAnalysisWorkspace
      onComposeReport={onComposeReport}
      onScopeChange={onScopeChange}
      queryAllowed={queryAllowed}
      scope={scope}
    />
  );
}

export function FormalMarketMonitoringWorkspace({
  section,
  selection,
  scope,
  onScopeChange,
  onComposeReport,
  workItems,
  documentDrafts,
  onDocumentDraftChange,
  onWorkItemChange,
  registryObjects,
  onRegistryObjectsChange,
  onSelectionChange,
  onSelectionClear,
  queryAllowed,
}: {
  section: MarketSection;
  selection?: FormalSelection;
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  onComposeReport: (context: BusinessReportContext) => void;
  workItems?: readonly BusinessWorkItem[];
  documentDrafts?: Readonly<Record<string, MarketDocumentDraft>>;
  onDocumentDraftChange?: (workId: string, draft: MarketDocumentDraft) => void;
  onWorkItemChange?: (item: BusinessWorkItem) => void;
  registryObjects?: readonly MonitoringObject[];
  onRegistryObjectsChange?: (objects: readonly MonitoringObject[]) => void;
  onSelectionChange: (selection: FormalSelection) => void;
  onSelectionClear: () => void;
  queryAllowed: boolean;
}) {
  return (
    <FormalWorkspaceScopeProvider
      classificationOptions={businessClassifications.filter(
        ({ domain }) => domain === "market",
      )}
      onScopeChange={onScopeChange}
      scope={scope}
    >
      <MarketMonitoringWorkspace
        onComposeReport={onComposeReport}
        onScopeChange={onScopeChange}
        onSelectionChange={onSelectionChange}
        onSelectionClear={onSelectionClear}
        queryAllowed={queryAllowed}
        scope={scope}
        section={section}
        selection={selection}
        workItems={workItems}
        documentDrafts={documentDrafts}
        onDocumentDraftChange={onDocumentDraftChange}
        onWorkItemChange={onWorkItemChange}
        registryObjects={registryObjects}
        onRegistryObjectsChange={onRegistryObjectsChange}
      />
    </FormalWorkspaceScopeProvider>
  );
}
