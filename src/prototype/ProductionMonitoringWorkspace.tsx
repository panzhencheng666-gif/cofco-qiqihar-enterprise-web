import { useState } from "react";

import type { BusinessReportContext } from "./businessReportModel";
import type { OperationalScope } from "./core/operationalScope";
import {
  businessClassificationFixtures,
  prototypeOperationalIdentity,
} from "./formalEnterpriseData";
import {
  createFormalRoute,
  writeFormalLocation,
  type BusinessCoordinates,
  type FormalSelection,
  type ProductionSection,
} from "./formalEnterpriseModel";
import { ProductionAnalysisWorkspace } from "./production/ProductionAnalysisWorkspace";
import { ProductionObjectRegistry } from "./production/ProductionObjectRegistry";
import { ProductionTaskWorkspace } from "./production/ProductionTaskWorkspace";
import { FormalWorkspaceScopeProvider } from "./UnifiedWorkspacePrimitives";

export interface ProductionMonitoringWorkspaceProps {
  section: ProductionSection;
  selection?: FormalSelection;
  scope?: OperationalScope;
  onScopeChange?: (coordinates: Partial<BusinessCoordinates>) => void;
  onSelectionChange?: (selection: FormalSelection) => void;
  queryAllowed?: boolean;
  onComposeReport: (context: BusinessReportContext) => void;
}

const defaultProductionScope: OperationalScope = {
  ...prototypeOperationalIdentity,
  coordinates: { regionId: "authorized-all" },
  savedView: null,
};

export function ProductionMonitoringWorkspace({
  section,
  selection,
  scope = defaultProductionScope,
  onScopeChange = () => undefined,
  onSelectionChange,
  queryAllowed = true,
  onComposeReport,
}: ProductionMonitoringWorkspaceProps) {
  const [localSelection, setLocalSelection] = useState(selection);
  const selectionIsControlled = onSelectionChange !== undefined;
  const activeSelection = selectionIsControlled ? selection : localSelection;
  const select = (next: FormalSelection) => {
    if (!selectionIsControlled) setLocalSelection(next);
    onSelectionChange?.(next);
  };
  void onComposeReport;
  if (section === "tasks") {
    return (
      <ProductionTaskWorkspace
        onScopeChange={onScopeChange}
        onSelectionChange={select}
        scope={scope}
        selection={activeSelection}
        queryAllowed={queryAllowed}
      />
    );
  }
  if (section === "objects") {
    return (
      <ProductionObjectRegistry
        onScopeChange={onScopeChange}
        onSelectionChange={select}
        scope={scope}
        selection={activeSelection}
        queryAllowed={queryAllowed}
      />
    );
  }
  return (
    <ProductionAnalysisWorkspace
      onScopeChange={onScopeChange}
      queryAllowed={queryAllowed}
      scope={scope}
    />
  );
}

function writeProductionSelection(
  section: ProductionSection,
  scope: OperationalScope,
  selection: FormalSelection,
) {
  const url = new URL(window.location.href);
  url.search = writeFormalLocation({
    route: createFormalRoute("production", section),
    coordinates: scope.coordinates,
    selection,
  });
  window.history.pushState({}, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function FormalProductionMonitoringWorkspace({
  section,
  selection,
  scope,
  onScopeChange,
  onComposeReport,
}: {
  section: ProductionSection;
  selection?: FormalSelection;
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  onComposeReport: (context: BusinessReportContext) => void;
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
        onSelectionChange={(next) =>
          writeProductionSelection(section, scope, next)
        }
        scope={scope}
        section={section}
        selection={selection}
      />
    </FormalWorkspaceScopeProvider>
  );
}
