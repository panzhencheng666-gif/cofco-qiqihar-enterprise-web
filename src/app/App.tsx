import { BrowserRouter } from "react-router";
import { AppErrorBoundary } from "@/app/error/AppErrorBoundary";
import { AppProviders } from "@/app/providers/AppProviders";
import { refineResources } from "@/app/router/navigation";
import { AppRouter } from "@/app/router/AppRouter";
import { mockEnterpriseGateway } from "@/platform/api/mock/mockEnterpriseGateway";

export function RootApp() {
  return (
    <BrowserRouter>
      <AppProviders resources={refineResources} gateway={mockEnterpriseGateway}>
        <AppErrorBoundary>
          <AppRouter />
        </AppErrorBoundary>
      </AppProviders>
    </BrowserRouter>
  );
}
