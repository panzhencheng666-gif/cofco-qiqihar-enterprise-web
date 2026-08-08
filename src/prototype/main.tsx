import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FormalEnterprisePrototype } from "./FormalEnterprisePrototype";
import { PrototypeBusinessErrorBoundary } from "./PrototypeBusinessErrorBoundary";
import "./formal-enterprise.css";
import "./market-monitoring.css";
import "./unified-workspaces.css";

const mount = document.getElementById("prototype-root");
if (!mount) throw new Error("缺少系统挂载节点");

createRoot(mount).render(
  <StrictMode>
    <PrototypeBusinessErrorBoundary>
      <FormalEnterprisePrototype />
    </PrototypeBusinessErrorBoundary>
  </StrictMode>,
);
