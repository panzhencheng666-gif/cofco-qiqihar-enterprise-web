import { render, screen } from "@testing-library/react";
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
});
