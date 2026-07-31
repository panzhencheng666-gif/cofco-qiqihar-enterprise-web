import { useState } from "react";
import type { BusinessReportContext } from "./businessReportModel";
import type { SupplySection } from "./formalEnterpriseModel";
import {
  getSupplyBalanceEquation,
  getSupplyBalanceScope,
  supplyBalanceScopes,
  type SupplyBalanceScopeKey,
} from "./supplyBalanceScope";
import {
  BusinessContextBar,
  WorkspaceHeader,
  WorkspaceStatus,
  WorkspaceSummaryStrip,
  WorkspaceTable,
  WorkspaceTableToolbar,
  type WorkspaceTone,
} from "./UnifiedWorkspacePrimitives";

type SupplyProduct = "corn" | "soybean" | "paddy" | "rice";

const supplyProducts: readonly {
  key: SupplyProduct;
  label: string;
  account: string;
  state: string;
}[] = [
  {
    key: "corn",
    label: "玉米",
    account: "玉米原粮",
    state: "市级账户已核定",
  },
  {
    key: "soybean",
    label: "大豆",
    account: "大豆原粮",
    state: "县级资料待补",
  },
  {
    key: "paddy",
    label: "稻谷",
    account: "稻谷原粮",
    state: "市级账户已核定",
  },
  {
    key: "rice",
    label: "大米",
    account: "大米产品",
    state: "加工转换待复核",
  },
];

const countyAccountRows = [
  ["龙沙区", "尚未建立可发布账户", "—", "缺少完整产品账户", "待准备"],
  ["建华区", "尚未建立可发布账户", "—", "缺少完整产品账户", "待准备"],
  ["铁锋区", "尚未建立可发布账户", "—", "缺少完整产品账户", "待准备"],
  ["昂昂溪区", "尚未建立可发布账户", "—", "缺少完整产品账户", "待准备"],
  ["富拉尔基区", "尚未建立可发布账户", "—", "缺少完整产品账户", "待准备"],
  ["碾子山区", "尚未建立可发布账户", "—", "缺少完整产品账户", "待准备"],
  ["梅里斯达斡尔族区", "账户准备中", "9 / 14", "库存资料待核", "待补数据"],
  ["讷河市", "2026/27 年度讷河账户", "12 / 14", "两项流向资料待补", "待补数据"],
  ["龙江县", "2026/27 年度龙江账户", "14 / 14", "输入资料完整", "已核定"],
  ["依安县", "账户准备中", "10 / 14", "加工与流向待核", "待补数据"],
  ["泰来县", "2026/27 年度泰来账户", "14 / 14", "输入资料完整", "已核定"],
  ["甘南县", "2026/27 年度甘南账户", "11 / 14", "加工量和库存待核", "待补数据"],
  ["富裕县", "账户准备中", "8 / 14", "企业库存待补", "待补数据"],
  ["克山县", "账户准备中", "10 / 14", "区域流向待核", "待补数据"],
  ["克东县", "账户准备中", "9 / 14", "消费使用资料待补", "待补数据"],
  ["拜泉县", "账户准备中", "11 / 14", "加工使用待核", "待补数据"],
] as const;

function toneFor(value: string): WorkspaceTone {
  if (value.includes("阻断") || value.includes("超过")) return "danger";
  if (
    value.includes("待") ||
    value.includes("准备") ||
    value.includes("暂估")
  ) {
    return "warning";
  }
  if (value.includes("核定") || value.includes("正式")) return "good";
  return "normal";
}

function ProductSwitch({
  product,
  onChange,
}: {
  product: SupplyProduct;
  onChange: (product: SupplyProduct) => void;
}) {
  return (
    <section aria-label="供需产品账户" className="supply-product-strip">
      <div>
        <small>产品账户</small>
        <strong>不同产品形态分别建账，不直接混加物理吨数</strong>
      </div>
      {supplyProducts.map((item) => (
        <button
          aria-pressed={item.key === product}
          className={item.key === product ? "is-active" : undefined}
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
        >
          <strong>{item.label}</strong>
          <small>{item.account}</small>
          <span>{item.state}</span>
        </button>
      ))}
    </section>
  );
}

function RegionSwitch({
  selected,
  onChange,
}: {
  selected: SupplyBalanceScopeKey;
  onChange: (key: SupplyBalanceScopeKey) => void;
}) {
  const scope = getSupplyBalanceScope(selected);
  return (
    <section aria-label="供需平衡地区范围" className="supply-region-band">
      <div>
        <small>当前平衡范围</small>
        <strong>{scope.label}</strong>
        <span>{scope.level}</span>
      </div>
      <div className="supply-region-switch">
        {supplyBalanceScopes.map((item) => (
          <button
            aria-pressed={item.key === selected}
            className={item.key === selected ? "is-active" : undefined}
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
          >
            {item.key === "qiqihar" ? "市级全域" : item.label}
          </button>
        ))}
      </div>
      <div>
        <small>采用账户</small>
        <strong>{scope.version}</strong>
        <em>{scope.coverage}</em>
        <WorkspaceStatus tone={toneFor(scope.status)}>
          {scope.status}
        </WorkspaceStatus>
      </div>
    </section>
  );
}

function SupplyContext({
  product,
  scopeKey,
  state,
  tone,
}: {
  product: SupplyProduct;
  scopeKey: SupplyBalanceScopeKey;
  state: string;
  tone?: WorkspaceTone;
}) {
  const productItem = supplyProducts.find((item) => item.key === product)!;
  const scope = getSupplyBalanceScope(scopeKey);
  return (
    <BusinessContextBar
      items={[
        ["统计区域", scope.label],
        ["产品账户", productItem.account],
        ["账户期间", "2026/27 营销年度"],
        ["采用版本", scope.version],
      ]}
      state={state}
      tone={tone}
    />
  );
}

function EquationWorkspace({
  scopeKey,
}: {
  scopeKey: SupplyBalanceScopeKey;
}) {
  const equation = getSupplyBalanceEquation(scopeKey);
  return (
    <>
      <WorkspaceTableToolbar
        title="供需核心等式"
        note="期末库存和库存平衡差额是两个不同概念"
      />
      <section aria-label="供需核心等式" className="supply-core-equation">
        <span>
          <small>总供给</small>
          <strong>{equation.totalSupply}</strong>
          <em>万吨</em>
        </span>
        <b>−</b>
        <span>
          <small>总使用</small>
          <strong>{equation.totalUse}</strong>
          <em>万吨</em>
        </span>
        <b>=</b>
        <span className="is-result">
          <small>调整前账面期末</small>
          <strong>{equation.bookEnding}</strong>
          <em>万吨</em>
        </span>
      </section>
      <WorkspaceTableToolbar
        title="供需账户构成"
        note="供给来源、使用去向和库存调查分别列示"
      />
      <WorkspaceTable
        columns={["账户项目", "本期结果", "构成或计算说明", "数据性质"]}
        label="供需账户构成"
        rows={[
          [
            "总供给",
            `${equation.totalSupply} 万吨`,
            "期初库存＋本期生产＋区域外流入＋其他供给",
            <WorkspaceStatus key="total-supply" tone="good">
              账户采用值
            </WorkspaceStatus>,
          ],
          [
            "总使用",
            `${equation.totalUse} 万吨`,
            "消费＋加工＋损耗＋区域外流出＋其他使用",
            <WorkspaceStatus key="total-use" tone="good">
              账户采用值
            </WorkspaceStatus>,
          ],
          [
            "调整前账面期末",
            `${equation.bookEnding} 万吨`,
            "总供给 − 总使用",
            <WorkspaceStatus key="book-ending" tone="good">
              公式结果
            </WorkspaceStatus>,
          ],
          [
            "调查汇总期末",
            `${equation.surveyEnding} 万吨`,
            "企业与农户库存调查汇总",
            <WorkspaceStatus key="survey-ending" tone="warning">
              调查对照值
            </WorkspaceStatus>,
          ],
        ]}
      />
      <WorkspaceTableToolbar
        title="库存差异解释"
        note="未经批准的差额不得直接覆盖账面期末"
      />
      <WorkspaceTable
        columns={["事项", "数值", "计算或采用规则", "当前状态"]}
        label="库存差异解释"
        rows={[
          [
            "批准库存调整",
            `${equation.approvedAdjustment} 万吨`,
            "经审核批准后才进入正式账户",
            <WorkspaceStatus key="approved-adjustment">
              当前无调整
            </WorkspaceStatus>,
          ],
          [
            "采用后账面期末",
            `${equation.adoptedEnding} 万吨`,
            "调整前账面期末＋批准库存调整",
            <WorkspaceStatus key="adopted-ending" tone="good">
              候选期初
            </WorkspaceStatus>,
          ],
          [
            "库存平衡差额",
            <strong key="inventory-difference">
              {equation.inventoryDifference}
            </strong>,
            "调查汇总期末 − 调整前账面期末",
            <WorkspaceStatus key="difference-status" tone="warning">
              待解释
            </WorkspaceStatus>,
          ],
        ]}
      />
    </>
  );
}

function SupplyOverview({
  onComposeReport,
}: {
  onComposeReport: (context: BusinessReportContext) => void;
}) {
  const [product, setProduct] = useState<SupplyProduct>("corn");
  const [scopeKey, setScopeKey] =
    useState<SupplyBalanceScopeKey>("qiqihar");
  const scope = getSupplyBalanceScope(scopeKey);
  const equation = getSupplyBalanceEquation(scopeKey);
  const productItem = supplyProducts.find((item) => item.key === product)!;
  const reportContext: BusinessReportContext = {
    application: "supply",
    applicationLabel: "供需与态势",
    product: productItem.account,
    region: scope.label,
    regionLevel: scope.level,
    period: "2026/27 营销年度",
    dataCutoff: "7 月 31 日 17:00",
    dataVersion: scope.version,
    author: "王洋",
    reviewer: "赵晨",
  };
  return (
    <div className="unified-workspace supply-workspace">
      <WorkspaceHeader
        eyebrow="供需与态势 / 供需总览"
        title="区域粮食供需账户"
        summary="先确认产品、地区、期间和采用版本，再解释供给来源、使用去向、期末库存与调查差额。"
        actions={
          <>
            <button type="button">查看历史账户</button>
            <button
              className="is-primary"
              type="button"
              onClick={() => onComposeReport(reportContext)}
            >
              编制供需报告
            </button>
          </>
        }
      />
      <SupplyContext
        product={product}
        scopeKey={scopeKey}
        state={scope.status === "已核定" ? "正式账户已核定" : "输入资料待补"}
        tone={scope.status === "已核定" ? "good" : "warning"}
      />
      <ProductSwitch product={product} onChange={setProduct} />
      <RegionSwitch selected={scopeKey} onChange={setScopeKey} />
      <WorkspaceSummaryStrip
        label="供需账户摘要"
        items={[
          {
            label: "总供给",
            value: `${equation.totalSupply} 万吨`,
            note: "正式指标版本采用值",
          },
          {
            label: "总使用",
            value: `${equation.totalUse} 万吨`,
            note: "使用与区域外流出",
          },
          {
            label: "采用后账面期末",
            value: `${equation.adoptedEnding} 万吨`,
            note: "批准调整后正式采用",
            tone: "good",
          },
          {
            label: "库存平衡差额",
            value: `${equation.inventoryDifference} 万吨`,
            note: "调查期末与账面期末之差",
            tone: "warning",
          },
        ]}
      />
      <EquationWorkspace scopeKey={scopeKey} />
    </div>
  );
}

function ProductAccounts() {
  const [product, setProduct] = useState<SupplyProduct>("corn");
  const productItem = supplyProducts.find((item) => item.key === product)!;
  return (
    <div className="unified-workspace supply-workspace">
      <WorkspaceHeader
        eyebrow="供需与态势 / 产品账户"
        title="产品账户与构成项目"
        summary="玉米、大豆、稻谷和大米分别建账；加工转换在上下游账户成对记录。"
      />
      <SupplyContext
        product={product}
        scopeKey="qiqihar"
        state="账户规范第 4 版有效"
      />
      <ProductSwitch product={product} onChange={setProduct} />
      <WorkspaceTableToolbar
        title={`${productItem.account}账户项目`}
        note="一个规范事实最多进入一个可加总角色。"
      />
      <WorkspaceTable
        columns={[
          "账户项目",
          "角色",
          "采用值",
          "来源",
          "质量状态",
          "采用版本",
        ]}
        label="产品账户项目"
        rows={[
          [
            "期初库存",
            "供给",
            "91.6 万吨",
            "上一年度采用后账面期末",
            <WorkspaceStatus key="opening" tone="good">
              通过
            </WorkspaceStatus>,
            "2025/26 发布版",
          ],
          [
            "本期生产",
            "供给",
            "621.8 万吨",
            "产情正式区域估计",
            <WorkspaceStatus key="production" tone="good">
              通过
            </WorkspaceStatus>,
            "产情第 30 周正式版",
          ],
          [
            "区域外净流入",
            "供给",
            "49.7 万吨",
            "去重物流边界事实",
            <WorkspaceStatus key="inflow" tone="warning">
              两项待核
            </WorkspaceStatus>,
            "市场第 31 周候选版",
          ],
          [
            "加工使用",
            "使用",
            "184.2 万吨",
            "加工投入规范事实",
            <WorkspaceStatus key="processing" tone="good">
              通过
            </WorkspaceStatus>,
            "市场第 30 周正式版",
          ],
        ]}
      />
    </div>
  );
}

function RegionalBalance() {
  const [scopeKey, setScopeKey] =
    useState<SupplyBalanceScopeKey>("qiqihar");
  const scope = getSupplyBalanceScope(scopeKey);
  return (
    <div className="unified-workspace supply-workspace">
      <WorkspaceHeader
        eyebrow="供需与态势 / 区域平衡"
        title="市级与县区供需平衡"
        summary="市级账户抵销市内县区流转；县区账户分别列示流入和流出。"
      />
      <SupplyContext
        product="corn"
        scopeKey={scopeKey}
        state={scope.status}
        tone={scope.status === "已核定" ? "good" : "warning"}
      />
      <RegionSwitch selected={scopeKey} onChange={setScopeKey} />
      <WorkspaceSummaryStrip
        label="地区账户规则"
        items={[
          {
            label: "账户层级",
            value: scope.level,
            note: "地区切换不改变产品和营销年度",
          },
          {
            label: "数据覆盖",
            value: scope.coverage,
            note: scope.status,
            tone: toneFor(scope.status),
          },
          {
            label: "市内流转处理",
            value:
              scope.level === "市级合并"
                ? `${scope.internalFlowElimination} 已抵销`
                : "分别列示流入流出",
            note: "账户规则有效",
            tone: "good",
          },
        ]}
      />
      <EquationWorkspace scopeKey={scopeKey} />
      <WorkspaceTableToolbar
        title="全部县区账户准备状态"
        note="没有正式输入的县区明确显示待准备，不以零补齐。"
      />
      <WorkspaceTable
        columns={["县区", "账户版本", "输入覆盖", "缺失或质量问题", "状态"]}
        label="县区供需账户"
        rows={countyAccountRows.map((row) => [
          row[0],
          row[1],
          row[2],
          row[3],
          <WorkspaceStatus key={row[0]} tone={toneFor(row[4])}>
            {row[4]}
          </WorkspaceStatus>,
        ])}
      />
    </div>
  );
}

function IndicatorLineage() {
  return (
    <div className="unified-workspace supply-workspace">
      <WorkspaceHeader
        eyebrow="供需与态势 / 指标与来源"
        title="指标与来源追溯"
        summary="查看每个账户值采用的正式指标、来源数据、截止时间、质量和审核版本。"
      />
      <SupplyContext
        product="corn"
        scopeKey="qiqihar"
        state="来源可追溯"
      />
      <WorkspaceTableToolbar
        title="玉米原粮账户采用指标"
        note="供需页面不重新填写来源值。"
      />
      <WorkspaceTable
        columns={[
          "账户项目",
          "采用值",
          "业务来源",
          "数据截止",
          "质量与审核",
          "采用版本",
        ]}
        label="供需指标来源"
        rows={[
          [
            "期初库存",
            "91.6 万吨",
            "上一年度供需发布结果",
            "2026-06-30",
            <WorkspaceStatus key="opening" tone="good">
              已发布
            </WorkspaceStatus>,
            "2025/26 供需结果发布版",
          ],
          [
            "本期生产",
            "621.8 万吨",
            "产情监测 · 区域正式估计",
            "2026-07-24 17:00",
            <WorkspaceStatus key="production" tone="good">
              质量通过
            </WorkspaceStatus>,
            "产情第 30 周正式指标版本",
          ],
          [
            "区域外净流入",
            "49.7 万吨",
            "市场监测 · 边界物流事实",
            "2026-07-31 17:00",
            <WorkspaceStatus key="inflow" tone="warning">
              两项待核
            </WorkspaceStatus>,
            "第 31 周市场正式指标版本",
          ],
          [
            "加工使用",
            "184.2 万吨",
            "市场监测 · 加工投入",
            "2026-07-24 17:00",
            <WorkspaceStatus key="processing" tone="good">
              审核通过
            </WorkspaceStatus>,
            "第 30 周市场正式指标版本",
          ],
        ]}
      />
      <div className="supply-lineage-flow" aria-label="供需指标追溯链路">
        {[
          "供需结果",
          "供需计算运行",
          "账户规范与公式",
          "正式指标",
          "规范业务数据",
          "原始单据与证据",
        ].map((item, index) => (
          <div key={item}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{item}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function SituationAnalysis() {
  return (
    <div className="unified-workspace supply-workspace">
      <WorkspaceHeader
        eyebrow="供需与态势 / 态势分析"
        title="供需态势与影响因素"
        summary="价格、质量、成本和种植意愿用于解释账户变化，不作为可相加供需数量。"
      />
      <SupplyContext
        product="corn"
        scopeKey="qiqihar"
        state="初步态势与正式账户已区分"
      />
      <WorkspaceTableToolbar
        title="供需态势解释指标"
        note="解释指标用于说明变化，不进入可相加供需数量"
      />
      <WorkspaceTable
        columns={["影响因素", "本期结果", "解释", "数据性质"]}
        label="供需态势解释指标"
        rows={[
          [
            "价格",
            "玉米主流收购价 2,346 元/吨",
            "周环比 +0.8%，北部县区价差扩大。",
            <WorkspaceStatus key="price-situation" tone="warning">
              解释指标
            </WorkspaceStatus>,
          ],
          [
            "加工",
            "重点企业开机率 72.6%",
            "深加工日耗较四周均值增加 3.1%。",
            <WorkspaceStatus key="processing-situation" tone="warning">
              解释指标
            </WorkspaceStatus>,
          ],
          [
            "物流",
            "铁路发运量环比 -6.4%",
            "仅用于解释区域外流出变化，当前仍为初步数据。",
            <WorkspaceStatus key="logistics-situation" tone="warning">
              解释指标
            </WorkspaceStatus>,
          ],
        ]}
      />
      <WorkspaceTableToolbar
        title="本期账户变化说明"
        note="正式发布前仍需完成来源和质量复核。"
      />
      <section aria-label="本期账户变化说明" className="supply-narrative">
          玉米账面期末库存预计为 103.9
          万吨；调查汇总期末高于账面推算，形成 1.7
          万吨库存平衡差额。当前差额仅作为解释和风险展示，未经批准不得直接覆盖账面期末。
      </section>
    </div>
  );
}

export function SupplyDemandWorkspace({
  section,
  onComposeReport,
}: {
  section: SupplySection;
  onComposeReport: (context: BusinessReportContext) => void;
}) {
  if (section === "accounts") return <ProductAccounts />;
  if (section === "regional") return <RegionalBalance />;
  if (section === "lineage") return <IndicatorLineage />;
  if (section === "situation") return <SituationAnalysis />;
  return <SupplyOverview onComposeReport={onComposeReport} />;
}
