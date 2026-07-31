import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFormalRoute } from "./formalEnterpriseModel";
import { EnterpriseShell } from "./EnterpriseShell";

afterEach(cleanup);

describe("EnterpriseShell", () => {
  it("renders frame and typed navigation without owning business facts", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <EnterpriseShell
        location={{
          route: createFormalRoute("market", "objects"),
          coordinates: { regionId: "authorized-all" },
        }}
        onNavigate={onNavigate}
      >
        <h1>workspace</h1>
      </EnterpriseShell>,
    );

    expect(screen.getByRole("heading", { name: "workspace" })).toBeVisible();
    const applications = screen.getByRole("navigation", { name: "业务应用" });
    expect(within(applications).getAllByRole("button")).toHaveLength(6);
    await user.click(within(applications).getByRole("button", { name: "产情监测" }));
    expect(onNavigate).toHaveBeenCalledWith(createFormalRoute("production", "tasks"));
  });
});
