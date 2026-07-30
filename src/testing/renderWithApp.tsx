import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { AppProviders } from "@/app/providers/AppProviders";

interface RenderWithAppOptions extends Omit<RenderOptions, "wrapper"> {
  initialEntries?: string[];
}

export function renderWithApp(
  ui: ReactElement,
  options: RenderWithAppOptions = {},
) {
  const { initialEntries = ["/"], ...renderOptions } = options;
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AppProviders resources={[]} disableRouteChangeHandler>
        {ui}
      </AppProviders>
    </MemoryRouter>,
    renderOptions,
  );
}
