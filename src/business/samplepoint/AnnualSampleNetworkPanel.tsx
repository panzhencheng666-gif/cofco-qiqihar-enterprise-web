import { useEffect, useState } from "react";

import type {
  AnnualSampleNetwork,
  AnnualSampleNetworkMembership,
  CurrentSession,
  RealtimeBusinessRepository,
  SampleNetworkMembershipStatus,
  SampleNetworkRelation,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";

import "./annual-sample-network.css";

const ANNUAL_NETWORK_DISCOVERY_START_YEAR = 2026;
const EMPTY_RELATIONS: readonly SampleNetworkRelation[] = [];

type ComparisonState =
  | { year: number; status: "LOADING" | "UNAVAILABLE" }
  | {
      year: number;
      status: "LOADED";
      relations: readonly SampleNetworkRelation[];
    };

export function AnnualSampleNetworkPanel({
  currentYear = new Date().getFullYear(),
  onSelectedYearChange,
  refreshSequence = 0,
  repository,
  selectedYear,
  session,
}: {
  currentYear?: number;
  onSelectedYearChange?: (year: number) => void;
  refreshSequence?: number;
  repository: RealtimeBusinessRepository;
  selectedYear?: number;
  session: CurrentSession;
}) {
  const [internalYear, setInternalYear] = useState(currentYear);
  const year = selectedYear ?? internalYear;
  const [network, setNetwork] = useState<AnnualSampleNetwork>();
  const [notCreated, setNotCreated] = useState(false);
  const [resolvedYear, setResolvedYear] = useState<number>();
  const [comparison, setComparison] = useState<ComparisonState>();
  const [comparisonRefresh, setComparisonRefresh] = useState(0);
  const [knownYears, setKnownYears] = useState(() => [
    currentYear,
    currentYear + 1,
  ]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [newSamplePointId, setNewSamplePointId] = useState("");
  const [newDesignVillageCode, setNewDesignVillageCode] = useState("");
  const [newRelationType, setNewRelationType] = useState<
    "" | "EXACT_VILLAGE" | "EXPLICIT_REPRESENTATION"
  >("");
  const [newEvidenceReference, setNewEvidenceReference] = useState("");
  const [newReason, setNewReason] = useState("");

  function rememberNetwork(next: AnnualSampleNetwork) {
    setKnownYears((years) =>
      knownYearList([
        ...years,
        next.networkYear,
        ...(next.carriedFromYear ? [next.carriedFromYear] : []),
      ]),
    );
  }

  useEffect(() => {
    let active = true;
    if (!repository.getSampleNetwork) {
      queueMicrotask(() => {
        if (!active) return;
        setNotCreated(false);
        setNetwork(undefined);
        setError("当前运行副本尚未提供年度样本网络接口。");
        setMessage("");
        setResolvedYear(year);
      });
      return () => {
        active = false;
      };
    }
    void repository
      .getSampleNetwork(year)
      .then((next) => {
        if (!active) return;
        setNetwork(next);
        rememberNetwork(next);
        setNotCreated(false);
        setError("");
        setMessage("");
        setResolvedYear(year);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setNetwork(undefined);
        setNotCreated(isNotFound(cause));
        setError(isNotFound(cause) ? "" : actionError(cause));
        setMessage("");
        setResolvedYear(year);
      });
    return () => {
      active = false;
    };
  }, [refreshSequence, repository, year]);

  useEffect(() => {
    let active = true;
    if (!repository.getSampleNetworkComparison) {
      queueMicrotask(() => {
        if (active) setComparison({ year, status: "UNAVAILABLE" });
      });
      return () => {
        active = false;
      };
    }
    queueMicrotask(() => {
      if (active) setComparison({ year, status: "LOADING" });
    });
    void repository
      .getSampleNetworkComparison(year)
      .then((next) => {
        if (active) {
          setComparison({ year, status: "LOADED", relations: next.relations });
        }
      })
      .catch(() => {
        if (active) setComparison({ year, status: "UNAVAILABLE" });
      });
    return () => {
      active = false;
    };
  }, [comparisonRefresh, refreshSequence, repository, year]);

  const loading = resolvedYear !== year;
  const currentNetwork = loading ? undefined : network;
  const currentNotCreated = !loading && notCreated;

  async function run(
    action: string,
    operation: () => Promise<AnnualSampleNetwork>,
  ) {
    setBusy(action);
    setError("");
    setMessage("");
    try {
      const next = await operation();
      setNetwork(next);
      rememberNetwork(next);
      setNotCreated(false);
      setResolvedYear(year);
      return next;
    } catch (cause) {
      setError(actionError(cause));
      return undefined;
    } finally {
      setBusy("");
    }
  }

  function createNetwork() {
    if (!repository.generateSampleNetworkCandidates) return;
    let carriedFromYear: number | undefined;
    void run("create", async () => {
      carriedFromYear = await nearestPublishedNetworkYear(year);
      return repository.generateSampleNetworkCandidates!(year, carriedFromYear);
    }).then((next) => {
      if (next) {
        setMessage(
          carriedFromYear
            ? `${year}年度候选名单已引用${carriedFromYear}年度稳定样本点。`
            : `${year}年度空白样本网络已创建。`,
        );
      }
    });
  }

  async function nearestPublishedNetworkYear(targetYear: number) {
    if (!repository.getSampleNetwork) return undefined;

    for (const candidateYear of discoveryYears(targetYear)) {
      try {
        const candidate = await repository.getSampleNetwork(candidateYear);
        rememberNetwork(candidate);
        if (candidate.statusCode === "PUBLISHED") return candidateYear;
      } catch (cause) {
        if (!isNotFound(cause)) throw cause;
      }
    }
    return undefined;
  }

  function decide(
    member: AnnualSampleNetworkMembership,
    statusCode: SampleNetworkMembershipStatus,
  ) {
    if (!repository.updateSampleNetworkMember) return;
    const reason = decisionReason(year, statusCode);
    const relation = memberRelation(relationIndex.get(member.samplePointId));
    void run(`member:${member.samplePointId}:${statusCode}`, () =>
      repository.updateSampleNetworkMember!(year, member.samplePointId, {
        designVillageRegionCode: relation?.designVillageRegionCode,
        relationType: relation?.relationType,
        evidenceReference: relation?.evidenceReference ?? undefined,
        statusCode,
        sourceCode: member.sourceCode,
        reason,
        version: member.version,
      }),
    );
  }

  function addMember() {
    if (
      !repository.updateSampleNetworkMember ||
      !newSamplePointId.trim() ||
      (newRelationType !== "" && !newDesignVillageCode.trim()) ||
      (newRelationType === "EXPLICIT_REPRESENTATION" &&
        !newEvidenceReference.trim())
    )
      return;
    void run("add-member", () =>
      repository.updateSampleNetworkMember!(year, newSamplePointId.trim(), {
        designVillageRegionCode:
          newRelationType === "" ? undefined : newDesignVillageCode.trim(),
        relationType: newRelationType || undefined,
        evidenceReference:
          newRelationType === "EXPLICIT_REPRESENTATION"
            ? newEvidenceReference.trim()
            : undefined,
        statusCode: "ACTIVE",
        sourceCode: "NEW",
        reason: newReason.trim() || `新增${year}年度现有样本点`,
        version: 0,
      }),
    ).then((next) => {
      if (!next) return;
      if (newRelationType !== "") {
        setComparisonRefresh((refresh) => refresh + 1);
      }
      setNewSamplePointId("");
      setNewDesignVillageCode("");
      setNewRelationType("");
      setNewEvidenceReference("");
      setNewReason("");
    });
  }

  function submit() {
    if (!network || !repository.submitSampleNetwork) return;
    void run("submit", () =>
      repository.submitSampleNetwork!(year, network.version),
    );
  }

  function review(decision: "APPROVE" | "RETURN") {
    if (!network || !repository.reviewSampleNetwork || !reviewReason.trim())
      return;
    void run(`review:${decision}`, () =>
      repository.reviewSampleNetwork!(
        year,
        network.version,
        decision,
        reviewReason.trim(),
      ),
    ).then((next) => {
      if (next) setReviewReason("");
    });
  }

  const canCreate = session.permissions.includes("BUSINESS_CREATE");
  const canUpdate = session.permissions.includes("BUSINESS_UPDATE");
  const canSubmit = session.permissions.includes("BUSINESS_SUBMIT");
  const canApprove = session.permissions.includes("BUSINESS_APPROVE");
  const canReturn = session.permissions.includes("BUSINESS_RETURN");
  const comparisonForYear = comparison?.year === year ? comparison : undefined;
  const relationStatus = comparisonForYear?.status ?? "LOADING";
  const selectedRelations =
    comparisonForYear?.status === "LOADED"
      ? comparisonForYear.relations
      : EMPTY_RELATIONS;
  const relationIndex = relationIndexByMember(selectedRelations);
  const canAddMember =
    Boolean(newSamplePointId.trim()) &&
    (newRelationType === "" || Boolean(newDesignVillageCode.trim())) &&
    (newRelationType !== "EXPLICIT_REPRESENTATION" ||
      Boolean(newEvidenceReference.trim())) &&
    !busy;

  return (
    <section
      aria-label="年度样本网络管理"
      className="annual-sample-network-panel"
    >
      <header>
        <div>
          <span>年度样本点管理</span>
          <h2>{year}年度现有样本名单</h2>
          <p>
            从2026年开始逐年确认当年实际使用的样本点；可沿用上年名单，也可新增、暂停或移除。
          </p>
        </div>
        <label>
          年度
          <select
            value={year}
            onChange={(event) => {
              const nextYear = Number(event.target.value);
              setInternalYear(nextYear);
              onSelectedYearChange?.(nextYear);
            }}
          >
            {knownYearList([...knownYears, currentYear + 1]).map(
              (optionYear) => (
                <option key={optionYear} value={optionYear}>
                  {optionYear}年
                </option>
              ),
            )}
          </select>
        </label>
      </header>

      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      <p className="annual-sample-network-panel__rule">
        仅创建年度名单，不复制产量、价格、库存等业务数据。
      </p>

      {loading ? <p>正在读取{year}年度样本网络…</p> : null}
      {currentNotCreated ? (
        <div className="annual-sample-network-panel__empty">
          <p>{year}年度样本网络尚未创建</p>
          {canCreate && repository.generateSampleNetworkCandidates ? (
            <button
              disabled={Boolean(busy)}
              onClick={createNetwork}
              type="button"
            >
              {year === currentYear
                ? `创建${year}年度网络`
                : `生成${year}年度候选名单`}
            </button>
          ) : null}
        </div>
      ) : null}

      {currentNetwork ? (
        <>
          <div className="annual-sample-network-panel__summary">
            <strong>{currentNetwork.networkYear}年度</strong>
            <span>{networkStatusLabel(currentNetwork.statusCode)}</span>
            <span>成员 {currentNetwork.memberships.length} 个</span>
          </div>
          <div
            className="annual-sample-network-panel__table"
            role="region"
            aria-label="年度样本成员"
          >
            <table>
              <thead>
                <tr>
                  <th>样本点</th>
                  <th>所在地层级/区域</th>
                  <th>设计关系</th>
                  <th>来源</th>
                  <th>状态</th>
                  <th>处理</th>
                </tr>
              </thead>
              <tbody>
                {currentNetwork.memberships.map((member) => (
                  <tr key={member.samplePointId}>
                    <td>{member.samplePointName}</td>
                    <td>{locationLabel(member)}</td>
                    <td>
                      {relationLabel(
                        relationIndex.get(member.samplePointId),
                        relationStatus,
                      )}
                    </td>
                    <td>{sourceLabel(member.sourceCode)}</td>
                    <td>{membershipStatusLabel(member.statusCode)}</td>
                    <td>
                      {currentNetwork.statusCode === "DRAFT" && canUpdate ? (
                        <div>
                          <button
                            onClick={() => decide(member, "ACTIVE")}
                            type="button"
                          >
                            启用
                          </button>
                          <button
                            onClick={() => decide(member, "PAUSED")}
                            type="button"
                          >
                            暂停
                          </button>
                          <button
                            onClick={() => decide(member, "REMOVED")}
                            type="button"
                          >
                            移除
                          </button>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {currentNetwork.statusCode === "DRAFT" && canUpdate ? (
            <div
              className="annual-sample-network-panel__add"
              aria-label="新增年度样本点"
            >
              <input
                aria-label="稳定样本点ID"
                placeholder="稳定样本点ID"
                value={newSamplePointId}
                onChange={(event) => setNewSamplePointId(event.target.value)}
              />
              <label>
                设计关系
                <select
                  aria-label="设计关系"
                  value={newRelationType}
                  onChange={(event) =>
                    setNewRelationType(
                      event.target.value as
                        "" | "EXACT_VILLAGE" | "EXPLICIT_REPRESENTATION",
                    )
                  }
                >
                  <option value="">不关联设计村</option>
                  <option value="EXACT_VILLAGE">精确对应</option>
                  <option value="EXPLICIT_REPRESENTATION">明确代表</option>
                </select>
              </label>
              {newRelationType ? (
                <input
                  aria-label="设计行政村代码"
                  placeholder="设计行政村代码"
                  value={newDesignVillageCode}
                  onChange={(event) =>
                    setNewDesignVillageCode(event.target.value)
                  }
                />
              ) : null}
              {newRelationType === "EXPLICIT_REPRESENTATION" ? (
                <input
                  aria-label="明确代表依据"
                  placeholder="明确代表依据"
                  value={newEvidenceReference}
                  onChange={(event) =>
                    setNewEvidenceReference(event.target.value)
                  }
                />
              ) : null}
              <input
                aria-label="新增理由"
                placeholder="新增理由"
                value={newReason}
                onChange={(event) => setNewReason(event.target.value)}
              />
              <button
                disabled={!canAddMember}
                onClick={addMember}
                type="button"
              >
                新增现有样本点
              </button>
            </div>
          ) : null}

          {currentNetwork.statusCode === "DRAFT" && canSubmit ? (
            <button disabled={Boolean(busy)} onClick={submit} type="button">
              提交独立审核
            </button>
          ) : null}

          {currentNetwork.statusCode === "IN_REVIEW" &&
          (canApprove || canReturn) ? (
            <div className="annual-sample-network-panel__review">
              <textarea
                aria-label="年度样本网络审核理由"
                value={reviewReason}
                onChange={(event) => setReviewReason(event.target.value)}
              />
              {canApprove ? (
                <button
                  disabled={!reviewReason.trim() || Boolean(busy)}
                  onClick={() => review("APPROVE")}
                  type="button"
                >
                  审核通过并发布
                </button>
              ) : null}
              {canReturn ? (
                <button
                  disabled={!reviewReason.trim() || Boolean(busy)}
                  onClick={() => review("RETURN")}
                  type="button"
                >
                  退回修改
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function isNotFound(error: unknown) {
  return (
    (error instanceof RealtimeApiError && error.status === 404) ||
    (typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 404)
  );
}

function actionError(error: unknown) {
  return error instanceof RealtimeApiError && error.clientMessage
    ? error.clientMessage
    : "年度样本网络操作未完成，请稍后重试。";
}

function decisionReason(year: number, status: SampleNetworkMembershipStatus) {
  if (status === "ACTIVE") return `确认纳入${year}年度现有样本网络`;
  if (status === "PAUSED") return `暂停${year}年度样本点`;
  return `移出${year}年度样本网络`;
}

function networkStatusLabel(status: AnnualSampleNetwork["statusCode"]) {
  return {
    DRAFT: "草稿",
    IN_REVIEW: "独立审核中",
    PUBLISHED: "已发布",
    RETIRED: "已停用",
  }[status];
}

function membershipStatusLabel(status: SampleNetworkMembershipStatus) {
  return { CANDIDATE: "候选", ACTIVE: "在网", PAUSED: "暂停", REMOVED: "移除" }[
    status
  ];
}

function sourceLabel(source: AnnualSampleNetworkMembership["sourceCode"]) {
  return { CARRIED_FORWARD: "上年引用", NEW: "本年新增", MANUAL: "人工调整" }[
    source
  ];
}

function knownYearList(years: readonly number[]) {
  return [...new Set(years)].sort((left, right) => left - right);
}

function discoveryYears(targetYear: number) {
  return Array.from(
    { length: Math.max(0, targetYear - ANNUAL_NETWORK_DISCOVERY_START_YEAR) },
    (_, index) => targetYear - index - 1,
  );
}

function memberRelation(
  relation: SampleNetworkRelation | undefined,
):
  | (Pick<
      SampleNetworkRelation,
      "designVillageRegionCode" | "evidenceReference"
    > & { relationType: "EXACT_VILLAGE" | "EXPLICIT_REPRESENTATION" })
  | undefined {
  if (
    relation?.relationType !== "EXACT_VILLAGE" &&
    relation?.relationType !== "EXPLICIT_REPRESENTATION"
  ) {
    return undefined;
  }
  if (relation.reviewStatus === "RETURNED") return undefined;
  return relation as Pick<
    SampleNetworkRelation,
    "designVillageRegionCode" | "evidenceReference"
  > & { relationType: "EXACT_VILLAGE" | "EXPLICIT_REPRESENTATION" };
}

function relationIndexByMember(relations: readonly SampleNetworkRelation[]) {
  const index = new Map<string, SampleNetworkRelation>();
  for (const relation of relations) {
    const previous = index.get(relation.samplePointId);
    if (!previous || relationPriority(relation) > relationPriority(previous)) {
      index.set(relation.samplePointId, relation);
    }
  }
  return index;
}

function relationPriority(relation: SampleNetworkRelation) {
  const typePriority = {
    EXACT_VILLAGE: 3,
    EXPLICIT_REPRESENTATION: 2,
    REGIONAL_ASSOCIATION: 1,
  }[relation.relationType];
  return relation.reviewStatus === "RETURNED"
    ? typePriority
    : typePriority + 10;
}

function locationLabel(member: AnnualSampleNetworkMembership) {
  return `${
    {
      PREFECTURE: "地市级",
      COUNTY: "区县级",
      TOWNSHIP: "乡镇级",
      VILLAGE: "村级",
    }[member.locatedRegionLevel]
  } / ${member.locatedRegionName}`;
}

function relationLabel(
  relation: SampleNetworkRelation | undefined,
  status: ComparisonState["status"],
): string {
  if (status === "LOADING") return "正在读取设计关系…";
  if (status === "UNAVAILABLE") return "设计关系暂不可用";
  if (!relation) return "未关联设计村";
  if (relation.reviewStatus === "RETURNED") {
    if (relation.relationType === "EXACT_VILLAGE") {
      return `退回的精确对应（${relation.designVillageRegionCode}）`;
    }
    if (relation.relationType === "REGIONAL_ASSOCIATION") {
      return "退回的区域关联（系统推导）";
    }
    return `退回的明确代表（${relation.designVillageRegionCode}；${relation.evidenceReference ?? "未说明依据"}）`;
  }
  if (relation.relationType === "EXACT_VILLAGE") {
    return `精确对应（${relation.designVillageRegionCode}）`;
  }
  if (relation.relationType === "REGIONAL_ASSOCIATION") {
    return "区域关联（系统推导）";
  }
  return `明确代表（${relation.designVillageRegionCode}；${relation.evidenceReference ?? "未说明依据"}）`;
}
