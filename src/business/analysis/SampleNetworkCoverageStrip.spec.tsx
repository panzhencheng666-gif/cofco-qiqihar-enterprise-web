import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";
import { ALL_AUTHORIZED_REGION_CODE } from "@/platform/api/observableAnalysisContract";
import { SampleNetworkCoverageStrip } from "./SampleNetworkCoverageStrip";

afterEach(cleanup);

describe("SampleNetworkCoverageStrip", () => {
  it("shows coverage counts as network context and omits the all-region sentinel", async () => {
    const getSampleNetworkComparison = vi.fn().mockResolvedValue({
      networkYear: 2026,
      networkStatus: "PUBLISHED",
      designPointCount: 2332,
      activeSamplePointCount: 650,
      coveredDesignPointCount: 640,
      uncoveredDesignPointCount: 1692,
      points: [],
    });
    const repository = {
      getSampleNetworkComparison,
    } as unknown as RealtimeBusinessRepository;

    render(
      <SampleNetworkCoverageStrip
        regionCode={ALL_AUTHORIZED_REGION_CODE}
        repository={repository}
        year={2026}
      />,
    );

    const strip = await screen.findByRole("region", { name: "样本网络覆盖" });
    expect(strip).toHaveTextContent("设计行政村2,332");
    expect(strip).toHaveTextContent("年度现有样本点650");
    expect(strip).toHaveTextContent("未覆盖行政村1,692");
    expect(strip).toHaveTextContent(
      "仅用于样本网络覆盖对照，不参与业务指标计算",
    );
    expect(getSampleNetworkComparison).toHaveBeenCalledWith(2026, undefined);
  });

  it("discards a stale response when the selected year changes", async () => {
    let resolve2026: ((value: unknown) => void) | undefined;
    const getSampleNetworkComparison = vi.fn((year: number) =>
      year === 2026
        ? new Promise((resolve) => {
            resolve2026 = resolve;
          })
        : Promise.resolve({
            networkYear: 2027,
            networkStatus: "NOT_CREATED",
            designPointCount: 2332,
            activeSamplePointCount: 0,
            coveredDesignPointCount: 0,
            uncoveredDesignPointCount: 2332,
            points: [],
          }),
    );
    const repository = {
      getSampleNetworkComparison,
    } as unknown as RealtimeBusinessRepository;
    const { rerender } = render(
      <SampleNetworkCoverageStrip repository={repository} year={2026} />,
    );

    rerender(
      <SampleNetworkCoverageStrip repository={repository} year={2027} />,
    );
    expect(await screen.findByText("2027年度网络尚未创建")).toBeVisible();
    resolve2026?.({
      networkYear: 2026,
      networkStatus: "PUBLISHED",
      designPointCount: 1,
      activeSamplePointCount: 1,
      coveredDesignPointCount: 1,
      uncoveredDesignPointCount: 0,
      points: [],
    });
    await waitFor(() =>
      expect(screen.getByText("2027年度网络尚未创建")).toBeVisible(),
    );
  });
});
