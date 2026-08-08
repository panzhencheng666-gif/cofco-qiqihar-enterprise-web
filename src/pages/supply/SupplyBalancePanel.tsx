import { useState } from "react";
import {
  EnterpriseObjectDrawer,
  EnterpriseStatusTag,
  EnterpriseTable,
  EnterpriseTextAction,
  type EnterpriseColumn,
} from "@/shared/enterprise-ui";
import {
  buildBalanceSummary,
  displayScaledValue,
  formalScaledValue,
  productAccountCatalog,
  type ProductAccountKey,
  type SupplyBalanceRow,
} from "@/workflows/supply-balance/model";

type SupplyBalanceDisplayRow = SupplyBalanceRow & { id: string };

const accountOrder: readonly ProductAccountKey[] = [
  "corn",
  "soybean",
  "paddy",
  "rice",
];

export function SupplyBalancePanel() {
  const [accountKey, setAccountKey] = useState<ProductAccountKey>("corn");
  const [selectedRow, setSelectedRow] = useState<SupplyBalanceDisplayRow>();
  const account = productAccountCatalog[accountKey];
  const summary = buildBalanceSummary(account);
  const rows: readonly SupplyBalanceDisplayRow[] = account.rows.map((row) => ({
    ...row,
    id: row.role,
  }));
  const columns: EnterpriseColumn<SupplyBalanceDisplayRow>[] = [
    { title: "账户分区", dataIndex: "section" },
    { title: "指标名称", dataIndex: "label" },
    {
      title: "演示值",
      dataIndex: "input",
      render: (_, row) => {
        const value = formalScaledValue(row.input);
        return (
          <strong className="enterprise-balance-value">
            {value === undefined ? "—" : displayScaledValue(value)} {row.unit}
          </strong>
        );
      },
    },
    { title: "生成方式", dataIndex: "generation" },
    { title: "来源与版本", dataIndex: "source" },
    {
      title: "输入状态",
      dataIndex: "input",
      render: (_, row) => row.input.state,
    },
    {
      title: "质量状态",
      dataIndex: "quality",
      render: (_, row) => (
        <EnterpriseStatusTag
          tone={row.quality === "通过" ? "success" : "warning"}
        >
          {row.quality}
        </EnterpriseStatusTag>
      ),
    },
    { title: "唯一计数规则", dataIndex: "countingRule" },
    {
      title: "操作",
      width: 88,
      pinned: "right",
      render: (_, row) => (
        <EnterpriseTextAction
          ariaLabel={`查看来源说明 ${row.label}`}
          onClick={() => setSelectedRow(row)}
        >
          查看来源说明
        </EnterpriseTextAction>
      ),
    },
  ];

  return (
    <section className="enterprise-balance-workspace">
      <div
        className="enterprise-product-account-tabs"
        aria-label="产品账户选择"
      >
        {accountOrder.map((key) => {
          const candidate = productAccountCatalog[key];
          return (
            <button
              key={candidate.accountKey}
              type="button"
              className={key === accountKey ? "is-selected" : undefined}
              aria-pressed={key === accountKey}
              onClick={() => setAccountKey(key)}
            >
              {candidate.accountName}
            </button>
          );
        })}
        <div className="enterprise-product-version">
          <span>{account.versionName}</span>
          <EnterpriseStatusTag
            tone={account.status === "演示结果已生成" ? "success" : "warning"}
          >
            {account.status}
          </EnterpriseStatusTag>
        </div>
      </div>

      <section
        className="enterprise-balance-governance"
        id="section-controls"
        aria-label="输入与规则版本"
      >
        <header>
          <strong>输入与规则版本</strong>
          <span>以下为演示账户的完整版本组合，不代表生产发布</span>
        </header>
        <dl>
          <div>
            <dt>指标输入版本</dt>
            <dd>{account.metricReleaseVersions.join("、")}</dd>
          </div>
          <div>
            <dt>账户规范版本</dt>
            <dd>{account.accountStandardVersion}</dd>
          </div>
          <div>
            <dt>库存合并矩阵版本</dt>
            <dd>{account.inventoryMatrixVersion}</dd>
          </div>
          <div>
            <dt>公式版本</dt>
            <dd>{account.formulaVersionName}</dd>
          </div>
          <div>
            <dt>结果版本</dt>
            <dd>{account.resultVersionName}</dd>
          </div>
        </dl>
      </section>

      <section
        className="enterprise-balance-equation"
        aria-label="供需平衡核心公式"
      >
        <span className="enterprise-visually-hidden">
          总供给{summary.totalSupply}
          {summary.unit}减期间总使用与外流
          {summary.totalDemand}
          {summary.unit}等于调整前账面推算期末库存
          {summary.preAdjustmentClosing}
          {summary.unit}
        </span>
        <article>
          <span>总供给</span>
          <strong>
            {summary.totalSupply}
            <small>{summary.unit}</small>
          </strong>
          <p>期初库存、产量、流入及其他合格供给</p>
        </article>
        <b aria-hidden="true">减</b>
        <article>
          <span>期间总使用与外流</span>
          <strong>
            {summary.totalDemand}
            <small>{summary.unit}</small>
          </strong>
          <p>直接使用、加工投料、损耗、出口及区域外流出</p>
        </article>
        <b aria-hidden="true">等于</b>
        <article className="is-result">
          <span>调整前账面推算期末库存</span>
          <strong>
            {summary.preAdjustmentClosing}
            <small>{summary.unit}</small>
          </strong>
          <p>按账户规则计算，本演示页面不提供填写操作</p>
        </article>
        <aside>
          <span>采用后账面期末库存</span>
          <strong>
            {summary.adoptedClosing} {summary.unit}
          </strong>
          <small>
            已批准库存调整 {summary.approvedAdjustment} {summary.unit}
          </small>
          <span>
            调查汇总期末库存 {summary.surveyClosing} {summary.unit}
          </span>
          <em>
            库存平衡差额 {summary.reconciliationDifference} {summary.unit}
          </em>
        </aside>
      </section>

      <section
        className="enterprise-section-anchor enterprise-work-panel"
        id="section-worklist"
      >
        <header className="enterprise-panel-heading">
          <div>
            <h2>供需账户明细</h2>
            <p>
              本演示账户使用预置的发布指标版本；分项、合计、账面推算、批准调整和调查汇总分别保留，不互相覆盖。
            </p>
          </div>
        </header>
        <EnterpriseTable
          ariaLabel="供需账户明细"
          columns={columns}
          rows={rows}
        />
      </section>

      <EnterpriseObjectDrawer
        title="指标来源说明"
        open={selectedRow !== undefined}
        object={
          selectedRow
            ? {
                name: selectedRow.label,
                regionPath: [account.accountName, account.versionName],
                contextLabel: "来源、生成与计数规则",
                contextValues: [
                  selectedRow.source,
                  selectedRow.generation,
                  selectedRow.countingRule,
                ],
              }
            : undefined
        }
        onClose={() => setSelectedRow(undefined)}
      />
    </section>
  );
}
