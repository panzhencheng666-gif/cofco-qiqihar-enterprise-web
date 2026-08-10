import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  realtimeBusinessRepository,
  type MasterDataSnapshot,
  type RealtimeBusinessRepository,
  type SupplyAccountRow,
  type SupplyInputWorkspace,
} from "@/platform/api/realtimeBusinessRepository";

import { RealtimeRegionCascadePicker } from "./RealtimeRegionCascadePicker";

interface RealtimeSupplyBalancePanelProps {
  productCode?: string;
  regionCode?: string;
  marketingYear?: string;
  permissions?: readonly string[];
  repository?: RealtimeBusinessRepository;
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
  MANUAL: "核定调整",
};

const resultStateLabels: Readonly<Record<string, string>> = {
  DRAFT: "待核定",
  CALCULATED: "已计算",
  PUBLISHED: "已发布",
  TRIAL: "试算结果",
  FORMAL_CANDIDATE: "待发布",
  FORMAL: "已发布",
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
  marketingYear: initialMarketingYear = "2026-W32",
  permissions = [],
  repository = realtimeBusinessRepository,
}: RealtimeSupplyBalancePanelProps) {
  const [master, setMaster] = useState<MasterDataSnapshot | null>(null);
  const [productCode, setProductCode] = useState(initialProductCode);
  const [regionCode, setRegionCode] = useState(initialRegionCode);
  const [marketingYear, setMarketingYear] = useState(initialMarketingYear);
  const [workspace, setWorkspace] = useState<SupplyInputWorkspace | null>(null);
  const [accounts, setAccounts] = useState<readonly SupplyAccountRow[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [operationBusy, setOperationBusy] = useState(false);
  const [operationMessage, setOperationMessage] = useState("");
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
  const activeScope = `${productCode}|${regionCode}|${marketingYear}`;
  const activeScopeRef = useRef(activeScope);

  useEffect(() => {
    activeScopeRef.current = activeScope;
  }, [activeScope]);

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
      const [nextMaster, nextWorkspace, nextAccounts] = await Promise.all([
        repository.loadMasterData(),
        repository.loadSupplyInputWorkspace({
          productCode,
          regionCode,
          marketingYear,
        }),
        repository.listSupplyAccounts({
          productCode,
          regionCode,
          marketingYear,
        }),
      ]);
      if (sequence !== requestSequence.current) return;
      setMaster(nextMaster);
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
  }, [marketingYear, productCode, regionCode, repository]);

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

  function resetOperationDrafts(): void {
    setSelectedSources({});
    setManualDrafts({});
    setInputSetReason("");
    setInputSetId("");
    setAdjustmentValue("");
    setAdjustmentReason("");
    setOperationMessage("");
    setError("");
  }

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
    setOperationMessage("来源选择已变化，请重新固化本次测算来源。");
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
        marketingYear,
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
      setOperationMessage(`${role.label}已完成核定并写入来源记录。`);
    } catch {
      setError("人工来源核定未完成，请检查数值、依据和当前版本后重试。");
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
        marketingYear,
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
      setOperationMessage("本次测算来源已固化，可以进行试算或正式发布。");
    } catch {
      setError("测算来源未能固化，请确认全部必需来源已经核定且未被他人更新。");
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
        marketingYear,
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
          ? result.resultState === "FORMAL"
            ? "供需测算已运行并正式发布。"
            : "供需测算已完成，但校验未通过，结果未正式发布。"
          : "供需试算已完成，结果尚未正式发布。",
      );
    } catch {
      setError("供需测算未完成，请确认来源、调整说明和当前核定版本后重试。");
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
            展示核定结果、计算公式与不可变来源；被授权员工可在本页完成核定与发布。
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
        <label>
          <span>产品品种</span>
          <select
            aria-label="产品品种"
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
        <label>
          <span>统计时间</span>
          <select
            aria-label="统计时间"
            disabled={operationBusy}
            value={marketingYear}
            onChange={(event) =>
              changeScope(() => setMarketingYear(event.target.value))
            }
          >
            {master?.periods.map((period) => (
              <option key={period.code} value={period.code}>
                {period.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>测算批次</span>
          <select
            aria-label="测算批次"
            disabled={operationBusy || accounts.length === 0}
            value={activeAccount?.id ?? ""}
            onChange={(event) => setSelectedAccountId(event.target.value)}
          >
            {accounts.length === 0 ? (
              <option value="">暂无已形成结果</option>
            ) : (
              accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  第 {account.resultVersion} 次测算 · 第{" "}
                  {account.decisionVersion} 次核定
                </option>
              ))
            )}
          </select>
        </label>
      </section>

      {workspace && mayOperate && (
        <section
          aria-label="测算来源与发布"
          className="realtime-supply-operations"
        >
          <header>
            <div>
              <h3>测算来源核定</h3>
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
                  <label>
                    <span>采用来源</span>
                    <select
                      aria-label={`${role.label}采用来源`}
                      disabled={!mayCreateInputSet || operationBusy}
                      onChange={(event) =>
                        changeSelectedSource(role.code, event.target.value)
                      }
                      value={selectedSources[role.code] ?? ""}
                    >
                      <option value="">尚未选择</option>
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
                  {mayApprove && role.manualAllowed && (
                    <div className="realtime-supply-manual-fields">
                      <label>
                        <span>人工核定值</span>
                        <input
                          aria-label={`${role.label}人工核定值`}
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
                          value={manual.value}
                        />
                      </label>
                      <label>
                        <span>核定依据</span>
                        <input
                          aria-label={`${role.label}核定依据`}
                          onChange={(event) =>
                            setManualDrafts((current) => ({
                              ...current,
                              [role.code]: {
                                ...manual,
                                reason: event.target.value,
                              },
                            }))
                          }
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
                        核定{role.label}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {mayCreateInputSet && (
            <div className="realtime-supply-input-set">
              <label>
                <span>输入集采用理由</span>
                <textarea
                  aria-label="输入集采用理由"
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
                固化本次测算来源
              </button>
            </div>
          )}

          {mayUpdateCalculation && (
            <div className="realtime-supply-runner">
              <label>
                <span>核定调整</span>
                <input
                  aria-label="核定调整"
                  inputMode="decimal"
                  onChange={(event) => setAdjustmentValue(event.target.value)}
                  value={adjustmentValue}
                />
              </label>
              <label>
                <span>调整说明</span>
                <input
                  aria-label="调整说明"
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
            <p>完成全部必需来源的审核与输入集固化后，系统才会展示计算结论。</p>
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
                {activeAccount.decisionVersion} 次核定 · 来源已固化
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
                <dt>核定调整</dt>
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
                  <span>核定调整</span>
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
                          <span>{source.label}</span>
                          <strong>
                            {source.value} {source.unitCode}
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
                    <td>04 应用核定调整</td>
                    <td>计算期末库存 + 核定调整</td>
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
                <p>以下来源随本次测算一同固化，不读取当前工作区的可变选择。</p>
              </div>
              <span>
                {activeAccount.inputSetId ? "测算来源已固化" : "暂无固化来源"}
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
                        <td>{source.label}</td>
                        <td>
                          {businessLabel(
                            sourceDomainLabels,
                            source.sourceDomain,
                            "其他业务来源",
                          )}
                        </td>
                        <td>已核定业务记录</td>
                        <td>第 {source.sourceVersion} 次修订</td>
                        <td>{source.label}</td>
                        <td>
                          {source.value} {source.unitCode}
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
