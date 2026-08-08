import { Refine, type IResourceItem } from "@refinedev/core";
import routerProvider from "@refinedev/react-router";
import { App, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import type { ReactNode } from "react";
import { enterpriseTheme } from "@/app/theme/theme";
import { createEnterpriseDataProvider } from "@/platform/api/enterpriseDataProvider";
import { EnterpriseGatewayProvider } from "@/workflows/enterprise-gateway/context";
import type { EnterpriseGateway } from "@/workflows/enterprise-gateway/port";
import { createAccessControlProvider } from "./accessControlProvider";

interface AppProvidersProps {
  children: ReactNode;
  resources: IResourceItem[];
  gateway: EnterpriseGateway;
  disableRouteChangeHandler?: boolean;
}

export function AppProviders({
  children,
  resources,
  gateway,
  disableRouteChangeHandler = false,
}: AppProvidersProps) {
  return (
    <ConfigProvider locale={zhCN} theme={enterpriseTheme}>
      <App>
        <Refine
          dataProvider={createEnterpriseDataProvider(gateway)}
          routerProvider={routerProvider}
          accessControlProvider={createAccessControlProvider(gateway)}
          resources={resources}
          options={{
            syncWithLocation: true,
            warnWhenUnsavedChanges: true,
            disableTelemetry: true,
            disableRouteChangeHandler,
          }}
        >
          <EnterpriseGatewayProvider gateway={gateway}>
            {children}
          </EnterpriseGatewayProvider>
        </Refine>
      </App>
    </ConfigProvider>
  );
}
