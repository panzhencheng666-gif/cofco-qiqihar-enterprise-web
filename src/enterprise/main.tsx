import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EnterpriseBusinessApplication } from "../business/EnterpriseBusinessApplication";
import { EnterpriseBusinessErrorBoundary } from "../business/EnterpriseBusinessErrorBoundary";
import "../business/formal-enterprise.css";
import "../business/market-monitoring.css";
import "../business/unified-workspaces.css";

const mount = document.getElementById("enterprise-root");
if (!mount) throw new Error("缺少系统挂载节点");

createRoot(mount).render(
  <StrictMode>
    <EnterpriseBusinessErrorBoundary>
      <EnterpriseBusinessApplication />
    </EnterpriseBusinessErrorBoundary>
  </StrictMode>,
);
