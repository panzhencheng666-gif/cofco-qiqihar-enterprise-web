import { useState } from "react";
import { BusinessReportComposer } from "./BusinessReportComposer";
import type { BusinessReportContext } from "./businessReportModel";
import { EnterpriseShell } from "./EnterpriseShell";
import { ExecutiveOverviewWorkspace } from "./ExecutiveOverviewWorkspace";
import {
  createFormalRoute,
} from "./formalEnterpriseModel";
import { MarketMonitoringWorkspace } from "./MarketMonitoringWorkspace";
import { MyWorkWorkspace } from "./MyWorkWorkspace";
import { ProductionMonitoringWorkspace } from "./ProductionMonitoringWorkspace";
import { ReportCenterWorkspace } from "./ReportCenterWorkspace";
import { SupplyDemandWorkspace } from "./SupplyDemandWorkspace";
import { useFormalEnterpriseLocation } from "./useFormalEnterpriseLocation";
import {
  prototypeOperationalIdentity,
  prototypeShellIdentity,
} from "./formalEnterpriseData";

interface FormalEnterprisePrototypeProps { initialSearch?: string; }

export function FormalEnterprisePrototype({ initialSearch }: FormalEnterprisePrototypeProps) {
  const { location, scope, issues, queryAllowed, navigate, updateCoordinates } =
    useFormalEnterpriseLocation(prototypeOperationalIdentity, initialSearch);
  const [reportContext, setReportContext] = useState<BusinessReportContext | null>(null);

  const workspace = (() => {
    switch (location.route.application) {
      case "overview":
        return <ExecutiveOverviewWorkspace onOpenRoute={navigate} scope={scope} onScopeChange={updateCoordinates} />;
      case "production":
        return <ProductionMonitoringWorkspace scope={scope} onScopeChange={updateCoordinates} section={location.route.section} onComposeReport={setReportContext} onSectionChange={(section) => navigate(section === "collection" ? createFormalRoute("production", "tasks") : createFormalRoute("production", section))} />;
      case "market":
        return <MarketMonitoringWorkspace scope={scope} onScopeChange={updateCoordinates} section={location.route.section} onComposeReport={setReportContext} onSectionChange={(section) => navigate(section === "collection" ? createFormalRoute("market", "tasks") : createFormalRoute("market", section))} />;
      case "supply":
        return <SupplyDemandWorkspace scope={scope} onScopeChange={updateCoordinates} section={location.route.section} onComposeReport={setReportContext} />;
      case "reporting":
        return <ReportCenterWorkspace scope={scope} onScopeChange={updateCoordinates} section={location.route.section} onComposeReport={setReportContext} />;
      case "work":
        return <MyWorkWorkspace scope={scope} onScopeChange={updateCoordinates} section={location.route.section} onOpenBusiness={(application, section) => navigate(section === "collection" ? createFormalRoute(application, "tasks") : createFormalRoute(application, "analysis"))} />;
    }
  })();

  return (
    <EnterpriseShell location={location} onNavigate={navigate} shellIdentity={prototypeShellIdentity}>
      {queryAllowed ? workspace : <section aria-live="polite" role="alert">当前范围无权查询：{issues.map((issue) => issue.value).join("、")}</section>}
      {reportContext && <BusinessReportComposer context={reportContext} onClose={() => setReportContext(null)} />}
    </EnterpriseShell>
  );
}
