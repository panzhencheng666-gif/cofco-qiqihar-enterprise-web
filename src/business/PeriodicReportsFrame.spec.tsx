import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PeriodicReportsFrame } from "./PeriodicReportsFrame";

describe("PeriodicReportsFrame", () => {
  it("opens content-only periodic reports through the same-origin gateway", () => {
    render(<PeriodicReportsFrame />);

    const frame = screen.getByTitle("齐齐哈尔粮食商情周期总结");
    expect(frame.getAttribute("src")).toBe(
      "/overview-monitoring/?embed=1#/报表中心",
    );
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
