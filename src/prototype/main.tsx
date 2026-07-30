import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EnterpriseArchitecturePrototype } from "./EnterpriseArchitecturePrototype";
import "./prototype.css";

const mount = document.getElementById("prototype-root");
if (!mount) throw new Error("缺少界面样板挂载节点");

createRoot(mount).render(
  <StrictMode>
    <EnterpriseArchitecturePrototype />
  </StrictMode>,
);
