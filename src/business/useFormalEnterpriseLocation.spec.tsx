import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFormalRoute,
  type FormalLocation,
} from "./formalEnterpriseModel";
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
    permissionKeys: ["enterprise:fixtures:read"],
  },
} as const;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

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
      <button
        type="button"
        onClick={() => navigate(createFormalRoute("market", "tasks"))}
      >
        open market
      </button>
      <button type="button" onClick={() => setSavedViewId("view-1")}>
        save view
      </button>
    </div>
  );
}

describe("useFormalEnterpriseLocation", () => {
  it("migrates an old English query to a Chinese-only business hash", () => {
    window.history.replaceState(
      {},
      "",
      "/?variant=A&page=overview&section=operations&region=qiqihar-nehe&product=corn",
    );

    render(<LocationProbe />);

    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("");
    expect(decodeURIComponent(window.location.hash)).toBe(
      "#/经营总览/经营运行",
    );
    expect(window.location.href).not.toMatch(
      /overview|operations|variant|qiqihar|corn/,
    );
  });

  it("keeps business state in history state and exposes only Chinese module and view names", async () => {
    window.history.replaceState({}, "", "/#/市场监测/监测对象");
    const pushState = window.history.pushState.bind(window.history);
    const replaceState = window.history.replaceState.bind(window.history);
    const pushed: Array<{ state: unknown; url: string }> = [];
    const replaced: Array<{ state: unknown; url: string }> = [];
    window.history.pushState = ((state, title, url) => {
      pushed.push({ state: state as unknown, url: String(url) });
      return pushState(state, title, url);
    }) as History["pushState"];
    window.history.replaceState = ((state, title, url) => {
      replaced.push({ state: state as unknown, url: String(url) });
      return replaceState(state, title, url);
    }) as History["replaceState"];
    const user = userEvent.setup();
    render(<LocationProbe />);

    await user.click(screen.getByRole("button", { name: "open task" }));
    expect(decodeURIComponent(pushed.at(-1)?.url ?? "")).toContain(
      "#/产情监测/产情任务",
    );
    expect(pushed.at(-1)?.url).not.toMatch(
      /page=|section=|selectionId|PROD-W31-002/,
    );
    const pushedLocation = (
      pushed.at(-1)?.state as { formalLocation?: FormalLocation } | undefined
    )?.formalLocation;
    expect(pushedLocation?.selection).toEqual({
      type: "work-item",
      id: "PROD-W31-002",
    });
    expect(screen.getByLabelText("location")).toHaveTextContent(
      '"id":"PROD-W31-002"',
    );

    await user.click(screen.getByRole("button", { name: "update filters" }));
    expect(decodeURIComponent(replaced.at(-1)?.url ?? "")).toContain(
      "#/产情监测/产情任务",
    );
    expect(replaced.at(-1)?.url).not.toMatch(
      /region=|product=|period=|qiqihar-nehe|corn|2026-W31/,
    );
    expect(screen.getByLabelText("location")).toHaveTextContent(
      '"regionId":"qiqihar-nehe"',
    );
  });

  it("restores coordinates and selection across back and forward history entries", async () => {
    window.history.replaceState({}, "", "/#/我的工作/我的任务");
    const user = userEvent.setup();
    render(<LocationProbe />);

    await user.click(screen.getByRole("button", { name: "open task" }));
    await user.click(screen.getByRole("button", { name: "update filters" }));
    const productionState = window.history.state as unknown as {
      formalLocation: FormalLocation;
    };

    await user.click(screen.getByRole("button", { name: "open market" }));
    const marketState = window.history.state as unknown;

    window.history.replaceState(productionState, "", "/#/产情监测/业务任务");
    void act(() => {
      window.dispatchEvent(
        new PopStateEvent("popstate", { state: productionState }),
      );
    });

    expect(screen.getByLabelText("location")).toHaveTextContent(
      '"application":"production"',
    );
    expect(screen.getByLabelText("location")).toHaveTextContent(
      '"regionId":"qiqihar-nehe"',
    );
    expect(screen.getByLabelText("location")).toHaveTextContent(
      '"id":"PROD-W31-002"',
    );

    window.history.replaceState(marketState, "", "/#/市场监测/业务任务");
    void act(() => {
      window.dispatchEvent(
        new PopStateEvent("popstate", { state: marketState }),
      );
    });

    expect(screen.getByLabelText("location")).toHaveTextContent(
      '"application":"market"',
    );
    expect(screen.getByLabelText("location")).not.toHaveTextContent(
      "PROD-W31-002",
    );
  });

  it("ignores injected identifiers and canonicalizes invalid or legacy routes", () => {
    window.history.replaceState(
      {},
      "",
      "/?page=market&section=analysis&region=qiqihar-nehe&product=corn&period=2026-W31&selectionType=object&selectionId=MARKET-001",
    );
    render(<LocationProbe />);

    expect(window.location.search).toBe("");
    expect(decodeURIComponent(window.location.hash)).toBe(
      "#/市场监测/市场分析",
    );
    expect(screen.getByLabelText("location")).not.toHaveTextContent(
      "MARKET-001",
    );
    expect(screen.getByLabelText("location")).toHaveTextContent(
      '"regionId":"authorized-all"',
    );

    window.history.replaceState({}, "", "/#/不存在的模块/INTERNAL-001");
    void act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(decodeURIComponent(window.location.hash)).toBe(
      "#/市场监测/玉米市场采集",
    );
    expect(window.location.href).not.toContain("INTERNAL-001");
  });

  it("keeps saved views in state without exposing their identifiers", async () => {
    window.history.replaceState({}, "", "/#/市场监测/市场分析");
    const replaceState = window.history.replaceState.bind(window.history);
    const calls: Array<{ state: unknown; url: string }> = [];
    window.history.replaceState = ((state, title, url) => {
      calls.push({ state: state as unknown, url: String(url) });
      return replaceState(state, title, url);
    }) as History["replaceState"];
    const user = userEvent.setup();
    render(<LocationProbe />);

    await user.click(screen.getByRole("button", { name: "save view" }));
    expect(calls.at(-1)?.url).not.toContain("view-1");
    expect(decodeURIComponent(calls.at(-1)?.url ?? "")).toContain(
      "#/市场监测/市场分析",
    );
    const replacedLocation = (
      calls.at(-1)?.state as { formalLocation?: FormalLocation } | undefined
    )?.formalLocation;
    expect(replacedLocation?.savedViewId).toBe("view-1");
    expect(screen.getByLabelText("location")).toHaveTextContent(
      '"savedViewId":"view-1"',
    );
  });
});
