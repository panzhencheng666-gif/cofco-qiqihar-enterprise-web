import { useState } from "react";
import { BusinessReportComposer } from "./BusinessReportComposer";
import type { BusinessReportContext } from "./businessReportModel";
import { EnterpriseShell } from "./EnterpriseShell";
import { FormalExecutiveOverviewWorkspace } from "./ExecutiveOverviewWorkspace";
import {
  createFormalRoute,
} from "./formalEnterpriseModel";
import { FormalMarketMonitoringWorkspace } from "./MarketMonitoringWorkspace";
import { FormalMyWorkWorkspace } from "./MyWorkWorkspace";
import { FormalProductionMonitoringWorkspace } from "./ProductionMonitoringWorkspace";
import { FormalReportCenterWorkspace } from "./ReportCenterWorkspace";
import { FormalSupplyDemandWorkspace } from "./SupplyDemandWorkspace";
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
        return <FormalExecutiveOverviewWorkspace section={location.route.section} onOpenRoute={navigate} scope={scope} onScopeChange={updateCoordinates} />;
      case "production":
        return <FormalProductionMonitoringWorkspace scope={scope} onScopeChange={updateCoordinates} section={location.route.section} onComposeReport={setReportContext} />;
      case "market":
        return <FormalMarketMonitoringWorkspace scope={scope} onScopeChange={updateCoordinates} section={location.route.section} onComposeReport={setReportContext} />;
      case "supply":
        return <FormalSupplyDemandWorkspace scope={scope} onScopeChange={updateCoordinates} section={location.route.section} onComposeReport={setReportContext} />;
      case "reporting":
        return <FormalReportCenterWorkspace scope={scope} onScopeChange={updateCoordinates} section={location.route.section} onComposeReport={setReportContext} />;
      case "work":
        return <FormalMyWorkWorkspace scope={scope} onScopeChange={updateCoordinates} section={location.route.section} onOpenBusiness={(application) => navigate(createFormalRoute(application, "tasks"))} />;
    }
  })();

  return (
    <EnterpriseShell location={location} onNavigate={navigate} shellIdentity={prototypeShellIdentity}>
      {queryAllowed ? workspace : <section aria-live="polite" role="alert">当前范围无权查询：{issues.map((issue) => issue.value).join("、")}</section>}
      {reportContext && <BusinessReportComposer context={reportContext} onClose={() => setReportContext(null)} />}
    </EnterpriseShell>
  );
}
