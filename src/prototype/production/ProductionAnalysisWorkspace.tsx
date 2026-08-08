import { useMemo } from "react";

import type {
  BusinessReportContext,
  BusinessReportRequest,
} from "../businessReportModel";
import { QuickReportExportMenu } from "../components/QuickReportExportMenu";
import { CompactBusinessQuery } from "../components/CompactBusinessQuery";
import { AnnualComparisonTrack } from "../components/AnnualComparisonTrack";
import { ComparisonCharts } from "../components/ComparisonCharts";
import { businessClassifications } from "../core/businessClassification";
import {
  getApplicableCultivars,
  platformProducts,
} from "../core/platformMasterData";
import {
  createMetricComparisonViewModel,
  type MetricComparisonViewModel,
} from "../core/metricComparisonViewModel";
import type { OperationalScope } from "../core/operationalScope";
import {
  enterpriseMetricDefinitions,
  queryPrototypeMetricComparisons,
} from "../data/enterpriseMetricFixtures";
import { findApprovedBusinessReportDatasetByMetricRelease } from "../data/businessReportDatasets";
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

interface UnavailableMetric {
  metricId: string;
  label: string;
  businessClassificationLabel: string;
  reason: string;
}

const productionReportTemplateByClassification: Readonly<
  Record<string, string>
> = {
  "production.planting-production": "种植生产监测报告",
};

const productionReportPeriodByAnalysisPeriod: Readonly<Record<string, string>> =
  {
    "2026-W31": "2026年第31周",
  };

function unavailableReason(reason: string): string {
  return reason.includes("批次")
    ? "所选采用数据与当前可用的已核定数据不一致"
    : "当前筛选范围尚未形成连续四个年度的已核定数据";
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
  const authorizedProductionProducts = platformProducts.filter(
    ({ id }) =>
      scope.authorization.authorizedProductIds.includes(id) &&
      productionProductNames[id] !== undefined,
  );
  const productInvalid =
    scope.coordinates.productId !== undefined &&
    !authorizedProductionProducts.some(
      ({ id }) => id === scope.coordinates.productId,
    );
  const applicableCultivars = scope.coordinates.productId
    ? getApplicableCultivars(scope.coordinates.productId).filter(({ id }) =>
        scope.authorization.authorizedCultivarIds.includes(id),
      )
    : [];
  const cultivarInvalid =
    scope.coordinates.cultivarId !== undefined &&
    !applicableCultivars.some(({ id }) => id === scope.coordinates.cultivarId);
  return (
    <CompactBusinessQuery
      ariaLabel="产情分析查询条件"
      primaryFields={[
        <label key="classification">
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
        </label>,
        <label key="region">
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
        </label>,
        <label key="product">
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
            {productInvalid && (
              <option disabled value={scope.coordinates.productId}>
                产品不可用（请重新选择）
              </option>
            )}
            {authorizedProductionProducts.map(({ id, label }) => (
              <option key={id} value={id}>
                {governedProductionName(productionProductNames, id, label)}
              </option>
            ))}
          </select>
        </label>,
        <label key="period">
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
        </label>,
      ]}
      moreFields={[
        <label key="cultivar">
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
            <option value="">
              {scope.coordinates.productId
                ? "全部适用品种"
                : "请先选择产品或作物"}
            </option>
            {cultivarInvalid && (
              <option disabled value={scope.coordinates.cultivarId}>
                品种不适用于当前产品（请重新选择）
              </option>
            )}
            {applicableCultivars.map(({ id, label }) => (
              <option key={id} value={id}>
                {governedProductionName(productionCultivarNames, id, label)}
              </option>
            ))}
          </select>
        </label>,
        <label key="data-layer">
          <span>数据状态</span>
          <select
            aria-label="数据状态"
            value={scope.coordinates.dataLayer ?? ""}
            onChange={(event) =>
              onScopeChange({
                dataLayer: (event.target.value ||
                  undefined) as BusinessCoordinates["dataLayer"],
                selectedMetricId: undefined,
              })
            }
          >
            <option value="">请选择数据状态</option>
            {productionAnalysisCoordinateOptions.dataLayers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>,
        <label key="release-version">
          <span>采用数据</span>
          <select
            aria-label="采用数据"
            value={scope.coordinates.releaseVersion ?? ""}
            onChange={(event) =>
              onScopeChange({
                releaseVersion: event.target.value || undefined,
                selectedMetricId: undefined,
              })
            }
          >
            <option value="">请选择采用的已核定数据</option>
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
        </label>,
      ]}
      actions={
        <>
          <button className="is-primary" type="button">
            查询
          </button>
          <button
            type="button"
            onClick={() =>
              onScopeChange({
                regionId: "authorized-all",
                businessSubtypeId: undefined,
                productId: undefined,
                cultivarId: undefined,
                periodKey: undefined,
                dataLayer: undefined,
                releaseVersion: undefined,
                selectedMetricId: undefined,
              })
            }
          >
            重置
          </button>
        </>
      }
    />
  );
}

export function ProductionAnalysisWorkspace({
  scope,
  onScopeChange,
  queryAllowed,
  onComposeReport,
}: {
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  queryAllowed: boolean;
  onComposeReport: (context: BusinessReportContext) => void;
}) {
  const year = currentYear(scope.coordinates.periodKey);
  const completeCoordinates =
    year !== null &&
    scope.coordinates.productId !== undefined &&
    scope.coordinates.dataLayer === "official" &&
    scope.coordinates.releaseVersion !== undefined;
  const { metrics, unavailableMetrics, unmappedVersion } = useMemo(() => {
    if (!completeCoordinates || year === null)
      return {
        metrics: [] as GovernedMetric[],
        unavailableMetrics: [] as UnavailableMetric[],
        unmappedVersion: false,
      };
    let missingGovernance = false;
    const available: GovernedMetric[] = [];
    const unavailable: UnavailableMetric[] = [];
    const results = queryPrototypeMetricComparisons({
      scope,
      queryAllowed,
      domain: "production",
      currentYear: year,
      businessSubtype: scope.coordinates.businessSubtypeId as never,
    });
    for (const result of results) {
      if (result.status === "no-release") {
        const definition = enterpriseMetricDefinitions.find(
          ({ metricId }) => metricId === result.metricId,
        );
        if (!definition) {
          missingGovernance = true;
          continue;
        }
        unavailable.push({
          metricId: definition.metricId,
          label: definition.label,
          businessClassificationLabel:
            businessClassifications.find(
              ({ id }) => id === definition.businessSubtype,
            )?.label ?? "业务分类待维护",
          reason: unavailableReason(result.reason),
        });
        continue;
      }
      const rawModel = createMetricComparisonViewModel(
        result.definition,
        result.comparison,
      );
      const model = localizedModel(rawModel);
      if (!model) {
        missingGovernance = true;
        unavailable.push({
          metricId: result.definition.metricId,
          label: result.definition.label,
          businessClassificationLabel:
            businessClassifications.find(
              ({ id }) => id === result.definition.businessSubtype,
            )?.label ?? "业务分类待维护",
          reason: "采用数据名称尚未完成业务确认",
        });
        continue;
      }
      const current = result.comparison.points[3];
      if (current.availability !== "available") {
        unavailable.push({
          metricId: result.definition.metricId,
          label: result.definition.label,
          businessClassificationLabel:
            businessClassifications.find(
              ({ id }) => id === result.definition.businessSubtype,
            )?.label ?? "业务分类待维护",
          reason: "当前年度数据尚未完成核定",
        });
        continue;
      }
      available.push({
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
          ] ?? "采用数据名称待维护",
        definitionLabel: `${result.definition.label}${productionMetricGovernanceLabels.definitionEdition}`,
        comparabilityLabel:
          productionMetricGovernanceLabels.comparabilityEdition,
      });
    }
    return {
      metrics: available,
      unavailableMetrics: unavailable,
      unmappedVersion: missingGovernance,
    };
  }, [completeCoordinates, queryAllowed, scope, year]);
  const selected = metrics.find(
    ({ model }) => model.metricId === scope.coordinates.selectedMetricId,
  );
  const invalidSelectedMetric =
    scope.coordinates.selectedMetricId !== undefined && selected === undefined;
  const reportClassification = businessClassifications.find(
    ({ domain, id }) =>
      domain === "production" &&
      id === scope.coordinates.businessSubtypeId &&
      scope.authorization.authorizedBusinessClassificationIds.includes(id),
  );
  const reportRegion =
    scope.coordinates.regionId !== "authorized-all" &&
    scope.authorization.authorizedRegionIds.includes(
      scope.coordinates
        .regionId as (typeof scope.authorization.authorizedRegionIds)[number],
    )
      ? getEnterpriseScopeRegion(scope.coordinates.regionId)
      : undefined;
  const reportProduct =
    scope.coordinates.productId &&
    scope.authorization.authorizedProductIds.includes(
      scope.coordinates.productId,
    )
      ? productionProductNames[scope.coordinates.productId]
      : undefined;
  const selectedReportCultivar =
    scope.coordinates.productId &&
    scope.coordinates.cultivarId &&
    scope.authorization.authorizedCultivarIds.includes(
      scope.coordinates.cultivarId,
    ) &&
    getApplicableCultivars(scope.coordinates.productId).some(
      ({ id }) => id === scope.coordinates.cultivarId,
    )
      ? productionCultivarNames[scope.coordinates.cultivarId]
      : undefined;
  const reportCultivar = selectedReportCultivar ?? "不按具体品种拆分";
  const reportPeriod = scope.coordinates.periodKey
    ? productionReportPeriodByAnalysisPeriod[scope.coordinates.periodKey]
    : undefined;
  const reportTemplate = reportClassification
    ? productionReportTemplateByClassification[reportClassification.id]
    : undefined;
  const metricReleaseVersionId = scope.coordinates.releaseVersion;
  const reportCoordinatesComplete = Boolean(
    reportClassification &&
    reportRegion &&
    reportProduct &&
    reportCultivar &&
    reportPeriod &&
    reportTemplate &&
    metricReleaseVersionId &&
    scope.coordinates.dataLayer === "official",
  );
  const canDraftReport =
    scope.authorization.permissionKeys.includes("report.draft.save");
  const approvedReportDataset =
    queryAllowed &&
    reportClassification &&
    reportRegion &&
    reportProduct &&
    reportCultivar &&
    reportPeriod &&
    reportTemplate &&
    metricReleaseVersionId &&
    scope.coordinates.dataLayer === "official"
      ? findApprovedBusinessReportDatasetByMetricRelease({
          application: "production",
          businessClassificationId: reportClassification.id,
          region: reportRegion.label,
          product: reportProduct,
          cultivar: reportCultivar,
          reportTemplate,
          period: reportPeriod,
          frequency: "周报",
          metricReleaseVersionId,
        })
      : null;
  const quickReportRequest: BusinessReportRequest | null =
    approvedReportDataset && reportRegion && scope.coordinates.productId
      ? {
          reportType: "产情报告",
          regionId: reportRegion.id,
          productId: scope.coordinates.productId,
          cultivarId: scope.coordinates.cultivarId ?? null,
          periodKey: approvedReportDataset.period,
          frequency: "周",
          cutoff: approvedReportDataset.dataCutoff,
          approvedDatasetId: approvedReportDataset.dataBatchId,
          sectionKeys: approvedReportDataset.chapters.map(({ title }) => title),
        }
      : null;
  const reportUnavailableReason = !queryAllowed
    ? "当前筛选范围超出您的数据权限，无法编制报告。"
    : !canDraftReport
      ? "当前登录岗位没有编制业务报告的权限。"
      : scope.coordinates.dataLayer !== "official"
        ? "只有已核定数据可用于编制报告。"
        : !reportCoordinatesComplete
          ? "请选择具体业务地区、业务分类、产品、品种口径、分析期间和采用数据后编制报告。"
          : !approvedReportDataset
            ? "当前地区、业务分类、产品、具体品种、期间和采用数据尚无完全匹配的已核定报告数据，系统未改用其他范围。"
            : null;
  const composeReport = () => {
    if (
      !canDraftReport ||
      !approvedReportDataset ||
      !reportClassification ||
      !reportRegion
    )
      return;
    onComposeReport({
      application: "production",
      applicationLabel: "产情监测",
      businessClassificationId: approvedReportDataset.businessClassificationId,
      businessClassificationLabel: reportClassification.label,
      product: approvedReportDataset.product,
      cultivar: approvedReportDataset.cultivar,
      reportTemplate: approvedReportDataset.reportTemplate,
      region: approvedReportDataset.region,
      regionLevel: reportRegion.level,
      period: approvedReportDataset.period,
      frequency: approvedReportDataset.frequency,
      dataCutoff: approvedReportDataset.dataCutoff,
      dataVersion: approvedReportDataset.dataBatchId,
      dataBatchLabel: approvedReportDataset.dataBatchLabel,
      author: scope.identity.displayName ?? "当前登录人员",
      authorPost: "区域数据管理员",
      reviewer: "赵晨",
      reviewerPost: "报告复核岗",
    });
  };
  return (
    <div className="unified-workspace production-task5-workspace">
      <WorkspaceHeader
        actions={
          <div className="workspace-header-report-actions">
            <button
              aria-describedby={
                reportUnavailableReason
                  ? "production-report-unavailable-reason"
                  : undefined
              }
              className="is-primary"
              disabled={!canDraftReport || !approvedReportDataset}
              type="button"
              onClick={composeReport}
            >
              按当前范围编制报告
            </button>
            <QuickReportExportMenu
              exportAllowed={scope.authorization.permissionKeys.includes(
                "report.export",
              )}
              request={quickReportRequest}
            />
          </div>
        }
        eyebrow="产情监测 / 监测分析"
        title="产情监测分析"
        summary="只读取官方已发布指标，按当前期与前三年同口径比较，并在选择指标后展开图表。"
      />
      {reportUnavailableReason && (
        <p
          className="production-task5-contract-context"
          id="production-report-unavailable-reason"
        >
          {reportUnavailableReason}
        </p>
      )}
      <AnalysisFilters onScopeChange={onScopeChange} scope={scope} />
      {!queryAllowed && (
        <div className="production-task5-alert" role="alert">
          当前筛选范围超出您的数据权限，系统未展示其他分析结果。
        </div>
      )}
      {!completeCoordinates && (
        <div className="production-task5-empty" role="status">
          请选择产品或作物、分析期间、数据状态和采用数据后查询。
        </div>
      )}
      {unmappedVersion && (
        <div className="production-task5-alert" role="alert">
          采用数据名称待维护，相关指标已停止展示且没有改用其他数据。
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
        <header>
          <div>
            <h2>四年指标对比台账</h2>
            <p>当前期、前三年、相邻同比和长期趋势采用同一统计口径</p>
          </div>
          <strong>{metrics.length} 项</strong>
        </header>
        <div
          aria-label="产情四年指标台账横向滚动区域"
          className="production-task5-ledger-scroll"
          tabIndex={0}
        >
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
                <th scope="col">四年指标值</th>
                <th scope="col">相邻同比</th>
                <th scope="col">当前较前三年</th>
                <th scope="col">数据依据</th>
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
                  <td>
                    <details className="production-task5-evidence-details">
                      <summary>查看数据依据</summary>
                      <dl>
                        <div>
                          <dt>三年复合增长率</dt>
                          <dd>{metric.model.cagrText}</dd>
                        </div>
                        <div>
                          <dt>来源与质量</dt>
                          <dd>
                            {productionMetricGovernanceLabels.source} ·{" "}
                            {metric.coverage} · {metric.quality}
                          </dd>
                        </div>
                        <div>
                          <dt>数据截止</dt>
                          <dd>{metric.cutoff}</dd>
                        </div>
                        <div>
                          <dt>采用数据</dt>
                          <dd>{metric.sourceVersionLabel}</dd>
                        </div>
                      </dl>
                    </details>
                  </td>
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
        {queryAllowed &&
          completeCoordinates &&
          metrics.length === 0 &&
          !unmappedVersion && (
            <div className="production-task5-empty" role="status">
              当前条件下暂无四年可比指标。指标目录及未达到比较条件的原因可在下方查看。
            </div>
          )}
        {queryAllowed &&
          completeCoordinates &&
          unavailableMetrics.length > 0 && (
            <details className="production-task5-availability-register">
              <summary>
                查看 {unavailableMetrics.length} 项暂不可比指标及原因
              </summary>
              <p>
                以下指标仍保留在业务目录中；在连续四个年度数据全部核定前，不计算同比或趋势。
              </p>
              <div className="production-task5-availability-scroll">
                <table aria-label="产情暂不可比指标目录">
                  <thead>
                    <tr>
                      <th scope="col">指标</th>
                      <th scope="col">业务分类</th>
                      <th scope="col">当前状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unavailableMetrics.map((metric) => (
                      <tr key={metric.metricId}>
                        <th scope="row">{metric.label}</th>
                        <td>{metric.businessClassificationLabel}</td>
                        <td>{metric.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
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
          <aside
            aria-label="统计口径与数据来源"
            className="production-task5-lineage"
          >
            <h2>统计口径与数据来源</h2>
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
                <dt>统计公式</dt>
                <dd>
                  {selected.definitionLabel} · {selected.formula}
                </dd>
              </div>
              <div>
                <dt>可比性</dt>
                <dd>
                  {selected.comparabilityLabel} ·{" "}
                  {selected.model.comparabilityText}
                </dd>
              </div>
              <div>
                <dt>采用数据</dt>
                <dd>{selected.sourceVersionLabel}</dd>
              </div>
            </dl>
          </aside>
        </section>
      )}
    </div>
  );
}
