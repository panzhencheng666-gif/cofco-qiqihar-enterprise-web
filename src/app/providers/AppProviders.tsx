import { Refine, type IResourceItem } from "@refinedev/core";
import routerProvider from "@refinedev/react-router";
import { App, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import type { ReactNode } from "react";
import { enterpriseTheme } from "@/app/theme/theme";
import { createEnterpriseDataProvider } from "@/platform/api/enterpriseDataProvider";
import { mockEnterpriseGateway } from "@/platform/api/mock/mockEnterpriseGateway";
import { accessControlProvider } from "./accessControlProvider";

interface AppProvidersProps {
  children: ReactNode;
  resources: IResourceItem[];
}

export function AppProviders({ children, resources }: AppProvidersProps) {
  return (
    <ConfigProvider locale={zhCN} theme={enterpriseTheme}>
      <App>
        <Refine
          dataProvider={createEnterpriseDataProvider(mockEnterpriseGateway)}
          routerProvider={routerProvider}
          accessControlProvider={accessControlProvider}
          resources={resources}
          options={{ syncWithLocation: true, warnWhenUnsavedChanges: true }}
        >
          {children}
        </Refine>
      </App>
    </ConfigProvider>
  );
}
