import { useEffect, useState } from "react";

import { ALL_AUTHORIZED_REGION_CODE } from "@/platform/api/observableAnalysisContract";
import type {
  RealtimeBusinessRepository,
  SampleNetworkComparison,
} from "@/platform/api/realtimeBusinessRepository";

import "./sample-network-coverage.css";

export function SampleNetworkCoverageStrip({
  productCode,
  regionCode,
  repository,
  year,
}: {
  productCode?: string;
  regionCode?: string;
  repository: RealtimeBusinessRepository;
  year: number;
}) {
  const scopedRegion =
    regionCode && regionCode !== ALL_AUTHORIZED_REGION_CODE
      ? regionCode
      : undefined;
  const requestKey = `${year}:${scopedRegion ?? "*"}:${productCode ?? "*"}`;
  const [result, setResult] = useState<{
    comparison?: SampleNetworkComparison;
    key: string;
    unavailable?: boolean;
  }>();

  useEffect(() => {
    let active = true;
    if (!repository.getSampleNetworkComparison) return undefined;
    void repository
      .getSampleNetworkComparison(year, scopedRegion, productCode)
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
  }, [productCode, repository, requestKey, scopedRegion, year]);

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
        ) : !isFormalNetwork(comparison.networkStatus) ? (
          <p>
            {year}年度网络尚未发布（当前：
            {networkStatusLabel(comparison.networkStatus)}）
          </p>
        ) : (
          <dl>
            <div>
              <dt>设计村总数</dt>
              <dd>{formatCount(comparison.designPointCount)}</dd>
            </div>
            <div>
              <dt>已登记设计坐标</dt>
              <dd>{formatCount(comparison.designCoordinateCount)}</dd>
            </div>
            <div>
              <dt>年度现有样本点</dt>
              <dd>{formatCount(comparison.activeSamplePointCount)}</dd>
            </div>
            <div>
              <dt>已审核报送</dt>
              <dd>
                {formatCount(comparison.approvedSubmissionSamplePointCount)}
              </dd>
            </div>
            <div>
              <dt>村级精确覆盖</dt>
              <dd>
                {formatCoverage(
                  comparison.exactCoveredDesignPointCount,
                  comparison.designPointCount,
                )}
              </dd>
            </div>
            <div>
              <dt>明确代表覆盖</dt>
              <dd>
                {formatCoverage(
                  comparison.representedDesignPointCount,
                  comparison.designPointCount,
                )}
              </dd>
            </div>
            <div>
              <dt>区域关联</dt>
              <dd>
                {formatCount(comparison.regionalAssociationDesignPointCount)}
              </dd>
            </div>
            <div>
              <dt>未建立覆盖关系</dt>
              <dd>{formatCount(comparison.unrelatedDesignPointCount)}</dd>
            </div>
            <div>
              <dt>地市级样本</dt>
              <dd>{formatCount(comparison.actualLevelCounts.prefecture)}</dd>
            </div>
            <div>
              <dt>区县级样本</dt>
              <dd>{formatCount(comparison.actualLevelCounts.county)}</dd>
            </div>
            <div>
              <dt>乡镇级样本</dt>
              <dd>{formatCount(comparison.actualLevelCounts.township)}</dd>
            </div>
            <div>
              <dt>村级样本</dt>
              <dd>{formatCount(comparison.actualLevelCounts.village)}</dd>
            </div>
            <div>
              <dt>待核验设计点</dt>
              <dd>
                {formatCount(comparison.pendingVerificationDesignPointCount)}
              </dd>
            </div>
            <div>
              <dt>多点对应行政村</dt>
              <dd>
                {formatCount(comparison.multipleActualPerDesignPointCount)}
              </dd>
            </div>
            <div>
              <dt>异常</dt>
              <dd>{formatCount(comparison.anomalyCount)}</dd>
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

function formatCoverage(value: number, total: number) {
  if (total <= 0) return `${formatCount(value)} / —`;
  return `${formatCount(value)} / ${formatCount(total)}（${((value / total) * 100).toFixed(1)}%）`;
}

function isFormalNetwork(status: SampleNetworkComparison["networkStatus"]) {
  return status === "PUBLISHED" || status === "RETIRED";
}

function networkStatusLabel(status: SampleNetworkComparison["networkStatus"]) {
  if (status === "DRAFT") return "草稿";
  if (status === "IN_REVIEW") return "审核中";
  return status;
}
