import "@ant-design/v5-patch-for-react-19";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RootApp } from "@/app/App";
import "@/app/styles/global.css";

const mount = document.getElementById("root");
if (!mount) throw new Error("缺少应用挂载节点 #root");

createRoot(mount).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
);
