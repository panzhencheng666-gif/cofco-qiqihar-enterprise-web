import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { IdentityWorkspaceApplication } from "../business/identity/IdentityWorkspaceApplication";
import "../business/formal-enterprise.css";
import "../business/identity/identity-workspace.css";
import "../business/enterprise-brand.css";

const root = document.getElementById("identity-root");
if (!root) throw new Error("缺少账号管理挂载节点");
createRoot(root).render(
  <StrictMode>
    <IdentityWorkspaceApplication />
  </StrictMode>,
);
