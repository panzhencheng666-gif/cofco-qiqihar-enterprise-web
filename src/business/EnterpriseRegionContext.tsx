import { createContext, useContext, type ReactNode } from "react";
import type { EnterpriseRegionId } from "./enterpriseRegions";

interface EnterpriseRegionContextValue {
  regionId: EnterpriseRegionId;
  setRegionId: (regionId: EnterpriseRegionId) => void;
}

const fallbackContext: EnterpriseRegionContextValue = {
  regionId: "qiqihar-all",
  setRegionId: () => undefined,
};

const EnterpriseRegionContext =
  createContext<EnterpriseRegionContextValue>(fallbackContext);

export function EnterpriseRegionProvider({
  children,
  regionId,
  onRegionChange,
}: {
  children: ReactNode;
  regionId: EnterpriseRegionId;
  onRegionChange: (regionId: EnterpriseRegionId) => void;
}) {
  return (
    <EnterpriseRegionContext.Provider
      value={{ regionId, setRegionId: onRegionChange }}
    >
      {children}
    </EnterpriseRegionContext.Provider>
  );
}

export function useEnterpriseRegion() {
  return useContext(EnterpriseRegionContext);
}
