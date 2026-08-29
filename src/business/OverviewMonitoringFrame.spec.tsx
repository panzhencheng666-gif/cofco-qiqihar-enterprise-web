import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OverviewMonitoringFrame } from "./OverviewMonitoringFrame";

describe("OverviewMonitoringFrame", () => {
  it("opens the map through the business platform same-origin gateway", () => {
    render(<OverviewMonitoringFrame />);

    const frame = screen.getByTitle("齐齐哈尔粮食商情总览监测地图");
    expect(frame.getAttribute("src")).toBe(
      "/overview-monitoring/?embed=1#/overview",
    );
  });

  it("lets the embedded map fill the whole entry without an outer navigation strip", () => {
    const view = render(<OverviewMonitoringFrame />);

    expect(
      within(view.container).queryByRole("navigation", {
        name: "总览监测导航",
      }),
    ).not.toBeInTheDocument();

    const css = readFileSync("src/business/formal-enterprise.css", "utf8");
    const entryRule = css.match(
      /\.overview-monitoring-entry\s*\{([^}]*)\}/s,
    )?.[1];
    expect(entryRule).toBeDefined();
    expect(entryRule).not.toMatch(/grid-template-rows/);
    expect(entryRule).toMatch(/overflow:\s*hidden/);
  });
});
