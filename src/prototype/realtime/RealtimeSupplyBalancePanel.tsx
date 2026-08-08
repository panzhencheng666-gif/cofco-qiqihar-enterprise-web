import { useCallback, useEffect, useMemo, useState } from "react";
import {
  realtimeBusinessRepository,
  type RealtimeBusinessRepository,
  type SupplyAccountRow,
  type SupplyInputRole,
  type SupplyInputWorkspace,
} from "@/platform/api/realtimeBusinessRepository";

interface RealtimeSupplyBalancePanelProps {
  productCode?: string;
  regionCode?: string;
  marketingYear?: string;
  repository?: RealtimeBusinessRepository;
}

const roleGroups: Readonly<Record<string, string>> = {
  SUPPLY: "供给",
  USE: "使用与外流",
  RECONCILIATION: "库存勾稽",
};

function display(value: string | null | undefined): string {
  return value === null || value === undefined || value === "" ? "—" : value;
}

function formatError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "供需账户请求失败，请检查业务数据服务。";
}

function initialSelections(
  workspace: SupplyInputWorkspace,
): Record<string, string> {
  return Object.fromEntries(
    workspace.roles
      .map(
        (role) =>
          [
            role.code,
            role.selectedReleaseId ?? role.releases[0]?.id ?? "",
          ] as const,
      )
      .filter(([, releaseId]) => releaseId !== ""),
  );
}

function roleStatus(
  role: SupplyInputRole,
  selection: string | undefined,
): string {
  if (selection) return "已选择来源";
  if (role.required) return "缺少必填来源";
  return "可留空";
}

export function RealtimeSupplyBalancePanel({
  productCode = "CORN",
  regionCode = "230200",
  marketingYear = "2026-W32",
  repository = realtimeBusinessRepository,
}: RealtimeSupplyBalancePanelProps) {
  const [workspace, setWorkspace] = useState<SupplyInputWorkspace | null>(null);
  const [accounts, setAccounts] = useState<readonly SupplyAccountRow[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [manualReasons, setManualReasons] = useState<Record<string, string>>(
    {},
  );
  const [inputSetReason, setInputSetReason] =
    useState("业务工作台确认当前供需输入");
  const [adjustmentValue, setAdjustmentValue] = useState("0");
  const [adjustmentReason, setAdjustmentReason] =
    useState("业务工作台供需平衡调整说明");
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const latestAccount = accounts[0] ?? null;
  const selectedRequiredRoles = useMemo(
    () =>
      workspace?.roles.filter(
        (role) => role.required && selections[role.code],
      ) ?? [],
    [selections, workspace],
  );
  const missingRequiredRoles = useMemo(
    () =>
      workspace?.roles.filter(
        (role) => role.required && !selections[role.code],
      ) ?? [],
    [selections, workspace],
  );

  const reload = useCallback(async () => {
    try {
      const [nextWorkspace, nextAccounts] = await Promise.all([
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
      setWorkspace(nextWorkspace);
      setAccounts(nextAccounts);
      setError("");
      setSelections((current) => ({
        ...initialSelections(nextWorkspace),
        ...current,
      }));
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      setLoading(false);
    }
  }, [marketingYear, productCode, regionCode, repository]);

  useEffect(() => {
    queueMicrotask(() => {
      void reload();
    });
  }, [reload]);

  async function approveManual(role: SupplyInputRole) {
    const value = manualValues[role.code]?.trim() ?? "";
    const reason = manualReasons[role.code]?.trim() ?? "";
    if (!value || !reason || !workspace) {
      setError(`${role.label}需要填写数值和原因。`);
      return;
    }
    setBusyAction(`manual:${role.code}`);
    setError("");
    setNotice("");
    try {
      await repository.approveSupplyManualDecision({
        productCode,
        regionCode,
        marketingYear,
        roleCode: role.code,
        value,
        reason,
        expectedVersion: role.manualDecisionVersion,
      });
      setManualValues((current) => ({ ...current, [role.code]: "" }));
      setManualReasons((current) => ({ ...current, [role.code]: "" }));
      setNotice(`${role.label}手工决策已批准，正在刷新来源工作区。`);
      await reload();
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      setBusyAction(null);
    }
  }

  async function createInputSet() {
    if (!workspace) return;
    if (missingRequiredRoles.length > 0) {
      setError(
        `仍缺少必填来源：${missingRequiredRoles.map((role) => role.label).join("、")}`,
      );
      return;
    }
    setBusyAction("input-set");
    setError("");
    setNotice("");
    try {
      const result = await repository.createSupplyInputSet({
        productCode,
        regionCode,
        marketingYear,
        reason: inputSetReason.trim() || "确认当前供需输入",
        expectedVersion: workspace.inputSetVersion,
        items: selectedRequiredRoles.map((role) => ({
          roleCode: role.code,
          sourceReleaseId: selections[role.code],
        })),
      });
      setNotice(
        `输入集 ${result.id} 已创建（版本 ${result.version}），可以执行供需试算。`,
      );
      await reload();
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      setBusyAction(null);
    }
  }

  async function runAccount(publish: boolean) {
    if (!workspace?.latestInputSetId) {
      setError(
        "请先创建完整输入集，再执行供需计算。没有完整来源时系统会阻断计算。 ",
      );
      return;
    }
    setBusyAction(publish ? "publish" : "trial");
    setError("");
    setNotice("");
    try {
      const result = await repository.runSupplyAccount({
        productCode,
        regionCode,
        marketingYear,
        inputSetId: workspace.latestInputSetId,
        adjustmentProposalValue: adjustmentValue.trim() || "0",
        adjustmentProposalReason: adjustmentReason.trim() || "供需平衡调整说明",
        expectedDecisionVersion: workspace.decisionVersion,
        publish,
      });
      setNotice(
        `${publish ? "供需账户已发布" : "供需账户试算已完成"}：${result.resultState}，结果版本 ${result.resultVersion}。`,
      );
      await reload();
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      setBusyAction(null);
    }
  }

  if (loading && !workspace) {
    return (
      <section className="realtime-business-panel" aria-label="实时供需账户">
        <p>正在读取供需输入与结果……</p>
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
          <h2>实时供需平衡</h2>
          <p>
            {productCode} · {regionCode} · {marketingYear}
            。来源、输入集和计算结果均来自业务数据服务。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading || busyAction !== null}
        >
          刷新
        </button>
      </header>
      {error && (
        <p className="realtime-business-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="realtime-business-notice" role="status">
          {notice}
        </p>
      )}
      {!workspace ? (
        <p className="realtime-business-empty">
          供需输入工作区不可用。系统未使用其他账户替代当前结果。
        </p>
      ) : (
        <>
          <div className="realtime-supply-summary" aria-label="供需计算状态">
            <span>
              输入集版本 <strong>{workspace.inputSetVersion}</strong>
            </span>
            <span>
              决策版本 <strong>{workspace.decisionVersion}</strong>
            </span>
            <span>
              最近结果{" "}
              <strong>
                {latestAccount
                  ? `V${latestAccount.resultVersion} ${latestAccount.resultState}`
                  : "暂无"}
              </strong>
            </span>
            <span>
              平衡状态{" "}
              <strong>
                {latestAccount
                  ? latestAccount.balanced
                    ? "已平衡"
                    : "未平衡/阻断"
                  : "待计算"}
              </strong>
            </span>
          </div>
          <div className="realtime-supply-roles">
            {workspace.roles.map((role) => {
              const selected = selections[role.code] ?? "";
              return (
                <article key={role.code} className="realtime-supply-role">
                  <div className="realtime-supply-role-heading">
                    <strong>{role.label}</strong>
                    <span>
                      {roleGroups[role.groupCode] ?? role.groupCode} ·{" "}
                      {role.required ? "必填" : "可选"} ·{" "}
                      {roleStatus(role, selected)}
                    </span>
                  </div>
                  <label>
                    采用来源
                    <select
                      value={selected}
                      onChange={(event) =>
                        setSelections((current) => ({
                          ...current,
                          [role.code]: event.target.value,
                        }))
                      }
                    >
                      <option value="">未选择</option>
                      {role.releases.map((release) => (
                        <option key={release.id} value={release.id}>
                          {release.sourceDomain} / {release.sourceRecordId} /{" "}
                          {release.value} {release.unitCode} /{" "}
                          {release.qualityState}
                        </option>
                      ))}
                    </select>
                  </label>
                  {role.manualAllowed && (
                    <div className="realtime-supply-manual">
                      <input
                        aria-label={`${role.label}手工值`}
                        inputMode="decimal"
                        placeholder="手工值（万吨）"
                        value={manualValues[role.code] ?? ""}
                        onChange={(event) =>
                          setManualValues((current) => ({
                            ...current,
                            [role.code]: event.target.value,
                          }))
                        }
                      />
                      <input
                        aria-label={`${role.label}手工原因`}
                        placeholder="手工决策原因"
                        value={manualReasons[role.code] ?? ""}
                        onChange={(event) =>
                          setManualReasons((current) => ({
                            ...current,
                            [role.code]: event.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => void approveManual(role)}
                        disabled={busyAction !== null}
                      >
                        批准手工来源
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <div className="realtime-supply-actions">
            <input
              aria-label="输入集原因"
              value={inputSetReason}
              onChange={(event) => setInputSetReason(event.target.value)}
            />
            <button
              type="button"
              onClick={() => void createInputSet()}
              disabled={busyAction !== null || missingRequiredRoles.length > 0}
            >
              创建不可变输入集
            </button>
            <input
              aria-label="供需调整值"
              inputMode="decimal"
              value={adjustmentValue}
              onChange={(event) => setAdjustmentValue(event.target.value)}
            />
            <input
              aria-label="供需调整原因"
              value={adjustmentReason}
              onChange={(event) => setAdjustmentReason(event.target.value)}
            />
            <button
              type="button"
              onClick={() => void runAccount(false)}
              disabled={busyAction !== null || !workspace.latestInputSetId}
            >
              试算
            </button>
            <button
              type="button"
              onClick={() => void runAccount(true)}
              disabled={busyAction !== null || !workspace.latestInputSetId}
            >
              运行并发布
            </button>
          </div>
          {latestAccount && (
            <dl className="realtime-supply-result" aria-label="最近供需结果">
              <div>
                <dt>总供给</dt>
                <dd>{display(latestAccount.totalSupply)}</dd>
              </div>
              <div>
                <dt>总使用</dt>
                <dd>{display(latestAccount.totalUse)}</dd>
              </div>
              <div>
                <dt>计算期末库存</dt>
                <dd>{display(latestAccount.calculatedEndingInventory)}</dd>
              </div>
              <div>
                <dt>采用后期末库存</dt>
                <dd>{display(latestAccount.adoptedEndingInventory)}</dd>
              </div>
              <div>
                <dt>库存勾稽差额</dt>
                <dd>
                  {display(latestAccount.inventoryReconciliationDifference)}
                </dd>
              </div>
              <div>
                <dt>校验码</dt>
                <dd>
                  {latestAccount.validationCodes.length > 0
                    ? latestAccount.validationCodes.join("、")
                    : "无"}
                </dd>
              </div>
            </dl>
          )}
        </>
      )}
    </section>
  );
}
