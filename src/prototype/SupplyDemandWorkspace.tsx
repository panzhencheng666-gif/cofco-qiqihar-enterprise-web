import { useState } from "react";
import type { BusinessReportContext } from "./businessReportModel";
import { useEnterpriseRegion } from "./EnterpriseRegionContext";
import {
  getEnterpriseRegion,
  type EnterpriseRegionId,
} from "./enterpriseRegions";
import type { SupplySection } from "./formalEnterpriseModel";
import {
  getSupplyBalanceEquation,
  getSupplyBalanceScopeForRegion,
  type SupplyBalanceScopeKey,
} from "./supplyBalanceScope";
import {
  BusinessContextBar,
  WorkspaceFilterBar,
  WorkspaceHeader,
  WorkspaceInlineStats,
  WorkspaceRegionSelect,
  WorkspaceStatus,
  WorkspaceTable,
  WorkspaceTableToolbar,
  type WorkspaceTone,
} from "./UnifiedWorkspacePrimitives";

type SupplyProduct = "corn" | "soybean" | "paddy" | "rice";

const supplyProducts: readonly {
  key: SupplyProduct;
  label: string;
  account: string;
}[] = [
  {
    key: "corn",
    label: "玉米",
    account: "玉米原粮",
  },
  {
    key: "soybean",
    label: "大豆",
    account: "大豆原粮",
  },
  {
    key: "paddy",
    label: "稻谷",
    account: "稻谷原粮",
  },
  {
    key: "rice",
    label: "大米",
    account: "大米产品",
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

const countyAccountRegionIds: readonly EnterpriseRegionId[] = [
  "qiqihar-longsha",
  "qiqihar-jianhua",
  "qiqihar-tiefeng",
  "qiqihar-angangxi",
  "qiqihar-fularji",
  "qiqihar-nianzishan",
  "qiqihar-meilisi",
  "qiqihar-nehe",
  "qiqihar-longjiang",
  "qiqihar-yian",
  "qiqihar-tailai",
  "qiqihar-gannan",
  "qiqihar-fuyu",
  "qiqihar-keshan",
  "qiqihar-kedong",
  "qiqihar-baiquan",
];

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

function SupplyFilterBar({
  product,
  onProductChange,
}: {
  product: SupplyProduct;
  onProductChange: (product: SupplyProduct) => void;
}) {
  return (
    <WorkspaceFilterBar
      label="供需账户查询条件"
      actions={
        <>
          <button className="is-primary" type="button">
            查询
          </button>
          <button type="button">重置</button>
        </>
      }
    >
      <label>
        <span>地区</span>
        <WorkspaceRegionSelect />
      </label>
      <label>
        <span>产品</span>
        <select
          aria-label="供需产品"
          value={product}
          onChange={(event) =>
            onProductChange(event.target.value as SupplyProduct)
          }
        >
          {supplyProducts.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label} · {item.account}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>账户期间</span>
        <select aria-label="供需账户期间" defaultValue="2026-27">
          <option value="2026-27">2026/27 营销年度</option>
        </select>
      </label>
      <label>
        <span>账户状态</span>
        <select aria-label="供需账户状态" defaultValue="all">
          <option value="all">全部状态</option>
          <option value="verified">已核定</option>
          <option value="preparing">待准备</option>
        </select>
      </label>
    </WorkspaceFilterBar>
  );
}

function SupplyContext({
  product,
  state,
  tone,
}: {
  product: SupplyProduct;
  state: string;
  tone?: WorkspaceTone;
}) {
  const { regionId } = useEnterpriseRegion();
  const productItem = supplyProducts.find((item) => item.key === product)!;
  const region = getEnterpriseRegion(regionId);
  const scope = getSupplyBalanceScopeForRegion(regionId);
  const version = scope ? scope.version : "尚未建立正式账户";
  return (
    <BusinessContextBar
      items={[
        ["统计区域", region.label],
        ["产品账户", productItem.account],
        ["账户期间", "2026/27 营销年度"],
        ["采用版本", version],
      ]}
      state={state}
      tone={tone}
    />
  );
}

function UnavailableAccount({ product }: { product: SupplyProduct }) {
  const { regionId } = useEnterpriseRegion();
  const region = getEnterpriseRegion(regionId);
  const productItem = supplyProducts.find((item) => item.key === product)!;
  return (
    <>
      <WorkspaceInlineStats
        label="供需账户状态"
        items={[
          {
            label: "当前地区",
            value: region.label,
          },
          {
            label: "账户状态",
            value: "尚未建立正式供需账户",
            tone: "warning",
          },
          {
            label: "行政底册",
            value: region.sourceStatus,
            note: region.sourceNote,
            tone: region.sourceStatus === "已核定" ? "good" : "warning",
          },
        ]}
      />
      <WorkspaceTableToolbar
        title="供需账户准备状态"
        note="未取得正式输入时不以零值或示例值代替。"
      />
      <WorkspaceTable
        columns={["地区", "产品账户", "账户期间", "当前状态", "下一项工作"]}
        label="供需账户准备状态"
        rows={[
          [
            region.label,
            productItem.account,
            "2026/27 营销年度",
            <WorkspaceStatus key="unavailable" tone="warning">
              尚未建立正式供需账户
            </WorkspaceStatus>,
            "核定来源、库存、生产、使用与跨区流向后建账",
          ],
        ]}
      />
    </>
  );
}

function BalanceStatement({ scopeKey }: { scopeKey: SupplyBalanceScopeKey }) {
  const equation = getSupplyBalanceEquation(scopeKey);
  return (
    <>
      <WorkspaceTableToolbar
        title="区域粮食供需平衡表"
        note="单位：万吨；账面结果、调查对照和批准调整在同一张表内连续核对"
      />
      <WorkspaceTable
        columns={[
          "业务环节",
          "账户项目",
          "本期结果",
          "计算或数据来源",
          "数据性质",
          "当前状态",
        ]}
        label="区域粮食供需平衡表"
        rows={[
          [
            "供给",
            "总供给",
            `${equation.totalSupply} 万吨`,
            "期初库存＋本期生产＋区域外流入＋其他供给",
            "账户采用值",
            <WorkspaceStatus key="total-supply" tone="good">
              已核定
            </WorkspaceStatus>,
          ],
          [
            "使用",
            "总使用",
            `${equation.totalUse} 万吨`,
            "消费＋加工＋损耗＋区域外流出＋其他使用",
            "账户采用值",
            <WorkspaceStatus key="total-use" tone="good">
              已核定
            </WorkspaceStatus>,
          ],
          [
            "账面库存",
            "调整前账面期末",
            `${equation.bookEnding} 万吨`,
            "总供给 − 总使用",
            "公式结果",
            <WorkspaceStatus key="book-ending" tone="good">
              已计算
            </WorkspaceStatus>,
          ],
          [
            "调查对照",
            "调查汇总期末",
            `${equation.surveyEnding} 万吨`,
            "企业与农户库存调查汇总",
            "独立调查值",
            <WorkspaceStatus key="survey-ending" tone="warning">
              待核对
            </WorkspaceStatus>,
          ],
          [
            "调整",
            "批准库存调整",
            `${equation.approvedAdjustment} 万吨`,
            "仅采用已完成审核批准的调整值",
            "审核采用值",
            <WorkspaceStatus key="approved-adjustment">
              当前无调整
            </WorkspaceStatus>,
          ],
          [
            "正式结果",
            "采用后账面期末",
            `${equation.adoptedEnding} 万吨`,
            "调整前账面期末＋批准库存调整",
            "正式账户结果",
            <WorkspaceStatus key="adopted-ending" tone="good">
              候选下期期初
            </WorkspaceStatus>,
          ],
          [
            "差异检查",
            "库存平衡差额",
            `${equation.inventoryDifference} 万吨`,
            "调查汇总期末 − 调整前账面期末",
            "质量检查值",
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
  const { regionId } = useEnterpriseRegion();
  const scope = getSupplyBalanceScopeForRegion(regionId);
  const scopeKey = scope?.key ?? null;
  const region = getEnterpriseRegion(regionId);
  const productItem = supplyProducts.find((item) => item.key === product)!;
  const reportContext: BusinessReportContext = {
    application: "supply",
    applicationLabel: "供需与态势",
    product: productItem.account,
    region: region.label,
    regionLevel: scope?.level ?? region.level,
    period: "2026/27 营销年度",
    dataCutoff: "7 月 31 日 17:00",
    dataVersion: scope?.version ?? "尚未建立正式账户",
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
      <SupplyFilterBar product={product} onProductChange={setProduct} />
      {scope && scopeKey && product === "corn" ? (
        <>
          <WorkspaceInlineStats
            label="当前供需账户"
            items={[
              {
                label: "账户层级",
                value: scope.level,
              },
              {
                label: "数据覆盖",
                value: scope.coverage,
                tone: toneFor(scope.status),
              },
              {
                label: "采用版本",
                value: scope.version,
              },
              {
                label: "账户状态",
                value: scope.status,
                tone: toneFor(scope.status),
              },
            ]}
          />
          <BalanceStatement scopeKey={scopeKey} />
        </>
      ) : (
        <UnavailableAccount product={product} />
      )}
    </div>
  );
}

function ProductAccounts() {
  const [product, setProduct] = useState<SupplyProduct>("corn");
  const { regionId } = useEnterpriseRegion();
  const productItem = supplyProducts.find((item) => item.key === product)!;
  const hasDetailedAccount = regionId === "qiqihar-all" && product === "corn";
  return (
    <div className="unified-workspace supply-workspace">
      <WorkspaceHeader
        eyebrow="供需与态势 / 产品账户"
        title="产品账户与构成项目"
        summary="玉米、大豆、稻谷和大米分别建账；加工转换在上下游账户成对记录。"
      />
      <SupplyFilterBar product={product} onProductChange={setProduct} />
      {hasDetailedAccount ? (
        <>
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
        </>
      ) : (
        <UnavailableAccount product={product} />
      )}
    </div>
  );
}

function RegionalBalance() {
  const [product, setProduct] = useState<SupplyProduct>("corn");
  const { regionId, setRegionId } = useEnterpriseRegion();
  const region = getEnterpriseRegion(regionId);
  const isQiqihar = region.parentId === "qiqihar";
  const comparisonRegionIds: readonly EnterpriseRegionId[] =
    regionId === "qiqihar-all"
      ? ["qiqihar-all", ...countyAccountRegionIds]
      : ["qiqihar-all", regionId];
  return (
    <div className="unified-workspace supply-workspace">
      <WorkspaceHeader
        eyebrow="供需与态势 / 区域平衡"
        title="市县供需账户对比"
        summary="比较市级合并账户与县区账户的供给、使用、期末库存、差异和数据完整度，并进入单一地区明细。"
      />
      <SupplyFilterBar product={product} onProductChange={setProduct} />
      {!isQiqihar || product !== "corn" ? (
        <UnavailableAccount product={product} />
      ) : (
        <>
          <WorkspaceTableToolbar
            title="市县供需账户对比"
            note={
              regionId === "qiqihar-all"
                ? "市级合并账户抵销市内流转；县区账户分别列示流入和流出"
                : `当前对比：齐齐哈尔市全域与${region.label}`
            }
          />
          <WorkspaceTable
            columns={[
              "地区",
              "账户层级",
              "账户版本",
              "总供给",
              "总使用",
              "采用后期末",
              "库存差额",
              "输入覆盖",
              "待办或质量问题",
              "状态",
              "操作",
            ]}
            label="市县供需账户对比"
            rows={comparisonRegionIds.map((rowRegionId) => {
              const rowScope = getSupplyBalanceScopeForRegion(rowRegionId);
              const rowEquation = rowScope
                ? getSupplyBalanceEquation(rowScope.key)
                : null;
              const countyIndex = countyAccountRegionIds.indexOf(rowRegionId);
              const countyRow =
                countyIndex >= 0 ? countyAccountRows[countyIndex] : null;
              const rowStatus = rowScope?.status ?? countyRow?.[4] ?? "待准备";
              return [
                getEnterpriseRegion(rowRegionId).label,
                rowScope?.level ?? "县级账户",
                rowScope?.version ?? countyRow?.[1] ?? "尚未建立可发布账户",
                rowEquation ? `${rowEquation.totalSupply} 万吨` : "—",
                rowEquation ? `${rowEquation.totalUse} 万吨` : "—",
                rowEquation ? `${rowEquation.adoptedEnding} 万吨` : "—",
                rowEquation ? `${rowEquation.inventoryDifference} 万吨` : "—",
                rowScope?.coverage ?? countyRow?.[2] ?? "—",
                countyRow?.[3] ?? "市内县区流转已抵销",
                <WorkspaceStatus
                  key={`${rowRegionId}-status`}
                  tone={toneFor(rowStatus)}
                >
                  {rowStatus}
                </WorkspaceStatus>,
                <button
                  className="unified-table-action"
                  key={`${rowRegionId}-action`}
                  type="button"
                  onClick={() => setRegionId(rowRegionId)}
                >
                  {regionId === rowRegionId ? "当前" : "查看"}
                </button>,
              ];
            })}
          />
        </>
      )}
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
      <SupplyContext product="corn" state="来源可追溯" />
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
      <SupplyContext product="corn" state="初步态势与正式账户已区分" />
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
        玉米账面期末库存预计为 103.9 万吨；调查汇总期末高于账面推算，形成 1.7
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
