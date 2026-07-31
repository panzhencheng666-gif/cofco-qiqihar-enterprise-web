import { useState } from "react";
import type { BusinessReportContext } from "./businessReportModel";
import {
  marketLogisticsRows,
  marketRegionCoverage,
  marketSubjectRows,
  marketTasks,
} from "./marketMonitoringData";
import {
  getApplicableFieldGroups,
  getMarketCompletion,
  grainLabels,
  marketRoleLabels,
  type MarketCollectionMode,
  type MarketCollectionTarget,
  type MarketFieldGroupKey,
  type MarketTask,
  type GrainKind,
  type MarketProductKind,
} from "./marketMonitoringModel";
import type { MarketSection } from "./formalEnterpriseModel";
import { useEnterpriseRegion } from "./EnterpriseRegionContext";
import { getEnterpriseRegion } from "./enterpriseRegions";
import {
  BusinessContextBar,
  WorkspaceFilterBar,
  WorkspaceHeader,
  WorkspaceInlineStats,
  WorkspacePagination,
  WorkspaceStatus,
  WorkspaceTable,
  WorkspaceTableToolbar,
  WorkspaceRegionSelect,
  type WorkspaceTone,
} from "./UnifiedWorkspacePrimitives";

export interface MarketMonitoringWorkspaceProps {
  section: MarketSection;
  onSectionChange?: (section: MarketSection) => void;
  onComposeReport: (context: BusinessReportContext) => void;
}

const marketReportContext: BusinessReportContext = {
  application: "market",
  applicationLabel: "市场监测",
  product: "玉米",
  region: "齐齐哈尔指定范围",
  regionLevel: "区域样本监测",
  period: "2026 年第 31 周",
  dataCutoff: "7 月 31 日 17:00",
  dataVersion: "市场监测第 31 周已核定数据",
  author: "王洋",
  reviewer: "赵晨",
};

function MarketPageHeader({
  eyebrow,
  title,
  summary,
  actions,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  actions?: React.ReactNode;
}) {
  return (
    <WorkspaceHeader
      actions={actions}
      eyebrow={eyebrow}
      summary={summary}
      title={title}
    />
  );
}

function MarketContextStrip({
  object = "玉米 · 市场主体与物流节点",
  state = "本期采集进行中",
}: {
  object?: string;
  state?: string;
}) {
  const { regionId } = useEnterpriseRegion();
  const region = getEnterpriseRegion(regionId);
  return (
    <BusinessContextBar
      items={[
        ["监测区域", <WorkspaceRegionSelect key="market-region" />],
        ["业务对象", object],
        ["监测期间", "2026 年第 31 周"],
        ["截止时间", "7 月 31 日 17:00"],
      ]}
      state={`${region.label} · ${state}`}
      tone={state.includes("待") || state.includes("采集") ? "warning" : "good"}
    />
  );
}

function MarketStatus({ children }: { children: string }) {
  const tone: WorkspaceTone =
    children.includes("待") || children.includes("退回")
      ? "warning"
      : children.includes("逾期") || children.includes("异常")
        ? "danger"
        : children.includes("通过") ||
            children.includes("正常") ||
            children.includes("已核定")
          ? "good"
          : "normal";
  return <WorkspaceStatus tone={tone}>{children}</WorkspaceStatus>;
}

function MarketOverview({
  onCollect,
  onComposeReport,
}: {
  onCollect: () => void;
  onComposeReport: (context: BusinessReportContext) => void;
}) {
  const { regionId } = useEnterpriseRegion();
  const region = getEnterpriseRegion(regionId);
  const [grain, setGrain] = useState<GrainKind>("corn");
  const grainRegistry = {
    corn: {
      subjects: 86,
      varietyCount: 12,
      examples: "德美亚3号、京科968",
    },
    soybean: {
      subjects: 42,
      varietyCount: 9,
      examples: "黑农84、东生22",
    },
    paddy: {
      subjects: 35,
      varietyCount: 8,
      examples: "龙粳31、绥粳18",
    },
  } as const;
  const grainMetrics: Record<
    GrainKind,
    readonly [string, string, string, string, string][]
  > = {
    corn: [
      ["主流收购价", "2,346", "元/吨", "较上次 +8", "good"],
      ["有效报价主体", "86", "家", "本周已报 79 家", "normal"],
      ["重点企业库存", "103.9", "万吨", "同口径 -2.4%", "normal"],
      ["本周铁路发运", "12.6", "万吨", "较四周均值 -12.3%", "warning"],
      ["影响发布异常", "3", "项", "今日需完成核实", "danger"],
    ],
    soybean: [
      ["普通豆主流价", "4,286", "元/吨", "较上次 +12", "good"],
      ["有效报价主体", "42", "家", "蛋白豆 16 家", "normal"],
      ["重点企业库存", "28.4", "万吨", "同口径 +1.1%", "normal"],
      ["本周加工量", "6.8", "万吨", "开机率 72.5%", "normal"],
      ["影响发布异常", "2", "项", "蛋白指标待核", "warning"],
    ],
    paddy: [
      ["主流收购价", "3,092", "元/吨", "较上次持平", "normal"],
      ["有效报价主体", "35", "家", "米厂 19 家", "normal"],
      ["重点企业库存", "18.7", "万吨", "同口径 -0.6%", "normal"],
      ["本周加工量", "4.2", "万吨", "出米率均值 68.1%", "normal"],
      ["影响发布异常", "1", "项", "质量依据待补", "warning"],
    ],
  };
  const selectedReportContext: BusinessReportContext = {
    ...marketReportContext,
    product: grainLabels[grain],
    region: region.label,
    dataVersion: `${grainLabels[grain]}市场监测第 31 周已核定数据`,
  };
  const filteredMarketTasks = marketTasks.filter(
    (task) => task.grain === grain,
  );

  return (
    <div className="market-workspace market-overview">
      <MarketPageHeader
        eyebrow="市场监测 / 市场总览"
        title="粮食市场监测总览"
        summary="在一个工作区掌握价格、库存、加工、物流、填报履责和待处理异常。"
        actions={
          <>
            <button
              type="button"
              onClick={() => onComposeReport(selectedReportContext)}
            >
              编制业务报告
            </button>
            <button className="is-primary" type="button" onClick={onCollect}>
              进入数据采集
            </button>
          </>
        }
      />
      <WorkspaceFilterBar
        label="市场监测查询条件"
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
          <span>监测地区</span>
          <WorkspaceRegionSelect />
        </label>
        <label>
          <span>样本类型</span>
          <select aria-label="样本类型" defaultValue="all">
            <option value="all">企业与物流节点</option>
            <option value="subject">市场主体</option>
            <option value="logistics">物流节点</option>
          </select>
        </label>
        <label>
          <span>粮食品种</span>
          <select
            aria-label="粮食品种"
            value={grain}
            onChange={(event) => setGrain(event.target.value as GrainKind)}
          >
            <option value="corn">玉米</option>
            <option value="soybean">大豆</option>
            <option value="paddy">稻谷</option>
          </select>
        </label>
        <label>
          <span>报送周期</span>
          <select aria-label="报送周期" defaultValue="week-31">
            <option value="week-31">2026 年第 31 周</option>
          </select>
        </label>
        <label>
          <span>填报状态</span>
          <select aria-label="填报状态" defaultValue="all">
            <option value="all">全部状态</option>
            <option value="writing">填写中</option>
            <option value="review">待审核</option>
            <option value="returned">已退回</option>
          </select>
        </label>
      </WorkspaceFilterBar>
      <WorkspaceInlineStats
        label="市场业务统计"
        items={[
          {
            label: "应报",
            value: "428",
          },
          {
            label: "已报",
            value: "395",
            tone: "good",
          },
          {
            label: "待审核",
            value: "27",
            tone: "warning",
          },
          {
            label: "质量阻断",
            value: grainMetrics[grain][4][1],
            tone: "danger",
          },
          {
            label: "统计口径",
            value: "按责任对象去重",
            note: "数据截至 2026-07-31 10:46",
          },
        ]}
      />
      <WorkspaceTableToolbar
        title="市场报送任务清单"
        note={`${region.label} · ${grainLabels[grain]} · 具体品种、价格与质量绑定展示`}
        actions={
          <>
            <button type="button">刷新</button>
            <button type="button">列设置</button>
            <button type="button" onClick={onCollect}>
              进入任务
            </button>
          </>
        }
      />
      <WorkspaceTable
        columns={[
          "序号",
          "样本对象",
          "对象类型",
          "责任地区",
          "品种与具体品种",
          "本期任务",
          "价格与质量摘要",
          "填报状态",
          "责任人",
          "操作",
        ]}
        label="市场报送任务清单"
        rows={filteredMarketTasks.map((task, index) => [
          String(index + 1).padStart(2, "0"),
          <strong key={`${task.id}-name`}>{task.targetName}</strong>,
          marketRoleLabels[task.role],
          task.region,
          `${grainLabels[task.grain]} · ${grainRegistry[grain].examples}`,
          task.target === "logistics"
            ? "流入、发运与即期价格"
            : "价格、数量、库存",
          grain === "corn"
            ? "2,410元/吨 · 水分14.2% · 容重716克/升 · 毒素合格"
            : grain === "soybean"
              ? "4,286元/吨 · 蛋白39.6% · 水分12.8% · 杂质0.7%"
              : "3,092元/吨 · 水分15.2% · 出糙率78.4% · 出米率68.1%",
          <MarketStatus key={`${task.id}-status`}>{task.status}</MarketStatus>,
          task.owner,
          <button className="unified-table-action" key={`${task.id}-action`}>
            查看
          </button>,
        ])}
      />
      <WorkspacePagination
        end={filteredMarketTasks.length}
        page={1}
        pages={9}
        start={1}
        total={428}
      />
      <details className="workspace-policy-details">
        <summary>查看监测区域行政底册</summary>
        <WorkspaceTable
          columns={[
            "监测区域",
            "覆盖范围",
            "乡镇覆盖",
            "行政村",
            "来源状态",
            "来源说明",
          ]}
          label="监测区域与行政来源"
          rows={marketRegionCoverage.map((item) => [
            item.label,
            item.detail,
            item.townshipCount,
            item.villageCount,
            <MarketStatus key={`${item.label}-state`}>
              {item.sourceState}
            </MarketStatus>,
            item.sourceNote,
          ])}
        />
      </details>
    </div>
  );
}

function MarketObjectRegistry() {
  const [target, setTarget] = useState<"subject" | "logistics">("subject");
  return (
    <div className="market-workspace">
      <MarketPageHeader
        eyebrow="市场监测 / 监测对象"
        title="市场监测对象"
        summary="一个经营主体只建一份档案，可同时承担贸易、加工、仓储、消费等多个角色。"
        actions={
          <button className="is-primary" type="button">
            新增监测对象
          </button>
        }
      />
      <MarketContextStrip object="市场主体与物流节点" state="对象名录有效" />
      <WorkspaceTableToolbar
        title="市场对象业务范围"
        note="同一主体可承担多个角色，但只建立一份主体档案"
      />
      <WorkspaceTable
        columns={["业务分组", "纳入对象"]}
        label="市场对象业务范围"
        rows={[
          ["购销与仓储", "贸易商 · 承储企业 / 储备库 · 批发市场"],
          [
            "加工与消费",
            "玉米深加工 · 大豆压榨 / 蛋白加工 · 食品调味 · 米厂 · 饲料 · 养殖",
          ],
          ["专题与节点", "种子 · 农药 · 化肥经销商 · 铁路站点 · 公路物流节点"],
        ]}
      />
      <WorkspaceTableToolbar
        title={target === "subject" ? "市场主体名录" : "物流节点名录"}
        note="主体角色可以多选，但主体档案不重复建立"
        actions={
          <>
            <button
              className={target === "subject" ? "is-active" : undefined}
              type="button"
              onClick={() => setTarget("subject")}
            >
              市场主体
            </button>
            <button
              className={target === "logistics" ? "is-active" : undefined}
              type="button"
              onClick={() => setTarget("logistics")}
            >
              物流节点
            </button>
          </>
        }
      />
      {target === "subject" ? (
        <WorkspaceTable
          columns={[
            "主体名称",
            "业务角色",
            "经营品类",
            "当前监测品种",
            "质量采集范围",
            "所属地区",
            "责任人",
            "监测状态",
          ]}
          label="市场主体名录"
          rows={marketSubjectRows.map((row) => [
            <strong key={`${row.name}-name`}>{row.name}</strong>,
            row.roles,
            row.grain,
            row.varieties,
            row.qualityScope,
            row.region,
            row.owner,
            <MarketStatus key={`${row.name}-status`}>
              {row.status}
            </MarketStatus>,
          ])}
        />
      ) : (
        <WorkspaceTable
          columns={[
            "节点名称",
            "节点类型",
            "覆盖范围",
            "采集范围",
            "责任人",
            "监测状态",
          ]}
          label="物流节点名录"
          rows={marketLogisticsRows.map((row) => [
            <strong key={`${row.name}-name`}>{row.name}</strong>,
            row.type,
            row.coverage,
            row.monitoring,
            row.owner,
            <MarketStatus key={`${row.name}-status`}>
              {row.status}
            </MarketStatus>,
          ])}
        />
      )}
    </div>
  );
}

type MarketFieldRow = {
  label: string;
  value: string;
  unit?: string;
  note?: string;
};

const grainEntryValues: Record<
  GrainKind,
  {
    price: string;
    quantity: string;
    form: string;
    variety: string;
    quality: readonly MarketFieldRow[];
    inventory: readonly MarketFieldRow[];
    sales: readonly MarketFieldRow[];
  }
> = {
  corn: {
    price: "2,346",
    quantity: "2,480",
    form: "散粮 · 干粮",
    variety: "德美亚3号",
    quality: [
      { label: "水分", value: "14.6", unit: "%" },
      { label: "容重", value: "716", unit: "克/升" },
      { label: "霉变粒", value: "0.5", unit: "%" },
      { label: "杂质", value: "0.9", unit: "%" },
      { label: "不完善粒", value: "3.2", unit: "%" },
      { label: "毒素检测", value: "合格" },
    ],
    inventory: [
      { label: "玉米库存", value: "18,420", unit: "吨" },
      { label: "其中散粮", value: "15,860", unit: "吨" },
      { label: "统计时点", value: "7月31日 08:00" },
      { label: "库存性质", value: "企业商品库存" },
    ],
    sales: [
      { label: "车板散粮价", value: "2,382", unit: "元/吨" },
      { label: "车板包粮价", value: "2,418", unit: "元/吨" },
      { label: "本期销售量", value: "1,260", unit: "吨" },
      { label: "交付方式", value: "站台交付" },
    ],
  },
  soybean: {
    price: "4,286",
    quantity: "960",
    form: "袋装 · 筛粮",
    variety: "黑农84",
    quality: [
      { label: "蛋白", value: "39.6", unit: "%" },
      { label: "水分", value: "12.8", unit: "%" },
      { label: "杂质", value: "0.7", unit: "%" },
      { label: "不完善粒", value: "1.9", unit: "%" },
    ],
    inventory: [
      { label: "大豆库存", value: "8,760", unit: "吨" },
      { label: "其中蛋白豆", value: "5,420", unit: "吨" },
      { label: "统计时点", value: "7月31日 08:00" },
      { label: "库存性质", value: "企业商品库存" },
    ],
    sales: [
      { label: "车板筛粮价", value: "4,360", unit: "元/吨" },
      { label: "车板塔粮价", value: "4,520", unit: "元/吨" },
      { label: "本期销售量", value: "620", unit: "吨" },
      { label: "交付方式", value: "车板交付" },
    ],
  },
  paddy: {
    price: "3,092",
    quantity: "1,860",
    form: "散粮 · 粳稻",
    variety: "龙粳31",
    quality: [
      { label: "水分", value: "15.2", unit: "%" },
      { label: "杂质", value: "0.8", unit: "%" },
      { label: "不完善粒", value: "2.1", unit: "%" },
      { label: "出糙率", value: "78.4", unit: "%" },
      { label: "出米率", value: "68.1", unit: "%" },
    ],
    inventory: [
      { label: "稻谷库存", value: "12,680", unit: "吨" },
      { label: "成品米库存", value: "3,260", unit: "吨" },
      { label: "统计时点", value: "7月31日 08:00" },
      { label: "库存性质", value: "企业商品库存" },
    ],
    sales: [
      { label: "大米销售价", value: "5,126", unit: "元/吨" },
      { label: "本期销售量", value: "386", unit: "吨" },
      { label: "交付方式", value: "出厂自提" },
      { label: "销售质量等级", value: "一级粳米" },
    ],
  },
};

function getMarketFieldRows(
  task: MarketTask,
  group: MarketFieldGroupKey,
): readonly MarketFieldRow[] {
  const grain =
    task.grain === "agri-input"
      ? grainEntryValues.corn
      : grainEntryValues[task.grain];
  const rows: Record<MarketFieldGroupKey, readonly MarketFieldRow[]> = {
    purchase: [
      {
        label: task.target === "logistics" ? "即期报价" : "收购价格",
        value: grain.price,
        unit: "元/吨",
        note: task.target === "logistics" ? "站点报价 · 含税" : "到厂价 · 含税",
      },
      {
        label: task.target === "logistics" ? "即期成交价" : "本期收购量",
        value: task.target === "logistics" ? "2,332" : grain.quantity,
        unit: task.target === "logistics" ? "元/吨" : "吨",
      },
      { label: "商品形态", value: grain.form },
      { label: "品种名称", value: grain.variety },
      { label: "作物年度", value: "2025年产" },
    ],
    quality: grain.quality,
    processing: [
      { label: "日加工量", value: "420", unit: "吨/日" },
      { label: "运行生产线", value: "2 / 3", unit: "条" },
      { label: "设计日产能", value: "600", unit: "吨/日" },
      { label: "开机率", value: "70.0", unit: "%", note: "自动计算" },
    ],
    inventory:
      task.role === "agri-dealer"
        ? [
            { label: "种子库存", value: "1,180", unit: "袋" },
            { label: "农药库存", value: "460", unit: "件" },
            { label: "化肥库存", value: "286", unit: "吨" },
            { label: "统计时点", value: "7月31日 08:00" },
          ]
        : grain.inventory,
    sales:
      task.role === "agri-dealer"
        ? [
            { label: "商品类别", value: "种子" },
            { label: "商品名称 / 品种", value: "德美亚3号" },
            { label: "销售价格", value: "48", unit: "元/袋" },
            { label: "本期销售量", value: "326", unit: "袋" },
            { label: "包装规格", value: "25 公斤/袋" },
          ]
        : grain.sales,
    movement:
      task.role === "road-node"
        ? [
            { label: "公路流入量", value: "5,480", unit: "吨" },
            { label: "公路流出量", value: "6,920", unit: "吨" },
            { label: "包装形态", value: "散粮" },
            { label: "主要起点", value: "扎兰屯市周边" },
            { label: "主要目的地", value: "黑龙江南部" },
          ]
        : [
            { label: "铁路到达量", value: "8,260", unit: "吨" },
            { label: "铁路发运量", value: "12,580", unit: "吨" },
            { label: "包装形态", value: "散粮" },
            { label: "主要起点", value: "讷河市、龙江县" },
            { label: "主要目的地", value: "辽宁鲅鱼圈" },
          ],
    evidence:
      task.role === "road-node"
        ? [
            { label: "运输批次", value: "12 批" },
            { label: "已匹配运单", value: "36 / 38", unit: "张" },
            { label: "过磅凭证", value: "已上传 38 张" },
            { label: "数据来源", value: "公路运单与过磅记录" },
          ]
        : [
            { label: "运单批次", value: "3 批" },
            { label: "已匹配运单", value: "18 / 20", unit: "张" },
            { label: "过磅凭证", value: "已上传 20 张" },
            { label: "数据来源", value: "铁路运单与站点台账" },
          ],
  };

  return rows[group];
}

function MarketEntryFields({ task }: { task: MarketTask }) {
  const groups = getApplicableFieldGroups(task.role, task.grain);
  return (
    <>
      <nav aria-label="当前填报内容" className="market-field-navigation">
        {groups.map((group, index) => (
          <button
            className={index === 0 ? "is-active" : undefined}
            key={group.key}
            type="button"
          >
            {group.label}
          </button>
        ))}
      </nav>
      <div className="market-entry-groups">
        {groups.map((group) => (
          <section className="market-entry-group" key={group.key}>
            <header>
              <div>
                <span>
                  {String(groups.indexOf(group) + 1).padStart(2, "0")}
                </span>
                <strong>{group.label}</strong>
              </div>
              <small>
                {group.key === "quality"
                  ? "价格对应质量条件"
                  : "本任务适用字段"}
              </small>
            </header>
            <div className="market-entry-fields">
              {getMarketFieldRows(task, group.key).map((field) => (
                <label key={field.label}>
                  <span>
                    {field.label}
                    {[
                      "收购价格",
                      "本期收购量",
                      "即期报价",
                      "即期成交价",
                      "铁路到达量",
                      "铁路发运量",
                      "公路流入量",
                      "公路流出量",
                    ].includes(field.label) && <b>*</b>}
                  </span>
                  <div>
                    <input
                      aria-label={field.label}
                      defaultValue={field.value}
                      readOnly
                    />
                    {field.unit && <em>{field.unit}</em>}
                  </div>
                  {field.note && <small>{field.note}</small>}
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function MarketOnlineCollection({
  target,
}: {
  target: MarketCollectionTarget;
}) {
  const tasks = marketTasks.filter((task) => task.target === target);
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "");
  const selectedTask =
    tasks.find((task) => task.id === taskId) ?? tasks[0] ?? marketTasks[0];
  const selectedGroups = getApplicableFieldGroups(
    selectedTask.role,
    selectedTask.grain,
  );
  const hasPurchase = selectedGroups.some((group) => group.key === "purchase");
  const validationTitle =
    selectedTask.role === "agri-dealer"
      ? "商品、规格和计量口径"
      : hasPurchase
        ? "价格与计价条件"
        : "流向与数量口径";
  const validationDetail =
    selectedTask.role === "agri-dealer"
      ? "种子品种、农资商品、价格单位和数量已关联"
      : hasPurchase
        ? "品种、质量和交付条件已关联"
        : "起点、终点和运输方向已填写";
  const canEdit = selectedTask.owner === "王洋";

  return (
    <>
      <div className="market-collection-layout">
        <aside className="market-task-list">
          <header>
            <span>区域任务</span>
            <strong>{target === "subject" ? "市场主体" : "物流节点"}</strong>
            <small>{tasks.length} 项 · 按责任人锁定</small>
          </header>
          <div>
            {tasks.map((task) => (
              <button
                className={
                  task.id === selectedTask.id ? "is-active" : undefined
                }
                key={task.id}
                type="button"
                onClick={() => setTaskId(task.id)}
              >
                <span>{task.id}</span>
                <strong>{task.targetName}</strong>
                <small>
                  {task.region} · {grainLabels[task.grain]} · {task.owner}
                </small>
                <div>
                  <MarketStatus>{task.status}</MarketStatus>
                  <em>{getMarketCompletion(task)}%</em>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="market-entry-panel">
          <header className="market-entry-heading">
            <div>
              <span>
                {selectedTask.id} · {marketRoleLabels[selectedTask.role]}
              </span>
              <h2>{selectedTask.targetName}</h2>
              <p>
                {selectedTask.region} · {grainLabels[selectedTask.grain]} · 截止{" "}
                {selectedTask.deadline}
              </p>
            </div>
            <MarketStatus>{selectedTask.status}</MarketStatus>
          </header>
          <MarketEntryFields key={selectedTask.id} task={selectedTask} />
        </section>

        <aside className="market-validation-panel">
          <header>
            <span>数据检查</span>
            <strong>提交前检查结果</strong>
          </header>
          <div className="market-validation-score">
            <strong>{getMarketCompletion(selectedTask)}%</strong>
            <span>
              已填写 {selectedTask.completedFields} /{" "}
              {selectedTask.applicableFields} 项
            </span>
          </div>
          <section>
            <h3>必须完成</h3>
            <p className="is-good">
              <b>✓</b>
              <span>
                <strong>
                  {selectedTask.target === "subject" ? "主体" : "节点"}
                  、期间和品类
                </strong>
                <small>任务预置，不允许修改</small>
              </span>
            </p>
            <p className="is-good">
              <b>✓</b>
              <span>
                <strong>{validationTitle}</strong>
                <small>{validationDetail}</small>
              </span>
            </p>
            <p className="is-warning">
              <b>!</b>
              <span>
                <strong>2项凭证待补充</strong>
                <small>
                  {target === "subject"
                    ? selectedTask.role === "agri-dealer"
                      ? "2项商品规格或进货凭证待补充"
                      : "质量检验单尚未上传"
                    : selectedTask.role === "rail-node"
                      ? "2张铁路运单尚未匹配"
                      : "2张公路运单尚未匹配"}
                </small>
              </span>
            </p>
          </section>
          <section>
            <h3>责任与权限</h3>
            <p className="is-locked">
              <b>锁</b>
              <span>
                <strong>{selectedTask.owner}（责任人）</strong>
                <small>
                  {selectedTask.region}
                  授权范围内唯一可写，审核人和管理员不能代填
                </small>
              </span>
            </p>
          </section>
          <footer>
            <span>最近保存</span>
            <strong>今天 13:02 · {selectedTask.owner}</strong>
          </footer>
        </aside>
      </div>
      <footer className="market-collection-footer">
        <span>
          当前任务仅责任人 {selectedTask.owner} 可编辑 · 提交后进入统一审核队列
        </span>
        <button disabled={!canEdit} type="button">
          保存草稿
        </button>
        <button disabled={!canEdit} type="button">
          检查数据
        </button>
        <button className="is-primary" disabled={!canEdit} type="button">
          提交审核
        </button>
      </footer>
    </>
  );
}

function MarketExcelCollection({ target }: { target: MarketCollectionTarget }) {
  const targetLabel = target === "subject" ? "市场主体" : "物流节点";
  return (
    <section className="market-panel market-import-panel">
      <div className="market-import-heading">
        <div>
          <span>Excel批量导入</span>
          <h2>{targetLabel}任务批量录入</h2>
          <p>上传后先预检，不直接提交</p>
        </div>
        <button type="button">下载当前任务模板</button>
      </div>
      <div className="market-import-flow">
        <article className="is-done">
          <span>01</span>
          <strong>下载任务模板</strong>
          <p>地区、期间、责任人和样本编号已经锁定</p>
        </article>
        <article className="is-current">
          <span>02</span>
          <strong>上传并预检</strong>
          <p>支持 .xlsx，单次不超过 5,000 行</p>
        </article>
        <article>
          <span>03</span>
          <strong>修正错误</strong>
          <p>错误定位到工作表、行和列</p>
        </article>
        <article>
          <span>04</span>
          <strong>确认导入</strong>
          <p>进入与在线填报相同的审核流程</p>
        </article>
      </div>
      <div className="market-upload-zone">
        <span>↥</span>
        <strong>拖放 Excel 文件到此处，或选择文件</strong>
        <p>系统先检查模板、任务身份、必填项、单位和重复数据</p>
        <button className="is-primary" type="button">
          选择 Excel 文件
        </button>
      </div>
      <footer className="market-import-summary">
        <div>
          <small>最近一次预检</small>
          <strong>228 行</strong>
        </div>
        <div>
          <small>通过</small>
          <strong>215 行</strong>
        </div>
        <div className="is-warning">
          <small>警告</small>
          <strong>8 行</strong>
        </div>
        <div className="is-danger">
          <small>错误</small>
          <strong>5 行</strong>
        </div>
        <button type="button">导出错误明细</button>
      </footer>
    </section>
  );
}

function MarketSystemCollection({
  target,
}: {
  target: MarketCollectionTarget;
}) {
  const targetLabel = target === "subject" ? "市场主体" : "物流节点";
  const sourceData =
    target === "subject"
      ? {
          received: "718",
          accepted: "684",
          review: "29",
          failed: "5",
          latest: "12:48",
          rows: [
            ["企业仓储库存台账", "12:48 · 426条", "待审核"],
            ["米厂生产日报", "11:32 · 292条", "5项异常"],
          ] as const,
        }
      : {
          received: "568",
          accepted: "557",
          review: "9",
          failed: "2",
          latest: "13:04",
          rows: [
            ["铁路货运运单数据", "13:04 · 438条", "审核通过"],
            ["公路过磅与运单数据", "12:56 · 130条", "待审核"],
          ] as const,
        };
  return (
    <section className="market-panel market-system-panel">
      <div className="market-import-heading">
        <div>
          <span>系统接入记录</span>
          <h2>{targetLabel}稳定来源接入与异常处理</h2>
          <p>系统接入只改变数据来源，不改变责任、校验和审核流程。</p>
        </div>
        <button type="button">查看全部接入记录</button>
      </div>
      <div className="market-system-summary">
        <article>
          <span>今日接收</span>
          <strong>
            {sourceData.received}
            <small>条</small>
          </strong>
          <p>最近接收 {sourceData.latest}</p>
        </article>
        <article className="is-good">
          <span>自动通过</span>
          <strong>
            {sourceData.accepted}
            <small>条</small>
          </strong>
          <p>进入待审核业务单据</p>
        </article>
        <article className="is-warning">
          <span>需要确认</span>
          <strong>
            {sourceData.review}
            <small>条</small>
          </strong>
          <p>单位或主体映射待确认</p>
        </article>
        <article className="is-danger">
          <span>接入失败</span>
          <strong>
            {sourceData.failed}
            <small>条</small>
          </strong>
          <p>不会自动改为零值</p>
        </article>
      </div>
      <div className="market-system-list">
        {sourceData.rows.map(([name, detail, state]) => (
          <div key={name}>
            <strong>{name}</strong>
            <span>{detail}</span>
            <MarketStatus>{state}</MarketStatus>
          </div>
        ))}
      </div>
    </section>
  );
}

function MarketCollectionWorkspace() {
  const [target, setTarget] = useState<MarketCollectionTarget>("subject");
  const [mode, setMode] = useState<MarketCollectionMode>("online");

  return (
    <div className="market-workspace">
      <MarketPageHeader
        eyebrow="市场监测 / 数据采集"
        title="市场监测数据采集"
        summary="在同一工作台完成市场主体和物流节点采集，三种录入方式共用校验、责任和审核规则。"
      />
      <MarketContextStrip object="当前授权范围内市场采集任务" />
      <section className="market-collection-switches">
        <div aria-label="采集对象">
          <button
            className={target === "subject" ? "is-active" : undefined}
            type="button"
            onClick={() => setTarget("subject")}
          >
            市场主体填报
          </button>
          <button
            className={target === "logistics" ? "is-active" : undefined}
            type="button"
            onClick={() => setTarget("logistics")}
          >
            物流节点填报
          </button>
        </div>
        <div aria-label="采集方式">
          {(
            [
              ["online", "在线填报"],
              ["excel", "Excel批量导入"],
              ["system", "系统接入记录"],
            ] as const
          ).map(([key, label]) => (
            <button
              className={mode === key ? "is-active" : undefined}
              key={key}
              type="button"
              onClick={() => setMode(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <span>同一任务 · 同一责任人 · 同一审核流程</span>
      </section>
      {mode === "online" ? (
        <MarketOnlineCollection key={target} target={target} />
      ) : mode === "excel" ? (
        <MarketExcelCollection target={target} />
      ) : (
        <MarketSystemCollection target={target} />
      )}
    </div>
  );
}

function MarketReviewWorkspace() {
  return (
    <div className="market-workspace">
      <MarketPageHeader
        eyebrow="市场监测 / 审核发布"
        title="市场数据审核与发布"
        summary="集中核对价格条件、数量口径、异常解释和发布资格。"
      />
      <MarketContextStrip object="待审核市场数据" state="7项待审核" />
      <section
        aria-label="市场数据发布与供需采用关系"
        className="market-lineage"
      >
        <header>
          <span>审核发布与供需采用</span>
          <strong>只采用已核定数据，不直接改写供需账户</strong>
        </header>
        <ol>
          <li>
            <span>01</span>
            <strong>原始填报</strong>
            <small>责任人、品种、价格和质量留痕</small>
          </li>
          <li>
            <span>02</span>
            <strong>业务审核</strong>
            <small>数量、凭证和异常解释核定</small>
          </li>
          <li>
            <span>03</span>
            <strong>正式发布</strong>
            <small>形成不可覆盖的市场数据版本</small>
          </li>
          <li>
            <span>04</span>
            <strong>供需采用</strong>
            <small>库存、加工和去重物流按版本引用</small>
          </li>
        </ol>
      </section>
      <WorkspaceTableToolbar
        title="待审核与退回事项"
        note="审核人只能核定、退回和填写审核意见，不能代改填报值"
      />
      <WorkspaceTable
        columns={["监测对象", "审核内容", "期间", "当前状态"]}
        label="市场审核队列"
        rows={[
          [
            "龙江北方粮贸有限公司",
            "玉米收购价与质量条件",
            "2026 年第 31 周",
            <MarketStatus key="market-review-1">待审核</MarketStatus>,
          ],
          [
            "北安大豆蛋白有限公司",
            "蛋白豆收购与日加工量 · 质量依据待补",
            "2026 年第 31 周",
            <MarketStatus key="market-review-2">已退回</MarketStatus>,
          ],
          [
            "齐齐哈尔铁路货运站",
            "本周发运量 · 运单匹配待确认",
            "2026 年第 31 周",
            <MarketStatus key="market-review-3">待审核</MarketStatus>,
          ],
        ]}
      />
    </div>
  );
}

function MarketReportWorkspace({
  onComposeReport,
}: {
  onComposeReport: (context: BusinessReportContext) => void;
}) {
  const [product, setProduct] = useState<MarketProductKind>("corn");
  const productLabel = grainLabels[product];
  const reportContext: BusinessReportContext = {
    ...marketReportContext,
    product: productLabel,
    dataVersion: `${productLabel}市场监测第 31 周已核定数据`,
  };
  const reportScope =
    product === "agri-input"
      ? "种子、农药、化肥价格、销量和库存"
      : "价格、质量、库存、加工与物流";
  const reportSource =
    product === "agri-input"
      ? "采用已审核的种子、农药和化肥价格、销量及库存数据；农资专题不进入粮食供需数量。"
      : "采用已审核的价格、质量、库存、加工和物流数据，不重复填报汇总数。";

  return (
    <div className="market-workspace">
      <MarketPageHeader
        eyebrow="市场监测 / 分析与报告"
        title="市场分析与业务报告"
        summary="按照所选区域、品类和期间，从已审核数据生成日报、周报和月报。"
        actions={
          <button
            className="is-primary"
            type="button"
            onClick={() => onComposeReport(reportContext)}
          >
            编制业务报告
          </button>
        }
      />
      <MarketContextStrip
        object={`${productLabel} · ${reportScope}`}
        state="报告数据可用"
      />
      <section aria-label="报告业务选择" className="market-report-scope">
        <div>
          <span>报告业务</span>
          {(["corn", "soybean", "paddy", "agri-input"] as const).map((item) => (
            <button
              aria-pressed={product === item}
              className={product === item ? "is-active" : undefined}
              key={item}
              type="button"
              onClick={() => setProduct(item)}
            >
              {grainLabels[item]}
            </button>
          ))}
        </div>
        <p>
          <small>报告区域</small>
          <strong>三大区域 · 当前授权范围</strong>
        </p>
        <p>
          <small>采用口径</small>
          <strong>仅采用已审核数据 · 截止 7 月 31 日 17:00</strong>
        </p>
      </section>
      <WorkspaceTableToolbar
        title="市场业务报告"
        note="日报、周报和月报采用同一已审核数据版本"
      />
      <WorkspaceTable
        columns={["报告频率", "报告名称", "数据来源与采用口径", "操作"]}
        label="市场业务报告"
        rows={["日报", "周报", "月报"].map((frequency) => [
          frequency,
          `${productLabel}${
            product === "agri-input" ? "市场专题" : "市场监测"
          }${frequency}`,
          reportSource,
          <button
            className="unified-table-action"
            key={frequency}
            type="button"
            onClick={() => onComposeReport(reportContext)}
          >
            生成{frequency}
          </button>,
        ])}
      />
    </div>
  );
}

export function MarketMonitoringWorkspace({
  section,
  onSectionChange,
  onComposeReport,
}: MarketMonitoringWorkspaceProps) {
  if (section === "collection") return <MarketCollectionWorkspace />;
  if (section === "objects") return <MarketObjectRegistry />;
  if (section === "review") return <MarketReviewWorkspace />;
  if (section === "reports") {
    return <MarketReportWorkspace onComposeReport={onComposeReport} />;
  }
  return (
    <MarketOverview
      onCollect={() => onSectionChange?.("collection")}
      onComposeReport={onComposeReport}
    />
  );
}
