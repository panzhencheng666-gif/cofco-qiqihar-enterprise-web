import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { createFormalRoute } from "./formalEnterpriseModel";
import { useFormalEnterpriseLocation } from "./useFormalEnterpriseLocation";

const operationalIdentity = {
  workUnit: { organizationId: "org", unitId: "unit", label: "工作单位" },
  identity: { userId: "user", postId: "post" },
  authorization: {
    authorizedRegionIds: ["qiqihar-nehe"],
    authorizedBusinessClassificationIds: ["production.planting-production"],
    authorizedProductIds: ["corn"],
    authorizedCultivarIds: ["jingke-968"],
    authorizedReleaseVersionIds: ["METRIC-2026-W31-V3"],
    permissionKeys: ["prototype:read"],
  },
} as const;

afterEach(cleanup);

function LocationProbe() {
  const { location, navigate, updateCoordinates, setSavedViewId } =
    useFormalEnterpriseLocation(operationalIdentity);
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
      <button type="button" onClick={() => navigate(createFormalRoute("market", "tasks"))}>
        open market
      </button>
      <button type="button" onClick={() => setSavedViewId("view-1")}>
        save view
      </button>
    </div>
  );
}

describe("useFormalEnterpriseLocation", () => {
  it("writes page navigation and user-controlled filters with pushState", async () => {
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
    expect(pushed.at(-1)).toContain("page=production");
    expect(pushed.at(-1)).toContain("variant=A");
    expect(pushed.at(-1)).toContain("region=qiqihar-nehe");
    expect(pushed.at(-1)).toContain("product=corn");
    expect(pushed.at(-1)).toContain("period=2026-W31");

    window.history.pushState = pushState;
    window.history.replaceState = replaceState;
  });

  it("restores route, selection, and filters on popstate", () => {
    window.history.replaceState({}, "", "/?page=work&section=tasks");
    render(<LocationProbe />);
    window.history.replaceState(
      {},
      "",
      "/?page=market&section=analysis&region=qiqihar-nehe&product=corn&period=2026-W31&selectionType=object&selectionId=MARKET-001",
    );
    act(() => window.dispatchEvent(new PopStateEvent("popstate")));

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

  it("clears stale selection during application navigation and restores page-owned coordinates", async () => {
    window.history.replaceState(
      {},
      "",
      "/?page=production&section=tasks&region=qiqihar-nehe&product=corn&selectionType=work-item&selectionId=PROD-W31-002",
    );
    const user = userEvent.setup();
    render(<LocationProbe />);

    await user.click(screen.getByRole("button", { name: "open market" }));

    expect(screen.getByLabelText("location")).not.toHaveTextContent(
      "PROD-W31-002",
    );
    expect(screen.getByLabelText("location")).toHaveTextContent(
      '"regionId":"authorized-all"',
    );
  });

  it("writes saved views with replaceState while retaining the current route", async () => {
    window.history.replaceState({}, "", "/?variant=A&page=market&section=analysis");
    const replaceState = window.history.replaceState;
    const calls: string[] = [];
    window.history.replaceState = ((state, title, url) => {
      calls.push(String(url));
      return replaceState.call(window.history, state, title, url);
    }) as History["replaceState"];
    const user = userEvent.setup();
    render(<LocationProbe />);

    await user.click(screen.getByRole("button", { name: "save view" }));
    expect(calls.at(-1)).toContain("savedView=view-1");
    expect(calls.at(-1)).toContain("page=market");
    expect(calls.at(-1)).toContain("variant=A");
    window.history.replaceState = replaceState;
  });
});
