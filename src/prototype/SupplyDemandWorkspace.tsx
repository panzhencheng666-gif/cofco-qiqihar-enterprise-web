import { useEffect, useState } from "react";
import type {
  BusinessReportContext,
  BusinessReportRequest,
} from "./businessReportModel";
import { QuickReportExportMenu } from "./components/QuickReportExportMenu";
import {
  transitionBusinessWork,
  type BusinessWorkItem,
  type BusinessWorkTransitionContext,
} from "./core/businessWork";
import {
  getEnterpriseScopeRegion,
  type EnterpriseRegionId,
} from "./enterpriseRegions";
import type {
  BusinessCoordinates,
  FormalRoute,
  FormalSelection,
  SupplySection,
} from "./formalEnterpriseModel";
import type { OperationalScope } from "./core/operationalScope";
import {
  filterPlatformMasterDataByAuthorization,
  platformProducts,
} from "./core/platformMasterData";
import {
  qiqiharCornSupplyAccountSnapshot,
  qiqiharSupplyAccountSnapshots,
  type SupplyAccountComparisonRow,
  type SupplyAccountRow,
  type SupplyAccountSnapshot,
} from "./data/supplyAccountSnapshot";
import { businessWorkFixtures } from "./data/businessWorkFixtures";
import { approvedBusinessReportDatasets } from "./data/businessReportDatasets";
import { projectDomainTasks } from "./application/businessWorkProjection";
import { businessClassificationFixtures } from "./formalEnterpriseData";
import {
  WorkspaceRegionSelect,
  FormalWorkspaceScopeProvider,
  useFormalWorkspaceScope,
  useWorkspaceRegion,
  WorkspaceStatus,
  WorkspaceTable,
  WorkspaceTableToolbar,
  type WorkspaceTone,
} from "./UnifiedWorkspacePrimitives";

export interface SupplyDemandWorkspaceProps {
  section: SupplySection;
  onComposeReport: (context: BusinessReportContext) => void;
  queryAllowed?: boolean;
  requestedWorkItem?: BusinessWorkItem;
  requestedSelectionUnavailable?: boolean;
  onWorkItemChange?: (item: BusinessWorkItem) => void;
}

type SupplyProduct =
  | "corn"
  | "soybean"
  | "soymeal"
  | "soyoil"
  | "soy-protein"
  | "paddy"
  | "rice"
  | "wheat";

type BalanceRow = SupplyAccountRow;

const productLabels: Record<SupplyProduct, string> = {
  corn: "玉米原粮",
  soybean: "大豆原粮",
  soymeal: "豆粕",
  soyoil: "豆油",
  "soy-protein": "大豆蛋白产品",
  paddy: "稻谷原粮",
  rice: "大米产品",
  wheat: "小麦原粮",
};

type SupplyMarketingYear = "" | "2026-27" | "2025-26";
type SupplyApprovalRecord =
  "" | "all" | "approval-3" | "approval-2" | "approval-1";

interface SupplyQuery {
  regionId: EnterpriseRegionId;
  product: SupplyProduct;
  marketingYear: Exclude<SupplyMarketingYear, "">;
  approval: Exclude<SupplyApprovalRecord, "">;
}

const approvalBySupplyAccountVersion: Readonly<
  Record<string, Exclude<SupplyApprovalRecord, "" | "all">>
> = Object.freeze({
  "ACCOUNT-VERSION-CORN-2026-1": "approval-1",
  "ACCOUNT-VERSION-CORN-2026-2": "approval-2",
  ...Object.fromEntries(
    qiqiharSupplyAccountSnapshots.map((snapshot) => [
      snapshot.accountVersionId,
      snapshot.approvalId,
    ]),
  ),
});

function queryForSupplyWorkItem(
  item: BusinessWorkItem | undefined,
): SupplyQuery | null {
  if (
    item?.domain !== "supply" ||
    item.subject.kind !== "supply-account" ||
    item.subject.productAccountId !== "PRODUCT-ACCOUNT-CORN-2026" ||
    item.regionId !== qiqiharCornSupplyAccountSnapshot.regionId ||
    item.periodKey !== "2026"
  ) {
    return null;
  }
  const approval =
    approvalBySupplyAccountVersion[item.subject.accountVersionId];
  if (!approval) return null;
  return {
    regionId: qiqiharCornSupplyAccountSnapshot.regionId,
    product: qiqiharCornSupplyAccountSnapshot.productId,
    marketingYear: qiqiharCornSupplyAccountSnapshot.marketingYearId,
    approval,
  };
}

const marketingYearLabels: Record<Exclude<SupplyMarketingYear, "">, string> = {
  "2026-27": "2026/27 营销年度",
  "2025-26": "2025/26 营销年度",
};

const approvalRecordLabels: Record<
  Exclude<SupplyApprovalRecord, "">,
  string
> = {
  all: "全部核定记录",
  "approval-3": "第3次核定（当前采用）",
  "approval-2": "第2次核定（已由后续记录替代）",
  "approval-1": "初次核定（历史记录）",
};

function isSupplyProduct(value: string | undefined): value is SupplyProduct {
  return Boolean(
    value && Object.prototype.hasOwnProperty.call(productLabels, value),
  );
}

function isSameSupplyQuery(
  query: SupplyQuery,
  draft: {
    regionId: EnterpriseRegionId;
    product: SupplyProduct | "";
    marketingYear: SupplyMarketingYear;
    approval: SupplyApprovalRecord;
  },
): boolean {
  return (
    query.regionId === draft.regionId &&
    query.product === draft.product &&
    query.marketingYear === draft.marketingYear &&
    query.approval === draft.approval
  );
}

function isExactAccountHistory(query: SupplyQuery): boolean {
  return qiqiharSupplyAccountSnapshots.some(
    (snapshot) =>
      query.regionId === snapshot.regionId &&
      query.product === snapshot.productId &&
      query.marketingYear === snapshot.marketingYearId,
  );
}

function supplyAccountForQuery(
  query: SupplyQuery,
): SupplyAccountSnapshot | null {
  return (
    qiqiharSupplyAccountSnapshots.find(
      (snapshot) =>
        query.regionId === snapshot.regionId &&
        query.product === snapshot.productId &&
        query.marketingYear === snapshot.marketingYearId &&
        query.approval === snapshot.approvalId,
    ) ?? null
  );
}

type SupplyComparisonRow = SupplyAccountComparisonRow;

function supplyReportDataset(product: SupplyProduct) {
  const reportProducts: Partial<Record<SupplyProduct, string>> = {
    corn: "玉米",
    soybean: "大豆",
    paddy: "稻谷",
  };
  const reportProduct = reportProducts[product];
  if (!reportProduct) return undefined;
  return approvedBusinessReportDatasets.find(
    (dataset) =>
      dataset.application === "supply" &&
      dataset.product === reportProduct &&
      dataset.dataBatchId === "SUPPLY-2026-MY-APPROVED",
  );
}

function amount(value: number): string {
  return `${value.toFixed(1)} 万吨`;
}

function change(current: number, previous: number): string {
  const difference = Number((current - previous).toFixed(1));
  if (difference === 0) return "持平";
  return `${difference > 0 ? "+" : ""}${difference.toFixed(1)} 万吨`;
}

function growthRate(current: number, previous: number): string {
  if (previous === 0) return "基期为零，无法计算";
  const rate = ((current - previous) / previous) * 100;
  if (Math.abs(rate) < 0.05) return "持平";
  return `${rate > 0 ? "+" : ""}${rate.toFixed(1)}%`;
}

function compoundGrowth(values: SupplyComparisonRow["values"]): string {
  if (values[0] <= 0 || values[3] < 0) return "暂不可计算";
  const rate = (Math.pow(values[3] / values[0], 1 / 3) - 1) * 100;
  return `${rate > 0 ? "+" : ""}${rate.toFixed(1)}%`;
}

function SupplyFourYearChart({
  rows,
}: {
  rows: readonly SupplyComparisonRow[];
}) {
  const years = [2023, 2024, 2025, 2026] as const;
  const x = [72, 252, 432, 612] as const;
  const colors = ["#1E625F", "#327F78", "#7B6A3D", "#B26A37"] as const;
  const maxValue = 800;
  const y = (value: number) => 230 - (value / maxValue) * 170;
  return (
    <figure className="supply-comparison-chart">
      <svg aria-label="供需核心指标四年趋势图" role="img" viewBox="0 0 690 285">
        <title>供需核心指标四年趋势图</title>
        {[0, 200, 400, 600, 800].map((tick) => (
          <g key={tick}>
            <line x1="58" x2="632" y1={y(tick)} y2={y(tick)} />
            <text x="48" y={y(tick) + 4} textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        {rows.map((row, rowIndex) => (
          <g key={row.label}>
            <polyline
              fill="none"
              points={row.values
                .map((value, index) => `${x[index]},${y(value)}`)
                .join(" ")}
              stroke={colors[rowIndex]}
              strokeWidth="3"
            />
            {row.values.map((value, index) => (
              <circle
                cx={x[index]}
                cy={y(value)}
                fill={colors[rowIndex]}
                key={`${row.label}-${years[index]}`}
                r="4"
              />
            ))}
          </g>
        ))}
        {years.map((year, index) => (
          <text key={year} textAnchor="middle" x={x[index]} y="260">
            {year}年
          </text>
        ))}
      </svg>
      <figcaption>
        {rows.map((row, index) => (
          <span key={row.label}>
            <i style={{ backgroundColor: colors[index] }} />
            {row.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

interface SupplyFilterControlsProps {
  product: SupplyProduct | "";
  productOptions: readonly SupplyProduct[];
  showProduct: boolean;
  marketingYear: SupplyMarketingYear;
  approval: SupplyApprovalRecord;
  canQuery: boolean;
  onProductChange: (product: SupplyProduct | "") => void;
  onMarketingYearChange: (year: SupplyMarketingYear) => void;
  onApprovalChange: (approval: SupplyApprovalRecord) => void;
  onQuery: () => void;
  onReset: () => void;
}

function SupplyFilterControls({
  product,
  productOptions,
  showProduct,
  marketingYear,
  approval,
  canQuery,
  onProductChange,
  onMarketingYearChange,
  onApprovalChange,
  onQuery,
  onReset,
}: SupplyFilterControlsProps) {
  return (
    <section
      aria-label="供需账户查询条件"
      className="enterprise-ledger-query enterprise-ledger-query--supply"
      role="search"
    >
      <WorkspaceRegionSelect />
      {showProduct && (
        <label>
          <span>产品账户</span>
          <select
            aria-label="产品账户"
            value={product}
            onChange={(event) => {
              const next = event.target.value;
              onProductChange(isSupplyProduct(next) ? next : "");
            }}
          >
            <option value="">请选择产品账户</option>
            {productOptions.map((productId) => (
              <option key={productId} value={productId}>
                {productLabels[productId]}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        <span>营销年度</span>
        <select
          aria-label="营销年度"
          value={marketingYear}
          onChange={(event) =>
            onMarketingYearChange(event.target.value as SupplyMarketingYear)
          }
        >
          <option value="">请选择营销年度</option>
          {Object.entries(marketingYearLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>账户核定记录</span>
        <select
          aria-label="账户核定记录"
          value={approval}
          onChange={(event) =>
            onApprovalChange(event.target.value as SupplyApprovalRecord)
          }
        >
          <option value="">请选择核定记录</option>
          {Object.entries(approvalRecordLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="enterprise-ledger-query__actions">
        <button
          className="is-primary"
          disabled={!canQuery}
          type="button"
          onClick={onQuery}
        >
          查询
        </button>
        <button type="button" onClick={onReset}>
          重置
        </button>
      </div>
    </section>
  );
}

function SupplyEmptyResult({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <section aria-label="供需查询结果" className="supply-empty-result">
      <strong>{title}</strong>
      <p>{detail}</p>
    </section>
  );
}

function SupplyStatementResult({
  query,
  selectedSource,
  onSourceChange,
}: {
  query: SupplyQuery | null;
  selectedSource: BalanceRow | null;
  onSourceChange: (row: BalanceRow | null) => void;
}) {
  if (!query) {
    return (
      <SupplyEmptyResult
        detail="请选择地区、产品账户、营销年度和核定记录。"
        title="请完成筛选并查询供需账户"
      />
    );
  }
  const region = getEnterpriseScopeRegion(query.regionId);
  const snapshot = supplyAccountForQuery(query);
  if (!region || !snapshot) {
    return (
      <SupplyEmptyResult
        detail={`${region?.label ?? "未选择地区"} · ${productLabels[query.product]} · ${marketingYearLabels[query.marketingYear]}。系统未用其他地区或产品的数据替代。`}
        title="当前筛选范围尚无已核定供需账户"
      />
    );
  }

  const { calculation, conclusion, equation, reconciliationDecision } =
    snapshot;
  const resultStateLabel =
    snapshot.resultState === "formal"
      ? "正式计算结果"
      : snapshot.resultState === "formal-candidate"
        ? "待核定计算结果"
        : "试算结果";
  const balanceRows = snapshot.balanceRows;

  return (
    <div className="supply-primary-result">
      <section
        aria-label="本次供需测算结果"
        className="supply-calculation-result"
      >
        <header>
          <div>
            <span>本次供需计算</span>
            <h2>{resultStateLabel}</h2>
          </div>
          <div>
            <WorkspaceStatus
              tone={snapshot.resultState === "formal" ? "good" : "warning"}
            >
              {resultStateLabel}
            </WorkspaceStatus>
            <small>数据截止：{snapshot.dataCutoff}</small>
          </div>
        </header>
        <p className="supply-calculation-result__purpose">
          计算目标：根据已核定的期初库存、本地生产、流入流出、消费、加工和损耗，计算本营销年度采用后期末库存。
        </p>
        <div className="supply-calculation-result__equations">
          <p>总供给 = 期初库存 + 本地生产 + 区域外流入 + 国际进口 + 其他供给</p>
          <p>
            总使用与外流 = 口粮消费 + 饲用消费 + 种用消费 + 加工投入 + 损耗 +
            区域外流出 + 国际出口 + 其他使用
          </p>
          <p>采用后期末库存 = 总供给 − 总使用与外流 + 批准库存调整</p>
        </div>
        <div className="supply-calculation-result__outcome">
          <div>
            <span>账面计算</span>
            <strong>
              总供给 {amount(equation.totalSupply)} − 总使用与外流{" "}
              {amount(equation.totalUse)} = 账面期末库存{" "}
              {amount(equation.bookEnding)}
            </strong>
            <small>
              加批准库存调整 {amount(equation.approvedAdjustment)}
              ，采用后期末库存为 {amount(equation.adoptedEnding)}。
            </small>
          </div>
          <div>
            <span>库存核对</span>
            <strong>
              采用后期末库存 {amount(calculation.adoptedEndingInventory)} −
              调查汇总期末 {amount(calculation.surveyedEndingInventory)} =
              账面与调查差额 {amount(calculation.bookDifference)}
            </strong>
            <small>{conclusion.reconciliationDetail}</small>
          </div>
        </div>
        <footer>
          <div>
            <strong>
              {conclusion.bookClosureLabel} · {conclusion.reconciliationLabel}
            </strong>
            <small>{conclusion.bookClosureDetail}</small>
          </div>
          <div>
            <WorkspaceStatus tone="good">
              {reconciliationDecision.explanationLabel}
            </WorkspaceStatus>
            <small>
              核对依据：{reconciliationDecision.explanationReferenceLabel} ·
              {reconciliationDecision.approvedBy}于
              {reconciliationDecision.approvedAt}确认
            </small>
            <small>下一步：{reconciliationDecision.nextAction}</small>
          </div>
        </footer>
      </section>
      <WorkspaceTableToolbar
        note="单位：万吨"
        title={`${region.label} · ${productLabels[query.product]} · ${marketingYearLabels[query.marketingYear]}`}
      />
      <div className="unified-table-scroll supply-statement-scroll">
        <table
          aria-label="区域粮食供需平衡表数据"
          className="unified-table supply-statement-table"
        >
          <thead>
            <tr>
              <th scope="col">业务段</th>
              <th scope="col">平衡表项目</th>
              <th scope="col">本期数</th>
              <th scope="col">上期数</th>
              <th scope="col">变化</th>
              <th scope="col">来源业务</th>
              <th scope="col">数据来源</th>
              <th scope="col">状态</th>
              <th scope="col">操作</th>
            </tr>
          </thead>
          <tbody>
            {balanceRows.map((row, index) => {
              const showGroup =
                index === 0 || balanceRows[index - 1]?.group !== row.group;
              const groupSize = balanceRows.filter(
                (candidate) => candidate.group === row.group,
              ).length;
              return (
                <tr
                  className={row.total ? "is-total" : undefined}
                  key={row.item}
                >
                  {showGroup && (
                    <th rowSpan={groupSize} scope="rowgroup">
                      {row.group}
                    </th>
                  )}
                  <th scope="row">{row.item}</th>
                  <td>{amount(row.current)}</td>
                  <td>{amount(row.previous)}</td>
                  <td>{change(row.current, row.previous)}</td>
                  <td>{row.sourceBusiness}</td>
                  <td>{row.sourceBatchLabel}</td>
                  <td>
                    <WorkspaceStatus tone={row.tone}>
                      {row.status}
                    </WorkspaceStatus>
                  </td>
                  <td>
                    <button
                      aria-label={`查看${row.item}来源`}
                      className="unified-table-action"
                      type="button"
                      onClick={() => onSourceChange(row)}
                    >
                      查看来源
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selectedSource && (
        <section
          aria-label={`${selectedSource.item}来源详情`}
          className="supply-source-detail"
        >
          <header>
            <strong>{selectedSource.item}来源详情</strong>
            <button type="button" onClick={() => onSourceChange(null)}>
              关闭
            </button>
          </header>
          <dl>
            <div>
              <dt>来源业务</dt>
              <dd>{selectedSource.sourceBusiness}</dd>
            </div>
            <div>
              <dt>数据来源</dt>
              <dd>{selectedSource.sourceBatchLabel}</dd>
            </div>
            <div>
              <dt>统计地区</dt>
              <dd>{region.label}</dd>
            </div>
            <div>
              <dt>采用数值</dt>
              <dd>{amount(selectedSource.current)}</dd>
            </div>
            <div>
              <dt>数据状态</dt>
              <dd>{selectedSource.status}</dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
}

function SupplyComparisonResult({ query }: { query: SupplyQuery | null }) {
  if (!query) {
    return (
      <SupplyEmptyResult
        detail="请选择完整账户范围，系统仅对连续核定且口径一致的数据进行比较。"
        title="请完成筛选并查询四年对比"
      />
    );
  }
  const snapshot = supplyAccountForQuery(query);
  if (!snapshot) {
    const region = getEnterpriseScopeRegion(query.regionId);
    return (
      <SupplyEmptyResult
        detail={`${region?.label ?? "未选择地区"} · ${productLabels[query.product]} · ${marketingYearLabels[query.marketingYear]}。系统未用其他账户的历年数据补齐。`}
        title="当前筛选范围尚无四年连续已核定数据"
      />
    );
  }
  return (
    <div className="supply-primary-result">
      <section aria-label="供需四年趋势" className="supply-comparison-region">
        <h2>核心指标趋势</h2>
        <p>统一按万吨统计；每个年度均采用当期已核定账户。</p>
        <SupplyFourYearChart rows={snapshot.comparisonRows} />
      </section>
      <div className="unified-table-scroll supply-comparison-scroll">
        <table
          aria-label="供需核心指标四年对比"
          className="unified-table supply-comparison-table"
        >
          <thead>
            <tr>
              <th scope="col">指标</th>
              <th scope="col">2023年</th>
              <th scope="col">2024年同比</th>
              <th scope="col">2025年同比</th>
              <th scope="col">2026年同比</th>
              <th scope="col">三年复合增长率</th>
              <th scope="col">说明</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.comparisonRows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>
                  {row.values[0].toFixed(1)} {row.unit}
                </td>
                {[1, 2, 3].map((index) => (
                  <td key={`${row.label}-${String(index)}`}>
                    <strong>
                      {row.values[index].toFixed(1)} {row.unit}
                    </strong>
                    <small>
                      {growthRate(row.values[index], row.values[index - 1])}
                    </small>
                  </td>
                ))}
                <td>{compoundGrowth(row.values)}</td>
                <td>
                  <WorkspaceStatus tone={row.tone}>
                    {row.tone === "warning" ? "需核对" : "连续可比"}
                  </WorkspaceStatus>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface SupplyApprovalHistoryRow {
  id: Exclude<SupplyApprovalRecord, "" | "all">;
  order: string;
  status: string;
  tone: WorkspaceTone;
  publishedAt: string;
}

const supplyApprovalHistoryRows: readonly SupplyApprovalHistoryRow[] = [
  {
    id: "approval-3",
    order: "第3次核定",
    status: "当前采用",
    tone: "good",
    publishedAt: "2026年7月31日 16:20",
  },
  {
    id: "approval-2",
    order: "第2次核定",
    status: "已由后续核定记录替代",
    tone: "normal",
    publishedAt: "2026年7月24日 16:10",
  },
  {
    id: "approval-1",
    order: "初次核定",
    status: "历史核定记录",
    tone: "normal",
    publishedAt: "2026年7月17日 15:50",
  },
];

function SupplyApprovalHistoryResult({ query }: { query: SupplyQuery | null }) {
  const [selectedRecordId, setSelectedRecordId] = useState<
    SupplyApprovalHistoryRow["id"] | null
  >(null);
  if (!query) {
    return (
      <SupplyEmptyResult
        detail="请选择地区、产品账户、营销年度和要查询的核定记录。"
        title="请完成筛选并查询核定记录"
      />
    );
  }
  if (!isExactAccountHistory(query)) {
    const region = getEnterpriseScopeRegion(query.regionId);
    return (
      <SupplyEmptyResult
        detail={`${region?.label ?? "未选择地区"} · ${productLabels[query.product]} · ${marketingYearLabels[query.marketingYear]}。系统未展示其他账户的核定记录。`}
        title="当前筛选范围尚无供需账户核定记录"
      />
    );
  }
  const rows = supplyApprovalHistoryRows.filter(
    (row) => query.approval === "all" || row.id === query.approval,
  );
  const selectedRecord = rows.find((row) => row.id === selectedRecordId);
  return (
    <div className="supply-primary-result">
      <WorkspaceTableToolbar
        note={`共 ${String(rows.length)} 条`}
        title="供需账户核定记录"
      />
      <WorkspaceTable
        columns={[
          "核定次序",
          "地区",
          "产品账户",
          "状态",
          "编制人",
          "审核人",
          "发布时间",
          "操作",
        ]}
        label="供需账户核定记录"
        rows={rows.map((row) => [
          row.order,
          "齐齐哈尔市全域",
          productLabels[query.product],
          <WorkspaceStatus key={`${row.id}-status`} tone={row.tone}>
            {row.status}
          </WorkspaceStatus>,
          "王洋",
          "赵晨",
          row.publishedAt,
          <button
            className="unified-table-action"
            key={`${row.id}-view`}
            type="button"
            onClick={() => setSelectedRecordId(row.id)}
          >
            查看核定详情
          </button>,
        ])}
      />
      {selectedRecord && (
        <section
          aria-label={`${selectedRecord.order}详情`}
          className="supply-source-detail"
        >
          <header>
            <strong>{selectedRecord.order}详情</strong>
            <button type="button" onClick={() => setSelectedRecordId(null)}>
              关闭
            </button>
          </header>
          <dl>
            <div>
              <dt>核定状态</dt>
              <dd>{selectedRecord.status}</dd>
            </div>
            <div>
              <dt>账户范围</dt>
              <dd>齐齐哈尔市全域 · 玉米原粮</dd>
            </div>
            <div>
              <dt>营销年度</dt>
              <dd>2026/27 营销年度</dd>
            </div>
            <div>
              <dt>编制与审核</dt>
              <dd>王洋编制 · 赵晨审核</dd>
            </div>
            <div>
              <dt>发布时间</dt>
              <dd>{selectedRecord.publishedAt}</dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
}

type SupplyResultSection = "calculation" | "comparison" | "versions";

const supplyHeaders: Record<
  SupplyResultSection,
  { eyebrow: string; title: string; summary: string }
> = {
  calculation: {
    eyebrow: "供需与态势 / 供需平衡表",
    title: "区域粮食供需平衡表",
    summary: "按地区、产品和营销年度查询已核定账户、测算结果与每项来源依据。",
  },
  comparison: {
    eyebrow: "供需与态势 / 四年对比",
    title: "供需账户四年对比",
    summary: "比较当前营销年度与前三年同口径供需结果，并展示相邻年度增长率。",
  },
  versions: {
    eyebrow: "供需与态势 / 核定记录",
    title: "供需账户核定记录",
    summary: "查询供需账户每次编制、审核、核定和后续替代记录。",
  },
};

export function SupplyDemandWorkspace({
  section,
  onComposeReport,
  queryAllowed = true,
  requestedWorkItem,
  requestedSelectionUnavailable = false,
  onWorkItemChange,
}: SupplyDemandWorkspaceProps) {
  const effectiveSection: SupplyResultSection =
    section === "records"
      ? "versions"
      : section === "balance" ||
          section === "corn-balance" ||
          section === "soybean-balance" ||
          section === "paddy-balance"
        ? "calculation"
        : section;
  const routeProduct: SupplyProduct | "" =
    section === "corn-balance"
      ? "corn"
      : section === "soybean-balance"
        ? "soybean"
        : section === "paddy-balance"
          ? "paddy"
          : "";
  const formalScope = useFormalWorkspaceScope();
  const { regionId, setRegionId } = useWorkspaceRegion();
  const requestedQuery = queryAllowed
    ? queryForSupplyWorkItem(requestedWorkItem)
    : null;
  const [localProduct, setLocalProduct] = useState<SupplyProduct | "">(
    requestedQuery?.product ?? "",
  );
  const [marketingYear, setMarketingYear] = useState<SupplyMarketingYear>(
    requestedQuery?.marketingYear ?? "",
  );
  const [approval, setApproval] = useState<SupplyApprovalRecord>(
    requestedQuery?.approval ?? "",
  );
  const [appliedQuery, setAppliedQuery] = useState<SupplyQuery | null>(
    requestedQuery,
  );
  const [selectedSource, setSelectedSource] = useState<BalanceRow | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");

  useEffect(() => {
    if (
      !formalScope ||
      !requestedQuery ||
      (formalScope.scope.coordinates.regionId === requestedQuery.regionId &&
        formalScope.scope.coordinates.productId === requestedQuery.product)
    ) {
      return;
    }
    formalScope.onScopeChange({
      regionId: requestedQuery.regionId,
      productId: requestedQuery.product,
    });
  }, [formalScope, requestedQuery]);

  const authorizedProducts = formalScope
    ? filterPlatformMasterDataByAuthorization(formalScope.scope.authorization)
        .products
    : platformProducts;
  const productOptions = authorizedProducts
    .map(({ id }) => id)
    .filter(isSupplyProduct);
  const scopedProduct = formalScope?.scope.coordinates.productId;
  const product = routeProduct
    ? productOptions.includes(routeProduct)
      ? routeProduct
      : ""
    : formalScope
      ? isSupplyProduct(scopedProduct) && productOptions.includes(scopedProduct)
        ? scopedProduct
        : ""
      : localProduct;
  const region =
    regionId === "authorized-all" ? null : getEnterpriseScopeRegion(regionId);
  const draft = region
    ? { regionId: region.id, product, marketingYear, approval }
    : null;
  const canQuery = Boolean(
    queryAllowed && region && product && marketingYear && approval,
  );
  const effectiveQuery =
    queryAllowed &&
    appliedQuery &&
    draft &&
    isSameSupplyQuery(appliedQuery, draft)
      ? appliedQuery
      : null;
  const hasChangedQuery = Boolean(
    appliedQuery && (!draft || !isSameSupplyQuery(appliedQuery, draft)),
  );
  const effectiveSnapshot = effectiveQuery
    ? supplyAccountForQuery(effectiveQuery)
    : null;
  const currentSupplyReportDataset = effectiveQuery
    ? supplyReportDataset(effectiveQuery.product)
    : undefined;
  const hasReportDraftPermission =
    !formalScope ||
    formalScope.scope.authorization.permissionKeys.includes(
      "report.draft.save",
    );
  const summaryStatus = !queryAllowed
    ? "当前筛选范围超出您的数据权限，系统未执行查询"
    : !canQuery
      ? "请完成全部查询条件后查询"
      : hasChangedQuery
        ? "筛选条件已变更，请重新查询"
        : effectiveQuery
          ? "已按当前条件完成查询"
          : "查询条件已就绪，请执行查询";
  const canComposeReport = Boolean(
    queryAllowed &&
    hasReportDraftPermission &&
    effectiveSection === "calculation" &&
    effectiveSnapshot?.reconciliationDecision.reportEligible,
  );
  const quickReportRequest: BusinessReportRequest | null =
    effectiveQuery && effectiveSnapshot && currentSupplyReportDataset
      ? {
          reportType: "供需报告",
          regionId: effectiveQuery.regionId,
          productId: effectiveQuery.product,
          cultivarId: null,
          periodKey: currentSupplyReportDataset.period,
          frequency: "月",
          cutoff: currentSupplyReportDataset.dataCutoff,
          approvedDatasetId: currentSupplyReportDataset.dataBatchId,
          sectionKeys: currentSupplyReportDataset.chapters.map(
            ({ title }) => title,
          ),
        }
      : null;
  const isAssignedReviewer = Boolean(
    formalScope &&
    requestedWorkItem &&
    formalScope.scope.identity.userId === requestedWorkItem.reviewerUserId,
  );
  const hasReviewPermissions = Boolean(
    formalScope?.scope.authorization.permissionKeys.includes(
      "business-work:review",
    ) &&
    formalScope.scope.authorization.permissionKeys.includes(
      "business-work:quality-review",
    ),
  );
  const canReviewRequestedExplanation = Boolean(
    requestedWorkItem &&
    onWorkItemChange &&
    isAssignedReviewer &&
    hasReviewPermissions &&
    requestedWorkItem.reviewStatus === "reviewing" &&
    requestedWorkItem.qualityStatus === "awaiting-explanation",
  );
  const header = supplyHeaders[effectiveSection];

  const setProduct = (nextProduct: SupplyProduct | "") => {
    setSelectedSource(null);
    if (formalScope) {
      formalScope.onScopeChange({ productId: nextProduct || undefined });
      return;
    }
    setLocalProduct(nextProduct);
  };

  const query = () => {
    if (!queryAllowed || !region || !product || !marketingYear || !approval)
      return;
    setSelectedSource(null);
    setAppliedQuery({ regionId: region.id, product, marketingYear, approval });
  };

  const reset = () => {
    if (formalScope) {
      formalScope.onScopeChange({
        regionId: "authorized-all",
        productId: undefined,
      });
    } else {
      setRegionId("qiqihar-all");
      setLocalProduct("");
    }
    setMarketingYear("");
    setApproval("");
    setAppliedQuery(null);
    setSelectedSource(null);
  };

  const composeReport = () => {
    if (
      !queryAllowed ||
      !hasReportDraftPermission ||
      !effectiveQuery ||
      !effectiveSnapshot?.reconciliationDecision.reportEligible ||
      !currentSupplyReportDataset
    )
      return;
    const reportRegion = getEnterpriseScopeRegion(effectiveQuery.regionId);
    if (!reportRegion) return;
    const reportContext: BusinessReportContext = {
      application: "supply",
      applicationLabel: "供需与态势",
      businessClassificationId: "supply.results",
      businessClassificationLabel: "结果",
      product:
        effectiveQuery.product === "corn"
          ? "玉米"
          : effectiveQuery.product === "soybean"
            ? "大豆"
            : "稻谷",
      cultivar: "不按具体品种拆分",
      reportTemplate: "供需平衡分析报告",
      region: reportRegion.label,
      regionLevel: reportRegion.level,
      period: "2026/27营销年度",
      frequency: "月报",
      dataCutoff: currentSupplyReportDataset.dataCutoff,
      dataVersion: currentSupplyReportDataset.dataBatchId,
      dataBatchLabel: currentSupplyReportDataset.dataBatchLabel,
      author: "王洋",
      authorPost: "区域数据管理员",
      reviewer: "赵晨",
      reviewerPost: "报告复核岗",
    };
    onComposeReport(reportContext);
  };

  const reviewSupplyExplanation = (decision: "approved" | "returned") => {
    if (
      !formalScope ||
      !requestedWorkItem ||
      !onWorkItemChange ||
      !canReviewRequestedExplanation
    ) {
      setReviewMessage("当前人员不是该任务的指派审核人或缺少审核权限。");
      return;
    }
    const explanation = requestedWorkItem.qualityHistory.findLast(
      ({ action }) => action === "explanation-submitted",
    );
    const latestRuleResult = requestedWorkItem.qualityHistory.findLast(
      ({ action }) => action === "rules-executed",
    )?.result;
    const submission = requestedWorkItem.submissionHistory.at(-1);
    if (
      !explanation?.explanationVersionId ||
      !latestRuleResult ||
      !submission
    ) {
      setReviewMessage(
        "供需说明、质量校验结果或本次提交记录不完整，不能形成审核结论。",
      );
      return;
    }
    const now = new Date().toISOString();
    const actor =
      formalScope.scope.identity.displayName || requestedWorkItem.reviewer;
    const context: BusinessWorkTransitionContext = {
      actorUserId: formalScope.scope.identity.userId,
      actor,
      roleIds: ["quality-reviewer", "reviewer"],
      permissionKeys: formalScope.scope.authorization.permissionKeys,
      now,
    };
    const qualityResult = transitionBusinessWork(
      requestedWorkItem,
      {
        type: "review-quality-explanation",
        event: {
          qualityEventId: `供需说明复核-${requestedWorkItem.workId}-${String(Date.now())}`,
          action:
            decision === "approved"
              ? "explanation-approved"
              : "explanation-returned",
          ruleVersionId: requestedWorkItem.qualityGovernance.ruleVersionId,
          result: latestRuleResult,
          actor,
          actorRoleId: "quality-reviewer",
          at: now,
          explanationVersionId: explanation.explanationVersionId,
        },
      },
      context,
    );
    if (qualityResult.status === "rejected") {
      setReviewMessage(qualityResult.reason);
      return;
    }
    const reviewResult = transitionBusinessWork(
      qualityResult.item,
      {
        type: decision === "approved" ? "approve-review" : "return-review",
        event: {
          reviewEventId: `供需业务审核-${requestedWorkItem.workId}-${String(Date.now())}`,
          submissionVersionId: submission.submissionVersionId,
          action: decision,
          reviewer: actor,
          at: now,
          reason: decision === "returned" ? reviewReason.trim() : null,
        },
      },
      context,
    );
    if (reviewResult.status === "rejected") {
      setReviewMessage(reviewResult.reason);
      return;
    }
    onWorkItemChange(reviewResult.item);
    setReviewReason("");
    setReviewMessage(
      decision === "approved"
        ? "供需说明审核已通过，审核记录已保存。"
        : "供需说明已退回修改，退回原因已保存。",
    );
  };

  return (
    <div className="enterprise-ledger-workbench supply-workspace">
      <div className="enterprise-ledger-workbench__breadcrumb">
        {header.eyebrow}
      </div>
      {effectiveSection === "calculation" && !hasReportDraftPermission && (
        <p className="report-permission-note" role="status">
          当前岗位没有报告编制权限，可以查询并查看供需测算结果。
        </p>
      )}
      {!queryAllowed && (
        <section className="supply-empty-result" role="alert">
          <strong>当前筛选范围超出您的数据权限</strong>
          <p>系统未执行供需账户查询，也不会使用其他范围的数据。</p>
        </section>
      )}
      {requestedSelectionUnavailable && (
        <section className="supply-empty-result" role="alert">
          <strong>所选供需任务不可用</strong>
          <p>
            该任务不存在、已超出授权范围或不属于供需核算，系统未改用其他任务。
          </p>
        </section>
      )}
      {requestedWorkItem &&
        requestedWorkItem.subject.kind === "supply-account" &&
        requestedQuery && (
          <section
            aria-label="当前供需复核任务"
            className="supply-result-summary"
          >
            <strong>{requestedWorkItem.title}</strong>
            <dl>
              <div>
                <dt>任务对象</dt>
                <dd>{requestedWorkItem.subject.accountLabel}</dd>
              </div>
              <div>
                <dt>当前处理人</dt>
                <dd>{requestedWorkItem.reviewer || "审核人未提供"}</dd>
              </div>
              <div>
                <dt>处理节点</dt>
                <dd>供需说明复核</dd>
              </div>
              <div>
                <dt>截止时间</dt>
                <dd>2026年8月3日 17:00</dd>
              </div>
            </dl>
            <label className="report-workflow-reason">
              <span>退回原因</span>
              <textarea
                aria-label="供需说明退回原因"
                disabled={!canReviewRequestedExplanation}
                placeholder="退回修改时必须填写具体业务原因"
                value={reviewReason}
                onChange={(event) => setReviewReason(event.target.value)}
              />
            </label>
            <div className="report-workflow-actions">
              <button
                disabled={!canReviewRequestedExplanation}
                type="button"
                onClick={() => reviewSupplyExplanation("approved")}
              >
                审核通过
              </button>
              <button
                disabled={
                  !canReviewRequestedExplanation || !reviewReason.trim()
                }
                type="button"
                onClick={() => reviewSupplyExplanation("returned")}
              >
                退回修改
              </button>
            </div>
            {!isAssignedReviewer && (
              <p className="report-permission-note" role="status">
                当前人员不是该任务的指派审核人，只能查看。
              </p>
            )}
            {isAssignedReviewer && !hasReviewPermissions && (
              <p className="report-permission-note" role="status">
                当前人员缺少供需说明审核权限，只能查看。
              </p>
            )}
            {reviewMessage && <p role="status">{reviewMessage}</p>}
          </section>
        )}
      <SupplyFilterControls
        approval={approval}
        canQuery={canQuery}
        marketingYear={marketingYear}
        product={product}
        productOptions={productOptions}
        showProduct={!routeProduct}
        onApprovalChange={setApproval}
        onMarketingYearChange={setMarketingYear}
        onProductChange={setProduct}
        onQuery={query}
        onReset={reset}
      />
      <header className="enterprise-ledger-title">
        <h1>{header.title}</h1>
        <p>
          {region?.label ?? "请选择统计地区"} ·{" "}
          {product ? productLabels[product] : "请选择产品账户"} ·{" "}
          {marketingYear
            ? marketingYearLabels[marketingYear]
            : "请选择营销年度"}
        </p>
      </header>
      <div className="enterprise-ledger-table__toolbar supply-ledger-toolbar">
        <strong>{summaryStatus}</strong>
        {effectiveSection === "calculation" && (
          <div>
            <button
              disabled={!canComposeReport}
              type="button"
              onClick={composeReport}
            >
              编制供需报告
            </button>
            <QuickReportExportMenu
              exportAllowed={
                !formalScope ||
                formalScope.scope.authorization.permissionKeys.includes(
                  "report.export",
                )
              }
              request={quickReportRequest}
            />
          </div>
        )}
      </div>
      {effectiveSection === "calculation" && (
        <SupplyStatementResult
          query={effectiveQuery}
          selectedSource={selectedSource}
          onSourceChange={setSelectedSource}
        />
      )}
      {effectiveSection === "comparison" && (
        <SupplyComparisonResult query={effectiveQuery} />
      )}
      {effectiveSection === "versions" && (
        <SupplyApprovalHistoryResult query={effectiveQuery} />
      )}
    </div>
  );
}

export function FormalSupplyDemandWorkspace({
  section,
  scope,
  onScopeChange,
  onComposeReport,
  selection,
  workItems = businessWorkFixtures,
  queryAllowed = true,
  onWorkItemChange,
}: {
  section: Extract<FormalRoute, { application: "supply" }>["section"];
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  onComposeReport: (context: BusinessReportContext) => void;
  selection?: FormalSelection;
  workItems?: readonly BusinessWorkItem[];
  queryAllowed?: boolean;
  onWorkItemChange?: (item: BusinessWorkItem) => void;
}) {
  const authorizedTasks = projectDomainTasks(workItems, {
    domain: "supply",
    scope,
    queryAllowed,
    availablePeriodKeys: [
      ...new Set(workItems.map(({ periodKey }) => periodKey)),
    ],
  });
  const requestedCandidate =
    selection?.type === "work-item"
      ? authorizedTasks.find(({ item }) => item.workId === selection.id)?.item
      : undefined;
  const requestedWorkItem =
    requestedCandidate && queryForSupplyWorkItem(requestedCandidate)
      ? requestedCandidate
      : undefined;
  const requestedSelectionUnavailable = Boolean(
    selection &&
    (selection.type !== "work-item" || requestedWorkItem === undefined),
  );
  return (
    <FormalWorkspaceScopeProvider
      classificationOptions={businessClassificationFixtures.supplyAnalysis}
      scope={scope}
      onScopeChange={onScopeChange}
    >
      <SupplyDemandWorkspace
        key={selection?.id ?? "手动查询供需账户"}
        section={section}
        onComposeReport={onComposeReport}
        onWorkItemChange={onWorkItemChange}
        queryAllowed={queryAllowed}
        requestedSelectionUnavailable={requestedSelectionUnavailable}
        requestedWorkItem={requestedWorkItem}
      />
    </FormalWorkspaceScopeProvider>
  );
}
