import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { AppProviders } from "@/app/providers/AppProviders";
import { mockEnterpriseGateway } from "@/platform/api/mock/mockEnterpriseGateway";
import type { EnterpriseGateway } from "@/workflows/enterprise-gateway/port";

interface RenderWithAppOptions extends Omit<RenderOptions, "wrapper"> {
  initialEntries?: string[];
  gateway?: EnterpriseGateway;
  gatewayOverrides?: Partial<EnterpriseGateway>;
}

export function renderWithApp(
  ui: ReactElement,
  options: RenderWithAppOptions = {},
) {
  const {
    initialEntries = ["/"],
    gateway = mockEnterpriseGateway,
    gatewayOverrides,
    ...renderOptions
  } = options;
  const resolvedGateway = { ...gateway, ...gatewayOverrides };
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AppProviders
        resources={[]}
        gateway={resolvedGateway}
        disableRouteChangeHandler
      >
        {ui}
      </AppProviders>
    </MemoryRouter>,
    renderOptions,
  );
}
