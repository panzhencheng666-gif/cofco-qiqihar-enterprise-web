import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";
import { CapabilityBoundary } from "@/app/router/CapabilityBoundary";
import { EnterpriseShell } from "@/app/shell/EnterpriseShell";

const MyWorkPage = lazy(() =>
  import("@/pages/MyWorkPage").then((module) => ({
    default: module.MyWorkPage,
  })),
);
const AccountSecurityPage = lazy(() =>
  import("@/pages/AccountSecurityPage").then((module) => ({
    default: module.AccountSecurityPage,
  })),
);
const ModuleWorkspacePage = lazy(() =>
  import("@/pages/ModuleWorkspacePage").then((module) => ({
    default: module.ModuleWorkspacePage,
  })),
);
const ObjectDocumentPage = lazy(() =>
  import("@/pages/ObjectDocumentPage").then((module) => ({
    default: module.ObjectDocumentPage,
  })),
);
const NotFoundPage = lazy(() =>
  import("@/pages/NotFoundPage").then((module) => ({
    default: module.NotFoundPage,
  })),
);

export function AppRouter() {
  return (
    <EnterpriseShell>
      <Suspense fallback={<div role="status">正在加载业务页面</div>}>
        <Routes>
          <Route
            path="/"
            element={
              <CapabilityBoundary capability="my-work:view">
                <MyWorkPage />
              </CapabilityBoundary>
            }
          />
          <Route
            path="/overview/*"
            element={
              <CapabilityBoundary capability="business-overview:view">
                <ModuleWorkspacePage />
              </CapabilityBoundary>
            }
          />
          <Route
            path="/production/*"
            element={
              <CapabilityBoundary capability="production-monitoring:view">
                <ModuleWorkspacePage />
              </CapabilityBoundary>
            }
          />
          <Route
            path="/market/*"
            element={
              <CapabilityBoundary capability="market-monitoring:view">
                <ModuleWorkspacePage />
              </CapabilityBoundary>
            }
          />
          <Route
            path="/supply/*"
            element={
              <CapabilityBoundary capability="supply-situation:view">
                <ModuleWorkspacePage />
              </CapabilityBoundary>
            }
          />
          <Route path="/reports/*" element={<Navigate replace to="/" />} />
          <Route
            path="/governance/*"
            element={
              <CapabilityBoundary capability="data-governance:view">
                <ModuleWorkspacePage />
              </CapabilityBoundary>
            }
          />
          <Route
            path="/system/*"
            element={
              <CapabilityBoundary capability="system-administration:view">
                <ModuleWorkspacePage />
              </CapabilityBoundary>
            }
          />
          <Route
            path="/account/security"
            element={
              <CapabilityBoundary capability="account-security:view">
                <AccountSecurityPage />
              </CapabilityBoundary>
            }
          />
          <Route
            path="/objects/:objectId/documents/:documentId"
            element={
              <CapabilityBoundary capability="business-document:view">
                <ObjectDocumentPage />
              </CapabilityBoundary>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </EnterpriseShell>
  );
}
