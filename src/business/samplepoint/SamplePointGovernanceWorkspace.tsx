import { useEffect, useState } from "react";

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
  ["registry", "稳定样本点"],
  ["design", "设计样本"],
  ["annual", "年度在网样本"],
  ["review", "审核队列"],
] as const satisfies readonly (readonly [GovernanceModule, string])[];

export function SamplePointGovernanceWorkspace({
  currentYear = new Date().getFullYear(),
  refreshSequence = 0,
  repository,
  session,
}: {
  currentYear?: number;
  refreshSequence?: number;
  repository: RealtimeBusinessRepository;
  session: CurrentSession;
}) {
  const [activeModule, setActiveModule] = useState<GovernanceModule>("annual");
  const [reviewModule, setReviewModule] = useState<ReviewModule>("coordinate");
  const [year, setYear] = useState(currentYear);
  const [comparison, setComparison] = useState<SampleNetworkComparison>();
  const [comparisonState, setComparisonState] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");

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
  }, [refreshSequence, repository, year]);

  return (
    <main className="sample-point-governance-workspace">
      <WorkspaceHeader
        eyebrow="平台运营管理部 / 数据治理"
        title="样本点管理"
        summary="设计参考、稳定身份、年度在网和独立审核分层管理；业务填报记录不在本页复制或改写。"
      />

      <dl
        className="sample-point-governance-workspace__status"
        aria-label="样本网络状态"
      >
        <Status
          label="设计参考点"
          value={summaryValue(comparisonState, comparison?.designPointCount)}
        />
        <Status
          label={`${year}年度在网`}
          value={summaryValue(
            comparisonState,
            comparison?.activeSamplePointCount,
          )}
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
            refreshSequence={refreshSequence}
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
  if (state === "loading") return <p role="status">正在读取设计样本清单…</p>;
  if (state === "unavailable" || !comparison) {
    return <p role="alert">设计样本清单暂不可用，请稍后重试。</p>;
  }
  return (
    <div className="sample-point-governance-workspace__table-region">
      <header>
        <div>
          <h2>设计样本清单</h2>
          <p>
            设计点不属于{year}
            年度业务数据；年度仅用于读取当前对照结果。未经权威核验的候选坐标不会作为地图精确点。
          </p>
        </div>
        <strong>{comparison.designPointCount} 个行政村</strong>
      </header>
      <div className="sample-point-governance-workspace__table-scroll">
        <table aria-label="设计样本清单">
          <thead>
            <tr>
              <th>行政村</th>
              <th>行政区代码</th>
              <th>所属乡镇 / 区县</th>
              <th>坐标来源</th>
              <th>核验状态</th>
              <th>地图展示</th>
            </tr>
          </thead>
          <tbody>
            {comparison.designPoints.map((point) => (
              <DesignReferenceRow key={point.villageRegionCode} point={point} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DesignReferenceRow({ point }: { point: SampleNetworkDesignPoint }) {
  const authorityApproved =
    point.coordinateReviewStatus === "AUTHORITY_APPROVED";
  return (
    <tr>
      <td>{point.villageName}</td>
      <td>{point.villageRegionCode}</td>
      <td>
        {point.townshipName} / {point.countyName}
      </td>
      <td>{point.coordinateSourceName?.trim() || "未登记权威来源"}</td>
      <td>{authorityApproved ? "权威核验通过" : "待权威核验"}</td>
      <td>{authorityApproved ? "可显示精确位置" : "仅显示行政村覆盖标识"}</td>
    </tr>
  );
}
