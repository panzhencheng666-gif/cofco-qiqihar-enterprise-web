import { useEffect, useState } from "react";

import { ALL_AUTHORIZED_REGION_CODE } from "@/platform/api/observableAnalysisContract";
import type {
  RealtimeBusinessRepository,
  SampleNetworkComparison,
} from "@/platform/api/realtimeBusinessRepository";

import "./sample-network-coverage.css";

export function SampleNetworkCoverageStrip({
  regionCode,
  repository,
  year,
}: {
  regionCode?: string;
  repository: RealtimeBusinessRepository;
  year: number;
}) {
  const scopedRegion =
    regionCode && regionCode !== ALL_AUTHORIZED_REGION_CODE
      ? regionCode
      : undefined;
  const requestKey = `${year}:${scopedRegion ?? "*"}`;
  const [result, setResult] = useState<{
    comparison?: SampleNetworkComparison;
    key: string;
    unavailable?: boolean;
  }>();

  useEffect(() => {
    let active = true;
    if (!repository.getSampleNetworkComparison) return undefined;
    void repository
      .getSampleNetworkComparison(year, scopedRegion)
      .then((next) => {
        if (!active) return;
        setResult({ comparison: next, key: requestKey });
      })
      .catch(() => {
        if (active) setResult({ key: requestKey, unavailable: true });
      });
    return () => {
      active = false;
    };
  }, [repository, requestKey, scopedRegion, year]);

  const current = result?.key === requestKey ? result : undefined;
  const comparison = current?.comparison;
  const unavailable =
    !repository.getSampleNetworkComparison || current?.unavailable;

  return (
    <section
      aria-label="样本网络覆盖"
      className="sample-network-coverage-strip"
    >
      {comparison ? (
        comparison.networkStatus === "NOT_CREATED" ? (
          <p>{year}年度网络尚未创建</p>
        ) : (
          <dl>
            <div>
              <dt>设计行政村</dt>
              <dd>{formatCount(comparison.designPointCount)}</dd>
            </div>
            <div>
              <dt>年度现有样本点</dt>
              <dd>{formatCount(comparison.activeSamplePointCount)}</dd>
            </div>
            <div>
              <dt>已覆盖行政村</dt>
              <dd>{formatCount(comparison.coveredDesignPointCount)}</dd>
            </div>
            <div>
              <dt>未覆盖行政村</dt>
              <dd>{formatCount(comparison.uncoveredDesignPointCount)}</dd>
            </div>
          </dl>
        )
      ) : (
        <p>{unavailable ? "样本网络覆盖暂不可用" : "正在读取样本网络覆盖…"}</p>
      )}
      <small>仅用于样本网络覆盖对照，不参与业务指标计算</small>
    </section>
  );
}

function formatCount(value: number) {
  return value.toLocaleString("zh-CN");
}
