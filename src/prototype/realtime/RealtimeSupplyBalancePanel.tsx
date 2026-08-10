import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  realtimeBusinessRepository,
  type MasterDataSnapshot,
  type RealtimeBusinessRepository,
  type SupplyAccountRow,
  type SupplyInputWorkspace,
  type SupplySurveyPeriod,
  type SupplySourceReleaseInput,
} from "@/platform/api/realtimeBusinessRepository";

import { RealtimeRegionCascadePicker } from "./RealtimeRegionCascadePicker";

interface RealtimeSupplyBalancePanelProps {
  productCode?: string;
  regionCode?: string;
  periodCode?: string;
  onPeriodCodeChange?: (periodCode: string) => void;
  permissions?: readonly string[];
  repository?: RealtimeBusinessRepository;
}

interface SupplySourceCandidate extends SupplySourceReleaseInput {
  key: string;
  roleLabel: string;
  contextLabel: string;
  valueLabel: string;
}

const roleGroups: Readonly<Record<string, string>> = {
  SUPPLY: "供给来源",
  USE: "使用与外流",
  RECONCILIATION: "库存勾稽",
};

const sourceDomainLabels: Readonly<Record<string, string>> = {
  PRODUCTION: "产情监测",
  MARKET: "市场监测",
  LOGISTICS: "物流监测",
  SUPPLY: "供需分析",
  MANUAL: "人工登记来源",
};

const resultStateLabels: Readonly<Record<string, string>> = {
  DRAFT: "待核定",
  CONFIRMED: "已确认",
  PUBLISHED: "已发布",
  BLOCKED: "已阻断",
};

const validationLabels: Readonly<Record<string, string>> = {
  MISSING_REQUIRED_SOURCE: "缺少必需业务来源",
  OUTSIDE_BALANCE_TOLERANCE: "库存勾稽差额超过允许范围",
};

const balanceReasonLabels: Readonly<Record<string, string>> = {
  WITHIN_TOLERANCE: "库存勾稽在允许范围内",
  OUTSIDE_BALANCE_TOLERANCE: "库存勾稽差额超过允许范围",
};

function display(value: string | null | undefined): string {
  return value === null || value === undefined || value === "" ? "—" : value;
}

function formatError(error: unknown): string {
  void error;
  return "当前供需结果暂时无法读取，请稍后重试；如持续出现，请联系业务管理员。";
}

function businessLabel(
  labels: Readonly<Record<string, string>>,
  value: string,
  fallback: string,
): string {
  return labels[value] ?? fallback;
}

function resultStateLabel(account: SupplyAccountRow): string {
  if (!account.publishable) return "校验阻断";
  return account.balanced ? "供需平衡" : "存在缺口";
}

export function RealtimeSupplyBalancePanel({
  productCode: initialProductCode = "CORN",
  regionCode: initialRegionCode = "230200",
  periodCode: initialPeriodCode = "",
  onPeriodCodeChange,
  permissions = [],
  repository = realtimeBusinessRepository,
}: RealtimeSupplyBalancePanelProps) {
  const [master, setMaster] = useState<MasterDataSnapshot | null>(null);
  const [surveyPeriods, setSurveyPeriods] = useState<readonly SupplySurveyPeriod[]>([]);
  const [productCode, setProductCode] = useState(initialProductCode);
  const [regionCode, setRegionCode] = useState(initialRegionCode);
  const [periodCode, setPeriodCode] = useState(initialPeriodCode);
  const [marketingYear, setMarketingYear] = useState("");
  const [workspace, setWorkspace] = useState<SupplyInputWorkspace | null>(null);
  const [accounts, setAccounts] = useState<readonly SupplyAccountRow[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [operationBusy, setOperationBusy] = useState(false);
  const [operationMessage, setOperationMessage] = useState("");
  const [sourceCandidates, setSourceCandidates] = useState<
    readonly SupplySourceCandidate[]
  >([]);
  const [sourceCandidatesLoaded, setSourceCandidatesLoaded] = useState(false);
  const [sourceCandidatesLoading, setSourceCandidatesLoading] = useState(false);
  const [selectedSources, setSelectedSources] = useState<
    Record<string, string>
  >({});
  const [manualDrafts, setManualDrafts] = useState<
    Record<string, { value: string; reason: string }>
  >({});
  const [inputSetReason, setInputSetReason] = useState("");
  const [inputSetId, setInputSetId] = useState("");
  const [adjustmentValue, setAdjustmentValue] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const requestSequence = useRef(0);
  const routeProductCodeRef = useRef(initialProductCode);
  const resetOperationDrafts = useCallback((): void => {
    setSelectedSources({});
    setManualDrafts({});
    setInputSetReason("");
    setInputSetId("");
    setAdjustmentValue("");
    setAdjustmentReason("");
    setSourceCandidates([]);
    setSourceCandidatesLoaded(false);
    setSourceCandidatesLoading(false);
    setOperationMessage("");
    setError("");
  }, []);
  const activeScope = `${productCode}|${regionCode}|${periodCode}`;
  const activeScopeRef = useRef(activeScope);

  useEffect(() => {
    activeScopeRef.current = activeScope;
  }, [activeScope]);

  useEffect(() => {
    if (routeProductCodeRef.current === initialProductCode) return;
    routeProductCodeRef.current = initialProductCode;
    resetOperationDrafts();
    setProductCode(initialProductCode);
  }, [initialProductCode, resetOperationDrafts]);

  const activeAccount =
    accounts.find(({ id }) => id === selectedAccountId) ?? accounts[0] ?? null;

  const roleByCode = useMemo(
    () => new Map(workspace?.roles.map((role) => [role.code, role]) ?? []),
    [workspace],
  );

  const sourcesByGroup = useMemo(() => {
    const grouped: Record<string, SupplyAccountRow["sources"]> = {
      SUPPLY: [],
      USE: [],
      RECONCILIATION: [],
    };
    for (const source of activeAccount?.sources ?? []) {
      const groupCode = roleByCode.get(source.roleCode)?.groupCode ?? "SUPPLY";
      grouped[groupCode] = [...(grouped[groupCode] ?? []), source];
    }
    return grouped;
  }, [activeAccount, roleByCode]);

  const reload = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setWorkspace(null);
    setAccounts([]);
    setSelectedAccountId("");
    setError("");
    try {
      const [nextMaster, nextSurveyPeriods] = await Promise.all([
        repository.loadMasterData(),
        repository.loadSupplySurveyPeriods(),
      ]);
      if (sequence !== requestSequence.current) return;
      const selectedPeriod =
        nextSurveyPeriods.find(({ code }) => code === periodCode) ??
        nextSurveyPeriods[0];
      const effectivePeriodCode = selectedPeriod?.code ?? periodCode;
      if (!selectedPeriod) throw new Error("No governed business period");
      const effectiveMarketingYear = selectedPeriod.marketingYearCode;
      const [nextWorkspace, nextAccounts] = await Promise.all([
        repository.loadSupplyInputWorkspace({
          productCode,
          regionCode,
          periodCode: effectivePeriodCode,
        }),
        repository.listSupplyAccounts({
          productCode,
          regionCode,
          periodCode: effectivePeriodCode,
        }),
      ]);
      if (sequence !== requestSequence.current) return;
      setMaster(nextMaster);
      setSurveyPeriods(nextSurveyPeriods);
      setPeriodCode(effectivePeriodCode);
      setMarketingYear(effectiveMarketingYear);
      setWorkspace(nextWorkspace);
      setAccounts(nextAccounts);
      setSelectedAccountId(nextAccounts[0]?.id ?? "");
      setSelectedSources(
        Object.fromEntries(
          nextWorkspace.roles.map((role) => [
            role.code,
            role.selectedReleaseId ?? role.releases[0]?.id ?? "",
          ]),
        ),
      );
      setInputSetId(
        nextWorkspace.latestInputSetId ?? nextAccounts[0]?.inputSetId ?? "",
      );
    } catch (cause) {
      if (sequence !== requestSequence.current) return;
      setWorkspace(null);
      setAccounts([]);
      setError(formatError(cause));
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [periodCode, productCode, regionCode, repository]);

  useEffect(() => {
    queueMicrotask(() => void reload());
  }, [reload]);

  const mayCreateInputSet = permissions.includes("BUSINESS_CREATE");
  const mayUpdateCalculation = permissions.includes("BUSINESS_UPDATE");
  const mayApprove = permissions.includes("BUSINESS_APPROVE");
  const mayOperate = mayCreateInputSet || mayUpdateCalculation || mayApprove;
  const requiredRoles = workspace?.roles.filter((role) => role.required) ?? [];
  const sourcesComplete = requiredRoles.every(
    (role) => selectedSources[role.code],
  );

  function changeScope(action: () => void): void {
    if (operationBusy) return;
    resetOperationDrafts();
    action();
  }

  function changeSelectedSource(roleCode: string, sourceReleaseId: string) {
    setSelectedSources((current) => ({
      ...current,
      [roleCode]: sourceReleaseId,
    }));
    setInputSetId("");
    setOperationMessage("数据来源已变化，请重新确认本次数据来源。");
  }

  async function loadSourceCandidates(): Promise<void> {
    if (!mayUpdateCalculation) return;
    setSourceCandidatesLoading(true);
    setOperationMessage("");
    setError("");
    const operationScope = activeScope;
    try {
      const [productionPage, logisticsPage] = await Promise.all([
        repository.listProduction({
          productCode,
          page: 0,
          pageSize: 100,
          filters: { regionCode, status: "APPROVED" },
        }),
        repository.listLogistics({
          productCode,
          page: 0,
          pageSize: 100,
          filters: {
            regionCode,
            periodCode,
            status: "APPROVED",
          },
        }),
      ]);
      if (activeScopeRef.current !== operationScope) return;
      const productionCandidates = productionPage.items.map(
        (record): SupplySourceCandidate => ({
          key: `PRODUCTION:${record.id}:${record.version}`,
          sourceDomain: "PRODUCTION",
          sourceRecordId: record.id,
          sourceVersion: record.version,
          productCode,
          regionCode,
          periodCode,
          roleCode: "LOCAL_PRODUCTION",
          roleLabel: "本地生产",
          sourceFieldCode: "PROD_ESTIMATED_OUTPUT",
          qualityState: "PASSED",
          contextLabel: `${display(record.values.PROD_REGION)} · ${display(record.values.PROD_SURVEY_DATE)}`,
          valueLabel: `${display(record.values.PROD_ESTIMATED_OUTPUT)} 公斤`,
        }),
      );
      const logisticsCandidates = logisticsPage.items.flatMap(
        (record): readonly SupplySourceCandidate[] => {
          const direction = record.values.LOG_DIRECTION;
          const role =
            direction === "INFLOW"
              ? ({ code: "EXTERNAL_INFLOW", label: "区域外流入" } as const)
              : direction === "OUTFLOW"
                ? ({ code: "EXTERNAL_OUTFLOW", label: "区域外流出" } as const)
                : null;
          if (!role) return [];
          return [
            {
              key: `LOGISTICS:${record.id}:${record.version}:${role.code}`,
              sourceDomain: "LOGISTICS",
              sourceRecordId: record.id,
              sourceVersion: record.version,
              productCode,
              regionCode,
              periodCode,
              roleCode: role.code,
              roleLabel: role.label,
              sourceFieldCode: "ROUTE_VOLUME",
              qualityState: "PASSED",
              contextLabel: record.displayValues.LOG_DIRECTION ?? role.label,
              valueLabel: `${display(record.values.LOG_ROUTE_VOLUME)} 吨`,
            },
          ];
        },
      );
      setSourceCandidates(
        [...productionCandidates, ...logisticsCandidates].filter(
          (candidate) =>
            !workspace?.roles.some(
              (role) =>
                role.code === candidate.roleCode &&
                role.releases.some(
                  (release) =>
                    release.sourceDomain === candidate.sourceDomain &&
                    release.sourceRecordId === candidate.sourceRecordId &&
                    release.sourceVersion === candidate.sourceVersion,
                ),
            ),
        ),
      );
      setSourceCandidatesLoaded(true);
    } catch {
      if (activeScopeRef.current !== operationScope) return;
      setSourceCandidates([]);
      setSourceCandidatesLoaded(true);
      setError("已审核业务来源读取失败，请确认当前地区和统计时间后重试。");
    } finally {
      if (activeScopeRef.current === operationScope)
        setSourceCandidatesLoading(false);
    }
  }

  async function releaseSourceCandidate(
    candidate: SupplySourceCandidate,
  ): Promise<void> {
    if (!mayUpdateCalculation) return;
    setOperationBusy(true);
    setOperationMessage("");
    setError("");
    const operationScope = activeScope;
    try {
      const releaseInput: SupplySourceReleaseInput = {
        sourceDomain: candidate.sourceDomain,
        sourceRecordId: candidate.sourceRecordId,
        sourceVersion: candidate.sourceVersion,
        productCode: candidate.productCode,
        regionCode: candidate.regionCode,
        periodCode: candidate.periodCode,
        roleCode: candidate.roleCode,
        sourceFieldCode: candidate.sourceFieldCode,
        qualityState: candidate.qualityState,
      };
      await repository.releaseSupplySource(releaseInput);
      if (activeScopeRef.current !== operationScope) return;
      await reload();
      setSourceCandidates((current) =>
        current.filter((item) => item.key !== candidate.key),
      );
      setOperationMessage(`${candidate.roleLabel}已发布为可选测算来源。`);
    } catch {
      if (activeScopeRef.current !== operationScope) return;
      setError("业务来源发布未完成，请确认记录已审核且尚未变更后重试。");
    } finally {
      setOperationBusy(false);
    }
  }

  async function approveManual(roleCode: string): Promise<void> {
    if (!workspace || !mayApprove) return;
    const role = workspace.roles.find(
      (candidate) => candidate.code === roleCode,
    );
    const draft = manualDrafts[roleCode];
    if (!role?.manualAllowed || !draft?.value.trim() || !draft.reason.trim())
      return;
    setOperationBusy(true);
    setOperationMessage("");
    setError("");
    const operationScope = activeScope;
    try {
      await repository.approveSupplyManualDecision({
        productCode,
        regionCode,
        periodCode,
        roleCode,
        value: draft.value,
        reason: draft.reason,
        expectedVersion: role.manualDecisionVersion,
      });
      setManualDrafts((current) => ({
        ...current,
        [roleCode]: { value: "", reason: "" },
      }));
      if (activeScopeRef.current !== operationScope) return;
      await reload();
      setOperationMessage(`${role.label}已核定并登记为可选来源。`);
    } catch {
      setError(
        "人工数据登记失败，请检查数值和数据出处，或确认数据是否已被他人更新。",
      );
    } finally {
      setOperationBusy(false);
    }
  }

  async function createInputSet(): Promise<void> {
    if (
      !workspace ||
      !mayCreateInputSet ||
      !sourcesComplete ||
      !inputSetReason.trim()
    )
      return;
    setOperationBusy(true);
    setOperationMessage("");
    setError("");
    const operationScope = activeScope;
    try {
      const created = await repository.createSupplyInputSet({
        productCode,
        regionCode,
        periodCode,
        reason: inputSetReason,
        expectedVersion: workspace.inputSetVersion,
        items: requiredRoles.map((role) => ({
          roleCode: role.code,
          sourceReleaseId: selectedSources[role.code] ?? "",
        })),
      });
      if (activeScopeRef.current !== operationScope) return;
      await reload();
      setInputSetId(created.id);
      setInputSetReason("");
      setOperationMessage("本次数据来源已确认，可以进行试算或正式发布。");
    } catch {
      setError("数据来源确认失败，请确认全部必需来源已经审核且未被他人更新。");
    } finally {
      setOperationBusy(false);
    }
  }

  async function runCalculation(publish: boolean): Promise<void> {
    if (
      !workspace ||
      !mayUpdateCalculation ||
      (publish && !mayApprove) ||
      !inputSetId ||
      !adjustmentValue.trim() ||
      !adjustmentReason.trim()
    )
      return;
    setOperationBusy(true);
    setOperationMessage("");
    setError("");
    const operationScope = activeScope;
    try {
      const result = await repository.runSupplyAccount({
        productCode,
        regionCode,
        periodCode,
        inputSetId,
        adjustmentProposalValue: adjustmentValue,
        adjustmentProposalReason: adjustmentReason,
        expectedDecisionVersion: workspace.decisionVersion,
        publish,
      });
      if (activeScopeRef.current !== operationScope) return;
      await reload();
      setOperationMessage(
        publish
          ? result.resultState === "PUBLISHED"
            ? "供需测算已运行并正式发布。"
            : "供需测算已完成，但校验未通过，结果未正式发布。"
          : "供需试算已完成，结果尚未正式发布。",
      );
    } catch {
      setError(
        "供需测算未完成，请检查数据来源、调整原因，或确认数据是否已被他人更新。",
      );
    } finally {
      setOperationBusy(false);
    }
  }

  if (loading && !master) {
    return (
      <section className="realtime-business-panel" aria-label="实时供需账户">
        <p>正在读取供需计算结果……</p>
      </section>
    );
  }

  return (
    <section
      className="realtime-business-panel realtime-supply-panel"
      aria-label="实时供需账户"
    >
      <header>
        <div>
          <p className="realtime-supply-eyebrow">经营决策分析</p>
          <h2>实时供需平衡</h2>
          <p>
            展示已确认的供需结果、计算公式和数据来源；被授权员工可在本页确认来源、试算并发布。
          </p>
        </div>
        <button type="button" onClick={() => void reload()} disabled={loading}>
          {loading ? "更新中" : "刷新结果"}
        </button>
      </header>

      <section
        aria-label="供需平衡筛选条件"
        className="enterprise-ledger-query realtime-supply-query"
        role="search"
      >
        {(master?.products.length ?? 0) > 1 && (
          <label>
            <span>产品或作物</span>
            <select
              aria-label="产品或作物"
              disabled={operationBusy}
              value={productCode}
              onChange={(event) =>
                changeScope(() => setProductCode(event.target.value))
              }
            >
              {master?.products.map((product) => (
                <option key={product.code} value={product.code}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <RealtimeRegionCascadePicker
          ariaLabel="统计地区"
          disabled={operationBusy}
          onChange={(nextRegionCode) =>
            changeScope(() => setRegionCode(nextRegionCode))
          }
          regions={master?.regions ?? []}
          requireVillage={false}
          value={regionCode}
        />
        {surveyPeriods.length > 1 && (
          <label>
            <span>调查期间</span>
            <select
              aria-label="调查期间"
              disabled={operationBusy}
              value={periodCode}
              onChange={(event) =>
                changeScope(() => {
                  const nextPeriodCode = event.target.value;
                  const nextPeriod = surveyPeriods.find(
                    ({ code }) => code === nextPeriodCode,
                  );
                  setPeriodCode(nextPeriodCode);
                  setMarketingYear(nextPeriod?.marketingYearCode ?? "");
                  onPeriodCodeChange?.(nextPeriodCode);
                })
              }
            >
              {surveyPeriods.map((period) => (
                <option key={period.code} value={period.code}>
                  {period.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {accounts.length > 1 && (
          <label>
            <span>结果版本</span>
            <select
              aria-label="结果版本"
              disabled={operationBusy}
              value={activeAccount?.id ?? ""}
              onChange={(event) => setSelectedAccountId(event.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.surveyQuarter ?? "年度"} · 第 {account.resultVersion} 版 · {businessLabel(
                    resultStateLabels,
                    account.resultState,
                    "已形成结果",
                  )}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="enterprise-ledger-query__summary">
          当前范围：
          {master?.products.find(({ code }) => code === productCode)?.name ??
            "尚无产品"}
          {" · "}
          {surveyPeriods.find(({ code }) => code === (activeAccount?.periodCode ?? periodCode))?.name ??
            "尚无调查期间"}
          {" · "}
          {activeAccount?.marketingYear
            ? `${activeAccount.marketingYear}营销年度`
            : surveyPeriods.find(({ code }) => code === periodCode)?.marketingYearName ??
              `${marketingYear}营销年度`}
          {" · "}
          {master?.regions.find(({ code }) => code === regionCode)?.name ??
            regionCode}
          {" · "}
          {activeAccount
            ? `${businessLabel(resultStateLabels, activeAccount.resultState, "已形成结果")} · 第${activeAccount.resultVersion}版`
            : "尚未形成测算结果"}
        </p>
      </section>

      {workspace && mayOperate && (
        <section
          aria-label="数据来源确认与发布"
          className="realtime-supply-operations"
        >
          <header>
            <div>
              <h3>确认供需数据来源</h3>
              <p>只显示当前范围内已经审核并可用于测算的业务来源。</p>
            </div>
            <span>
              已选{" "}
              {
                requiredRoles.filter((role) => selectedSources[role.code])
                  .length
              }
              /{requiredRoles.length} 项必需来源
            </span>
          </header>

          {mayUpdateCalculation && (
            <section
              aria-label="可发布业务来源"
              className="realtime-supply-candidates"
            >
              <header>
                <div>
                  <h4>可发布业务来源</h4>
                  <p>
                    从当前地区已审核的产情和物流记录中选择，无需填写系统编号。
                  </p>
                </div>
                <button
                  disabled={operationBusy || sourceCandidatesLoading}
                  onClick={() => void loadSourceCandidates()}
                  type="button"
                >
                  {sourceCandidatesLoading
                    ? "正在读取……"
                    : "读取已审核业务来源"}
                </button>
              </header>
              {sourceCandidates.map((candidate) => (
                <article
                  aria-label={`${candidate.roleLabel}候选来源`}
                  key={candidate.key}
                >
                  <div>
                    <strong>{candidate.roleLabel}</strong>
                    <span>{candidate.contextLabel}</span>
                  </div>
                  <b>{candidate.valueLabel}</b>
                  <button
                    disabled={operationBusy}
                    onClick={() => void releaseSourceCandidate(candidate)}
                    type="button"
                  >
                    发布为供需来源
                  </button>
                </article>
              ))}
              {sourceCandidatesLoaded && sourceCandidates.length === 0 && (
                <p>当前范围暂无尚可发布的已审核产情或物流记录。</p>
              )}
            </section>
          )}

          <div className="realtime-supply-source-grid">
            {workspace.roles.map((role) => {
              const manual = manualDrafts[role.code] ?? {
                value: "",
                reason: "",
              };
              return (
                <article key={role.code}>
                  <div>
                    <strong>{role.label}</strong>
                    <span>{role.required ? "必需来源" : "可选来源"}</span>
                  </div>
                  {role.releases.length === 0 ? (
                    <p className="realtime-supply-source-empty" role="status">
                      暂无可采用的已审核来源
                    </p>
                  ) : (
                    <label>
                      <span>选择数据来源</span>
                      <select
                        aria-label={`${role.label}采用来源`}
                        disabled={!mayCreateInputSet || operationBusy}
                        onChange={(event) =>
                          changeSelectedSource(role.code, event.target.value)
                        }
                        value={selectedSources[role.code] ?? ""}
                      >
                        <option value="">请选择已审核来源</option>
                        {role.releases.map((release) => (
                          <option key={release.id} value={release.id}>
                            {businessLabel(
                              sourceDomainLabels,
                              release.sourceDomain,
                              "业务核定来源",
                            )}
                            · {release.value} {release.unitCode} · 第{" "}
                            {release.sourceVersion} 次修订
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {mayApprove && role.manualAllowed && (
                    <details className="realtime-supply-manual-entry">
                      <summary>没有合适来源？填写拟采用数值</summary>
                      <div className="realtime-supply-manual-fields">
                        <small>
                          仅在没有可采用的已审核来源时填写；请填写拟采用数值，并写明可复核的数据出处。
                        </small>
                        <label>
                          <span>拟采用数值（万吨）</span>
                          <input
                            aria-label={`${role.label}拟采用数值（万吨）`}
                            inputMode="decimal"
                            onChange={(event) =>
                              setManualDrafts((current) => ({
                                ...current,
                                [role.code]: {
                                  ...manual,
                                  value: event.target.value,
                                },
                              }))
                            }
                            placeholder="例如：12.5000"
                            value={manual.value}
                          />
                        </label>
                        <label>
                          <span>调整原因与数据出处</span>
                          <input
                            aria-label={`${role.label}调整原因与数据出处`}
                            onChange={(event) =>
                              setManualDrafts((current) => ({
                                ...current,
                                [role.code]: {
                                  ...manual,
                                  reason: event.target.value,
                                },
                              }))
                            }
                            placeholder="例如：依据本期库存盘点表，经负责人复核"
                            value={manual.reason}
                          />
                        </label>
                        <button
                          disabled={
                            operationBusy ||
                            !manual.value.trim() ||
                            !manual.reason.trim()
                          }
                          onClick={() => void approveManual(role.code)}
                          type="button"
                        >
                          核定并登记{role.label}
                        </button>
                      </div>
                    </details>
                  )}
                </article>
              );
            })}
          </div>

          {mayCreateInputSet && (
            <div className="realtime-supply-input-set">
              <label>
                <span>本次数据来源说明</span>
                <textarea
                  aria-label="本次数据来源说明"
                  onChange={(event) => setInputSetReason(event.target.value)}
                  value={inputSetReason}
                />
              </label>
              <button
                disabled={
                  operationBusy || !sourcesComplete || !inputSetReason.trim()
                }
                onClick={() => void createInputSet()}
                type="button"
              >
                确认本次数据来源
              </button>
            </div>
          )}

          {mayUpdateCalculation && (
            <div className="realtime-supply-runner">
              <label>
                <span>期末库存调整量（万吨）</span>
                <input
                  aria-label="期末库存调整量（万吨）"
                  inputMode="decimal"
                  onChange={(event) => setAdjustmentValue(event.target.value)}
                  value={adjustmentValue}
                />
              </label>
              <label>
                <span>调整原因与依据</span>
                <input
                  aria-label="调整原因与依据"
                  onChange={(event) => setAdjustmentReason(event.target.value)}
                  value={adjustmentReason}
                />
              </label>
              <button
                disabled={
                  operationBusy ||
                  !inputSetId ||
                  !adjustmentValue.trim() ||
                  !adjustmentReason.trim()
                }
                onClick={() => void runCalculation(false)}
                type="button"
              >
                执行试算
              </button>
              {mayApprove && (
                <button
                  disabled={
                    operationBusy ||
                    !inputSetId ||
                    !adjustmentValue.trim() ||
                    !adjustmentReason.trim()
                  }
                  onClick={() => void runCalculation(true)}
                  type="button"
                >
                  运行并发布
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {operationMessage && (
        <p className="realtime-business-success" role="status">
          {operationMessage}
        </p>
      )}

      {error && (
        <p className="realtime-business-error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="realtime-supply-loading" role="status">
          正在更新当前筛选范围的核定结果……
        </div>
      ) : !workspace ? (
        <p className="realtime-business-empty">
          当前筛选范围尚无供需计算数据，系统未使用其他地区或时间的数据替代。
        </p>
      ) : !activeAccount ? (
        <section
          className="realtime-supply-empty-result"
          aria-label="计算阻断说明"
        >
          <div>
            <strong>尚未形成核定计算结果</strong>
            <p>完成全部必需来源的审核与确认后，系统才会展示计算结论。</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>计算项目</th>
                <th>归属</th>
                <th>来源状态</th>
              </tr>
            </thead>
            <tbody>
              {workspace.roles.map((role) => (
                <tr key={role.code}>
                  <td>{role.label}</td>
                  <td>{roleGroups[role.groupCode] ?? role.groupCode}</td>
                  <td>
                    {role.selectedReleaseId
                      ? "已选择，等待形成核定结果"
                      : role.required
                        ? "缺少必需来源"
                        : "未采用可选来源"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <>
          <section
            aria-label="平衡结论"
            className={`realtime-supply-conclusion ${activeAccount.publishable ? "is-ready" : "is-blocked"}`}
          >
            <div className="realtime-supply-conclusion__status">
              <span>{resultStateLabel(activeAccount)}</span>
              <strong>
                {businessLabel(
                  balanceReasonLabels,
                  activeAccount.balanceReason,
                  activeAccount.balanceReason,
                )}
              </strong>
              <small>
                第 {activeAccount.resultVersion} 次测算 · 第{" "}
                {activeAccount.decisionVersion} 次核定 · 数据来源已确认
              </small>
            </div>
            <dl className="realtime-supply-kpis">
              <div>
                <dt>总供给</dt>
                <dd>{display(activeAccount.totalSupply)}</dd>
                <small>万吨</small>
              </div>
              <div>
                <dt>总使用</dt>
                <dd>{display(activeAccount.totalUse)}</dd>
                <small>万吨</small>
              </div>
              <div>
                <dt>计算期末库存</dt>
                <dd>{display(activeAccount.calculatedEndingInventory)}</dd>
                <small>万吨</small>
              </div>
              <div>
                <dt>期末库存调整量</dt>
                <dd>{display(activeAccount.approvedAdjustment)}</dd>
                <small>万吨</small>
              </div>
              <div className="is-primary">
                <dt>采用期末库存</dt>
                <dd>{display(activeAccount.adoptedEndingInventory)}</dd>
                <small>万吨</small>
              </div>
              <div>
                <dt>库存勾稽差额</dt>
                <dd>
                  {display(activeAccount.inventoryReconciliationDifference)}
                </dd>
                <small>万吨</small>
              </div>
            </dl>
          </section>

          <div className="realtime-supply-analysis-grid">
            <figure className="realtime-supply-bridge" aria-label="供需平衡桥">
              <figcaption>
                <strong>供需平衡桥</strong>
                <span>从供给到采用期末库存的完整计算路径</span>
              </figcaption>
              <div className="realtime-supply-bridge__flow">
                <div data-tone="supply">
                  <span>总供给</span>
                  <strong>{display(activeAccount.totalSupply)}</strong>
                </div>
                <b aria-hidden="true">−</b>
                <div data-tone="use">
                  <span>总使用</span>
                  <strong>{display(activeAccount.totalUse)}</strong>
                </div>
                <b aria-hidden="true">=</b>
                <div data-tone="inventory">
                  <span>计算库存</span>
                  <strong>
                    {display(activeAccount.calculatedEndingInventory)}
                  </strong>
                </div>
                <b aria-hidden="true">+</b>
                <div data-tone="adjustment">
                  <span>期末库存调整量</span>
                  <strong>{display(activeAccount.approvedAdjustment)}</strong>
                </div>
                <b aria-hidden="true">=</b>
                <div data-tone="adopted">
                  <span>采用库存</span>
                  <strong>
                    {display(activeAccount.adoptedEndingInventory)}
                  </strong>
                </div>
              </div>
              <p>
                计算规则：{activeAccount.formula.name}，结果保留{" "}
                {activeAccount.formula.scale} 位小数，允许差额{" "}
                {activeAccount.formula.tolerance}。
              </p>
            </figure>

            <section
              className="realtime-supply-composition"
              aria-label="供需构成"
            >
              <header>
                <strong>供需构成</strong>
                <span>本次测算采用的来源项</span>
              </header>
              {(["SUPPLY", "USE"] as const).map((groupCode) => (
                <div key={groupCode}>
                  <h3>{roleGroups[groupCode]}</h3>
                  {sourcesByGroup[groupCode]?.length ? (
                    <ul>
                      {sourcesByGroup[groupCode].map((source) => (
                        <li key={`${source.roleCode}-${source.sourceRecordId}`}>
                          <span>{source.roleLabel}</span>
                          <strong>
                            {source.adoptedValue} {source.unitCode}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>该结果未返回分项来源。</p>
                  )}
                </div>
              ))}
            </section>
          </div>

          <section aria-label="计算明细" className="realtime-supply-detail">
            <header>
              <div>
                <h3>计算明细</h3>
                <p>逐步展示计算过程，不允许在本页直接修改核定值。</p>
              </div>
              <span>按核定规则逐步计算</span>
            </header>
            <div className="realtime-supply-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>步骤</th>
                    <th>计算表达式</th>
                    <th>结果</th>
                    <th>单位</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>01 汇总供给</td>
                    <td>∑ 供给来源</td>
                    <td>{display(activeAccount.totalSupply)}</td>
                    <td>万吨</td>
                  </tr>
                  <tr>
                    <td>02 汇总使用</td>
                    <td>∑ 使用与外流</td>
                    <td>{display(activeAccount.totalUse)}</td>
                    <td>万吨</td>
                  </tr>
                  <tr>
                    <td>03 计算库存</td>
                    <td>总供给 − 总使用</td>
                    <td>{display(activeAccount.calculatedEndingInventory)}</td>
                    <td>万吨</td>
                  </tr>
                  <tr>
                    <td>04 应用期末库存调整</td>
                    <td>计算期末库存 + 期末库存调整量</td>
                    <td>{display(activeAccount.adoptedEndingInventory)}</td>
                    <td>万吨</td>
                  </tr>
                  <tr>
                    <td>05 库存勾稽</td>
                    <td>采用期末库存 − 调查期末库存</td>
                    <td>
                      {display(activeAccount.inventoryReconciliationDifference)}
                    </td>
                    <td>万吨</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section aria-label="来源追溯" className="realtime-supply-detail">
            <header>
              <div>
                <h3>来源追溯</h3>
                <p>以下来源随本次测算一同保存，不受当前可选来源变化影响。</p>
              </div>
              <span>
                {activeAccount.inputSetId
                  ? "本次数据来源已保存"
                  : "暂无已保存的数据来源"}
              </span>
            </header>
            <div className="realtime-supply-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>计算项目</th>
                    <th>业务来源</th>
                    <th>来源记录</th>
                    <th>来源修订</th>
                    <th>来源字段</th>
                    <th>采用值</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAccount.sources.length > 0 ? (
                    activeAccount.sources.map((source) => (
                      <tr key={`${source.roleCode}-${source.sourceRecordId}`}>
                        <td>{source.roleLabel}</td>
                        <td>
                          {businessLabel(
                            sourceDomainLabels,
                            source.sourceDomain,
                            "其他业务来源",
                          )}
                        </td>
                        <td>已核定业务记录</td>
                        <td>第 {source.sourceVersion} 次修订</td>
                        <td>{source.roleLabel}</td>
                        <td>
                          {source.adoptedValue} {source.unitCode}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>该历史结果未返回可追溯来源明细。</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section
            className="realtime-supply-validation"
            aria-label="校验与追溯"
          >
            <div>
              <span>校验结论</span>
              <strong>
                {activeAccount.validationCodes.length > 0
                  ? activeAccount.validationCodes
                      .map((code) =>
                        businessLabel(validationLabels, code, "业务校验未通过"),
                      )
                      .join("、")
                  : "全部规则通过"}
              </strong>
            </div>
            <div>
              <span>库存调查值</span>
              <strong>
                {display(activeAccount.surveyedEndingInventory)} 万吨
              </strong>
            </div>
            <div>
              <span>结果状态</span>
              <strong>
                {businessLabel(
                  resultStateLabels,
                  activeAccount.resultState,
                  "已形成结果",
                )}
              </strong>
            </div>
            <div>
              <span>发布资格</span>
              <strong>{activeAccount.publishable ? "可发布" : "已阻断"}</strong>
            </div>
            <div>
              <span>结果完整性</span>
              <strong>
                {activeAccount.calculationChecksum
                  ? "校验通过"
                  : activeAccount.legacyReadOnly
                    ? "历史结果只读"
                    : "等待校验"}
              </strong>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
