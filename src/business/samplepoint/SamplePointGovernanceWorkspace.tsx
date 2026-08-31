import { useEffect, useMemo, useState } from "react";

import type {
  CurrentSession,
  RealtimeBusinessRepository,
  SampleNetworkComparison,
  SampleNetworkDesignPoint,
} from "@/platform/api/realtimeBusinessRepository";
import { WorkspaceHeader } from "../UnifiedWorkspacePrimitives";
import { AnnualSampleNetworkPanel } from "./AnnualSampleNetworkPanel";
import { SamplePointCoordinateGovernancePanel } from "./SamplePointCoordinateGovernancePanel";
import { SamplePointIdentityGovernancePanel } from "./SamplePointIdentityGovernancePanel";

import "./sample-point-governance-workspace.css";

type GovernanceModule = "registry" | "design" | "annual" | "review";
type ReviewModule = "coordinate" | "identity-import" | "identity-merge";

const modules = [
  ["registry", "样本点名册"],
  ["annual", "年度样本"],
  ["design", "设计参考点"],
  ["review", "变更与审核"],
] as const satisfies readonly (readonly [GovernanceModule, string])[];

const DESIGN_REFERENCE_PAGE_SIZE = 50;
const DESIGN_DATASET_AGGREGATE_TYPE = "DESIGN_COORDINATE_DATASET";
const DESIGN_DATASET_CLEANUP_ACTION =
  "LEGACY_VILLAGE_DESIGN_COORDINATES_DELETED";
const DESIGN_DATASET_REFRESH_DEBOUNCE_MS = 500;
const EMPTY_DESIGN_POINTS: readonly SampleNetworkDesignPoint[] = [];

const moduleGuidance: Readonly<
  Record<GovernanceModule, { title: string; description: string }>
> = {
  registry: {
    title: "样本点名册",
    description:
      "每个真实样本点只建立一次稳定身份；月份填报只增加业务记录，不重复创建样本点。",
  },
  design: {
    title: "设计参考点",
    description:
      "行政村设计参考点不随年份变化，仅用于与年度现有样本进行覆盖对照；当前数量以清单实时结果为准。",
  },
  annual: {
    title: "年度样本",
    description:
      "从 2026 年开始逐年确认当年实际使用名单；沿用上年只复制成员关系，不复制业务数据。",
  },
  review: {
    title: "变更与审核",
    description:
      "按治理类型查看变更申请，完成授权范围内的独立审核并保留处理结果。",
  },
};

export function SamplePointGovernanceWorkspace({
  currentYear = new Date().getFullYear(),
  refreshSequence = 0,
  refreshSequenceByYear = {},
  repository,
  session,
}: {
  currentYear?: number;
  refreshSequence?: number;
  refreshSequenceByYear?: Readonly<Record<number, number>>;
  repository: RealtimeBusinessRepository;
  session: CurrentSession;
}) {
  const [activeModule, setActiveModule] =
    useState<GovernanceModule>("registry");
  const [reviewModule, setReviewModule] = useState<ReviewModule>("coordinate");
  const [year, setYear] = useState(currentYear);
  const [comparison, setComparison] = useState<SampleNetworkComparison>();
  const [comparisonState, setComparisonState] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");
  const [designDatasetRefreshSequence, setDesignDatasetRefreshSequence] =
    useState(0);
  const selectedYearRefreshSequence =
    refreshSequence + (refreshSequenceByYear[year] ?? 0);
  const comparisonRefreshSequence =
    selectedYearRefreshSequence + designDatasetRefreshSequence;

  useEffect(() => {
    if (!repository.subscribeBusinessEvents) return undefined;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = repository.subscribeBusinessEvents(0, (event) => {
      if (
        event.aggregateType !== DESIGN_DATASET_AGGREGATE_TYPE ||
        event.actionCode !== DESIGN_DATASET_CLEANUP_ACTION
      ) {
        return;
      }
      if (refreshTimer !== undefined) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = undefined;
        setDesignDatasetRefreshSequence((current) => current + 1);
      }, DESIGN_DATASET_REFRESH_DEBOUNCE_MS);
    });
    return () => {
      if (refreshTimer !== undefined) clearTimeout(refreshTimer);
      unsubscribe();
    };
  }, [repository]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setComparisonState("loading");
    });
    if (!repository.getSampleNetworkComparison) {
      queueMicrotask(() => {
        if (active) {
          setComparison(undefined);
          setComparisonState("unavailable");
        }
      });
      return () => {
        active = false;
      };
    }
    void repository
      .getSampleNetworkComparison(year)
      .then((next) => {
        if (!active) return;
        setComparison(next);
        setComparisonState("ready");
      })
      .catch(() => {
        if (!active) return;
        setComparison(undefined);
        setComparisonState("unavailable");
      });
    return () => {
      active = false;
    };
  }, [comparisonRefreshSequence, repository, year]);

  return (
    <main
      aria-label="样本点管理工作台"
      className="sample-point-governance-workspace"
      data-layout="ledger-workbench"
    >
      <WorkspaceHeader
        eyebrow="平台运营管理部 / 数据治理"
        title="样本点管理"
        summary="分别维护稳定样本身份、年度启用关系和设计参考基准；治理变更独立审核并全程留痕。"
      />

      <nav
        aria-label="样本点治理模块"
        className="sample-point-governance-workspace__tabs"
        role="tablist"
      >
        {modules.map(([module, label]) => (
          <button
            aria-controls={`sample-governance-${module}`}
            aria-selected={activeModule === module}
            id={`sample-governance-tab-${module}`}
            key={module}
            onClick={() => setActiveModule(module)}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="sample-point-governance-workspace__context">
        <strong>{moduleGuidance[activeModule].title}</strong>
        <span>{moduleGuidance[activeModule].description}</span>
        {(activeModule === "annual" || activeModule === "design") && (
          <span className="sample-point-governance-workspace__context-year">
            管理年度：{year}年
          </span>
        )}
      </div>

      {activeModule === "annual" ? (
        <dl
          aria-label="年度样本概况"
          className="sample-point-governance-workspace__status-line"
          role="status"
        >
          <Status
            label={`${year}年度样本`}
            value={summaryValue(
              comparisonState,
              comparison?.activeSamplePointCount,
            )}
          />
          <Status
            label="对照异常"
            value={summaryValue(comparisonState, comparison?.anomalyCount)}
          />
        </dl>
      ) : null}
      {activeModule === "design" ? (
        <dl
          aria-label="设计参考点概况"
          className="sample-point-governance-workspace__status-line"
          role="status"
        >
          <Status
            label="设计参考点"
            value={summaryValue(comparisonState, comparison?.designPointCount)}
          />
          <Status
            label="待权威坐标核验"
            value={summaryValue(
              comparisonState,
              comparison?.pendingVerificationDesignPointCount,
            )}
          />
          <Status
            label="对照异常"
            value={summaryValue(comparisonState, comparison?.anomalyCount)}
          />
        </dl>
      ) : null}

      <section
        aria-labelledby={`sample-governance-tab-${activeModule}`}
        className="sample-point-governance-workspace__main"
        id={`sample-governance-${activeModule}`}
        role="tabpanel"
      >
        {activeModule === "registry" ? (
          <SamplePointIdentityGovernancePanel
            mode="manage"
            repository={repository}
          />
        ) : null}
        {activeModule === "design" ? (
          <DesignReferenceTable
            comparison={comparison}
            state={comparisonState}
            year={year}
          />
        ) : null}
        {activeModule === "annual" ? (
          <AnnualSampleNetworkPanel
            currentYear={currentYear}
            onSelectedYearChange={setYear}
            refreshSequence={selectedYearRefreshSequence}
            repository={repository}
            selectedYear={year}
            session={session}
          />
        ) : null}
        {activeModule === "review" ? (
          <>
            <div
              aria-label="审核业务类型"
              className="sample-point-governance-workspace__review-switch"
              role="group"
            >
              {(
                [
                  ["coordinate", "坐标修正"],
                  ["identity-import", "新导入身份"],
                  ["identity-merge", "历史身份归并"],
                ] as const
              ).map(([module, label]) => (
                <button
                  aria-pressed={reviewModule === module}
                  key={module}
                  onClick={() => setReviewModule(module)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            {reviewModule === "coordinate" ? (
              <SamplePointCoordinateGovernancePanel
                mode="review"
                repository={repository}
              />
            ) : null}
            {reviewModule === "identity-import" ? (
              <SamplePointIdentityGovernancePanel
                mode="import-review"
                repository={repository}
              />
            ) : null}
            {reviewModule === "identity-merge" ? (
              <SamplePointIdentityGovernancePanel
                mode="merge-review"
                repository={repository}
              />
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function summaryValue(
  state: "loading" | "ready" | "unavailable",
  value: number | undefined,
) {
  if (state === "loading") return "同步中";
  if (state === "unavailable" || value === undefined) return "不可用";
  return `${value} 个`;
}

function DesignReferenceTable({
  comparison,
  state,
  year,
}: {
  comparison: SampleNetworkComparison | undefined;
  state: "loading" | "ready" | "unavailable";
  year: number;
}) {
  const [query, setQuery] = useState("");
  const [countyCode, setCountyCode] = useState("");
  const [townshipCode, setTownshipCode] = useState("");
  const [verification, setVerification] = useState<"" | "APPROVED" | "PENDING">(
    "",
  );
  const [page, setPage] = useState(1);
  const designPoints = comparison?.designPoints ?? EMPTY_DESIGN_POINTS;
  const countyOptions = useMemo(
    () =>
      uniqueRegionOptions(
        designPoints.map(
          (point) => [point.countyRegionCode, point.countyName] as const,
        ),
      ),
    [designPoints],
  );
  const townshipOptions = useMemo(
    () =>
      uniqueRegionOptions(
        designPoints
          .filter((point) => point.countyRegionCode === countyCode)
          .map(
            (point) => [point.townshipRegionCode, point.townshipName] as const,
          ),
      ),
    [countyCode, designPoints],
  );
  const filteredPoints = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("zh-CN");
    return designPoints.filter((point) => {
      const matchesQuery =
        !term ||
        [point.villageName, point.townshipName, point.countyName].some(
          (value) => value.toLocaleLowerCase("zh-CN").includes(term),
        );
      const authorityApproved =
        point.coordinateReviewStatus === "AUTHORITY_APPROVED";
      return (
        matchesQuery &&
        (!countyCode || point.countyRegionCode === countyCode) &&
        (!townshipCode || point.townshipRegionCode === townshipCode) &&
        (!verification ||
          (verification === "APPROVED"
            ? authorityApproved
            : !authorityApproved))
      );
    });
  }, [countyCode, designPoints, query, townshipCode, verification]);
  const pageCount = Math.max(
    1,
    Math.ceil(filteredPoints.length / DESIGN_REFERENCE_PAGE_SIZE),
  );
  const currentPage = Math.min(page, pageCount);
  const visiblePoints = filteredPoints.slice(
    (currentPage - 1) * DESIGN_REFERENCE_PAGE_SIZE,
    currentPage * DESIGN_REFERENCE_PAGE_SIZE,
  );

  if (state === "loading") return <p role="status">正在读取设计参考点清单…</p>;
  if (state === "unavailable" || !comparison) {
    return <p role="alert">设计参考点清单暂不可用，请稍后重试。</p>;
  }
  return (
    <div className="sample-point-governance-workspace__table-region">
      <header>
        <div>
          <h2>设计参考点清单</h2>
          <p>
            设计点不属于{year}
            年度业务数据；年度仅用于读取当前对照结果。未经权威核验的候选坐标不会作为地图精确点。
          </p>
        </div>
        <strong>{comparison.designPointCount} 个行政村</strong>
      </header>
      <div
        aria-label="设计参考点台账工具栏"
        className="sample-point-governance-workspace__toolbar"
        role="toolbar"
      >
        <form
          aria-label="设计参考点筛选"
          className="sample-point-governance-workspace__filters"
          onSubmit={(event) => event.preventDefault()}
          role="search"
        >
          <label className="sample-point-governance-workspace__filter-query">
            <span>关键词</span>
            <input
              aria-label="搜索行政村、乡镇或区县"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="搜索行政村、乡镇或区县"
              type="search"
              value={query}
            />
          </label>
          <label>
            <span>区县</span>
            <select
              aria-label="所属区县"
              onChange={(event) => {
                setCountyCode(event.target.value);
                setTownshipCode("");
                setPage(1);
              }}
              value={countyCode}
            >
              <option value="">全部区县</option>
              {countyOptions.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {countyCode ? (
            <label>
              <span>乡镇</span>
              <select
                aria-label="所属乡镇"
                onChange={(event) => {
                  setTownshipCode(event.target.value);
                  setPage(1);
                }}
                value={townshipCode}
              >
                <option value="">全部乡镇</option>
                {townshipOptions.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            <span>核验状态</span>
            <select
              aria-label="坐标核验状态"
              onChange={(event) => {
                setVerification(
                  event.target.value as "" | "APPROVED" | "PENDING",
                );
                setPage(1);
              }}
              value={verification}
            >
              <option value="">全部状态</option>
              <option value="APPROVED">权威核验通过</option>
              <option value="PENDING">待权威核验</option>
            </select>
          </label>
          <button
            disabled={!query && !countyCode && !townshipCode && !verification}
            onClick={() => {
              setQuery("");
              setCountyCode("");
              setTownshipCode("");
              setVerification("");
              setPage(1);
            }}
            type="button"
          >
            清除筛选
          </button>
        </form>
      </div>
      <div
        aria-label="设计参考点滚动清单"
        className="sample-point-governance-workspace__table-scroll sample-point-governance-workspace__table-scroll--bounded"
        role="region"
        tabIndex={0}
      >
        <table aria-label="设计参考点清单">
          <thead>
            <tr>
              <th>行政村</th>
              <th>所属乡镇 / 区县</th>
              <th>坐标来源</th>
              <th>核验状态</th>
              <th>地图展示</th>
            </tr>
          </thead>
          <tbody>
            {visiblePoints.map((point) => (
              <DesignReferenceRow key={point.villageRegionCode} point={point} />
            ))}
            {visiblePoints.length === 0 ? (
              <tr>
                <td colSpan={5}>没有符合当前筛选条件的设计参考点。</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <nav
        aria-label="设计参考点分页"
        className="sample-point-governance-workspace__pagination"
      >
        <span>
          共 {filteredPoints.length} 条 · 第 {currentPage} / {pageCount} 页
        </span>
        <div>
          <button
            disabled={currentPage === 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            type="button"
          >
            上一页
          </button>
          <button
            disabled={currentPage === pageCount}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
            type="button"
          >
            下一页
          </button>
        </div>
      </nav>
    </div>
  );
}

function uniqueRegionOptions(
  options: ReadonlyArray<readonly [string, string]>,
) {
  return [...new Map(options).entries()].sort((left, right) =>
    left[1].localeCompare(right[1], "zh-CN"),
  );
}

function DesignReferenceRow({ point }: { point: SampleNetworkDesignPoint }) {
  const authorityApproved =
    point.coordinateReviewStatus === "AUTHORITY_APPROVED";
  return (
    <tr>
      <td>{point.villageName}</td>
      <td>
        {point.townshipName} / {point.countyName}
      </td>
      <td>{point.coordinateSourceName?.trim() || "未登记权威来源"}</td>
      <td>{authorityApproved ? "权威核验通过" : "待权威核验"}</td>
      <td>{authorityApproved ? "可显示精确位置" : "仅显示行政村覆盖标识"}</td>
    </tr>
  );
}
