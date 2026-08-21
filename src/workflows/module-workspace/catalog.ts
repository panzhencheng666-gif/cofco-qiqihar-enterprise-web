import type { ModuleWorkspaceRecord, ModuleWorkspaceView } from "./model";
import { monitoringObjectIds } from "@/domains/monitoring-object/identifiers";

const standardLifecycle = [
  { key: "assigned", label: "任务下达", detail: "428 项", state: "completed" },
  { key: "collected", label: "事实采集", detail: "395 项", state: "completed" },
  { key: "quality", label: "规则校验", detail: "5 项阻断", state: "current" },
  { key: "review", label: "分级审核", detail: "37 项待办", state: "pending" },
  {
    key: "publish",
    label: "版本发布",
    detail: "生成演示事实版本",
    state: "pending",
  },
] as const;

const standardLabels = {
  name: "业务对象或任务",
  category: "对象类型",
  scope: "责任区域",
  period: "本期事项",
  status: "业务状态",
  quality: "质量状态",
  owner: "当前责任人",
  timeLimit: "时限",
} as const;

function sectionNavigation(worklistLabel: string) {
  return [
    { key: "overview", label: "运营总览", target: "#section-overview" },
    { key: "worklist", label: worklistLabel, target: "#section-worklist" },
    { key: "lifecycle", label: "流程与审核", target: "#section-lifecycle" },
    { key: "quality", label: "质量与异常", target: "#section-quality" },
    { key: "controls", label: "来源与版本", target: "#section-controls" },
  ] as const;
}

const farmerObjects = [
  {
    businessObjectId: monitoringObjectIds.farmerSample017,
    name: "龙江县农户样本 017",
    scope: "龙江县 / 景星镇",
    owner: "李敏",
  },
  {
    businessObjectId: "farmer-042",
    name: "讷河市农户样本 042",
    scope: "讷河市 / 同义镇",
    owner: "王洋",
  },
  {
    businessObjectId: "farmer-108",
    name: "依安县农户样本 108",
    scope: "依安县 / 新兴镇",
    owner: "赵晨",
  },
] as const;

const plantingRecords: readonly ModuleWorkspaceRecord[] = [
  {
    id: "planting-village-001",
    businessObjectId: "village-fuqiang",
    name: "同义镇富强村级样本点",
    category: "行政村样本",
    scope: "讷河市 / 同义镇",
    period: "秋收测产调查",
    status: "县级审核中",
    quality: "2 条待解释",
    owner: "王洋",
    timeLimit: "今天 12:00",
  },
  {
    id: "planting-extension-001",
    businessObjectId: "extension-nehe",
    name: "讷河市农业技术推广中心",
    category: "农技站",
    scope: "讷河市",
    period: "秋收测产调查",
    status: "已经提交",
    quality: "通过",
    owner: "赵晨",
    timeLimit: "今天 14:00",
  },
  ...farmerObjects.map((farmer, index) => ({
    id: `planting-${farmer.businessObjectId}`,
    businessObjectId: farmer.businessObjectId,
    name: farmer.name,
    category: "农户样本",
    scope: farmer.scope,
    period: "作物季面积与成本调查",
    status: index === 0 ? "等待填报" : "已经提交",
    quality: index === 0 ? "未校验" : "通过",
    owner: farmer.owner,
    timeLimit: index === 0 ? "明天 10:00" : "今天 16:00",
  })),
];

function farmerRecords(
  context: "stock" | "sales" | "intention",
): readonly ModuleWorkspaceRecord[] {
  const contextDefinition = {
    stock: {
      period: "农户余粮与库存调查",
      status: "等待填报",
      quality: "未校验",
    },
    sales: {
      period: "农户销售事件核对",
      status: "等待复核",
      quality: "销售与库存待勾稽",
    },
    intention: {
      period: "下一作物季种植意愿调查",
      status: "已经提交",
      quality: "上期面积已引用",
    },
  }[context];

  return farmerObjects.map((farmer, index) => ({
    id: `${context}-${farmer.businessObjectId}`,
    businessObjectId: farmer.businessObjectId,
    name: farmer.name,
    category: "农户样本",
    scope: farmer.scope,
    period: contextDefinition.period,
    status: index === 2 ? "县级审核中" : contextDefinition.status,
    quality: index === 2 ? "1 条待解释" : contextDefinition.quality,
    owner: farmer.owner,
    timeLimit: index === 0 ? "今天 12:00" : "明天 10:00",
  }));
}

function productionRecords(context: string): readonly ModuleWorkspaceRecord[] {
  if (context === "stock") return farmerRecords("stock");
  if (context === "sales") return farmerRecords("sales");
  if (context === "intention") return farmerRecords("intention");
  return plantingRecords;
}

function productionView(context: string): ModuleWorkspaceView {
  const titles: Record<string, [string, string]> = {
    production: [
      "产情监测运营总览",
      "统一查看种植样本、农户库存销售、种植意愿、质量审核和演示发布状态。",
    ],
    planting: [
      "种植生产运营工作区",
      "在同一对象和生长周期内管理面积、单产、产量、成本、补贴、保险及全过程来源。",
    ],
    stock: [
      "农户余粮运营工作区",
      "管理分品种库存快照、自用、损耗和盘点差异；销售事件在此只读用于勾稽，唯一录入入口在农户销售工作区。",
    ],
    sales: [
      "农户销售运营工作区",
      "记录逐笔有效销售事件，由系统汇总销售数量、销售比例和库存变动，不重复填写累计值。",
    ],
    intention: [
      "种植意愿运营工作区",
      "引用当前演示种植面积，结合价格、销量和调查原因形成下一年度意愿变化及解释。",
    ],
  };
  const [title, description] = titles[context] ?? titles.production;
  const metricsByContext: Record<string, ModuleWorkspaceView["metrics"]> = {
    production: [
      {
        key: "objects",
        label: "有效样本对象",
        value: 554,
        suffix: "个",
        note: "行政村样本、农技站和农户样本",
      },
      {
        key: "coverage",
        label: "本期采集完成率",
        value: 92.4,
        suffix: "%",
        note: "395 / 428 份已提交",
        tone: "success",
      },
      {
        key: "review",
        label: "待审核与退回",
        value: 37,
        suffix: "项",
        note: "8 项临近时限",
        tone: "warning",
      },
      {
        key: "blocking",
        label: "阻断性质量异常",
        value: 5,
        suffix: "项",
        note: "影响事实版本生成",
        tone: "danger",
      },
    ],
    planting: [
      {
        key: "objects",
        label: "种植调查对象",
        value: 554,
        suffix: "个",
        note: "行政村样本、农技站和农户样本",
      },
      {
        key: "coverage",
        label: "面积与产量完成率",
        value: 92.4,
        suffix: "%",
        note: "395 / 428 份已提交",
        tone: "success",
      },
      {
        key: "cost",
        label: "成本保障待复核",
        value: 21,
        suffix: "项",
        note: "地租、补贴与保险关系",
        tone: "warning",
      },
      {
        key: "blocking",
        label: "面积产量阻断",
        value: 5,
        suffix: "项",
        note: "未关闭前不能形成采用值",
        tone: "danger",
      },
    ],
    stock: [
      {
        key: "farmers",
        label: "有效农户样本",
        value: 312,
        suffix: "户",
        note: "均关联同一农户与库存地点",
      },
      {
        key: "submitted",
        label: "余粮调查完成率",
        value: 91.3,
        suffix: "%",
        note: "285 / 312 户已提交",
        tone: "success",
      },
      {
        key: "reconciliation",
        label: "库存勾稽待解释",
        value: 12,
        suffix: "户",
        note: "销售、自用与损耗不平",
        tone: "warning",
      },
      {
        key: "overdue",
        label: "逾期未报",
        value: 8,
        suffix: "户",
        note: "记录截止责任人与补填人",
        tone: "danger",
      },
    ],
    sales: [
      {
        key: "events",
        label: "本期有效销售事件",
        value: 1486,
        suffix: "笔",
        note: "累计销量由事件自动汇总",
      },
      {
        key: "quantity",
        label: "销售数量",
        value: "18.6",
        suffix: "万吨",
        note: "按品种和区域汇总",
        tone: "success",
      },
      {
        key: "inventory",
        label: "销售库存待勾稽",
        value: 9,
        suffix: "户",
        note: "销售事件与库存移动核对",
        tone: "warning",
      },
      {
        key: "duplicate",
        label: "疑似重复销售",
        value: 3,
        suffix: "笔",
        note: "同一交易凭证待核验",
        tone: "danger",
      },
    ],
    intention: [
      {
        key: "respondents",
        label: "意愿调查对象",
        value: 312,
        suffix: "户",
        note: "引用同一农户和作物季档案",
      },
      {
        key: "completed",
        label: "意愿调查完成率",
        value: 87.8,
        suffix: "%",
        note: "274 / 312 户已提交",
        tone: "success",
      },
      {
        key: "explanation",
        label: "行为原因待解释",
        value: 18,
        suffix: "户",
        note: "价格、销量与面积变化需匹配",
        tone: "warning",
      },
      {
        key: "baseline",
        label: "基期数据缺失",
        value: 4,
        suffix: "户",
        note: "不能自动计算同比变化",
        tone: "danger",
      },
    ],
  };
  const noticesByContext: Record<string, ModuleWorkspaceView["notices"]> = {
    production: [
      {
        id: "production-notice-1",
        title: "面积与产量勾稽异常",
        detail: "讷河市 · 阻断事实版本生成",
        tone: "danger",
      },
      {
        id: "production-notice-2",
        title: "农户库存销售待勾稽",
        detail: "12 户需要补充说明",
        tone: "warning",
      },
      {
        id: "production-notice-3",
        title: "行政村调查尚未完成",
        detail: "覆盖率低于本期要求",
        tone: "warning",
      },
    ],
    planting: [
      {
        id: "planting-notice-1",
        title: "面积与产量勾稽异常",
        detail: "讷河市 · 阻断事实版本生成",
        tone: "danger",
      },
      {
        id: "planting-notice-2",
        title: "成本补贴保险关系待解释",
        detail: "农户样本 · 需要补充说明",
        tone: "warning",
      },
      {
        id: "planting-notice-3",
        title: "行政村调查尚未完成",
        detail: "覆盖率低于本期要求",
        tone: "warning",
      },
    ],
    stock: [
      {
        id: "stock-notice-1",
        title: "农户库存勾稽不平",
        detail: "销售、自用、损耗与盘点差异待解释",
        tone: "danger",
      },
      {
        id: "stock-notice-2",
        title: "期末结转候选待确认",
        detail: "通过审核后才能进入下期期初候选",
        tone: "warning",
      },
      {
        id: "stock-notice-3",
        title: "库存地点关系缺失",
        detail: "居住地与实际储粮地点需要分开",
        tone: "warning",
      },
    ],
    sales: [
      {
        id: "sales-notice-1",
        title: "销售事件疑似重复",
        detail: "同一交易凭证出现两次",
        tone: "danger",
      },
      {
        id: "sales-notice-2",
        title: "销售比例等待重算",
        detail: "库存采用值更新后自动重算",
        tone: "warning",
      },
      {
        id: "sales-notice-3",
        title: "成交价格缺少质量条件",
        detail: "需要补充水分或蛋白等适用指标",
        tone: "warning",
      },
    ],
    intention: [
      {
        id: "intention-notice-1",
        title: "上期演示面积引用失败",
        detail: "4 户缺少可用基期数据",
        tone: "danger",
      },
      {
        id: "intention-notice-2",
        title: "面积变化原因待解释",
        detail: "同比变化与价格销量原因不一致",
        tone: "warning",
      },
      {
        id: "intention-notice-3",
        title: "下一作物季品种待确认",
        detail: "农户尚未确认最终计划",
        tone: "warning",
      },
    ],
  };
  const lifecycleByContext = {
    planting: [
      {
        key: "assigned",
        label: "任务下达",
        detail: "428 份",
        state: "completed",
      },
      {
        key: "reported",
        label: "面积产量填报",
        detail: "395 份",
        state: "completed",
      },
      {
        key: "quality",
        label: "规则校验",
        detail: "5 项阻断",
        state: "current",
      },
      {
        key: "review",
        label: "分级审核",
        detail: "37 份待办",
        state: "pending",
      },
      { key: "publish", label: "事实版本", detail: "待生成", state: "pending" },
    ],
    stock: [
      {
        key: "assigned",
        label: "调查对象",
        detail: "312 户",
        state: "completed",
      },
      {
        key: "reported",
        label: "余粮填报",
        detail: "285 户",
        state: "completed",
      },
      {
        key: "reconcile",
        label: "库存勾稽",
        detail: "12 户待解释",
        state: "current",
      },
      {
        key: "review",
        label: "库存审核",
        detail: "8 户待补报",
        state: "pending",
      },
      {
        key: "carry",
        label: "期末结转候选",
        detail: "待确认",
        state: "pending",
      },
    ],
    sales: [
      {
        key: "record",
        label: "销售事件录入",
        detail: "1,486 笔",
        state: "completed",
      },
      {
        key: "verify",
        label: "交易凭证核验",
        detail: "3 笔待核",
        state: "current",
      },
      {
        key: "reconcile",
        label: "库存移动勾稽",
        detail: "9 户待解释",
        state: "pending",
      },
      { key: "review", label: "销售审核", detail: "待处理", state: "pending" },
      {
        key: "publish",
        label: "销售事实",
        detail: "分别生成",
        state: "pending",
      },
    ],
    intention: [
      {
        key: "assigned",
        label: "调查对象",
        detail: "312 户",
        state: "completed",
      },
      {
        key: "reported",
        label: "意愿填报",
        detail: "274 户",
        state: "completed",
      },
      {
        key: "baseline",
        label: "基期比对",
        detail: "4 户缺失",
        state: "current",
      },
      {
        key: "explain",
        label: "变化原因审核",
        detail: "18 户待解释",
        state: "pending",
      },
      { key: "publish", label: "意愿事实", detail: "待生成", state: "pending" },
    ],
  } as const;
  return {
    eyebrow: "产情运营 / 统一对象工作区",
    title,
    description,
    metrics: metricsByContext[context] ?? metricsByContext.production,
    lifecycleTitle: "本期业务生命周期",
    lifecycleNote: "同一任务、对象、单据、质量和发布版本全程关联",
    lifecycle:
      lifecycleByContext[context as keyof typeof lifecycleByContext] ??
      standardLifecycle,
    notices: noticesByContext[context] ?? noticesByContext.production,
    tableTitle: "样本与调查任务",
    tableDescription:
      "种植、成本保障、余粮、销售和意愿均回到同一对象档案与作物季，不重复建立样本、任务或事实。",
    sectionNavigation: sectionNavigation("样本与调查任务"),
    controlTitle: "产情业务控制信息",
    controlItems: [
      { label: "责任岗位", value: "齐齐哈尔产情审核岗" },
      { label: "任务批次", value: "2026 年第三季度调查批次" },
      { label: "数据截止", value: "2026-07-31 16:00" },
      { label: "质量规则", value: "产情质量规则第 4 版" },
      { label: "数据资格", value: "阻断校验通过并完成分级审核" },
    ],
    columnLabels: standardLabels,
    records: productionRecords(context),
  };
}

const marketSubjectCatalog = {
  grainTrader: {
    id: monitoringObjectIds.grainTraderOperatingSite,
    name: "龙江丰禾粮贸第一经营场所",
    scope: "龙江县",
  },
  cornProcessor: {
    id: "market-subject-corn-processor",
    name: "齐齐哈尔北方玉米加工厂",
    scope: "富拉尔基区",
  },
  soybeanProcessor: {
    id: "market-subject-soybean-processor",
    name: "讷河绿源大豆加工厂",
    scope: "讷河市",
  },
  riceMill: {
    id: "market-subject-rice-mill",
    name: "泰来县丰谷米业",
    scope: "泰来县",
  },
  reserveDepot: {
    id: "market-subject-reserve-depot",
    name: "齐齐哈尔区域储备库",
    scope: "昂昂溪区",
  },
  railwayNode: {
    id: "market-subject-railway-node",
    name: "讷河铁路物流节点",
    scope: "讷河市",
  },
  roadNode: {
    id: "market-subject-road-node",
    name: "龙江县公路物流节点",
    scope: "龙江县",
  },
  seedDealer: {
    id: "market-subject-seed-dealer",
    name: "依安县丰穗种子经销部",
    scope: "依安县",
  },
  pesticideDealer: {
    id: "market-subject-pesticide-dealer",
    name: "甘南县田安农药经销部",
    scope: "甘南县",
  },
  fertilizerDealer: {
    id: "market-subject-fertilizer-dealer",
    name: "克山县沃土化肥经销部",
    scope: "克山县",
  },
} as const;

type MarketSubjectKey = keyof typeof marketSubjectCatalog;

function marketRecord(
  subjectKey: MarketSubjectKey,
  taskKey: string,
  details: Omit<
    ModuleWorkspaceRecord,
    "id" | "businessObjectId" | "name" | "scope"
  >,
): ModuleWorkspaceRecord {
  const subject = marketSubjectCatalog[subjectKey];
  return {
    id: `${taskKey}-${subject.id}`,
    businessObjectId: subject.id,
    name: subject.name,
    scope: subject.scope,
    ...details,
  };
}

function marketRecords(context: string): readonly ModuleWorkspaceRecord[] {
  const common = {
    status: "已经提交",
    quality: "通过",
    timeLimit: "今天 16:00",
  };

  const recordsByContext: Record<string, readonly ModuleWorkspaceRecord[]> = {
    market: [
      marketRecord("grainTrader", "overview", {
        ...common,
        category: "贸易与仓储主体",
        period: "主体全景核验",
        owner: "王洋",
      }),
      marketRecord("cornProcessor", "overview", {
        ...common,
        category: "玉米深加工主体",
        period: "主体全景核验",
        owner: "李敏",
      }),
      marketRecord("railwayNode", "overview", {
        ...common,
        category: "铁路物流节点",
        period: "节点全景核验",
        owner: "赵晨",
      }),
    ],
    subjects: [
      marketRecord("grainTrader", "subject", {
        ...common,
        category: "企业、场所与仓储设施",
        period: "角色能力与关系核验",
        owner: "王洋",
      }),
      marketRecord("cornProcessor", "subject", {
        ...common,
        category: "企业、工厂与生产线",
        period: "角色能力与关系核验",
        owner: "李敏",
      }),
      marketRecord("riceMill", "subject", {
        ...common,
        category: "企业、米厂与仓储设施",
        period: "角色能力与关系核验",
        owner: "赵晨",
      }),
    ],
    trading: [
      marketRecord("grainTrader", "quote", {
        category: "报价任务",
        period: "玉米收购报价",
        status: "区域复核中",
        quality: "1 条品质条件待解释",
        owner: "王洋",
        timeLimit: "今天 12:00",
      }),
      marketRecord("grainTrader", "trade-delivery", {
        category: "成交与交付任务",
        period: "玉米收购成交与交付",
        status: "等待复核",
        quality: "交付数量待核对",
        owner: "王洋",
        timeLimit: "今天 14:00",
      }),
      marketRecord("cornProcessor", "quote", {
        ...common,
        category: "报价任务",
        period: "玉米采购报价",
        owner: "李敏",
      }),
      marketRecord("cornProcessor", "trade-delivery", {
        ...common,
        category: "成交与交付任务",
        period: "玉米采购成交与交付",
        owner: "李敏",
      }),
      marketRecord("riceMill", "quote", {
        ...common,
        category: "报价任务",
        period: "稻谷采购报价",
        owner: "赵晨",
      }),
      marketRecord("riceMill", "trade-delivery", {
        ...common,
        category: "成交与交付任务",
        period: "稻谷采购成交与交付",
        owner: "赵晨",
      }),
    ],
    inventory: [
      marketRecord("grainTrader", "inventory", {
        ...common,
        category: "商品粮库存",
        period: "玉米库存快照与盘点",
        owner: "王洋",
      }),
      marketRecord("cornProcessor", "inventory", {
        category: "原料与成品库存",
        period: "玉米原料和加工成品库存",
        status: "等待复核",
        quality: "物理持仓待勾稽",
        owner: "李敏",
        timeLimit: "今天 14:00",
      }),
      marketRecord("reserveDepot", "inventory", {
        ...common,
        category: "政策粮代储库存",
        period: "政策属性与保管责任核验",
        owner: "赵晨",
      }),
    ],
    processing: [
      marketRecord("cornProcessor", "processing", {
        category: "玉米加工",
        period: "原料投入、产出与开机率",
        status: "等待复核",
        quality: "投入产出待勾稽",
        owner: "李敏",
        timeLimit: "今天 14:00",
      }),
      marketRecord("soybeanProcessor", "processing", {
        ...common,
        category: "大豆压榨与蛋白加工",
        period: "原豆投入和产品产出",
        owner: "王洋",
      }),
      marketRecord("riceMill", "processing", {
        ...common,
        category: "稻谷加工",
        period: "稻谷投入与大米副产品产出",
        owner: "赵晨",
      }),
    ],
    logistics: [
      marketRecord("railwayNode", "logistics", {
        category: "铁路运输节点",
        period: "装车、到达与区域边界穿越",
        status: "等待修正",
        quality: "重复风险",
        owner: "赵晨",
        timeLimit: "今天 16:30",
      }),
      marketRecord("roadNode", "logistics", {
        ...common,
        category: "公路运输节点",
        period: "流入、流出与区域边界穿越",
        owner: "王洋",
      }),
    ],
    "agri-inputs": [
      marketRecord("seedDealer", "agri-inputs", {
        ...common,
        category: "种子经销",
        period: "品种、价格与销量",
        owner: "李敏",
      }),
      marketRecord("pesticideDealer", "agri-inputs", {
        ...common,
        category: "农药经销",
        period: "产品、价格与销量",
        owner: "王洋",
      }),
      marketRecord("fertilizerDealer", "agri-inputs", {
        ...common,
        category: "化肥经销",
        period: "产品、价格与销量",
        owner: "赵晨",
      }),
    ],
  };

  return recordsByContext[context] ?? recordsByContext.market;
}

function marketView(context: string): ModuleWorkspaceView {
  const marketContext = context;
  const titles: Record<string, [string, string]> = {
    market: [
      "市场监测运营总览",
      "以主体全景为入口，分别治理行情交易、库存仓储、加工转化、物流流向和农资市场事实。",
    ],
    subjects: [
      "市场主体全景工作区",
      "企业、经营场所、设施、业务能力和委托保管关系集中展示，主体只建一次。",
    ],
    trading: [
      "行情与交易工作区",
      "将报价、成交、数量和适用品质条件组合展示，但分别保留可独立审核的业务事实。",
    ],
    inventory: [
      "库存与仓储工作区",
      "以物理持仓为数量权威，分别标明所有权、保管责任、在途状态和政策属性。",
    ],
    processing: [
      "加工与转化工作区",
      "加工投入、主副产品产出、损耗和转换率按批次独立记录并执行物料守恒。",
    ],
    logistics: [
      "物流流向工作区",
      "铁路、公路运输共用唯一运输任务和分段，区域流入流出只由边界穿越事实汇总。",
    ],
    "agri-inputs": [
      "农资市场工作区",
      "按经销主体管理种子、农药和化肥的品种、规格、销售价格与销售数量。",
    ],
  };
  const [title, description] = titles[marketContext] ?? titles.market;
  const lifecycleByContext = {
    market: [
      {
        key: "subject",
        label: "主体档案",
        detail: "286 家",
        state: "completed",
      },
      {
        key: "quote",
        label: "报价事实",
        detail: "1,284 条",
        state: "completed",
      },
      { key: "trade", label: "成交与交付", detail: "326 笔", state: "current" },
      {
        key: "publish",
        label: "事实发布",
        detail: "等待审核",
        state: "pending",
      },
    ],
    subjects: [
      {
        key: "identity",
        label: "主体建档",
        detail: "一企一档",
        state: "completed",
      },
      {
        key: "relation",
        label: "关系核验",
        detail: "场所与设施",
        state: "completed",
      },
      {
        key: "capability",
        label: "角色能力",
        detail: "按有效期",
        state: "current",
      },
      {
        key: "responsibility",
        label: "责任配置",
        detail: "12 项待办",
        state: "pending",
      },
      {
        key: "active",
        label: "档案生效",
        detail: "审核后生效",
        state: "pending",
      },
    ],
    trading: [
      {
        key: "quote",
        label: "报价事实",
        detail: "1,284 条",
        state: "completed",
      },
      { key: "trade", label: "成交事实", detail: "326 笔", state: "completed" },
      {
        key: "quality",
        label: "品质关联",
        detail: "12 条待解释",
        state: "current",
      },
      {
        key: "delivery",
        label: "交付结算",
        detail: "43 项进行中",
        state: "pending",
      },
      {
        key: "publish",
        label: "事实发布",
        detail: "分别发布",
        state: "pending",
      },
    ],
    inventory: [
      {
        key: "position",
        label: "库存持仓",
        detail: "唯一数量",
        state: "completed",
      },
      {
        key: "ownership",
        label: "权属保管",
        detail: "四维分开",
        state: "completed",
      },
      { key: "count", label: "盘点差异", detail: "8 项待核", state: "current" },
      {
        key: "quality",
        label: "库存勾稽",
        detail: "3 项异常",
        state: "pending",
      },
      {
        key: "publish",
        label: "库存发布",
        detail: "等待审核",
        state: "pending",
      },
    ],
    processing: [
      {
        key: "line",
        label: "产线档案",
        detail: "32 条有效",
        state: "completed",
      },
      {
        key: "input",
        label: "加工投入",
        detail: "24 批次",
        state: "completed",
      },
      { key: "output", label: "产品产出", detail: "46 批次", state: "current" },
      {
        key: "balance",
        label: "物料守恒",
        detail: "3 项异常",
        state: "pending",
      },
      {
        key: "publish",
        label: "加工发布",
        detail: "等待审核",
        state: "pending",
      },
    ],
    logistics: [
      { key: "task", label: "运输任务", detail: "126 项", state: "completed" },
      {
        key: "segment",
        label: "运输分段",
        detail: "铁路与公路",
        state: "completed",
      },
      {
        key: "boundary",
        label: "边界穿越",
        detail: "86 项有效",
        state: "current",
      },
      {
        key: "deduplicate",
        label: "重复校验",
        detail: "3 项待核",
        state: "pending",
      },
      {
        key: "publish",
        label: "事实发布",
        detail: "去重后发布",
        state: "pending",
      },
    ],
    "agri-inputs": [
      { key: "dealer", label: "经销主体", detail: "86 家", state: "completed" },
      {
        key: "catalog",
        label: "农资目录",
        detail: "412 项",
        state: "completed",
      },
      {
        key: "sales",
        label: "销售采集",
        detail: "36 项待报",
        state: "current",
      },
      {
        key: "quality",
        label: "规则校验",
        detail: "4 项待办",
        state: "pending",
      },
      {
        key: "publish",
        label: "事实发布",
        detail: "分别发布",
        state: "pending",
      },
    ],
  } as const;
  const lifecycle =
    lifecycleByContext[marketContext as keyof typeof lifecycleByContext] ??
    lifecycleByContext.market;
  const lifecycleNotes: Record<string, string> = {
    trading:
      "报价任务与成交、交付任务分别处理；同一主体可同时参与两类任务，但不强制每条报价形成成交。",
    inventory:
      "库存持仓、权属保管和盘点差异是相互关联但各自独立事实，不与加工日报共用提交边界。",
    processing:
      "加工投入、产品产出和损耗是相互关联但各自独立事实，以批次守恒而不是库存抄值生成结果。",
    logistics:
      "运输任务、分段和边界穿越是相互关联但各自独立事实，按唯一事件去重。",
    "agri-inputs":
      "种子、农药和化肥销售是同一经销主体下的独立事实，按产品目录统一展示但不互相混算。",
  };
  const metricsByContext: Record<string, ModuleWorkspaceView["metrics"]> = {
    market: [
      {
        key: "subjects",
        label: "有效市场主体",
        value: 286,
        suffix: "家",
        note: "覆盖贸易、加工、仓储、物流和农资",
      },
      {
        key: "quotes",
        label: "今日有效报价",
        value: 1284,
        suffix: "条",
        note: "报价、成交、库存和加工分别统计",
        tone: "success",
      },
      {
        key: "trade-delivery-review",
        label: "成交与交付待审核",
        value: 43,
        suffix: "项",
        note: "只统计成交与交付事实",
        tone: "warning",
      },
      {
        key: "trading-quality",
        label: "交易品质待解释",
        value: 12,
        suffix: "项",
        note: "只统计交易事实的品质条件",
        tone: "danger",
      },
    ],
    subjects: [
      {
        key: "subjects",
        label: "有效市场主体",
        value: 286,
        suffix: "家",
        note: "企业主体只建一次",
      },
      {
        key: "sites",
        label: "经营场所与设施",
        value: 412,
        suffix: "个",
        note: "所有、经营、租赁与保管关系分开",
        tone: "success",
      },
      {
        key: "relations",
        label: "关系待核验",
        value: 12,
        suffix: "项",
        note: "场所、设施与主体关系",
        tone: "warning",
      },
      {
        key: "capabilities",
        label: "能力即将到期",
        value: 4,
        suffix: "项",
        note: "需要重新确认有效期",
        tone: "danger",
      },
    ],
    trading: [
      {
        key: "quotes",
        label: "今日有效报价",
        value: 1284,
        suffix: "条",
        note: "均关联产品和适用品质条件",
      },
      {
        key: "trades",
        label: "今日有效成交",
        value: 326,
        suffix: "笔",
        note: "不要求每条报价形成成交",
        tone: "success",
      },
      {
        key: "quality",
        label: "品质条件待解释",
        value: 12,
        suffix: "条",
        note: "价格、数量与检验结果待关联",
        tone: "warning",
      },
      {
        key: "settlement",
        label: "交付结算阻断",
        value: 3,
        suffix: "笔",
        note: "不影响其他独立报价事实",
        tone: "danger",
      },
    ],
    inventory: [
      {
        key: "positions",
        label: "有效库存持仓",
        value: 418,
        suffix: "笔",
        note: "物理数量唯一",
      },
      {
        key: "coverage",
        label: "库存报送覆盖率",
        value: 94.1,
        suffix: "%",
        note: "按经营场所和仓储设施统计",
        tone: "success",
      },
      {
        key: "counts",
        label: "盘点差异待核",
        value: 8,
        suffix: "项",
        note: "不直接覆盖账面库存",
        tone: "warning",
      },
      {
        key: "custody",
        label: "权属保管冲突",
        value: 2,
        suffix: "项",
        note: "政策属性与企业所有权冲突",
        tone: "danger",
      },
    ],
    processing: [
      {
        key: "lines",
        label: "有效加工产线",
        value: 32,
        suffix: "条",
        note: "按主体、工厂和产品登记",
      },
      {
        key: "batches",
        label: "今日加工批次",
        value: 24,
        suffix: "批",
        note: "投入与产出分别记录",
        tone: "success",
      },
      {
        key: "balance",
        label: "物料守恒待解释",
        value: 3,
        suffix: "批",
        note: "主副产品和损耗待核",
        tone: "warning",
      },
      {
        key: "missing",
        label: "产品形态缺失",
        value: 1,
        suffix: "批",
        note: "不能计算原粮当量",
        tone: "danger",
      },
    ],
    logistics: [
      {
        key: "tasks",
        label: "今日运输任务",
        value: 126,
        suffix: "项",
        note: "铁路、公路共用唯一任务",
      },
      {
        key: "crossings",
        label: "有效边界穿越",
        value: 86,
        suffix: "项",
        note: "用于区域流入流出汇总",
        tone: "success",
      },
      {
        key: "incomplete",
        label: "运输分段待补",
        value: 7,
        suffix: "项",
        note: "缺少起讫点或运输方式",
        tone: "warning",
      },
      {
        key: "duplicates",
        label: "疑似重复运输",
        value: 3,
        suffix: "项",
        note: "同一运输分段或同一次边界穿越被重复申报",
        tone: "danger",
      },
    ],
    "agri-inputs": [
      {
        key: "dealers",
        label: "有效农资经销主体",
        value: 86,
        suffix: "家",
        note: "种子、农药和化肥",
      },
      {
        key: "products",
        label: "有效农资产品",
        value: 412,
        suffix: "项",
        note: "按品种、规格和单位管理",
        tone: "success",
      },
      {
        key: "reporting",
        label: "销售数据待报",
        value: 36,
        suffix: "项",
        note: "价格与数量分别校验",
        tone: "warning",
      },
      {
        key: "price",
        label: "价格异常",
        value: 4,
        suffix: "项",
        note: "超出同区域合理范围",
        tone: "danger",
      },
    ],
  };
  const noticesByContext: Record<string, ModuleWorkspaceView["notices"]> = {
    market: [
      {
        id: "market-notice-1",
        title: "交易品质条件待解释",
        detail: "12 条交易事实需要补充检验条件",
        tone: "danger",
      },
      {
        id: "market-notice-2",
        title: "主体关系待核验",
        detail: "12 项场所设施关系需要确认",
        tone: "warning",
      },
      {
        id: "market-notice-3",
        title: "成交与交付审核临近截止",
        detail: "43 项成交与交付事实等待审核",
        tone: "warning",
      },
    ],
    subjects: [
      {
        id: "subjects-notice-1",
        title: "政策库存保管关系冲突",
        detail: "企业所有权与委托保管需要分开",
        tone: "danger",
      },
      {
        id: "subjects-notice-2",
        title: "经营场所租赁关系待续期",
        detail: "4 项关系即将到期",
        tone: "warning",
      },
      {
        id: "subjects-notice-3",
        title: "加工能力适用产品待确认",
        detail: "2 条产线缺少产品范围",
        tone: "warning",
      },
    ],
    trading: [
      {
        id: "trading-notice-1",
        title: "成交价格缺少品质条件",
        detail: "12 笔交易需要补充水分或蛋白指标",
        tone: "danger",
      },
      {
        id: "trading-notice-2",
        title: "交付数量与成交数量不符",
        detail: "3 笔交易等待责任人解释",
        tone: "warning",
      },
      {
        id: "trading-notice-3",
        title: "报价有效期即将结束",
        detail: "28 条报价将在一小时内失效",
        tone: "warning",
      },
    ],
    inventory: [
      {
        id: "inventory-notice-1",
        title: "库存权属与保管关系冲突",
        detail: "2 项政策粮代储库存待核验",
        tone: "danger",
      },
      {
        id: "inventory-notice-2",
        title: "盘点差异等待审批",
        detail: "未经批准不得覆盖账面库存",
        tone: "warning",
      },
      {
        id: "inventory-notice-3",
        title: "在途库存缺少运输任务",
        detail: "4 项持仓无法追溯运输来源",
        tone: "warning",
      },
    ],
    processing: [
      {
        id: "processing-notice-1",
        title: "加工投入产出不守恒",
        detail: "3 个批次超出损耗规则",
        tone: "danger",
      },
      {
        id: "processing-notice-2",
        title: "副产品产出尚未登记",
        detail: "豆粕、米糠或稻壳数量缺失",
        tone: "warning",
      },
      {
        id: "processing-notice-3",
        title: "转换率版本待确认",
        detail: "1 条产线使用旧规则",
        tone: "warning",
      },
    ],
    logistics: [
      {
        id: "logistics-notice-1",
        title: "同一分段或边界穿越重复申报",
        detail:
          "不将合法多式联运判为重复；仅核对同一分段或同一次边界穿越的重复申报",
        tone: "danger",
      },
      {
        id: "logistics-notice-2",
        title: "边界穿越时间缺失",
        detail: "5 项不能进入流入流出汇总",
        tone: "warning",
      },
      {
        id: "logistics-notice-3",
        title: "物流方向待确认",
        detail: "2 个任务缺少地区或运输方向",
        tone: "warning",
      },
    ],
    "agri-inputs": [
      {
        id: "agri-inputs-notice-1",
        title: "农资价格超出合理区间",
        detail: "4 项需要经销主体说明",
        tone: "danger",
      },
      {
        id: "agri-inputs-notice-2",
        title: "产品规格与销量单位不一致",
        detail: "6 项需要换算或修正",
        tone: "warning",
      },
      {
        id: "agri-inputs-notice-3",
        title: "本期销售数据尚未填报",
        detail: "36 项接近截止时间",
        tone: "warning",
      },
    ],
  };
  return {
    eyebrow: "市场运营 / 主体全景工作区",
    title,
    description,
    metrics: metricsByContext[marketContext] ?? metricsByContext.market,
    lifecycleTitle: "本期业务治理状态",
    lifecycleNote:
      lifecycleNotes[marketContext] ??
      "主体档案负责组合展示，报价、交易、库存、加工、物流和政策执行保持独立事实边界。",
    lifecycle,
    notices: noticesByContext[marketContext] ?? noticesByContext.market,
    tableTitle: "主体与业务工作清单",
    tableDescription:
      "同一企业、经营场所和设施只建一次；各类事实按自身频率、责任和审核边界独立治理。",
    sectionNavigation: sectionNavigation("主体与业务工作清单"),
    controlTitle: "市场业务控制信息",
    controlItems: [
      { label: "责任岗位", value: "齐齐哈尔市场复核岗" },
      { label: "业务批次", value: "2026-07-31 市场日报批次" },
      { label: "数据截止", value: "2026-07-31 16:30" },
      { label: "质量规则", value: "市场事实质量规则第 3 版" },
      { label: "数据资格", value: "按事实边界分别审核与发布" },
    ],
    columnLabels: standardLabels,
    records: marketRecords(marketContext),
  };
}

function supplyView(context: string): ModuleWorkspaceView {
  const titles: Record<string, [string, string]> = {
    supply: [
      "供需与态势总览",
      "只读取已审核发布指标，展示产品账户、勾稽结果、态势和完整来源。",
    ],
    accounts: [
      "产品账户工作区",
      "玉米、大豆、稻谷与大米分别建账，产品转换使用受控原粮当量版本。",
    ],
    balance: [
      "供需账户勾稽",
      "只读取预置演示指标版本，分别保留调整前账面、批准调整、采用后账面、调查汇总和库存平衡差额。",
    ],
    realtime: [
      "实时监控（演示）",
      "展示初步演示信号的新鲜度、质量和覆盖范围；观察信号不能直接写入供需结果。",
    ],
    map: [
      "区域地图（演示）",
      "按授权范围展示演示指标、样本覆盖率和风险，不扩大样本代表范围。",
    ],
    lineage: [
      "版本与数据血缘",
      "追溯事实、指标、公式、账户角色、发布版本和替代关系。",
    ],
  };
  const [title, description] = titles[context] ?? titles.supply;
  const balanceMetrics: ModuleWorkspaceView["metrics"] = [
    {
      key: "supply",
      label: "总供给",
      value: 763.1,
      suffix: "万吨",
      note: "期初库存＋产量＋流入",
    },
    {
      key: "demand",
      label: "期间总使用与外流",
      value: 659.2,
      suffix: "万吨",
      note: "消费＋加工＋流出",
    },
    {
      key: "closing",
      label: "采用后账面期末库存",
      value: 103.9,
      suffix: "万吨",
      note: "调整前账面加已批准调整",
      tone: "success",
    },
    {
      key: "difference",
      label: "库存平衡差额",
      value: 0,
      suffix: "万吨",
      note: "调查汇总减采用后账面",
      tone: "success",
    },
  ];
  const metricsByContext: Record<string, ModuleWorkspaceView["metrics"]> = {
    supply: balanceMetrics,
    balance: balanceMetrics,
    accounts: [
      {
        key: "accounts",
        label: "已定义产品账户",
        value: 4,
        suffix: "个",
        note: "玉米、原豆、稻谷和大米互斥建账",
      },
      {
        key: "roles",
        label: "启用账户角色",
        value: 31,
        suffix: "项",
        note: "供给、使用、库存与备查分项",
        tone: "success",
      },
      {
        key: "conversion",
        label: "产品转换规则",
        value: 1,
        suffix: "套",
        note: "稻谷投入与大米产出共同引用",
        tone: "warning",
      },
      {
        key: "pending",
        label: "定义待复核",
        value: 2,
        suffix: "项",
        note: "原豆用途与稻米转换边界",
        tone: "danger",
      },
    ],
    realtime: [
      {
        key: "signals",
        label: "当前演示信号",
        value: 126,
        suffix: "项",
        note: "产情、行情、库存与物流分别计数",
      },
      {
        key: "fresh",
        label: "时效符合率",
        value: 96.8,
        suffix: "%",
        note: "按各信号时效规则判断",
        tone: "success",
      },
      {
        key: "warning",
        label: "质量预警",
        value: 7,
        suffix: "项",
        note: "只影响观察层，不覆盖结果层",
        tone: "warning",
      },
      {
        key: "disconnected",
        label: "数据源中断",
        value: 2,
        suffix: "项",
        note: "保持上一观察值并标记过期",
        tone: "danger",
      },
    ],
    map: [
      {
        key: "regions",
        label: "授权监测区域",
        value: 3,
        suffix: "个",
        note: "齐齐哈尔、黑河、呼伦贝尔指定范围",
      },
      {
        key: "coverage",
        label: "样本覆盖率",
        value: 91.6,
        suffix: "%",
        note: "分区域显示分子、分母与抽样口径",
        tone: "success",
      },
      {
        key: "unknown",
        label: "区划对应关系待确认",
        value: 4,
        suffix: "项",
        note: "不归入上级区域汇总",
        tone: "warning",
      },
      {
        key: "risk",
        label: "区域风险提示",
        value: 3,
        suffix: "项",
        note: "不确定性与数据质量分别展示",
        tone: "danger",
      },
    ],
    lineage: [
      {
        key: "chains",
        label: "结果血缘链",
        value: 18,
        suffix: "条",
        note: "事实、指标、账户、公式与结果逐层关联",
      },
      {
        key: "complete",
        label: "演示链路完整率",
        value: 100,
        suffix: "%",
        note: "仅代表当前演示目录",
        tone: "success",
      },
      {
        key: "recalculate",
        label: "下游待重算",
        value: 2,
        suffix: "项",
        note: "上游修订不改写历史版本",
        tone: "warning",
      },
      {
        key: "orphan",
        label: "孤立版本",
        value: 0,
        suffix: "项",
        note: "未发现无来源结果",
        tone: "success",
      },
    ],
  };
  const lifecycleByContext: Record<string, ModuleWorkspaceView["lifecycle"]> = {
    supply: [
      {
        key: "fact",
        label: "事实发布",
        detail: "固定事实版本",
        state: "completed",
      },
      {
        key: "metric",
        label: "指标发布",
        detail: "固定指标版本",
        state: "completed",
      },
      {
        key: "account",
        label: "账户校验",
        detail: "角色互斥",
        state: "current",
      },
      {
        key: "calculate",
        label: "供需计算",
        detail: "结果校验一致",
        state: "pending",
      },
      {
        key: "release",
        label: "结果发布",
        detail: "生成不可变版本",
        state: "pending",
      },
    ],
    balance: [
      {
        key: "fact",
        label: "事实发布",
        detail: "固定事实版本",
        state: "completed",
      },
      {
        key: "metric",
        label: "指标发布",
        detail: "固定指标版本",
        state: "completed",
      },
      {
        key: "account",
        label: "账户校验",
        detail: "角色互斥",
        state: "current",
      },
      {
        key: "calculate",
        label: "供需计算",
        detail: "结果校验一致",
        state: "pending",
      },
      {
        key: "release",
        label: "结果发布",
        detail: "生成不可变版本",
        state: "pending",
      },
    ],
    accounts: [
      {
        key: "boundary",
        label: "账户边界",
        detail: "产品与区域",
        state: "completed",
      },
      {
        key: "roles",
        label: "角色启用",
        detail: "互斥角色清单",
        state: "completed",
      },
      {
        key: "conversion",
        label: "转换关系",
        detail: "原粮与产品",
        state: "current",
      },
      {
        key: "approval",
        label: "口径复核",
        detail: "2 项待办",
        state: "pending",
      },
      {
        key: "effective",
        label: "定义生效",
        detail: "追加式版本",
        state: "pending",
      },
    ],
    realtime: [
      {
        key: "ingest",
        label: "信号采集",
        detail: "分来源接收",
        state: "completed",
      },
      {
        key: "freshness",
        label: "时效检查",
        detail: "96.8% 符合",
        state: "completed",
      },
      {
        key: "quality",
        label: "质量标记",
        detail: "7 项预警",
        state: "current",
      },
      {
        key: "scope",
        label: "范围投影",
        detail: "按权限展示",
        state: "pending",
      },
      {
        key: "observe",
        label: "态势观察",
        detail: "不写入结果",
        state: "pending",
      },
    ],
    map: [
      {
        key: "region",
        label: "区划版本",
        detail: "固定边界",
        state: "completed",
      },
      {
        key: "scope",
        label: "权限范围",
        detail: "责任区域",
        state: "completed",
      },
      {
        key: "indicator",
        label: "指标投影",
        detail: "演示指标",
        state: "current",
      },
      {
        key: "coverage",
        label: "覆盖率说明",
        detail: "口径可追溯",
        state: "pending",
      },
      {
        key: "render",
        label: "地图呈现",
        detail: "不扩大代表范围",
        state: "pending",
      },
    ],
    lineage: [
      {
        key: "fact",
        label: "事实版本",
        detail: "来源固定",
        state: "completed",
      },
      {
        key: "metric",
        label: "指标版本",
        detail: "口径固定",
        state: "completed",
      },
      {
        key: "mapping",
        label: "账户角色",
        detail: "唯一对应",
        state: "current",
      },
      {
        key: "formula",
        label: "公式运行",
        detail: "数据来源已确认",
        state: "pending",
      },
      {
        key: "result",
        label: "结果版本",
        detail: "替代关系保留",
        state: "pending",
      },
    ],
  };
  const noticesByContext: Record<string, ModuleWorkspaceView["notices"]> = {
    supply: [
      {
        id: "supply-1",
        title: "大豆用途角色待复核",
        detail: "压榨与非压榨蛋白加工禁止重复",
        tone: "danger",
      },
      {
        id: "supply-2",
        title: "稻谷与大米双账户",
        detail: "加工运行与转换规则必须一致",
        tone: "warning",
      },
      {
        id: "supply-3",
        title: "缺失用途保持未知",
        detail: "缺失值不会自动补零",
        tone: "default",
      },
    ],
    balance: [
      {
        id: "balance-1",
        title: "大豆用途角色待复核",
        detail: "压榨与非压榨蛋白加工禁止重复",
        tone: "danger",
      },
      {
        id: "balance-2",
        title: "稻谷与大米双账户",
        detail: "加工运行与转换规则必须一致",
        tone: "warning",
      },
      {
        id: "balance-3",
        title: "缺失用途保持未知",
        detail: "缺失值不会自动补零",
        tone: "default",
      },
    ],
    accounts: [
      {
        id: "accounts-1",
        title: "原豆用途边界待确认",
        detail: "压榨与直接蛋白加工分别启用",
        tone: "danger",
      },
      {
        id: "accounts-2",
        title: "稻米转换规则待复核",
        detail: "投入、产出、副产品和损耗共同校验",
        tone: "warning",
      },
      {
        id: "accounts-3",
        title: "未启用角色不生成空字段",
        detail: "角色启用清单决定账户结构",
        tone: "default",
      },
    ],
    realtime: [
      {
        id: "realtime-1",
        title: "两个演示数据源已过期",
        detail: "保留最后观察值并标注采集时间",
        tone: "danger",
      },
      {
        id: "realtime-2",
        title: "价格信号波动超阈值",
        detail: "只触发观察预警，不修改供需结果",
        tone: "warning",
      },
      {
        id: "realtime-3",
        title: "实时层与结果层隔离",
        detail: "只有发布指标可进入供需计算",
        tone: "default",
      },
    ],
    map: [
      {
        id: "map-1",
        title: "四项区划对应关系待确认",
        detail: "未确认前不归入上级汇总",
        tone: "danger",
      },
      {
        id: "map-2",
        title: "呼伦贝尔仅展示指定范围",
        detail: "扎兰屯、阿荣旗、莫旗和鄂伦春旗",
        tone: "warning",
      },
      {
        id: "map-3",
        title: "样本覆盖率不等于区域代表率",
        detail: "需结合抽样设计与不确定性解释",
        tone: "default",
      },
    ],
    lineage: [
      {
        id: "lineage-1",
        title: "两项下游结果待重算",
        detail: "上游修订已生成影响记录",
        tone: "warning",
      },
      {
        id: "lineage-2",
        title: "历史版本保持不变",
        detail: "修订生成替代版本和替代原因",
        tone: "default",
      },
      {
        id: "lineage-3",
        title: "演示链路未发现孤立结果",
        detail: "仅代表当前前端演示目录",
        tone: "default",
      },
    ],
  };
  const recordsByContext: Record<string, readonly ModuleWorkspaceRecord[]> = {
    supply: [
      {
        id: "supply-corn",
        businessObjectId: "supply-account-corn",
        name: "玉米产品账户",
        category: "原粮账户",
        scope: "齐齐哈尔市",
        period: "2026 年第 3 版",
        status: "勾稽通过",
        quality: "演示指标完整",
        owner: "区域发布岗",
        timeLimit: "10:46",
      },
      {
        id: "supply-soy",
        businessObjectId: "supply-account-soy",
        name: "大豆原豆账户",
        category: "原豆账户",
        scope: "齐齐哈尔市",
        period: "2026 年第 2 版",
        status: "等待复核",
        quality: "用途角色待确认",
        owner: "供需审核岗",
        timeLimit: "今天 16:00",
      },
      {
        id: "supply-rice",
        businessObjectId: "supply-account-rice",
        name: "稻谷与大米双账户",
        category: "原粮与成品账户",
        scope: "齐齐哈尔市",
        period: "2026 年第 1 版",
        status: "规则校验中",
        quality: "转换规则待确认",
        owner: "指标治理岗",
        timeLimit: "明天 10:00",
      },
    ],
    accounts: [
      {
        id: "account-corn-definition",
        businessObjectId: "supply-account-corn",
        name: "玉米产品账户定义",
        category: "原粮账户定义",
        scope: "齐齐哈尔市",
        period: "账户规范第 3 版",
        status: "演示已生效",
        quality: "角色互斥",
        owner: "供需口径岗",
        timeLimit: "长期有效",
      },
      {
        id: "account-soy-definition",
        businessObjectId: "supply-account-soy",
        name: "大豆原豆账户定义",
        category: "原豆账户定义",
        scope: "齐齐哈尔市",
        period: "账户规范第 2 版",
        status: "等待复核",
        quality: "用途边界待确认",
        owner: "供需口径岗",
        timeLimit: "今天 16:00",
      },
      {
        id: "account-paddy-definition",
        businessObjectId: "supply-account-paddy",
        name: "稻谷账户定义",
        category: "原粮账户定义",
        scope: "齐齐哈尔市",
        period: "账户规范第 1 版",
        status: "等待复核",
        quality: "转换关系待确认",
        owner: "供需口径岗",
        timeLimit: "明天 10:00",
      },
      {
        id: "account-rice-definition",
        businessObjectId: "supply-account-rice",
        name: "大米账户定义",
        category: "成品账户定义",
        scope: "齐齐哈尔市",
        period: "账户规范第 1 版",
        status: "等待复核",
        quality: "转换关系待确认",
        owner: "供需口径岗",
        timeLimit: "明天 10:00",
      },
    ],
    balance: [],
    realtime: [
      {
        id: "signal-production",
        businessObjectId: "signal-production-corn",
        name: "玉米收获进度演示信号",
        category: "产情观察信号",
        scope: "齐齐哈尔市",
        period: "采集于 10:42",
        status: "演示更新",
        quality: "通过",
        owner: "产情观察岗",
        timeLimit: "15 分钟时效",
      },
      {
        id: "signal-market",
        businessObjectId: "signal-market-corn",
        name: "玉米现货价格演示信号",
        category: "行情观察信号",
        scope: "齐齐哈尔市",
        period: "采集于 10:40",
        status: "演示更新",
        quality: "波动预警",
        owner: "市场观察岗",
        timeLimit: "10 分钟时效",
      },
      {
        id: "signal-logistics",
        businessObjectId: "signal-logistics-corn",
        name: "玉米区域流出演示信号",
        category: "物流观察信号",
        scope: "齐齐哈尔市",
        period: "采集于 09:55",
        status: "演示已过期",
        quality: "数据源中断",
        owner: "物流观察岗",
        timeLimit: "30 分钟时效",
      },
    ],
    map: [
      {
        id: "map-qqhr",
        businessObjectId: "monitoring-region-qqhr",
        name: "齐齐哈尔监测区域",
        category: "区域指标投影",
        scope: "梅里斯区、8 县、1 县级市",
        period: "2026/27 年度",
        status: "演示展示",
        quality: "覆盖率 94.2%",
        owner: "区域数据岗",
        timeLimit: "指标第 7 版",
      },
      {
        id: "map-heihe",
        businessObjectId: "monitoring-region-heihe",
        name: "黑河监测区域",
        category: "区域指标投影",
        scope: "黑河全域",
        period: "2026/27 年度",
        status: "演示展示",
        quality: "覆盖率 89.8%",
        owner: "区域数据岗",
        timeLimit: "指标第 5 版",
      },
      {
        id: "map-hulunbuir",
        businessObjectId: "monitoring-region-hulunbuir",
        name: "呼伦贝尔监测区域",
        category: "区域指标投影",
        scope: "扎兰屯、阿荣旗、莫旗、鄂伦春旗",
        period: "2026/27 年度",
        status: "演示展示",
        quality: "覆盖率 88.6%",
        owner: "区域数据岗",
        timeLimit: "指标第 4 版",
      },
    ],
    lineage: [
      {
        id: "lineage-corn-supply",
        businessObjectId: "supply-account-corn",
        name: "玉米总供给血缘",
        category: "供需血缘链",
        scope: "齐齐哈尔市",
        period: "事实 → 指标 → 账户角色 → 公式 → 结果",
        status: "演示完整",
        quality: "通过",
        owner: "数据血缘岗",
        timeLimit: "结果第 3 版",
      },
      {
        id: "lineage-soy-use",
        businessObjectId: "supply-account-soy",
        name: "大豆加工使用血缘",
        category: "供需血缘链",
        scope: "齐齐哈尔市",
        period: "压榨与非压榨蛋白加工分别关联",
        status: "等待复核",
        quality: "角色边界待确认",
        owner: "数据血缘岗",
        timeLimit: "今天 16:00",
      },
      {
        id: "lineage-paddy-rice",
        businessObjectId: "supply-account-rice",
        name: "稻谷转大米血缘",
        category: "产品转换血缘链",
        scope: "齐齐哈尔市",
        period: "同一加工运行与转换规则",
        status: "等待复核",
        quality: "转换关系待确认",
        owner: "数据血缘岗",
        timeLimit: "明天 10:00",
      },
    ],
  };
  const controlItemsByContext: Record<
    string,
    ModuleWorkspaceView["controlItems"]
  > = {
    supply: [
      { label: "责任岗位", value: "区域供需发布岗" },
      { label: "结果批次", value: "2026 年玉米供需第 3 批" },
      { label: "指标输入", value: "演示指标版本集合" },
      { label: "账户规范", value: "产品账户规范第 3 版" },
      { label: "结果资格", value: "演示结果，不代表生产发布" },
    ],
    accounts: [
      { label: "口径责任", value: "供需账户口径岗" },
      { label: "账户边界", value: "产品＋区域＋营销年度" },
      { label: "角色规则", value: "启用、互斥、缺失不补零" },
      { label: "转换规则", value: "稻谷转大米第 1 版" },
      { label: "生效方式", value: "追加版本，不覆盖历史" },
    ],
    balance: [
      { label: "发布责任", value: "区域供需发布岗" },
      { label: "计算批次", value: "2026 年玉米供需第 3 批" },
      { label: "指标输入", value: "固定指标发布版本集合" },
      { label: "账户规范", value: "产品账户规范第 3 版" },
      { label: "结果资格", value: "演示结果，不代表生产发布" },
    ],
    realtime: [
      { label: "观察责任", value: "区域态势观察岗" },
      { label: "数据层级", value: "演示初步观察层" },
      { label: "时效规则", value: "按来源分别判断" },
      { label: "权限范围", value: "当前责任区域" },
      { label: "结果隔离", value: "不得直接写入供需结果" },
    ],
    map: [
      { label: "地图责任", value: "区域数据管理岗" },
      { label: "区划版本", value: "演示行政区划第 6 版" },
      { label: "指标版本", value: "演示指标版本集合" },
      { label: "抽样说明", value: "覆盖率与代表范围分开" },
      { label: "权限范围", value: "三地市指定监测范围" },
    ],
    lineage: [
      { label: "治理责任", value: "数据血缘管理岗" },
      { label: "事实版本", value: "演示事实版本集合" },
      { label: "指标版本", value: "演示指标版本集合" },
      { label: "结果版本", value: "演示供需结果集合" },
      { label: "修订规则", value: "新版本替代，历史不覆盖" },
    ],
  };
  return {
    eyebrow: "决策与报告 / 只读结果演示",
    title,
    description,
    metrics: metricsByContext[context] ?? balanceMetrics,
    lifecycleTitle: "结果生成流程（演示）",
    lifecycleNote:
      context === "realtime"
        ? "观察信号与供需结果分层治理"
        : context === "map"
          ? "区划、权限、指标与抽样说明共同决定地图投影"
          : context === "lineage"
            ? "事实、指标、账户角色、公式和结果逐层追溯"
            : "事实发布版本 → 指标发布版本 → 唯一账户角色对应 → 按既定规则计算 → 结果发布版本",
    lifecycle: lifecycleByContext[context] ?? lifecycleByContext.supply,
    notices: noticesByContext[context] ?? noticesByContext.supply,
    tableTitle: "供需账户与发布版本",
    tableDescription:
      context === "realtime"
        ? "观察信号按来源独立展示，不替代已审核发布的业务事实。"
        : context === "map"
          ? "区域投影同时展示范围、版本和覆盖率，不扩大样本代表范围。"
          : context === "lineage"
            ? "每条结果沿事实、指标、账户角色和公式逐层追溯。"
            : "所有结果只读、可勾稽、可追溯，业务页面不能直接修改。",
    sectionNavigation: sectionNavigation("供需账户明细"),
    controlTitle: "供需计算控制信息",
    controlItems:
      controlItemsByContext[context] ?? controlItemsByContext.supply,
    columnLabels: {
      ...standardLabels,
      name: "产品账户",
      category: "账户口径",
      period: "演示版本",
      status: "勾稽状态",
      quality: "数据资格",
      owner: "发布责任",
      timeLimit: "发布时间",
    },
    records: recordsByContext[context] ?? recordsByContext.supply,
  };
}

function managementView(module: string, context: string): ModuleWorkspaceView {
  const moduleMeta: Record<string, [string, string, string]> = {
    overview: [
      "经营总览",
      "统一查看演示经营指标、履责态势、质量风险和发布状态。",
      "经营管理 / 演示指标总览",
    ],
    reports: [
      "报表中心",
      "统一编排履责报告与业务分析报告，固定数据截止时间、演示版本和审批发布记录。",
      "报告管理 / 不可变报告版本",
    ],
    governance: [
      "数据治理",
      "管理主数据、指标、单位、质量规则、公式和血缘版本，不代替业务人员填报。",
      "治理平台 / 规范与质量",
    ],
    system: [
      "系统管理",
      "管理组织、人员、责任岗位、有效任职、角色权限、安全与运行配置。",
      "控制与治理 / 组织和安全",
    ],
  };
  const [baseTitle, description, eyebrow] =
    moduleMeta[module] ?? moduleMeta.overview;
  const contextLabels: Record<string, string> = {
    "overview:overview": "运营总览",
    "overview:responsibility": "履责态势",
    "overview:risk": "风险与预警",
    "reports:reports": "报表总览",
    "reports:duty": "履责报告",
    "reports:business": "业务分析报告",
    "reports:versions": "报告版本",
    "governance:governance": "治理总览",
    "governance:master-data": "主数据",
    "governance:quality": "质量规则",
    "governance:metrics": "指标与公式",
    "governance:lineage": "数据血缘",
    "system:system": "管理总览",
    "system:organization": "组织与人员",
    "system:responsibility": "岗位与责任",
    "system:permissions": "角色与权限",
    "system:security": "安全与运行",
  };
  const contextLabel = contextLabels[`${module}:${context}`] ?? "业务总览";
  const metricsByModule: Record<string, ModuleWorkspaceView["metrics"]> = {
    overview: [
      {
        key: "published",
        label: "演示指标版本",
        value: 18,
        suffix: "个",
        note: "当前经营视图引用",
      },
      {
        key: "obligation",
        label: "本期应报任务",
        value: 428,
        suffix: "项",
        note: "按责任坐标生成",
      },
      {
        key: "duty",
        label: "按时履责率",
        value: 92.4,
        suffix: "%",
        note: "按固定截止快照统计",
        tone: "success",
      },
      {
        key: "risk",
        label: "阻断风险",
        value: 5,
        suffix: "项",
        note: "未关闭前不得发布",
        tone: "danger",
      },
    ],
    reports: [
      {
        key: "scheduled",
        label: "本期待生成",
        value: 12,
        suffix: "份",
        note: "日报、周报和月报",
      },
      {
        key: "review",
        label: "等待复核",
        value: 4,
        suffix: "份",
        note: "数字与版本已经锁定",
        tone: "warning",
      },
      {
        key: "published",
        label: "演示已生成",
        value: 26,
        suffix: "份",
        note: "不可变文件可追溯",
        tone: "success",
      },
      {
        key: "replacement",
        label: "待替代版本",
        value: 1,
        suffix: "份",
        note: "保留原报告与原因",
        tone: "danger",
      },
    ],
    governance: [
      {
        key: "master",
        label: "生效主数据版本",
        value: 42,
        suffix: "个",
        note: "行政区划、产品和单位",
      },
      {
        key: "rules",
        label: "启用质量规则",
        value: 186,
        suffix: "条",
        note: "均有版本和适用范围",
      },
      {
        key: "blocking",
        label: "质量阻断",
        value: 5,
        suffix: "项",
        note: "影响事实发布",
        tone: "danger",
      },
      {
        key: "lineage",
        label: "演示结果血缘完整率",
        value: 100,
        suffix: "%",
        note: "演示版本链路",
        tone: "success",
      },
    ],
    system: [
      {
        key: "accounts",
        label: "有效账号",
        value: 76,
        suffix: "个",
        note: "均关联人员和组织",
      },
      {
        key: "appointments",
        label: "有效任职",
        value: 91,
        suffix: "项",
        note: "按有效期管理",
      },
      {
        key: "conflicts",
        label: "责任坐标冲突",
        value: 0,
        suffix: "项",
        note: "同一事项唯一负责人",
        tone: "success",
      },
      {
        key: "security",
        label: "高风险会话",
        value: 0,
        suffix: "项",
        note: "权限撤销即时生效",
        tone: "success",
      },
    ],
  };
  const lifecycleByModule: Record<string, ModuleWorkspaceView["lifecycle"]> = {
    overview: [
      {
        key: "facts",
        label: "事实版本",
        detail: "演示版本已固定",
        state: "completed",
      },
      {
        key: "metrics",
        label: "指标发布",
        detail: "18 个版本",
        state: "completed",
      },
      {
        key: "projection",
        label: "经营投影",
        detail: "按权限计算",
        state: "current",
      },
      { key: "risk", label: "风险确认", detail: "5 项待办", state: "pending" },
      {
        key: "report",
        label: "报告引用",
        detail: "等待锁定",
        state: "pending",
      },
    ],
    reports: [
      {
        key: "definition",
        label: "报告定义",
        detail: "范围和模板",
        state: "completed",
      },
      {
        key: "snapshot",
        label: "锁定版本",
        detail: "固定截止时点",
        state: "completed",
      },
      { key: "generate", label: "报告生成", detail: "12 份", state: "current" },
      {
        key: "approval",
        label: "复核审批",
        detail: "4 份待办",
        state: "pending",
      },
      {
        key: "publish",
        label: "报告发布",
        detail: "不可变文件",
        state: "pending",
      },
    ],
    governance: [
      {
        key: "definition",
        label: "规范定义",
        detail: "主数据与规则",
        state: "completed",
      },
      {
        key: "validation",
        label: "版本校验",
        detail: "结构与口径",
        state: "completed",
      },
      {
        key: "impact",
        label: "影响分析",
        detail: "下游重算",
        state: "current",
      },
      {
        key: "approval",
        label: "治理审批",
        detail: "3 项待办",
        state: "pending",
      },
      {
        key: "effective",
        label: "版本生效",
        detail: "追加式发布",
        state: "pending",
      },
    ],
    system: [
      {
        key: "request",
        label: "配置申请",
        detail: "组织与责任",
        state: "completed",
      },
      {
        key: "separation",
        label: "职责校验",
        detail: "默认拒绝",
        state: "completed",
      },
      {
        key: "approval",
        label: "授权审批",
        detail: "2 项待办",
        state: "current",
      },
      {
        key: "effective",
        label: "授权生效",
        detail: "按有效期",
        state: "pending",
      },
      { key: "audit", label: "安全审计", detail: "全程留痕", state: "pending" },
    ],
  };
  const recordsByModule: Record<string, ModuleWorkspaceView["records"]> = {
    overview: [
      {
        id: "overview-indicator",
        businessObjectId: "management-view-corn-supply",
        name: "玉米供需指标演示视图",
        category: "经营指标",
        scope: "齐齐哈尔市",
        period: "2026/27 年度",
        status: "演示结果已生成",
        quality: "血缘完整",
        owner: "经营分析岗",
        timeLimit: "10:46",
      },
      {
        id: "overview-duty",
        businessObjectId: "management-view-duty-week-31",
        name: "第 31 周报送履责态势",
        category: "履责态势",
        scope: "东北区域经营中心",
        period: "2026 年第 31 周",
        status: "滚动更新",
        quality: "截止快照已固定",
        owner: "运营管理岗",
        timeLimit: "今天 18:00",
      },
      {
        id: "overview-risk",
        businessObjectId: "management-view-publication-risk",
        name: "发布阻断风险清单",
        category: "风险预警",
        scope: "全部授权区域",
        period: "当前批次",
        status: "等待处置",
        quality: "5 项阻断",
        owner: "质量管理岗",
        timeLimit: "今天 16:00",
      },
    ],
    reports: [
      {
        id: "report-duty-weekly",
        businessObjectId: "report-definition-duty-weekly",
        name: "第 31 周人员履责报告",
        category: "履责报告",
        scope: "东北区域经营中心",
        period: "截止 2026-07-31 17:00",
        status: "等待复核",
        quality: "版本集合已锁定",
        owner: "报告复核岗",
        timeLimit: "今天 18:00",
      },
      {
        id: "report-market-weekly",
        businessObjectId: "report-definition-market-weekly",
        name: "玉米市场运行周报",
        category: "业务分析报告",
        scope: "齐齐哈尔市",
        period: "2026 年第 31 周",
        status: "生成中",
        quality: "演示指标完整",
        owner: "市场分析岗",
        timeLimit: "今天 18:30",
      },
      {
        id: "report-version",
        businessObjectId: "report-definition-grain-monthly",
        name: "七月粮食商情月报第 2 版",
        category: "报告版本",
        scope: "东北区域经营中心",
        period: "2026 年 7 月",
        status: "演示结果已生成",
        quality: "文件版本已固定",
        owner: "报告发布岗",
        timeLimit: "昨天 17:20",
      },
    ],
    governance: [
      {
        id: "governance-master-region",
        businessObjectId: "governance-asset-region-master",
        name: "行政区划主数据第 6 版",
        category: "主数据版本",
        scope: "三地市授权范围",
        period: "2026-07-01 起生效",
        status: "已经生效",
        quality: "层级校验通过",
        owner: "主数据管理员",
        timeLimit: "长期有效",
      },
      {
        id: "governance-quality-area",
        businessObjectId: "governance-asset-planting-quality-rule",
        name: "种植面积与产量勾稽规则第 4 版",
        category: "质量规则",
        scope: "产情监测",
        period: "2026 年调查轮次",
        status: "已经启用",
        quality: "5 项阻断待处置",
        owner: "质量规则管理员",
        timeLimit: "今天 16:00",
      },
      {
        id: "governance-metric-supply",
        businessObjectId: "governance-asset-corn-supply-metric",
        name: "玉米供需指标与公式第 3 版",
        category: "指标公式",
        scope: "供需与态势",
        period: "2026/27 年度",
        status: "等待审批",
        quality: "影响分析完成",
        owner: "指标治理岗",
        timeLimit: "明天 10:00",
      },
    ],
    system: [
      {
        id: "system-organization",
        businessObjectId: "organization-northeast-operation-center",
        name: "东北区域经营中心组织单元",
        category: "组织人员",
        scope: "东北区域经营中心",
        period: "当前有效",
        status: "已经生效",
        quality: "组织关系完整",
        owner: "组织管理员",
        timeLimit: "长期有效",
      },
      {
        id: "system-responsibility",
        businessObjectId: "responsibility-qqhr-corn-production",
        name: "齐齐哈尔玉米产情报送责任岗",
        category: "责任岗位",
        scope: "齐齐哈尔市 / 玉米产情",
        period: "2026-01-01 至 2026-12-31",
        status: "唯一负责人有效",
        quality: "无重叠无空档",
        owner: "责任管理员",
        timeLimit: "2026-12-31",
      },
      {
        id: "system-permission",
        businessObjectId: "permission-region-reviewer-v3",
        name: "区域审核员权限版本第 3 版",
        category: "角色权限",
        scope: "授权区域与业务事项",
        period: "2026-07-01 起生效",
        status: "已经生效",
        quality: "职责分离通过",
        owner: "安全管理员",
        timeLimit: "长期有效",
      },
    ],
  };
  const labelsByModule: Record<string, ModuleWorkspaceView["columnLabels"]> = {
    overview: {
      ...standardLabels,
      name: "经营视图",
      category: "视图类型",
      period: "数据期间",
      status: "运行状态",
      owner: "责任岗位",
    },
    reports: {
      ...standardLabels,
      name: "报告任务或版本",
      category: "报告类型",
      scope: "报告范围",
      period: "截止时点或期间",
      status: "报告状态",
      quality: "版本与复核",
      owner: "当前责任岗",
      timeLimit: "计划完成时间",
    },
    governance: {
      ...standardLabels,
      name: "治理资产",
      category: "资产类型",
      scope: "适用范围",
      period: "版本有效期",
      status: "版本状态",
      quality: "校验状态",
      owner: "治理责任岗",
      timeLimit: "下次节点",
    },
    system: {
      ...standardLabels,
      name: "组织与授权资产",
      category: "配置类型",
      scope: "责任或授权范围",
      period: "有效期",
      status: "生效状态",
      quality: "控制状态",
      owner: "管理责任岗",
      timeLimit: "有效截止",
    },
  };
  const controlByModule: Record<
    string,
    Pick<ModuleWorkspaceView, "controlTitle" | "controlItems">
  > = {
    overview: {
      controlTitle: "经营视图控制信息",
      controlItems: [
        { label: "责任岗位", value: "经营分析岗" },
        { label: "数据截止", value: "2026-07-31 17:00" },
        { label: "指标版本", value: "演示指标版本集合" },
        { label: "视图口径", value: "按当前账号责任范围投影" },
      ],
    },
    reports: {
      controlTitle: "报告生成控制信息",
      controlItems: [
        { label: "报告责任", value: "报告复核与发布岗" },
        { label: "数据截止", value: "报告运行时固定" },
        { label: "引用版本", value: "事实、指标与供需版本集合" },
        { label: "发布资格", value: "人工复核并审批通过" },
      ],
    },
    governance: {
      controlTitle: "数据治理控制信息",
      controlItems: [
        { label: "治理责任", value: "主数据与指标治理岗" },
        { label: "变更方式", value: "追加新版本，不覆盖历史" },
        { label: "影响分析", value: "生效前评估下游重算范围" },
        { label: "审计要求", value: "申请、审批、生效全程留痕" },
      ],
    },
    system: {
      controlTitle: "系统授权控制信息",
      controlItems: [
        { label: "管理责任", value: "组织、责任与安全管理员" },
        { label: "授权原则", value: "默认拒绝并按责任坐标授权" },
        { label: "职责分离", value: "填报、审核与发布岗位互斥" },
        { label: "生效方式", value: "审批后按有效期生效" },
      ],
    },
  };
  const control = controlByModule[module] ?? controlByModule.overview;
  return {
    eyebrow,
    title: `${baseTitle} · ${contextLabel}`,
    description,
    metrics: metricsByModule[module] ?? metricsByModule.overview,
    lifecycleTitle: "受控业务生命周期",
    lifecycleNote: "定义、执行、审核、发布和替代均保留不可变记录",
    lifecycle: lifecycleByModule[module] ?? lifecycleByModule.overview,
    notices: [
      {
        id: `${module}-notice-1`,
        title: "待关闭的阻断事项",
        detail: "需要责任岗位在时限内处理",
        tone: "danger",
      },
      {
        id: `${module}-notice-2`,
        title: "临近截止任务",
        detail: "系统已进入提醒窗口",
        tone: "warning",
      },
      {
        id: `${module}-notice-3`,
        title: "版本状态正常",
        detail: "当前演示版本可追溯",
        tone: "default",
      },
    ],
    tableTitle: `${baseTitle}工作清单`,
    tableDescription: "只呈现当前账号可访问范围内的演示事项。",
    sectionNavigation: sectionNavigation(`${baseTitle}工作清单`),
    controlTitle: control.controlTitle,
    controlItems: control.controlItems,
    columnLabels: labelsByModule[module] ?? standardLabels,
    records: recordsByModule[module] ?? recordsByModule.overview,
  };
}

export function resolveModuleWorkspace(
  pathname: string,
): ModuleWorkspaceView | undefined {
  const [module = "", context = module] = pathname.split("/").filter(Boolean);
  const allowedContexts: Readonly<Record<string, readonly string[]>> = {
    production: ["production", "planting", "stock", "sales", "intention"],
    market: [
      "market",
      "subjects",
      "trading",
      "inventory",
      "processing",
      "logistics",
      "agri-inputs",
    ],
    supply: ["supply", "accounts", "balance", "realtime", "map", "lineage"],
    overview: ["overview", "responsibility", "risk"],
    reports: ["reports", "duty", "business", "versions"],
    governance: ["governance", "master-data", "quality", "metrics", "lineage"],
    system: [
      "system",
      "organization",
      "responsibility",
      "permissions",
      "security",
    ],
  };

  if (!allowedContexts[module]?.includes(context)) return undefined;
  if (module === "production") return productionView(context);
  if (module === "market") return marketView(context);
  if (module === "supply") return supplyView(context);
  if (["overview", "reports", "governance", "system"].includes(module)) {
    return managementView(module, context);
  }
  return undefined;
}
