import { useCallback, useEffect, useState } from "react";

import type {
  CurrentSession,
  RealtimeBusinessRepository,
  SampleNetworkComparison,
} from "@/platform/api/realtimeBusinessRepository";
import { WorkspaceHeader } from "../UnifiedWorkspacePrimitives";
import { AnnualSampleNetworkPanel } from "./AnnualSampleNetworkPanel";
import { DesignSamplePointTable } from "./DesignSamplePointTable";
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

const DESIGN_DATASET_AGGREGATE_TYPE = "DESIGN_COORDINATE_DATASET";
const DESIGN_DATASET_CLEANUP_ACTION =
  "LEGACY_VILLAGE_DESIGN_COORDINATES_DELETED";
const DESIGN_DATASET_REFRESH_DEBOUNCE_MS = 500;
const DESIGN_POINT_AGGREGATE_TYPE = "DESIGN_SAMPLE_POINT";
const DESIGN_POINT_ACTIONS = new Set([
  "DESIGN_SAMPLE_POINT_CREATED",
  "DESIGN_SAMPLE_POINT_UPDATED",
  "DESIGN_SAMPLE_POINT_DELETED",
]);

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
      "设计参考点不随年份变化；按业务对象维护点位、行政区、坐标和适用信息，当前数量以清单实时结果为准。",
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
  initialModule = "registry",
  mode = "all",
  refreshSequence = 0,
  refreshSequenceByYear = {},
  repository,
  session,
}: {
  currentYear?: number;
  initialModule?: GovernanceModule;
  mode?: "all" | "design";
  refreshSequence?: number;
  refreshSequenceByYear?: Readonly<Record<number, number>>;
  repository: RealtimeBusinessRepository;
  session: CurrentSession;
}) {
  const [activeModule, setActiveModule] = useState<GovernanceModule>(
    mode === "design" ? "design" : initialModule,
  );
  const [reviewModule, setReviewModule] = useState<ReviewModule>("coordinate");
  const [year, setYear] = useState(currentYear);
  const [comparison, setComparison] = useState<SampleNetworkComparison>();
  const [comparisonState, setComparisonState] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");
  const [designDatasetRefreshSequence, setDesignDatasetRefreshSequence] =
    useState(0);
  const [designPointTotal, setDesignPointTotal] = useState<number>();
  const [designPointState, setDesignPointState] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");
  const selectedYearRefreshSequence =
    refreshSequence + (refreshSequenceByYear[year] ?? 0);
  const comparisonRefreshSequence =
    selectedYearRefreshSequence + designDatasetRefreshSequence;
  const handleDesignListStateChange = useCallback(
    (state: "loading" | "ready" | "unavailable", total: number | undefined) => {
      setDesignPointState(state);
      setDesignPointTotal(total);
    },
    [],
  );

  useEffect(() => {
    if (!repository.subscribeBusinessEvents) return undefined;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = repository.subscribeBusinessEvents(0, (event) => {
      const designDatasetChanged =
        event.aggregateType === DESIGN_DATASET_AGGREGATE_TYPE &&
        event.actionCode === DESIGN_DATASET_CLEANUP_ACTION;
      const designPointChanged =
        event.aggregateType === DESIGN_POINT_AGGREGATE_TYPE &&
        DESIGN_POINT_ACTIONS.has(event.actionCode);
      if (!designDatasetChanged && !designPointChanged) {
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
        title={mode === "design" ? "设计样本点" : "样本点管理"}
        summary={
          mode === "design"
            ? "维护不随年份变化的业务对象点位、行政区、坐标和适用信息；数量以清单实时结果为准。"
            : "分别维护稳定样本身份、年度启用关系和设计参考基准；治理变更独立审核并全程留痕。"
        }
      />

      {mode === "all" ? (
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
      ) : null}

      <div className="sample-point-governance-workspace__context">
        <strong>{moduleGuidance[activeModule].title}</strong>
        <span>{moduleGuidance[activeModule].description}</span>
        {activeModule === "annual" && (
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
            value={summaryValue(designPointState, designPointTotal)}
          />
        </dl>
      ) : null}

      <section
        aria-label={mode === "design" ? "设计样本点台账" : undefined}
        aria-labelledby={
          mode === "all" ? `sample-governance-tab-${activeModule}` : undefined
        }
        className="sample-point-governance-workspace__main"
        id={`sample-governance-${activeModule}`}
        role={mode === "all" ? "tabpanel" : "region"}
      >
        {activeModule === "registry" ? (
          <SamplePointIdentityGovernancePanel
            mode="manage"
            repository={repository}
          />
        ) : null}
        {activeModule === "design" ? (
          <DesignSamplePointTable
            onListStateChange={handleDesignListStateChange}
            refreshSequence={designDatasetRefreshSequence}
            repository={repository}
            session={session}
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
