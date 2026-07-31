import { useState } from "react";
import type { BusinessReportContext } from "./businessReportModel";
import { useEnterpriseRegion } from "./EnterpriseRegionContext";
import { getEnterpriseRegion } from "./enterpriseRegions";
import type { SupplySection } from "./formalEnterpriseModel";
import {
  WorkspaceFilterBar,
  WorkspaceHeader,
  WorkspaceInlineStats,
  WorkspaceRegionSelect,
  WorkspaceStatus,
  WorkspaceTable,
  WorkspaceTableToolbar,
  type WorkspaceTone,
} from "./UnifiedWorkspacePrimitives";

export interface SupplyDemandWorkspaceProps {
  section: SupplySection | "statement";
  onComposeReport: (context: BusinessReportContext) => void;
}

type SupplyProduct =
  "corn" | "soybean" | "soymeal" | "soyoil" | "soy-protein" | "paddy" | "rice";

type BalanceGroup = "供给" | "使用与外流" | "期末与核对";

interface BalanceRow {
  group: BalanceGroup;
  item: string;
  current: number;
  previous: number;
  sourceBusiness: string;
  sourceVersion: string;
  status: string;
  tone: WorkspaceTone;
  total?: boolean;
}

const productLabels: Record<SupplyProduct, string> = {
  corn: "玉米原粮",
  soybean: "大豆原粮",
  soymeal: "豆粕",
  soyoil: "豆油",
  "soy-protein": "大豆蛋白产品",
  paddy: "稻谷原粮",
  rice: "大米产品",
};

const cornBalanceRows: readonly BalanceRow[] = [
  {
    group: "供给",
    item: "期初库存",
    current: 126.4,
    previous: 121.8,
    sourceBusiness: "上期供需平衡",
    sourceVersion: "2025/26年度正式期末版本",
    status: "已采用",
    tone: "good",
  },
  {
    group: "供给",
    item: "本地生产",
    current: 512.8,
    previous: 498.6,
    sourceBusiness: "产情监测",
    sourceVersion: "2026年第30周正式产量版本",
    status: "已采用",
    tone: "good",
  },
  {
    group: "供给",
    item: "区域外流入",
    current: 118.7,
    previous: 114.3,
    sourceBusiness: "市场监测 · 物流",
    sourceVersion: "2026年第31周边界流入版本",
    status: "已采用",
    tone: "good",
  },
  {
    group: "供给",
    item: "国际进口",
    current: 5.2,
    previous: 4.9,
    sourceBusiness: "市场监测 · 进口",
    sourceVersion: "2026年第31周进口核定版本",
    status: "已采用",
    tone: "good",
  },
  {
    group: "供给",
    item: "其他供给",
    current: 0,
    previous: 0,
    sourceBusiness: "供需调整",
    sourceVersion: "2026/27年度第3版",
    status: "已核定",
    tone: "normal",
  },
  {
    group: "供给",
    item: "总供给",
    current: 763.1,
    previous: 739.6,
    sourceBusiness: "供需平衡",
    sourceVersion: "2026/27年度第3版",
    status: "已计算",
    tone: "good",
    total: true,
  },
  {
    group: "使用与外流",
    item: "口粮消费",
    current: 32.4,
    previous: 33.1,
    sourceBusiness: "消费采用值",
    sourceVersion: "2026/27年度消费采用版本",
    status: "已采用",
    tone: "good",
  },
  {
    group: "使用与外流",
    item: "饲用消费",
    current: 176.8,
    previous: 170.4,
    sourceBusiness: "市场监测 · 饲料养殖",
    sourceVersion: "2026年第31周饲用核定版本",
    status: "已采用",
    tone: "good",
  },
  {
    group: "使用与外流",
    item: "种用消费",
    current: 7.6,
    previous: 7.3,
    sourceBusiness: "产情监测 · 用种",
    sourceVersion: "2026年播种用种正式版本",
    status: "已采用",
    tone: "good",
  },
  {
    group: "使用与外流",
    item: "加工投入",
    current: 321.7,
    previous: 308.9,
    sourceBusiness: "市场监测 · 加工",
    sourceVersion: "2026年第31周加工投入版本",
    status: "已采用",
    tone: "good",
  },
  {
    group: "使用与外流",
    item: "损耗",
    current: 18.6,
    previous: 17.9,
    sourceBusiness: "产情与市场监测",
    sourceVersion: "2026/27年度损耗采用版本",
    status: "已采用",
    tone: "good",
  },
  {
    group: "使用与外流",
    item: "区域外流出",
    current: 95.1,
    previous: 91.7,
    sourceBusiness: "市场监测 · 物流",
    sourceVersion: "2026年第31周边界流出版本",
    status: "已采用",
    tone: "good",
  },
  {
    group: "使用与外流",
    item: "国际出口",
    current: 6,
    previous: 5.7,
    sourceBusiness: "市场监测 · 出口",
    sourceVersion: "2026年第31周出口核定版本",
    status: "已采用",
    tone: "good",
  },
  {
    group: "使用与外流",
    item: "其他使用",
    current: 1,
    previous: 0.8,
    sourceBusiness: "供需调整",
    sourceVersion: "2026/27年度第3版",
    status: "已核定",
    tone: "normal",
  },
  {
    group: "使用与外流",
    item: "总使用与外流",
    current: 659.2,
    previous: 635.8,
    sourceBusiness: "供需平衡",
    sourceVersion: "2026/27年度第3版",
    status: "已计算",
    tone: "good",
    total: true,
  },
  {
    group: "期末与核对",
    item: "调整前账面期末",
    current: 103.9,
    previous: 103.8,
    sourceBusiness: "供需平衡",
    sourceVersion: "2026/27年度第3版",
    status: "已计算",
    tone: "good",
    total: true,
  },
  {
    group: "期末与核对",
    item: "批准库存调整",
    current: 0,
    previous: 0,
    sourceBusiness: "库存调整审批",
    sourceVersion: "2026/27年度第3版",
    status: "无调整",
    tone: "normal",
  },
  {
    group: "期末与核对",
    item: "采用后账面期末",
    current: 103.9,
    previous: 103.8,
    sourceBusiness: "供需平衡",
    sourceVersion: "2026/27年度第3版",
    status: "候选期初",
    tone: "good",
    total: true,
  },
  {
    group: "期末与核对",
    item: "调查汇总期末",
    current: 105.6,
    previous: 104.2,
    sourceBusiness: "市场与产情库存调查",
    sourceVersion: "2026年第31周库存调查版本",
    status: "待核对",
    tone: "warning",
  },
  {
    group: "期末与核对",
    item: "库存平衡差额",
    current: 1.7,
    previous: 0.4,
    sourceBusiness: "供需平衡",
    sourceVersion: "2026/27年度第3版",
    status: "待解释",
    tone: "warning",
    total: true,
  },
];

function amount(value: number): string {
  return `${value.toFixed(1)} 万吨`;
}

function change(current: number, previous: number): string {
  const difference = Number((current - previous).toFixed(1));
  if (difference === 0) return "持平";
  return `${difference > 0 ? "+" : ""}${difference.toFixed(1)} 万吨`;
}

function SupplyStatement({
  onComposeReport,
}: {
  onComposeReport: (context: BusinessReportContext) => void;
}) {
  const { regionId } = useEnterpriseRegion();
  const region = getEnterpriseRegion(regionId);
  const [product, setProduct] = useState<SupplyProduct>("corn");
  const [selectedSource, setSelectedSource] = useState<BalanceRow | null>(null);
  const hasFormalAccount = product === "corn" && region.parentId === "qiqihar";

  const reportContext: BusinessReportContext = {
    application: "supply",
    applicationLabel: "供需与态势",
    product: productLabels[product],
    region: region.label,
    regionLevel: region.level,
    period: "2026/27 营销年度",
    dataCutoff: "7 月 31 日 17:00",
    dataVersion: "2026/27年度供需账户第3版",
    author: "王洋",
    reviewer: "赵晨",
  };

  return (
    <div className="unified-workspace supply-workspace">
      <WorkspaceHeader
        actions={
          <button
            className="is-primary"
            type="button"
            onClick={() => onComposeReport(reportContext)}
          >
            编制供需报告
          </button>
        }
        eyebrow="供需与态势 / 供需平衡表"
        summary="按地区、产品、营销年度和采用版本查看正式供需账户。"
        title="区域粮食供需平衡表"
      />
      <WorkspaceFilterBar
        actions={
          <>
            <button className="is-primary" type="button">
              查询
            </button>
            <button type="button">重置</button>
          </>
        }
        label="供需平衡查询条件"
      >
        <label>
          <span>业务地区</span>
          <WorkspaceRegionSelect />
        </label>
        <label>
          <span>产品账户</span>
          <select
            aria-label="产品账户"
            value={product}
            onChange={(event) => {
              setProduct(event.target.value as SupplyProduct);
              setSelectedSource(null);
            }}
          >
            {Object.entries(productLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>营销年度</span>
          <select aria-label="营销年度" defaultValue="2026-27">
            <option value="2026-27">2026/27 营销年度</option>
            <option value="2025-26">2025/26 营销年度</option>
          </select>
        </label>
        <label>
          <span>采用版本</span>
          <select aria-label="采用版本" defaultValue="v3">
            <option value="v3">第3版 · 当前采用</option>
            <option value="v2">第2版 · 已替代</option>
          </select>
        </label>
      </WorkspaceFilterBar>
      <WorkspaceInlineStats
        label="当前供需账户"
        items={[
          {
            label: "当前账户",
            value: `${region.label} · ${productLabels[product]}`,
          },
          { label: "统计单位", value: "万吨" },
          {
            label: "账户状态",
            value: hasFormalAccount ? "正式账户已核定" : "尚未形成正式账户版本",
            tone: hasFormalAccount ? "good" : "warning",
          },
          { label: "数据截止", value: "2026-07-31 17:00" },
        ]}
      />

      {hasFormalAccount ? (
        <>
          <WorkspaceTableToolbar
            note="单位：万吨"
            title={`${region.label} · ${productLabels[product]}`}
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
                  <th scope="col">来源版本</th>
                  <th scope="col">状态</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                {cornBalanceRows.map((row, index) => {
                  const showGroup =
                    index === 0 ||
                    cornBalanceRows[index - 1]?.group !== row.group;
                  const groupSize = cornBalanceRows.filter(
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
                      <td>{row.sourceVersion}</td>
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
                          onClick={() => setSelectedSource(row)}
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
                <button type="button" onClick={() => setSelectedSource(null)}>
                  关闭
                </button>
              </header>
              <dl>
                <div>
                  <dt>来源业务</dt>
                  <dd>{selectedSource.sourceBusiness}</dd>
                </div>
                <div>
                  <dt>来源版本</dt>
                  <dd>{selectedSource.sourceVersion}</dd>
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
        </>
      ) : (
        <>
          <WorkspaceTableToolbar title="供需账户准备状态" />
          <WorkspaceTable
            columns={["地区", "产品账户", "账户版本", "数据状态", "处理入口"]}
            label="供需账户准备状态"
            rows={[
              [
                region.label,
                productLabels[product],
                "尚未形成正式账户版本",
                <WorkspaceStatus key="missing" tone="warning">
                  缺失
                </WorkspaceStatus>,
                <button
                  className="unified-table-action"
                  key="prepare"
                  type="button"
                >
                  查看数据准备
                </button>,
              ],
            ]}
          />
        </>
      )}
    </div>
  );
}

function SupplyVersionHistory() {
  return (
    <div className="unified-workspace supply-workspace">
      <WorkspaceHeader
        eyebrow="供需与态势 / 版本记录"
        summary="查询供需账户的编制、审核、发布和替代记录。"
        title="供需版本记录"
      />
      <WorkspaceFilterBar
        actions={
          <button className="is-primary" type="button">
            查询
          </button>
        }
        label="供需版本查询条件"
      >
        <label>
          <span>业务地区</span>
          <WorkspaceRegionSelect />
        </label>
        <label>
          <span>产品账户</span>
          <select aria-label="产品账户" defaultValue="corn">
            {Object.entries(productLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>营销年度</span>
          <select aria-label="营销年度" defaultValue="2026-27">
            <option value="2026-27">2026/27 营销年度</option>
            <option value="2025-26">2025/26 营销年度</option>
          </select>
        </label>
      </WorkspaceFilterBar>
      <WorkspaceTableToolbar title="供需版本记录" />
      <WorkspaceTable
        columns={[
          "版本",
          "地区",
          "产品账户",
          "状态",
          "编制人",
          "审核人",
          "发布时间",
          "操作",
        ]}
        label="供需版本记录"
        rows={[
          [
            "第3版",
            "齐齐哈尔市全域",
            "玉米原粮",
            <WorkspaceStatus key="active" tone="good">
              当前采用
            </WorkspaceStatus>,
            "王洋",
            "赵晨",
            "2026-07-31 16:20",
            <button className="unified-table-action" key="view-3" type="button">
              查看
            </button>,
          ],
          [
            "第2版",
            "齐齐哈尔市全域",
            "玉米原粮",
            <WorkspaceStatus key="replaced">已替代</WorkspaceStatus>,
            "王洋",
            "赵晨",
            "2026-07-24 16:10",
            <button className="unified-table-action" key="view-2" type="button">
              查看
            </button>,
          ],
          [
            "第1版",
            "齐齐哈尔市全域",
            "玉米原粮",
            <WorkspaceStatus key="history">历史版本</WorkspaceStatus>,
            "王洋",
            "赵晨",
            "2026-07-17 15:50",
            <button className="unified-table-action" key="view-1" type="button">
              查看
            </button>,
          ],
        ]}
      />
    </div>
  );
}

export function SupplyDemandWorkspace({
  section,
  onComposeReport,
}: SupplyDemandWorkspaceProps) {
  if (section === "versions") return <SupplyVersionHistory />;
  return <SupplyStatement onComposeReport={onComposeReport} />;
}
