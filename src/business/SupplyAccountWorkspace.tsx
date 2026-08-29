import { useCallback, useEffect, useMemo, useState } from "react";

import {
  RealtimeApiError,
  realtimeApiClient,
  type RealtimeApiClient,
} from "@/platform/api/realtimeApiClient";
import type {
  MasterDataSnapshot,
  RealtimeBusinessRepository,
  SupplySurveyPeriod,
} from "@/platform/api/realtimeBusinessRepository";

interface SupplyRelease {
  id: string;
  sourceDomain: string;
  sourceRecordId: string;
  sourceVersion: number;
  sourceFieldCode: string;
  value: string;
  unitCode: string;
  qualityState: string;
  approvedAt: string;
}

interface SupplyRole {
  code: string;
  label: string;
  groupCode: string;
  required: boolean;
  sortOrder: number;
  manualAllowed: boolean;
  manualDecisionVersion: number;
  selectedReleaseId: string | null;
  releases: readonly SupplyRelease[];
}

interface SupplyInputWorkspaceView {
  productCode: string;
  regionCode: string;
  periodCode: string;
  surveyYear: number;
  surveyQuarter: string | null;
  periodPrecision: string;
  marketingYear: string;
  inputSetVersion: number;
  latestInputSetId: string | null;
  decisionVersion: number;
  roles: readonly SupplyRole[];
}

interface SupplySourceSnapshot {
  roleCode: string;
  roleLabel: string;
  groupCode: string;
  sourceDomain: string;
  sourceRecordId: string;
  sourceVersion: number;
  sourceFieldCode: string;
  unitCode: string;
  approvalState: string;
  approvedAt: string;
  qualityState: string;
  sourceValue: string | null;
  adoptedValue: string | null;
  reason: string;
}

interface SupplyAccountView {
  id: string;
  resultVersion: number;
  resultState: string;
  validationCodes: readonly string[];
  balanced: boolean;
  publishable: boolean;
  totalSupply: string | null;
  totalUse: string | null;
  calculatedEndingInventory: string | null;
  approvedAdjustment: string | null;
  adoptedEndingInventory: string | null;
  surveyedEndingInventory: string | null;
  inventoryReconciliationDifference: string | null;
  calculatedByName: string | null;
  calculatedAt: string | null;
  formula: { name: string; version: number; tolerance: string };
  sources: readonly SupplySourceSnapshot[];
}

interface SupplyAccountPage {
  items: readonly SupplyAccountView[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
}

const sourceLabels: Readonly<Record<string, string>> = {
  PRODUCTION: "已审核产情",
  MARKET: "已确认合同的市场来源",
  LOGISTICS: "已审核物流",
  MANUAL: "人工核定",
};

const stateLabels: Readonly<Record<string, string>> = {
  DRAFT: "条件不足",
  CONFIRMED: "已核算",
  PUBLISHED: "已发布",
};

const validationLabels: Readonly<Record<string, string>> = {
  MISSING_REQUIRED_SOURCE: "缺少必需来源",
  SOURCE_QUALITY_NOT_PASSED: "来源质量校验未通过",
  OUTSIDE_INVENTORY_TOLERANCE: "库存核对差额超出容差",
  MISSING_SURVEYED_ENDING_INVENTORY: "缺少盘点期末库存",
};

function displayDecimal(value: string | null | undefined, unit = "万吨") {
  return value === null || value === undefined ? "未提供" : `${value} ${unit}`;
}

function displayTime(value: string | null | undefined) {
  if (!value) return "时间未记录";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? "时间未记录"
    : new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(parsed);
}

function issueMessage(error: unknown, fallback: string) {
  return error instanceof RealtimeApiError && error.clientMessage
    ? error.clientMessage
    : fallback;
}

function authorizedRegions(
  masterData: MasterDataSnapshot | undefined,
  authorizedRegionCodes: readonly string[],
) {
  if (!masterData) return [];
  const unrestricted = authorizedRegionCodes.includes("*");
  return masterData.regions.filter(
    (region) =>
      ["PREFECTURE", "COUNTY"].includes(region.level.toUpperCase()) &&
      (unrestricted ||
        authorizedRegionCodes.includes(region.code) ||
        (region.parentCode !== null &&
          authorizedRegionCodes.includes(region.parentCode))),
  );
}

export function SupplyAccountWorkspace({
  api = realtimeApiClient,
  authorizedRegionCodes,
  permissions,
  repository,
  section,
}: {
  api?: RealtimeApiClient;
  authorizedRegionCodes: readonly string[];
  permissions: readonly string[];
  repository: RealtimeBusinessRepository;
  section: "balance" | "records";
}) {
  const [masterData, setMasterData] = useState<MasterDataSnapshot>();
  const [periods, setPeriods] = useState<readonly SupplySurveyPeriod[]>([]);
  const [regionCode, setRegionCode] = useState("");
  const [productCode, setProductCode] = useState("");
  const [periodCode, setPeriodCode] = useState("");
  const [workspace, setWorkspace] = useState<SupplyInputWorkspaceView>();
  const [history, setHistory] = useState<readonly SupplyAccountView[]>([]);
  const [historyPageNumber, setHistoryPageNumber] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(0);
  const [selectedReleases, setSelectedReleases] = useState<
    Readonly<Record<string, string>>
  >({});
  const [manualValues, setManualValues] = useState<
    Readonly<Record<string, string>>
  >({});
  const [manualReasons, setManualReasons] = useState<
    Readonly<Record<string, string>>
  >({});
  const [inputSetReason, setInputSetReason] =
    useState("按已审核来源建立计算输入");
  const [adjustmentValue, setAdjustmentValue] = useState("0");
  const [adjustmentReason, setAdjustmentReason] = useState("无人工调整");
  const [issue, setIssue] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      repository.loadMasterData(),
      repository.loadSupplySurveyPeriods(),
    ])
      .then(([nextMasterData, nextPeriods]) => {
        if (!active) return;
        setMasterData(nextMasterData);
        setPeriods(nextPeriods);
        setRegionCode(
          authorizedRegions(nextMasterData, authorizedRegionCodes)[0]?.code ??
            "",
        );
        setProductCode(nextMasterData.products[0]?.code ?? "");
        setPeriodCode(nextPeriods[0]?.code ?? "");
      })
      .catch(() => {
        if (active) setIssue("供需统计口径加载失败，请重试。");
      });
    return () => {
      active = false;
    };
  }, [authorizedRegionCodes, repository]);

  const reload = useCallback(async () => {
    if (!productCode || !regionCode || !periodCode) return;
    setLoading(true);
    try {
      if (section === "balance") {
        const nextWorkspace = await api.get<SupplyInputWorkspaceView>(
          "/api/v1/supply-input-workspaces",
          { productCode, regionCode, periodCode },
        );
        setWorkspace(nextWorkspace);
        setSelectedReleases(
          Object.fromEntries(
            nextWorkspace.roles.flatMap((role) => {
              const selected = role.selectedReleaseId ?? role.releases[0]?.id;
              return selected ? [[role.code, selected]] : [];
            }),
          ),
        );
      }
      const nextHistory = await api.get<SupplyAccountPage>(
        "/api/v1/supply-accounts",
        {
          productCode,
          regionCode,
          periodCode,
          pageNumber: historyPageNumber,
          pageSize: 10,
        },
      );
      setHistory(
        [...nextHistory.items].sort(
          (left, right) => right.resultVersion - left.resultVersion,
        ),
      );
      setHistoryTotalPages(nextHistory.totalPages);
      setIssue(undefined);
    } catch (error) {
      setIssue(issueMessage(error, "供需数据读取失败，请重试。"));
    } finally {
      setLoading(false);
    }
  }, [api, historyPageNumber, periodCode, productCode, regionCode, section]);

  useEffect(() => {
    if (!productCode || !regionCode || !periodCode) return;
    let unsubscribe: (() => void) | undefined;
    let active = true;
    queueMicrotask(() => {
      if (active) void reload();
    });
    repository
      .listNotifications()
      .then(({ items }) =>
        Math.max(0, ...items.map(({ sequence }) => sequence)),
      )
      .catch(() => 0)
      .then(
        (afterSequence) => {
          if (!active) return;
          unsubscribe = repository.subscribeBusinessEvents(
            afterSequence,
            (event) => {
              const relevantAggregate =
                event.aggregateType.startsWith("SUPPLY_") ||
                [
                  "PRODUCTION_RECORD",
                  "MARKET_RECORD",
                  "LOGISTICS_RECORD",
                ].includes(event.aggregateType);
              const selectedPeriod = periods.find(
                ({ code }) => code === periodCode,
              );
              if (
                relevantAggregate &&
                (event.productCode === null ||
                  event.productCode === productCode) &&
                (event.surveyYear === null ||
                  event.surveyYear === undefined ||
                  event.surveyYear === selectedPeriod?.surveyYear) &&
                event.regionCodes.includes(regionCode)
              ) {
                void reload();
              }
            },
            () => setIssue("实时联动暂时中断，可点击刷新重新查询权威数据。"),
          );
        },
        () => {
          if (active)
            setIssue("实时联动暂时中断，可点击刷新重新查询权威数据。");
        },
      );
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [periodCode, periods, productCode, regionCode, reload, repository]);

  const regions = useMemo(
    () => authorizedRegions(masterData, authorizedRegionCodes),
    [authorizedRegionCodes, masterData],
  );
  const missingRoles =
    workspace?.roles.filter(
      (role) => role.required && !selectedReleases[role.code],
    ) ?? [];
  const latest = history[0];
  const canApprove = permissions.includes("BUSINESS_APPROVE");
  const canCreate = permissions.includes("BUSINESS_CREATE");
  const canCalculate = permissions.includes("BUSINESS_UPDATE");

  async function write(action: () => Promise<unknown>, fallback: string) {
    if (busy) return;
    setBusy(true);
    setIssue(undefined);
    try {
      await action();
      await reload();
    } catch (error) {
      setIssue(issueMessage(error, fallback));
    } finally {
      setBusy(false);
    }
  }

  async function approveManual(role: SupplyRole) {
    const value = manualValues[role.code];
    const reason = manualReasons[role.code]?.trim();
    if (value === undefined || value === "" || !reason) {
      setIssue(`请完整填写${role.label}的数值和核定依据。`);
      return;
    }
    await write(
      () =>
        api.post("/api/v1/supply-inputs/manual-decisions", {
          productCode,
          regionCode,
          periodCode,
          roleCode: role.code,
          value,
          reason,
          expectedVersion: role.manualDecisionVersion,
        }),
      `${role.label}核定失败，数据未保存。`,
    );
  }

  async function createInputSet() {
    if (!workspace || missingRoles.length > 0 || !inputSetReason.trim()) {
      setIssue("计算条件尚未完整，不能建立计算输入。");
      return;
    }
    await write(
      () =>
        api.post("/api/v1/supply-input-sets", {
          productCode,
          regionCode,
          periodCode,
          reason: inputSetReason.trim(),
          expectedVersion: workspace.inputSetVersion,
          items: workspace.roles.flatMap((role) => {
            const sourceReleaseId = selectedReleases[role.code];
            return sourceReleaseId
              ? [{ roleCode: role.code, sourceReleaseId }]
              : [];
          }),
        }),
      "计算输入建立失败，数据未保存。",
    );
  }

  async function calculate(publish: boolean) {
    if (!workspace?.latestInputSetId) {
      setIssue("请先建立完整的计算输入。");
      return;
    }
    if (adjustmentValue === "" || !adjustmentReason.trim()) {
      setIssue("请填写调整值和调整依据；无调整时填写 0。");
      return;
    }
    await write(
      () =>
        api.post("/api/v1/supply-accounts/runs", {
          productCode,
          regionCode,
          periodCode,
          inputSetId: workspace.latestInputSetId,
          adjustmentProposalValue: adjustmentValue,
          adjustmentProposalReason: adjustmentReason.trim(),
          expectedDecisionVersion: workspace.decisionVersion,
          publish,
        }),
      publish ? "发布失败，未生成假成功记录。" : "计算失败，未生成假成功记录。",
    );
  }

  return (
    <section
      className="regional-data-workspace supply-account-workspace"
      aria-label="供需账户"
    >
      <header className="supply-account-workspace__header">
        <div>
          <p className="supply-account-workspace__eyebrow">权威供需账户</p>
          <h2>{section === "records" ? "计算记录" : "供需平衡"}</h2>
          <p>按地区、统计期和品种统一采用已审核来源，计算规则由服务端保存。</p>
        </div>
        <button type="button" disabled={loading} onClick={() => void reload()}>
          刷新重查
        </button>
      </header>

      <div
        className="regional-data-workspace__filters supply-account-workspace__filters"
        aria-label="统计口径"
      >
        <label>
          <span>责任地区</span>
          <select
            value={regionCode}
            onChange={(event) => {
              setHistoryPageNumber(0);
              setRegionCode(event.target.value);
            }}
          >
            {regions.map((region) => (
              <option key={region.code} value={region.code}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>统计期</span>
          <select
            value={periodCode}
            onChange={(event) => {
              setHistoryPageNumber(0);
              setPeriodCode(event.target.value);
            }}
          >
            {periods.map((period) => (
              <option key={period.code} value={period.code}>
                {period.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>品种</span>
          <select
            value={productCode}
            onChange={(event) => {
              setHistoryPageNumber(0);
              setProductCode(event.target.value);
            }}
          >
            {masterData?.products.map((product) => (
              <option key={product.code} value={product.code}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="regional-data-workspace__notice supply-account-workspace__notice">
        市场台账当前不自动纳入供需账户，待业务口径确认；系统不会臆造市场字段映射。
      </p>

      {issue ? (
        <p
          className="regional-data-workspace__issue supply-account-workspace__issue"
          role="alert"
        >
          {issue}
        </p>
      ) : null}
      {loading ? <p role="status">正在读取权威供需数据…</p> : null}

      {section === "balance" && workspace ? (
        <>
          {missingRoles.length > 0 ? (
            <p className="supply-account-workspace__warning" role="alert">
              计算条件未完整：缺少
              {missingRoles.map((role) => role.label).join("、")}
            </p>
          ) : (
            <p className="supply-account-workspace__ready" role="status">
              计算条件已完整
            </p>
          )}
          <div className="regional-data-workspace__table-wrap supply-account-workspace__table-wrap">
            <table>
              <thead>
                <tr>
                  <th>业务字段</th>
                  <th>来源</th>
                  <th>采用值</th>
                  <th>规则</th>
                  <th>人工核定</th>
                </tr>
              </thead>
              <tbody>
                {workspace.roles.map((role) => {
                  const releaseId = selectedReleases[role.code];
                  const release = role.releases.find(
                    ({ id }) => id === releaseId,
                  );
                  return (
                    <tr key={role.code}>
                      <th scope="row">
                        {role.label}
                        {role.required ? (
                          <span aria-label="必填"> *</span>
                        ) : null}
                      </th>
                      <td>
                        {role.releases.length > 1 ? (
                          <select
                            aria-label={`${role.label}数据来源`}
                            value={releaseId ?? ""}
                            onChange={(event) =>
                              setSelectedReleases((current) => ({
                                ...current,
                                [role.code]: event.target.value,
                              }))
                            }
                          >
                            {role.releases.map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {sourceLabels[candidate.sourceDomain] ??
                                  "已审核业务来源"}{" "}
                                · {displayTime(candidate.approvedAt)}
                              </option>
                            ))}
                          </select>
                        ) : release ? (
                          (sourceLabels[release.sourceDomain] ??
                          "已审核业务来源")
                        ) : (
                          "尚无可采用来源"
                        )}
                      </td>
                      <td>
                        {release
                          ? displayDecimal(release.value, release.unitCode)
                          : "未提供"}
                      </td>
                      <td>
                        {role.groupCode === "SUPPLY"
                          ? "计入总供给"
                          : role.groupCode === "USE"
                            ? "计入总需求"
                            : "用于库存核对"}
                      </td>
                      <td>
                        {role.manualAllowed && canApprove ? (
                          <div className="supply-account-workspace__manual">
                            <input
                              aria-label={`${role.label}人工核定值`}
                              inputMode="decimal"
                              placeholder="万吨"
                              value={manualValues[role.code] ?? ""}
                              onChange={(event) =>
                                setManualValues((current) => ({
                                  ...current,
                                  [role.code]: event.target.value,
                                }))
                              }
                            />
                            <input
                              aria-label={`${role.label}核定依据`}
                              placeholder="核定依据"
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
                              disabled={busy}
                              onClick={() => void approveManual(role)}
                            >
                              核定
                            </button>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="regional-data-workspace__actions supply-account-workspace__actions">
            <label>
              <span>输入快照说明</span>
              <input
                value={inputSetReason}
                onChange={(event) => setInputSetReason(event.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={busy || !canCreate || missingRoles.length > 0}
              onClick={() => void createInputSet()}
            >
              建立计算输入
            </button>
            <label>
              <span>库存调整（万吨）</span>
              <input
                inputMode="decimal"
                value={adjustmentValue}
                onChange={(event) => setAdjustmentValue(event.target.value)}
              />
            </label>
            <label>
              <span>调整依据</span>
              <input
                value={adjustmentReason}
                onChange={(event) => setAdjustmentReason(event.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={busy || !canCalculate || !workspace.latestInputSetId}
              onClick={() => void calculate(false)}
            >
              生成计算记录
            </button>
            <button
              type="button"
              disabled={
                busy ||
                !canCalculate ||
                !canApprove ||
                !workspace.latestInputSetId
              }
              onClick={() => void calculate(true)}
            >
              审核并发布
            </button>
          </div>

          <section
            className="supply-account-workspace__result"
            aria-label="最近计算结果"
          >
            <h3>最近计算结果</h3>
            {latest ? (
              <ResultSummary value={latest} />
            ) : (
              <p>尚无计算记录；缺少条件时不会伪造数值。</p>
            )}
          </section>
        </>
      ) : null}

      {section === "records" && !loading ? (
        <div className="supply-account-workspace__history">
          {history.length === 0 ? (
            <p>当前统计口径尚无计算记录。</p>
          ) : (
            history.map((record) => (
              <HistoryCard key={record.id} record={record} />
            ))
          )}
          {historyTotalPages > 1 ? (
            <nav aria-label="计算记录分页">
              <button
                type="button"
                disabled={historyPageNumber === 0}
                onClick={() =>
                  setHistoryPageNumber((current) => Math.max(0, current - 1))
                }
              >
                上一页
              </button>
              <span>
                第 {historyPageNumber + 1} / {historyTotalPages} 页
              </span>
              <button
                type="button"
                disabled={historyPageNumber + 1 >= historyTotalPages}
                onClick={() => setHistoryPageNumber((current) => current + 1)}
              >
                下一页
              </button>
            </nav>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ResultSummary({ value }: { value: SupplyAccountView }) {
  return (
    <dl className="supply-account-workspace__metrics">
      <div>
        <dt>总供给</dt>
        <dd>{displayDecimal(value.totalSupply)}</dd>
      </div>
      <div>
        <dt>总需求</dt>
        <dd>{displayDecimal(value.totalUse)}</dd>
      </div>
      <div>
        <dt>计算期末库存</dt>
        <dd>{displayDecimal(value.calculatedEndingInventory)}</dd>
      </div>
      <div>
        <dt>采用期末库存</dt>
        <dd>{displayDecimal(value.adoptedEndingInventory)}</dd>
      </div>
      <div>
        <dt>库存核对差额</dt>
        <dd>{displayDecimal(value.inventoryReconciliationDifference)}</dd>
      </div>
    </dl>
  );
}

function HistoryCard({ record }: { record: SupplyAccountView }) {
  const state = stateLabels[record.resultState] ?? "状态待确认";
  return (
    <article
      className="supply-account-workspace__record"
      aria-label={`第${record.resultVersion}版 ${state}`}
    >
      <header>
        <h3>
          第{record.resultVersion}版 · {state}
        </h3>
        <p>
          {record.calculatedByName ?? "操作者已留痕"} ·{" "}
          {displayTime(record.calculatedAt)}
        </p>
      </header>
      <p>
        公式快照：{record.formula.name} V{record.formula.version}（容差{" "}
        {record.formula.tolerance} 万吨）
      </p>
      {record.validationCodes.length > 0 ? (
        <p className="supply-account-workspace__warning">
          计算说明：
          {record.validationCodes
            .map((code) => validationLabels[code] ?? "存在待完善计算条件")
            .join("；")}
        </p>
      ) : null}
      <ResultSummary value={record} />
      <details open>
        <summary>本次采用的输入快照</summary>
        {record.sources.length === 0 ? (
          <p>本次未形成完整输入快照。</p>
        ) : (
          <ul>
            {record.sources.map((source) => (
              <li key={`${source.roleCode}:${source.sourceVersion}`}>
                <strong>{source.roleLabel}</strong>：
                {sourceLabels[source.sourceDomain] ?? "已审核业务来源"}，采用{" "}
                {displayDecimal(source.adoptedValue, source.unitCode)}；
                {source.reason}
              </li>
            ))}
          </ul>
        )}
      </details>
    </article>
  );
}
