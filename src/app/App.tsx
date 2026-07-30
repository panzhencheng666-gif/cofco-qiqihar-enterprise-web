import { BrowserRouter } from "react-router";
import { AppErrorBoundary } from "@/app/error/AppErrorBoundary";
import { AppProviders } from "@/app/providers/AppProviders";
import { refineResources } from "@/app/router/navigation";
import { AppRouter } from "@/app/router/AppRouter";

export function RootApp() {
  return (
    <BrowserRouter>
      <AppProviders resources={refineResources}>
        <AppErrorBoundary>
          <AppRouter />
        </AppErrorBoundary>
      </AppProviders>
    </BrowserRouter>
  );
}
