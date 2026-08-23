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
      coveredDesignPointCount: 340,
      uncoveredDesignPointCount: 1992,
      exactCoveredDesignPointCount: 300,
      representedDesignPointCount: 40,
      regionalAssociationDesignPointCount: 50,
      unrelatedDesignPointCount: 1942,
      actualLevelCounts: {
        prefecture: 2,
        county: 10,
        township: 38,
        village: 600,
      },
      designPoints: [],
      actualPoints: [],
      relations: [],
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
    expect(strip).toHaveTextContent("设计村总数2,332");
    expect(strip).toHaveTextContent("年度现有样本点650");
    expect(strip).toHaveTextContent("村级精确覆盖300");
    expect(strip).toHaveTextContent("明确代表覆盖40");
    expect(strip).toHaveTextContent("区域关联50");
    expect(strip).toHaveTextContent("地市级样本2");
    expect(strip).toHaveTextContent("区县级样本10");
    expect(strip).toHaveTextContent("乡镇级样本38");
    expect(strip).toHaveTextContent("村级样本600");
    expect(strip).not.toHaveTextContent("已覆盖行政村");
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
            exactCoveredDesignPointCount: 0,
            representedDesignPointCount: 0,
            regionalAssociationDesignPointCount: 0,
            unrelatedDesignPointCount: 2332,
            actualLevelCounts: {
              prefecture: 0,
              county: 0,
              township: 0,
              village: 0,
            },
            designPoints: [],
            actualPoints: [],
            relations: [],
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
      exactCoveredDesignPointCount: 1,
      representedDesignPointCount: 0,
      regionalAssociationDesignPointCount: 0,
      unrelatedDesignPointCount: 0,
      actualLevelCounts: { prefecture: 0, county: 0, township: 0, village: 1 },
      designPoints: [],
      actualPoints: [],
      relations: [],
    });
    await waitFor(() =>
      expect(screen.getByText("2027年度网络尚未创建")).toBeVisible(),
    );
  });
});
