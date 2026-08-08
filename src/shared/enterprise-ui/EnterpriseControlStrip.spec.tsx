import type { ComponentType, ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as EnterpriseUi from "./index";

interface ControlStripProps {
  title: string;
  items: readonly {
    label: string;
    value: ReactNode;
  }[];
}

describe("EnterpriseControlStrip", () => {
  it("exports and renders titled control metadata with description-list semantics", () => {
    const EnterpriseControlStrip = (
      EnterpriseUi as unknown as Record<
        string,
        ComponentType<ControlStripProps> | undefined
      >
    ).EnterpriseControlStrip;

    expect(EnterpriseControlStrip).toBeDefined();
    if (!EnterpriseControlStrip) return;

    render(
      <EnterpriseControlStrip
        title="本次运行控制"
        items={[
          { label: "责任岗位", value: "区域分析岗" },
          { label: "任务批次", value: "2026 年第 31 周" },
          { label: "截止时点", value: "07 月 31 日 18:00" },
          { label: "数据资格", value: "正式发布" },
        ]}
      />,
    );

    const strip = screen.getByRole("region", { name: "本次运行控制" });
    expect(strip.querySelector("dl")).toBeVisible();
    expect(strip.querySelectorAll("dt")).toHaveLength(4);
    expect(strip.querySelectorAll("dd")).toHaveLength(4);
    expect(within(strip).getByText("责任岗位")).toBeVisible();
    expect(within(strip).getByText("区域分析岗")).toBeVisible();
    expect(within(strip).getByText("任务批次")).toBeVisible();
    expect(within(strip).getByText("2026 年第 31 周")).toBeVisible();
  });
});
