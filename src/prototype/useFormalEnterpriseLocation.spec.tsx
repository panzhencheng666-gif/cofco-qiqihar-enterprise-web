import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { createFormalRoute } from "./formalEnterpriseModel";
import { useFormalEnterpriseLocation } from "./useFormalEnterpriseLocation";

afterEach(cleanup);

function LocationProbe() {
  const { location, navigate, updateCoordinates } =
    useFormalEnterpriseLocation();
  return (
    <div>
      <output aria-label="location">{JSON.stringify(location)}</output>
      <button
        type="button"
        onClick={() =>
          navigate(createFormalRoute("production", "tasks"), {
            type: "work-item",
            id: "PROD-W31-002",
          })
        }
      >
        open task
      </button>
      <button
        type="button"
        onClick={() =>
          updateCoordinates({
            regionId: "qiqihar-nehe",
            productId: "corn",
            periodKey: "2026-W31",
          })
        }
      >
        update filters
      </button>
    </div>
  );
}

describe("useFormalEnterpriseLocation", () => {
  it("writes page navigation with pushState and filters with replaceState", async () => {
    window.history.replaceState({}, "", "/?variant=A&page=market&section=objects");
    const pushState = window.history.pushState;
    const replaceState = window.history.replaceState;
    const pushed: string[] = [];
    const replaced: string[] = [];
    window.history.pushState = ((state, title, url) => {
      pushed.push(String(url));
      return pushState.call(window.history, state, title, url);
    }) as History["pushState"];
    window.history.replaceState = ((state, title, url) => {
      replaced.push(String(url));
      return replaceState.call(window.history, state, title, url);
    }) as History["replaceState"];
    const user = userEvent.setup();
    render(<LocationProbe />);

    await user.click(screen.getByRole("button", { name: "open task" }));
    expect(pushed.at(-1)).toContain("page=production");
    expect(pushed.at(-1)).toContain("selectionId=PROD-W31-002");

    await user.click(screen.getByRole("button", { name: "update filters" }));
    expect(replaced.at(-1)).toContain("page=production");
    expect(replaced.at(-1)).toContain("variant=A");
    expect(replaced.at(-1)).toContain("region=qiqihar-nehe");
    expect(replaced.at(-1)).toContain("product=corn");
    expect(replaced.at(-1)).toContain("period=2026-W31");

    window.history.pushState = pushState;
    window.history.replaceState = replaceState;
  });

  it("restores route, selection, and filters on popstate", () => {
    window.history.replaceState(
      {},
      "",
      "/?page=market&section=analysis&region=qiqihar-nehe&product=corn&period=2026-W31&selectionType=object&selectionId=MARKET-001",
    );
    render(<LocationProbe />);
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(screen.getByLabelText("location")).toHaveTextContent(
      '"application":"market"',
    );
    expect(screen.getByLabelText("location")).toHaveTextContent(
      '"section":"analysis"',
    );
    expect(screen.getByLabelText("location")).toHaveTextContent(
      '"id":"MARKET-001"',
    );
    expect(screen.getByLabelText("location")).toHaveTextContent(
      '"productId":"corn"',
    );
  });
});
