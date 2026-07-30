import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { AppProviders } from "@/app/providers/AppProviders";

export function renderWithApp(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <AppProviders resources={[]} disableRouteChangeHandler>
        {ui}
      </AppProviders>
    </MemoryRouter>,
    options,
  );
}
