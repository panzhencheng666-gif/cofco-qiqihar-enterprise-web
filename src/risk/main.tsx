import "@ant-design/v5-patch-for-react-19";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RiskWarningApplication } from "./RiskWarningApplication";
import "@/business/enterprise-brand.css";
import "./risk-warning.css";

const mount = document.getElementById("risk-root");
if (!mount) throw new Error("缺少风险研判预警系统挂载节点");

createRoot(mount).render(
  <StrictMode>
    <RiskWarningApplication />
  </StrictMode>,
);
