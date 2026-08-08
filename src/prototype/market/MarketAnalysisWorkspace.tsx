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
import { marketAnalysisCoordinateOptions } from "../marketMonitoringData";
import {
  formatMarketDateTime,
  governedMarketName,
  marketCultivarNames,
  marketCultivarsByProduct,
  marketPriceStatisticLabel,
  marketProductMasterData,
} from "../marketMonitoringModel";
import { WorkspaceHeader } from "../UnifiedWorkspacePrimitives";

interface GovernedMarketMetric {
  model: MetricComparisonViewModel;
  formula: string;
  statisticLabel: string;
  cutoff: string;
  coverage: string;
  quality: string;
  releaseBatchLabel: string;
}

interface UnavailableMarketMetric {
  metricId: string;
  label: string;
  businessClassificationLabel: string;
  reason: string;
}

const marketReportTemplateByClassification: Readonly<Record<string, string>> = {
  "market.quote-trade": "价格与交易监测报告",
};

const marketReportPeriodByAnalysisPeriod: Readonly<Record<string, string>> = {
  "2026-W31": "2026年第31周",
};

function unavailableReason(reason: string): string {
  return reason.includes("批次")
    ? "所选采用数据与当前可用的已核定数据不一致"
    : "当前筛选范围尚未形成连续四个年度的已核定数据";
}

function currentYear(periodKey: string | undefined): number | null {
  const match = /^(\d{4})-W\d+$/.exec(periodKey ?? "");
  return match ? Number(match[1]) : null;
}

function localizedModel(
  model: MetricComparisonViewModel,
): MetricComparisonViewModel {
  return {
    ...model,
    yearCells: model.yearCells.map((cell) => ({
      ...cell,
      releaseVersionLabel: `${String(cell.year)} 年已核定市场数据`,
    })),
  };
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
      domain === "market" &&
      scope.authorization.authorizedBusinessClassificationIds.includes(id),
  );
  const products = marketProductMasterData.filter(({ id }) =>
    scope.authorization.authorizedProductIds.includes(id),
  );
  const cultivars = scope.coordinates.productId
    ? (marketCultivarsByProduct[scope.coordinates.productId] ?? []).filter(
        (id) => scope.authorization.authorizedCultivarIds.includes(id),
      )
    : [];
  const regionInvalid =
    scope.coordinates.regionId !== "authorized-all" &&
    !scope.authorization.authorizedRegionIds.includes(
      scope.coordinates
        .regionId as (typeof scope.authorization.authorizedRegionIds)[number],
    );
  return (
    <CompactBusinessQuery
      ariaLabel="市场分析查询条件"
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
            <option value="">请选择业务分类</option>
            {classifications.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
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
            {regionInvalid && (
              <option disabled value={scope.coordinates.regionId}>
                地区不可用（请重新选择）
              </option>
            )}
            {scope.authorization.authorizedRegionIds.map((id) => (
              <option key={id} value={id}>
                {getEnterpriseScopeRegion(id)?.label ?? "地区名称待维护"}
              </option>
            ))}
          </select>
        </label>,
        <label key="product">
          <span>产品或品类</span>
          <select
            aria-label="产品或品类"
            value={scope.coordinates.productId ?? ""}
            onChange={(event) =>
              onScopeChange({
                productId: event.target.value || undefined,
                cultivarId: undefined,
                selectedMetricId: undefined,
              })
            }
          >
            <option value="">请选择产品或品类</option>
            {products.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
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
            {marketAnalysisCoordinateOptions.periods.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>,
      ]}
      moreFields={[
        <label key="cultivar">
          <span>具体品种</span>
          <select
            aria-label="具体品种"
            disabled={!scope.coordinates.productId}
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
                ? "不限定具体品种"
                : "请先选择产品或品类"}
            </option>
            {cultivars.map((id) => (
              <option key={id} value={id}>
                {governedMarketName(marketCultivarNames, id, "品种名称待维护")}
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
            {marketAnalysisCoordinateOptions.releaseVersions
              .filter(({ id }) =>
                scope.authorization.authorizedReleaseVersionIds.includes(id),
              )
              .map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
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

export function MarketAnalysisWorkspace({
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
  const selectedClassification = businessClassifications.find(
    ({ domain, id }) =>
      domain === "market" &&
      id === scope.coordinates.businessSubtypeId &&
      scope.authorization.authorizedBusinessClassificationIds.includes(id),
  );
  const cultivarMismatch = Boolean(
    scope.coordinates.productId &&
    scope.coordinates.cultivarId &&
    !(marketCultivarsByProduct[scope.coordinates.productId] ?? []).includes(
      scope.coordinates.cultivarId,
    ),
  );
  const completeCoordinates =
    selectedClassification !== undefined &&
    scope.coordinates.productId !== undefined &&
    year !== null &&
    scope.coordinates.releaseVersion !== undefined &&
    !cultivarMismatch;
  const { metrics, unavailableMetrics } = useMemo(() => {
    if (!completeCoordinates || year === null || !selectedClassification) {
      return {
        metrics: [] as GovernedMarketMetric[],
        unavailableMetrics: [] as UnavailableMarketMetric[],
      };
    }
    const available: GovernedMarketMetric[] = [];
    const unavailable: UnavailableMarketMetric[] = [];
    const results = queryPrototypeMetricComparisons({
      scope: {
        ...scope,
        coordinates: { ...scope.coordinates, dataLayer: "official" },
      },
      queryAllowed,
      domain: "market",
      currentYear: year,
      businessSubtype: selectedClassification.id,
    });
    for (const result of results) {
      if (result.status === "no-release") {
        const definition = enterpriseMetricDefinitions.find(
          ({ metricId }) => metricId === result.metricId,
        );
        if (!definition) continue;
        unavailable.push({
          metricId: definition.metricId,
          label: definition.label,
          businessClassificationLabel: selectedClassification.label,
          reason: unavailableReason(result.reason),
        });
        continue;
      }
      const current = result.comparison.points[3];
      if (current.availability !== "available") {
        unavailable.push({
          metricId: result.definition.metricId,
          label: result.definition.label,
          businessClassificationLabel: selectedClassification.label,
          reason: "当前年度数据尚未完成核定",
        });
        continue;
      }
      available.push({
        model: localizedModel(
          createMetricComparisonViewModel(result.definition, result.comparison),
        ),
        formula: result.definition.formula,
        statisticLabel:
          result.definition.measureType === "price"
            ? marketPriceStatisticLabel(result.definition.aggregation)
            : "规范事实按统计口径汇总",
        cutoff: formatMarketDateTime(current.coordinate.period.cutoff),
        coverage: `${current.coverageRate}%`,
        quality:
          current.qualityStatus === "passed" ? "质量通过" : "存在质量提醒",
        releaseBatchLabel: "2026年第31周已核定数据（当前采用）",
      });
    }
    return { metrics: available, unavailableMetrics: unavailable };
  }, [completeCoordinates, queryAllowed, scope, selectedClassification, year]);
  const selected = metrics.find(
    ({ model }) => model.metricId === scope.coordinates.selectedMetricId,
  );
  const invalidSelectedMetric =
    scope.coordinates.selectedMetricId !== undefined && !selected;
  const invalidRegion =
    scope.coordinates.regionId !== "authorized-all" &&
    !scope.authorization.authorizedRegionIds.includes(
      scope.coordinates
        .regionId as (typeof scope.authorization.authorizedRegionIds)[number],
    );
  const reportRegion =
    scope.coordinates.regionId !== "authorized-all" && !invalidRegion
      ? getEnterpriseScopeRegion(scope.coordinates.regionId)
      : undefined;
  const reportProduct = scope.coordinates.productId
    ? marketProductMasterData.find(
        ({ id }) => id === scope.coordinates.productId,
      )?.label
    : undefined;
  const selectedReportCultivar =
    scope.coordinates.productId &&
    scope.coordinates.cultivarId &&
    scope.authorization.authorizedCultivarIds.includes(
      scope.coordinates.cultivarId,
    ) &&
    (marketCultivarsByProduct[scope.coordinates.productId] ?? []).includes(
      scope.coordinates.cultivarId,
    )
      ? marketCultivarNames[scope.coordinates.cultivarId]
      : undefined;
  const reportCultivar = selectedReportCultivar ?? "不按具体品种拆分";
  const reportPeriod = scope.coordinates.periodKey
    ? marketReportPeriodByAnalysisPeriod[scope.coordinates.periodKey]
    : undefined;
  const reportTemplate = selectedClassification
    ? marketReportTemplateByClassification[selectedClassification.id]
    : undefined;
  const metricReleaseVersionId = scope.coordinates.releaseVersion;
  const reportUsesOfficialData =
    scope.coordinates.dataLayer === undefined ||
    scope.coordinates.dataLayer === "official";
  const reportCoordinatesComplete = Boolean(
    selectedClassification &&
    reportRegion &&
    reportProduct &&
    reportCultivar &&
    reportPeriod &&
    reportTemplate &&
    metricReleaseVersionId &&
    reportUsesOfficialData,
  );
  const canDraftReport =
    scope.authorization.permissionKeys.includes("report.draft.save");
  const approvedReportDataset =
    queryAllowed &&
    selectedClassification &&
    reportRegion &&
    reportProduct &&
    reportCultivar &&
    reportPeriod &&
    reportTemplate &&
    metricReleaseVersionId &&
    reportUsesOfficialData
      ? findApprovedBusinessReportDatasetByMetricRelease({
          application: "market",
          businessClassificationId: selectedClassification.id,
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
          reportType: "市场报告",
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
      : !reportUsesOfficialData
        ? "只有正式发布数据可用于编制报告。"
        : !reportCoordinatesComplete
          ? "请选择具体业务地区、业务分类、产品、品种口径、分析期间和采用数据后编制报告。"
          : !approvedReportDataset
            ? "当前地区、业务分类、产品、具体品种、期间和采用数据尚无完全匹配的已核定报告数据，系统未改用其他范围。"
            : null;
  const composeReport = () => {
    if (
      !canDraftReport ||
      !approvedReportDataset ||
      !selectedClassification ||
      !reportRegion
    )
      return;
    onComposeReport({
      application: "market",
      applicationLabel: "市场监测",
      businessClassificationId: approvedReportDataset.businessClassificationId,
      businessClassificationLabel: selectedClassification.label,
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
    <div className="unified-workspace market-task6-workspace">
      <WorkspaceHeader
        actions={
          <div className="workspace-header-report-actions">
            <button
              aria-describedby={
                reportUnavailableReason
                  ? "market-report-unavailable-reason"
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
        eyebrow="市场监测 / 监测分析"
        title="市场监测分析"
        summary="只读取正式发布市场指标，比较当前期与前三年、相邻年度、三个基期和三年复合增长率。"
      />
      {reportUnavailableReason && (
        <p
          className="market-task6-contract-context"
          id="market-report-unavailable-reason"
        >
          {reportUnavailableReason}
        </p>
      )}
      <AnalysisFilters onScopeChange={onScopeChange} scope={scope} />
      {!queryAllowed && (
        <div className="market-task6-alert" role="alert">
          当前筛选范围超出您的数据权限，系统未展示其他分析结果。
        </div>
      )}
      {cultivarMismatch && (
        <div className="market-task6-alert" role="alert">
          具体品种与所选产品不匹配，系统没有回落到其他产品或品种。
        </div>
      )}
      {!completeCoordinates && !cultivarMismatch && (
        <div className="market-task6-empty" role="status">
          请选择业务分类、产品或品类、分析期间和采用数据后查询。
        </div>
      )}
      {invalidSelectedMetric && (
        <div className="market-task6-alert" role="alert">
          所选指标不可用或无权查看，系统未打开其他指标。
        </div>
      )}
      <section
        aria-label="市场四年指标台账区域"
        className="market-task6-ledger-region"
      >
        <header>
          <div>
            <h2>四年可比指标台账</h2>
            <p>只对连续四个年度均已核定且统计口径一致的指标计算同比</p>
          </div>
          <strong>{metrics.length} 项</strong>
        </header>
        <p className="market-task6-scroll-hint">
          表格较宽时，请在表格区域左右滚动查看完整内容。
        </p>
        <div
          aria-label="市场四年指标台账横向滚动区域"
          className="market-task6-ledger-scroll"
          tabIndex={0}
        >
          <table
            aria-label="市场四年指标台账"
            className="market-task6-ledger market-task6-analysis-ledger"
          >
            <thead>
              <tr>
                <th className="market-task6-sticky" scope="col">
                  指标
                </th>
                <th scope="col">当前值</th>
                <th scope="col">当前与前三年</th>
                <th scope="col">年度变化</th>
                <th scope="col">三年复合增长率</th>
                <th scope="col">口径与质量</th>
                <th scope="col">采用数据</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => (
                <tr key={metric.model.metricId}>
                  <th className="market-task6-sticky" scope="row">
                    {metric.model.metricLabel}
                  </th>
                  <td>
                    {metric.model.currentValue} {metric.model.unit}
                  </td>
                  <td>
                    {metric.model.yearCells
                      .map((cell) => `${cell.year}：${cell.valueText}`)
                      .join(" · ")}
                  </td>
                  <td>
                    <span>
                      相邻年度：
                      {metric.model.pairCells
                        .map(
                          ({ label, changeText }) => `${label} ${changeText}`,
                        )
                        .join(" · ")}
                    </span>
                    <span>
                      当前较三个基期：
                      {metric.model.currentVsBaselineSeries
                        .map(
                          ({ label, changeText }) => `${label} ${changeText}`,
                        )
                        .join(" · ")}
                    </span>
                  </td>
                  <td>{metric.model.cagrText}</td>
                  <td>
                    <span>{metric.statisticLabel}</span>
                    <span>
                      正式发布数据 · 覆盖 {metric.coverage} · {metric.quality} ·
                      截止 {metric.cutoff}
                    </span>
                  </td>
                  <td>{metric.releaseBatchLabel}</td>
                  <td>
                    <button
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
        {queryAllowed && completeCoordinates && metrics.length === 0 && (
          <div className="market-task6-empty" role="status">
            <strong>当前条件下暂无四年可比指标</strong>
            <span>
              相关业务指标尚未形成连续四年已核定数据，系统没有改用其他产品、地区或采用数据。
            </span>
          </div>
        )}
        {queryAllowed &&
          completeCoordinates &&
          unavailableMetrics.length > 0 && (
            <details className="market-task6-availability-register">
              <summary>
                查看 {unavailableMetrics.length} 项暂不可比指标及原因
              </summary>
              <p>
                以下指标仍保留在业务目录中；在连续四个年度数据全部核定前，不计算同比或趋势。
              </p>
              <div className="market-task6-availability-scroll">
                <table aria-label="市场暂不可比指标目录">
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
        {invalidRegion && (
          <p className="market-task6-coordinate-note">
            所选地区不在当前授权范围，系统没有回落到其他地区。
          </p>
        )}
      </section>
      {selected && !invalidSelectedMetric && (
        <section
          aria-label={`${selected.model.metricLabel}选中指标分析`}
          className="market-task6-selected-analysis"
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
            className="market-task6-lineage"
          >
            <h2>统计口径与数据来源</h2>
            <dl>
              <div>
                <dt>统计口径</dt>
                <dd>{selected.statisticLabel}</dd>
              </div>
              <div>
                <dt>计算规则</dt>
                <dd>{selected.formula}</dd>
              </div>
              <div>
                <dt>可比规则</dt>
                <dd>{selected.model.comparabilityText}</dd>
              </div>
              <div>
                <dt>采用数据</dt>
                <dd>{selected.releaseBatchLabel}</dd>
              </div>
            </dl>
          </aside>
        </section>
      )}
    </div>
  );
}
