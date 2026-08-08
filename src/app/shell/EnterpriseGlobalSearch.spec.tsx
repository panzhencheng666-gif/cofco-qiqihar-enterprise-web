import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { implementedNavigation } from "@/app/router/navigation";
import { renderWithApp } from "@/testing/renderWithApp";
import { EnterpriseGlobalSearch } from "./EnterpriseGlobalSearch";

afterEach(cleanup);

describe("EnterpriseGlobalSearch", () => {
  it("supports arrow-key selection and opens the highlighted workspace", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    renderWithApp(
      <EnterpriseGlobalSearch
        navigation={implementedNavigation}
        onNavigate={onNavigate}
      />,
    );

    const input = screen.getByRole("searchbox", {
      name: "搜索应用和工作区",
    });
    await user.type(input, "监测");

    const results = screen.getAllByRole("option");
    expect(results.length).toBeGreaterThan(1);
    expect(results[0]).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowDown}{Enter}");

    expect(onNavigate).toHaveBeenCalledWith("/production");
  });
});
