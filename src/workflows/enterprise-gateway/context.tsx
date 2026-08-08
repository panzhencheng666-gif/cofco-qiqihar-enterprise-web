import { createContext, useContext, type ReactNode } from "react";
import type { EnterpriseGateway } from "./port";

const EnterpriseGatewayContext = createContext<EnterpriseGateway | undefined>(
  undefined,
);

export function EnterpriseGatewayProvider({
  gateway,
  children,
}: {
  gateway: EnterpriseGateway;
  children: ReactNode;
}) {
  return (
    <EnterpriseGatewayContext.Provider value={gateway}>
      {children}
    </EnterpriseGatewayContext.Provider>
  );
}

export function useEnterpriseGateway(): EnterpriseGateway {
  const gateway = useContext(EnterpriseGatewayContext);
  if (!gateway) {
    throw new Error("企业网关尚未在应用装配层提供");
  }
  return gateway;
}
