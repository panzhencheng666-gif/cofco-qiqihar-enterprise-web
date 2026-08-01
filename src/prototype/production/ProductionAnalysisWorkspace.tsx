import { useMemo } from "react";

import { AnnualComparisonTrack } from "../components/AnnualComparisonTrack";
import { ComparisonCharts } from "../components/ComparisonCharts";
import { businessClassifications } from "../core/businessClassification";
import {
  createMetricComparisonViewModel,
  type MetricComparisonViewModel,
} from "../core/metricComparisonViewModel";
import type { OperationalScope } from "../core/operationalScope";
import { queryPrototypeMetricComparisons } from "../data/enterpriseMetricFixtures";
import { getEnterpriseScopeRegion } from "../enterpriseRegions";
import type { BusinessCoordinates } from "../formalEnterpriseModel";
import {
  productionAnalysisCoordinateOptions,
  productionMetricGovernanceLabels,
  productionMetricReleaseNames,
} from "../productionMonitoringData";
import {
  formatProductionDateTime,
  governedProductionName,
  productionCultivarNames,
  productionProductNames,
} from "../productionMonitoringModel";
import { WorkspaceHeader } from "../UnifiedWorkspacePrimitives";

interface GovernedMetric {
  model: MetricComparisonViewModel;
  formula: string;
  cutoff: string;
  coverage: string;
  quality: string;
  sourceVersionLabel: string;
  definitionLabel: string;
  comparabilityLabel: string;
}

function regionName(id: string): string {
  return getEnterpriseScopeRegion(id)?.label ?? "地区名称待维护";
}

function localizedModel(
  model: MetricComparisonViewModel,
): MetricComparisonViewModel | null {
  const yearCells = model.yearCells.map((cell) => ({
    ...cell,
    releaseVersionLabel:
      productionMetricReleaseNames[cell.releaseVersionLabel] ?? "",
  }));
  if (yearCells.some(({ releaseVersionLabel }) => !releaseVersionLabel))
    return null;
  return { ...model, yearCells };
}

function currentYear(periodKey: string | undefined): number | null {
  const match = /^(\d{4})-W\d+$/.exec(periodKey ?? "");
  return match ? Number(match[1]) : null;
}

function AnalysisFilters({
  scope,
  onScopeChange,
}: {
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
}) {
  const classifications = businessClassifications.filter(
    ({ domain, id }) =>
      domain === "production" &&
      scope.authorization.authorizedBusinessClassificationIds.includes(id),
  );
  return (
    <section
      aria-label="产情分析筛选"
      className="production-task5-filter-surface"
    >
      <div className="production-task5-filter-grid production-task5-filter-grid--analysis">
        <label>
          <span>业务分类</span>
          <select
            aria-label="业务分类"
            value={scope.coordinates.businessSubtypeId ?? ""}
            onChange={(event) =>
              onScopeChange({
                businessSubtypeId: event.target.value || undefined,
                selectedMetricId: undefined,
              })
            }
          >
            <option value="">全部已授权分类</option>
            {classifications.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>业务地区</span>
          <select
            aria-label="业务地区"
            value={scope.coordinates.regionId}
            onChange={(event) =>
              onScopeChange({
                regionId: event.target.value,
                selectedMetricId: undefined,
              })
            }
          >
            <option value="authorized-all">全部已授权范围</option>
            {scope.authorization.authorizedRegionIds.map((id) => (
              <option key={id} value={id}>
                {regionName(id)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>产品或作物</span>
          <select
            aria-label="产品或作物"
            value={scope.coordinates.productId ?? ""}
            onChange={(event) =>
              onScopeChange({
                productId: event.target.value || undefined,
                cultivarId: undefined,
                selectedMetricId: undefined,
              })
            }
          >
            <option value="">请选择已授权产品</option>
            {scope.authorization.authorizedProductIds.map((id) => (
              <option key={id} value={id}>
                {governedProductionName(
                  productionProductNames,
                  id,
                  "产品名称待维护",
                )}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>具体品种</span>
          <select
            aria-label="具体品种"
            value={scope.coordinates.cultivarId ?? ""}
            onChange={(event) =>
              onScopeChange({
                cultivarId: event.target.value || undefined,
                selectedMetricId: undefined,
              })
            }
          >
            <option value="">全部已授权品种</option>
            {scope.authorization.authorizedCultivarIds.map((id) => (
              <option key={id} value={id}>
                {governedProductionName(
                  productionCultivarNames,
                  id,
                  "品种名称待维护",
                )}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>分析期间</span>
          <select
            aria-label="分析期间"
            value={scope.coordinates.periodKey ?? ""}
            onChange={(event) =>
              onScopeChange({
                periodKey: event.target.value || undefined,
                selectedMetricId: undefined,
              })
            }
          >
            <option value="">请选择分析期间</option>
            {productionAnalysisCoordinateOptions.periods.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
            {scope.coordinates.periodKey &&
              !productionAnalysisCoordinateOptions.periods.some(
                ({ id }) => id === scope.coordinates.periodKey,
              ) && (
                <option disabled value={scope.coordinates.periodKey}>
                  无效分析期间（请重新选择）
                </option>
              )}
          </select>
        </label>
        <label>
          <span>数据层</span>
          <select
            aria-label="数据层"
            value={scope.coordinates.dataLayer ?? ""}
            onChange={(event) =>
              onScopeChange({
                dataLayer: (event.target.value ||
                  undefined) as BusinessCoordinates["dataLayer"],
                selectedMetricId: undefined,
              })
            }
          >
            <option value="">请选择数据层</option>
            {productionAnalysisCoordinateOptions.dataLayers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>指标数据版本</span>
          <select
            aria-label="指标数据版本"
            value={scope.coordinates.releaseVersion ?? ""}
            onChange={(event) =>
              onScopeChange({
                releaseVersion: event.target.value || undefined,
                selectedMetricId: undefined,
              })
            }
          >
            <option value="">请选择已授权版本</option>
            {productionAnalysisCoordinateOptions.releaseVersions
              .filter(({ id }) =>
                scope.authorization.authorizedReleaseVersionIds.includes(id),
              )
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
          </select>
        </label>
      </div>
    </section>
  );
}

export function ProductionAnalysisWorkspace({
  scope,
  onScopeChange,
  queryAllowed,
}: {
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  queryAllowed: boolean;
}) {
  const year = currentYear(scope.coordinates.periodKey);
  const completeCoordinates =
    year !== null &&
    scope.coordinates.productId !== undefined &&
    scope.coordinates.dataLayer === "official" &&
    scope.coordinates.releaseVersion !== undefined;
  const { metrics, unmappedVersion } = useMemo(() => {
    if (!completeCoordinates || year === null)
      return { metrics: [] as GovernedMetric[], unmappedVersion: false };
    let missingGovernance = false;
    const governed = queryPrototypeMetricComparisons({
      scope,
      queryAllowed,
      domain: "production",
      currentYear: year,
      businessSubtype: scope.coordinates.businessSubtypeId as never,
    }).flatMap((result): GovernedMetric[] => {
      if (result.status !== "ready") return [];
      const rawModel = createMetricComparisonViewModel(
        result.definition,
        result.comparison,
      );
      const model = localizedModel(rawModel);
      if (!model) {
        missingGovernance = true;
        return [];
      }
      const current = result.comparison.points[3];
      if (current.availability !== "available") return [];
      return [
        {
          model,
          formula: result.definition.formula,
          cutoff: formatProductionDateTime(current.coordinate.period.cutoff),
          coverage: `${current.coverageRate}%`,
          quality:
            current.qualityStatus === "passed"
              ? productionMetricGovernanceLabels.qualityPassed
              : "存在质量提醒",
          sourceVersionLabel:
            productionMetricReleaseNames[
              current.coordinate.metricReleaseVersionId
            ] ?? "指标版本名称待维护",
          definitionLabel: `${result.definition.label}${productionMetricGovernanceLabels.definitionEdition}`,
          comparabilityLabel:
            productionMetricGovernanceLabels.comparabilityEdition,
        },
      ];
    });
    return { metrics: governed, unmappedVersion: missingGovernance };
  }, [completeCoordinates, queryAllowed, scope, year]);
  const selected = metrics.find(
    ({ model }) => model.metricId === scope.coordinates.selectedMetricId,
  );
  const invalidSelectedMetric =
    scope.coordinates.selectedMetricId !== undefined && selected === undefined;
  return (
    <div className="unified-workspace production-task5-workspace">
      <WorkspaceHeader
        eyebrow="产情监测 / 监测分析"
        title="产情监测分析"
        summary="只读取官方已发布指标，按当前期与前三年同口径比较，并在选择指标后展开图表。"
      />
      <AnalysisFilters onScopeChange={onScopeChange} scope={scope} />
      {!queryAllowed && (
        <div className="production-task5-alert" role="alert">
          当前业务坐标无权查询，系统未展示其他分析结果。
        </div>
      )}
      {!completeCoordinates && (
        <div className="production-task5-empty" role="status">
          请选择产品或作物、分析期间、正式数据层和指标数据版本后查询。
        </div>
      )}
      {unmappedVersion && (
        <div className="production-task5-alert" role="alert">
          指标版本名称待维护，相关指标已停止展示且没有回落到其他版本。
        </div>
      )}
      {invalidSelectedMetric && (
        <div className="production-task5-alert" role="alert">
          所选指标不可用或无权查看，系统未打开其他指标。
        </div>
      )}
      <section
        aria-label="产情四年指标台账区域"
        className="production-task5-ledger-region"
      >
        <div className="production-task5-ledger-scroll">
          <table
            aria-label="产情四年指标台账"
            className="production-task5-ledger production-task5-analysis-ledger"
          >
            <thead>
              <tr>
                <th className="production-task5-sticky" scope="col">
                  指标
                </th>
                <th scope="col">当前值</th>
                <th scope="col">当前与前三年</th>
                <th scope="col">三段相邻变化</th>
                <th scope="col">当前较三个基期</th>
                <th scope="col">三年复合增长率</th>
                <th scope="col">来源与质量</th>
                <th scope="col">截止</th>
                <th scope="col">指标数据版本</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => (
                <tr key={metric.model.metricId}>
                  <th className="production-task5-sticky" scope="row">
                    {metric.model.metricLabel}
                  </th>
                  <td>
                    {metric.model.currentValue} {metric.model.unit}
                  </td>
                  <td>
                    {metric.model.yearCells
                      .map((cell) => `${String(cell.year)}：${cell.valueText}`)
                      .join(" · ")}
                  </td>
                  <td>
                    {metric.model.pairCells
                      .map(({ label, changeText }) => `${label} ${changeText}`)
                      .join(" · ")}
                  </td>
                  <td>
                    {metric.model.currentVsBaselineSeries
                      .map(({ label, changeText }) => `${label} ${changeText}`)
                      .join(" · ")}
                  </td>
                  <td>{metric.model.cagrText}</td>
                  <td>
                    {productionMetricGovernanceLabels.source} ·{" "}
                    {metric.coverage} · {metric.quality}
                  </td>
                  <td>{metric.cutoff}</td>
                  <td>{metric.sourceVersionLabel}</td>
                  <td>
                    <button
                      className="production-task5-row-action"
                      type="button"
                      aria-pressed={
                        selected?.model.metricId === metric.model.metricId
                      }
                      onClick={() =>
                        onScopeChange({
                          selectedMetricId: metric.model.metricId,
                        })
                      }
                    >
                      分析{metric.model.metricLabel}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {completeCoordinates && metrics.length === 0 && !unmappedVersion && (
          <div className="production-task5-empty" role="status">
            当前业务坐标没有四个年度的官方发布指标，系统未改变筛选条件。
          </div>
        )}
      </section>
      {selected && !invalidSelectedMetric && (
        <section
          aria-label={`${selected.model.metricLabel}选中指标分析`}
          className="production-task5-selected-analysis"
        >
          <AnnualComparisonTrack
            model={selected.model}
            onSelect={(metricId) =>
              onScopeChange({ selectedMetricId: metricId })
            }
            selected
          />
          <ComparisonCharts model={selected.model} />
          <aside aria-label="来源与口径" className="production-task5-lineage">
            <h2>来源与口径</h2>
            <dl>
              <div>
                <dt>指标来源</dt>
                <dd>{productionMetricGovernanceLabels.source}</dd>
              </div>
              <div>
                <dt>数据截止</dt>
                <dd>{selected.cutoff}</dd>
              </div>
              <div>
                <dt>覆盖与质量</dt>
                <dd>
                  {selected.coverage} · {selected.quality}
                </dd>
              </div>
              <div>
                <dt>指标定义</dt>
                <dd>
                  {selected.definitionLabel} · {selected.formula}
                </dd>
              </div>
              <div>
                <dt>可比规则</dt>
                <dd>
                  {selected.comparabilityLabel} ·{" "}
                  {selected.model.comparabilityText}
                </dd>
              </div>
              <div>
                <dt>采用版本</dt>
                <dd>{selected.sourceVersionLabel}</dd>
              </div>
            </dl>
          </aside>
        </section>
      )}
    </div>
  );
}
