import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OverviewMonitoringFrame } from "./OverviewMonitoringFrame";

describe("OverviewMonitoringFrame", () => {
  it("opens the real map application's overview route instead of the prototype shell", () => {
    render(<OverviewMonitoringFrame />);

    const frame = screen.getByTitle("齐齐哈尔粮食商情总览监测地图");
    expect(frame.getAttribute("src")).toMatch(
      /^https?:\/\/(?:[^/]+):63200\/\?embed=1#\/overview$/,
    );
  });
});
