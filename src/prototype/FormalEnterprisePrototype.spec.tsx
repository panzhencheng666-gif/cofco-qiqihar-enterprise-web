import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { FormalEnterprisePrototype } from "./FormalEnterprisePrototype";

afterEach(cleanup);

describe("formal enterprise prototype", () => {
  it("uses the enterprise shell and the three-section production navigation", () => {
    render(
      <FormalEnterprisePrototype initialSearch="?page=production&section=objects" />,
    );

    expect(screen.getByText("企业经营平台")).toBeVisible();
    const navigation = screen.getByRole("navigation", { name: "产情监测模块" });
    expect(within(navigation).getAllByRole("button")).toHaveLength(3);
    expect(within(navigation).getByText("业务任务")).toBeVisible();
    expect(within(navigation).getByText("监测对象")).toBeVisible();
    expect(within(navigation).getByText("监测分析")).toBeVisible();
  });

  it("changes applications through the location-owned route", async () => {
    const user = userEvent.setup();
    render(<FormalEnterprisePrototype initialSearch="?page=market&section=tasks" />);

    await user.click(
      within(screen.getByRole("navigation", { name: "业务应用" })).getByRole(
        "button",
        { name: "供需与态势" },
      ),
    );

    expect(window.location.search).toContain("page=supply");
    expect(
      screen.getByRole("navigation", { name: "供需与态势模块" }),
    ).toHaveTextContent("供需测算");
  });
});
