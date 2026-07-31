import { useState } from "react";
import { BusinessReportComposer } from "./BusinessReportComposer";
import type { BusinessReportContext } from "./businessReportModel";
import { EnterpriseShell } from "./EnterpriseShell";
import { ExecutiveOverviewWorkspace } from "./ExecutiveOverviewWorkspace";
import {
  createFormalRoute,
  type FormalApplication,
  type FormalRoute,
} from "./formalEnterpriseModel";
import { MarketMonitoringWorkspace } from "./MarketMonitoringWorkspace";
import { MyWorkWorkspace } from "./MyWorkWorkspace";
import { ProductionMonitoringWorkspace } from "./ProductionMonitoringWorkspace";
import { ReportCenterWorkspace } from "./ReportCenterWorkspace";
import { SupplyDemandWorkspace } from "./SupplyDemandWorkspace";
import { useFormalEnterpriseLocation } from "./useFormalEnterpriseLocation";

interface FormalEnterprisePrototypeProps { initialSearch?: string; }

export function FormalEnterprisePrototype({ initialSearch }: FormalEnterprisePrototypeProps) {
  const { location, navigate } = useFormalEnterpriseLocation(initialSearch);
  const [reportContext, setReportContext] = useState<BusinessReportContext | null>(null);

  function openApplication(
    application: FormalApplication,
    route: FormalRoute["section"] | "overview",
  ) {
    const section =
      route === "overview"
        ? application === "supply"
          ? "calculation"
          : "tasks"
        : route;
    navigate(createFormalRoute(application, section));
  }

  const workspace = (() => {
    switch (location.route.application) {
      case "overview":
        return <ExecutiveOverviewWorkspace onOpenApplication={openApplication} />;
      case "production":
        return <ProductionMonitoringWorkspace section={location.route.section} onComposeReport={setReportContext} onSectionChange={(section) => navigate(createFormalRoute("production", section === "collection" ? "tasks" : section))} />;
      case "market":
        return <MarketMonitoringWorkspace section={location.route.section} onComposeReport={setReportContext} onSectionChange={(section) => navigate(createFormalRoute("market", section === "collection" ? "tasks" : section))} />;
      case "supply":
        return <SupplyDemandWorkspace section={location.route.section} onComposeReport={setReportContext} />;
      case "reporting":
        return <ReportCenterWorkspace section={location.route.section} onComposeReport={setReportContext} />;
      case "work":
        return <MyWorkWorkspace section={location.route.section} onOpenBusiness={(application, section) => navigate(createFormalRoute(application, section === "collection" ? "tasks" : "analysis"))} />;
    }
  })();

  return (
    <EnterpriseShell location={location} onNavigate={navigate}>
      {workspace}
      {reportContext && <BusinessReportComposer context={reportContext} onClose={() => setReportContext(null)} />}
    </EnterpriseShell>
  );
}
