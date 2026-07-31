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
} from "./marketMonitoringModel";
import type { MarketSection } from "./formalEnterpriseModel";

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
    <header className="market-page-header">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{summary}</p>
      </div>
      {actions && <div className="market-page-actions">{actions}</div>}
    </header>
  );
}

function MarketContextStrip({
  object = "玉米 · 市场主体与物流节点",
  state = "本期采集进行中",
}: {
  object?: string;
  state?: string;
}) {
  return (
    <section aria-label="当前市场监测上下文" className="market-context-strip">
      <div className="is-current">
        <span />
        <small>当前责任</small>
        <strong>东北区域经营中心</strong>
      </div>
      <div>
        <small>监测区域</small>
        <strong>三大区域 · 当前授权范围</strong>
      </div>
      <div>
        <small>业务对象</small>
        <strong>{object}</strong>
      </div>
      <div>
        <small>监测期间</small>
        <strong>2026 年第 31 周</strong>
      </div>
      <div>
        <small>截止与状态</small>
        <strong>7 月 31 日 17:00 · {state}</strong>
      </div>
    </section>
  );
}

function MarketStatus({ children }: { children: string }) {
  const tone = children.includes("待") || children.includes("退回")
    ? "warning"
    : children.includes("逾期") || children.includes("异常")
      ? "danger"
      : children.includes("通过") ||
          children.includes("正常") ||
          children.includes("已核定")
        ? "good"
        : "normal";
  return <span className={`market-status is-${tone}`}>{children}</span>;
}

function MarketOverview({
  onCollect,
  onComposeReport,
}: {
  onCollect: () => void;
  onComposeReport: (context: BusinessReportContext) => void;
}) {
  const [grain, setGrain] = useState<GrainKind>("corn");
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
  const tasks = marketTasks.slice(0, 3);

  return (
    <div className="market-workspace market-overview">
      <MarketPageHeader
        eyebrow="市场监测 / 市场总览"
        title="粮食市场监测总览"
        summary="在一个工作区掌握价格、库存、加工、物流、填报履责和待处理异常。"
        actions={
          <>
            <button type="button" onClick={() => onComposeReport(marketReportContext)}>
              编制业务报告
            </button>
            <button className="is-primary" type="button" onClick={onCollect}>
              进入数据采集
            </button>
          </>
        }
      />
      <MarketContextStrip />

      <section aria-label="粮食品类" className="market-grain-strip">
        <div>
          <small>当前粮食品类</small>
          <strong>{grainLabels[grain]}市场</strong>
        </div>
        {(["corn", "soybean", "paddy"] as const).map((item) => (
          <button
            aria-label={`切换到${grainLabels[item]}`}
            aria-pressed={grain === item}
            className={grain === item ? "is-active" : undefined}
            key={item}
            type="button"
            onClick={() => setGrain(item)}
          >
            <strong>{grainLabels[item]}</strong>
            <small>
              {item === "corn"
                ? "86家主体"
                : item === "soybean"
                  ? "42家主体"
                  : "35家主体"}
            </small>
          </button>
        ))}
        <span>品种名称可选标准项，也可保留企业原始填报名称</span>
      </section>

      <section aria-label="市场监测核心指标" className="market-metric-strip">
        {grainMetrics[grain].map(([label, value, unit, note, tone]) => (
          <article className={`is-${tone}`} key={label}>
            <span>{label}</span>
            <strong>
              {value}
              <small>{unit}</small>
            </strong>
            <p>{note}</p>
          </article>
        ))}
      </section>

      <div className="market-overview-grid">
        <section className="market-panel market-trend-panel">
          <div className="market-panel-heading">
            <div>
              <span>价格与到货</span>
              <h2>{grainLabels[grain]}主流价格与样本响应</h2>
            </div>
            <div className="market-panel-tools">
              <button type="button">近 30 天</button>
              <button type="button">全部区域</button>
            </div>
          </div>
          <div className="market-chart">
            <div className="market-chart-axis">
              <span>2,380</span>
              <span>2,340</span>
              <span>2,300</span>
              <span>2,260</span>
            </div>
            <svg aria-label="近30天价格趋势" role="img" viewBox="0 0 760 210">
              <defs>
                <linearGradient id="marketArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#2b938a" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#2b938a" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 158 C74 150 92 126 154 132 S252 144 310 119 S410 78 468 96 S575 70 628 58 S702 64 760 42 L760 210 L0 210 Z"
                fill="url(#marketArea)"
              />
              <path
                d="M0 158 C74 150 92 126 154 132 S252 144 310 119 S410 78 468 96 S575 70 628 58 S702 64 760 42"
                fill="none"
                stroke="#167c74"
                strokeWidth="4"
              />
              <circle cx="760" cy="42" fill="#167c74" r="6" />
            </svg>
            <div className="market-chart-foot">
              <span>7月2日</span>
              <span>7月9日</span>
              <span>7月16日</span>
              <span>7月23日</span>
              <span>7月31日</span>
            </div>
          </div>
          <footer className="market-trend-summary">
            <div>
              <small>样本报价中位数</small>
              <strong>2,342 元/吨</strong>
            </div>
            <div>
              <small>区域最大价差</small>
              <strong>96 元/吨</strong>
            </div>
            <div>
              <small>本周有效响应</small>
              <strong>79 / 86 家</strong>
            </div>
          </footer>
        </section>

        <aside className="market-panel market-task-rail">
          <div className="market-panel-heading">
            <div>
              <span>本人工作</span>
              <h2>需要处理</h2>
            </div>
            <button type="button" onClick={onCollect}>
              全部任务
            </button>
          </div>
          <div className="market-task-cards">
            {tasks.map((task) => (
              <button key={task.id} type="button" onClick={onCollect}>
                <span>{task.id}</span>
                <strong>{task.targetName}</strong>
                <small>
                  {marketRoleLabels[task.role]} · {grainLabels[task.grain]}
                </small>
                <div>
                  <MarketStatus>{task.status}</MarketStatus>
                  <em>{getMarketCompletion(task)}%</em>
                </div>
              </button>
            ))}
          </div>
          <footer>
            <span>3 项影响本周发布</span>
            <strong>最早截止：今天 17:00</strong>
          </footer>
        </aside>
      </div>

      <section className="market-panel market-region-panel">
        <div className="market-panel-heading">
          <div>
            <span>样本网络覆盖</span>
            <h2>三大监测区域</h2>
          </div>
          <small>行政村数量只采用2025—2026年最新官方口径</small>
        </div>
        <div className="market-region-grid">
          {marketRegionCoverage.map((region) => (
            <article key={region.label}>
              <div>
                <strong>{region.label}</strong>
                <span>{region.detail}</span>
              </div>
              <p>
                <small>乡镇覆盖</small>
                <strong>{region.townshipCount}</strong>
              </p>
              <p>
                <small>行政村</small>
                <strong>{region.villageCount}</strong>
              </p>
              <div className="market-region-source">
                <MarketStatus>{region.sourceState}</MarketStatus>
                <small>{region.sourceNote}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="market-panel market-table-panel">
        <div className="market-panel-heading">
          <div>
            <span>监测对象与任务</span>
            <h2>本周采集进度</h2>
          </div>
          <div className="market-panel-tools">
            <button type="button">全部对象</button>
            <button type="button">全部状态</button>
          </div>
        </div>
        <div className="market-table-scroll">
          <table>
            <thead>
              <tr>
                <th>任务编号</th>
                <th>监测对象</th>
                <th>对象角色</th>
                <th>地区</th>
                <th>粮食品类</th>
                <th>责任人</th>
                <th>完成度</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {marketTasks.map((task) => (
                <tr key={task.id}>
                  <td>{task.id}</td>
                  <td>
                    <strong>{task.targetName}</strong>
                  </td>
                  <td>{marketRoleLabels[task.role]}</td>
                  <td>{task.region}</td>
                  <td>{grainLabels[task.grain]}</td>
                  <td>{task.owner}</td>
                  <td>{getMarketCompletion(task)}%</td>
                  <td>
                    <MarketStatus>{task.status}</MarketStatus>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
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
        actions={<button className="is-primary" type="button">新增监测对象</button>}
      />
      <MarketContextStrip object="市场主体与物流节点" state="对象名录有效" />
      <section className="market-panel market-registry-panel">
        <div className="market-target-tabs">
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
          <span>主体角色可以多选，但主体档案不重复建立</span>
        </div>
        <div className="market-table-scroll">
          <table>
            <thead>
              {target === "subject" ? (
                <tr>
                  <th>主体名称</th>
                  <th>业务角色</th>
                  <th>经营品类</th>
                  <th>所属地区</th>
                  <th>责任人</th>
                  <th>监测状态</th>
                </tr>
              ) : (
                <tr>
                  <th>节点名称</th>
                  <th>节点类型</th>
                  <th>覆盖范围</th>
                  <th>责任人</th>
                  <th>监测状态</th>
                </tr>
              )}
            </thead>
            <tbody>
              {target === "subject"
                ? marketSubjectRows.map((row) => (
                    <tr key={row.name}>
                      <td><strong>{row.name}</strong></td>
                      <td>{row.roles}</td>
                      <td>{row.grain}</td>
                      <td>{row.region}</td>
                      <td>{row.owner}</td>
                      <td><MarketStatus>{row.status}</MarketStatus></td>
                    </tr>
                  ))
                : marketLogisticsRows.map((row) => (
                    <tr key={row.name}>
                      <td><strong>{row.name}</strong></td>
                      <td>{row.type}</td>
                      <td>{row.coverage}</td>
                      <td>{row.owner}</td>
                      <td><MarketStatus>{row.status}</MarketStatus></td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const marketFieldRows: Record<
  MarketFieldGroupKey,
  readonly { label: string; value: string; unit?: string; note?: string }[]
> = {
  purchase: [
    {
      label: "收购价格",
      value: "3,092",
      unit: "元/吨",
      note: "到厂价 · 含税",
    },
    { label: "本期收购量", value: "1,860", unit: "吨" },
    { label: "商品形态", value: "散粮 · 潮粮" },
    { label: "品种名称", value: "龙粳31" },
    { label: "作物年度", value: "2025年产" },
  ],
  quality: [
    { label: "水分", value: "15.2", unit: "%" },
    { label: "杂质", value: "0.8", unit: "%" },
    { label: "不完善粒", value: "2.1", unit: "%" },
    { label: "出糙率", value: "78.4", unit: "%" },
    { label: "出米率", value: "68.1", unit: "%" },
  ],
  processing: [
    { label: "日加工量", value: "420", unit: "吨/日" },
    { label: "运行生产线", value: "2 / 3", unit: "条" },
    { label: "设计日产能", value: "600", unit: "吨/日" },
    { label: "开机率", value: "70.0", unit: "%", note: "系统计算" },
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
  movement: [
    { label: "到达量", value: "8,260", unit: "吨" },
    { label: "发运量", value: "12,580", unit: "吨" },
    { label: "包装形态", value: "散粮" },
    { label: "主要起点", value: "讷河市、龙江县" },
    { label: "主要目的地", value: "辽宁鲅鱼圈" },
  ],
  evidence: [
    { label: "运单批次", value: "3 批" },
    { label: "已匹配运单", value: "18 / 20", unit: "张" },
    { label: "过磅凭证", value: "已上传 20 张" },
    { label: "数据来源", value: "铁路运单与站点台账" },
  ],
};

function MarketEntryFields({
  task,
}: {
  task: MarketTask;
}) {
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
                <span>{String(groups.indexOf(group) + 1).padStart(2, "0")}</span>
                <strong>{group.label}</strong>
              </div>
              <small>
                {group.key === "quality"
                  ? "价格对应质量条件"
                  : "本任务适用字段"}
              </small>
            </header>
            <div className="market-entry-fields">
              {marketFieldRows[group.key].map((field) => (
                <label key={field.label}>
                  <span>
                    {field.label}
                    {["收购价格", "本期收购量", "到达量", "发运量"].includes(
                      field.label,
                    ) && <b>*</b>}
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

  return (
    <>
      <div className="market-collection-layout">
        <aside className="market-task-list">
          <header>
            <span>本人任务</span>
            <strong>{target === "subject" ? "市场主体" : "物流节点"}</strong>
            <small>{tasks.length} 项 · 仅本人可填写</small>
          </header>
          <div>
            {tasks.map((task) => (
              <button
                className={task.id === selectedTask.id ? "is-active" : undefined}
                key={task.id}
                type="button"
                onClick={() => setTaskId(task.id)}
              >
                <span>{task.id}</span>
                <strong>{task.targetName}</strong>
                <small>
                  {task.region} · {grainLabels[task.grain]}
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
                {selectedTask.region} · {grainLabels[selectedTask.grain]} ·
                截止 {selectedTask.deadline}
              </p>
            </div>
            <MarketStatus>{selectedTask.status}</MarketStatus>
          </header>
          <MarketEntryFields task={selectedTask} />
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
                <strong>主体、期间和品类</strong>
                <small>任务预置，不允许修改</small>
              </span>
            </p>
            <p className="is-good">
              <b>✓</b>
              <span>
                <strong>价格与计价条件</strong>
                <small>含税、交付地点已填写</small>
              </span>
            </p>
            <p className="is-warning">
              <b>!</b>
              <span>
                <strong>2项凭证待补充</strong>
                <small>
                  {target === "subject"
                    ? "质量检验单尚未上传"
                    : "2张铁路运单尚未匹配"}
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
                <small>审核人和管理员均不能代填</small>
              </span>
            </p>
          </section>
          <footer>
            <span>最近保存</span>
            <strong>今天 13:02 · 王洋</strong>
          </footer>
        </aside>
      </div>
      <footer className="market-collection-footer">
        <span>
          当前任务仅责任人 {selectedTask.owner} 可编辑 ·
          提交后进入统一审核队列
        </span>
        <button type="button">保存草稿</button>
        <button type="button">检查数据</button>
        <button className="is-primary" type="button">
          提交审核
        </button>
      </footer>
    </>
  );
}

function MarketExcelCollection() {
  return (
    <section className="market-panel market-import-panel">
      <div className="market-import-heading">
        <div>
          <span>Excel批量导入</span>
          <h2>当前采集任务批量录入</h2>
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

function MarketSystemCollection() {
  return (
    <section className="market-panel market-system-panel">
      <div className="market-import-heading">
        <div>
          <span>系统接入记录</span>
          <h2>稳定来源接入与异常处理</h2>
          <p>系统接入只改变数据来源，不改变责任、校验和审核流程。</p>
        </div>
        <button type="button">查看全部接入记录</button>
      </div>
      <div className="market-system-summary">
        <article>
          <span>今日接收</span>
          <strong>1,286<small>条</small></strong>
          <p>最近接收 13:04</p>
        </article>
        <article className="is-good">
          <span>自动通过</span>
          <strong>1,241<small>条</small></strong>
          <p>进入待审核业务单据</p>
        </article>
        <article className="is-warning">
          <span>需要确认</span>
          <strong>37<small>条</small></strong>
          <p>单位或主体映射待确认</p>
        </article>
        <article className="is-danger">
          <span>接入失败</span>
          <strong>8<small>条</small></strong>
          <p>不会自动改为零值</p>
        </article>
      </div>
      <div className="market-system-list">
        <div>
          <strong>铁路货运运单数据</strong>
          <span>13:04 · 568条</span>
          <MarketStatus>审核通过</MarketStatus>
        </div>
        <div>
          <strong>企业仓储库存台账</strong>
          <span>12:48 · 426条</span>
          <MarketStatus>待审核</MarketStatus>
        </div>
        <div>
          <strong>米厂生产日报</strong>
          <span>11:32 · 292条</span>
          <MarketStatus>8项异常</MarketStatus>
        </div>
      </div>
    </section>
  );
}

function MarketCollectionWorkspace() {
  const [target, setTarget] =
    useState<MarketCollectionTarget>("subject");
  const [mode, setMode] = useState<MarketCollectionMode>("online");

  return (
    <div className="market-workspace">
      <MarketPageHeader
        eyebrow="市场监测 / 数据采集"
        title="市场监测数据采集"
        summary="在同一工作台完成市场主体和物流节点采集，三种录入方式共用校验、责任和审核规则。"
      />
      <MarketContextStrip object="本人负责的市场采集任务" />
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
        <MarketExcelCollection />
      ) : (
        <MarketSystemCollection />
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
      <section className="market-panel market-table-panel">
        <div className="market-panel-heading">
          <div>
            <span>审核队列</span>
            <h2>待审核与退回事项</h2>
          </div>
        </div>
        <div className="market-review-cards">
          <article>
            <strong>龙江北方粮贸有限公司</strong>
            <p>玉米收购价与质量条件 · 第31周</p>
            <MarketStatus>待审核</MarketStatus>
          </article>
          <article>
            <strong>北安大豆蛋白有限公司</strong>
            <p>蛋白豆收购与日加工量 · 质量依据待补</p>
            <MarketStatus>已退回</MarketStatus>
          </article>
          <article>
            <strong>齐齐哈尔铁路货运站</strong>
            <p>本周发运量 · 运单匹配待确认</p>
            <MarketStatus>待审核</MarketStatus>
          </article>
        </div>
      </section>
    </div>
  );
}

function MarketReportWorkspace({
  onComposeReport,
}: {
  onComposeReport: (context: BusinessReportContext) => void;
}) {
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
            onClick={() => onComposeReport(marketReportContext)}
          >
            编制业务报告
          </button>
        }
      />
      <MarketContextStrip object="玉米 · 价格、库存、加工与物流" state="报告数据可用" />
      <section className="market-panel market-report-grid">
        {["日报", "周报", "月报"].map((frequency) => (
          <article key={frequency}>
            <span>{frequency}</span>
            <strong>玉米市场监测{frequency}</strong>
            <p>采用已审核的价格、质量、库存、加工和物流数据，不重复填报汇总数。</p>
            <button type="button" onClick={() => onComposeReport(marketReportContext)}>
              生成{frequency}
            </button>
          </article>
        ))}
      </section>
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
