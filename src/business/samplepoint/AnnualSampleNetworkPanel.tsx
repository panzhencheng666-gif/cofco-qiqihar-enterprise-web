import { useEffect, useState } from "react";

import type {
  AnnualSampleNetwork,
  AnnualSampleNetworkMembership,
  CurrentSession,
  RealtimeBusinessRepository,
  SampleNetworkMembershipStatus,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";

import "./annual-sample-network.css";

export function AnnualSampleNetworkPanel({
  currentYear = new Date().getFullYear(),
  repository,
  session,
}: {
  currentYear?: number;
  repository: RealtimeBusinessRepository;
  session: CurrentSession;
}) {
  const [year, setYear] = useState(currentYear);
  const [network, setNetwork] = useState<AnnualSampleNetwork>();
  const [notCreated, setNotCreated] = useState(false);
  const [resolvedYear, setResolvedYear] = useState<number>();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [newSamplePointId, setNewSamplePointId] = useState("");
  const [newVillageCode, setNewVillageCode] = useState("");
  const [newReason, setNewReason] = useState("");

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
  }, [repository, year]);

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
    const carriedFromYear = year === currentYear + 1 ? currentYear : undefined;
    void run("create", () =>
      repository.generateSampleNetworkCandidates!(year, carriedFromYear),
    ).then((next) => {
      if (next) {
        setMessage(
          carriedFromYear
            ? `${year}年度候选名单已引用${carriedFromYear}年度稳定样本点。`
            : `${year}年度空白样本网络已创建。`,
        );
      }
    });
  }

  function decide(
    member: AnnualSampleNetworkMembership,
    statusCode: SampleNetworkMembershipStatus,
  ) {
    if (!repository.updateSampleNetworkMember) return;
    const reason = decisionReason(year, statusCode);
    void run(`member:${member.samplePointId}:${statusCode}`, () =>
      repository.updateSampleNetworkMember!(year, member.samplePointId, {
        villageRegionCode: member.villageRegionCode,
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
      !newSamplePointId ||
      !newVillageCode
    )
      return;
    void run("add-member", () =>
      repository.updateSampleNetworkMember!(year, newSamplePointId.trim(), {
        villageRegionCode: newVillageCode.trim(),
        statusCode: "ACTIVE",
        sourceCode: "NEW",
        reason: newReason.trim() || `新增${year}年度现有样本点`,
        version: 0,
      }),
    ).then((next) => {
      if (!next) return;
      setNewSamplePointId("");
      setNewVillageCode("");
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

  return (
    <section
      aria-label="年度样本网络管理"
      className="annual-sample-network-panel"
    >
      <header>
        <div>
          <span>稳定样本点年度在网治理</span>
          <h2>设计样本点与现有样本点对照</h2>
          <p>
            2,332个行政村设计点不分年份；年度名单只引用稳定样本点，不复制业务数据。
          </p>
        </div>
        <label>
          年度
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          >
            <option value={currentYear}>{currentYear}年</option>
            <option value={currentYear + 1}>{currentYear + 1}年</option>
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
                ? `创建${year}年度空白网络`
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
            <span>版本 {currentNetwork.version}</span>
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
                  <th>行政村</th>
                  <th>来源</th>
                  <th>状态</th>
                  <th>处理</th>
                </tr>
              </thead>
              <tbody>
                {currentNetwork.memberships.map((member) => (
                  <tr key={member.samplePointId}>
                    <td>{member.samplePointName}</td>
                    <td>{member.villageName}</td>
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
              <input
                aria-label="行政村代码"
                placeholder="行政村代码"
                value={newVillageCode}
                onChange={(event) => setNewVillageCode(event.target.value)}
              />
              <input
                aria-label="新增理由"
                placeholder="新增理由"
                value={newReason}
                onChange={(event) => setNewReason(event.target.value)}
              />
              <button
                disabled={
                  !newSamplePointId.trim() ||
                  !newVillageCode.trim() ||
                  Boolean(busy)
                }
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
